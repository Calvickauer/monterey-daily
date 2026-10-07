const mods = import.meta.glob('./content/stories/*.json', { eager: true });
export const stories = Object.entries(mods).map(([p,m])=>({id:p.split('/').pop().replace('.json',''),...m.default})).sort((a,b)=>b.date.localeCompare(a.date));
export const CATS = { government:'Government', 'public-safety':'Public Safety', environment:'Environment & Coast', business:'Business', community:'Community', sports:'Sports', weather:'Weather' };
export const B = import.meta.env.BASE_URL.replace(/\/$/,'');
export const day = d => new Date(d).toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});
export const fmt = d => new Date(d).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' PT';
