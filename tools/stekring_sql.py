#!/usr/bin/env python3
"""Stekring van een tenant: SQL genereren en de DB-ring controleren.

De server valideert elke stekkeuze tegen `wedstrijd.stek_ring` van DIE klant
(sinds 13 aug 2026, migratie stekring_per_klant_stap1/2). Die ring moet exact
gelijk zijn aan `STEK_POSITIE` in de kaart.js van de tenant: staat een stek wel
op de kaart maar niet in de ring, dan biedt de app hem aan en weigert de server
hem met `onbekende_stek`. Precies dat was de blokkade voor klant 2.

Gebruik:
    python3 tools/stekring_sql.py --slug demo          # SQL naar stdout
    python3 tools/stekring_sql.py --slug demo --check  # alleen de samenvatting

De positie is de FYSIEKE volgorde rond het water; twee stekken zijn "naast
elkaar" als hun posities 1 verschillen. Een gat in de nummering (bijvoorbeeld
een oever zonder stekken) hoort dus ook een gat in de posities te zijn, anders
loot de app koppels naast elkaar die dat in werkelijkheid niet zijn.
"""
import argparse
import json
import os
import re
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(os.path.dirname(HIER), 'docs')


def lees_posities(slug):
    pad = os.path.join(DOCS, slug, 'kaart.js')
    if not os.path.exists(pad):
        raise SystemExit(f'FOUT: {pad} bestaat niet')
    tekst = open(pad, encoding='utf-8').read()
    m = re.search(r'const STEK_POSITIE\s*=\s*(\{.*?\});', tekst, re.S)
    if not m:
        raise SystemExit(f'FOUT: geen STEK_POSITIE gevonden in {pad}')
    ruw = json.loads(m.group(1))
    return sorted((int(pos), int(stek)) for stek, pos in ruw.items())


def segmenten(paren):
    """Aaneengesloten stukken; bepaalt hoeveel koppels er passen."""
    stukken, vorige = 1, None
    for positie, _ in paren:
        if vorige is not None and positie != vorige + 1:
            stukken += 1
        vorige = positie
    return stukken


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--slug', required=True, help='tenant-map onder docs/')
    ap.add_argument('--check', action='store_true', help='alleen samenvatten, geen SQL')
    a = ap.parse_args()

    paren = lees_posities(a.slug)
    posities = [p for p, _ in paren]
    stekken = [s for _, s in paren]
    if len(set(posities)) != len(posities):
        raise SystemExit('FOUT: dubbele posities in STEK_POSITIE')
    if len(set(stekken)) != len(stekken):
        raise SystemExit('FOUT: dubbele steknummers in STEK_POSITIE')

    stukken = segmenten(paren)
    max_koppels = sum(
        n // 2 for n in _lengtes(posities)
    )
    print(f'# {a.slug}: {len(paren)} stekken, posities {posities[0]} t/m {posities[-1]}, '
          f'{stukken} aaneengesloten stuk{"ken" if stukken != 1 else ""}, '
          f'max {max_koppels} koppels', file=sys.stderr)
    if a.check:
        return

    waarden = ',\n  '.join(f'({p}, {s})' for p, s in paren)
    print(f"""-- stekring voor tenant '{a.slug}', gegenereerd uit docs/{a.slug}/kaart.js
-- (tools/stekring_sql.py). Positie = fysieke volgorde rond het water.
delete from wedstrijd.stek_ring
where klant_id = (select id from wedstrijd.klanten where slug = '{a.slug}');

insert into wedstrijd.stek_ring (klant_id, positie, stek)
select (select id from wedstrijd.klanten where slug = '{a.slug}'), v.positie, v.stek
from (values
  {waarden}
) as v(positie, stek);""")


def _lengtes(posities):
    """Lengtes van de aaneengesloten stukken."""
    uit, lengte, vorige = [], 0, None
    for p in posities:
        if vorige is not None and p != vorige + 1:
            uit.append(lengte)
            lengte = 0
        lengte += 1
        vorige = p
    uit.append(lengte)
    return uit


if __name__ == '__main__':
    main()
