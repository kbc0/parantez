// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Yayındaki adres (bağlantıların ve paylaşım görsellerinin tam adresi için).
const SITE = process.env.SITE_URL ?? 'https://parantezbulten.com';

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (sayfa) => !sayfa.includes('/admin/') })],
});
