# Monterey Daily
Monterey County news aggregator (Astro + Pagefind, GitHub Pages). `npm run fetch` pulls feeds from `scripts/sources.json` into `src/content/stories/*.json` (headline, short summary, link, date, image + credit; never full text). `npm run build` builds and indexes search. A GitHub Action runs daily at 13:00 UTC.
