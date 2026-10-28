# Hertta ♥

Hearts für einen Menschen und drei Computergegner, mit deutschsprachiger Browseroberfläche. Keine externen Laufzeit-Abhängigkeiten, Konten oder API-Schlüssel.

## Starten

Voraussetzung: Node.js 22 oder neuer und ein moderner Browser mit JavaScript-Modulen und Web Workers.

```sh
cd /workspace/Hertta-KI
npm start
```

Öffne auf deinem eigenen Rechner `http://localhost:3000`. In einer Cloud-Umgebung nutze deren unterstützte Portfreigabe für Port 3000. `PORT=8080 npm start` wählt einen anderen Port. Beenden mit Strg+C.

```sh
npm test
npm run benchmark -- 100
```

Die Tests prüfen Kartenweitergabe, Bedienpflicht, ersten Stich, Herzfreigabe, Pik-Dame, Durchmarsch, 100 vollständige Runden, Informationsgrenzen und legale Simulationsentscheidungen. Der reproduzierbare Benchmark vergleicht einen rotierenden KI-Sitz mit drei heuristischen Gegnern; niedrige Strafpunkte sind besser. Er spielt einzelne Runden ohne Weitergabe und ist keine Ranglistenmessung.

## Spielen

Wähle zuerst drei Karten und bestätige die Weitergabe. Ihre Richtung wechselt pro Runde: links, rechts, gegenüber, keine. Klicke danach auf eine freigegebene Karte, wenn du am Zug bist. Der letzte abgeschlossene Stich bleibt bis zur nächsten Karte sichtbar. Die Tabelle zeigt Gesamtpunkte, die Plätze am Tisch die aktuellen Rundenpunkte. Bei mindestens 100 Gesamtpunkten endet das Spiel. Die niedrigste Punktzahl gewinnt, Gleichstände sind möglich. Ein Durchmarsch gibt den drei Gegnern jeweils 26 Punkte.

Die Bedenkzeit gilt pro KI-Zug. „Intensiv“ verwendet etwa fünf Sekunden; die Oberfläche bleibt durch Web Workers bedienbar. „Tipp berechnen“ markiert einen Vorschlag für deine Hand. „Neues Spiel“ bricht eine laufende Berechnung ab und setzt den Spielstand zurück.

## KI und Informationsgrenzen

Die KI verwendet informationsbeschränkte Monte-Carlo-Auswertung: Sie erzeugt mögliche Verteilungen der unbekannten Karten, die zur öffentlichen Historie, zur Bedienpflicht und zu ihren selbst weitergegebenen Karten passen. Jede legale Karte wird in denselben möglichen Verteilungen bis zum Rundenende ausgespielt. Sie wählt die Karte mit dem besten mittleren Ergebnis relativ zu den anderen Spielern. Durchmärsche fließen in die Endbewertung ein. Die Ausspielstrategie bevorzugt sichere Stiche und das Abwerfen gefährlicher Karten. Die Weitergabe erfolgt heuristisch.

Gegnerische Hände sind im Spielzustand des Browsers notwendig, werden aber **nicht an den KI-Worker übergeben**. Jeder Gegner bekommt nur seine eigene Beobachtung. Das ist kein manipulationssicheres Online-Spiel.

Grenzen: Die Simulation verwendet vereinfachte gegnerische Strategien und keine vollständige Suche über Informationsmengen. Sie optimiert Rundenpunkte, nicht die Gewinnwahrscheinlichkeit beim aktuellen Gesamtspielstand. Es gibt keine trainierten neuronalen Netze, keine zugesicherte optimale Spielweise und keinen belegten Vergleich mit Spitzenprogrammen. Mehr Rechenzeit reduziert Stichprobenrauschen, garantiert aber keinen besseren Einzelzug. Für weitere Verbesserungen sind stärkere Gegner-Benchmarks, strategische Durchmarschplanung und ein über Selbstspiel trainiertes Bewertungsmodell sinnvolle nächste Schritte.

## Aufbau

- `src/game.js`: unabhängige Regeln und Zustandsübergänge.
- `src/ai.js`: Beobachtungen, verdeckte Kartenverteilungen, Rollouts, Entscheidungen.
- `src/worker.js`: Berechnung außerhalb des UI-Threads.
- `src/app.js`, `index.html`, `style.css`: Oberfläche und Spielablauf.
- `server.js`: kleiner statischer Entwicklungsserver.

Spielstände werden derzeit nicht dauerhaft gespeichert. Es werden keine Telemetrie oder externen Schriftarten geladen.
