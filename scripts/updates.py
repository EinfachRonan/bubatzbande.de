#!/usr/bin/env python3
"""Schreibt site/updates.json: letzter Commit (Unix-Zeit) pro Spiele-Ordner in site/.
Läuft im Deploy (braucht volle Git-Historie). Die Startseite sortiert damit die Testspiele.
Commits mit „[still]“ in der Commit-Nachricht werden übersprungen (stille Änderungen, z. B. Handy-Layout)."""
import json, os, subprocess
root = os.path.join(os.path.dirname(__file__), '..', 'site')
out = {}
for d in sorted(os.listdir(root)):
    if not os.path.isdir(os.path.join(root, d)) or d in ('api', 'fonts'):
        continue
    # Commits mit „[still]“ in der Nachricht (z. B. reine Handy-Optimierungen von Ronan) zählen NICHT als Update
    log = subprocess.run(['git', 'log', '--format=%ct%x09%s', '--', 'site/' + d], capture_output=True, text=True).stdout.splitlines()
    for line in log:
        t, _, msg = line.partition('\t')
        if '[still]' not in msg and t:
            out[d] = int(t)
            break
with open(os.path.join(root, 'updates.json'), 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print(out)
