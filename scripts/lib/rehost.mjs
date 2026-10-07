// Rehost publisher images from hosts that set third-party cookies (e.g. CivicPlus sites like ci.seaside.ca.us set
// ASP.NET_SessionId / CP_IsMobile on image requests, which costs Lighthouse "best practices" points).
// Configure per source in scripts/sources.json:
//   "rehostImages": true                    -> rehost any remote image of that source's stories
//   "rehostImages": ["ci.seaside.ca.us"]     -> rehost only images on these hosts (subdomains match)
// The image is downloaded, resized to <= 1200px wide, saved as public/source-images/<id>.webp and `image` points at
// "/source-images/<id>.webp". imageKind stays 'source'; imageCredit / imageCreditUrl are left untouched.
// On any failure the remote URL is kept and a warning logged (the next run retries).
import fs from 'node:fs';
import path from 'node:path';
import { fetchWithRetry, sourceHeaders } from './http.mjs';

export const REHOST_DIR = 'source-images';
export const localPath = id => `/${REHOST_DIR}/${id}.webp`;
const isRemote = u => /^https?:\/\//i.test(String(u || ''));

/** Map source name -> rehost config (true or [hosts]) for sources that opt in. */
export function rehostConfig(sources = []) {
  const m = new Map();
  for (const s of sources) if (s.rehostImages === true || (Array.isArray(s.rehostImages) && s.rehostImages.length)) m.set(s.name, s);
  return m;
}

/** Should this story's image be rehosted under the given source config? */
export function shouldRehost(story, src) {
  if (!src || !story?.image || story.imageGenerated || story.imageKind === 'stock' || !isRemote(story.image)) return false;
  if (src.rehostImages === true) return true;
  let host; try { host = new URL(story.image).hostname.toLowerCase(); } catch { return false; }
  return src.rehostImages.some(h => { h = String(h).toLowerCase().replace(/^www\./, ''); return host === h || host.endsWith('.' + h); });
}

/** Download + compress one image. Returns { ok, bytes, width, height } or { ok:false, error }. */
export async function rehostImage(story, src, { publicDir = 'public', dry = false, fetchImpl, sharpImpl, maxWidth = 1200, quality = 76, log = console.warn } = {}) {
  const from = story.image;
  try {
    const r = await fetchWithRetry(from, { headers: { ...sourceHeaders(src), Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' }, tries: 2, budgetMs: 20000, timeoutMs: 20000, fetchImpl });
    const type = r.headers?.get?.('content-type') || '';
    if (type && !/^image\//i.test(type)) throw new Error(`not an image (${type})`);
    const input = Buffer.from(await r.arrayBuffer());
    if (!input.length) throw new Error('empty body');
    const sharp = sharpImpl || (await import('sharp')).default;
    const { data, info } = await sharp(input).rotate().resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality, effort: 5 }).toBuffer({ resolveWithObject: true });
    if (!dry) {
      const dir = path.join(publicDir, REHOST_DIR);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${story.id}.webp`), data);
      story.image = localPath(story.id);
    }
    return { ok: true, id: story.id, from, bytes: data.length, width: info.width, height: info.height };
  } catch (e) {
    log(`::warning title=Image rehost failed::${story.source}: ${story.id} ${from} (${e.message}); keeping the remote URL`);
    return { ok: false, id: story.id, from, error: e.message };
  }
}

/** Rehost every opted-in remote image in `stories`; also re-point stories whose file already exists. */
export async function rehostImages(stories, sources, opts = {}) {
  const cfg = rehostConfig(sources), publicDir = opts.publicDir || 'public';
  const out = { rehosted: [], failed: [], reused: 0 };
  for (const s of stories) {
    const src = cfg.get(s.source);
    if (!shouldRehost(s, src)) continue;
    if (!opts.force && fs.existsSync(path.join(publicDir, REHOST_DIR, `${s.id}.webp`))) { if (!opts.dry) s.image = localPath(s.id); out.reused++; continue; }
    const r = await rehostImage(s, src, opts);
    (r.ok ? out.rehosted : out.failed).push(r);
  }
  return out;
}

/** Delete rehosted files no story points at any more (e.g. pruned or merged stories). */
export function pruneRehosted(stories, { publicDir = 'public' } = {}) {
  const dir = path.join(publicDir, REHOST_DIR);
  if (!fs.existsSync(dir)) return [];
  const used = new Set(stories.map(s => s.image).filter(u => String(u || '').startsWith(`/${REHOST_DIR}/`)).map(u => path.basename(u)));
  const removed = [];
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.webp') && !used.has(f)) { fs.unlinkSync(path.join(dir, f)); removed.push(f); }
  return removed;
}
