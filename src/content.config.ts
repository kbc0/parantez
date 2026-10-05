import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { KONULAR } from './lib/konular';

const konuKeys = Object.keys(KONULAR) as [string, ...string[]];

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
    rakam: z.object({ deger: z.string(), aciklama: z.string() }),
    kisaKisa: z.array(z.object({ konu: z.enum(konuKeys), metin: z.string() })).min(1).max(8),
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
    gorsel: z.string(),
    gorselAlt: z.string().default(''),
    gorselKaynak: z.string().default('Fotoğraf: Picsum (geçici görsel)'),
    neden: z.string(),
    kisaca: z.array(z.string()).min(1).max(4),
    podcast: z.string().optional(),
    taslak: z.boolean().default(false),
  }),
});

export const collections = { sayilar, yazilar };
