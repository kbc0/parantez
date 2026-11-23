# (parantez)

Haftalık bülten. Her pazar 09:00: haftanın özeti ve beş yazı.
Astro (statik) + Cloudflare Workers. `main`'e push edilen her commit Workers Builds ile yayına çıkar.

## Tasarım yönü

Site sahibi bu çizgiyi çok seviyor; yeni işler bu çizgide kalsın:
**mesajlaşma + haber hibriti.** Ne yoracak kadar mesaj, ne de çok ciddi bir haber sitesi.

- **Sohbet yok; her sayı bir kapaktır.** Site sahibi sohbeti kaldırdı, arayüz sade kalsın.
  Mesajlaşma havası küçük dokunuşlarla sürer: editörün selam balonu, (parantez)'in not balonları, Hakkında.
- **Yazı sayfaları balonsuz okunur.** Tek sütun, rahat satır aralığı. Üstte sitenin ortak menüsü (`Sayfa.astro`),
  ekranın en üstünde ince bir okuma ilerlemesi çizgisi. Sitenin geri kalanıyla bağ küçük dokunuşlarla kurulur:
  - yazarın avatarı; başlığın üstündeki "Sayı 01 · 2/5" sayıya götürür;
  - (parantez)'in "kısaca" ve "neden önemli?" not balonları;
  - sonda tek tepki satırı, paylaş (telefonda paylaşma menüsü, bilgisayarda bağlantıyı kopyalar), sıradaki yazı
    ve sayfa içi abonelik.
- **Ana sayfa bu haftanın kapağıdır** (`src/components/SayiKapak.astro`). Masaüstünde tek ekranlıktır ve kaymaz;
  telefonda aynı kapak alt alta dizilir.
  - Solda editörün selam balonu, dev başlık, özet (editörün notunun ilk paragrafı) ve "Abone ol".
  - Sağda sekmeler: Yazılar (numaralı beş yazı), Ne oldu? (kısa kısa; solda konunun renginde şerit) ve Haftalık seçki
    (dinle/izle/oku ve gidilecek yerler). Seçki sekmesinde dışarı bağlantı yok; sondaki "Seçkiyi incele →" tam sayfaya
    (`/sayi/<no>/secki/`) götürür, bağlantılar orada. Seçki sayfası da masaüstünde tek ekrana sığar.
    Sekmeler radyo düğmeleriyle; JS gerekmez.
  - Eski sayılar (`/sayi/<no>/`) aynı kapakla açılır; tarihte "arşiv" yazar. Bu haftanın sayısı ana sayfadır:
    bağlantılar `/`'e gider, `/sayi/<no>/` sayfasının asıl adresi (canonical) `/`'dir.
  - Sayfalara "Bu haftanın sayısı", "Arşiv" gibi tekrar eden düğmeler konmaz; her şeye üst menüden gidilir.
  - Logo sol üstte durur. Sağ üstte tek düğme var: masaüstünde "Arşiv", telefonda "Menü".
    Tüm sayılar, konular, Araştırma, Abone ol ve Hakkında bu çekmecede (masaüstünde sağdan, telefonda tam ekran).
    `/#liste` çekmeceyi açık getirir.
  - "Abone ol" yerinde açılır.
- **Araştırma (`/arastirma/`) sade ve renksizdir; makale gibi okunur.** Site sahibi kalabalık istemiyor.
  - İskeleti `src/layouts/Arastirma.astro` (Sayfa.astro üstüne), stili `src/styles/arastirma.css`. Üst menü ana sayfanınkinin
    aynısıdır (logo; Araştırma · Hakkında · Arşiv, Arşiv en sağda ve aynı çekmeceyi açar; telefonda logo ve tek "Menü" düğmesi). Sohbet listesi, bar, balon,
    tepki ve renk yok. Mürekkep, beyaz, griler.
  - Liste sayfası yalnızca başlık ve yayınlar (No. ve başlık). Tanıtım metni, süzgeç, özet yok.
  - Yazı sayfası: No., başlık, yazarlar ve tarih; sonra metin. Künye, bulgu kutusu, içindekiler, atıf gibi
    ayrı parçalar eklenmez; gereken her şey metnin içinde (ara başlık, tablo, grafik, dipnot).
  - Görseller gri tonlu.
- **Sade sayfalar** (`src/layouts/Sayfa.astro`): yazılar, Hakkında, Araştırma, konu (`/konu/<konu>/`), abonelik sayfaları,
  seçki ve 404.
  Üst menü ana sayfanınki; sol liste, üst bar ve mesaj kutusu yok.
  - Hakkında ve abonelik sayfaları (parantez)'in balonlarıyla konuşur; e-posta balonların altındaki kutuyla alınır.
    Hakkında'da tepkiler kalır.
  - Konu sayfası: büyük "#konu" başlığı ve yazıların listesi (başlık, spot, sayı, süre, yazar).
- **Üst menü her sayfada aynıdır** (`AnaUst.astro`); sohbet barı kalmadı. Sayfa geçişlerinde üst menü yerinde durur,
  yalnızca içerik değişir (`view-transition-name: ust`). Bu haftanın sayısına giden bağlantılar ana sayfaya gider.

Kaçınılacaklar:
- büyük siyah yuvarlaklar ve küçük siyah numara yuvarlakları;
- bildirim gibi görünen sayaç rozetleri (ör. menüde mavi "3");
- aynı yeri açan birden fazla düğme;
- ekran kenarlarında gri boşluklar;
- kalabalık sayfa sonları;
- karanlık mod;
- klasik haber sitesi görünümü ve "AI slop";
- "gençler için" diye tanıtmak (ekip genç ama yalnızca gençlere yazmıyor).

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
  - Yazının sayısı ve sırası yazının değil sayının dosyasındadır (`yazilar` listesi; `src/lib/yerlesim.ts`).
    Listede olmayan yazı havuzda bekler, sitede görünmez. Site `lib/site.ts`'te, panel ve bülten aynı yardımcıyla hesaplar.
- Markdown: Astro'nun Sätteri işlemcisi (`astro.config.mjs`).
  - ` ```grafik ` blokları çubuk grafiğe dönüşür (`src/lib/grafik.js`; panel önizlemesi de bunu kullanır).
  - `[^1]` dipnotları "Kaynaklar ve notlar" başlığıyla sonda toplanır.
- Sayfalar: `src/pages/`. İskeletler: ana sayfa ve sayı kapakları `src/layouts/App.astro` (`ana` prop'u),
  geri kalan her şey `src/layouts/Sayfa.astro`. `<head>` etiketleri `src/components/Bas.astro`.
  - Üst menü `src/components/AnaUst.astro`, Arşiv çekmecesi `src/components/Arsiv.astro`; ikisi her sayfada aynı,
    üst menü değişirse hepsinde değişir.
  - `.on` sınıfı basılı tepki ve seçili öğeler içindir; tek başına stil vermeyin.
- Betikler (`src/scripts/`):
  - `ortak.ts`: her sayfa; sayfa içi abonelik, paylaş.
  - `sohbet.ts`: balonlu sayfalar (Hakkında, kapak): tepkiler ve yerinde abonelik.
  - `okuma.ts`: yazı sayfası; okuma ilerlemesi, okundu işareti ve tepkiler.
- Yazı paneli: `/admin` (bkz. `PANEL.md`).
  - Arayüz `src/pages/admin/index.astro`, `src/scripts/panel.ts`, `src/scripts/panel-icerik.ts`.
  - Sunucu `worker/panel.js`, `worker/inceleme.js` ve `worker/github.js`.
  - Akran incelemesi: yeni sayı, yazı ve araştırmalar (ve silmeler) öneri olarak D1'de bekler.
    Yazandan başka bir ekip üyesi onaylayınca GitHub'a commit edilir. Hesaplar da D1'de.
  - Yayındaki bir içeriğin küçük düzeltmesi "Doğrudan yayınla" ile incelemesiz commit edilir (`/api/panel/kaydet`).
  - Ekip listesi `src/data/ekip.json`, görseller `public/gorseller/` altında.
  - İçerik şeması değişirse `panel-icerik.ts`'teki denetim de güncellenmeli.
  - Önizleme `src/scripts/panel-onizleme.ts`: yazı sayfası, araştırma yayını, sayının kapağı (`SayiKapak.astro`) ve üst barın kopyası.
    Panel sayfası önizleme için `arastirma.css`'i de yükler.
    Bu şablonlar değişirse önizleme de güncellenmeli.
- Bülten e-postası (Resend): `worker/bulten.js` şablonu sayının e-postadaki hâlidir (selam, not, kısa kısa, yazılar,
  seçki); kapakta sayıya yeni bir parça eklenirse e-posta da gözden geçirilmeli. Gönderim `worker/gonderim.js` (her dakika çalışan zamanlayıcı;
  panelde **Bülten**), e-posta istemcisi `worker/eposta.js`. Sayı onaylanınca gönderimi yayın günü 09:00'a kendiliğinden
  planlanır (`sayiyiPlanla`; `inceleme.js` ve `panel.js` kaydet çağırır).
- Arama motorları: `Bas.astro` açıklama, paylaşım kartı, ikonlar ve `meta.ld` ile yapısal veri (`src/lib/yapisal.ts`:
  ana sayfada WebSite + Organization, yazıda NewsArticle, araştırmada Article). `public/robots.txt` site haritasını gösterir.
- Worker: `worker/index.js`.
  - `/api/abone/*`: çift onaylı abonelik ve tek tıkla çıkış (`worker/abonelik.js`; D1 `aboneler`).
    Sayfaları `/abone/son-adim/`, `/abone/tamam/`, `/abone/cik/`, `/abone/ayrildin/`, `/abone/gecersiz/`. KV `ABONELER` yalnızca eski kayıtlar için.
    Panelde abone listesi (arama, çıkarma, engelleme, silme, CSV) yalnızca yöneticiye açık (`/api/panel/aboneler/*`).
  - `/api/tepki`: tepkiler; D1 `parantez-tepkiler`. Yeni bir sayfa türü tepki alacaksa `SAYFA` kalıbına eklenmeli.
  - Tepki alan sayfalar (`/yazi/*`, `/hakkinda/`) önce Worker'dan geçer: sayılar HTML'e baştan yazılır
    (`tepkiliSayfa`, HTMLRewriter), sayfa sonradan kaymaz. Yeni tepkili sayfa türü `TEPKILI` ve `run_worker_first`'e de eklenmeli.
- Hız: `public/_headers` `/_astro/*` dosyalarını bir yıl önbellekte tutar (adları içerik özetli). Yazı tipi
  `Bas.astro`'da önceden istenir; bağlantıya yönelince sayfa önceden indirilir (speculation rules).
- Her şey JavaScript olmadan da çalışmalı. Formlar doğrudan `/api/abone`'ye gider; çıkış formu `/api/abone/cik`'e.
- Yerelde deneme: `npx wrangler dev`. Derlemeyi kendisi yapar.
