// One-off / maintenance: remove archived NWS alert stories that don't apply to Monterey County.
// Archived alerts only keep headline/summary, so the check is textual (fetch.mjs filters on SAME/UGC codes).
import fs from 'node:fs';
import { loadArchive, OUT } from './lib/store.mjs';
const MONTEREY_AREA = /monterey|salinas|big sur|santa lucia|arroyo seco|lake san antonio|pinnacles|carmel|los padres/i;
const dry = process.argv.includes('--dry'); let removed = 0, kept = 0;
for (const s of loadArchive()) {
  if (!/NWS/.test(s.source)) continue;
  const areas = s.headline.split(':').slice(1).join(':');
  if (MONTEREY_AREA.test(areas)) { kept++; continue; }
  console.log(`${dry ? 'would remove' : 'removed'}: ${s.id} | ${s.headline}`);
  if (!dry) fs.unlinkSync(`${OUT}/${s.id}.json`); removed++;
}
console.log({ nwsKept: kept, nwsRemoved: removed, dry });
