// Matched, freely licensed stock photos for stories without a publisher image:
// public/photos/<story-file-stem>.webp + public/photos/manifest.json
// (per stem: alt, credit, author, author_url?, license, license_url, source_page_url).
import fs from 'node:fs';
import path from 'node:path';

export const PHOTO_DIR = 'public/photos';

/** Normalize a manifest to { stem: entry }. Accepts {images|photos:[...]}, [...] or {stem: {...}}. */
export function parseManifest(m) {
  const out = {};
  const list = Array.isArray(m) ? m : Array.isArray(m?.images) ? m.images : Array.isArray(m?.photos) ? m.photos : null;
  if (list) {
    for (const e of list) {
      const stem = e.stem || e.id || (e.file || e.path || e.image || '').split('/').pop().replace(/\.[a-z0-9]+$/i, '');
      if (stem) out[stem] = { ...e };
    }
  } else if (m && typeof m === 'object') {
    for (const [k, v] of Object.entries(m)) if (v && typeof v === 'object' && !Array.isArray(v)) out[k.replace(/\.[a-z0-9]+$/i, '')] = { ...v };
  }
  return out;
}

export function loadPhotoManifest(dir = PHOTO_DIR) {
  try { return parseManifest(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))); } catch { return {}; }
}

/** Copy <src>/*.webp and manifest.json into public/photos (only changed files). */
export function syncPhotos(src, dest = PHOTO_DIR) {
  const copied = [];
  if (!src || !fs.existsSync(src)) return { ok: false, copied };
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src).filter(f => /\.webp$/i.test(f) || f === 'manifest.json')) {
    const from = path.join(src, f), to = path.join(dest, f);
    if (!fs.existsSync(to) || !fs.readFileSync(to).equals(fs.readFileSync(from))) { fs.copyFileSync(from, to); copied.push(to); }
  }
  return { ok: true, copied };
}

const GOV = [[/noaa\.gov$/, 'NOAA'], [/nps\.gov$/, 'NPS'], [/usgs\.gov$/, 'USGS'], [/fws\.gov$/, 'USFWS'], [/fs\.usda\.gov$|fs\.fed\.us$/, 'USDA Forest Service'],
  [/usda\.gov$/, 'USDA'], [/nasa\.gov$/, 'NASA'], [/blm\.gov$/, 'BLM'], [/epa\.gov$/, 'EPA'], [/army\.mil$|navy\.mil$|af\.mil$|defense\.gov$|dvidshub\.net$/, 'U.S. military (DVIDS)'],
  [/loc\.gov$/, 'Library of Congress'], [/fema\.gov$/, 'FEMA'], [/dot\.gov$/, 'U.S. DOT'], [/ca\.gov$/, 'State of California']];
/** Platform name from the source page URL. */
export function sourceName(url) {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
  if (/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/.test(host)) return 'Wikimedia Commons';
  if (/(^|\.)unsplash\.com$/.test(host)) return 'Unsplash';
  if (/(^|\.)pexels\.com$/.test(host)) return 'Pexels';
  if (/(^|\.)flickr\.com$/.test(host)) return 'Flickr';
  for (const [re, n] of GOV) if (re.test(host)) return n;
  return host;
}

/** Story fields for a stock photo entry. */
export function stockFields(stem, e = {}) {
  const sourceUrl = e.source_page_url || e.sourceUrl || e.source_url || null;
  const source = sourceName(sourceUrl) || e.source || null;
  const author = e.author || null, license = e.license || null;
  const imageAttribution = { author, ...(e.author_url || e.authorUrl ? { authorUrl: e.author_url || e.authorUrl } : {}), source, sourceUrl, license, ...(e.license_url || e.licenseUrl ? { licenseUrl: e.license_url || e.licenseUrl } : {}) };
  const credit = author || source ? `Photo: ${[author, source].filter(Boolean).join(' / ')}${license ? `, ${license}` : ''}` : (e.credit || 'Photo');
  return { image: `/photos/${stem}.webp`, imageAlt: e.alt || null, imageCredit: credit, imageGenerated: false, imageKind: 'stock', imageAttribution };
}

export const hasPhotoFile = (stem, publicDir = 'public') => fs.existsSync(path.join(publicDir, 'photos', `${stem}.webp`));
