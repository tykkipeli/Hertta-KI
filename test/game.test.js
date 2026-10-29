import test from "node:test";
import assert from "node:assert/strict";
import {
  deal,
  createState,
  legal,
  play,
  points,
  roundScores,
  passCards,
} from "../src/game.js";
import { observe, sample, decide, policy, choosePass } from "../src/ai.js";
function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test("dealing and passing conserve the entire deck", () => {
  const h = deal(rng(1));
  passCards(h, h.map(choosePass), 1);
  assert.equal(new Set(h.flat()).size, 52);
  h.forEach((x) => assert.equal(x.length, 13));
  assert.throws(() => passCards(h, [[0, 0, 0], [], [], []], 1));
});
test("opening, following suit, first trick penalties, hearts breaking", () => {
  const s = createState([
    [0, 39],
    [1, 40],
    [13, 36],
    [2, 41],
  ]);
  assert.deepEqual(legal(s), [0]);
  play(s, 0);
  assert.deepEqual(legal(s), [1]);
  play(s, 1);
  assert.deepEqual(legal(s), [13]);
  play(s, 13);
  play(s, 2);
  assert.equal(s.turn, 3);
  assert.equal(s.broken, false);
  assert.deepEqual(legal(s), [41]);
  play(s, 41);
  assert.equal(s.broken, true);
});
test("queen scoring and shooting the moon", () => {
  assert.equal(points(36), 13);
  assert.equal(points(38), 0);
  assert.deepEqual(roundScores([0, 26, 0, 0]), [26, 0, 26, 26]);
  assert.deepEqual(roundScores([1, 12, 13, 0]), [1, 12, 13, 0]);
});
test("100 complete legal games conserve cards and 26 points", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = rng(seed),
      s = createState(deal(random));
    while (s.completed < 13) play(s, policy(s, random));
    assert.equal(
      s.taken.reduce((a, b) => a + b),
      26,
    );
    assert.equal(s.history.length, 13);
    assert.equal(
      new Set(s.history.flatMap((t) => t.trick.map((x) => x.card))).size,
      52,
    );
    assert.ok(s.hands.every((h) => h.length === 0));
  }
});
test("observations exclude opponents and sampled deals respect voids and known passes", () => {
  const random = rng(91),
    s = createState(deal(random));
  for (let i = 0; i < 28; i++) play(s, policy(s, random));
  const p = s.turn,
    o = observe(s, p);
  assert.equal(o.hands, undefined);
  for (let i = 0; i < 30; i++) {
    const world = sample(o, random);
    assert.ok(world);
    assert.deepEqual(
      world.hands.map((h) => h.length),
      o.counts,
    );
    for (let q = 0; q < 4; q++)
      assert.ok(
        world.hands[q].every((c) => !o.voids[q].includes(Math.floor(c / 13))),
      );
    assert.equal(new Set(world.hands.flat()).size, 24);
  }
  const q = (p + 1) % 4,
    c = s.hands[q][0];
  o.known = { [q]: [c] };
  assert.ok(sample(o, random).hands[q].includes(c));
});
test("simulation returns legal cards throughout a full game", () => {
  const random = rng(121),
    s = createState(deal(random));
  let searched = 0;
  while (s.completed < 13) {
    const result = decide(observe(s, s.turn), {
      milliseconds: 0,
      minSamples: 2,
      rng: random,
    });
    assert.ok(legal(s).includes(result.card));
    searched += result.samples;
    play(s, result.card);
  }
  assert.ok(searched > 0);
  assert.equal(
    s.taken.reduce((a, b) => a + b),
    26,
  );
});

test("each decision is invariant to actual hidden hands and another AI calculation", () => {
  const s = createState(deal(rng(501)));
  play(s, 0);
  const p = s.turn,
    o = observe(
      s,
      p,
      { [(p + 1) % 4]: [s.hands[(p + 1) % 4][0]] },
      [12, 24, 38, 19],
    );
  const first = decide(o, { milliseconds: 0, minSamples: 4, rng: rng(88) });
  const others = [0, 1, 2, 3].filter((q) => q !== p);
  const a = others[0],
    b = others[1];
  [s.hands[a][0], s.hands[b][0]] = [s.hands[b][0], s.hands[a][0]];
  assert.deepEqual(observe(s, p, o.known, o.totals), o);
  const independent = createState(deal(rng(33)));
  decide(observe(independent, independent.turn), {
    milliseconds: 0,
    minSamples: 2,
    rng: rng(33),
  });
  const second = decide(o, { milliseconds: 0, minSamples: 4, rng: rng(88) });
  assert.deepEqual(first, second);
});

test("observation memory, hand and totals are copied, not shared with workers", () => {
  const s = createState(deal(rng(13))),
    p = s.turn,
    known = { [(p + 1) % 4]: [20, 21, 22] },
    totals = [1, 2, 3, 4];
  const o = observe(s, p, known, totals);
  o.hand.pop();
  o.known[(p + 1) % 4].pop();
  o.totals[0] = 99;
  o.voids[0].push(3);
  assert.equal(s.hands[p].length, 13);
  assert.equal(known[(p + 1) % 4].length, 3);
  assert.deepEqual(totals, [1, 2, 3, 4]);
  assert.deepEqual(s.voids[0], []);
});

test("search preserves caller state and consumes real samples", () => {
  const s = createState(deal(rng(111)));
  play(s, 0);
  const o = observe(s, s.turn),
    snapshot = structuredClone(o);
  const r = decide(o, { milliseconds: 0, minSamples: 8, rng: rng(40) });
  assert.ok(legal(s).includes(r.card));
  if (r.estimates) assert.ok(r.samples >= 8);
  assert.deepEqual(o, snapshot);
});

test("search visit counts account for every simulated hand", () => {
  const s = createState(deal(rng(700)));
  play(s, 0);
  const r = decide(observe(s, s.turn), {
    milliseconds: 0,
    minSamples: 4,
    rng: rng(701),
  });
  if (r.estimates)
    assert.equal(
      r.estimates.reduce((n, e) => n + e.samples, 0),
      r.simulations,
    );
});

test("passing model matches the frozen reference strategy", async () => {
  const { chooseReferencePass, isReferencePass } = await import(
    "../src/reference-policy.js"
  );
  const { choosePass: oldPass } = await import("./fixtures/ai-v1.js");
  for (let seed = 0; seed < 40; seed++)
    for (const hand of deal(rng(seed))) {
      const pass = chooseReferencePass(hand);
      assert.deepEqual(pass, oldPass(hand));
      assert.ok(
        isReferencePass(
          hand.filter((c) => !pass.includes(c)),
          pass,
        ),
      );
    }
});

test("compact rollouts preserve the reference policy's outcomes", async () => {
  const { rollout } = await import("../src/rollout.js");
  const { conservativePolicy } = await import("../src/reference-policy.js");
  for (let seed = 0; seed < 12; seed++) {
    const s = createState(deal(rng(seed + 800))),
      random = rng(seed + 900);
    for (let move = 0; move < 48; move++) {
      const first = legal(s)[0],
        copy = structuredClone(s);
      const actual = rollout(s, first, rng(seed + move));
      play(copy, first);
      const simulationRandom = rng(seed + move);
      while (copy.completed < 13)
        play(copy, conservativePolicy(copy, simulationRandom));
      assert.deepEqual(actual, roundScores(copy.taken));
      play(s, conservativePolicy(s, random));
    }
  }
});

test("uniform sampler weights feasible assignments equally despite voids", async () => {
  const { createDealSampler } = await import("../src/deals.js");
  const unknown = [1, 2, 14, 15, 27, 28],
    hand = [0, 13];
  const seen = Array.from({ length: 52 }, (_, c) => c).filter(
    (c) => !unknown.includes(c) && !hand.includes(c),
  );
  const o = {
    player: 0,
    hand,
    counts: [2, 2, 2, 2],
    turn: 0,
    completed: 11,
    trick: [],
    taken: [0, 0, 0, 0],
    broken: true,
    known: {},
    voids: [[], [1], [0], [2]],
    history: [{ trick: seen.map((card) => ({ card, player: 0 })) }],
  };
  const expected = new Set();
  for (let a = 0; a < 6; a++)
    for (let b = a + 1; b < 6; b++) {
      const one = [unknown[a], unknown[b]],
        rest = unknown.filter((c) => !one.includes(c));
      for (let c = 0; c < 4; c++)
        for (let d = c + 1; d < 4; d++) {
          const two = [rest[c], rest[d]],
            three = rest.filter((x) => !two.includes(x));
          if (
            one.some((x) => Math.floor(x / 13) === 1) ||
            two.some((x) => Math.floor(x / 13) === 0) ||
            three.some((x) => Math.floor(x / 13) === 2)
          )
            continue;
          expected.add(JSON.stringify([one, two, three]));
        }
    }
  assert.ok(expected.size > 1);
  const draw = createDealSampler(o),
    random = rng(34567),
    frequencies = new Map();
  for (let i = 0; i < 12000; i++) {
    const world = draw(random);
    const key = JSON.stringify(
      world.hands.slice(1).map((h) => h.sort((a, b) => a - b)),
    );
    assert.ok(expected.has(key));
    frequencies.set(key, (frequencies.get(key) || 0) + 1);
  }
  assert.equal(frequencies.size, expected.size);
  for (const n of frequencies.values())
    assert.ok(
      Math.abs(n - 12000 / expected.size) < (12000 / expected.size) * 0.2,
    );
});
