-- v88 (14 sep 2026): afsluiting van de wedstrijd
-- 1) prijsuitreiking_ts (optioneel) op de wedstrijd, 2) eind_gemeld_op + cronjob
-- die bij het verstrijken van de eindtijd één push stuurt (winnaar, registreren
-- gesloten, prijsuitreiking), 3) prijsuitreiking_ts in de state van deelnemer en kijker.
-- Signatuurwijzigingen: w_maak_wedstrijd en w_admin_tijden krijgen extra
-- parameters MET default; de oude signatuur wordt gedropt zodat PostgREST niet
-- twee kandidaten ziet. Oude clients (zonder de parameter) blijven werken.

alter table wedstrijd.wedstrijden
  add column if not exists prijsuitreiking_ts timestamptz,
  add column if not exists eind_gemeld_op timestamptz;

-- wedstrijden die al afgelopen zijn nooit alsnog melden
update wedstrijd.wedstrijden set eind_gemeld_op = now() where eind_ts <= now() and eind_gemeld_op is null;

drop function if exists public.w_maak_wedstrijd(text, text, timestamptz, timestamptz, text, integer, text, text, uuid);
CREATE OR REPLACE FUNCTION public.w_maak_wedstrijd(p_naam text, p_mode text, p_start timestamp with time zone, p_eind timestamp with time zone, p_org_wachtwoord text, p_max_teams integer DEFAULT NULL::integer, p_regels text DEFAULT NULL::text, p_klant text DEFAULT NULL::text, p_client_id uuid DEFAULT NULL::uuid, p_prijsuitreiking timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
  v_klant uuid;
  v_bestaand wedstrijd.wedstrijden;
begin
  -- wachtwoord moet bij DEZE klant horen; p_klant is een selector, geen bewijs
  v_klant := wedstrijd.klant_van_org(p_org_wachtwoord, coalesce(nullif(trim(p_klant), ''), 'nphv'));
  if p_client_id is not null then
    select * into v_bestaand from wedstrijd.wedstrijden where client_id = p_client_id;
    if found then
      return json_build_object('code', v_bestaand.code, 'kijk_code', v_bestaand.kijk_code,
                               'pin', v_bestaand.admin_pin, 'id', v_bestaand.id, 'bestond_al', true);
    end if;
  end if;
  if (select alleen_lezen from wedstrijd.klant_instellingen where klant_id = v_klant) then
    raise exception 'alleen_lezen';
  end if;
  if coalesce(trim(p_naam),'') = '' or length(p_naam) > 60 then raise exception 'ongeldige_naam'; end if;
  if p_mode not in ('individueel','koppel') then raise exception 'ongeldige_mode'; end if;
  if p_eind <= p_start then raise exception 'eind_voor_start'; end if;
  if p_prijsuitreiking is not null and p_prijsuitreiking < p_start then raise exception 'prijsuitreiking_voor_start'; end if;
  if p_max_teams is not null and (p_max_teams < 2 or p_max_teams > 200) then
    raise exception 'ongeldig_maximum';
  end if;
  if p_regels is not null and length(p_regels) > 3000 then raise exception 'regels_te_lang'; end if;
  v_code := wedstrijd.nieuwe_team_code();
  v_kijk := wedstrijd.nieuwe_team_code();
  v_pin := wedstrijd.nieuwe_pin();
  insert into wedstrijd.wedstrijden (code, kijk_code, naam, mode, start_ts, eind_ts, admin_pin, zones, max_teams, regels, klant_id, client_id, prijsuitreiking_ts)
  values (v_code, v_kijk, trim(p_naam), p_mode, p_start, p_eind, v_pin,
          (select standaard_zones from wedstrijd.klant_instellingen where klant_id = v_klant), p_max_teams,
          nullif(trim(coalesce(p_regels,'')), ''), v_klant, p_client_id, p_prijsuitreiking)
  returning id into v_id;
  return json_build_object('code', v_code, 'kijk_code', v_kijk, 'pin', v_pin, 'id', v_id);
end $function$;

drop function if exists public.w_admin_tijden(text, text, timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.w_admin_tijden(p_code text, p_pin text, p_start timestamp with time zone, p_eind timestamp with time zone, p_prijsuitreiking timestamp with time zone DEFAULT NULL::timestamp with time zone, p_wis_prijsuitreiking boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_w wedstrijd.wedstrijden;
  v_prijs timestamptz;
begin
  select * into v_w from wedstrijd.wedstrijden
  where code = upper(trim(p_code)) and admin_pin = trim(p_pin) for update;
  if not found then raise exception 'pin_onjuist'; end if;
  if p_eind <= p_start then raise exception 'eind_voor_start'; end if;
  -- eerst de UITEINDELIJKE prijsuitreiking bepalen (wissen, nieuwe waarde of
  -- bestaande), dan pas valideren: anders laat een oude client die de parameter
  -- niet meestuurt een prijsuitreiking vóór de nieuwe start staan (Codex v88)
  v_prijs := case when p_wis_prijsuitreiking then null else coalesce(p_prijsuitreiking, v_w.prijsuitreiking_ts) end;
  if v_prijs is not null and v_prijs < p_start then raise exception 'prijsuitreiking_voor_start'; end if;
  update wedstrijd.wedstrijden
     set start_ts = p_start, eind_ts = p_eind,
         prijsuitreiking_ts = v_prijs,
         eind_gemeld_op = case when p_eind > now() then null else eind_gemeld_op end
   where id = v_w.id;
  return json_build_object('ok', true);
end $function$;

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
        'prijsuitreiking_ts', w.prijsuitreiking_ts,
        'zones', w.zones, 'max_teams', w.max_teams, 'regels', w.regels,
        'dag_regels', w.dag_regels,
        'seizoen_ex_aequo', (select z.regels->>'ex_aequo' from wedstrijd.seizoenen z where z.id = w.seizoen_id))
      from wedstrijd.wedstrijden w where w.code = upper(trim(p_code))),
    'teams', coalesce((select json_agg(json_build_object(
        'id', t.id, 'naam', t.naam, 'naam2', t.naam2, 'team_naam', t.team_naam,
        'lot_nummer', t.lot_nummer, 'stekken', t.stekken, 'zone', t.zone,
        'duo_id', t.duo_id)
        order by t.lot_nummer nulls last, t.created_at, t.id)
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
    'server_now', pg_catalog.now()
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
        'prijsuitreiking_ts', w.prijsuitreiking_ts,
        'max_teams', w.max_teams, 'regels', w.regels,
        'dag_regels', w.dag_regels,
        'seizoen_ex_aequo', (select z.regels->>'ex_aequo' from wedstrijd.seizoenen z where z.id = w.seizoen_id))
      from wedstrijd.wedstrijden w where w.kijk_code = upper(trim(p_kijk_code))),
    'teams', coalesce((select json_agg(json_build_object(
        'id', t.id, 'naam', t.naam, 'naam2', t.naam2, 'team_naam', t.team_naam,
        'lot_nummer', t.lot_nummer, 'stekken', t.stekken, 'zone', t.zone,
        'duo_id', t.duo_id)
        order by t.lot_nummer nulls last, t.created_at, t.id)
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
    'server_now', pg_catalog.now()
  );
$function$;

-- einde-melding: één push per wedstrijd zodra de eindtijd is verstreken.
-- Draait via pg_cron elke 5 minuten (NOOIT per minuut: 16 aug 2026 legde een
-- minuut-cron de hele app plat). Venster van 3 uur zodat een gemiste run niet
-- leidt tot pushes over oude wedstrijden; eind_gemeld_op voorkomt dubbelen.
CREATE OR REPLACE FUNCTION wedstrijd.meld_afgelopen()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
  n integer := 0;
  v_regel text;
  v_body text;
  v_winnaars text;
  v_aantal_winnaars integer;
  v_totaal bigint;
  v_vissen bigint;
begin
  for r in
    select w.id, w.naam, w.eind_ts, w.prijsuitreiking_ts, w.seizoen_id, w.dag_regels
    from wedstrijd.wedstrijden w
    where w.eind_ts <= now() and w.eind_ts > now() - interval '3 hours' and w.eind_gemeld_op is null
    for update skip locked
  loop
    update wedstrijd.wedstrijden set eind_gemeld_op = now() where id = r.id;
    -- dezelfde regelkeuze als dagRegel() in de client: per wedstrijd, anders seizoen, anders app
    v_regel := coalesce(r.dag_regels->>'ex_aequo',
                        (select z.regels->>'ex_aequo' from wedstrijd.seizoenen z where z.id = r.seizoen_id), 'app');
    if v_regel not in ('app','sportvisunie','karper') then v_regel := 'app'; end if;
    with per_team as (
      select t.id, coalesce(t.team_naam, t.naam || case when t.naam2 is not null then ' & ' || t.naam2 else '' end) as naam,
             sum(v.gewicht_gram) as totaal, count(*) as aantal, max(v.gewicht_gram) as grootste,
             min(v.created_at) filter (where v.gewicht_gram = (select max(v2.gewicht_gram) from wedstrijd.vangsten v2 where v2.team_id = t.id and v2.wedstrijd_id = r.id and v2.status = 'actief')) as tijd_grootste
      from wedstrijd.vangsten v join wedstrijd.teams t on t.id = v.team_id
      where v.wedstrijd_id = r.id and v.status = 'actief'
      group by t.id, t.naam, t.naam2, t.team_naam
    ), gerangschikt as (
      select *, rank() over (order by
        totaal desc,
        case when v_regel = 'karper' then aantal end desc,
        case when v_regel <> 'sportvisunie' then grootste end desc,
        case when v_regel <> 'sportvisunie' then tijd_grootste end asc) as rang
      from per_team
    )
    select string_agg(naam, ' en ' order by naam), count(*), max(totaal), max(aantal)
      into v_winnaars, v_aantal_winnaars, v_totaal, v_vissen
      from gerangschikt where rang = 1;
    if v_winnaars is null then
      v_body := 'Registreren is gesloten. Er is niets gevangen.';
    elsif v_aantal_winnaars > 1 then
      v_body := format('Voorlopige uitslag: %s delen de eerste plaats met %s kg. Registreren is gesloten.',
                       v_winnaars, replace(to_char(v_totaal / 1000.0, 'FM999990.00'), '.', ','));
    else
      v_body := format('Voorlopige uitslag: %s wint met %s kg (%s %s). Registreren is gesloten.',
                       v_winnaars, replace(to_char(v_totaal / 1000.0, 'FM999990.00'), '.', ','),
                       v_vissen, case when v_vissen = 1 then 'vis' else 'vissen' end);
    end if;
    if r.prijsuitreiking_ts is not null then
      v_body := v_body || format(' Prijsuitreiking %s.',
        case when (r.prijsuitreiking_ts at time zone 'Europe/Amsterdam')::date = (r.eind_ts at time zone 'Europe/Amsterdam')::date
             then 'om ' || to_char(r.prijsuitreiking_ts at time zone 'Europe/Amsterdam', 'HH24:MI') || ' uur'
             else 'op ' || to_char(r.prijsuitreiking_ts at time zone 'Europe/Amsterdam', 'DD-MM') || ' om ' || to_char(r.prijsuitreiking_ts at time zone 'Europe/Amsterdam', 'HH24:MI') || ' uur' end);
    end if;
    perform extensions.http_post_ignore(r.id, null, '🏁 ' || r.naam || ' is afgelopen', v_body);
    n := n + 1;
  end loop;
  return n;
end $function$;

revoke all on function wedstrijd.meld_afgelopen() from public, anon, authenticated;

select cron.schedule('wedstrijd_meld_afgelopen', '*/5 * * * *', $$select wedstrijd.meld_afgelopen()$$);

-- ---------------------------------------------------------------------------
-- v88b (zelfde dag, na de Codex-review): meld_afgelopen gebruikt dezelfde
-- dagregel en tiebreaks als het klassement (app/sportvisunie/karper via
-- rank()), noemt gedeelde winnaars, heet "voorlopige uitslag" en toont de datum
-- van de prijsuitreiking op een andere dag; w_admin_tijden valideert de
-- UITEINDELIJKE prijsuitreiking. Definitieve tekst: zie review/database.sql
-- (vers geëxporteerd) en migratie `wedstrijd_afsluiting_v88b` in Supabase.
