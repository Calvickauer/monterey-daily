// One-off / maintenance: dedupe the whole archive in place.  node scripts/dedupe-archive.mjs [--dry]
import { loadArchive, dedupeAndPrune, writeStory } from './lib/store.mjs';
import { dedupeStories } from './lib/dedupe.mjs';
const dry = process.argv.includes('--dry');
const all = loadArchive();
const res = dry ? dedupeStories(all) : dedupeAndPrune(all);
for (const r of res.removed) console.log(`${r.reason.padEnd(11)} drop [${r.story.source}] ${r.story.headline}\n      keep [${r.keptAs.source}] ${r.keptAs.headline}`);
let written = 0;
if (!dry) for (const s of res.kept) if (writeStory(s)) written++;
console.log({ before: all.length, after: res.kept.length, removedByUrl: res.stats.removedUrl, removedByHeadline: res.stats.removedFuzzy, removedSpanishTranslation: res.stats.removedTranslation,
  clustersWithAlsoCoveredBy: res.stats.clusters, filesWritten: written, dry });
