# Yazı paneli: kurulum ve kullanım

Panel `parantezbulten.com/admin` adresinde. Ekip buradan e-posta ve parolayla girer;
sayı, yazı ve ekip bilgilerini düzenler. GitHub hesabı gerekmez.

Kaydedilen her şey sitenin GitHub deposuna bir commit olarak gider. Cloudflare siteyi
1–2 dakikada yeniden derleyip yayına alır. Panelin sol altındaki "Yayın durumu" bunu izler.

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

- **Yeni sayı:** **Sayılar** → **+ Yeni sayı**. Önce *taslak* olarak kaydedin.
  Taslak sayının yazıları da sitede görünmez.
- **Yazılar:** **Yazılar** → **+ Yeni yazı**, sayıyı seçin.
  Yazı taslakken sitede görünmez. Taslak kutusunu kaldırıp kaydedince yayına çıkar.
- **Sayıyı yayınlamak:** Bütün yazılar hazır olunca sayının taslak kutusunu kaldırıp kaydedin.
  Sayı ve yazıları birlikte çıkar.
- **Görsel:** Yatay bir fotoğraf seçin; panel küçültüp JPG yapar.
  "Görselde ne var?" alanını doldurun; görme engelli okurlar için.
- **Aynı anda düzenleme:** İki kişi aynı yazıyı aynı anda kaydederse ikincisi uyarı alır.
  Sayfayı yenileyip değişikliğini tekrar uygular. Kimsenin emeği sessizce silinmez.
- **Kaydedemiyorsanız:** Kırmızı kutuda neyin eksik olduğu yazar.
  Panel, sitenin derlenmesini bozacak içeriğin kaydedilmesine izin vermez.

## Sorun olursa

- **Parolasını unutan ekip üyesi:** Yönetici **Hesaplar**'dan *Parolayı sıfırla* der, yeni geçici parolayı iletir.
- **Yönetici parolasını unutursa:** Cloudflare'deki `YONETICI_EPOSTA` ve `YONETICI_PAROLA` her zaman çalışır.
- **"GitHub anahtarı geçersiz":** Anahtarın süresi dolmuş olabilir. 1. adımı tekrarlayıp `GITHUB_TOKEN`'ı güncelleyin.
- **"Yayın durumu" uzun süre dönüyorsa:** Cloudflare'de **Workers & Pages → parantez → Deployments**
  bölümünde son derlemenin hatasına bakın. Site, hatalı derleme yayına çıkmadığı için eski hâliyle çalışmaya devam eder.

## Teknik notlar

- Arayüz: `src/pages/admin/index.astro`, `src/scripts/panel.ts`, `src/scripts/panel-icerik.ts`, `src/styles/panel.css`.
- Sunucu: `worker/panel.js` (giriş, hesaplar, içerik) ve `worker/github.js` (GitHub REST/GraphQL).
- Panel yalnızca `src/content/sayilar/*.md`, `src/content/yazilar/*.md`, `src/data/ekip.json` ve
  `public/gorseller/*` dosyalarına yazabilir.
- Parolalar PBKDF2 ile saklanır. Oturum çerezi `HttpOnly`, `Secure`, `SameSite=Strict`.
  15 dakikada 10 hatalı denemeden sonra giriş durur.
- Yerelde denemek için `.dev.vars` dosyasına üç değişkeni yazın, `npx wrangler dev` çalıştırın.
