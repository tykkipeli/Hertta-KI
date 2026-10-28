import { suit, points } from "./game.js";
import { chooseReferencePass, isReferencePass } from "./reference-policy.js";

// Reconstruct hypothetical pre-pass deals. Only the observing player's own
// sent/received cards and public play constrain these deals. Human passing is
// free; the computer passing model is the public deterministic reference policy.
export function createBeliefSampler(
  o,
  rng,
  prior,
  { setupMilliseconds = 100, steps = 24, maximumDraws = 64 } = {},
) {
  const entry = Object.entries(o.known || {})[0];
  if (!entry || o.received?.cards?.length !== 3)
    return { next: () => prior(o, rng), mode: "uniform" };
  const root = o.player,
    direction = (Number(entry[0]) - root + 4) % 4,
    sent = entry[1],
    received = o.received.cards;
  if (!direction) return { next: () => prior(o, rng), mode: "uniform" };
  const actions = [...o.history.flatMap((t) => t.trick), ...o.trick],
    played = Array.from({ length: 4 }, (_, p) =>
      actions.filter((a) => a.player === p).map((a) => a.card),
    );
  const seen = Array(52).fill(false);
  actions.forEach((a) => (seen[a.card] = true));
  const rootPost = [...o.hand, ...played[root]].sort((a, b) => a - b);
  if (rootPost.length !== 13)
    return { next: () => prior(o, rng), mode: "uniform" };
  const ai = (p) => p !== o.humanPlayer;
  const limit = performance.now() + setupMilliseconds;
  let seed = null;
  function compatible(post, p, incoming, outgoing) {
    if (!ai(p)) return true;
    return isReferencePass(
      post[p].filter((c) => !incoming.includes(c)),
      outgoing,
    );
  }
  function subsets(hand, receiver) {
    const result = [];
    const mandatory = ai(receiver)
      ? hand.filter((c) => c === 36 || c === 37)
      : [];
    for (let i = 0; i < 11; i++)
      for (let j = i + 1; j < 12; j++)
        for (let k = j + 1; k < 13; k++) {
          const cards = [hand[i], hand[j], hand[k]];
          if (!mandatory.every((c) => cards.includes(c))) continue;
          if (
            ai(receiver) &&
            hand.includes(51) &&
            !cards.includes(51) &&
            hand.filter((c) => suit(c) === 3 && !cards.includes(c)).length < 4
          )
            continue;
          result.push(cards);
        }
    return result;
  }
  function decode(post) {
    const out = Array(4).fill(null);
    out[root] = sent;
    if (direction === 2) {
      const other = (root + 2) % 4;
      out[other] = received;
      if (!compatible(post, other, sent, received)) return null;
      const a = (root + 1) % 4,
        b = (root + 3) % 4;
      const aIn = subsets(post[a], a),
        bIn = subsets(post[b], b);
      for (const incomingA of aIn)
        for (const incomingB of bIn) {
          if (performance.now() > limit) return null;
          if (
            compatible(post, a, incomingA, incomingB) &&
            compatible(post, b, incomingB, incomingA)
          ) {
            out[a] = incomingB;
            out[b] = incomingA;
            return out;
          }
        }
    } else {
      const a = (root + direction) % 4,
        b = (root + 2 * direction) % 4,
        c = (root + 3 * direction) % 4;
      out[c] = received;
      const bIn = subsets(post[b], b).filter((cards) =>
        compatible(post, a, sent, cards),
      );
      if (!bIn.length) return null;
      const cIn = subsets(post[c], c).filter((cards) =>
        compatible(post, c, cards, received),
      );
      for (const incomingB of bIn)
        for (const incomingC of cIn) {
          if (performance.now() > limit) return null;
          if (compatible(post, b, incomingB, incomingC)) {
            out[a] = incomingB;
            out[b] = incomingC;
            return out;
          }
        }
    }
    return null;
  }
  let draws = 0;
  while (performance.now() < limit && !seed && draws++ < maximumDraws) {
    const world = prior(o, rng);
    if (!world) break;
    const post = world.hands.map((h, p) =>
      [...h, ...played[p]].sort((a, b) => a - b),
    );
    const out = decode(post);
    if (!out) continue;
    const original = post.map((h, p) =>
      [
        ...h.filter((c) => !out[(p - direction + 4) % 4].includes(c)),
        ...out[p],
      ].sort((a, b) => a - b),
    );
    let humanMask = 0;
    if (o.humanPlayer !== undefined)
      original[o.humanPlayer].forEach((c, i) => {
        if (out[o.humanPlayer].includes(c)) humanMask |= 1 << i;
      });
    seed = { deck: Uint8Array.from(original.flat()), humanMask };
  }
  if (!seed) return { next: () => prior(o, rng), mode: "uniform-fallback" };
  const source = (root - direction + 4) % 4;
  const mutable = Array.from({ length: 52 }, (_, i) => i).filter(
    (i) =>
      Math.floor(i / 13) !== root &&
      !(Math.floor(i / 13) === source && received.includes(seed.deck[i])),
  );
  const freeHuman =
    o.humanPlayer !== undefined &&
    o.humanPlayer !== root &&
    o.humanPlayer !== source;
  const heartsOnly = Array(4).fill(false),
    pointsOnly = Array(4).fill(false);
  let broken = false;
  const tricks = [...o.history.map((t) => t.trick), o.trick];
  for (let t = 0; t < tricks.length; t++) {
    const trick = tricks[t];
    if (trick.length && suit(trick[0].card) === 3 && !broken)
      heartsOnly[trick[0].player] = true;
    for (let i = 0; i < trick.length; i++) {
      const a = trick[i];
      if (
        t === 0 &&
        i > 0 &&
        suit(a.card) !== suit(trick[0].card) &&
        points(a.card) > 0
      )
        pointsOnly[a.player] = true;
      if (suit(a.card) === 3) broken = true;
    }
  }
  function postHands() {
    const original = Array.from({ length: 4 }, (_, p) =>
      Array.from(seed.deck.slice(p * 13, p * 13 + 13)),
    );
    const out = original.map((hand, p) =>
      p === root
        ? sent
        : p === o.humanPlayer
          ? hand.filter((_, i) => seed.humanMask & (1 << i))
          : chooseReferencePass([...hand].sort((a, b) => a - b)),
    );
    const post = original.map((hand, p) =>
      [
        ...hand.filter((c) => !out[p].includes(c)),
        ...out[(p - direction + 4) % 4],
      ].sort((a, b) => a - b),
    );
    const owner = Array(52);
    post.forEach((h, p) => h.forEach((c) => (owner[c] = p)));
    if (rootPost.some((c) => owner[c] !== root)) return null;
    if (actions.some((a) => owner[a.card] !== a.player)) return null;
    for (let p = 0; p < 4; p++)
      for (const c of post[p])
        if (
          !seen[c] &&
          (o.voids[p].includes(suit(c)) ||
            (heartsOnly[p] && suit(c) !== 3) ||
            (pointsOnly[p] && !points(c)))
        )
          return null;
    return post;
  }
  let post = postHands();
  if (!post) return { next: () => prior(o, rng), mode: "uniform-fallback" };
  let proposed = 0,
    accepted = 0;
  function step() {
    proposed++;
    if (freeHuman && rng() < 0.2) {
      const selected = [],
        unselected = [];
      for (let i = 0; i < 13; i++)
        (seed.humanMask & (1 << i) ? selected : unselected).push(i);
      const i = selected[Math.floor(rng() * selected.length)],
        j = unselected[Math.floor(rng() * unselected.length)],
        old = seed.humanMask;
      seed.humanMask ^= (1 << i) | (1 << j);
      const next = postHands();
      if (next) {
        post = next;
        accepted++;
      } else seed.humanMask = old;
    } else {
      const i = mutable[Math.floor(rng() * mutable.length)];
      let j;
      do {
        j = mutable[Math.floor(rng() * mutable.length)];
      } while (Math.floor(i / 13) === Math.floor(j / 13));
      const a = seed.deck[i],
        b = seed.deck[j];
      seed.deck[i] = b;
      seed.deck[j] = a;
      const next = postHands();
      if (next) {
        post = next;
        accepted++;
      } else {
        seed.deck[i] = a;
        seed.deck[j] = b;
      }
    }
  }
  for (let i = 0; i < 512; i++) step();
  const diagnostics = { mode: "passing-posterior", proposed: 0, accepted: 0 };
  return {
    mode: "passing-posterior",
    diagnostics,
    next() {
      for (let i = 0; i < steps; i++) step();
      diagnostics.proposed = proposed;
      diagnostics.accepted = accepted;
      return {
        hands: post.map((h) => h.filter((c) => !seen[c])),
        turn: o.turn,
        trick: o.trick.map((a) => ({ ...a })),
        taken: [...o.taken],
        broken: o.broken,
        completed: o.completed,
        history: [...o.history],
        voids: o.voids.map((v) => [...v]),
        played: [...seen],
      };
    },
  };
}
