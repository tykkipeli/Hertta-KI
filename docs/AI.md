# KI, Informationsgrenzen und Bewertung

## Ziel und Suchverfahren

Jeder Spieler maximiert seine eigene geschätzte Gewinnwahrscheinlichkeit. Eine Teamwertung, ein gemeinsamer privater Kartenbestand oder Nachrichten zwischen den KI-Workern sind nicht vorgesehen.

Eine Beobachtung enthält die eigene Hand, eigene Weitergabedaten sowie öffentliche Fehlfarben, Karten und Punkte. Die KI zieht hypothetische Kartenverteilungen und spielt jede legale Karte in diesen Verteilungen bis zum Rundenende aus. Die simulierten Spieler verwenden nur ihre jeweilige hypothetische Hand und öffentliches Spielgeschehen.

Anschließend bewertet die KI den gesamten Spielstand. Ein Korpus aus 1.500 Runden der Referenz-KI liefert plausible weitere Runden mit ihren gemeinsamen Punktverteilungen, einschließlich Durchmärschen. Die Auswertung spielt diese Punktfolgen bis zur 100-Punkte-Grenze weiter und teilt Gleichstände. Vier Sitzrotationen jeder Folge vermeiden einen willkürlichen Vorteil für einen Platz. Die Zukunftsproben bleiben für alle Karten eines Suchlaufs gleich; Ergebnisse für identische Rundenabrechnungen werden zwischengespeichert.

Die Zukunftsproben nehmen Referenz-Spielstärke für alle vier Plätze an. Unterschiede zwischen menschlichen Spielern und der neuen KI werden darin noch nicht gezielt gelernt. Das ist ein Modell des weiteren Spiels, keine Garantie optimaler Entscheidungen. Insbesondere wird nicht behauptet, dass die KI eine berechnete perfekte Strategie besitzt.

## Eigene Weitergabe als private Information

Die drei Computergegner verwenden dieselbe festgelegte Weitergabeheuristik. Das erlaubt Rückschlüsse, ohne deren tatsächliche Karten einzusehen. Beispielsweise gibt diese Heuristik die Pik-Dame immer weiter. Ein Empfänger, dem der beobachtende Spieler keine Pik-Dame gegeben hat, hat sie daher nicht durch diese Weitergabe erhalten. Beim Menschen bleibt eine bewusste andere Weitergabe möglich.

Bei mindestens 100 Millisekunden angeforderter Bedenkzeit versucht die KI, einen mit der eigenen Weitergabe und den öffentlichen Karten vereinbaren ursprünglichen Deal zu finden. Die Weitergabe nach links/rechts wird als Kette, die gegenüberliegende Weitergabe als zwei Tauschpaare rückwärts betrachtet. Danach verändern symmetrische Markov-Schritte die unbekannten ursprünglichen Karten. Ein Schritt bleibt nur bestehen, wenn die eigene Hand, die eigenen erhaltenen Karten, bekannte Besitzer gespielter Karten und öffentliche Fehlfarben weiterhin stimmen.

Bei einem menschlichen Gegner wird dessen unbekannte Auswahl als freie Dreiermenge modelliert. Tests decken ausdrücklich den Fall ab, dass ein Mensch die Pik-Dame behält. Die KI erhält dabei nicht dessen tatsächlich gewählte Karten, außer den drei Karten, die sie selbst von ihm bekommen hat.

Das Verfahren ist eine endliche, korrelierte Monte-Carlo-Näherung. Eine begrenzte Initialisierung kann scheitern; dann wird mit der einfacheren Kartenverteilung weitergesucht. Bei kleineren Zeitbudgets wird von Anfang an ein weicher Weitergabe-Prior verwendet. So wird auch bei wenig Rechenzeit eine legale Karte geliefert.

## Trennung der Spieler

- `src/observation.js` bildet die Informationsgrenze zwischen Spielzustand und KI.
- Jeder Worker bekommt nur die Beobachtung des gerade rechnenden Spielers.
- Die Weitergabe wird in drei getrennten Workern ausschließlich aus der jeweiligen eigenen Hand gewählt.
- Vorhersagen fremder Hände sind erzeugte Hypothesen, keine Kopien der wirklichen Hände.
- Ein Neustart beendet bestehende Worker. Epoch-Prüfungen verhindern, dass verspätete Ergebnisse eine neue Partie verändern.

Die Tests prüfen unter anderem unveränderte Entscheidungen bei ausgetauschten tatsächlichen Gegnerkarten, unveränderte Eingabeobjekte, vereinbare Kartenhypothesen, erhaltene Karten und die tatsächlich an Worker gesendeten Nachrichten.

## Spielstärke messen

Der bisherige Gegner ist als unveränderte Referenz in `test/fixtures/ai-v1.js` gespeichert. Der neue Benchmark lässt einen neuen Spieler gegen drei Referenzen antreten. Platz und Weitergabe wechseln, Punkte werden nach den wirklichen Regeln abgerechnet, Gleichstände anteilig gezählt. Die Quellcode-Hashes und einzelnen Spielergebnisse bleiben in den Ergebnisdateien erhalten.

Einzelne Runden sind von vollständigen Spielen zu unterscheiden. Außerdem sind feste Stichprobenzahlen und gleiche Zeitbudgets unterschiedliche Vergleiche. Die Berichte enthalten deshalb auch tatsächliche mittlere Rechenzeiten. Ein Vergleich mit bloß einer schwachen Ausspielheuristik wird nicht als Nachweis eines Fortschritts gegenüber der vorherigen KI gewertet.

Die abgeschlossenen Vergleichsläufe werden in [RESULTS.md](RESULTS.md) dokumentiert. Die Ergebnisse gelten für die dort genannten Gegner, Regeln und Rechenbudgets, nicht für beliebige Hearts-Programme oder menschliche Strategien.

## Grenzen

Die Ausspielsimulation verwendet ein vereinfachtes Gegnermodell. Auch die Verteilung weiterer Runden ist eine empirische Näherung. Die Annahme über Computer-Weitergaben gilt für die implementierten Referenzstrategien; beim Menschen wird sie bewusst gelockert. Sehr kleine Zeitbudgets liefern weniger aussagekräftige Stichproben. Eine vollständig optimale Hearts-Strategie und eine Überlegenheit über Spitzenprogramme sind nicht nachgewiesen.
