# Yazı paneli: kurulum ve kullanım

Panel `parantezbulten.com/admin` adresinde. Ekip buradan e-posta ve parolayla girer;
sayı, yazı ve ekip bilgilerini düzenler. GitHub hesabı gerekmez.

Sayı ve yazılar **akran incelemesiyle** yayınlanır, GitHub'daki pull request gibi:
yazan değişikliğini incelemeye gönderir, ekipten **başka biri** okurun göreceği hâliyle
önizleyip onaylar. Kimse kendi önerisini onaylayamaz; yani bir şeyin yayına çıkması için
en az iki kişi gerekir. Yönetici de bu kurala tabidir.

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

## Günlük kullanım

### Yazmak

- **Yeni yazı:** **Yazılar** → **+ Yeni yazı**, sayıyı seçin. Var olan bir yazıyı düzenlemek için listeden açın.
- Formun altında üç düğme var:
  - **Önizle:** okurun göreceği hâli telefon ya da masaüstü ekranında gösterir. Hiçbir şey kaydedilmez.
  - **Taslak olarak sakla:** kaydeder ama kimseye göndermez. Ekip görebilir, onaylayamaz.
  - **İncelemeye gönder:** ekibin onayına açar. Hiçbir şey doğrudan yayına çıkmaz.
- **Silmek:** yazıyı açıp *Silinmesini öner*. Bu da bir öneridir; onaylanınca siteden kalkar.
- **Görsel:** Yatay bir fotoğraf seçin; panel küçültüp JPG yapar.
  "Görselde ne var?" alanını doldurun; görme engelli okurlar için.
- **Kaydedemiyorsanız:** Kırmızı kutuda neyin eksik olduğu yazar.
  Panel, sitenin derlenmesini bozacak içeriğin incelemeye gönderilmesine izin vermez.

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
- **Sayıyı yayınlamak:** Bütün yazılar onaylanınca sayıyı açıp "Sitede gizli kalsın" işaretini kaldırın ve incelemeye gönderin.
  Onaylandığı anda sayı ve bütün yazıları birlikte yayına çıkar.
- Sohbetteki her şey (haftanın cümlesi, editörün notu, kısa kısa, dinle/izle/oku önerileri, etkinlikler) sayı formundadır.
  Önizleme, sayının sohbet hâlini gösterir.

### Aynı şeyi iki kişi düzenlerse

- Bir yazı ya da sayı için aynı anda tek bir açık öneri olabilir. Başkası öneri açmışsa düzenle dediğinizde o öneriye gidersiniz;
  orada yorum yazarsınız.
- Öneri hazırlanırken yayındaki hâl değişirse (araya başka bir onay girdiyse) panel uyarır.
  Onaylanmaya çalışılırsa yayınlanmaz, yazana geri döner. Kimsenin emeği sessizce silinmez.

## Sorun olursa

- **Parolasını unutan ekip üyesi:** Yönetici **Hesaplar**'dan *Parolayı sıfırla* der, yeni geçici parolayı iletir.
- **Yönetici parolasını unutursa:** Cloudflare'deki `YONETICI_EPOSTA` ve `YONETICI_PAROLA` her zaman çalışır.
- **"GitHub anahtarı geçersiz":** Anahtarın süresi dolmuş olabilir. 1. adımı tekrarlayıp `GITHUB_TOKEN`'ı güncelleyin.
- **Tek başınıza yayın yapamıyorsanız:** Bu bilerek böyle. En az iki hesap gerekir; ikinci kişiye **Hesaplar**'dan hesap açın.
- **"Yayın durumu" uzun süre dönüyorsa:** Cloudflare'de **Workers & Pages → parantez → Deployments**
  bölümünde son derlemenin hatasına bakın. Site, hatalı derleme yayına çıkmadığı için eski hâliyle çalışmaya devam eder.

## Teknik notlar

- Arayüz: `src/pages/admin/index.astro`, `src/scripts/panel.ts`, `src/scripts/panel-icerik.ts`, `src/styles/panel.css`.
- Önizleme ve farklar: `src/scripts/panel-onizleme.ts`. Şablonları sitedekilerin kopyası:
  `src/pages/yazi/[slug].astro`, `src/components/IssueChat.astro` (ve Grp, LinkCard, Av), `src/layouts/App.astro`'daki üst bar.
  Bunlardan biri değişirse önizlemedeki karşılığı da güncellenmeli.
- Sunucu: `worker/panel.js` (giriş, hesaplar, içerik), `worker/inceleme.js` (öneriler, yorumlar, onay)
  ve `worker/github.js` (GitHub REST/GraphQL).
- Öneriler ve yorumlar D1'de (`panel_oneriler`, `panel_yorumlar`). Onaya kadar GitHub'a hiçbir şey gitmez;
  önerinin görseli de onaya kadar D1'de durur (en fazla ~1 MB).
- Sunucu kuralları: sayı ve yazı yalnızca onayla yazılır (`/api/panel/kaydet` yalnızca ekip listesine yazar);
  öneren kendi önerisini onaylayamaz; onay, önerinin hazırlandığı sürüm hâlâ yayındaysa commit edilir.
- Panel yalnızca `src/content/sayilar/*.md`, `src/content/yazilar/*.md`, `src/data/ekip.json` ve
  `public/gorseller/*` dosyalarına yazabilir.
- Parolalar PBKDF2 ile saklanır. Oturum çerezi `HttpOnly`, `Secure`, `SameSite=Strict`.
  15 dakikada 10 hatalı denemeden sonra giriş durur.
- Yerelde denemek için `.dev.vars` dosyasına üç değişkeni yazın, `npx wrangler dev` çalıştırın.
