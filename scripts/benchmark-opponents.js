// Complete private-AI matches against an explicitly frozen recent opponent.
// Both roles call their normal uninstrumented engines with equal budgets.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { deal, createState, play, roundScores, passCards } from "../src/game.js";
import { observe } from "../src/observation.js";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes("--" + name) ? args[args.indexOf("--" + name) + 1] : fallback;
const candidatePath = path.resolve(option("candidate", "artifacts/match-research-20261031/baseline"));
const opponentPath = path.resolve(option("baseline", "artifacts/match-research-20261031/baseline"));
const output = path.resolve(option("out", "artifacts/head-to-head"));
const count = Number(option("games", 80)), milliseconds = Number(option("ms", 200)), samples = Number(option("samples", 16)), seed = Number(option("seed", 20360107));
assert.ok(Number.isInteger(count) && count > 0 && count % 4 === 0);
assert.ok(Number.isInteger(samples) && samples > 0 && Number.isInteger(seed));
assert.ok(Number.isFinite(milliseconds) && milliseconds >= 0);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function snapshot(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "analysis-manifest.json")));
  for (const [file, expected] of Object.entries(manifest.hashes)) assert.equal(hash(fs.readFileSync(path.join(directory, file))), expected, directory + "/" + file);
  return manifest;
}
const candidateManifest = snapshot(candidatePath), opponentManifest = snapshot(opponentPath);
for (const file of ["src/game.js", "src/observation.js"]) {
  assert.equal(hash(fs.readFileSync(file)), candidateManifest.hashes[file]);
  assert.equal(candidateManifest.hashes[file], opponentManifest.hashes[file]);
}
const candidate = await import(pathToFileURL(path.join(candidatePath, "src/ai.js")).href);
const opponent = await import(pathToFileURL(path.join(opponentPath, "src/ai.js")).href);
const driverSha = hash(fs.readFileSync(new URL(import.meta.url)));
const budget = { old: { milliseconds, minSamples: samples }, new: { milliseconds, minSamples: samples } };
const experimentalProvenance = { benchmark: "frozen-private-head-to-head-v1", normalUninstrumentedEngines: true, driverSha, baselineHashes: opponentManifest.hashes, candidateHashes: candidateManifest.hashes };
const config = { seed, games: count, budget, experimentalProvenance };
fs.mkdirSync(output, { recursive: true });
const lock = path.join(output, "process.json");
const processStart = fs.readFileSync("/proc/self/stat", "utf8").split(") ")[1].split(" ")[19];
if (fs.existsSync(lock)) {
  const previous = JSON.parse(fs.readFileSync(lock));
  let alive = false;
  try {
    const stat = fs.readFileSync("/proc/" + previous.pid + "/stat", "utf8").split(") ")[1];
    const command = fs.readFileSync("/proc/" + previous.pid + "/cmdline", "utf8");
    alive = stat[0] !== "Z" && stat.split(" ")[19] === previous.processStart && command.includes("benchmark-opponents.js");
  } catch {}
  assert.ok(!alive, "This benchmark is already running");
  fs.rmSync(lock);
}
const atomic = (file, data) => { fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2) + "\n"); fs.renameSync(file + ".tmp", file); };
const lockFd = fs.openSync(lock, "wx");
fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, processStart, output }) + "\n");
fs.closeSync(lockFd);
const checkpoint = path.join(output, "checkpoint.json"), start = performance.now();
const fresh = { config, runId: randomUUID(), startedAt: new Date().toISOString(), resumes: [], records: [], engineTimeMs: [0, 0], decisionCounts: [0, 0], passingTimeMs: [0, 0], passingCounts: [0, 0], activeSeconds: 0 };
const saved = fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint)) : fresh;
assert.deepEqual(saved.config, config, "Never resume with changed sources, driver or parameters");
const records = saved.records;
assert.ok(records.length <= count);
for (const [i, row] of records.entries()) { assert.equal(row.game, i); assert.equal(row.newSeat, i % 4); assert.ok(Math.max(...row.totals) >= 100); }
const completedRounds = records.reduce((sum, r) => sum + r.rounds, 0);
assert.deepEqual(saved.decisionCounts, [13 * completedRounds, 39 * completedRounds]);
const completedPasses = records.reduce((sum, r) => sum + r.rounds - Math.floor(r.rounds / 4), 0);
assert.deepEqual(saved.passingCounts, [completedPasses, 3 * completedPasses]);
for (const values of [saved.engineTimeMs, saved.passingTimeMs]) assert.ok(values.length === 2 && values.every((n) => Number.isFinite(n) && n >= 0));
if (fs.existsSync(path.join(output, "result.json"))) {
  const finished = JSON.parse(fs.readFileSync(path.join(output, "result.json")));
  assert.equal(records.length, count); assert.equal(finished.runId, saved.runId); assert.equal(finished.games, count);
  assert.deepEqual(finished.records, records); assert.deepEqual(finished.experimentalProvenance, experimentalProvenance); assert.deepEqual(finished.budget, budget);
  console.log(JSON.stringify({ completed: true, preservedExistingResult: true, file: path.join(output, "result.json"), games: count }));
  process.exit(0);
}
if (records.length && records.length < count) saved.resumes.push({ at: new Date().toISOString(), completedGames: records.length });
const { engineTimeMs, decisionCounts, passingTimeMs, passingCounts } = saved;
const activeSecondsBefore = saved.activeSeconds;
const seeded = (initial) => { let n = initial >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };
function saveCheckpoint() { saved.activeSeconds = activeSecondsBefore + (performance.now() - start) / 1000; atomic(checkpoint, saved); }
saveCheckpoint();
function progress(currentRound = 0, completedTricks = 0) {
  atomic(path.join(output, "progress.json"), { at: new Date().toISOString(), state: records.length === count ? "completed" : "running", runId: saved.runId, completedGames: records.length, targetGames: count, currentRound, completedTricks, milliseconds, minSamples: samples });
}
progress();
for (let game = records.length; game < count; game++) {
  const seat = game % 4, totals = [0, 0, 0, 0], dealRng = seeded(seed + Math.floor(game / 4) * 65537);
  const streams = Array.from({ length: 4 }, (_, p) => seeded(seed + game * 997 + p * 101 + 71));
  let round = 0;
  do {
    const hands = deal(dealRng), direction = [1, 3, 2, 0][round % 4], known = Array.from({ length: 4 }, () => ({})), received = Array(4).fill(null);
    if (direction) {
      const selections = hands.map((hand, p) => {
        const role = p === seat ? 0 : 1, began = performance.now();
        const cards = (role === 0 ? candidate : opponent).choosePass(hand, { direction });
        passingTimeMs[role] += performance.now() - began; passingCounts[role]++; return cards;
      });
      for (let p = 0; p < 4; p++) { known[p][(p + direction) % 4] = selections[p].slice(); const from = (p - direction + 4) % 4; received[p] = { from, cards: selections[from].slice() }; }
      passCards(hands, selections, direction);
    }
    const state = createState(hands); progress(round, 0);
    while (state.completed < 13) {
      const p = state.turn, role = p === seat ? 0 : 1, o = observe(state, p, known[p], totals, received[p]);
      assert.equal(o.hands, undefined);
      const began = performance.now();
      const result = (role === 0 ? candidate : opponent).decide(o, { milliseconds, minSamples: samples, rng: streams[p] });
      engineTimeMs[role] += performance.now() - began; decisionCounts[role]++;
      const trick = play(state, result.card);
      if (trick && (state.completed % 2 === 0 || state.completed === 13)) progress(round, state.completed);
    }
    const scores = roundScores(state.taken); scores.forEach((n, p) => { totals[p] += n; }); round++;
  } while (!totals.some((n) => n >= 100));
  const low = Math.min(...totals), winners = totals.flatMap((n, p) => n === low ? [p] : []);
  records.push({ game, newSeat: seat, rounds: round, totals, winners });
  saveCheckpoint(); progress();
  console.error(JSON.stringify({ runId: saved.runId, completedGames: records.length, targetGames: count }));
}
const wins = [0, 0, 0, 0], unique = [0, 0, 0, 0], points = [0, 0, 0, 0];
for (const row of records) {
  const role = (p) => p === row.newSeat ? 0 : 1 + (p - row.newSeat + 3) % 4;
  row.totals.forEach((n, p) => { points[role(p)] += n; });
  for (const p of row.winners) { wins[role(p)] += 1 / row.winners.length; if (row.winners.length === 1) unique[role(p)]++; }
}
const sourceHashes = Object.fromEntries(Object.entries(candidateManifest.hashes).filter(([file]) => file.startsWith("src/") || file === "test/fixtures/ai-v1.js"));
sourceHashes.activeEngine = candidateManifest.hashes["src/ai.js"];
const result = { runId: saved.runId, mode: "matches-to-100", sourceHashes, experimentalProvenance, seed, games: count, rounds: records.reduce((sum, r) => sum + r.rounds, 0), budget, engines: ["candidate", "frozen-baseline-left", "frozen-baseline-across", "frozen-baseline-right"], winShares: wins.map((n) => n / count), outrightWins: unique, meanPoints: points.map((n) => n / count), meanDecisionMilliseconds: engineTimeMs.map((n, i) => n / decisionCounts[i]), meanPassingMilliseconds: passingTimeMs.map((n, i) => n / Math.max(1, passingCounts[i])), normalUninstrumentedEngines: true, node: process.version, startedAt: saved.startedAt, completedAt: new Date().toISOString(), resumes: saved.resumes, seconds: saved.activeSeconds, records };
atomic(path.join(output, "result.json"), result); progress();
console.log(JSON.stringify({ completed: true, file: path.join(output, "result.json"), games: count }));
