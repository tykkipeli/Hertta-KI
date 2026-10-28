import { deal, createState, play, roundScores, passCards } from "./src/game.js";
import { observe } from "./src/observation.js";
import {
  decide as oldDecide,
  choosePass as oldPass,
  observe as oldObserve,
} from "./test/fixtures/ai-v1.js";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf("--" + name);
  return i < 0 ? fallback : Number(args[i + 1]);
}
const count = /^\d+$/.test(args[0] || "") ? Number(args[0]) : 40;
const milliseconds = option("ms", 0),
  samples = option("samples", 32),
  seed = option("seed", 20261028);
if (!Number.isInteger(count) || count < 1)
  throw Error("Game count must be a positive integer");
const engineIndex = args.indexOf("--engine");
const enginePath = engineIndex >= 0 ? args[engineIndex + 1] : "src/ai.js";
const selected = await import(pathToFileURL(resolve(enginePath)).href);
const newDecide = selected.decide,
  newPass = selected.choosePass;
const matches = args.includes("--matches");
const newSamples = option("new-samples", samples),
  newMilliseconds = option("new-ms", milliseconds);
for (const [name, value] of [
  ["ms", milliseconds],
  ["new-ms", newMilliseconds],
])
  if (!Number.isFinite(value) || value < 0)
    throw Error(name + " must be nonnegative");
for (const [name, value] of [
  ["samples", samples],
  ["new-samples", newSamples],
])
  if (!Number.isInteger(value) || value < 1)
    throw Error(name + " must be a positive integer");
const beliefModes = {};
const engineTimeMs = [0, 0],
  decisionCounts = [0, 0],
  passingTimeMs = [0, 0],
  passingCounts = [0, 0];
function seeded(initial) {
  let n = initial >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
const sourceHashes = {};
for (const path of [
  ...(await readdir("src"))
    .filter((n) => n.endsWith(".js"))
    .sort()
    .map((n) => "src/" + n),
  "test/fixtures/ai-v1.js",
])
  sourceHashes[path] = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
sourceHashes.activeEngine = createHash("sha256")
  .update(await readFile(enginePath))
  .digest("hex");
let points = [0, 0, 0, 0],
  wins = [0, 0, 0, 0],
  uniqueWins = [0, 0, 0, 0],
  rounds = 0;
const records = [],
  started = performance.now();
for (let game = 0; game < count; game++) {
  const seat = game % 4,
    totals = [0, 0, 0, 0];
  // Four rotations share the same deals. RNG streams remain private per seat.
  const dealRng = seeded(seed + Math.floor(game / 4) * 65537);
  const streams = Array.from({ length: 4 }, (_, p) =>
    seeded(seed + game * 997 + p * 101 + 71),
  );
  let round = 0;
  do {
    const hands = deal(dealRng),
      direction = [1, 3, 2, 0][round % 4];
    const known = Array.from({ length: 4 }, () => ({})),
      received = Array(4).fill(null);
    if (direction) {
      const selections = hands.map((h, p) => {
        const start = performance.now(),
          role = p === seat ? 0 : 1;
        const cards =
          p === seat ? newPass(h, { direction, rng: streams[p] }) : oldPass(h);
        passingTimeMs[role] += performance.now() - start;
        passingCounts[role]++;
        return cards;
      });
      for (let p = 0; p < 4; p++)
        known[p][(p + direction) % 4] = [...selections[p]];
      for (let p = 0; p < 4; p++) {
        const from = (p - direction + 4) % 4;
        received[p] = { from, cards: [...selections[from]] };
      }
      passCards(hands, selections, direction);
    }
    const state = createState(hands);
    while (state.completed < 13) {
      const p = state.turn,
        observation =
          p === seat
            ? observe(state, p, known[p], totals, received[p])
            : oldObserve(state, p, known[p]);
      const role = p === seat ? 0 : 1,
        decisionStart = performance.now();
      const result = (p === seat ? newDecide : oldDecide)(observation, {
        milliseconds: p === seat ? newMilliseconds : milliseconds,
        minSamples: p === seat ? newSamples : samples,
        rng: streams[p],
      });
      if (role === 0 && result.beliefMode)
        beliefModes[result.beliefMode] =
          (beliefModes[result.beliefMode] || 0) + 1;
      engineTimeMs[role] += performance.now() - decisionStart;
      decisionCounts[role]++;
      play(state, result.card);
    }
    roundScores(state.taken).forEach((n, p) => (totals[p] += n));
    round++;
    rounds++;
  } while (matches && !totals.some((n) => n >= 100));
  const low = Math.min(...totals),
    winners = totals.map((n, p) => (n === low ? p : -1)).filter((p) => p >= 0);
  for (let p = 0; p < 4; p++) {
    const role = p === seat ? 0 : 1 + ((p - seat + 3) % 4);
    points[role] += totals[p];
    if (winners.includes(p)) wins[role] += 1 / winners.length;
    if (winners.length === 1 && winners[0] === p) uniqueWins[role]++;
  }
  records.push({ game, newSeat: seat, rounds: round, totals, winners });
  if ((game + 1) % 20 === 0)
    console.error(
      `${game + 1}/${count}: new win share ${((wins[0] / (game + 1)) * 100).toFixed(1)}%`,
    );
}
const rate = wins[0] / count;
// Wilson interval is descriptive: fractional ties and paired rotations are dependent.
const z = 1.96,
  center = (rate + (z * z) / (2 * count)) / (1 + (z * z) / count);
const radius =
  (z * Math.sqrt((rate * (1 - rate)) / count + (z * z) / (4 * count * count))) /
  (1 + (z * z) / count);
const result = {
  sourceHashes,
  enginePath,
  algorithm: selected.algorithm || "private-belief tree search",
  mode: matches ? "matches-to-100" : "single-rounds",
  seed,
  games: count,
  rounds,
  budget: {
    old: { milliseconds, minSamples: samples },
    new: { milliseconds: newMilliseconds, minSamples: newSamples },
  },
  beliefModes,
  meanDecisionMilliseconds: engineTimeMs.map((n, i) => n / decisionCounts[i]),
  meanPassingMilliseconds: passingTimeMs.map(
    (n, i) => n / Math.max(1, passingCounts[i]),
  ),
  engines: ["new", "v1-opponent-1", "v1-opponent-2", "v1-opponent-3"],
  winShares: wins.map((n) => n / count),
  outrightWins: uniqueWins,
  meanPoints: points.map((n) => n / count),
  newWinRateDescriptive95: [center - radius, center + radius],
  seconds: (performance.now() - started) / 1000,
  records,
};
await mkdir("artifacts", { recursive: true });
const path = `artifacts/benchmark-${matches ? "matches" : "rounds"}-${seed}-${count}-${milliseconds}ms-${samples}samples-new${newSamples}samples-${newMilliseconds}ms.json`;
await writeFile(path, JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({ ...result, records: undefined, artifact: path }, null, 2),
);
