# Vergleich mit der eingefrorenen Ausgangs-KI

Eine deutlich höhere Spielstärke ist bisher **nicht nachgewiesen**. Diese Änderung verbessert Oberfläche, Nachvollziehbarkeit und die Trennung privaten Wissens; die neue KI bleibt experimentell.

Die Referenz ist `test/fixtures/ai-v1.js`, unverändert aus Commit `fa856d4` bis auf den Importpfad. Pro Partie spielt eine neue KI gegen drei Referenzkopien. Partien enden bei mindestens 100 Punkten; vier Sitzrotationen teilen dieselbe Kartenfolge. Geteilte Siege werden anteilig gezählt. Beide Versionen erhalten ihr jeweiliges ursprüngliches Beobachtungsformat und dasselbe Zeitbudget.

| Budget je Entscheidung | Partien | Neue KI | Alte KI rechts/gegenüber/links |
| --- | ---: | ---: | --- |
| 25 ms | 80 | 22,5 % | 23,75 / 28,75 / 25,0 % |
| 200 ms | 20 | 27,5 % | 17,5 / 22,5 / 32,5 % |

Die drei alten Gegner verwenden denselben Algorithmus; die Spalten bezeichnen relative Sitzpositionen. Insbesondere 20 Partien erlauben keine belastbare Aussage über kleine Unterschiede. Das höhere Budget aktiviert die auf dem Kartentausch beruhende Hypothesenbildung. Auch dort ist keine Überlegenheit belegt.

Rohdaten mit Seeds, Budgets, Quellcode-Hashes und Einzelpartien: [25 ms](benchmarks/25ms.json), [200 ms](benchmarks/200ms.json).

Reproduktion:

```sh
node benchmark.js 80 --matches --ms 25 --samples 1 --seed 20261127
node benchmark.js 20 --matches --ms 200 --samples 1 --seed 20261128
```

Zeitbasierte Ergebnisse variieren mit Rechner und Last. Frühere explorative Vergleiche sind hier ausgeschlossen: Die Referenz erhielt zusätzliche ungenutzte Metadaten, deren Kopieraufwand sie benachteiligte. Die obigen Kontrollläufe korrigieren das Eingabeformat. Auch gleiche feste Stichprobenzahlen sind kein Nachweis gleicher Rechenzeit.
