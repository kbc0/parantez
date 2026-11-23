import { getCollection, type CollectionEntry } from 'astro:content';
import ekip from '../data/ekip.json';
import { yaziYerleri } from './yerlesim';

export type Sayi = CollectionEntry<'sayilar'>;
// Sitedeki yazı: sayısı ve sırası, içinde bulunduğu sayının listesinden eklenmiş hâliyle
export type Yazi = Omit<CollectionEntry<'yazilar'>, 'data'> & { data: CollectionEntry<'yazilar'>['data'] & { sayi: number; sira: number } };
export type Arastirma = CollectionEntry<'arastirmalar'>;

export const SITE = {
  ad: '(parantez)',
  slogan: 'Gündem uzun. Biz kısaltıyoruz. Bazen de uzatıyoruz.',
  aciklama: 'Haftalık bülten. Her pazar 09:00’da gelen kutuna: haftanın özeti ve beş yazı. Gündem uzun, biz kısaltıyoruz.',
  // Aramalarda markanın öbür yazılışları (yapısal veri)
  digerAdlar: ['Parantez', 'Parantez Bülten'],
  // Resmî hesaplar (yapısal veride sameAs)
  hesaplar: ['https://www.instagram.com/parantezbulten/'],
  eposta: 'baris@parantezbulten.com',
};

export async function sayilar(): Promise<Sayi[]> {
  const all = await getCollection('sayilar', (s) => !s.data.taslak);
  return all.sort((a, b) => b.data.sayi - a.data.sayi);
}

// Yazı, yayındaki bir sayının listesindeyse ve kendisi gizli değilse görünür. Listede olmayan yazılar
// havuzda bekler; sayı taslakken yazıları da hazırlanır, sayı yayına alınınca hepsi birlikte çıkar.
export async function yazilar(): Promise<Yazi[]> {
  const yer = yaziYerleri((await sayilar()).map((s) => ({ sayi: s.data.sayi, yazilar: s.data.yazilar })));
  const all = await getCollection('yazilar', (y) => !y.data.taslak && yer.has(y.id));
  return all
    .map((y) => ({ ...y, data: { ...y.data, ...yer.get(y.id)! } }))
    .sort((a, b) => b.data.sayi - a.data.sayi || a.data.sira - b.data.sira);
}

export async function sayininYazilari(no: number): Promise<Yazi[]> {
  return (await yazilar()).filter((y) => y.data.sayi === no);
}

export async function arastirmalar(): Promise<Arastirma[]> {
  const all = await getCollection('arastirmalar', (a) => !a.data.taslak);
  return all.sort((a, b) => b.data.no - a.data.no);
}

export const pad = (n: number) => String(n).padStart(2, '0');

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Tarihler TR saatine göre (UTC+3) gösterilir.
const tr = (d: Date) => new Date(d.getTime() + 3 * 3600 * 1000);
export const tarihUzun = (d: Date) => { const t = tr(d); return `${t.getUTCDate()} ${AYLAR[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const gunAdi = (d: Date) => GUNLER[tr(d).getUTCDay()];
// Yayın anı (sayının günü, Türkiye saatiyle 09:00): yapısal veri ve paylaşım kartı için
export const yayinAni = (d: Date) => `${d.toISOString().slice(0, 10)}T09:00:00+03:00`;
// Arama sonuçlarındaki açıklama için düz ve kısa metin
export function kisaMetin(md: string, sinir = 160): string {
  const duz = md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  if (duz.length <= sinir) return duz;
  const kes = duz.slice(0, sinir - 1);
  return `${kes.slice(0, Math.max(kes.lastIndexOf(' '), sinir * 0.6)).trim()}…`;
}
export const tarihKisa = (d: Date) => { const t = tr(d); return `${pad(t.getUTCDate())}.${pad(t.getUTCMonth() + 1)}`; };
export const aralik = (a: Date, b: Date) => {
  const x = tr(a), y = tr(b);
  const sol = x.getUTCMonth() === y.getUTCMonth() ? `${x.getUTCDate()}` : `${x.getUTCDate()} ${AYLAR[x.getUTCMonth()]}`;
  return `${sol} — ${tarihUzun(b)}`;
};

// Spot, gövde, "neden önemli" ve "kısaca" birlikte; dakikada ~180 kelime.
export function okumaSuresi(y: Yazi): number {
  const metin = [y.data.spot, y.body ?? '', y.data.neden, ...y.data.kisaca].join(' ');
  const kelime = metin.replace(/[#>*_`]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(kelime / 180));
}

export const ayYil = (d: Date) => { const t = tr(d); return `${AYLAR[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };

// picsum.photos geçici görselleri istenen boyuta çevirir; panelden yüklenen
// görsellere (/gorseller/…) ve diğer adreslere dokunmaz.
export function gorsel(src: string, w: number, h: number): string {
  return src.replace(/^(https:\/\/picsum\.photos\/seed\/[^/]+)\/\d+\/\d+$/, `$1/${w}/${h}`);
}

// Sohbette avatar olarak görünen kişiler. Liste src/data/ekip.json'da; panelden düzenlenir.
export type Kisi = { ad: string; kisa: string; renk: string; rol: string };
const KISILER: Record<string, Kisi> = Object.fromEntries((ekip as Kisi[]).map((k) => [k.ad, k]));
export const PARANTEZ: Kisi = { ad: '(parantez)', kisa: '(p)', renk: '#111111', rol: 'bülten' };
export function kisi(ad: string): Kisi {
  if (KISILER[ad]) return KISILER[ad];
  const kisa = ad.split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr');
  return { ad, kisa, renk: '#8b8b86', rol: 'yazar' };
}
export const ilkAd = (ad: string) => ad.split(/\s+/)[0];

export const yaziUrl = (y: Yazi) => `/yazi/${y.id}/`;
export const sayiUrl = (no: number) => `/sayi/${no}/`;
export const konuUrl = (k: string) => `/konu/${k}/`;
export const arastirmaUrl = (a: Arastirma) => `/arastirma/${a.id}/`;
