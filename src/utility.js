// Once public points guarantee that this round ends the match, optimise the
// actual winner rather than treating all destinations of penalty cards alike.
export function matchEndsThisRound(o) {
  const totals = o.totals || [0, 0, 0, 0],
    takers = o.taken.flatMap((n, p) => (n > 0 ? [p] : []));
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
