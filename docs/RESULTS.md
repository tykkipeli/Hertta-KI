# Vergleich mit der ursprünglichen KI

## Aktueller Stand der Überarbeitung

Die aktuelle Weitergabe-, Durchmarsch-, Dame-Hinweis- und Endspielüberarbeitung (**KI-Quellstand `85331e2`**) hat den vorab festgelegten 200-ms-Test bestanden. In **640 vollständigen Partien** gegen drei unveränderte ursprüngliche KIs beträgt ihr Sieganteil **38,52 %**; das 95-%-Block-Bootstrapintervall über **160 vollständige Viererblöcke** liegt bei **34,77–42,34 %**, vollständig über dem 25-%-Vergleichswert bei gleicher Spielstärke. Alle Spieler erhielten **200 ms je Entscheidung und mindestens 16 Stichproben**.

Die Serie enthält 6.640 gespielte Runden. Die mittlere gemessene Entscheidungsdauer einschließlich sofortiger Züge beträgt **165,99 ms** für den Kandidaten und **164,65 ms** für die Referenz. Quell-Snapshot, ursprüngliche Lauf-IDs, Seeds, vollständige Endstände und Summen wurden geprüft. Nach dem Umgebungsausfall wurden 378 abgeschlossene Partien fortgesetzt; der eingefrorene KI-Quellstand blieb erhalten. [Rohdaten, Quellmanifest und Auswertung](benchmarks/strategy-85331e2/README.md).

Eine **unabhängige Bestätigung mit 640 weiteren vollständigen Partien** und eigenen Karten-Seeds erreicht bei denselben 200 ms **36,56 % Sieganteil**, 95-%-Blockintervall **33,13–40,08 %**. Auch diese Serie überschreitet die vorab festgelegte 25-%-Untergrenze. Sie lief auf getrennten GitHub-Actions-Runnern mit genau denselben eingefrorenen KI- und Referenzquellen. Sämtliche 160 Viererblöcke, Quell- und Treiber-Hashes, Lauf-IDs, Seeds, Endstände und Metadaten wurden geprüft. [Rohdaten und reproduzierbare Auswertung](benchmarks/strategy-85331e2-ci/README.md).

| Abgeschlossene 200-ms-Serie | Partien | Sieganteil | 95-%-Blockintervall |
| --- | ---: | ---: | --- |
| Ursprüngliche Bestätigung | 640 | 38,52 % | 34,77–42,34 % |
| Unabhängige CI-Bestätigung | 640 | 36,56 % | 33,13–40,08 % |

Die Serien werden getrennt ausgewertet und nicht gepoolt. Die **320-Partien-Serie bei 1.200 ms läuft noch**; auch die unabhängige CI-Serie prüft dieses Budget gesondert. Die beiden abgeschlossenen 200-ms-Serien belegen einen Vorteil in diesem Testaufbau; daraus folgt noch kein Ergebnis für 1.200 ms, 5 Sekunden oder andere Gegner. [Vorab festgelegtes Prüfprotokoll](VALIDATION.md).

## Längere Vergleiche des früheren Standes

Die historischen 5-ms-Ergebnisse betreffen **Commit `2d28e63`**. Sie reichen als allgemeiner Stärkenachweis nicht aus. Beim anschließenden **200-ms-Vergleich mit 320 vollständigen Partien** erzielte dieser frühere Stand nur **22,03 %** (95-%-Intervall: **18,28–25,78 %**). Ein Vorteil ist damit nicht belegt; auch eine sichere Unterlegenheit folgt aus diesem Intervall nicht. [Rohdaten und Auswertung](benchmarks/long-budget-v2/200ms-summary.json).

Auch die inzwischen abgeschlossene **1.200-ms-Serie mit 320 vollständigen Partien** dieses früheren Standes belegt keinen Vorteil: **24,38 % Sieganteil**, 95-%-Block-Bootstrapintervall **20,63–28,28 %**. Beide längeren Serien enthalten denselben früheren Quellstand und werden getrennt ausgewertet. [1.200-ms-Rohdaten und Auswertung](benchmarks/long-budget-v2/1200ms-summary.json).

Die früheren Ergebnisse werden getrennt von der neuen 200-ms-Bestätigung aufbewahrt. Erkundungsläufe mit festen Stichproben oder beschleunigter, auf Verhaltensgleichheit geprüfter Referenzausführung werden ebenfalls nicht als Zeitbudgetnachweis ausgegeben.

## Historische Ergebnisse von Commit `2d28e63`

Bei gleichem **5-ms-Budget** erzielte die damalige KI **34,69 % Sieganteil in 480 vollständigen Spielen** gegen drei ursprüngliche Kopien; das 95-%-Intervall beträgt **30,73–38,65 %**. Damit ist im dokumentierten Kleinbudgetvergleich ein Vorteil belegt. Das ist **kein Nachweis einer Überlegenheit bei allen Bedenkzeiten**. Insbesondere ist ein Vorteil bei den längeren GUI-Einstellungen noch nicht nachgewiesen.

## Bestätigung mit gleichem Zeitbudget

Alle vier Spieler erhielten dasselbe vorgegebene Budget von **5 ms je Entscheidung**, mit mindestens einer Stichprobe. Zwei vorab festgelegte Serien verwenden dieselbe eingefrorene endgültige KI. Erzwungene Züge können sofort enden; das Zeitmittel enthält auch diese Züge.

| Serie           | Vollständige Partien |     Neue KI | Alte Kopien links / gegenüber / rechts |
| --------------- | -------------------: | ----------: | -------------------------------------- |
| Seed `20261213` |                  160 |     29,69 % | 25,94 / 21,88 / 22,50 %                |
| Seed `20261215` |                  320 |     37,19 % | 20,78 / 19,06 / 22,97 %                |
| **Zusammen**    |              **480** | **34,69 %** | 22,50 / 20,00 / 22,81 %                |

Das 95-%-Bootstrapintervall über **120 vollständige Viererblöcke** der Sitzrotationen beträgt **30,73–38,65 %**. Es liegt vollständig über den erwarteten 25 % bei vier gleich starken Kopien. Die tatsächlich gemessene mittlere Dauer beträgt **3,99 ms** für die neue und **4,06 ms** für die alten KIs. Der Vorteil beruht in diesem Test nicht auf einem größeren vorgegebenen Zeitbudget.

Rohdaten: [160 Partien](benchmarks/equal-time-160.json), [320 Partien](benchmarks/equal-time-320.json), [gemeinsame Auswertung](benchmarks/equal-time-summary.json). Die beiden Serien umfassen zusammen 5.005 gespielte Runden. Sie werden nicht mit den Erkundungsläufen oder anderen Rechenbudgets vermischt.

```sh
node benchmark.js 160 --matches --ms 5 --samples 1 --seed 20261213
node benchmark.js 320 --matches --ms 5 --samples 1 --seed 20261215
node scripts/summarize-benchmarks.js docs/benchmarks/equal-time-160.json docs/benchmarks/equal-time-320.json
```

## Unabhängige Bestätigung mit festen Stichproben

Die Variante wurde vor diesem Lauf eingefroren. Die endgültig ausgelieferten KI-Dateien stimmen mit den gespeicherten Quellcode-Hashes überein.

| Messwert                                  |     Neue KI | Drei ursprüngliche Kopien, nach relativer Sitzposition |
| ----------------------------------------- | ----------: | ------------------------------------------------------ |
| Vollständige Partien                      |         160 | dieselben Partien                                      |
| Stichproben pro nicht erzwungenem Zug     |         128 | jeweils 16                                             |
| Sieganteil, Gleichstände anteilig         | **33,75 %** | 24,06 / 22,50 / 19,69 %                                |
| Mittlerer Gesamtpunktestand bei Spielende |   **65,11** | 76,56 / 78,53 / 77,99                                  |
| Mittlere Rechenzeit je Entscheidung       | **2,28 ms** | 3,03 ms im Mittel                                      |

Die neue KI gewinnt damit häufiger als jede der drei Kopien in diesem Lauf und verwendet trotz achtfacher Stichprobenzahl weniger mittlere Rechenzeit. Das Zeitmittel enthält auch erzwungene Züge. Dies ist ein **Vergleich fester Stichprobenzahlen**, kein identisches vorgegebenes Zeitlimit.

Das über vollständige Viererblöcke der Sitzrotationen berechnete 95-%-Bootstrapintervall für ihren Sieganteil beträgt **26,875–40,9375 %**. Vier gleich starke Kopien hätten im symmetrischen Vergleich einen erwarteten Anteil von 25 %. Das Intervall ist eine empirische Unsicherheitsangabe für diesen Testaufbau, keine Garantie für andere Gegner oder Einstellungen.

Rohdaten: [Bestätigung](benchmarks/fixed-samples-confirmation.json), [Auswertung](benchmarks/fixed-samples-summary.json). Seed: `20261214`.

```sh
node benchmark.js 160 --matches --samples 16 --new-samples 128 --seed 20261214
node scripts/summarize-benchmarks.js docs/benchmarks/fixed-samples-confirmation.json
```

## Protokoll und Grenzen

Die Referenz ist `test/fixtures/ai-v1.js`, unverändert aus Commit `fa856d4` bis auf den Importpfad. Pro Partie spielt eine neue KI gegen drei Referenzkopien bis mindestens 100 Gesamtpunkte. Vier Sitzrotationen teilen dieselbe Kartenfolge; Zufallsströme bleiben pro Spieler getrennt. Jede Version erhält ihr eigenes ursprüngliches Beobachtungsformat. Tatsächliche gegnerische Hände werden der KI nicht übergeben.

Die drei alten Gegner verwenden denselben Algorithmus. Ihre Spalten bezeichnen die Plätze links, gegenüber und rechts relativ zur neuen KI. Sie sind keine verschiedenen trainierten Gegner. Der neue Algorithmus wurde anhand von Erkundungsläufen ausgewählt; diese werden nicht mit den abschließenden Bestätigungsserien zusammengefasst. Zeitbasierte Ergebnisse variieren mit Rechner und Last. Feste Stichproben sind leichter reproduzierbar.

Ein früherer Stand der gekoppelten Suche erreichte bei 25 ms in 40 Partien nur **23,75 %**. [Rohdaten](benchmarks/earlier-paired-25ms.json), [damaliger KI-Quellstand](benchmarks/earlier-paired-agent.js.txt). Dieser Stand verwendete noch dieselbe Generatorfamilie für Karten-Sampling und Ausspielsimulation. Die fertige Variante trennt diese Generatoren; der ältere Lauf bleibt als Hinweis erhalten, dass der Vorteil nicht pauschal auf größere Budgets übertragen werden darf.

Das zuvor erprobte empirische Match-Modell brachte ebenfalls keinen Vorteil: **22,5 %** in 80 Partien bei 25 ms und **27,5 %** in 20 Partien bei 200 ms. Es wurde entfernt. [25-ms-Daten](benchmarks/retired-match-model-25ms.json), [200-ms-Daten](benchmarks/retired-match-model-200ms.json).

Noch frühere explorative Zeitvergleiche sind ausgeschlossen: Die Referenz erhielt zusätzliche ungenutzte Metadaten, deren Kopieraufwand sie benachteiligte. Alle hier verlinkten Vergleiche verwenden ihr korrektes ursprüngliches Eingabeformat.
