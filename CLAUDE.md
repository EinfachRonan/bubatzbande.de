# Regeln für dieses Repo (bubatzbande.de)

## Mario arbeitet NUR an seinen Spielen – über den Branch `mario`

Mario (Ronans Kollege) programmiert „Die Legenden der Kräuterhöhle“ (`site/kraeuterhoehle/`) und darf **eigene neue Spiele** anlegen: jedes in einem eigenen Ordner `site/m-<name>/`.
**Wenn Mario schreibt oder die Arbeit für Mario ist, gilt:**

1. Nur Dateien in `site/kraeuterhoehle/` und in `site/m-*/` ändern. Nichts anderes anfassen (Startseite, `bb.js`, `api/`, andere Spiele, Workflows, Skripte, diese Datei).
2. **Nie direkt auf `master` pushen.** Immer so arbeiten:
   ```bash
   git fetch origin master
   git checkout -B mario origin/master        # frisch vom aktuellen Stand
   # … nur in site/kraeuterhoehle/ ändern, committen …
   git push -f origin mario
   ```
3. Die GitHub-Action **Mario-Schleuse** übernimmt dann automatisch NUR `site/kraeuterhoehle/` und `site/m-*/` nach `master` und deployt. Änderungen außerhalb werden ignoriert.
4. Will Mario etwas außerhalb seines Ordners geändert haben (z. B. Startseite, gemeinsames Konto-System), nicht selbst machen, sondern sagen: „Das muss Ronan freigeben.“

### Neues Spiel von Mario in die Beta bringen

Sagt Mario z. B. „Neues Spiel, in die Beta mit Code 1234“:

1. Ordner `site/m-<name>/` anlegen (`m-` + 2–17 Zeichen: kleine Buchstaben, Ziffern, Bindestrich; z. B. `site/m-pilzjagd/`).
2. Darin `index.html` (das Spiel) und ein rechteckiges Startbild (z. B. `key.jpg`, 1280×720).
3. Darin `spiel.json`:
   ```json
   {
     "name": "Pilzjagd",
     "text": "Kurze Beschreibung für die Kachel (max. 160 Zeichen).",
     "bild": "key.jpg",
     "version": "0.1",
     "art": "Jump'n'Run",
     "code": "1234"
   }
   ```
   `code` = Beta-Code, 3–12 Ziffern. Wer ihn auf der Startseite unter ⚙️ → „Code eingeben“ eingibt, bekommt das Spiel als Kachel (Label „Test · … · von Mario“). Die Schleuse speichert den Code nur verschlüsselt und nimmt ihn danach aus `spiel.json` raus. Fehlt `code` später, bleibt der alte gültig; neuen Code eintragen = Code ändern. Codes, die schon vergeben sind, werden abgelehnt (Warnung in der Action).
4. Bearbeiten: einfach Dateien im Ordner ändern, `version` hochzählen. Löschen: Ordner löschen.
5. Konto-Funktionen: `<script src="../bb.js"></script>` einbinden; Spielstand im Konto mit `BB.cloud.put('m-<name>', daten)` / `await BB.cloud.get('m-<name>')`.
6. Für **alle** freigeben (raus aus der Beta) kann nur Ronan: Ordnername in `site/mario-frei.json` eintragen.

Ronan selbst darf wie bisher alles ändern und direkt auf `master` pushen.
