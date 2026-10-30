import { legal, suit, rank, points } from "./game.js";
// Lightweight stochastic policy used as a reference and fallback.
export function conservativePolicy(s, rng = Math.random) {
  const choices = legal(s);
  if (choices.length === 1) return choices[0];
  if (rng() < 0.08) return choices[Math.floor(rng() * choices.length)];
  const trick = s.trick,
    led = trick.length ? suit(trick[0].card) : -1;
  const top = trick.length
    ? Math.max(
        ...trick.filter((x) => suit(x.card) === led).map((x) => rank(x.card)),
      )
    : -1;
  const pot = trick.reduce((n, x) => n + points(x.card), 0);
  function value(c) {
    if (!trick.length)
      return -rank(c) - (suit(c) === 2 ? 3 : 0) - points(c) * 2;
    if (suit(c) !== led) return points(c) * 20 + rank(c);
    if (rank(c) <= top) return rank(c) + points(c) * 4;
    if (trick.length === 3 && pot === 0) return rank(c) * 0.7 - points(c) * 5;
    return -20 - pot * 10 - rank(c) - points(c) * 10;
  }
  return choices.reduce((a, c) => (value(c) > value(a) ? c : a));
}

export function chooseReferencePass(hand) {
  const counts = [0, 0, 0, 0];
  hand.forEach((c) => counts[suit(c)]++);
  const danger = (c) =>
    (c === 36 ? 24 : c === 37 ? 22 : c === 38 ? 21 : rank(c)) +
    (suit(c) === 3 ? 4 : 0) +
    (counts[suit(c)] <= 3 && suit(c) !== 2 ? 7 : 0);
  return [...hand].sort((a, b) => danger(b) - danger(a)).slice(0, 3);
}

// Exact set test for the sorted-hand reference passing policy.
export function isReferencePass(retained, outgoing) {
  const counts = [0, 0, 0, 0];
  for (const c of [...retained, ...outgoing]) counts[suit(c)]++;
  const priority = (c) =>
    ((c === 36 ? 24 : c === 37 ? 22 : c === 38 ? 21 : rank(c)) +
      (suit(c) === 3 ? 4 : 0) +
      (counts[suit(c)] <= 3 && suit(c) !== 2 ? 7 : 0)) *
      64 -
    c;
  const cutoff = Math.min(...outgoing.map(priority));
  return retained.every((c) => priority(c) < cutoff);
}
