import { leadWinProbability } from "./lead.js";
import { suit, rank } from "./game.js";

// Whole-hand cost: a card's danger depends on its cover and on the suits left.
export function defensiveRisk(hand) {
  const colors = Array.from({ length: 4 }, (_, s) =>
    hand.filter((c) => suit(c) === s),
  );
  let risk = 0;
  for (const s of [0, 1, 3]) {
    const cards = colors[s];
    if (!cards.length) {
      risk -= s === 3 ? 2 : 3.5;
      continue;
    }
    if (cards.length === 1) risk += 1;
    if (cards.length === 2) risk += 0.4;
    for (const c of cards)
      risk += (s === 3 ? 2.8 : 2.2) * ((rank(c) + 1) / 13) ** 3;
  }
  const low = colors[2].filter((c) => c < 36).length;
  if (hand.includes(36)) risk += Math.max(0.8, 13 - 3 * low);
  for (const c of [37, 38])
    if (hand.includes(c)) risk += 5 * Math.exp(-0.7 * low);
  return risk;
}

// Conservative opening assessment. Long controlled hearts and side entries
// matter; merely holding many penalty cards does not make a moon plausible.
export function moonPotential(hand, played = Array(52).fill(false)) {
  if (!played[51] && !hand.includes(51)) return 0;
  const hearts = hand.filter((c) => c >= 39);
  if (hearts.length < 3 && played.slice(39).filter(Boolean).length < 6)
    return 0;
  const topHearts = Array.from({ length: 13 }, (_, i) => 51 - i).filter(
    (c) => !played[c],
  );
  if (!hand.includes(topHearts[0])) return 0;
  let controls = 0,
    losers = 0;
  for (let s = 0; s < 4; s++) {
    const cards = hand.filter((c) => suit(c) === s),
      remaining = Array.from({ length: 13 }, (_, i) => s * 13 + 12 - i).filter(
        (c) => !played[c],
      );
    let run = 0;
    while (run < remaining.length && hand.includes(remaining[run])) run++;
    controls += run;
    losers += Math.max(
      0,
      cards.length - run - (run >= 2 ? Math.max(0, cards.length - 4) : 0),
    );
  }
  const heartRun = topHearts.findIndex((c) => !hand.includes(c));
  const run = heartRun < 0 ? topHearts.length : heartRun;
  return Math.max(
    0,
    Math.min(
      1,
      0.18 * run + 0.035 * controls + 0.025 * hearts.length - 0.14 * losers,
    ),
  );
}

export function chooseStrategicPass(hand, { direction = 1 } = {}) {
  if (!direction) return [];
  let best,
    cost = Infinity;
  const moon = moonPotential(hand) > 0.7;
  // A mediocre thirteen-card hand can become a controlled moon hand after
  // passing three losers. Evaluate that possibility before giving away an ace.
  const exploreMoon =
    !moon && hand.includes(51) && hand.filter((c) => c >= 39).length >= 6;
  let createdMoon,
    createdPotential = -Infinity,
    createdRisk = Infinity;
  for (let a = 0; a < 11; a++)
    for (let b = a + 1; b < 12; b++)
      for (let c = b + 1; c < 13; c++) {
        const retained = hand.filter((_, i) => i !== a && i !== b && i !== c);
        const value = moon
          ? moonPassRisk(retained, hand)
          : defensiveRisk(retained);
        if (value < cost) {
          cost = value;
          best = [hand[a], hand[b], hand[c]];
        }
        if (exploreMoon && retained.filter((card) => card >= 39).length >= 6) {
          const potential = moonPotential(retained),
            risk = defensiveRisk(retained);
          if (
            potential >= 0.9 &&
            (potential > createdPotential ||
              (potential === createdPotential && risk < createdRisk))
          ) {
            createdPotential = potential;
            createdRisk = risk;
            createdMoon = [hand[a], hand[b], hand[c]];
          }
        }
      }
  return createdMoon || best;
}

function moonPassRisk(retained, original) {
  let cost = 0;
  for (let s = 0; s < 4; s++) {
    const cards = retained.filter((c) => suit(c) === s);
    let run = 0;
    while (retained.includes(s * 13 + 12 - run)) run++;
    if (!cards.length) cost += 2;
    cost += Math.max(0, cards.length - run) * 2;
    if (s === 3) cost -= Math.min(4, run) * 3;
  }
  if (original.includes(36) && !retained.includes(36)) cost += 8;
  return cost;
}

// The choice function receives only the acting hypothetical hand and public
// information; it cannot consult the other hypothetical hands.
export function strategicChoice(v) {
  const {
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
  } = v;
  const possibleMoon = taken.every((n, p) => p === turn || n === 0);
  const moon =
    possibleMoon &&
    (taken[turn] === 25 ||
      v.moonPlan === true ||
      moonPotential(hand, played) >
        0.65 * Math.max(0.25, (26 - taken[turn]) / 26));
  const threat = taken.findIndex(
    (n, p) =>
      p !== turn && n >= 18 && taken.every((x, q) => q === p || x === 0),
  );
  const counts = [0, 0, 0, 0];
  for (const c of hand) counts[suit(c)]++;
  const spadeCover = hand.filter((x) => x >= 26 && x < 36).length;
  let best = -Infinity,
    card = choices[0];
  for (const c of choices) {
    const color = suit(c),
      r = rank(c),
      pt = c >= 39 ? 1 : c === 36 ? 13 : 0;
    let higher = 0,
      lower = 0;
    if (!length)
      for (let x = color * 13; x < (color + 1) * 13; x++)
        if (!played[x] && !hand.includes(x)) {
          if (x < c) lower++;
          else if (x > c) higher++;
        }
    let value;
    if (moon) {
      if (!length)
        value =
          (higher === 0 ? 30 : 0) +
          (color === 3 ? 12 : 0) -
          higher * 4 -
          r * 0.05;
      else if (color !== led)
        value = -pt * 30 + r + (counts[color] === 1 ? 5 : 0);
      else if (r > top) value = 30 + pot * 10 - r * 0.2;
      else value = -pt * 20 + r * 0.1;
    } else if (!length) {
      const chance = leadWinProbability(
        v.followers?.[color] ?? 3,
        lower,
        higher,
      );
      value = -40 * chance + r * 0.3 - pt * 20 * chance;
      if (c === 36) value += 12 * (1 - chance);
      if (!played[36] && !hand.includes(36) && color === 2) {
        if (c < 36) value += 4;
        else value -= 80 * chance;
      }
      if (counts[color] <= 2) value += 1;
    } else if (color !== led) {
      const cover = spadeCover;
      const danger =
        c === 36
          ? 100
          : c >= 39
            ? 12 + r * 0.3
            : c === 37 || c === 38
              ? r + 18 * Math.exp(-0.65 * cover)
              : r;
      value = danger + (counts[color] === 1 ? 5 : 0);
    } else if (r <= top) value = r + pt * 10;
    else if (threat >= 0 && winner === threat && pot > 0) value = 60 - r;
    else if (length === 3 && pot === 0) value = r * 0.7 - pt * 8;
    else if (completed === 0 && pot === 0) value = r * 0.2;
    else value = -20 - pot * 10 - r - pt * 10;
    if (value > best) {
      best = value;
      card = c;
    }
  }
  return card;
}

export function describePass(hand, cards) {
  const retained = hand.filter((c) => !cards.includes(c));
  const names = ["Kreuz", "Karo", "Pik", "Herz"],
    reasons = [];
  const cleared = names.filter(
    (_, s) =>
      hand.some((c) => suit(c) === s) && !retained.some((c) => suit(c) === s),
  );
  if (cleared.length)
    reasons.push(
      `Alle ${cleared.join("- und ")}-Karten abgeben; neue Karten können die Farbe wieder auffüllen.`,
    );
  const cover = retained.filter((c) => c >= 26 && c < 36).length;
  if (retained.includes(37) && cover >= 4)
    reasons.push(`Pik-König mit ${cover} kleinen Pik als Deckung behalten.`);
  if (
    moonPotential(hand) > 0.7 ||
    (retained.filter((card) => card >= 39).length >= 6 &&
      moonPotential(retained) >= 0.9)
  )
    reasons.push(
      "Hohe Herzkontrolle für einen möglichen Durchmarsch erhalten.",
    );
  if (!reasons.length)
    reasons.push(
      "Gefährliche hohe Karten abgeben und die Resthand möglichst sicher halten.",
    );
  return reasons.join(" ");
}
