# Status Codex-review duo-feature (verwerkt 30 aug 2026, v73)

Bron: `codex-review-duo-codex.md` (review van commit `0e63bfa`, de duo-feature
uit v72). Oordeel van de reviewer: niet inzetten op 12 september vóór de P0 en
de eerste twee P1's zijn opgelost. Alle vier de punten zijn geverifieerd tegen
de code, alle vier klopten, en alles is dezelfde avond opgelost in v73
(migratie `duo_codex_fixes_join_expliciet_en_namen`).

## P0 · Maar één duolid kon in de UI kiezen; gedeelde stek kleurde "bezet" | VERWERKT

Klopte volledig, en pijnlijk: mijn eigen browsertest van v72 koos de zone via
een directe RPC-aanroep en zag dus nooit dat `magSelecteren()` op team-ID
vergeleek. Duoleden delen een lotnummer, maar `teamAanBeurt()` geeft één rij
terug; het andere duolid kreeg nooit bediening op de kaart, en in
`bezetDoor[stek]` overschreef het tweede lid het eerste waardoor de eigen
gedeelde stek als "bezet" kon kleuren.

Fix: nieuwe helpers `mijnBeurtNu()` (vergelijkt op LOTNUMMER + eigen open
keuze) en `zelfdeEenheid(a, b)` (zelfde team of zelfde duo_id). Gebruikt in
`magSelecteren`, de kaartkleuring (stekken én zoneletters) en de lotinglijst
(beide duoleden tonen "aan de beurt…"). Server: `t.id` als laatste
sorteersleutel in beide state-functies zodat de teamvolgorde deterministisch
is (duo-inserts delen een created_at).

Getest in de browser: beide duoleden mogen selecteren, na de keuze kleurt de
zone bij beiden als "mijn" en verschijnt niets als "bezet".

## P1 · Verborgen tweede naamveld kon stiekem een duo maken | VERWERKT

Klopte: de client stuurde `p_naam2` altijd mee en de server leidde "duo" af
uit een gevulde waarde. Vinkje aan, naam typen, vinkje uit = onbedoeld duo.

Fix aan twee kanten. Server: duo kan alleen nog EXPLICIET via een nieuwe
parameter `p_duo boolean default false` (oude signatuur gedropt wegens de
bekende PostgREST-overloadvalkuil; oude clients krijgen de default en kunnen
dus nooit meer per ongeluk een duo maken, precies het gedrag van vóór v72).
Client: `p_naam2` gaat alleen nog mee bij koppel of aangevinkt duo, het veld
wordt gewist bij uitvinken, en een leeg maatveld geeft een nette melding.
Browsertest: aan/typen/uit levert een solo op.

## P1 · Deellink landde op "Meedoen"; maatcode had geen levenscyclus | VERWERKT

Klopte. Fix: de duo-respons van `w_join` bevat nu ook het TOKEN van de maat,
en het deelbericht gebruikt de bestaande deeplink `#/w/CODE?t=TOKEN`: de maat
opent de link en is meteen ingelogd (het token in een appje is qua macht
gelijk aan de persoonlijke code die er toch al in stond). `DUO_MAAT` is nu
gebonden aan de wedstrijdcode, wordt gewist bij uitloggen, en na herladen
haalt de app de maatgegevens (naam + code, bewust ZONDER token) terug via het
token-beveiligde `w_mijn_team`, dat daarvoor is uitgebreid. Browsertest:
blok overleeft een herlaad-simulatie, token is daarna weg.

## P1 · 'Jan' en 'jan' smolten in het seizoen samen | VERWERKT (minimale variant)

Bekend backlogpunt (seizoen sleutelt op `lower(trim(naam))`), maar duo's maken
het waarschijnlijker omdat één persoon beide namen intikt. De structurele fix
(stabiele seizoensdeelnemer-ID) blijft backlog; voor 12 september is de
invariant nu afgedwongen waar namen ontstaan: `w_join` weigert
case-insensitieve duplicaten binnen de wedstrijd (solo én duo, duo-namen ook
onderling: `duo_namen_gelijk`), en `w_wijzig_team` bewaakt hetzelfde bij een
naamswijziging. Servertests: alle randgevallen geven nette foutcodes.

## P2 · Exact gelijke duonamen gaven een ruwe databasefout | VERWERKT

Meegenomen in dezelfde validatie (`duo_namen_gelijk`, vertaald in FOUTEN).

## Wat de reviewer bevestigde

De serverkant van de races is coherent: alle keuze-, beheer- en
verwijderpaden vergrendelen dezelfde wedstrijdrij en worden geserialiseerd;
max_teams telt personen, de capaciteit telt loteenheden; koppel kan geen duo
worden; oude clients blijven werken.

## En passant

De tekst "Registreren kan vanaf de start" op Mijn deelname was dubbelzinnig
(Patrick las hem als aanmelden). Nu: "🎣 Vangsten doorgeven kan vanaf de start
van de wedstrijd (…). Tot die tijd hoef je niets te doen."
