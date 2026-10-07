// One-off/backfill: re-clean stored story headlines + summaries with scripts/summarize.mjs.
// Usage: node scripts/resummarize.mjs [--dry]
import fs from 'node:fs'; import { cleanText, summarize } from './summarize.mjs';
const D = 'src/content/stories'; const dry = process.argv.includes('--dry'); let ch = 0;
for (const f of fs.readdirSync(D)) {
  const p = `${D}/${f}`; const s = JSON.parse(fs.readFileSync(p));
  const headline = cleanText(s.headline).replace(/\s+/g, ' ');
  const summary = summarize(s.summary, { title: headline, source: s.source }) || headline; // nothing usable: fall back to the headline (cards hide a summary that equals it)
  if (headline === s.headline && summary === s.summary) continue;
  ch++; console.log(`- ${headline}\n  BEFORE: ${s.summary}\n  AFTER:  ${summary}`);
  if (!dry) fs.writeFileSync(p, JSON.stringify({ ...s, headline, summary }, null, 2));
}
console.log(`${dry ? 'would change' : 'changed'} ${ch} stories`);
