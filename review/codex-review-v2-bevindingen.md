# Codex-review v2: bevindingen en voorstellen

Dit document hoort bij `chatgpt-review-v2.md` en vat de review van de v21-code samen. Het doel is dat Claude Code de punten hieronder direct kan omzetten naar fixes of migraties.

## Samenvatting

De frontend is duidelijk verder gehard sinds de vorige ronde: directe token-scrub, foto-fallback, org-pin cleanup, versiecheck, beheer-polling-preservation en placeholders voor vangsten zonder foto zijn goede verbeteringen.

De belangrijkste risico's zitten nu in twee plekken:

- de SQL-bundel `review/database.sql` lijkt niet synchroon met de v21-frontend
- team verwijderen kan vangsten hard uit de database verwijderen door cascade

Als live Supabase wel nieuwere functies heeft dan `database.sql`, is het alsnog belangrijk om dit bestand bij te werken. Dit bestand is namelijk de review-, herstel- en migratiebron.

## P0

### 1. Frontend en SQL-bundel zijn niet consistent

**Bestanden**

- `docs/app.js`, rond regels 435, 1007 en 1299
- `review/database.sql`, rond regels 320, 345 en 660

**Probleem**

De frontend gebruikt functies en parameters die in `review/database.sql` niet als effectieve laatste definities terugkomen:

- `w_maak_wedstrijd` krijgt vanuit de frontend `p_max_teams` en `p_regels`
- `w_admin_regels` wordt aangeroepen vanuit Beheer
- `w_push_subscribe` krijgt `p_route`
- `w_get_state`, `w_get_state_kijker` en `w_org_wedstrijden` moeten `max_teams` en `regels` teruggeven, maar de zichtbare definities doen dat niet
- `push_subs.route` wordt verwacht door `push-vangst.ts`, maar de tabeldefinitie heeft die kolom niet

In `database.sql` staan wel changelog-commentaren die zeggen dat dit is aangepast, maar de bijbehorende `create or replace function` definities ontbreken of zijn oud.

**Reproductiescenario**

Gebruik een database die vanuit deze SQL-bundel is opgebouwd of hersteld. Daarna:

1. Log in als organisator.
2. Maak een nieuwe wedstrijd aan met maximum en regels.
3. Zet pushmeldingen aan.
4. Probeer regels in Beheer op te slaan.

De kans is groot dat PostgREST faalt met ontbrekende parameters, ontbrekende functie of ontbrekende kolom.

**Voorstel**

Werk `review/database.sql` bij met de echte v21-definities:

- `alter table wedstrijd.wedstrijden add column regels text`
- `alter table wedstrijd.push_subs add column route text`
- actuele `w_maak_wedstrijd(p_naam, p_mode, p_start, p_eind, p_org_wachtwoord, p_max_teams, p_regels)`
- actuele `w_get_state` en `w_get_state_kijker` met `max_teams` en `regels`
- actuele `w_org_wedstrijden` met `max_teams`
- nieuwe `w_admin_regels`
- actuele `w_push_subscribe` met `p_route`
- actuele `w_push_payload` die `route` per subscription teruggeeft

Als live Supabase al klopt, exporteer of kopieer de live definities alsnog naar deze bundel.

### 2. Changelog claimt fixes die niet effectief in de SQL staan

**Bestand**

- `review/database.sql`, rond regels 729 tot 736

**Probleem**

Het commentaar zegt dat review-fixes zijn doorgevoerd:

- `w_admin_reset_loting` wist `teams.zone`
- muterende RPC's locken de wedstrijd-rij met `FOR UPDATE`
- `w_start_stekkeuze` doet capaciteitschecks
- codes zijn hard uniek over beide kolommen
- `w_push_subscribe` valideert keys strenger en slaat routes op

Maar de effectieve definities in hetzelfde bestand laten meerdere oude paden zien:

- `w_admin_reset_loting` wist `zone` niet
- `w_start_stekkeuze` heeft geen `FOR UPDATE` en geen capaciteitscheck
- `w_kies_zone` haalt de wedstrijd zonder `FOR UPDATE`
- `w_push_subscribe` heeft geen strenge keyvalidatie en geen route

**Reproductiescenario**

Voer deze SQL-bundel uit op een lege database en draai daarna een zonewedstrijd:

1. Start loting.
2. Laat een team een zone kiezen.
3. Reset de loting.
4. Start opnieuw.

De oude `zone` blijft staan en kan de nieuwe keuze blokkeren.

**Voorstel**

Maak de bundel zelf consistent. Voeg volledige, effectieve definities toe voor alle geclaimde fixes. Gebruik commentaar alleen als toelichting, niet als vervanging van migratiecode.

### 3. Team verwijderen kan vangsten hard verwijderen

**Bestanden**

- `review/database.sql`, `vangsten.team_id`, rond regel 45
- `review/database.sql`, `w_admin_verwijder_team`, rond regel 1042
- `docs/app.js`, beheerknop team verwijderen, rond regel 1451

**Probleem**

`vangsten.team_id` heeft `references wedstrijd.teams(id) on delete cascade`. De nieuwe `w_admin_verwijder_team` werkt in elke fase. Daardoor verwijdert een team-delete ook alle vangsten van dat team hard uit de database.

Dat botst met het auditmodel voor vangsten, waar losse vangsten juist status `verwijderd` krijgen in plaats van echt verwijderd te worden.

**Reproductiescenario**

1. Laat team A een vangst registreren.
2. Open Beheer.
3. Verwijder team A met de knop in de deelnemerslijst.
4. De teamrij verdwijnt, maar ook alle vangsten van dat team verdwijnen door cascade.

Een foutieve klik na of tijdens de wedstrijd leidt dan tot dataverlies.

**Voorstel**

Kies een van deze veilige varianten:

- blokkeer `w_admin_verwijder_team` zodra het team vangsten heeft
- voeg `teams.status` toe en soft-delete teams
- wijzig de FK zodat vangsten niet hard cascaden bij team-delete
- maak aparte RPC's: `w_admin_verwijder_team_aanmelding` voor aanmeldfase en `w_admin_diskwalificeer_team` voor latere fases

Minimale fix voor de wedstrijddag:

```sql
if exists (select 1 from wedstrijd.vangsten where team_id = p_team_id) then
  raise exception 'team_heeft_vangsten';
end if;
```

## P1

### 4. Idempotentie op `foto_path` checkt niet hetzelfde team en gewicht

**Bestand**

- `review/database.sql`, `w_registreer_vangst`, rond regels 934 tot 963

**Probleem**

Bij `unique_violation` op `foto_path` doet de functie:

```sql
select id into v_id from wedstrijd.vangsten where foto_path = p_foto_path;
return json_build_object('id', v_id, 'dubbel', true);
```

Er wordt niet gecontroleerd of de bestaande vangst bij dezelfde wedstrijd, hetzelfde team, hetzelfde gewicht en status `actief` hoort.

**Reproductiescenario**

Een client of directe RPC hergebruikt een bestaande publieke `foto_path` met een ander gewicht of ander team-token binnen dezelfde wedstrijd. De RPC geeft dan alsnog `{dubbel:true}` terug alsof het een normale retry was.

De storagepaden zijn uuid's, dus dit is geen eenvoudig publiek lek, maar binnen het model is de idempotentie te ruim.

**Voorstel**

Maak het conflictpad strenger:

```sql
select id into v_id
from wedstrijd.vangsten
where foto_path = p_foto_path
  and wedstrijd_id = v_w.id
  and team_id = v_team.id
  and gewicht_gram = p_gewicht_gram
  and status = 'actief';

if not found then
  raise exception 'foto_al_gebruikt';
end if;

return json_build_object('id', v_id, 'dubbel', true);
```

### 5. Foto-delete helper ontbreekt in de SQL-bundel

**Bestand**

- `review/database.sql`, `w_org_verwijder_wedstrijd`, rond regels 868 tot 888

**Probleem**

`w_org_verwijder_wedstrijd` roept `extensions.http_wis_fotos(v_paths)` aan. In `database.sql` staat alleen commentaar dat deze helper bestaat. De daadwerkelijke definitie ontbreekt.

**Reproductiescenario**

Een database die uit deze bundel is opgebouwd krijgt `w_org_verwijder_wedstrijd`, maar niet `extensions.http_wis_fotos`. Bij verwijderen wordt de exception geslikt en de wedstrijd wordt wel uit de database verwijderd. Foto's blijven dan in Storage staan.

**Voorstel**

Voeg de helper volledig toe, vergelijkbaar met `extensions.http_post_ignore`:

```sql
create or replace function extensions.http_wis_fotos(p_paths jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_secret text;
begin
  select push_secret into v_secret from wedstrijd.instellingen where id = 1;
  perform net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/wis-fotos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('paths', p_paths)
  );
end $$;
```

Laat de RPC eventueel teruggeven of de cleanup-call daadwerkelijk is aangeroepen.

### 6. `w_admin_kies` en deelnemerkeuze moeten dezelfde lock gebruiken

**Bestanden**

- `review/database.sql`, `w_admin_kies`, rond regels 991 tot 1040
- `review/database.sql`, oude `w_kies_zone`, rond regels 503 tot 515

**Probleem**

`w_admin_kies` lockt de wedstrijd-rij met `FOR UPDATE`. In de effectieve oude definitie van `w_kies_zone` in dit bestand gebeurt dat niet. Daardoor is het serialisatiemodel afhankelijk van welke definitie live staat.

**Reproductiescenario**

1. Deelnemer is aan de beurt en selecteert zone A.
2. Organisator gebruikt tegelijk "geef plek" en wijst zone A toe aan een afwezig team.
3. Zonder gedeelde lock kunnen beide transacties de zone als vrij zien.

**Voorstel**

Zorg dat alle keuze-RPC's dezelfde wedstrijd-lock pakken:

- `w_kies_stek`
- `w_kies_zone`
- `w_admin_kies`
- `w_admin_reset_loting`
- `w_start_stekkeuze`

Overweeg daarnaast echte databaseconstraints of een genormaliseerde `team_stekken` tabel als extra vangnet.

## P2

### 7. Pushklik focust bestaand venster maar navigeert niet naar route

**Bestand**

- `docs/sw.js`, rond regels 49 tot 55

**Probleem**

Bij notification click wordt het eerste bestaande venster gefocust. Als dat venster op de homepagina of een andere wedstrijd staat, navigeert de service worker niet naar de route uit de pushdata.

**Reproductiescenario**

1. Zet push aan voor wedstrijd X.
2. Laat de app openstaan op home of wedstrijd Y.
3. Klik op een pushmelding voor X.
4. Het bestaande venster krijgt focus, maar blijft op de oude route.

**Voorstel**

Als `route` bestaat, navigeer een bestaand venster eerst:

```js
for (const c of lijst) {
  if ('navigate' in c && route) {
    await c.navigate('./' + route);
    return c.focus();
  }
  if ('focus' in c) return c.focus();
}
return self.clients.openWindow(route ? './' + route : '.');
```

### 8. Foto-cleanup accepteert andere paden dan de database

**Bestanden**

- `review/wis-fotos.ts`, rond regel 8
- `review/database.sql`, `w_registreer_vangst` en `w_admin_voeg_vangst`

**Probleem**

De edge function verwijdert alleen paden die matchen op:

```ts
^[A-Za-z0-9]+\/[A-Za-z0-9-]+\.(jpe?g|png|webp|gif|heic)$
```

De database accepteert veel ruimer: alleen wedstrijdcode-prefix en lengte. Daardoor kan een geldig opgeslagen `foto_path` later niet door `wis-fotos` worden verwijderd.

**Reproductiescenario**

Een directe RPC of toekomstige client uploadt een pad dat wel door de DB-validatie komt maar niet door `PAD_OK`. Bij wedstrijd verwijderen blijft die foto staan.

**Voorstel**

Trek de validatie gelijk:

- maak DB-validatie even strikt als `PAD_OK`
- of laat `wis-fotos` exact de door de DB opgeslagen paden accepteren, zolang ze binnen bucket en wedstrijd-prefix vallen

### 9. CSP mist nog twee zinvolle directives

**Bestand**

- `docs/index.html`, rond regel 8

**Probleem**

De CSP is bruikbaar en lijkt de huidige app niet te breken. Wel ontbreken twee simpele hardening-directives:

- `object-src 'none'`
- `frame-ancestors 'none'`

**Voorstel**

Breid de CSP uit:

```html
object-src 'none'; frame-ancestors 'none'
```

### 10. Klassement-opbouw labelt aantal resterende vissen als kilo's

**Bestand**

- `docs/app.js`, functie `renderKlassement`, rond regels 893 tot 907

**Probleem**

Bij meer dan 10 vissen wordt de opbouw afgekapt met:

```js
+ nog ${alle.length - 10} kg
```

Maar `${alle.length - 10}` is het aantal resterende vissen, niet gewicht.

**Reproductiescenario**

Een team heeft 13 vangsten. De opbouw toont `+ nog 3 kg`, terwijl het eigenlijk `+ nog 3 vissen` moet zijn.

**Voorstel**

Wijzig naar:

```js
`+ nog ${alle.length - 10} vissen`
```

Of tel het resterende gewicht echt op en toon dat als kilo's.

### 11. Push wordt onderdrukt als een willekeurig appvenster zichtbaar is

**Bestand**

- `docs/sw.js`, rond regels 35 tot 37

**Probleem**

De service worker toont geen pushmelding als er een zichtbaar appvenster is. Dat venster kan ook op home of op een andere wedstrijd staan.

**Reproductiescenario**

Gebruiker heeft de app zichtbaar open op de homepagina. Een vangst in een gevolgde wedstrijd komt binnen. De pushmelding wordt onderdrukt, terwijl de in-app toast mogelijk niet de juiste context heeft.

**Voorstel**

Onderdruk alleen als het zichtbare venster dezelfde route of wedstrijdcode heeft. Anders gewoon de notificatie tonen.

## Expliciet gecontroleerd en goedgekeurd

- De meeste XSS-paden zijn goed afgedekt: namen, teamnamen, regels, zones en foutmeldingen gaan via `esc()` of `textContent`.
- `w_admin_kies`, `w_admin_voeg_vangst`, `w_admin_wedstrijd` en `w_org_verwijder_wedstrijd` vragen in de getoonde definities een admin pin of organisatie-wachtwoord.
- `w_login_deelnemer` geeft token alleen terug op basis van een persoonlijke deelnemercode. Binnen het gekozen bearer-code-model is dat consistent.
- Foto-compressie heeft nu een fallback via `Image`.
- Teamlink-token wordt direct uit de adresbalk gehaald.
- Organisatie-uitloggen wist nu ook `pin:` keys uit `sessionStorage`.
- De service worker gebruikt network-first en sluit `version.json` uit van cache.
- De CSP staat externe scripts niet toe en beperkt connect/img tot de eigen site en het Supabase-project.
- `push-vangst.ts` verstuurt inmiddels in batches met `Promise.allSettled`.
- De vaste zonekaartlaag wordt alleen getoond als wedstrijd-zones exact overeenkomen met `ZONE_STANDAARD`.

## Aanbevolen volgorde

1. Maak `review/database.sql` eerst synchroon met live v21 en voeg ontbrekende functies/kolommen toe.
2. Fix team-delete zodat vangsten niet hard verdwijnen.
3. Maak idempotentie op `foto_path` strenger.
4. Trek foto-path-validatie tussen DB en `wis-fotos.ts` gelijk.
5. Pak de P2 UI- en service-workerpunten mee zodra de wedstrijddag-risico's dicht zijn.
