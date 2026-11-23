// Panel: okurun göreceği hâliyle önizleme ve iki sürüm arasındaki farklar.
// Şablonlar sitedekilerin aynısı olmalı: src/pages/yazi/[slug].astro, src/pages/arastirma/[slug].astro,
// src/components/SayiKapak.astro (sayının kapağı) ve src/layouts/App.astro'nun üst barı.
// Biri değişirse buradaki karşılığı da güncellenmeli.
import { marked } from 'marked';
import { KONULAR, KONU_RENK } from '../lib/konular';
import { grafikHtml } from '../lib/grafik.js';
import { FIILLER, type ArastirmaVeri, type Kayit, type Kisi, type SayiVeri, type YaziVeri } from './panel-icerik';
import { yaziYerleri } from '../lib/yerlesim';

// Ham HTML gösterilmez (yalnızca Markdown). ```grafik blokları sitedeki gibi çubuk grafik olur.
marked.use({
  renderer: {
    html: () => '',
    code({ text, lang }) { return lang === 'grafik' ? grafikHtml(text) : false; },
  },
});

// Dipnotlar ([^1]) sitedeki gibi: metinde üst simge, sonda "Kaynaklar ve notlar"
const IM = ['\uE000', '\uE001'];
export function metinHtml(md: string): string {
  const tanimlar = new Map<string, string>();
  const govde = md.replace(/^\[\^([^\]\s]+)\]:[ \t]*(.*)$/gm, (_, k: string, t: string) => { tanimlar.set(k, t); return ''; });
  const sira: string[] = [];
  const isaretli = govde.replace(/\[\^([^\]\s]+)\]/g, (m, k: string) => {
    if (!tanimlar.has(k)) return m;
    if (!sira.includes(k)) sira.push(k);
    return `${IM[0]}${sira.indexOf(k) + 1}${IM[1]}`;
  });
  let html = marked.parse(isaretli, { async: false }) as string;
  html = html.replace(new RegExp(`${IM[0]}(\\d+)${IM[1]}`, 'g'), '<sup><a href="#" data-footnote-ref>$1</a></sup>');
  if (sira.length) {
    html += `<section class="footnotes"><h2>Kaynaklar ve notlar</h2><ol>${sira.map((k) => `<li><p>${marked.parseInline(tanimlar.get(k)!, { async: false })}</p></li>`).join('')}</ol></section>`;
  }
  return html;
}

const e = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pad = (n: number) => String(n).padStart(2, '0');
const konuAdi = (k: string) => KONULAR[k] ?? k;
const konuRenk = (k: string) => KONU_RENK[k] ?? '#8b8b86';

export type Baglam = { sayilar: Kayit<SayiVeri>[]; yazilar: Kayit<YaziVeri>[]; arastirmalar: Kayit<ArastirmaVeri>[]; ekip: Kisi[] };
type YaziTaslak = { yol: string; veri: YaziVeri; govde: string };

const PARANTEZ: Kisi = { ad: '(parantez)', kisa: '(p)', renk: '#111111', rol: 'bülten' };
export function kisiBul(ad: string, ekip: Kisi[]): Kisi {
  const k = ekip.find((x) => x.ad === ad);
  if (k) return k;
  const kisa = ad.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr');
  return { ad, kisa, renk: '#8b8b86', rol: 'yazar' };
}
export const av = (k: Kisi) => `<span class="av av--o" style="--av:${e(k.renk)}" aria-hidden="true">${e(k.kisa)}</span>`;

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const tarih = (t: string) => new Date(`${t || '2000-01-01'}T12:00:00Z`);
const tarihUzun = (t: string) => { const d = tarih(t); return `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const gunAdi = (t: string) => GUNLER[tarih(t).getUTCDay()];

const gorsel = (src: string, w: number, h: number) => src.replace(/^(https:\/\/picsum\.photos\/seed\/[^/]+)\/\d+\/\d+$/, `$1/${w}/${h}`);

// Sitedeki okumaSuresi ile aynı: spot, gövde, "neden önemli" ve "kısaca"; dakikada ~180 kelime
export function okumaSuresi(v: YaziVeri, govde: string): number {
  const metin = [v.spot, govde, v.neden, ...v.kisaca].join(' ');
  return Math.max(1, Math.ceil(metin.replace(/[#>*_`]/g, ' ').split(/\s+/).filter(Boolean).length / 180));
}

const adOf = (yol: string) => yol.split('/').pop()!.replace(/\.md$/, '');
const SVG_GERI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>';
// Barın sağındaki "Menü" düğmesi (App.astro'daki gibi; masaüstünde "Arşiv")
const MENU = '<button type="button" class="bar__menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg><span class="ana-ust__masa">Arşiv</span><span class="ana-ust__tel">Menü</span></button>';
// Bir sayının listesindeki yazılar, sırasıyla (henüz bulunmayanlar atlanır)
export const sayininYazilari = (v: SayiVeri, yazilar: Kayit<YaziVeri>[]) =>
  v.yazilar.map((ad) => yazilar.find((y) => adOf(y.yol) === ad)).filter((y): y is Kayit<YaziVeri> => !!y);
const SVG_PAYLAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const SVG_GONDER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';

function bar(baslik: string, alt: string, sag: string) {
  return `
    <header class="bar">
      <a class="bar__geri" href="#" aria-label="Geri">${SVG_GERI}</a>
      <div class="bar__kim"><div class="bar__k">${av(PARANTEZ)}<div class="bar__t"><b>${e(baslik)}</b><span>${e(alt)}</span></div></div></div>
      <div class="bar__act">${sag}${MENU}</div>
    </header>`;
}

// ------------------------------------------------------------------ yazı sayfası

export function yaziOnizleme(y: YaziTaslak, b: Baglam, gorselUrl?: string): string {
  const v = y.veri;
  // Yazı bir sayının listesindeyse o sayının içinde; değilse havuzda (yayına çıkmamış) gibi gösterilir
  const yer = yaziYerleri(b.sayilar.map((s) => s.veri)).get(adOf(y.yol));
  const sayi = yer ? b.sayilar.find((s) => s.veri.sayi === yer.sayi) : undefined;
  const kardesler = sayi
    ? sayi.veri.yazilar.map((ad) => (ad === adOf(y.yol) ? y : b.yazilar.find((x) => adOf(x.yol) === ad && !x.veri.taslak))).filter((x): x is YaziTaslak => !!x)
    : [y];
  const i = kardesler.findIndex((x) => x.yol === y.yol);
  const n = kardesler.length;
  const sonraki = kardesler[i + 1];
  const sayiAdi = yer ? `Sayı ${pad(yer.sayi)}` : 'Havuzda';
  const yazar = kisiBul(v.yazar, b.ekip);
  const dk = okumaSuresi(v, y.govde);
  const foto = gorselUrl ?? gorsel(v.gorsel, 1200, 632);

  return `<div class="app"><div class="main">
    ${bar(sayiAdi, `yazı ${i + 1}/${n} · ${konuAdi(v.konu).toLocaleLowerCase('tr')}`, `<button type="button" class="ib" title="Paylaş" aria-label="Paylaş">${SVG_PAYLAS}</button>`)}
    <main class="oku">
      <article class="yz" style="--c:${konuRenk(v.konu)}">
        <header class="yz__bas">
          <p class="yz__ust"><a class="yz__konu" href="#">${e(konuAdi(v.konu))}</a><span>${sayiAdi} · ${i + 1}/${n}</span></p>
          <h1 class="yz__baslik">${e(v.baslik)}</h1>
          <p class="yz__spot">${e(v.spot)}</p>
          <div class="yz__imza">${av(yazar)}<span><b>${e(yazar.ad)}</b><small>${sayi ? tarihUzun(sayi.veri.yayin) : 'yayın tarihi yok'} · ${dk} dk okuma</small></span></div>
        </header>
        <figure class="yz__foto">
          <span class="yz__g">${foto ? `<img src="${e(foto)}" alt="${e(v.gorselAlt)}" width="1200" height="632">` : ''}</span>
          ${v.gorselKaynak ? `<figcaption>${e(v.gorselKaynak)}</figcaption>` : ''}
        </figure>
        <aside class="not" aria-label="Kısaca">${av(PARANTEZ)}
          <div class="not__b"><b class="not__e">Kısaca</b><ol>${v.kisaca.map((k) => `<li>${e(k)}</li>`).join('')}</ol></div>
        </aside>
        <div class="yz__metin">${metinHtml(y.govde)}</div>
        <aside class="not not--neden" aria-label="Neden önemli?">${av(PARANTEZ)}
          <div class="not__b"><b class="not__e">Neden önemli?</b><p>${e(v.neden)}</p></div>
        </aside>
        <footer class="yz__son">
          <p class="bitti"><span>(son)</span></p>
          <div class="yz-tepki"><p>bu yazı nasıldı?</p><div>${['❤️', '😂', '😮', '😢', '🔥'].map((x) => `<button type="button">${x}<span></span></button>`).join('')}</div></div>
          ${sonraki ? `
            <a class="sonraki" href="#">
              <span class="sonraki__t">
                <small>Sıradaki · ${i + 2}/${n} · ${okumaSuresi(sonraki.veri, sonraki.govde)} dk</small>
                <b>${e(sonraki.veri.baslik)}</b>
                <span>${e(sonraki.veri.yazar)} · ${e(konuAdi(sonraki.veri.konu))}</span>
              </span>
              <span class="sonraki__g"><img src="${e(gorsel(sonraki.veri.gorsel, 1200, 632))}" alt="" width="1200" height="632"></span>
            </a>` : `
            <a class="sonraki sonraki--son" href="#">
              <span class="sonraki__t"><small>Bu sayının son yazısıydı</small><b>${sayiAdi} sohbetine dön</b><span>özet, öneriler ve etkinlikler orada</span></span>
            </a>`}
          <section class="yz-abone" aria-label="Abone ol">
            <div class="not">${av(PARANTEZ)}<div class="not__b"><p>bu yazı her pazar 09:00’da gelen bültenimizden. sana da gelsin mi?</p></div></div>
            <form class="yz-abone__form"><input name="eposta" type="email" placeholder="e-posta adresin"><button class="send" type="button" aria-label="Abone ol">${SVG_GONDER}</button></form>
          </section>
        </footer>
      </article>
    </main>
  </div></div>`;
}

// ------------------------------------------------------------------ sayının kapağı (SayiKapak.astro)

const ANA_UST = `<header class="ana-ust"><a class="brand" href="#"><b>(parantez)</b></a><nav aria-label="Site">
  <button type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg><span class="ana-ust__masa">Arşiv</span><span class="ana-ust__tel">Menü</span></button>
  <a href="#">Araştırma</a><a href="#">Hakkında</a></nav></header>`;
const ilkAd = (ad: string) => ad.split(/\s+/)[0];
const AY_KUCUK = AYLAR.map((a) => a.toLocaleLowerCase('tr'));

// Sekmeler radyo düğmeleriyle çalışır; önizlemede betik olmasa da tıklanınca değişir
export function sayiOnizleme(v: SayiVeri, govde: string, b: Baglam): string {
  const liste = sayininYazilari(v, b.yazilar).filter((y) => !y.veri.taslak);
  const sureler = liste.map((y) => okumaSuresi(y.veri, y.govde));
  const editor = kisiBul(v.imza.split(',')[0].trim(), b.ekip);
  const ozet = govde.trim().split(/\n\s*\n/)[0]?.replace(/[*_`#>]/g, '').trim() ?? '';
  const oneriler = FIILLER.map(([k, fiil]) => ({ k, fiil, o: v.oneriler?.[k] })).filter((x) => x.o);
  const etkinlikler = [...(v.etkinlikler ?? [])].sort((a, c) => a.tarih.localeCompare(c.tarih));
  const disari = oneriler.length > 0 || etkinlikler.length > 0;
  // Daha yeni bir sayı varsa bu sayı sitede "arşiv" olarak görünür
  const guncel = !b.sayilar.some((s) => !s.veri.taslak && s.veri.sayi > v.sayi);

  return `<div class="app app--ana"><div class="main"><main class="msgs">
    ${ANA_UST}
    <section class="kapak"><div class="kapak__ic">
      <div class="kapak__sol">
        <p class="kapak__ust">Sayı ${pad(v.sayi)} · ${gunAdi(v.yayin)}, ${tarihUzun(v.yayin)} ${guncel ? '<em class="rozet">bu hafta</em>' : '<em class="rozet rozet--arsiv">arşiv</em>'}</p>
        <div class="kapak__selam">${av(editor)}<p>günaydın. bu hafta tek cümle:</p></div>
        <h1 class="kapak__baslik">${e(v.baslik)}</h1>
        ${ozet ? `<p class="kapak__ozet">${e(ozet)}</p>` : ''}
        <div class="kapak__cta"><a class="chip chip--dolu" href="#">Abone ol</a></div>
      </div>
      <div class="kapak__sag sek">
        <input type="radio" name="sek" id="sek-yazilar" checked>
        <input type="radio" name="sek" id="sek-ne-oldu">
        ${disari ? '<input type="radio" name="sek" id="sek-ne-yapsam">' : ''}
        <div class="sek__d">
          <label class="chip" for="sek-yazilar">Yazılar <span class="sek__say">${liste.length}</span></label>
          <label class="chip" for="sek-ne-oldu">Ne oldu?</label>
          ${disari ? '<label class="chip" for="sek-ne-yapsam">Haftalık seçki</label>' : ''}
        </div>
        <div class="sek__p sek__p--yazilar"><ol class="kapak__yazilar">
          ${liste.map((y, i) => `<li><a href="#" style="--c:${konuRenk(y.veri.konu)}"><span class="kapak__no">${pad(i + 1)}</span>
            <span class="kapak__t"><b>${e(y.veri.baslik)}</b><small><i aria-hidden="true"></i>${e(konuAdi(y.veri.konu))} · ${sureler[i]} dk · ${e(ilkAd(y.veri.yazar))}</small></span></a></li>`).join('')}
        </ol></div>
        <div class="sek__p sek__p--ne-oldu"><ul class="kisa">
          ${v.kisaKisa.map((k) => `<li style="--c:${konuRenk(k.konu)}"><small>${e(konuAdi(k.konu))}</small><span>${e(k.metin)}</span></li>`).join('')}
        </ul></div>
        ${disari ? `<div class="sek__p sek__p--ne-yapsam"><ul class="yapsam">
          ${oneriler.map(({ fiil, o }) => `<li><span class="yapsam__e">${fiil}</span><span class="yapsam__t">
            <b>${e(o!.baslik)}</b><small>${e(o!.kimden)} · ${e(o!.tur)}</small><span class="yapsam__n">${e(o!.not)}</span></span></li>`).join('')}
          ${etkinlikler.map((x) => `<li><span class="yapsam__e">Git</span><span class="yapsam__t">
            <b>${e(x.ad)}</b>
            <small>${tarih(x.tarih).getUTCDate()} ${AY_KUCUK[tarih(x.tarih).getUTCMonth()]} ${gunAdi(x.tarih)}${x.saat ? ` ${e(x.saat)}` : ''} · ${e(x.yer)}, ${e(x.sehir)} · ${e(x.ucret)}</small></span></li>`).join('')}
        </ul><a class="sek__devam" href="#">Seçkiyi incele →</a></div>` : ''}
      </div>
    </div></section>
  </main></div></div>`;
}

// ------------------------------------------------------------------ araştırma

type ArastirmaTaslak = { yol: string; veri: ArastirmaVeri; govde: string };
const adlar = (l: string[]) => (l.length < 2 ? l[0] ?? '' : `${l.slice(0, -1).join(', ')} ve ${l[l.length - 1]}`);

// src/layouts/Arastirma.astro (üst menü: components/AnaUst.astro) + src/pages/arastirma/[slug].astro
export function arastirmaOnizleme(a: ArastirmaTaslak, _b: Baglam, gorselUrl?: string): string {
  const v = a.veri;
  const foto = gorselUrl ?? (v.gorsel ? gorsel(v.gorsel, 1200, 632) : '');
  return `<div class="ust-sayfa ar-sayfa">
    <header class="ana-ust"><a class="brand" href="#"><b>(parantez)</b></a><nav><button type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>Arşiv</button><a href="#">Araştırma</a><a href="#">Hakkında</a></nav></header>
    <main class="ar-kap ar-ana">
      <article class="ar-yazi">
        <header>
          <p class="ar-no">No. ${pad(v.no)}</p>
          <h1 class="ar-baslik">${e(v.baslik)}</h1>
          <p class="ar-imza">${e(adlar(v.yazarlar))} · ${tarihUzun(v.yayin)}</p>
        </header>
        ${foto ? `<figure class="ar-gorsel"><img src="${e(foto)}" alt="${e(v.gorselAlt)}" width="1200" height="632">${v.gorselKaynak ? `<figcaption>${e(v.gorselKaynak)}</figcaption>` : ''}</figure>` : ''}
        <div class="ar-metin">${metinHtml(a.govde)}</div>
      </article>
    </main>
  </div>`;
}

// ------------------------------------------------------------------ çerçeve

const CIHAZ = { telefon: { w: 390, h: 760 }, masaustu: { w: 1280, h: 800 } } as const;
export type Cihaz = keyof typeof CIHAZ;

export function cihazTercihi(): Cihaz {
  try { return localStorage.getItem('pn:cihaz') === 'masaustu' ? 'masaustu' : 'telefon'; } catch { return 'telefon'; }
}

function belge(govde: string): string {
  // Sitenin stil dosyaları panelinkilerle aynı; önizleme onları kullanır. Betik çalışmaz;
  // kapaktaki sekmeler radyo düğmeleriyle olduğu için yine de değişir.
  const stiller = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((x) => x.outerHTML).join('\n');
  return `<!doctype html><html lang="tr" class="yan-kapali"><head><meta charset="utf-8"><base href="${location.origin}/">${stiller}</head><body>${govde}</body></html>`;
}

// Önizleme alanı: telefon/masaüstü seçimi ve sitenin kendisi gibi kayan bir çerçeve
export function onizlemeKur(kap: HTMLElement, govde: string) {
  let cihaz = cihazTercihi();
  kap.innerHTML = `
    <div class="pn-cihazlar" role="group" aria-label="Ekran">
      <button type="button" data-cihaz="telefon">Telefon</button>
      <button type="button" data-cihaz="masaustu">Masaüstü</button>
    </div>
    <div class="pn-cerceve"><iframe title="Önizleme" sandbox="allow-same-origin"></iframe></div>`;
  const cerceve = kap.querySelector<HTMLElement>('.pn-cerceve')!;
  const fr = kap.querySelector('iframe')!;
  fr.addEventListener('load', () => {
    // Önizlemedeki bağlantılar bir yere gitmez
    fr.contentDocument?.addEventListener('click', (ev) => {
      if ((ev.target as Element).closest?.('a, button, form')) ev.preventDefault();
    }, true);
  });
  fr.srcdoc = belge(govde);

  const olc = () => {
    const { w, h } = CIHAZ[cihaz];
    const k = Math.min(1, ((kap.clientWidth || w) - 20) / w);
    fr.style.width = `${w}px`;
    fr.style.height = `${h}px`;
    fr.style.transform = k < 1 ? `scale(${k})` : '';
    cerceve.style.width = `${w * k}px`;
    cerceve.style.height = `${h * k}px`;
    cerceve.dataset.cihaz = cihaz;
    for (const b of kap.querySelectorAll<HTMLButtonElement>('[data-cihaz]')) b.setAttribute('aria-pressed', String(b.dataset.cihaz === cihaz));
  };
  kap.addEventListener('click', (ev) => {
    const b = (ev.target as Element).closest<HTMLButtonElement>('[data-cihaz]');
    if (!b) return;
    cihaz = b.dataset.cihaz as Cihaz;
    try { localStorage.setItem('pn:cihaz', cihaz); } catch { /* yok */ }
    olc();
  });
  const g = new ResizeObserver(() => (kap.isConnected ? olc() : g.disconnect()));
  g.observe(kap);
  olc();
}

// ------------------------------------------------------------------ farklar

type Parca = { t: -1 | 0 | 1; s: string };

// En uzun ortak alt dizi ile iki listenin farkı
export function fark(a: string[], b: string[]): Parca[] {
  let bas = 0;
  while (bas < a.length && bas < b.length && a[bas] === b[bas]) bas++;
  let son = 0;
  while (son < a.length - bas && son < b.length - bas && a[a.length - 1 - son] === b[b.length - 1 - son]) son++;
  const x = a.slice(bas, a.length - son);
  const y = b.slice(bas, b.length - son);
  const orta: Parca[] = [];
  if (x.length * y.length > 2_000_000) {
    orta.push(...x.map((s) => ({ t: -1 as const, s })), ...y.map((s) => ({ t: 1 as const, s })));
  } else {
    const m = x.length, n = y.length;
    const L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (x[i] === y[j]) { orta.push({ t: 0, s: x[i] }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) orta.push({ t: -1, s: x[i++] });
      else orta.push({ t: 1, s: y[j++] });
    }
    while (i < m) orta.push({ t: -1, s: x[i++] });
    while (j < n) orta.push({ t: 1, s: y[j++] });
  }
  return [...a.slice(0, bas).map((s) => ({ t: 0 as const, s })), ...orta, ...a.slice(a.length - son).map((s) => ({ t: 0 as const, s }))];
}

// Bir cümle içinde kelime kelime fark
function kelimeFarki(eski: string, yeni: string): string {
  const p = fark(eski.split(/(\s+)/), yeni.split(/(\s+)/));
  // Cümle baştan yazılmışsa kelime kelime göstermek okunmaz: eskisi ve yenisi alt alta
  const kelime = (t: number) => p.filter((x) => x.t === t && x.s.trim()).length;
  if (kelime(0) < Math.max(kelime(-1), kelime(1))) return `<del>${e(eski)}</del><br><ins>${e(yeni)}</ins>`;
  let html = '';
  for (let i = 0; i < p.length;) {
    const t = p[i].t;
    let s = '';
    while (i < p.length && p[i].t === t) s += p[i++].s;
    html += t === 0 ? e(s) : t < 0 ? `<del>${e(s)}</del>` : `<ins>${e(s)}</ins>`;
  }
  return html;
}

// Paragraf paragraf fark; değişen paragrafların içinde kelime farkı
function bloklarFarki(eski: string[], yeni: string[]): string {
  const p = fark(eski, yeni);
  let html = '';
  for (let i = 0; i < p.length;) {
    if (p[i].t === 0) { html += `<p class="pn-fark__ayni">${e(p[i++].s)}</p>`; continue; }
    const cik: string[] = [], gir: string[] = [];
    while (i < p.length && p[i].t !== 0) (p[i].t < 0 ? cik : gir).push(p[i++].s);
    const ortak = Math.min(cik.length, gir.length);
    for (let k = 0; k < ortak; k++) html += `<p class="pn-fark__degisti">${kelimeFarki(cik[k], gir[k])}</p>`;
    for (const s of cik.slice(ortak)) html += `<p class="pn-fark__cikti"><del>${e(s)}</del></p>`;
    for (const s of gir.slice(ortak)) html += `<p class="pn-fark__girdi"><ins>${e(s)}</ins></p>`;
  }
  return html;
}

const paragraflar = (md: string) => md.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

type Alan = [etiket: string, deger: string | string[], tur?: 'gorsel'];

function alanlarFarki(eski: Alan[], yeni: Alan[], gorselUrl?: string): string {
  let html = '';
  yeni.forEach(([etiket, y, tur], i) => {
    const x = eski[i][1];
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    let ic: string;
    if (tur === 'gorsel') {
      const resim = (src: string) => (src ? `<img src="${e(src)}" alt="">` : '<span>yok</span>');
      ic = `<div class="pn-fark__gorsel"><del>${resim(gorsel(String(x), 600, 316))}</del><ins>${resim(gorselUrl ?? gorsel(String(y), 600, 316))}</ins></div>`;
    } else if (Array.isArray(y) || Array.isArray(x)) {
      ic = bloklarFarki([x].flat(), [y].flat());
    } else {
      ic = `<p class="pn-fark__degisti">${kelimeFarki(String(x), String(y))}</p>`;
    }
    html += `<section class="pn-fark__alan"><h3>${e(etiket)}</h3>${ic}</section>`;
  });
  return html;
}

const yaziAlanlari = (v: YaziVeri): Alan[] => [
  ['Başlık', v.baslik], ['Konu', konuAdi(v.konu)], ['Yazar', v.yazar],
  ['Spot', v.spot], ['Görsel', v.gorsel, 'gorsel'], ['Görselde ne var?', v.gorselAlt], ['Görsel kaynağı', v.gorselKaynak],
  ['Kısaca', v.kisaca], ['Neden önemli?', v.neden], ['Sitede gizli', v.taslak ? 'evet' : 'hayır'],
];

const sayiAlanlari = (v: SayiVeri): Alan[] => [
  ['Sayı no', String(v.sayi)], ['Haftanın cümlesi', v.baslik], ['Yayın', v.yayin], ['Kapsadığı hafta', `${v.baslangic} → ${v.bitis}`],
  ['İmza', v.imza], ['Sitede gizli', v.taslak ? 'evet' : 'hayır'],
  ['Yazılar', v.yazilar.map((ad, i) => `${i + 1}. ${ad}`)],
  ['Kısa kısa', v.kisaKisa.map((k) => `${konuAdi(k.konu)}: ${k.metin}`)],
  ...FIILLER.map(([k, ad]): Alan => {
    const o = v.oneriler?.[k];
    return [ad, o ? [`${o.baslik} — ${o.kimden} (${o.tur})`, o.not, ...(o.link ? [`${o.linkMetni ?? 'bağlantı'}: ${o.link}`] : [])] : []];
  }),
  ['Gidilecek yerler', (v.etkinlikler ?? []).map((x) => `${x.tarih}${x.saat ? ` ${x.saat}` : ''} · ${x.ad} · ${x.tur} · ${x.yer}, ${x.sehir} · ${x.ucret}${x.link ? ` · ${x.link}` : ''}`)],
];

export function yaziFarki(eski: YaziTaslak, yeni: YaziTaslak, gorselUrl?: string): string {
  const alanlar = alanlarFarki(yaziAlanlari(eski.veri), yaziAlanlari(yeni.veri), gorselUrl);
  const metin = eski.govde.trim() === yeni.govde.trim() ? '' : `<section class="pn-fark__alan"><h3>Metin</h3>${bloklarFarki(paragraflar(eski.govde), paragraflar(yeni.govde))}</section>`;
  return alanlar + metin || '<p class="pn-bos">Yayındaki hâliyle aynı; değişiklik yok.</p>';
}

export function sayiFarki(eski: { veri: SayiVeri; govde: string }, yeni: { veri: SayiVeri; govde: string }): string {
  const alanlar = alanlarFarki(sayiAlanlari(eski.veri), sayiAlanlari(yeni.veri));
  const metin = eski.govde.trim() === yeni.govde.trim() ? '' : `<section class="pn-fark__alan"><h3>Haftanın özeti</h3>${bloklarFarki(paragraflar(eski.govde), paragraflar(yeni.govde))}</section>`;
  return alanlar + metin || '<p class="pn-bos">Yayındaki hâliyle aynı; değişiklik yok.</p>';
}

const arastirmaAlanlari = (v: ArastirmaVeri): Alan[] => [
  ['Başlık', v.baslik], ['No', String(v.no)], ['Yayın', v.yayin], ['Yazarlar', v.yazarlar], ['Kısa açıklama', v.ozet],
  ['Görsel', v.gorsel, 'gorsel'], ['Görselde ne var?', v.gorselAlt], ['Görsel kaynağı', v.gorselKaynak],
  ['Sitede gizli', v.taslak ? 'evet' : 'hayır'],
];

export function arastirmaFarki(eski: ArastirmaTaslak, yeni: ArastirmaTaslak, gorselUrl?: string): string {
  const alanlar = alanlarFarki(arastirmaAlanlari(eski.veri), arastirmaAlanlari(yeni.veri), gorselUrl);
  const metin = eski.govde.trim() === yeni.govde.trim() ? '' : `<section class="pn-fark__alan"><h3>Metin</h3>${bloklarFarki(paragraflar(eski.govde), paragraflar(yeni.govde))}</section>`;
  return alanlar + metin || '<p class="pn-bos">Yayındaki hâliyle aynı; değişiklik yok.</p>';
}

export { adOf };
