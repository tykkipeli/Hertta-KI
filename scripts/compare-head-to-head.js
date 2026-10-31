// Compare complete frozen-engine experiments with common four-seat deal blocks.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const root = process.argv[2];
assert.ok(root, "Provide a campaign directory with plan.json");
const plan = JSON.parse(fs.readFileSync(path.join(root, "plan.json")));
assert.equal(plan.arms[0], "control");
assert.ok(plan.gamesPerWorker > 0 && plan.gamesPerWorker % 4 === 0);
assert.equal(plan.gamesPerArm, plan.workers * plan.gamesPerWorker);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(plan.snapshots.control, "analysis-manifest.json"))).hashes,
  JSON.parse(fs.readFileSync(path.join(plan.opponentSnapshot, "analysis-manifest.json"))).hashes,
  "Control must be the unchanged opponent engine");
const ids = new Set(), blocks = [], sourceManifests = {}, elapsed = {};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (let worker = 0; worker < plan.workers; worker++) {
  const runs = plan.arms.map((arm) => {
    const file = path.join(root, arm, "worker-" + worker, "result.json");
    const run = JSON.parse(fs.readFileSync(file));
    assert.equal(run.mode, "matches-to-100"); assert.equal(run.normalUninstrumentedEngines, true);
    assert.equal(run.games, plan.gamesPerWorker); assert.equal(run.records.length, plan.gamesPerWorker);
    assert.equal(run.seed, plan.seeds[worker]); assert.ok(!ids.has(run.runId)); ids.add(run.runId);
    assert.deepEqual(run.budget, { old: { milliseconds: plan.milliseconds, minSamples: plan.samples }, new: { milliseconds: plan.milliseconds, minSamples: plan.samples } });
    assert.equal(run.experimentalProvenance.benchmark, "frozen-private-head-to-head-v1");
    assert.equal(run.experimentalProvenance.driverSha, plan.driverSha256);
    const expected = JSON.parse(fs.readFileSync(path.join(plan.snapshots[arm], "analysis-manifest.json"))).hashes;
    const baseline = JSON.parse(fs.readFileSync(path.join(plan.opponentSnapshot, "analysis-manifest.json"))).hashes;
    assert.deepEqual(run.experimentalProvenance.candidateHashes, expected);
    assert.deepEqual(run.experimentalProvenance.baselineHashes, baseline);
    for (const [file, hash] of Object.entries(expected)) assert.equal(digest(fs.readFileSync(path.join(plan.snapshots[arm], file))), hash);
    for (const [file, hash] of Object.entries(baseline)) assert.equal(digest(fs.readFileSync(path.join(plan.opponentSnapshot, file))), hash);
    let rounds = 0;
    for (const [i, row] of run.records.entries()) {
      assert.equal(row.game, i); assert.equal(row.newSeat, i % 4);
      assert.ok(Number.isInteger(row.rounds) && row.rounds >= 4 && row.rounds <= 16);
      assert.ok(row.totals.length === 4 && row.totals.every((n) => Number.isInteger(n) && n >= 0));
      assert.ok(Math.max(...row.totals) >= 100);
      assert.deepEqual(row.winners, row.totals.flatMap((n, p) => n === Math.min(...row.totals) ? [p] : []));
      const extra = row.totals.reduce((a, n) => a + n, 0) - 26 * row.rounds;
      assert.ok(extra >= 0 && extra % 52 === 0 && extra / 52 <= row.rounds);
      rounds += row.rounds;
    }
    assert.equal(rounds, run.rounds);
    const share = run.records.reduce((a, r) => a + (r.winners.includes(r.newSeat) ? 1 / r.winners.length : 0), 0) / run.games;
    assert.equal(run.winShares[0], share);
    sourceManifests[arm] = expected;
    elapsed[arm] = (elapsed[arm] || 0) + run.seconds;
    return run;
  });
  for (let start = 0; start < plan.gamesPerWorker; start += 4) {
    blocks.push({ seed: (plan.seeds[worker] + Math.floor(start / 4) * 65537) >>> 0, shares: runs.map((r) => r.records.slice(start, start + 4).reduce((a, x) => a + (x.winners.includes(x.newSeat) ? 1 / x.winners.length : 0), 0) / 4) });
  }
}
assert.equal(blocks.length * 4, plan.gamesPerArm);
assert.equal(new Set(blocks.map((b) => b.seed)).size, blocks.length);
let seed = 0x35b741;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const distributions = plan.arms.map(() => ({ shares: [], differences: [] }));
for (let sample = 0; sample < 10000; sample++) {
  const sums = plan.arms.map(() => 0);
  for (let i = 0; i < blocks.length; i++) blocks[Math.floor(random() * blocks.length)].shares.forEach((v, j) => { sums[j] += v; });
  for (let i = 0; i < sums.length; i++) {
    distributions[i].shares.push(sums[i] / blocks.length);
    distributions[i].differences.push((sums[i] - sums[0]) / blocks.length);
  }
}
const results = plan.arms.map((arm, i) => {
  for (const d of Object.values(distributions[i])) d.sort((a, b) => a - b);
  return { arm, games: plan.gamesPerArm, winShare: blocks.reduce((a, b) => a + b.shares[i], 0) / blocks.length, interval95: [distributions[i].shares[250], distributions[i].shares[9750]], differenceFromControl: blocks.reduce((a, b) => a + b.shares[i] - b.shares[0], 0) / blocks.length, pairedDifference95: [distributions[i].differences[250], distributions[i].differences[9750]], workerSeconds: elapsed[arm] };
});
const report = { at: new Date().toISOString(), exploratory: plan.exploratory, purpose: plan.purpose, milliseconds: plan.milliseconds, samples: plan.samples, gamesPerArm: plan.gamesPerArm, independentFourSeatBlocks: blocks.length, bootstrapReplicates: 10000, results, sourceManifests, blocks, limitation: plan.exploratory ? "Exploratory candidate selection requires a fresh predeclared confirmation. Fixed-sample experiments do not establish equal-time GUI strength." : "Intervals use whole four-seat deal blocks; source, opponent and budgets apply only to this frozen experiment." };
fs.writeFileSync(path.join(root, "comparison.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, sourceManifests: undefined, blocks: undefined }, null, 2));
