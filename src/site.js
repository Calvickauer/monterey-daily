// Site identity, absolute URLs and structured-data helpers (shared by layout, pages, feed + sitemap).
import { CATS } from './lib.js';
import sources from '../scripts/sources.json';

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const SITE_URL = new URL(base, import.meta.env.SITE).href; // https://calvickauer.github.io/monterey-daily/
export const abs = (p = '') => new URL(String(p).replace(/^\//, ''), SITE_URL).href;

export const SITE = {
  name: 'Monterey Daily',
  title: 'Monterey Daily – Monterey County news, gathered daily',
  tagline: 'Monterey County headlines from local newsrooms, linked to the original reporting.',
  description: 'Monterey Daily gathers Monterey County headlines each morning from local newsrooms and public agencies, with short summaries that link to the original reporting.',
  repo: 'https://github.com/Calvickauer/monterey-daily',
  issues: 'https://github.com/Calvickauer/monterey-daily/issues',
  ogImage: abs('og-image.png'), ogImageAlt: 'Monterey Daily: Monterey County headlines from local newsrooms, linked to the original reporting.',
  logo: abs('logo.png'),
};

// ---- Outlets (derived from scripts/sources.json: every feed fetch.mjs actually pulls) ----
const DISPLAY = {
  'KSBW Action News 8 (local)': 'KSBW Action News 8',
  'KION 5/46 (KION Central Coast)': 'KION Central Coast (KION 5/46)',
  'Lookout Santa Cruz (regional)': 'Lookout Santa Cruz',
  'KQED News (Bay Area regional)': 'KQED News',
  'NWS alerts – Monterey County zones': 'National Weather Service (San Francisco Bay Area/Monterey office)',
};
const ABOUT = {
  'KSBW Action News 8 (local)': 'Central Coast TV news (local news feed only).',
  'Monterey County Weekly / Monterey County NOW': 'Independent weekly covering Monterey County news, government, environment and culture.',
  'KION 5/46 (KION Central Coast)': 'Central Coast TV news. We include only stories that mention Monterey County communities.',
  'Voices of Monterey Bay': 'Nonprofit, bilingual (English/Spanish) community journalism.',
  'Lookout Santa Cruz (regional)': 'Santa Cruz County news. We include only stories that mention Monterey County communities.',
  'County of Monterey News': 'Official news releases from the County of Monterey and its departments, including the Sheriff and District Attorney.',
  'City of Seaside News Flash': 'Official news from the City of Seaside.',
  'City of Marina News Flash': 'Official news from the City of Marina.',
  'MBARI News': 'News from the Monterey Bay Aquarium Research Institute.',
  'King City Rustler / South County Newspapers': 'Salinas Valley and South County newspapers.',
  'NWS alerts – Monterey County zones': 'Active weather watches, warnings and advisories for Monterey County zones (public domain).',
  'KQED News (Bay Area regional)': 'Bay Area public media. We include only stories that mention Monterey County communities.',
  'Pajaronian': 'Watsonville and Pajaro Valley newspaper. We include only stories that mention Monterey County communities.',
};
export const outlets = sources.filter(s => s.status?.startsWith('working')).map(s => ({
  key: s.name, name: DISPLAY[s.name] || s.name, url: s.url, feed: s.type === 'rss' ? s.feed_url : s.url, about: ABOUT[s.name] || '',
}));
const byKey = Object.fromEntries(outlets.map(o => [o.key, o]));
/** Outlet record for a story's `source` (falls back to the story's own sourceUrl). */
export const outletFor = s => byKey[s.source] || { key: s.source, name: DISPLAY[s.source] || s.source, url: s.sourceUrl, feed: s.sourceUrl, about: '' };

// ---- Structured data ----
export const websiteLD = () => ({ '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: SITE.name, description: SITE.description, inLanguage: 'en-US', publisher: { '@id': `${SITE_URL}#organization` } });
export const organizationLD = () => ({ '@type': 'Organization', '@id': `${SITE_URL}#organization`, name: SITE.name, url: SITE_URL,
  logo: { '@type': 'ImageObject', url: SITE.logo, width: 512, height: 512 }, sameAs: [SITE.repo], description: SITE.description });
const isAI = s => s.imageGenerated || /\bAI\b/.test(s.imageCredit || '');
/** NewsArticle node describing the ORIGINAL article; publisher is the outlet, never Monterey Daily. */
export const articleLD = s => {
  const o = outletFor(s);
  return { '@type': 'NewsArticle', '@id': s.link, headline: s.headline, description: s.summary && s.summary !== s.headline ? s.summary : undefined,
    url: s.link, mainEntityOfPage: { '@type': 'WebPage', '@id': s.link }, datePublished: s.date,
    publisher: { '@type': 'Organization', name: o.name, url: o.url },
    image: s.image && !isAI(s) && /^https?:/.test(s.image) ? s.image : undefined,
    articleSection: CATS[s.category] };
};
export const storyListLD = (list, { name = 'Top Stories', url = SITE_URL } = {}) => ({ '@type': 'ItemList', name, url, numberOfItems: list.length,
  itemListOrder: 'https://schema.org/ItemListOrderDescending',
  itemListElement: list.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: s.link, item: articleLD(s) })) });
/** Serialize nodes as one JSON-LD @graph; safe to embed in <script>. */
export const ldJson = nodes => JSON.stringify({ '@context': 'https://schema.org', '@graph': [].concat(nodes) }).replace(/</g, '\\u003c');

// ---- RSS / XML ----
export const xmlEscape = v => String(v ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
