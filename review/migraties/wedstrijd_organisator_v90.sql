-- v90 (14 sep 2026): organisator-correcties en foto-toestemming. Toegepast als
-- migratie `wedstrijd_organisator_v90` (plus `wedstrijd_kijker_zones_v89` voor de
-- zones in de kijkerstate). Definitieve functieteksten: review/database.sql.
--
-- 1) vangsten.gewijzigd_op/gewijzigd_wat: audit van organisator-ingrepen (ster in de app)
-- 2) w_admin_vangst: ook team (verkeerde code) en vangsttijd corrigeren
-- 3) w_admin_voeg_vangst: vangsttijd meegeven bij handmatige invoer ('handmatig')
-- 4) teams.foto_toestemming + w_join(p_foto_toestemming)
-- 5) w_get_state (+kijker): gevangen_op, gewijzigd_op, gewijzigd_wat per vangst,
--    foto_toestemming per team (alleen deelnemerstate), sortering op de vangsttijd
-- Oude signaturen gedropt (PostgREST mag geen twee kandidaten zien):
--   drop function if exists public.w_admin_vangst(text, text, uuid, integer, boolean);
--   drop function if exists public.w_admin_voeg_vangst(text, text, uuid, integer, text, uuid);
--   drop function if exists public.w_join(text, text, text, text, boolean);
alter table wedstrijd.vangsten
  add column if not exists gewijzigd_op timestamptz,
  add column if not exists gewijzigd_wat text;
alter table wedstrijd.teams
  add column if not exists foto_toestemming boolean not null default false;
notify pgrst, 'reload schema';
