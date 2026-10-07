// Append every archive day that has stories to src/data/published-days.json, so a day page stays
// published (with a notice) even if dedupe later moves all of its stories elsewhere. Run after fetch.
import fs from 'node:fs';
const F = 'src/data/published-days.json', D = 'src/content/stories';
const day = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const prev = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : [];
const days = new Set(prev);
for (const f of fs.readdirSync(D)) if (f.endsWith('.json')) days.add(day(JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8')).date));
const out = [...days].sort();
if (out.length !== prev.length) fs.writeFileSync(F, JSON.stringify(out, null, 1) + '\n');
console.log(`published days: ${out.length} (${out.length - prev.length} new)`);
