// Verwijdert wedstrijdfoto's uit de bucket wedstrijd-fotos via de Storage API.
// Auth: x-push-secret header (zelfde secret als push-vangst), gecheckt via RPC
// w_secret_check. Aangeroepen door w_org_verwijder_wedstrijd (pg_net, best effort).
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'wedstrijd-fotos';
const PAD_OK = /^[A-Za-z0-9]+\/[A-Za-z0-9-]+\.(jpe?g|png|webp|gif|heic)$/;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('nee', { status: 405 });
  const secret = req.headers.get('x-push-secret') ?? '';
  let body: { paths?: string[] };
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }

  const check = await fetch(`${SB_URL}/rest/v1/rpc/w_secret_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ p_secret: secret }),
  });
  if (!check.ok || (await check.text()) !== 'true') return new Response('unauthorized', { status: 401 });

  const paths = (body.paths ?? []).filter((p) => typeof p === 'string' && PAD_OK.test(p)).slice(0, 1000);
  if (!paths.length) return Response.json({ verwijderd: 0 });

  const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    body: JSON.stringify({ prefixes: paths }),
  });
  const tekst = await res.text();
  if (!res.ok) return new Response(`storage: ${res.status} ${tekst}`, { status: 502 });
  let aantal = paths.length;
  try { aantal = JSON.parse(tekst).length ?? aantal; } catch { /* laat schatting staan */ }
  return Response.json({ verwijderd: aantal });
});
