import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import sharp from 'sharp';
import { rehostImages, shouldRehost, rehostConfig, pruneRehosted } from '../scripts/lib/rehost.mjs';
import { assignImages, hasRealImage } from '../scripts/lib/illustrations.mjs';

const SEASIDE = { name: 'City of Seaside News Flash', url: 'https://www.ci.seaside.ca.us', rehostImages: ['ci.seaside.ca.us'] };
const OTHER = { name: 'KSBW', url: 'https://www.ksbw.com' };
const story = (id, source, image, extra = {}) => ({ id, source, image, imageKind: 'source', imageGenerated: false, imageAlt: null,
  imageCredit: `Image: ${source}`, imageCreditUrl: 'https://www.ci.seaside.ca.us/CivicAlerts.aspx?AID=1', category: 'community', headline: id, ...extra });
const ok = buf => async () => ({ ok: true, status: 200, headers: { get: k => (k === 'content-type' ? 'image/png' : null) }, arrayBuffer: async () => buf });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rehost-'));

test('host matching: only opted-in sources and listed hosts (subdomains ok); never local/stock/illustration images', () => {
  assert.ok(shouldRehost(story('a', SEASIDE.name, 'https://www.ci.seaside.ca.us/ImageRepository/Document?documentID=1'), SEASIDE));
  assert.ok(!shouldRehost(story('b', SEASIDE.name, 'https://cdn.example.com/x.jpg'), SEASIDE));
  assert.ok(!shouldRehost(story('c', SEASIDE.name, '/source-images/c.webp'), SEASIDE));
  assert.ok(!shouldRehost(story('d', SEASIDE.name, 'https://www.ci.seaside.ca.us/x.png', { imageKind: 'stock' }), SEASIDE));
  assert.ok(shouldRehost(story('e', 'X', 'https://anything.example/x.jpg'), { name: 'X', rehostImages: true }));
  assert.deepEqual([...rehostConfig([SEASIDE, OTHER]).keys()], [SEASIDE.name]);
});

test('Seaside image is downloaded, compressed to <=1200px webp, and the story points at the local file (credit kept)', async () => {
  const dir = tmp();
  const png = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#3a7' } }).png().toBuffer();
  const s = story('2026-10-07-aaaa', SEASIDE.name, 'https://www.ci.seaside.ca.us/ImageRepository/Document?documentID=17133');
  const k = story('2026-10-07-bbbb', OTHER.name, 'https://kubrick.htvapps.com/x.jpg');
  const r = await rehostImages([s, k], [SEASIDE, OTHER], { publicDir: dir, fetchImpl: ok(png) });
  assert.equal(r.rehosted.length, 1); assert.equal(r.failed.length, 0);
  assert.equal(s.image, '/source-images/2026-10-07-aaaa.webp');
  assert.equal(k.image, 'https://kubrick.htvapps.com/x.jpg');
  const meta = await sharp(path.join(dir, 'source-images', '2026-10-07-aaaa.webp')).metadata();
  assert.equal(meta.format, 'webp'); assert.equal(meta.width, 1200); assert.equal(meta.height, 800);
  // assignImages keeps it a publisher ('source') image with its original credit + credit URL
  assert.ok(hasRealImage(s));
  assignImages([s], { publicDir: dir, lib: {}, alts: {}, photos: {} });
  assert.equal(s.imageKind, 'source'); assert.equal(s.imageGenerated, false); assert.equal(s.image, '/source-images/2026-10-07-aaaa.webp');
  assert.equal(s.imageCredit, 'Image: City of Seaside News Flash'); assert.equal(s.imageCreditUrl, 'https://www.ci.seaside.ca.us/CivicAlerts.aspx?AID=1');
  // idempotent: a second run reuses the file without downloading
  const s2 = story('2026-10-07-aaaa', SEASIDE.name, 'https://www.ci.seaside.ca.us/ImageRepository/Document?documentID=17133');
  const r2 = await rehostImages([s2], [SEASIDE], { publicDir: dir, fetchImpl: async () => { throw new Error('should not fetch'); } });
  assert.equal(r2.reused, 1); assert.equal(s2.image, '/source-images/2026-10-07-aaaa.webp');
  // orphans are pruned
  fs.writeFileSync(path.join(dir, 'source-images', 'gone.webp'), 'x');
  assert.deepEqual(pruneRehosted([s], { publicDir: dir }), ['gone.webp']);
});

test('download failure keeps the remote URL and logs a warning', async () => {
  const dir = tmp(), warnings = [];
  const url = 'https://www.ci.seaside.ca.us/ImageRepository/Document?documentID=9';
  const s = story('2026-10-07-cccc', SEASIDE.name, url);
  const r = await rehostImages([s], [SEASIDE], { publicDir: dir, log: m => warnings.push(m),
    fetchImpl: async () => ({ ok: false, status: 404, headers: { get: () => null } }) });
  assert.equal(r.failed.length, 1); assert.equal(s.image, url);
  assert.match(warnings[0], /rehost failed.*keeping the remote URL/i);
  const html = story('2026-10-07-dddd', SEASIDE.name, url);
  const r2 = await rehostImages([html], [SEASIDE], { publicDir: dir, log: m => warnings.push(m),
    fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, arrayBuffer: async () => Buffer.from('<html>') }) });
  assert.equal(r2.failed.length, 1); assert.equal(html.image, url);
  assert.ok(!fs.existsSync(path.join(dir, 'source-images', '2026-10-07-dddd.webp')));
});
