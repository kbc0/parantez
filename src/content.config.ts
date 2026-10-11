import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { KONULAR } from './lib/konular';

const konuKeys = Object.keys(KONULAR) as [string, ...string[]];

// "Parantez dışı": haftanın albümü, filmi/dizisi ve okuması.
const oneri = z.object({
  baslik: z.string(),
  kimden: z.string(), // sanatçı, yönetmen, yazar
  tur: z.string(), // ör. "Albüm · 2018"
  not: z.string().max(200), // bizim tek cümlemiz
  link: z.url().optional(),
  linkMetni: z.string().optional(),
});

const etkinlik = z.object({
  tarih: z.coerce.date(),
  saat: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  ad: z.string(),
  tur: z.string(), // konser, söyleşi, sergi…
  yer: z.string(),
  sehir: z.string(), // "Kadıköy, İstanbul" ya da "Çevrim içi"
  ucret: z.string(), // "Ücretsiz", "250 TL"
  link: z.url().optional(),
});

// Haftalık sayı: gövdesi (markdown) yayın yönetmeninin kısa notu.
const sayilar = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/sayilar' }),
  schema: z.object({
    sayi: z.number().int().positive(),
    baslik: z.string(),
    yayin: z.coerce.date(),
    baslangic: z.coerce.date(),
    bitis: z.coerce.date(),
    imza: z.string(),
    kisaKisa: z.array(z.object({ konu: z.enum(konuKeys), metin: z.string() })).min(3).max(5),
    oneriler: z.object({ dinle: oneri, izle: oneri, oku: oneri }).partial().optional(),
    etkinlikler: z.array(etkinlik).max(6).optional(),
    taslak: z.boolean().default(false),
  }),
});

// Yazı: her sayıda 5 tane, `sira` ile dizilir.
const yazilar = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/yazilar' }),
  schema: z.object({
    baslik: z.string(),
    sayi: z.number().int().positive(),
    sira: z.number().int().min(1).max(9),
    konu: z.enum(konuKeys),
    yazar: z.string(),
    spot: z.string(),
    gorsel: z.string(), // tam adres ya da panelden yüklenen /gorseller/… dosyası
    gorselAlt: z.string().default(''),
    gorselKaynak: z.string().default(''),
    neden: z.string(),
    kisaca: z.array(z.string()).min(1).max(4),
    podcast: z.string().optional(),
    taslak: z.boolean().default(false),
  }),
});

// Araştırma: ayda bir yayımlanan rapor, politika notu ya da veri notu. Gövdesi (markdown) yayının kendisi;
// ```grafik blokları çubuk grafik, [^1] dipnot olur.
const arastirmalar = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/arastirmalar' }),
  schema: z.object({
    no: z.number().int().positive(), // "No. 01"
    tur: z.enum(['rapor', 'politika-notu', 'veri-notu']).default('rapor'), // yayın türü
    baslik: z.string(),
    yayin: z.coerce.date(),
    ozet: z.string(), // başlığın altındaki birkaç cümle
    yazarlar: z.array(z.string()).min(1).max(6),
    konu: z.enum(konuKeys),
    bulgular: z.array(z.object({ rakam: z.string().optional(), metin: z.string() })).min(1).max(5),
    kunye: z.array(z.object({ ad: z.string(), deger: z.string() })).max(6).default([]), // ör. Örneklem: 1.240 kişi
    yontem: z.string(), // raporun sonundaki "Yöntem" notu
    gorsel: z.string().default(''),
    gorselAlt: z.string().default(''),
    gorselKaynak: z.string().default(''),
    pdf: z.url().optional(),
    taslak: z.boolean().default(false),
  }),
});

export const collections = { sayilar, yazilar, arastirmalar };
