// Panel: içerik dosyalarını okuma/yazma ve sitenin kurallarına göre denetleme.
// Kurallar src/content.config.ts ile aynı; burada yakalanmayan bir hata sitenin
// derlenmesini durdurur (site eski hâliyle yayında kalır).
import { parse, stringify } from 'yaml';
import { KONULAR } from '../lib/konular';

export type Kisi = { ad: string; kisa: string; renk: string; rol: string };
export type Oneri = { baslik: string; kimden: string; tur: string; not: string; link?: string; linkMetni?: string };
export type Etkinlik = { tarih: string; saat?: string; ad: string; tur: string; yer: string; sehir: string; ucret: string; link?: string };

export type YaziVeri = {
  baslik: string; sayi: number; sira: number; konu: string; yazar: string; spot: string;
  gorsel: string; gorselAlt: string; gorselKaynak: string; neden: string; kisaca: string[];
  podcast?: string; taslak?: boolean;
};
export type SayiVeri = {
  sayi: number; baslik: string; yayin: string; baslangic: string; bitis: string; imza: string;
  kisaKisa: { konu: string; metin: string }[];
  oneriler?: Partial<Record<'dinle' | 'izle' | 'oku', Oneri>>;
  etkinlikler?: Etkinlik[];
  taslak?: boolean;
};
export type Kayit<T> = { yol: string; sha: string; veri: T; govde: string };

export const KONU_LISTESI = Object.entries(KONULAR);
export const FIILLER = [['dinle', 'Dinle'], ['izle', 'İzle'], ['oku', 'Oku']] as const;

// ------------------------------------------------------------------ dosya biçimi

export function ayir(metin: string): { veri: Record<string, unknown>; govde: string } {
  const m = metin.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { veri: {}, govde: metin };
  return { veri: (parse(m[1]) as Record<string, unknown>) ?? {}, govde: m[2].replace(/^\s*\n/, '') };
}

// Boş alanları atar, alan sırasını korur
function temizle<T extends object>(o: T): T {
  const sonuc: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const ic = temizle(v as object);
      if (Object.keys(ic).length) sonuc[k] = ic;
      continue;
    }
    sonuc[k] = Array.isArray(v) ? v.map((x) => (typeof x === 'object' && x ? temizle(x) : x)) : v;
  }
  return sonuc as T;
}

export function birlestir(veri: object, govde: string): string {
  // Metinler hep tırnaklı yazılır: saat (19:00) ya da tarih gibi değerler başka türe dönüşmesin
  return `---\n${stringify(temizle(veri), { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })}---\n\n${govde.trim()}\n`;
}

export function yaziOku(d: { yol: string; sha: string; metin: string }): Kayit<YaziVeri> {
  const { veri, govde } = ayir(d.metin);
  const v = veri as Partial<YaziVeri>;
  return {
    yol: d.yol, sha: d.sha, govde,
    veri: {
      baslik: String(v.baslik ?? ''), sayi: Number(v.sayi ?? 0), sira: Number(v.sira ?? 1), konu: String(v.konu ?? ''),
      yazar: String(v.yazar ?? ''), spot: String(v.spot ?? ''), gorsel: String(v.gorsel ?? ''),
      gorselAlt: String(v.gorselAlt ?? ''), gorselKaynak: String(v.gorselKaynak ?? ''), neden: String(v.neden ?? ''),
      kisaca: Array.isArray(v.kisaca) ? v.kisaca.map(String) : [], podcast: v.podcast ? String(v.podcast) : undefined,
      taslak: !!v.taslak,
    },
  };
}

const tarihMetni = (x: unknown) => (x instanceof Date ? x.toISOString().slice(0, 10) : String(x ?? '').slice(0, 10));

export function sayiOku(d: { yol: string; sha: string; metin: string }): Kayit<SayiVeri> {
  const { veri, govde } = ayir(d.metin);
  const v = veri as Partial<SayiVeri>;
  return {
    yol: d.yol, sha: d.sha, govde,
    veri: {
      sayi: Number(v.sayi ?? 0), baslik: String(v.baslik ?? ''), yayin: tarihMetni(v.yayin),
      baslangic: tarihMetni(v.baslangic), bitis: tarihMetni(v.bitis), imza: String(v.imza ?? ''),
      kisaKisa: Array.isArray(v.kisaKisa) ? v.kisaKisa.map((k) => ({ konu: String(k.konu ?? ''), metin: String(k.metin ?? '') })) : [],
      oneriler: v.oneriler ?? {},
      etkinlikler: Array.isArray(v.etkinlikler) ? v.etkinlikler.map((e) => ({ ...e, tarih: tarihMetni(e.tarih) })) : [],
      taslak: !!v.taslak,
    },
  };
}

export function yaziMetni(v: YaziVeri, govde: string): string {
  return birlestir({
    baslik: v.baslik, sayi: v.sayi, sira: v.sira, konu: v.konu, yazar: v.yazar, spot: v.spot,
    gorsel: v.gorsel, gorselAlt: v.gorselAlt, gorselKaynak: v.gorselKaynak, neden: v.neden,
    kisaca: v.kisaca, podcast: v.podcast, taslak: v.taslak,
  }, govde);
}

export function sayiMetni(v: SayiVeri, govde: string): string {
  return birlestir({
    sayi: v.sayi, baslik: v.baslik, yayin: v.yayin, baslangic: v.baslangic, bitis: v.bitis, imza: v.imza,
    kisaKisa: v.kisaKisa, oneriler: v.oneriler, etkinlikler: v.etkinlikler, taslak: v.taslak,
  }, govde);
}

// ------------------------------------------------------------------ denetim

const URL_GECERLI = (s: string) => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
const TARIH = /^\d{4}-\d{2}-\d{2}$/;

export function yaziDenetle(v: YaziVeri, govde: string): string[] {
  const h: string[] = [];
  if (!v.baslik.trim()) h.push('Başlık boş.');
  if (!(v.sayi > 0)) h.push('Sayı seçilmedi.');
  if (!(v.sira >= 1 && v.sira <= 9)) h.push('Sıra 1 ile 9 arasında olmalı.');
  if (!KONULAR[v.konu]) h.push('Konu seçilmedi.');
  if (!v.yazar.trim()) h.push('Yazar seçilmedi.');
  if (!v.spot.trim()) h.push('Spot boş.');
  if (!v.gorsel.trim()) h.push('Görsel yok.');
  if (!v.neden.trim()) h.push('"Neden önemli?" boş.');
  const kisaca = v.kisaca.filter((k) => k.trim());
  if (kisaca.length < 1 || kisaca.length > 4) h.push('"Kısaca" 1 ile 4 madde arasında olmalı.');
  if (!govde.trim()) h.push('Yazının metni boş.');
  return h;
}

export function sayiDenetle(v: SayiVeri): string[] {
  const h: string[] = [];
  if (!(v.sayi > 0)) h.push('Sayı numarası geçersiz.');
  if (!v.baslik.trim()) h.push('Haftanın cümlesi boş.');
  for (const [ad, t] of [['Yayın', v.yayin], ['Başlangıç', v.baslangic], ['Bitiş', v.bitis]] as const) {
    if (!TARIH.test(t)) h.push(`${ad} tarihi eksik.`);
  }
  if (!v.imza.trim()) h.push('İmza seçilmedi.');
  const kk = v.kisaKisa.filter((k) => k.metin.trim());
  if (kk.length < 3 || kk.length > 5) h.push('"Kısa kısa" 3 ile 5 madde arasında olmalı.');
  if (kk.some((k) => !KONULAR[k.konu])) h.push('"Kısa kısa" maddelerinin hepsinde konu seçili olmalı.');
  for (const [k, ad] of FIILLER) {
    const o = v.oneriler?.[k];
    if (!o) continue;
    if (!o.baslik.trim() || !o.kimden.trim() || !o.tur.trim() || !o.not.trim()) h.push(`"${ad}" önerisinde başlık, kimden, tür ve not dolu olmalı.`);
    if (o.not.length > 200) h.push(`"${ad}" önerisinin notu en fazla 200 karakter olabilir.`);
    if (o.link && !URL_GECERLI(o.link)) h.push(`"${ad}" önerisinin bağlantısı geçerli bir adres değil.`);
  }
  const ev = v.etkinlikler ?? [];
  if (ev.length > 6) h.push('En fazla 6 etkinlik olabilir.');
  ev.forEach((e, i) => {
    if (!TARIH.test(e.tarih) || !e.ad.trim() || !e.tur.trim() || !e.yer.trim() || !e.sehir.trim() || !e.ucret.trim()) {
      h.push(`${i + 1}. etkinlikte tarih, ad, tür, yer, şehir ve ücret dolu olmalı.`);
    }
    if (e.saat && !/^\d{2}:\d{2}$/.test(e.saat)) h.push(`${i + 1}. etkinliğin saati SS:DD biçiminde olmalı.`);
    if (e.link && !URL_GECERLI(e.link)) h.push(`${i + 1}. etkinliğin bağlantısı geçerli bir adres değil.`);
  });
  return h;
}

// ------------------------------------------------------------------ küçük yardımcılar

export function adres(baslik: string): string {
  const harf: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  return baslik.toLocaleLowerCase('tr')
    .replace(/[çğıiöşüâîû]/g, (c) => harf[c] ?? c)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60).replace(/-+$/, '');
}

export function kisaltma(ad: string): string {
  return ad.trim().split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toLocaleUpperCase('tr');
}

// Git'in dosya kimliği (blob sha). Kaydettikten sonra dosyanın yeni sürümünü bilmek için.
export async function blobSha(metin: string): Promise<string> {
  const icerik = new TextEncoder().encode(metin);
  const bas = new TextEncoder().encode(`blob ${icerik.length}\0`);
  const tum = new Uint8Array(bas.length + icerik.length);
  tum.set(bas);
  tum.set(icerik, bas.length);
  const h = await crypto.subtle.digest('SHA-1', tum);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function gunEkle(tarih: string, gun: number): string {
  const d = new Date(`${tarih}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

export function sonrakiPazartesi(): string {
  const d = new Date();
  const fark = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + fark);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
