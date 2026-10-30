# Strategie, Informationsgrenzen und Bewertung

Die aktuelle Überarbeitung hat den vorab festgelegten 200-ms-Test bestanden: 38,52 % Sieganteil in 640 vollständigen Partien, 95-%-Blockintervall 34,77–42,34 %. Der gesonderte Test bei 1.200 ms läuft noch. Funktionierende Strategietests und diese konkrete Vergleichsserie sind unterschiedliche Belege; Ergebnisse, jeweilige Quellstände und Grenzen stehen in [RESULTS.md](RESULTS.md).

## Weitergabe als Entscheidung über die ganze Hand

`strategy.js` bewertet alle 286 möglichen Dreiergruppen. Maßgeblich sind die verbliebenen Farben und Karten, nicht nur eine Rangliste gefährlicher Einzelkarten. Ein langer Bestand kleiner Pik schützt hohe Pik; das Leeren einer kurzen Nebenfarbe eröffnet Abwurfchancen. Bei schwacher Pik-Deckung bleibt König/Ass gefährlich. Hohe Herzkontrolle und Seiteneinstiege können stattdessen für einen möglichen Durchmarsch erhalten werden. Nach dem Empfang neuer Karten kann eine zuvor geleerte Farbe wieder besetzt sein.

Die festen Gewichte dieser Bewertung sind Heuristiken. Die Regressionstests decken ausdrücklich den Fall ab, Karo 8 und 9 zusammen mit Herz-Dame abzugeben und den durch sechs kleine Pik gedeckten König zu behalten. Eine andere Testhand mit ungeschütztem König gibt ihn ab. Das beweist die beabsichtigte Unterscheidung dieser Situationen, nicht eine optimale Auswahl für jede Hand.

Der Weitergabe-Tipp verwendet dieselbe Auswahl wie die Computer. Er markiert und erläutert drei Karten, ohne sie auszuwählen oder auszutauschen.

## Öffentliche Hinweise auf die Pik-Dame

Ein weiches Gegnermodell berücksichtigt, wenn ein Spieler eine legale Gelegenheit zum sicheren Abwerfen der Dame nicht genutzt hat. Unter einem bereits höheren Pik ist diese Information stärker; beim Abwurf in einer Fehlfarbe kann das Behalten einer gut gedeckten Dame sinnvoll sein. Die Gewichtung berücksichtigt daher hypothetische kleine Pik zur damaligen Gelegenheit. Sie schließt keine sonst zulässige Kartenverteilung aus. Menschliche Abweichungen werden weniger stark gewichtet. Bei drohendem Durchmarsch oder nahe dem Spielende entfällt diese Annahme, weil das Zurückhalten der Dame dann absichtlich richtig sein kann.

Die groben Gewichte stammen aus 509 synthetischen Entscheidungssituationen der alten KI mit jeweils 512 Verteilungen. Die Kalibrierung bestätigte ausdrücklich, dass die alte KI eine gedeckte Dame oft behält; „hätte sie abwerfen können, also hat sie sie nicht“ wäre falsch. [Kalibrierungszahlen](benchmarks/queen-policy-calibration.json), Reproduktion mit `node scripts/calibrate-queen-policy.js 600 512`. Diese Daten sind ein Gegnermodell, kein Spielstärkenachweis. Ohne relative Information bleibt auch die Zufallsfolge des normalen Samplers unverändert.

## Eigene Suche und Durchmarsch

Die Suchverteilung berücksichtigt eigene Karten, eigene bekannte Weitergaben, öffentliche gespielte Karten und Fehlfarben. Dynamische Programmierung zählt die vollständigen Zuteilungen nach Farben und Handgrößen; Multinomialgewichte vermeiden eine gierige Verzerrung. Die frühere Annahme, Computer würden immer die Pik-Dame abgeben, wird **nicht mehr verwendet**, weil die neue Weitergabe diese Karte unter geeigneten Bedingungen behalten darf. Auch menschliche Weitergaben bleiben frei.

Jede legale Karte wird in denselben gezogenen Verteilungen ausgespielt. Gekoppelte Zufallsfolgen reduzieren das Rauschen beim Vergleich. Die eigene simulierte Ausspielstrategie berücksichtigt unter anderem hohe Karten mit Deckung, Abwürfe zum Leeren einer Farbe, plausible eigene Durchmärsche und die Abwehr eines Gegners, der bisher alle Punkte sammelt. Beim Ausspiel einer Farbe berücksichtigt ein Näherungsmodell die noch unbekannten höheren und niedrigeren Karten sowie öffentliche Fehlfarben. Eine gedruckte Zwei, die inzwischen die höchste verbleibende Karte ihrer Farbe ist, wird dadurch nicht für einen sicheren Ausstieg gehalten. Die Rang-Extremfälle sind eindeutig; Zwischenwerte beruhen auf einer vereinfachten Empfängerverteilung ohne vollständige Kapazitätsmodellierung. Die anderen simulierten Spieler verwenden beim Ausspielen ebenfalls dieses Modell, sonst die konservative Referenz-Ausspiellogik. Dieses vereinfachte Gegnermodell bleibt eine mögliche Fehlerquelle.

Ein anfänglicher Durchmarschplan wird aus der eigenen ursprünglichen Nach-Tausch-Hand rekonstruiert: aktuelle eigene Karten plus eigene öffentlich gespielte Karten. Er braucht daher keine gemeinsame oder fremde private Erinnerung. Der Plan bleibt über die ersten gewonnenen Stiche hinweg bestehen, solange kein anderer Spieler punktet. Eine reine Zahl hoher Strafkarten reicht als Begründung nicht aus. Ein Durchmarsch bleibt ein unsicherer Plan; eine andere gespielte Karte kann seinen Erfolg verhindern.

Die gewöhnliche Suchbewertung ist `Mittelwert(gegnerische Rundenpunkte) - eigene Rundenpunkte`, einschließlich der echten Durchmarschabrechnung. Sobald öffentliche bereits genommene Punkte garantieren, dass diese Runde das Spiel beendet, wird stattdessen die tatsächliche eigene Gewinnchance bewertet. Gleichstände teilen den Gewinn; Rundenpunkte entscheiden nur bei identischer geschätzter Gewinnchance. Wenn die noch zu vergebenden Punkte oder ein möglicher Durchmarsch ein Spielende zulassen könnten, wird es bereits vor dem sicheren Überschreiten von 100 vorausschauend bewertet: ein tatsächlicher Sieg zählt als Sieg, eine tatsächliche Niederlage als Niederlage. Falls das Spiel weitergeht, liefert der neue Gesamtstand eine einfache, ausdrücklich unkalibrierte Schätzung der weiteren Gewinnchance. So kann die KI eine sonst sichere Niederlage durch Weiterreichen der Dame an jemanden mit 99 Punkten vermeiden, auch wenn sie dafür selbst 13 Punkte aufnehmen muss. Früh im Spiel bleibt die gewöhnliche Strafpunktbewertung erhalten.

## Exakt bekannte kleine Endspiele

Der Kartensampler zählt auch, ob die zulässige Zuteilung eindeutig ist. Nur bei **einer einzigen** aus den eigenen und öffentlichen Informationen ableitbaren Restverteilung und höchstens drei Karten je Spieler beginnt eine begrenzte exakte Suche. Sie behandelt jede gegnerische legale Fortsetzung als mögliche Gegenwehr. Bei drohendem Spielende darf nur ein gegen alle Fortsetzungen gesicherter sofortiger Spielsieg die Monte-Carlo-Entscheidung ersetzen; eine lediglich fortgesetzte Partie zählt dafür nicht als gesicherter Sieg. In den übrigen Runden gilt dies für gesicherte punktfreie Ergebnisse beziehungsweise einen gesicherten Durchmarsch. Ein laufender Durchmarschplan wird nicht für eine bloß gesicherte gewöhnliche Nullrunde verworfen. Bei überschrittenem Knotenlimit oder ohne passendes gesichertes Ergebnis rechnet die normale Suche weiter.

Diese Einschränkung verhindert, dass die KI eine gezogene Vermutung für wirklich bekannte gegnerische Hände hält. Tests vergleichen die exakte Suche mit vollständiger Aufzählung kleiner Spiele.

## Trennung der Spieler

- `observation.js` bildet die Informationsgrenze. Jeder Worker erhält nur eigene Hand und Tauschdaten sowie öffentliche Karten, Fehlfarben und Spielstände.
- Weitergabe-Worker erhalten nur die jeweilige eigene ursprüngliche Hand und die öffentliche Richtung.
- Die taktische Ausspielauswahl innerhalb der Simulation erhält nur die handelnde hypothetische Hand und öffentliches Stichgeschehen.
- Die exakte Suche erhält ausschließlich eine eindeutig aus diesen Informationen rekonstruierte Verteilung.
- Neustarts beenden Worker; Epoch-Prüfungen verwerfen verspätete Ergebnisse.

Die Tests prüfen unveränderte Entscheidungen nach Veränderungen tatsächlicher unbekannter Gegnerkarten, unveränderte Eingabeobjekte, zulässige Hypothesen sowie die wirklich an Worker gesendeten Nachrichten.

## Stärke messen

Die ursprüngliche KI ist in `test/fixtures/ai-v1.js` eingefroren. Der normale Benchmark spielt einen Kandidaten gegen drei unveränderte Kopien bis 100 Punkte. Vier Sitzrotationen teilen dieselben Kartenfolgen, Zufallsströme bleiben pro Spieler getrennt, Gleichstände werden anteilig gezählt. Ergebnisdateien enthalten Budgets, gemessene Dauer, Seeds, Quellcode-Hashes und jede vollständige Partie. Bootstrapintervalle verwenden ganze Viererblöcke.

Feste Stichprobenzahlen und gleiche Zeitlimits sind verschiedene Experimente. Sehr kurze Zeitlimits reichen für den hier angestrebten Stärkenachweis nicht aus. Eine Aussage über höhere Budgets erfordert abgeschlossene unveränderte Vergleichsserien bei diesen Budgets; Zwischenstände, einzelne Beispielhände und Erkundungsläufe genügen nicht.
