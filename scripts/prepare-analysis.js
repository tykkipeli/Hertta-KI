import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const destination = process.argv[2];
const source = process.argv[3] || ".";
const overrides = process.argv[4];
if (!destination) throw Error("Usage: node scripts/prepare-analysis.js OUTPUT_DIRECTORY [SOURCE_DIRECTORY] [OVERRIDES_DIRECTORY]");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = fs.readdirSync(path.join(source, "src")).filter((name) => name.endsWith(".js")).sort()
  .map((name) => "src/" + name).concat(["test/fixtures/ai-v1.js", "package.json"]);
assert.ok(!fs.existsSync(destination), "Analysis snapshots must not overwrite earlier runs");
fs.mkdirSync(destination, { recursive: true });
const hashes = {};
for (const file of files) {
  const bytes = fs.readFileSync(path.join(source, file));
  fs.mkdirSync(path.dirname(path.join(destination, file)), { recursive: true });
  fs.writeFileSync(path.join(destination, file), bytes);
  hashes[file] = hash(bytes);
}
const baselineHashes = structuredClone(hashes);
if (overrides) {
  function apply(directory, relative = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.posix.join(relative, entry.name);
      assert.ok(!entry.isSymbolicLink(), "Do not follow experiment symlinks");
      if (entry.isDirectory()) apply(path.join(directory, entry.name), file);
      else {
        assert.ok(file.startsWith("src/") && file.endsWith(".js"), "Overrides must be JavaScript under src/");
        const bytes = fs.readFileSync(path.join(directory, entry.name));
        fs.mkdirSync(path.dirname(path.join(destination, file)), { recursive: true });
        fs.writeFileSync(path.join(destination, file), bytes); hashes[file] = hash(bytes);
      }
    }
  }
  apply(overrides);
}
let instrumented = fs.readFileSync(path.join(destination, "src/agent.js"), "utf8");
function replaceOnce(before, after) {
  assert.equal(instrumented.split(before).length, 2, "Diagnostic anchor changed: " + before);
  instrumented = instrumented.replace(before, after);
}
replaceOnce("  const pointSums = choices.map(() => 0);", `  const outcomes = choices.map(() => ({ ownPoints: 0, moon: 0, opponentMoon: 0, atLeast13: 0, zero: 0 }));
  const pointSums = choices.map(() => 0);`);
replaceOnce("      pointSums[i] += pointsValue;", `      outcomes[i].ownPoints += scores[o.player];
      outcomes[i].moon += Number(scores.every((score, p) => score === (p === o.player ? 0 : 26)));
      outcomes[i].opponentMoon += Number(scores.some((score, p) => p !== o.player && score === 0 && scores.every((n, q) => n === (q === p ? 0 : 26))));
      outcomes[i].atLeast13 += Number(scores[o.player] >= 13);
      outcomes[i].zero += Number(scores[o.player] === 0);
      pointSums[i] += pointsValue;`);
replaceOnce("    beliefMode: beliefs.mode,", "    beliefMode: beliefs.mode,\n    analysis: { moonPlan, openingMoonPotential: moonPotential(originalHand) },");
replaceOnce("      stderr: Math.sqrt(", `      analysis: Object.fromEntries(Object.entries(outcomes[i]).map(([key, value]) => [key, value / n])),
      stderr: Math.sqrt(`);
const diagnosticFile = "src/agent-diagnostic.js";
fs.writeFileSync(path.join(destination, diagnosticFile), instrumented);
const manifest = { createdAt: new Date().toISOString(), sourceDirectory: path.resolve(source), ...(overrides ? { overrideDirectory: path.resolve(overrides), baselineHashes } : {}), purpose: "Exploratory decision analysis; not strength confirmation", hashes, diagnosticFile, diagnosticSha256: hash(instrumented) };
fs.writeFileSync(path.join(destination, "analysis-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ frozen: destination, files: Object.keys(hashes).length, diagnosticSha256: manifest.diagnosticSha256 }));
