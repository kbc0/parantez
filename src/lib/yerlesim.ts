// Bir yazının hangi sayıda, kaçıncı sırada olduğu sayının kendi dosyasındaki `yazilar` listesinden çıkar.
// Yazı dosyasında sayı yoktur: yazılar sayıdan bağımsız yüklenir, onaylanınca "havuzda" bekler; editör sayıyı
// hazırlarken havuzdan seçip sıralar. Site (lib/site.ts), panel ve bülten e-postası (worker/bulten.js) bunu kullanır.

export type Yer = { sayi: number; sira: number };

// yazı adı (dosya adı, ör. "faiz-sabit") → { sayi, sira }. Bir yazı iki sayıda listelenmişse küçük numaralı geçerli.
export function yaziYerleri(sayilar: { sayi: number; yazilar?: string[] }[]): Map<string, Yer> {
  const yer = new Map<string, Yer>();
  for (const s of [...sayilar].sort((a, b) => a.sayi - b.sayi)) {
    (s.yazilar ?? []).forEach((ad, i) => { if (!yer.has(ad)) yer.set(ad, { sayi: s.sayi, sira: i + 1 }); });
  }
  return yer;
}
