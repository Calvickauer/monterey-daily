// sitemap.xml regenerated on every build from the same stories/categories/archive days the pages use.
import { stories, CATS, day } from '../lib.js';
import { abs } from '../site.js';

export function GET() {
  const latest = list => list.reduce((m, s) => (s.date > m ? s.date : m), '').slice(0, 10) || undefined;
  const urls = [
    { loc: abs(''), lastmod: latest(stories), changefreq: 'daily', priority: '1.0' },
    ...Object.keys(CATS).map(c => ({ c, list: stories.filter(s => s.category === c) })).filter(e => e.list.length)
      .map(e => ({ loc: abs(`category/${e.c}/`), lastmod: latest(e.list), changefreq: 'daily', priority: '0.8' })),
    { loc: abs('archive/'), lastmod: latest(stories), changefreq: 'daily', priority: '0.5' },
    ...[...new Set(stories.map(s => day(s.date)))].sort().reverse()
      .map(d => ({ loc: abs(`archive/${d}/`), lastmod: latest(stories.filter(s => day(s.date) === d)), changefreq: 'monthly', priority: '0.4' })),
    { loc: abs('about/'), changefreq: 'monthly', priority: '0.3' },
    { loc: abs('sources/'), lastmod: latest(stories), changefreq: 'monthly', priority: '0.3' },
    { loc: abs('search/'), changefreq: 'monthly', priority: '0.2' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
