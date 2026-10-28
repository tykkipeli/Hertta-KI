import { readFile, writeFile } from "node:fs/promises";
const { metadata, rows } = JSON.parse(
  await readFile("artifacts/round-outcomes.json", "utf8"),
);
const phases = Array.from({ length: 4 }, () => []);
for (const { phase, scores } of rows) {
  if (
    scores.length !== 4 ||
    ![26, 78].includes(scores.reduce((a, b) => a + b, 0))
  )
    throw Error("Invalid round outcome");
  phases[phase].push(scores);
}
if (phases.some((p) => !p.length))
  throw Error("Every passing phase requires outcomes");
await writeFile(
  "src/future-model.js",
  "// Empirical round outcomes from isolated reference-AI self-play.\nexport const futureModel=" +
    JSON.stringify({ metadata, phases }) +
    ";\n",
);
console.log(metadata);
