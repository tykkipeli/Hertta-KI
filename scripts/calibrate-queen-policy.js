import {
  deal,
  createState,
  passCards,
  legal,
  play,
  suit,
  rank,
} from "../src/game.js";
import { choosePass, decide, observe } from "../test/fixtures/ai-v1.js";
import { conservativePolicy } from "../src/reference-policy.js";
import { writeFile, mkdir } from "node:fs/promises";
function rng(s) {
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const deals = Number(process.argv[2] || 600),
  samples = Number(process.argv[3] || 512);
if (
  !Number.isInteger(deals) ||
  deals < 1 ||
  !Number.isInteger(samples) ||
  samples < 1
)
  throw Error("Positive integer deal and sample counts required");
const rows = [],
  bins = {};
for (let seed = 0; seed < deals; seed++) {
  const random = rng(seed + 207731),
    hands = deal(random),
    direction = [1, 3, 2, 0][seed % 4],
    known = Array.from({ length: 4 }, () => ({}));
  if (direction) {
    const sent = hands.map(choosePass);
    sent.forEach((cards, p) => (known[p][(p + direction) % 4] = cards));
    passCards(hands, sent, direction);
  }
  const state = createState(hands);
  while (state.completed < 13) {
    const p = state.turn,
      choices = legal(state),
      led = state.trick.length ? suit(state.trick[0].card) : -1;
    const top = state.trick.length
      ? Math.max(
          ...state.trick
            .filter((x) => suit(x.card) === led)
            .map((x) => rank(x.card)),
        )
      : -1;
    if (
      state.completed > 0 &&
      state.trick.length &&
      choices.includes(36) &&
      choices.length > 1 &&
      (led !== 2 || top > 10)
    ) {
      const monopoly = state.taken.some(
        (n, q) => n >= 10 && state.taken.every((x, k) => k === q || x === 0),
      );
      const cover = state.hands[p].filter((c) => c >= 26 && c < 36).length;
      const kind = led === 2 ? "under-high-spade" : "off-suit";
      const result = decide(observe(state, p, known[p]), {
        milliseconds: 0,
        minSamples: samples,
        rng: rng(seed * 53 + state.completed * 7 + p),
      });
      rows.push({
        seed,
        player: p,
        kind,
        cover,
        monopoly,
        chosen: result.card,
        hand: state.hands[p].slice(),
        taken: state.taken.slice(),
      });
      const bin = kind + "/" + Math.min(4, cover) + "/" + monopoly;
      bins[bin] ??= { n: 0, kept: 0 };
      bins[bin].n++;
      bins[bin].kept += result.card !== 36 ? 1 : 0;
    }
    play(state, conservativePolicy(state, random));
  }
}
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/queen-policy-calibration.json",
  JSON.stringify({ samples: samples, rows, bins }, null, 2),
);
console.log(
  JSON.stringify({ samples: samples, decisions: rows.length, bins }, null, 2),
);
