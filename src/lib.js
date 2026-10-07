const mods = import.meta.glob('./content/stories/*.json', { eager: true });
export const stories = Object.entries(mods).map(([p,m])=>({id:p.split('/').pop().replace('.json',''),...m.default})).sort((a,b)=>b.date.localeCompare(a.date));
export const CATS = { government:'Government', 'public-safety':'Public Safety', environment:'Environment & Coast', business:'Business', community:'Community', sports:'Sports', weather:'Weather' };
export const B = import.meta.env.BASE_URL.replace(/\/$/,'');
export const day = d => new Date(d).toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});
export const fmt = d => new Date(d).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' PT';
import publishedDays from './data/published-days.json';
/** Every archive day ever published (stories' days + days kept after dedupe emptied them). */
export const archiveDays = [...new Set([...publishedDays, ...stories.map(s=>day(s.date))])].sort().reverse();
const normTitle = t => String(t||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const titleCount = stories.reduce((m,s)=>{ const k=normTitle(s.headline); m.set(k,(m.get(k)||0)+1); return m; }, new Map());
/** True when another story has the same headline (e.g. repeated "Evacuation Zone Updates" releases). */
export const titleCollides = s => (titleCount.get(normTitle(s.headline))||0) > 1;
export const shortDate = d => new Date(d).toLocaleDateString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric'});
