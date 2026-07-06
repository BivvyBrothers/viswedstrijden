// Supabase Edge Function "push-vangst" (Deno), gedeployed met verify_jwt UIT.
// Auth: x-push-secret header, gecheckt in de database (w_push_payload geeft null bij fout secret).
// Aangeroepen door de database zelf (pg_net) bij elke nieuwe vangst.
import webpush from 'npm:web-push@3.6.7';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

async function rpc(fn: string, args: unknown) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('nee', { status: 405 });
  const secret = req.headers.get('x-push-secret') ?? '';
  let body: { wedstrijd_id?: string; team_id?: string; titel?: string; body?: string };
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  if (!body.wedstrijd_id) return new Response('wedstrijd_id ontbreekt', { status: 400 });

  const payload = await rpc('w_push_payload', {
    p_secret: secret,
    p_wedstrijd_id: body.wedstrijd_id,
    p_team_id: body.team_id ?? null,
  });
  if (!payload) return new Response('unauthorized', { status: 401 });

  webpush.setVapidDetails(payload.contact, payload.vapid_public, payload.vapid_private);
  const bericht = JSON.stringify({
    title: body.titel ?? 'Viswedstrijd',
    body: body.body ?? 'Nieuwe vangst!',
  });

  let ok = 0;
  const dood: string[] = [];
  for (const s of payload.subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        bericht,
        { TTL: 3600 },
      );
      ok++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dood.push(s.id);
    }
  }
  if (dood.length) await rpc('w_push_cleanup', { p_secret: secret, p_ids: dood });
  return Response.json({ verstuurd: ok, opgeruimd: dood.length });
});
