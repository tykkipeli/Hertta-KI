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

## Wiederherstellung und unabhängiger CI-Lauf

Nach dem Verlust des Shellzugriffs am 29. Oktober 2026 wurden am 30. Oktober **378 vollständig abgeschlossene 200-ms-Partien** wiederhergestellt. Alle Quell-Snapshot-Hashes, Laufparameter, Sitzrotationen, Endstände und Checkpoint-Summen wurden geprüft; dieselben 29 Funktionstests bestanden auch in der wiederhergestellten Umgebung. Dort laufen dieselben vier Serien mit erhaltenen Lauf-IDs weiter. Nur die jeweils unterbrochene Partie wird wiederholt. Der KI-Quellstand bleibt unverändert. Der Wiederherstellungszeitpunkt und die Laufumgebung sind zusätzlich in den Rohdaten vermerkt.

Der separate Branch [`codex/hearts-strength-recovery-85331e2`](https://github.com/tykkipeli/Hertta-KI/tree/codex/hearts-strength-recovery-85331e2/docs/benchmarks/recovery-85331e2) enthält Quell-Snapshot, Controller, Checkpoints und Wiederherstellungsprotokoll. Ein zusätzlicher Hintergrundprozess sichert den Stand alle zehn Minuten mit normalen, nicht erzwungenen Git-Pushes und prüft den entfernten Commit anschließend erneut. Damit bleiben die gesicherten abgeschlossenen Partien auch bei einem weiteren Ausfall dieser Maschine erhalten. Die jüngsten noch nicht gesicherten Partien können dennoch verloren gehen.

Beim Veröffentlichen der Umgebung wurde außerdem der zuvor vorbereitete [GitHub-Actions-Lauf](https://github.com/tykkipeli/Hertta-KI/actions/runs/41074729210) gestartet. Diese unabhängige Bestätigung verwendet denselben eingefrorenen KI-Quellstand, aber eigene Seeds: `20270000 + worker * 1000003 + block * 65537`. Sie umfasst ebenfalls 640 Partien bei 200 ms und 320 bei 1.200 ms, aufgeteilt in 240 Viererblöcke mit höchstens vier gleichzeitigen Jobs. Referenz und Kandidat erhalten dieselben Budgets und mindestens 16 Stichproben. Vollständige Blöcke werden als Artefakte gespeichert; die abschließende Auswertung archiviert Rohdaten und Bericht zusätzlich auf `codex/hearts-strength-results-85331e2-ci-v1`.

Diese CI-Serie ersetzt die wiederhergestellte Serie nicht. Beide werden vollständig und getrennt ausgewertet, einschließlich negativer Ergebnisse; Budgets und abweichende Quellstände werden weiterhin nicht vermischt. Für das CI-Erfolgskriterium müssen die 95-%-Block-Bootstrapintervalle bei **beiden** Zeitbudgets vollständig über 25 % liegen. Ein gestarteter Job, ein erfolgreicher Funktionstest oder ein günstiger Zwischenstand erfüllt dieses Kriterium nicht.
