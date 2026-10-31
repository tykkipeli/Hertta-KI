// An opponent's remaining high heart can stop a moon later. The old rollout
// usually spent its highest losing heart immediately, making moons too easy.
// Coarse probabilities come from separate exploratory, fully replayed games;
// this is a fallible opponent model, not a hard assumption about hidden cards.
export function moonDefenseChoice({ choices, led, top, length, taken, turn, winner }, rng) {
  if (!length || led !== 3 || winner === turn || taken[winner] < 13 ||
      taken.some((n, p) => p !== winner && n > 0) ||
      choices.length < 2 || choices.some((c) => c < 39)) return null;
  const winning = choices.filter((c) => c % 13 > top);
  const losing = choices.filter((c) => c % 13 <= top);
  if (winning.length && losing.length) {
    const stopProbability = taken[winner] >= 18 ? .35 : .15;
    return rng() < stopProbability ? Math.min(...winning) : null;
  }
  if (!winning.length && losing.length >= 2) {
    const keepProbability = taken[winner] >= 22 ? .95 : taken[winner] >= 18 ? .8 : .55;
    if (rng() >= keepProbability) return null;
    const highest = Math.max(...losing), retainGuard = losing.filter((c) => c !== highest);
    return retainGuard[Math.floor(rng() * retainGuard.length)];
  }
  return null;
}
