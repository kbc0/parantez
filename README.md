# (parantez)

Genç okurlar için haftalık bülten. Her pazartesi 07:30: haftanın özeti + 5 yazı. Gündem uzun, biz kısaltıyoruz. Bazen de uzatıyoruz.

Site bir mesajlaşma uygulaması gibi çalışır: her sayı bir sohbet, her yazı bir konuşma. Okur hazır cevaplarla ("Ne oldu?", "Yazılar", "Bu hafta ne yapsam?", "Abone ol") ilerler, mesajlara sabit emojilerle tepki bırakır ve e-postasını mesaj kutusuna yazarak abone olur. Yazılarda "Aa" düğmesi balonları kapatıp düz okuma moduna geçer.

Astro ile üretilen statik sayfalar + Cloudflare Worker:
- `/api/abone` — e-posta aboneliği, Cloudflare KV'de (`ABONELER`)
- `/api/tepki` — mesaj tepkileri, Cloudflare D1'de (`parantez-tepkiler`). İzinli emojiler: ❤️ 😂 😮 😢 🔥

Sayfalar JavaScript olmadan da okunur ve abonelik formu yine çalışır.

Önceki (klasik editoryal) tasarım `klasik-tasarim` branch'inde duruyor.

## Sayfalar

| Adres | Ne var |
| --- | --- |
| `/` | Ana sayfa: sohbet listesi. Bütün sayılar (en yenisi üstte), konular, abone ol, hakkında |
| `/sayi/<no>/` | Bir sayının sohbeti: editörün notu, ardından hazır cevaplarla açılan dallar (ne oldu, yazılar, parantez dışı, abone) |
| `/yazi/<slug>/` | Yazı: her paragraf bir mesaj, `##` ara başlıklar ayraç; düz okuma modu var |
| `/konu/<konu>/` | Bir konudaki bütün yazılar |
| `/hakkinda/`, `/abone/` | Sabit sayfalar |
| `/rss.xml`, `/sitemap-index.xml` | Akış ve site haritası |

## Yeni sayı yayınlamak

1. `src/content/sayilar/` içine yeni bir dosya ekle (ör. `04.md`). Var olan bir sayıyı kopyalayıp düzenlemek en kolayı:
   - `sayi`, `baslik`, `yayin` (pazartesi), `baslangic` / `bitis` (haftanın aralığı), `imza`
   - `kisaKisa`: 3–5 kısa haber (`konu` + `metin`), sohbette "Ne oldu?" mesajları
   - `oneriler` (isteğe bağlı, "Parantez dışı"): `dinle`, `izle`, `oku`; her biri `baslik`, `kimden`, `tur`, `not` (en fazla 200 karakter), isteğe bağlı `link` + `linkMetni`
   - `etkinlikler` (isteğe bağlı, en fazla 6): `tarih`, `saat` (ör. "20:00"), `ad`, `tur`, `yer`, `sehir`, `ucret` ("Ücretsiz" yazılırsa işaretlenir), isteğe bağlı `link`. Tarihe göre kendiliğinden sıralanır.
   - Dosyanın gövdesi: yayın yönetmeninin kısa notu (markdown)
2. `src/content/yazilar/` içine 5 yazı ekle. Yazar adı sohbette avatar olur; ekip `src/lib/site.ts` içindeki `KISILER` listesinde. Dosya adı adresi belirler (`faiz-sabit.md` → `/yazi/faiz-sabit/`).
   - `sayi`: hangi sayıya ait, `sira`: 1–5
   - `konu`: `ekonomi`, `sehir`, `teknoloji`, `dunya`, `iklim`, `egitim`, `kultur`, `spor` (liste: `src/lib/konular.ts`)
   - `spot`, `neden` (neden önemli?), `kisaca` (1–4 madde), `gorsel`, `gorselAlt`, `gorselKaynak`
   - Gövde: markdown, ara başlıklar `##` ile
3. `main`'e push'la. Cloudflare siteyi kendisi derleyip yayınlar. En yüksek numaralı sayı ana sayfadaki listenin en üstüne "yeni" etiketiyle çıkar.

Hazır olmayan bir sayı ya da yazı için `taslak: true` yaz; sitede görünmez.

Okuma süreleri metinden otomatik hesaplanır. Alanlar eksik ya da hatalıysa derleme hata verir ve neyin yanlış olduğunu söyler.

## Geliştirme

```bash
npm install
npm run dev       # http://localhost:4321 — hızlı önizleme (abonelik ve tepkiler çalışmaz)
npm run preview   # derler ve Cloudflare ortamında çalıştırır: http://localhost:8787 (abonelik ve tepkiler dahil)
npm run check     # tip ve içerik kontrolü
```

Node 22.12+ gerekir.

## Yayın (Cloudflare Workers)

Repo Cloudflare'e bağlı; `main`'e her push otomatik deploy olur.

- Deploy komutu: `npx wrangler deploy` (önce `npm run build`'i kendisi çalıştırır, `wrangler.jsonc` içinde `build.command`)
- Abone listesi: `ABONELER` adlı KV deposu. İlk deploy'da Cloudflare otomatik oluşturur. Kayıtları Cloudflare panelinde **Storage & Databases → KV** altında görebilirsin; her anahtar bir e-posta adresi.
- Tepkiler: `parantez-tepkiler` adlı D1 veritabanı. İlk deploy'da Cloudflare otomatik oluşturur, tablo ilk istekte kurulur. Bir IP dakikada en fazla 40 tepki verebilir.
- Kendi alan adını bağlayınca `astro.config.mjs` içindeki `SITE` adresini (ya da `SITE_URL` ortam değişkenini) güncelle; RSS, site haritası ve paylaşım önizlemeleri bunu kullanır.

## Dosyalar

```
src/content/        içerik (sayılar + yazılar, markdown)
src/content.config.ts  içerik şeması
src/pages/          sayfalar
src/components/     sohbet parçaları: avatar, mesaj grubu, link kartı, mesaj kutusu, sayı sohbeti
src/layouts/App.astro  uygulama iskeleti (sohbet listesi, üst bar, mesaj kutusu)
src/lib/chips.ts    hazır cevaplar
src/scripts/sohbet.ts  sohbet davranışları (dallar, yazıyor…, tepkiler, abonelik, düz okuma)
src/styles/         tasarım (tek CSS dosyası, mobil öncelikli)
worker/index.js     /api/abone ve /api/tepki
public/             favicon, paylaşım görseli
```

Not: Bu bir konsept çalışma. İçerikler örnek, görseller (picsum.photos) geçicidir.
