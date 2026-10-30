# Vorab festgelegter Test der Strategieüberarbeitung

Die Weitergabe-, Durchmarsch-, Rang-, Dame-Hinweis- und Spielendeüberarbeitung ist ein Kandidat ohne abgeschlossenen Stärkenachweis. Die 5-ms-Ergebnisse des früheren Standes gelten hierfür nicht. Die normalen vollständigen Benchmarkpartien werden mit unveränderter Ausführung der ursprünglichen KI gespielt, nicht mit dem beschleunigten Erkundungshelfer.

## Geplante Serien

| Budget je Entscheidung | Partien insgesamt | Aufteilung                    |
| ---------------------- | ----------------: | ----------------------------- |
| 200 ms                 |               640 | 4 Prozesse mit je 160 Partien |
| 1.200 ms               |               320 | 4 Prozesse mit je 80 Partien  |

Für alle Spieler gilt dieselbe Suchuntergrenze von 16 Stichproben, sofern eine Monte-Carlo-Suche nötig ist. Erzwungene Züge und bewiesene kleine Endspiele können früher enden. Pro Partie spielt genau ein Kandidat gegen drei unveränderte Kopien aus `test/fixtures/ai-v1.js`. Alle Spiele laufen bis zur 100-Punkte-Grenze; Gleichstände zählen anteilig.

Die vier Seeds sind `20261260`, `21261263`, `22261266`, `23261269`. Vier Sitzrotationen teilen jeweils dieselben Kartenfolgen. Private Zufallsströme bleiben pro Spieler getrennt. Die Serien erhalten einen eigenen vor der Datensammlung eingefrorenen Quell-Snapshot, dessen Hashes mit den Ergebnissen abgeglichen werden.

## Kriterium und Auswertung

Primäres Kriterium ist, dass das 95-%-Block-Bootstrapintervall des Kandidaten-Sieganteils in der vollständig abgeschlossenen 200-ms-Serie vollständig über 25 % liegt. Die vollständigen Viererblöcke werden gemeinsam resampelt. Die 1.200-ms-Serie wird separat ausgewertet; Zeitbudgets werden nicht gepoolt. Zwischenstände, einzelne Hände oder reine Strategietests gelten nicht als Nachweis. Ein negatives Ergebnis muss ebenso berichtet werden und bedeutet weitere Überarbeitung.

Die Zahl der Partien wurde vor Beginn dieser Bestätigung festgelegt. Der erste kurze Setupversuch mit Stand `9caa65f` und die noch nicht gestartete Warteschlange dieses Standes werden nicht mit der Bestätigung des abschließenden Kandidaten vermischt. Erkundungsdaten mit festen Stichproben, teils beschleunigter Referenz und früherer Dateinamenkollision gehören ebenfalls nicht in diese Auswertung.

## Laufbedingungen und Dauerhaftigkeit

Die Umgebung hat vier CPU-Kerne als Gesamtquote. Es laufen höchstens vier Bestätigungsworker gleichzeitig; sie starten nach dem Ende der bisherigen Benchmarkprozesse. Nach jeder vollständigen Partie wird ein atomarer Checkpoint gespeichert. Eine unterbrochene Partie wird beim Neustart wiederholt, abgeschlossene Partien werden fortgesetzt. Der eingefrorene Quellstand bleibt während einer Serie unverändert. Gemessene Entscheidungsdauern, Seeds, Quellcode-Hashes und sämtliche Einzelpartien bleiben erhalten.

Die Hintergrundprozesse laufen unabhängig vom startenden Chatbefehl. Eine Unterbrechung oder Löschung der Cloudumgebung kann sie dennoch stoppen. Die lokalen Arbeitsverzeichnisse, Statusdateien und Checkpoints liegen unter `artifacts/strategy-validation-<Quellcommit>/`; sie sind nicht Teil des Git-Repositories. Vollständige Ergebnisse werden nach Abschluss zusätzlich mit dem jeweiligen Quellstand dokumentiert.

Beispiel für die erste Teilserie:

```sh
node benchmark.js 160 --matches --ms 200 --samples 16 --seed 20261260
```

Die normale Benchmarkablage verwendet inzwischen eindeutige Lauf-IDs, damit Wiederholungen mit gleichen Parametern keine früheren Rohdaten überschreiben.
