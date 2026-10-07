import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, titleTokens, jaccard, dedupeStories, findResidualDuplicates } from '../scripts/lib/dedupe.mjs';
import { assignIllustrations, assignImages, canonicalFolder, hashIndex } from '../scripts/lib/illustrations.mjs';
import { isSpanish, statusConflict } from '../scripts/lib/dedupe.mjs';
import { parseManifest, sourceName, stockFields } from '../scripts/lib/photos.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { serialize } from '../scripts/lib/store.mjs';

test('normalizeUrl collapses scheme, www, tracking, trailing slash, fragments', () => {
  const k = 'example.com/news/story-1';
  for (const u of [
    'https://www.example.com/news/story-1/',
    'http://example.com/news/story-1',
    'https://EXAMPLE.com/news/story-1?utm_source=rss&utm_medium=feed',
    'https://www.example.com/news/story-1#comments',
    'https://example.com/news/story-1/?fbclid=abc&gclid=x',
    'example.com/news/story-1',
  ]) assert.equal(normalizeUrl(u), k, u);
});

test('normalizeUrl collapses AMP variants', () => {
  const k = 'example.com/news/story-1';
  for (const u of [
    'https://example.com/news/story-1/amp/',
    'https://example.com/news/story-1/amp',
    'https://example.com/news/story-1?amp',
    'https://example.com/news/story-1?amp=1',
    'https://amp.example.com/news/story-1',
    'https://www-example-com.cdn.ampproject.org/c/s/www.example.com/news/story-1/amp/',
    'https://www.google.com/amp/s/www.example.com/news/story-1',
    'https://example.com/amp/news/story-1',
  ]) assert.equal(normalizeUrl(u), k, u);
  assert.equal(normalizeUrl('https://example.com/news/story-1.amp.html'), normalizeUrl('https://example.com/news/story-1.html'));
});

test('normalizeUrl keeps id-style query params', () => {
  assert.notEqual(normalizeUrl('https://x.gov/News?id=1'), normalizeUrl('https://x.gov/News?id=2'));
  assert.equal(normalizeUrl('https://x.gov/News?id=1&utm_campaign=z'), normalizeUrl('http://www.x.gov/News/?id=1'));
});

test('titleTokens + jaccard', () => {
  const a = titleTokens('Salinas City Council approves new budget for 2027');
  const b = titleTokens("Salinas city council approves 2027 budget");
  assert.ok(jaccard(a, b) >= 0.6);
  assert.ok(jaccard(titleTokens('Shelter-in-place order lifted after battery fire'), titleTokens('Whale sightings surge in Monterey Bay')) < 0.2);
});

const H = 3600e3, t0 = Date.parse('2026-10-01T12:00:00Z');
const st = (o) => ({ summary: '', image: null, imageGenerated: false, date: new Date(t0).toISOString(), ...o });

test('dedupe: URL variants and cross-outlet headlines; keeps best; alsoCoveredBy', () => {
  const stories = [
    st({ id: 'a', headline: 'Fire burns 200 acres near Big Sur, evacuations ordered', link: 'https://ksbw.com/article/fire-big-sur/1', source: 'KSBW', image: 'https://img/1.jpg', summary: 'x'.repeat(200) }),
    st({ id: 'b', headline: 'Fire burns 200 acres near Big Sur, evacuations ordered', link: 'http://www.ksbw.com/article/fire-big-sur/1/?utm_source=rss', source: 'KSBW' }),
    st({ id: 'c', headline: 'Evacuations ordered as fire burns 200 acres near Big Sur', link: 'https://montereycountynow.com/news/fire', source: 'MC NOW', date: new Date(t0 + 5 * H).toISOString() }),
    st({ id: 'd', headline: 'Evacuations ordered as fire burns 200 acres near Big Sur', link: 'https://lookout.co/fire', source: 'Lookout', date: new Date(t0 + 72 * H).toISOString() }),
    st({ id: 'e', headline: 'Aquarium welcomes rescued otter pup', link: 'https://x.org/otter', source: 'X' }),
  ];
  const r = dedupeStories(stories);
  assert.equal(r.stats.removedUrl, 1);
  assert.equal(r.stats.removedFuzzy, 1);       // c merged; d is >48h after -> separate
  const a = r.kept.find(s => s.id === 'a');
  assert.deepEqual(a.alsoCoveredBy, [{ name: 'MC NOW', url: 'https://montereycountynow.com/news/fire', title: stories[2].headline }]);
  assert.ok(r.kept.find(s => s.id === 'd'));
  assert.deepEqual(r.kept.find(s => s.id === 'e').alsoCoveredBy, []);
  const res = findResidualDuplicates(r.kept);
  assert.equal(res.dupUrls.length, 0); assert.equal(res.fuzzyPairs.length, 0);
});

test('dedupe prefers real photo over generated image, then earliest', () => {
  const r = dedupeStories([
    st({ id: 'g', headline: 'County opens new library branch in Gonzales', link: 'https://a.com/1', source: 'A', image: '/generated/g.webp', imageGenerated: true }),
    st({ id: 'p', headline: 'County opens new library branch in Gonzales', link: 'https://b.com/2', source: 'B', image: 'https://b.com/p.jpg', date: new Date(t0 + H).toISOString() }),
  ]);
  assert.equal(r.kept.length, 1); assert.equal(r.kept[0].id, 'p');
});

test('dedupe is idempotent', () => {
  const s = [st({ id: '1', headline: 'Big Sur road reopens after slide', link: 'https://a.com/x', source: 'A' }),
             st({ id: '2', headline: 'Big Sur road reopens after slide', link: 'https://b.com/y', source: 'B' })];
  const once = dedupeStories(s).kept;
  const twice = dedupeStories([...once, s[1]]).kept;
  assert.deepEqual(twice, once);
});

test('Spanish twin folds into English version, listed as (Español)', () => {
  const r = dedupeStories([
    st({ id: 'es', headline: 'Encuentran en México a la joven de 14 años que dio a luz a la “Bebé Angelita”; el padre está bajo custodia.', link: 'https://www.montereycountynow.com/svnow/translation/encuentran/article_1.html', source: 'Monterey County Weekly / Monterey County NOW', date: new Date(t0).toISOString() }),
    st({ id: 'en', headline: 'Fourteen-year-old girl who gave birth to "Baby Angelita" found in Mexico, father in custody.', link: 'https://www.montereycountynow.com/svnow/news/fourteen/article_2.html', source: 'Monterey County Weekly / Monterey County NOW', date: new Date(t0 + 3 * 60e3).toISOString() }),
  ]);
  assert.equal(r.kept.length, 1); assert.equal(r.kept[0].id, 'en'); assert.equal(r.stats.removedTranslation, 1);
  assert.equal(r.kept[0].alsoCoveredBy[0].name, 'MC NOW (Español)');
  assert.ok(isSpanish({ headline: 'Regreso al hogar, a la tierra', summary: 'Louise Miranda Ramírez, presidenta de la Nación Ohlone, ha esperado dos años para recuperar las tierras', link: 'https://x/2026/09/27/regreso/' }));
  assert.ok(!isSpanish({ headline: 'Del Rey Oaks police knew in advance of ICE presence', summary: 'The police chief said', link: 'https://x/y' }));
});

test('event rule merges differently-worded repeats but not opposite status updates', () => {
  const H = 3600e3;
  const r = dedupeStories([
    st({ id: 'k1', headline: '14-year-old Monterey County girl rescued in Mexico; father accused of incest arrested', link: 'https://ksbw.com/a/1', source: 'KSBW' }),
    st({ id: 'k2', headline: 'Monterey County girl found safe in Mexico after amber alert, father arrested', link: 'https://ksbw.com/a/2', source: 'KSBW', date: new Date(t0 + 16 * H).toISOString() }),
    st({ id: 'x1', headline: 'Whale watching season begins in Monterey Bay', link: 'https://a.com/w', source: 'A' }),
    st({ id: 'x2', headline: 'Library hours change at Seaside branch', link: 'https://a.com/l', source: 'A' }),
    st({ id: 'x3', headline: 'Downtown Salinas farmers market moves to Saturday', link: 'https://a.com/f', source: 'A' }),
  ]);
  assert.equal(r.kept.length, 4);
  assert.ok(statusConflict('Shelter-in-Place Order LIFTED - Battery Fire', 'Shelter In Place Order Issued Due to Fire'));
});

function tmpLib() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'illo-')); const pub = path.join(d, 'public');
  for (const c of ['government', 'general']) { fs.mkdirSync(path.join(pub, 'illustrations', c), { recursive: true }); for (const n of [1, 2, 3]) fs.writeFileSync(path.join(pub, 'illustrations', c, `${n}.webp`), 'x'); }
  const lib = { government: [1, 2, 3].map(n => `/illustrations/government/${n}.webp`), general: [1, 2, 3].map(n => `/illustrations/general/${n}.webp`) };
  return { pub, lib };
}

test('illustrations: deterministic, category -> general fallback, no adjacent repeats', () => {
  const { pub, lib } = tmpLib();
  const mk = () => Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, headline: 'h', category: i % 3 ? 'government' : 'weather', date: new Date(t0 + i * 3600e3).toISOString(), image: null }));
  const a = mk(), b = mk();
  assignIllustrations(a, { lib, alts: {}, publicDir: pub }); assignIllustrations(b, { lib, alts: {}, publicDir: pub });
  assert.deepEqual(a.map(s => s.image), b.map(s => s.image));
  assert.ok(a.every(s => s.imageGenerated && s.imageCredit === 'Illustration'));
  assert.ok(a.filter(s => s.category === 'weather').every(s => s.image.includes('/general/')));
  for (const g of ['government', 'general']) { const l = a.filter(s => s.image.includes(`/${g}/`)); for (let i = 1; i < l.length; i++) assert.notEqual(l[i].image, l[i - 1].image); }
  assert.equal(canonicalFolder('Environment & Coast'), 'environment'); assert.equal(canonicalFolder('Public Safety'), 'public-safety');
});

test('assignImages: publisher photo > stock photo > illustration; upgrades to stock when file appears', () => {
  const { pub, lib } = tmpLib();
  const s = [{ id: 'p', category: 'government', date: '2026-10-01', image: 'https://x/p.jpg', imageGenerated: false },
             { id: 'q', category: 'government', date: '2026-10-02', image: null }];
  let r = assignImages(s, { publicDir: pub, lib, alts: {}, photos: {} });
  assert.equal(s[0].imageKind, 'photo'); assert.equal(s[1].imageKind, 'illustration'); assert.equal(r.illustration, 1);
  fs.mkdirSync(path.join(pub, 'photos')); fs.writeFileSync(path.join(pub, 'photos', 'q.webp'), 'x');
  const man = { q: { alt: 'Monterey city hall', author: 'Jane Doe', license: 'CC BY-SA 4.0', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/', source_page_url: 'https://commons.wikimedia.org/wiki/File:X.jpg' } };
  r = assignImages(s, { publicDir: pub, lib, alts: {}, photos: man });
  assert.equal(s[1].image, '/photos/q.webp'); assert.equal(s[1].imageKind, 'stock'); assert.equal(s[1].imageGenerated, false);
  assert.equal(s[1].imageCredit, 'Photo: Jane Doe / Wikimedia Commons, CC BY-SA 4.0'); assert.equal(s[1].imageAlt, 'Monterey city hall');
  assert.deepEqual(s[1].imageAttribution, { author: 'Jane Doe', source: 'Wikimedia Commons', sourceUrl: man.q.source_page_url, license: 'CC BY-SA 4.0', licenseUrl: man.q.license_url });
  assert.equal(r.stockNew, 1); assert.equal(s[0].imageAttribution, null);
  r = assignImages(s, { publicDir: pub, lib, alts: {}, photos: man }); assert.equal(r.stockNew, 0); assert.equal(r.stock, 1); // idempotent
  assert.equal(sourceName('https://www.nps.gov/pinn/x.htm'), 'NPS'); assert.equal(sourceName('https://unsplash.com/photos/abc'), 'Unsplash');
  assert.equal(stockFields('z', { author: 'A', license: 'Public domain', source_page_url: 'https://www.fisheries.noaa.gov/x', author_url: 'https://a' }).imageAttribution.authorUrl, 'https://a');
  assert.deepEqual(Object.keys(parseManifest({ images: [{ file: 'a.webp', alt: 'x' }] })), ['a']);
  assert.deepEqual(Object.keys(parseManifest({ 'b': { alt: 'y' } })), ['b']);
});

test('serialize always includes contract fields', () => {
  const o = JSON.parse(serialize({ id: 'x', headline: 'h', image: null }));
  assert.equal(o.imageGenerated, false); assert.deepEqual(o.alsoCoveredBy, []); assert.equal(o.imageAlt, null); assert.equal(o.imageAttribution, null); assert.equal(o.id, undefined);
});
