// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Yayına alınan adres. Kendi alan adı bağlanınca burayı güncelle.
const SITE = process.env.SITE_URL ?? 'https://parantez.workers.dev';

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
});
