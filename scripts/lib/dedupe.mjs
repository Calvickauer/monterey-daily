// Story de-duplication: URL normalization + fuzzy headline clustering.
// Pure functions (no fs) so they can be used from fetch, one-off scripts and tests.

const TRACKING = /^(utm_.*|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|_ga|_gl|ref|ref_src|ref_url|cmpid|cmp|src|source|share|smid|s_cid|ito|ncid|ocid|sr_share|taid|outputtype|amp|amp_js_v|usqp|__twitter_impression|rss|feed|partner|via)$/i;

/** Canonical dedupe key for a URL (not meant for display/linking). */
export function normalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s.replace(/^\/\//, '');
  let u;
  try { u = new URL(s); } catch { return s.toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, ''); }
  let host = u.hostname.toLowerCase();
  let path = u.pathname;
  // Google AMP cache: https://www-example-com.cdn.ampproject.org/c/s/www.example.com/path
  if (host.endsWith('.cdn.ampproject.org') || host === 'cdn.ampproject.org') {
    const m = path.match(/^\/(?:[a-z]\/)*(?:s\/)?([^/]+)(\/.*)?$/i);
    if (m) { host = m[1].toLowerCase(); path = m[2] || '/'; }
  }
  // google.com/amp/s/example.com/path
  if (/^(www\.)?google\.[a-z.]+$/.test(host) && path.startsWith('/amp/')) {
    const m = path.match(/^\/amp\/(?:s\/)?([^/]+)(\/.*)?$/i);
    if (m) { host = m[1].toLowerCase(); path = m[2] || '/'; }
  }
  host = host.replace(/^www\d*\./, '').replace(/^(amp|m)\./, '').replace(/^www\./, '');
  if ((u.port === '80' || u.port === '443')) { /* default ports dropped */ }
  try { path = decodeURI(path); } catch { /* keep raw */ }
  path = path
    .replace(/\/+/g, '/')
    .replace(/\.amp\.html?$/i, '.html')
    .replace(/\/amp\/?$/i, '/')
    .replace(/\/amp(?=\/)/i, '')
    .replace(/\/index\.(html?|php)$/i, '/')
    .replace(/\/+$/, '');
  // Keep query params only when a source clearly needs them (id-style CMS links), minus tracking.
  const keep = [];
  for (const [k, v] of u.searchParams) {
    if (TRACKING.test(k)) continue;
    if (/^(id|p|page_id|articleid|aid|story|storyid|nid)$/i.test(k)) keep.push(`${k.toLowerCase()}=${v}`);
  }
  keep.sort();
  return host + path.toLowerCase() + (keep.length ? '?' + keep.join('&') : '');
}

export const STOPWORDS = new Set(('a an and are as at be been being but by can could did do does for from had has have he her his how i ' +
  'if in into is it its new news no not of on or our over says said she so than that the their them then there these they ' +
  'this those to up was we were what when where which who will with would you your about after again against all also am ' +
  'any because before between both during each few more most other out own same some such through under until very via ' +
  'vs just now get gets got amid among per here why de la el en los las y del para por con un una que se').split(/\s+/));

/** Headline -> set of normalized tokens. */
export function titleTokens(title) {
  const t = String(title || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]s\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOPWORDS.has(w))
    .map(w => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .map(w => SYN[w] || w)
    .filter(w => w !== 'year' && w !== 'old');
  return new Set(t);
}

// Light synonym folding so differently-worded repeats line up ("rescued" ~ "found safe", "custody" ~ "arrested").
const SYN = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', rescued: 'found', safe: 'found', safely: 'found', located: 'found',
  arrested: 'arrest', custody: 'arrest', killed: 'dead', kill: 'dead', die: 'dead', dies: 'dead', died: 'dead', fatal: 'dead',
  death: 'dead', collision: 'crash', crashe: 'crash', blaze: 'fire', wildfire: 'fire' };

// Opposite status words: "order issued" vs "order lifted" are separate updates, never merge them.
// Follow-up pieces ("What we know about the victims") are separate stories, never repeats.
export const FOLLOW_UP = /^\s*(what (we|you) know|what to know|who (was|were|is)\b|timeline\b|live( updates)?\b|explainer\b|analysis:|q ?& ?a\b)/i;

const STATUS_A = /\b(lifted|ended|expire[ds]?|cancell?ed|rescinded|reopen(s|ed|ing)?|contained|over)\b/i;
const STATUS_B = /\b(issued|ordered|extended|closed|closes|closure|begins?|starts?|announced)\b/i;
export function statusConflict(h1, h2) {
  const a1 = STATUS_A.test(h1), b1 = STATUS_B.test(h1), a2 = STATUS_A.test(h2), b2 = STATUS_B.test(h2);
  return (a1 && !a2 && b2) || (a2 && !a1 && b1);
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// Rough source tiers: primary local outlets / agencies > regional outlets.
const REGIONAL = /lookout|kqed|pajaronian|regional/i;
export function sourceTier(source = '') { return REGIONAL.test(source) ? 0 : 1; }

export const hasRealImage = s => !!s.image && !s.imageGenerated && s.imageKind !== 'stock' && !String(s.image).startsWith('/');

/** Comparator: negative if a is the better version to keep. */
export function compareQuality(a, b) {
  const d = (x, y) => (x === y ? 0 : x ? -1 : 1);
  const ra = hasRealImage(a), rb = hasRealImage(b);
  if (ra !== rb) return d(ra, rb);
  const la = (a.summary || '').length, lb = (b.summary || '').length;
  const sa = la >= 120, sb = lb >= 120; // substantive summary vs. headline-only
  if (sa !== sb) return d(sa, sb);
  const ta = sourceTier(a.source), tb = sourceTier(b.source);
  if (ta !== tb) return tb - ta;
  // Already-archived beats newly fetched (keeps ids/images stable when an outlet re-publishes at a new URL).
  if (!!a._new !== !!b._new) return a._new ? 1 : -1;
  if (Math.abs(la - lb) > 40) return lb - la;
  const da = Date.parse(a.date) || 0, db = Date.parse(b.date) || 0;
  if (da !== db) return da - db; // earliest first
  return String(a.id || a.link).localeCompare(String(b.id || b.link));
}

const HOURS = 3600e3;

// ---------- Spanish translation detection / pairing ----------
const ES_WORDS = new Set('el la los las del y en para por con una un que se su sus al es lo como mas sobre tras entre desde hasta sin ha han son este esta estos estas nuevo nueva ano anos muerte traen historias junta da'.split(' '));
const EN_WORDS = new Set('the and of to in for with is on at from by as are was this that after about who new'.split(' '));
const plain = t => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
export function isSpanish(s) {
  if (/\/(translation|traduccion|espanol|es)\//i.test(s.link || '')) return true;
  const words = plain(`${s.headline} ${s.summary === s.headline ? '' : (s.summary || '')}`).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 60);
  if (words.length < 4) return false;
  const es = words.filter(w => ES_WORDS.has(w)).length, en = words.filter(w => EN_WORDS.has(w)).length;
  return es / words.length >= 0.12 && es > en * 1.5;
}
const GENERIC_CAPS = new Set('featured story destacado reportaje obituario obituary opinion news noticias photos fotos articulo article por by and y the el la los las de del en a an in of traduccion translation monterey county condado california'.split(' '));
/** Proper-noun / number anchors that survive translation (names, places, numbers). */
export function anchors(s) {
  const text = `${s.headline} ${s.summary === s.headline ? '' : (s.summary || '')}`;
  const out = new Set();
  for (const m of plain(text).matchAll(/\b([A-Z][A-Za-z-]{2,}|\d{2,})\b/g)) {
    const w = m[1].toLowerCase().replace(/s$/, '');
    if (!GENERIC_CAPS.has(w) && !STOPWORDS.has(w) && !ES_WORDS.has(w)) out.add(w);
  }
  return out;
}
const section = u => { try { return new URL(u).pathname.split('/')[1] || ''; } catch { return ''; } };
const TRANSLATION_SOURCES = /montereycountynow|monterey county (weekly|now)|voices of monterey bay|voicesofmontereybay/i;

/**
 * Cluster stories. Each story needs {headline, link, date, source}; `id` optional.
 * Edges: (1) same normalized URL, (2) same story by headline within the time window,
 * (3) Spanish translation -> English twin from the same outlet.
 */
export function clusterStories(stories, { threshold = 0.6, windowHours = 48, eventHours = 36, translations = true } = {}) {
  const n = stories.length, parent = [...Array(n).keys()];
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); return a !== b; };
  // 1) exact normalized URL
  const byUrl = new Map();
  stories.forEach((s, i) => {
    const k = normalizeUrl(s.link);
    if (!k) return;
    if (byUrl.has(k)) union(byUrl.get(k), i); else byUrl.set(k, i);
  });
  // 2) headline similarity. IDF over headlines + previously merged titles keeps weights stable across runs.
  const toks = stories.map(s => titleTokens(s.headline));
  const df = new Map(); let docs = 0;
  const addDf = set => { docs++; for (const x of set) df.set(x, (df.get(x) || 0) + 1); };
  toks.forEach(addDf);
  stories.forEach(s => (s.alsoCoveredBy || []).forEach(e => e.title && addDf(titleTokens(e.title))));
  const idf = x => Math.log((docs + 1) / ((df.get(x) || 0) + 0.5));
  const wjac = (A, B) => { let i = 0, u = 0; for (const x of new Set([...A, ...B])) { if ((df.get(x) || 0) < 2) continue; const v = idf(x); u += v; if (A.has(x) && B.has(x)) i += v; } return u ? i / u : 0; };
  const spanish = stories.map(s => translations && isSpanish(s));
  const t = stories.map(s => Date.parse(s.date) || 0);
  const order = [...Array(n).keys()].sort((a, b) => t[a] - t[b]);
  const win = windowHours * HOURS, ev = eventHours * HOURS;
  const fuzzyPairs = [];
  for (let x = 0; x < n; x++) {
    const i = order[x];
    for (let y = x + 1; y < n && t[order[y]] - t[i] <= win; y++) {
      const j = order[y];
      if (spanish[i] !== spanish[j]) continue; // cross-language handled below
      if (statusConflict(stories[i].headline, stories[j].headline)) continue;
      if (FOLLOW_UP.test(stories[i].headline) || FOLLOW_UP.test(stories[j].headline)) continue; // follow-ups stay separate
      const sim = jaccard(toks[i], toks[j]);
      let hit = sim >= threshold, kind = 'jaccard';
      // Same-event rule only links different outlets (one outlet's later stories are follow-ups, not repeats).
      if (!hit && t[j] - t[i] <= ev && stories[i].source !== stories[j].source) {
        let shared = 0; for (const w of toks[i]) if (toks[j].has(w)) shared++;
        const w = shared >= 4 ? wjac(toks[i], toks[j]) : 0;
        if (w >= 0.4) { hit = true; kind = 'event'; }
      }
      if (hit) { fuzzyPairs.push([i, j, sim, kind]); union(i, j); }
    }
  }
  // 2b) Same outlet re-publishing the same piece (identical substantive summary) within 7 days,
  //     e.g. MC NOW running a Weekly editorial again on /svnow/ with a reworded headline.
  const sumKey = stories.map(st => { const x = plain(st.summary || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return x.length >= 80 && x !== plain(st.headline || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ? x : null; });
  const bySum = new Map();
  for (const i of order) {
    const k = sumKey[i] && `${stories[i].source}|${sumKey[i]}`;
    if (!k) continue;
    const prev = bySum.get(k);
    if (prev != null && t[i] - t[prev] <= 7 * 24 * HOURS && !statusConflict(stories[i].headline, stories[prev].headline)) { union(prev, i); fuzzyPairs.push([prev, i, 1, 'republish']); }
    else bySum.set(k, i);
  }
  // 3) Spanish -> English twin (same outlet; MC NOW posts minutes apart, VoMB up to ~3 weeks later)
  const translationPairs = [];
  if (translations) {
    const anc = stories.map(anchors);
    for (let i = 0; i < n; i++) {
      if (!spanish[i] || !TRANSLATION_SOURCES.test(`${stories[i].source} ${stories[i].link}`)) continue;
      let best = -1, bestScore = 0, bestDt = Infinity;
      for (let j = 0; j < n; j++) {
        if (i === j || spanish[j] || stories[j].source !== stories[i].source) continue;
        const dt = Math.abs(t[i] - t[j]);
        if (dt > 21 * 24 * HOURS) continue;
        let sc = 0; for (const a of anc[i]) if (anc[j].has(a)) sc++;
        // MC NOW publishes the twin within minutes in the same section (/svnow/translation/ <-> /svnow/news/ etc.)
        if (dt <= 30 * 60e3) sc += 1 + (section(stories[i].link) && section(stories[i].link) === section(stories[j].link) ? 1 : 0);
        else if (dt <= 2 * HOURS && sc >= 1) sc += 1; // shared name + posted within 2h (VoMB twins)
        if (sc > bestScore || (sc === bestScore && dt < bestDt)) { best = j; bestScore = sc; bestDt = dt; }
      }
      if (best >= 0 && bestScore >= 2) { translationPairs.push([i, best, bestScore]); union(i, best); }
    }
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  return { clusters: [...groups.values()], fuzzyPairs, translationPairs, spanish };
}

/**
 * Dedupe a list of stories. Returns
 *  { kept: [story with alsoCoveredBy], removed: [{story, keptAs, reason}], stats }
 * Input stories are not mutated (kept ones are shallow-copied).
 */
export function dedupeStories(stories, opts = {}) {
  const { clusters, spanish } = clusterStories(stories, opts);
  const es = new Map(stories.map((s, i) => [s, spanish[i]]));
  const kept = [], removed = [];
  const stats = { input: stories.length, clusters: 0, removedUrl: 0, removedFuzzy: 0, removedTranslation: 0 };
  for (const idxs of clusters) {
    if (idxs.length === 1) {
      const s = stories[idxs[0]];
      kept.push({ ...s, alsoCoveredBy: normalizeCovered(s.alsoCoveredBy, s) });
      continue;
    }
    // English version always wins over a Spanish translation; otherwise by quality.
    const members = idxs.map(i => stories[i]).sort((a, b) => (es.get(a) - es.get(b)) || compareQuality(a, b));
    const best = members[0];
    const bestKey = normalizeUrl(best.link);
    const others = members.slice(1);
    const covered = [...(best.alsoCoveredBy || [])];
    for (const o of others) {
      const reason = normalizeUrl(o.link) === bestKey ? 'url' : es.get(o) && !es.get(best) ? 'translation' : 'fuzzy';
      if (reason === 'url') stats.removedUrl++; else if (reason === 'translation') stats.removedTranslation++; else stats.removedFuzzy++;
      removed.push({ story: o, keptAs: best, reason });
      const name = reason === 'translation' ? spanishName(o.source) : o.source;
      covered.push({ name, url: o.link, title: o.headline }, ...(o.alsoCoveredBy || []));
    }
    const ac = normalizeCovered(covered, best);
    if (ac.length) stats.clusters++;
    kept.push({ ...best, alsoCoveredBy: ac });
  }
  // An entry whose URL is itself a kept story (e.g. an un-merged follow-up) is not "also covered by".
  const keptUrls = new Set(kept.map(k => normalizeUrl(k.link)));
  for (const k of kept) {
    const before = k.alsoCoveredBy.length;
    k.alsoCoveredBy = k.alsoCoveredBy.filter(e => !keptUrls.has(normalizeUrl(e.url)));
    stats.staleEntriesDropped = (stats.staleEntriesDropped || 0) + before - k.alsoCoveredBy.length;
  }
  stats.clusters = kept.filter(k => k.alsoCoveredBy.length).length;
  stats.output = kept.length;
  stats.clustersMerged = clusters.filter(c => c.length > 1).length;
  return { kept, removed, stats };
}

const SHORT = [[/monterey county (weekly|now)/i, 'MC NOW'], [/voices of monterey bay/i, 'Voices of Monterey Bay']];
export const spanishName = src => `${(SHORT.find(([re]) => re.test(src || '')) || [, src])[1]} (Español)`;

/** One entry per distinct URL (never the kept story's own URL). Same-outlet follow-ups are kept, with title. */
export function normalizeCovered(list, best) {
  const out = [], seenUrl = new Set([normalizeUrl(best.link)]);
  const self = [...titleTokens(best.headline)].sort().join(' ');
  for (const e of list || []) {
    if (!e || !e.url) continue;
    const name = e.name || e.source || '';
    const k = normalizeUrl(e.url);
    if (seenUrl.has(k)) continue;
    // same outlet re-publishing the same headline at another URL is not "also covered by"
    if (name === best.source && e.title && [...titleTokens(e.title)].sort().join(' ') === self) continue;
    seenUrl.add(k);
    out.push(e.title ? { name, url: e.url, title: e.title } : { name, url: e.url });
  }
  return out;
}

/** Report residual duplicates (for verification). */
export function findResidualDuplicates(stories, opts = {}) {
  const urls = new Map(), dupUrls = [];
  for (const s of stories) { const k = normalizeUrl(s.link); if (urls.has(k)) dupUrls.push([urls.get(k), s]); else urls.set(k, s); }
  const { fuzzyPairs, translationPairs } = clusterStories(stories, opts);
  return { dupUrls, fuzzyPairs: fuzzyPairs.map(([i, j, sim, kind]) => [stories[i], stories[j], sim, kind]),
    translationPairs: translationPairs.map(([i, j, sc]) => [stories[i], stories[j], sc]) };
}
