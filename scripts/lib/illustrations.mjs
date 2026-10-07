// Generic per-category AI illustrations for stories without a publisher photo.
// Library lives in public/illustrations/<category>/<n>.webp (plus a "general" set) and is committed to the repo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hasPhotoFile, loadPhotoManifest, stockFields } from './photos.mjs';

export const ILLU_DIR = 'public/illustrations';
export const CREDIT = 'Illustration'; // code-drawn vector art (not AI)
export const CATEGORIES = ['government', 'public-safety', 'environment', 'business', 'community', 'sports', 'weather'];
const IMG = /\.(webp|png|jpe?g|avif)$/i;

const ALIASES = {
  government: ['government', 'gov', 'govt', 'politics'],
  'public-safety': ['public-safety', 'publicsafety', 'public_safety', 'safety', 'public safety'],
  environment: ['environment', 'environment-coast', 'environment-and-coast', 'environment_coast', 'environment & coast', 'environment-&-coast', 'coast', 'env'],
  business: ['business', 'economy'],
  community: ['community', 'culture'],
  sports: ['sports', 'sport'],
  weather: ['weather'],
  general: ['general', 'generic', 'default', 'misc', 'other', 'all'],
};
/** Map a library folder name to a category key used in story JSON. */
export function canonicalFolder(name) {
  const n = String(name).toLowerCase().trim();
  const slug = n.replace(/&/g, 'and').replace(/[\s_]+/g, '-');
  for (const [k, list] of Object.entries(ALIASES)) if (list.includes(n) || list.includes(slug)) return k;
  return slug.replace(/[^a-z0-9-]/g, '');
}

const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/** Copy the illustration library (e.g. /workspace/monterey-news/illustrations) into public/illustrations. */
export function syncLibrary(src, dest = ILLU_DIR) {
  const copied = [];
  if (!src || !fs.existsSync(src)) return { ok: false, copied };
  for (const d of fs.readdirSync(src, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const files = fs.readdirSync(path.join(src, d.name)).filter(f => IMG.test(f)).sort(natural);
    if (!files.length) continue;
    const outDir = path.join(dest, canonicalFolder(d.name));
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of files) {
      const from = path.join(src, d.name, f), to = path.join(outDir, f.toLowerCase().replace(/\s+/g, '-'));
      if (!fs.existsSync(to) || !fs.readFileSync(to).equals(fs.readFileSync(from))) { fs.copyFileSync(from, to); copied.push(to); }
    }
  }
  const man = path.join(src, 'manifest.json');
  if (fs.existsSync(man)) { fs.mkdirSync(dest, { recursive: true }); fs.copyFileSync(man, path.join(dest, 'manifest.json')); copied.push(path.join(dest, 'manifest.json')); }
  return { ok: true, copied };
}

/** Alt text per public path, from public/illustrations/manifest.json ({images:[{file, alt}]}). */
export function loadAlts(dir = ILLU_DIR) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    return Object.fromEntries((m.images || []).map(e => [`/illustrations/${e.file}`, e.alt || null]));
  } catch { return {}; }
}

/** { category: ['/illustrations/<category>/<n>.webp', ...] } from what is on disk. */
export function loadLibrary(dir = ILLU_DIR) {
  const lib = {};
  if (!fs.existsSync(dir)) return lib;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const files = fs.readdirSync(path.join(dir, d.name)).filter(f => IMG.test(f)).sort(natural);
    if (files.length) lib[d.name] = files.map(f => `/illustrations/${d.name}/${f}`);
  }
  return lib;
}

export const hashIndex = id => parseInt(crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 8), 16);
/** Publisher photo from the feed or og:image (not a stock match, not an illustration). */
export const hasRealImage = s => !!s.image && !s.imageGenerated && s.imageKind !== 'stock' && !String(s.image).startsWith('/');
export const groupFor = (category, lib) => (lib[category]?.length ? category : lib.general?.length ? 'general' : null);
const fileExists = (img, publicDir) => !!img && fs.existsSync(path.join(publicDir, img));

/**
 * Assign illustrations to stories without a real image.
 * - `only`: Set of story ids to (re)assign; null = recompute every illustrated/image-less story (backfill).
 *   Stories outside `only` keep their current illustration (unless its file is missing).
 * - Deterministic: hash(id) mod N within the story's category set (general set if category is unknown/empty),
 *   stepping to the next index when the neighbouring story (date order, same set) already has that image.
 * Mutates stories. Returns { assigned, byCategory, unassigned }.
 */
export function assignIllustrations(stories, { lib = loadLibrary(), alts = loadAlts(), only = null, publicDir = 'public' } = {}) {
  const res = { assigned: 0, byCategory: {}, unassigned: 0 };
  const groups = new Map();
  for (const s of stories) {
    if (hasRealImage(s)) continue;
    const g = groupFor(s.category, lib);
    if (!g) { if (!s.image) res.unassigned++; continue; }
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(s);
  }
  for (const [g, list] of groups) {
    const imgs = lib[g];
    list.sort((a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id)));
    const target = list.map(s => !only || only.has(s.id) || !s.image || !fileExists(s.image, publicDir) || !imgs.includes(s.image));
    for (let i = 0; i < list.length; i++) {
      if (!target[i]) { list[i].imageCredit = CREDIT; list[i].imageAlt = alts[list[i].image] || null; continue; }
      const s = list[i];
      const prev = list[i - 1]?.image;
      const next = list[i + 1] && !target[i + 1] ? list[i + 1].image : null;
      const start = hashIndex(s.id) % imgs.length;
      let pick = imgs[start];
      for (let k = 0; k < imgs.length; k++) { const c = imgs[(start + k) % imgs.length]; if (c !== prev && c !== next) { pick = c; break; } }
      s.image = pick; s.imageGenerated = true; s.imageCredit = CREDIT; s.imageAlt = alts[pick] || null;
      res.assigned++; res.byCategory[g] = (res.byCategory[g] || 0) + 1;
    }
  }
  return res;
}

/**
 * Full image pass. Priority per story: publisher photo (feed/og:image, imageKind 'source')
 * -> matched stock photo public/photos/<id>.webp ('stock') -> category illustration ('illustration').
 * Sets image, imageAlt, imageCredit, imageCreditUrl, imageGenerated (=== kind 'illustration'), imageKind, imageAttribution. Idempotent: stories are
 * upgraded from illustration to stock as soon as a photo file exists.
 * `only` limits which illustration assignments may change (null = recompute all, used by the backfill).
 */
export function assignImages(stories, { only = null, publicDir = 'public', lib = loadLibrary(), alts = loadAlts(), photos = loadPhotoManifest(path.join(publicDir, 'photos')) } = {}) {
  const res = { photo: 0, stock: 0, stockNew: 0, illustration: 0, none: 0, byCategory: {} };
  const rest = [];
  for (const s of stories) {
    if (hasRealImage(s)) { Object.assign(s, { imageGenerated: false, imageKind: 'source', imageAttribution: null, imageCreditUrl: null }); if (s.imageAlt === undefined) s.imageAlt = null; res.photo++; continue; }
    if (hasPhotoFile(s.id, publicDir)) {
      if (s.imageKind !== 'stock') res.stockNew++;
      Object.assign(s, stockFields(s.id, photos[s.id]));
      res.stock++; continue;
    }
    if (s.imageKind === 'stock' || String(s.image || '').startsWith('/photos/')) s.image = null; // photo removed -> illustration
    s.imageAttribution = null; s.imageCreditUrl = null;
    rest.push(s);
  }
  const ill = assignIllustrations(rest, { lib, alts, only, publicDir });
  for (const s of rest) {
    if (s.image && s.imageGenerated) { s.imageKind = 'illustration'; res.illustration++; }
    else { Object.assign(s, { image: null, imageAlt: null, imageCredit: null, imageGenerated: false }); delete s.imageKind; res.none++; }
  }
  res.byCategory = { ...ill.byCategory };
  res.illustrationsChanged = ill.assigned;
  return res;
}
