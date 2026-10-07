import { getCollection, type CollectionEntry } from 'astro:content';

export type Sayi = CollectionEntry<'sayilar'>;
export type Yazi = CollectionEntry<'yazilar'>;

export const SITE = {
  ad: '(parantez)',
  slogan: 'Gündem uzun. Biz kısaltıyoruz. Bazen de uzatıyoruz.',
  aciklama: 'Her pazartesi 07:30’da gelen kutuna: haftanın özeti ve beş yazı. Gündem uzun, biz kısaltıyoruz. Bazen de uzatıyoruz.',
  eposta: 'merhaba@parantez.example',
};

export async function sayilar(): Promise<Sayi[]> {
  const all = await getCollection('sayilar', (s) => !s.data.taslak);
  return all.sort((a, b) => b.data.sayi - a.data.sayi);
}

export async function yazilar(): Promise<Yazi[]> {
  const all = await getCollection('yazilar', (y) => !y.data.taslak);
  return all.sort((a, b) => b.data.sayi - a.data.sayi || a.data.sira - b.data.sira);
}

export async function sayininYazilari(no: number): Promise<Yazi[]> {
  return (await yazilar()).filter((y) => y.data.sayi === no);
}

export async function guncelUrl(): Promise<string> {
  const [g] = await sayilar();
  return g ? sayiUrl(g.data.sayi) : '/';
}

export const pad = (n: number) => String(n).padStart(2, '0');

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Tarihler TR saatine göre (UTC+3) gösterilir.
const tr = (d: Date) => new Date(d.getTime() + 3 * 3600 * 1000);
export const tarihUzun = (d: Date) => { const t = tr(d); return `${t.getUTCDate()} ${AYLAR[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const gunAdi = (d: Date) => GUNLER[tr(d).getUTCDay()];
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

// picsum.photos geçici görselleri istenen boyuta çevirir; gerçek görsellere dokunmaz.
export function gorsel(src: string, w: number, h: number): string {
  return src.replace(/^(https:\/\/picsum\.photos\/seed\/[^/]+)\/\d+\/\d+$/, `$1/${w}/${h}`);
}

// Sohbette avatar olarak görünen kişiler
export type Kisi = { ad: string; kisa: string; renk: string; rol: string };
const KISILER: Record<string, Kisi> = {
  'Ece Arslan': { ad: 'Ece Arslan', kisa: 'EA', renk: '#ff4a24', rol: 'yayın yönetmeni' },
  'Deniz Kaya': { ad: 'Deniz Kaya', kisa: 'DK', renk: '#2a35ff', rol: 'editör' },
  'Mert Yalın': { ad: 'Mert Yalın', kisa: 'MY', renk: '#111111', rol: 'editör' },
};
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
