import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { deal, createState, legal, play, roundScores, passCards } from "../src/game.js";
import { observe } from "../src/observation.js";
import { decide as oldDecide, choosePass as oldPass, observe as oldObserve } from "../test/fixtures/ai-v1.js";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes("--" + name) ? args[args.indexOf("--" + name) + 1] : fallback;
const count = Number(option("games", 40)), seed = Number(option("seed", 20273101));
const samples = Number(option("samples", 64)), opponentSamples = Number(option("opponent-samples", 16));
const rolloutBudgetPerAction = Number(option("rollout-budget", 0));
const snapshot = option("snapshot", "artifacts/decision-audit-20261031/baseline");
const output = option("out", "artifacts/decision-audit-20261031/worker-0");
const opponents = option("opponents", "original");
for (const n of [count, samples, opponentSamples]) assert.ok(Number.isInteger(n) && n > 0);
assert.ok(Number.isInteger(seed));
assert.ok(Number.isInteger(rolloutBudgetPerAction) && rolloutBudgetPerAction >= 0);
assert.ok(["original", "self", "baseline"].includes(opponents));
const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, "analysis-manifest.json")));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [file, expected] of Object.entries(manifest.hashes)) assert.equal(hash(fs.readFileSync(path.join(snapshot, file))), expected, file);
assert.equal(hash(fs.readFileSync(path.join(snapshot, manifest.diagnosticFile))), manifest.diagnosticSha256);
// The engine only receives observe(); complete hands below are stored for offline replay.
const instrumented = await import(pathToFileURL(path.resolve(snapshot, manifest.diagnosticFile)).href);
const baseline = await import(pathToFileURL(path.resolve(snapshot, "src/ai.js")).href);
const baselineStrategy = await import(pathToFileURL(path.resolve(snapshot, "src/strategy.js")).href);
const opponentPath = option("opponent-engine", "artifacts/decision-audit-20261031/baseline/src/ai.js");
const opponent = opponents === "baseline" ? await import(pathToFileURL(path.resolve(opponentPath)).href) : baseline;
let opponentManifest;
if (opponents === "baseline") {
  const base = path.resolve(path.dirname(opponentPath), "..");
  opponentManifest = JSON.parse(fs.readFileSync(path.join(base, "analysis-manifest.json")));
  for (const [file, expected] of Object.entries(opponentManifest.hashes)) assert.equal(hash(fs.readFileSync(path.join(base, file))), expected, "Opponent snapshot: " + file);
}
for (const file of ["src/game.js", "src/observation.js", "test/fixtures/ai-v1.js"])
  assert.equal(hash(fs.readFileSync(file)), manifest.hashes[file], "Analysis host changed: " + file);
const seeded = (initial) => { let n = initial >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };
assert.ok(!fs.existsSync(output), "Trace directories are immutable; choose a fresh output");
fs.mkdirSync(output, { recursive: true });
const runId = randomUUID();
const meta = { version: 1, runId, seed, games: count, samples, opponentSamples, rolloutBudgetPerAction, opponents, ...(opponents === "baseline" ? { opponentEngine: path.resolve(opponentPath), opponentEngineSha256: hash(fs.readFileSync(opponentPath)), opponentManifest } : {}), snapshot: path.resolve(snapshot), createdAt: new Date().toISOString(), exploratory: true, manifest, driverSha256: hash(fs.readFileSync(new URL(import.meta.url))) };
fs.writeFileSync(path.join(output, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
const atomic = (file, value) => { fs.writeFileSync(file + ".tmp", JSON.stringify(value, null, 2) + "\n"); fs.renameSync(file + ".tmp", file); };
const records = [];
let totalRounds = 0, decisions = 0, parityChecks = 0;
const started = performance.now();
for (let game = 0; game < count; game++) {
  const seat = game % 4, totals = [0, 0, 0, 0], dealRng = seeded(seed + Math.floor(game / 4) * 65537);
  const streams = Array.from({ length: 4 }, (_, p) => seeded(seed + game * 997 + p * 101 + 71));
  let round = 0;
  do {
    const hands = deal(dealRng), beforePass = structuredClone(hands), direction = [1, 3, 2, 0][round % 4];
    const known = Array.from({ length: 4 }, () => ({})), received = Array(4).fill(null);
    const selections = direction ? hands.map((hand, p) => p === seat ? baseline.choosePass(hand, { direction }) : opponents === "original" ? oldPass(hand) : opponent.choosePass(hand, { direction })) : hands.map(() => []);
    if (direction) {
      for (let p = 0; p < 4; p++) {
        known[p][(p + direction) % 4] = [...selections[p]];
        const from = (p - direction + 4) % 4;
        received[p] = { from, cards: [...selections[from]] };
      }
      passCards(hands, selections, direction);
    }
    const state = createState(hands), observations = [], moves = [], totalsBefore = totals.slice();
    while (state.completed < 13) {
      const p = state.turn;
      const o = p === seat || opponents !== "original" ? observe(state, p, known[p], totals, received[p]) : oldObserve(state, p, known[p]);
      let result;
      if (p === seat) {
        // Pass-through RNG tracing verifies diagnostics do not change the engine's policy.
        const calls = [], random = () => { const value = streams[p](); calls.push(value); return value; };
        const options = { milliseconds: 0, minSamples: samples, ...(rolloutBudgetPerAction ? { maxSimulations: rolloutBudgetPerAction * legal(state).length } : {}) };
        result = instrumented.decide(o, { ...options, rng: random });
        if (rolloutBudgetPerAction) assert.ok(result.simulations <= options.maxSimulations);
        if (game === 0) {
          let at = 0;
          const original = baseline.decide(o, { ...options, rng: () => { assert.ok(at < calls.length); return calls[at++]; } });
          assert.equal(at, calls.length); assert.equal(original.card, result.card);
          const clean = structuredClone(result); delete clean.analysis;
          for (const estimate of clean.estimates || []) delete estimate.analysis;
          assert.deepEqual(clean, original); parityChecks++;
        }
        observations.push({ move: moves.length, observation: o, result }); decisions++;
      } else result = (opponents === "original" ? oldDecide : opponent.decide)(o, { milliseconds: 0, minSamples: opponentSamples, rng: streams[p] });
      assert.ok(legal(state).includes(result.card));
      moves.push({ player: p, card: result.card }); play(state, result.card);
    }
    const scores = roundScores(state.taken);
    for (let p = 0; p < 4; p++) totals[p] += scores[p];
    const data = { runId, game, seat, round, direction, totalsBefore, beforePass, passes: selections, ownPostPass: hands[seat], openingMoonPotential: baselineStrategy.moonPotential(hands[seat]), beforePassMoonPotential: baselineStrategy.moonPotential(beforePass[seat]), moves, decisions: observations, taken: state.taken, scores, totalsAfter: totals.slice() };
    fs.appendFileSync(path.join(output, "rounds.jsonl"), JSON.stringify(data) + "\n");
    totalRounds++; round++;
    atomic(path.join(output, "progress.json"), { at: new Date().toISOString(), state: "running", game, targetGames: count, completedGames: game, round, totalRounds, decisions, seconds: (performance.now() - started) / 1000 });
  } while (!totals.some((n) => n >= 100));
  const low = Math.min(...totals), winners = totals.flatMap((n, p) => n === low ? [p] : []);
  records.push({ game, seat, rounds: round, totals, winners });
  atomic(path.join(output, "checkpoint.json"), { runId, completedGames: records.length, records });
  if (records.length % 4 === 0) console.error(JSON.stringify({ runId, completedGames: records.length, targetGames: count, rounds: totalRounds, seconds: (performance.now() - started) / 1000 }));
}
const result = { ...meta, state: "completed", completedAt: new Date().toISOString(), completedGames: records.length, totalRounds, decisions, parityChecks, seconds: (performance.now() - started) / 1000, records };
atomic(path.join(output, "result.json"), result);
atomic(path.join(output, "progress.json"), { at: result.completedAt, state: "completed", completedGames: records.length, targetGames: count, totalRounds, decisions });
console.log(JSON.stringify({ output, completedGames: count, totalRounds, decisions, parityChecks, seconds: result.seconds }));
