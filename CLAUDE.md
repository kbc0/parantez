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
- **Araştırma (`/arastirma/`) sade ve renksizdir; makale gibi okunur.** Site sahibi kalabalık istemiyor.
  - İskeleti `src/layouts/Arastirma.astro` (Sayfa.astro üstüne), stili `src/styles/arastirma.css`. Üst menü ana sayfanınkinin
    aynısıdır (logo; Arşiv · Araştırma · Hakkında; Arşiv aynı çekmeceyi açar). Sohbet listesi, bar, balon,
    tepki ve renk yok. Mürekkep, beyaz, griler.
  - Liste sayfası yalnızca başlık ve yayınlar (No. ve başlık). Tanıtım metni, süzgeç, özet yok.
  - Yazı sayfası: No., başlık, yazarlar ve tarih; sonra metin. Künye, bulgu kutusu, içindekiler, atıf gibi
    ayrı parçalar eklenmez; gereken her şey metnin içinde (ara başlık, tablo, grafik, dipnot).
  - Görseller gri tonlu.
- **Hakkında (`/hakkinda/`) sohbet gibi konuşur ama sohbet düzeninde değildir.** Üst menü ana sayfanınki;
  sol liste, üst bar ve mesaj kutusu yok. Balonlar ve tepkiler aynen kalır; e-posta en altta mesajla alınır.
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

- İçerik: `src/content/sayilar/*.md`, `src/content/yazilar/*.md`, `src/content/arastirmalar/*.md` (şema `src/content.config.ts`).
- Markdown: Astro'nun Sätteri işlemcisi (`astro.config.mjs`).
  - ` ```grafik ` blokları çubuk grafiğe dönüşür (`src/lib/grafik.js`; panel önizlemesi de bunu kullanır).
  - `[^1]` dipnotları "Kaynaklar ve notlar" başlığıyla sonda toplanır.
- Sayfalar: `src/pages/`. Ortak iskelet: `src/layouts/App.astro` (araştırma hariç). `<head>` etiketleri `src/components/Bas.astro`.
  - Ana sayfanın üst menüsü `src/components/AnaUst.astro`, Arşiv çekmecesi `src/components/Arsiv.astro`.
    Ana sayfa ve sade sayfalar (`src/layouts/Sayfa.astro`: araştırma, hakkında) ikisini de kullanır;
    üst menü değişirse hepsinde değişir.
  - `.on` sınıfı basılı tepki ve seçili öğeler içindir; tek başına stil vermeyin (öneri kartı `.onr`).
  - `okuma` prop'u yazı düzenini açar.
  - `ana` prop'u ana sayfa düzenini açar.
- Betikler (`src/scripts/`):
  - `ortak.ts`: her sayfa; geri düğmesi, sayfa içi abonelik, paylaş.
  - `sohbet.ts`: sohbet sayfaları.
  - `okuma.ts`: yazı sayfası.
- Yazı paneli: `/admin` (bkz. `PANEL.md`).
  - Arayüz `src/pages/admin/index.astro`, `src/scripts/panel.ts`, `src/scripts/panel-icerik.ts`.
  - Sunucu `worker/panel.js`, `worker/inceleme.js` ve `worker/github.js`.
  - Akran incelemesi: yeni sayı, yazı ve araştırmalar (ve silmeler) öneri olarak D1'de bekler.
    Yazandan başka bir ekip üyesi onaylayınca GitHub'a commit edilir. Hesaplar da D1'de.
  - Yayındaki bir içeriğin küçük düzeltmesi "Doğrudan yayınla" ile incelemesiz commit edilir (`/api/panel/kaydet`).
  - Ekip listesi `src/data/ekip.json`, görseller `public/gorseller/` altında.
  - İçerik şeması değişirse `panel-icerik.ts`'teki denetim de güncellenmeli.
  - Önizleme `src/scripts/panel-onizleme.ts`: yazı sayfası, araştırma yayını, sohbet ve üst barın kopyası.
    Panel sayfası önizleme için `arastirma.css`'i de yükler.
    Bu şablonlar değişirse önizleme de güncellenmeli.
- Bülten e-postası (Resend): `worker/bulten.js` şablonu sayının sohbet hâlinin e-posta karşılığıdır;
  `IssueChat.astro` değişirse o da gözden geçirilmeli. Gönderim `worker/gonderim.js` (her dakika çalışan zamanlayıcı;
  panelde **Bülten**), e-posta istemcisi `worker/eposta.js`.
- Worker: `worker/index.js`.
  - `/api/abone/*`: çift onaylı abonelik ve tek tıkla çıkış (`worker/abonelik.js`; D1 `aboneler`).
    Sayfaları `/abone/son-adim/`, `/abone/tamam/`, `/abone/cik/`, `/abone/ayrildin/`, `/abone/gecersiz/`. KV `ABONELER` yalnızca eski kayıtlar için.
  - `/api/tepki`: tepkiler; D1 `parantez-tepkiler`. Yeni bir sayfa türü tepki alacaksa `SAYFA` kalıbına eklenmeli.
- Her şey JavaScript olmadan da çalışmalı. Formlar doğrudan `/api/abone`'ye gider; çıkış formu `/api/abone/cik`'e.
- Yerelde deneme: `npx wrangler dev`. Derlemeyi kendisi yapar.
