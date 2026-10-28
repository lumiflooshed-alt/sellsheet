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
// Company (optional): bind a D1 database as TEAM_DB (Worker → Settings → Bindings → D1 database) and several people
// can share customers, leads and history. The tables are created on first use. /team/* calls carry the person's own
// Google or Microsoft access token (Authorization: Bearer …, X-Prov: google|microsoft); the Worker asks Google or
// Microsoft who it belongs to, so nobody can act as someone else. Nothing is stored about anyone outside a company.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : 'null', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Prov', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: cors });
    if (req.method === 'GET') return json({ ok: true, app: 'sellsheet-google-token', configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SEAL_KEY && allowed.length), team: !!env.TEAM_DB });
    if (!ok) return json({ error: 'origin_not_allowed', detail: 'Add ' + (origin || 'the site address') + ' to ALLOWED_ORIGINS.' }, 403);
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const tpath = new URL(req.url).pathname.replace(/\/+$/, '');
    if (/\/team\/[a-z]+$/.test(tpath)) {
      let tb; try { tb = await req.json(); } catch (_) { return json({ error: 'bad_request' }, 400); }
      try { return await team(req, env, tpath.split('/').pop(), tb || {}, json); }
      catch (e) { return json({ error: 'server_error', detail: String(e && e.message || e) }, 502); }
    }
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

/* ---------- company: shared customers, leads and history ---------- */
const KINDS = { cust: ['cust', 'grp'], lead: ['lead'], log: ['log'], act: ['act'], todo: ['todo'], tpl: ['tpl'] };
const SHARE_DEF = { cust: true, lead: true, log: true, act: true, todo: false, tpl: false };
const ck = v => String(v || '').trim().toLowerCase();
const okEmail = v => /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(v) && v.length <= 200;
const who = new Map(); // token fingerprint -> {email, exp}: saves asking Google/Microsoft on every call
async function whoIs(req, env) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim(), prov = req.headers.get('X-Prov') === 'microsoft' ? 'microsoft' : 'google';
  if (!tok || tok.length > 5000) return '';
  const fp = prov + ':' + b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(tok)))), hit = who.get(fp);
  if (hit && hit.exp > Date.now()) return hit.email;
  let email = '';
  // Google: the token must also have been issued to this app (not to some other site the person signed in to)
  if (prov === 'google') { const r = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(tok)); const j = await r.json().catch(() => ({}));
    const aud = String(env.GOOGLE_CLIENT_ID || ''); if (r.ok && j.email && String(j.email_verified) !== 'false' && (!aud || j.aud === aud || j.azp === aud)) email = ck(j.email); }
  else { const r = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', { headers: { Authorization: 'Bearer ' + tok } }); const j = await r.json().catch(() => ({})); if (r.ok) email = ck(j.mail || j.userPrincipalName); }
  if (email) { if (who.size > 500) who.clear(); who.set(fp, { email, exp: Date.now() + 5 * 60e3 }); }
  return email;
}
let ready = null;
function schema(db) {
  return ready || (ready = db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY, name TEXT, created INTEGER, seq INTEGER DEFAULT 0, share TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS members(company TEXT, email TEXT, role TEXT, status TEXT, name TEXT, invited_by TEXT, at INTEGER, PRIMARY KEY(company, email))'),
    db.prepare('CREATE INDEX IF NOT EXISTS members_email ON members(email)'),
    db.prepare('CREATE TABLE IF NOT EXISTS items(company TEXT, kind TEXT, id TEXT, data TEXT, upd INTEGER, del INTEGER DEFAULT 0, by TEXT, seq INTEGER, PRIMARY KEY(company, kind, id))'),
    db.prepare('CREATE INDEX IF NOT EXISTS items_seq ON items(company, seq)')
  ]).catch(e => { ready = null; throw e; }));
}
const shareOf = c => { let s = {}; try { s = JSON.parse(c.share || '{}') || {}; } catch (_) {} const o = {}; for (const k in SHARE_DEF) o[k] = typeof s[k] === 'boolean' ? s[k] : SHARE_DEF[k]; return o; };
const kindsOf = sh => new Set(Object.keys(sh).filter(k => sh[k]).flatMap(k => KINDS[k]));
async function team(req, env, op, b, json) {
  if (!env.TEAM_DB) return json({ error: 'team_off', detail: 'Add a D1 database binding named TEAM_DB to this Worker.' }, 501);
  const db = env.TEAM_DB; await schema(db);
  const me = await whoIs(req, env); if (!me) return json({ error: 'signin', detail: 'Sign in again.' }, 401);
  const now = Date.now();
  const mine = await db.prepare("SELECT m.company, m.role, c.name, c.share, c.seq FROM members m JOIN companies c ON c.id = m.company WHERE m.email = ? AND m.status = 'active'").bind(me).first();
  const members = id => db.prepare('SELECT email, role, status, name, invited_by, at FROM members WHERE company = ? ORDER BY status, email').bind(id).all().then(r => r.results || []);
  const admin = () => mine && mine.role === 'admin';
  const view = async () => { const m = await db.prepare("SELECT m.company, m.role, c.name, c.share, c.seq FROM members m JOIN companies c ON c.id = m.company WHERE m.email = ? AND m.status = 'active'").bind(me).first();
    const inv = (await db.prepare("SELECT m.company AS id, c.name, m.invited_by FROM members m JOIN companies c ON c.id = m.company WHERE m.email = ? AND m.status = 'invited'").bind(me).all()).results || [];
    return json({ me, company: m ? { id: m.company, name: m.name, share: shareOf(m), seq: m.seq } : null, role: m ? m.role : '', members: m ? await members(m.company) : [], invites: inv }); };
  const name = v => String(v || '').trim().slice(0, 80);
  if (op === 'me') return view();
  if (op === 'create') {
    if (mine) return json({ error: 'in_company', detail: 'Leave your current company first.' }, 409);
    const n = name(b.name); if (!n) return json({ error: 'bad_request', detail: 'Give the company a name.' }, 400);
    const id = b64u(crypto.getRandomValues(new Uint8Array(12)));
    await db.batch([db.prepare('INSERT INTO companies(id, name, created, seq, share) VALUES (?, ?, ?, 0, ?)').bind(id, n, now, JSON.stringify(SHARE_DEF)),
      db.prepare("INSERT INTO members(company, email, role, status, name, invited_by, at) VALUES (?, ?, 'admin', 'active', ?, ?, ?)").bind(id, me, name(b.you), me, now)]);
    return view();
  }
  if (op === 'accept' || op === 'decline') {
    const id = String(b.company || ''), row = await db.prepare("SELECT 1 FROM members WHERE company = ? AND email = ? AND status = 'invited'").bind(id, me).first();
    if (!row) return json({ error: 'no_invite', detail: 'That invitation is no longer there.' }, 404);
    if (op === 'decline') { await db.prepare('DELETE FROM members WHERE company = ? AND email = ?').bind(id, me).run(); return view(); }
    if (mine) return json({ error: 'in_company', detail: 'Leave your current company first.' }, 409);
    await db.prepare("UPDATE members SET status = 'active', at = ?, name = ? WHERE company = ? AND email = ?").bind(now, name(b.you), id, me).run();
    return view();
  }
  if (!mine) return json({ error: 'no_company', detail: 'You are not in a company.' }, 403);
  const co = mine.company;
  if (op === 'rename' || op === 'invite' || op === 'remove' || op === 'role' || op === 'share') {
    if (!admin()) return json({ error: 'not_admin', detail: 'Only an admin can do that.' }, 403);
    if (op === 'rename') { const n = name(b.name); if (n) await db.prepare('UPDATE companies SET name = ? WHERE id = ?').bind(n, co).run(); }
    if (op === 'share') { const sh = shareOf({ share: JSON.stringify(b.share || {}) }); await db.prepare('UPDATE companies SET share = ? WHERE id = ?').bind(JSON.stringify(sh), co).run(); }
    if (op === 'invite') { const e = ck(b.email); if (!okEmail(e)) return json({ error: 'bad_request', detail: 'Check the email address.' }, 400);
      const ex = await db.prepare('SELECT status FROM members WHERE company = ? AND email = ?').bind(co, e).first();
      if (ex && ex.status === 'active') return json({ error: 'exists', detail: e + ' is already in the company.' }, 409);
      if (((await db.prepare('SELECT COUNT(*) AS n FROM members WHERE company = ?').bind(co).first()) || {}).n >= 200) return json({ error: 'full', detail: 'That is a lot of people. Remove someone first.' }, 409);
      await db.prepare("INSERT INTO members(company, email, role, status, name, invited_by, at) VALUES (?, ?, ?, 'invited', '', ?, ?) ON CONFLICT(company, email) DO UPDATE SET role = excluded.role, invited_by = excluded.invited_by, at = excluded.at")
        .bind(co, e, b.role === 'admin' ? 'admin' : 'member', me, now).run(); }
    if (op === 'remove' || op === 'role') { const e = ck(b.email);
      const admins = ((await db.prepare("SELECT COUNT(*) AS n FROM members WHERE company = ? AND role = 'admin' AND status = 'active'").bind(co).first()) || {}).n;
      const t = await db.prepare('SELECT role, status FROM members WHERE company = ? AND email = ?').bind(co, e).first(); if (!t) return json({ error: 'not_found' }, 404);
      const losesAdmin = t.role === 'admin' && t.status === 'active' && (op === 'remove' || b.role !== 'admin');
      if (losesAdmin && admins <= 1) return json({ error: 'last_admin', detail: 'Make someone else an admin first.' }, 409);
      if (op === 'remove') await db.prepare('DELETE FROM members WHERE company = ? AND email = ?').bind(co, e).run();
      else await db.prepare('UPDATE members SET role = ? WHERE company = ? AND email = ?').bind(b.role === 'admin' ? 'admin' : 'member', co, e).run(); }
    return view();
  }
  if (op === 'leave') {
    const all = await members(co), act = all.filter(m => m.status === 'active');
    if (act.length <= 1) { await db.batch([db.prepare('DELETE FROM items WHERE company = ?').bind(co), db.prepare('DELETE FROM members WHERE company = ?').bind(co), db.prepare('DELETE FROM companies WHERE id = ?').bind(co)]); return view(); }
    if (mine.role === 'admin' && act.filter(m => m.role === 'admin').length <= 1) return json({ error: 'last_admin', detail: 'Make someone else an admin before you leave.' }, 409);
    await db.prepare('DELETE FROM members WHERE company = ? AND email = ?').bind(co, me).run(); return view();
  }
  if (op === 'sync') {
    // push: the newest change of each item wins; pull: everything changed since `since` (a company-wide counter)
    const kinds = kindsOf(shareOf(mine)), items = (Array.isArray(b.items) ? b.items : []).slice(0, 300)
      .filter(x => x && kinds.has(x.kind) && typeof x.id === 'string' && x.id && x.id.length <= 200 && +x.upd > 0);
    if (items.length) {
      const top = await db.prepare('UPDATE companies SET seq = seq + ? WHERE id = ? RETURNING seq').bind(items.length, co).first();
      let s = top.seq - items.length;
      const st = db.prepare('INSERT INTO items(company, kind, id, data, upd, del, by, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(company, kind, id) DO UPDATE SET data = excluded.data, upd = excluded.upd, del = excluded.del, by = excluded.by, seq = excluded.seq WHERE excluded.upd > items.upd');
      await db.batch(items.map(x => { const data = x.del ? '' : JSON.stringify(x.data ?? null); return st.bind(co, x.kind, x.id, data.length > 60000 ? 'null' : data, Math.floor(+x.upd), x.del ? Math.floor(+x.del) || Math.floor(+x.upd) : 0, me, ++s); }));
    }
    const since = Math.max(0, Math.floor(+b.since || 0)), lim = 500;
    const kl = [...kinds], rows = kl.length ? ((await db.prepare(`SELECT kind, id, data, upd, del, by, seq FROM items WHERE company = ? AND seq > ? AND kind IN (${kl.map(() => '?').join(',')}) ORDER BY seq LIMIT ?`).bind(co, since, ...kl, lim + 1).all()).results || []) : [];
    const more = rows.length > lim, page = rows.slice(0, lim), cur = await db.prepare('SELECT seq FROM companies WHERE id = ?').bind(co).first();
    return json({ items: page.map(r => ({ kind: r.kind, id: r.id, upd: r.upd, del: r.del || 0, by: r.by, data: r.del ? null : (() => { try { return JSON.parse(r.data); } catch (_) { return null; } })() })),
      seq: page.length ? page[page.length - 1].seq : Math.max(since, cur && !items.length ? cur.seq : since), more, share: shareOf(mine), role: mine.role });
  }
  return json({ error: 'not_found' }, 404);
}
