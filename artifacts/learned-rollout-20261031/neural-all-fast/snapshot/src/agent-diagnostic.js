import { createQueenBelief } from "./queen-belief.js";
import { solveKnownEndgame } from "./endgame.js";
import {
  matchEndsThisRound,
  terminalWinShare,
  matchEndThreat,
  lateMatchValue,
} from "./utility.js";
import { rollout } from "./rollout.js";
import { conservativePolicy } from "./reference-policy.js";
import { chooseStrategicPass, moonPotential } from "./strategy.js";
import { legal } from "./game.js";
export { observe } from "./observation.js";
import { createDealSampler, sample } from "./deals.js";
export { sample };
// Evaluate the whole remaining hand instead of ranking dangerous cards alone.
export function choosePass(hand, { direction = 1 } = {}) {
  return direction ? chooseStrategicPass(hand) : [];
}

export const algorithm =
  "Whole-hand passing and moon-aware private Monte Carlo";
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
  const posterior = createQueenBelief(o, draw);
  const beliefs = { next: () => posterior.next(rng), mode: posterior.mode };
  const terminal = matchEndsThisRound(o);
  const late = terminal || matchEndThreat(o);
  const originalHand = [
    ...o.hand,
    ...o.history
      .flatMap((t) => t.trick)
      .concat(o.trick)
      .filter((x) => x.player === o.player)
      .map((x) => x.card),
  ];
  const moonPlan = moonPotential(originalHand) > 0.7;
  if (draw.totalDeals === 1 && o.counts.every((n) => n <= 3)) {
    const exact = solveKnownEndgame(
      draw(() => 0.5),
      o,
    );
    if (
      exact &&
      (exact.terminal
        ? exact.value === 1
        : exact.value === 78 || (!moonPlan && exact.value >= 26))
    )
      return {
        card: exact.card,
        method: "exact",
        nodes: exact.nodes,
        samples: 0,
        simulations: 0,
        guaranteedValue: exact.value,
      };
  }
  const outcomes = choices.map(() => ({ ownPoints: 0, moon: 0, opponentMoon: 0, atLeast13: 0, zero: 0 }));
  const pointSums = choices.map(() => 0);
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
      const scores = rollout(
        world,
        choices[i],
        pairedRandom,
        o.player,
        moonPlan,
        true,
      );
      const pointsValue =
        scores.reduce((n, x, p) => n + (p === o.player ? 0 : x), 0) / 3 -
        scores[o.player];
      const value = terminal
        ? terminalWinShare(scores, o.totals, o.player)
        : late
          ? lateMatchValue(scores, o.totals, o.player)
          : pointsValue;
      outcomes[i].ownPoints += scores[o.player];
      outcomes[i].moon += Number(scores.every((score, p) => score === (p === o.player ? 0 : 26)));
      outcomes[i].opponentMoon += Number(scores.some((score, p) => p !== o.player && score === 0 && scores.every((n, q) => n === (q === p ? 0 : 26))));
      outcomes[i].atLeast13 += Number(scores[o.player] >= 13);
      outcomes[i].zero += Number(scores[o.player] === 0);
      pointSums[i] += pointsValue;
      sums[i] += value;
      squares[i] += value * value;
    }
    n++;
  } while (n < minSamples || performance.now() < deadline);
  if (!n)
    return { card: conservativePolicy(base, rng), samples: 0, simulations: 0 };
  const means = sums.map((v) => v / n);
  let index = 0;
  for (let i = 1; i < choices.length; i++)
    if (
      means[i] > means[index] ||
      (means[i] === means[index] && pointSums[i] > pointSums[index])
    )
      index = i;
  return {
    card: choices[index],
    samples: n,
    simulations: n * choices.length,
    relativeScore: pointSums[index] / n,
    objective: terminal
      ? "match-win"
      : late
        ? "late-match-win-estimate"
        : "round-penalties",
    ...(terminal ? { winProbability: means[index] } : {}),
    ...(!terminal && late ? { estimatedWinProbability: means[index] } : {}),
    beliefMode: beliefs.mode,
    analysis: { moonPlan, openingMoonPotential: moonPotential(originalHand) },
    estimates: choices.map((card, i) => ({
      card,
      samples: n,
      relativeScore: pointSums[i] / n,
      ...(terminal ? { winProbability: means[i] } : {}),
      ...(!terminal && late ? { estimatedWinProbability: means[i] } : {}),
      analysis: Object.fromEntries(Object.entries(outcomes[i]).map(([key, value]) => [key, value / n])),
      stderr: Math.sqrt(Math.max(0, squares[i] / n - means[i] ** 2) / n),
    })),
  };
}
export const policy = conservativePolicy;
