import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { yazilar, sayilar, SITE, yaziUrl } from '../lib/site';

export async function GET(context: APIContext) {
  const [ys, ss] = await Promise.all([yazilar(), sayilar()]);
  return rss({
    title: SITE.ad,
    description: SITE.aciklama,
    site: context.site!,
    items: ys.map((y) => ({
      title: y.data.baslik,
      description: y.data.spot,
      link: yaziUrl(y),
      pubDate: ss.find((s) => s.data.sayi === y.data.sayi)!.data.yayin,
      author: y.data.yazar,
      categories: [y.data.konu],
    })),
    customData: '<language>tr-TR</language>',
  });
}
