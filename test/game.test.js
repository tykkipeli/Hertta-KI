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

test("passing creates a diamond void while retaining a well-covered spade king", async () => {
  const { chooseStrategicPass } = await import("../src/strategy.js");
  const hand = [0, 5, 9, 19, 20, 26, 27, 28, 29, 30, 31, 37, 49],
    original = hand.slice();
  for (const direction of [1, 2, 3])
    assert.deepEqual(
      new Set(chooseStrategicPass(hand, { direction })),
      new Set([19, 20, 49]),
    );
  assert.deepEqual(new Set(choosePass(hand)), new Set([19, 20, 49]));
  assert.deepEqual(hand, original);
  assert.deepEqual(chooseStrategicPass(hand, { direction: 0 }), []);
  const exposed = [0, 5, 9, 19, 20, 13, 14, 15, 16, 17, 18, 37, 49];
  assert.ok(chooseStrategicPass(exposed).includes(37));
});

test("a controlled moon hand retains the queen and its high heart run", async () => {
  const { chooseStrategicPass, moonPotential } = await import(
    "../src/strategy.js"
  );
  const hand = [12, 11, 25, 36, 37, 38, 45, 46, 47, 48, 49, 50, 51];
  assert.ok(moonPotential(hand) > 0.7);
  assert.ok(
    moonPotential([0, 1, 2, 13, 14, 26, 39, 40, 41, 42, 43, 44, 45]) < 0.2,
  );
  const sent = chooseStrategicPass(hand);
  for (const c of [36, 48, 49, 50, 51]) assert.ok(!sent.includes(c));
});

test("moon play takes points economically and abandons the plan when another player scores", async () => {
  const { strategicChoice } = await import("../src/strategy.js");
  const v = {
    hand: [39, 48, 49, 50, 51],
    choices: [39, 48, 49, 50, 51],
    led: 3,
    top: 8,
    pot: 2,
    length: 3,
    played: Array(52).fill(false),
    taken: [13, 0, 0, 0],
    turn: 0,
    winner: 1,
    completed: 5,
  };
  assert.equal(strategicChoice(v), 48);
  assert.equal(strategicChoice({ ...v, taken: [13, 1, 0, 0] }), 39);
  assert.equal(strategicChoice({ ...v, taken: [0, 18, 0, 0] }), 48);
});

test("game-winning objective activates only when public points guarantee the match ends", async () => {
  const { matchEndsThisRound, matchEndThreat, terminalWinShare } = await import(
    "../src/utility.js"
  );
  assert.equal(
    matchEndsThisRound({ totals: [80, 79, 95, 90], taken: [0, 1, 5, 0] }),
    true,
  );
  assert.equal(
    matchEndsThisRound({ totals: [0, 0, 95, 0], taken: [0, 0, 5, 0] }),
    false,
  );
  assert.equal(
    matchEndsThisRound({ totals: [80, 0, 95, 0], taken: [0, 0, 5, 0] }),
    true,
  );
  assert.equal(terminalWinShare([0, 10, 10, 6], [80, 79, 95, 90], 0), 1);
  assert.equal(terminalWinShare([0, 0, 13, 13], [80, 79, 95, 90], 0), 0);
  assert.equal(terminalWinShare([0, 0, 13, 13], [79, 79, 95, 90], 0), 0.5);
});

test("a moon plan survives using its high cards and stops when an opponent scores", async () => {
  const { strategicChoice } = await import("../src/strategy.js");
  const played = Array(52).fill(true);
  for (const c of [0, 1, 2, 3, 13, 14, 26, 51]) played[c] = false;
  const v = {
    hand: [0, 51],
    choices: [0, 51],
    led: -1,
    top: -1,
    pot: 0,
    length: 0,
    played,
    taken: [25, 0, 0, 0],
    turn: 0,
    winner: -1,
    completed: 11,
    moonPlan: true,
  };
  assert.equal(strategicChoice(v), 51);
  assert.equal(strategicChoice({ ...v, taken: [24, 1, 0, 0] }), 0);
});

test("known endgame search matches exhaustive adversarial play", async () => {
  const { solveKnownEndgame } = await import("../src/endgame.js");
  const { matchEndsThisRound, matchEndThreat, terminalWinShare } = await import(
    "../src/utility.js"
  );
  for (let seed = 0; seed < 50; seed++) {
    const r = rng(8100 + seed),
      s = createState(deal(r));
    while (s.completed < 11) play(s, policy(s, r));
    const o = observe(s, s.turn, {}, [80, 85, 90, 95]),
      terminal = matchEndsThisRound(o) || matchEndThreat(o),
      p = s.turn;
    function exhaustive(state) {
      if (state.completed === 13) {
        const scores = roundScores(state.taken);
        return terminal
          ? Math.max(...scores.map((n, q) => n + o.totals[q])) >= 100
            ? terminalWinShare(scores, o.totals, p)
            : 0
          : scores.reduce((n, x, q) => n + (q === p ? -3 * x : x), 0);
      }
      const values = legal(state).map((c) => {
        const copy = structuredClone(state);
        play(copy, c);
        return exhaustive(copy);
      });
      return state.turn === p ? Math.max(...values) : Math.min(...values);
    }
    const solved = solveKnownEndgame(s, o, { nodeLimit: 100000 });
    assert.ok(solved);
    assert.equal(solved.value, exhaustive(s));
    const next = structuredClone(s);
    play(next, solved.card);
    assert.equal(exhaustive(next), solved.value);
  }
});

test("sampler marks a deal unique only when public constraints determine all hands", async () => {
  const { createDealSampler } = await import("../src/deals.js");
  const random = rng(844),
    s = createState(deal(random));
  while (s.completed < 11) play(s, policy(s, random));
  const o = observe(s, s.turn);
  o.known = Object.fromEntries(
    [0, 1, 2, 3].filter((p) => p !== s.turn).map((p) => [p, [...s.hands[p]]]),
  );
  assert.equal(createDealSampler(o).totalDeals, 1);
  const ordinary = observe(createState(deal(rng(1))), 0);
  assert.ok(createDealSampler(ordinary).totalDeals > 1);
});

test("lead rank model matches exhaustive recipient assignments", async () => {
  const { leadWinProbability } = await import("../src/lead.js");
  for (let n = 1; n <= 3; n++)
    for (let lower = 0; lower <= 3; lower++)
      for (let higher = 0; higher <= 3; higher++) {
        let retained = 0;
        const total = n ** (lower + higher);
        for (let code = 0; code < total; code++) {
          let state = code;
          const lows = Array(n).fill(0),
            highs = Array(n).fill(0);
          for (let i = 0; i < lower + higher; i++) {
            const p = state % n;
            state = Math.floor(state / n);
            (i < lower ? lows : highs)[p]++;
          }
          if (highs.every((v, p) => v === 0 || lows[p] > 0)) retained++;
        }
        assert.ok(
          Math.abs(leadWinProbability(n, lower, higher) - retained / total) <
            1e-12,
        );
      }
});

test("a printed low card that became a master is not mistaken for a safe exit", async () => {
  const { strategicChoice } = await import("../src/strategy.js");
  const played = Array(52).fill(true);
  for (const c of [0, 23, 24, 25]) played[c] = false;
  const v = {
    hand: [0, 23],
    choices: [0, 23],
    led: -1,
    top: -1,
    pot: 0,
    length: 0,
    played,
    taken: [0, 1, 0, 0],
    turn: 0,
    winner: -1,
    completed: 11,
    followers: [0, 2, 0, 0],
  };
  assert.equal(strategicChoice(v), 23);
});

test("late match value prefers surviving a certain loss and securing an available win", async () => {
  const { matchEndThreat, lateMatchValue } = await import("../src/utility.js");
  assert.equal(
    matchEndThreat({ totals: [0, 10, 20, 30], taken: [0, 0, 0, 0] }),
    false,
  );
  assert.equal(
    matchEndThreat({ totals: [70, 80, 85, 86], taken: [0, 0, 5, 0] }),
    true,
  );
  const ends = [0, 0, 1, 25],
    survives = [10, 0, 0, 16];
  assert.equal(lateMatchValue(ends, [84, 50, 99, 80], 0), 0);
  assert.ok(lateMatchValue(survives, [84, 50, 99, 80], 0) > 0);
  assert.equal(lateMatchValue(ends, [50, 70, 99, 80], 0), 1);
  assert.ok(lateMatchValue(survives, [50, 70, 99, 80], 0) < 1);
  assert.equal(lateMatchValue([0, 13, 7, 6], [53, 50, 95, 96], 0), 1);
  assert.equal(lateMatchValue([0, 0, 13, 13], [53, 50, 95, 96], 0), 0);
});

test("public queen beliefs preserve the RNG when there is no relative evidence", async () => {
  const { createQueenBelief } = await import("../src/queen-belief.js");
  const o = {
    player: 0,
    hand: [0],
    history: [],
    trick: [],
    totals: [0, 0, 0, 0],
    taken: [0, 0, 0, 0],
    counts: [1, 1, 1, 1],
    voids: [[], [], [], []],
    known: {},
  };
  let calls = 0;
  const random = () => {
      calls++;
      return 0.3;
    },
    world = { hands: [[0], [36], [13], [39]] };
  const b = createQueenBelief(o, () => world);
  assert.equal(b.mode, "uniform");
  assert.equal(b.next(random), world);
  assert.equal(calls, 0);
  const uncertain = createQueenBelief(
    {
      ...o,
      history: [
        {
          trick: [
            { player: 0, card: 0 },
            { player: 1, card: 1 },
            { player: 2, card: 2 },
            { player: 3, card: 3 },
          ],
        },
      ],
      trick: [
        { player: 0, card: 37 },
        { player: 1, card: 27 },
      ],
    },
    () => world,
  );
  assert.equal(uncertain.mode, "public-action-queen-prior");
  assert.equal(
    uncertain.next(() => 0),
    world,
  ); // Even the missed opportunity never excludes this holder.
  const endgame = createQueenBelief(
    { ...o, totals: [0, 0, 90, 0] },
    () => world,
  );
  assert.equal(endgame.mode, "uniform");
});

test("the search keeps a losing match alive instead of gifting the queen to a player at 99", async () => {
  const { shuffle } = await import("../src/game.js");
  const { decide: oldDecide, observe: oldObserve } = await import(
    "./fixtures/ai-v1.js"
  );
  const reserved = [
      [36, 38],
      [26, 12],
      [37, 25],
      [27, 1],
    ],
    random = rng(67148);
  const pool = shuffle(
    Array.from({ length: 52 }, (_, c) => c).filter(
      (c) => !reserved.flat().includes(c),
    ),
    random,
  );
  const state = createState(
    reserved.map((cards, p) =>
      [...cards, ...pool.slice(p * 11, p * 11 + 11)].sort((a, b) => a - b),
    ),
  );
  while (state.completed < 11) {
    const choices = legal(state).filter(
      (c) => !reserved[state.turn].includes(c),
    );
    assert.ok(choices.length);
    play(state, choices[Math.floor(random() * choices.length)]);
  }
  assert.equal(state.turn, 0);
  assert.deepEqual(state.hands[0], [36, 38]);
  const known = {
    2: [
      37,
      25,
      state.history.flatMap((t) => t.trick).find((x) => x.player === 2).card,
    ],
  };
  const totals = [80, 77, 99, 80].map((n, p) => n - state.taken[p]);
  const old = oldDecide(oldObserve(state, 0, known), {
    milliseconds: 0,
    minSamples: 32,
    rng: rng(5),
  });
  const current = decide(observe(state, 0, known, totals), {
    milliseconds: 0,
    minSamples: 32,
    rng: rng(5),
  });
  assert.equal(old.card, 36);
  assert.equal(current.card, 38);
  assert.equal(current.objective, "late-match-win-estimate");
});

test("missed safe queen discards reduce a hypothesis weight without excluding it", async () => {
  const { createQueenBelief } = await import("../src/queen-belief.js");
  const o = {
    player: 0,
    hand: [12],
    history: [
      {
        trick: [
          { player: 0, card: 0 },
          { player: 1, card: 1 },
          { player: 2, card: 2 },
          { player: 3, card: 3 },
        ],
      },
    ],
    trick: [
      { player: 0, card: 37 },
      { player: 1, card: 27 },
    ],
    totals: [0, 0, 0, 0],
    taken: [0, 0, 0, 0],
    counts: [1, 1, 1, 1],
    voids: [[], [], [], []],
    known: {},
  };
  const bad = { hands: [[12], [36], [13], [39]] },
    good = { hands: [[12], [13], [36], [39]] };
  let at = 0;
  const belief = createQueenBelief(o, () => (++at % 2 ? bad : good)),
    random = rng(7612);
  let kept = 0;
  for (let n = 0; n < 5000; n++) kept += belief.next(random) === bad ? 1 : 0;
  assert.ok(kept > 50 && kept < 500);
  let draws = 0;
  const positive = createQueenBelief(o, () => {
    draws++;
    return bad;
  });
  assert.equal(
    positive.next(() => 0),
    bad,
  );
  assert.equal(draws, 1);
});

test("queen beliefs allow a protected queen to be deliberately retained", async () => {
  const { createQueenBelief } = await import("../src/queen-belief.js");
  const o = {
    player: 0,
    hand: [12],
    history: [
      {
        trick: [
          { player: 0, card: 0 },
          { player: 1, card: 1 },
          { player: 2, card: 2 },
          { player: 3, card: 3 },
        ],
      },
    ],
    trick: [
      { player: 0, card: 4 },
      { player: 1, card: 13 },
    ],
    totals: [0, 0, 0, 0],
    taken: [0, 0, 0, 0],
    counts: [1, 5, 5, 5],
    voids: [[], [], [], []],
    known: { 1: [36] },
  };
  const covered = { hands: [[12], [26, 27, 28, 29, 36], [14], [39]] },
    exposed = { hands: [[12], [14, 15, 16, 17, 36], [26], [39]] };
  let at = 0;
  const belief = createQueenBelief(o, () => (++at % 2 ? covered : exposed)),
    random = rng(7123);
  let nCovered = 0;
  for (let n = 0; n < 5000; n++)
    nCovered += belief.next(random) === covered ? 1 : 0;
  assert.ok(nCovered > 3000 && nCovered < 4400);
});

test("end-of-match bounds account for shooting the moon", async () => {
  const { matchEndsThisRound, matchEndThreat } = await import(
    "../src/utility.js"
  );
  assert.equal(
    matchEndsThisRound({ totals: [20, 90, 0, 0], taken: [26, 0, 0, 0] }),
    true,
  );
  assert.equal(
    matchEndsThisRound({ totals: [95, 20, 0, 0], taken: [26, 0, 0, 0] }),
    false,
  );
  assert.equal(
    matchEndThreat({ totals: [74, 20, 0, 0], taken: [16, 0, 0, 0] }),
    false,
  );
  assert.equal(
    matchEndThreat({ totals: [74, 20, 0, 0], taken: [0, 0, 0, 0] }),
    true,
  );
  assert.equal(
    matchEndThreat({ totals: [20, 20, 87, 20], taken: [0, 13, 0, 0] }),
    true,
  );
});

test("a void is used to discard the protected king rather than burn its small spade guards", async () => {
  const { strategicChoice } = await import("../src/strategy.js");
  const hand = [26, 27, 28, 29, 30, 31, 37];
  const v = {
    hand,
    choices: hand,
    led: 1,
    top: 5,
    pot: 0,
    length: 1,
    played: Array(52).fill(false),
    taken: [0, 1, 0, 0],
    turn: 0,
    winner: 1,
    completed: 4,
  };
  assert.equal(strategicChoice(v), 37);
  const withAnotherExit = { ...v, hand: [...hand, 12], choices: [...hand, 12] };
  assert.equal(strategicChoice(withAnotherExit), 12);
});
