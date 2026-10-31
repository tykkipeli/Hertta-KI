# Abgeschlossener Vergleich des KI-Quellstands 85331e2

Eine eingefrorene neue KI gegen drei unveränderte ursprüngliche Kopien aus fa856d4. Alle Spieler erhalten dasselbe genannte Zeitbudget und mindestens 16 Stichproben. Vollständige Partien bis 100 Punkte; geteilte Siege werden anteilig gezählt.

| Budget | Vollständige Partien | Sieganteil | 95-%-Blockintervall | Untergrenze > 25 % |
| --- | ---: | ---: | --- | --- |
| 200 ms | 640 | 38,52 % | 34,77 %–42,34 % | erfüllt |
| 1200 ms | 320 | 36,25 % | 31,09 %–41,56 % | erfüllt |

Die Budgets werden getrennt ausgewertet und nicht gepoolt. Vier Sitzrotationen teilen eine Kartenfolge; der Bootstrap zieht ganze Viererblöcke. Die beiden Budgets verwenden dieselben vorab gewählten Seed-Familien und sind keine unabhängigen Wiederholungen. Eine separate GitHub-Actions-Kampagne mit eigenen Seeds ist unter https://github.com/tykkipeli/Hertta-KI/actions/runs/41074729210 zu prüfen; deren Ergebnisse werden hier nicht hinzugerechnet. Ein Ergebnis für 5 Sekunden oder andere Gegner folgt daraus nicht.

Die JSON-Rohdateien sind unveränderte Kopien der acht ursprünglichen Ergebnisdateien. manifest.json hält ihre SHA-256-Werte, Lauf-IDs und Seeds sowie das eingefrorene Quellmanifest fest. Die Summary-Dateien haben ausschließlich relative Dateiverweise erhalten; die statistischen Werte bleiben unverändert. Mit dem eingefrorenen scripts/summarize-benchmarks.js aus dem Snapshot lässt sich jedes Budget aus seinen vier Rohdateien separat erneut auswerten.

Dieses Paket wurde lokal automatisch nach vollständiger Quellen-, Protokoll- und Ergebnisprüfung erstellt. Es veröffentlicht weder eine neue GitHub-Aktion noch einen neuen Quellbranch. Es ist für die abschließende Dokumentation und PR-Prüfung vorbereitet.
