// (parantez) — akran incelemesi. Sayı ve yazılar doğrudan yayınlanmaz:
// yazan bir öneri hazırlar, başka bir ekip üyesi önizleyip onaylayınca yayına çıkar.
// GitHub'daki "pull request" mantığı, ama panelin içinde ve GitHub hesabı gerektirmeden.
//
// Öneri durumları:
//   taslak     — yazan hâlâ çalışıyor
//   inceleme   — onay bekliyor
//   degisiklik — inceleyen değişiklik istedi; yazan düzeltip yeniden gönderir
//   yayinlandi — onaylandı, GitHub'a commit edildi
//   kapatildi  — geri çekildi
//
// Öneriler ve yorumlar D1'de (DB) durur. Onaya kadar GitHub'a hiçbir şey gitmez.

import { github, GithubHatasi } from './github.js';

const ACIK = ['taslak', 'inceleme', 'degisiklik'];
const YOLLAR = {
  yazi: /^src\/content\/yazilar\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/,
  sayi: /^src\/content\/sayilar\/\d{1,4}\.md$/,
};
const GORSEL_YOLU = /^public\/gorseller\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp)$/;
const GORSEL_SINIRI = 1_400_000; // base64 uzunluğu (~1 MB görsel); D1 satır sınırının altında
const KILIT = 60_000; // onay sürerken öneri bu kadar süre kilitli kalır

const json = (veri, status = 200) => Response.json(veri, { status, headers: { 'cache-control': 'no-store' } });
const hata = (status, mesaj) => json({ hata: mesaj }, status);

export const incelemeSemasi = (db) => [
  db.prepare(`CREATE TABLE IF NOT EXISTS panel_oneriler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tur TEXT NOT NULL, islem TEXT NOT NULL, yol TEXT NOT NULL, temel TEXT,
    metin TEXT, baslik TEXT NOT NULL, gorsel_yol TEXT, gorsel TEXT,
    surum INTEGER NOT NULL DEFAULT 1, durum TEXT NOT NULL, yazan TEXT NOT NULL, yazan_ad TEXT NOT NULL,
    onaylayan TEXT, onaylayan_ad TEXT, commit_sha TEXT,
    olusturma INTEGER NOT NULL, guncelleme INTEGER NOT NULL)`),
  db.prepare('CREATE INDEX IF NOT EXISTS panel_oneriler_durum ON panel_oneriler (durum, guncelleme)'),
  db.prepare(`CREATE TABLE IF NOT EXISTS panel_yorumlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT, oneri INTEGER NOT NULL,
    eposta TEXT NOT NULL, ad TEXT NOT NULL, metin TEXT NOT NULL,
    tur TEXT NOT NULL DEFAULT 'yorum', zaman INTEGER NOT NULL)`),
  db.prepare('CREATE INDEX IF NOT EXISTS panel_yorumlar_oneri ON panel_yorumlar (oneri, zaman)'),
];

const yorumEkle = (db, oneri, ben, metin, tur = 'yorum') =>
  db.prepare('INSERT INTO panel_yorumlar (oneri, eposta, ad, metin, tur, zaman) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(oneri, ben.eposta, ben.ad, String(metin).slice(0, 4000), tur, Date.now()).run();

const disari = (o) => {
  const { gorsel, ...geri } = o;
  return { ...geri, gorselVar: !!gorsel };
};

export async function inceleme(yol, yontem, veri, ben, env, url) {
  const db = env.DB;
  const simdi = Date.now();

  // Liste: açık öneriler (metinleriyle) ve son kapananlar
  if (yol === 'oneriler' && yontem === 'GET') {
    const acik = await db.prepare(`SELECT o.id, o.tur, o.islem, o.yol, o.temel, o.metin, o.baslik, o.gorsel_yol, o.durum,
        o.yazan, o.yazan_ad, o.olusturma, o.guncelleme,
        (SELECT COUNT(*) FROM panel_yorumlar y WHERE y.oneri = o.id AND y.tur = 'yorum') AS yorum
      FROM panel_oneriler o WHERE o.durum IN ('taslak', 'inceleme', 'degisiklik') ORDER BY o.guncelleme DESC`).all();
    const son = await db.prepare(`SELECT id, tur, islem, yol, baslik, durum, yazan, yazan_ad, onaylayan_ad, commit_sha, guncelleme
      FROM panel_oneriler WHERE durum IN ('yayinlandi', 'kapatildi') ORDER BY guncelleme DESC LIMIT 15`).all();
    return json({ acik: acik.results, son: son.results });
  }

  const id = Number(yontem === 'GET' ? url.searchParams.get('id') : veri.id) || 0;
  const oneriGetir = () => db.prepare('SELECT * FROM panel_oneriler WHERE id = ?').bind(id).first();

  if (yol === 'oneri' && yontem === 'GET') {
    const o = await oneriGetir();
    if (!o) return hata(404, 'Öneri bulunamadı.');
    const { results } = await db.prepare('SELECT id, eposta, ad, metin, tur, zaman FROM panel_yorumlar WHERE oneri = ? ORDER BY zaman').bind(id).all();
    return json({ oneri: disari(o), yorumlar: results });
  }

  // Önizleme için önerinin görseli
  if (yol === 'gorsel' && yontem === 'GET') {
    const o = await db.prepare('SELECT gorsel FROM panel_oneriler WHERE id = ?').bind(id).first();
    if (!o?.gorsel) return new Response('yok', { status: 404 });
    const bayt = Uint8Array.from(atob(o.gorsel), (c) => c.charCodeAt(0));
    return new Response(bayt, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=300' } });
  }

  // Yeni öneri ya da yazanın kendi önerisini güncellemesi
  if (yol === 'oneri' && yontem === 'POST') {
    const tur = veri.tur;
    const islem = veri.islem === 'sil' ? 'sil' : 'kaydet';
    const dosya = String(veri.yol || '');
    const temel = veri.temel ?? null;
    const baslik = String(veri.baslik || '').trim().slice(0, 160);
    if (!YOLLAR[tur]?.test(dosya)) return hata(400, 'Geçersiz dosya.');
    if (temel !== null && !/^[0-9a-f]{40}$/.test(temel)) return hata(400, 'Geçersiz sürüm.');
    if (islem === 'sil' && temel === null) return hata(400, 'Yayında olmayan bir şeyin silinmesi önerilemez.');
    if (!baslik) return hata(400, 'Başlık boş olamaz.');
    const metin = islem === 'kaydet' ? veri.metin : null;
    if (islem === 'kaydet' && (typeof metin !== 'string' || !metin.trim() || metin.length > 200_000)) return hata(400, 'Metin okunamadı.');

    let gorselYol, gorsel;
    if (veri.gorsel === null) { gorselYol = null; gorsel = null; }
    else if (veri.gorsel) {
      if (tur !== 'yazi' || !GORSEL_YOLU.test(veri.gorsel.yol) || typeof veri.gorsel.base64 !== 'string') return hata(400, 'Geçersiz görsel.');
      if (veri.gorsel.base64.length > GORSEL_SINIRI) return hata(400, 'Görsel çok büyük; daha küçük bir fotoğraf dene.');
      gorselYol = veri.gorsel.yol;
      gorsel = veri.gorsel.base64;
    }

    const cakisan = await db.prepare(`SELECT id, yazan_ad FROM panel_oneriler WHERE yol = ? AND durum IN ('taslak', 'inceleme', 'degisiklik') AND id != ?`).bind(dosya, id).first();
    if (cakisan) return json({ hata: `Bunun için açık bir öneri var (${cakisan.yazan_ad}). Ona yorum yazabilirsin.`, id: cakisan.id }, 409);

    let durum = veri.gonder ? 'inceleme' : 'taslak';
    if (id) {
      const o = await oneriGetir();
      if (!o) return hata(404, 'Öneri bulunamadı.');
      if (o.yazan !== ben.eposta) return hata(403, 'Başkasının önerisini düzenleyemezsin; yorum yazabilirsin.');
      if (!ACIK.includes(o.durum)) return hata(409, 'Bu öneri kapanmış.');
      if (o.onaylayan && o.guncelleme > simdi - KILIT) return hata(409, 'Öneri şu an onaylanıyor; biraz sonra tekrar bak.');
      if (!veri.gonder && o.durum !== 'taslak') durum = o.durum; // gönderilmiş öneri güncellenince incelemede kalır
      await db.prepare(`UPDATE panel_oneriler SET islem = ?, temel = ?, metin = ?, baslik = ?, durum = ?, guncelleme = ?,
        surum = surum + 1, onaylayan = NULL, onaylayan_ad = NULL ${veri.gorsel === undefined ? '' : ', gorsel_yol = ?, gorsel = ?'} WHERE id = ?`)
        .bind(...[islem, temel, metin, baslik, durum, simdi], ...(veri.gorsel === undefined ? [] : [gorselYol, gorsel]), id).run();
      if (veri.gonder && o.durum !== 'inceleme') await yorumEkle(db, id, ben, o.durum === 'degisiklik' ? 'düzeltip yeniden gönderdi' : 'incelemeye gönderdi', 'olay');
      else if (o.durum === 'inceleme') await yorumEkle(db, id, ben, 'öneriyi güncelledi', 'olay');
      return json({ id, durum });
    }

    const r = await db.prepare(`INSERT INTO panel_oneriler (tur, islem, yol, temel, metin, baslik, gorsel_yol, gorsel, durum, yazan, yazan_ad, olusturma, guncelleme)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(tur, islem, dosya, temel, metin, baslik, gorselYol ?? null, gorsel ?? null, durum, ben.eposta, ben.ad, simdi, simdi).run();
    const yeniId = r.meta.last_row_id;
    if (durum === 'inceleme') await yorumEkle(db, yeniId, ben, islem === 'sil' ? 'silinmesini önerdi' : 'incelemeye gönderdi', 'olay');
    return json({ id: yeniId, durum });
  }

  const o = id ? await oneriGetir() : null;
  if (!o) return hata(404, 'Öneri bulunamadı.');

  if (yol === 'oneri/yorum' && yontem === 'POST') {
    const metin = String(veri.metin || '').trim();
    if (!metin) return hata(400, 'Yorum boş.');
    await yorumEkle(db, id, ben, metin);
    await db.prepare('UPDATE panel_oneriler SET guncelleme = ? WHERE id = ?').bind(simdi, id).run();
    return json({ ok: true });
  }

  if (yol === 'oneri/kapat' && yontem === 'POST') {
    if (o.yazan !== ben.eposta && ben.yetki !== 'yonetici') return hata(403, 'Öneriyi yalnızca yazan geri çekebilir.');
    if (!ACIK.includes(o.durum)) return hata(409, 'Bu öneri zaten kapanmış.');
    await db.prepare("UPDATE panel_oneriler SET durum = 'kapatildi', gorsel = NULL, guncelleme = ? WHERE id = ?").bind(simdi, id).run();
    await yorumEkle(db, id, ben, 'öneriyi geri çekti', 'olay');
    return json({ ok: true });
  }

  // İnceleme: yazan kendi önerisini onaylayamaz
  if (yol === 'oneri/degisiklik' || yol === 'oneri/onayla') {
    if (o.yazan === ben.eposta) return hata(403, 'Kendi önerini onaylayamazsın; başka bir ekip üyesinin bakması gerekiyor.');
    if (o.durum !== 'inceleme') return hata(409, 'Bu öneri şu an incelemede değil.');
  }

  if (yol === 'oneri/degisiklik' && yontem === 'POST') {
    const metin = String(veri.metin || '').trim();
    if (!metin) return hata(400, 'Neyin değişmesi gerektiğini yaz.');
    await db.prepare("UPDATE panel_oneriler SET durum = 'degisiklik', guncelleme = ? WHERE id = ?").bind(simdi, id).run();
    await yorumEkle(db, id, ben, metin, 'degisiklik');
    return json({ ok: true });
  }

  if (yol === 'oneri/onayla' && yontem === 'POST') {
    if (!env.GITHUB_TOKEN) return hata(503, 'GitHub bağlantısı kurulmamış (GITHUB_TOKEN).');
    // Onay, inceleyenin gördüğü sürüme verilir
    if (Number(veri.surum) !== o.surum) return hata(409, 'Öneri sen bakarken güncellendi. Son hâline bakıp öyle onayla.');
    // Aynı anda iki kişi onaylamasın: öneri kısa bir süre bu kişiye kilitlenir
    const kilit = await db.prepare(`UPDATE panel_oneriler SET onaylayan = ?, onaylayan_ad = ?, guncelleme = ?
      WHERE id = ? AND durum = 'inceleme' AND surum = ? AND (onaylayan IS NULL OR guncelleme < ?)`)
      .bind(ben.eposta, ben.ad, simdi, id, o.surum, simdi - KILIT).run();
    if (kilit.meta.changes !== 1) return hata(409, 'Bu öneriyi şu an başka biri onaylıyor.');
    const kilidiAc = (durum = 'inceleme') => db.prepare("UPDATE panel_oneriler SET durum = ?, onaylayan = NULL, onaylayan_ad = NULL WHERE id = ?").bind(durum, id).run();
    const dosyalar = o.islem === 'kaydet'
      ? [{ yol: o.yol, metin: o.metin }, ...(o.gorsel && o.gorsel_yol ? [{ yol: o.gorsel_yol, base64: o.gorsel }] : [])]
      : [];
    const tanim = { yazi: 'Yazı', sayi: 'Sayı' }[o.tur];
    const eylem = o.islem === 'sil' ? 'silindi' : o.temel ? 'güncellendi' : 'eklendi';
    const mesaj = `${tanim} ${eylem}: ${o.baslik}\n\nÖneren: ${o.yazan_ad} <${o.yazan}>\nOnaylayan: ${ben.ad} <${ben.eposta}>`;
    let commit;
    try {
      commit = await github(env).yaz({
        mesaj, yazar: { ad: o.yazan_ad, eposta: o.yazan }, dosyalar, sil: o.islem === 'sil' ? [o.yol] : [], beklenen: { [o.yol]: o.temel },
      });
    } catch (e) {
      if (e instanceof GithubHatasi && e.status === 409) {
        await yorumEkle(db, id, ben, 'yayınlanamadı: bu öneri hazırlanırken yayındaki sürüm değişmiş. yazanın öneriyi güncel sürüme göre düzeltip yeniden göndermesi gerekiyor.', 'olay');
        await kilidiAc('degisiklik');
        return hata(409, 'Bu öneri hazırlanırken yayındaki sürüm değişmiş. Öneri, düzeltilmesi için yazana geri gönderildi.');
      }
      await kilidiAc();
      if (e instanceof GithubHatasi) {
        console.error(e.message);
        return hata(502, e.status === 401 || e.status === 403 ? 'GitHub anahtarı geçersiz ya da yetkisi yetmiyor.' : 'GitHub şu an cevap vermiyor. Biraz sonra tekrar dene.');
      }
      throw e;
    }
    await db.prepare(`UPDATE panel_oneriler SET durum = 'yayinlandi', onaylayan = ?, onaylayan_ad = ?, commit_sha = ?, gorsel = NULL, guncelleme = ? WHERE id = ?`)
      .bind(ben.eposta, ben.ad, commit, simdi, id).run();
    const not = String(veri.metin || '').trim();
    await yorumEkle(db, id, ben, not ? `onayladı ve yayınladı: ${not}` : 'onayladı ve yayınladı', 'onay');
    return json({ ok: true, commit });
  }

  return hata(404, 'Bulunamadı.');
}
