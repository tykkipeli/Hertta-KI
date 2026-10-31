# Unabhängige Bestätigung des KI-Quellstands 85331e2

Beide vorab festgelegten Serien gegen drei unveränderte ursprüngliche KIs sind vollständig abgeschlossen. Alle vier Spieler erhalten dasselbe genannte Zeitbudget je Entscheidung und mindestens 16 Stichproben; erzwungene Züge können früher enden. Das vorab festgelegte CI-Kriterium verlangt, dass die 95-%-Untergrenze bei **beiden** Budgets über 25 % liegt; es ist erfüllt.

| Budget je Entscheidung | Vollständige Partien | Viererblöcke | Sieganteil | 95-%-Block-Bootstrapintervall |
| --- | ---: | ---: | ---: | --- |
| 200 ms | 640 | 160 | 36,5625 % | 33,125–40,078125 % |
| 1.200 ms | 320 | 80 | 35,78125 % | 31,5625–40 % |

Diese Kampagne verwendet eigene Karten-Seeds und getrennte GitHub-Actions-Runner. Sie wird nicht mit der [ursprünglichen Bestätigung](../strategy-85331e2/README.md) gepoolt. Beide prüfen denselben eingefrorenen KI-Quellstand. Innerhalb jeder Kampagne verwenden die beiden Budgets dieselben Seed-Familien und sind deshalb keine unabhängigen Wiederholungen voneinander. Für 5 Sekunden oder andere Gegner liegt kein Nachweis vor.

## Herkunft und Prüfung

- [GitHub-Actions-Lauf 41074729210](https://github.com/tykkipeli/Hertta-KI/actions/runs/41074729210), Kampagne `85331e2-ci-v1`.
- Unveränderte abschließende CI-Metadaten: [Bewertung beider Budgets](ci-assessment.json), [vollständige Kampagne mit 240 von 240 Blöcken](ci-campaign.json).
- [Eingefrorener CI-Treiber](https://github.com/tykkipeli/Hertta-KI/blob/74702fceaba54591edb347dd6ae754afa3e83bea/scripts/hearts-strength-ci.cjs), Quellstand `74702fceaba54591edb347dd6ae754afa3e83bea` mit unveränderten KI-Dateien aus `85331e2`.
- Auswahl und Quell-Hashes bei [200 ms](selection-200ms.json) und [1.200 ms](selection-1200ms.json): alle 240 Blöcke, zugehörige Artefaktnamen, ursprüngliche Lauf-IDs, Ausführungsversuche, Metadaten und SHA-256 der unveränderten Rohdateien.
- Jeder Block enthält vier vollständige Sitzrotationen. Sein Karten-Seed ist `20270000 + worker * 1000003 + block * 65537`, mit `worker = 0..3` und `block = 0..39` bei 200 ms beziehungsweise `block = 0..19` bei 1.200 ms. Diese Seeds überschneiden sich nicht mit der ursprünglichen Bestätigungsserie.
- Bei wiederholten Ausführungen würde je Block der früheste vollständige Lauf gewählt, unabhängig von seinem Ergebnis. In dieser Serie gab es keine vollständigen Duplikate.

Alle Rohdateien wurden gegen die eingefrorenen Quellen und das Prüfprotokoll validiert: gleiche Budgets, vollständige Sitzrotationen, eindeutige Lauf-IDs und Seeds, legale Endstände mit korrekter Punktesumme, übereinstimmende Checkpoints und Artefaktmetadaten. Der ursprüngliche Gegner, sein Beobachtungsformat und seine Klonausführung bleiben unverändert. Keine tatsächlichen fremden Hände werden dem Kandidaten übergeben.

## Auswertung erneut erzeugen

[200ms-files.txt](200ms-files.txt) und [1200ms-files.txt](1200ms-files.txt) halten die ursprüngliche numerische Blockreihenfolge fest. Vom Repository-Hauptverzeichnis unter Bash:

```sh
mapfile -t proof_files < docs/benchmarks/strategy-85331e2-ci/200ms-files.txt
node scripts/summarize-benchmarks.js "${proof_files[@]}"
mapfile -t proof_files < docs/benchmarks/strategy-85331e2-ci/1200ms-files.txt
node scripts/summarize-benchmarks.js "${proof_files[@]}"
```

Die gespeicherten Auswertungen bei [200 ms](200ms-summary.json) und [1.200 ms](1200ms-summary.json) wurden aus genau diesen unveränderten Rohdaten neu erzeugt und mit den abschließenden CI-Auswertungen abgeglichen. Sieganteile, Budgets, Rundenzahlen, Quellen und Bootstrapintervalle stimmen überein. Auch die im CI-Bericht enthaltenen Quellen und der instrumentierte Treiber stimmen mit den vorab festgelegten Hashes überein. Der Bootstrap zieht 10.000 Stichproben vollständiger Viererblöcke. Die numerische Dateireihenfolge erhält die genaue Folge des deterministischen Bootstrapgenerators.

Die 1.200-ms-Serie umfasst 3.301 Runden. Ihre über alle Runden gewichteten mittleren Entscheidungsdauern einschließlich sofortiger Züge betragen 978,6996236285503 ms für den Kandidaten und 952,8258091411614 ms für die Referenz. Gleiche vorgegebene Budgets bedeuten nicht identische verbrauchte Rechenzeit.

Die Rohdaten liegen pro Block unter `<Budget>ms/<Budget>-<Worker>-<Block>/result.json`, die ursprünglichen CI-Metadaten daneben als `meta.json`. Das vollständige CI-Archiv liegt zusätzlich auf [`codex/hearts-strength-results-85331e2-ci-v1`](https://github.com/tykkipeli/Hertta-KI/tree/codex/hearts-strength-results-85331e2-ci-v1). Der eingefrorene CI-Bericht enthält noch einen historischen Hinweis auf die damals unerreichbare Cloud-Serie; diese wurde inzwischen vollständig wiederhergestellt und ist gesondert dokumentiert. Die [Ergebnisübersicht](../../RESULTS.md) und das [Prüfprotokoll](../../VALIDATION.md) erläutern Grenzen und die getrennte Bewertung der Budgets.
