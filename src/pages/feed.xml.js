// RSS 2.0 feed of Monterey Daily itself. Each item links to (and uses as guid) the ORIGINAL article, credits the outlet.
import { stories, CATS } from '../lib.js';
import { SITE, SITE_URL, abs, outletFor, xmlEscape as x } from '../site.js';

export function GET() {
  const items = stories.slice(0, 50);
  const rfc822 = d => new Date(d).toUTCString();
  const body = items.map(s => {
    const o = outletFor(s);
    const summary = s.summary && s.summary !== s.headline ? `${s.summary} ` : '';
    return `  <item>
    <title>${x(s.headline)}</title>
    <link>${x(s.link)}</link>
    <guid isPermaLink="true">${x(s.link)}</guid>
    <pubDate>${rfc822(s.date)}</pubDate>
    <description>${x(`${summary}(via ${o.name})`)}</description>
    <source url="${x(o.feed || o.url)}">${x(o.name)}</source>
    ${CATS[s.category] ? `<category>${x(CATS[s.category])}</category>` : ''}
  </item>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${x(SITE.name)}</title>
  <link>${SITE_URL}</link>
  <description>${x(SITE.tagline)}</description>
  <language>en-us</language>
  <lastBuildDate>${rfc822(items[0]?.date || Date.now())}</lastBuildDate>
  <ttl>720</ttl>
  <atom:link href="${abs('feed.xml')}" rel="self" type="application/rss+xml"/>
  <image><url>${abs('logo.png')}</url><title>${x(SITE.name)}</title><link>${SITE_URL}</link><width>144</width><height>144</height></image>
${body}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
