import { fetchWithRetry } from './http.mjs';
// Publisher og:image lookup (real images first: feed image, then og:image).
export const NO_OG = /NWS|County of Monterey|Seaside|Marina|Pacific Grove/;
export async function ogImage(url, ua) {
  try {
    const r = await fetchWithRetry(url, { headers: { 'User-Agent': ua, Accept: 'text/html,*/*' }, timeoutMs: 15000, tries: 2, budgetMs: 10000 });
    const h = (await r.text()).slice(0, 200000);
    const m = h.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)/i) || h.match(/content=["']([^"']+)["'][^>]+property=["']og:image/i);
    const img = m?.[1]?.replace(/&amp;/g, '&') || null;
    if (!img || /logo|default|placeholder|favicon/i.test(img)) return null;
    return new URL(img, url).href.replace(/^http:\/\//i, 'https://');
  } catch { return null; }
}
