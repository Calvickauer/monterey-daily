import { defineConfig } from 'astro/config';
export default defineConfig({ site: 'https://calvickauer.github.io', base: '/monterey-daily', trailingSlash: 'ignore',
  // Inline CSS so pages have no render-blocking stylesheet request (better FCP/LCP on mobile).
  build: { inlineStylesheets: 'always' } });
