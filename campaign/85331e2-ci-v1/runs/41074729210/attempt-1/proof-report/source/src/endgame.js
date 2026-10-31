import { legal, play, roundScores } from "./game.js";
import {
  matchEndsThisRound,
  matchEndThreat,
  terminalWinShare,
} from "./utility.js";

// Used only when the public information uniquely determines every remaining
// hand. Search against every legal opposing continuation, not cooperative play.
export function solveKnownEndgame(
  world,
  observation,
  { nodeLimit = 8192 } = {},
) {
  const player = observation.player,
    terminal = matchEndsThisRound(observation) || matchEndThreat(observation);
  let nodes = 0;
  function utility(s) {
    const scores = roundScores(s.taken);
    return terminal
      ? Math.max(...scores.map((n, p) => n + observation.totals[p])) >= 100
        ? terminalWinShare(scores, observation.totals, player)
        : 0
      : scores.reduce((n, x, p) => n + (p === player ? -3 * x : x), 0);
  }
  function clone(s) {
    return {
      ...s,
      hands: s.hands.map((h) => h.slice()),
      trick: s.trick.map((x) => ({ ...x })),
      taken: s.taken.slice(),
      history: s.history.slice(),
      voids: s.voids.map((v) => v.slice()),
      played: s.played?.slice(),
    };
  }
  function search(s, alpha, beta) {
    if (++nodes > nodeLimit) throw Error("node-limit");
    if (s.completed === 13) return utility(s);
    const own = s.turn === player;
    let value = own ? -Infinity : Infinity;
    for (const c of legal(s)) {
      const child = clone(s);
      play(child, c);
      const result = search(child, alpha, beta);
      if (own) {
        value = Math.max(value, result);
        alpha = Math.max(alpha, value);
      } else {
        value = Math.min(value, result);
        beta = Math.min(beta, value);
      }
      if (alpha >= beta) break;
    }
    return value;
  }
  try {
    let value = -Infinity,
      card;
    const upper = terminal ? 1 : 78;
    for (const c of legal(world)) {
      const child = clone(world);
      play(child, c);
      const result = search(child, value, Infinity);
      if (result > value) {
        value = result;
        card = c;
      }
      if (value === upper) break;
    }
    return { card, value, nodes, terminal };
  } catch (error) {
    if (error.message === "node-limit") return null;
    throw error;
  }
}
