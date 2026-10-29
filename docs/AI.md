# KI und Informationsgrenzen

Jeder Spieler bewertet seinen eigenen Strafpunktnachteil. Es gibt keine Teamwertung, keine gemeinsame private Kartenkenntnis und keine Nachrichten zwischen KI-Workern. Die Bewertung ist eine Näherung für erfolgreiches Hearts-Spiel, keine berechnete optimale Match-Strategie.

## Kartenhypothesen

Eine Beobachtung enthält nur die eigene Hand, eigene Weitergabedaten und öffentliche Karten, Punkte und Fehlfarben. `src/deals.js` erzeugt hypothetische Hände mit den passenden Kartenzahlen. Bekannte selbst weitergegebene Karten bleiben ihrem Empfänger zugeordnet, solange sie nicht öffentlich gespielt wurden.

Für die übrigen Karten zählt dynamische Programmierung, wie viele vollständige Zuteilungen jede mögliche Farbverteilung erlaubt. Die Gewichtung mit Multinomialkoeffizienten liefert gleichverteilte Zuteilungen unter diesen Bedingungen. Ohne Fehlfarben genügt Mischen und Aufteilen. Das Verfahren vermeidet den Verteilungsfehler einer gierigen Zuteilung und berechnet die Zähler nur einmal je Zug. Der Test vergleicht die Stichprobenhäufigkeit mit allen möglichen Zuteilungen einer kleinen vollständig aufzählbaren Situation.

Zusätzlich verwendet die Suche einen **weichen** Weitergabe-Prior: Ein Computerempfänger, dem man selbst keine Pik-Dame gegeben hat, erhält in den Hypothesen seltener die Pik-Dame. Diese Einschätzung beruht auf der bekannten Weitergabeheuristik. Beim Menschen ist sie abgeschwächt; er darf die Dame behalten. Das ist ein Gegnermodell, keine zusätzliche Spielregel oder Kenntnis der wirklichen Hände. Die gewichtete Suchverteilung ist deshalb von der uniformen Basisverteilung zu unterscheiden.

## Ausspielsimulation und Bewertung

Jede legale Karte wird in denselben gezogenen Händen bis zum Rundenende ausgespielt. `src/rollout.js` führt die konservative Referenz-Ausspiellogik in einem kompakten Zustand aus. Die Kartenwahl jedes simulierten Spielers verwendet nur dessen hypothetische Hand und den öffentlichen Stich. Tests vergleichen die Ergebnisse mit dem vollständigen Regelmotor bei identischen Zufallsfolgen über viele Spielpositionen.

Alle Karten einer gezogenen Verteilung verwenden dieselbe neu gezogene Zufallsfolge. Diese Kopplung verringert das Rauschen beim Vergleich zweier Karten. Neue Verteilungen haben unabhängige Zufallsfolgen. Die tatsächlichen Entscheidungen und privaten Erinnerungen verschiedener Spieler bleiben unabhängig.

Nach einer Simulation wird die echte Rundenabrechnung einschließlich Durchmarsch angewandt. Die Nutzenfunktion ist `Mittelwert(gegnerische Rundenpunkte) - eigene Rundenpunkte`. Ohne Durchmarsch ist das eine lineare Umformung der eigenen Strafpunkte, weil jede Runde genau 26 Punkte verteilt. Jeder Spieler maximiert ausschließlich seinen eigenen Wert. Die KI verwendet keine zukünftigen wirklichen Karten und kein empirisches Zukunftsmodell mehr. Dieses zuvor erprobte Modell ergab keinen belastbaren Vorteil und wurde entfernt.

## Trennung der Spieler und Tippfunktion

- `src/observation.js` bildet die Informationsgrenze zwischen Spielzustand und KI.
- Jeder Ausspiel-Worker erhält nur die Beobachtung des gerade rechnenden Spielers.
- Jeder Weitergabe-Worker erhält ausschließlich seine eigene ursprüngliche Hand und die öffentliche Tauschrichtung.
- Der Weitergabe-Tipp verwendet dieselbe Auswahlfunktion wie die Computer und markiert drei Karten. Er verändert weder die Auswahl noch die Hand und führt keinen Tausch aus.
- Neustarts beenden Worker; Epoch-Prüfungen verwerfen verspätete Ergebnisse.

Die Tests prüfen unter anderem unveränderte Entscheidungen bei veränderten wirklichen Gegnerkarten, unveränderte Eingabeobjekte, zulässige Kartenhypothesen und die tatsächlich an Worker gesendeten Nachrichten.

## Stärke und Grenzen

Die unveränderte Vorgänger-KI ist in `test/fixtures/ai-v1.js` eingefroren. Der Benchmark spielt eine neue KI gegen drei dieser Kopien bis zur 100-Punkte-Grenze, rotiert alle Plätze und teilt Gleichstände. Getrennte Zufallsströme verhindern eine gemeinsame private Erinnerung. Ergebnisdateien enthalten Quellcode-Hashes, Budgets, Seeds, tatsächliche Laufzeiten und Einzelpartien.

[RESULTS.md](RESULTS.md) dokumentiert die Vergleichsläufe. Feste Stichprobenzahlen und gleiche Zeitbudgets sind unterschiedliche Experimente. Konfidenzintervalle werden aus vollständigen Viererblöcken der Sitzrotationen gebootstrapt. Kleine Stichproben, andere Gegner oder größere Budgets können andere Ergebnisse liefern. Gegen Menschen oder Spitzenprogramme ist keine allgemeine Überlegenheit nachgewiesen. Auch eine längere Suche garantiert keinen besseren Einzelzug; die simulierte Ausspielpolitik bleibt vereinfacht.
