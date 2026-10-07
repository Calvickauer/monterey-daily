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

/** Credit caption for licensed stock photos (imageKind === 'stock' only).
 *  License compliance: CC BY / BY-SA need author, source, license (+ link) and a note of changes.
 *  With imageAttribution { author, authorUrl?, source, sourceUrl, license, licenseUrl?, changes? }:
 *    -> per-part links + filePhoto (imageFilePhoto: "File photo. " prefix) + change note
 *       (" (cropped)" / " (resized)", taken from imageCredit if present, else derived from
 *       imageAttribution.changes for CC BY* licenses).
 *  Without imageAttribution: imageCredit text linked to imageCreditUrl -> { text, url? }.
 *  The rendered text must contain everything in imageCredit (checked in QA). */
export function stockCredit(s) {
  if (s?.imageKind !== 'stock') return null;
  const text = str(s.imageCredit);
  const url = httpUrl(s.imageCreditUrl);
  const a = s.imageAttribution;
  if (a && typeof a === 'object' && (str(a.author) || str(a.source)) && str(a.license)) {
    const fromCredit = text && text.match(/\((cropped|resized)\)\s*$/i);
    const ch = str(a.changes) || '';
    let changeNote = fromCredit ? fromCredit[1].toLowerCase() : null;
    if (!changeNote && ch && /^CC BY/i.test(a.license)) changeNote = /crop/i.test(ch) ? 'cropped' : /resiz/i.test(ch) ? 'resized' : null;
    return {
      filePhoto: s.imageFilePhoto === true || /^File photo\./i.test(text || ''),
      author: str(a.author), authorUrl: httpUrl(a.authorUrl),
      source: str(a.source), sourceUrl: httpUrl(a.sourceUrl) ?? url,
      license: str(a.license), licenseUrl: httpUrl(a.licenseUrl),
      changeNote, changes: ch || undefined,
    };
  }
  return text ? { text, url } : null;
}
