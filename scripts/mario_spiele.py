#!/usr/bin/env python3
"""Marios eigene Spiele einsammeln (läuft in der Mario-Schleuse, nachdem seine Ordner übernommen wurden).

Jedes Spiel von Mario liegt in einem eigenen Ordner  site/m-<name>/  mit einer Datei  spiel.json:
  {
    "name": "Mein Spiel",
    "text": "Kurze Beschreibung für die Kachel.",
    "bild": "key.jpg",              # Startbild im Spiele-Ordner (rechteckig, z. B. 1280x720)
    "version": "0.1",
    "art": "Rätsel",                # kleines Label auf der Kachel (optional)
    "code": "1234"                  # Beta-Code (3–12 Ziffern) – wird NICHT veröffentlicht
  }

Ergebnis:
  site/mario-spiele.json      öffentlich, für die Startseite (ohne Codes)
  site/api/mario_codes.php    nur Hashes der Codes, für bb.php („Code eingeben“)
Der Code wird aus spiel.json entfernt, bevor es auf master landet. Fehlt er später (z. B. weil Marios
Branch neu vom master geholt wurde), bleibt der bisherige Code gültig.
Freigeschaltet für alle (raus aus der Beta) wird ein Spiel nur von Ronan: Eintrag in site/mario-frei.json.
"""
import glob, hashlib, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')
CODES = os.path.join(SITE, 'api', 'mario_codes.php')  # .php, damit die Hashes nicht abrufbar sind
OUT = os.path.join(SITE, 'mario-spiele.json')

def warn(msg):
    print('::warning title=Mario-Spiele::' + msg)

def h(code):
    return hashlib.sha256(('bbcode:' + code).encode()).hexdigest()

def clean(s, n):
    s = re.sub(r'\s+', ' ', str(s or '')).strip()
    return s[:n]

old = {}
try:
    txt = open(CODES, encoding='utf-8').read()
    old = json.loads(txt[txt.index("<<<'J'\n") + 7:txt.rindex('\nJ, true)')])
except Exception:
    pass
old_by_game = {v['g']: k for k, v in old.items()}

# Codes, die schon für Ronans Spiele vergeben sind, darf Mario nicht nehmen
php = open(os.path.join(SITE, 'api', 'bb.php'), encoding='utf-8').read()
taken = {h(c) for c in re.findall(r"'bbcode:([0-9]+)'", php)}

games, codes = [], {}
for d in sorted(glob.glob(os.path.join(SITE, 'm-*'))):
    ordner = os.path.basename(d)
    if not os.path.isdir(d):
        continue
    if not re.fullmatch(r'm-[a-z0-9-]{2,17}', ordner):
        warn(f'{ordner}: Ordnername ungültig (nur m- + 2–17 kleine Buchstaben/Ziffern/Bindestrich) – übersprungen')
        continue
    pj = os.path.join(d, 'spiel.json')
    if not os.path.isfile(pj):
        warn(f'{ordner}: keine spiel.json – erscheint nicht auf der Startseite')
        continue
    try:
        sp = json.load(open(pj, encoding='utf-8'))
        assert isinstance(sp, dict)
    except Exception as e:
        warn(f'{ordner}/spiel.json ist kein gültiges JSON ({e}) – übersprungen')
        continue
    if not os.path.isfile(os.path.join(d, 'index.html')):
        warn(f'{ordner}: keine index.html – übersprungen')
        continue
    name = clean(sp.get('name'), 40) or ordner
    bild = clean(sp.get('bild'), 60)
    if not bild or not re.fullmatch(r'[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)', bild) or '..' in bild or not os.path.isfile(os.path.join(d, bild)):
        if bild:
            warn(f'{ordner}: Bild „{bild}“ nicht gefunden – nehme Standardbild')
        bild = ''
    ver = clean(sp.get('version'), 10) or '0.1'
    art = clean(sp.get('art'), 20)
    code = re.sub(r'\s+', '', str(sp.get('code') or ''))
    hk = None
    if code:
        if not re.fullmatch(r'[0-9]{3,12}', code):
            warn(f'{ordner}: Code muss aus 3–12 Ziffern bestehen – alter Code bleibt')
        elif h(code) in taken:
            warn(f'{ordner}: Code {code} ist schon für ein anderes Spiel vergeben – alter Code bleibt')
        elif h(code) in codes:
            warn(f'{ordner}: Code {code} hat schon ein anderes Mario-Spiel – alter Code bleibt')
        else:
            hk = h(code)
    if not hk:
        hk = old_by_game.get(ordner)
        if hk in codes:
            hk = None
    if not hk:
        warn(f'{ordner}: kein gültiger Code – das Spiel ist erst über die Startseite erreichbar, wenn ein Code drinsteht')
    else:
        codes[hk] = {'g': ordner, 'name': name, 'v': ver, 'url': ordner + '/'}
    games.append({
        'k': ordner, 'url': ordner + '/', 'name': name, 'text': clean(sp.get('text'), 160),
        'img': (ordner + '/' + bild) if bild else 'krieg/img/hoehle.jpg', 'v': ver, 'art': art, 'code': 1 if hk else 0,
    })
    # Code nicht veröffentlichen
    if 'code' in sp:
        del sp['code']
        with open(pj, 'w', encoding='utf-8') as f:
            json.dump(sp, f, ensure_ascii=False, indent=2)
            f.write('\n')

os.makedirs(os.path.dirname(CODES), exist_ok=True)
with open(CODES, 'w', encoding='utf-8') as f:
    js = json.dumps(codes, ensure_ascii=False, indent=1)
    f.write("<?php // automatisch erzeugt von scripts/mario_spiele.py – nicht von Hand ändern\nreturn json_decode(<<<'J'\n" + js + "\nJ, true);\n")
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(games, f, ensure_ascii=False, indent=1)
print(f'{len(games)} Mario-Spiel(e):', ', '.join(g['k'] for g in games) or '–')
