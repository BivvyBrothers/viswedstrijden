-- =====================================================================
-- Viswedstrijden Plas van der Ende: database-definities (Supabase/Postgres)
-- Export voor code-review, 6 jul 2026. Geen data of secrets.
-- Schema `wedstrijd` = tabellen; alle client-toegang loopt via
-- SECURITY DEFINER RPC's (prefix w_) in `public`. Het schema `wedstrijd`
-- is NIET via PostgREST bereikbaar; tabellen hebben RLS aan zonder policies.
-- =====================================================================

create schema if not exists wedstrijd;

create table wedstrijd.wedstrijden (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- deelnemerscode (6 tekens)
  kijk_code text not null unique,     -- kijkcode (6 tekens)
  naam text not null,
  mode text not null default 'individueel' check (mode in ('individueel','koppel')),
  start_ts timestamptz not null,
  eind_ts timestamptz not null,
  status text not null default 'aanmelden' check (status in ('aanmelden','stekkeuze','klaar')),
  admin_pin text not null,            -- per-wedstrijd beheersleutel, automatisch gegenereerd
  zones jsonb,                        -- [{"naam":"Zone A","stekken":[20,22,...]}] of null
  max_teams int check (max_teams between 2 and 200),  -- null = onbeperkt
  created_at timestamptz not null default now(),
  check (eind_ts > start_ts)
);

create table wedstrijd.teams (
  id uuid primary key default gen_random_uuid(),
  wedstrijd_id uuid not null references wedstrijd.wedstrijden(id) on delete cascade,
  naam text not null,
  naam2 text,                         -- koppelmaat (alleen mode koppel)
  team_naam text,                     -- optionele teamnaam
  token uuid not null default gen_random_uuid(),  -- geheim deelnemers-token
  lot_nummer int,                     -- volgorde na loting
  stekken int[] not null default '{}',
  zone text,                          -- gekozen zone-naam (bij zone-wedstrijden)
  created_at timestamptz not null default now(),
  unique (wedstrijd_id, naam)
);
create index teams_wedstrijd_idx on wedstrijd.teams(wedstrijd_id);

create table wedstrijd.vangsten (
  id uuid primary key default gen_random_uuid(),
  wedstrijd_id uuid not null references wedstrijd.wedstrijden(id) on delete cascade,
  team_id uuid not null references wedstrijd.teams(id) on delete cascade,
  gewicht_gram int not null check (gewicht_gram between 50 and 50000),
  foto_path text not null,            -- pad in publieke bucket wedstrijd-fotos
  status text not null default 'actief' check (status in ('actief','verwijderd')),
  created_at timestamptz not null default now()
);
create index vangsten_wedstrijd_idx on wedstrijd.vangsten(wedstrijd_id, status);

-- fysieke volgorde van de 96 stekken rond de plas (nummers 1-100; even 12/14/16/18 bestaan niet);
-- aangrenzend = opeenvolgende posities; bewuste gaten in posities bij oever zonder stekken
create table wedstrijd.stek_ring (
  positie int primary key,
  stek int not null unique
);
insert into wedstrijd.stek_ring (positie, stek) values
  (1, 1),
  (2, 3),
  (3, 5),
  (4, 7),
  (5, 9),
  (6, 11),
  (7, 13),
  (8, 15),
  (9, 17),
  (10, 19),
  (11, 21),
  (12, 23),
  (13, 25),
  (14, 27),
  (15, 29),
  (16, 31),
  (17, 33),
  (18, 35),
  (19, 37),
  (20, 39),
  (21, 41),
  (22, 43),
  (23, 45),
  (24, 47),
  (25, 49),
  (26, 51),
  (27, 53),
  (28, 55),
  (29, 57),
  (30, 59),
  (31, 61),
  (32, 63),
  (33, 65),
  (34, 67),
  (35, 69),
  (36, 71),
  (37, 73),
  (38, 75),
  (39, 77),
  (40, 79),
  (41, 81),
  (42, 83),
  (43, 85),
  (44, 87),
  (45, 89),
  (46, 91),
  (47, 93),
  (48, 95),
  (49, 97),
  (50, 99),
  (51, 100),
  (52, 98),
  (53, 96),
  (54, 94),
  (55, 92),
  (56, 90),
  (57, 88),
  (58, 86),
  (59, 84),
  (60, 82),
  (61, 80),
  (62, 78),
  (63, 76),
  (64, 74),
  (65, 72),
  (66, 70),
  (67, 68),
  (68, 66),
  (69, 64),
  (70, 62),
  (71, 60),
  (72, 58),
  (73, 56),
  (74, 54),
  (75, 52),
  (76, 50),
  (77, 48),
  (78, 46),
  (79, 44),
  (80, 42),
  (81, 40),
  (82, 38),
  (83, 36),
  (84, 34),
  (85, 32),
  (86, 30),
  (87, 28),
  (88, 26),
  (89, 24),
  (90, 22),
  (91, 20),
  (93, 10),
  (94, 8),
  (95, 6),
  (96, 4),
  (97, 2);
-- let op: positie 92 is bewust overgeslagen (stuk zuidwest-oever zonder stekken)

create table wedstrijd.instellingen (
  id int primary key check (id = 1),
  organisator_wachtwoord text not null,   -- plain (bewuste keuze, hobby-schaal)
  vapid_public text,
  vapid_private text,                     -- web-push VAPID private key
  push_secret text,                       -- auth voor de edge function
  push_contact text not null default 'mailto:***',
  standaard_zones jsonb                   -- vaste zone-indeling, geerfd door nieuwe wedstrijden
);

create table wedstrijd.push_subs (
  id uuid primary key default gen_random_uuid(),
  wedstrijd_id uuid not null references wedstrijd.wedstrijden(id) on delete cascade,
  team_id uuid references wedstrijd.teams(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subs_wedstrijd_idx on wedstrijd.push_subs(wedstrijd_id);

-- RLS aan zonder policies op alle wedstrijd-tabellen (RPC-only toegang)
alter table wedstrijd.wedstrijden enable row level security;
alter table wedstrijd.teams enable row level security;
alter table wedstrijd.vangsten enable row level security;
alter table wedstrijd.stek_ring enable row level security;
alter table wedstrijd.instellingen enable row level security;
alter table wedstrijd.push_subs enable row level security;

-- Storage: publieke bucket 'wedstrijd-fotos' (max 5 MB, image/jpeg|png|webp).
-- Policies op storage.objects: INSERT toegestaan voor anon (alleen deze bucket),
-- geen SELECT-policy (geen listing; lezen gaat via /object/public/...-URL's).

-- =====================================================================
-- Hulpfuncties (schema wedstrijd)
-- =====================================================================

CREATE OR REPLACE FUNCTION wedstrijd.nieuwe_code() RETURNS text
LANGUAGE plpgsql SET search_path TO ''
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
    exit when not exists (
      select 1 from wedstrijd.wedstrijden where code = v_code or kijk_code = v_code
    );
  end loop;
  return v_code;
end $function$;

CREATE OR REPLACE FUNCTION wedstrijd.valideer_zones(p_zones jsonb) RETURNS void
LANGUAGE plpgsql SET search_path TO ''
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

-- push-aanroep naar de edge function via pg_net (fire-and-forget)
CREATE OR REPLACE FUNCTION extensions.http_post_ignore(p_wedstrijd_id uuid, p_team_id uuid, p_titel text, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_secret text;
begin
  select push_secret into v_secret from wedstrijd.instellingen where id = 1;
  perform net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/push-vangst',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object('wedstrijd_id', p_wedstrijd_id, 'team_id', p_team_id,
                               'titel', p_titel, 'body', p_body)
  );
end $function$;

-- =====================================================================
-- Publieke RPC's (allemaal: SECURITY DEFINER, search_path '', grant execute
-- aan anon + authenticated; aangeroepen met de publishable/anon key)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.w_org_check(p_wachtwoord text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and organisator_wachtwoord = trim(p_wachtwoord)) then
    raise exception 'org_wachtwoord_onjuist';
  end if;
  return json_build_object('ok', true,
    'standaard_zones', (select standaard_zones from wedstrijd.instellingen where id = 1));
end $function$;

CREATE OR REPLACE FUNCTION public.w_org_wachtwoord(p_huidig text, p_nieuw text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if coalesce(length(trim(p_nieuw)), 0) < 6 then raise exception 'wachtwoord_te_kort'; end if;
  update wedstrijd.instellingen set organisator_wachtwoord = trim(p_nieuw)
  where id = 1 and organisator_wachtwoord = trim(p_huidig);
  if not found then raise exception 'org_wachtwoord_onjuist'; end if;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_org_standaard_zones(p_wachtwoord text, p_zones jsonb) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and organisator_wachtwoord = trim(p_wachtwoord)) then
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

CREATE OR REPLACE FUNCTION public.w_org_wedstrijden(p_wachtwoord text) RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  select case when exists (select 1 from wedstrijd.instellingen where id = 1 and organisator_wachtwoord = trim(p_wachtwoord))
  then json_build_object(
    'wedstrijden', coalesce((select json_agg(json_build_object(
      'code', w.code, 'kijk_code', w.kijk_code, 'admin_pin', w.admin_pin,
      'naam', w.naam, 'mode', w.mode, 'status', w.status,
      'start_ts', w.start_ts, 'eind_ts', w.eind_ts,
      'heeft_zones', (w.zones is not null),
      'teams', (select count(*) from wedstrijd.teams t where t.wedstrijd_id = w.id),
      'vangsten', (select count(*) from wedstrijd.vangsten v where v.wedstrijd_id = w.id and v.status = 'actief'))
      order by w.start_ts desc)
    from wedstrijd.wedstrijden w), '[]'::json),
    'server_now', now())
  else null end;
$function$;

CREATE OR REPLACE FUNCTION public.w_maak_wedstrijd(p_naam text, p_mode text, p_start timestamptz, p_eind timestamptz, p_org_wachtwoord text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
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
  if coalesce(trim(p_naam),'') = '' or length(p_naam) > 60 then raise exception 'ongeldige_naam'; end if;
  if p_mode not in ('individueel','koppel') then raise exception 'ongeldige_mode'; end if;
  if p_eind <= p_start then raise exception 'eind_voor_start'; end if;
  v_code := wedstrijd.nieuwe_code();
  v_kijk := wedstrijd.nieuwe_code();
  v_pin := lower(wedstrijd.nieuwe_code()) || floor(random()*1000)::text;
  insert into wedstrijd.wedstrijden (code, kijk_code, naam, mode, start_ts, eind_ts, admin_pin, zones)
  values (v_code, v_kijk, trim(p_naam), p_mode, p_start, p_eind, v_pin,
          (select standaard_zones from wedstrijd.instellingen where id = 1))
  returning id into v_id;
  return json_build_object('code', v_code, 'kijk_code', v_kijk, 'pin', v_pin, 'id', v_id);
end $function$;

CREATE OR REPLACE FUNCTION public.w_get_state(p_code text) RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  select json_build_object(
    'wedstrijd', (select json_build_object(
        'code', w.code, 'kijk_code', w.kijk_code, 'naam', w.naam, 'mode', w.mode,
        'start_ts', w.start_ts, 'eind_ts', w.eind_ts, 'status', w.status,
        'zones', w.zones)
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

CREATE OR REPLACE FUNCTION public.w_get_state_kijker(p_kijk_code text) RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  select json_build_object(
    'wedstrijd', (select json_build_object(
        'kijk_code', w.kijk_code, 'naam', w.naam, 'mode', w.mode,
        'start_ts', w.start_ts, 'eind_ts', w.eind_ts, 'status', w.status)
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

CREATE OR REPLACE FUNCTION public.w_join(p_code text, p_naam text, p_naam2 text DEFAULT NULL, p_team_naam text DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code));
  if not found then raise exception 'wedstrijd_niet_gevonden'; end if;
  if v_w.status <> 'aanmelden' then raise exception 'aanmelden_gesloten'; end if;
  if coalesce(trim(p_naam),'') = '' or length(p_naam) > 40 then raise exception 'ongeldige_naam'; end if;
  if v_w.mode = 'koppel' and (coalesce(trim(p_naam2),'') = '' or length(p_naam2) > 40) then
    raise exception 'tweede_naam_verplicht';
  end if;
  if p_team_naam is not null and length(p_team_naam) > 40 then raise exception 'ongeldige_naam'; end if;
  insert into wedstrijd.teams (wedstrijd_id, naam, naam2, team_naam)
  values (v_w.id, trim(p_naam),
          case when v_w.mode = 'koppel' then trim(p_naam2) end,
          nullif(trim(coalesce(p_team_naam,'')), ''))
  returning * into v_team;
  return json_build_object('team_id', v_team.id, 'token', v_team.token);
exception when unique_violation then
  raise exception 'naam_bestaat_al';
end $function$;

CREATE OR REPLACE FUNCTION public.w_mijn_team(p_code text, p_token uuid) RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  select json_build_object('id', t.id, 'naam', t.naam, 'naam2', t.naam2,
    'lot_nummer', t.lot_nummer, 'stekken', t.stekken)
  from wedstrijd.teams t
  join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
  where w.code = upper(trim(p_code)) and t.token = p_token;
$function$;

CREATE OR REPLACE FUNCTION public.w_start_stekkeuze(p_code text, p_pin text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) and admin_pin = trim(p_pin);
  if not found then raise exception 'pin_onjuist'; end if;
  if v_w.status <> 'aanmelden' then raise exception 'al_geloot'; end if;
  if (select count(*) from wedstrijd.teams where wedstrijd_id = v_w.id) < 1 then
    raise exception 'geen_deelnemers';
  end if;
  with geschud as (
    select id, row_number() over (order by random()) as nr
    from wedstrijd.teams where wedstrijd_id = v_w.id
  )
  update wedstrijd.teams t set lot_nummer = g.nr from geschud g where t.id = g.id;
  update wedstrijd.wedstrijden set status = 'stekkeuze' where id = v_w.id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_kies_stek(p_code text, p_token uuid, p_stekken integer[]) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
  v_nodig int;
  v_beurt int;
  v_posities int[];
begin
  select w.* into v_w from wedstrijd.wedstrijden w where w.code = upper(trim(p_code));
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

CREATE OR REPLACE FUNCTION public.w_kies_zone(p_code text, p_token uuid, p_zone text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team wedstrijd.teams;
  v_beurt int;
  v_stekken int[];
begin
  select w.* into v_w from wedstrijd.wedstrijden w where w.code = upper(trim(p_code));
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

CREATE OR REPLACE FUNCTION public.w_registreer_vangst(p_code text, p_token uuid, p_gewicht_gram integer, p_foto_path text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
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
  if p_foto_path is null or p_foto_path not like (v_w.code || '/%') or length(p_foto_path) > 200 then
    raise exception 'ongeldige_foto';
  end if;
  insert into wedstrijd.vangsten (wedstrijd_id, team_id, gewicht_gram, foto_path)
  values (v_w.id, v_team.id, p_gewicht_gram, p_foto_path)
  returning id into v_id;

  begin
    v_wie := coalesce(v_team.team_naam,
      v_team.naam || coalesce(' & ' || v_team.naam2, ''));
    perform extensions.http_post_ignore(v_w.id, v_team.id, v_w.naam,
      'Nieuwe vangst: ' || round(p_gewicht_gram / 1000.0, 2) || ' kg door ' || v_wie);
  exception when others then null;
  end;

  return json_build_object('id', v_id);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_check(p_code text, p_pin text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
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

CREATE OR REPLACE FUNCTION public.w_admin_vangst(p_code text, p_pin text, p_vangst_id uuid, p_gewicht_gram integer DEFAULT NULL, p_verwijder boolean DEFAULT false) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) and admin_pin = trim(p_pin);
  if not found then raise exception 'pin_onjuist'; end if;
  update wedstrijd.vangsten set
    gewicht_gram = coalesce(p_gewicht_gram, gewicht_gram),
    status = case when p_verwijder then 'verwijderd' else status end
  where id = p_vangst_id and wedstrijd_id = v_w.id;
  if not found then raise exception 'vangst_niet_gevonden'; end if;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_reset_loting(p_code text, p_pin text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) and admin_pin = trim(p_pin);
  if not found then raise exception 'pin_onjuist'; end if;
  update wedstrijd.teams set lot_nummer = null, stekken = '{}' where wedstrijd_id = v_w.id;
  update wedstrijd.wedstrijden set status = 'aanmelden' where id = v_w.id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_tijden(p_code text, p_pin text, p_start timestamptz, p_eind timestamptz) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) and admin_pin = trim(p_pin);
  if not found then raise exception 'pin_onjuist'; end if;
  if p_eind <= p_start then raise exception 'eind_voor_start'; end if;
  update wedstrijd.wedstrijden set start_ts = p_start, eind_ts = p_eind where id = v_w.id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_verwijder_team(p_code text, p_pin text, p_team_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) and admin_pin = trim(p_pin);
  if not found then raise exception 'pin_onjuist'; end if;
  if v_w.status <> 'aanmelden' then raise exception 'alleen_tijdens_aanmelden'; end if;
  delete from wedstrijd.teams where id = p_team_id and wedstrijd_id = v_w.id;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_admin_zones(p_code text, p_pin text, p_zones jsonb) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
begin
  select * into v_w from wedstrijd.wedstrijden where code = upper(trim(p_code)) and admin_pin = trim(p_pin);
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

CREATE OR REPLACE FUNCTION public.w_push_subscribe(p_code text, p_token uuid, p_endpoint text, p_p256dh text, p_auth text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_team_id uuid;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) or kijk_code = upper(trim(p_code));
  if not found then raise exception 'wedstrijd_niet_gevonden'; end if;
  if p_endpoint is null or length(p_endpoint) > 500 or p_endpoint not like 'https://%'
     or coalesce(length(p_p256dh),0) > 200 or coalesce(length(p_auth),0) > 100 then
    raise exception 'ongeldige_subscription';
  end if;
  select id into v_team_id from wedstrijd.teams where wedstrijd_id = v_w.id and token = p_token;
  insert into wedstrijd.push_subs (wedstrijd_id, team_id, endpoint, p256dh, auth)
  values (v_w.id, v_team_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set wedstrijd_id = excluded.wedstrijd_id,
    team_id = excluded.team_id, p256dh = excluded.p256dh, auth = excluded.auth;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_push_unsubscribe(p_endpoint text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  delete from wedstrijd.push_subs where endpoint = p_endpoint;
  return json_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.w_push_payload(p_secret text, p_wedstrijd_id uuid, p_team_id uuid DEFAULT NULL) RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  select case when exists (select 1 from wedstrijd.instellingen where id = 1 and push_secret = p_secret)
  then json_build_object(
    'vapid_public', (select vapid_public from wedstrijd.instellingen where id = 1),
    'vapid_private', (select vapid_private from wedstrijd.instellingen where id = 1),
    'contact', (select push_contact from wedstrijd.instellingen where id = 1),
    'subs', coalesce((select json_agg(json_build_object(
        'id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from wedstrijd.push_subs s
      where s.wedstrijd_id = p_wedstrijd_id
        and (p_team_id is null or s.team_id is distinct from p_team_id)), '[]'::json)
  ) else null end;
$function$;

CREATE OR REPLACE FUNCTION public.w_push_cleanup(p_secret text, p_ids uuid[]) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from wedstrijd.instellingen where id = 1 and push_secret = p_secret) then
    raise exception 'nee';
  end if;
  delete from wedstrijd.push_subs where id = any(p_ids);
  return json_build_object('ok', true);
end $function$;


-- =====================================================================
-- UPDATE 6 jul (na het samenstellen van deze bundel): max_teams
-- w_maak_wedstrijd kreeg p_max_teams int default null (validatie 2-200);
-- w_join doet nu 'select ... for update' op de wedstrijd-rij en weigert met
-- 'wedstrijd_vol' zodra het maximum is bereikt; w_get_state, w_get_state_kijker
-- en w_org_wedstrijden geven max_teams mee. Frontend toont "X/Y aangemeld" en
-- een compleet-signaal richting de loting.
-- =====================================================================


-- =====================================================================
-- UPDATE 6 jul, review-fixes doorgevoerd (P0-1, P1-2, P1-3, P1-5, P1-6, P2-13):
-- w_admin_reset_loting wist nu ook teams.zone; alle muterende RPC's locken de
-- wedstrijd-rij met FOR UPDATE; w_start_stekkeuze doet een capaciteitscheck
-- (teams <= zones, of teams * stekken-per-team <= 96); trigger codes_uniek +
-- check code<>kijk_code maken codes hard uniek over beide kolommen;
-- w_push_subscribe valideert p256dh/auth met base64url-regexes, weigert een
-- onbekend token, en slaat een route (#/w/... of #/k/...) per subscription op
-- die de service worker gebruikt bij een klik op de melding.
-- =====================================================================


-- =====================================================================
-- UPDATE 6 jul avond: persoonlijke inlogcodes (migratie wedstrijd_deelnemer_codes,
-- geplaatst na herstel van de Supabase-storing). Koppel deelt 1 code.
-- =====================================================================

alter table wedstrijd.teams add column deelnemer_code text unique;

create or replace function wedstrijd.nieuwe_team_code() returns text
language plpgsql set search_path = ''
as $$
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
end $$;

create or replace function wedstrijd.nieuwe_code() returns text
language plpgsql set search_path = ''
as $$
begin
  return wedstrijd.nieuwe_team_code();
end $$;

do $$
declare r record;
begin
  for r in select id from wedstrijd.teams where deelnemer_code is null loop
    update wedstrijd.teams set deelnemer_code = wedstrijd.nieuwe_team_code() where id = r.id;
  end loop;
end $$;
alter table wedstrijd.teams alter column deelnemer_code set not null;

create or replace function public.w_join(p_code text, p_naam text, p_naam2 text default null, p_team_naam text default null)
returns json
language plpgsql security definer set search_path = ''
as $$
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
end $$;

create or replace function public.w_login_deelnemer(p_code text) returns json
language sql security definer set search_path = ''
as $$
  select json_build_object(
    'wedstrijd_code', w.code,
    'team_id', t.id,
    'token', t.token,
    'naam', t.naam,
    'deelnemer_code', t.deelnemer_code)
  from wedstrijd.teams t
  join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
  where t.deelnemer_code = upper(trim(p_code));
$$;
grant execute on function public.w_login_deelnemer(text) to anon, authenticated;

create or replace function public.w_mijn_team(p_code text, p_token uuid) returns json
language sql security definer set search_path = ''
as $$
  select json_build_object('id', t.id, 'naam', t.naam, 'naam2', t.naam2,
    'lot_nummer', t.lot_nummer, 'stekken', t.stekken, 'deelnemer_code', t.deelnemer_code)
  from wedstrijd.teams t
  join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
  where w.code = upper(trim(p_code)) and t.token = p_token;
$$;

create or replace function public.w_admin_teamcodes(p_code text, p_pin text) returns json
language sql security definer set search_path = ''
as $$
  select case when exists (
    select 1 from wedstrijd.wedstrijden
    where code = upper(trim(p_code)) and admin_pin = trim(p_pin))
  then coalesce((select json_agg(json_build_object('team_id', t.id, 'deelnemer_code', t.deelnemer_code))
    from wedstrijd.teams t
    join wedstrijd.wedstrijden w on w.id = t.wedstrijd_id
    where w.code = upper(trim(p_code))), '[]'::json)
  else null end;
$$;
grant execute on function public.w_admin_teamcodes(text, text) to anon, authenticated;
