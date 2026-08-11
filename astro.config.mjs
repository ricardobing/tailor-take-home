// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// SITE_URL y BASE_PATH los inyecta el workflow de deploy (GitHub Pages sirve
// bajo /<repo>/). En dev local no hacen falta.
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH ?? '/',
  integrations: [preact()],
});
