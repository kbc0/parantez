// Alttaki hazır cevaplar. `ac` olanlar sohbette bir dal açar, `href` olanlar sayfaya gider.
// "Tüm sayılar" ana sayfanın çekmecesini açar (/#liste); her sayı /sayi/<no>/ adresinde açılır.
export type Chip = { metin: string; ac?: string; soz?: string; href?: string };
