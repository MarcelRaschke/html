# Beat Architekt: Abnahmetests

Browser-Tests (Playwright, Chromium) fuer die Demo unter `demos/beat-architekt/`. Sie pruefen gemessene Werte, nicht nur, ob Funktionen existieren: Lautheit gegen EBU Tech 3341, True Peak, Limiter, Recorder, Crossfade, KI-Mix und jede exportierte Datei mit ffprobe/ffmpeg.

## Ausfuehren

```bash
cd demos/beat-architekt/tests
npm ci
npx playwright install chromium   # einmalig; in CI mit --with-deps
npx playwright test               # alle Specs
npx playwright test specs/07-delivery-encoder.spec.js   # einzelne Spec
```

Voraussetzungen: Node 20 oder neuer, fuer `07-delivery-encoder` zusaetzlich `ffmpeg` und `ffprobe` im PATH. Fehlt ffmpeg lokal, wird diese Spec uebersprungen; in CI (`CI=true`) ist es Pflicht. Der MP3-Test laedt lamejs von jsDelivr und braucht dafuer Netzzugang.

Der Testserver (`serve.js`) liefert das Demo-Verzeichnis auf `http://127.0.0.1:8090/` aus. Der Port laesst sich mit `BA_TEST_PORT` aendern; ein bereits laufender Server wird lokal wiederverwendet.

## Aufbau

| Spec | Prueft |
|---|---|
| `01-loudness` | K-Filter-Koeffizienten, EBU 3341 Faelle 1 bis 5 bei 44,1 und 48 kHz (+/-0,1 LU), Normalisierung, Live-Meter |
| `02-true-peak` | True-Peak-Fehler bis 20 kHz, Inter-Sample-Peaks, Export-Limiter auf -1 dBTP |
| `03-export-worker` | Worker-Ergebnis identisch zum Haupt-Thread, Reaktionszeit der Oberflaeche, Fallback ohne Worker |
| `04-live-meter-limiter` | Live-True-Peak (Halten, Abfall, Clipping), Live-Limiter offline und im Master-Pfad |
| `05-master-path` | Sample-Player ueber Limiter und Meter, Master-Recorder (Worklet und ScriptProcessor), Video-Export |
| `06-crossfade-aimix` | Crossfade-Rampe, Abbruch, MIDI im Fade, KI-Pause, Gain-Trennung, Frequenzbalance und Bass-Toleranz |
| `07-delivery-encoder` | WAV/AIFF/MP3/Opus mit ffprobe und Rueckdecodierung, AAC-Fehlerpfad, M4A-Muxer, Export ueber die Oberflaeche |

Jeder Test schlaegt zusaetzlich fehl, wenn auf der Seite unerwartete Fehler oder Konsolenfehler auftreten (Fixture `app` in `helpers.js`). Erwartete Fehler meldet ein Test ausdruecklich mit `app.allowErrors(/.../)`.

## Grundsaetze

- Ein Worker, keine automatischen Wiederholungen: Die Tests messen Zeitverlaeufe; ein roter Test ist ein Befund.
- Toleranzen stammen aus Normen (EBU 3341: +/-0,1 LU) oder aus dokumentierten Eigenschaften (MP3-Encoderverzoegerung 1105 Samples, Dither hoechstens 1,6 LSB).
- Neue Phasen bringen ihre Abnahmekriterien als Spec in diesem Verzeichnis mit.
