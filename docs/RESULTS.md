# Vergleich mit der ursprünglichen KI

## Neue Weitergabe-Erweiterung aus der Spielanalyse

Eine Analyse von 480 vollständigen Partien hat eine übersehene Durchmarschmöglichkeit vor der Weitergabe aufgedeckt: Die KI berücksichtigt jetzt auch, ob erst die Abgabe dreier Verlustkarten eine stark kontrollierte Hand schafft. In einem getrennten gezielten Vergleich mit 40 neuen betroffenen Ausgangshänden und je 16 gepaarten verdeckten Verteilungen sinken die eigenen mittleren Rundenpunkte von 7,4922 auf 4,8859; die beobachtete Durchmarschquote steigt von 13,9063 % auf 54,2188 %. Alle vier privaten KIs erhalten jeweils 64 Stichproben. Der gepaarte Bootstrap über ganze Ausgangshände belegt einen positiven relativen Rundenwertunterschied.

Dies sind 1.280 ausgespielte **Runden in betroffenen Anfangspositionen**, keine allgemeinen Partien bis 100 Punkte und kein neuer Vergleich bei gleichem Zeitbudget. Ein zusätzlicher allgemeiner Sieganteilsgewinn der neuen Erweiterung ist noch nicht belegt. Eine ebenfalls geprüfte Änderung des Gegnermodells zeigte in 640 vollständigen Vergleichspartien keinen Vorteil und wurde nicht übernommen. [Methodik, Fälle, Rohdaten und Grenzen](analysis/2026-10-31/README.md).

## Bestätigter Ausgangsstand `85331e2`

Die bisherige Weitergabe-, Durchmarsch-, Dame-Hinweis- und Endspielüberarbeitung (**KI-Quellstand `85331e2`**, vor der neuen Weitergabe-Erweiterung) hat den vorab festgelegten 200-ms-Test bestanden. In **640 vollständigen Partien** gegen drei unveränderte ursprüngliche KIs beträgt ihr Sieganteil **38,52 %**; das 95-%-Block-Bootstrapintervall über **160 vollständige Viererblöcke** liegt bei **34,77–42,34 %**, vollständig über dem 25-%-Vergleichswert bei gleicher Spielstärke. Alle Spieler erhielten **200 ms je Entscheidung und mindestens 16 Stichproben**.

Die Serie enthält 6.640 gespielte Runden. Die mittlere gemessene Entscheidungsdauer einschließlich sofortiger Züge beträgt **165,99 ms** für den Kandidaten und **164,65 ms** für die Referenz. Quell-Snapshot, ursprüngliche Lauf-IDs, Seeds, vollständige Endstände und Summen wurden geprüft. Nach dem Umgebungsausfall wurden 378 abgeschlossene Partien fortgesetzt; der eingefrorene KI-Quellstand blieb erhalten. [Rohdaten, Quellmanifest und Auswertung](benchmarks/strategy-85331e2/README.md).

Eine **unabhängige Bestätigung mit 640 weiteren vollständigen Partien** und eigenen Karten-Seeds erreicht bei denselben 200 ms **36,56 % Sieganteil**, 95-%-Blockintervall **33,13–40,08 %**. Auch diese Serie überschreitet die vorab festgelegte 25-%-Untergrenze. Sie lief auf getrennten GitHub-Actions-Runnern mit genau denselben eingefrorenen KI- und Referenzquellen. Sämtliche 160 Viererblöcke, Quell- und Treiber-Hashes, Lauf-IDs, Seeds, Endstände und Metadaten wurden geprüft. [Rohdaten und reproduzierbare Auswertung](benchmarks/strategy-85331e2-ci/README.md).

Auch die **beiden vollständigen Serien bei 1.200 ms** belegen einen Vorteil: Die ursprüngliche Bestätigung erreicht **36,25 %** in 320 Partien (95-%-Intervall **31,09–41,56 %**), die unabhängige CI-Bestätigung **35,78 %** in weiteren 320 Partien (**31,56–40,00 %**). Beide Untergrenzen überschreiten 25 %. Alle vier Spieler erhalten wiederum dasselbe vorgegebene Budget und mindestens 16 Stichproben.

| Abgeschlossene Serie | Partien | Sieganteil | 95-%-Blockintervall |
| --- | ---: | ---: | --- |
| Ursprüngliche Bestätigung, 200 ms | 640 | 38,52 % | 34,77–42,34 % |
| Unabhängige CI-Bestätigung, 200 ms | 640 | 36,56 % | 33,13–40,08 % |
| Ursprüngliche Bestätigung, 1.200 ms | 320 | 36,25 % | 31,09–41,56 % |
| Unabhängige CI-Bestätigung, 1.200 ms | 320 | 35,78 % | 31,56–40,00 % |

Die ursprüngliche 1.200-ms-Serie umfasst 3.313 Runden, die unabhängige Serie 3.301 Runden. Die über alle Runden gewichteten mittleren Entscheidungsdauern einschließlich sofortiger Züge betragen **985,55 / 965,07 ms** für Kandidat / Referenz in der ursprünglichen Serie und **978,70 / 952,83 ms** in der CI-Serie. Gleiche vorgegebene Budgets bedeuten nicht identische tatsächlich verbrauchte Rechenzeit. Die [ursprünglichen Rohdaten](benchmarks/strategy-85331e2/README.md) und die [unabhängigen CI-Rohdaten](benchmarks/strategy-85331e2-ci/README.md) einschließlich Metadaten und Hashes sind vollständig erhalten; die Auswertungen wurden lokal erneut erzeugt und mit den abschließenden Berichten abgeglichen.

Die Serien werden getrennt ausgewertet und nicht gepoolt. Innerhalb einer Kampagne verwenden die beiden Budgets dieselben vorab gewählten Seed-Familien; sie sind deshalb keine unabhängigen Wiederholungen voneinander. Die CI-Kampagne verwendet eigene, von der ursprünglichen Bestätigung getrennte Seeds. Alle geplanten Partien wurden abgeschlossen; es wurde nicht nach einem günstigen Zwischenstand gestoppt. Das CI-Kriterium verlangt den Vorteil bei **beiden** Budgets und ist erfüllt. Damit ist ein Vorteil gegen drei ursprüngliche Kopien bei 200 und 1.200 ms belegt. Für 5 Sekunden oder andere Gegner liegt kein Nachweis vor. [Vorab festgelegtes Prüfprotokoll](VALIDATION.md).

## Längere Vergleiche des früheren Standes

Die historischen 5-ms-Ergebnisse betreffen **Commit `2d28e63`**. Sie reichen als allgemeiner Stärkenachweis nicht aus. Beim anschließenden **200-ms-Vergleich mit 320 vollständigen Partien** erzielte dieser frühere Stand nur **22,03 %** (95-%-Intervall: **18,28–25,78 %**). Ein Vorteil ist damit nicht belegt; auch eine sichere Unterlegenheit folgt aus diesem Intervall nicht. [Rohdaten und Auswertung](benchmarks/long-budget-v2/200ms-summary.json).

Auch die inzwischen abgeschlossene **1.200-ms-Serie mit 320 vollständigen Partien** dieses früheren Standes belegt keinen Vorteil: **24,38 % Sieganteil**, 95-%-Block-Bootstrapintervall **20,63–28,28 %**. Beide längeren Serien enthalten denselben früheren Quellstand und werden getrennt ausgewertet. [1.200-ms-Rohdaten und Auswertung](benchmarks/long-budget-v2/1200ms-summary.json).

Die früheren Ergebnisse werden getrennt von den neuen Bestätigungsserien aufbewahrt. Erkundungsläufe mit festen Stichproben oder beschleunigter, auf Verhaltensgleichheit geprüfter Referenzausführung werden ebenfalls nicht als Zeitbudgetnachweis ausgegeben.

## Historische Ergebnisse von Commit `2d28e63`

Bei gleichem **5-ms-Budget** erzielte die damalige KI **34,69 % Sieganteil in 480 vollständigen Spielen** gegen drei ursprüngliche Kopien; das 95-%-Intervall beträgt **30,73–38,65 %**. Damit ist im dokumentierten Kleinbudgetvergleich ein Vorteil belegt. Das ist **kein Nachweis einer Überlegenheit bei allen Bedenkzeiten**. Für diesen früheren Quellstand belegen die oben dokumentierten längeren Tests keinen Vorteil.

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
