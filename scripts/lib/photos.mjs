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

// Free licenses that allow commercial use (no NC / ND).
const FREE = /^(cc0( 1\.0)?|cc by(-sa)? \d\.\d( [a-z]{2,3})?|public domain( \(.*\))?|pdm|cc pdm( 1\.0)?|us government public domain)$/i;
/** Reason an entry can't be used (null = OK). */
export function entryProblem(e) {
  if (!e) return 'no manifest entry';
  const lic = String(e.license || '').trim();
  if (!lic) return 'missing license';
  if (/\b(nc|nd|non-?commercial|no-?deriv)/i.test(lic) || !FREE.test(lic)) return `license not free/commercial-OK: ${lic}`;
  if (!String(e.author || '').trim()) return 'missing author';
  if (!e.source_page_url && !e.sourceUrl) return 'missing source_page_url';
  return null;
}
export const photoFile = (stem, e) => (e?.file || `${stem}.webp`).split('/').pop();

/**
 * Copy only the stock photos that will actually be used into public/photos (recompressing anything
 * over maxBytes to <= maxWidth webp), drop unused files, and write a filtered public/photos/manifest.json.
 * `wanted(stem)` says whether a story exists and still needs a photo.
 */
export async function syncPhotos(src, { wanted = () => true, dest = PHOTO_DIR, maxBytes = 150_000, maxWidth = 1200 } = {}) {
  const res = { ok: false, used: [], skipped: [], recompressed: [], removed: [], notNeeded: [] };
  let man;
  try { man = parseManifest(JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'))); } catch { return res; }
  res.ok = true;
  let sharp = null;
  try { sharp = (await import('sharp')).default; } catch { /* copy as-is */ }
  fs.mkdirSync(dest, { recursive: true });
  const keep = {}, keepFiles = new Set();
  for (const [stem, e] of Object.entries(man)) {
    const problem = entryProblem(e) || (fs.existsSync(path.join(src, photoFile(stem, e))) ? null : 'file missing');
    if (problem) { res.skipped.push({ stem, reason: problem }); continue; }
    if (!wanted(stem)) { res.notNeeded.push(stem); continue; }
    const f = photoFile(stem, e), from = path.join(src, f), to = path.join(dest, f);
    let buf = fs.readFileSync(from);
    if (buf.length > maxBytes && sharp) {
      // keep the width (the manifest's "changes" note says 1200px wide); lower quality until under maxBytes
      // cards are 16:9 object-fit:cover, so capping height at 3:4 of the width hides nothing visible
      for (const q of [72, 64, 56, 50]) {
        buf = await sharp(fs.readFileSync(from)).resize({ width: maxWidth, height: Math.round(maxWidth * 0.75), fit: 'cover', position: 'attention', withoutEnlargement: true }).webp({ quality: q, effort: 6 }).toBuffer();
        if (buf.length <= maxBytes) break;
      }
      res.recompressed.push(`${f} ${Math.round(fs.statSync(from).size / 1024)}KB -> ${Math.round(buf.length / 1024)}KB`);
    }
    if (!fs.existsSync(to) || !fs.readFileSync(to).equals(buf)) fs.writeFileSync(to, buf);
    keep[stem] = { ...e, file: f }; keepFiles.add(f); res.used.push(stem);
  }
  for (const f of fs.readdirSync(dest)) if (f.endsWith('.webp') && !keepFiles.has(f)) { fs.unlinkSync(path.join(dest, f)); res.removed.push(f); }
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(keep, null, 1) + '\n');
  return res;
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

/** Short changes note for the credit line, e.g. "cropped" (CC BY / BY-SA require indicating changes). */
export function shortChanges(changes) {
  const c = String(changes || '').toLowerCase();
  if (!c) return null;
  if (/crop/.test(c)) return 'cropped';
  if (/resiz|scal/.test(c)) return 'resized';
  if (/convert|webp/.test(c)) return null; // format conversion only
  return c.length <= 30 ? c : 'modified';
}
const needsChanges = lic => /^cc by/i.test(String(lic || ''));

/** Story fields for a stock photo entry. */
export function stockFields(stem, e = {}) {
  const sourceUrl = e.source_page_url || e.sourceUrl || e.source_url || null;
  const source = sourceName(sourceUrl) || e.source || null;
  const author = e.author || null, license = e.license || null;
  const changes = e.changes || null;
  const imageAttribution = { author, ...(e.author_url || e.authorUrl ? { authorUrl: e.author_url || e.authorUrl } : {}), source, sourceUrl, license,
    ...(e.license_url || e.licenseUrl ? { licenseUrl: e.license_url || e.licenseUrl } : {}), ...(changes ? { changes } : {}) };
  const ch = needsChanges(license) ? shortChanges(changes) : null;
  const filePhoto = /\(file photo\)/i.test(e.alt || '');
  let credit = author || source ? `Photo: ${[author, source].filter(Boolean).join(' / ')}${license ? `, ${license}` : ''}${ch ? ` (${ch})` : ''}` : (e.credit || 'Photo');
  if (filePhoto) credit = `File photo. ${credit}`;
  return { image: `/photos/${photoFile(stem, e)}`, imageAlt: e.alt || null, imageCredit: credit, imageCreditUrl: sourceUrl, imageGenerated: false,
    imageKind: 'stock', imageFilePhoto: filePhoto, imageAttribution };
}

/** A usable stock photo for this story: valid manifest entry + file present in public/photos. */
export const hasPhotoFile = (stem, publicDir = 'public', man = {}) =>
  !!man[stem] && !entryProblem(man[stem]) && fs.existsSync(path.join(publicDir, 'photos', photoFile(stem, man[stem])));
