import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { yazilar, sayilar, arastirmalar, SITE, yaziUrl, arastirmaUrl } from '../lib/site';

export async function GET(context: APIContext) {
  const [ys, ss, as] = await Promise.all([yazilar(), sayilar(), arastirmalar()]);
  return rss({
    title: SITE.ad,
    description: SITE.aciklama,
    site: context.site!,
    items: [
      ...ys.map((y) => ({
        title: y.data.baslik,
        description: y.data.spot,
        link: yaziUrl(y),
        pubDate: ss.find((s) => s.data.sayi === y.data.sayi)!.data.yayin,
        author: y.data.yazar,
        categories: [y.data.konu],
      })),
      ...as.map((a) => ({
        title: `Araştırma: ${a.data.baslik}`,
        description: a.data.ozet,
        link: arastirmaUrl(a),
        pubDate: a.data.yayin,
        author: a.data.yazarlar.join(', '),
        categories: ['arastirma', a.data.konu],
      })),
    ],
    customData: '<language>tr-TR</language>',
  });
}
