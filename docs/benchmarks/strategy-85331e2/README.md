# Bestätigung des KI-Quellstands 85331e2

Die abgeschlossene Serie umfasst 640 vollständige Partien bei 200 ms je Entscheidung, mindestens 16 Stichproben für alle Spieler, vier Sitzrotationen und unveränderte Ausführung der ursprünglichen Referenz. Ergebnis: **38,515625 % Sieganteil**, 95-%-Block-Bootstrapintervall **34,765625–42,34375 %** über 160 Viererblöcke. Die vorab festgelegte 25-%-Untergrenze wird überschritten.

Die vier Rohdateien enthalten jeweils 160 Partien und behalten die ursprünglichen Lauf-IDs:

- [200ms-0.json](200ms-0.json), Seed 20261260
- [200ms-1.json](200ms-1.json), Seed 21261263
- [200ms-2.json](200ms-2.json), Seed 22261266
- [200ms-3.json](200ms-3.json), Seed 23261269

[Gemeinsame Auswertung](200ms-summary.json), [Quellmanifest](source-manifest.json), [Prüfprotokoll](../../VALIDATION.md).

Nach dem Umgebungsausfall wurden 378 abgeschlossene Partien aus Checkpoints wiederhergestellt. Ihre Endstände, Summen, Parameter und Quellcode-Hashes wurden geprüft. Nur die jeweils unterbrochene Partie wurde wiederholt. Der Kandidat und die Referenz blieben während der gesamten Serie unverändert. Beide Ausführungszeiträume verwendeten Node 24.19.0 und vier Bestätigungsworker innerhalb einer Vierkernquote. Seeds, vollständige Partien und gemessene Entscheidungszeiten bleiben in den Rohdaten erhalten.

Das Manifest beschreibt den eingefrorenen Quell-Snapshot: `benchmark.js` bezeichnet dort den Checkpoint-Treiber, `benchmark-original.js` den normalen ursprünglichen Benchmark. Beide Dateien und die KI-Quellen sind im [Sicherungsbranch](https://github.com/tykkipeli/Hertta-KI/tree/codex/hearts-strength-recovery-85331e2/docs/benchmarks/recovery-85331e2/snapshot) erhalten. Die normalen Referenzfunktionen, ihr Beobachtungsformat und ihre Klonausführung wurden nicht beschleunigt.

Auswertung erneut erzeugen, vom Repository-Hauptverzeichnis:

```sh
node scripts/summarize-benchmarks.js docs/benchmarks/strategy-85331e2/200ms-0.json docs/benchmarks/strategy-85331e2/200ms-1.json docs/benchmarks/strategy-85331e2/200ms-2.json docs/benchmarks/strategy-85331e2/200ms-3.json
```

Die Serie bei 1.200 ms und die unabhängige CI-Serie sind gesonderte Vergleiche. Sie werden nicht mit diesen Daten gepoolt. Die zusätzlichen Forschungsprototypen waren an dieser Bestätigung nicht beteiligt.
