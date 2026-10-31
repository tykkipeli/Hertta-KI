// Only this observation crosses the worker boundary; opponents' hands are absent.
export function observe(
  s,
  p,
  known = {},
  totals = [0, 0, 0, 0],
  received = null,
) {
  return {
    received: structuredClone(received),
    totals: [...totals],
    player: p,
    hand: [...s.hands[p]],
    counts: s.hands.map((h) => h.length),
    turn: s.turn,
    trick: structuredClone(s.trick),
    taken: [...s.taken],
    broken: s.broken,
    completed: s.completed,
    history: structuredClone(s.history),
    voids: s.voids.map((v) => [...v]),
    known: structuredClone(known),
  };
}
