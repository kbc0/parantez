// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { grafikHtml } from './src/lib/grafik.js';

// Yayındaki adres (bağlantıların ve paylaşım görsellerinin tam adresi için).
const SITE = process.env.SITE_URL ?? 'https://parantezbulten.com';

/** @type {import('satteri').MdastPluginEntry} */
const grafikEklentisi = {
  name: 'grafik',
  code(node, ctx) {
    if (node.lang === 'grafik') ctx.replaceNode(node, { type: 'html', value: grafikHtml(node.value) });
  },
};

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (sayfa) => !sayfa.includes('/admin/') && !/\/abone\/[^/]+\/$/.test(sayfa) })],
  markdown: {
    processor: satteri({
      // ```grafik blokları çubuk grafiğe dönüşür (src/lib/grafik.js)
      mdastPlugins: [grafikEklentisi],
      // Dipnotlar ([^1]) yazının sonunda Türkçe başlıkla toplanır
      features: { gfm: { footnotes: { label: 'Kaynaklar ve notlar', backLabel: 'Metne dön' } } },
    }),
  },
});
