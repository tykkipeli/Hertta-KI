import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.argv[2] || "artifacts/passing-validation-20261031";
const plan = JSON.parse(fs.readFileSync(path.join(root, "plan.json")));
const cases = JSON.parse(fs.readFileSync(path.join(root, "cases.json")));
const rows = [], seen = new Set();
for (let worker = 0; worker < plan.workers; worker++) {
  const completed = JSON.parse(fs.readFileSync(path.join(root, "worker-" + worker + "-complete.json")));
  assert.equal(completed.completedPairedWorlds, plan.cases * plan.worldsPerHand / plan.workers);
  for (const line of fs.readFileSync(path.join(root, "worker-" + worker + ".jsonl"), "utf8").trim().split("\n")) {
    const row = JSON.parse(line), key = row.caseIndex + "/" + row.worldIndex;
    assert.ok(!seen.has(key)); seen.add(key);
    assert.ok(row.caseIndex >= 0 && row.caseIndex < plan.cases && row.worldIndex >= 0 && row.worldIndex < plan.worldsPerHand);
    assert.equal(row.worldIndex % plan.workers, worker); assert.equal(row.results.length, 2);
    for (const [arm, result] of row.results.entries()) {
      assert.equal(result.arm, arm ? "candidate" : "control");
      assert.equal(result.taken.reduce((sum, n) => sum + n, 0), 26);
      assert.ok(result.taken.every((n) => Number.isInteger(n) && n >= 0));
      const shooter = result.taken.indexOf(26);
      assert.deepEqual(result.scores, shooter < 0 ? result.taken : result.taken.map((_, p) => p === shooter ? 0 : 26));
      const p = cases[row.caseIndex].seat;
      assert.equal(result.ownPoints, result.scores[p]); assert.equal(result.ownMoon, result.taken[p] === 26);
      assert.ok(Math.abs(result.value - (result.scores.reduce((sum, n, q) => sum + (q === p ? 0 : n), 0) / 3 - result.scores[p])) < 1e-12);
    }
    rows.push(row);
  }
}
assert.equal(rows.length, plan.cases * plan.worldsPerHand);
const perHand = cases.map((item) => {
  const worlds = rows.filter((r) => r.caseIndex === item.index); assert.equal(worlds.length, plan.worldsPerHand);
  const arms = [0, 1].map((arm) => ({ ownPoints: worlds.reduce((sum, r) => sum + r.results[arm].ownPoints, 0) / worlds.length, moonRate: worlds.filter((r) => r.results[arm].ownMoon).length / worlds.length, relativeValue: worlds.reduce((sum, r) => sum + r.results[arm].value, 0) / worlds.length, leadMargin: worlds.reduce((sum, r) => sum + Math.min(...r.results[arm].scores.filter((_, p) => p !== item.seat)) - r.results[arm].scores[item.seat], 0) / worlds.length }));
  return { caseIndex: item.index, arms, deltaValue: arms[1].relativeValue - arms[0].relativeValue, ownPointsSaved: arms[0].ownPoints - arms[1].ownPoints, deltaMoon: arms[1].moonRate - arms[0].moonRate, deltaLeadMargin: arms[1].leadMargin - arms[0].leadMargin };
});
let seed = 0x92ab71; const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const metrics = ["deltaValue", "ownPointsSaved", "deltaMoon", "deltaLeadMargin"], bootstrap = Object.fromEntries(metrics.map((m) => [m, []]));
for (let b = 0; b < 10000; b++) {
  const sums = Object.fromEntries(metrics.map((m) => [m, 0]));
  for (let i = 0; i < perHand.length; i++) { const hand = perHand[Math.floor(rng() * perHand.length)]; for (const m of metrics) sums[m] += hand[m]; }
  for (const m of metrics) bootstrap[m].push(sums[m] / perHand.length);
}
const differences = {};
for (const m of metrics) { bootstrap[m].sort((a, b) => a - b); differences[m] = { mean: perHand.reduce((sum, h) => sum + h[m], 0) / perHand.length, interval95: [bootstrap[m][250], bootstrap[m][9750]] }; }
const report = { at: new Date().toISOString(), exploratory: true, targetedConditionalEvaluation: true, initialHands: cases.length, worldsPerHand: plan.worldsPerHand, pairedWorlds: rows.length, playedRounds: rows.length * 2, configuredSamplesPerPlayer: plan.samplesPerPlayer, equalTimeBudget: false, totalsBefore: plan.totalsBefore, bootstrapUnit: "Whole initial hand, retaining all sixteen paired hidden deals", bootstrapReplicates: 10000, arms: [0, 1].map((arm) => ({ name: arm ? "candidate" : "control", ownPoints: perHand.reduce((sum, h) => sum + h.arms[arm].ownPoints, 0) / perHand.length, moonRate: perHand.reduce((sum, h) => sum + h.arms[arm].moonRate, 0) / perHand.length, relativeValue: perHand.reduce((sum, h) => sum + h.arms[arm].relativeValue, 0) / perHand.length, leadMargin: perHand.reduce((sum, h) => sum + h.arms[arm].leadMargin, 0) / perHand.length })), differences, criterionMet: differences.deltaValue.interval95[0] > 0, limitation: "Only uniformly generated hands affected by the preregistered rare passing change, with fresh hidden completions and all four frozen private AIs. This evaluates round outcomes at fixed samples, not overall match win share or equal-time GUI strength.", perHand };
fs.writeFileSync(path.join(root, "summary.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, perHand: undefined }, null, 2));
