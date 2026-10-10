// (parantez) — yazı paneli (/admin). Tek sayfalık küçük bir uygulama.
// Sunucu: worker/panel.js (/api/panel/*). Dosya biçimi ve denetim: panel-icerik.ts.
import { marked } from 'marked';

// Önizlemede ham HTML gösterilmez (yalnızca Markdown)
marked.use({ renderer: { html: () => '' } });
import { KONULAR } from '../lib/konular';
import {
  FIILLER, KONU_LISTESI, adres, blobSha, gunEkle, kisaltma, sayiDenetle, sayiMetni, sayiOku,
  sonrakiPazartesi, yaziDenetle, yaziMetni, yaziOku,
  type Etkinlik, type Kayit, type Kisi, type Oneri, type SayiVeri, type YaziVeri,
} from './panel-icerik';

type Uye = { eposta: string; ad: string; yetki: 'yonetici' | 'yazar'; degistirmeli: boolean };
type Bekleyen = { commit: string; oncesi: string; baslik: string; adres?: string; zaman: number; yayinda?: boolean };

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

class ApiHatasi extends Error { constructor(mesaj: string, public status: number) { super(mesaj); } }

async function api<T = Record<string, unknown>>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(`/api/panel/${yol}`, govde === undefined
    ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Panel': '1' }, body: JSON.stringify(govde) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiHatasi(j.hata || `Bir şeyler ters gitti (${r.status}).`, r.status);
  return j as T;
}

const yonetici = () => durum.ben?.yetki === 'yonetici';
const kisiler = () => durum.ekip.liste;
const sayiBul = (n: number) => durum.sayilar.find((s) => s.veri.sayi === n);
const sayilarSirali = () => [...durum.sayilar].sort((a, b) => b.veri.sayi - a.veri.sayi);

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

async function icerikYukle() {
  durum.yukHata = '';
  try {
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
    durum.yukHata = (err as Error).message;
  }
  ciz();
}

// ------------------------------------------------------------------ yazılar

function yazilarSayfasi() {
  if (!durum.github) return iskelet('yazilar', githubYok());
  if (!durum.yuklendi) return iskelet('yazilar', yukleniyor());
  const gruplar = new Map<number, Kayit<YaziVeri>[]>();
  for (const y of durum.yazilar) gruplar.set(y.veri.sayi, [...(gruplar.get(y.veri.sayi) ?? []), y]);
  const nolar = [...new Set([...durum.sayilar.map((s) => s.veri.sayi), ...gruplar.keys()])].sort((a, b) => b - a);
  const satir = (y: Kayit<YaziVeri>) => `
    <a class="pn-satir-link" href="#/yazi/${e(adOf(y.yol))}">
      <span class="pn-no">${pad(y.veri.sira)}</span>
      <span class="pn-satir-t"><b>${e(y.veri.baslik)}</b><small>${e(KONULAR[y.veri.konu] ?? y.veri.konu)} · ${e(y.veri.yazar)}</small></span>
      ${y.veri.taslak ? '<em class="pn-rozet">taslak</em>' : ''}
    </a>`;
  iskelet('yazilar', `
    <div class="pn-bas">
      <h1>Yazılar</h1>
      <a class="chip chip--dolu" href="#/yazi/yeni">+ Yeni yazı</a>
    </div>
    ${nolar.map((n) => {
      const s = sayiBul(n);
      const liste = (gruplar.get(n) ?? []).sort((a, b) => a.veri.sira - b.veri.sira);
      return `
        <section class="pn-grup">
          <h2>Sayı ${pad(n)}${s ? ` · ${e(s.veri.baslik)}` : ''} ${s?.veri.taslak ? '<em class="pn-rozet">sayı taslak</em>' : ''}</h2>
          ${liste.length ? liste.map(satir).join('') : '<p class="pn-bos">Bu sayıda henüz yazı yok.</p>'}
        </section>`;
    }).join('') || '<p class="pn-bos">Henüz yazı yok.</p>'}`);
}

const adOf = (yol: string) => yol.split('/').pop()!.replace(/\.md$/, '');

let yeniGorsel: { yol: string; base64: string; url: string } | null = null;

function yaziFormu(slug: string) {
  if (!durum.github) return iskelet('yazilar', githubYok());
  if (!durum.yuklendi) return iskelet('yazilar', yukleniyor());
  const kayit = slug === 'yeni' ? null : durum.yazilar.find((y) => adOf(y.yol) === slug);
  if (slug !== 'yeni' && !kayit) return iskelet('yazilar', '<p class="pn-bos">Yazı bulunamadı.</p>');
  yeniGorsel = null;

  const son = sayilarSirali()[0]?.veri.sayi ?? 1;
  const benKisi = kisiler().find((k) => k.ad === durum.ben?.ad)?.ad ?? kisiler()[0]?.ad ?? '';
  const v: YaziVeri = kayit?.veri ?? {
    baslik: '', sayi: son, sira: (durum.yazilar.filter((y) => y.veri.sayi === son).length || 0) + 1, konu: '', yazar: benKisi,
    spot: '', gorsel: '', gorselAlt: '', gorselKaynak: '', neden: '', kisaca: ['', '', ''], taslak: true,
  };
  const govde = kayit?.govde ?? '';
  const kisaca = v.kisaca.length ? v.kisaca : [''];
  const yazarlar = kisiler().some((k) => k.ad === v.yazar) || !v.yazar ? kisiler() : [...kisiler(), { ad: v.yazar, kisa: '', renk: '', rol: '' }];

  iskelet('yazilar', `
    <form class="pn-form" data-form="yazi" data-slug="${e(slug)}" novalidate>
      <div class="pn-bas">
        <h1>${kayit ? 'Yazıyı düzenle' : 'Yeni yazı'}</h1>
        ${kayit ? `<a class="pn-dis" href="/yazi/${e(slug)}/" target="_blank" rel="noopener">Sitede gör ↗</a>` : ''}
      </div>
      <div class="pn-hatalar" data-hatalar hidden></div>

      <label class="pn-alan"><span>Başlık</span><input name="baslik" value="${e(v.baslik)}" maxlength="140" required></label>
      ${kayit
        ? `<p class="pn-adres">parantezbulten.com/yazi/<b>${e(slug)}</b>/</p>`
        : `<label class="pn-alan"><span>Adres <small>başlıktan oluşur; kaydettikten sonra değişmez</small></span>
            <div class="pn-adres-gir"><span>parantezbulten.com/yazi/</span><input name="adres" pattern="[a-z0-9-]+" maxlength="60" data-adres-elle="0"><span>/</span></div></label>`}

      <div class="pn-izgara">
        <label class="pn-alan"><span>Sayı</span><select name="sayi">${sayilarSirali().map((s) => `<option value="${s.veri.sayi}"${s.veri.sayi === v.sayi ? ' selected' : ''}>Sayı ${pad(s.veri.sayi)}${s.veri.taslak ? ' (taslak)' : ''}</option>`).join('')}</select></label>
        <label class="pn-alan"><span>Sıra</span><input name="sira" type="number" min="1" max="9" value="${v.sira}"></label>
        <label class="pn-alan"><span>Konu</span><select name="konu"><option value="">Seç</option>${KONU_LISTESI.map(([k, ad]) => `<option value="${k}"${k === v.konu ? ' selected' : ''}>${ad}</option>`).join('')}</select></label>
        <label class="pn-alan"><span>Yazar</span><select name="yazar">${yazarlar.map((k) => `<option${k.ad === v.yazar ? ' selected' : ''}>${e(k.ad)}</option>`).join('')}</select></label>
      </div>

      <label class="pn-alan"><span>Spot <small>başlığın altındaki bir-iki cümle</small></span><textarea name="spot" rows="3">${e(v.spot)}</textarea></label>

      <fieldset class="pn-kutu pn-gorsel">
        <legend>Görsel</legend>
        <div class="pn-gorsel__on" data-gorsel-on>${v.gorsel ? `<img src="${e(v.gorsel)}" alt="">` : '<span>Görsel yok</span>'}</div>
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

      <label class="pn-onay"><input type="checkbox" name="taslak"${v.taslak ? ' checked' : ''}> Taslak olarak kalsın <small>sitede görünmez</small></label>

      <div class="pn-eylem">
        <button class="chip chip--dolu" type="submit" data-kaydet>${v.taslak ? 'Taslağı kaydet' : 'Kaydet ve yayınla'}</button>
        <a class="chip" href="#/yazilar">Vazgeç</a>
        ${kayit ? '<button class="pn-tehlike" type="button" data-sil>Yazıyı sil</button>' : ''}
      </div>
    </form>`);
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
        <button type="button" data-onizle aria-pressed="false">Önizle</button>
      </div>
      <textarea name="govde" rows="16">${e(govde)}</textarea>
      <div class="pn-onizleme yz__metin" data-onizleme hidden></div>
      <small>${ipucu}</small>
    </div>`;
}

function yaziOkuForm(f: HTMLFormElement): YaziVeri {
  return {
    baslik: deger(f, 'baslik'), sayi: Number(deger(f, 'sayi')), sira: Number(deger(f, 'sira')),
    konu: deger(f, 'konu'), yazar: deger(f, 'yazar'), spot: deger(f, 'spot'), gorsel: deger(f, 'gorsel'),
    gorselAlt: deger(f, 'gorselAlt'), gorselKaynak: deger(f, 'gorselKaynak'), neden: deger(f, 'neden'),
    kisaca: $$<HTMLInputElement>('[name="kisaca"]', f).map((i) => i.value.trim()).filter(Boolean),
    podcast: durum.yazilar.find((y) => adOf(y.yol) === f.dataset.slug)?.veri.podcast,
    taslak: $<HTMLInputElement>('[name="taslak"]', f)!.checked,
  };
}

async function yaziKaydet(f: HTMLFormElement) {
  const slug = f.dataset.slug!;
  const kayit = slug === 'yeni' ? null : durum.yazilar.find((y) => adOf(y.yol) === slug) ?? null;
  const v = yaziOkuForm(f);
  const govde = $<HTMLTextAreaElement>('[name="govde"]', f)!.value;
  const ad = kayit ? slug : (deger(f, 'adres') || adres(v.baslik));
  const hatalar = yaziDenetle(v, govde);
  if (!kayit) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ad)) hatalar.push('Adres yalnızca küçük harf, rakam ve tire içerebilir.');
    else if (durum.yazilar.some((y) => adOf(y.yol) === ad)) hatalar.push('Bu adresle bir yazı zaten var; adresi değiştir.');
  }
  const ayniSira = durum.yazilar.find((y) => y !== kayit && y.veri.sayi === v.sayi && y.veri.sira === v.sira);
  if (ayniSira) hatalar.push(`Sayı ${pad(v.sayi)}'te ${v.sira}. sırada zaten “${ayniSira.veri.baslik}” var.`);
  if (hataGoster(f, hatalar)) return;

  const yol = `src/content/yazilar/${ad}.md`;
  const metin = yaziMetni(v, govde);
  const dosyalar: { yol: string; metin?: string; base64?: string }[] = [{ yol, metin }];
  if (yeniGorsel && v.gorsel === `/${yeniGorsel.yol.replace(/^public\//, '')}`) dosyalar.push({ yol: yeniGorsel.yol, base64: yeniGorsel.base64 });

  await kaydet(f, {
    mesaj: `${kayit ? 'Yazı güncellendi' : 'Yeni yazı'}: ${v.baslik}${v.taslak ? ' (taslak)' : ''}`,
    dosyalar, beklenen: { [yol]: kayit?.sha ?? null },
  }, async (commit) => {
    const yeni = { yol, sha: await blobSha(metin), veri: v, govde };
    durum.yazilar = kayit ? durum.yazilar.map((y) => (y === kayit ? yeni : y)) : [...durum.yazilar, yeni];
    const sayiYayinda = !sayiBul(v.sayi)?.veri.taslak;
    bekleyenEkle(commit, v.baslik, !v.taslak && sayiYayinda ? `/yazi/${ad}/` : undefined);
    toast(v.taslak ? 'Taslak kaydedildi.' : 'Kaydedildi. Sitede 1–2 dakika içinde görünür.');
    location.hash = '#/yazilar';
  });
}

// ------------------------------------------------------------------ sayılar

function sayilarSayfasi() {
  if (!durum.github) return iskelet('sayilar', githubYok());
  if (!durum.yuklendi) return iskelet('sayilar', yukleniyor());
  iskelet('sayilar', `
    <div class="pn-bas">
      <h1>Sayılar</h1>
      <a class="chip chip--dolu" href="#/sayi/yeni">+ Yeni sayı</a>
    </div>
    <section class="pn-grup">
      ${sayilarSirali().map((s) => `
        <a class="pn-satir-link" href="#/sayi/${s.veri.sayi}">
          <span class="pn-no">${pad(s.veri.sayi)}</span>
          <span class="pn-satir-t"><b>${e(s.veri.baslik)}</b><small>yayın ${e(s.veri.yayin)} · ${durum.yazilar.filter((y) => y.veri.sayi === s.veri.sayi).length} yazı</small></span>
          ${s.veri.taslak ? '<em class="pn-rozet">taslak</em>' : ''}
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

function sayiFormu(arg: string) {
  if (!durum.github) return iskelet('sayilar', githubYok());
  if (!durum.yuklendi) return iskelet('sayilar', yukleniyor());
  const kayit = arg === 'yeni' ? null : sayiBul(Number(arg));
  if (arg !== 'yeni' && !kayit) return iskelet('sayilar', '<p class="pn-bos">Sayı bulunamadı.</p>');
  const yayin = sonrakiPazartesi();
  const editor = kisiler()[0];
  const v: SayiVeri = kayit?.veri ?? {
    sayi: (sayilarSirali()[0]?.veri.sayi ?? 0) + 1, baslik: '', yayin, baslangic: gunEkle(yayin, -6), bitis: yayin,
    imza: editor ? `${editor.ad}, ${editor.rol}` : '', kisaKisa: [{ konu: '', metin: '' }, { konu: '', metin: '' }, { konu: '', metin: '' }],
    oneriler: {}, etkinlikler: [], taslak: true,
  };
  const imzalar = kisiler().map((k) => `${k.ad}, ${k.rol}`);
  if (v.imza && !imzalar.includes(v.imza)) imzalar.push(v.imza);
  const yazilari = durum.yazilar.filter((y) => y.veri.sayi === v.sayi).length;

  iskelet('sayilar', `
    <form class="pn-form" data-form="sayi" data-no="${kayit ? v.sayi : 'yeni'}" novalidate>
      <div class="pn-bas">
        <h1>${kayit ? `Sayı ${pad(v.sayi)}` : 'Yeni sayı'}</h1>
        ${kayit ? `<a class="pn-dis" href="/sayi/${v.sayi}/" target="_blank" rel="noopener">Sitede gör ↗</a>` : ''}
      </div>
      <div class="pn-hatalar" data-hatalar hidden></div>

      <div class="pn-izgara">
        <label class="pn-alan"><span>Sayı no</span><input name="sayi" type="number" min="1" value="${v.sayi}"${kayit ? ' readonly' : ''}></label>
        <label class="pn-alan"><span>Yayın (pazartesi)</span><input name="yayin" type="date" value="${e(v.yayin)}"></label>
        <label class="pn-alan"><span>Kapsadığı hafta: başlangıç</span><input name="baslangic" type="date" value="${e(v.baslangic)}"></label>
        <label class="pn-alan"><span>Bitiş</span><input name="bitis" type="date" value="${e(v.bitis)}"></label>
      </div>
      <label class="pn-alan"><span>Haftanın cümlesi <small>sohbetteki büyük başlık</small></span><input name="baslik" value="${e(v.baslik)}" maxlength="90" placeholder="Faiz sabit, kira değil."></label>
      <label class="pn-alan"><span>İmza <small>selamı veren editör</small></span><select name="imza">${imzalar.map((i) => `<option${i === v.imza ? ' selected' : ''}>${e(i)}</option>`).join('')}</select></label>

      ${metinAlani(kayit?.govde ?? '', 'Haftanın özeti', 'Editörün notu: iki kısa paragraf. Sohbette selamdan sonra gelir.')}

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

      <label class="pn-onay"><input type="checkbox" name="taslak"${v.taslak ? ' checked' : ''}> Taslak olarak kalsın <small>sayı ve yazıları sitede görünmez</small></label>

      <div class="pn-eylem">
        <button class="chip chip--dolu" type="submit" data-kaydet>${v.taslak ? 'Taslağı kaydet' : 'Kaydet ve yayınla'}</button>
        <a class="chip" href="#/sayilar">Vazgeç</a>
        ${kayit ? `<button class="pn-tehlike" type="button" data-sil${yazilari ? ` disabled title="Önce bu sayıdaki ${yazilari} yazıyı sil ya da başka sayıya taşı."` : ''}>Sayıyı sil</button>` : ''}
      </div>
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

async function sayiKaydet(f: HTMLFormElement) {
  const kayit = f.dataset.no === 'yeni' ? null : sayiBul(Number(f.dataset.no)) ?? null;
  const v = sayiOkuForm(f);
  const govde = $<HTMLTextAreaElement>('[name="govde"]', f)!.value;
  const hatalar = sayiDenetle(v);
  if (!govde.trim()) hatalar.push('Haftanın özeti boş.');
  if (!kayit && sayiBul(v.sayi)) hatalar.push(`Sayı ${pad(v.sayi)} zaten var.`);
  if (hataGoster(f, hatalar)) return;

  const yol = kayit?.yol ?? `src/content/sayilar/${pad(v.sayi)}.md`;
  const metin = sayiMetni(v, govde);
  await kaydet(f, {
    mesaj: `${kayit ? 'Sayı güncellendi' : 'Yeni sayı'}: ${pad(v.sayi)} · ${v.baslik}${v.taslak ? ' (taslak)' : ''}`,
    dosyalar: [{ yol, metin }], beklenen: { [yol]: kayit?.sha ?? null },
  }, async (commit) => {
    const yeni = { yol, sha: await blobSha(metin), veri: v, govde };
    durum.sayilar = kayit ? durum.sayilar.map((s) => (s === kayit ? yeni : s)) : [...durum.sayilar, yeni];
    bekleyenEkle(commit, `Sayı ${pad(v.sayi)}`, v.taslak ? undefined : `/sayi/${v.sayi}/`);
    toast(v.taslak ? 'Taslak kaydedildi.' : 'Kaydedildi. Sitede 1–2 dakika içinde görünür.');
    location.hash = '#/sayilar';
  });
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

// ------------------------------------------------------------------ kaydetme ve yayın durumu

function hataGoster(f: HTMLFormElement, hatalar: string[]): boolean {
  const kutu = $('[data-hatalar]', f)!;
  kutu.hidden = !hatalar.length;
  kutu.innerHTML = hatalar.length ? `<b>Kaydetmeden önce:</b><ul>${hatalar.map((h) => `<li>${e(h)}</li>`).join('')}</ul>` : '';
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
  const blob = await new Promise<Blob>((ok, hayir) => c.toBlob((b) => (b ? ok(b) : hayir(new Error('Görsel işlenemedi.'))), 'image/jpeg', 0.84));
  const base64 = await new Promise<string>((ok) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.readAsDataURL(blob);
  });
  const ek = Math.random().toString(36).slice(2, 6);
  return { yol: `public/gorseller/${(ad || 'gorsel').slice(0, 50)}-${ek}.jpg`, base64, url: URL.createObjectURL(blob) };
}

// ------------------------------------------------------------------ yönlendirme

function ciz() {
  if (!durum.ben) return girisSayfasi();
  if (durum.ben.degistirmeli) return parolaSayfasi(true);
  const [sayfa, arg] = location.hash.replace(/^#\/?/, '').split('/');
  switch (sayfa) {
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
  const f = t.closest<HTMLFormElement>('form[data-form="yazi"], form[data-form="sayi"], form[data-form="ekip"]');
  if (f) durum.kirli = true;
  // Yeni yazıda adres başlıktan oluşur (okur elle değiştirmediyse)
  if (t.name === 'baslik' && f?.dataset.form === 'yazi') {
    const a = $<HTMLInputElement>('[name="adres"]', f);
    if (a && a.dataset.adresElle !== '1') a.value = adres(t.value);
  }
  if (t.name === 'adres') t.dataset.adresElle = '1';
  if (t.name === 'taslak') {
    const d = $('[data-kaydet]', f!);
    if (d) d.textContent = t.checked ? 'Taslağı kaydet' : 'Kaydet ve yayınla';
  }
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
  const onizle = t.closest<HTMLButtonElement>('[data-onizle]');
  if (onizle && f) {
    const acik = onizle.getAttribute('aria-pressed') !== 'true';
    onizle.setAttribute('aria-pressed', String(acik));
    onizle.textContent = acik ? 'Düzenle' : 'Önizle';
    const alan = $<HTMLTextAreaElement>('[name="govde"]', f)!;
    const on = $('[data-onizleme]', f)!;
    on.innerHTML = acik ? await marked.parse(alan.value) : '';
    on.hidden = !acik;
    alan.hidden = acik;
    return;
  }

  if (t.closest('[data-sil]') && f) return silmeIste(f);

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

async function silmeIste(f: HTMLFormElement) {
  if (f.dataset.form === 'yazi') {
    const kayit = durum.yazilar.find((y) => adOf(y.yol) === f.dataset.slug);
    if (!kayit || !confirm(`“${kayit.veri.baslik}” silinsin mi? Bu geri alınamaz.`)) return;
    await kaydet(f, { mesaj: `Yazı silindi: ${kayit.veri.baslik}`, dosyalar: [], sil: [kayit.yol], beklenen: { [kayit.yol]: kayit.sha } }, async (commit) => {
      durum.yazilar = durum.yazilar.filter((y) => y !== kayit);
      bekleyenEkle(commit, `Silindi: ${kayit.veri.baslik}`);
      toast('Yazı silindi.');
      location.hash = '#/yazilar';
    });
  } else if (f.dataset.form === 'sayi') {
    const kayit = sayiBul(Number(f.dataset.no));
    if (!kayit || !confirm(`Sayı ${pad(kayit.veri.sayi)} silinsin mi? Bu geri alınamaz.`)) return;
    await kaydet(f, { mesaj: `Sayı silindi: ${pad(kayit.veri.sayi)}`, dosyalar: [], sil: [kayit.yol], beklenen: { [kayit.yol]: kayit.sha } }, async (commit) => {
      durum.sayilar = durum.sayilar.filter((s) => s !== kayit);
      bekleyenEkle(commit, `Silindi: Sayı ${pad(kayit.veri.sayi)}`);
      toast('Sayı silindi.');
      location.hash = '#/sayilar';
    });
  }
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
  if (tur === 'yazi') return yaziKaydet(f);
  if (tur === 'sayi') return sayiKaydet(f);
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
