# Status Codex-review v8 (verwerkt 18 jul 2026, v56)

Bron: `codex-review-v8-bevindingen.md` (totaalreview site + app + codecheck
v53-v55). Uitkomst: geen P0; twee P1's en twee P2's, alle vier verwerkt in
v56 (de structurele delen van de P1's staan als voorwaarden genoteerd).
Van de tien UX-aanbevelingen zijn er drie direct doorgevoerd, drie liggen
als keuze bij Patrick en vier staan op de backlog (app-werk).

## Bevindingen

### 1. P1 · Site belooft tenancy die nog niet af is | VERWERKT (copy) + VOORWAARDE

- Copy aangepast op de landing: "standaardkaart die direct werkt" is nu
  "dan richten we bij de start een standaardkaart met zones voor jullie
  in" (belofte = inrichten door ons, niet instant zelfbediening). De
  FAQ-prijstekst benoemt inrichting en ondersteuning als onderdeel.
- De structurele kant klopt en stond al in de planning: de VOLLEDIGE
  DB-tenancy-migratie (eigen org-wachtwoord, zones, stek_ring en
  instellingen per klant) is een harde voorwaarde voordat een tweede
  productieklant live gaat. Dat staat in CLAUDE.md en de projectmemory
  als eerste stap "bij eerste betalende klant"; deze review bevestigt dat.

### 2. P1 · Registratie bij slecht bereik | VERWERKT (client + copy), rest genoteerd

- **Idempotente retry zonder servermigratie**: het fotopad wordt nu per
  POGING vastgehouden (`VANGST_POGING`, sleutel = bestand + gewicht).
  Een retry na een netwerkfout uploadt naar hetzelfde pad (HTTP 409 van
  storage telt als "stond er al") en roept de RPC met hetzelfde
  `p_foto_path` aan, waardoor de bestaande server-idempotentie (unieke
  foto_path, Codex v2) een dubbele vangst herkent in plaats van een
  tweede rij te maken. Zelfde patroon voor de organisator-invoer
  (`BV_POGING`, inclusief team in de sleutel).
- **Herkenbare netwerkfout**: `foutTekst()` vertaalt fetch-/TypeError-
  fouten naar "Geen verbinding met de server. Controleer je bereik en
  probeer het opnieuw; je invoer blijft staan." Het formulier bewaarde
  gewicht en foto al bij een fout (reset gebeurt alleen bij succes).
- **Eerlijke copy**: de FAQ zegt nu dat klok en klassement doorlopen bij
  een onderbreking, maar dat registreren even verbinding nodig heeft en
  dat invoer blijft staan.
- **Genoteerd voor later** (server + client, aparte release): een
  client-gegenereerde submission_id met serverconstraint en een echte
  offline-outbox (IndexedDB met statussen). Dit vraagt een RPC-migratie
  en hoort bij de tenancy-/hardening-ronde voor de eerste betaalde klant.
- Kanttekening: registratie zonder foto door de organisator heeft geen
  idempotentie-anker; dat risico is klein (organisator, corrigeerbaar in
  Beheer) en gaat mee in de submission_id-ronde.

### 3. P2 · "Naar de app" op de generieke instructiepagina | VERWERKT

`docs/instructies.html`: de hoofdknop én de terugpijl linksboven gaan nu
naar `/inloggen/` (de organisatiekeuze). De tenant-varianten houden
`./`, want daar is dat al de juiste app-ingang.

### 4. P2 · Lightbox als echte modal | VERWERKT

- `#foto-groot` heeft nu `role="dialog"`, `aria-modal="true"` en een
  `aria-label` in beide tenants.
- Focuslus: zolang de lightbox open is onderschept Tab de focus en houdt
  hem op de sluitknop (het enige bedienbare element in de overlay), dus
  geen tabben naar bediening achter de overlay meer.
- `#toast` heeft `role="status"` + `aria-live="polite"`, zodat ook de
  foutmelding bij een mislukte afbeelding wordt uitgesproken.
- Native `<dialog>` is overwogen en bewust niet gedaan in deze ronde: de
  huidige overlay wordt door drie flows gedeeld en de div+aria-oplossing
  dekt de gemelde scenario's; genoteerd als nette refactor voor later.
- Getest in de preview: dialog-attributen, focus bij Tab, Escape, toast.

## Codecheck-notities uit de review

- Terecht: de v8-briefing verwisselde de commit-hashes van v54/v55
  (v54 = `8022dc4`, v55 = `e800215`). Alleen administratief; hierbij
  gecorrigeerd vastgelegd.
- De overige checks (geen conflicts lightbox/deel-overlay, scaffold-
  controles, versies, og.png) bevestigen v53-v55; geen actie nodig.

## UX-aanbevelingen: wat ermee gebeurd is

**Direct doorgevoerd (v56):**
- (4) Privacy-bewijsregel in de hero: "Geen deelnemersaccounts · geen
  vangstenlogboek · geen locatie-tracking".
- (7) "Vraag het prijzenblad aan"-knop met voorgevulde mail (onderwerp +
  vragen naar organisatie, water en deelnemersaantal) + benoemd welke twee
  onderdelen de prijs bepalen.
- (8) Mobiele hero compacter: de telefoon-mockup is op smalle schermen
  kleiner zodat de eerste inhoudssectie eerder in beeld komt.

**Keuze voor Patrick (merk/inhoud, niet zonder akkoord gewijzigd):**
- (1) Demo als primaire hero-knop in plaats van Inloggen.
- (3) Letterlijke NL-hoofdboodschap als H1, met "Loot. Vis. Win." als
  merkregel eronder.
- (5) NPHV als praktijkbewijs met naam/citaat: vraagt toestemming NPHV.
- (6) Sectie "Van waterkaart naar wedstrijddag": kan geschreven worden
  zodra Patrick de doorlooptijd/het serviceniveau bevestigt.

**Backlog (app-werk, aparte ronde):**
- (2) Eén-tik-demo's per rol (deelnemer auto-inloggen, organisator
  read-only rondleiding).
- (9) Overzicht/zoom-standen voor de kaart.
- (10) Tabbalk-herontwerp op smalle schermen + vaste "Vangst
  registreren"-hoofdactie tijdens een lopende wedstrijd.
