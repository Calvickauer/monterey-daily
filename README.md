# Monterey Daily
Monterey County news aggregator (Astro + Pagefind, GitHub Pages). `npm run fetch` pulls feeds from `scripts/sources.json` into `src/content/stories/*.json` (headline, short summary, link, date, image + credit; never full text). `npm run build` builds and indexes search. A GitHub Action runs daily at 13:00 UTC.

## Styling

Coastal palette tokens live in `src/styles/theme.css` (Pacific blues, kelp greens, sunset coral/gold, Big Sur sand); everything else is in `src/styles/global.css`. Each category has a `.cat-<slug>` class that sets `--c` (chips, card top border, link hover), `--c-deep` (header gradient start), `--c-soft` (tints) and `--glow` (decorative only). All text/background pairs were checked for WCAG AA (4.5:1 body, 3:1 large). If you add a category to `CATS` in `src/lib.js`, add a matching `.cat-<slug>` block.

Motion uses only `transform` and `opacity`: staggered scroll-reveal for cards (IntersectionObserver, only active once JS adds `html.js`, so cards are visible without JS), hover lift + tilt on precise pointers, a three-layer drifting wave in the masthead, and Astro View Transitions (`<ViewTransitions/>`) with a fade/slide between pages. `prefers-reduced-motion: reduce` turns all of it off and shows content immediately.

### Illustration badge

Fallback illustrations (generic vector art from `public/illustrations/<category>/<n>.webp`, not AI, not photos) get a small frosted "Illustration" pill in the image's top-left corner, with an accessible label (`role="note"`, "Illustration: not a photo of this story").

- Story data: the backend sets `"imageGenerated": true` (the only field the badge reads) and optionally `"imageAlt"`. Root-relative image paths get the site base prefixed. `imageAlt` becomes the `alt`; when absent (or identical to the headline) cards use `alt=""`.
- `Card.astro` sets `data-image-kind="illustration"` on the `<figure>` and renders `<ImageBadge kind="illustration"/>`; photos get the outlet credit caption instead.
- Plain HTML: `<figure data-image-kind="illustration"><img …><span class="img-badge" role="note" aria-label="Illustration: not a photo of this story">Illustration</span></figure>`.

The badge hides itself if the image fails to load.

## Content & SEO

Summaries are built by `scripts/summarize.mjs` (entity decoding, boilerplate/byline removal, 1–2 sentences, ≤280 chars). `node --test scripts/` runs its tests; `node scripts/summary-report.mjs` prints before/after against the live feeds; `node scripts/resummarize.mjs` re-cleans stored stories. The build also emits `feed.xml` (RSS of our headlines, linking to the original articles), `sitemap.xml` and `robots.txt` from `src/pages/*.js`; nothing extra needs committing. Page metadata/OpenGraph/JSON-LD live in `src/components/Seo.astro` + `src/site.js`; `node scripts/og-image.mjs` regenerates `public/og-image.png` and `public/logo.png`.

## Backend: dedupe & images

Story JSON (`src/content/stories/<id>.json`) always carries:

- `alsoCoveredBy: [{ name, url, title? }]`: other outlets (or Spanish twins, e.g. `MC NOW (Español)`) folded into this story; `[]` if none.
- `image`, `imageAlt` (string|null), `imageCredit` (string|null), `imageCreditUrl` (string|null), `imageGenerated` (boolean, === `imageKind === 'illustration'`), `imageKind`, `imageAttribution` (object|null).
  - `imageKind: 'source'`: publisher (outlet) image from the feed or og:image (`imageGenerated: false`).
  - `imageKind: 'stock'`: matched freely licensed photo at `/photos/<id>.webp` (`imageGenerated: false`), with
    `imageAttribution: { author, authorUrl?, source, sourceUrl, license, licenseUrl? }` `imageCredit: "Photo: {author} / {source}, {license}"` and `imageCreditUrl` = source page.
  - `imageKind: 'illustration'`: code-drawn category art at `/illustrations/<category>/<n>.webp` (`imageGenerated: true`, credit `Illustration`).
  - Local image paths are root-relative; the UI prefixes the Pages base (`imgSrc` in `src/media.js`).

Scripts:

- `npm run fetch`: fetch feeds, dedupe against the whole archive (normalized URL, fuzzy headline within 48h, Spanish twins), then assign images (photo > stock > illustration).
- `npm run dedupe`: one-off/maintenance dedupe of the whole archive (`-- --dry` to preview).
- `npm run backfill-images`: idempotent. Syncs `/workspace/monterey-news/illustrations` and `/workspace/monterey-news/photos` (override with `--src=` / `--photos-src=`), tries og:image, then wires stock photos and illustrations. Rerun whenever new photos land.
- `node scripts/purge-nws.mjs`: removes archived NWS alerts that don't name Monterey County zones.
- `npm test`: unit tests for dedupe and image assignment.
