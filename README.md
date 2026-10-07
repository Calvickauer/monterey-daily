# Monterey Daily
Monterey County news aggregator (Astro + Pagefind, GitHub Pages). `npm run fetch` pulls feeds from `scripts/sources.json` into `src/content/stories/*.json` (headline, short summary, link, date, image + credit; never full text). `npm run build` builds and indexes search. A GitHub Action runs daily at 13:00 UTC.

## Styling

Coastal palette tokens live in `src/styles/theme.css` (Pacific blues, kelp greens, sunset coral/gold, Big Sur sand); everything else is in `src/styles/global.css`. Each category has a `.cat-<slug>` class that sets `--c` (chips, card top border, link hover), `--c-deep` (header gradient start), `--c-soft` (tints) and `--glow` (decorative only). All text/background pairs were checked for WCAG AA (4.5:1 body, 3:1 large). If you add a category to `CATS` in `src/lib.js`, add a matching `.cat-<slug>` block.

Motion uses only `transform` and `opacity`: staggered scroll-reveal for cards (IntersectionObserver, only active once JS adds `html.js`, so cards are visible without JS), hover lift + tilt on precise pointers, a three-layer drifting wave in the masthead, and Astro View Transitions (`<ViewTransitions/>`) with a fade/slide between pages. `prefers-reduced-motion: reduce` turns all of it off and shows content immediately.

### Image badges

Story images come in three kinds, set by the backend in `imageKind`:

| `imageKind` | Source | Badge |
|---|---|---|
| `photo` | the outlet's own photo (absolute URL) | none (credit caption instead) |
| `ai` | photo-realistic AI image, `public/ai-images/<stem>.webp` | "AI-generated image" |
| `illustration` | per-category illustration library, `public/illustrations/<category>/<n>.webp` | "Illustration" |

If `imageKind` is missing, `"imageGenerated": true` falls back to "Illustration"; otherwise no badge. Root-relative paths get the site base prefixed. `imageAlt` (string or null) becomes the `alt`; when absent (or identical to the headline) cards use `alt=""` because the headline sits right below the image.

- `Card.astro` sets `data-image-kind="ai"|"illustration"` on the `<figure>` and renders `<ImageBadge kind=…/>`: a frosted pill in the top-left corner with an accessible label (`role="note"`, e.g. "AI-generated image: not a real photo of this story").
- `<Card s={story} kind="ai" />` overrides the kind; `<ImageBadge kind="illustration"/>` works inside any positioned wrapper carrying `data-image-kind`.
- Plain HTML: `<figure data-image-kind="ai"><img …><span class="img-badge" role="note" aria-label="AI-generated image: not a real photo of this story">AI-generated image</span></figure>`.

The badge hides itself if the image fails to load.
