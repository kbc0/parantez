# (parantez)

Genç okurlar için haftalık bülten. Her pazartesi 07:30: haftanın özeti + 5 yazı. Gündem uzun, biz kısaltıyoruz. Bazen de uzatıyoruz.

Astro ile üretilen statik bir site; Cloudflare Workers üzerinde yayınlanır. Abonelik formu bir Worker fonksiyonuna (`/api/abone`) gider ve e-postaları Cloudflare KV'de saklar.

## Sayfalar

| Adres | Ne var |
| --- | --- |
| `/` | Güncel sayı: haftanın özeti (editör notu, bu sayıda, ne oldu?) ve 5 yazı |
| `/sayi/<no>/` | Geçmiş bir sayı (aynı düzen, soluk görseller) |
| `/yazi/<slug>/` | Yazı sayfası: yalnızca yazının kendisi |
| `/arsiv/` | Bütün sayılar ve konular |
| `/konu/<konu>/` | Bir konudaki bütün yazılar |
| `/hakkinda/`, `/abone/` | Sabit sayfalar |
| `/rss.xml`, `/sitemap-index.xml` | Akış ve site haritası |

## Yeni sayı yayınlamak

1. `src/content/sayilar/` içine yeni bir dosya ekle (ör. `04.md`). Var olan bir sayıyı kopyalayıp düzenlemek en kolayı:
   - `sayi`, `baslik`, `yayin` (pazartesi), `baslangic` / `bitis` (haftanın aralığı), `imza`
   - `kisaKisa`: 3–5 kısa haber (`konu` + `metin`), ana sayfada "Ne oldu?" şeridi
   - Dosyanın gövdesi: yayın yönetmeninin kısa notu (markdown)
2. `src/content/yazilar/` içine 5 yazı ekle. Dosya adı adresi belirler (`faiz-sabit.md` → `/yazi/faiz-sabit/`).
   - `sayi`: hangi sayıya ait, `sira`: 1–5
   - `konu`: `ekonomi`, `sehir`, `teknoloji`, `dunya`, `iklim`, `egitim`, `kultur`, `spor` (liste: `src/lib/konular.ts`)
   - `spot`, `neden` (neden önemli?), `kisaca` (1–4 madde), `gorsel`, `gorselAlt`, `gorselKaynak`
   - Gövde: markdown, ara başlıklar `##` ile
3. `main`'e push'la. Cloudflare siteyi kendisi derleyip yayınlar. En yüksek numaralı sayı otomatik olarak ana sayfaya geçer.

Hazır olmayan bir sayı ya da yazı için `taslak: true` yaz; sitede görünmez.

Okuma süreleri metinden otomatik hesaplanır. Alanlar eksik ya da hatalıysa derleme hata verir ve neyin yanlış olduğunu söyler.

## Geliştirme

```bash
npm install
npm run dev       # http://localhost:4321 — hızlı önizleme (abonelik formu çalışmaz)
npm run preview   # derler ve Cloudflare ortamında çalıştırır: http://localhost:8787 (form dahil)
npm run check     # tip ve içerik kontrolü
```

Node 22.12+ gerekir.

## Yayın (Cloudflare Workers)

Repo Cloudflare'e bağlı; `main`'e her push otomatik deploy olur.

- Deploy komutu: `npx wrangler deploy` (önce `npm run build`'i kendisi çalıştırır, `wrangler.jsonc` içinde `build.command`)
- Abone listesi: `ABONELER` adlı KV deposu. İlk deploy'da Cloudflare otomatik oluşturur. Kayıtları Cloudflare panelinde **Storage & Databases → KV** altında görebilirsin; her anahtar bir e-posta adresi.
- Kendi alan adını bağlayınca `astro.config.mjs` içindeki `SITE` adresini (ya da `SITE_URL` ortam değişkenini) güncelle; RSS, site haritası ve paylaşım önizlemeleri bunu kullanır.

## Dosyalar

```
src/content/        içerik (sayılar + yazılar, markdown)
src/content.config.ts  içerik şeması
src/pages/          sayfalar
src/components/     kart, bölüm başlığı, abonelik formu, sayı görünümü
src/layouts/        ortak şablon (header, içindekiler, footer)
src/styles/         tasarım (tek CSS dosyası)
worker/index.js     /api/abone
public/             favicon, paylaşım görseli
```

Not: Bu bir konsept çalışma. İçerikler örnek, görseller (picsum.photos) geçicidir.
