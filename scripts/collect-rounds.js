import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  deal,
  createState,
  play,
  passCards,
  roundScores,
} from "../src/game.js";
import { decide, observe, choosePass } from "../test/fixtures/ai-v1.js";
const rounds = Number(process.argv[2] || 1500),
  samples = Number(process.argv[3] || 8);
const initialSeed = 80791;
let seed = initialSeed;
const rng = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const rows = [];
for (let game = 0; game < rounds; game++) {
  const hands = deal(rng),
    phase = game % 4,
    direction = [1, 3, 2, 0][phase],
    known = Array.from({ length: 4 }, () => ({}));
  if (direction) {
    const selections = hands.map(choosePass);
    for (let p = 0; p < 4; p++) known[p][(p + direction) % 4] = selections[p];
    passCards(hands, selections, direction);
  }
  const state = createState(hands);
  while (state.completed < 13) {
    const p = state.turn;
    play(
      state,
      decide(observe(state, p, known[p]), {
        milliseconds: 0,
        minSamples: samples,
        rng,
      }).card,
    );
  }
  rows.push({ phase, scores: roundScores(state.taken) });
  if ((game + 1) % 100 === 0) console.error(`${game + 1}/${rounds} rounds`);
}
const metadata = {
  rounds,
  teacherSamples: samples,
  seed: initialSeed,
  teacherSha256: createHash("sha256")
    .update(await readFile("test/fixtures/ai-v1.js"))
    .digest("hex"),
};
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/round-outcomes.json",
  JSON.stringify({ metadata, rows }) + "\n",
);
console.log(metadata);
