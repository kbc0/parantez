export const KONULAR: Record<string, string> = {
  ekonomi: 'Ekonomi',
  sehir: 'Şehir',
  teknoloji: 'Teknoloji',
  dunya: 'Dünya',
  iklim: 'İklim',
  egitim: 'Eğitim',
  kultur: 'Kültür',
  spor: 'Spor',
};

export const konuAdi = (k: string) => KONULAR[k] ?? k;
