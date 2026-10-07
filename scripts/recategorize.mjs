// Re-run categorize() over the archive and rewrite changed stories (node scripts/recategorize.mjs [--dry]).
import fs from 'node:fs';
import { categorize } from './categorize.mjs';
import { loadArchive, writeStory, OUT } from './lib/store.mjs';
const dry = process.argv.includes('--dry'); let changed = 0, removed = 0;
for (const s of loadArchive()) {
  // (kept from the original script) drop CNN wire paths and non-local NWS alerts
  if (/\/(national-world|cnn-style|noticias-cnn|cnn-[a-z-]+)\//.test(s.link) || (/NWS/.test(s.source) && /North Bay|San Francisco|Sonoma/.test(s.headline) && !/Monterey|Salinas|Big Sur/.test(s.headline))) {
    console.log(`remove | ${s.id} | ${s.headline.slice(0, 80)}`); removed++; if (!dry) fs.unlinkSync(`${OUT}/${s.id}.json`); continue;
  }
  const c = categorize(s);
  if (c === s.category) continue;
  console.log(`${s.category} -> ${c} | ${s.id} | ${s.headline.slice(0, 80)}`);
  s.category = c; changed++;
  if (!dry) writeStory(s);
}
console.log({ changed, removed, dry });
