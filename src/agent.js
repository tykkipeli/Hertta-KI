import { createBeliefSampler } from "./belief.js";
import { createMatchEvaluator, nextPassingPhase } from "./match-value.js";
import { conservativePolicy, chooseReferencePass } from "./reference-policy.js";
import { suit, legal, play, roundScores, shuffle } from "./game.js";
export { observe } from "./observation.js";
export function sample(o, rng = Math.random) {
  const seen = new Set([
    ...o.hand,
    ...o.history.flatMap((t) => t.trick.map((x) => x.card)),
    ...o.trick.map((x) => x.card),
  ]);
  const pool = Array.from({ length: 52 }, (_, i) => i).filter(
    (c) => !seen.has(c),
  );
  const hands = Array.from({ length: 4 }, () => []);
  hands[o.player] = [...o.hand];
  for (const [key, cards] of Object.entries(o.known || {})) {
    const p = Number(key);
    if (p === o.player) continue;
    for (const c of cards) {
      const ix = pool.indexOf(c);
      if (ix >= 0) {
        hands[p].push(c);
        pool.splice(ix, 1);
      }
    }
  }
  // Randomized constrained backtracking preserves every publicly revealed void.
  const capacities = o.counts.map((n, p) => n - hands[p].length);
  let nodes = 0;
  shuffle(pool, rng);
  pool.sort((a, b) => allowed(a).length - allowed(b).length);
  function allowed(c) {
    return [0, 1, 2, 3].filter(
      (p) =>
        p !== o.player && capacities[p] > 0 && !o.voids[p].includes(suit(c)),
    );
  }
  function assign(i) {
    if (++nodes > 30000) return false;
    if (i === pool.length) return true;
    const c = pool[i];
    for (const p of shuffle(allowed(c), rng)) {
      hands[p].push(c);
      capacities[p]--;
      if (assign(i + 1)) return true;
      hands[p].pop();
      capacities[p]++;
    }
    return false;
  }
  if (!assign(0)) return null;
  return {
    hands,
    turn: o.turn,
    trick: o.trick.map((x) => ({ ...x })),
    taken: [...o.taken],
    broken: o.broken,
    completed: o.completed,
    history: [...o.history],
    voids: o.voids.map((v) => [...v]),
    played: [...publicPlayed(o)],
  };
}

// Keep the deterministic passing strategy used by the private belief model.
export function choosePass(hand, { direction = 1 } = {}) {
  return direction ? chooseReferencePass(hand) : [];
}

function publicPlayed(s) {
  if (s.played) return s.played;
  const played = Array(52).fill(false);
  for (const t of s.history) for (const x of t.trick) played[x.card] = true;
  for (const x of s.trick) played[x.card] = true;
  return played;
}

// A receiver cannot retain a queen under the standard passing strategy if
// we did not send it. Use a soft opponent-model prior, never a rule exclusion.
function beliefWorld(o, rng) {
  const entry = Object.entries(o.known || {})[0];
  if (!entry || entry[1].includes(36)) return sample(o, rng);
  const receiver = Number(entry[0]),
    acceptance = receiver === o.humanPlayer ? 0.55 : 0.1;
  let world;
  for (let attempt = 0; attempt < 32; attempt++) {
    world = sample(o, rng);
    if (!world) return null;
    if (!world.hands[receiver].includes(36) || rng() < acceptance) return world;
  }
  return world;
}

export const algorithm =
  "Monte Carlo with passing-consistent private belief sampling and match-win value";
export function decide(
  o,
  {
    milliseconds = 1200,
    minSamples = 16,
    rng = Math.random,
    inference = "auto",
  } = {},
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
  const matchValue = createMatchEvaluator(
    o.totals || [0, 0, 0, 0],
    nextPassingPhase(o),
  );
  const lightweight =
    inference === "fast" ||
    (inference === "auto" && milliseconds > 0 && milliseconds < 100);
  const beliefs = lightweight
    ? {
        next: () => beliefWorld(o, rng),
        mode: Object.keys(o.known || {}).length ? "passing-prior" : "uniform",
      }
    : createBeliefSampler(o, rng, sample, {
        setupMilliseconds:
          milliseconds > 0
            ? Math.min(250, Math.max(5, milliseconds * 0.25))
            : 250,
      });
  const sums = choices.map(() => 0),
    squares = choices.map(() => 0);
  let n = 0;
  do {
    const world = beliefs.next();
    if (!world) break;
    for (let i = 0; i < choices.length; i++) {
      const s = {
        ...world,
        hands: world.hands.map((h) => [...h]),
        trick: world.trick.map((x) => ({ ...x })),
        taken: [...world.taken],
        history: [...world.history],
        voids: world.voids.map((v) => [...v]),
        played: [...world.played],
      };
      play(s, choices[i]);
      while (s.completed < 13) play(s, conservativePolicy(s, rng));
      const value = matchValue(roundScores(s.taken))[o.player];
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
    winProbability: means[index],
    beliefMode: beliefs.mode,
    estimates: choices.map((card, i) => ({
      card,
      samples: n,
      winProbability: means[i],
      stderr:
        beliefs.mode === "passing-posterior"
          ? null
          : Math.sqrt(Math.max(0, squares[i] / n - means[i] ** 2) / n),
    })),
  };
}
export const policy = conservativePolicy;
