// Suits: clubs, diamonds, spades, hearts. Rank 0 = two, 12 = ace.
export const suit = (c) => Math.floor(c / 13),
  rank = (c) => c % 13;
export const points = (c) => (suit(c) === 3 ? 1 : c === 36 ? 13 : 0);
export const label = (c) =>
  "23456789TJQKA"[rank(c)] + ["♣", "♦", "♠", "♥"][suit(c)];
export function shuffle(a, rng = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function deal(rng = Math.random) {
  const deck = shuffle(
    Array.from({ length: 52 }, (_, i) => i),
    rng,
  );
  return Array.from({ length: 4 }, (_, p) =>
    deck.slice(p * 13, p * 13 + 13).sort((a, b) => a - b),
  );
}
export function createState(hands) {
  return {
    hands: hands.map((h) => [...h]),
    turn: hands.findIndex((h) => h.includes(0)),
    trick: [],
    taken: [0, 0, 0, 0],
    broken: false,
    completed: 0,
    played: Array(52).fill(false),
    history: [],
    voids: Array.from({ length: 4 }, () => []),
  };
}
export function legal(s, p = s.turn) {
  const hand = s.hands[p];
  if (s.trick.length) {
    const follow = hand.filter((c) => suit(c) === suit(s.trick[0].card));
    if (follow.length) return follow;
    if (s.completed === 0) {
      const safe = hand.filter((c) => points(c) === 0);
      if (safe.length) return safe;
    }
    return [...hand];
  }
  if (s.completed === 0) return hand.includes(0) ? [0] : [...hand];
  const safe = hand.filter((c) => suit(c) !== 3);
  return !s.broken && safe.length ? safe : [...hand];
}
export function winner(trick) {
  const led = suit(trick[0].card);
  return trick
    .filter((x) => suit(x.card) === led)
    .reduce((a, b) => (rank(a.card) > rank(b.card) ? a : b)).player;
}
export function play(s, card) {
  if (!legal(s).includes(card)) throw Error("Illegal card " + card);
  const p = s.turn;
  if (s.played) s.played[card] = true;
  s.hands[p].splice(s.hands[p].indexOf(card), 1);
  if (s.trick.length && suit(card) !== suit(s.trick[0].card)) {
    const v = suit(s.trick[0].card);
    if (!s.voids[p].includes(v)) s.voids[p].push(v);
  }
  if (suit(card) === 3) s.broken = true;
  s.trick.push({ player: p, card });
  let result = null;
  if (s.trick.length === 4) {
    const w = winner(s.trick);
    const value = s.trick.reduce((n, x) => n + points(x.card), 0);
    s.taken[w] += value;
    result = {
      winner: w,
      points: value,
      trick: s.trick.map((x) => ({ ...x })),
    };
    s.history.push(result);
    s.trick = [];
    s.completed++;
    s.turn = w;
  } else s.turn = (p + 1) % 4;
  return result;
}
export function roundScores(taken) {
  const moon = taken.indexOf(26);
  return moon < 0 ? [...taken] : taken.map((_, i) => (i === moon ? 0 : 26));
}
export function passCards(hands, selections, direction) {
  if (direction === 0) return;
  for (let p = 0; p < 4; p++) {
    if (
      selections[p].length !== 3 ||
      new Set(selections[p]).size !== 3 ||
      selections[p].some((c) => !hands[p].includes(c))
    )
      throw Error("Invalid pass");
  }
  for (let p = 0; p < 4; p++)
    hands[p] = hands[p].filter((c) => !selections[p].includes(c));
  for (let p = 0; p < 4; p++) hands[(p + direction) % 4].push(...selections[p]);
  for (const h of hands) h.sort((a, b) => a - b);
}
