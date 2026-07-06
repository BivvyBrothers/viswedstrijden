-- WACHT OP UITVOERING (Supabase-MCP lag eruit op 6 jul): persoonlijke inlogcodes
-- Migratienaam: wedstrijd_deelnemer_codes
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
