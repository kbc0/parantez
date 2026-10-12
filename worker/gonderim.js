// (parantez) — bültenin gönderimi.
//
// Panelden bir sayı planlanır (Bülten sayfası). Sonrasını her dakika çalışan zamanlayıcı yürütür:
//   planli       → yayın saatinden 10 dakika önce sayı gizliyse görünür yapılır (GitHub'a commit)
//   yayinda      → yayın saatinde, site yeni hâliyle yayına çıktıysa e-posta hazırlanır ve dondurulur
//   gonderiliyor → her dakika 2 × 50 aboneye; hepsine gidince
//   bitti
// Planlanan gönderim, gönderim sürerken bile panelden iptal edilebilir (iptal).
//
// E-postanın kendisi site derlenirken hazırlanır (/bulten/<no>.json, src/pages/bulten/[sayi].json.ts).
// Zamanlayıcı onu sitenin kendi dosyalarından okur: dosya varsa site o sayıyla güncellenmiştir.
// Ücretsiz Workers planında bir çalışma 10 ms işlemci kullanabilir; parti boyu buna göre küçük tutulur.
// Ücretli planda BULTEN_PARTI (en fazla 100) ve BULTEN_TUR artırılabilir.
//
// Bir parti Resend'e "Idempotency-Key" ile gider: çalışma yarıda kesilip aynı parti
// yeniden gönderilirse e-posta ikinci kez gitmez. Resend'in günlük sınırı dolarsa gönderim
// bekler ve sınır açılınca kaldığı yerden sürer.

import { github, GithubHatasi, yetkiHatasi } from './github.js';
import { eposta, EpostaHatasi, epostaHataMetni, KIMDEN } from './eposta.js';
import { abonelikSemasi, aboneSayilari, cikisAdresi, kvTasi, siteAdresi } from './abonelik.js';
import { CIK, buSayinin, bultenHtml, bultenUyarilari, bultenVerisi, gonderimZamani, kisisel, partiGovdesi } from './bulten.js';
import { sayiMetni, sayiOku } from '../src/scripts/panel-icerik.ts';

const YAYIN_ONCE = 10 * 60e3; // sayı, e-postadan bu kadar önce sitede görünür olur
const parti = (env) => Math.min(100, Math.max(1, Number(env.BULTEN_PARTI) || 30)); // tek istekteki e-posta (Resend en fazla 100)
const tur = (env) => Math.min(10, Math.max(1, Number(env.BULTEN_TUR) || 1)); // bir çalışmadaki parti
const KILIT = 3 * 60e3;
const ACIK = ['planli', 'yayinda', 'gonderiliyor'];
const DENEME_ARASI = 30e3;
const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const pad = (n) => String(n).padStart(2, '0');
const json = (veri, status = 200) => Response.json(veri, { status, headers: { 'cache-control': 'no-store' } });
const hata = (status, mesaj) => json({ hata: mesaj }, status);

let semaHazir = null;
export function gonderimSemasi(db) {
  semaHazir ??= db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS gonderimler (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sayi INTEGER NOT NULL, durum TEXT NOT NULL, zaman INTEGER NOT NULL,
      planlayan TEXT NOT NULL, planlayan_ad TEXT NOT NULL, olusturma INTEGER NOT NULL,
      yayin_commit TEXT, baslangic INTEGER, bitis INTEGER, konu TEXT, html TEXT, metin TEXT,
      imlec TEXT NOT NULL DEFAULT '', adet INTEGER NOT NULL DEFAULT 0, toplam INTEGER,
      hata TEXT, bekle INTEGER, kilit INTEGER, iptal_eden TEXT)`),
    db.prepare('CREATE INDEX IF NOT EXISTS gonderimler_durum ON gonderimler (durum, zaman)'),
  ]).catch((e) => { semaHazir = null; throw e; });
  return semaHazir;
}

async function kisaOzet(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Hata, panelde görünecek cümle ve tekrar denemeden önce beklenecek süre
function hataDegerlendir(e) {
  if (e instanceof EpostaHatasi) {
    const sure = { daily_quota_exceeded: 60, monthly_quota_exceeded: 360, rate_limit_exceeded: 1, concurrent_idempotent_requests: 1 }[e.ad] ?? 10;
    const devam = e.ad.endsWith('quota_exceeded') ? ' Sınır açılınca kaldığı yerden devam edecek.' : ' Birazdan yeniden denenecek.';
    return { metin: epostaHataMetni(e) + devam, sure };
  }
  if (e instanceof GithubHatasi) {
    if (e.status === 409) return { metin: 'Sayı tam o sırada değişti; yeniden denenecek.', sure: 1 };
    if (e.status === 401 || e.status === 403) return { metin: yetkiHatasi(e), sure: 10 };
    return { metin: 'GitHub şu an cevap vermiyor; birazdan yeniden denenecek.', sure: 5 };
  }
  return { metin: String(e.message || e), sure: 10 };
}

// ------------------------------------------------------------------ zamanlayıcı

export async function zamanla(env) {
  const db = env.DB;
  if (!db) return;
  await Promise.all([abonelikSemasi(db), gonderimSemasi(db)]);
  await kvTasi(env).catch((e) => console.error('KV taşıma:', e.message));

  const g = await db.prepare(`SELECT id, sayi, durum, zaman, planlayan, planlayan_ad, bekle FROM gonderimler
    WHERE durum IN ('planli', 'yayinda', 'gonderiliyor') ORDER BY zaman LIMIT 1`).first();
  const simdi = Date.now();
  if (!g || (g.bekle && g.bekle > simdi)) return;
  if (g.durum === 'planli' && simdi < g.zaman - YAYIN_ONCE) return;
  if (g.durum === 'yayinda' && simdi < g.zaman) return;

  // Aynı anda iki çalışma aynı gönderimi yürütmesin
  const kilit = await db.prepare('UPDATE gonderimler SET kilit = ? WHERE id = ? AND (kilit IS NULL OR kilit < ?)').bind(simdi, g.id, simdi - KILIT).run();
  if (kilit.meta.changes !== 1) return;
  try {
    let durum = g.durum;
    if (durum === 'planli') durum = await yayinaAl(env, g);
    if (durum === 'yayinda' && Date.now() >= g.zaman) durum = await hazirla(env, g);
    if (durum === 'gonderiliyor') await gonder(env, g.id);
  } catch (e) {
    const { metin, sure } = hataDegerlendir(e);
    console.error(`gönderim ${g.id}:`, e.message);
    await db.prepare('UPDATE gonderimler SET hata = ?, bekle = ? WHERE id = ?').bind(metin, Date.now() + sure * 60e3, g.id).run();
  } finally {
    await db.prepare('UPDATE gonderimler SET kilit = NULL WHERE id = ?').bind(g.id).run();
  }
}

// Sayı gizliyse "taslak" işaretini kaldırır; site 1–2 dakikada yeniden derlenir
async function yayinaAl(env, g) {
  const gh = github(env);
  const s = (await gh.icerik()).sayilar.filter(buSayinin(g.sayi)).map(sayiOku).find((x) => x.veri.sayi === g.sayi);
  if (!s) throw new Error(`Sayı ${pad(g.sayi)} depoda yok.`);
  let commit = null;
  if (s.veri.taslak) {
    commit = await gh.yaz({
      mesaj: `Sayı ${pad(g.sayi)} yayında (planlı gönderim)\n\nPlanlayan: ${g.planlayan_ad} <${g.planlayan}>`,
      yazar: { ad: g.planlayan_ad, eposta: g.planlayan },
      dosyalar: [{ yol: s.yol, metin: sayiMetni({ ...s.veri, taslak: false }, s.govde) }],
      beklenen: { [s.yol]: s.sha },
    });
  }
  const r = await env.DB.prepare("UPDATE gonderimler SET durum = 'yayinda', yayin_commit = ?, hata = NULL, bekle = NULL WHERE id = ? AND durum = 'planli'").bind(commit, g.id).run();
  return r.meta.changes ? 'yayinda' : 'iptal';
}

// Site yeni hâliyle yayındaysa (sayının e-postası derlenmişse) e-postayı dondurur; gönderim boyunca bu hâli gider
async function hazirla(env, g) {
  const db = env.DB;
  const dosya = await env.ASSETS.fetch(new Request(`${siteAdresi(env)}/bulten/${g.sayi}.json`)).catch(() => null);
  const b = dosya?.status === 200 ? await dosya.json().catch(() => null) : null;
  if (!b?.html) {
    if (!dosya?.bodyUsed) await dosya?.body?.cancel();
    const uzun = Date.now() - g.zaman > 10 * 60e3;
    await db.prepare('UPDATE gonderimler SET hata = ? WHERE id = ?')
      .bind(uzun ? 'Site hâlâ güncellenmedi; Cloudflare derlemesi başarısız olmuş olabilir. Sayı sitede görününce gönderim kendiliğinden başlar.' : null, g.id).run();
    return 'yayinda';
  }
  const simdi = Date.now();
  const { n } = await db.prepare("SELECT COUNT(*) AS n FROM aboneler WHERE durum = 'onayli' AND onay <= ?").bind(simdi).first();
  const r = await db.prepare(`UPDATE gonderimler SET durum = 'gonderiliyor', baslangic = ?, konu = ?, html = ?, metin = ?, toplam = ?,
    imlec = '', adet = 0, hata = NULL, bekle = NULL WHERE id = ? AND durum = 'yayinda'`).bind(simdi, b.konu, b.html, b.text, n, g.id).run();
  return r.meta.changes ? 'gonderiliyor' : 'iptal';
}

async function gonder(env, id) {
  const db = env.DB;
  const g = await db.prepare('SELECT id, baslangic, konu, html, metin, imlec, adet FROM gonderimler WHERE id = ?').bind(id).first();
  const e = eposta(env);
  const icerik = { konu: g.konu, html: g.html, text: g.metin };
  let { imlec, adet } = g;
  for (let t = 0; t < tur(env); t++) {
    // Panelden durdurulduysa bırak
    if (t && (await db.prepare('SELECT durum FROM gonderimler WHERE id = ?').bind(id).first())?.durum !== 'gonderiliyor') return;
    // Gönderim başladığında onaylı olan aboneler; bu arada çıkanlar atlanır
    const { results } = await db.prepare(`SELECT eposta, anahtar FROM aboneler
      WHERE durum = 'onayli' AND onay <= ? AND eposta > ? ORDER BY eposta LIMIT ?`).bind(g.baslangic, imlec, parti(env)).all();
    if (!results.length) {
      await db.prepare("UPDATE gonderimler SET durum = 'bitti', bitis = ?, hata = NULL, bekle = NULL WHERE id = ? AND durum = 'gonderiliyor'").bind(Date.now(), id).run();
      return;
    }
    const govde = partiGovdesi(icerik, results.map((a) => ({ adres: a.eposta, cikis: cikisAdresi(env, a.anahtar) })), e);
    try {
      await e.toplu(govde, `bulten-${id}-${await kisaOzet(imlec)}`);
    } catch (err) {
      // Aynı anahtarla farklı bir parti: bu imleçten sonrası zaten gönderilmiş (araya bir çıkış girmiş)
      if (!(err instanceof EpostaHatasi && err.ad === 'invalid_idempotent_request')) throw err;
    }
    imlec = results[results.length - 1].eposta;
    adet += results.length;
    await db.prepare('UPDATE gonderimler SET imlec = ?, adet = ?, hata = NULL WHERE id = ?').bind(imlec, adet, id).run();
  }
}

// ------------------------------------------------------------------ panel: /api/panel/bulten/*

export async function bultenPanel(yol, yontem, veri, ben, env) {
  const db = env.DB;
  await Promise.all([abonelikSemasi(db), gonderimSemasi(db)]);
  const simdi = Date.now();

  if (yol === 'bulten' && yontem === 'GET') {
    const { results } = await db.prepare(`SELECT id, sayi, durum, zaman, planlayan_ad, baslangic, bitis, konu, adet, toplam, hata, bekle, iptal_eden
      FROM gonderimler ORDER BY id DESC LIMIT 12`).all();
    return json({ aboneler: await aboneSayilari(db), gonderimler: results, resend: !!env.RESEND_API_KEY, kimden: env.BULTEN_KIMDEN || KIMDEN, simdi });
  }
  if (yontem !== 'POST') return hata(404, 'Bulunamadı.');

  if (yol === 'bulten/iptal') {
    const g = await db.prepare('SELECT id, durum FROM gonderimler WHERE id = ?').bind(Number(veri.id) || 0).first();
    if (!g || !ACIK.includes(g.durum)) return hata(409, 'Bu gönderim zaten bitmiş ya da iptal edilmiş.');
    await db.prepare("UPDATE gonderimler SET durum = 'iptal', iptal_eden = ?, bitis = ? WHERE id = ?").bind(ben.ad, simdi, g.id).run();
    return json({ ok: true, onceki: g.durum });
  }

  // Gönderilmiş bir e-postanın kendisi
  if (yol === 'bulten/onizle' && veri.id) {
    const g = await db.prepare('SELECT konu, html FROM gonderimler WHERE id = ? AND html IS NOT NULL').bind(Number(veri.id) || 0).first();
    if (!g) return hata(404, 'Bu gönderimin e-postası yok.');
    return json({ konu: g.konu, html: g.html.replaceAll(CIK, '#'), uyarilar: [] });
  }

  if (!env.GITHUB_TOKEN) return hata(503, 'GitHub bağlantısı kurulmamış (GITHUB_TOKEN).');
  const no = Number(veri.sayi);
  if (!Number.isInteger(no) || no < 1) return hata(400, 'Sayı seçilmedi.');

  try {
    if (yol === 'bulten/onizle') {
      const v = await bultenVerisi(env, no);
      if (!v) return hata(404, `Sayı ${pad(no)} depoda yok. Önce onaylanıp kaydedilmesi gerekiyor.`);
      const b = bultenHtml(env, v);
      const uyarilar = bultenUyarilari(v);
      if (v.sayi.veri.taslak) uyarilar.push('Sayı şu an sitede gizli; e-postadaki bağlantılar sayı yayına çıkınca açılır.');
      return json({ konu: b.konu, html: b.html.replaceAll(CIK, '#'), uyarilar, gizli: v.sayi.veri.taslak, yayin: v.sayi.veri.yayin, zaman: gonderimZamani(v.sayi.veri.yayin) });
    }

    if (!env.RESEND_API_KEY) return hata(503, 'E-posta gönderimi kurulmamış: Cloudflare\'de RESEND_API_KEY tanımlanmalı.');

    if (yol === 'bulten/dene') {
      // Deneme, panele giren kişiye ya da onun yazdığı adrese gider
      const adres = String(veri.adres || ben.eposta).trim().toLowerCase();
      if (!EPOSTA.test(adres) || adres.length > 254) return hata(400, 'Deneme adresi bir e-posta adresine benzemiyor.');
      const ad = `dene:${ben.eposta}`;
      const son = await db.prepare('SELECT deger FROM ayarlar WHERE ad = ?').bind(ad).first();
      if (son && Number(son.deger) > simdi - DENEME_ARASI) return hata(429, 'Deneme e-postası az önce gitti. Yarım dakika sonra tekrar dene.');
      const v = await bultenVerisi(env, no);
      if (!v) return hata(404, `Sayı ${pad(no)} depoda yok.`);
      const b = bultenHtml(env, v);
      const m = kisisel({ ...b, konu: `[deneme] ${b.konu}` }, adres, `${siteAdresi(env)}/abone/`);
      delete m.headers; // deneme e-postasında tek tıkla çıkış yok
      await eposta(env).gonder(m);
      await db.prepare('INSERT OR REPLACE INTO ayarlar (ad, deger) VALUES (?, ?)').bind(ad, String(simdi)).run();
      return json({ ok: true, eposta: adres });
    }

    if (yol === 'bulten/planla') {
      const acik = await db.prepare("SELECT sayi FROM gonderimler WHERE durum IN ('planli', 'yayinda', 'gonderiliyor') LIMIT 1").first();
      if (acik) return hata(409, `Sayı ${pad(acik.sayi)} için bekleyen bir gönderim var. Önce o bitmeli ya da iptal edilmeli.`);
      const gitti = await db.prepare("SELECT id FROM gonderimler WHERE sayi = ? AND durum = 'bitti' LIMIT 1").bind(no).first();
      if (gitti) return hata(409, `Sayı ${pad(no)} zaten gönderildi.`);
      const v = await bultenVerisi(env, no);
      if (!v) return hata(404, `Sayı ${pad(no)} depoda yok. Önce onaylanıp kaydedilmesi gerekiyor.`);
      if (!v.yazilar.length) return hata(400, 'Bu sayıda yayına çıkacak yazı yok.');
      const zaman = veri.simdi ? simdi : gonderimZamani(v.sayi.veri.yayin);
      if (!veri.simdi && zaman < simdi + 60e3) return hata(400, 'Bu sayının yayın saati geçti. Hemen göndermek için "Şimdi gönder"i seç.');
      const r = await db.prepare(`INSERT INTO gonderimler (sayi, durum, zaman, planlayan, planlayan_ad, olusturma) VALUES (?, 'planli', ?, ?, ?, ?)`)
        .bind(no, zaman, ben.eposta, ben.ad, simdi).run();
      return json({ ok: true, id: r.meta.last_row_id, zaman });
    }
  } catch (e) {
    if (e instanceof GithubHatasi) {
      console.error(e.message);
      return hata(502, e.status === 401 || e.status === 403 ? yetkiHatasi(e) : 'GitHub şu an cevap vermiyor. Biraz sonra tekrar dene.');
    }
    if (e instanceof EpostaHatasi) {
      console.error(e.message);
      return hata(502, epostaHataMetni(e));
    }
    throw e;
  }
  return hata(404, 'Bulunamadı.');
}
