import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { legal } from "../src/game.js";

const root = process.argv[2] || "artifacts/learned-rollout-20261031";
const featurePath = path.resolve(root, "overrides/src/policy-features.js");
const { policyFeatures } = await import(pathToFileURL(featurePath).href);
const sources = ["artifacts/decision-audit-20261031", "artifacts/decision-self-audit-20261031", "artifacts/moon-defense-comparison-20261031/control", "artifacts/match-research-20261031/control", "artifacts/search-allocation-20261031/control"];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = { at: new Date().toISOString(), featureSha256: hash(fs.readFileSync(featurePath)), sources: [], records: 0, actions: 0, excludedLate: 0, split: "whole independent four-seat deal blocks: hash mod10,0=test,1=validation,2..9=train", inputBoundary: "acting hand and public history only; known private passes not represented; no true opponent hands or future outcomes", folds: {} };
const out = path.join(root, "policy-data.jsonl");
assert.ok(!fs.existsSync(out), "Do not overwrite frozen training data");
const fd = fs.openSync(out, "wx");
for (const directory of sources) for (let worker = 0; worker < 4; worker++) {
  const file = path.join(directory, "worker-" + worker, "rounds.jsonl");
  const meta = JSON.parse(fs.readFileSync(path.join(path.dirname(file), "meta.json")));
  assert.equal(meta.samples, 64); assert.equal(meta.manifest.hashes["src/agent.js"], "140393371adb40597c2ad5fd593f73def403240bbdcfc247f1c7c92fca041812");
  manifest.sources.push({ file, sha256: hash(fs.readFileSync(file)), runId: meta.runId, seed: meta.seed, games: meta.games, opponentSamples: meta.opponentSamples, opponents: meta.opponents });
  for await (const line of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) {
    const round = JSON.parse(line), blockSeed = (meta.seed + Math.floor(round.game / 4) * 65537) >>> 0;
    const fold = parseInt(hash(String(blockSeed)).slice(0, 8), 16) % 10;
    for (const { observation: o, result } of round.decisions) {
      if (!result.estimates || result.estimates.length < 2) continue;
      if (result.objective !== "round-penalties") { manifest.excludedLate++; continue; }
      const played = Array(52).fill(false);
      for (const t of [...o.history, { trick: o.trick }]) for (const x of t.trick) played[x.card] = true;
      const choices = legal({ ...o, hands: Array.from({ length: 4 }, (_, p) => p === o.player ? o.hand : []) });
      assert.deepEqual(choices, result.estimates.map((e) => e.card));
      const led = o.trick.length ? Math.floor(o.trick[0].card / 13) : -1;
      const ledCards = o.trick.filter((x) => Math.floor(x.card / 13) === led);
      const winning = ledCards.reduce((a, x) => !a || x.card > a.card ? x : a, null);
      const v = { hand: o.hand, choices, led, top: winning ? winning.card % 13 : -1, pot: o.trick.reduce((n, x) => n + (x.card >= 39 ? 1 : x.card === 36 ? 13 : 0), 0), length: o.trick.length, played, taken: o.taken, turn: o.player, winner: winning?.player ?? -1, completed: o.completed, moonPlan: result.analysis.moonPlan, followers: !o.trick.length ? [0, 1, 2, 3].map((color) => [0, 1, 2, 3].filter((p) => p !== o.player && o.counts[p] > 0 && !o.voids[p].includes(color)).length) : undefined };
      const x = policyFeatures(v), values = result.estimates.map((e) => e.relativeScore);
      assert.ok(x.every((row) => row.length === 47 && row.every(Number.isFinite)));
      fs.writeSync(fd, JSON.stringify({ fold, blockSeed, game: round.game, round: round.round, x, values }) + "\n");
      manifest.records++; manifest.actions += choices.length; manifest.folds[fold] = (manifest.folds[fold] || 0) + 1;
    }
  }
  console.error(JSON.stringify({ file, decisions: manifest.records }));
}
fs.closeSync(fd);
manifest.dataSha256 = hash(fs.readFileSync(out));
fs.writeFileSync(path.join(root, "data-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest));
