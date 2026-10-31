// Soft inference from public missed queen-discard opportunities. The weights
// are a conservative smoothing of 509 decisions of the frozen reference at
// 512 worlds per decision (scripts/calibrate-queen-policy.js). They are an
// opponent model, never a rule exclusion; human behaviour is less constrained.
const missRates = [0.22, 0.3, 0.31, 0.38, 0.6];
export function createQueenBelief(o, draw) {
  const actions = [...o.history.flatMap((t) => t.trick), ...o.trick];
  const uniform = { mode: "uniform", next: (rng) => draw(rng) };
  if (draw.totalDeals === 1) return uniform;
  if (
    o.hand.includes(36) ||
    actions.some((x) => x.card === 36) ||
    Math.max(...(o.totals || [0])) >= 74 ||
    o.taken.some(
      (n, p) => n >= 10 && o.taken.every((x, q) => q === p || x === 0),
    )
  )
    return uniform;
  const totalLow = [0, 0, 0, 0];
  for (const x of actions)
    if (x.card >= 26 && x.card < 36) totalLow[x.player]++;
  const beforeLow = [0, 0, 0, 0],
    events = Array(4).fill(null);
  for (const [index, trick] of [
    ...o.history.map((t) => t.trick),
    o.trick,
  ].entries()) {
    if (!trick.length) continue;
    const led = Math.floor(trick[0].card / 13);
    let top = -1;
    for (const x of trick) {
      const color = Math.floor(x.card / 13),
        r = x.card % 13,
        p = x.player;
      let kind = 0;
      if (index > 0 && p !== o.player) {
        if (led === 2 && top > 10) kind = 2;
        else if (color !== led && led !== 2) kind = 1;
      }
      if (kind && (!events[p] || kind >= events[p].kind))
        events[p] = { kind, laterLow: totalLow[p] - beforeLow[p] };
      if (x.card >= 26 && x.card < 36) beforeLow[p]++;
      if (color === led) top = Math.max(top, r);
    }
  }
  const known = Object.entries(o.known || {}).find(([, cards]) =>
    cards.includes(36),
  );
  const possible = known
    ? [Number(known[0])]
    : [0, 1, 2, 3].filter(
        (p) => p !== o.player && o.counts[p] > 0 && !o.voids[p].includes(2),
      );
  if (!possible.length) return uniform;
  const maximumFor = (p) =>
    !events[p]
      ? 1
      : events[p].kind === 2
        ? p === o.humanPlayer
          ? 0.35
          : 0.05
        : p === o.humanPlayer
          ? 0.85
          : 0.6;
  const bounds = possible.map(maximumFor),
    maximum = Math.max(...bounds);
  // Preserve the sampling RNG exactly when the observation gives no relative
  // information (including the case where every possible holder missed alike).
  if (
    possible.every((p) => !events[p] || events[p].kind === 2) &&
    bounds.every((n) => n === bounds[0])
  )
    return uniform;
  return {
    mode: "public-action-queen-prior",
    events,
    next(rng) {
      let world;
      for (let attempt = 0; attempt < 256; attempt++) {
        world = draw(rng);
        if (!world) return null;
        const owner = world.hands.findIndex((h) => h.includes(36)),
          event = events[owner];
        if (owner < 0 || !event) return world;
        const human = owner === o.humanPlayer;
        const cover =
          world.hands[owner].filter((c) => c >= 26 && c < 36).length +
          event.laterLow;
        const weight =
          event.kind === 2
            ? human
              ? 0.35
              : 0.05
            : human
              ? cover >= 4
                ? 0.85
                : 0.65
              : missRates[Math.min(4, cover)];
        if (rng() < weight / maximum) return world;
      }
      return world;
    },
  };
}
