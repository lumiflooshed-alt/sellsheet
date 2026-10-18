// Rakaposhica Dashboard: "Stay signed in" helper for Google (a Cloudflare Worker, free plan is plenty).
//
// Google only hands out long-lasting sign-ins (refresh tokens) to a server that holds the
// Client secret. This Worker is that server. It never sees your email or files: it only swaps
// Google's one-time sign-in code for a lasting sign-in, and later swaps that for a fresh
// one-hour access token, so the site can keep working without asking you to sign in again.
//
// The lasting sign-in is sealed (encrypted) with SEAL_KEY before it goes back to the browser,
// so the copy saved there is useless without this Worker.
//
// Settings (Cloudflare → Workers → this Worker → Settings → Variables and Secrets):
//   GOOGLE_CLIENT_ID      text    your Google Client ID (…apps.googleusercontent.com)
//   GOOGLE_CLIENT_SECRET  secret  the Client secret from the same Google client
//   SEAL_KEY              secret  any long random text (e.g. 40+ random letters and digits)
//   ALLOWED_ORIGINS       text    the site's address(es), comma separated,
//                                 e.g. https://lumiflooshed-alt.github.io,https://YOUR-NAME.pages.dev
//
// Endpoints (POST, JSON): /exchange {code, redirect_uri, code_verifier} · /refresh {rt} · /revoke {rt}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : 'null', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: cors });
    if (req.method === 'GET') return json({ ok: true, app: 'sellsheet-google-token', configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SEAL_KEY && allowed.length) });
    if (!ok) return json({ error: 'origin_not_allowed', detail: 'Add ' + (origin || 'the site address') + ' to ALLOWED_ORIGINS.' }, 403);
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SEAL_KEY) return json({ error: 'not_configured', detail: 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SEAL_KEY.' }, 500);

    let body;
    try { body = await req.json(); } catch (_) { return json({ error: 'bad_request' }, 400); }
    const path = new URL(req.url).pathname.replace(/\/+$/, '');

    try {
      if (path.endsWith('/exchange')) {
        if (typeof body.code !== 'string' || !body.code) return json({ error: 'bad_request' }, 400);
        // the sign-in window returns to the site itself, so its address must be one of the allowed ones
        const ru = typeof body.redirect_uri === 'string' ? body.redirect_uri : '';
        if (!allowed.some(o => ru === o || ru.startsWith(o + '/'))) return json({ error: 'bad_redirect', detail: 'The return address must be on ' + allowed.join(' or ') }, 400);
        const r = await google(env, { grant_type: 'authorization_code', code: body.code, redirect_uri: ru, ...(typeof body.code_verifier === 'string' ? { code_verifier: body.code_verifier } : {}) });
        if (r.error) return json(r, 400);
        return json({ access_token: r.access_token, expires_in: r.expires_in, scope: r.scope, rt: r.refresh_token ? await seal(env, r.refresh_token) : '' });
      }
      if (path.endsWith('/refresh')) {
        const rt = await unseal(env, body.rt);
        if (!rt) return json({ error: 'invalid_grant' }, 401);
        const r = await google(env, { grant_type: 'refresh_token', refresh_token: rt });
        if (r.error) return json(r, r.error === 'invalid_grant' ? 401 : 400);
        return json({ access_token: r.access_token, expires_in: r.expires_in, scope: r.scope });
      }
      if (path.endsWith('/revoke')) {
        const rt = await unseal(env, body.rt);
        if (rt) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: rt }) });
        return json({ ok: true });
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'server_error', detail: String(e && e.message || e) }, 502);
    }
  }
};

async function google(env, params) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return { error: j.error || 'google_error', detail: j.error_description || ('Google replied ' + r.status) };
  return j;
}

// AES-GCM with a key made from SEAL_KEY; output is base64url(iv + ciphertext)
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function key(env) { return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode(env.SEAL_KEY)), 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function seal(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), enc.encode(text)));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  return b64u(out);
}
async function unseal(env, s) {
  if (typeof s !== 'string' || s.length < 20 || s.length > 4000) return '';
  try { const u = unb64u(s); return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, await key(env), u.slice(12))); }
  catch (_) { return ''; }
}
