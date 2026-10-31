# Spielanalyse und bessere Durchmarsch-Weitergabe

Untersucht wurden **480 vollständige Partien, 5.081 Runden und 66.053 Entscheidungen** der jeweils beobachteten KI: 320 Partien gegen drei ursprüngliche Gegner und 160 gegen Kopien der bisherigen starken KI. Alle 264.212 ausgespielten Karten wurden zur Verhaltensauswertung legal rekonstruiert. 29 ausgewählte auffällige Entscheidungen wurden bei 1.200 ms sowie mit jeweils 2.048 neuen hypothetischen Verteilungen unter fünf Ausspielmodellen nachgerechnet.

Die Analysepartien verwenden feste Stichprobenzahlen: Kandidat 64 / ursprüngliche Gegner 16, im Selbstspiel alle 64. Sie sind **kein neuer Zeitbudget-Stärkenachweis**. Die bisherigen Vergleiche bei 200 und 1.200 ms betreffen den eingefrorenen Stand `85331e2`. Die neue Weitergabe-Erweiterung erhält einen eigenen gezielten Vergleich.

## Erkennt die KI einen möglichen Durchmarsch?

Ja. `moonPotential` bewertet hohe Herzfolgen, Kontrollkarten und mögliche Verluststiche. Dieser Wert ist eine Heuristik, keine kalibrierte Erfolgswahrscheinlichkeit. Die Suche bewertet auch die tatsächliche 26-Punkte-Abrechnung. Ein anfänglicher Plan wird aus der eigenen ursprünglichen Nach-Tausch-Hand rekonstruiert und bleibt über neu gestartete Worker hinweg erhalten. Sobald ein anderer Spieler Punkte nimmt, endet der eigene Durchmarschplan.

In den protokollierten Runden vollendet die beobachtete KI **98 Durchmärsche**. Nur fünf Runden beginnen mit einem ausdrücklich gesetzten Anfangsplan, davon gelingen drei. **95 Durchmärsche entstehen ohne solchen Anfangsplan**; die Simulation kann günstige Verläufe und verbleibende Kontrollkarten später berücksichtigen. Die kleinen Anfangsplan-Zahlen erlauben keine verlässliche Erfolgsquotenschätzung.

Ein konkreter Fehler lag vor dem Weitergeben: Die KI prüfte nur, ob die ursprünglichen 13 Karten bereits einen starken Plan ergeben. Sie prüfte nicht, ob erst das Entfernen dreier Verlustkarten eine solche Hand schafft.

## Konkrete verbesserte Weitergabe

Die protokollierte Ausgangshand enthält:

- Kreuz: **2, Ass**
- Pik: **4, Bube, König**
- Herz: **2, 4, 5, 9, Bube, Dame, König, Ass**

Die bisherige Auswahl lautet **Kreuz 2, Kreuz Ass, Herz Ass**. Die neue Auswahl gibt **Pik 4, Pik Bube, Pik König** ab und erhält die acht Herzen samt hoher Folge und das Kreuz-Ass als Einstieg. Die anfängliche Durchmarschheuristik allein unterschätzt diese Möglichkeit.

Bei mindestens sechs Herzen einschließlich Ass prüft die Erweiterung auch alle verbleibenden Zehnkartenhände. Nur wenn mindestens sechs Herzen erhalten bleiben und eine Resthand einen Heuristikwert von mindestens 0,9 erreicht, berücksichtigt sie einen neu geschaffenen Durchmarschplan. Bei gleicher Kontrolle entscheidet das defensive Risiko. **0,9 bedeutet nicht 90 % Erfolgschance.** Bereits erkannte Anfangspläne und gewöhnliche defensive Weitergaben behalten ihr Verfahren. Der Tipp erläutert den möglichen Durchmarsch; neu empfangene Karten können den Plan wieder verschlechtern.

### Getrennte Prüfung an neuen Händen

Nach Festlegung der Änderung wurden **40 weitere betroffene Hände** durch gleichverteilte zufällige Austeilungen erzeugt. Die motivierende Hand ist ausgeschlossen. Es waren 175.499 Austeilungen nötig; die Änderung betrifft seltene Konstellationen. Für jede Hand werden 16 neue verdeckte Verteilungen der unbekannten 39 Karten erzeugt. Beide Weitergaben werden in denselben Verteilungen ausgespielt, mit vier getrennten privaten KIs des bisherigen starken Standes und jeweils 64 Stichproben je Entscheidung. Die anderen Spieler wählen ihre Weitergaben unabhängig aus ihren eigenen Händen. Keine KI erhält tatsächliche gegnerische Karten.

Das ergibt **640 gepaarte Verteilungen und 1.280 vollständig ausgespielte Runden**, jeweils mit Anfangsstand null. Es handelt sich um Runden, nicht um vollständige Partien bis 100 Punkte.

| Messwert in den betroffenen Startpositionen | Bisherige Weitergabe | Neue Weitergabe |
| --- | ---: | ---: |
| Mittlere eigene Rundenpunkte | 7,4922 | **4,8859** |
| Beobachtete eigene Durchmarschquote | 13,9063 % | **54,2188 %** |
| Mittlerer relativer Rundenwert | 1,6021 | **11,7396** |

Der relative Rundenwert ist `Mittelwert(gegnerische Rundenpunkte) − eigene Rundenpunkte`. Das vorab festgelegte Kriterium verlangt einen positiven Unterschied im gepaarten Bootstrap über **ganze Ausgangshände**, jeweils mit allen 16 Verteilungen. Die Verbesserung beträgt **10,1375**, das 95-%-Intervall **7,7229–12,5042**. Auch die eingesparten eigenen Punkte sind positiv: **2,6063**, Intervall **1,5281–3,6938**. Die Durchmarschquote steigt um **40,3125 Prozentpunkte**, Intervall **33,125–47,5**.

[Plan](passing-validation/plan.json), [Ausgangshände](passing-validation/cases.json), [Auswertung](passing-validation/summary.json) und sämtliche gepaarten Rundenergebnisse in `passing-validation/worker-0..3.jsonl` bleiben erhalten. Diese Daten belegen die gezielte Verbesserung in den untersuchten betroffenen Anfangspositionen. **Ein zusätzlicher allgemeiner Sieganteilsgewinn bei zufälligen Partien oder den GUI-Zeitbudgets ist für die neue Erweiterung noch nicht nachgewiesen.**

## Auffällig bedeutet nicht automatisch schlecht

- **Pik-Dame absichtlich nehmen:** In `worker-0/7/0/31` nimmt die KI einen Stich mit der Dame, obwohl sie verlieren könnte. Anschließend gewinnt sie alle 26 Punkte. Die Nachrechnung unterstützt die Durchmarschentscheidung.
- **Anfangsplan aufgeben:** In `worker-0/53/9/27` bleiben nur Herzen, während Karo bedient werden müsste. Jede legale Karte gibt einen Herzpunkt an einen Gegner. Das Aufgeben des Durchmarschs ist hier erzwungen.
- **Dame beim sicheren Abwurf behalten:** Einige Varianten sind in den untersuchten Simulationen gleich gut. Das Zurückhalten allein belegt keinen Fehler; ein pauschaler Abwurfzwang wäre nicht gerechtfertigt.
- **Durchmarsch nicht sofort stoppen:** In `worker-0/11/3/39` könnten Bube oder König bereits vier Punkte nehmen. Die KI wartet und stoppt den Gegner in der protokollierten Runde später mit drei eigenen Punkten. Das erklärt den Zug; ein einzelner günstiger tatsächlicher Verlauf beweist noch keine optimale Entscheidung unter Unsicherheit.

Die [ausgewählten Fälle](selected-cases.json) enthalten die damals verfügbare eigene und öffentliche Beobachtung. Spätere Ergebnisse sind als nachträgliche Information getrennt. Die [Nachrechnungen](decision-reviews/0.jsonl) und die drei weiteren Dateien dieses Verzeichnisses bewahren alle 29 Ergebnisse. Fünf Züge ändern sich mit größerem Rechenbudget. Die gezielte Auswahl erlaubt keine zufällige Fehlerquotenschätzung.

## Nachgewiesene Schwäche des Ausspielmodells

In `worker-1/9/9/32` hält die KI **Herz 7, 8, 10, Bube, Dame**, hat bereits 15 Punkte und ist am Ausspiel. Herz-Ass und Herz-König wurden öffentlich gespielt. Ihre Simulation erwartet nach Herz 10 ausschließlich erfolgreiche Durchmärsche, auch nach 7.702 Verteilungen bei 1.200 ms. Das vereinfachte Gegnermodell wirft zu häufig die höchste noch verlierende Herzkarte ab.

Tatsächliche Gegner behalten solche Stopper oft. Bei 15–17 Punkten eines einzigen Gegners behalten die ursprünglichen KIs in **81 von 142 passenden Situationen** ihre höchste Herzkarte, bei 18–21 Punkten in **98 von 122**. Sie nehmen aber auch nicht jeden möglichen Stopper sofort: Bei 15–17 Punkten gewinnen sie nur **16 von 76** Stichen, in denen sie sowohl gewinnen als auch verlieren könnten. [Vollständige Kalibrierung](moon-defense-calibration.json).

Ein [Gegenbeispiel](moon-counterexample.json) verwendet ausschließlich eine aus der damaligen Beobachtung zulässige **hypothetische** Verteilung. Die vollständige öffentliche Vorgeschichte und alle 20 folgenden Züge wurden mit der Regelengine legal nachgespielt. Die alte Simulation erhält `[26, 0, 26, 26]`; eine legale verteidigende Fortsetzung ergibt `[0, 22, 0, 4]`. Damit ist die angenommene Sicherheit widerlegt. Daraus folgt noch nicht, dass Herz 10 falsch ist: Die untersuchte neue Modellvariante wählt dieselbe Karte mit vorsichtigerer Einschätzung.

Eine stochastische Verteidigungsvariante wurde vollständig gegen die bisherige starke KI geprüft:

| Explorative Vergleichsserie | Vollständige Partien | Sieganteil |
| --- | ---: | ---: |
| Unveränderte Kontrollversion gegen drei gleiche Kopien | 320 | 25,9375 % |
| Modellvariante gegen drei unveränderte starke Kopien | 320 | 24,8438 % |

Alle Spieler erhalten 64 Stichproben; die Serien verwenden neue gemeinsame Kartenseeds. Die gepaarte Differenz beträgt **−1,0938 Prozentpunkte**, 95-%-Intervall **−6,4063 bis +4,2188**. Weder eine Verbesserung noch eine sichere Verschlechterung ist belegt. **Diese Modellvariante wird nicht übernommen.** Quellen und Ergebnisse bleiben unter [experiments/moon-defense](experiments/moon-defense/src/rollout.js) und [model-comparison](model-comparison/comparison.json) erhalten. Die produktive Änderung betrifft ausschließlich die Weitergabe und deren Erklärung.

## Daten und Reproduktion

Vollständige lokale Zugprotokolle liegen unter `artifacts/decision-audit-20261031/worker-*` und `artifacts/decision-self-audit-20261031/worker-*`; [trace-manifest.json](trace-manifest.json) hält Hashes und Ausgangscode fest. Kompakte Rundenergebnisse, Vergleichspartien, Beobachtungen, Manifeste und Auswertungen sind hier eingecheckt. Die Diagnoseinstrumentierung wurde in 1.066 Entscheidungen gegen den unveränderten Agenten geprüft, einschließlich identischer Zufallsverwendung und sämtlicher normaler Schätzwerte.

Die Befehle setzen frische Ausgabeverzeichnisse voraus. Der alte Quell-Snapshot im Repository ermöglicht die Reproduktion auch nach der Weitergabeänderung:

```sh
node scripts/prepare-analysis.js artifacts/decision-audit-20261031/baseline docs/benchmarks/recovery-85331e2/snapshot
for worker in 0 1 2 3; do
  node scripts/trace-matches.js --games 80 --seed $((20273101 + worker * 1000003)) --samples 64 --opponent-samples 16 --out artifacts/decision-audit-20261031/worker-$worker > artifacts/decision-audit-20261031/worker-$worker.log 2>&1 &
done
wait
node scripts/summarize-traces.js artifacts/decision-audit-20261031
```

Für das Selbstspiel: eigene Ausgabewurzel `artifacts/decision-self-audit-20261031`, gleicher Ausgangsquellstand, jeweils 40 Partien, Seeds `20281113 + worker * 1000003`, `--opponents self --opponent-samples 64` und das dort erzeugte `--snapshot`. Anschließend beide Wurzeln an `scripts/calibrate-moon-defense.js` übergeben. `scripts/review-decisions.js` prüft ausgewählte Fälle mit `--samples 2048 --timed-ms 1200`; Zeitmessungen können zwischen Rechnern abweichen.

Verworfenen Modellversuch vorbereiten, ohne die Anwendung zu ändern:

```sh
node scripts/prepare-analysis.js artifacts/moon-defense-next docs/benchmarks/recovery-85331e2/snapshot docs/analysis/2026-10-31/experiments/moon-defense
node scripts/find-moon-counterexample.js
```

Geprüften Weitergabe-Kandidaten vorbereiten und an neuen privaten KIs prüfen:

```sh
node scripts/prepare-analysis.js artifacts/passing-moon-next docs/benchmarks/recovery-85331e2/snapshot docs/analysis/2026-10-31/experiments/passing
node scripts/validate-passing.js prepare
for worker in 0 1 2 3; do
  node scripts/validate-passing.js run --worker $worker > artifacts/passing-validation-20261031/worker-$worker.log 2>&1 &
done
wait
node scripts/summarize-passing-validation.js
```

Nur gespeicherte Ergebnisse erneut auswerten, ohne neue Partien zu spielen:

```sh
cp -R docs/analysis/2026-10-31/model-comparison artifacts/recheck-moon-model
node scripts/compare-trace-matches.js artifacts/recheck-moon-model
cp -R docs/analysis/2026-10-31/passing-validation artifacts/recheck-passing
node scripts/summarize-passing-validation.js artifacts/recheck-passing
```

Die produktive Weitergabe stimmt für alle 40 Testhände mit dem eingefrorenen Kandidaten überein. Ausspielstrategie, Kartensuche, Durchmarschheuristik und Informationsgrenze bleiben unverändert. Neue Regressionstests prüfen die geschaffene Durchmarschhand, Seiteneinstiege und viele niedrige Herzen ohne ausreichende Kontrolle. Der Browsertest prüft die neue Tippauswahl samt Erklärung und weiterhin manuelle Auswahl; die Regression zum gedeckten Pik-König bleibt erhalten.
