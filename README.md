# Hertta ♥

Hearts für einen Menschen und drei unabhängig spielende Computergegner. Deutschsprachige Browseroberfläche, vollständige Spielregeln und lokale KI-Berechnung ohne Konto oder externe KI-Dienste.

## Starten

Node.js 22 oder neuer genügt zum Spielen:

```sh
npm start
```

Öffne auf deinem eigenen Rechner `http://localhost:3000`. In einer Cloud-Umgebung verwende die unterstützte Portfreigabe für Port 3000. `PORT=8080 npm start` wählt einen anderen Port. Beenden mit Strg+C.

## Die Oberfläche

- Jeder Platz zeigt **Stiche**, **Punkte**, verbleibende Karten und den Gesamtstand. Ein Stapel aus 13 kleinen Karten macht gewonnene Stiche zusätzlich sichtbar.
- Jede ausgespielte Karte landet an der Position ihres Spielers. Die letzte Karte wird animiert; Name und aktive Markierung zeigen den Spielverlauf.
- Ein vollständiger Stich bleibt kurz liegen. Gewinner und Siegerkarte leuchten auf, anschließend wandern die Karten zum Gewinner.
- Nach der Weitergabe siehst du **erhaltene und abgegebene Karten nebeneinander**. Erst „Karten aufnehmen & spielen“ startet das Spiel. Neue Karten bleiben in der Hand markiert.
- Der Stichverlauf lässt sich aufklappen. Die Rundenabrechnung unterscheidet Stiche, Rundenpunkte und Gesamtstand einschließlich Durchmarsch.
- Die Oberfläche unterstützt schmale Bildschirme, Tastaturbedienung, Screenreader-Beschriftungen und reduzierte Bewegung.

Wähle zunächst drei Karten zum Weitergeben. Danach sind spielbare Karten hell dargestellt. „Tipp berechnen“ markiert in der Weitergabephase drei Vorschläge und beim Ausspielen eine Karte. Die Vorschläge ändern deine Auswahl nicht automatisch. „Neues Spiel“ beendet auch laufende KI-Berechnungen. [Beispiel des Weitergabe-Tipps](docs/screenshots/passing-hint.png).

## Regeln

Bediene die angespielte Farbe, falls du sie hast. Die Kreuz-Zwei beginnt. Im ersten Stich dürfen keine Strafkarten abgeworfen werden, solange andere Karten vorhanden sind. Herzen dürfen erst nach dem ersten abgeworfenen Herz ausgespielt werden – außer du hast nur Herzen.

Jedes Herz zählt einen Punkt, die Pik-Dame 13. Wer alle 26 Punkte sammelt, gibt den drei Gegnern jeweils 26 Punkte. Die Weitergabe wechselt zwischen links, rechts, gegenüber und keiner Weitergabe. Sobald jemand mindestens 100 Punkte erreicht, gewinnt der niedrigste Gesamtstand. Gleichstände zählen als geteilte Siege.

## Die KI

Die KI zieht verdeckte Hände aus den Verteilungen, die zur eigenen Hand, den selbst abgegebenen Karten und öffentlichen Fehlfarben passen. Ein kombinatorischer Zähler gewichtet mögliche Verteilungen gleich, statt sie durch eine gierige Kartenzuteilung zu verzerren. Ein weiches Modell der bekannten Weitergabestrategie hilft, die Pik-Dame einzuschätzen; menschliche Weitergaben bleiben möglich.

Für jede legale Karte simuliert sie die restliche Runde. Eine kompakte Simulation ermöglicht mehr Stichproben pro Sekunde. Innerhalb einer gezogenen Verteilung verwenden alle Karten dieselbe Zufallsfolge: Unterschiede zwischen den Karten werden dadurch weniger von zufälligen Ausspielvarianten überlagert. Die Bewertung minimiert den eigenen Strafpunktnachteil, einschließlich Durchmarsch. Eine optimale Strategie für den gesamten Match wird damit nicht behauptet.

Jeder Suchlauf läuft in einem eigenen Worker. Er erhält nur die **eigene Hand**, die **eigenen abgegebenen und erhaltenen Karten**, öffentliche Karten, Fehlfarben und Spielstände. Gegnerische tatsächliche Hände werden nicht übergeben. Es gibt keine Mannschaftswertung oder gemeinsame private KI-Erinnerung. Auch der Tipp für den Menschen verwendet ausschließlich dessen Informationen.

Die Bedenkzeit lässt sich zwischen 0,2, 1,2 und 5 Sekunden pro Zug wählen. Sie beeinflusst die Zahl der geprüften Möglichkeiten; ein längerer Suchlauf garantiert keinen besseren Einzelzug. Die KI und sämtliche Modelle laufen lokal im Browser.

Im Vergleich mit drei eingefrorenen Vorgängern erreicht die neue KI bei gleichem **5-ms-Budget 34,69 % Sieganteil in 480 vollständigen Spielen** (95-%-Intervall: 30,73–38,65 %). Ein Vorteil bei längeren Bedenkzeiten ist bisher nicht nachgewiesen. [Rohdaten und Testbedingungen](docs/RESULTS.md).

Methodik, Vergleich mit der eingefrorenen Vorgängerversion und Grenzen stehen in [docs/AI.md](docs/AI.md).

## Prüfen und vergleichen

```sh
npm test
npm ci
npm run test:browser
npm run benchmark -- 160 --matches --samples 16 --new-samples 128 --seed 20261211
```

Zum Spielen und für die Regeltests sind keine zusätzlichen Pakete nötig. `npm ci` installiert das festgeschriebene Playwright für Browserprüfungen. Der Browser-Test startet und beendet seinen eigenen Testserver. Er verwendet vorhandenes Chromium oder `CHROMIUM_PATH`; alternativ lässt sich Chromium mit `npx playwright install chromium` installieren. `BASE_URL` erlaubt die Prüfung eines bereits laufenden Servers.

Der Browser-Test prüft Kartenempfang, Tippfunktion, eine vollständige Runde, Abrechnung, Neustart, getrennte Worker-Nachrichten und Bildschirmbreiten von 320, 390 und 768 Pixeln. Screenshots und Benchmarkdaten landen im ignorierten Verzeichnis `artifacts/`.

Der Benchmark spielt eine neue KI gegen drei unveränderte Instanzen aus [test/fixtures/ai-v1.js](test/fixtures/ai-v1.js). Er rotiert den neuen Spieler durch alle Plätze, verwendet getrennte Zufallsströme und protokolliert Siege, Gleichstände, tatsächliche Laufzeiten, Seeds und Quellcode-Hashes. `--matches` spielt bis 100 Punkte; ohne diese Option werden einzelne Runden verglichen. `--ms` setzt ein gleiches Zeitbudget, `--samples` eine Untergrenze der Stichproben. Zeitbasierte Läufe können trotz gleicher Karten-Seeds wegen schwankender Rechenzeit unterschiedliche Entscheidungen treffen.

Spielstände werden derzeit nicht dauerhaft gespeichert. Das Spiel ist eine lokale Einzelspieler-Anwendung; der Browser enthält den vollständigen Spielzustand und ist kein manipulationssicherer Online-Server.
