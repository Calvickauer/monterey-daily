import fs from 'node:fs'; import { categorize } from './categorize.mjs';
const D='src/content/stories'; let ch=0, rm=0;
for (const f of fs.readdirSync(D)) { const p=`${D}/${f}`, s=JSON.parse(fs.readFileSync(p));
  if (/\/(national-world|cnn-style|noticias-cnn|cnn-[a-z-]+)\//.test(s.link) || (/NWS/.test(s.source) && /North Bay|San Francisco|Sonoma/.test(s.headline) && !/Monterey|Salinas|Big Sur/.test(s.headline))) { fs.unlinkSync(p); rm++; continue; }
  const c=categorize(s); if (c!==s.category) { console.log(`${s.category} -> ${c} | ${s.headline.slice(0,80)}`); s.category=c; fs.writeFileSync(p, JSON.stringify(s,null,2)); ch++; } }
console.log({changed:ch, removed:rm});
