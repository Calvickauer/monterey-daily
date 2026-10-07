// Served at /monterey-daily/robots.txt. NOTE: crawlers only honor robots.txt at the host root
// (https://calvickauer.github.io/robots.txt), so also submit the sitemap in Search Console.
import { abs } from '../site.js';
export function GET() {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
