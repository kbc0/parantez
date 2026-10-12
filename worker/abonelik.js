// (parantez) — abonelik: çift onaylı kayıt, onay ve tek tıkla çıkış.
//
//   POST /api/abone        — e-posta yazılır; onay bağlantısı e-postayla gider
//   GET  /api/abone/onay   — onay bağlantısı (?t=…); abonelik başlar
//   GET  /api/abone/cik    — çıkış sayfası (/abone/cik/), bağlantıdaki anahtarla
//   POST /api/abone/cik    — çıkış; e-postadaki "tek tıkla çık" (RFC 8058) da buraya gelir
//
// Aboneler D1'de (DB, `aboneler`). Eskiden KV'de (ABONELER) duranlar ilk zamanlanmış
// çalışmada D1'e taşınır (kvTasi). Resend anahtarı yoksa kayıt eskisi gibi tek adımlıdır.
// Panelde yönetici listeyi görür, arar ve yönetir (abonePanel: /api/panel/aboneler/*).

import { eposta, EpostaHatasi, h } from './eposta.js';

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ANAHTAR = /^[A-Za-z0-9_-]{20,64}$/;
const TEKRAR = 10 * 60e3; // aynı adrese onay e-postası en fazla 10 dakikada bir
const ONAY_BEKLE = 'neredeyse tamam: e-postana bir onay bağlantısı gönderdim. ona dokununca abonelik başlıyor. birkaç dakikada gelmezse spam klasörüne de bakar mısın?';
const IP_SINIRI = 10; // bir IP'den saatte en fazla bu kadar kayıt denemesi

export const siteAdresi = (env) => (env.SITE_ADRESI || 'https://parantezbulten.com').replace(/\/$/, '');
export const cikisAdresi = (env, anahtar) => `${siteAdresi(env)}/api/abone/cik?t=${anahtar}`;

let semaHazir = null;
export function abonelikSemasi(db) {
  semaHazir ??= db.batch([
    // durum: bekliyor (onay bağlantısı gitti) | onayli | ayrildi | engelli (panelden; siteden yeniden abone olamaz)
    db.prepare(`CREATE TABLE IF NOT EXISTS aboneler (
      eposta TEXT PRIMARY KEY, durum TEXT NOT NULL, anahtar TEXT NOT NULL UNIQUE, kaynak TEXT, ulke TEXT,
      olusturma INTEGER NOT NULL, onay INTEGER, ayrilma INTEGER, son_mektup INTEGER)`),
    db.prepare('CREATE INDEX IF NOT EXISTS aboneler_durum ON aboneler (durum, eposta)'),
    db.prepare('CREATE TABLE IF NOT EXISTS abone_denemeler (ip TEXT NOT NULL, zaman INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS abone_denemeler_ip ON abone_denemeler (ip, zaman)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ayarlar (ad TEXT PRIMARY KEY, deger TEXT)'),
  ]).catch((e) => { semaHazir = null; throw e; });
  return semaHazir;
}

const json = (veri, status = 200) => Response.json(veri, { status, headers: { 'cache-control': 'no-store' } });
const yeniAnahtar = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function ipOzeti(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'yerel';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`parantez-abone:${ip}`));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ kayıt

export async function abone(request, env) {
  const jsonIster = (request.headers.get('accept') || '').includes('application/json');
  // JavaScript yokken form doğrudan buraya gelir; cevap bir sayfaya yönlendirmedir
  const yanit = (status, mesaj, sayfa = '/abone/tamam/') =>
    jsonIster
      ? json({ ok: status < 300, mesaj }, status)
      : status < 300
        ? Response.redirect(new URL(sayfa, request.url), 303)
        : new Response(mesaj, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  if (request.method !== 'POST') return new Response('Yalnızca POST', { status: 405, headers: { allow: 'POST' } });

  let form;
  try { form = await request.formData(); } catch { return yanit(400, 'form okunamadı.'); }
  if (form.get('web')) return yanit(200, 'tamamdır.'); // bot tuzağı

  const adres = String(form.get('eposta') || '').trim().toLowerCase();
  if (!EPOSTA.test(adres) || adres.length > 254) return yanit(400, 'bu bir e-posta adresine benzemiyor. tekrar dener misin?');
  if (!env.DB) return yanit(503, 'abonelik şu an kapalı. birazdan tekrar dener misin?');
  const db = env.DB;
  await abonelikSemasi(db);

  const simdi = Date.now();
  const ip = await ipOzeti(request);
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM abone_denemeler WHERE ip = ? AND zaman > ?').bind(ip, simdi - 3600e3).first();
  if (n >= IP_SINIRI) return yanit(429, 'çok fazla deneme oldu. biraz sonra tekrar dener misin?');
  await db.prepare('INSERT INTO abone_denemeler (ip, zaman) VALUES (?, ?)').bind(ip, simdi).run();
  if (Math.random() < 0.05) await db.prepare('DELETE FROM abone_denemeler WHERE zaman < ?').bind(simdi - 86400e3).run();

  let kayit = await db.prepare('SELECT * FROM aboneler WHERE eposta = ?').bind(adres).first();
  if (!kayit && env.ABONELER && (await env.ABONELER.get(adres))) {
    return yanit(200, 'sen zaten abonesin. bülten her pazartesi 07:30’da gelen kutunda.'); // henüz taşınmamış eski kayıt
  }
  if (kayit?.durum === 'onayli') return yanit(200, 'sen zaten abonesin. bülten her pazartesi 07:30’da gelen kutunda.');
  // Engellenen adres: cevap aynı, ama hiçbir şey gönderilmez ve kayıt değişmez
  if (kayit?.durum === 'engelli') return yanit(201, ONAY_BEKLE, '/abone/son-adim/');

  const kaynak = String(form.get('kaynak') || 'site').slice(0, 60);
  const ulke = request.cf?.country ?? null;

  // Resend kurulmadıysa onay e-postası gidemez: kayıt eskisi gibi tek adımda tamamlanır
  if (!env.RESEND_API_KEY) {
    if (kayit) await db.prepare("UPDATE aboneler SET durum = 'onayli', onay = ?, ayrilma = NULL WHERE eposta = ?").bind(simdi, adres).run();
    else await db.prepare("INSERT INTO aboneler (eposta, durum, anahtar, kaynak, ulke, olusturma, onay) VALUES (?, 'onayli', ?, ?, ?, ?, ?)")
      .bind(adres, yeniAnahtar(), kaynak, ulke, simdi, simdi).run();
    return yanit(201, 'tamamdır, kaydettim. pazartesi 07:30’da gelen kutundayız.');
  }

  const bekle = ONAY_BEKLE;
  if (kayit?.durum === 'bekliyor' && kayit.son_mektup > simdi - TEKRAR) return yanit(200, bekle, '/abone/son-adim/');

  if (!kayit) {
    kayit = { eposta: adres, anahtar: yeniAnahtar() };
    await db.prepare("INSERT INTO aboneler (eposta, durum, anahtar, kaynak, ulke, olusturma, son_mektup) VALUES (?, 'bekliyor', ?, ?, ?, ?, ?)")
      .bind(adres, kayit.anahtar, kaynak, ulke, simdi, simdi).run();
  } else {
    await db.prepare("UPDATE aboneler SET durum = 'bekliyor', son_mektup = ?, kaynak = ? WHERE eposta = ?").bind(simdi, kaynak, adres).run();
  }

  try {
    await eposta(env).gonder({ to: adres, ...onayEpostasi(env, kayit.anahtar) });
  } catch (e) {
    console.error('onay e-postası gitmedi', e.message);
    await db.prepare('UPDATE aboneler SET son_mektup = NULL WHERE eposta = ?').bind(adres).run();
    if (e instanceof EpostaHatasi) return yanit(502, 'onay e-postasını şu an gönderemedim. birazdan tekrar dener misin?');
    throw e;
  }
  return yanit(201, bekle, '/abone/son-adim/');
}

// ------------------------------------------------------------------ onay ve çıkış

export async function onayla(request, env, url) {
  const git = (sayfa) => Response.redirect(new URL(sayfa, url), 303);
  const t = url.searchParams.get('t') || '';
  if (!env.DB || !ANAHTAR.test(t)) return git('/abone/');
  await abonelikSemasi(env.DB);
  const k = await env.DB.prepare('SELECT eposta, durum FROM aboneler WHERE anahtar = ?').bind(t).first();
  if (!k || k.durum === 'ayrildi' || k.durum === 'engelli') return git('/abone/');
  if (k.durum === 'bekliyor') await env.DB.prepare("UPDATE aboneler SET durum = 'onayli', onay = ?, ayrilma = NULL WHERE anahtar = ?").bind(Date.now(), t).run();
  return git('/abone/tamam/');
}

export async function cik(request, env, url) {
  // Sayfa: /abone/cik/ statik sayfası, formuna bağlantıdaki anahtar konarak.
  // E-posta güvenlik tarayıcıları bağlantıları açabildiği için çıkış yalnızca POST ile olur.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const t = url.searchParams.get('t') || '';
    if (!ANAHTAR.test(t)) return Response.redirect(new URL('/abone/gecersiz/', url), 303);
    const sayfa = await env.ASSETS.fetch(new Request(new URL('/abone/cik/', url)));
    const yeni = new HTMLRewriter()
      .on('input[name="t"]', { element(el) { el.setAttribute('value', t); } })
      .transform(sayfa);
    const r = new Response(yeni.body, yeni);
    r.headers.set('cache-control', 'no-store');
    r.headers.set('x-robots-tag', 'noindex');
    return r;
  }
  if (request.method !== 'POST') return new Response('İzin yok', { status: 405, headers: { allow: 'GET, POST' } });

  let t = url.searchParams.get('t') || '';
  let tekTik = false;
  try {
    const form = await request.formData();
    if (form.get('t')) t = String(form.get('t'));
    tekTik = form.get('List-Unsubscribe') === 'One-Click';
  } catch { /* gövdesiz istek */ }
  const gecersiz = () => (tekTik
    ? new Response('geçersiz bağlantı', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    : Response.redirect(new URL('/abone/gecersiz/', url), 303));
  if (!env.DB || !ANAHTAR.test(t)) return gecersiz();
  await abonelikSemasi(env.DB);
  const k = await env.DB.prepare('SELECT durum FROM aboneler WHERE anahtar = ?').bind(t).first();
  if (!k) return gecersiz();
  if (k.durum === 'onayli' || k.durum === 'bekliyor') await env.DB.prepare("UPDATE aboneler SET durum = 'ayrildi', ayrilma = ? WHERE anahtar = ?").bind(Date.now(), t).run();
  if (tekTik) return new Response('ok', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return Response.redirect(new URL('/abone/ayrildin/', url), 303);
}

// ------------------------------------------------------------------ eski KV kayıtları

// KV'deki eski aboneleri bir kez D1'e taşır (onaylı sayılırlar: siteye kendileri yazdılar).
export async function kvTasi(env) {
  if (!env.ABONELER || !env.DB) return;
  await abonelikSemasi(env.DB);
  const bitti = await env.DB.prepare("SELECT deger FROM ayarlar WHERE ad = 'kv_tasindi'").first();
  if (bitti) return;
  let imlec;
  let adet = 0;
  do {
    const l = await env.ABONELER.list({ cursor: imlec, limit: 1000 });
    const satirlar = [];
    for (const k of l.keys) {
      const adres = k.name.toLowerCase();
      if (!EPOSTA.test(adres)) continue;
      let v = {};
      try { v = JSON.parse((await env.ABONELER.get(k.name)) || '{}'); } catch { /* bozuk kayıt */ }
      const zaman = Date.parse(v.tarih) || Date.now();
      satirlar.push(env.DB.prepare("INSERT OR IGNORE INTO aboneler (eposta, durum, anahtar, kaynak, ulke, olusturma, onay) VALUES (?, 'onayli', ?, ?, ?, ?, ?)")
        .bind(adres, yeniAnahtar(), v.kaynak ?? 'site', v.ulke ?? null, zaman, zaman));
    }
    if (satirlar.length) await env.DB.batch(satirlar);
    adet += satirlar.length;
    imlec = l.list_complete ? undefined : l.cursor;
  } while (imlec);
  await env.DB.prepare("INSERT OR REPLACE INTO ayarlar (ad, deger) VALUES ('kv_tasindi', ?)").bind(String(Date.now())).run();
  if (adet) console.log(`KV'den ${adet} abone taşındı`);
}

export async function aboneSayilari(db) {
  await abonelikSemasi(db);
  const { results } = await db.prepare('SELECT durum, COUNT(*) AS n FROM aboneler GROUP BY durum').all();
  const s = { onayli: 0, bekliyor: 0, ayrildi: 0, engelli: 0 };
  for (const r of results) s[r.durum] = r.n;
  return s;
}

// ------------------------------------------------------------------ panel: /api/panel/aboneler/*

const DURUMLAR = ['onayli', 'bekliyor', 'ayrildi', 'engelli'];
const SAYFA_BOYU = 50;
const isoTarih = (t) => (t ? new Date(t).toISOString() : '');
const csvHucre = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));

// Abone listesi kişisel veri: yalnızca yönetici görür ve değiştirir
export async function abonePanel(yol, yontem, veri, ben, env, url) {
  const db = env.DB;
  if (ben.yetki !== 'yonetici') return json({ hata: 'Abone listesini yalnızca yönetici görebilir.' }, 403);
  await abonelikSemasi(db);
  const hata = (status, mesaj) => json({ hata: mesaj }, status);

  if (yol === 'aboneler' && yontem === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 100);
    const durum = DURUMLAR.includes(url.searchParams.get('durum')) ? url.searchParams.get('durum') : '';
    const atla = Math.max(0, Number(url.searchParams.get('atla')) || 0);
    const kosul = 'WHERE (?1 = \'\' OR instr(eposta, ?1) > 0) AND (?2 = \'\' OR durum = ?2)';
    const { results } = await db.prepare(`SELECT eposta, durum, kaynak, ulke, olusturma, onay, ayrilma FROM aboneler ${kosul}
      ORDER BY olusturma DESC, eposta LIMIT ?3 OFFSET ?4`).bind(q, durum, SAYFA_BOYU + 1, atla).all();
    const { n } = await db.prepare(`SELECT COUNT(*) AS n FROM aboneler ${kosul}`).bind(q, durum).first();
    return json({ liste: results.slice(0, SAYFA_BOYU), devami: results.length > SAYFA_BOYU, toplam: n, sayilar: await aboneSayilari(db) });
  }

  if (yol === 'aboneler/csv' && yontem === 'GET') {
    const { results } = await db.prepare('SELECT eposta, durum, kaynak, ulke, olusturma, onay, ayrilma FROM aboneler ORDER BY olusturma').all();
    const satirlar = [['eposta', 'durum', 'kaynak', 'ulke', 'kayit', 'onay', 'ayrilma'],
      ...results.map((r) => [r.eposta, r.durum, r.kaynak, r.ulke, isoTarih(r.olusturma), isoTarih(r.onay), isoTarih(r.ayrilma)])];
    return new Response(`\ufeff${satirlar.map((s) => s.map(csvHucre).join(',')).join('\n')}\n`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store',
        'content-disposition': `attachment; filename="parantez-aboneler-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }
  if (yontem !== 'POST') return hata(404, 'Bulunamadı.');

  const adres = String(veri.eposta || '').trim().toLowerCase();
  if (!EPOSTA.test(adres) || adres.length > 254) return hata(400, 'Bu bir e-posta adresine benzemiyor.');
  const simdi = Date.now();
  const k = await db.prepare('SELECT * FROM aboneler WHERE eposta = ?').bind(adres).first();

  // Elle ekleme de onayla olur: eklenen adrese onay e-postası gider
  if (yol === 'aboneler/ekle') {
    if (k) return hata(409, `Bu adres listede zaten var (${{ onayli: 'onaylı', bekliyor: 'onay bekliyor', ayrildi: 'ayrılmış', engelli: 'engelli' }[k.durum]}).`);
    if (!env.RESEND_API_KEY) return hata(503, 'Onay e-postası gidemez: Cloudflare\'de RESEND_API_KEY tanımlanmalı.');
    const anahtar = yeniAnahtar();
    await db.prepare("INSERT INTO aboneler (eposta, durum, anahtar, kaynak, olusturma, son_mektup) VALUES (?, 'bekliyor', ?, 'panel', ?, ?)")
      .bind(adres, anahtar, simdi, simdi).run();
    try {
      await eposta(env).gonder({ to: adres, ...onayEpostasi(env, anahtar) });
    } catch (e) {
      await db.prepare('DELETE FROM aboneler WHERE eposta = ?').bind(adres).run();
      if (e instanceof EpostaHatasi) return hata(502, `Onay e-postası gidemedi: ${e.message}`);
      throw e;
    }
    return json({ ok: true, mesaj: `${adres} adresine onay e-postası gitti. Onaylayınca abone olur.` });
  }

  if (yol !== 'aboneler/islem') return hata(404, 'Bulunamadı.');
  if (!k) return hata(404, 'Bu adres listede yok.');
  const islem = String(veri.islem || '');
  const durumu = (yeni, ek = '') => db.prepare(`UPDATE aboneler SET durum = ?${ek} WHERE eposta = ?`);

  if (islem === 'onayla') {
    if (k.durum !== 'bekliyor') return hata(409, 'Yalnızca onay bekleyen bir adres elle onaylanabilir.');
    await durumu('onayli', ', onay = ?, ayrilma = NULL').bind('onayli', simdi, adres).run();
    return json({ ok: true, mesaj: `${adres} onaylandı; bültenler gidecek.` });
  }
  if (islem === 'yeniden-gonder') {
    if (k.durum !== 'bekliyor') return hata(409, 'Onay e-postası yalnızca onay bekleyen adrese gönderilir.');
    if (!env.RESEND_API_KEY) return hata(503, 'Onay e-postası gidemez: Cloudflare\'de RESEND_API_KEY tanımlanmalı.');
    if (k.son_mektup > simdi - TEKRAR) return hata(429, 'Bu adrese 10 dakika içinde zaten onay e-postası gitti.');
    await eposta(env).gonder({ to: adres, ...onayEpostasi(env, k.anahtar) });
    await db.prepare('UPDATE aboneler SET son_mektup = ? WHERE eposta = ?').bind(simdi, adres).run();
    return json({ ok: true, mesaj: `${adres} adresine onay e-postası yeniden gitti.` });
  }
  if (islem === 'cikar') {
    if (k.durum !== 'onayli' && k.durum !== 'bekliyor') return hata(409, 'Bu adres zaten listede değil.');
    await durumu('ayrildi', ', ayrilma = ?').bind('ayrildi', simdi, adres).run();
    return json({ ok: true, mesaj: `${adres} listeden çıkarıldı.` });
  }
  if (islem === 'engelle') {
    if (k.durum === 'engelli') return hata(409, 'Bu adres zaten engelli.');
    await durumu('engelli', ', ayrilma = ?').bind('engelli', simdi, adres).run();
    return json({ ok: true, mesaj: `${adres} engellendi; bülten gitmez, siteden de abone olamaz.` });
  }
  if (islem === 'engeli-kaldir') {
    if (k.durum !== 'engelli') return hata(409, 'Bu adres engelli değil.');
    await durumu('ayrildi').bind('ayrildi', adres).run();
    return json({ ok: true, mesaj: `${adres} için engel kalktı. İsterse siteden yeniden abone olabilir.` });
  }
  if (islem === 'sil') {
    await db.prepare('DELETE FROM aboneler WHERE eposta = ?').bind(adres).run();
    return json({ ok: true, mesaj: `${adres} ve kaydı tamamen silindi.` });
  }
  return hata(400, 'Bilinmeyen işlem.');
}

// ------------------------------------------------------------------ onay e-postası

const YAZI = "'Hanken Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export function onayEpostasi(env, anahtar) {
  const site = siteAdresi(env);
  const baglanti = `${site}/api/abone/onay?t=${anahtar}`;
  const balon = (metin) => `<tr><td style="padding:0 0 4px 44px"><div style="display:inline-block;max-width:460px;padding:10px 14px;border-radius:20px;background:#f1f1ed;color:#111111;font-size:17px;line-height:1.5">${metin}</div></td></tr>`;
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>Aboneliğini onaylar mısın?</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${YAZI};color:#111111">
<tr><td style="padding:0 0 22px;font-size:22px;font-weight:800;letter-spacing:-0.02em">(parantez)</td></tr>
<tr><td style="padding:0 0 4px 44px;font-size:12px;font-weight:600;color:#84847f">(parantez)</td></tr>
<tr><td style="padding:0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="top" style="padding:0 8px 0 0"><div style="width:36px;height:36px;border-radius:50%;background:#111111;color:#ffffff;font-size:12px;font-weight:800;line-height:36px;text-align:center">(p)</div></td>
<td><div style="display:inline-block;max-width:460px;padding:10px 14px;border-radius:20px;background:#f1f1ed;font-size:17px;line-height:1.5">selam! bu adresi (parantez)’e abone olmak için yazdın.</div></td></tr></table></td></tr>
${balon('bir dokunuşla onaylar mısın? sonra her pazartesi 07:30’da haftanın özeti ve beş yazı gelir.')}
<tr><td style="padding:14px 0 0 44px"><a href="${h(baglanti)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#2a35ff;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">aboneliğimi onayla →</a></td></tr>
<tr><td style="padding:28px 0 0 44px;font-size:13px;line-height:1.5;color:#84847f">bunu sen yazmadıysan e-postayı görmezden gel; başka bir şey gelmez.<br><a href="${h(site)}" style="color:#84847f">parantezbulten.com</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `selam! bu adresi (parantez)'e abone olmak için yazdın.\n\nonaylamak için: ${baglanti}\n\nsonra her pazartesi 07:30'da haftanın özeti ve beş yazı gelir. bunu sen yazmadıysan e-postayı görmezden gel; başka bir şey gelmez.`;
  return { subject: 'aboneliğini onaylar mısın?', html, text };
}
