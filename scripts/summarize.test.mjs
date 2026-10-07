// Run: node --test scripts/
import test from 'node:test'; import assert from 'node:assert/strict';
import { decodeEntities, cleanText, summarize, sentences } from './summarize.mjs';

test('decodes named, numeric, hex and double-encoded entities', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry&#8217;s &#x2014; caf&eacute;&nbsp;open &amp;#8220;now&amp;#8221;'), 'Tom & Jerry’s — café open “now”');
  assert.equal(decodeEntities('&bogus; stays'), '&bogus; stays');
});

test('strips tags, figures and collapses whitespace', () => {
  assert.equal(cleanText('<figure><img src="x"><figcaption>Photo credit</figcaption></figure><p>Hello&nbsp;  <b>world</b></p>'), 'Hello world');
});

test('removes WordPress "appeared first on" footer and bylines', () => {
  const s = summarize('<p>By Carlos E. Castañeda A small plane crashed near the airport Wednesday, authorities said. The FAA said a Van&#8217;s RV-7A crashed in a field.</p><p>The post <a href="#">Small plane</a> appeared first on <a>KION</a>.</p>');
  assert.equal(s, 'A small plane crashed near the airport Wednesday, authorities said. The FAA said a Van’s RV-7A crashed in a field.');
});

test('removes kicker, byline + translator credit and […] (Voices of Monterey Bay style)', () => {
  const s = summarize('REPORTAJE &#124; Artículo y fotos por Claudia Meléndez Salinas Traducción por Víctor Almazán Louise Miranda Ramírez ha esperado dos años para recuperar parte de las tierras. Esto, si empezamos a contar desde que la parcela [&#8230;]');
  assert.equal(s, 'Louise Miranda Ramírez ha esperado dos años para recuperar parte de las tierras.');
});

test('drops "Continue reading" / "Read more" tails', () => {
  assert.equal(summarize('The council approved the budget on Tuesday. Continue reading →'), 'The council approved the budget on Tuesday.');
  assert.equal(summarize('Crews repaved Fremont Street. Read more'), 'Crews repaved Fremont Street.');
});

test('county press-release header becomes a readable lead', () => {
  const s = summarize('DATE/TIME: 10/6/2026 6:00 PM\nTYPE OF INCIDENT: Stolen Vehicle Arrest in Salinas\nLOCATION: 1000 Block Main Street, Salinas\nMEDIA CONTACT: A. Person, 831-555-0100\nOn...');
  assert.equal(s, 'Stolen Vehicle Arrest in Salinas. Location: 1000 Block Main Street, Salinas.');
});

test('caps long full-text content at <=280 chars on a sentence boundary', () => {
  const full = Array.from({ length: 40 }, (_, i) => `Sentence number ${i + 1} describes what happened at the Monterey County meeting in detail.`).join(' ');
  const s = summarize(`<p>${full}</p>`);
  assert.ok(s.length <= 280, s.length); assert.match(s, /\.$/); assert.ok(sentences(s).length <= 2);
});

test('single huge sentence is cut on a word with an ellipsis', () => {
  const s = summarize('word '.repeat(200));
  assert.ok(s.length <= 280); assert.match(s, /…$/);
});

test('does not split on abbreviations', () => {
  assert.deepEqual(sentences('Dr. Smith met U.S. Rep. Panetta at 3 p.m. Tuesday. Then he left.'), ['Dr. Smith met U.S. Rep. Panetta at 3 p.m. Tuesday.', 'Then he left.']);
});

test('summary identical to headline is dropped', () => {
  assert.equal(summarize('<p>Road closed</p>', { title: 'Road closed' }), '');
});

test('removes syndication credits ("originally published by", "republished with permission")', () => {
  assert.equal(summarize('FEATURED By Keith Menconi, San José Spotlight This story was originally published by San José Spotlight. Federal authorities have agreed to pause construction work.'), 'Federal authorities have agreed to pause construction work.');
  assert.equal(summarize('FEATURED STORY By Gabriel Thompson This article was produced by Capital Main. It is republished here with permission. When Sara Ramirez started as an interpreter, she was happy.'), 'When Sara Ramirez started as an interpreter, she was happy.');
});

test('drops stock-photo credit prefix (Stacker style)', () => {
  assert.equal(summarize('anatoliy_gleb // Shutterstock Stacker compiled a list of the cheapest gas stations in Salinas. Gas stations are ranked by price. #1. Shell'), 'Stacker compiled a list of the cheapest gas stations in Salinas. Gas stations are ranked by price.');
});

test('is idempotent on already-trimmed summaries', () => {
  for (const raw of ['The office will close Oct. 30 after a June 2025 audit found it was out of compliance [&#8230;]', 'FEATURED By George B. Sánchez-Tello Dozens of residents told the board to stop a proposal. More text here that goes on and on and on for a while to make it long enough to need trimming, really quite long indeed, longer than one hundred and forty characters for sure.']) {
    const once = summarize(raw); assert.equal(summarize(once), once);
  }
});
