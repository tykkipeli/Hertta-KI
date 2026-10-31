import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createState, play, roundScores } from "../src/game.js";

const root = "artifacts/decision-audit-20261031", variant = "artifacts/moon-defense-next";
const caseId = process.argv[2] || "worker-1/9/9/32";
const item = Object.values(JSON.parse(fs.readFileSync(root + "/cases.json"))).flat().find((c) => c.id === caseId);
assert.ok(item);
const o = item.observation;
const { createDealSampler } = await import(pathToFileURL(path.resolve(root, "baseline/src/deals.js")).href);
const { rollout } = await import(pathToFileURL(path.resolve(root, "baseline/src/rollout.js")).href);
const directory = path.join(root, "counterexample"); fs.mkdirSync(directory, { recursive: true });
let source = fs.readFileSync(path.join(variant, "src/rollout.js"), "utf8");
source = source.replace(/from "\.\/(.*?)"/g, (_, name) => "from " + JSON.stringify(pathToFileURL(path.resolve(variant, "src", name)).href));
const parameter = "  modelOpponentLeads = false,\n";
assert.equal(source.split(parameter).length, 2);
source = source.replace(parameter, parameter + "  traceMoves = null,\n");
const beforePlay = "    const color = Math.floor(card / 13),";
assert.equal(source.split(beforePlay).length, 2);
source = source.replace(beforePlay, "    if (traceMoves) traceMoves.push({ player: turn, card });\n" + beforePlay);
fs.writeFileSync(path.join(directory, "rollout-trace.mjs"), source);
const { rollout: traceRollout } = await import(pathToFileURL(path.resolve(directory, "rollout-trace.mjs")).href);
const seeded = (initial) => { let n = initial >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };
const random = seeded(0x58a324), draw = createDealSampler(o);
const prior = o.history.flatMap((t) => t.trick).concat(o.trick);
for (let attempt = 0; attempt < 10000; attempt++) {
  const world = draw(random), full = world.hands.map((hand, p) => hand.concat(prior.filter((x) => x.player === p).map((x) => x.card)));
  const state = createState(full);
  let consistent = true;
  try { for (const move of prior) { assert.equal(state.turn, move.player); play(state, move.card); } } catch { consistent = false; }
  if (!consistent) continue;
  assert.equal(state.turn, o.player); assert.deepEqual(state.taken, o.taken);
  const seed = 0x7193 + attempt, oldScores = rollout(world, item.result.card, seeded(seed), o.player, false, true);
  if (!oldScores.every((n, p) => n === (p === o.player ? 0 : 26))) continue;
  const moves = [], newScores = traceRollout(world, item.result.card, seeded(seed), o.player, false, true, moves);
  if (newScores[o.player] === 0) continue;
  for (const move of moves) { assert.equal(state.turn, move.player); play(state, move.card); }
  assert.equal(state.completed, 13); assert.deepEqual(roundScores(state.taken), newScores);
  const record = { caseId, purpose: "Counterexample to a simulated 100% moon claim, not a proof that the selected root card is wrong", usesActualOpponentHands: false, sampledHypotheticalWorld: world, randomSeed: seed, recordedCard: item.result.card, oldScores, legalDefensiveScores: newScores, legalDefensiveTaken: state.taken, legalContinuation: moves, priorHistoryReplayedLegally: true, continuationReplayedLegally: true };
  fs.writeFileSync(path.join(directory, "witness.json"), JSON.stringify(record, null, 2) + "\n");
  console.log(JSON.stringify({ caseId, oldScores, legalDefensiveScores: newScores, legalContinuationMoves: moves.length, priorAndFutureLegalityVerified: true, usesActualOpponentHands: false }));
  process.exit(0);
}
throw Error("No counterexample found in the fixed search limit");
