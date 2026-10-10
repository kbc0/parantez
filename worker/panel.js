// (parantez) — yazı paneli (/admin) için API: /api/panel/*
//
// Hesaplar D1'de (DB) durur; parola PBKDF2 ile saklanır, oturum çerezi HttpOnly'dir.
// İçerik GitHub'dan okunur ve oraya commit edilir (worker/github.js).
//
// İlk kurulum: Cloudflare'de iki gizli değişken tanımlanır:
//   YONETICI_EPOSTA, YONETICI_PAROLA — bu bilgilerle ilk girişte yönetici hesabı açılır.
// Aynı bilgiler sonradan da çalışır (parola unutulursa kurtarma yolu).

import { github, GithubHatasi } from './github.js';
import { inceleme, incelemeSemasi } from './inceleme.js';

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ITERASYON = 20000; // Workers'ın CPU sınırına sığsın diye ölçülü
const OTURUM_GUN = 30;
const CEREZ = 'p_panel';
const DENEME_SINIRI = 10; // 15 dakikada bir IP'den hatalı giriş

// Panelin yazabileceği dosyalar. Başka hiçbir yere dokunamaz.
const YAZILABILIR = [
  /^src\/content\/sayilar\/\d{1,4}\.md$/,
  /^src\/content\/yazilar\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/,
  /^src\/data\/ekip\.json$/,
  /^public\/gorseller\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp)$/,
];
const SILINEBILIR = YAZILABILIR.slice(0, 2);
const GORSEL_SINIRI = 3 * 1024 * 1024;

const json = (veri, status = 200, ek = {}) =>
  Response.json(veri, { status, headers: { 'cache-control': 'no-store', ...ek } });
const hata = (status, mesaj) => json({ hata: mesaj }, status);

// ------------------------------------------------------------------ yardımcılar

const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (metin) => hex(await crypto.subtle.digest('SHA-256', enc.encode(metin)));

function esit(a, b) {
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let fark = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) fark |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return fark === 0;
}

async function parolaOzeti(parola, tuz = crypto.getRandomValues(new Uint8Array(16)), iter = ITERASYON) {
  const anahtar = await crypto.subtle.importKey('raw', enc.encode(parola), 'PBKDF2', false, ['deriveBits']);
  const bitler = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: tuz, iterations: iter }, anahtar, 256);
  return `pbkdf2$${iter}$${b64(tuz)}$${b64(new Uint8Array(bitler))}`;
}

async function parolaDogru(parola, kayit) {
  const [tur, iter, tuz, ozet] = String(kayit).split('$');
  if (tur !== 'pbkdf2') return false;
  const yeni = await parolaOzeti(parola, unb64(tuz), Number(iter));
  return esit(yeni.split('$')[3], ozet);
}

// Kolay okunur geçici parola: kgmv-7tqa-x3dp
function geciciParola() {
  const harf = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(12));
  const s = [...r].map((b) => harf[b % harf.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

function cerezOku(request, ad) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp(`(?:^|;\\s*)${ad}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

const cerez = (deger, saniye) =>
  `${CEREZ}=${deger}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${saniye}`;

async function ipOzeti(request) {
  return (await sha256(`panel:${request.headers.get('cf-connecting-ip') || 'yerel'}`)).slice(0, 16);
}

// ------------------------------------------------------------------ veritabanı

let semaHazir = null;
function sema(db) {
  semaHazir ??= db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS panel_uyeler (
      eposta TEXT PRIMARY KEY, ad TEXT NOT NULL, yetki TEXT NOT NULL DEFAULT 'yazar',
      parola TEXT NOT NULL, degistirmeli INTEGER NOT NULL DEFAULT 1, olusturma INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS panel_oturumlar (
      ozet TEXT PRIMARY KEY, eposta TEXT NOT NULL, bitis INTEGER NOT NULL)`),
    db.prepare('CREATE TABLE IF NOT EXISTS panel_girisler (ip TEXT NOT NULL, zaman INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS panel_girisler_ip ON panel_girisler (ip, zaman)'),
    ...incelemeSemasi(db),
  ]).catch((e) => { semaHazir = null; throw e; });
  return semaHazir;
}

const disari = (u) => u && ({ eposta: u.eposta, ad: u.ad, yetki: u.yetki, degistirmeli: !!u.degistirmeli });

async function oturumAc(db, eposta) {
  const belirtec = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const bitis = Date.now() + OTURUM_GUN * 864e5;
  await db.prepare('INSERT INTO panel_oturumlar (ozet, eposta, bitis) VALUES (?, ?, ?)').bind(await sha256(belirtec), eposta, bitis).run();
  // Eski oturumları ara ara temizle
  if (Math.random() < 0.1) await db.prepare('DELETE FROM panel_oturumlar WHERE bitis < ?').bind(Date.now()).run();
  return belirtec;
}

async function kim(request, db) {
  const belirtec = cerezOku(request, CEREZ);
  if (!belirtec) return null;
  return db.prepare(`SELECT u.* FROM panel_oturumlar o JOIN panel_uyeler u ON u.eposta = o.eposta
    WHERE o.ozet = ? AND o.bitis > ?`).bind(await sha256(belirtec), Date.now()).first();
}

// ------------------------------------------------------------------ istekler

export async function panel(request, env, url) {
  if (!env.DB) return hata(503, 'Veritabanı bağlı değil.');
  await sema(env.DB);
  const db = env.DB;
  const yol = url.pathname.replace(/^\/api\/panel\/?/, '').replace(/\/$/, '');
  const yontem = request.method;

  // Değişiklik yapan istekler yalnızca panelin kendisinden gelebilir
  if (yontem !== 'GET') {
    const origin = request.headers.get('origin');
    if (request.headers.get('x-panel') !== '1' || (origin && origin !== url.origin)) return hata(403, 'İzin yok.');
  }

  let veri = {};
  if (yontem === 'POST') {
    try { veri = await request.json(); } catch { return hata(400, 'İstek okunamadı.'); }
  }

  if (yol === 'giris' && yontem === 'POST') return giris(request, env, veri);
  if (yol === 'cikis' && yontem === 'POST') {
    const belirtec = cerezOku(request, CEREZ);
    if (belirtec) await db.prepare('DELETE FROM panel_oturumlar WHERE ozet = ?').bind(await sha256(belirtec)).run();
    return json({ ok: true }, 200, { 'set-cookie': cerez('', 0) });
  }

  const ben = await kim(request, db);
  if (!ben) return hata(401, 'Oturum yok.');

  if (yol === 'ben') return json({ ben: disari(ben), github: !!env.GITHUB_TOKEN });

  if (yol === 'parola' && yontem === 'POST') {
    const yeni = String(veri.yeni || '');
    if (!(await parolaDogru(String(veri.eski || ''), ben.parola))) return hata(400, 'Şu anki parolan yanlış.');
    if (yeni.length < 10) return hata(400, 'Yeni parola en az 10 karakter olmalı.');
    await db.prepare('UPDATE panel_uyeler SET parola = ?, degistirmeli = 0 WHERE eposta = ?').bind(await parolaOzeti(yeni), ben.eposta).run();
    return json({ ok: true, ben: disari({ ...ben, degistirmeli: 0 }) });
  }

  if (yol === 'ad' && yontem === 'POST') {
    const ad = String(veri.ad || '').trim().slice(0, 60);
    if (!ad) return hata(400, 'Ad boş olamaz.');
    await db.prepare('UPDATE panel_uyeler SET ad = ? WHERE eposta = ?').bind(ad, ben.eposta).run();
    return json({ ok: true, ben: disari({ ...ben, ad }) });
  }

  // Bundan sonrası için parolanın değiştirilmiş olması gerekir
  if (ben.degistirmeli) return hata(403, 'Önce parolanı değiştirmen gerekiyor.');

  if (yol === 'uyeler' || yol.startsWith('uyeler/')) return uyeler(yol, yontem, veri, ben, db);
  if (['icerik', 'dosya', 'dosyalar', 'kaydet'].includes(yol)) return icerik(yol, yontem, veri, ben, env, url);
  if (yol === 'oneriler' || yol === 'oneri' || yol === 'gorsel' || yol.startsWith('oneri/')) return inceleme(yol, yontem, veri, ben, env, url);
  return hata(404, 'Bulunamadı.');
}

async function giris(request, env, veri) {
  const db = env.DB;
  const ip = await ipOzeti(request);
  const simdi = Date.now();
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM panel_girisler WHERE ip = ? AND zaman > ?').bind(ip, simdi - 15 * 60e3).first();
  if (n >= DENEME_SINIRI) return hata(429, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.');

  const eposta = String(veri.eposta || '').trim().toLowerCase();
  const parola = String(veri.parola || '');
  let uye = EPOSTA.test(eposta) ? await db.prepare('SELECT * FROM panel_uyeler WHERE eposta = ?').bind(eposta).first() : null;
  let dogru = uye ? await parolaDogru(parola, uye.parola) : false;

  // Kurulum ve kurtarma: Cloudflare'deki yönetici bilgileri her zaman çalışır
  const yEposta = String(env.YONETICI_EPOSTA || '').trim().toLowerCase();
  if (!dogru && yEposta && env.YONETICI_PAROLA && eposta === yEposta && esit(parola, env.YONETICI_PAROLA)) {
    if (!uye) {
      await db.prepare('INSERT INTO panel_uyeler (eposta, ad, yetki, parola, degistirmeli, olusturma) VALUES (?, ?, ?, ?, 0, ?)')
        .bind(eposta, eposta.split('@')[0], 'yonetici', await parolaOzeti(parola), simdi).run();
    } else if (uye.yetki !== 'yonetici') {
      await db.prepare("UPDATE panel_uyeler SET yetki = 'yonetici' WHERE eposta = ?").bind(eposta).run();
    }
    uye = await db.prepare('SELECT * FROM panel_uyeler WHERE eposta = ?').bind(eposta).first();
    dogru = true;
  }

  if (!dogru) {
    if (!yEposta || !env.YONETICI_PAROLA) {
      const { n: uyeSayisi } = await db.prepare('SELECT COUNT(*) AS n FROM panel_uyeler').first();
      if (!uyeSayisi) return hata(503, 'Panel henüz kurulmadı: Cloudflare’de YONETICI_EPOSTA ve YONETICI_PAROLA tanımlanmalı.');
    }
    await db.prepare('INSERT INTO panel_girisler (ip, zaman) VALUES (?, ?)').bind(ip, simdi).run();
    if (Math.random() < 0.1) await db.prepare('DELETE FROM panel_girisler WHERE zaman < ?').bind(simdi - 864e5).run();
    return hata(401, 'E-posta ya da parola yanlış.');
  }

  const belirtec = await oturumAc(db, uye.eposta);
  return json({ ben: disari(uye), github: !!env.GITHUB_TOKEN }, 200, { 'set-cookie': cerez(belirtec, OTURUM_GUN * 86400) });
}

// ------------------------------------------------------------------ hesaplar (yalnızca yönetici)

async function uyeler(yol, yontem, veri, ben, db) {
  if (ben.yetki !== 'yonetici') return hata(403, 'Bunu yalnızca yönetici yapabilir.');

  if (yol === 'uyeler' && yontem === 'GET') {
    const { results } = await db.prepare('SELECT eposta, ad, yetki, degistirmeli, olusturma FROM panel_uyeler ORDER BY olusturma').all();
    return json({ uyeler: results.map((u) => ({ ...disari(u), olusturma: u.olusturma })) });
  }

  const eposta = String(veri.eposta || '').trim().toLowerCase();
  if (!EPOSTA.test(eposta)) return hata(400, 'Geçerli bir e-posta yaz.');

  if (yol === 'uyeler' && yontem === 'POST') {
    const ad = String(veri.ad || '').trim().slice(0, 60);
    const yetki = veri.yetki === 'yonetici' ? 'yonetici' : 'yazar';
    if (!ad) return hata(400, 'Ad boş olamaz.');
    if (await db.prepare('SELECT 1 FROM panel_uyeler WHERE eposta = ?').bind(eposta).first()) return hata(409, 'Bu e-postayla bir hesap zaten var.');
    const gecici = geciciParola();
    await db.prepare('INSERT INTO panel_uyeler (eposta, ad, yetki, parola, degistirmeli, olusturma) VALUES (?, ?, ?, ?, 1, ?)')
      .bind(eposta, ad, yetki, await parolaOzeti(gecici), Date.now()).run();
    return json({ ok: true, gecici });
  }

  if (yol === 'uyeler/sifirla' && yontem === 'POST') {
    const gecici = geciciParola();
    const r = await db.prepare('UPDATE panel_uyeler SET parola = ?, degistirmeli = 1 WHERE eposta = ?').bind(await parolaOzeti(gecici), eposta).run();
    if (!r.meta.changes) return hata(404, 'Hesap bulunamadı.');
    await db.prepare('DELETE FROM panel_oturumlar WHERE eposta = ?').bind(eposta).run();
    return json({ ok: true, gecici });
  }

  if (yol === 'uyeler/sil' && yontem === 'POST') {
    if (eposta === ben.eposta) return hata(400, 'Kendi hesabını silemezsin.');
    await db.batch([
      db.prepare('DELETE FROM panel_uyeler WHERE eposta = ?').bind(eposta),
      db.prepare('DELETE FROM panel_oturumlar WHERE eposta = ?').bind(eposta),
    ]);
    return json({ ok: true });
  }

  return hata(404, 'Bulunamadı.');
}

// ------------------------------------------------------------------ içerik (GitHub)

async function icerik(yol, yontem, veri, ben, env, url) {
  if (!env.GITHUB_TOKEN) return hata(503, 'GitHub bağlantısı kurulmamış (GITHUB_TOKEN).');
  const gh = github(env);

  try {
    if (yol === 'icerik' && yontem === 'GET') {
      try { return json(await gh.icerik()); } catch (e) {
        if (e instanceof GithubHatasi && e.status === 401) throw e;
        // GraphQL kullanılamıyorsa yalnızca liste döner; panel metinleri parça parça ister
        return json({ agac: await gh.agac() });
      }
    }

    if (yol === 'dosyalar' && yontem === 'POST') {
      const liste = Array.isArray(veri.liste) ? veri.liste : [];
      if (!liste.length || liste.length > 40) return hata(400, 'En fazla 40 dosya istenebilir.');
      if (liste.some((d) => !YAZILABILIR.slice(0, 3).some((r) => r.test(d?.yol)) || !/^[0-9a-f]{40}$/.test(d?.sha))) return hata(400, 'Geçersiz dosya.');
      return json({ dosyalar: await gh.bloblar(liste) });
    }

    if (yol === 'dosya' && yontem === 'GET') {
      const dosyaYolu = url.searchParams.get('yol') || '';
      if (!YAZILABILIR.slice(0, 3).some((r) => r.test(dosyaYolu))) return hata(400, 'Geçersiz dosya.');
      return json(await gh.dosya(dosyaYolu));
    }

    if (yol === 'kaydet' && yontem === 'POST') {
      const dosyalar = Array.isArray(veri.dosyalar) ? veri.dosyalar : [];
      const sil = Array.isArray(veri.sil) ? veri.sil : [];
      const beklenen = veri.beklenen && typeof veri.beklenen === 'object' ? veri.beklenen : {};
      if (!dosyalar.length && !sil.length) return hata(400, 'Kaydedilecek bir şey yok.');
      // Sayı ve yazılar yalnızca akran incelemesiyle yayına çıkar (worker/inceleme.js)
      if (sil.length || dosyalar.some((d) => d?.yol !== 'src/data/ekip.json')) return hata(403, 'Sayı ve yazılar inceleme ile yayınlanır.');
      if (dosyalar.length > 6 || sil.length > 6) return hata(400, 'Tek seferde çok fazla dosya.');

      for (const d of dosyalar) {
        if (!YAZILABILIR.some((r) => r.test(d?.yol))) return hata(400, `Bu dosyaya yazılamaz: ${d?.yol}`);
        const gorsel = d.yol.startsWith('public/gorseller/');
        if (gorsel) {
          if (typeof d.base64 !== 'string' || d.base64.length * 0.75 > GORSEL_SINIRI) return hata(400, 'Görsel çok büyük (en fazla 3 MB).');
        } else if (typeof d.metin !== 'string' || d.metin.length > 200_000) {
          return hata(400, 'Metin okunamadı.');
        }
        if (d.yol.endsWith('ekip.json') && ben.yetki !== 'yonetici') return hata(403, 'Ekibi yalnızca yönetici düzenleyebilir.');
      }
      for (const s of sil) if (!SILINEBILIR.some((r) => r.test(s))) return hata(400, `Bu dosya silinemez: ${s}`);
      for (const [y, sha] of Object.entries(beklenen)) {
        if (!YAZILABILIR.some((r) => r.test(y)) || (sha !== null && !/^[0-9a-f]{40}$/.test(sha))) return hata(400, 'Geçersiz sürüm bilgisi.');
      }

      const mesaj = `${String(veri.mesaj || 'Panelden güncelleme').slice(0, 120)}\n\nPanelden: ${ben.ad} <${ben.eposta}>`;
      const commit = await gh.yaz({ mesaj, yazar: ben, dosyalar, sil, beklenen });
      return json({ ok: true, commit });
    }
  } catch (e) {
    if (e instanceof GithubHatasi) {
      if (e.status === 409) return json({ hata: 'Bu içerik sen düzenlerken başka biri tarafından değiştirildi. Sayfayı yenileyip değişikliğini tekrar uygula.', yol: e.yol }, 409);
      if (e.status === 401 || e.status === 403) return hata(502, 'GitHub anahtarı geçersiz ya da yetkisi yetmiyor.');
      if (e.status === 404) return hata(404, 'Dosya bulunamadı.');
      console.error(e.message);
      return hata(502, 'GitHub şu an cevap vermiyor. Biraz sonra tekrar dene.');
    }
    throw e;
  }
  return hata(404, 'Bulunamadı.');
}
