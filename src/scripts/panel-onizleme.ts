// Panel: okurun göreceği hâliyle önizleme ve iki sürüm arasındaki farklar.
// Şablonlar sitedekilerin aynısı olmalı: src/pages/yazi/[slug].astro,
// src/components/IssueChat.astro (Grp, LinkCard, Av) ve src/layouts/App.astro'nun üst barı.
// Biri değişirse buradaki karşılığı da güncellenmeli.
import { marked } from 'marked';
import { KONULAR, KONU_RENK } from '../lib/konular';
import { FIILLER, type Kayit, type Kisi, type SayiVeri, type YaziVeri } from './panel-icerik';

// Ham HTML gösterilmez (yalnızca Markdown)
marked.use({ renderer: { html: () => '' } });
export const metinHtml = (md: string) => marked.parse(md, { async: false }) as string;

const e = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pad = (n: number) => String(n).padStart(2, '0');
const konuAdi = (k: string) => KONULAR[k] ?? k;
const konuRenk = (k: string) => KONU_RENK[k] ?? '#8b8b86';

export type Baglam = { sayilar: Kayit<SayiVeri>[]; yazilar: Kayit<YaziVeri>[]; ekip: Kisi[] };
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
const AYK = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
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
const SVG_PAYLAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
const SVG_GONDER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';

function bar(baslik: string, alt: string, sag: string) {
  return `
    <header class="bar">
      <a class="bar__geri" href="#" aria-label="Geri">${SVG_GERI}</a>
      <div class="bar__kim"><div class="bar__k">${av(PARANTEZ)}<div class="bar__t"><b>${e(baslik)}</b><span>${e(alt)}</span></div></div></div>
      <div class="bar__act">${sag}</div>
    </header>`;
}

// ------------------------------------------------------------------ yazı sayfası

export function yaziOnizleme(y: YaziTaslak, b: Baglam, gorselUrl?: string): string {
  const v = y.veri;
  const sayi = b.sayilar.find((s) => s.veri.sayi === v.sayi);
  const kardesler = [...b.yazilar.filter((x) => x.veri.sayi === v.sayi && !x.veri.taslak && x.yol !== y.yol), y]
    .sort((a, c) => a.veri.sira - c.veri.sira);
  const i = kardesler.findIndex((x) => x.yol === y.yol);
  const n = kardesler.length;
  const sonraki = kardesler[i + 1];
  const yazar = kisiBul(v.yazar, b.ekip);
  const dk = okumaSuresi(v, y.govde);
  const foto = gorselUrl ?? gorsel(v.gorsel, 1200, 632);

  return `<div class="app"><div class="main">
    ${bar(`Sayı ${pad(v.sayi)}`, `yazı ${i + 1}/${n} · ${konuAdi(v.konu).toLocaleLowerCase('tr')}`, `<button type="button" class="ib" title="Paylaş" aria-label="Paylaş">${SVG_PAYLAS}</button>`)}
    <main class="oku">
      <article class="yz" style="--c:${konuRenk(v.konu)}">
        <header class="yz__bas">
          <p class="yz__ust"><a class="yz__konu" href="#">${e(konuAdi(v.konu))}</a><span>Sayı ${pad(v.sayi)} · ${i + 1}/${n}</span></p>
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
              <span class="sonraki__t"><small>Bu sayının son yazısıydı</small><b>Sayı ${pad(v.sayi)} sohbetine dön</b><span>özet, öneriler ve etkinlikler orada</span></span>
            </a>`}
          <section class="yz-abone" aria-label="Abone ol">
            <div class="not">${av(PARANTEZ)}<div class="not__b"><p>bu yazı her pazartesi 07:30’da gelen bültenimizden. sana da gelsin mi?</p></div></div>
            <form class="yz-abone__form"><input name="eposta" type="email" placeholder="e-posta adresin"><button class="send" type="button" aria-label="Abone ol">${SVG_GONDER}</button></form>
          </section>
        </footer>
      </article>
    </main>
  </div></div>`;
}

// ------------------------------------------------------------------ sayı sohbeti

const grp = (k: Kisi, ic: string, { isim = true, flow = false, cls = '' } = {}) => `
  <div class="grp${cls ? ` ${cls}` : ''}" data-kim="${e(k.kisa)}">
    <div class="grp__av">${av(k)}</div>
    ${isim ? `<div class="grp__ad">${e(k.ad)}${k.kisa === '(p)' ? '' : ` · ${e(k.rol)}`}</div>` : ''}
    <div class="bs${flow ? ' flow' : ''}"${flow ? ' data-flow="not"' : ''}>${ic}</div>
  </div>`;

export function sayiOnizleme(v: SayiVeri, govde: string, b: Baglam): string {
  const liste = b.yazilar.filter((y) => y.veri.sayi === v.sayi && !y.veri.taslak).sort((a, c) => a.veri.sira - c.veri.sira);
  const sureler = liste.map((y) => okumaSuresi(y.veri, y.govde));
  const toplam = sureler.reduce((t, x) => t + x, 0);
  const editor = kisiBul(v.imza.split(',')[0].trim(), b.ekip);
  const oneriler = FIILLER.map(([k, fiil]) => ({ k, fiil, o: v.oneriler?.[k] })).filter((x) => x.o);
  const etkinlikler = [...(v.etkinlikler ?? [])].sort((a, c) => a.tarih.localeCompare(c.tarih));
  const kart = (y: Kayit<YaziVeri>, i: number) => `
    <a class="lc" href="#" style="--c:${konuRenk(y.veri.konu)}">
      <span class="lc__img"><img src="${e(gorsel(y.veri.gorsel, 1200, 632))}" alt="" width="1200" height="632"></span>
      <span class="lc__body">
        <small>${pad(y.veri.sira)} · ${e(konuAdi(y.veri.konu))} · ${sureler[i]} dk</small>
        <b>${e(y.veri.baslik)}</b>
        <span class="lc__spot">${e(y.veri.spot)}</span>
      </span>
    </a>`;

  return `<div class="app"><div class="main">
    ${bar(`Sayı ${pad(v.sayi)}`, v.baslik, '<a class="ib" href="#" title="Hakkında" aria-label="Hakkında"><span aria-hidden="true">i</span></a>')}
    <main class="msgs">
      <div class="sohbet">
        <div class="day">Sayı ${pad(v.sayi)} · ${gunAdi(v.yayin)}, ${tarihUzun(v.yayin)} · 07:30</div>
        ${grp(editor, `<p class="b">günaydın. bu hafta tek cümle:</p><h1 class="b b--baslik">${e(v.baslik)}</h1>`)}
        ${grp(editor, metinHtml(govde), { isim: false, flow: true, cls: 'grp--devam' })}
        ${grp(PARANTEZ, `<p class="b">bu sayıda ${liste.length} yazı var, toplam ${toplam} dakika. nereden başlayalım?</p>`)}

        <section class="dal" aria-label="Ne oldu?">
          <div class="me"><p class="b">bu hafta ne oldu?</p></div>
          ${grp(PARANTEZ, `<p class="b">kısaca ${v.kisaKisa.length} şey:</p>${v.kisaKisa.map((k) => `<p class="b"><span class="kt">${e(konuAdi(k.konu))}</span>${e(k.metin)}</p>`).join('')}`)}
        </section>

        <section class="dal" aria-label="Bu sayının yazıları">
          <div class="me"><p class="b">yazıları göster</p></div>
          ${grp(PARANTEZ, `<p class="b">bu sayıda ${liste.length} yazı, toplam ${toplam} dakika. birine dokun, okumaya başla:</p>${liste.map(kart).join('')}`)}
        </section>

        ${oneriler.length || etkinlikler.length ? `
        <section class="dal" aria-label="Parantez dışı">
          <div class="me"><p class="b">bu hafta ne yapsam?</p></div>
          ${grp(PARANTEZ, `
            ${oneriler.length ? '<p class="b">gündemin dışında kalanlar. dinle, izle, oku:</p>' : ''}
            ${oneriler.map(({ fiil, o }) => `
              <div class="b on">
                <small>${fiil} · ${e(o!.tur)}</small><b>${e(o!.baslik)}</b><span class="on__kim">${e(o!.kimden)}</span><p>${e(o!.not)}</p>
                ${o!.link ? `<a href="#">${e(o!.linkMetni ?? `${fiil} →`)}</a>` : ''}
              </div>`).join('')}
            ${etkinlikler.length ? '<p class="b">bir de bu hafta gidilecek yerler:</p>' : ''}
            ${etkinlikler.map((x) => `
              <div class="b ev">
                <span class="ev__d"><b>${tarih(x.tarih).getUTCDate()}</b><small>${AYK[tarih(x.tarih).getUTCMonth()]}</small></span>
                <span class="ev__t"><small>${e(x.tur)} · ${gunAdi(x.tarih)}${x.saat ? ` ${e(x.saat)}` : ''}</small><b>${x.link ? `<a href="#">${e(x.ad)}</a>` : e(x.ad)}</b><span>${e(x.yer)} · ${e(x.sehir)}</span></span>
                <span class="ev__u${/ücretsiz|bedava/i.test(x.ucret) ? ' is-free' : ''}">${e(x.ucret)}</span>
              </div>`).join('')}`)}
        </section>` : ''}

        <section class="dal" aria-label="Abone ol">
          <div class="me"><p class="b">bülten bana da gelsin</p></div>
          ${grp(PARANTEZ, `
            <p class="b">çok iyi. her pazartesi 07:30’da tek bir e-posta: haftanın özeti ve beş yazı. ücretsiz.</p>
            <p class="b">istediğin an, her e-postanın en altındaki bağlantıyla tek tıkla abonelikten çıkabilirsin.</p>
            <p class="b">e-posta adresini aşağıya yazar mısın?</p>`)}
        </section>
      </div>
    </main>
  </div></div>`;
}

// ------------------------------------------------------------------ çerçeve

const CIHAZ = { telefon: { w: 390, h: 760 }, masaustu: { w: 1280, h: 800 } } as const;
export type Cihaz = keyof typeof CIHAZ;

export function cihazTercihi(): Cihaz {
  try { return localStorage.getItem('pn:cihaz') === 'masaustu' ? 'masaustu' : 'telefon'; } catch { return 'telefon'; }
}

function belge(govde: string): string {
  // Sitenin stil dosyaları panelinkilerle aynı; önizleme onları kullanır. Betik çalışmaz,
  // bu yüzden sohbetin tüm dalları açık görünür (JavaScript'siz okurdaki gibi).
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
  ['Başlık', v.baslik], ['Sayı', `Sayı ${pad(v.sayi)}`], ['Sıra', String(v.sira)], ['Konu', konuAdi(v.konu)], ['Yazar', v.yazar],
  ['Spot', v.spot], ['Görsel', v.gorsel, 'gorsel'], ['Görselde ne var?', v.gorselAlt], ['Görsel kaynağı', v.gorselKaynak],
  ['Kısaca', v.kisaca], ['Neden önemli?', v.neden], ['Sitede gizli', v.taslak ? 'evet' : 'hayır'],
];

const sayiAlanlari = (v: SayiVeri): Alan[] => [
  ['Sayı no', String(v.sayi)], ['Haftanın cümlesi', v.baslik], ['Yayın', v.yayin], ['Kapsadığı hafta', `${v.baslangic} → ${v.bitis}`],
  ['İmza', v.imza], ['Sitede gizli', v.taslak ? 'evet' : 'hayır'],
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

export { adOf };
