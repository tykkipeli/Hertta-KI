import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import assert from "node:assert/strict";
import { createState, passCards, play, legal, suit, rank, winner } from "../src/game.js";

const roots = process.argv.slice(2);
if (!roots.length) throw Error("Provide trace roots");
const groups = {}, examples = [];
let rounds = 0, moves = 0;
for (const root of roots) for (const name of fs.readdirSync(root).filter((name) => /^worker-\d+$/.test(name))) {
  const dir = path.join(root, name), meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json")));
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(dir, "rounds.jsonl")), crlfDelay: Infinity })) {
    if (!line) continue;
    const round = JSON.parse(line), hands = structuredClone(round.beforePass);
    passCards(hands, round.passes, round.direction);
    const state = createState(hands);
    for (const [index, move] of round.moves.entries()) {
      const p = state.turn; assert.equal(p, move.player);
      const choices = legal(state); assert.ok(choices.includes(move.card));
      const takers = state.taken.flatMap((n, q) => n > 0 ? [q] : []);
      if (takers.length === 1 && state.taken[takers[0]] >= 13 && takers[0] !== p && state.trick.length && suit(state.trick[0].card) === 3 && winner(state.trick) === takers[0] && choices.length > 1 && choices.every((c) => suit(c) === 3)) {
        const shooter = takers[0], top = Math.max(...state.trick.map((x) => x.card)), winning = choices.filter((c) => c > top), losing = choices.filter((c) => c < top);
        const type = meta.opponents === "original" && p !== round.seat ? "original" : "current";
        const taken = state.taken[shooter], band = taken < 15 ? "13-14" : taken < 18 ? "15-17" : taken < 22 ? "18-21" : "22-25";
        const key = type + "/" + band;
        const g = groups[key] ||= { type, band, decisions: 0, canWinAndLose: 0, stoppedNow: 0, allLosingMultiple: 0, keptHighest: 0, discardedLowest: 0, discardedHighest: 0, discardedMiddle: 0 };
        g.decisions++;
        if (winning.length && losing.length) { g.canWinAndLose++; g.stoppedNow += Number(move.card > top); }
        if (!winning.length && choices.length >= 2) {
          g.allLosingMultiple++;
          g.keptHighest += Number(move.card !== Math.max(...choices));
          g.discardedLowest += Number(move.card === Math.min(...choices));
          g.discardedHighest += Number(move.card === Math.max(...choices));
          g.discardedMiddle += Number(move.card !== Math.min(...choices) && move.card !== Math.max(...choices));
          if (examples.length < 24 && move.card !== Math.max(...choices)) examples.push({ trace: root + "/" + name, game: round.game, round: round.round, move: index, player: p, shooter, choices, selected: move.card, pointsAlreadyTaken: taken, finalTaken: round.taken });
        }
      }
      play(state, move.card); moves++;
    }
    assert.deepEqual(state.taken, round.taken); rounds++;
  }
}
const report = { createdAt: new Date().toISOString(), exploratory: true, note: "Actual hidden hands are used only to reconstruct past legal choices for offline aggregate calibration; no engine receives them.", rounds, moves, groups: Object.values(groups), examples };
fs.writeFileSync(path.join(roots[0], "moon-defense-calibration.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ rounds, moves, groups: report.groups }, null, 2));
