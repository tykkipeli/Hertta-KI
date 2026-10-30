// Independent-recipient approximation: each unseen card is assigned to one
// eligible opponent. A leader can retain the trick if every opponent holding
// a higher card also has a lower card with which to duck. Public voids reduce
// the eligible count. Capacities and strategic choices make intermediate
// values approximate; the zero/one extremes follow directly from card ranks.
const table = Array.from({ length: 4 }, () =>
  Array.from({ length: 13 }, () => Array(13).fill(0)),
);
for (let n = 1; n <= 3; n++)
  for (let lower = 0; lower <= 12; lower++) {
    let occupied = [1, 0, 0, 0];
    for (let i = 0; i < lower; i++) {
      const next = [0, 0, 0, 0];
      for (let k = 0; k <= n; k++) {
        next[k] += (occupied[k] * k) / n;
        if (k < n) next[k + 1] += (occupied[k] * (n - k)) / n;
      }
      occupied = next;
    }
    for (let higher = 0; higher <= 12; higher++)
      table[n][lower][higher] =
        higher === 0
          ? 1
          : occupied.reduce((sum, p, k) => sum + p * (k / n) ** higher, 0);
  }
export function leadWinProbability(followers, lower, higher) {
  return followers === 0 ? 1 : table[followers][lower][higher];
}
