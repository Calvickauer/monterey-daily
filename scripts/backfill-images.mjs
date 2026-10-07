// Re-runnable / idempotent: npm run backfill-images [-- --no-og] [--src=/path/to/illustrations] [--photos-src=/path/to/photos]
// 1) sync the illustration library into public/illustrations (if the source folder exists)
// 2) try the publisher og:image for archived stories that have no image (real images first)
// 3) wire matched stock photos (public/photos/<stem>.webp + manifest.json, synced from --photos-src)
// 4) (re)assign illustrations deterministically to every story still without a photo
import { loadArchive, writeStory } from './lib/store.mjs';
import { syncLibrary, loadLibrary, assignImages, hasRealImage } from './lib/illustrations.mjs';
import { syncPhotos } from './lib/photos.mjs';
import { ogImage, NO_OG } from './lib/og.mjs';
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const UA = 'MontereyDaily/1.0 (+https://github.com/Calvickauer/monterey-daily; contact: calvickauer@users.noreply.github.com)';
const src = arg('src', process.env.ILLUSTRATIONS_SRC || '/workspace/monterey-news/illustrations');
const sync = syncLibrary(src);
console.log(sync.ok ? `library synced from ${src}: ${sync.copied.length} file(s) updated` : `library source ${src} not found; using public/illustrations as-is`);
const photoSrc = arg('photos-src', process.env.PHOTOS_SRC || '/workspace/monterey-news/photos');

const lib = loadLibrary();
console.log('library:', Object.fromEntries(Object.entries(lib).map(([k, v]) => [k, v.length])));
const all = loadArchive();
let og = 0;
if (!process.argv.includes('--no-og')) {
  const todo = all.filter(s => !hasRealImage(s) && !NO_OG.test(s.source));
  for (let i = 0; i < todo.length; i += 4) await Promise.all(todo.slice(i, i + 4).map(async s => {
    const im = await ogImage(s.link, UA);
    if (im) { Object.assign(s, { image: im, imageAlt: null, imageCredit: `Image: ${s.source}`, imageGenerated: false }); og++; }
  }));
}
// Stock photos: copy only those used (story exists and has no publisher image), recompress big ones.
const ps = await syncPhotos(photoSrc, { wanted: stem => { const s = all.find(x => x.id === stem); return !!s && !hasRealImage(s); } });
if (ps.ok) console.log({ stockUsed: ps.used.length, stockSkipped: ps.skipped, stockNotNeeded: ps.notNeeded, recompressed: ps.recompressed, removedFromPublic: ps.removed });
else console.log(`stock photo manifest not found in ${photoSrc}; using public/photos as-is`);
const res = assignImages(all, { lib });
let written = 0; for (const s of all) if (writeStory(s)) written++;
console.log({ stories: all.length, source: res.source, ogImagesFound: og, stock: res.stock, stockNewlyWired: res.stockNew,
  illustration: res.illustration, illustrationByCategory: res.byCategory, withoutImage: res.none, filesWritten: written });
if (!Object.keys(lib).length) console.log('NOTE: illustration library is empty; rerun this script once it lands.');
