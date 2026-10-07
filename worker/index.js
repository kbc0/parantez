// (parantez) — Cloudflare Worker
// Statik sayfaları `dist/` klasöründen Cloudflare servis eder; bu dosya yalnızca
// statik dosyası olmayan istekleri karşılar:
//   POST /api/abone  — e-posta aboneliği (KV: ABONELER)
//   GET  /api/tepki  — bir sayfadaki tepki sayıları (D1: DB)
//   POST /api/tepki  — tepki ver / geri al

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMOJI = ['❤️', '😂', '😮', '😢', '🔥'];
const SAYFA = /^(sayi-\d{1,4}|yazi-[a-z0-9-]{1,90}|hakkinda)$/;
const MESAJ = /^[a-z0-9-]{1,40}$/;
const KIMLIK = /^[a-z0-9-]{8,64}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const yol = url.pathname.replace(/\/$/, '');
    if (yol === '/api/abone') return abone(request, env);
    if (yol === '/api/tepki') return tepki(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

const json = (veri, status = 200) =>
  Response.json(veri, { status, headers: { 'cache-control': 'no-store' } });

// ------------------------------------------------------------------ abonelik

async function abone(request, env) {
  const jsonIster = (request.headers.get('accept') || '').includes('application/json');
  const yanit = (status, mesaj) =>
    jsonIster
      ? json({ ok: status < 300, mesaj }, status)
      : status < 300
        ? Response.redirect(new URL('/abone/tamam/', request.url), 303)
        : new Response(mesaj, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  if (request.method !== 'POST') return new Response('Yalnızca POST', { status: 405, headers: { allow: 'POST' } });

  let form;
  try { form = await request.formData(); } catch { return yanit(400, 'form okunamadı.'); }

  if (form.get('web')) return yanit(200, 'tamamdır.'); // bot tuzağı

  const eposta = String(form.get('eposta') || '').trim().toLowerCase();
  if (!EPOSTA.test(eposta) || eposta.length > 254) return yanit(400, 'bu bir e-posta adresine benzemiyor. tekrar dener misin?');
  if (!env.ABONELER) return yanit(503, 'abonelik şu an kapalı. birazdan tekrar dener misin?');

  if (await env.ABONELER.get(eposta)) return yanit(200, 'sen zaten abonesin. bülten her pazartesi 07:30’da gelen kutunda.');

  await env.ABONELER.put(eposta, JSON.stringify({
    tarih: new Date().toISOString(),
    kaynak: String(form.get('kaynak') || 'site').slice(0, 60),
    ulke: request.cf?.country ?? null,
  }));
  return yanit(201, 'tamamdır, kaydettim. pazartesi 07:30’da gelen kutundayız.');
}

// ------------------------------------------------------------------ tepkiler

let semaHazir = null;
function sema(db) {
  semaHazir ??= db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS tepkiler (
      sayfa TEXT NOT NULL, mesaj TEXT NOT NULL, kullanici TEXT NOT NULL,
      emoji TEXT NOT NULL, ip TEXT NOT NULL, zaman INTEGER NOT NULL,
      PRIMARY KEY (sayfa, mesaj, kullanici))`),
    db.prepare('CREATE INDEX IF NOT EXISTS tepkiler_ip ON tepkiler (ip, zaman)'),
  ]).catch((e) => { semaHazir = null; throw e; });
  return semaHazir;
}

async function ipOzeti(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'yerel';
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`parantez:${ip}`));
  return [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sayfaSayilari(db, sayfa) {
  const { results } = await db.prepare(
    'SELECT mesaj, emoji, COUNT(*) AS n FROM tepkiler WHERE sayfa = ? GROUP BY mesaj, emoji',
  ).bind(sayfa).all();
  const sayilar = {};
  for (const r of results) (sayilar[r.mesaj] ??= {})[r.emoji] = r.n;
  return sayilar;
}

async function tepki(request, env, url) {
  if (!env.DB) return json({ hata: 'kapalı' }, 503);
  await sema(env.DB);

  if (request.method === 'GET') {
    const sayfa = url.searchParams.get('sayfa') || '';
    const k = url.searchParams.get('k') || '';
    if (!SAYFA.test(sayfa)) return json({ hata: 'sayfa' }, 400);
    const sayilar = await sayfaSayilari(env.DB, sayfa);
    const benim = {};
    if (KIMLIK.test(k)) {
      const { results } = await env.DB.prepare('SELECT mesaj, emoji FROM tepkiler WHERE sayfa = ? AND kullanici = ?').bind(sayfa, k).all();
      for (const r of results) benim[r.mesaj] = r.emoji;
    }
    return json({ sayilar, benim });
  }

  if (request.method !== 'POST') return new Response('İzin yok', { status: 405, headers: { allow: 'GET, POST' } });

  // Yalnızca kendi sayfalarımızdan gelen istekler
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ hata: 'köken' }, 403);

  let veri;
  try { veri = await request.json(); } catch { return json({ hata: 'json' }, 400); }
  const { sayfa, mesaj, emoji, k } = veri ?? {};
  if (!SAYFA.test(sayfa) || !MESAJ.test(mesaj) || !EMOJI.includes(emoji) || !KIMLIK.test(k)) return json({ hata: 'geçersiz' }, 400);

  const ip = await ipOzeti(request);
  const simdi = Date.now();
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM tepkiler WHERE ip = ? AND zaman > ?').bind(ip, simdi - 60_000).first();
  if (n > 40) return json({ hata: 'yavaş' }, 429);

  const once = await env.DB.prepare('SELECT emoji FROM tepkiler WHERE sayfa = ? AND mesaj = ? AND kullanici = ?').bind(sayfa, mesaj, k).first();
  let benim = emoji;
  if (once?.emoji === emoji) {
    await env.DB.prepare('DELETE FROM tepkiler WHERE sayfa = ? AND mesaj = ? AND kullanici = ?').bind(sayfa, mesaj, k).run();
    benim = null;
  } else {
    await env.DB.prepare(
      'INSERT OR REPLACE INTO tepkiler (sayfa, mesaj, kullanici, emoji, ip, zaman) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(sayfa, mesaj, k, emoji, ip, simdi).run();
  }

  const { results } = await env.DB.prepare(
    'SELECT emoji, COUNT(*) AS n FROM tepkiler WHERE sayfa = ? AND mesaj = ? GROUP BY emoji',
  ).bind(sayfa, mesaj).all();
  const sayilar = Object.fromEntries(results.map((r) => [r.emoji, r.n]));
  return json({ sayilar, benim });
}
