import { strategicChoice } from "./strategy.js";
// Compact execution of the reference rollout policy. It sees the hypothetical
// player's hand and public trick only; no opponent hand enters card selection.
export function rollout(
  world,
  first,
  rng,
  strategyPlayer = -1,
  moonPlan = false,
  modelOpponentLeads = false,
) {
  const hands = world.hands.map((h) => h.slice());
  const taken = world.taken.slice();
  const voids = world.voids.map((v) => v.slice());
  let turn = world.turn,
    completed = world.completed,
    broken = world.broken;
  let length = world.trick.length,
    led = -1,
    top = -1,
    winner = -1,
    pot = 0;
  for (const x of world.trick) {
    const color = Math.floor(x.card / 13),
      rank = x.card % 13;
    if (led < 0) led = color;
    if (color === led && rank > top) {
      top = rank;
      winner = x.player;
    }
    pot += x.card >= 39 ? 1 : x.card === 36 ? 13 : 0;
  }
  const played = world.played ? world.played.slice() : Array(52).fill(false);
  let card = first;
  while (completed < 13) {
    const hand = hands[turn];
    if (card === null) {
      let choices = [];
      if (length) {
        for (const c of hand) if (Math.floor(c / 13) === led) choices.push(c);
        if (!choices.length && completed === 0)
          for (const c of hand) if (c < 39 && c !== 36) choices.push(c);
      } else if (completed === 0 && hand.includes(0)) choices.push(0);
      else if (!broken) for (const c of hand) if (c < 39) choices.push(c);
      if (!choices.length) choices = hand;
      if (choices.length === 1) card = choices[0];
      else if (
        turn === strategyPlayer ||
        strategyPlayer === -2 ||
        (!length && modelOpponentLeads)
      )
        card = strategicChoice({
          hand,
          choices,
          led,
          top,
          pot,
          length,
          played,
          taken,
          turn,
          winner,
          completed,
          moonPlan: turn === strategyPlayer && moonPlan,
          followerCounts: !length
            ? [0, 1, 2, 3].map(
                (color) =>
                  [0, 1, 2, 3].filter(
                    (p) =>
                      p !== turn &&
                      hands[p].length > 0 &&
                      !voids[p].includes(color),
                  ).map(p => hands[p].length),
              )
            : undefined,
        });
      else if (rng() < 0.08) card = choices[Math.floor(rng() * choices.length)];
      else {
        let best = -Infinity;
        for (const c of choices) {
          const color = Math.floor(c / 13),
            rank = c % 13;
          const points = c >= 39 ? 1 : c === 36 ? 13 : 0;
          const value = !length
            ? -rank - (color === 2 ? 3 : 0) - points * 2
            : color !== led
              ? points * 20 + rank
              : rank <= top
                ? rank + points * 4
                : length === 3 && pot === 0
                  ? rank * 0.7 - points * 5
                  : -20 - pot * 10 - rank - points * 10;
          if (value > best) {
            best = value;
            card = c;
          }
        }
      }
    }
    const color = Math.floor(card / 13),
      rank = card % 13;
    if (length && color !== led && !voids[turn].includes(led))
      voids[turn].push(led);
    played[card] = true;
    hand.splice(hand.indexOf(card), 1);
    if (!length) {
      led = color;
      top = -1;
    }
    if (color === led && rank > top) {
      top = rank;
      winner = turn;
    }
    pot += card >= 39 ? 1 : card === 36 ? 13 : 0;
    if (color === 3) broken = true;
    if (++length === 4) {
      taken[winner] += pot;
      completed++;
      turn = winner;
      length = 0;
      led = -1;
      top = -1;
      pot = 0;
    } else turn = (turn + 1) % 4;
    card = null;
  }
  const moon = taken.indexOf(26);
  return moon < 0 ? taken : taken.map((_, p) => (p === moon ? 0 : 26));
}
