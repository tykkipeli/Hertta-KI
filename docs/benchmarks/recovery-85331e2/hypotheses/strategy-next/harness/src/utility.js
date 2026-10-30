// Once public points guarantee that this round ends the match, optimise the
// actual winner rather than treating all destinations of penalty cards alike.
export function matchEndsThisRound(o) {
  const totals = o.totals || [0, 0, 0, 0],
    takers = o.taken.flatMap((n, p) => (n > 0 ? [p] : []));
  if (takers.length === 1 && o.taken[takers[0]] === 26)
    return totals.some((n, p) => p !== takers[0] && n + 26 >= 100);
  if (!totals.some((n, p) => n + o.taken[p] >= 100)) return false;
  return (
    takers.length >= 2 ||
    (takers.length === 1 &&
      totals.some((n, p) => p !== takers[0] && n + 26 >= 100))
  );
}
export function terminalWinShare(scores, totals, player) {
  const final = scores.map((n, p) => n + totals[p]),
    low = Math.min(...final);
  return final[player] === low ? 1 / final.filter((n) => n === low).length : 0;
}

export function matchEndThreat(o) {
  const totals = o.totals || [0, 0, 0, 0],
    remaining = 26 - o.taken.reduce((a, b) => a + b, 0);
  const takers = o.taken.flatMap((n, p) => (n > 0 ? [p] : []));
  if (takers.length === 1 && o.taken[takers[0]] === 26)
    return matchEndsThisRound(o);
  // A normal score is at most 25: all 26 would be a moon instead.
  if (totals.some((n, p) => n + Math.min(25, o.taken[p] + remaining) >= 100))
    return true;
  const shooters =
    takers.length === 0 ? [0, 1, 2, 3] : takers.length === 1 ? takers : [];
  return shooters.some((shooter) =>
    totals.some((n, p) => p !== shooter && n + 26 >= 100),
  );
}

// Actual terminal outcomes are exact. If the match survives, this deliberately
// simple estimate values the remaining chance instead of treating survival
// while behind as equivalent to an immediate loss. It is used only near 100.
export function lateMatchValue(scores, totals, player) {
  const final = scores.map((n, p) => n + totals[p]);
  if (Math.max(...final) >= 100)
    return terminalWinShare(scores, totals, player);
  const temperature =
    8 * Math.sqrt(Math.max(1, (100 - Math.max(...final)) / 8));
  const low = Math.min(...final);
  const weights = final.map((n) => Math.exp((low - n) / temperature));
  return weights[player] / weights.reduce((a, b) => a + b, 0);
}
