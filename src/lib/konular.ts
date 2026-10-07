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

// Link kartlarındaki renk şeridi
export const KONU_RENK: Record<string, string> = {
  ekonomi: '#2a35ff',
  sehir: '#ff4a24',
  teknoloji: '#111111',
  dunya: '#8b8b86',
  iklim: '#9fd400',
  egitim: '#ff7ab8',
  kultur: '#ffbfdc',
  spor: '#d2ff2e',
};

export const konuAdi = (k: string) => KONULAR[k] ?? k;
export const konuRenk = (k: string) => KONU_RENK[k] ?? '#8b8b86';
