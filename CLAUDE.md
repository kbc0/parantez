# (parantez)

Gençler için haftalık bülten. Her pazartesi 07:30: haftanın özeti ve beş yazı.
Astro (statik) + Cloudflare Workers. `main`'e push edilen her commit Workers Builds ile yayına çıkar.

## Tasarım yönü

Site sahibi bu çizgiyi çok seviyor; yeni işler bu çizgide kalsın:
**mesajlaşma + haber hibriti.** Ne yoracak kadar mesaj, ne de çok ciddi bir haber sitesi.

- **Sayı sayfaları sohbettir.** Balonlar, hazır cevaplar (chip), "yazıyor…", sadece hazır emojilerle tepki.
  E-posta da mesaj yoluyla alınır.
- **Yazı sayfaları balonsuz okunur.** Tek sütun, rahat satır aralığı. Sohbetle bağ küçük dokunuşlarla kurulur:
  - aynı üst bar ve yazarın avatarı;
  - (parantez)'in "kısaca" ve "neden önemli?" not balonları;
  - sonda tek tepki satırı, sıradaki yazı ve sayfa içi abonelik.
- **Masaüstü ana sayfa tek ekranlık bir kapaktır ve kaymaz.**
  - Editörün selam balonu, dev başlık, özet, chip düğmeler ve numaralı beş yazı.
  - Logo sol üstte durur. Sağ üstte tek "Arşiv" düğmesi var; tüm sayılar ve konular sağdan açılan çekmecede.
  - "Abone ol" yerinde açılır.
- **Mobil ana sayfa sohbet listesidir.**
- **Geri düğmesi** okuru geldiği yere götürür. Sohbete dönen okur kaldığı yerden devam eder.

Kaçınılacaklar:
- büyük siyah yuvarlaklar ve küçük siyah numara yuvarlakları;
- bildirim gibi görünen sayaç rozetleri (ör. menüde mavi "3");
- aynı yeri açan birden fazla düğme;
- ekran kenarlarında gri boşluklar;
- kalabalık sayfa sonları;
- karanlık mod;
- klasik haber sitesi görünümü ve "AI slop".

Renkler (`src/styles/global.css` :root):
- mürekkep #111, kâğıt #fff;
- mesaj mavisi #2A35FF (okurun mesajları, chip'ler, bağlantılar);
- domates #FF4A24;
- pembe #FFBFDC ("neden önemli?");
- fosfor #D2FF2E;
- balon #F1F1ED.

Yazı tipi: Hanken Grotesk.

## Kod

- İçerik: `src/content/sayilar/*.md`, `src/content/yazilar/*.md` (şema `src/content.config.ts`).
- Sayfalar: `src/pages/`. Ortak iskelet: `src/layouts/App.astro`.
  - `okuma` prop'u yazı düzenini açar.
  - `ana` prop'u ana sayfa düzenini açar.
- Betikler (`src/scripts/`):
  - `ortak.ts`: her sayfa; geri düğmesi, sayfa içi abonelik, paylaş.
  - `sohbet.ts`: sohbet sayfaları.
  - `okuma.ts`: yazı sayfası.
- Yazı paneli: `/admin` (bkz. `PANEL.md`).
  - Arayüz `src/pages/admin/index.astro`, `src/scripts/panel.ts`, `src/scripts/panel-icerik.ts`.
  - Sunucu `worker/panel.js` ve `worker/github.js`.
  - İçerik GitHub'a commit edilir. Hesaplar D1'de tutulur.
  - Ekip listesi `src/data/ekip.json`, görseller `public/gorseller/` altında.
  - İçerik şeması değişirse `panel-icerik.ts`'teki denetim de güncellenmeli.
- Worker: `worker/index.js`.
  - `/api/abone`: abonelik; KV `ABONELER`.
  - `/api/tepki`: tepkiler; D1 `parantez-tepkiler`.
- Her şey JavaScript olmadan da çalışmalı. Formlar doğrudan `/api/abone`'ye gider.
- Yerelde deneme: `npx wrangler dev`. Derlemeyi kendisi yapar.
