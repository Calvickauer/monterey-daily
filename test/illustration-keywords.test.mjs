import test from 'node:test'; import assert from 'node:assert/strict';
import { keywordCandidates } from '../scripts/lib/illustrations.mjs';
const lib = { weather: ['/illustrations/weather/1.webp','/illustrations/weather/2.webp','/illustrations/weather/3.webp'],
  general: ['/illustrations/general/1.webp','/illustrations/general/2.webp'], 'public-safety': ['/illustrations/public-safety/1.webp','/illustrations/public-safety/2.webp','/illustrations/public-safety/3.webp'],
  government: ['/illustrations/government/1.webp'], environment: ['/illustrations/environment/2.webp','/illustrations/environment/3.webp'] };
test('illustration keywords: heat avoids storm art, flood/storm/fog map within weather', () => {
  assert.ok(!keywordCandidates({ category: 'weather', headline: 'Heat Advisory: Southern Salinas Valley' }, lib).includes('/illustrations/weather/2.webp'));
  assert.deepEqual(keywordCandidates({ category: 'weather', headline: 'Coastal Flood Advisory' }, lib), ['/illustrations/weather/2.webp']);
  assert.deepEqual(keywordCandidates({ category: 'weather', headline: 'Dense Fog Advisory' }, lib), ['/illustrations/weather/1.webp']);
  assert.deepEqual(keywordCandidates({ category: 'public-safety', headline: 'Timber Fire Evacuation Zone Updates' }, lib), ['/illustrations/public-safety/3.webp']);
});
test('illustration keywords: no cross-category pick for unrelated categories; null when nothing matches', () => {
  assert.equal(keywordCandidates({ category: 'government', headline: 'Council discusses the bay trail' }, lib), null);
  assert.equal(keywordCandidates({ category: 'government', headline: 'Budget hearing' }, lib), null);
});
