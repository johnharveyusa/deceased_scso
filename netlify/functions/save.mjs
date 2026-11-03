// End of Watch "save helper".
// The memorial page sends an administrator's edits here together with the
// passcode. This helper checks the passcode, then saves the edits to GitHub
// using ONE key that only lives in Netlify's settings (GITHUB_TOKEN).
// Administrators never see or handle a key.
import vm from 'node:vm';

const REPO = 'johnharveyusa/deceased_scso';
const FILE = 'index.html';
const ADMIN_HASH = 111271057249131;           // same passcode as the page
const ALLOWED_ORIGINS = ['https://johnharveyusa.github.io'];

function cyrb53(s, seed = 7) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function rankUnit(r) { return { 'Sheriff': 1, 'Chief Deputy': 2, 'CAO': 2.5, 'Asst Chief': 4, 'Chief Inspector': 4.5, 'Inspector': 5, 'Captain': 6, 'Lieutenant': 7, 'Sergeant': 8, 'Patrolman': 9, 'Reserve': 10 }[r] || 9; }
const q = s => JSON.stringify(String(s == null ? '' : s));

function insertOfficer(DATA, rec) {
  const last = o => o.n.replace(/["']/g, '').trim().split(/\s+/).pop().toLowerCase();
  let after = -1;
  for (let i = 0; i < DATA.length; i++) {
    if (DATA[i].r !== rec.r) continue;
    if (last(DATA[i]) > last(rec)) { DATA.splice(i, 0, rec); return; }
    after = i;
  }
  if (after >= 0) DATA.splice(after + 1, 0, rec); else DATA.push(rec);
}
function mergeEdits(DATA, ED) {
  Object.entries(ED).forEach(([n, x]) => {
    if (!x || !x.add) return;
    const add = Object.assign({}, x.add, { u: rankUnit(x.add.r) });
    const ex = DATA.find(o => o.n === n);
    if (ex) Object.assign(ex, add);
    else insertOfficer(DATA, Object.assign({ e: '', ob: '', fb: '', dod: '', obt: '', ph: '', y: null, lod: false, notes: '' }, add));
  });
  Object.entries(ED).forEach(([n, x]) => { if (x && x.del) { const i = DATA.findIndex(o => o.n === n); if (i >= 0) DATA.splice(i, 1); } });
  DATA.forEach(o => {
    const x = ED[o.n];
    if (x && !x.del && 'e' in x) {
      o.e = x.e; o.ob = x.ob; o.fb = x.fb; o.obt = x.obt || o.obt || '';
      if ('ph' in x) o.ph = x.ph; if ('gal' in x) o.gal = x.gal;
      if ('y' in x) { o.dod = x.dod || ''; o.y = x.y; }
    }
  });
}
function buildPageSource(src, DATA) {
  const lines = DATA.map(o => `{n:${q(o.n)},r:${q(o.r)},u:${o.u},y:${o.y == null ? 'null' : o.y},lod:${!!o.lod},notes:${q(o.notes)},e:${q(o.e)},ob:${q(o.ob)},fb:${q(o.fb)},dod:${q(o.dod)}${o.obt ? ',obt:' + q(o.obt) : ''}${o.ph ? ',ph:' + q(o.ph) : ''}${(o.gal && o.gal.length) ? ',gal:[' + o.gal.map(q).join(',') + ']' : ''}}`);
  src = src.replace(/const EMBEDDED = \[[\s\S]*?\n\];/, () => 'const EMBEDDED = [\n' + lines.join(',\n') + '\n];');
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return src.replace(/LAST UPDATED \d\d\/\d\d\/\d{4}/, 'LAST UPDATED ' + mm + '/' + dd + '/' + d.getFullYear());
}
function cleanEdits(ED) {
  // only keep the fields the page uses, as plain text, so nothing odd gets written
  const S = v => typeof v === 'string' ? v.slice(0, 40000) : '';
  const out = {};
  for (const [n, x] of Object.entries(ED || {}).slice(0, 400)) {
    if (typeof n !== 'string' || !n.trim() || !x || typeof x !== 'object') continue;
    if (x.del) { out[n] = { del: true }; continue; }
    const c = {};
    if (x.add) c.add = { n: S(x.add.n) || n, r: S(x.add.r) || 'Patrolman', lod: !!x.add.lod, notes: S(x.add.notes) };
    if ('e' in x) {
      Object.assign(c, { e: S(x.e), ob: /^https?:\/\//i.test(x.ob || '') ? S(x.ob) : '', fb: /^https?:\/\//i.test(x.fb || '') ? S(x.fb) : '', dod: S(x.dod), obt: S(x.obt) });
      c.y = Number.isInteger(x.y) ? x.y : null;
      if ('ph' in x) c.ph = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(x.ph || '') ? x.ph : '';
      if (Array.isArray(x.gal)) c.gal = x.gal.filter(g => typeof g === 'string' && (/^photos\/[a-z0-9.\-]+\.jpg$/.test(g) || /^data:image\/jpeg;base64,/.test(g))).slice(0, 60);
    }
    out[n] = c;
  }
  return out;
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: cors });
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: cors });
  if (req.method === 'GET') return reply(200, { ok: true, ready: !!process.env.GITHUB_TOKEN });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });

  let body;
  try { body = await req.json(); } catch { return reply(400, { error: 'Bad request' }); }
  if (cyrb53(String(body.passcode || '').trim().toUpperCase()) !== ADMIN_HASH) return reply(401, { error: 'Wrong passcode' });
  const token = process.env.GITHUB_TOKEN;
  if (!token) return reply(500, { error: 'The helper has no GitHub key yet (GITHUB_TOKEN).' });
  const edits = cleanEdits(body.edits);
  if (!Object.keys(edits).length) return reply(400, { error: 'Nothing to save' });

  const api = 'https://api.github.com/repos/' + REPO + '/contents/';
  const hdr = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'end-of-watch-helper', 'Content-Type': 'application/json' };
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const cur = await fetch(api + FILE + '?ref=main', { headers: hdr });
      if (cur.status === 401 || cur.status === 403) return reply(502, { error: 'GitHub did not accept the helper\'s key. It may have expired.' });
      if (!cur.ok) throw new Error('GitHub answered ' + cur.status);
      const info = await cur.json();
      let src = Buffer.from(info.content, 'base64').toString('utf8');
      if (!src.includes('const EMBEDDED = [')) {   // very large files come back without content
        const raw = await fetch(info.download_url, { headers: { 'User-Agent': 'end-of-watch-helper' } });
        src = await raw.text();
      }
      const m = src.match(/const EMBEDDED = (\[[\s\S]*?\n\]);/);
      const DATA = vm.runInNewContext('(' + m[1] + ')', {}, { timeout: 2000 });
      mergeEdits(DATA, edits);
      // gallery photos go up as separate files
      for (const o of DATA) {
        if (!o.gal) continue;
        for (let i = 0; i < o.gal.length; i++) {
          if (!/^data:image\//.test(o.gal[i])) continue;
          const slug = o.n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const path = 'photos/' + slug + '-' + Date.now().toString(36) + '-' + i + '.jpg';
          const r = await fetch(api + path, { method: 'PUT', headers: hdr, body: JSON.stringify({ message: 'Photo for ' + o.n, content: o.gal[i].split(',')[1], branch: 'main' }) });
          if (!r.ok) throw new Error('photo upload failed (' + r.status + ')');
          o.gal[i] = path;
        }
      }
      const names = Object.keys(edits);
      const put = await fetch(api + FILE, {
        method: 'PUT', headers: hdr,
        body: JSON.stringify({ message: 'Memorial update: ' + names.slice(0, 3).join(', ') + (names.length > 3 ? ' and ' + (names.length - 3) + ' more' : ''), content: Buffer.from(buildPageSource(src, DATA), 'utf8').toString('base64'), sha: info.sha, branch: 'main' })
      });
      if ((put.status === 409 || put.status === 422) && attempt < 3) { await new Promise(r => setTimeout(r, 1200)); continue; }
      if (!put.ok) throw new Error('GitHub answered ' + put.status);
      return reply(200, { ok: true, officers: DATA.length });
    }
    return reply(503, { error: 'Busy, please try again' });
  } catch (e) {
    return reply(500, { error: String(e.message || e) });
  }
};
