import { XMLParser } from 'fast-xml-parser';
import { categorize } from './categorize.mjs';
import { cleanText, summarize } from './summarize.mjs';
import fs from 'node:fs'; import crypto from 'node:crypto';
import { normalizeUrl } from './lib/dedupe.mjs';
import { loadArchive, dedupeAndPrune, writeStory } from './lib/store.mjs';
import { assignImages } from './lib/illustrations.mjs';
import { ogImage, NO_OG } from './lib/og.mjs';
import { fetchWithRetry, sourceHeaders } from './lib/http.mjs';
const UA = 'MontereyDaily/1.0 (+https://github.com/Calvickauer/monterey-daily; contact: calvickauer@users.noreply.github.com)';
const DRY = process.argv.includes('--dry'); // fetch + report, write nothing
const T0 = Date.now();
const sources = JSON.parse(fs.readFileSync('scripts/sources.json','utf8')).filter(s => s.status?.startsWith('working'));
const PLACES = /\b(monterey|salinas|seaside|marina|carmel|pacific grove|big sur|castroville|gonzales|soledad|greenfield|king city|moss landing|pebble beach|prunedale|chualar|pajaro|aromas|del rey oaks|sand city|carmel valley|fort ord|elkhorn slough|watsonville)\b/i;
const FILTER = /lookout|kqed|pajaronian/i;
const p = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@' });
const txt = v => (v==null?'':typeof v==='object'?(v['#text']??''):String(v));
const strip = s => cleanText(s).replace(/\s+/g,' ');
// 1–2 sentence teaser (never full text); fall back to full content only when the description is thin.
const short = (i) => { const o={title:i.title,source:i.source}; const a=summarize(i.summary,o); return a.length>=60||!i.alt ? a : (summarize(i.alt,o).length>a.length ? summarize(i.alt,o) : a); };
const CATS = [
 ['weather',/\b(weather|storm|rain|heat|wind advisory|forecast|flood watch|red flag|surf advisory)\b/i],
 ['public-safety',/\b(police|sheriff|fire|crash|arrest|shooting|homicide|chp|collision|suspect|court|sentenc|da |district attorney|evacuat|missing|stabb|robbery)\b/i],
 ['sports',/\b(football|basketball|baseball|soccer|volleyball|game|playoff|coach|athlet|golf|tournament|laguna seca|racing)\b/i],
 ['environment',/\b(ocean|coast|beach|whale|marine|wildlife|sanctuary|climate|water|drought|otter|fish|kelp|habitat|mbari|deep.sea|environment)\b/i],
 ['government',/\b(council|supervisors|board|county|city|mayor|election|ballot|measure|budget|ordinance|state|policy|vote|grant)\b/i],
 ['business',/\b(business|restaurant|jobs|econom|housing|tourism|company|develop|agricultur|farm|wine|opens|store|lettuce)\b/i],
];
// NWS: Monterey County = SAME/FIPS 006053, county zone CAC053, forecast zones below (MTR, matches sources.json query).
const MONTEREY_UGC = new Set(['CAC053','CAZ516','CAZ517','CAZ518','CAZ528','CAZ529','CAZ530']);
const MONTEREY_AREA = /monterey|salinas|big sur|santa lucia|arroyo seco|lake san antonio|pinnacles|carmel|los padres/i;
const montereyAreas = p => String(p.areaDesc||'').split(';').map(a=>a.trim()).filter(a=>MONTEREY_AREA.test(a));
const appliesToMonterey = p => { const g=p.geocode||{}; const geo=(g.SAME||[]).includes('006053') || (g.UGC||[]).some(z=>MONTEREY_UGC.has(z)) || (p.affectedZones||[]).some(u=>MONTEREY_UGC.has(String(u).split('/').pop()));
  return geo && (montereyAreas(p).length>0 || (g.UGC||[]).some(z=>MONTEREY_UGC.has(z))); };
const cat = (t, s) => (s.name.includes('NWS')?'weather':CATS.find(([,r])=>r.test(t))?.[0]) || 'community';
// Shared fetch helper: per-source UA/headers (sources.json "user_agent"/"headers"), retry on 429/5xx with backoff.
async function get(url, src = {}){ const r = await fetchWithRetry(url,{headers:sourceHeaders(src),timeoutMs:20000,log:m=>console.warn(m)}); return r.text(); }
const report = []; const items = [];
for (const s of sources) {
  try {
    let list = [];
    if (s.type==='api') {
      const j = JSON.parse(await get(s.feed_url, s));
      // Keep only alerts that apply to Monterey County (SAME 006053 / Monterey UGC zones) and title them with the
      // Monterey County zones only (multi-county alerts list e.g. Sonoma zones first).
      list = j.features.filter(f=>appliesToMonterey(f.properties)).map(f=>{ const p=f.properties; const areas=montereyAreas(p);
        return {title:`${p.event}: ${areas.length ? areas.slice(0,3).join(', ') : 'Monterey County'}`, link:p['@id']||f.id, date:p.sent, summary:p.headline||p.description, image:null}; });
    } else {
      const x = p.parse(await get(s.feed_url, s)); const ch = x.rss?.channel; let raw = ch?.item ?? x.feed?.entry ?? []; if(!Array.isArray(raw)) raw=[raw];
      list = raw.slice(0,30).map(i=>{ const html = txt(i['content:encoded'])||txt(i.description);
        const mc=[].concat(i['media:content']||[],i['media:thumbnail']||[],i.enclosure||[]).find(m=>m?.['@url']&&!/audio|video/.test(m['@type']||''));
        const img = html.match(/<img[^>]*>/i)?.[0] || '';
        const image = mc?.['@url'] || img.match(/src=["']([^"']+)/i)?.[1] || null;
        // alt text for real photos when the feed provides one (media:description/title, or the <img alt>)
        const imgAlt = mc?.['@url'] ? strip(mc['media:description'] ?? mc['media:title'] ?? '') : strip(img.match(/alt=["']([^"']*)/i)?.[1] || '');
        return {title:strip(i.title), link:txt(i.link?.['@href']??i.link).trim(), date:txt(i.pubDate||i.published||i['dc:date']), summary:i.description||html, alt:html, image, imageAlt: image && imgAlt ? imgAlt.slice(0,300) : null}; });
    }
    if (/KION/.test(s.name)) list = list.filter(i=>!/\/(national-world|cnn-style|noticias-cnn|cnn-[a-z-]+)\//.test(i.link));
    if (FILTER.test(s.name) || /KION/.test(s.name)) list = list.filter(i=>PLACES.test(i.title+' '+strip(i.summary)));
    if (/Voices/.test(s.name)) list = list.slice(0,15);
    // City of Pacific Grove (Revize): titles+links only; links still use the old .org domain (301 -> .gov).
    // No pubDate: the date falls back to the time the item is first seen (archived items are never re-dated).
    if (/Pacific Grove/.test(s.name)) {
      list = list.map(i=>({...i, link:i.link.replace(/^https?:\/\/(www\.)?cityofpacificgrove\.org/i,'https://www.cityofpacificgrove.gov'), summary:null, alt:null, image:null, imageAlt:null}));
      // Revize ids (news_detail_T3_R<n>) increase over time; drop long-stale pinned items (e.g. R95 from 2020).
      const rid = u => +(u.match(/_R(\d+)/)?.[1] || 0), max = Math.max(0, ...list.map(i=>rid(i.link)));
      list = list.filter(i => !rid(i.link) || rid(i.link) >= max - 100);
    }
    // BigSurKate: description is only "The post X appeared first on BigSurKate" filler; use the headline. Credit is required (source name).
    if (/BigSurKate/.test(s.name)) list = list.map(i=>({...i, summary: /appeared first on/i.test(strip(i.summary)) ? null : i.summary, alt:null}));
    let n=0;
    for (const i of list) { if(!i.title||!i.link) continue; const d=new Date(i.date); i.date=isNaN(d)?new Date().toISOString():d.toISOString(); i.link=i.link.replace(/^http:\/\//i,'https://'); i.source=s.name; i.sourceUrl=s.url; items.push(i); n++; }
    report.push(`${s.name}: ${n}`);
  } catch(e){ report.push(`${s.name}: FAILED (${e.message})`); console.warn(`::warning title=Feed skipped::${s.name}: ${e.message} (continuing without it)`); }
}
// ---- merge with archive, dedupe (URL + fuzzy headline), write ----
const archive = loadArchive();
// Known = archived links + links already folded into a story's alsoCoveredBy (so re-seen duplicates stay merged).
const known = new Set(archive.flatMap(s => [s.link, ...(s.alsoCoveredBy || []).map(e => e.url)]).map(normalizeUrl));
const fresh = []; const freshKeys = new Set();
for (const i of items.sort((a,b)=>b.date.localeCompare(a.date))) {
  const key = normalizeUrl(i.link);
  if (freshKeys.has(key)) continue; freshKeys.add(key);
  const id = i.date.slice(0,10)+'-'+crypto.createHash('sha1').update(i.link).digest('hex').slice(0,10);
  const story = { id, headline:i.title, summary:short(i)||i.title, source:i.source, sourceUrl:i.sourceUrl, link:i.link, date:i.date, category:null, image:i.image||null, imageAlt:i.imageAlt||null, imageCredit:i.image?`Image: ${i.source}`:null, imageGenerated:false, alsoCoveredBy:[] };
  story.category = categorize(story);
  story._new = !known.has(key);
  fresh.push(story);
}
// Items already archived (same normalized URL) are skipped. Everything else is clustered together with the
// whole archive, so an item previously merged into another story just re-merges (alsoCoveredBy is idempotent).
const all = [...archive, ...fresh.filter(s => s._new)];
const res = DRY ? (await import('./lib/dedupe.mjs')).dedupeStories(all) : dedupeAndPrune(all);
const archiveIds = new Set(archive.map(s => s.id));
const keptNew = res.kept.filter(s => !archiveIds.has(s.id));
// Real publisher images first (feed image, then og:image); illustrations only for stories with neither.
for (const s of keptNew) if (!s.image && !NO_OG.test(s.source)) { const im = await ogImage(s.link, UA); if (im) { s.image = im; s.imageAlt = null; s.imageCredit = `Image: ${s.source}`; } }
const img = assignImages(res.kept, { only: new Set(keptNew.map(s => s.id)) });
let written = 0;
if (!DRY) for (const s of res.kept) { delete s._new; if (writeStory(s)) written++; }
console.log(report.join('\n'));
console.log(`fetched ${items.length}, new ${fresh.filter(s=>s._new).length}, added ${keptNew.length}`);
for (const r of res.removed) if (r.reason !== 'url') console.log(`  ${r.reason} merge: [${r.story.source}] ${r.story.headline.slice(0, 90)}\n      into [${r.keptAs.source}] ${r.keptAs.headline.slice(0, 90)}`);
console.log(`dedupe: removed ${res.stats.removedUrl} by URL, ${res.stats.removedFuzzy} by headline, ${res.stats.removedTranslation} Spanish translations; archive ${archive.length} -> ${res.kept.length}`);
console.log(`images: ${img.source} source, ${img.stock} stock (${img.stockNew} newly wired), ${img.illustration} illustration (${img.illustrationsChanged} assigned this run ${JSON.stringify(img.byCategory)}), ${img.none} without image`);
console.log(`files written ${written}${DRY?' (dry run)':''}; ${Math.round((Date.now()-T0)/1000)}s`);
