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
