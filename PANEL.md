# Yazı paneli: kurulum ve kullanım

Panel `parantezbulten.com/admin` adresinde. Ekip buradan e-posta ve parolayla girer;
sayı, yazı, araştırma ve ekip bilgilerini düzenler; bülteni e-postayla gönderir. GitHub hesabı gerekmez.

Yeni sayı, yazı ve araştırmalar **akran incelemesiyle** yayınlanır, GitHub'daki pull request gibi:
yazan incelemeye gönderir, ekipten **başka biri** okurun göreceği hâliyle önizleyip onaylar.
Kimse kendi önerisini onaylayamaz; yani yeni bir şeyin yayına çıkması için en az iki kişi gerekir.
Yönetici de bu kurala tabidir. Silmek de incelemeyle olur.

Yayında olan bir şeyin **küçük düzeltmesi** (yazım hatası, imza, tarih, bir cümle) incelemeye
gitmeden **Doğrudan yayınla** ile de yayınlanabilir. Büyük değişiklikler yine incelemeye gönderilir.

Onaylanan öneri sitenin GitHub deposuna bir commit olarak gider (yazarı öneren kişi,
mesajında onaylayan da yazar). Cloudflare siteyi 1–2 dakikada yeniden derleyip yayına alır.
Panelin sol altındaki "Yayın durumu" bunu izler.

## Bir kerelik kurulum

### 1. GitHub anahtarı

Panelin depoya yazabilmesi için bir anahtar gerekiyor.

1. GitHub'da sağ üstteki profil resmi → **Settings** → en altta **Developer settings**.
2. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Ayarlar:
   - **Token name:** `parantez-panel`
   - **Expiration:** 1 yıl (süre dolunca yenisini oluşturup aşağıdaki değeri güncelleyin)
   - **Repository access:** *Only select repositories* → `kbc0/parantez`
   - **Permissions → Repository permissions → Contents:** *Read and write*
     (izni ekleyince "Read-only" seçili gelir; açılır listeden **Read and write** yapın. Read-only kalırsa panel
     içeriği okur ama kaydedemez.)
4. **Generate token** ve çıkan anahtarı kopyalayın. Bir daha gösterilmez.

### 2. Cloudflare'de üç gizli değişken

Cloudflare panelinde: **Workers & Pages** → **parantez** → **Settings** → **Variables and Secrets** → **Add**.
Üçünü de **Secret** türünde ekleyin. Düz metin (Text) türü her yayında silinir.

| Ad | Değer |
| --- | --- |
| `GITHUB_TOKEN` | 1. adımdaki anahtar |
| `YONETICI_EPOSTA` | yöneticinin e-postası, ör. `baris@parantezbulten.com` |
| `YONETICI_PAROLA` | uzun ve güçlü bir parola |

Kaydedin (**Deploy**). Başka bir şey gerekmez. Hesaplar mevcut D1 veritabanında
(`parantez-tepkiler`) kendiliğinden oluşur.

### 3. İlk giriş

1. `parantezbulten.com/admin` adresine `YONETICI_EPOSTA` ve `YONETICI_PAROLA` ile girin.
2. **hesabım** → adınızı yazın.
3. **Ekip** → sitede görünen kişileri (ad, kısaltma, renk, rol) gerçek ekiple değiştirin.
4. **Hesaplar** → her ekip üyesine hesap açın. Çıkan geçici parolayı kişiye iletin.
   Kişi ilk girişte kendi parolasını belirler.

### 4. E-posta gönderimi (Resend)

Bülten ve abonelik onay e-postaları [Resend](https://resend.com) ile gider.

1. Resend'de **Domains** → **Add Domain** → `parantezbulten.com`. Bölge: **Ireland (eu-west-1)**.
2. Resend birkaç DNS kaydı gösterir (`resend._domainkey` TXT; `send` için MX ve TXT).
   Cloudflare'de **parantezbulten.com** → **DNS** → **Records** → **Add record** ile hepsini aynen ekleyin.
   Resend, Cloudflare için otomatik kurulum düğmesi gösterirse onu da kullanabilirsiniz.
   Ayrıca önerilir: `_dmarc` adına TXT kaydı, değeri `v=DMARC1; p=none;`.
3. Resend'de alan adı **Verified** olunca **API Keys** → **Create API Key**
   (Permission: *Sending access*, Domain: `parantezbulten.com`). Anahtarı kopyalayın.
4. Cloudflare'de 2. adımdaki yere bir gizli değişken daha ekleyin: `RESEND_API_KEY` = bu anahtar.
5. Panelde **Bülten** → **Kendime deneme gönder** ile deneyin.

Gönderen `(parantez) <bulten@parantezbulten.com>`, cevaplar `baris@parantezbulten.com`'a gider
(`wrangler.jsonc` → `BULTEN_KIMDEN`, `BULTEN_YANIT`).

Resend'in ücretsiz planı **günde 100 e-posta** gönderir (onay e-postaları dahil). Abone sayısı 90'ı geçince
Pro plana geçin (ayda 50.000 e-posta). Sınır dolarsa gönderim durmaz, bekler; sınır açılınca kaldığı yerden sürer.

`RESEND_API_KEY` tanımlanana kadar abonelik eskisi gibi tek adımlıdır (onay e-postası gitmez).

## Günlük kullanım

### Yazmak

- **Yeni yazı:** **Yazılar** → **+ Yeni yazı**, sayıyı seçin. Var olan bir yazıyı düzenlemek için listeden açın.
- Formun altındaki düğmeler:
  - **Önizle:** okurun göreceği hâli telefon ya da masaüstü ekranında gösterir. Hiçbir şey kaydedilmez.
  - **Taslak olarak sakla:** kaydeder ama kimseye göndermez. Ekip görebilir, onaylayamaz.
  - **İncelemeye gönder:** ekibin onayına açar. Yeni içerik yalnızca böyle yayına çıkar.
  - **Doğrudan yayınla:** yalnızca yayındaki bir şeyi düzenlerken görünür. Küçük düzeltmeler için;
    incelemeye gitmeden 1–2 dakikada sitede olur. Bu sayı, yazı ya da araştırma için açık bir öneri varsa
    yalnızca öneriyi yazan, kendi önerisinin içinden doğrudan yayınlayabilir; öneri de yayınlanmış sayılır.
- **Silmek:** yazıyı açıp *Silinmesini öner*. Bu da bir öneridir; onaylanınca siteden kalkar.
- **Görsel:** Yatay bir fotoğraf seçin; panel küçültüp JPG yapar.
  "Görselde ne var?" alanını doldurun; görme engelli okurlar için.
- **Kaydedemiyorsanız:** Kırmızı kutuda neyin eksik olduğu yazar.
  Panel, sitenin derlenmesini bozacak içeriğin incelemeye gönderilmesine ya da yayınlanmasına izin vermez.

### İncelemek

- Sol menüdeki **İnceleme** sayfası: *Onayını bekleyenler*, *Senin önerilerin*, ekipte hazırlananlar ve son kapananlar.
  Onayını bekleyen bir şey varsa menüde "İnceleme · 2 bekliyor" gibi yazar.
- Bir öneriyi açınca solda **Önizleme** (telefon/masaüstü) ve **Değişiklikler** (yayındaki hâline göre ne değişti;
  silinen kırmızı, eklenen yeşil), sağda **Konuşma** var.
- Konuşmanın altındaki düğmeler:
  - **Yorum yaz:** soru sor, not bırak. Öneri olduğu yerde kalır.
  - **Değişiklik iste:** neyin değişmesi gerektiğini yazın; öneri yazana geri döner.
  - **Onayla ve yayınla:** öneri yayına çıkar. İsterseniz bir not da ekleyin.
- Yazan, değişiklik istenen öneriyi **Düzenle** ile açar, düzeltir ve **Düzelttim, yeniden gönder** der.
  Önerisini **Geri çek** ile kapatabilir. Yönetici gerekirse başkasının önerisini kapatabilir.

### Sayılar

- **Yeni sayı:** **Sayılar** → **+ Yeni sayı**. "Sitede gizli kalsın" işaretli gelir:
  sayı ve içindeki yazılar onaylansa bile sitede görünmez. Böylece yazılar hafta içinde tek tek incelenip onaylanabilir.
- **Sayıyı yayınlamak:** Bütün yazılar onaylanınca sayıyı açıp "Sitede gizli kalsın" işaretini kaldırın;
  incelemeye gönderin ya da doğrudan yayınlayın. Sayı ve bütün yazıları birlikte yayına çıkar.
- **Yayındaki sayıyı düzeltmek:** (ör. selamı veren editörün imzası) sayıyı açın, değiştirin, **Doğrudan yayınla**.
- Sohbetteki her şey (haftanın cümlesi, editörün notu, kısa kısa, dinle/izle/oku önerileri, etkinlikler) sayı formundadır.
  Önizleme, sayının sohbet hâlini gösterir.

### Bülten (e-posta)

- **Bülten** sayfası: abone sayısı, sıradaki gönderim ve gönderilenler.
- Sayıyı seçin → **Önizle** e-postanın telefonda ve masaüstünde nasıl görüneceğini gösterir.
  **Kendime deneme gönder** e-postayı yalnızca size yollar.
- **… 07:30'a planla:** sayının yayın günü (pazartesi) 07:30'da tüm abonelere gider.
  Sayı "Sitede gizli kalsın" işaretliyse 07:20'de kendiliğinden yayına çıkar; e-posta, sayı sitede görününce gider.
  Yani pazar akşamı her şeyi hazırlayıp planlamak yeterli; sabah kimsenin bir şeye basması gerekmez.
- **Şimdi gönder:** yayın saati geçmiş bir sayı için. Birkaç dakika içinde gider.
- Plan, gönderim başlamadan ya da sürerken **iptal** edilebilir. Sayı yayına çıkmışsa sitede kalır.
- Bir sayı yalnızca bir kez gönderilir. Aynı anda tek bir gönderim planlanabilir.
- Gönderim dakikada 30 kişiye gider (saatte 1.800); panel ilerlemeyi gösterir. Bu hız Cloudflare'in ücretsiz
  Workers planına göre ayarlı. Ücretli plandaysanız `wrangler.jsonc`'ye `"BULTEN_PARTI": "100"` ve
  `"BULTEN_TUR": "3"` ekleyerek dakikada 300'e çıkarabilirsiniz.

### Abonelik

- Okur sitede e-postasını yazınca **onay e-postası** gider; bağlantıya dokununca abonelik başlar.
  Böylece başkasının adresi yazılamaz.
- Her bültenin altında **abonelikten çık** bağlantısı var. Gmail ve Apple Mail'deki "abonelikten çık" düğmesi de çalışır.
- Aboneler D1'de (`aboneler` tablosu). Eskiden KV'de duranlar ilk çalışmada oraya taşınır; onaylı sayılırlar.

### Araştırmalar

- **Araştırmalar** → **+ Yeni araştırma**. Sitede `/arastirma/` sayfasında numarası ve başlığıyla listelenir.
- Sayfası makale gibidir: numara, başlık, yazarlar ve tarih; ardından metin. Başka kutu yoktur.
- Formda: başlık, numara (No.), yayın tarihi, yazarlar, kısa açıklama (sayfada görünmez; paylaşılınca
  ve aramalarda çıkar), isteğe bağlı görsel (sitede gri tonlu) ve metin.
- Metinde `## ` ile başlayan satır ara başlık olur. Yöntem, kaynaklar gibi bölümleri de böyle yazın.
- **Grafik** düğmesi metne örnek bir blok koyar. Değerleri değiştirin:

  ````
  ```grafik
  Kiranın gelire oranı
  birim: %
  Yarısından fazlası: 41 *
  Üçte biri ile yarısı arası: 33
  Üçte birinden azı: 26
  kaynak: (parantez) anketi, Eylül 2026
  ```
  ````

  İlk satır başlık; her "etiket: sayı" satırı bir çubuk. Sonuna `*` konan satır koyu, diğerleri açık gri olur
  (yazılarda vurgu mavidir). Sayılar Türkçe yazılır (`1.240`, `12,5`).
- **Dipnot** düğmesi metne `[^1]` koyar ve notu en alta açar. Notlar sitede "Kaynaklar ve notlar" başlığıyla toplanır.
- **Tablo** için Markdown tablosu yazılabilir (`| Durum | Oran |` satırları).
- Sitedeki "Örnek" araştırma yalnızca tasarımı göstermek için var. İlk gerçek araştırma yayımlanınca
  ondan **Silinmesini öner** deyin.

### Aynı şeyi iki kişi düzenlerse

- Bir yazı ya da sayı için aynı anda tek bir açık öneri olabilir. Başkası öneri açmışsa düzenle dediğinizde o öneriye gidersiniz;
  orada yorum yazarsınız.
- Öneri hazırlanırken yayındaki hâl değişirse (araya başka bir onay girdiyse) panel uyarır.
  Onaylanmaya çalışılırsa yayınlanmaz, yazana geri döner. Kimsenin emeği sessizce silinmez.

## Sorun olursa

- **Parolasını unutan ekip üyesi:** Yönetici **Hesaplar**'dan *Parolayı sıfırla* der, yeni geçici parolayı iletir.
- **Yönetici parolasını unutursa:** Cloudflare'deki `YONETICI_EPOSTA` ve `YONETICI_PAROLA` her zaman çalışır.
- **"GitHub anahtarı geçersiz ya da süresi dolmuş":** 1. adımı tekrarlayıp `GITHUB_TOKEN`'ı güncelleyin.
- **"Depoyu okuyabiliyor ama yazamıyor":** Anahtarın Contents izni "Read-only" kalmış. GitHub'da anahtarı açıp
  (Settings → Developer settings → Fine-grained tokens → anahtar → **Edit**) Contents'i **Read and write** yapın.
  Anahtar değişmez; Cloudflare'de bir şey yapmak gerekmez.
- **Tek başınıza yayın yapamıyorsanız:** Bu bilerek böyle. En az iki hesap gerekir; ikinci kişiye **Hesaplar**'dan hesap açın.
- **"E-posta gönderimi henüz kurulmadı":** Cloudflare'de `RESEND_API_KEY` yok (kurulumun 4. adımı).
- **"Resend gönderimi reddetti; alan adı doğrulanmamış olabilir":** Resend'de **Domains** altında `parantezbulten.com`
  *Verified* olmalı. DNS kayıtları eksikse Cloudflare'den ekleyin.
- **Gönderim "Site hâlâ güncellenmedi" diyorsa:** sayı yayına alındı ama Cloudflare derlemesi bitmedi ya da hata verdi.
  Derleme düzelince gönderim kendiliğinden başlar.
- **"Yayın durumu" uzun süre dönüyorsa:** Cloudflare'de **Workers & Pages → parantez → Deployments**
  bölümünde son derlemenin hatasına bakın. Site, hatalı derleme yayına çıkmadığı için eski hâliyle çalışmaya devam eder.

## Teknik notlar

- Arayüz: `src/pages/admin/index.astro`, `src/scripts/panel.ts`, `src/scripts/panel-icerik.ts`, `src/styles/panel.css`.
- Önizleme ve farklar: `src/scripts/panel-onizleme.ts`. Şablonları sitedekilerin kopyası:
  `src/pages/yazi/[slug].astro`, `src/pages/arastirma/[slug].astro`, `src/components/IssueChat.astro` (ve Grp, LinkCard, Av), `src/layouts/App.astro`'daki üst bar.
  Bunlardan biri değişirse önizlemedeki karşılığı da güncellenmeli.
- Sunucu: `worker/panel.js` (giriş, hesaplar, içerik), `worker/inceleme.js` (öneriler, yorumlar, onay)
  ve `worker/github.js` (GitHub REST/GraphQL).
- Bülten: `worker/bulten.js` (e-posta şablonu; sohbetin e-postadaki hâli, içerik GitHub'dan),
  `worker/gonderim.js` (plan, zamanlayıcı, panelin `/api/panel/bulten/*` uçları), `worker/eposta.js` (Resend),
  `worker/abonelik.js` (kayıt, onay, çıkış; `/api/abone/*`). Zamanlayıcı her dakika çalışır (`wrangler.jsonc` → `triggers`).
- Gönderimler D1'de (`gonderimler`): planli → yayinda → gonderiliyor → bitti (ya da iptal).
  Her yayındaki sayının e-postası site derlenirken `/bulten/<no>.json` olarak hazırlanır (`src/pages/bulten/[sayi].json.ts`);
  zamanlayıcı onu okuyup dondurur, dosya yoksa site henüz güncellenmemiştir. Panelin önizlemesi aynı şablonu GitHub'daki
  içerikle çalıştırır (gizli sayı da önizlenebilsin diye). Partiler Resend'e `Idempotency-Key` ile gider;
  yarıda kalan parti yeniden gönderilirse ikinci kez gitmez.
- Öneriler ve yorumlar D1'de (`panel_oneriler`, `panel_yorumlar`). Onaya kadar GitHub'a hiçbir şey gitmez;
  önerinin görseli de onaya kadar D1'de durur (en fazla ~1 MB).
- Sunucu kuralları: yeni sayı, yazı ve araştırmalar ile silmeler yalnızca onayla yazılır.
  `/api/panel/kaydet` ekip listesine ya da yayındaki tek bir içerik dosyasına (beklenen sürümüyle; varsa görseliyle) yazar.
  O dosyanın açık bir önerisi varsa yalnızca önerinin yazanı, öneri kimliğiyle yazabilir; öneri `yayinlandi` olur.
  Öneren kendi önerisini onaylayamaz; onay, önerinin hazırlandığı sürüm hâlâ yayındaysa commit edilir.
- Panel yalnızca `src/content/sayilar/*.md`, `src/content/yazilar/*.md`, `src/content/arastirmalar/*.md`,
  `src/data/ekip.json` ve `public/gorseller/*` dosyalarına yazabilir.
- Parolalar PBKDF2 ile saklanır. Oturum çerezi `HttpOnly`, `Secure`, `SameSite=Strict`.
  15 dakikada 10 hatalı denemeden sonra giriş durur.
- Yerelde denemek için `.dev.vars` dosyasına değişkenleri yazın, `npx wrangler dev --test-scheduled` çalıştırın.
  Zamanlayıcıyı elle çalıştırmak için: `curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"`.
  `RESEND_API` ve `GITHUB_API` ile sahte sunuculara yönlendirilebilir; `SITE_ADRESI` e-postalardaki bağlantıların kökü.
