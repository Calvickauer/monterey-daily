// Image helpers shared by story components.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Resolve a story image: root-relative paths (e.g. /illustrations/<category>/<n>.webp) get the
 *  site base prefixed so they work on GitHub Pages; absolute/protocol-relative URLs pass through. */
export function imgSrc(src) {
  if (!src || typeof src !== 'string') return null;
  if (/^(https?:)?\/\//i.test(src) || /^data:/i.test(src)) return src;
  if (src.startsWith('/')) return src.startsWith(BASE + '/') ? src : BASE + src;
  return src;
}

/** Normalize the optional "also covered by" list: keep only entries with an http(s) url. */
export function alsoCovered(s) {
  const list = Array.isArray(s?.alsoCoveredBy) ? s.alsoCoveredBy : [];
  return list
    .filter((a) => a && typeof a.url === 'string' && /^https?:\/\//i.test(a.url))
    .map((a) => {
      let name = a.name || a.source;
      if (!name) { try { name = new URL(a.url).hostname.replace(/^www\./, ''); } catch { name = a.url; } }
      return { name, url: a.url, title: a.title || undefined, es: /\(Español\)/i.test(name) };
    });
}

/** Badge kind for a story image: 'illustration' or null.
 *  imageKind 'illustration' -> badge; 'source' (alias 'photo') / 'stock' -> none;
 *  missing imageKind -> badge only when imageGenerated is true. */
export function imageKind(s) {
  const k = s?.imageKind;
  if (k === 'illustration') return 'illustration';
  if (typeof k === 'string' && k) return null;
  return (s?.imageGenerated ?? false) ? 'illustration' : null;
}

const httpUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Credit caption for licensed stock photos (imageKind === 'stock' only; required for CC BY / BY-SA).
 *  Contract (flat): imageCredit (text) + imageCreditUrl (photo's source page) -> { text, url? }.
 *  Optional enrichment: imageAttribution { author, authorUrl?, source, sourceUrl, license, licenseUrl? }
 *  -> { author, authorUrl, source, sourceUrl, license, licenseUrl } for per-part links.
 *  Returns null only when there is nothing to credit. Field names live in this function only. */
export function stockCredit(s) {
  if (s?.imageKind !== 'stock') return null;
  const text = str(s.imageCredit);
  const url = httpUrl(s.imageCreditUrl);
  const a = s.imageAttribution;
  if (a && typeof a === 'object') {
    const author = str(a.author), source = str(a.source);
    // Use the per-part version only if it's at least as complete as the text credit (keeps the license).
    if ((author || source) && (str(a.license) || !text)) {
      return {
        author, authorUrl: httpUrl(a.authorUrl),
        source, sourceUrl: httpUrl(a.sourceUrl) ?? url,
        license: str(a.license), licenseUrl: httpUrl(a.licenseUrl),
      };
    }
  }
  return text ? { text, url } : null;
}
