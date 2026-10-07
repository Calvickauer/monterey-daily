// Archive I/O: src/content/stories/<id>.json (one story per file; the UI globs these).
import fs from 'node:fs';
import path from 'node:path';
import { dedupeStories } from './dedupe.mjs';

export const OUT = 'src/content/stories';
const ORDER = ['headline', 'summary', 'source', 'sourceUrl', 'link', 'date', 'category', 'image', 'imageAlt', 'imageCredit', 'imageCreditUrl', 'imageGenerated', 'imageKind', 'imageFilePhoto', 'imageAttribution', 'alsoCoveredBy'];

/** Fill contract fields: imageGenerated (bool), imageAlt (string|null), imageAttribution (object|null), alsoCoveredBy (array) are always present. */
export function withDefaults(s) {
  const o = { ...s };
  if (o.imageAlt === undefined || o.imageAlt === '') o.imageAlt = null;
  if (o.imageAttribution === undefined) o.imageAttribution = null;
  if (o.imageCreditUrl === undefined) o.imageCreditUrl = null;
  o.imageGenerated = !!o.imageGenerated;
  if (!Array.isArray(o.alsoCoveredBy)) o.alsoCoveredBy = [];
  return o;
}

export function serialize(s) {
  const o = withDefaults(s), out = {};
  for (const k of ORDER) if (k in o && !(o[k] === undefined)) out[k] = o[k];
  for (const k of Object.keys(o)) if (!(k in out) && k !== 'id' && !k.startsWith('_') && o[k] !== undefined) out[k] = o[k];
  return JSON.stringify(out, null, 2) + '\n';
}

export function loadArchive(dir = OUT) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => ({ id: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

export function writeStory(s, dir = OUT) {
  const p = path.join(dir, s.id + '.json'), body = serialize(s);
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== body) { fs.writeFileSync(p, body); return true; }
  return false;
}

/**
 * Dedupe `stories` (archive + any new, each with an `id`), delete loser files that exist on disk
 * and their generated images. Returns { kept, removed, stats }. Does not write kept stories.
 */
export function dedupeAndPrune(stories, opts = {}, dir = OUT) {
  const res = dedupeStories(stories, opts);
  const keptIds = new Set(res.kept.map(s => s.id));
  for (const r of res.removed) {
    if (keptIds.has(r.story.id)) continue;
    const p = path.join(dir, r.story.id + '.json');
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return res;
}
