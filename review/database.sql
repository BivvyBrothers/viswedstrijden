-- =====================================================================
-- Viswedstrijden Plas van der Ende: database-export (schema `wedstrijd`)
-- VERS GEGENEREERD uit de live Supabase-database op 8 jul 2026 (app v22,
-- na migratie wedstrijd_codex_v2_fixes). Dit bestand is de review-,
-- herstel- en migratiebron: alle definities hieronder zijn de EFFECTIEVE
-- live definities (pg_get_functiondef), geen changelog-lagen meer.
--
-- Secrets (organisatie-wachtwoord, VAPID private key, push_secret) staan
-- als rijdata in wedstrijd.instellingen en horen NIET in dit bestand.
--
-- API-model: RLS aan zonder policies; alle toegang via SECURITY DEFINER
-- RPC's w_* in public met set search_path = ''. Advisor-warnings
-- "security definer callable by anon" zijn by design.
-- =====================================================================

create schema if not exists wedstrijd;

-- =====================================================================
-- Tabellen
-- =====================================================================

create table wedstrijd.instellingen (
  id int primary key check (id = 1),
  organisator_wachtwoord text not null,
  vapid_public text,
  vapid_private text,
  push_secret text,
  push_contact text not null default 'mailto:patrick@kemblinck.nl',
  standaard_zones jsonb,
  alleen_lezen boolean not null default false  -- abonnement verlopen: geen nieuwe wedstrijden (migratie wedstrijd_alleen_lezen)
);

create table wedstrijd.wedstrijden (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  naam text not null,
  mode text not null default 'individueel' check (mode in ('individueel','koppel')),
  start_ts timestamptz not null,
  eind_ts timestamptz not null,
  status text not null default 'aanmelden' check (status in ('aanmelden','stekkeuze','klaar')),
  admin_pin text not null,
  created_at timestamptz not null default now(),
  zones jsonb,
  kijk_code text not null unique,
  max_teams int check (max_teams >= 2 and max_teams <= 200),
  regels text check (length(regels) <= 3000),
  check (eind_ts > start_ts),
  constraint codes_verschillend check (code <> kijk_code)
);

create table wedstrijd.teams (
  id uuid primary key default gen_random_uuid(),
  wedstrijd_id uuid not null references wedstrijd.wedstrijden(id) on delete cascade,
  naam text not null,
  naam2 text,
  token uuid not null default gen_random_uuid(),
  lot_nummer int,
  stekken int[] not null default '{}',
  created_at timestamptz not null default now(),
  team_naam text,
  zone text,
  deelnemer_code text not null unique,
  unique (wedstrijd_id, naam)
);
create index teams_wedstrijd_idx on wedstrijd.teams (wedstrijd_id);

create table wedstrijd.vangsten (
  id uuid primary key default gen_random_uuid(),
  wedstrijd_id uuid not null references wedstrijd.wedstrijden(id) on delete cascade,
  team_id uuid not null references wedstrijd.teams(id) on delete cascade,
  gewicht_gram int not null check (gewicht_gram >= 50 and gewicht_gram <= 50000),
  foto_path text,                     -- NULL = handmatig ingevoerd door organisator
  status text not null default 'actief' check (status in ('actief','verwijderd')),
  created_at timestamptz not null default now()
);
create index vangsten_wedstrijd_idx on wedstrijd.vangsten (wedstrijd_id, status);
-- idempotente registratie: zelfde foto kan maar bij 1 vangst horen
create unique index vangsten_foto_uniek on wedstrijd.vangsten (foto_path) where foto_path is not null;
-- NB: team-delete casceert vangsten; daarom blokkeert w_admin_verwijder_team
-- zodra het team vangsten heeft (audit-model: vangsten soft-deleten).

create table wedstrijd.push_subs (
  id uuid primary key default gen_random_uuid(),
  wedstrijd_id uuid not null references wedstrijd.wedstrijden(id) on delete cascade,
  team_id uuid references wedstrijd.teams(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  route text                          -- '#/w/CODE' of '#/k/CODE' voor notificatieklik
);
create index push_subs_wedstrijd_idx on wedstrijd.push_subs (wedstrijd_id);

create table wedstrijd.stek_ring (
  positie int primary key,
  stek int not null unique
);
-- fysieke volgorde rond de plas (zelfde als STEK_POSITIE in docs/kaart.js):
-- oneven 1..99, dan even 100 terug naar 54, dan 52 terug naar 20, gat, dan bank 10,8,6,4,2.
-- Bewust: 52-54 (over de duiker) geldt als aangrenzend; gaten tussen 10-20 en 2-1.
do $$
declare pos int := 0; s int;
begin
  for s in select generate_series(1, 99, 2) loop
    pos := pos + 1; insert into wedstrijd.stek_ring values (pos, s);
  end loop;
  for s in select generate_series(100, 54, -2) loop
    pos := pos + 1; insert into wedstrijd.stek_ring values (pos, s);
  end loop;
  for s in select generate_series(52, 20, -2) loop
    pos := pos + 1; insert into wedstrijd.stek_ring values (pos, s);
  end loop;
  pos := pos + 1; -- gat: zuidwest-oever zonder stekken
  foreach s in array array[10,8,6,4,2] loop
    pos := pos + 1; insert into wedstrijd.stek_ring values (pos, s);
  end loop;
end $$;
-- stekken 12/14/16/18 bestaan niet (13/15/17 wel), conform de NPHV-kaart

-- RLS aan zonder policies: tabellen zijn alleen via de RPC's bereikbaar
alter table wedstrijd.instellingen enable row level security;
alter table wedstrijd.wedstrijden enable row level security;
alter table wedstrijd.teams enable row level security;
alter table wedstrijd.vangsten enable row level security;
alter table wedstrijd.push_subs enable row level security;
alter table wedstrijd.stek_ring enable row level security;

-- Storage: publieke bucket 'wedstrijd-fotos' (public read, geen listing;
-- upload met anon key; paden 'CODE/uuid.jpg'; max 5MB, alleen afbeeldingen).

-- =====================================================================
-- Hulpfuncties (schema wedstrijd + extensions)
-- =====================================================================

CREATE OR REPLACE FUNCTION wedstrijd.nieuwe_team_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random()*32)::int, 1);
    end loop;
    exit when not exists (select 1 from wedstrijd.wedstrijden where code = v_code or kijk_code = v_code)
      and not exists (select 1 from wedstrijd.teams where deelnemer_code = v_code);
  end loop;
  return v_code;
end $function$;

CREATE OR REPLACE FUNCTION wedstrijd.nieuwe_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  return wedstrijd.nieuwe_team_code();
end $function$;

CREATE OR REPLACE FUNCTION wedstrijd.valideer_zones(p_zones jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  z jsonb;
  alle int[] := '{}';
  namen text[] := '{}';
  v_naam text;
  v_stekken int[];
begin
  if jsonb_typeof(p_zones) <> 'array' or jsonb_array_length(p_zones) > 60 then
    raise exception 'ongeldige_zones';
  end if;
  for z in select * from jsonb_array_elements(p_zones) loop
    v_naam := trim(z->>'naam');
    if v_naam is null or v_naam = '' or length(v_naam) > 20 then raise exception 'ongeldige_zones'; end if;
    if lower(v_naam) = any(namen) then raise exception 'zone_naam_dubbel'; end if;
    namen := namen || lower(v_naam);
    select coalesce(array_agg(distinct s::int), '{}') into v_stekken
    from jsonb_array_elements_text(z->'stekken') s;
    if cardinality(v_stekken) = 0 then raise exception 'ongeldige_zones'; end if;
    if exists (select 1 from unnest(v_stekken) s where s not in (select stek from wedstrijd.stek_ring)) then
      raise exception 'onbekende_stek';
    end if;
    if alle && v_stekken then raise exception 'stek_in_meerdere_zones'; end if;
    alle := alle || v_stekken;
  end loop;
end $function$;

-- fire-and-forget webpush via pg_net (aangeroepen vanuit vangst-RPC's)
CREATE OR REPLACE FUNCTION extensions.http_post_ignore(p_wedstrijd_id uuid, p_team_id uuid, p_titel text, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_secret text;
begin
  select push_secret into v_secret from wedstrijd.instellingen where id = 1;
  perform net.http_post(
    url := 'https://xyfvkmhkwcjqskxrcfrj.supabase.co/functions/v1/push-vangst',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object(
      'wedstrijd_id', p_wedstrijd_id,
      'team_id', p_team_id,
      'titel', p_titel,
      'body', p_body
    )
  );
end $function$;

-- fire-and-forget foto-cleanup via edge function wis-fotos (zie review/wis-fotos.ts)
CREATE OR REPLACE FUNCTION extensions.http_wis_fotos(p_paths jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_secret text;
begin
  select push_secret into v_secret from wedstrijd.instellingen where id = 1;
  perform net.http_post(
    url := 'https://xyfvkmhkwcjqskxrcfrj.supabase.co/functions/v1/wis-fotos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object('paths', p_paths)
  );
end $function$;

-- =====================================================================
-- Publieke RPC's: state en deelname
-- =====================================================================

CREATE OR REPLACE FUNCTION public.w_get_state(p_code text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object(
    'wedstrijd', (select json_build_object(
        'code', w.code, 'kijk_code', w.kijk_code, 'naam', w.naam, 'mode', w.mode,
        'start_ts', w.start_ts, 'eind_ts', w.eind_ts, 'status', w.status,
        'zones', w.zones, 'max_teams', w.max_teams, 'regels', w.regels)
      from wedstrijd.wedstrijden w where w.code = upper(trim(p_code))),
    'teams', coalesce((select json_agg(json_build_object(
        'id', t.id, 'naam', t.naam, 'naam2', t.naam2, 'team_naam', t.team_naam,
        'lot_nummer', t.lot_nummer, 'stekken', t.stekken, 'zone', t.zone)
        order by t.lot_nummer nulls last, t.created_at)
      from wedstrijd.teams t
      join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
      where w.code = upper(trim(p_code))), '[]'::json),
    'vangsten', coalesce((select json_agg(json_build_object(
        'id', v.id, 'team_id', v.team_id, 'gewicht_gram', v.gewicht_gram,
        'foto_path', v.foto_path, 'created_at', v.created_at)
        order by v.created_at desc)
      from wedstrijd.vangsten v
      join wedstrijd.wedstrijden w on w.id = v.wedstrijd_id
      where w.code = upper(trim(p_code)) and v.status = 'actief'), '[]'::json),
    'server_now', now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.w_get_state_kijker(p_kijk_code text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object(
    'wedstrijd', (select json_build_object(
        'kijk_code', w.kijk_code, 'naam', w.naam, 'mode', w.mode,
        'start_ts', w.start_ts, 'eind_ts', w.eind_ts, 'status', w.status,
        'max_teams', w.max_teams, 'regels', w.regels)
      from wedstrijd.wedstrijden w where w.kijk_code = upper(trim(p_kijk_code))),
    'teams', coalesce((select json_agg(json_build_object(
        'id', t.id, 'naam', t.naam, 'naam2', t.naam2, 'team_naam', t.team_naam,
        'lot_nummer', t.lot_nummer, 'stekken', t.stekken, 'zone', t.zone)
        order by t.lot_nummer nulls last, t.created_at)
      from wedstrijd.teams t
      join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
      where w.kijk_code = upper(trim(p_kijk_code))), '[]'::json),
    'vangsten', coalesce((select json_agg(json_build_object(
        'id', v.id, 'team_id', v.team_id, 'gewicht_gram', v.gewicht_gram,
        'foto_path', v.foto_path, 'created_at', v.created_at)
        order by v.created_at desc)
      from wedstrijd.vangsten v
      join wedstrijd.wedstrijden w on w.id = v.wedstrijd_id
      where w.kijk_code = upper(trim(p_kijk_code)) and v.status = 'actief'), '[]'::json),
    'server_now', now()
  );
$function$;

CREATE OR REPLACE FUNCTION public.w_join(p_code text, p_naam text, p_naam2 text DEFAULT NULL::text, p_team_naam text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) for update;
  if not found then raise exception 'wedstrijd_niet_gevonden'; end if;
  if v_w.status <> 'aanmelden' then raise exception 'aanmelden_gesloten'; end if;
  if v_w.max_teams is not null and
     (select count(*) from wedstrijd.teams where wedstrijd_id = v_w.id) >= v_w.max_teams then
    raise exception 'wedstrijd_vol';
  end if;
  if coalesce(trim(p_naam),'') = '' or length(p_naam) > 40 then raise exception 'ongeldige_naam'; end if;
  if v_w.mode = 'koppel' and (coalesce(trim(p_naam2),'') = '' or length(p_naam2) > 40) then
    raise exception 'tweede_naam_verplicht';
  end if;
  if p_team_naam is not null and length(p_team_naam) > 40 then raise exception 'ongeldige_naam'; end if;
  insert into wedstrijd.teams (wedstrijd_id, naam, naam2, team_naam, deelnemer_code)
  values (v_w.id, trim(p_naam),
          case when v_w.mode = 'koppel' then trim(p_naam2) end,
          nullif(trim(coalesce(p_team_naam,'')), ''),
          wedstrijd.nieuwe_team_code())
  returning * into v_team;
  return json_build_object('team_id', v_team.id, 'token', v_team.token,
                           'deelnemer_code', v_team.deelnemer_code);
exception when unique_violation then
  raise exception 'naam_bestaat_al';
end $function$;

CREATE OR REPLACE FUNCTION public.w_login_deelnemer(p_code text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object(
    'wedstrijd_code', w.code,
    'team_id', t.id,
    'token', t.token,
    'naam', t.naam,
    'deelnemer_code', t.deelnemer_code)
  from wedstrijd.teams t
  join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
  where t.deelnemer_code = upper(trim(p_code));
$function$;

CREATE OR REPLACE FUNCTION public.w_mijn_team(p_code text, p_token uuid)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select json_build_object('id', t.id, 'naam', t.naam, 'naam2', t.naam2,
    'lot_nummer', t.lot_nummer, 'stekken', t.stekken, 'deelnemer_code', t.deelnemer_code)
  from wedstrijd.teams t
  join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
  where w.code = upper(trim(p_code)) and t.token = p_token;
$function$;

-- =====================================================================
-- Publieke RPC's: stekkeuze
-- =====================================================================

CREATE OR REPLACE FUNCTION public.w_kies_stek(p_code text, p_token uuid, p_stekken integer[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
  v_nodig int;
  v_beurt int;
  v_posities int[];
begin
  select w.* into v_w from wedstrijd.wedstrijden w
  where w.code = upper(trim(p_code)) for update;
  if not found then raise exception 'wedstrijd_niet_gevonden'; end if;
  if v_w.status <> 'stekkeuze' then raise exception 'geen_stekkeuze_fase'; end if;
  if v_w.zones is not null then raise exception 'wedstrijd_gebruikt_zones'; end if;

  select t.* into v_team from wedstrijd.teams t
  where t.wedstrijd_id = v_w.id and t.token = p_token
  for update;
  if not found then raise exception 'team_niet_gevonden'; end if;
  if cardinality(v_team.stekken) > 0 then raise exception 'al_gekozen'; end if;

  select min(lot_nummer) into v_beurt from wedstrijd.teams
  where wedstrijd_id = v_w.id and cardinality(stekken) = 0;
  if v_team.lot_nummer <> v_beurt then raise exception 'niet_jouw_beurt'; end if;

  v_nodig := case when v_w.mode = 'koppel' then 2 else 1 end;
  if cardinality(p_stekken) <> v_nodig or (select count(distinct s) from unnest(p_stekken) s) <> v_nodig then
    raise exception 'verkeerd_aantal_stekken';
  end if;

  select array_agg(positie order by positie) into v_posities
  from wedstrijd.stek_ring where stek = any(p_stekken);
  if coalesce(cardinality(v_posities),0) <> v_nodig then raise exception 'onbekende_stek'; end if;
  if v_nodig = 2 and v_posities[2] - v_posities[1] <> 1 then
    raise exception 'stekken_niet_naast_elkaar';
  end if;

  if exists (
    select 1 from wedstrijd.teams
    where wedstrijd_id = v_w.id and stekken && p_stekken
  ) then raise exception 'stek_bezet'; end if;

  update wedstrijd.teams set stekken = p_stekken where id = v_team.id;

  if not exists (select 1 from wedstrijd.teams where wedstrijd_id = v_w.id and cardinality(stekken) = 0) then
    update wedstrijd.wedstrijden set status = 'klaar' where id = v_w.id;
  end if;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_kies_zone(p_code text, p_token uuid, p_zone text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
  v_beurt int;
  v_stekken int[];
begin
  select w.* into v_w from wedstrijd.wedstrijden w
  where w.code = upper(trim(p_code)) for update;
  if not found then raise exception 'wedstrijd_niet_gevonden'; end if;
  if v_w.status <> 'stekkeuze' then raise exception 'geen_stekkeuze_fase'; end if;
  if v_w.zones is null then raise exception 'wedstrijd_zonder_zones'; end if;

  select t.* into v_team from wedstrijd.teams t
  where t.wedstrijd_id = v_w.id and t.token = p_token
  for update;
  if not found then raise exception 'team_niet_gevonden'; end if;
  if cardinality(v_team.stekken) > 0 then raise exception 'al_gekozen'; end if;

  select min(lot_nummer) into v_beurt from wedstrijd.teams
  where wedstrijd_id = v_w.id and cardinality(stekken) = 0;
  if v_team.lot_nummer <> v_beurt then raise exception 'niet_jouw_beurt'; end if;

  select coalesce(array_agg(s::int), '{}') into v_stekken
  from jsonb_array_elements(v_w.zones) z, jsonb_array_elements_text(z->'stekken') s
  where lower(trim(z->>'naam')) = lower(trim(p_zone));
  if cardinality(v_stekken) = 0 then raise exception 'onbekende_zone'; end if;

  if exists (
    select 1 from wedstrijd.teams
    where wedstrijd_id = v_w.id and lower(coalesce(zone,'')) = lower(trim(p_zone))
  ) then raise exception 'zone_bezet'; end if;

  update wedstrijd.teams set stekken = v_stekken, zone = trim(p_zone) where id = v_team.id;

  if not exists (select 1 from wedstrijd.teams where wedstrijd_id = v_w.id and cardinality(stekken) = 0) then
    update wedstrijd.wedstrijden set status = 'klaar' where id = v_w.id;
  end if;
  return json_build_object('ok', true);
end $function$;

-- =====================================================================
-- Publieke RPC's: vangsten
-- =====================================================================

CREATE OR REPLACE FUNCTION public.w_registreer_vangst(p_code text, p_token uuid, p_gewicht_gram integer, p_foto_path text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
  v_id uuid;
  v_wie text;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code));
  if not found then raise exception 'wedstrijd_niet_gevonden'; end if;
  select * into v_team from wedstrijd.teams where wedstrijd_id = v_w.id and token = p_token;
  if not found then raise exception 'team_niet_gevonden'; end if;
  if now() < v_w.start_ts then raise exception 'wedstrijd_niet_begonnen'; end if;
  if now() > v_w.eind_ts then raise exception 'wedstrijd_afgelopen'; end if;
  if p_gewicht_gram is null or p_gewicht_gram < 50 or p_gewicht_gram > 50000 then
    raise exception 'ongeldig_gewicht';
  end if;
  if p_foto_path is null
     or p_foto_path !~ ('^' || v_w.code || '/[A-Za-z0-9-]+\.(jpe?g|png|webp|gif|heic)$') then
    raise exception 'ongeldige_foto';
  end if;

  begin
    insert into wedstrijd.vangsten (wedstrijd_id, team_id, gewicht_gram, foto_path)
    values (v_w.id, v_team.id, p_gewicht_gram, p_foto_path)
    returning id into v_id;
  exception when unique_violation then
    -- alleen een echte retry telt als dubbel: zelfde wedstrijd, team, gewicht en actief
    select id into v_id from wedstrijd.vangsten
    where foto_path = p_foto_path and wedstrijd_id = v_w.id
      and team_id = v_team.id and gewicht_gram = p_gewicht_gram and status = 'actief';
    if not found then raise exception 'foto_al_gebruikt'; end if;
    return json_build_object('id', v_id, 'dubbel', true);
  end;

  begin
    v_wie := coalesce(v_team.team_naam, v_team.naam || coalesce(' & ' || v_team.naam2, ''));
    perform extensions.http_post_ignore(v_w.id, v_team.id, v_w.naam,
      'Nieuwe vangst: ' || round(p_gewicht_gram / 1000.0, 2) || ' kg door ' || v_wie);
  exception when others then null;
  end;

  return json_build_object('id', v_id);
end $function$;

-- =====================================================================
-- Beheer-RPC's (admin_pin per wedstrijd)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.w_admin_check(p_code text, p_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1 from wedstrijd.wedstrijden
    where code = upper(trim(p_code)) and admin_pin = trim(p_pin)
  ) then
    raise exception 'pin_onjuist';
  end if;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_start_stekkeuze(p_code text, p_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_teams int;
  v_capaciteit int;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) and admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  if v_w.status <> 'aanmelden' then raise exception 'al_geloot'; end if;
  select count(*) into v_teams from wedstrijd.teams where wedstrijd_id = v_w.id;
  if v_teams < 1 then raise exception 'geen_deelnemers'; end if;
  if v_w.zones is not null then
    v_capaciteit := jsonb_array_length(v_w.zones);
    if v_teams > v_capaciteit then raise exception 'te_veel_teams_voor_zones'; end if;
  else
    select count(*) into v_capaciteit from wedstrijd.stek_ring;
    if v_teams * (case when v_w.mode = 'koppel' then 2 else 1 end) > v_capaciteit then
      raise exception 'te_veel_teams_voor_stekken';
    end if;
  end if;
  with geschud as (
    select id, row_number() over (order by random()) as nr
    from wedstrijd.teams where wedstrijd_id = v_w.id
  )
  update wedstrijd.teams t set lot_nummer = g.nr from geschud g where t.id = g.id;
  update wedstrijd.wedstrijden set status = 'stekkeuze' where id = v_w.id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_reset_loting(p_code text, p_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) and admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  update wedstrijd.teams set lot_nummer = null, stekken = '{}', zone = null
  where wedstrijd_id = v_w.id;
  update wedstrijd.wedstrijden set status = 'aanmelden' where id = v_w.id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_tijden(p_code text, p_pin text, p_start timestamp with time zone, p_eind timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) and admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  if p_eind <= p_start then raise exception 'eind_voor_start'; end if;
  update wedstrijd.wedstrijden set start_ts = p_start, eind_ts = p_eind where id = v_w.id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_wedstrijd(p_code text, p_pin text, p_naam text DEFAULT NULL::text, p_max_teams integer DEFAULT NULL::integer, p_wis_max boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_teams int;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) and admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  if p_naam is not null then
    if coalesce(trim(p_naam),'') = '' or length(p_naam) > 60 then raise exception 'ongeldige_naam'; end if;
    update wedstrijd.wedstrijden set naam = trim(p_naam) where id = v_w.id;
  end if;
  if p_wis_max then
    update wedstrijd.wedstrijden set max_teams = null where id = v_w.id;
  elsif p_max_teams is not null then
    select count(*) into v_teams from wedstrijd.teams where wedstrijd_id = v_w.id;
    if p_max_teams < 2 or p_max_teams > 200 or p_max_teams < v_teams then
      raise exception 'ongeldig_maximum';
    end if;
    update wedstrijd.wedstrijden set max_teams = p_max_teams where id = v_w.id;
  end if;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_regels(p_code text, p_pin text, p_regels text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) and admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  if p_regels is not null and length(p_regels) > 3000 then raise exception 'regels_te_lang'; end if;
  update wedstrijd.wedstrijden set regels = nullif(trim(coalesce(p_regels,'')), '') where id = v_w.id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_zones(p_code text, p_pin text, p_zones jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) and admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  if v_w.status <> 'aanmelden' then raise exception 'alleen_tijdens_aanmelden'; end if;
  if p_zones is null or p_zones = 'null'::jsonb or jsonb_array_length(p_zones) = 0 then
    update wedstrijd.wedstrijden set zones = null where id = v_w.id;
    return json_build_object('ok', true, 'zones', 0);
  end if;
  perform wedstrijd.valideer_zones(p_zones);
  update wedstrijd.wedstrijden set zones = p_zones where id = v_w.id;
  return json_build_object('ok', true, 'zones', jsonb_array_length(p_zones));
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_kies(p_code text, p_pin text, p_team_id uuid, p_zone text DEFAULT NULL::text, p_stekken integer[] DEFAULT NULL::integer[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
  v_stekken int[];
  v_nodig int;
  v_posities int[];
begin
  select w.* into v_w from wedstrijd.wedstrijden w
  where w.code = upper(trim(p_code)) and w.admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  if v_w.status <> 'stekkeuze' then raise exception 'geen_stekkeuze_fase'; end if;

  select t.* into v_team from wedstrijd.teams t
  where t.id = p_team_id and t.wedstrijd_id = v_w.id for update;
  if not found then raise exception 'team_niet_gevonden'; end if;
  if cardinality(v_team.stekken) > 0 then raise exception 'al_gekozen'; end if;

  if v_w.zones is not null then
    if p_zone is null then raise exception 'wedstrijd_gebruikt_zones'; end if;
    select coalesce(array_agg(s::int), '{}') into v_stekken
    from jsonb_array_elements(v_w.zones) z, jsonb_array_elements_text(z->'stekken') s
    where lower(trim(z->>'naam')) = lower(trim(p_zone));
    if cardinality(v_stekken) = 0 then raise exception 'onbekende_zone'; end if;
    if exists (select 1 from wedstrijd.teams
               where wedstrijd_id = v_w.id and lower(coalesce(zone,'')) = lower(trim(p_zone))) then
      raise exception 'zone_bezet';
    end if;
    update wedstrijd.teams set stekken = v_stekken, zone = trim(p_zone) where id = v_team.id;
  else
    if p_stekken is null then raise exception 'wedstrijd_zonder_zones'; end if;
    v_nodig := case when v_w.mode = 'koppel' then 2 else 1 end;
    if cardinality(p_stekken) <> v_nodig or (select count(distinct s) from unnest(p_stekken) s) <> v_nodig then
      raise exception 'verkeerd_aantal_stekken';
    end if;
    select array_agg(positie order by positie) into v_posities
    from wedstrijd.stek_ring where stek = any(p_stekken);
    if coalesce(cardinality(v_posities),0) <> v_nodig then raise exception 'onbekende_stek'; end if;
    if v_nodig = 2 and v_posities[2] - v_posities[1] <> 1 then raise exception 'stekken_niet_naast_elkaar'; end if;
    if exists (select 1 from wedstrijd.teams where wedstrijd_id = v_w.id and stekken && p_stekken) then
      raise exception 'stek_bezet';
    end if;
    update wedstrijd.teams set stekken = p_stekken where id = v_team.id;
  end if;

  if not exists (select 1 from wedstrijd.teams where wedstrijd_id = v_w.id and cardinality(stekken) = 0) then
    update wedstrijd.wedstrijden set status = 'klaar' where id = v_w.id;
  end if;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_verwijder_team(p_code text, p_pin text, p_team_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) and admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  -- vangsten zijn audit-data: eerst (soft-)verwijderen in Beheer, dan pas het team
  if exists (select 1 from wedstrijd.vangsten where team_id = p_team_id) then
    raise exception 'team_heeft_vangsten';
  end if;
  delete from wedstrijd.teams where id = p_team_id and wedstrijd_id = v_w.id;
  if not found then raise exception 'team_niet_gevonden'; end if;
  if v_w.status = 'stekkeuze' and not exists (
    select 1 from wedstrijd.teams where wedstrijd_id = v_w.id and cardinality(stekken) = 0
  ) and exists (select 1 from wedstrijd.teams where wedstrijd_id = v_w.id) then
    update wedstrijd.wedstrijden set status = 'klaar' where id = v_w.id;
  end if;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_vangst(p_code text, p_pin text, p_vangst_id uuid, p_gewicht_gram integer DEFAULT NULL::integer, p_verwijder boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) and admin_pin = trim(p_pin);
  if not found then raise exception 'pin_onjuist'; end if;
  if p_gewicht_gram is not null and (p_gewicht_gram < 50 or p_gewicht_gram > 50000) then
    raise exception 'ongeldig_gewicht';
  end if;
  update wedstrijd.vangsten set
    gewicht_gram = coalesce(p_gewicht_gram, gewicht_gram),
    status = case when p_verwijder then 'verwijderd' else status end
  where id = p_vangst_id and wedstrijd_id = v_w.id;
  if not found then raise exception 'vangst_niet_gevonden'; end if;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_voeg_vangst(p_code text, p_pin text, p_team_id uuid, p_gewicht_gram integer, p_foto_path text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
  v_id uuid;
  v_wie text;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) and admin_pin = trim(p_pin);
  if not found then raise exception 'pin_onjuist'; end if;
  select * into v_team from wedstrijd.teams where id = p_team_id and wedstrijd_id = v_w.id;
  if not found then raise exception 'team_niet_gevonden'; end if;
  if p_gewicht_gram is null or p_gewicht_gram < 50 or p_gewicht_gram > 50000 then
    raise exception 'ongeldig_gewicht';
  end if;
  if p_foto_path is not null
     and p_foto_path !~ ('^' || v_w.code || '/[A-Za-z0-9-]+\.(jpe?g|png|webp|gif|heic)$') then
    raise exception 'ongeldige_foto';
  end if;
  insert into wedstrijd.vangsten (wedstrijd_id, team_id, gewicht_gram, foto_path)
  values (v_w.id, v_team.id, p_gewicht_gram, p_foto_path)
  returning id into v_id;
  begin
    v_wie := coalesce(v_team.team_naam, v_team.naam || coalesce(' & ' || v_team.naam2, ''));
    perform extensions.http_post_ignore(v_w.id, v_team.id, v_w.naam,
      'Nieuwe vangst: ' || round(p_gewicht_gram / 1000.0, 2) || ' kg door ' || v_wie);
  exception when others then null;
  end;
  return json_build_object('id', v_id);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_teamcodes(p_code text, p_pin text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when exists (
    select 1 from wedstrijd.wedstrijden
    where code = upper(trim(p_code)) and admin_pin = trim(p_pin))
  then coalesce((select json_agg(json_build_object('team_id', t.id, 'deelnemer_code', t.deelnemer_code))
    from wedstrijd.teams t
    join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
    where w.code = upper(trim(p_code))), '[]'::json)
  else null end;
$function$;

-- =====================================================================
-- Organisatie-RPC's (organisatie-wachtwoord uit instellingen)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.w_org_check(p_wachtwoord text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and organisator_wachtwoord = trim(p_wachtwoord)) then
    perform pg_catalog.pg_sleep(0.5);
    raise exception 'org_wachtwoord_onjuist';
  end if;
  return json_build_object('ok', true,
    'standaard_zones', (select standaard_zones from wedstrijd.instellingen where id = 1));
end $function$;

CREATE OR REPLACE FUNCTION public.w_org_wedstrijden(p_wachtwoord text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and organisator_wachtwoord = trim(p_wachtwoord)) then
    perform pg_catalog.pg_sleep(0.5);
    return null;
  end if;
  return json_build_object(
    'wedstrijden', coalesce((select json_agg(json_build_object(
      'code', w.code, 'kijk_code', w.kijk_code, 'admin_pin', w.admin_pin,
      'naam', w.naam, 'mode', w.mode, 'status', w.status,
      'start_ts', w.start_ts, 'eind_ts', w.eind_ts,
      'heeft_zones', (w.zones is not null), 'max_teams', w.max_teams,
      'teams', (select count(*) from wedstrijd.teams t where t.wedstrijd_id = w.id),
      'vangsten', (select count(*) from wedstrijd.vangsten v where v.wedstrijd_id = w.id and v.status = 'actief'))
      order by w.start_ts desc)
    from wedstrijd.wedstrijden w), '[]'::json),
    'server_now', now());
end $function$;

CREATE OR REPLACE FUNCTION public.w_org_standaard_zones(p_wachtwoord text, p_zones jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and organisator_wachtwoord = trim(p_wachtwoord)) then
    perform pg_catalog.pg_sleep(0.5);
    raise exception 'org_wachtwoord_onjuist';
  end if;
  if p_zones is null or p_zones = 'null'::jsonb or jsonb_array_length(p_zones) = 0 then
    update wedstrijd.instellingen set standaard_zones = null where id = 1;
    return json_build_object('ok', true, 'zones', 0);
  end if;
  perform wedstrijd.valideer_zones(p_zones);
  update wedstrijd.instellingen set standaard_zones = p_zones where id = 1;
  return json_build_object('ok', true, 'zones', jsonb_array_length(p_zones));
end $function$;

CREATE OR REPLACE FUNCTION public.w_maak_wedstrijd(p_naam text, p_mode text, p_start timestamp with time zone, p_eind timestamp with time zone, p_org_wachtwoord text, p_max_teams integer DEFAULT NULL::integer, p_regels text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_code text;
  v_kijk text;
  v_pin text;
  v_id uuid;
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and organisator_wachtwoord = trim(p_org_wachtwoord)) then
    raise exception 'org_wachtwoord_onjuist';
  end if;
  if (select alleen_lezen from wedstrijd.instellingen where id = 1) then
    raise exception 'alleen_lezen';
  end if;
  if coalesce(trim(p_naam),'') = '' or length(p_naam) > 60 then raise exception 'ongeldige_naam'; end if;
  if p_mode not in ('individueel','koppel') then raise exception 'ongeldige_mode'; end if;
  if p_eind <= p_start then raise exception 'eind_voor_start'; end if;
  if p_max_teams is not null and (p_max_teams < 2 or p_max_teams > 200) then
    raise exception 'ongeldig_maximum';
  end if;
  if p_regels is not null and length(p_regels) > 3000 then raise exception 'regels_te_lang'; end if;
  v_code := wedstrijd.nieuwe_team_code();
  v_kijk := wedstrijd.nieuwe_team_code();
  v_pin := lower(wedstrijd.nieuwe_team_code()) || floor(random()*1000)::text;
  insert into wedstrijd.wedstrijden (code, kijk_code, naam, mode, start_ts, eind_ts, admin_pin, zones, max_teams, regels)
  values (v_code, v_kijk, trim(p_naam), p_mode, p_start, p_eind, v_pin,
          (select standaard_zones from wedstrijd.instellingen where id = 1), p_max_teams,
          nullif(trim(coalesce(p_regels,'')), ''))
  returning id into v_id;
  return json_build_object('code', v_code, 'kijk_code', v_kijk, 'pin', v_pin, 'id', v_id);
end $function$;

CREATE OR REPLACE FUNCTION public.w_org_verwijder_wedstrijd(p_wachtwoord text, p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_naam text;
  v_teams int;
  v_vangsten int;
  v_paths jsonb;
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and organisator_wachtwoord = trim(p_wachtwoord)) then
    perform pg_catalog.pg_sleep(0.5);
    raise exception 'org_wachtwoord_onjuist';
  end if;
  select id, naam into v_id, v_naam from wedstrijd.wedstrijden
  where upper(code) = upper(trim(p_code)) for update;
  if v_id is null then raise exception 'wedstrijd_niet_gevonden'; end if;
  select count(*) into v_teams from wedstrijd.teams where wedstrijd_id = v_id;
  select count(*), coalesce(jsonb_agg(foto_path) filter (where foto_path is not null), '[]'::jsonb)
    into v_vangsten, v_paths from wedstrijd.vangsten where wedstrijd_id = v_id;
  if jsonb_array_length(v_paths) > 0 then
    begin
      perform extensions.http_wis_fotos(v_paths);
    exception when others then null;
    end;
  end if;
  delete from wedstrijd.wedstrijden where id = v_id;
  return json_build_object('ok', true, 'naam', v_naam,
    'teams', v_teams, 'vangsten', v_vangsten, 'fotos', jsonb_array_length(v_paths));
end $function$;

-- =====================================================================
-- Push-RPC's (subscriptions door clients; payload/cleanup door edge function)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.w_push_subscribe(p_code text, p_token uuid, p_endpoint text, p_p256dh text, p_auth text, p_route text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team_id uuid;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) or kijk_code = upper(trim(p_code));
  if not found then raise exception 'wedstrijd_niet_gevonden'; end if;
  if p_endpoint is null or length(p_endpoint) > 500 or p_endpoint not like 'https://%'
     or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{80,130}$'
     or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{16,50}$' then
    raise exception 'ongeldige_subscription';
  end if;
  if p_route is not null and p_route !~ '^#/(w|k)/[A-Z0-9]{4,8}$' then
    raise exception 'ongeldige_subscription';
  end if;
  if p_token is not null then
    select id into v_team_id from wedstrijd.teams where wedstrijd_id = v_w.id and token = p_token;
    if v_team_id is null then raise exception 'team_niet_gevonden'; end if;
  end if;
  insert into wedstrijd.push_subs (wedstrijd_id, team_id, endpoint, p256dh, auth, route)
  values (v_w.id, v_team_id, p_endpoint, p_p256dh, p_auth, p_route)
  on conflict (endpoint) do update set wedstrijd_id = excluded.wedstrijd_id,
    team_id = excluded.team_id, p256dh = excluded.p256dh, auth = excluded.auth,
    route = excluded.route;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_push_unsubscribe(p_endpoint text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from wedstrijd.push_subs where endpoint = p_endpoint;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_push_payload(p_secret text, p_wedstrijd_id uuid, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when exists (select 1 from wedstrijd.instellingen where id = 1 and push_secret = p_secret)
  then json_build_object(
    'vapid_public', (select vapid_public from wedstrijd.instellingen where id = 1),
    'vapid_private', (select vapid_private from wedstrijd.instellingen where id = 1),
    'contact', (select push_contact from wedstrijd.instellingen where id = 1),
    'subs', coalesce((select json_agg(json_build_object(
        'id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'route', s.route))
      from wedstrijd.push_subs s
      where s.wedstrijd_id = p_wedstrijd_id
        and (p_team_id is null or s.team_id is distinct from p_team_id)), '[]'::json)
  ) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.w_push_cleanup(p_secret text, p_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and push_secret = p_secret) then
    raise exception 'nee';
  end if;
  delete from wedstrijd.push_subs where id = any(p_ids);
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_secret_check(p_secret text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from wedstrijd.instellingen where id = 1 and push_secret = p_secret);
$function$;

-- =====================================================================
-- Grants: alle w_*-RPC's zijn de publieke API
-- =====================================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as proc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'w\_%' escape '\'
  loop
    execute format('grant execute on function %s to anon, authenticated', f.proc);
  end loop;
end $$;
