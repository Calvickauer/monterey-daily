import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { dedupeStories } from '../scripts/lib/dedupe.mjs';
import { categorize } from '../scripts/categorize.mjs';
import { fetchWithRetry, retryAfterMs, sourceHeaders, BROWSER_UA } from '../scripts/lib/http.mjs';
import { entryProblem, stockFields, syncPhotos, shortChanges } from '../scripts/lib/photos.mjs';

const MC = 'Monterey County Weekly / Monterey County NOW', KSBW = 'KSBW Action News 8 (local)', CO = 'County of Monterey News';
const mk = (id, source, date, headline, extra = {}) => ({ id, source, date, headline, link: `https://example.com/${id}`, summary: '', image: null, imageGenerated: false, ...extra });
const ids = r => r.kept.map(s => s.id).sort();

test('Mexico rescue cluster (4 English copies + Spanish twin) collapses to 1', () => {
  const r = dedupeStories([
    mk('county', CO, '2026-10-05T16:15:00Z', '14-Year-Old Diana Galvez Ortega Safely Rescued in Mexico; Sergio Galvez Perez Arrested'),
    mk('mcnow-es', MC, '2026-10-05T19:58:00Z', 'Encuentran en México a la joven de 14 años que dio a luz a la “Bebé Angelita”; el padre está bajo custodia.', { link: 'https://www.montereycountynow.com/svnow/translation/encuentran/article_1.html' }),
    mk('mcnow', MC, '2026-10-05T20:01:00Z', 'Fourteen-year-old girl who gave birth to "Baby Angelita" found in Mexico, father in custody.', { link: 'https://www.montereycountynow.com/svnow/news/fourteen/article_2.html', image: 'https://x/a.jpg' }),
    mk('ksbw1', KSBW, '2026-10-06T00:54:00Z', '14-year-old Monterey County girl rescued in Mexico; father accused of incest arrested'),
    mk('ksbw2', KSBW, '2026-10-06T17:14:00Z', 'Monterey County girl found safe in Mexico after amber alert, father arrested'),
    mk('other1', KSBW, '2026-10-06T10:00:00Z', 'Salinas council approves new budget'),
    mk('other2', CO, '2026-10-06T11:00:00Z', 'Library hours change at Seaside branch'),
  ]);
  assert.deepEqual(ids(r), ['mcnow', 'other1', 'other2']);
  assert.equal(r.kept.find(s => s.id === 'mcnow').alsoCoveredBy.length, 4);
});

test('follow-ups stay separate: KSBW crash + "what we know about the victims"', () => {
  const r = dedupeStories([
    mk('crash', KSBW, '2026-10-06T18:32:00Z', 'Head-on crash on near Salinas kills 3 passengers, hospitalizes 3 others'),
    mk('victims', KSBW, '2026-10-06T19:15:00Z', 'What we know about 3 victims killed in head-on crash near Salinas'),
  ]);
  assert.equal(r.kept.length, 2);
});

test('follow-ups stay separate: DA charges release + County arrest notice; DA charges + KSBW "arrested again"', () => {
  const r = dedupeStories([
    mk('da', CO, '2026-10-06T22:47:00Z', 'DISTRICT ATTORNEY’S OFFICE ANNOUNCES CHARGES AGAINST 14-YEAR-OLD’S MOTHER, OFELIA GARCIA ORTEGA, FOLLOWING INVESTIGATION INTO DEATH OF INFANT'),
    mk('arrest', CO, '2026-10-06T22:50:00Z', 'OFELIA GARCIA ORTEGA, Mother of 14-Year-Old in Baby Angelita Investigation Has Been Arrested'),
    mk('again', KSBW, '2026-10-07T00:04:00Z', 'Mother of girl whose newborn was found dead arrested again in Monterey County'),
  ]);
  assert.equal(r.kept.length, 3);
});

test('same outlet re-publishing the same piece (identical summary, 54h apart) folds', () => {
  const sum = 'Sara Rubin here, with a suggestion to check your mailbox to see if you’ve received a mail-in ballot yet. If you’re a registered voter in Monterey County, odds are good that it has already arrived.';
  const r = dedupeStories([
    mk('ed1', MC, '2026-10-04T14:00:00Z', 'Our editorial board weighs in on ballot measures and propositions. Now it’s your turn to decide.', { summary: sum, image: 'https://x/e.jpg' }),
    mk('ed2', MC, '2026-10-06T20:34:00Z', 'The Monterey County Weekly editorial board weighed in on ballot measures and propositions. Now it’s your turn to decide.', { summary: sum }),
    mk('upd1', CO, '2026-09-23T10:00:00Z', 'Timber Fire Update 9/23/26', { summary: 'x'.repeat(10) }),
  ]);
  assert.deepEqual(ids(r), ['ed1', 'upd1']);
  assert.equal(r.kept.find(s => s.id === 'ed1').alsoCoveredBy[0].url, 'https://example.com/ed2');
});

test('alsoCoveredBy entries that point at a standalone story are dropped', () => {
  const r = dedupeStories([
    mk('crash', KSBW, '2026-10-06T18:32:00Z', 'Head-on crash near Salinas kills 3', { alsoCoveredBy: [{ name: KSBW, url: 'https://example.com/victims', title: 'What we know' }] }),
    mk('victims', KSBW, '2026-10-06T19:15:00Z', 'What we know about 3 victims killed in head-on crash near Salinas'),
  ]);
  assert.deepEqual(r.kept.find(s => s.id === 'crash').alsoCoveredBy, []);
});

test('categorize: road closures, slides, Highway 1 / Caltrans, traffic advisories -> public-safety', () => {
  for (const h of ['Full Overnight Closure of Highway One in Big Sur on Thursday, 10/8', 'Mud Creek realignment to begin Monday 10/5',
    'Caltrans: Hwy 1 lane closures near Gorda', 'Weekly Traffic Advisory: September 28, 2026', 'Landslide closes road near Carmel Valley'])
    assert.equal(categorize({ headline: h, summary: '', source: 'BigSurKate (Kate Woods Novoa)' }), 'public-safety', h);
  assert.equal(categorize({ headline: 'Big Sur Jade Festival, 2026', summary: '', source: 'BigSurKate (Kate Woods Novoa)' }), 'community');
});

test('fetchWithRetry: retries 429/5xx with backoff, honors Retry-After, bounded', async () => {
  const waits = [];
  const seq = [{ status: 429, h: { 'retry-after': '2' } }, { status: 503 }, { status: 200 }];
  let n = 0;
  const fetchImpl = async () => { const x = seq[n++]; return { ok: x.status === 200, status: x.status, headers: { get: k => x.h?.[k] ?? null } }; };
  const r = await fetchWithRetry('u', { fetchImpl, sleep: async ms => waits.push(ms), random: () => 0.5 });
  assert.equal(r.status, 200); assert.equal(n, 3);
  assert.equal(waits[0], 2000); assert.equal(waits[1], 2000); // Retry-After 2s, then 1s*2^1 backoff
  n = 0; const four = async () => ({ ok: false, status: 404, headers: { get: () => null } });
  await assert.rejects(fetchWithRetry('u', { fetchImpl: four, sleep: async () => {} }), /404/);
  let calls = 0; const always = async () => { calls++; return { ok: false, status: 500, headers: { get: () => null } }; };
  await assert.rejects(fetchWithRetry('u', { fetchImpl: always, sleep: async () => {}, tries: 3 }), /500/); assert.equal(calls, 3);
  calls = 0; const slow = async () => { calls++; return { ok: false, status: 429, headers: { get: () => '600' } }; };
  await assert.rejects(fetchWithRetry('u', { fetchImpl: slow, sleep: async () => {}, budgetMs: 10000 }), /429/); assert.equal(calls, 1); // capped wait 15s > 10s budget -> give up instead of waiting
  assert.equal(retryAfterMs('3'), 3000); assert.ok(retryAfterMs(new Date(Date.now() + 5000).toUTCString()) > 3000);
  assert.equal(sourceHeaders({ user_agent: 'browser' })['User-Agent'], BROWSER_UA);
  assert.match(sourceHeaders({})['User-Agent'], /MontereyDaily/);
});

test('stock photos: license/author checks, changes note, file photo, only used files copied', async () => {
  const ok = { author: 'A', license: 'CC BY-SA 4.0', license_url: 'u', source_page_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', changes: 'Resized to 1200px wide and cropped; converted to WebP', alt: 'Ridge on fire (file photo)' };
  assert.equal(entryProblem(ok), null);
  assert.match(entryProblem({ ...ok, license: 'CC BY-NC 4.0' }), /not free/);
  assert.match(entryProblem({ ...ok, license: 'CC BY-ND 2.0' }), /not free/);
  assert.equal(entryProblem({ ...ok, license: '' }), 'missing license');
  assert.equal(entryProblem({ ...ok, author: '' }), 'missing author');
  assert.equal(entryProblem({ ...ok, license: 'CC0' }), null); assert.equal(entryProblem({ ...ok, license: 'Public domain' }), null);
  const f = stockFields('s1', ok);
  assert.equal(f.imageCredit, 'File photo. Photo: A / Wikimedia Commons, CC BY-SA 4.0 (cropped)');
  assert.equal(f.imageFilePhoto, true); assert.equal(f.imageAttribution.changes, ok.changes); assert.equal(f.imageGenerated, false);
  assert.equal(stockFields('s2', { ...ok, license: 'CC0', alt: 'Pier' }).imageCredit, 'Photo: A / Wikimedia Commons, CC0');
  assert.equal(shortChanges('Resized to 1200px wide; converted to WebP'), 'resized');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-')), src = path.join(d, 'src'), dest = path.join(d, 'dest');
  fs.mkdirSync(src); for (const s of ['a', 'b', 'c']) fs.writeFileSync(path.join(src, `${s}.webp`), 'x');
  fs.writeFileSync(path.join(src, 'manifest.json'), JSON.stringify({ a: { ...ok, file: 'a.webp' }, b: { ...ok, file: 'b.webp' }, c: { ...ok, file: 'c.webp', license: 'CC BY-NC 2.0' } }));
  const r = await syncPhotos(src, { dest, wanted: s => s === 'a' });
  assert.deepEqual(r.used, ['a']); assert.deepEqual(r.notNeeded, ['b']); assert.equal(r.skipped[0].stem, 'c');
  assert.deepEqual(fs.readdirSync(dest).sort(), ['a.webp', 'manifest.json']);
});
