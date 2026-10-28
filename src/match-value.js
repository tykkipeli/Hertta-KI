import { futureModel } from "./future-model.js";

// Sample future score sequences, preserving correlations and moon outcomes.
// Four seat rotations of every sequence prevent an arbitrary seat advantage.
export function createMatchEvaluator(
  totals,
  phase = 0,
  { sequences = 128 } = {},
) {
  let seed = 2166136261;
  for (const n of [...totals, phase])
    seed = Math.imul(seed ^ n, 16777619) >>> 0;
  const rng = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // At least 26 points are added per round; 16 rounds must cross 100.
  const traces = [];
  for (let sample = 0; sample < sequences; sample++) {
    const base = [];
    for (let step = 0; step < 16; step++) {
      const bank = futureModel.phases[(phase + step) % 4],
        scores = bank[Math.floor(rng() * bank.length)],
        rotation = Math.floor(rng() * 4);
      base.push(
        Array.from({ length: 4 }, (_, p) => scores[(p + rotation) % 4]),
      );
    }
    for (let rotation = 0; rotation < 4; rotation++) {
      const cumulative = new Uint16Array(64),
        hit = new Uint8Array(108);
      hit.fill(16);
      for (let step = 0; step < 16; step++)
        for (let p = 0; p < 4; p++)
          cumulative[step * 4 + p] =
            (step ? cumulative[(step - 1) * 4 + p] : 0) +
            base[step][(p + rotation) % 4];
      for (let p = 0; p < 4; p++)
        for (let score = 0; score <= 26; score++) {
          const threshold = 100 - totals[p] - score;
          for (let step = 0; step < 16; step++)
            if (cumulative[step * 4 + p] >= threshold) {
              hit[p * 27 + score] = step;
              break;
            }
        }
      traces.push({ cumulative, hit });
    }
  }
  const cache = new Map();
  return (scores) => {
    const key =
      scores[0] | (scores[1] << 5) | (scores[2] << 10) | (scores[3] << 15);
    if (cache.has(key)) return cache.get(key);
    const start = scores.map((n, p) => n + totals[p]),
      wins = [0, 0, 0, 0];
    if (start.some((n) => n >= 100)) {
      const low = Math.min(...start),
        count = start.filter((n) => n === low).length;
      const result = start.map((n) => (n === low ? 1 / count : 0));
      cache.set(key, result);
      return result;
    }
    for (const { cumulative, hit } of traces) {
      const step = Math.min(
        hit[scores[0]],
        hit[27 + scores[1]],
        hit[54 + scores[2]],
        hit[81 + scores[3]],
      );
      if (step >= 16) throw Error("Future trace failed to reach the match end");
      const offset = step * 4,
        a = start[0] + cumulative[offset],
        b = start[1] + cumulative[offset + 1],
        c = start[2] + cumulative[offset + 2],
        d = start[3] + cumulative[offset + 3];
      const low = Math.min(a, b, c, d),
        count =
          Number(a === low) +
          Number(b === low) +
          Number(c === low) +
          Number(d === low);
      if (a === low) wins[0] += 1 / count;
      if (b === low) wins[1] += 1 / count;
      if (c === low) wins[2] += 1 / count;
      if (d === low) wins[3] += 1 / count;
    }
    const result = wins.map((n) => n / traces.length);
    cache.set(key, result);
    return result;
  };
}
export function nextPassingPhase(o) {
  const target = Object.keys(o.known || {})[0];
  if (target === undefined) return 0;
  const direction = (Number(target) - o.player + 4) % 4;
  return direction === 1 ? 1 : direction === 3 ? 2 : 3;
}
