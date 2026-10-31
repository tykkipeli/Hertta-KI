import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.argv[2] || "artifacts/moon-defense-comparison-20261031";
const plan = JSON.parse(fs.readFileSync(path.join(root, "plan.json")));
assert.deepEqual(plan.arms, ["control", "moon-defense"]);
const blocks = [], ids = new Set(), records = { control: [], "moon-defense": [] };
let rounds = { control: 0, "moon-defense": 0 }, games = 0;
const manifests = {};
for (let w = 0; w < plan.workers; w++) {
  const runs = plan.arms.map((arm) => JSON.parse(fs.readFileSync(path.join(root, arm, "worker-" + w, "result.json"))));
  for (const [i, run] of runs.entries()) {
    assert.equal(run.state, "completed"); assert.equal(run.completedGames, plan.gamesPerWorker);
    assert.equal(run.records.length, plan.gamesPerWorker); assert.equal(run.seed, plan.seeds[w]);
    assert.equal(run.samples, plan.samples); assert.equal(run.opponentSamples, plan.opponentSamples);
    assert.equal(run.opponents, "baseline"); assert.ok(!ids.has(run.runId)); ids.add(run.runId);
    const arm = plan.arms[i];
    if (manifests[arm]) assert.deepEqual(run.manifest, manifests[arm]); else manifests[arm] = run.manifest;
    assert.deepEqual(run.opponentManifest, runs[0].opponentManifest);
    assert.deepEqual(run.opponentManifest.hashes, runs[0].manifest.hashes);
    if (i === 1) assert.deepEqual(run.manifest.baselineHashes, runs[0].manifest.hashes);
    rounds[plan.arms[i]] += run.totalRounds;
    for (const [game, row] of run.records.entries()) {
      assert.equal(row.game, game); assert.equal(row.seat, game % 4); assert.ok(Math.max(...row.totals) >= 100);
      assert.deepEqual(row.winners, row.totals.flatMap((n, p) => n === Math.min(...row.totals) ? [p] : []));
      records[plan.arms[i]].push(row);
    }
  }
  for (let start = 0; start < plan.gamesPerWorker; start += 4) {
    const shares = runs.map((run) => run.records.slice(start, start + 4).reduce((sum, row) => sum + (row.winners.includes(row.seat) ? 1 / row.winners.length : 0), 0) / 4);
    blocks.push({ seed: (plan.seeds[w] + Math.floor(start / 4) * 65537) >>> 0, control: shares[0], candidate: shares[1], delta: shares[1] - shares[0] }); games += 4;
  }
}
assert.equal(games, plan.gamesPerArm);
assert.equal(new Set(blocks.map((b) => b.seed)).size, blocks.length);
let seed = 0x73ba23;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const boot = { control: [], candidate: [], delta: [] };
for (let b = 0; b < 10000; b++) {
  const sums = { control: 0, candidate: 0, delta: 0 };
  for (let i = 0; i < blocks.length; i++) { const row = blocks[Math.floor(random() * blocks.length)]; for (const key of Object.keys(sums)) sums[key] += row[key]; }
  for (const key of Object.keys(sums)) boot[key].push(sums[key] / blocks.length);
}
const results = {};
for (const key of Object.keys(boot)) {
  boot[key].sort((a, b) => a - b);
  results[key] = { mean: blocks.reduce((sum, row) => sum + row[key], 0) / blocks.length, interval95: [boot[key][250], boot[key][9750]] };
}
const report = { at: new Date().toISOString(), exploratory: true, comparison: "One candidate versus three frozen copies of the previously proven 85331e2 AI", configuredSamples: plan.samples, opponentSamples: plan.opponentSamples, equalTimeBudget: false, gamesPerArm: games, independentDealBlocks: blocks.length, pairedWholeBlockBootstrapReplicates: 10000, rounds, results, sourceManifests: manifests, interpretation: "Fixed-sample selection data only. A positive exploratory result requires fresh equal-time confirmation before claiming stronger play at the GUI budgets.", blocks };
fs.writeFileSync(path.join(root, "comparison.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, blocks: undefined }, null, 2));
