// Alttaki hazır cevaplar. `ac` olanlar sohbette bir dal açar, `href` olanlar sayfaya gider.
export type Chip = { metin: string; ac?: string; soz?: string; href?: string };

export function sayiChips(opts: { disari: boolean; arsiv: boolean }): Chip[] {
  const c: Chip[] = [
    { metin: 'Ne oldu?', ac: 'ne-oldu' },
    { metin: 'Yazılar', ac: 'yazilar' },
  ];
  if (opts.disari) c.push({ metin: 'Bu hafta ne yapsam?', ac: 'disari' });
  c.push({ metin: 'Abone ol', ac: 'abone' });
  c.push({ metin: 'Hepsini göster', ac: 'hepsi' });
  c.push(opts.arsiv ? { metin: 'Bu haftanın sayısı', href: '/' } : { metin: 'Önceki sayılar', href: '/arsiv/' });
  return c;
}

export const GENEL: Chip[] = [
  { metin: 'Bu haftanın sayısı', href: '/' },
  { metin: 'Abone ol', ac: 'abone' },
  { metin: 'Önceki sayılar', href: '/arsiv/' },
];
