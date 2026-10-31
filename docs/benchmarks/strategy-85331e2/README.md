# Bestätigung des KI-Quellstands 85331e2

Beide vorab festgelegten Serien sind abgeschlossen: mindestens 16 Stichproben für alle Spieler, vier Sitzrotationen und unveränderte Ausführung der ursprünglichen Referenz. Bei beiden Budgets liegt die 95-%-Untergrenze über dem Vergleichswert von 25 %.

| Budget je Entscheidung | Vollständige Partien | Viererblöcke | Sieganteil | 95-%-Block-Bootstrapintervall |
| --- | ---: | ---: | ---: | --- |
| 200 ms | 640 | 160 | 38,515625 % | 34,765625–42,34375 % |
| 1.200 ms | 320 | 80 | 36,25 % | 31,09375–41,5625 % |

Die vier Rohdateien enthalten jeweils 160 Partien und behalten die ursprünglichen Lauf-IDs:

- [200ms-0.json](200ms-0.json), Seed 20261260
- [200ms-1.json](200ms-1.json), Seed 21261263
- [200ms-2.json](200ms-2.json), Seed 22261266
- [200ms-3.json](200ms-3.json), Seed 23261269

[Gemeinsame Auswertung](200ms-summary.json), [Quellmanifest](source-manifest.json), [Prüfprotokoll](../../VALIDATION.md).

Die vier Rohdateien bei 1.200 ms enthalten jeweils 80 vollständige Partien:

- [1200ms-0.json](1200ms-0.json), Seed 20261260
- [1200ms-1.json](1200ms-1.json), Seed 21261263
- [1200ms-2.json](1200ms-2.json), Seed 22261266
- [1200ms-3.json](1200ms-3.json), Seed 23261269

[1.200-ms-Auswertung](1200ms-summary.json). Die 320 Partien umfassen 3.313 Runden. Die über alle Runden gewichteten mittleren Entscheidungszeiten einschließlich sofortiger Züge betragen 985,5469507951377 ms für den Kandidaten und 965,0720968227446 ms für die ursprünglichen Gegner. Gleiche vorgegebene Budgets bedeuten nicht identische verbrauchte Rechenzeit.

Nach dem Umgebungsausfall wurden 378 abgeschlossene Partien aus Checkpoints wiederhergestellt. Ihre Endstände, Summen, Parameter und Quellcode-Hashes wurden geprüft. Nur die jeweils unterbrochene Partie wurde wiederholt. Der Kandidat und die Referenz blieben während der gesamten Serie unverändert. Beide Ausführungszeiträume verwendeten Node 24.19.0 und vier Bestätigungsworker innerhalb einer Vierkernquote. Seeds, vollständige Partien und gemessene Entscheidungszeiten bleiben in den Rohdaten erhalten.

Das Manifest beschreibt den eingefrorenen Quell-Snapshot: `benchmark.js` bezeichnet dort den Checkpoint-Treiber, `benchmark-original.js` den normalen ursprünglichen Benchmark. Beide Dateien und die KI-Quellen sind im [Sicherungsbranch](https://github.com/tykkipeli/Hertta-KI/tree/codex/hearts-strength-recovery-85331e2/docs/benchmarks/recovery-85331e2/snapshot) erhalten. Die normalen Referenzfunktionen, ihr Beobachtungsformat und ihre Klonausführung wurden nicht beschleunigt.

Auswertung erneut erzeugen, vom Repository-Hauptverzeichnis:

```sh
node scripts/summarize-benchmarks.js docs/benchmarks/strategy-85331e2/200ms-0.json docs/benchmarks/strategy-85331e2/200ms-1.json docs/benchmarks/strategy-85331e2/200ms-2.json docs/benchmarks/strategy-85331e2/200ms-3.json
node scripts/summarize-benchmarks.js docs/benchmarks/strategy-85331e2/1200ms-0.json docs/benchmarks/strategy-85331e2/1200ms-1.json docs/benchmarks/strategy-85331e2/1200ms-2.json docs/benchmarks/strategy-85331e2/1200ms-3.json
```

Die beiden Budgets werden gesondert ausgewertet und verwenden dieselben Seed-Familien; sie sind keine unabhängigen Wiederholungen voneinander. Die [unabhängige CI-Bestätigung](../strategy-85331e2-ci/README.md) verwendet eigene Seeds und bestätigt den Vorteil ebenfalls bei beiden Budgets. Die vier Ergebnisse werden nicht gepoolt. Alle geplanten Partien wurden abgeschlossen, ohne vorzeitigen Abbruch anhand eines Zwischenstands. Die zusätzlichen Forschungsprototypen waren an dieser Bestätigung nicht beteiligt.
