# hosttech-ddns

Dynamic DNS für djjessejay.ch über die Hosttech DNS REST API (`https://api.ns1.hosttech.eu/api/v1`).

Das Werkzeug ermittelt die öffentliche IPv4-Adresse des Hosts und aktualisiert den A-Record nur dann, wenn er von der aktuellen IP abweicht. Ein systemd-Timer führt den Lauf alle 5 Minuten aus. Es gibt keine externen Abhängigkeiten, nur Node.js 22 oder neuer.

## Aufbau

```
tools/hosttech-ddns/
├── src/
│   ├── ddns.js             Einstiegspunkt (CLI), Exit-Code 0 oder 1
│   ├── config.js           Konfiguration aus Umgebungsvariablen
│   ├── sync.js             IP-Ermittlung und Record-Abgleich
│   └── hosttech-client.js  API-Client mit Retry und Timeout
├── test/                   node:test, fetch ist gemockt, kein Netzwerk nötig
├── deploy/
│   ├── hosttech-ddns.service
│   ├── hosttech-ddns.timer
│   └── env.example         Vorlage für /etc/hosttech-ddns/env
└── README.md
```

Ablauf eines Laufs: Zuerst wird die IP ermittelt (oder `HOSTTECH_IP` übernommen). Danach werden Zone-ID, Records und der Ziel-Record gelesen. Ist der Wert identisch, endet der Lauf ohne Schreibzugriff. Andernfalls folgt genau ein PUT mit der neuen IP und der bestehenden TTL.

## Konfiguration

Alle Einstellungen laufen über Umgebungsvariablen. Der Token darf nicht im Repository stehen.

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `HOSTTECH_TOKEN` | ja | | API-Token aus dem Hosttech-Account |
| `HOSTTECH_DOMAIN` | ja | | Zone, z. B. `djjessejay.ch` |
| `HOSTTECH_RECORD_NAME` | nein | `@` | Name des Records, `@` für die Apex-Domain |
| `HOSTTECH_RECORD_TYPE` | nein | `A` | Nur `A` wird unterstützt |
| `HOSTTECH_IP` | nein | | Feste IP, die IP-Ermittlung entfällt |
| `IP_CHECK_URL` | nein | `https://api4.ipify.org` | IPv4-Dienst, Antwort muss reine IPv4 sein |
| `HTTP_TIMEOUT_MS` | nein | `10000` | Timeout je Request |
| `DDNS_DRY_RUN` | nein | `0` | `1` loggt die Änderung, schreibt aber nichts |

Die Antwort des IP-Dienstes wird validiert. HTML oder ein leerer Body führen zu einem Fehler und nie zu einem Schreibzugriff.

## Betrieb auf dem Host

Voraussetzungen sind ein Node.js-22-Binary unter `/usr/bin/node` (sonst den Pfad in der Unit-Datei anpassen) und ein API-Token mit Schreibrecht auf die Zone.

```bash
sudo mkdir -p /opt/hosttech-ddns /etc/hosttech-ddns
sudo cp -r src package.json README.md /opt/hosttech-ddns/
sudo cp deploy/env.example /etc/hosttech-ddns/env
sudo chown root:root /etc/hosttech-ddns/env && sudo chmod 600 /etc/hosttech-ddns/env
sudo $EDITOR /etc/hosttech-ddns/env        # Token eintragen, DDNS_DRY_RUN=1 für den ersten Test
sudo cp deploy/hosttech-ddns.service deploy/hosttech-ddns.timer /etc/systemd/system/
sudo systemctl daemon-reload

# Erster Lauf ohne Schreibzugriff
sudo systemctl start hosttech-ddns.service
journalctl -u hosttech-ddns.service -n 20 --no-pager

# Nach erfolgreichem Dry-Run: DDNS_DRY_RUN=0 setzen, dann Timer aktivieren
sudo systemctl enable --now hosttech-ddns.timer
systemctl list-timers hosttech-ddns.timer
```

Lokal lässt sich der Lauf ohne Installation ausführen, etwa mit `set -a; . ./.env; set +a; DDNS_DRY_RUN=1 npm start`.

## Tests

```bash
npm test
```

Die Tests decken Retry-Verhalten (429/5xx werden wiederholt, 401 nicht), Paginierung, Abgleichslogik, Mehrdeutigkeitsschutz, IP-Validierung, Dry-Run und Konfigurationsvalidierung ab.

## Fehlersuche

Ein Exit-Code 1 mit `HTTP 401` bedeutet einen ungültigen oder abgelaufenen Token. `Zone ... nicht im Hosttech-Account gefunden` heißt, dass der Token diese Zone nicht sehen kann. `Mehrdeutig` bedeutet, dass mehrere A-Records mit gleichem Namen existieren (etwa Round-Robin). In diesem Fall wird bewusst nichts geschrieben, der Record muss manuell bereinigt werden. Netzwerkfehler werden dreimal mit Backoff wiederholt und landen danach im Journal.

## Offene Punkte gegen die echte API

Die folgenden Annahmen sind im Code markiert und müssen einmal gegen die Hosttech-Dokumentation oder einen echten Response geprüft werden. Die Tests verwenden einen Mock.

Die Paginierung erwartet `meta.last_page` im Laravel-Format. Liefert die API stattdessen `links.next`, muss `#getAll` in `src/hosttech-client.js` angepasst werden.

Der PUT-Body enthält `name`, `type`, `value` und `ttl`. Felder wie `priority` bei MX-Records spielen für A-Records keine Rolle, für andere Typen wäre der Body zu erweitern.

Der frühere Aufruf `/user/v1/tools/changettl` wurde bewusst entfernt. Er wirkt zonenweit auf alle Records, verschluckte Fehler und ist für einen DDNS-Lauf nicht geeignet.

## Sicherheit

Der Token gehört ausschließlich in `/etc/hosttech-ddns/env` mit Modus 600. Die Unit läuft mit `DynamicUser` und einem schreibgeschützten Dateisystem. Bei einem versehentlich veröffentlichten Token ist eine Rotation in der Hosttech-Oberfläche der richtige Schritt, das Entfernen aus der Git-Historie allein reicht nicht.
