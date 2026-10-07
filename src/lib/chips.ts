// Alttaki hazır cevaplar. `ac` olanlar sohbette bir dal açar, `href` olanlar sayfaya gider.
// Ana sayfa (/) sayı listesidir; her sayı /sayi/<no>/ adresinde açılır.
export type Chip = { metin: string; ac?: string; soz?: string; href?: string };

export function sayiChips(opts: { disari: boolean; guncelUrl?: string }): Chip[] {
  const c: Chip[] = [
    { metin: 'Ne oldu?', ac: 'ne-oldu' },
    { metin: 'Yazılar', ac: 'yazilar' },
  ];
  if (opts.disari) c.push({ metin: 'Bu hafta ne yapsam?', ac: 'disari' });
  c.push({ metin: 'Abone ol', ac: 'abone' });
  c.push({ metin: 'Hepsini göster', ac: 'hepsi' });
  if (opts.guncelUrl) c.push({ metin: 'Bu haftanın sayısı', href: opts.guncelUrl });
  c.push({ metin: 'Tüm sayılar', href: '/' });
  return c;
}

export const genelChips = (guncelUrl: string): Chip[] => [
  { metin: 'Bu haftanın sayısı', href: guncelUrl },
  { metin: 'Abone ol', ac: 'abone' },
  { metin: 'Tüm sayılar', href: '/' },
];
