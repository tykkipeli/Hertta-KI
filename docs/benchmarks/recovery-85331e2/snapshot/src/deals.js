import { shuffle, suit } from "./game.js";

// Sample uniformly among all card assignments consistent with the observation.
// Counting completions by suit avoids biased greedy assignments and rejection.
export function createDealSampler(o) {
  const players = [0, 1, 2, 3].filter((p) => p !== o.player);
  const seen = new Set([
    ...o.hand,
    ...o.history.flatMap((t) => t.trick.map((x) => x.card)),
    ...o.trick.map((x) => x.card),
  ]);
  const fixed = Array.from({ length: 4 }, () => []);
  fixed[o.player] = o.hand.slice();
  for (const [owner, cards] of Object.entries(o.known || {})) {
    const p = Number(owner);
    if (p === o.player) continue;
    for (const c of cards)
      if (!seen.has(c)) {
        fixed[p].push(c);
        seen.add(c);
      }
  }
  const pool = Array.from({ length: 52 }, (_, c) => c).filter(
    (c) => !seen.has(c),
  );
  const colors = Array.from({ length: 4 }, (_, s) =>
    pool.filter((c) => suit(c) === s),
  );
  const capacities = players.map((p) => o.counts[p] - fixed[p].length);
  const masks = colors.map((_, s) =>
    players.reduce(
      (mask, p, i) => mask | (o.voids[p].includes(s) ? 0 : 1 << i),
      0,
    ),
  );
  const factorial = [1];
  for (let n = 1; n <= 39; n++) factorial[n] = factorial[n - 1] * n;
  const combinations = (n, a, b) =>
    factorial[n] / (factorial[a] * factorial[b] * factorial[n - a - b]);
  const unrestricted = masks.every(
    (mask, s) => !colors[s].length || mask === 7,
  );
  const memo = new Map();
  function allocations(s, cap, visit) {
    const n = colors[s].length,
      mask = masks[s];
    for (
      let a = mask & 1 ? Math.max(0, n - cap[1] - cap[2]) : 0;
      a <= Math.min(n, mask & 1 ? cap[0] : 0);
      a++
    ) {
      for (
        let b = mask & 2 ? Math.max(0, n - a - cap[2]) : 0;
        b <= Math.min(n - a, mask & 2 ? cap[1] : 0);
        b++
      ) {
        const c = n - a - b;
        if (c > cap[2] || (c && !(mask & 4))) continue;
        visit(a, b, c, combinations(n, a, b));
      }
    }
  }
  function ways(s, cap) {
    if (cap.some((c) => c < 0)) return 0;
    if (s === 4) return cap.every((c) => c === 0) ? 1 : 0;
    const key = s * 196 + cap[0] * 14 + cap[1];
    if (memo.has(key)) return memo.get(key);
    let total = 0;
    allocations(s, cap, (a, b, c, multiplicity) => {
      total += multiplicity * ways(s + 1, [cap[0] - a, cap[1] - b, cap[2] - c]);
    });
    memo.set(key, total);
    return total;
  }
  const valid =
    capacities.every((n) => n >= 0) &&
    capacities.reduce((a, b) => a + b, 0) === pool.length &&
    players.every((p) => fixed[p].every((c) => !o.voids[p].includes(suit(c))));
  const count = valid ? (unrestricted ? 1 : ways(0, capacities)) : 0;
  const played = Array(52).fill(false);
  for (const t of [...o.history, { trick: o.trick }])
    for (const x of t.trick) played[x.card] = true;
  const draw = (rng = Math.random) => {
    if (!count) return null;
    const hands = fixed.map((h) => h.slice());
    if (unrestricted) {
      const cards = shuffle(pool.slice(), rng);
      let at = 0;
      players.forEach((p, i) => {
        hands[p].push(...cards.slice(at, at + capacities[i]));
        at += capacities[i];
      });
    } else {
      let cap = capacities.slice();
      for (let s = 0; s < 4; s++) {
        let draw = rng() * ways(s, cap),
          chosen;
        allocations(s, cap, (a, b, c, multiplicity) => {
          if (chosen) return;
          const weight =
            multiplicity * ways(s + 1, [cap[0] - a, cap[1] - b, cap[2] - c]);
          if (weight <= 0) return;
          draw -= weight;
          chosen = [a, b, c];
          if (draw >= 0) chosen = null;
        });
        if (!chosen) return null;
        const cards = shuffle(colors[s].slice(), rng);
        let at = 0;
        chosen.forEach((n, i) => {
          hands[players[i]].push(...cards.slice(at, at + n));
          at += n;
          cap[i] -= n;
        });
      }
      // Rollout tie breaking must not depend on the suit allocation algorithm.
      for (const p of players) shuffle(hands[p], rng);
    }
    return {
      hands,
      turn: o.turn,
      trick: o.trick.map((x) => ({ ...x })),
      taken: o.taken.slice(),
      broken: o.broken,
      completed: o.completed,
      history: o.history.slice(),
      voids: o.voids.map((v) => v.slice()),
      played: played.slice(),
    };
  };
  draw.totalDeals = !valid
    ? 0
    : unrestricted
      ? factorial[pool.length] /
        capacities.reduce((n, c) => n * factorial[c], 1)
      : count;
  return draw;
}
export function sample(o, rng = Math.random) {
  return createDealSampler(o)(rng);
}
