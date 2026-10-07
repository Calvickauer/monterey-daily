import * as pagefind from 'pagefind'; import fs from 'node:fs';
const { index } = await pagefind.createIndex({});
for (const f of fs.readdirSync('src/content/stories')) {
  const s = JSON.parse(fs.readFileSync('src/content/stories/'+f));
  await index.addCustomRecord({ url: s.link, content: `${s.headline}. ${s.summary}`, language: 'en',
    meta: { title: s.headline, date: s.date.slice(0,10) }, filters: { category: [s.category], source: [s.source] } });
}
await index.writeFiles({ outputPath: 'dist/pagefind' }); console.log('indexed');
