import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const out = process.argv[2] || "artifacts/match-research-20261031/calibration";
assert.ok(!fs.existsSync(out), "Preserve earlier calibration outputs");
fs.mkdirSync(out, { recursive: true });
const sources = ["artifacts/decision-self-audit-20261031", "artifacts/moon-defense-comparison-20261031/control"];
const rows = [], games = new Set(), blocks = new Set(), inputs = [];
for (const root of sources) for (let worker = 0; worker < 4; worker++) {
  const dir = path.join(root, "worker-" + worker), meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"))), result = JSON.parse(fs.readFileSync(path.join(dir, "result.json")));
  assert.equal(result.state, "completed"); assert.equal(meta.samples, 64); assert.equal(meta.opponentSamples, 64);
  assert.ok(meta.opponents === "self" || meta.opponents === "baseline");
  if (meta.opponents === "baseline") assert.deepEqual(meta.manifest.hashes, meta.opponentManifest.hashes);
  inputs.push({ directory: dir, runId: meta.runId, traceSha256: createHash("sha256").update(fs.readFileSync(path.join(dir,"rounds.jsonl"))).digest("hex"), sourceHashes: meta.manifest.hashes });
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(dir, "rounds.jsonl")), crlfDelay: Infinity })) {
    if (!line) continue;
    const r = JSON.parse(line); assert.equal(r.runId, result.runId);
    const record = result.records[r.game]; assert.equal(record.game, r.game);
    const block = (meta.seed + Math.floor(r.game / 4) * 65537) >>> 0;
    const game = meta.runId + "/" + r.game; games.add(game); blocks.add(block);
    if (Math.max(...r.totalsBefore) === 0) continue;
    assert.ok(Math.max(...r.totalsBefore) < 100);
    const fold = createHash("sha256").update("equity-holdout:" + block).digest().readUInt32LE() % 5;
    rows.push({ block, game, totals: r.totalsBefore, winners: record.winners, split: fold === 0 ? "validation" : "training" });
  }
}
assert.equal(games.size, 480); assert.equal(blocks.size, 120);
const train = rows.filter((r) => r.split === "training"), test = rows.filter((r) => r.split === "validation");
assert.ok(train.length && test.length);
const trainBlocks = new Set(train.map((r) => r.block)), testBlocks = new Set(test.map((r) => r.block));
for (const block of testBlocks) assert.ok(!trainBlocks.has(block));
function forecast(totals, a, b, original = false) {
  const remaining = 100 - Math.max(...totals), low = Math.min(...totals);
  const temperature = original ? Math.sqrt(8 * Math.max(8, remaining)) : Math.sqrt(a * Math.max(1, remaining) + b);
  const weights = totals.map((n) => Math.exp((low - n) / temperature)), sum = weights.reduce((x, y) => x + y, 0);
  return weights.map((w) => w / sum);
}
function metrics(data, a, b, original = false) {
  let logLoss = 0, brier = 0;
  for (const row of data) {
    const probabilities = forecast(row.totals, a, b, original);
    for (let p = 0; p < 4; p++) {
      const target = row.winners.includes(p) ? 1 / row.winners.length : 0;
      if (target) logLoss -= target * Math.log(probabilities[p]);
      brier += (probabilities[p] - target) ** 2;
    }
  }
  return { rows: data.length, logLoss: logLoss / data.length, brier: brier / data.length };
}
let best;
const grid = [];
for (let a = 1; a <= 40; a++) for (const b of [0,16,36,64,100,144,196,256]) {
  const training = metrics(train, a, b); grid.push({ a, b, ...training });
  if (!best || training.logLoss < best.training.logLoss) best = { a, b, training };
}
const validation = metrics(test, best.a, best.b), heuristicValidation = metrics(test, 8, 64, true);
const bands = [[0,50],[50,74],[74,90],[90,100]].map(([min,max]) => {
  const subset = test.filter((r) => Math.max(...r.totals) >= min && Math.max(...r.totals) < max);
  return { min, max, fitted: subset.length ? metrics(subset,best.a,best.b) : null, heuristic: subset.length ? metrics(subset,8,64,true) : null };
});
const result = { at: new Date().toISOString(), purpose: "Exploratory public-score match-win forecast, not a strength proof", sourceMatches: games.size, sourceDealBlocks: blocks.size, trainingBlocks: trainBlocks.size, validationBlocks: testBlocks.size, trainRows: train.length, validationRows: test.length, splitRule: "SHA256 of whole four-game deal-block seed; fold zero held out. No validation labels used to select parameters.", fitted: { a: best.a, b: best.b, formula: "temperature=sqrt(a*max(1,100-max(total))+b)", training: best.training, validation }, heuristic: { formula: "temperature=sqrt(8*max(8,100-max(total)))", training: metrics(train,8,64,true), validation: heuristicValidation }, bands, limitation: "Source games use the frozen 85331e2 self-play policy at 64 worlds. Improved forecast calibration does not establish improved decisions; a separate fresh complete-match comparison is required.", inputs };
fs.writeFileSync(path.join(out,"calibration.json"),JSON.stringify(result,null,2)+"\n");
fs.writeFileSync(path.join(out,"training-grid.json"),JSON.stringify(grid,null,2)+"\n");
fs.writeFileSync(path.join(out,"rows.json"),JSON.stringify(rows)+"\n");
console.log(JSON.stringify({ ...result, inputs: undefined },null,2));
