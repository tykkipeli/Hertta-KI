import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes("--" + name) ? args[args.indexOf("--" + name) + 1] : fallback;
const root = option("root", "artifacts/decision-audit-20261031");
const snapshot = path.resolve(option("snapshot", path.join(root, "baseline"))), worker = Number(option("worker", 0)), workers = Number(option("workers", 1));
const count = Number(option("take", 4)), samples = Number(option("samples", 2048)), timedMs = Number(option("timed-ms", 1200));
const output = option("out", path.join(root, "review-" + worker + ".jsonl"));
const onlyIds = option("ids", "").split(",").filter(Boolean);
assert.ok(!fs.existsSync(output), "Do not overwrite an earlier review");
const load = (file) => import(pathToFileURL(path.join(snapshot, "src", file)).href);
const [{ createDealSampler }, { createQueenBelief }, { rollout }, utility, strategy, game, agent] = await Promise.all(["deals.js", "queen-belief.js", "rollout.js", "utility.js", "strategy.js", "game.js", "agent.js"].map(load));
const selected = [], seen = new Set();
for (const [kind, cases] of Object.entries(JSON.parse(fs.readFileSync(path.join(root, "cases.json"))))) {
  for (const item of cases.slice(0, count)) {
    if (seen.has(item.id) || (onlyIds.length && !onlyIds.includes(item.id))) continue; seen.add(item.id); selected.push({ ...item, selectedKind: kind });
  }
}
const seeded = (initial) => { let n = initial >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };
const pairedRandom = (initial) => { let stream = initial; return () => { let z = (stream += 0x6d2b79f5); z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; }; };
function evaluate(item, mode, seed) {
  const o = item.observation, base = { ...o, hands: Array.from({ length: 4 }, (_, p) => p === o.player ? o.hand : []) }, choices = game.legal(base);
  const draw = createDealSampler(o), belief = createQueenBelief(o, draw), random = seeded(seed);
  const original = [...o.hand, ...o.history.flatMap((t) => t.trick).concat(o.trick).filter((x) => x.player === o.player).map((x) => x.card)];
  const openingMoonPlan = strategy.moonPotential(original) > .7;
  const terminal = utility.matchEndsThisRound(o), late = terminal || utility.matchEndThreat(o);
  const acc = choices.map((card) => ({ card, value: 0, ownPoints: 0, moon: 0, opponentMoon: 0, delta: 0, deltaSquare: 0, pointsDelta: 0, pointsDeltaSquare: 0 }));
  const reference = choices.indexOf(item.result.card); assert.ok(reference >= 0);
  let n = 0;
  for (; n < samples; n++) {
    const world = belief.next(random); assert.ok(world);
    const sharedSeed = Math.floor(random() * 4294967296);
    const values = [], pointsValues = [];
    for (let i = 0; i < choices.length; i++) {
      const scores = rollout(world, choices[i], pairedRandom(sharedSeed), mode === "conservative" ? -1 : mode === "all-tactical" ? -2 : o.player, mode === "moon" || (mode !== "adaptive-moon" && openingMoonPlan), mode !== "conservative");
      const pointsValue = scores.reduce((sum, x, p) => sum + (p === o.player ? 0 : x), 0) / 3 - scores[o.player];
      const value = terminal ? utility.terminalWinShare(scores, o.totals, o.player) : late ? utility.lateMatchValue(scores, o.totals, o.player) : pointsValue;
      values.push(value); pointsValues.push(pointsValue);
      acc[i].value += value; acc[i].ownPoints += scores[o.player];
      acc[i].moon += Number(scores.every((x, p) => x === (p === o.player ? 0 : 26)));
      acc[i].opponentMoon += Number(scores.some((x, p) => p !== o.player && x === 0 && scores.every((y, q) => y === (p === q ? 0 : 26))));
    }
    for (let i = 0; i < choices.length; i++) {
      const delta = values[i] - values[reference], pd = pointsValues[i] - pointsValues[reference];
      acc[i].delta += delta; acc[i].deltaSquare += delta * delta;
      acc[i].pointsDelta += pd; acc[i].pointsDeltaSquare += pd * pd;
    }
  }
  const estimates = acc.map((a) => ({ card: a.card, label: game.label(a.card), value: a.value / n, ownPoints: a.ownPoints / n, moon: a.moon / n, opponentMoon: a.opponentMoon / n, deltaFromRecorded: a.delta / n, pairedStandardError: Math.sqrt(Math.max(0, a.deltaSquare / n - (a.delta / n) ** 2) / n), pointsDeltaFromRecorded: a.pointsDelta / n, pointsPairedStandardError: Math.sqrt(Math.max(0, a.pointsDeltaSquare / n - (a.pointsDelta / n) ** 2) / n) }));
  estimates.sort((a, b) => b.value - a.value || b.pointsDeltaFromRecorded - a.pointsDeltaFromRecorded);
  return { mode, samples: n, objective: terminal ? "match-win" : late ? "late-match-win-estimate" : "round-penalties", beliefMode: belief.mode, openingMoonPlan, estimates };
}
let completed = 0;
for (const [index, item] of selected.entries()) {
  if (index % workers !== worker) continue;
  const seed = createHash("sha256").update("independent-review:" + item.id).digest().readUInt32LE();
  const timed = agent.decide(item.observation, { milliseconds: timedMs, minSamples: 16, rng: seeded(seed ^ 0x25bed912) });
  const reviews = ["baseline", "adaptive-moon", "conservative", "moon", "all-tactical"].map((mode) => evaluate(item, mode, seed));
  const record = { id: item.id, kind: item.selectedKind, exploratory: true, observationsOnly: true, recordedCard: item.result.card, recordedLabel: game.label(item.result.card), timedRecheck: { milliseconds: timedMs, ...timed }, reviews };
  fs.appendFileSync(output, JSON.stringify(record) + "\n"); completed++;
  console.error(JSON.stringify({ worker, completed, totalSelected: selected.length, case: item.id, kind: item.selectedKind, timedCard: game.label(timed.card), original: game.label(item.result.card), bestBaseline: reviews[0].estimates[0] }));
}
console.log(JSON.stringify({ output, completed }));
