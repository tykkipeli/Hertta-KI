import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import assert from "node:assert/strict";
import { moonPotential } from "../src/strategy.js";
import { label, points, rank, suit } from "../src/game.js";

const root = process.argv[2] || "artifacts/decision-audit-20261031";
const dirs = fs.readdirSync(root).filter((name) => /^worker-\d+$/.test(name)).sort().map((name) => path.join(root, name));
assert.ok(dirs.length);
const stats = { games: 0, rounds: 0, decisions: 0, searchedDecisions: 0, parityChecks: 0, openingMoonPlans: 0, openingPlansSucceeded: 0, unplannedMoons: 0, ownMoons: 0, opponentMoons: 0, openingPlanOwnPoints: 0, noPlanOwnPoints: 0, beforePassPlans: 0, passLostPlan: 0, postPassGainedPlan: 0 };
const categories = {}, candidates = {}, runIds = new Set();
const buckets = [[0, .01], [.01, .1], [.1, .25], [.25, .5], [.5, .75], [.75, 1.01]].map(([low, high]) => ({ low, high, rounds: 0, predictedMoonSum: 0, realizedMoons: 0, expectedPointsSum: 0, actualPointsSum: 0 }));
function chosenEstimate(decision) { return decision.result.estimates?.find((e) => e.card === decision.result.card); }
function score(e, result) { return result.objective === "match-win" ? e.winProbability : result.objective === "late-match-win-estimate" ? e.estimatedWinProbability : e.relativeScore; }
for (const dir of dirs) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json")));
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json")));
  assert.equal(result.state, "completed"); assert.equal(result.completedGames, meta.games);
  assert.ok(!runIds.has(meta.runId)); runIds.add(meta.runId);
  stats.games += result.completedGames; stats.parityChecks += result.parityChecks;
  let count = 0;
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(dir, "rounds.jsonl")), crlfDelay: Infinity })) {
    if (!line) continue;
    const round = JSON.parse(line); count++; stats.rounds++; stats.decisions += round.decisions.length;
    assert.equal(round.runId, meta.runId); assert.equal(round.moves.length, 52); assert.equal(round.decisions.length, 13);
    const own = round.seat, ownMoon = round.taken[own] === 26, plan = round.openingMoonPotential > .7;
    stats.ownMoons += Number(ownMoon); stats.opponentMoons += Number(round.taken.some((n, p) => p !== own && n === 26));
    if (plan) { stats.openingMoonPlans++; stats.openingPlansSucceeded += Number(ownMoon); stats.openingPlanOwnPoints += round.scores[own]; }
    else { stats.noPlanOwnPoints += round.scores[own]; stats.unplannedMoons += Number(ownMoon); }
    stats.beforePassPlans += Number(round.beforePassMoonPotential > .7);
    stats.passLostPlan += Number(round.beforePassMoonPotential > .7 && !plan);
    stats.postPassGainedPlan += Number(round.beforePassMoonPotential <= .7 && plan);
    const first = round.decisions.find((d) => chosenEstimate(d)?.analysis);
    if (first) {
      const estimate = chosenEstimate(first).analysis;
      const bucket = buckets.find((b) => estimate.moon >= b.low && estimate.moon < b.high);
      bucket.rounds++; bucket.predictedMoonSum += estimate.moon; bucket.realizedMoons += Number(ownMoon);
      bucket.expectedPointsSum += estimate.ownPoints; bucket.actualPointsSum += round.scores[own];
    }
    const seen = new Set();
    function flag(kind, decision, severity, explanation) {
      if (seen.has(kind)) return; seen.add(kind);
      categories[kind] = (categories[kind] || 0) + 1;
      const item = { id: path.basename(dir) + "/" + round.game + "/" + round.round + "/" + decision.move, kind, severity, explanation, source: path.join(dir, "rounds.jsonl"), game: round.game, round: round.round, move: decision.move, seat: own, hand: decision.observation.hand.map(label), playedCard: label(decision.result.card), openingMoonPotential: round.openingMoonPotential, actualTaken: round.taken, actualScores: round.scores, observation: decision.observation, result: decision.result };
      (candidates[kind] ||= []).push(item);
      candidates[kind].sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
      candidates[kind] = candidates[kind].slice(0, 16);
    }
    for (const decision of round.decisions) {
      const { observation: o, result: r } = decision, estimate = chosenEstimate(decision);
      if (!estimate) continue; stats.searchedDecisions++;
      const selected = r.card, prior = r.analysis?.openingMoonPotential || 0;
      const possible = o.taken.every((n, p) => p === own || n === 0);
      const played = Array(52).fill(false);
      for (const trick of [...o.history, { trick: o.trick }]) for (const x of trick.trick) played[x.card] = true;
      const alternative = Math.max(...r.estimates.filter((e) => e.card !== selected).map((e) => score(e, r)));
      const gap = score(estimate, r) - alternative;
      if (estimate.analysis.moon >= .25 && !ownMoon && round.scores[own] >= 10)
        flag("optimistic-moon-failed", decision, estimate.analysis.moon, "High simulated moon probability followed by a failed moon; calibration finding, not proof of a wrong move.");
      if (prior > .7 && possible && o.trick.length && suit(selected) !== suit(o.trick[0].card) && points(selected) > 0)
        flag("opening-moon-plan-abandoned", decision, estimate.analysis.moon, "A penalty discard gives up the opening moon plan; could be a rational retreat.");
      if (!plan && possible && moonPotential(o.hand, played) > .7)
        flag("dynamic-moon-opportunity", decision, moonPotential(o.hand, played), "Remaining public masters suggest a moon despite the original opening threshold.");
      if (o.trick.length) {
        const led = suit(o.trick[0].card), pot = o.trick.reduce((sum, x) => sum + points(x.card), 0);
        const highest = o.trick.filter((x) => suit(x.card) === led).reduce((a, b) => a.card > b.card ? a : b);
        const offSuit = suit(selected) !== led;
        const ownImpossible = o.taken.some((n, p) => p !== own && n > 0);
        if (offSuit && (o.hand.includes(37) || o.hand.includes(38)) && selected >= 26 && selected < 36 && o.hand.filter((c) => c >= 26 && c < 36).length >= 3 && !played[36] && ownImpossible)
          flag("small-spade-discard-keeps-king", decision, o.hand.filter((c) => c >= 26 && c < 36).length + gap, "A small spade is discarded while an off-suit king/ace could be shed; preserving control may still matter.");
        if (o.hand.includes(36) && r.estimates.some((e) => e.card === 36) && selected !== 36 && led !== 2 && ownImpossible && o.taken.filter((n) => n > 0).length >= 2 && Math.max(...o.totals) < 74)
          flag("safe-queen-discard-declined", decision, gap, "Early match, own/opponent moons already impossible, legal queen dump declined; inspect alternatives rather than assume an error.");
        if (o.trick.length === 3) {
          const wins = (card) => suit(card) === led && rank(card) > rank(highest.card);
          if (pot > 0 && wins(selected) && r.estimates.some((e) => !wins(e.card)))
            flag("avoidable-last-seat-points", decision, pot + points(selected), "Takes a known penalty trick despite a legal losing card; moon or match-win objectives can justify this.");
          if (pot > 0 && !wins(selected) && o.taken[highest.player] >= 14 && o.taken.every((n, p) => p === highest.player || n === 0) && r.estimates.some((e) => wins(e.card)))
            flag("moon-stop-declined", decision, pot, "Could stop an opponent's sole-point moon now; compare its future threat and match score.");
        }
      } else if ([37, 38].includes(selected) && o.hand.some((c) => c >= 26 && c < 36) && !played[36] && possible === false)
        flag("high-spade-lead-with-guards", decision, gap, "Leads an exposed high spade despite low guards; can be justified by known queen location or public voids.");
    }
  }
  assert.equal(count, result.totalRounds);
}
const summary = { createdAt: new Date().toISOString(), exploratory: true, warning: "Flags are hypotheses, not demonstrated errors. Fixed-sample audit data are not a new strength confirmation.", ...stats, openingPlanSuccessRate: stats.openingPlansSucceeded / Math.max(1, stats.openingMoonPlans), meanOwnPointsWithPlan: stats.openingPlanOwnPoints / Math.max(1, stats.openingMoonPlans), meanOwnPointsWithoutPlan: stats.noPlanOwnPoints / Math.max(1, stats.rounds - stats.openingMoonPlans), categories, calibration: buckets.map((b) => ({ ...b, predictedMoon: b.predictedMoonSum / Math.max(1, b.rounds), realizedMoon: b.realizedMoons / Math.max(1, b.rounds), expectedOwnPoints: b.expectedPointsSum / Math.max(1, b.rounds), actualOwnPoints: b.actualPointsSum / Math.max(1, b.rounds) })) };
fs.writeFileSync(path.join(root, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
fs.writeFileSync(path.join(root, "cases.json"), JSON.stringify(candidates, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
