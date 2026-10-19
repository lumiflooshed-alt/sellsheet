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
//
// QuickBooks Online (optional, same Worker). QuickBooks doesn't accept calls from web pages, so the
// site talks to QuickBooks through here. The QuickBooks sign-in is kept in a KV namespace (bound as
// QBO_KV) and shared by all your devices; each device holds only a random key, checked on every call.
//   INTUIT_CLIENT_ID      text    from developer.intuit.com → your app → Keys & credentials
//   INTUIT_CLIENT_SECRET  secret  from the same page
//   INTUIT_ENV            text    sandbox (testing) or production
//   QBO_KV                KV namespace binding (Settings → Bindings → KV namespace)
// Endpoints (POST, JSON): /qbo/config · /qbo/connect {code, redirect_uri, realmId} · /qbo/api {conn, key, method, path, params, body}
//   · /qbo/disconnect {conn, key}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : 'null', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: cors });
    if (req.method === 'GET') return json({ ok: true, app: 'sellsheet-google-token', configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SEAL_KEY && allowed.length), quickbooks: qboReady(env) });
    if (!ok) return json({ error: 'origin_not_allowed', detail: 'Add ' + (origin || 'the site address') + ' to ALLOWED_ORIGINS.' }, 403);
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let body;
    try { body = await req.json(); } catch (_) { return json({ error: 'bad_request' }, 400); }
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    if (path.startsWith('/qbo/')) {
      try { const r = await qbo(path.slice(5), body, env, allowed); return json(r.body, r.status); }
      catch (e) { return json({ error: 'server_error', detail: String(e && e.message || e) }, 502); }
    }
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SEAL_KEY) return json({ error: 'not_configured', detail: 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SEAL_KEY.' }, 500);

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
const b64u = u => { let o = ''; for (let i = 0; i < u.length; i += 0x8000) o += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(o).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
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

/* ---------------- QuickBooks Online ---------------- */
const QBO_AUTH = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_REVOKE = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const QBO_MINOR = '75';
const qboReady = env => !!(env.INTUIT_CLIENT_ID && env.INTUIT_CLIENT_SECRET && env.QBO_KV);
const qboProd = env => String(env.INTUIT_ENV || '').toLowerCase() === 'production';
const qboBase = env => qboProd(env) ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
// what the site may ask QuickBooks for: lists, items, customers, vendors, accounts, tax codes, sales and purchase documents, reports
const QBO_PATH = /^(query|cdc|preferences|companyinfo\/\d+|(item|customer|vendor|account|taxcode|class|department|term|paymentmethod|bill|billpayment|purchaseorder|invoice|estimate|salesreceipt|creditmemo|payment|purchase|vendorcredit|inventoryadjustment|attachable)(\/\d+(\/(pdf|send))?)?|reports\/[A-Za-z]+)$/;
const sha = async t => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t))));
const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));

async function qboTokens(env, params) {
  const r = await fetch(QBO_TOKEN, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(env.INTUIT_CLIENT_ID + ':' + env.INTUIT_CLIENT_SECRET), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return { error: j.error || 'intuit_error', detail: j.error_description || ('QuickBooks sign-in replied ' + r.status) };
  return j;
}
// a working access token; renews it (QuickBooks hands out a new refresh token each time, which is kept)
async function qboAccess(env, id, c, force) {
  if (!force && c.at && c.atExp > Date.now() + 60e3) return c.at;
  let t = await qboTokens(env, { grant_type: 'refresh_token', refresh_token: c.rt });
  if (t.error) {
    // another request may have renewed it a moment ago
    const again = JSON.parse(await env.QBO_KV.get('conn:' + id) || 'null');
    if (again && again.rt !== c.rt) { Object.assign(c, again); if (c.atExp > Date.now() + 60e3) return c.at; t = await qboTokens(env, { grant_type: 'refresh_token', refresh_token: c.rt }); }
    if (t.error) throw Object.assign(new Error('reconnect'), { code: 'reconnect', detail: t.detail });
  }
  Object.assign(c, { at: t.access_token, atExp: Date.now() + (+t.expires_in || 3600) * 1000, rt: t.refresh_token || c.rt, rtExp: Date.now() + (+t.x_refresh_token_expires_in || 8640000) * 1000 });
  await env.QBO_KV.put('conn:' + id, JSON.stringify(c));
  return c.at;
}
async function qboCall(env, c, at, method, path, params, body) {
  const u = new URL(qboBase(env) + '/v3/company/' + encodeURIComponent(c.realm) + '/' + path);
  for (const [k, v] of Object.entries(params || {})) if (typeof v === 'string' || typeof v === 'number') u.searchParams.set(k, String(v));
  u.searchParams.set('minorversion', QBO_MINOR);
  const pdf = /\/pdf$/.test(path);
  const r = await fetch(u, { method, headers: { Authorization: 'Bearer ' + at, Accept: pdf ? 'application/pdf' : 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}) });
  if (pdf && r.ok) return { status: 200, data: { pdf: b64u(new Uint8Array(await r.arrayBuffer())) } };
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}
async function qbo(op, b, env, allowed) {
  if (!qboReady(env)) return { status: 500, body: { error: 'qbo_not_configured', detail: 'Add INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET and the QBO_KV binding to the Worker.' } };
  if (op === 'config') return { status: 200, body: { clientId: env.INTUIT_CLIENT_ID, env: qboProd(env) ? 'production' : 'sandbox', auth: QBO_AUTH } };
  if (op === 'connect') {
    const ru = typeof b.redirect_uri === 'string' ? b.redirect_uri : '';
    if (!allowed.some(o => ru === o || ru.startsWith(o + '/'))) return { status: 400, body: { error: 'bad_redirect' } };
    if (typeof b.code !== 'string' || !/^\d+$/.test(String(b.realmId || ''))) return { status: 400, body: { error: 'bad_request' } };
    const t = await qboTokens(env, { grant_type: 'authorization_code', code: b.code, redirect_uri: ru });
    if (t.error) return { status: 400, body: t };
    const id = rand(12), key = rand(32);
    const c = { realm: String(b.realmId), rt: t.refresh_token, rtExp: Date.now() + (+t.x_refresh_token_expires_in || 8640000) * 1000, at: t.access_token, atExp: Date.now() + (+t.expires_in || 3600) * 1000, keyHash: await sha(key), env: qboProd(env) ? 'production' : 'sandbox', created: Date.now() };
    await env.QBO_KV.put('conn:' + id, JSON.stringify(c));
    const info = await qboCall(env, c, c.at, 'GET', 'companyinfo/' + c.realm);
    const ci = info.data && info.data.CompanyInfo || {};
    return { status: 200, body: { conn: id, key, realm: c.realm, env: c.env, company: ci.CompanyName || ci.LegalName || '', country: ci.Country || '' } };
  }
  // every other call names the connection and proves it holds its key
  const id = typeof b.conn === 'string' ? b.conn : '';
  const c = id && JSON.parse(await env.QBO_KV.get('conn:' + id) || 'null');
  if (!c || typeof b.key !== 'string' || await sha(b.key) !== c.keyHash) return { status: 401, body: { error: 'not_connected', detail: 'This device isn’t connected to QuickBooks. Connect again in Settings → QuickBooks.' } };
  if (op === 'disconnect') {
    await fetch(QBO_REVOKE, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(env.INTUIT_CLIENT_ID + ':' + env.INTUIT_CLIENT_SECRET), 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ token: c.rt }) }).catch(() => {});
    await env.QBO_KV.delete('conn:' + id);
    return { status: 200, body: { ok: true } };
  }
  if (op !== 'api') return { status: 404, body: { error: 'not_found' } };
  const method = b.method === 'POST' ? 'POST' : 'GET', path = String(b.path || '');
  if (!QBO_PATH.test(path)) return { status: 400, body: { error: 'path_not_allowed', detail: path } };
  try {
    let at = await qboAccess(env, id, c), r = await qboCall(env, c, at, method, path, b.params, b.body);
    if (r.status === 401) { at = await qboAccess(env, id, c, true); r = await qboCall(env, c, at, method, path, b.params, b.body); }
    return { status: 200, body: { status: r.status, data: r.data } };
  } catch (e) {
    if (e.code === 'reconnect') return { status: 401, body: { error: 'reconnect', detail: 'QuickBooks needs you to connect again (the connection expired or was removed).' } };
    throw e;
  }
}
