// Before/after check of summary cleanup against the real feeds.
// Usage: node scripts/summary-report.mjs [perSource=3] [--dir=/path/with/<slug>.xml cached feeds]
import { XMLParser } from 'fast-xml-parser'; import fs from 'node:fs';
import { summarize } from './summarize.mjs';
const UA = 'MontereyDaily/1.0 (+https://github.com/Calvickauer/monterey-daily; contact: calvickauer@users.noreply.github.com)';
const N = Number(process.argv.find(a => /^\d+$/.test(a)) || 3);
const dir = process.argv.find(a => a.startsWith('--dir='))?.slice(6);
const txt = v => (v == null ? '' : typeof v === 'object' ? (v['#text'] ?? '') : String(v));
// Previous implementation, kept here only for comparison.
const oldStrip = s => txt(s).replace(/<[^>]+>/g,' ').replace(/&#8217;|&rsquo;/g,"'").replace(/&#8220;|&#8221;|&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;|&#160;/g,' ').replace(/&#\d+;/g,'').replace(/\s+/g,' ').trim();
const oldShort = s => { s = oldStrip(s); return s.length > 240 ? s.slice(0, s.lastIndexOf(' ', 237)) + '…' : s; };
const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
const sources = JSON.parse(fs.readFileSync('scripts/sources.json', 'utf8')).filter(s => s.status?.startsWith('working') && s.type === 'rss');
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
let changed = 0, total = 0, maxLen = 0;
for (const s of sources) {
  let xml;
  try { xml = dir ? fs.readFileSync(`${dir}/${slug(s.name)}.xml`, 'utf8') : await (await fetch(s.feed_url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })).text(); }
  catch (e) { console.log(`\n## ${s.name}: fetch failed (${e.message})`); continue; }
  let raw; try { const x = p.parse(xml); raw = x.rss?.channel?.item ?? x.feed?.entry ?? []; } catch { raw = []; }
  if (!Array.isArray(raw)) raw = [raw];
  if (!raw.length) { console.log(`\n## ${s.name}: no items (blocked/rate-limited?)`); continue; }
  console.log(`\n## ${s.name}`);
  for (const i of raw.slice(0, N)) {
    const html = txt(i['content:encoded']) || txt(i.description); const desc = i.description || html;
    let after = summarize(desc, { title: txt(i.title), source: s.name });
    if (after.length < 60 && html) { const b = summarize(html, { title: txt(i.title), source: s.name }); if (b.length > after.length) after = b; }
    const before = oldShort(desc); total++; if (before !== after) changed++; maxLen = Math.max(maxLen, after.length);
    console.log(`- ${oldStrip(i.title)}\n  BEFORE (${before.length}): ${before}\n  AFTER  (${after.length}): ${after}`);
  }
}
console.log(`\n${changed}/${total} summaries changed; longest new summary ${maxLen} chars.`);
