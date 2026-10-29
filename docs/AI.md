# Strategie, Informationsgrenzen und Bewertung

Die aktuelle Überarbeitung ist ein zu prüfender Kandidat. Der frühere Vorteil bei 5 ms hat sich bei 200 ms nicht bestätigt. Ein erfolgreicher Strategietest ist kein Spielstärkenachweis; abgeschlossene Vergleiche und ihre jeweiligen Quellstände stehen in [RESULTS.md](RESULTS.md).

## Weitergabe als Entscheidung über die ganze Hand

`strategy.js` bewertet alle 286 möglichen Dreiergruppen. Maßgeblich sind die verbliebenen Farben und Karten, nicht nur eine Rangliste gefährlicher Einzelkarten. Ein langer Bestand kleiner Pik schützt hohe Pik; das Leeren einer kurzen Nebenfarbe eröffnet Abwurfchancen. Bei schwacher Pik-Deckung bleibt König/Ass gefährlich. Hohe Herzkontrolle und Seiteneinstiege können stattdessen für einen möglichen Durchmarsch erhalten werden. Nach dem Empfang neuer Karten kann eine zuvor geleerte Farbe wieder besetzt sein.

Die festen Gewichte dieser Bewertung sind Heuristiken. Die Regressionstests decken ausdrücklich den Fall ab, Karo 8 und 9 zusammen mit Herz-Dame abzugeben und den durch sechs kleine Pik gedeckten König zu behalten. Eine andere Testhand mit ungeschütztem König gibt ihn ab. Das beweist die beabsichtigte Unterscheidung dieser Situationen, nicht eine optimale Auswahl für jede Hand.

Der Weitergabe-Tipp verwendet dieselbe Auswahl wie die Computer. Er markiert und erläutert drei Karten, ohne sie auszuwählen oder auszutauschen.

## Eigene Suche und Durchmarsch

Die Suchverteilung berücksichtigt eigene Karten, eigene bekannte Weitergaben, öffentliche gespielte Karten und Fehlfarben. Dynamische Programmierung zählt die vollständigen Zuteilungen nach Farben und Handgrößen; Multinomialgewichte vermeiden eine gierige Verzerrung. Die frühere Annahme, Computer würden immer die Pik-Dame abgeben, wird **nicht mehr verwendet**, weil die neue Weitergabe diese Karte unter geeigneten Bedingungen behalten darf. Auch menschliche Weitergaben bleiben frei.

Jede legale Karte wird in denselben gezogenen Verteilungen ausgespielt. Gekoppelte Zufallsfolgen reduzieren das Rauschen beim Vergleich. Die eigene simulierte Ausspielstrategie berücksichtigt unter anderem hohe Karten mit Deckung, Abwürfe zum Leeren einer Farbe, plausible eigene Durchmärsche und die Abwehr eines Gegners, der bisher alle Punkte sammelt. Beim Ausspiel einer Farbe berücksichtigt ein Näherungsmodell die noch unbekannten höheren und niedrigeren Karten sowie öffentliche Fehlfarben. Eine gedruckte Zwei, die inzwischen die höchste verbleibende Karte ihrer Farbe ist, wird dadurch nicht für einen sicheren Ausstieg gehalten. Die Rang-Extremfälle sind eindeutig; Zwischenwerte beruhen auf einer vereinfachten Empfängerverteilung ohne vollständige Kapazitätsmodellierung. Die anderen simulierten Spieler verwenden beim Ausspielen ebenfalls dieses Modell, sonst die konservative Referenz-Ausspiellogik. Dieses vereinfachte Gegnermodell bleibt eine mögliche Fehlerquelle.

Ein anfänglicher Durchmarschplan wird aus der eigenen ursprünglichen Nach-Tausch-Hand rekonstruiert: aktuelle eigene Karten plus eigene öffentlich gespielte Karten. Er braucht daher keine gemeinsame oder fremde private Erinnerung. Der Plan bleibt über die ersten gewonnenen Stiche hinweg bestehen, solange kein anderer Spieler punktet. Eine reine Zahl hoher Strafkarten reicht als Begründung nicht aus. Ein Durchmarsch bleibt ein unsicherer Plan; eine andere gespielte Karte kann seinen Erfolg verhindern.

Die gewöhnliche Suchbewertung ist `Mittelwert(gegnerische Rundenpunkte) - eigene Rundenpunkte`, einschließlich der echten Durchmarschabrechnung. Sobald öffentliche bereits genommene Punkte garantieren, dass diese Runde das Spiel beendet, wird stattdessen die tatsächliche eigene Gewinnchance bewertet. Gleichstände teilen den Gewinn; Rundenpunkte entscheiden nur bei identischer geschätzter Gewinnchance.

## Exakt bekannte kleine Endspiele

Der Kartensampler zählt auch, ob die zulässige Zuteilung eindeutig ist. Nur bei **einer einzigen** aus den eigenen und öffentlichen Informationen ableitbaren Restverteilung und höchstens drei Karten je Spieler beginnt eine begrenzte exakte Suche. Sie behandelt jede gegnerische legale Fortsetzung als mögliche Gegenwehr. Ein sicheres sofortiges Spielgewinn-Ergebnis kann die Monte-Carlo-Entscheidung ersetzen; im normalen Rundenfall gilt dies für gesicherte punktfreie Ergebnisse beziehungsweise einen gesicherten Durchmarsch. Ein laufender Durchmarschplan wird nicht für eine bloß gesicherte gewöhnliche Nullrunde verworfen. Bei überschrittenem Knotenlimit oder ohne passendes gesichertes Ergebnis rechnet die normale Suche weiter.

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
