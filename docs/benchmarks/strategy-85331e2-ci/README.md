# Unabhängige Bestätigung des KI-Quellstands 85331e2

Die abgeschlossene 200-ms-Serie umfasst **640 vollständige Partien in 160 Viererblöcken** gegen drei unveränderte ursprüngliche KIs. Der Kandidat erreicht **36,5625 % Sieganteil**, das 95-%-Block-Bootstrapintervall beträgt **33,125–40,078125 %**. Die vorab festgelegte Untergrenze von 25 % wird überschritten. Alle vier Spieler erhalten 200 ms je Entscheidung und mindestens 16 Stichproben; erzwungene Züge können früher enden.

Diese Serie verwendet eigene Karten-Seeds und getrennte GitHub-Actions-Runner. Sie wird nicht mit der [ursprünglichen Bestätigung](../strategy-85331e2/README.md) gepoolt. Beide prüfen denselben eingefrorenen KI-Quellstand. Ein Ergebnis für 1.200 ms oder 5 Sekunden folgt daraus nicht; die CI-Tests bei 1.200 ms laufen noch.

## Herkunft und Prüfung

- [GitHub-Actions-Lauf 41074729210](https://github.com/tykkipeli/Hertta-KI/actions/runs/41074729210), Kampagne `85331e2-ci-v1`.
- [Eingefrorener CI-Treiber](https://github.com/tykkipeli/Hertta-KI/blob/74702fceaba54591edb347dd6ae754afa3e83bea/scripts/hearts-strength-ci.cjs), Quellstand `74702fceaba54591edb347dd6ae754afa3e83bea` mit unveränderten KI-Dateien aus `85331e2`.
- [Auswahl und Quell-Hashes](selection-200ms.json): alle 160 Blöcke, zugehörige Artefaktnamen, ursprüngliche Lauf-IDs, Ausführungsversuche, Metadaten und SHA-256 der unveränderten Rohdateien.
- Jeder Block enthält vier vollständige Sitzrotationen. Sein Karten-Seed ist `20270000 + worker * 1000003 + block * 65537`, mit `worker = 0..3` und `block = 0..39`. Diese Seeds überschneiden sich nicht mit der ursprünglichen Bestätigungsserie.
- Bei wiederholten Ausführungen würde je Block der früheste vollständige Lauf gewählt, unabhängig von seinem Ergebnis. In dieser Serie gab es keine vollständigen Duplikate.

Alle Rohdateien wurden gegen die eingefrorenen Quellen und das Prüfprotokoll validiert: gleiche Budgets, vollständige Sitzrotationen, eindeutige Lauf-IDs und Seeds, legale Endstände mit korrekter Punktesumme, übereinstimmende Checkpoints und Artefaktmetadaten. Der ursprüngliche Gegner, sein Beobachtungsformat und seine Klonausführung bleiben unverändert. Keine tatsächlichen fremden Hände werden dem Kandidaten übergeben.

## Auswertung erneut erzeugen

[200ms-files.txt](200ms-files.txt) hält die ursprüngliche numerische Blockreihenfolge fest. Vom Repository-Hauptverzeichnis unter Bash:

```sh
mapfile -t proof_files < docs/benchmarks/strategy-85331e2-ci/200ms-files.txt
node scripts/summarize-benchmarks.js "${proof_files[@]}"
```

Die [gespeicherte Auswertung](200ms-summary.json) wurde aus genau diesen unveränderten Rohdaten neu erzeugt und mit der ursprünglichen Auswertung abgeglichen. Sieganteile, Budget, Rundenzahlen, Quellen und Bootstrapintervall stimmen überein. Der Bootstrap zieht 10.000 Stichproben vollständiger Viererblöcke. Die numerische Dateireihenfolge erhält die genaue Folge des deterministischen Bootstrapgenerators.

Die Rohdaten liegen pro Block unter `200ms/<Budget>-<Worker>-<Block>/result.json`, die ursprünglichen CI-Metadaten daneben als `meta.json`. Die [Ergebnisübersicht](../../RESULTS.md) und das [Prüfprotokoll](../../VALIDATION.md) erläutern Grenzen und die getrennte Bewertung der Budgets.
