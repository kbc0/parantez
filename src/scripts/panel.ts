// (parantez) — yazı paneli (/admin). Tek sayfalık küçük bir uygulama.
// Sunucu: worker/panel.js (/api/panel/*). Dosya biçimi ve denetim: panel-icerik.ts.
import { KONULAR } from '../lib/konular';
import {
  FIILLER, KONU_LISTESI, adres, blobSha, gunEkle, kisaltma, sayiDenetle, sayiMetni, sayiOku,
  sonrakiPazartesi, yaziDenetle, yaziMetni, yaziOku,
  type Etkinlik, type Kayit, type Kisi, type Oneri, type SayiVeri, type YaziVeri,
} from './panel-icerik';
import { av, kisiBul, onizlemeKur, sayiFarki, sayiOnizleme, yaziFarki, yaziOnizleme, type Baglam } from './panel-onizleme';

type Uye = { eposta: string; ad: string; yetki: 'yonetici' | 'yazar'; degistirmeli: boolean };
type Bekleyen = { commit: string; oncesi: string; baslik: string; adres?: string; zaman: number; yayinda?: boolean };
type OneriDurum = 'taslak' | 'inceleme' | 'degisiklik' | 'yayinlandi' | 'kapatildi';
// Öneri: yayına çıkmadan önce ekipten birinin onayını bekleyen değişiklik (worker/inceleme.js)
type OneriOzet = {
  id: number; tur: 'yazi' | 'sayi'; islem: 'kaydet' | 'sil'; yol: string; temel: string | null; metin: string | null;
  baslik: string; gorsel_yol: string | null; durum: OneriDurum; yazan: string; yazan_ad: string;
  olusturma: number; guncelleme: number; yorum: number;
};
type OneriTam = OneriOzet & { onaylayan: string | null; onaylayan_ad: string | null; commit_sha: string | null; gorselVar: boolean; surum: number };
type OneriSon = Pick<OneriTam, 'id' | 'tur' | 'islem' | 'yol' | 'baslik' | 'durum' | 'yazan' | 'yazan_ad' | 'onaylayan_ad' | 'commit_sha' | 'guncelleme'>;
type Yorum = { id: number; eposta: string; ad: string; metin: string; tur: 'yorum' | 'olay' | 'degisiklik' | 'onay'; zaman: number };

const EKIP_YOLU = 'src/data/ekip.json';
const RENKLER: [string, string][] = [
  ['#ff4a24', 'domates'], ['#2a35ff', 'mavi'], ['#111111', 'mürekkep'],
  ['#84847f', 'kurşun'], ['#d6336c', 'gül'], ['#0f8a5f', 'yeşil'],
];

const kok = document.getElementById('panel')!;
const durum = {
  ben: null as Uye | null,
  github: false,
  yuklendi: false,
  yukHata: '',
  sayilar: [] as Kayit<SayiVeri>[],
  yazilar: [] as Kayit<YaziVeri>[],
  ekip: { sha: '' as string | null, liste: [] as Kisi[] },
  oneriler: { acik: [] as OneriOzet[], son: [] as OneriSon[] },
  kirli: false,
  gecici: null as null | { eposta: string; parola: string },
};

// ------------------------------------------------------------------ yardımcılar

const e = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const pad = (n: number) => String(n).padStart(2, '0');
const deger = (r: ParentNode, ad: string) => ($<HTMLInputElement>(`[name="${ad}"]`, r)?.value ?? '').trim();

const toastEl = $('[data-toast]')!;
let toastZaman = 0;
function toast(metin: string, ms = 2600) {
  toastEl.textContent = metin;
  toastEl.hidden = false;
  clearTimeout(toastZaman);
  toastZaman = window.setTimeout(() => (toastEl.hidden = true), ms);
}

class ApiHatasi extends Error { constructor(mesaj: string, public status: number, public veri: Record<string, unknown> = {}) { super(mesaj); } }

async function api<T = Record<string, unknown>>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(`/api/panel/${yol}`, govde === undefined
    ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Panel': '1' }, body: JSON.stringify(govde) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiHatasi(j.hata || `Bir şeyler ters gitti (${r.status}).`, r.status, j);
  return j as T;
}

const yonetici = () => durum.ben?.yetki === 'yonetici';
const kisiler = () => durum.ekip.liste;
const sayiBul = (n: number) => durum.sayilar.find((s) => s.veri.sayi === n);

// Öneriler
const DURUM_ADI: Record<OneriDurum, string> = {
  taslak: 'taslak', inceleme: 'onay bekliyor', degisiklik: 'düzeltme istendi', yayinlandi: 'yayınlandı', kapatildi: 'geri çekildi',
};
const acikOneri = (yol: string) => durum.oneriler.acik.find((o) => o.yol === yol);
const benim = (o: { yazan: string }) => o.yazan === durum.ben?.eposta;
const onayimiBekleyen = () => durum.oneriler.acik.filter((o) => o.durum === 'inceleme' && !benim(o));
function rozet(o: { durum: OneriDurum; islem: string; temel?: string | null }) {
  const kapali = o.durum === 'yayinlandi' || o.durum === 'kapatildi';
  const metin = o.islem === 'sil' ? (o.durum === 'yayinlandi' ? 'silindi' : kapali ? DURUM_ADI[o.durum] : 'silinmesi önerildi')
    : o.temel === null && !kapali ? `yeni · ${DURUM_ADI[o.durum]}` : DURUM_ADI[o.durum];
  return `<em class="pn-rozet pn-rozet--${o.durum}">${metin}</em>`;
}
// Henüz yayında olmayan, öneri olarak bekleyen yeni yazı ve sayılar
const yeniYazilar = () => durum.oneriler.acik
  .filter((o) => o.tur === 'yazi' && o.islem === 'kaydet' && o.metin && !durum.yazilar.some((y) => y.yol === o.yol))
  .map((o) => ({ oneri: o, kayit: yaziOku({ yol: o.yol, sha: '', metin: o.metin! }) }));
const yeniSayilar = () => durum.oneriler.acik
  .filter((o) => o.tur === 'sayi' && o.islem === 'kaydet' && o.metin && !durum.sayilar.some((s) => s.yol === o.yol))
  .map((o) => ({ oneri: o, kayit: sayiOku({ yol: o.yol, sha: '', metin: o.metin! }) }));
// Önizleme için: yayındakiler ve önerilen yeni sayılar
const baglam = (): Baglam => ({ sayilar: [...durum.sayilar, ...yeniSayilar().map((x) => x.kayit)], yazilar: durum.yazilar, ekip: durum.ekip.liste });

function zamanMetni(t: number) {
  const dk = Math.round((Date.now() - t) / 60e3);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  if (dk < 24 * 60) return `${Math.round(dk / 60)} saat önce`;
  if (dk < 48 * 60) return 'dün';
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// ------------------------------------------------------------------ giriş ve iskelet

function girisSayfasi(mesaj = '') {
  kok.innerHTML = `
    <div class="pn-giris">
      <form class="pn-kart" data-form="giris">
        <p class="pn-marka">(parantez) <span>panel</span></p>
        <h1>Giriş yap</h1>
        ${mesaj ? `<p class="pn-uyari">${e(mesaj)}</p>` : ''}
        <label class="pn-alan"><span>E-posta</span><input name="eposta" type="email" autocomplete="username" required autofocus></label>
        <label class="pn-alan"><span>Parola</span><input name="parola" type="password" autocomplete="current-password" required></label>
        <button class="chip chip--dolu pn-tam" type="submit">Giriş</button>
        <p class="pn-not">Hesabın yoksa ya da parolanı unuttuysan yöneticiye yaz.</p>
      </form>
    </div>`;
}

function parolaSayfasi(zorunlu: boolean) {
  const adFormu = zorunlu ? '' : `
    <form class="pn-kart pn-kart--dar" data-form="ad">
      <h1>Hesabım</h1>
      <p class="pn-not">${e(durum.ben?.eposta)}</p>
      <label class="pn-alan"><span>Adın <small>panelde görünür; yazılarda yazar adı Ekip'ten seçilir</small></span><input name="ad" value="${e(durum.ben?.ad)}" required></label>
      <button class="chip chip--dolu" type="submit">Adı kaydet</button>
    </form>`;
  const icerik = `${adFormu}
    <form class="pn-kart pn-kart--dar" data-form="parola">
      <${zorunlu ? 'h1' : 'h2'}>${zorunlu ? 'Önce parolanı belirle' : 'Parolamı değiştir'}</${zorunlu ? 'h1' : 'h2'}>
      ${zorunlu ? '<p class="pn-not">Sana verilen geçici parolayla girdin. Devam etmeden kendi parolanı belirle.</p>' : ''}
      <label class="pn-alan"><span>${zorunlu ? 'Geçici parola' : 'Şu anki parola'}</span><input name="eski" type="password" autocomplete="current-password" required></label>
      <label class="pn-alan"><span>Yeni parola <small>en az 10 karakter</small></span><input name="yeni" type="password" autocomplete="new-password" minlength="10" required></label>
      <label class="pn-alan"><span>Yeni parola (tekrar)</span><input name="yeni2" type="password" autocomplete="new-password" minlength="10" required></label>
      <button class="chip chip--dolu" type="submit">Parolayı kaydet</button>
    </form>`;
  if (zorunlu) kok.innerHTML = `<div class="pn-giris">${icerik}</div>`;
  else iskelet('parola', icerik);
}

function iskelet(etkin: string, icerik: string) {
  const ben = durum.ben!;
  const link = (h: string, ad: string) => `<a href="#/${h}"${etkin === h ? ' aria-current="page"' : ''}>${ad}</a>`;
  kok.innerHTML = `
    <header class="pn-ust">
      <a class="pn-marka" href="#/yazilar">(parantez) <span>panel</span></a>
      <div class="pn-ben">
        <span>${e(ben.ad)}</span>
        <a href="#/hesabim">hesabım</a>
        <button type="button" data-cikis>Çıkış</button>
      </div>
    </header>
    <div class="pn-govde">
      <nav class="pn-menu" aria-label="Panel">
        ${link('inceleme', `İnceleme${onayimiBekleyen().length ? ` <small>${onayimiBekleyen().length} bekliyor</small>` : ''}`)}
        ${link('yazilar', 'Yazılar')}${link('sayilar', 'Sayılar')}${link('ekip', 'Ekip')}${yonetici() ? link('hesaplar', 'Hesaplar') : ''}
        <a class="pn-menu__site" href="/" target="_blank" rel="noopener">Siteyi aç ↗</a>
        <div class="pn-yayin" data-yayin></div>
      </nav>
      <main class="pn-ana">${icerik}</main>
    </div>`;
  yayinCiz();
  scrollTo(0, 0);
}

function githubYok() {
  return `
    <section class="pn-kart pn-bilgi">
      <h1>GitHub bağlantısı kurulmadı</h1>
      <p>Panel içerikleri sitenin GitHub deposuna kaydediyor. Bunun için Cloudflare'de <b>GITHUB_TOKEN</b> adında bir gizli değişken tanımlanmalı.</p>
      ${yonetici() ? '<p class="pn-not">Kurulum adımları depodaki <b>PANEL.md</b> dosyasında.</p>' : '<p class="pn-not">Yöneticiye haber ver.</p>'}
    </section>`;
}

function yukleniyor() {
  if (durum.yukHata) return `<section class="pn-kart pn-bilgi"><h1>İçerik yüklenemedi</h1><p>${e(durum.yukHata)}</p><button class="chip" type="button" data-yenile>Tekrar dene</button></section>`;
  return '<p class="pn-bos">İçerik yükleniyor…</p>';
}

// ------------------------------------------------------------------ içerik

type Ham = { yol: string; sha: string; metin: string };

// Dosya metinleri sürümüne (sha) göre tarayıcıda saklanır; sürüm değişmedikçe yeniden indirilmez
const onbellek = {
  oku(sha: string) { try { return localStorage.getItem(`pn:b:${sha}`); } catch { return null; } },
  yaz(sha: string, metin: string) { try { localStorage.setItem(`pn:b:${sha}`, metin); } catch { /* dolu */ } },
};

async function onerileriYukle() {
  const j = await api<{ acik: OneriOzet[]; son: OneriSon[] }>('oneriler');
  // Başkasının onayladığı bir öneri yayına çıktıysa içerik de tazelenmeli
  const yayina = j.son.some((o) => o.durum === 'yayinlandi' && durum.oneriler.acik.some((a) => a.id === o.id));
  const degisti = JSON.stringify(j) !== JSON.stringify(durum.oneriler);
  durum.oneriler = j;
  return { yayina, degisti };
}

// Arka planda gelen veriyle sayfa, okurun kaldığı yer kaybolmadan yeniden çizilir
function yerindeCiz() {
  const y = scrollY;
  ciz();
  scrollTo(0, y);
}

// Liste sayfalarındayken arka planda tazelenen veriyle sayfa yeniden çizilir; formlara dokunulmaz
const listede = () => ['', 'yazilar', 'sayilar', 'inceleme'].includes(location.hash.replace(/^#\/?/, '').split('/')[0]);

async function icerikYukle(sessiz = false) {
  if (!sessiz) durum.yukHata = '';
  try {
    await onerileriYukle();
    const j = await api<{ sayilar?: Ham[]; yazilar?: Ham[]; ekip?: Ham | null; agac?: { yol: string; sha: string }[] }>('icerik');
    let sayilar = j.sayilar ?? [];
    let yazilar = j.yazilar ?? [];
    let ekip = j.ekip ?? null;
    if (j.agac) {
      const eksik = j.agac.filter((d) => onbellek.oku(d.sha) === null);
      for (let i = 0; i < eksik.length; i += 40) {
        const { dosyalar } = await api<{ dosyalar: Ham[] }>('dosyalar', { liste: eksik.slice(i, i + 40) });
        for (const d of dosyalar) onbellek.yaz(d.sha, d.metin);
      }
      const tum = j.agac.map((d) => ({ ...d, metin: onbellek.oku(d.sha) ?? '' }));
      sayilar = tum.filter((d) => d.yol.startsWith('src/content/sayilar/'));
      yazilar = tum.filter((d) => d.yol.startsWith('src/content/yazilar/'));
      ekip = tum.find((d) => d.yol === EKIP_YOLU) ?? null;
    }
    durum.sayilar = sayilar.map(sayiOku);
    durum.yazilar = yazilar.map(yaziOku);
    durum.ekip = { sha: ekip?.sha ?? null, liste: ekip ? JSON.parse(ekip.metin) : [] };
    durum.yuklendi = true;
  } catch (err) {
    if (sessiz) return;
    durum.yukHata = (err as Error).message;
  }
  if (!sessiz) ciz();
  else if (listede() && !durum.kirli) yerindeCiz();
}

let sonTazeleme = Date.now();
async function tazele() {
  if (!durum.yuklendi || document.hidden || Date.now() - sonTazeleme < 45e3) return;
  sonTazeleme = Date.now();
  try {
    const { yayina, degisti } = await onerileriYukle();
    if (yayina) return icerikYukle(true);
    if (!degisti) return;
    if (listede() && !durum.kirli) yerindeCiz();
    else menuyuTazele();
  } catch { /* sessiz */ }
}
setInterval(tazele, 60e3);
document.addEventListener('visibilitychange', tazele);

function menuyuTazele() {
  const a = $('.pn-menu a[href="#/inceleme"]');
  const n = onayimiBekleyen().length;
  if (a) a.innerHTML = `İnceleme${n ? ` <small>${n} bekliyor</small>` : ''}`;
}

// ------------------------------------------------------------------ yazılar

const adOf = (yol: string) => yol.split('/').pop()!.replace(/\.md$/, '');
const siteYolu = (yol: string) => `/${yol.replace(/^public\//, '')}`;
const formOnerisi = (f: HTMLFormElement) => (f.dataset.oneri ? durum.oneriler.acik.find((o) => o.id === Number(f.dataset.oneri)) : undefined);

function yazilarSayfasi() {
  if (!durum.github) return iskelet('yazilar', githubYok());
  if (!durum.yuklendi) return iskelet('yazilar', yukleniyor());
  type Satir = { kayit: Kayit<YaziVeri>; oneri?: OneriOzet };
  const satirlar: Satir[] = [...durum.yazilar.map((kayit) => ({ kayit, oneri: acikOneri(kayit.yol) })), ...yeniYazilar()];
  const gruplar = new Map<number, Satir[]>();
  for (const x of satirlar) gruplar.set(x.kayit.veri.sayi, [...(gruplar.get(x.kayit.veri.sayi) ?? []), x]);
  const tum = baglam().sayilar;
  const nolar = [...new Set([...tum.map((s) => s.veri.sayi), ...gruplar.keys()])].sort((a, b) => b - a);
  const satir = ({ kayit: y, oneri: o }: Satir) => `
    <a class="pn-satir-link" href="${o ? `#/oneri/${o.id}` : `#/yazi/${e(adOf(y.yol))}`}">
      <span class="pn-no">${pad(y.veri.sira)}</span>
      <span class="pn-satir-t"><b>${e(y.veri.baslik)}</b><small>${e(KONULAR[y.veri.konu] ?? (y.veri.konu || 'konu yok'))} · ${e(y.veri.yazar)}${o ? ` · öneren ${e(o.yazan_ad)}` : ''}</small></span>
      ${o ? rozet(o) : y.veri.taslak ? '<em class="pn-rozet">gizli</em>' : ''}
    </a>`;
  iskelet('yazilar', `
    <div class="pn-bas">
      <h1>Yazılar</h1>
      <a class="chip chip--dolu" href="#/yazi/yeni">+ Yeni yazı</a>
    </div>
    ${nolar.map((n) => {
      const s = tum.find((x) => x.veri.sayi === n);
      const sOneri = s ? acikOneri(s.yol) : undefined;
      const liste = (gruplar.get(n) ?? []).sort((a, b) => a.kayit.veri.sira - b.kayit.veri.sira);
      return `
        <section class="pn-grup">
          <h2>Sayı ${pad(n)}${s ? ` · ${e(s.veri.baslik)}` : ''} ${sOneri ? rozet(sOneri) : s?.veri.taslak ? '<em class="pn-rozet">sayı gizli</em>' : ''}</h2>
          ${liste.length ? liste.map(satir).join('') : '<p class="pn-bos">Bu sayıda henüz yazı yok.</p>'}
        </section>`;
    }).join('') || '<p class="pn-bos">Henüz yazı yok.</p>'}`);
}

let yeniGorsel: { yol: string; base64: string; url: string } | null = null;

// Başkasının açık önerisi olan bir şey düzenlenmez: öneriye gidilir, orada yorum yazılır
function oneriyeYonlendir(o: OneriOzet) {
  if (!benim(o)) toast(`Bunun için ${o.yazan_ad} bir öneri hazırlamış. Ona yorum yazabilirsin.`, 4200);
  location.replace(benim(o) && o.islem === 'kaydet' ? `#/oneri/${o.id}/duzenle` : `#/oneri/${o.id}`);
}

function yaziFormu(slug: string, oneriId?: number) {
  if (!durum.github) return iskelet('yazilar', githubYok());
  if (!durum.yuklendi) return iskelet('yazilar', yukleniyor());
  const oneri = oneriId ? durum.oneriler.acik.find((o) => o.id === oneriId) : undefined;
  if (oneriId && (!oneri || !benim(oneri) || oneri.islem !== 'kaydet')) return void location.replace(`#/oneri/${oneriId}`);
  const yol = oneri?.yol ?? (slug === 'yeni' ? null : `src/content/yazilar/${slug}.md`);
  const kayit = yol ? durum.yazilar.find((y) => y.yol === yol) ?? null : null;
  if (!oneri && yol) {
    const o = acikOneri(yol);
    if (o) return oneriyeYonlendir(o);
    if (!kayit) return iskelet('yazilar', '<p class="pn-bos">Yazı bulunamadı.</p>');
  }
  const kaynak = oneri ? yaziOku({ yol: oneri.yol, sha: '', metin: oneri.metin ?? '' }) : kayit;
  const eskimis = !!oneri && (oneri.temel ?? null) !== (kayit?.sha ?? null);
  yeniGorsel = null;

  const tum = baglam().sayilar.sort((a, b) => b.veri.sayi - a.veri.sayi);
  const son = tum[0]?.veri.sayi ?? 1;
  const benKisi = kisiler().find((k) => k.ad === durum.ben?.ad)?.ad ?? kisiler()[0]?.ad ?? '';
  const v: YaziVeri = kaynak?.veri ?? {
    baslik: '', sayi: son, sira: durum.yazilar.filter((y) => y.veri.sayi === son).length + 1, konu: '', yazar: benKisi,
    spot: '', gorsel: '', gorselAlt: '', gorselKaynak: '', neden: '', kisaca: ['', '', ''],
  };
  const govde = kaynak?.govde ?? '';
  const kisaca = v.kisaca.length ? v.kisaca : [''];
  const yazarlar = kisiler().some((k) => k.ad === v.yazar) || !v.yazar ? kisiler() : [...kisiler(), { ad: v.yazar, kisa: '', renk: '', rol: '' }];
  const gorselSrc = oneri?.gorsel_yol && v.gorsel === siteYolu(oneri.gorsel_yol) ? `/api/panel/gorsel?id=${oneri.id}` : v.gorsel;
  const ad = yol ? adOf(yol) : 'yeni';

  iskelet('yazilar', `
    <form class="pn-form" data-form="yazi" data-slug="${e(ad)}" data-oneri="${oneri?.id ?? ''}" novalidate>
      <div class="pn-bas">
        <h1>${oneri ? 'Önerini düzenle' : kayit ? 'Yazıyı düzenle' : 'Yeni yazı'}</h1>
        ${kayit ? `<a class="pn-dis" href="/yazi/${e(ad)}/" target="_blank" rel="noopener">Yayındaki hâli ↗</a>` : ''}
      </div>
      ${eskimis ? '<p class="pn-uyari">Sen bu öneriyi hazırladıktan sonra yazının yayındaki hâli değişti. Kaydettiğinde önerin yayındaki son hâlin üzerine kurulur; önizlemede ve değişikliklerde, araya girmiş bir düzeltmeyi geri almadığına bak.</p>' : ''}
      <div class="pn-hatalar" data-hatalar hidden></div>

      <label class="pn-alan"><span>Başlık</span><input name="baslik" value="${e(v.baslik)}" maxlength="140" required></label>
      ${yol
        ? `<p class="pn-adres">parantezbulten.com/yazi/<b>${e(ad)}</b>/</p>`
        : `<label class="pn-alan"><span>Adres <small>başlıktan oluşur; kaydettikten sonra değişmez</small></span>
            <div class="pn-adres-gir"><span>parantezbulten.com/yazi/</span><input name="adres" pattern="[a-z0-9-]+" maxlength="60" data-adres-elle="0"><span>/</span></div></label>`}

      <div class="pn-izgara">
        <label class="pn-alan"><span>Sayı</span><select name="sayi">${tum.map((s) => `<option value="${s.veri.sayi}"${s.veri.sayi === v.sayi ? ' selected' : ''}>Sayı ${pad(s.veri.sayi)}${!s.sha ? ' (öneri)' : s.veri.taslak ? ' (gizli)' : ''}</option>`).join('')}</select></label>
        <label class="pn-alan"><span>Sıra</span><input name="sira" type="number" min="1" max="9" value="${v.sira}"></label>
        <label class="pn-alan"><span>Konu</span><select name="konu"><option value="">Seç</option>${KONU_LISTESI.map(([k, ad]) => `<option value="${k}"${k === v.konu ? ' selected' : ''}>${ad}</option>`).join('')}</select></label>
        <label class="pn-alan"><span>Yazar</span><select name="yazar">${yazarlar.map((k) => `<option${k.ad === v.yazar ? ' selected' : ''}>${e(k.ad)}</option>`).join('')}</select></label>
      </div>

      <label class="pn-alan"><span>Spot <small>başlığın altındaki bir-iki cümle</small></span><textarea name="spot" rows="3">${e(v.spot)}</textarea></label>

      <fieldset class="pn-kutu pn-gorsel">
        <legend>Görsel</legend>
        <div class="pn-gorsel__on" data-gorsel-on>${gorselSrc ? `<img src="${e(gorselSrc)}" alt="">` : '<span>Görsel yok</span>'}</div>
        <div class="pn-gorsel__alan">
          <label class="chip pn-dosya">Görsel seç<input type="file" name="gorselDosya" accept="image/*"></label>
          <small>Yatay bir fotoğraf iyi durur. Büyükse küçültülür.</small>
          <input type="hidden" name="gorsel" value="${e(v.gorsel)}">
          <label class="pn-alan"><span>Görselde ne var? <small>görme engelli okurlar için</small></span><input name="gorselAlt" value="${e(v.gorselAlt)}"></label>
          <label class="pn-alan"><span>Kaynak</span><input name="gorselKaynak" value="${e(v.gorselKaynak)}" placeholder="Fotoğraf: Ad Soyad"></label>
        </div>
      </fieldset>

      <fieldset class="pn-kutu" data-liste="kisaca">
        <legend>Kısaca <small>yazının en başında, 1–4 madde</small></legend>
        <div data-satirlar>${kisaca.map((k) => kisacaSatiri(k)).join('')}</div>
        <button type="button" class="pn-ekle" data-ekle="kisaca">+ madde ekle</button>
      </fieldset>

      <label class="pn-alan"><span>Neden önemli? <small>yazının sonundaki pembe not</small></span><textarea name="neden" rows="2">${e(v.neden)}</textarea></label>

      ${metinAlani(govde)}

      ${v.taslak ? '<label class="pn-onay"><input type="checkbox" name="taslak" checked> Sitede gizli kalsın <small>onaylansa da görünmez</small></label>' : ''}

      ${eylemler(oneri, kayit ? 'Silinmesini öner' : '', '#/yazilar')}
    </form>`);
}

// Formların altı: önizle, incelemeye gönder, taslak olarak sakla
function eylemler(oneri: OneriOzet | undefined, silme: string, geri: string) {
  const inceleniyor = oneri?.durum === 'inceleme';
  return `
    <div class="pn-gonder">
      <div class="pn-eylem">
        <button class="chip" type="button" data-onizle>Önizle</button>
        <button class="chip chip--dolu" type="submit" data-gonder="1">${inceleniyor ? 'Öneriyi güncelle' : oneri?.durum === 'degisiklik' ? 'Düzelttim, yeniden gönder' : 'İncelemeye gönder'}</button>
        ${inceleniyor ? '' : `<button class="chip" type="submit" data-gonder="0">${oneri?.durum === 'degisiklik' ? 'Kaydet, sonra gönderirim' : 'Taslak olarak sakla'}</button>`}
        <a class="pn-vazgec" href="${oneri ? `#/oneri/${oneri.id}` : geri}">Vazgeç</a>
        ${silme && !oneri ? `<button class="pn-tehlike" type="button" data-sil>${silme}</button>` : ''}
      </div>
      <p class="pn-not">Hiçbir şey doğrudan yayına çıkmaz. İncelemeye gönderince ekipten başka biri önizleyip onaylar; kendi önerini onaylayamazsın.</p>
    </div>`;
}

const kisacaSatiri = (k: string) =>
  `<div class="pn-satir"><input name="kisaca" value="${e(k)}" maxlength="160" placeholder="Kısa bir cümle"><button type="button" class="pn-x" data-sil-satir aria-label="Maddeyi sil">×</button></div>`;

function metinAlani(govde: string, baslik = 'Metin', ipucu = 'Paragraflar arasında bir boş satır bırak. “## ” ile başlayan satır ara başlık olur.') {
  return `
    <div class="pn-metin">
      <div class="pn-arac">
        <span>${baslik}</span>
        <button type="button" data-bicim="h2">Ara başlık</button>
        <button type="button" data-bicim="b"><b>Kalın</b></button>
        <button type="button" data-bicim="a">Bağlantı</button>
      </div>
      <textarea name="govde" rows="16">${e(govde)}</textarea>
      <small>${ipucu}</small>
    </div>`;
}

function yaziOkuForm(f: HTMLFormElement): YaziVeri {
  const oneri = formOnerisi(f);
  const kaynak = oneri?.metin ? yaziOku({ yol: oneri.yol, sha: '', metin: oneri.metin }) : durum.yazilar.find((y) => adOf(y.yol) === f.dataset.slug);
  return {
    baslik: deger(f, 'baslik'), sayi: Number(deger(f, 'sayi')), sira: Number(deger(f, 'sira')),
    konu: deger(f, 'konu'), yazar: deger(f, 'yazar'), spot: deger(f, 'spot'), gorsel: deger(f, 'gorsel'),
    gorselAlt: deger(f, 'gorselAlt'), gorselKaynak: deger(f, 'gorselKaynak'), neden: deger(f, 'neden'),
    kisaca: $$<HTMLInputElement>('[name="kisaca"]', f).map((i) => i.value.trim()).filter(Boolean),
    podcast: kaynak?.veri.podcast,
    taslak: !!$<HTMLInputElement>('[name="taslak"]', f)?.checked,
  };
}

// Görsel: yeni seçildiyse gönderilir; önerideki eski görsel artık kullanılmıyorsa silinir
function gorselIstegi(gorsel: string, oneri?: OneriOzet) {
  if (yeniGorsel && gorsel === siteYolu(yeniGorsel.yol)) return { yol: yeniGorsel.yol, base64: yeniGorsel.base64 };
  if (oneri?.gorsel_yol && gorsel !== siteYolu(oneri.gorsel_yol)) return null;
  return undefined;
}

async function yaziKaydet(f: HTMLFormElement, gonder: boolean) {
  const oneri = formOnerisi(f);
  const sabit = f.dataset.slug !== 'yeni';
  const v = yaziOkuForm(f);
  const govde = $<HTMLTextAreaElement>('[name="govde"]', f)!.value;
  const ad = sabit ? f.dataset.slug! : (deger(f, 'adres') || adres(v.baslik));
  const yol = `src/content/yazilar/${ad}.md`;
  const kayit = durum.yazilar.find((y) => y.yol === yol) ?? null;
  const hatalar = gonder ? yaziDenetle(v, govde) : v.baslik ? [] : ['Başlık boş.'];
  if (!sabit) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ad)) hatalar.push('Adres yalnızca küçük harf, rakam ve tire içerebilir.');
    else if (kayit || acikOneri(yol)) hatalar.push('Bu adresle bir yazı ya da öneri zaten var; adresi değiştir.');
  }
  if (gonder) {
    const ayniSira = [...durum.yazilar, ...yeniYazilar().map((x) => x.kayit)]
      .find((y) => y.yol !== yol && y.veri.sayi === v.sayi && y.veri.sira === v.sira && !y.veri.taslak);
    if (ayniSira) hatalar.push(`Sayı ${pad(v.sayi)}'te ${v.sira}. sırada zaten “${ayniSira.veri.baslik}” var.`);
  }
  if (hataGoster(f, hatalar)) return;
  await oneriKaydet(f, {
    id: oneri?.id, tur: 'yazi', islem: 'kaydet', yol, temel: kayit?.sha ?? null,
    metin: yaziMetni(v, govde), baslik: v.baslik, gorsel: gorselIstegi(v.gorsel, oneri),
  }, gonder);
}

async function oneriKaydet(f: HTMLFormElement, istek: Record<string, unknown>, gonder: boolean) {
  const dugmeler = $$<HTMLButtonElement>('.pn-eylem button', f);
  for (const d of dugmeler) d.disabled = true;
  try {
    const j = await api<{ id: number }>('oneri', { ...istek, gonder });
    durum.kirli = false;
    await onerileriYukle().catch(() => {});
    toast(gonder ? 'İncelemeye gönderildi. Ekipten biri onaylayınca yayına çıkar.' : 'Kaydedildi. Hazır olunca incelemeye gönder.', 3800);
    location.hash = `#/oneri/${j.id}`;
  } catch (err) {
    const a = err as ApiHatasi;
    hataGoster(f, [a.message], a.veri?.id ? `#/oneri/${a.veri.id}` : undefined);
  } finally {
    for (const d of dugmeler) if (d.isConnected) d.disabled = false;
  }
}

// ------------------------------------------------------------------ sayılar

function sayilarSayfasi() {
  if (!durum.github) return iskelet('sayilar', githubYok());
  if (!durum.yuklendi) return iskelet('sayilar', yukleniyor());
  const satirlar = [...durum.sayilar.map((kayit) => ({ kayit, oneri: acikOneri(kayit.yol) })), ...yeniSayilar()]
    .sort((a, b) => b.kayit.veri.sayi - a.kayit.veri.sayi);
  iskelet('sayilar', `
    <div class="pn-bas">
      <h1>Sayılar</h1>
      <a class="chip chip--dolu" href="#/sayi/yeni">+ Yeni sayı</a>
    </div>
    <section class="pn-grup">
      ${satirlar.map(({ kayit: s, oneri: o }) => `
        <a class="pn-satir-link" href="${o ? `#/oneri/${o.id}` : `#/sayi/${s.veri.sayi}`}">
          <span class="pn-no">${pad(s.veri.sayi)}</span>
          <span class="pn-satir-t"><b>${e(s.veri.baslik || 'Başlıksız')}</b><small>yayın ${e(s.veri.yayin)} · ${durum.yazilar.filter((y) => y.veri.sayi === s.veri.sayi).length} yazı${o ? ` · öneren ${e(o.yazan_ad)}` : ''}</small></span>
          ${o ? rozet(o) : s.veri.taslak ? '<em class="pn-rozet">gizli</em>' : ''}
        </a>`).join('') || '<p class="pn-bos">Henüz sayı yok.</p>'}
    </section>`);
}

const kisaKisaSatiri = (k: { konu: string; metin: string }) => `
  <div class="pn-satir pn-satir--konu">
    <select name="kkKonu"><option value="">Konu</option>${KONU_LISTESI.map(([kk, ad]) => `<option value="${kk}"${kk === k.konu ? ' selected' : ''}>${ad}</option>`).join('')}</select>
    <input name="kkMetin" value="${e(k.metin)}" maxlength="240" placeholder="Bir cümlelik haber">
    <button type="button" class="pn-x" data-sil-satir aria-label="Maddeyi sil">×</button>
  </div>`;

const etkinlikSatiri = (x: Partial<Etkinlik>) => `
  <div class="pn-etk">
    <div class="pn-etk__ust">
      <label class="pn-alan"><span>Tarih</span><input name="evTarih" type="date" value="${e(x.tarih)}"></label>
      <label class="pn-alan"><span>Saat</span><input name="evSaat" type="time" value="${e(x.saat)}"></label>
      <label class="pn-alan"><span>Tür</span><input name="evTur" value="${e(x.tur)}" placeholder="Konser, söyleşi…"></label>
      <label class="pn-alan"><span>Ücret</span><input name="evUcret" value="${e(x.ucret)}" placeholder="Ücretsiz / 250 TL"></label>
    </div>
    <label class="pn-alan"><span>Etkinliğin adı</span><input name="evAd" value="${e(x.ad)}"></label>
    <div class="pn-etk__ust">
      <label class="pn-alan"><span>Yer</span><input name="evYer" value="${e(x.yer)}"></label>
      <label class="pn-alan"><span>Şehir</span><input name="evSehir" value="${e(x.sehir)}" placeholder="Kadıköy, İstanbul"></label>
      <label class="pn-alan pn-alan--genis"><span>Bağlantı <small>isteğe bağlı</small></span><input name="evLink" type="url" value="${e(x.link)}" placeholder="https://"></label>
    </div>
    <button type="button" class="pn-tehlike pn-kucuk" data-sil-satir>Etkinliği kaldır</button>
  </div>`;

function oneriAlani(k: string, ad: string, o?: Oneri) {
  return `
    <fieldset class="pn-kutu pn-oneri" data-oneri="${k}">
      <legend>${ad} <small>boş bırakılabilir</small></legend>
      <div class="pn-izgara">
        <label class="pn-alan"><span>Başlık</span><input name="${k}Baslik" value="${e(o?.baslik)}"></label>
        <label class="pn-alan"><span>Kimden</span><input name="${k}Kimden" value="${e(o?.kimden)}" placeholder="sanatçı, yönetmen, yazar"></label>
        <label class="pn-alan"><span>Tür</span><input name="${k}Tur" value="${e(o?.tur)}" placeholder="Albüm · 2018"></label>
      </div>
      <label class="pn-alan"><span>Bizim notumuz <small data-sayac="${k}Not">${o?.not.length ?? 0}/200</small></span><textarea name="${k}Not" rows="2" maxlength="200">${e(o?.not)}</textarea></label>
      <div class="pn-izgara">
        <label class="pn-alan"><span>Bağlantı <small>isteğe bağlı</small></span><input name="${k}Link" type="url" value="${e(o?.link)}" placeholder="https://"></label>
        <label class="pn-alan"><span>Bağlantı yazısı</span><input name="${k}LinkMetni" value="${e(o?.linkMetni)}" placeholder="Spotify’da dinle →"></label>
      </div>
    </fieldset>`;
}

function sayiFormu(arg: string, oneriId?: number) {
  if (!durum.github) return iskelet('sayilar', githubYok());
  if (!durum.yuklendi) return iskelet('sayilar', yukleniyor());
  const oneri = oneriId ? durum.oneriler.acik.find((o) => o.id === oneriId) : undefined;
  if (oneriId && (!oneri || !benim(oneri) || oneri.islem !== 'kaydet')) return void location.replace(`#/oneri/${oneriId}`);
  const kayit = oneri ? durum.sayilar.find((s) => s.yol === oneri.yol) ?? null : arg === 'yeni' ? null : sayiBul(Number(arg)) ?? null;
  if (!oneri && arg !== 'yeni') {
    const o = kayit ? acikOneri(kayit.yol) : yeniSayilar().find((x) => x.kayit.veri.sayi === Number(arg))?.oneri;
    if (o) return oneriyeYonlendir(o);
    if (!kayit) return iskelet('sayilar', '<p class="pn-bos">Sayı bulunamadı.</p>');
  }
  const kaynak = oneri ? sayiOku({ yol: oneri.yol, sha: '', metin: oneri.metin ?? '' }) : kayit;
  const eskimis = !!oneri && (oneri.temel ?? null) !== (kayit?.sha ?? null);
  const yayin = sonrakiPazartesi();
  const editor = kisiler()[0];
  const enBuyuk = Math.max(0, ...baglam().sayilar.map((s) => s.veri.sayi));
  const v: SayiVeri = kaynak?.veri ?? {
    sayi: enBuyuk + 1, baslik: '', yayin, baslangic: gunEkle(yayin, -6), bitis: yayin,
    imza: editor ? `${editor.ad}, ${editor.rol}` : '', kisaKisa: [{ konu: '', metin: '' }, { konu: '', metin: '' }, { konu: '', metin: '' }],
    oneriler: {}, etkinlikler: [], taslak: true,
  };
  const imzalar = kisiler().map((k) => `${k.ad}, ${k.rol}`);
  if (v.imza && !imzalar.includes(v.imza)) imzalar.push(v.imza);
  const yazilari = durum.yazilar.filter((y) => y.veri.sayi === v.sayi).length;
  const yol = oneri?.yol ?? kayit?.yol ?? '';

  iskelet('sayilar', `
    <form class="pn-form" data-form="sayi" data-yol="${e(yol)}" data-oneri="${oneri?.id ?? ''}" novalidate>
      <div class="pn-bas">
        <h1>${oneri ? 'Önerini düzenle' : kayit ? `Sayı ${pad(v.sayi)}` : 'Yeni sayı'}</h1>
        ${kayit && !kayit.veri.taslak ? `<a class="pn-dis" href="/sayi/${v.sayi}/" target="_blank" rel="noopener">Yayındaki hâli ↗</a>` : ''}
      </div>
      ${eskimis ? '<p class="pn-uyari">Sen bu öneriyi hazırladıktan sonra sayının yayındaki hâli değişti. Kaydettiğinde önerin yayındaki son hâlin üzerine kurulur; araya girmiş bir düzeltmeyi geri almadığına bak.</p>' : ''}
      <div class="pn-hatalar" data-hatalar hidden></div>

      <div class="pn-izgara">
        <label class="pn-alan"><span>Sayı no</span><input name="sayi" type="number" min="1" value="${v.sayi}"${yol ? ' readonly' : ''}></label>
        <label class="pn-alan"><span>Yayın (pazartesi)</span><input name="yayin" type="date" value="${e(v.yayin)}"></label>
        <label class="pn-alan"><span>Kapsadığı hafta: başlangıç</span><input name="baslangic" type="date" value="${e(v.baslangic)}"></label>
        <label class="pn-alan"><span>Bitiş</span><input name="bitis" type="date" value="${e(v.bitis)}"></label>
      </div>
      <label class="pn-alan"><span>Haftanın cümlesi <small>sohbetteki büyük başlık</small></span><input name="baslik" value="${e(v.baslik)}" maxlength="90" placeholder="Faiz sabit, kira değil."></label>
      <label class="pn-alan"><span>İmza <small>selamı veren editör</small></span><select name="imza">${imzalar.map((i) => `<option${i === v.imza ? ' selected' : ''}>${e(i)}</option>`).join('')}</select></label>

      ${metinAlani(kaynak?.govde ?? '', 'Haftanın özeti', 'Editörün notu: iki kısa paragraf. Sohbette selamdan sonra gelir.')}

      <fieldset class="pn-kutu" data-liste="kisaKisa">
        <legend>Kısa kısa <small>“Ne oldu?” · 3–5 madde</small></legend>
        <div data-satirlar>${v.kisaKisa.map(kisaKisaSatiri).join('')}</div>
        <button type="button" class="pn-ekle" data-ekle="kisaKisa">+ madde ekle</button>
      </fieldset>

      <h2 class="pn-ara">Parantez dışı</h2>
      ${FIILLER.map(([k, ad]) => oneriAlani(k, ad, v.oneriler?.[k])).join('')}

      <fieldset class="pn-kutu" data-liste="etkinlik">
        <legend>Gidilecek yerler <small>en fazla 6</small></legend>
        <div data-satirlar>${(v.etkinlikler ?? []).map(etkinlikSatiri).join('')}</div>
        <button type="button" class="pn-ekle" data-ekle="etkinlik">+ etkinlik ekle</button>
      </fieldset>

      <label class="pn-onay"><input type="checkbox" name="taslak"${v.taslak ? ' checked' : ''}> Sitede gizli kalsın <small>sayı ve yazıları onaylansa da görünmez; hepsi hazır olunca işareti kaldırıp yeniden gönder, birlikte yayına çıksınlar</small></label>

      ${eylemler(oneri, kayit && !yazilari ? 'Silinmesini öner' : '', '#/sayilar')}
      ${kayit && yazilari && !oneri ? `<p class="pn-not">Bu sayıyı silmek için önce içindeki ${yazilari} yazının silinmesi ya da başka sayıya taşınması gerekiyor.</p>` : ''}
    </form>`);
}

function sayiOkuForm(f: HTMLFormElement): SayiVeri {
  const oneriler: SayiVeri['oneriler'] = {};
  for (const [k] of FIILLER) {
    const o: Oneri = {
      baslik: deger(f, `${k}Baslik`), kimden: deger(f, `${k}Kimden`), tur: deger(f, `${k}Tur`), not: deger(f, `${k}Not`),
      link: deger(f, `${k}Link`) || undefined, linkMetni: deger(f, `${k}LinkMetni`) || undefined,
    };
    if (o.baslik || o.kimden || o.tur || o.not || o.link) oneriler[k] = o;
  }
  const etkinlikler: Etkinlik[] = $$('.pn-etk', f).map((r) => ({
    tarih: deger(r, 'evTarih'), saat: deger(r, 'evSaat') || undefined, ad: deger(r, 'evAd'), tur: deger(r, 'evTur'),
    yer: deger(r, 'evYer'), sehir: deger(r, 'evSehir'), ucret: deger(r, 'evUcret'), link: deger(r, 'evLink') || undefined,
  })).filter((x) => Object.values(x).some(Boolean));
  return {
    sayi: Number(deger(f, 'sayi')), baslik: deger(f, 'baslik'), yayin: deger(f, 'yayin'), baslangic: deger(f, 'baslangic'),
    bitis: deger(f, 'bitis'), imza: deger(f, 'imza'),
    kisaKisa: $$('.pn-satir--konu', f).map((r) => ({ konu: deger(r, 'kkKonu'), metin: deger(r, 'kkMetin') })).filter((k) => k.metin || k.konu),
    oneriler, etkinlikler: etkinlikler.sort((a, b) => a.tarih.localeCompare(b.tarih)),
    taslak: $<HTMLInputElement>('[name="taslak"]', f)!.checked,
  };
}

async function sayiKaydet(f: HTMLFormElement, gonder: boolean) {
  const oneri = formOnerisi(f);
  const v = sayiOkuForm(f);
  const govde = $<HTMLTextAreaElement>('[name="govde"]', f)!.value;
  const yol = f.dataset.yol || `src/content/sayilar/${pad(v.sayi)}.md`;
  const kayit = durum.sayilar.find((s) => s.yol === yol) ?? null;
  const hatalar = gonder ? sayiDenetle(v) : v.sayi > 0 ? [] : ['Sayı numarası geçersiz.'];
  if (gonder && !govde.trim()) hatalar.push('Haftanın özeti boş.');
  if (!f.dataset.yol && v.sayi > 0 && (baglam().sayilar.some((s) => s.veri.sayi === v.sayi) || acikOneri(yol))) hatalar.push(`Sayı ${pad(v.sayi)} zaten var ya da önerilmiş.`);
  if (hataGoster(f, hatalar)) return;
  await oneriKaydet(f, {
    id: oneri?.id, tur: 'sayi', islem: 'kaydet', yol, temel: kayit?.sha ?? null,
    metin: sayiMetni(v, govde), baslik: `Sayı ${pad(v.sayi)}${v.baslik ? ` · ${v.baslik}` : ''}`,
  }, gonder);
}

// ------------------------------------------------------------------ ekip

const ekipSatiri = (k: Partial<Kisi>, duzenle: boolean) => duzenle ? `
  <div class="pn-kisi">
    <span class="av" style="--av:${e(k.renk || '#111111')}" data-kisi-av>${e(k.kisa)}</span>
    <label class="pn-alan"><span>Ad soyad</span><input name="kAd" value="${e(k.ad)}"></label>
    <label class="pn-alan pn-alan--kisa"><span>Kısaltma</span><input name="kKisa" value="${e(k.kisa)}" maxlength="3"></label>
    <label class="pn-alan"><span>Rol</span><input name="kRol" value="${e(k.rol)}" placeholder="editör"></label>
    <label class="pn-alan pn-alan--kisa"><span>Renk</span><select name="kRenk">${RENKLER.map(([r, ad]) => `<option value="${r}"${r === k.renk ? ' selected' : ''}>${ad}</option>`).join('')}</select></label>
    <button type="button" class="pn-x" data-sil-satir aria-label="Kişiyi çıkar">×</button>
  </div>` : `
  <div class="pn-kisi pn-kisi--oku">
    <span class="av" style="--av:${e(k.renk)}">${e(k.kisa)}</span>
    <span class="pn-satir-t"><b>${e(k.ad)}</b><small>${e(k.rol)}</small></span>
  </div>`;

function ekipSayfasi() {
  if (!durum.github) return iskelet('ekip', githubYok());
  if (!durum.yuklendi) return iskelet('ekip', yukleniyor());
  const duzenle = yonetici();
  iskelet('ekip', `
    <form class="pn-form" data-form="ekip" novalidate>
      <div class="pn-bas"><h1>Ekip</h1></div>
      <p class="pn-not">Yazılarda ve sohbette görünen kişiler: adı, avatardaki kısaltması, rengi ve rolü.${duzenle ? ' Bir ismi değiştirirsen eski yazılarda eski isim kalır.' : ' Değişiklik için yöneticiye yaz.'}</p>
      <div class="pn-hatalar" data-hatalar hidden></div>
      <fieldset class="pn-kutu" data-liste="ekip">
        <div data-satirlar>${kisiler().map((k) => ekipSatiri(k, duzenle)).join('')}</div>
        ${duzenle ? '<button type="button" class="pn-ekle" data-ekle="ekip">+ kişi ekle</button>' : ''}
      </fieldset>
      ${duzenle ? '<div class="pn-eylem"><button class="chip chip--dolu" type="submit" data-kaydet>Ekibi kaydet</button></div>' : ''}
    </form>`);
}

async function ekipKaydet(f: HTMLFormElement) {
  const liste: Kisi[] = $$('.pn-kisi', f).map((r) => ({
    ad: deger(r, 'kAd'), kisa: (deger(r, 'kKisa') || kisaltma(deger(r, 'kAd'))).toLocaleUpperCase('tr'), renk: deger(r, 'kRenk'), rol: deger(r, 'kRol'),
  })).filter((k) => k.ad);
  const hatalar: string[] = [];
  if (!liste.length) hatalar.push('Ekipte en az bir kişi olmalı.');
  if (liste.some((k) => !k.rol)) hatalar.push('Herkesin bir rolü olmalı.');
  if (new Set(liste.map((k) => k.ad)).size !== liste.length) hatalar.push('Aynı isim iki kez yazılmış.');
  if (hataGoster(f, hatalar)) return;
  const metin = `${JSON.stringify(liste, null, 2)}\n`;
  await kaydet(f, { mesaj: 'Ekip güncellendi', dosyalar: [{ yol: EKIP_YOLU, metin }], beklenen: { [EKIP_YOLU]: durum.ekip.sha } }, async (commit) => {
    durum.ekip = { sha: await blobSha(metin), liste };
    bekleyenEkle(commit, 'Ekip');
    toast('Ekip kaydedildi.');
    ekipSayfasi();
  });
}

// ------------------------------------------------------------------ hesaplar (yönetici)

async function hesaplarSayfasi() {
  if (!yonetici()) return iskelet('hesaplar', '<p class="pn-bos">Bu sayfa yalnızca yönetici için.</p>');
  iskelet('hesaplar', '<p class="pn-bos">Hesaplar yükleniyor…</p>');
  let uyeler: (Uye & { olusturma: number })[] = [];
  try { uyeler = (await api<{ uyeler: (Uye & { olusturma: number })[] }>('uyeler')).uyeler; } catch (err) { toast((err as Error).message); }
  const g = durum.gecici;
  iskelet('hesaplar', `
    <div class="pn-bas"><h1>Hesaplar</h1></div>
    <p class="pn-not">Panele kimlerin girebileceği. Yeni hesap açınca geçici bir parola çıkar; onu kişiye ilet, ilk girişte kendi parolasını belirler.</p>
    ${g ? `<div class="pn-gecici"><p><b>${e(g.eposta)}</b> için geçici parola:</p><code>${e(g.parola)}</code><button type="button" class="chip" data-kopyala="${e(g.parola)}">Kopyala</button><small>Bu parola bir daha gösterilmeyecek.</small></div>` : ''}
    <section class="pn-grup">
      ${uyeler.map((u) => `
        <div class="pn-hesap">
          <span class="pn-satir-t"><b>${e(u.ad)}</b><small>${e(u.eposta)} · ${u.yetki === 'yonetici' ? 'yönetici' : 'yazar'}${u.degistirmeli ? ' · ilk girişi bekleniyor' : ''}</small></span>
          ${u.eposta === durum.ben?.eposta ? '<em class="pn-rozet pn-rozet--sen">sen</em>' : `
            <button type="button" class="pn-kucuk" data-sifirla="${e(u.eposta)}">Parolayı sıfırla</button>
            <button type="button" class="pn-kucuk pn-tehlike" data-hesap-sil="${e(u.eposta)}">Sil</button>`}
        </div>`).join('')}
    </section>
    <form class="pn-kart pn-kart--ic" data-form="hesap" novalidate>
      <h2>Yeni hesap</h2>
      <div class="pn-izgara">
        <label class="pn-alan"><span>Ad soyad</span><input name="ad" required></label>
        <label class="pn-alan"><span>E-posta</span><input name="eposta" type="email" required></label>
        <label class="pn-alan pn-alan--kisa"><span>Yetki</span><select name="yetki"><option value="yazar">Yazar</option><option value="yonetici">Yönetici</option></select></label>
      </div>
      <p class="pn-not">Yazar: yazı ve sayı ekler, düzenler. Yönetici: ayrıca ekibi ve hesapları yönetir.</p>
      <button class="chip chip--dolu" type="submit">Hesabı aç</button>
    </form>`);
  durum.gecici = null;
}

// ------------------------------------------------------------------ inceleme

function incelemeSayfasi() {
  if (!durum.github) return iskelet('inceleme', githubYok());
  if (!durum.yuklendi) return iskelet('inceleme', yukleniyor());
  const { acik, son } = durum.oneriler;
  const satir = (o: OneriOzet | OneriSon, alt: string) => `
    <a class="pn-satir-link" href="#/oneri/${o.id}">
      <span class="pn-tur">${o.tur === 'yazi' ? 'yazı' : 'sayı'}</span>
      <span class="pn-satir-t"><b>${e(o.baslik)}</b><small>${alt}</small></span>
      ${rozet(o as OneriOzet)}
    </a>`;
  const acikSatir = (o: OneriOzet) => satir(o, `${benim(o) ? 'sen' : e(o.yazan_ad)} · ${zamanMetni(o.guncelleme)}${o.yorum ? ` · ${o.yorum} yorum` : ''}`);
  const bolum = (baslik: string, liste: string[], bos?: string) => (liste.length || bos)
    ? `<section class="pn-grup"><h2>${baslik}</h2>${liste.join('') || `<p class="pn-bos">${bos}</p>`}</section>` : '';
  iskelet('inceleme', `
    <div class="pn-bas"><h1>İnceleme</h1></div>
    <p class="pn-not pn-not--ust">Sayı ve yazılar doğrudan yayınlanmaz. Yazan incelemeye gönderir; ekipten başka biri önizleyip onaylayınca yayına çıkar. Kimse kendi önerisini onaylayamaz.</p>
    ${bolum('Onayını bekleyenler', onayimiBekleyen().map(acikSatir), 'Şu an onayını bekleyen bir şey yok.')}
    ${bolum('Senin önerilerin', acik.filter(benim).map(acikSatir), 'Açık önerin yok. Yazılar ya da Sayılar’dan bir şey düzenleyince burada görünür.')}
    ${bolum('Ekipte hazırlananlar', acik.filter((o) => !benim(o) && o.durum !== 'inceleme').map(acikSatir))}
    ${bolum('Son kapananlar', son.map((o) => satir(o, `${e(o.yazan_ad)} önerdi${o.onaylayan_ad ? ` · ${e(o.onaylayan_ad)} onayladı` : ''} · ${zamanMetni(o.guncelleme)}`)))}`);
}

let sayfaOnerisi: OneriTam | null = null;

async function oneriSayfasi(id: number) {
  if (!durum.github) return iskelet('inceleme', githubYok());
  if (!durum.yuklendi) return iskelet('inceleme', yukleniyor());
  if (sayfaOnerisi?.id !== id) iskelet('inceleme', '<p class="pn-bos">Öneri yükleniyor…</p>');
  let j: { oneri: OneriTam; yorumlar: Yorum[] };
  try {
    j = await api(`oneri?id=${id}`);
  } catch (err) {
    return iskelet('inceleme', `<p class="pn-bos">${e((err as Error).message)} <a href="#/inceleme">İncelemeye dön</a></p>`);
  }
  if (location.hash !== `#/oneri/${id}`) return; // bu arada başka sayfaya geçildi
  sayfaOnerisi = j.oneri;
  // Listedeki kopyası da güncellensin (düzenleme formu oradan okur)
  const { gorselVar, onaylayan, onaylayan_ad, commit_sha, surum, ...ozet } = j.oneri;
  const digerleri = durum.oneriler.acik.filter((x) => x.id !== id);
  durum.oneriler.acik = ['taslak', 'inceleme', 'degisiklik'].includes(ozet.durum)
    ? [{ ...ozet, yorum: j.yorumlar.filter((y) => y.tur === 'yorum').length }, ...digerleri] : digerleri;
  menuyuTazele();
  oneriCiz(j.oneri, j.yorumlar);
}

function oneriCiz(o: OneriTam, yorumlar: Yorum[]) {
  const acik = ['taslak', 'inceleme', 'degisiklik'].includes(o.durum);
  const ben = benim(o);
  const inceleyen = o.durum === 'inceleme' && !ben;
  const yayindaki = (o.tur === 'yazi' ? durum.yazilar : durum.sayilar).find((k) => k.yol === o.yol);
  const eskimis = acik && (o.temel ?? null) !== (yayindaki?.sha ?? null);
  const ne = o.tur === 'yazi' ? 'yazı' : 'sayı';
  const ilk = (ad: string) => ad.split(/\s+/)[0];

  // Önizleme ve farklar
  let onizleme = '';
  let farklar = '';
  let adres = '';
  const gorselUrl = o.gorselVar && o.gorsel_yol ? `/api/panel/gorsel?id=${o.id}` : undefined;
  if (o.tur === 'yazi') {
    const yeni = o.islem === 'kaydet' && o.metin ? yaziOku({ yol: o.yol, sha: '', metin: o.metin }) : yayindaki as Kayit<YaziVeri> | undefined;
    const url = gorselUrl && yeni?.veri.gorsel === siteYolu(o.gorsel_yol!) ? gorselUrl : undefined;
    if (yeni) onizleme = yaziOnizleme(yeni, baglam(), url);
    if (acik && o.islem === 'kaydet' && yayindaki && yeni) farklar = yaziFarki(yayindaki as Kayit<YaziVeri>, yeni, url);
    adres = `/yazi/${adOf(o.yol)}/`;
  } else {
    const yeni = o.islem === 'kaydet' && o.metin ? sayiOku({ yol: o.yol, sha: '', metin: o.metin }) : yayindaki as Kayit<SayiVeri> | undefined;
    if (yeni) onizleme = sayiOnizleme(yeni.veri, yeni.govde, baglam());
    if (acik && o.islem === 'kaydet' && yayindaki && yeni) farklar = sayiFarki(yayindaki as Kayit<SayiVeri>, yeni);
    if (yeni) adres = `/sayi/${yeni.veri.sayi}/`;
  }

  const ne2 = o.islem === 'sil' ? 'siteden kaldırmak' : o.temel ? 'güncellemek' : 'yayınlamak';
  const durumMetni: Record<OneriDurum, string> = {
    taslak: ben ? 'Taslak. Ekip görebilir ama onaylayamaz; hazır olunca incelemeye gönder.' : `${e(ilk(o.yazan_ad))} hâlâ üzerinde çalışıyor. İncelemeye gönderilince onaylayabilirsin; şimdiden yorum yazabilirsin.`,
    inceleme: ben ? 'Onay bekliyor. Ekipten başka biri onaylayınca yayına çıkar.' : `${e(ilk(o.yazan_ad))} bu ${ne}yı ${ne2} istiyor. Önizlemeye${farklar ? ' ve değişikliklere' : ''} bak; uygunsa onayla, değilse neyin değişmesi gerektiğini yaz.`,
    degisiklik: ben ? 'Değişiklik istendi. Konuşmaya bak, düzeltip yeniden gönder.' : 'Yazandan düzeltme bekleniyor.',
    yayinlandi: `Yayınlandı. ${e(o.onaylayan_ad ?? '')} onayladı.`,
    kapatildi: 'Geri çekildi; yayına çıkmadı.',
  };
  const eylem = [
    ben && acik && o.islem === 'kaydet' ? `<a class="chip${o.durum === 'degisiklik' ? ' chip--dolu' : ''}" href="#/oneri/${o.id}/duzenle">Düzenle</a>` : '',
    ben && o.durum === 'taslak' ? '<button type="button" class="chip chip--dolu" data-gonder-oneri>İncelemeye gönder</button>' : '',
    o.durum === 'yayinlandi' && o.islem === 'kaydet' && adres ? `<a class="pn-dis" href="${e(adres)}" target="_blank" rel="noopener">Sitede gör ↗</a>` : '',
    acik && (ben || yonetici()) ? `<button type="button" class="pn-tehlike" data-geri-cek>${ben ? 'Geri çek' : 'Öneriyi kapat'}</button>` : '',
  ].join('');

  const kisi = kisiBul(o.yazan_ad, kisiler());
  iskelet('inceleme', `
    <div class="pn-oneri">
      <a class="pn-geri" href="#/inceleme">← İnceleme</a>
      <header class="pn-oneri__bas">
        <p class="pn-ust-not">${o.tur === 'yazi' ? 'Yazı' : 'Sayı'} · ${o.islem === 'sil' ? 'silme önerisi' : o.temel ? 'düzenleme önerisi' : 'yeni'}</p>
        <h1>${e(o.baslik)}</h1>
        <p class="pn-kim">${av(kisi)}<span><b>${ben ? 'Sen' : e(o.yazan_ad)}</b> · ${zamanMetni(o.olusturma)} açıldı</span>${rozet(o)}</p>
      </header>
      <div class="pn-durum pn-durum--${o.durum}">
        <p>${durumMetni[o.durum]}</p>
        ${eylem ? `<div class="pn-eylem">${eylem}</div>` : ''}
      </div>
      ${eskimis ? `<p class="pn-uyari">Bu öneri hazırlandıktan sonra ${ne}nın yayındaki hâli değişti. ${ben ? 'Önerini açıp yeniden kaydet; yayındaki son hâlin üzerine kurulur.' : 'Onaylanırsa çakışır ve yazana geri döner; önce yazanın güncellemesi gerekiyor.'}</p>` : ''}
      ${o.islem === 'sil' && acik ? `<p class="pn-uyari">Onaylanırsa bu ${ne} siteden kalkar. Aşağıda şu anki hâli var.</p>` : ''}

      <div class="pn-oneri__izgara">
        <section class="pn-oneri__on">
          ${farklar ? `
            <div class="pn-sekmeler" role="tablist">
              <button type="button" role="tab" data-sekme="onizleme" aria-selected="true">Önizleme</button>
              <button type="button" role="tab" data-sekme="fark" aria-selected="false">Değişiklikler</button>
            </div>` : ''}
          <div data-sekme-alan="onizleme">${onizleme ? '<div data-onizleme-kap></div>' : '<p class="pn-bos">Önizlenecek bir şey yok.</p>'}</div>
          ${farklar ? `<div class="pn-fark" data-sekme-alan="fark" hidden>${farklar}</div>` : ''}
        </section>
        <aside class="pn-konusma" aria-label="Konuşma">
          <h2>Konuşma</h2>
          <div class="pn-yorumlar">
            <p class="pn-olay"><b>${e(o.yazan_ad)}</b> öneriyi açtı · ${zamanMetni(o.olusturma)}</p>
            ${yorumlar.map(yorumHtml).join('')}
          </div>
          ${acik ? `
            <form class="pn-yaz" data-form="yorum" data-id="${o.id}" novalidate>
              <textarea name="metin" rows="3" placeholder="${inceleyen ? 'Yorumun ya da düzeltme isteğin…' : 'Bir şey yaz…'}"></textarea>
              <div class="pn-yaz__eylem">
                <button type="submit" class="chip" data-islem="yorum">Yorum yaz</button>
                ${inceleyen ? `
                  <button type="submit" class="chip" data-islem="degisiklik">Değişiklik iste</button>
                  <button type="submit" class="chip chip--dolu" data-islem="onayla">${o.islem === 'sil' ? 'Onayla ve kaldır' : 'Onayla ve yayınla'}</button>` : ''}
              </div>
              ${inceleyen ? '<small>Değişiklik isterken neyin değişmesi gerektiğini yaz. Onaylarken not eklemek isteğe bağlı.</small>' : ''}
            </form>` : ''}
        </aside>
      </div>
    </div>`);
  const kap = $('[data-onizleme-kap]');
  if (kap && onizleme) onizlemeKur(kap, onizleme);
  const liste = $('.pn-yorumlar');
  if (liste) liste.scrollTop = liste.scrollHeight;
}

function yorumHtml(y: Yorum) {
  const kim = e(y.ad);
  const zaman = zamanMetni(y.zaman);
  if (y.tur === 'olay') return `<p class="pn-olay"><b>${kim}</b> ${e(y.metin)} · ${zaman}</p>`;
  if (y.tur === 'onay') {
    const not = y.metin.replace(/^onayladı ve yayınladı:?\s*/, '');
    return `<p class="pn-olay pn-olay--onay"><b>${kim}</b> onayladı ve yayınladı · ${zaman}</p>${not ? balon(y, not, '') : ''}`;
  }
  return balon(y, y.metin, y.tur === 'degisiklik' ? 'Değişiklik istedi' : '');
}

function balon(y: Yorum, metin: string, etiket: string) {
  const ben = y.eposta === durum.ben?.eposta;
  return `
    <div class="pn-yorum${ben ? ' pn-yorum--ben' : ''}${etiket ? ' pn-yorum--degisiklik' : ''}">
      ${ben ? '' : av(kisiBul(y.ad, kisiler()))}
      <div class="pn-yorum__ic">
        <small>${ben ? 'sen' : e(y.ad)} · ${zamanMetni(y.zaman)}</small>
        <p class="pn-yorum__b">${etiket ? `<b>${etiket}</b>` : ''}${e(metin).replace(/\n/g, '<br>')}</p>
      </div>
    </div>`;
}

// Onaylanan öneri yayına çıkınca paneldeki içerik de güncellenir
async function yayinaIsle(o: OneriTam) {
  const yeni = o.islem === 'kaydet' && o.metin ? { yol: o.yol, sha: await blobSha(o.metin), metin: o.metin } : null;
  if (o.tur === 'yazi') {
    durum.yazilar = durum.yazilar.filter((y) => y.yol !== o.yol);
    if (yeni) durum.yazilar.push(yaziOku(yeni));
  } else {
    durum.sayilar = durum.sayilar.filter((s) => s.yol !== o.yol);
    if (yeni) durum.sayilar.push(sayiOku(yeni));
  }
}

function siteAdresi(o: OneriTam): string | undefined {
  if (o.islem === 'sil' || !o.metin) return undefined;
  if (o.tur === 'sayi') {
    const v = sayiOku({ yol: o.yol, sha: '', metin: o.metin }).veri;
    return v.taslak ? undefined : `/sayi/${v.sayi}/`;
  }
  const v = yaziOku({ yol: o.yol, sha: '', metin: o.metin }).veri;
  const s = sayiBul(v.sayi);
  return !v.taslak && s && !s.veri.taslak ? `/yazi/${adOf(o.yol)}/` : undefined;
}

async function yorumGonder(f: HTMLFormElement, islem: string) {
  const o = sayfaOnerisi;
  if (!o || o.id !== Number(f.dataset.id)) return;
  const alan = $<HTMLTextAreaElement>('[name="metin"]', f)!;
  const metin = alan.value.trim();
  if (islem === 'yorum' && !metin) return void alan.focus();
  if (islem === 'degisiklik' && !metin) { toast('Neyin değişmesi gerektiğini yaz.'); return void alan.focus(); }
  if (islem === 'onayla' && !confirm(o.islem === 'sil'
    ? `“${o.baslik}” siteden kaldırılsın mı?`
    : `“${o.baslik}” yayına çıksın mı? Sitede 1–2 dakika içinde görünür.`)) return;
  const dugmeler = $$<HTMLButtonElement>('button', f);
  for (const d of dugmeler) d.disabled = true;
  try {
    if (islem === 'onayla') {
      const oncesi = await surum();
      const j = await api<{ commit: string }>('oneri/onayla', { id: o.id, metin, surum: o.surum });
      sonOncesi = oncesi;
      await yayinaIsle(o);
      bekleyenEkle(j.commit, o.baslik, siteAdresi(o));
      toast(o.islem === 'sil' ? 'Onaylandı. 1–2 dakika içinde siteden kalkar.' : 'Onaylandı. Sitede 1–2 dakika içinde görünür.', 4000);
    } else {
      await api(islem === 'degisiklik' ? 'oneri/degisiklik' : 'oneri/yorum', { id: o.id, metin });
    }
    durum.kirli = false;
  } catch (err) {
    toast((err as Error).message, 6000);
    if ((err as ApiHatasi).status !== 409) {
      for (const d of dugmeler) d.disabled = false;
      return;
    }
  }
  await onerileriYukle().catch(() => {});
  await oneriSayfasi(o.id);
}

async function geriCek() {
  const o = sayfaOnerisi;
  if (!o || !confirm(benim(o) ? 'Öneri geri çekilsin mi? Yayına çıkmaz; istersen sonra yenisini açarsın.' : 'Öneri kapatılsın mı? Yayına çıkmaz; yazan isterse yenisini açar.')) return;
  try {
    await api('oneri/kapat', { id: o.id });
    await onerileriYukle().catch(() => {});
    toast('Öneri geri çekildi.');
    oneriSayfasi(o.id);
  } catch (err) { toast((err as Error).message); }
}

async function incelemeyeGonder() {
  const o = sayfaOnerisi;
  if (!o) return;
  try {
    await api('oneri', { id: o.id, tur: o.tur, islem: o.islem, yol: o.yol, temel: o.temel, metin: o.metin, baslik: o.baslik, gonder: true });
    await onerileriYukle().catch(() => {});
    toast('İncelemeye gönderildi. Ekipten biri onaylayınca yayına çıkar.', 3800);
    oneriSayfasi(o.id);
  } catch (err) { toast((err as Error).message, 5000); }
}

async function silmeOner(f: HTMLFormElement) {
  const kayit = f.dataset.form === 'yazi'
    ? durum.yazilar.find((y) => adOf(y.yol) === f.dataset.slug)
    : durum.sayilar.find((s) => s.yol === f.dataset.yol);
  if (!kayit) return;
  const baslik = f.dataset.form === 'yazi' ? kayit.veri.baslik : `Sayı ${pad((kayit.veri as SayiVeri).sayi)} · ${kayit.veri.baslik}`;
  if (!confirm(`“${baslik}” için silme önerisi açılsın mı? Ekipten biri onaylarsa siteden kalkar.`)) return;
  await oneriKaydet(f, { tur: f.dataset.form, islem: 'sil', yol: kayit.yol, temel: kayit.sha, baslik }, true);
}

// Formdaki hâlin önizlemesi (henüz kaydedilmemiş olabilir)
function formOnizle(f: HTMLFormElement) {
  const govde = $<HTMLTextAreaElement>('[name="govde"]', f)!.value;
  let html: string;
  if (f.dataset.form === 'yazi') {
    const oneri = formOnerisi(f);
    const v = yaziOkuForm(f);
    const ad = f.dataset.slug === 'yeni' ? (deger(f, 'adres') || adres(v.baslik) || 'yeni-yazi') : f.dataset.slug!;
    const url = yeniGorsel && v.gorsel === siteYolu(yeniGorsel.yol) ? yeniGorsel.url
      : oneri?.gorsel_yol && v.gorsel === siteYolu(oneri.gorsel_yol) ? `/api/panel/gorsel?id=${oneri.id}` : undefined;
    html = yaziOnizleme({ yol: `src/content/yazilar/${ad}.md`, veri: v, govde }, baglam(), url);
  } else {
    html = sayiOnizleme(sayiOkuForm(f), govde, baglam());
  }
  const d = document.createElement('dialog');
  d.className = 'pn-modal';
  d.innerHTML = `
    <div class="pn-modal__ust">
      <p><b>Önizleme</b><small>okurun göreceği hâl · henüz kaydedilmedi</small></p>
      <button type="button" class="chip" data-kapat>Kapat</button>
    </div>
    <div class="pn-modal__alan" data-onizleme-kap></div>`;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (ev) => { if (ev.target === d || (ev.target as Element).closest('[data-kapat]')) d.close(); });
  d.showModal();
  onizlemeKur($('[data-onizleme-kap]', d)!, html);
}

// ------------------------------------------------------------------ kaydetme ve yayın durumu

function hataGoster(f: HTMLFormElement, hatalar: string[], baglanti?: string): boolean {
  const kutu = $('[data-hatalar]', f)!;
  kutu.hidden = !hatalar.length;
  kutu.innerHTML = hatalar.length ? `<b>Kaydetmeden önce:</b><ul>${hatalar.map((h) => `<li>${e(h)}</li>`).join('')}</ul>${baglanti ? `<a href="${e(baglanti)}">Öneriyi aç →</a>` : ''}` : '';
  if (hatalar.length) kutu.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return hatalar.length > 0;
}

async function kaydet(
  f: HTMLFormElement,
  istek: { mesaj: string; dosyalar: { yol: string; metin?: string; base64?: string }[]; sil?: string[]; beklenen: Record<string, string | null> },
  sonra: (commit: string) => Promise<void>,
) {
  const dugme = $<HTMLButtonElement>('[data-kaydet]', f);
  const eski = dugme?.textContent;
  if (dugme) { dugme.disabled = true; dugme.textContent = 'Kaydediliyor…'; }
  try {
    const oncesi = await surum();
    const { commit } = await api<{ commit: string }>('kaydet', istek);
    durum.kirli = false;
    sonOncesi = oncesi;
    await sonra(commit);
  } catch (err) {
    hataGoster(f, [(err as Error).message]);
  } finally {
    if (dugme && dugme.isConnected) { dugme.disabled = false; dugme.textContent = eski ?? 'Kaydet'; }
  }
}

let sonOncesi = '';
async function surum(): Promise<string> {
  try { return (await (await fetch(`/surum.txt?_=${Date.now()}`, { cache: 'no-store' })).text()).trim(); } catch { return ''; }
}

function bekleyenler(): Bekleyen[] {
  try { return JSON.parse(sessionStorage.getItem('pn:bekleyen') || '[]'); } catch { return []; }
}
function bekleyenYaz(l: Bekleyen[]) { try { sessionStorage.setItem('pn:bekleyen', JSON.stringify(l.slice(-5))); } catch { /* yok */ } }

function bekleyenEkle(commit: string, baslik: string, adresi?: string) {
  bekleyenYaz([...bekleyenler(), { commit, oncesi: sonOncesi, baslik, adres: adresi, zaman: Date.now() }]);
  yayinTakip();
}

function yayinCiz() {
  const kutu = $('[data-yayin]');
  if (!kutu) return;
  const l = bekleyenler();
  kutu.innerHTML = l.length ? `<h3>Yayın durumu</h3>${l.slice().reverse().map((b) => `
    <div class="pn-yayin__s${b.yayinda ? ' tamam' : ''}">
      <span>${b.yayinda ? '✓' : '<i class="pn-donen"></i>'}</span>
      <p><b>${e(b.baslik)}</b><small>${b.yayinda ? (b.adres ? `yayında · <a href="${e(b.adres)}" target="_blank" rel="noopener">aç ↗</a>` : 'kaydedildi') : Date.now() - b.zaman > 6 * 60e3 ? 'uzun sürdü; biraz sonra siteye bak' : 'siteye işleniyor…'}</small></p>
    </div>`).join('')}` : '';
}

let takipZaman = 0;
async function yayinTakip() {
  clearTimeout(takipZaman);
  yayinCiz();
  const l = bekleyenler();
  if (!l.some((b) => !b.yayinda)) return;
  const simdiki = await surum();
  let degisti = false;
  for (const b of l) {
    if (b.yayinda) continue;
    // Site bu commit'ten ya da daha yenisinden derlendiyse yayında sayılır
    if (simdiki === b.commit || (simdiki && simdiki !== b.oncesi && Date.now() - b.zaman > 30e3)) { b.yayinda = true; degisti = true; }
  }
  if (degisti) { bekleyenYaz(l); yayinCiz(); }
  if (l.some((b) => !b.yayinda && Date.now() - b.zaman < 15 * 60e3)) takipZaman = window.setTimeout(yayinTakip, 10_000);
  else yayinCiz();
}

// ------------------------------------------------------------------ görsel

async function gorselHazirla(dosya: File, ad: string): Promise<{ yol: string; base64: string; url: string }> {
  const bmp = await createImageBitmap(dosya);
  const olcek = Math.min(1, 1600 / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * olcek);
  c.height = Math.round(bmp.height * olcek);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  // Öneriyle birlikte saklanabilsin diye ~1 MB'ın altına inene kadar sıkıştırılır
  let blob: Blob, base64: string;
  for (let kalite = 0.84; ; kalite -= 0.12) {
    blob = await new Promise<Blob>((ok, hayir) => c.toBlob((b) => (b ? ok(b) : hayir(new Error('Görsel işlenemedi.'))), 'image/jpeg', kalite));
    base64 = await new Promise<string>((ok) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.readAsDataURL(blob);
    });
    if (base64.length <= 1_400_000 || kalite < 0.4) break;
  }
  const ek = Math.random().toString(36).slice(2, 6);
  return { yol: `public/gorseller/${(ad || 'gorsel').slice(0, 50)}-${ek}.jpg`, base64, url: URL.createObjectURL(blob) };
}

// ------------------------------------------------------------------ yönlendirme

// Kendi önerini düzenlemek: önerinin türüne göre yazı ya da sayı formu, önerideki hâliyle
async function oneriDuzenle(id: number) {
  if (!durum.yuklendi) return iskelet('inceleme', yukleniyor());
  // Önerinin son hâliyle açılsın (bu arada değişiklik istenmiş olabilir)
  await onerileriYukle().catch(() => {});
  if (location.hash !== `#/oneri/${id}/duzenle`) return;
  const o = durum.oneriler.acik.find((x) => x.id === id);
  if (!o) return void location.replace(`#/oneri/${id}`);
  return o.tur === 'yazi' ? yaziFormu('', id) : sayiFormu('', id);
}

function ciz() {
  if (!durum.ben) return girisSayfasi();
  if (durum.ben.degistirmeli) return parolaSayfasi(true);
  const [sayfa, arg, alt] = location.hash.replace(/^#\/?/, '').split('/');
  if (sayfa !== 'oneri') sayfaOnerisi = null;
  switch (sayfa) {
    case 'inceleme': return incelemeSayfasi();
    case 'oneri': return alt === 'duzenle' ? oneriDuzenle(Number(arg)) : oneriSayfasi(Number(arg));
    case 'yazi': return yaziFormu(arg || 'yeni');
    case 'sayilar': return sayilarSayfasi();
    case 'sayi': return sayiFormu(arg || 'yeni');
    case 'ekip': return ekipSayfasi();
    case 'hesaplar': return hesaplarSayfasi();
    case 'hesabim': return parolaSayfasi(false);
    default: return yazilarSayfasi();
  }
}

let sonHash = location.hash;
addEventListener('hashchange', () => {
  if (durum.kirli && !confirm('Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?')) {
    history.replaceState(null, '', sonHash);
    return;
  }
  durum.kirli = false;
  sonHash = location.hash;
  ciz();
});
addEventListener('beforeunload', (ev) => { if (durum.kirli) ev.preventDefault(); });

// ------------------------------------------------------------------ olaylar

kok.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement;
  const f = t.closest<HTMLFormElement>('form[data-form="yazi"], form[data-form="sayi"], form[data-form="ekip"], form[data-form="yorum"]');
  if (f) durum.kirli = f.dataset.form !== 'yorum' || !!t.value.trim();
  // Yeni yazıda adres başlıktan oluşur (okur elle değiştirmediyse)
  if (t.name === 'baslik' && f?.dataset.form === 'yazi') {
    const a = $<HTMLInputElement>('[name="adres"]', f);
    if (a && a.dataset.adresElle !== '1') a.value = adres(t.value);
  }
  if (t.name === 'adres') t.dataset.adresElle = '1';
  if (t.name === 'yayin' && f?.dataset.form === 'sayi' && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) {
    $<HTMLInputElement>('[name="baslangic"]', f)!.value = gunEkle(t.value, -6);
    $<HTMLInputElement>('[name="bitis"]', f)!.value = t.value;
  }
  const sayac = $(`[data-sayac="${t.name}"]`, f ?? kok);
  if (sayac) sayac.textContent = `${t.value.length}/200`;
  if (t.name === 'kAd' || t.name === 'kKisa' || t.name === 'kRenk') {
    const r = t.closest('.pn-kisi')!;
    const av = $('[data-kisi-av]', r)!;
    av.textContent = (deger(r, 'kKisa') || kisaltma(deger(r, 'kAd'))).toLocaleUpperCase('tr');
    av.style.setProperty('--av', deger(r, 'kRenk'));
  }
});

// Bir alanda Enter'a basmak formu göndermesin (yanlışlıkla incelemeye gitmesin)
kok.addEventListener('keydown', (ev) => {
  const t = ev.target as HTMLElement;
  if (ev.key === 'Enter' && t instanceof HTMLInputElement && t.closest('form[data-form="yazi"], form[data-form="sayi"], form[data-form="ekip"]')) ev.preventDefault();
});

kok.addEventListener('change', async (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.name === 'taslak' || t.name === 'kRenk') t.dispatchEvent(new Event('input', { bubbles: true }));
  if (t.name !== 'gorselDosya' || !t.files?.[0]) return;
  const f = t.closest<HTMLFormElement>('form')!;
  const ad = f.dataset.slug === 'yeni' ? (deger(f, 'adres') || adres(deger(f, 'baslik'))) : f.dataset.slug!;
  try {
    yeniGorsel = await gorselHazirla(t.files[0], ad);
    $<HTMLInputElement>('[name="gorsel"]', f)!.value = `/${yeniGorsel.yol.replace(/^public\//, '')}`;
    $('[data-gorsel-on]', f)!.innerHTML = `<img src="${yeniGorsel.url}" alt="">`;
    durum.kirli = true;
  } catch {
    toast('Bu görsel açılamadı. JPG ya da PNG dene.');
  }
});

kok.addEventListener('click', async (ev) => {
  const t = ev.target as HTMLElement;
  const f = t.closest<HTMLFormElement>('form');

  if (t.closest('[data-cikis]')) {
    await api('cikis', {}).catch(() => {});
    durum.ben = null;
    return ciz();
  }
  if (t.closest('[data-yenile]')) { durum.yukHata = ''; ciz(); return icerikYukle(); }

  const ekle = t.closest<HTMLElement>('[data-ekle]');
  if (ekle && f) {
    const tur = ekle.dataset.ekle!;
    const satirlar = $('[data-satirlar]', ekle.closest('[data-liste]')!)!;
    const n = satirlar.children.length;
    const sinir: Record<string, number> = { kisaca: 4, kisaKisa: 5, etkinlik: 6, ekip: 20 };
    if (n >= sinir[tur]) return toast(`En fazla ${sinir[tur]} tane.`);
    const html = tur === 'kisaca' ? kisacaSatiri('') : tur === 'kisaKisa' ? kisaKisaSatiri({ konu: '', metin: '' })
      : tur === 'etkinlik' ? etkinlikSatiri({}) : ekipSatiri({ renk: '#111111' }, true);
    satirlar.insertAdjacentHTML('beforeend', html);
    $<HTMLInputElement>('input', satirlar.lastElementChild!)?.focus();
    durum.kirli = true;
    return;
  }
  if (t.closest('[data-sil-satir]')) {
    t.closest('.pn-satir, .pn-etk, .pn-kisi')?.remove();
    durum.kirli = true;
    return;
  }

  const bicim = t.closest<HTMLElement>('[data-bicim]');
  if (bicim && f) return bicimUygula($<HTMLTextAreaElement>('[name="govde"]', f)!, bicim.dataset.bicim!);
  if (t.closest('[data-onizle]') && f) return formOnizle(f);
  if (t.closest('[data-sil]') && f) return silmeOner(f);
  if (t.closest('[data-geri-cek]')) return geriCek();
  if (t.closest('[data-gonder-oneri]')) return incelemeyeGonder();
  const sekme = t.closest<HTMLElement>('[data-sekme]');
  if (sekme) {
    for (const b of $$('[data-sekme]')) b.setAttribute('aria-selected', String(b === sekme));
    for (const a of $$('[data-sekme-alan]')) a.hidden = a.dataset.sekmeAlan !== sekme.dataset.sekme;
    return;
  }

  const kopya = t.closest<HTMLElement>('[data-kopyala]');
  if (kopya) {
    try { await navigator.clipboard.writeText(kopya.dataset.kopyala!); toast('Kopyalandı.'); } catch { toast('Kopyalanamadı; elle seç.'); }
    return;
  }
  const sifirla = t.closest<HTMLElement>('[data-sifirla]');
  if (sifirla) {
    const eposta = sifirla.dataset.sifirla!;
    if (!confirm(`${eposta} için yeni bir geçici parola oluşturulsun mu? Eski parolası çalışmaz olur.`)) return;
    try { const j = await api<{ gecici: string }>('uyeler/sifirla', { eposta }); durum.gecici = { eposta, parola: j.gecici }; hesaplarSayfasi(); } catch (err) { toast((err as Error).message); }
    return;
  }
  const hSil = t.closest<HTMLElement>('[data-hesap-sil]');
  if (hSil) {
    const eposta = hSil.dataset.hesapSil!;
    if (!confirm(`${eposta} hesabı silinsin mi? Panele bir daha giremez.`)) return;
    try { await api('uyeler/sil', { eposta }); toast('Hesap silindi.'); hesaplarSayfasi(); } catch (err) { toast((err as Error).message); }
  }
});

function bicimUygula(alan: HTMLTextAreaElement, tur: string) {
  const { selectionStart: a, selectionEnd: b, value } = alan;
  const secili = value.slice(a, b);
  let yeni = '';
  let imlec = 0;
  if (tur === 'h2') {
    const satirBasi = value.lastIndexOf('\n', a - 1) + 1;
    const once = value.slice(0, satirBasi).replace(/\n*$/, '');
    const satir = value.slice(satirBasi).replace(/^#+\s*/, '');
    yeni = `${once}${once ? '\n\n' : ''}## ${satir}`;
    imlec = yeni.length - satir.length + (a - satirBasi);
    alan.value = yeni;
  } else if (tur === 'b') {
    yeni = `**${secili || 'kalın yazı'}**`;
    alan.setRangeText(yeni, a, b, 'end');
  } else if (tur === 'a') {
    const url = prompt('Bağlantı adresi (https://…)');
    if (!url) return;
    yeni = `[${secili || 'bağlantı'}](${url.trim()})`;
    alan.setRangeText(yeni, a, b, 'end');
  }
  if (tur === 'h2') alan.setSelectionRange(imlec, imlec);
  alan.focus();
  alan.dispatchEvent(new Event('input', { bubbles: true }));
}

kok.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target as HTMLFormElement;
  const tur = f.dataset.form;
  const dugme = $<HTMLButtonElement>('button[type="submit"]', f);

  if (tur === 'giris') {
    if (dugme) dugme.disabled = true;
    try {
      const j = await api<{ ben: Uye; github: boolean }>('giris', { eposta: deger(f, 'eposta'), parola: $<HTMLInputElement>('[name="parola"]', f)!.value });
      oturumBasladi(j.ben, j.github);
    } catch (err) {
      girisSayfasi((err as Error).message);
    }
    return;
  }
  if (tur === 'parola') {
    const yeni = $<HTMLInputElement>('[name="yeni"]', f)!.value;
    if (yeni !== $<HTMLInputElement>('[name="yeni2"]', f)!.value) return toast('Yeni parolalar aynı değil.');
    if (yeni.length < 10) return toast('Yeni parola en az 10 karakter olmalı.');
    try {
      const j = await api<{ ben: Uye }>('parola', { eski: $<HTMLInputElement>('[name="eski"]', f)!.value, yeni });
      const ilk = durum.ben?.degistirmeli;
      durum.ben = j.ben;
      toast('Parolan kaydedildi.');
      if (ilk) { location.hash = '#/yazilar'; ciz(); if (durum.github && !durum.yuklendi) icerikYukle(); } else location.hash = '#/yazilar';
    } catch (err) { toast((err as Error).message); }
    return;
  }
  if (tur === 'ad') {
    try {
      const j = await api<{ ben: Uye }>('ad', { ad: deger(f, 'ad') });
      durum.ben = j.ben;
      toast('Adın kaydedildi.');
      ciz();
    } catch (err) { toast((err as Error).message); }
    return;
  }
  if (tur === 'hesap') {
    const eposta = deger(f, 'eposta');
    try {
      const j = await api<{ gecici: string }>('uyeler', { ad: deger(f, 'ad'), eposta, yetki: deger(f, 'yetki') });
      durum.gecici = { eposta, parola: j.gecici };
      hesaplarSayfasi();
    } catch (err) { toast((err as Error).message); }
    return;
  }
  const gonder = (ev as SubmitEvent).submitter?.dataset.gonder === '1';
  if (tur === 'yazi') return yaziKaydet(f, gonder);
  if (tur === 'sayi') return sayiKaydet(f, gonder);
  if (tur === 'yorum') return yorumGonder(f, (ev as SubmitEvent).submitter?.dataset.islem ?? 'yorum');
  if (tur === 'ekip') return ekipKaydet(f);
});

// ------------------------------------------------------------------ başlat

function oturumBasladi(ben: Uye, githubVar: boolean) {
  durum.ben = ben;
  durum.github = githubVar;
  ciz();
  if (!ben.degistirmeli && githubVar && !durum.yuklendi) icerikYukle();
  yayinTakip();
}

(async () => {
  try {
    const j = await api<{ ben: Uye; github: boolean }>('ben');
    oturumBasladi(j.ben, j.github);
  } catch (err) {
    girisSayfasi((err as ApiHatasi).status === 401 ? '' : (err as Error).message);
  }
})();
