import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { moonPotential, defensiveRisk } from "../src/strategy.js";
import { label, shuffle, passCards, createState } from "../src/game.js";
import { choosePass as oldPass } from "../test/fixtures/ai-v1.js";
import { rollout as baselineRollout } from "../src/rollout.js";

const root = process.argv[2] || "artifacts/decision-audit-20261031";
const { rollout: defensiveRollout } = await import(pathToFileURL(path.resolve("artifacts/moon-defense-next/src/rollout.js")).href);
let considered = 0;
const candidates = [];
for (const name of fs.readdirSync(root).filter((name) => /^worker-\d+$/.test(name)).sort()) {
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(root, name, "rounds.jsonl")), crlfDelay: Infinity })) {
    if (!line) continue;
    const round = JSON.parse(line);
    if (!round.direction) continue; considered++;
    const hand = round.beforePass[round.seat];
    if (!hand.includes(51) || round.beforePassMoonPotential > .7) continue;
    const originalPass = round.passes[round.seat], retained = hand.filter((c) => !originalPass.includes(c)), original = moonPotential(retained);
    let best = { potential: original, pass: originalPass, risk: defensiveRisk(retained) };
    for (let a = 0; a < 11; a++) for (let b = a + 1; b < 12; b++) for (let c = b + 1; c < 13; c++) {
      const keep = hand.filter((_, i) => i !== a && i !== b && i !== c), potential = moonPotential(keep), risk = defensiveRisk(keep);
      if (potential > best.potential || (potential === best.potential && risk < best.risk)) best = { potential, pass: [hand[a], hand[b], hand[c]], risk };
    }
    if (best.potential >= .8 && best.potential - original >= .4) candidates.push({ id: name + "/" + round.game + "/" + round.round, seat: round.seat, direction: round.direction, hand, originalPass, alternatePass: best.pass, originalRetainedPotential: original, alternateRetainedPotential: best.potential, openingPotential: round.beforePassMoonPotential, originalRisk: defensiveRisk(retained), alternateRisk: best.risk });
  }
}
candidates.sort((a, b) => (b.alternateRetainedPotential - b.originalRetainedPotential) - (a.alternateRetainedPotential - a.originalRetainedPotential) || a.id.localeCompare(b.id));
const seeded = (initial) => { let n = initial >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };
const reports = [];
for (const [index, item] of candidates.slice(0, 12).entries()) {
  const rng = seeded(0x28d781 + index * 65537), pool = Array.from({ length: 52 }, (_, c) => c).filter((c) => !item.hand.includes(c));
  const sums = [0, 0].map(() => [{ value: 0, points: 0, moons: 0, difference: 0, differenceSquare: 0 }, { value: 0, points: 0, moons: 0, difference: 0, differenceSquare: 0 }]);
  const samples = 512;
  for (let n = 0; n < samples; n++) {
    const others = shuffle(pool.slice(), rng), hands = Array.from({ length: 4 }, (_, p) => p === item.seat ? item.hand.slice() : []);
    let at = 0; for (let p = 0; p < 4; p++) if (p !== item.seat) { hands[p] = others.slice(at, at + 13).sort((a, b) => a - b); at += 13; }
    const selections = hands.map((h, p) => p === item.seat ? [] : oldPass(h)), randomSeed = Math.floor(rng() * 4294967296);
    for (const [model, rollout] of [baselineRollout, defensiveRollout].entries()) {
      const values = [];
      for (let arm = 0; arm < 2; arm++) {
        const passed = structuredClone(hands), passes = selections.map((x) => x.slice());
        passes[item.seat] = arm === 0 ? item.originalPass : item.alternatePass; passCards(passed, passes, item.direction);
        const world = createState(passed), scores = rollout(world, null, seeded(randomSeed), item.seat, moonPotential(passed[item.seat]) > .7, true);
        const value = scores.reduce((sum, x, p) => sum + (p === item.seat ? 0 : x), 0) / 3 - scores[item.seat];
        values.push(value); sums[model][arm].value += value; sums[model][arm].points += scores[item.seat]; sums[model][arm].moons += Number(scores.every((x, p) => x === (p === item.seat ? 0 : 26)));
      }
      const delta = values[1] - values[0]; sums[model][1].difference += delta; sums[model][1].differenceSquare += delta * delta;
    }
  }
  const models = sums.map((arms, i) => ({ model: i === 0 ? "baseline-rollout" : "defensive-opponent-rollout", samples, arms: arms.map((a, j) => ({ pass: j === 0 ? "original" : "alternate", value: a.value / samples, ownPoints: a.points / samples, moonFrequency: a.moons / samples })), pairedValueDifference: arms[1].difference / samples, pairedStandardError: Math.sqrt(Math.max(0, arms[1].differenceSquare / samples - (arms[1].difference / samples) ** 2) / samples) }));
  reports.push({ ...item, labels: { hand: item.hand.map(label), originalPass: item.originalPass.map(label), alternatePass: item.alternatePass.map(label) }, models });
}
const report = { at: new Date().toISOString(), exploratory: true, note: "Passing hypotheses only: retained-hand moon scores are not success probabilities. Counterfactual worlds use own pre-pass hand only, uniform unknown initial deals and the frozen original opponents' passing policy. Full-game private-agent confirmation is required before changing passing.", consideredHandsWithPassing: considered, flaggedHands: candidates.length, reviewedHands: reports.length, reports };
fs.writeFileSync(path.join(root, "passing-analysis.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ consideredHandsWithPassing: considered, flaggedHands: candidates.length, reports: reports.map((r) => ({ id: r.id, ...r.labels, models: r.models })) }));
