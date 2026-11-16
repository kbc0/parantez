// (parantez) — Cloudflare Worker
// Statik sayfaları `dist/` klasöründen Cloudflare servis eder; bu dosya yalnızca
// statik dosyası olmayan istekleri karşılar:
//   /api/abone/*     — abonelik: kayıt, onay, çıkış (worker/abonelik.js; D1: DB)
//   GET  /api/tepki  — bir sayfadaki tepki sayıları (D1: DB)
//   POST /api/tepki  — tepki ver / geri al
//   /api/panel/*     — yazı paneli (/admin): giriş, hesaplar, içerik, bülten (worker/panel.js)
//   /sayi/*, /yazi/*, /hakkinda/ — statik sayfa, tepki sayıları içine yazılmış olarak (tepkiliSayfa)
// Her dakika çalışan zamanlayıcı (scheduled) planlanan bülteni yayınlar ve gönderir (worker/gonderim.js).

import { panel } from './panel.js';
import { abone, cik, onayla } from './abonelik.js';
import { zamanla } from './gonderim.js';

const EMOJI = ['❤️', '😂', '😮', '😢', '🔥'];
const SAYFA = /^(sayi-\d{1,4}|yazi-[a-z0-9-]{1,90}|arastirma-[a-z0-9-]{1,90}|hakkinda)$/;
const MESAJ = /^[a-z0-9-]{1,40}$/;
const KIMLIK = /^[a-z0-9-]{8,64}$/;
// Tepki alan sayfalar: adresten sayfa anahtarı (sayi-3, yazi-faiz-sabit, hakkinda)
const TEPKILI = /^\/(sayi\/\d{1,4}|yazi\/[a-z0-9-]{1,90}|hakkinda)\/$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const yol = url.pathname.replace(/\/$/, '');
    if (yol === '/api/abone') return abone(request, env);
    if (yol === '/api/abone/onay') return onayla(request, env, url);
    if (yol === '/api/abone/cik') return cik(request, env, url);
    if (yol === '/api/tepki') return tepki(request, env, url);
    if (yol === '/api/panel' || yol.startsWith('/api/panel/')) return panel(request, env, url);
    const tepkili = url.pathname.match(TEPKILI);
    if (tepkili && (request.method === 'GET' || request.method === 'HEAD')) return tepkiliSayfa(request, env, tepkili[1].replace('/', '-'));
    return env.ASSETS.fetch(request);
  },

  async scheduled(olay, env, ctx) {
    ctx.waitUntil(zamanla(env));
  },
};

const json = (veri, status = 200) =>
  Response.json(veri, { status, headers: { 'cache-control': 'no-store' } });

// ------------------------------------------------------------------ tepkili sayfalar
// Tepki sayıları sayfa açıldıktan sonra ayrı bir istekle gelince balonların altına sonradan ekleniyor,
// sayfa kayıyordu. Sayılar artık HTML'e baştan yazılır; betik (sohbet.ts, okuma.ts) yalnızca okurun
// kendi tepkisini işaretler. Sayfanın yapısı sohbet.ts'teki çizimle aynı olmalı (ciz, paragraf kimlikleri).

const kac = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const tkHtml = (sayilar) => `<span class="tk">${Object.entries(sayilar).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  .map(([e, n]) => `<button type="button" class="tkb" data-e="${kac(e)}" aria-label="${kac(e)} ${n}">${kac(e)}<span>${n}</span></button>`).join('')}</span>`;

async function tepkiliSayfa(request, env, sayfa) {
  const r = await env.ASSETS.fetch(request);
  if (r.status !== 200 || !(r.headers.get('content-type') || '').includes('text/html') || !env.DB) return r;
  let sayilar;
  try {
    await sema(env.DB);
    sayilar = await sayfaSayilari(env.DB, sayfa);
  } catch { return r; } // tepkiler kapalı: sayfa yine çalışır

  const dolu = (id) => Object.values(sayilar[id] ?? {}).some((n) => n > 0);
  const isle = (el, id) => {
    if (!dolu(id)) return;
    el.setAttribute('class', `${el.getAttribute('class') ?? ''} has-tk`.trim());
    el.append(tkHtml(sayilar[id]), { html: true });
  };
  // Markdown'dan gelen paragraflara sohbet.ts'deki gibi sırayla kimlik ver (not1, not2…)
  const akis = { on: 'p', i: 0 };
  const paragraf = { element(el) { if (el.getAttribute('data-tepki') === null) { const id = `${akis.on}${++akis.i}`; el.setAttribute('data-tepki', id); isle(el, id); } } };
  // Yazının tek tepki satırı: sayılar düğmelerin içine
  const yazi = sayilar.yazi ?? {};
  let dugme = '';
  let rw = new HTMLRewriter()
    .on('.flow', { element(el) { akis.on = el.getAttribute('data-flow') || 'p'; akis.i = 0; } })
    .on('[data-tepki]', { element(el) { isle(el, el.getAttribute('data-tepki')); } })
    .on('[data-yazi-tepki]', { element(el) { el.removeAttribute('hidden'); el.setAttribute('data-hazir', ''); } })
    .on('[data-yazi-tepki] button[data-e]', { element(el) {
      dugme = el.getAttribute('data-e');
      if (yazi[dugme]) el.setAttribute('aria-label', `${dugme} ile tepki ver (${yazi[dugme]})`);
    } })
    .on('[data-yazi-tepki] button[data-e] > span', { element(el) { if (yazi[dugme]) el.setInnerContent(String(yazi[dugme])); } });
  for (const t of ['p', 'ul', 'ol', 'blockquote']) rw = rw.on(`.flow > ${t}`, paragraf);

  const yeni = rw.transform(r);
  const h = new Headers(yeni.headers);
  h.delete('etag');
  h.set('cache-control', 'no-cache');
  return new Response(yeni.body, { status: 200, headers: h });
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
