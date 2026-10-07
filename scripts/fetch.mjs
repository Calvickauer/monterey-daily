import { XMLParser } from 'fast-xml-parser';
import { categorize } from './categorize.mjs';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const UA = 'MontereyDaily/1.0 (+https://github.com/Calvickauer/monterey-daily; contact: calvickauer@users.noreply.github.com)';
const OUT = 'src/content/stories';
const sources = JSON.parse(fs.readFileSync('scripts/sources.json','utf8')).filter(s => s.status?.startsWith('working'));
const PLACES = /\b(monterey|salinas|seaside|marina|carmel|pacific grove|big sur|castroville|gonzales|soledad|greenfield|king city|moss landing|pebble beach|prunedale|chualar|pajaro|aromas|del rey oaks|sand city|carmel valley|fort ord|elkhorn slough|watsonville)\b/i;
const FILTER = /lookout|kqed|pajaronian/i;
const p = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@' });
const txt = v => (v==null?'':typeof v==='object'?(v['#text']??''):String(v));
const strip = s => txt(s).replace(/<[^>]+>/g,' ').replace(/&#8217;|&rsquo;/g,"'").replace(/&#8220;|&#8221;|&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;|&#160;/g,' ').replace(/&#\d+;/g,'').replace(/\s+/g,' ').trim();
const short = s => { s=strip(s); return s.length>240 ? s.slice(0,s.lastIndexOf(' ',237))+'…' : s; };
const CATS = [
 ['weather',/\b(weather|storm|rain|heat|wind advisory|forecast|flood watch|red flag|surf advisory)\b/i],
 ['public-safety',/\b(police|sheriff|fire|crash|arrest|shooting|homicide|chp|collision|suspect|court|sentenc|da |district attorney|evacuat|missing|stabb|robbery)\b/i],
 ['sports',/\b(football|basketball|baseball|soccer|volleyball|game|playoff|coach|athlet|golf|tournament|laguna seca|racing)\b/i],
 ['environment',/\b(ocean|coast|beach|whale|marine|wildlife|sanctuary|climate|water|drought|otter|fish|kelp|habitat|mbari|deep.sea|environment)\b/i],
 ['government',/\b(council|supervisors|board|county|city|mayor|election|ballot|measure|budget|ordinance|state|policy|vote|grant)\b/i],
 ['business',/\b(business|restaurant|jobs|econom|housing|tourism|company|develop|agricultur|farm|wine|opens|store|lettuce)\b/i],
];
const cat = (t, s) => (s.name.includes('NWS')?'weather':CATS.find(([,r])=>r.test(t))?.[0]) || 'community';
async function get(url){ const r = await fetch(url,{headers:{'User-Agent':UA,'Accept':'*/*'},signal:AbortSignal.timeout(20000)}); if(!r.ok) throw new Error(r.status); return r.text(); }
async function og(url){ try{ const h=(await get(url)).slice(0,200000); return h.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]||h.match(/content=["']([^"']+)["'][^>]+property=["']og:image/i)?.[1]||null; }catch{return null;} }
const report = []; const items = [];
for (const s of sources) {
  try {
    let list = [];
    if (s.type==='api') {
      const j = JSON.parse(await get(s.feed_url));
      list = j.features.map(f=>({title:`${f.properties.event}: ${f.properties.areaDesc.split(';').slice(0,3).join(',')}`, link:f.properties['@id']||f.id, date:f.properties.sent, summary:f.properties.headline||f.properties.description, image:null}));
    } else {
      const x = p.parse(await get(s.feed_url)); const ch = x.rss?.channel; let raw = ch?.item ?? x.feed?.entry ?? []; if(!Array.isArray(raw)) raw=[raw];
      list = raw.slice(0,30).map(i=>{ const html = txt(i['content:encoded'])||txt(i.description);
        const mc=[].concat(i['media:content']||[],i['media:thumbnail']||[],i.enclosure||[]).find(m=>m?.['@url']&&!/audio|video/.test(m['@type']||''));
        return {title:strip(i.title), link:txt(i.link?.['@href']??i.link).trim(), date:txt(i.pubDate||i.published||i['dc:date']), summary:i.description||html, image: mc?.['@url'] || html.match(/<img[^>]+src=["']([^"']+)/i)?.[1] || null}; });
    }
    if (/KION/.test(s.name)) list = list.filter(i=>!/\/(national-world|cnn-style|noticias-cnn|cnn-[a-z-]+)\//.test(i.link));
    if (FILTER.test(s.name)) list = list.filter(i=>PLACES.test(i.title+' '+strip(i.summary)));
    if (/Voices/.test(s.name)) list = list.slice(0,15);
    let n=0;
    for (const i of list) { if(!i.title||!i.link) continue; const d=new Date(i.date); i.date=isNaN(d)?new Date().toISOString():d.toISOString(); i.link=i.link.replace(/^http:\/\//i,'https://'); i.source=s.name; i.sourceUrl=s.url; items.push(i); n++; }
    report.push(`${s.name}: ${n}`);
  } catch(e){ report.push(`${s.name}: FAILED (${e.message})`); }
}
const norm = t => t.toLowerCase().replace(/[^a-z0-9 ]/g,'').split(' ').filter(w=>w.length>3).slice(0,8).join(' ');
const seen = new Set(fs.readdirSync(OUT).map(f=>JSON.parse(fs.readFileSync(path.join(OUT,f))).link));
const titles = new Set(fs.readdirSync(OUT).map(f=>norm(JSON.parse(fs.readFileSync(path.join(OUT,f))).headline)));
let added=0;
for (const i of items.sort((a,b)=>b.date.localeCompare(a.date))) {
  const id = i.date.slice(0,10)+'-'+crypto.createHash('sha1').update(i.link).digest('hex').slice(0,10);
  const key = norm(i.title);
  if (seen.has(i.link) || titles.has(key)) continue;
  seen.add(i.link); titles.add(key);
  if (!i.image && i.source!=='NWS alerts – Monterey County zones' && !/County of Monterey|Seaside|Marina/.test(i.source)) i.image = await og(i.link);
  const story = { headline:i.title, summary:short(i.summary)||i.title, source:i.source, sourceUrl:i.sourceUrl, link:i.link, date:i.date, category:null, image:i.image||null, imageCredit:i.image?`Image: ${i.source}`:null };
  story.category = categorize(story);
  fs.writeFileSync(path.join(OUT,id+'.json'), JSON.stringify(story,null,2)); added++;
}
console.log(report.join('\n')); console.log(`added ${added}`);
