import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.argv[2] || "artifacts/match-research-20261031";
const plan = JSON.parse(fs.readFileSync(path.join(root, "plan.json")));
assert.equal(plan.arms[0], "control");
const blocks = [], manifests = {}, ids = new Set(), aggregate = {};
for (const arm of plan.arms) aggregate[arm] = { rounds: 0, ownPoints: 0, files: [] };
for (let worker = 0; worker < plan.workers; worker++) {
  const runs = plan.arms.map((arm) => {
    const file = path.join(root, arm, "worker-" + worker, "result.json");
    const run = JSON.parse(fs.readFileSync(file));
    assert.equal(run.state, "completed"); assert.equal(run.games, plan.gamesPerWorker); assert.equal(run.completedGames, plan.gamesPerWorker); assert.equal(run.records.length, plan.gamesPerWorker);
    assert.equal(run.seed, plan.seeds[worker]); assert.equal(run.samples, plan.samplesByArm?.[arm] ?? plan.samples); assert.equal(run.opponentSamples, plan.opponentSamples); assert.equal(run.opponents, "baseline");
    assert.equal(run.rolloutBudgetPerAction || 0, plan.rolloutBudgets?.[arm] ?? 0);
    assert.ok(!ids.has(run.runId)); ids.add(run.runId);
    if (manifests[arm]) assert.deepEqual(run.manifest, manifests[arm]); else manifests[arm] = run.manifest;
    let rounds = 0;
    for (const [i, row] of run.records.entries()) {
      assert.equal(row.game, i); assert.equal(row.seat, i % 4); assert.ok(Number.isInteger(row.rounds) && row.rounds >= 4 && row.rounds <= 16);
      assert.ok(row.totals.length === 4 && row.totals.every((n) => Number.isInteger(n) && n >= 0)); assert.ok(Math.max(...row.totals) >= 100);
      assert.deepEqual(row.winners, row.totals.flatMap((n, p) => n === Math.min(...row.totals) ? [p] : []));
      const extra = row.totals.reduce((sum, n) => sum + n, 0) - 26 * row.rounds; assert.ok(extra >= 0 && extra % 52 === 0 && extra / 52 <= row.rounds);
      rounds += row.rounds; aggregate[arm].ownPoints += row.totals[row.seat];
    }
    assert.equal(rounds, run.totalRounds); aggregate[arm].rounds += rounds; aggregate[arm].files.push(file);
    return run;
  });
  for (const [index, run] of runs.entries()) {
    assert.deepEqual(run.opponentManifest.hashes, runs[0].manifest.hashes);
    if (index) assert.deepEqual(run.manifest.baselineHashes, runs[0].manifest.hashes);
  }
  for (let start = 0; start < plan.gamesPerWorker; start += 4) {
    const shares = runs.map((run) => run.records.slice(start, start + 4).reduce((sum, row) => sum + (row.winners.includes(row.seat) ? 1 / row.winners.length : 0), 0) / 4);
    blocks.push({ seed: (plan.seeds[worker] + Math.floor(start / 4) * 65537) >>> 0, shares });
  }
}
assert.equal(blocks.length * 4, plan.gamesPerArm);
assert.equal(new Set(blocks.map((b) => b.seed)).size, blocks.length);
let seed = 0x47ac31; const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const distributions = plan.arms.map(() => ({ shares: [], differences: [] }));
for (let replicate = 0; replicate < 10000; replicate++) {
  const sums = plan.arms.map(() => 0);
  for (let i = 0; i < blocks.length; i++) { const b = blocks[Math.floor(rng() * blocks.length)]; b.shares.forEach((n, j) => { sums[j] += n; }); }
  sums.forEach((n, i) => { distributions[i].shares.push(n / blocks.length); distributions[i].differences.push((n - sums[0]) / blocks.length); });
}
const results = plan.arms.map((arm, i) => {
  for (const data of Object.values(distributions[i])) data.sort((a, b) => a - b);
  return { arm, games: plan.gamesPerArm, minSamples: plan.samplesByArm?.[arm] ?? plan.samples, rolloutBudgetPerAction: plan.rolloutBudgets?.[arm] ?? 0, rounds: aggregate[arm].rounds, meanOwnPoints: aggregate[arm].ownPoints / plan.gamesPerArm, winShare: blocks.reduce((sum, b) => sum + b.shares[i], 0) / blocks.length, interval95: [distributions[i].shares[250], distributions[i].shares[9750]], differenceFromControl: blocks.reduce((sum, b) => sum + b.shares[i] - b.shares[0], 0) / blocks.length, pairedDifference95: [distributions[i].differences[250], distributions[i].differences[9750]] };
});
const report = { at: new Date().toISOString(), exploratory: true, purpose: plan.purpose, gamesPerArm: plan.gamesPerArm, samples: plan.samples, opponentSamples: plan.opponentSamples, equalTimeBudget: false, independentFourSeatBlocks: blocks.length, bootstrapReplicates: 10000, seedsDisjointFromCalibration: plan.seedsDisjointFromCalibration, results, sourceManifests: manifests, blocks, limitation: "Multiple exploratory candidates share the same control games. Selection needs fresh confirmation; neither a successful job nor improved forecast loss proves strength." };
fs.writeFileSync(path.join(root, "comparison.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, sourceManifests: undefined, blocks: undefined }, null, 2));
