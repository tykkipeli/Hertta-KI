import fs from "node:fs";
import assert from "node:assert/strict";
import readline from "node:readline";
import { policyFeatures } from "./overrides/src/policy-features.js";
import { neuralChoice as original } from "./overrides/src/learned-policy.js";
import { neuralChoice as flat } from "./compiled/learned-policy-flat.js";
import { legal } from "../../src/game.js";

const rows = [];
let count = 0;
for await (const line of readline.createInterface({ input: fs.createReadStream("artifacts/decision-self-audit-20261031/worker-0/rounds.jsonl") })) {
  const round = JSON.parse(line);
  for (const { observation: o, result } of round.decisions) {
    if (!result.estimates?.length) continue;
    const played = Array(52).fill(false);
    for (const t of [...o.history, { trick: o.trick }]) for (const x of t.trick) played[x.card] = true;
    const choices = legal({ ...o, hands: Array.from({ length: 4 }, (_, p) => p === o.player ? o.hand : []) });
    const led = o.trick.length ? Math.floor(o.trick[0].card / 13) : -1;
    const best = o.trick.filter((x) => Math.floor(x.card / 13) === led).reduce((a, x) => !a || x.card > a.card ? x : a, null);
    const v = { hand: o.hand, choices, led, top: best ? best.card % 13 : -1, pot: o.trick.reduce((n, x) => n + (x.card >= 39 ? 1 : x.card === 36 ? 13 : 0), 0), length: o.trick.length, played, taken: o.taken, turn: o.player, winner: best?.player ?? -1, completed: o.completed, moonPlan: result.analysis.moonPlan, followers: !o.trick.length ? [0, 1, 2, 3].map((c) => [0, 1, 2, 3].filter((p) => p !== o.player && o.counts[p] > 0 && !o.voids[p].includes(c)).length) : undefined };
    const before = structuredClone(v), features = policyFeatures(v), chosen = original(v);
    assert.ok(choices.includes(chosen));
    assert.equal(chosen, flat(v));
    assert.deepEqual(v, before);
    // Relative seat rotation must preserve the actor's decision and features.
    for (let shift = 1; shift < 4; shift++) {
      const rotate = (p) => p >= 0 ? (p + shift) % 4 : p;
      const rotated = { ...v, turn: rotate(v.turn), winner: rotate(v.winner), taken: Array.from({ length: 4 }, (_, p) => v.taken[(p - shift + 4) % 4]) };
      assert.deepEqual(policyFeatures(rotated), features);
      assert.equal(original(rotated), chosen);
    }
    count++;
    if (count >= 2000) break;
  }
  if (count >= 2000) break;
}
rows.push({ cases: count, legalActions: true, unchangedInput: true, allSeatRotations: true, flatInferenceExactlyEquivalent: true });
fs.writeFileSync("artifacts/learned-rollout-20261031/policy-invariants.json", JSON.stringify({ rows }, null, 2) + "\n");
console.log(rows);
