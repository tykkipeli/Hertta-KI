import { rollout } from "./rollout.js";
import { conservativePolicy, chooseReferencePass } from "./reference-policy.js";
import { legal } from "./game.js";
export { observe } from "./observation.js";
import { createDealSampler, sample } from "./deals.js";
export { sample };
// Keep the deterministic passing strategy used by the private belief model.
export function choosePass(hand, { direction = 1 } = {}) {
  return direction ? chooseReferencePass(hand) : [];
}

// A receiver cannot retain a queen under the standard passing strategy if
// we did not send it. Use a soft opponent-model prior, never a rule exclusion.
function beliefWorld(o, rng, draw) {
  const entry = Object.entries(o.known || {})[0];
  if (!entry || entry[1].includes(36)) return draw(rng);
  const receiver = Number(entry[0]),
    acceptance = receiver === o.humanPlayer ? 0.55 : 0.1;
  let world;
  for (let attempt = 0; attempt < 32; attempt++) {
    world = draw(rng);
    if (!world) return null;
    if (!world.hands[receiver].includes(36) || rng() < acceptance) return world;
  }
  return world;
}

export const algorithm =
  "Uniform private Monte Carlo with paired rollout randomness";
export function decide(
  o,
  { milliseconds = 1200, minSamples = 16, rng = Math.random } = {},
) {
  const deadline = performance.now() + milliseconds;
  if (o.turn !== o.player || !o.hand.length)
    throw Error("Decision requires the acting player");
  const base = {
    ...o,
    hands: Array.from({ length: 4 }, (_, p) => (p === o.player ? o.hand : [])),
  };
  const choices = legal(base);
  if (choices.length === 1)
    return { card: choices[0], samples: 0, simulations: 0 };

  const draw = createDealSampler(o);
  const beliefs = {
    next: () => beliefWorld(o, rng, draw),
    mode: Object.keys(o.known || {}).length ? "passing-prior" : "uniform",
  };
  const sums = choices.map(() => 0),
    squares = choices.map(() => 0);
  let n = 0;
  do {
    const world = beliefs.next();
    if (!world) break;
    const seed = Math.floor(rng() * 4294967296);
    for (let i = 0; i < choices.length; i++) {
      let stream = seed;
      // A different generator from the benchmark's sampling RNG avoids
      // overlapping its sequence when the caller supplies a seeded LCG.
      const pairedRandom = () => {
        let z = (stream += 0x6d2b79f5);
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
      };
      const scores = rollout(world, choices[i], pairedRandom);
      const value =
        scores.reduce((n, x, p) => n + (p === o.player ? 0 : x), 0) / 3 -
        scores[o.player];
      sums[i] += value;
      squares[i] += value * value;
    }
    n++;
  } while (n < minSamples || performance.now() < deadline);
  if (!n)
    return { card: conservativePolicy(base, rng), samples: 0, simulations: 0 };
  const means = sums.map((v) => v / n),
    index = means.indexOf(Math.max(...means));
  return {
    card: choices[index],
    samples: n,
    simulations: n * choices.length,
    relativeScore: means[index],
    beliefMode: beliefs.mode,
    estimates: choices.map((card, i) => ({
      card,
      samples: n,
      relativeScore: means[i],
      stderr: Math.sqrt(Math.max(0, squares[i] / n - means[i] ** 2) / n),
    })),
  };
}
export const policy = conservativePolicy;
