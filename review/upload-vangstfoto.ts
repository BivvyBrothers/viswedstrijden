// Kopie van de edge function `upload-vangstfoto` (gedeployed 18 jul 2026,
// verify_jwt = false; autorisatie zit in de functie zelf).
//
// Waarom: de browser uploadde eerder rechtstreeks naar storage met de publieke
// sleutel. Die aanroep bevat geen bewijs dat de uploader bij het team hoort,
// dus een storage-policy kon dat ook niet afdwingen (Codex v10 hoog-2).
// Deze functie controleert eerst wedstrijdcode + teamtoken (deelnemer) of
// admin-pin (organisator) en uploadt pas daarna met de service-role sleutel,
// naar een pad dat de SERVER kiest.
//
// Aanroep: POST met headers
//   x-w-code   wedstrijdcode
//   x-w-token  teamtoken (deelnemer)   OF   x-w-pin  admin-pin (organisator)
//   content-type: image/jpeg
// Body: de JPEG-bytes. Antwoord: { pad: "CODE/uuid.jpg" }
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'wedstrijd-fotos';
const MAX_BYTES = 5 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-w-code, x-w-token, x-w-pin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// eenvoudige rate-limit per IP in het geheugen van deze instantie: genoeg om
// een botje af te remmen, geen vervanging voor een echte WAF
const RAAM_MS = 60_000;
const MAX_PER_RAAM = 20;
const tellers = new Map<string, { tot: number; n: number }>();

function magNog(ip: string): boolean {
  const nu = Date.now();
  const t = tellers.get(ip);
  if (!t || nu > t.tot) {
    tellers.set(ip, { tot: nu + RAAM_MS, n: 1 });
    if (tellers.size > 5000) tellers.clear();  // simpele opruiming
    return true;
  }
  t.n += 1;
  return t.n <= MAX_PER_RAAM;
}

async function rpc(naam: string, params: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${naam}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  return { ok: r.ok, data: await r.json().catch(() => null) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ fout: 'method' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'onbekend';
  if (!magNog(ip)) return json({ fout: 'te_veel_uploads' }, 429);

  const code = (req.headers.get('x-w-code') || '').trim().toUpperCase();
  const token = (req.headers.get('x-w-token') || '').trim();
  const pin = (req.headers.get('x-w-pin') || '').trim();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return json({ fout: 'ongeldige_code' }, 400);

  // autorisatie: teamtoken van een deelnemer OF de admin-pin van de wedstrijd
  let toegestaan = false;
  if (token) {
    const r = await rpc('w_mijn_team', { p_code: code, p_token: token });
    toegestaan = !!(r.ok && r.data && r.data.id);
  } else if (pin) {
    const r = await rpc('w_admin_check', { p_code: code, p_pin: pin });
    toegestaan = !!(r.ok && r.data);
  }
  if (!toegestaan) return json({ fout: 'geen_toegang' }, 403);

  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return json({ fout: 'ongeldige_foto' }, 400);
  // alleen echte JPEG's (de client comprimeert altijd naar JPEG)
  if (!(body[0] === 0xff && body[1] === 0xd8)) return json({ fout: 'ongeldige_foto' }, 400);

  // de SERVER kiest het pad; de client kan dus niets overschrijven
  const pad = `${code}/${crypto.randomUUID()}.jpg`;
  const up = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${pad}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false',
    },
    body,
  });
  if (!up.ok) return json({ fout: 'upload_mislukt' }, 502);
  return json({ pad });
});
