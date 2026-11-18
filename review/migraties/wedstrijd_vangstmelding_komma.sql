-- wedstrijd_vangstmelding_komma (18 nov 2026)
-- De pushmelding bij een nieuwe vangst toonde "17.90 kg" (punt) omdat de uitkomst van
-- round() rechtstreeks in de tekst werd geplakt. Overal elders in de app staat een komma.
-- Bewust per functie BIJ NAAM en met een controle dat de regel er precies één keer staat:
-- de live definitie wordt opgehaald, alleen die ene regel vervangen en teruggeschreven.
-- Vooraf bewezen in een transactie met rollback (security definer, search_path en
-- rechten bleven gelijk; voorbeeld: "Nieuwe vangst: 17,90 kg door Patrick").
do $m$
declare
  v_fn regprocedure;
  v_def text;
  v_oud constant text := $o$'Nieuwe vangst: ' || round(p_gewicht_gram / 1000.0, 2) || ' kg door ' || v_wie$o$;
  v_nieuw constant text := $n$'Nieuwe vangst: ' || replace(round(p_gewicht_gram / 1000.0, 2)::text, '.', ',') || ' kg door ' || v_wie$n$;
begin
  foreach v_fn in array array[
    'public.w_registreer_vangst(text, uuid, integer, text)'::regprocedure,
    'public.w_admin_voeg_vangst(text, text, uuid, integer, text, uuid, timestamp with time zone)'::regprocedure]
  loop
    v_def := pg_get_functiondef(v_fn);
    if (length(v_def) - length(replace(v_def, v_oud, ''))) / length(v_oud) <> 1 then
      raise exception 'verwachtte de meldingsregel precies 1x in %', v_fn;
    end if;
    execute replace(v_def, v_oud, v_nieuw);
  end loop;
end $m$;
