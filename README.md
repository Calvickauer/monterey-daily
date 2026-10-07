# Monterey Daily
Monterey County news aggregator (Astro + Pagefind, GitHub Pages). `npm run fetch` pulls feeds from `scripts/sources.json` into `src/content/stories/*.json` (headline, short summary, link, date, image + credit; never full text). `npm run build` builds and indexes search. A GitHub Action runs daily at 13:00 UTC.

## Styling

Coastal palette tokens live in `src/styles/theme.css` (Pacific blues, kelp greens, sunset coral/gold, Big Sur sand); everything else is in `src/styles/global.css`. Each category has a `.cat-<slug>` class that sets `--c` (chips, card top border, link hover), `--c-deep` (header gradient start), `--c-soft` (tints) and `--glow` (decorative only). All text/background pairs were checked for WCAG AA (4.5:1 body, 3:1 large). If you add a category to `CATS` in `src/lib.js`, add a matching `.cat-<slug>` block.

Motion uses only `transform` and `opacity`: staggered scroll-reveal for cards (IntersectionObserver, only active once JS adds `html.js`, so cards are visible without JS), hover lift + tilt on precise pointers, a three-layer drifting wave in the masthead, and Astro View Transitions (`<ViewTransitions/>`) with a fade/slide between pages. `prefers-reduced-motion: reduce` turns all of it off and shows content immediately.

### AI illustration badge

Generated (AI) images get a small frosted "AI illustration" pill in the image's top-left corner, with an accessible label (`role="note"`, "AI illustration: this image was generated with AI").

- Story data: add `"imageGenerated": true` to a story JSON in `src/content/stories/` (optionally `"imageAlt"` for alt text). `Card.astro` then sets `data-ai-generated` on the `<figure>` and renders `<AiBadge/>`.
- Components: `<Card s={story} ai />` forces the badge; `<AiBadge label="AI illustration"/>` can be placed inside any positioned wrapper that carries `data-ai-generated`.
- Plain HTML: `<figure data-ai-generated><img …><span class="ai-badge" role="note" aria-label="AI-generated illustration">AI illustration</span></figure>`.

The badge hides itself if the image fails to load.

## Content & SEO

Summaries are built by `scripts/summarize.mjs` (entity decoding, boilerplate/byline removal, 1–2 sentences, ≤280 chars). `node --test scripts/` runs its tests; `node scripts/summary-report.mjs` prints before/after against the live feeds; `node scripts/resummarize.mjs` re-cleans stored stories. The build also emits `feed.xml` (RSS of our headlines, linking to the original articles), `sitemap.xml` and `robots.txt` from `src/pages/*.js`; nothing extra needs committing. Page metadata/OpenGraph/JSON-LD live in `src/components/Seo.astro` + `src/site.js`; `node scripts/og-image.mjs` regenerates `public/og-image.png` and `public/logo.png`.
