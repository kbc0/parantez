// Arama motorları için yapısal veri (schema.org, JSON-LD). Bas.astro sayfanın <head>'ine yazar.
// Ana sayfa sitenin adını ve kurumu, yazı ve araştırma sayfaları makaleyi tanıtır.
// Google'da sitenin adı ve logosu buradan okunur: https://developers.google.com/search/docs/appearance/site-names
import { SITE } from './site';

const adres = (yol: string, site: URL) => new URL(yol, site).href;

function kurum(site: URL) {
  return {
    '@type': 'Organization',
    '@id': `${adres('/', site)}#kurum`,
    name: SITE.ad,
    alternateName: SITE.digerAdlar,
    url: adres('/', site),
    logo: { '@type': 'ImageObject', url: adres('/icon-512.png', site), width: 512, height: 512 },
    sameAs: SITE.hesaplar,
  };
}

export function siteLd(site: URL) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${adres('/', site)}#site`,
      name: SITE.ad,
      alternateName: SITE.digerAdlar,
      url: adres('/', site),
      description: SITE.aciklama,
      inLanguage: 'tr',
      publisher: { '@id': `${adres('/', site)}#kurum` },
    },
    { '@context': 'https://schema.org', ...kurum(site) },
  ];
}

interface Makale {
  tur: 'NewsArticle' | 'Article';
  yol: string;
  baslik: string;
  aciklama: string;
  gorsel?: string;
  yayin: string; // ISO zaman
  yazarlar: string[];
  bolum?: string;
}

export function makaleLd(m: Makale, site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': m.tur,
    mainEntityOfPage: adres(m.yol, site),
    url: adres(m.yol, site),
    headline: m.baslik,
    description: m.aciklama,
    ...(m.gorsel ? { image: [adres(m.gorsel, site)] } : {}),
    datePublished: m.yayin,
    author: m.yazarlar.map((name) => ({ '@type': 'Person', name })),
    publisher: kurum(site),
    ...(m.bolum ? { articleSection: m.bolum } : {}),
    inLanguage: 'tr',
    isAccessibleForFree: true,
  };
}
