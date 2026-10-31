import { strategicChoice, moonPotential } from "./strategy.js";
import { leadWinProbability } from "./lead.js";

// Inputs are exclusively the acting player's hand and public trick information.
// No sampled opponent cards, true hidden cards, or final outcomes enter features.
export function policyFeatures(v) {
  const { hand, choices, led, top, pot, length, played, taken, turn, winner, completed } = v;
  const counts = [0, 0, 0, 0], present = new Uint8Array(52);
  for (const c of hand) { counts[Math.floor(c / 13)]++; present[c] = 1; }
  const reference = strategicChoice(v);
  const possibleMoon = taken.every((n, p) => p === turn || n === 0);
  const moon = possibleMoon && (taken[turn] === 25 || v.moonPlan === true || moonPotential(hand, played) > 0.65 * Math.max(0.25, (26 - taken[turn]) / 26));
  const other = Math.max(...taken.filter((_, p) => p !== turn));
  const threat = taken.findIndex((n, p) => p !== turn && n >= 18 && taken.every((x, q) => q === p || x === 0));
  const cover = hand.filter((c) => c >= 26 && c < 36).length;
  return choices.map((c) => {
    const color = Math.floor(c / 13), r = c % 13, follows = length > 0 && color === led;
    let higher = 0, lower = 0, ownHigher = 0, ownLower = 0;
    for (let x = color * 13; x < (color + 1) * 13; x++) {
      if (present[x]) { if (x > c) ownHigher++; if (x < c) ownLower++; }
      else if (!played[x]) { if (x > c) higher++; if (x < c) lower++; }
    }
    const win = follows && r > top;
    const chance = !length ? leadWinProbability(v.followers?.[color] ?? 3, lower, higher) : win ? 1 : 0;
    return [
      Number(c === reference), r / 12, (r / 12) ** 2,
      Number(color === 0), Number(color === 1), Number(color === 2), Number(color === 3), Number(c === 36),
      Number(length === 0), Number(length === 1), Number(length === 2), Number(length === 3),
      Number(follows), Number(win), Number(follows && !win), Number(length > 0 && !follows),
      counts[color] / 13, Number(counts[color] === 1), Number(counts[color] === 2),
      higher / 13, lower / 13, ownHigher / 13, ownLower / 13, chance,
      pot / 26, Number(pot > 0), Number(pot >= 13),
      taken[turn] / 26, other / 26, Number(moon), Number(threat >= 0), Number(winner === threat && threat >= 0),
      completed / 13, hand.length / 13, cover / 10, Number(present[36]), Number(played[36]),
      Number(c >= 37 && c <= 38), Number(!played[36] && !present[36] && color === 2),
      Number(color === 3) * r / 12, Number(win) * pot / 26, Number(!length) * higher / 13,
      Number(!length) * lower / 13, Number(length > 0 && !follows) * r / 12,
      Number(follows && !win) * r / 12, Number(win && length === 3 && pot === 0) * r / 12,
      (v.followers?.[color] ?? 3) / 3,
    ];
  });
}
