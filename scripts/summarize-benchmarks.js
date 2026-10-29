import { readFile, writeFile, mkdir } from "node:fs/promises";
const files = process.argv.slice(2);
if (!files.length) throw Error("Provide benchmark JSON files");
const runs = await Promise.all(
  files.map(async (file) => ({
    file,
    data: JSON.parse(await readFile(file, "utf8")),
  })),
);
const reference = runs[0].data;
for (const { data } of runs) {
  if (
    data.mode !== reference.mode ||
    JSON.stringify(data.budget) !== JSON.stringify(reference.budget)
  )
    throw Error("Only combine runs with matching mode and budgets");
  if (
    data.sourceHashes["test/fixtures/ai-v1.js"] !==
    reference.sourceHashes["test/fixtures/ai-v1.js"]
  )
    throw Error("Reference opponent changed");
  for (const key of [
    "activeEngine",
    "src/agent.js",
    "src/deals.js",
    "src/rollout.js",
    "src/reference-policy.js",
    "src/game.js",
    "src/observation.js",
  ]) {
    if (data.sourceHashes[key] !== reference.sourceHashes[key])
      throw Error("Do not combine different AI versions: " + key);
  }
}
const blocks = [],
  totals = [0, 0, 0, 0];
let games = 0;
for (const { data } of runs) {
  for (let start = 0; start < data.records.length; start += 4) {
    const rows = data.records.slice(start, start + 4);
    if (rows.length !== 4)
      throw Error("Complete seat-rotation blocks required");
    const wins = [0, 0, 0, 0];
    for (const row of rows)
      for (const p of row.winners) {
        const role = p === row.newSeat ? 0 : 1 + ((p - row.newSeat + 3) % 4);
        wins[role] += 1 / row.winners.length;
      }
    blocks.push(wins.map((n) => n / 4));
    wins.forEach((n, i) => (totals[i] += n));
    games += 4;
  }
}
let seed = 123481;
const rng = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const boot = [];
for (let i = 0; i < 10000; i++) {
  let share = 0;
  for (let j = 0; j < blocks.length; j++)
    share += blocks[Math.floor(rng() * blocks.length)][0];
  boot.push(share / blocks.length);
}
boot.sort((a, b) => a - b);
const shares = totals.map((n) => n / games),
  interval = [boot[250], boot[9750]];
const report = {
  files,
  mode: reference.mode,
  budget: reference.budget,
  games,
  independentDealBlocks: blocks.length,
  winShares: shares,
  newWinShareBlockBootstrap95: interval,
  meanOldWinShare: (1 - shares[0]) / 3,
  newMinusMeanOld: shares[0] - (1 - shares[0]) / 3,
  relativePositionNote:
    "Old opponents are labeled by position relative to the new agent, not distinct policies.",
  runs: runs.map(({ file, data }) => ({
    file,
    seed: data.seed,
    rounds: data.rounds,
    winShares: data.winShares,
    meanDecisionMilliseconds: data.meanDecisionMilliseconds,
    activeSource:
      data.sourceHashes.activeEngine || data.sourceHashes["src/ai.js"],
    agentSource: data.sourceHashes["src/agent.js"],
  })),
};
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/benchmark-summary.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
