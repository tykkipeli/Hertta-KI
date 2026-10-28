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

test("match forecasts share ties, end at 100, conserve probabilities and have no seat bias", async () => {
  const { createMatchEvaluator } = await import("../src/match-value.js");
  const equal = createMatchEvaluator([0, 0, 0, 0], 0, { sequences: 16 })([
    0, 0, 0, 0,
  ]);
  equal.forEach((n) => assert.ok(Math.abs(n - 0.25) < 1e-10));
  const end = createMatchEvaluator([80, 90, 99, 99], 1, { sequences: 8 });
  assert.deepEqual(end([0, 26, 0, 0]), [1, 0, 0, 0]);
  const tie = createMatchEvaluator([80, 80, 99, 99], 2, { sequences: 8 });
  assert.deepEqual(tie([0, 0, 1, 1]), [0.5, 0.5, 0, 0]);
  const state = createMatchEvaluator([12, 24, 38, 19], 3, { sequences: 32 });
  const a = state([0, 10, 8, 8]);
  assert.ok(Math.abs(a.reduce((x, y) => x + y) - 1) < 1e-10);
  a.forEach((n) => assert.ok(n >= 0 && n <= 1));
  assert.deepEqual(a, state([0, 10, 8, 8]));
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

test("passing posterior preserves private facts and all public card constraints", async () => {
  const { createBeliefSampler } = await import("../src/belief.js");
  const { chooseReferencePass } = await import("../src/reference-policy.js");
  for (const direction of [1, 2, 3]) {
    const random = rng(140 + direction),
      hands = deal(random),
      selections = hands.map(chooseReferencePass);
    passCards(hands, selections, direction);
    const state = createState(hands);
    for (let i = 0; i < 20; i++) play(state, policy(state, random));
    const p = state.turn,
      target = (p + direction) % 4,
      source = (p - direction + 4) % 4;
    const o = observe(state, p, { [target]: selections[p] }, [0, 0, 0, 0], {
      from: source,
      cards: selections[source],
    });
    const sampler = createBeliefSampler(o, random, sample, {
      setupMilliseconds: 2000,
    });
    assert.equal(sampler.mode, "passing-posterior");
    const played = state.history.flatMap((t) => t.trick).concat(state.trick);
    for (let i = 0; i < 8; i++) {
      const world = sampler.next();
      assert.deepEqual(world.hands[p], o.hand);
      assert.deepEqual(
        world.hands.map((h) => h.length),
        o.counts,
      );
      assert.equal(
        new Set([...world.hands.flat(), ...played.map((x) => x.card)]).size,
        52,
      );
      world.hands.forEach((hand, q) =>
        assert.ok(hand.every((c) => !o.voids[q].includes(Math.floor(c / 13)))),
      );
      const full = [
        ...world.hands[target],
        ...played.filter((x) => x.player === target).map((x) => x.card),
      ];
      const retained = full.filter((c) => !selections[p].includes(c));
      assert.ok(!retained.includes(36));
      assert.ok(!retained.includes(37));
    }
  }
});

test("human passing is not forced to follow the computer policy", async () => {
  const { createBeliefSampler } = await import("../src/belief.js");
  const { chooseReferencePass } = await import("../src/reference-policy.js");
  const random = rng(902),
    hands = deal(random);
  let owner = hands.findIndex((h) => h.includes(36));
  if (owner !== 0) {
    const replacement = hands[0][0];
    hands[0][0] = 36;
    hands[owner][hands[owner].indexOf(36)] = replacement;
  }
  hands.forEach((h) => h.sort((a, b) => a - b));
  const selections = hands.map((h, p) =>
    p === 0 ? h.filter((c) => c !== 36).slice(0, 3) : chooseReferencePass(h),
  );
  passCards(hands, selections, 1);
  const state = createState(hands);
  let queenSeen = false;
  while (state.completed < 13) {
    if (queenSeen && state.turn === 3) break;
    const c =
      state.turn === 0 && legal(state).includes(36)
        ? 36
        : policy(state, random);
    queenSeen ||= c === 36;
    play(state, c);
  }
  assert.ok(queenSeen);
  assert.ok(state.completed < 13);
  const o = observe(state, 3, { 0: selections[3] }, [0, 0, 0, 0], {
    from: 2,
    cards: selections[2],
  });
  o.humanPlayer = 0;
  const sampler = createBeliefSampler(o, random, sample, {
    setupMilliseconds: 2000,
  });
  assert.equal(sampler.mode, "passing-posterior");
  const world = sampler.next(),
    publicHuman = state.history
      .flatMap((t) => t.trick)
      .concat(state.trick)
      .filter((x) => x.player === 0)
      .map((x) => x.card);
  const retained = [...world.hands[0], ...publicHuman].filter(
    (c) => !selections[3].includes(c),
  );
  assert.ok(retained.includes(36));
});
