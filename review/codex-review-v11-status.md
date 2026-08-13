# Status Codex-review v11 (verwerkt 13 aug 2026, v66)

Bron: `codex-review-v11-codex.md` (diepe review van de hele app na v65) en
`codex-features-v11-codex.md` (featureadvies). Uitkomst review: 1 P0, 10 P1,
7 P2. Alle claims zijn eerst tegen de code geverifieerd; wat hieronder als
VERWERKT staat, is ook op de live database of in de browser getest.

Vier migraties, allemaal live:
`seizoen_tiebreak_alleen_getelde_wedstrijden`,
`codex_v11_levenscyclus_en_team_lock`,
`codex_v11_wachtwoordkruiscontrole_en_codeentropie`,
`codex_v11_pin_uit_gen_random_bytes`.

## P0 · Afgetrokken wedstrijden bepaalden alsnog de seizoenskampioen | VERWERKT

Geverifieerd en juist. In `w_seizoen_stand` waren `gewicht_geteld` en
`punten_totaal` netjes berekend met `filter (where not vervallen)`, maar de
TIEBREAKS gebruikten `gewicht_totaal` en `hoogste_dag`, en die tellen alle
wedstrijden mee. `seizoensklassement-ontwerp.md` punt 8 schrijft voor: totaal
vangstgewicht over de MEEGETELDE wedstrijden, daarna het hoogste vangstgewicht
in een wedstrijd (TTC 7.5, ONK).

Fix: nieuw veld `hoogste_dag_geteld` (met filter), en de rangschikking gebruikt
uitsluitend getelde waarden:

- totaalgewicht: `gewicht_geteld desc, hoogste_dag_geteld desc`
- plaatspunten: `punten_totaal asc, gewicht_geteld desc, hoogste_dag_geteld desc`

`gewicht_totaal` blijft in de uitvoer, want de app toont dat als informatieve
regel ("X gevangen").

Bewijs met synthetische data door beide rangschikkingen: A en B met gelijke
punten (6) en gelijk geteld gewicht (20 kg), waarbij A alleen in zijn
AFGETROKKEN wedstrijd 50 kg had tegen B 20 kg. Oud: A eerste, B tweede. Nieuw:
beiden plaats 1, wat de echte ex aequo is. De demo-seizoensstand (12
deelnemers, 3 wedstrijden) is voor en na de migratie identiek, dus geen
regressie op bestaande data.

## P1 · Bevroren scherm bij traag bereik | VERWERKT (bug van onszelf, v62)

Geverifieerd en het ergste van de hele ronde, want het treft precies het moment
waarop de app moet werken. `laadState` deed `const mijnReq = ++STATE_REQ;` bij
ELKE poll. Duurde een verzoek langer dan de pollinterval van 6 seconden, dan
had de volgende poll de teller al opgehoogd en verklaarde `verouderd()` het
antwoord ongeldig. Bij structureel trage verbinding gold dat voor elk antwoord
en bleef het scherm leeg, terwijl de app zelf niets fout leek te doen.

Fix in `docs/app.js`:

- `SESSIE_GEN` hoogt alleen op bij een ROUTEWISSEL (`route()`) en bij uitloggen
  (`wisOrgScherm`), niet per poll. De bescherming tegen een laat antwoord van
  een ander scherm blijft dus bestaan.
- `STATE_BEZIG`: loopt er al een verzoek, dan wordt de poll overgeslagen.
  De vlag wordt alleen vrijgegeven door de eigenaar van de huidige generatie,
  zodat een laat antwoord het lopende verzoek niet vrijgeeft.
- `rpc()` heeft een harde timeout van 20 seconden (AbortController). Zonder
  timeout kan een half werkende verbinding een verzoek minutenlang laten hangen
  en dan blijft `STATE_BEZIG` staan. Nieuwe foutcode `geen_verbinding`.
- `laadOrg` heeft nu dezelfde bescherming: een laat antwoord na uitloggen kan
  het organisatorscherm niet meer opnieuw vullen.

Bewezen met Chrome DevTools-netwerkemulatie (latency 8000 ms, dus hoger dan de
pollinterval), 45 seconden op `/demo/#/k/KIJKJE`:

| versie | uitkomst |
|---|---|
| v65 (oud) | `naam: ""`, `STATE: null` | scherm blijft leeg |
| v66 (nieuw) | `naam: "Voorjaarswedstrijd (demo)"`, 12 teams, 24 tabelrijen |

## P1 · Levenscyclus niet afgedwongen | VERWERKT, deels bewust anders

Geverifieerd. `w_registreer_vangst` controleerde tijd, code en token maar niet
de stand van de wedstrijd; `w_admin_reset_loting` kon ook draaien nadat er al
gevist was, waarna de plaatsingen verdwenen en de vangsten bleven staan.

Verwerkt, maar niet zo streng als voorgesteld:

- **Reset**: geweigerd zodra er een actieve vangst is
  (`reset_niet_mogelijk_vangsten`). De reviewer wilde "alleen vóór de
  starttijd". Bewust niet overgenomen: een organisator die zich vergist moet
  vlak na de start nog kunnen herstellen, en zolang er geen vangst is valt er
  niets aan de uitslag te bederven.
- **Vangst**: geweigerd als de status `stekkeuze` is en dit team nog geen stek
  of zone heeft (`kies_eerst_je_plek`). De reviewer wilde "alleen bij status
  klaar". Bewust niet overgenomen: een wedstrijd die nooit geloot wordt blijft
  op `aanmelden` staan en dat is een ONDERSTEUNDE werkwijze (de app heeft er
  sinds v59 een eigen fase-icoon voor: LIVE, nog niet geloot). De strenge
  variant zou informele wedstrijden breken.

Getest op de live database met een transactie die daarna is teruggedraaid:
reset op een wedstrijd met vangsten geeft `reset_niet_mogelijk_vangsten`, een
vangst van een team zonder plek tijdens `stekkeuze` geeft `kies_eerst_je_plek`,
en beide meldingen zijn in de app vertaald.

## P1 · Beheerders- en organisatorwachtwoord konden samenvallen | VERWERKT

Geverifieerd, en de bestaande check bleek achterhaald in plaats van afwezig:
`w_su_wachtwoord` vergeleek het nieuwe beheerderswachtwoord met
`instellingen.organisator_wachtwoord`, maar sinds de tenancy-migratie (juli)
staan de echte organisatorwachtwoorden per klant in `klant_instellingen`. De
check beschermde dus niets meer. `w_org_wachtwoord` controleerde helemaal niet
tegen het beheerderswachtwoord en vergrendelde de rij niet.

Fix: `w_su_wachtwoord` controleert nu tegen alle klanten, `w_org_wachtwoord`
tegen het beheerderswachtwoord en met `for update`. Getest in een transactie
met rollback: beide richtingen geven nu een nette fout, een normale wijziging
blijft toegestaan.

## P1 · Race bij team verwijderen | VERWERKT

Geverifieerd. `w_admin_verwijder_team` lockte de wedstrijdrij, niet de teamrij,
dus een vangst die tussen de controle en de delete binnenkwam verdween alsnog
via de cascade. Nu wordt de teamrij eerst met `for update` gepakt; dat botst
met de `for key share`-lock die een vangst-insert op de parent neemt, dus de
delete wacht netjes.

## P1 · Eén globale stekring voor alle tenants | BEVESTIGD, staat op de backlog

Geverifieerd en juist: `wedstrijd.stek_ring` heeft geen `klant_id`, terwijl de
kaart per tenant is. Dit is de bekende harde blokkade voor klant 2 (staat al in
CLAUDE.md en in de projectmemory). Niet in deze ronde opgelost: het is een
datamodelwijziging met migratie van bestaande wedstrijden, geen reparatie.
Codex noemt hetzelfde punt in zijn featureadvies als voorstel 2.

## P1 · Registratietijd is niet de vangsttijd | NIET NU

Feitelijk juist: de ex-aequoregel "grootste vis" gebruikt `created_at`, en dat
is het moment waarop de registratie de server bereikt. Bij slecht bereik kan
dat later zijn dan de vangst. Een apart veld `gevangen_op` is echter alleen
zinvol samen met de offline wachtrij (featurevoorstel 3): zolang de app pas
registreert als er verbinding is, is er geen betrouwbaarder tijdstip
beschikbaar. Genoteerd als onderdeel van dat werk.

Het tweede deel van deze bevinding (de organisator kan de tijden zo wijzigen
dat bestaande vangsten buiten het venster vallen) blijft open op de backlog.

## P1 · Koppelcapaciteit kan fragmenteren | VERLAAGD NAAR BACKLOG

Analyse is technisch juist: `max_koppels()` telt de paren die er BIJ AANVANG
zijn, maar geldige losse keuzes kunnen de ring zo versnipperen dat het laatste
koppel geen aangrenzend paar meer vindt. In de praktijk speelt dat pas bij
vrijwel exact 47 koppels, dus 94 vissers op één plas. Verlaagd naar P2 en op de
backlog gezet; de nette oplossing (matching-simulatie bij elke keuze, of vooraf
paren reserveren) is te veel werk voor dit risico.

## P1 · Kijkcode geeft meer terug dan het klassement | ONTWERPKEUZE, vastgelegd

Feitelijk juist: `w_get_state_kijker` levert team-ID's, lotnummers, stekken en
alle vangsten met fotopad, terwijl de kijkersinterface alleen klassement en
seizoen toont. Geen lek in de zin van gevoelige gegevens: dit is precies wat op
de wedstrijddag aan het water openbaar is, en de kijkcode wordt door de
organisator zelf gedeeld. Bewust zo gelaten, nu expliciet vastgelegd in
CLAUDE.md bij de rolomschrijving zodat het een keuze is en geen toeval.

## P1 · `database.sql` is geen reproduceerbare herstelbron | DEELS VERWERKT

Terecht punt over de KOP: die claimde herstelbron te zijn en noemde nog
"8 jul 2026, app v22" terwijl het bestand sindsdien bij elke migratie is
bijgewerkt. De kop zegt nu eerlijk wat het bestand is (reviewbron, effectieve
functiedefinities) en wat het niet is (nooit tegen een lege database gedraaid).
Een echte, uitvoerbare schema-export met CI eromheen is een apart klusje en
staat op de backlog; met één ontwikkelaar en een gehoste database is de
migratiegeschiedenis van Supabase vandaag de werkelijke herstelbron.

## P2 · Deelafbeelding kon een andere winnaar noemen dan de tab | VERWERKT

Geverifieerd. De tab "Grootste vis" sorteert op gewicht en dan op vangsttijd;
de deelafbeelding reduceerde de op TOTAALgewicht gesorteerde lijst met
`>` en hield bij exact gelijk gewicht dus de eerste uit die lijst. Nu gebruiken
beide `klGrootsteEerst` / `klGrootsteWinnaar`.

## P2 · Uploadcredential volgde niet de actieve rol | VERWERKT

Geverifieerd. `uploadFoto` koos altijd eerst een aanwezig teamtoken, ook als de
organisator via Beheer een vangst toevoegde. Op een toestel waarop ooit als
deelnemer is meegedaan, ging de upload dan met een (mogelijk verlopen) token
in plaats van de geldige pin. Nu bepaalt `ROL` de credential.

## P2 · Beheerscherm meldde ten onrechte "alle omgevingen" | VERWERKT

Geverifieerd. Bevestigingsknop en toast zeiden dat het organisatiewachtwoord
voor ALLE omgevingen werd gewijzigd, terwijl de aanroep `p_klant` meestuurt en
alleen die klant raakt. Beide teksten noemen nu de klantnaam. Dit is de soort
fout die bij een beveiligingsincident echt kwaad kan: je denkt dat je alles
hebt geroteerd.

## P2 · Overig | BACKLOG

- **Foto zonder databaseverwijzing**: een geldig teamtoken mag ook na afloop
  nog uploaden; mislukt de registratie daarna, dan blijft er een weesbestand
  achter. Hangt samen met de foto-opruiming boven 1000 bestanden (al op de
  backlog).
- **Service worker wacht onbeperkt op een hangende verbinding**: de RPC-timeout
  hierboven dekt de datakant; voor de shell zelf staat een korte timeout of
  stale-while-revalidate op de backlog.
- **Toegankelijkheid**: de foto-input staat op `display: none` en de stekken op
  de SVG-kaart hebben geen `tabindex` of toetsenbordhandler. Meegenomen in de
  visuele ronde.
- **Tijdzone**: `datetime-local` wordt in de zone van het TOESTEL uitgelegd. Bij
  één Nederlandse klant met Nederlandse organisatoren geen praktijkprobleem;
  een tenant-tijdzone is de nette oplossing en staat op de backlog.

## Eigen bevindingen naast de review

- **Codes en pins kwamen uit `random()`** in plaats van `gen_random_bytes`.
  Voor iets dat als sleutel dient hoort dat cryptografisch te zijn. Verwerkt:
  `wedstrijd.nieuwe_team_code()` haalt 6 bytes op (256 is deelbaar door 32, dus
  modulo 32 geeft geen bias) en de nieuwe `wedstrijd.nieuwe_pin()` doet
  hetzelfde voor de drie cijfers. Vorm van codes en pins is ongewijzigd, dus
  bestaande codes en de UI blijven werken. Getest met 200 codes: allemaal
  uniek, correct formaat, alle 32 tekens komen voor.
  `order by random()` in de LOTING blijft staan: dat is eerlijkheid, geen
  sleutelmateriaal, en niet te sturen zonder databasetoegang.
- **`w_login_deelnemer` zoekt globaal** op deelnemerscode over alle klanten
  heen en geeft direct het teamtoken terug, zonder rate-limiting. Zes tekens
  uit 32 is ruim een miljard mogelijkheden, dus vandaag geen praktijkrisico,
  maar het wordt zwakker naarmate er klanten bij komen. Op de backlog samen met
  de al genoteerde rate-limit op de login-RPC's.
- **Er staat geen enkele test en geen CI in deze repo.** Dat is het
  structurele punt achter de P0 hierboven: een test van tien regels op de
  seizoensberekening had die fout gevangen. Voor een product waarvan de uitslag
  het bestaansrecht is, is dit het grootste gat. Voorstel voor een volgende
  ronde: een klein SQL-testscript dat de seizoens- en klassementsregels tegen
  vaste synthetische data draait, plus een GitHub Action die het bij elke push
  uitvoert.

## Werkfout van mijzelf tijdens deze ronde

Bij het testen van de nieuwe reset-controle heb ik `w_admin_reset_loting` ook
op 499QWP aangeroepen om te zien dat een reset ZONDER vangsten nog wordt
toegestaan. Die wedstrijd heeft geen vangsten, dus de reset werd uitgevoerd:
lotnummers, stekken en zones leeg, status terug naar `aanmelden`. Direct
hersteld uit de waarden die eerder in dezelfde sessie waren uitgelezen (6 teams,
lot 1 t/m 6, stekken 55 / 24+26 / 27 / 37 / 47 / 58, zones E, R, B, C, D, N,
status `klaar`) en geverifieerd. Les: schrijvende RPC's nooit "even" testen op
productiedata, ook niet als de verwachte uitkomst onschuldig lijkt. Testen die
schrijven horen in een transactie met rollback, zoals de andere controles in
deze ronde.
