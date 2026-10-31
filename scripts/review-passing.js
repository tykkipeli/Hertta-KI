import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { shuffle, passCards, createState, play, legal, roundScores } from "../src/game.js";
import { observe } from "../src/observation.js";
import { lateMatchValue } from "../src/utility.js";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes("--" + name) ? args[args.indexOf("--" + name) + 1] : fallback;
const root = option("root", "artifacts/decision-audit-20261031");
const worker = Number(option("worker", 0)), workers = Number(option("workers", 4)), worlds = Number(option("worlds", 64)), samples = Number(option("samples", 64));
const output = path.join(root, "passing-private-" + worker + ".jsonl");
assert.ok(!fs.existsSync(output));
const engine = await import(pathToFileURL(path.resolve(root, "baseline/src/ai.js")).href);
const report = JSON.parse(fs.readFileSync(path.join(root, "passing-analysis.json")));
const seeded = (initial) => { let n = initial >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };
for (const [caseIndex, item] of report.reports.slice(0, 3).entries()) {
  for (let worldIndex = 0; worldIndex < worlds; worldIndex++) {
    if (worldIndex % workers !== worker) continue;
    const random = seeded(20299503 + caseIndex * 1000003 + worldIndex * 65537);
    const pool = shuffle(Array.from({ length: 52 }, (_, c) => c).filter((c) => !item.hand.includes(c)), random);
    const hands = Array.from({ length: 4 }, (_, p) => p === item.seat ? item.hand.slice() : []);
    let at = 0; for (let p = 0; p < 4; p++) if (p !== item.seat) { hands[p] = pool.slice(at, at + 13).sort((a, b) => a - b); at += 13; }
    const outgoing = hands.map((h, p) => p === item.seat ? [] : engine.choosePass(h, { direction: item.direction }));
    const results = [];
    for (let arm = 0; arm < 2; arm++) {
      const passed = structuredClone(hands), selections = structuredClone(outgoing), known = Array.from({ length: 4 }, () => ({})), received = [];
      selections[item.seat] = arm === 0 ? item.originalPass : item.alternatePass;
      for (let p = 0; p < 4; p++) {
        known[p][(p + item.direction) % 4] = selections[p].slice();
        const from = (p - item.direction + 4) % 4; received[p] = { from, cards: selections[from].slice() };
      }
      passCards(passed, selections, item.direction);
      const state = createState(passed), streams = Array.from({ length: 4 }, (_, p) => seeded(0x67d9 + worldIndex * 997 + p * 101));
      while (state.completed < 13) {
        const p = state.turn, o = observe(state, p, known[p], [0, 0, 0, 0], received[p]);
        assert.equal(o.hands, undefined);
        const result = engine.decide(o, { milliseconds: 0, minSamples: samples, rng: streams[p] });
        assert.ok(legal(state).includes(result.card)); play(state, result.card);
      }
      const scores = roundScores(state.taken), value = scores.reduce((sum, n, p) => sum + (p === item.seat ? 0 : n), 0) / 3 - scores[item.seat];
      results.push({ arm: arm === 0 ? "original-pass" : "alternate-pass", ownHandAfterPassing: passed[item.seat], taken: state.taken, scores, ownPoints: scores[item.seat], ownMoon: state.taken[item.seat] === 26, relativeValue: value, continuationWinEstimate: lateMatchValue(scores, [0, 0, 0, 0], item.seat) });
    }
    fs.appendFileSync(output, JSON.stringify({ caseId: item.id, exploratory: true, conditionedOnOwnInitialHandOnly: true, worlds, worldIndex, samples, players: "Four unchanged frozen 85331e2 AIs with independent private observations", totalsBefore: [0, 0, 0, 0], initialHands: hands, direction: item.direction, results }) + "\n");
    console.error(JSON.stringify({ worker, caseId: item.id, worldIndex, worlds }));
  }
}
