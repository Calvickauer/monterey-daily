// Text cleanup + short-summary helpers for feed items.
// Goal: 1–2 sentence teasers (~280 chars max), never the full article text.

const NAMED = {
  amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', ensp:' ', emsp:' ', thinsp:' ', zwj:'', zwnj:'', shy:'',
  lsquo:'‘', rsquo:'’', sbquo:'‚', ldquo:'“', rdquo:'”', bdquo:'„', laquo:'«', raquo:'»', lsaquo:'‹', rsaquo:'›', prime:'′', Prime:'″',
  ndash:'–', mdash:'—', hellip:'…', bull:'•', middot:'·', para:'¶', sect:'§', dagger:'†', Dagger:'‡', permil:'‰',
  copy:'©', reg:'®', trade:'™', deg:'°', plusmn:'±', times:'×', divide:'÷', frac12:'½', frac14:'¼', frac34:'¾', sup2:'²', sup3:'³', micro:'µ',
  cent:'¢', pound:'£', euro:'€', yen:'¥', curren:'¤', iexcl:'¡', iquest:'¿', ordf:'ª', ordm:'º', acute:'´', uml:'¨', cedil:'¸', macr:'¯', brvbar:'¦', not:'¬', larr:'←', rarr:'→', uarr:'↑', darr:'↓', harr:'↔',
  Agrave:'À', Aacute:'Á', Acirc:'Â', Atilde:'Ã', Auml:'Ä', Aring:'Å', AElig:'Æ', Ccedil:'Ç', Egrave:'È', Eacute:'É', Ecirc:'Ê', Euml:'Ë',
  Igrave:'Ì', Iacute:'Í', Icirc:'Î', Iuml:'Ï', ETH:'Ð', Ntilde:'Ñ', Ograve:'Ò', Oacute:'Ó', Ocirc:'Ô', Otilde:'Õ', Ouml:'Ö', Oslash:'Ø',
  Ugrave:'Ù', Uacute:'Ú', Ucirc:'Û', Uuml:'Ü', Yacute:'Ý', THORN:'Þ', szlig:'ß',
  agrave:'à', aacute:'á', acirc:'â', atilde:'ã', auml:'ä', aring:'å', aelig:'æ', ccedil:'ç', egrave:'è', eacute:'é', ecirc:'ê', euml:'ë',
  igrave:'ì', iacute:'í', icirc:'î', iuml:'ï', eth:'ð', ntilde:'ñ', ograve:'ò', oacute:'ó', ocirc:'ô', otilde:'õ', ouml:'ö', oslash:'ø',
  ugrave:'ù', uacute:'ú', ucirc:'û', uuml:'ü', yacute:'ý', thorn:'þ', yuml:'ÿ', OElig:'Œ', oelig:'œ', Scaron:'Š', scaron:'š', Yuml:'Ÿ', fnof:'ƒ', circ:'ˆ', tilde:'˜',
};
const CP1252 = { 128:'€',130:'‚',131:'ƒ',132:'„',133:'…',134:'†',135:'‡',136:'ˆ',137:'‰',138:'Š',139:'‹',140:'Œ',142:'Ž',145:'‘',146:'’',147:'“',148:'”',149:'•',150:'–',151:'—',152:'˜',153:'™',154:'š',155:'›',156:'œ',158:'ž',159:'Ÿ' };
const cp = n => { if (CP1252[n]) return CP1252[n]; if (!n || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return ''; try { return String.fromCodePoint(n); } catch { return ''; } };

/** Decode named + numeric HTML entities. Runs twice to undo double-encoding (&amp;#8217;). */
export function decodeEntities(s = '') {
  let out = String(s);
  for (let k = 0; k < 2 && /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i.test(out); k++) {
    out = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
      if (e[0] === '#') return cp(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return e in NAMED ? NAMED[e] : (e.toLowerCase() in NAMED ? NAMED[e.toLowerCase()] : m);
    });
  }
  return out;
}

const txt = v => (v == null ? '' : typeof v === 'object' ? (v['#text'] ?? '') : String(v));

/** HTML -> plain text: drop non-content elements, strip tags, decode entities, collapse whitespace. */
export function cleanText(v) {
  let s = txt(v);
  s = s.replace(/<!\[CDATA\[|\]\]>/g, '')
       .replace(/<(script|style|figcaption|figure|noscript|iframe|svg)\b[\s\S]*?<\/\1>/gi, ' ')
       .replace(/<!--[\s\S]*?-->/g, ' ')
       .replace(/<\/?(p|div|br|li|h[1-6]|blockquote|tr)\b[^>]*>/gi, '\n')
       .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s).replace(/<[^>]+>/g, ' '); // tags that were entity-encoded
  return s.replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ').replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n[\s\n]*/g, '\n').trim();
}

// A byline name: First [M.] Last (two capitalised words; a third word is ambiguous with the story text).
// Known three-word bylines from our outlets are listed explicitly.
const NAME = "(?:Claudia Meléndez Salinas|Víctor M\\. Almazán|\\p{Lu}\\p{Ll}[\\p{L}'’-]*(?:\\s+\\p{Lu}\\.)?\\s+\\p{Lu}\\p{Ll}[\\p{L}'’-]*)";
const KICKERS = 'FOR IMMEDIATE RELEASE|PRESS RELEASE|NEWS RELEASE|FEATURED(?: STORY)?|DESTACADO|REPORTAJE|OBITUARY|OBITUARIO|CRIMINAL JUSTICE|JUSTICIA PENAL|OPINI[OÓ]N|COMMENTARY|COMENTARIO|ANALYSIS|AN[AÁ]LISIS|PERSPECTIVE|UPDATE|BREAKING(?: NEWS)?|EDUCATION|EDUCACI[OÓ]N|ENVIRONMENT|MEDIO AMBIENTE|HEALTH|SALUD|POLITICS|POL[IÍ]TICA|AGRICULTURE|AGRICULTURA|IMMIGRATION|INMIGRACI[OÓ]N|ARTS?|CULTURE|CULTURA|COMMUNITY|COMUNIDAD|ELECTIONS?|ELECCIONES|HOUSING|VIVIENDA|LABOR|TRABAJO|SPORTS|DEPORTES|NEWS|NOTICIAS';
const CREDIT = '(?:By|Por|(?:Story|Article|Photos?|Text|Words|Artículo|Fotos?|Fotografías|Reportaje|Texto)(?:\\s+(?:and|y|&)\\s+(?:story|photos?|article|text|words|fotos?|fotografías|artículo|texto))?\\s+(?:by|por|de))';
const BOILERPLATE = [
  /\bThe post\b[\s\S]*?\bappeared first on\b[\s\S]*$/i,         // WordPress footer
  /\bThis (article|story|entry) (was )?(originally )?(appeared|published) (first )?(on|in)\b[\s\S]*$/i,
  /\b(Continue reading|Read more|Read the full (story|article)|Keep reading|Click here to read( more)?)\b[\s\S]{0,120}$/i,
  /\[(…|\.\.\.|&hellip;|more)\]\s*$/i,                            // [...] / […]
  /\s*(…|\.\.\.)\s*$/,                                            // trailing ellipsis from feed truncation
];
const LEADING = [
  /^\s*(Last Updated|Updated|UPDATE|Posted( on)?|Published)\s*:?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*/i,
  /^\s*(Posted|Published|Updated)( on)?\s*:?\s*[A-Z][a-z]+\.? \d{1,2},? \d{4}\s*/,
  new RegExp(`^\\s*(?:${KICKERS})\\s*[|｜:]?\\s+(?=\\p{Lu}|¿|¡|")`, 'u'),          // "FEATURED ", "REPORTAJE | "
  /^\s*\p{Lu}{3,}(?:\s+\p{Lu}{2,}){0,2}\s*[|｜]\s*/u,                                 // any "SECTION | "
  new RegExp(`^[^\\n]{0,160}?Traducci[oó]n(?:\\s+por|\\s*:)?\\s+${NAME}\\s+`, 'u'),   // Voices bylines incl. translator
  new RegExp(`^\\s*${CREDIT}\\s+${NAME}(?:\\s*(?:,|and|y|&)\\s*${NAME})*(?:\\s*,\\s*(?:CNN|AP|Reuters|KION|KSBW|Bay City News|CalMatters|[A-Z]{2,6}))?\\s*(?:\\(CNN\\)\\s*[—–-]+\\s*)?(?:[|—–-]\\s*)?`, 'u'),
  /^\s*\((CNN|AP|Reuters|Bay City News)\)\s*[—–-]+\s*/i,
  /^\s*[A-Z][\w .]{1,30}, [A-Z]{2}\.?\s*[—–-]+\s*[A-Z][a-z]+\.? \d{1,2},? \d{4}\s*[—–-]?\s*/,   // "Marina, CA — September 22, 2026"
];
const ABBR = /\b(Mr|Mrs|Ms|Dr|Sr|Jr|St|Mt|Ft|Ave|Blvd|Rd|Hwy|No|Gov|Sen|Rep|Sgt|Lt|Capt|Det|Ofc|Dep|Supt|Prof|Inc|Co|Corp|Ltd|vs|etc|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Calif|U\.S|a\.m|p\.m|[A-Z])\.$/;

/** Split into sentences, avoiding common abbreviations / initials. */
export function sentences(s) {
  const out = []; let start = 0;
  const re = /[.!?]+["”’)\]]*(?=\s+["“¿¡(]?[\p{Lu}\d])/gu; let m;
  while ((m = re.exec(s))) {
    const end = m.index + m[0].length; const chunk = s.slice(start, end);
    if (m[0][0] === '.' && ABBR.test(s.slice(Math.max(start, m.index - 12), m.index + 1))) continue;
    out.push(chunk.trim()); start = end;
  }
  const rest = s.slice(start).trim(); if (rest) out.push(rest);
  return out;
}

/** County press-release format: "DATE/TIME: … TYPE OF INCIDENT: … LOCATION: … MEDIA CONTACT: … narrative" */
function pressRelease(s) {
  if (!/TYPE OF INCIDENT:/i.test(s)) return null;
  const LABELS = 'DATE/TIME|TYPE OF INCIDENT|LOCATION|MEDIA CONTACT|CASE ?#|SUSPECTS?|VICTIMS?';
  const f = k => s.match(new RegExp(`${k}:\\s*([\\s\\S]*?)\\s*(?=(?:${LABELS}):|\\n|$)`, 'i'))?.[1]?.replace(/(…|\.\.\.)$/, '').trim();
  const body = s.includes('\n') ? s.split('\n').filter(l => !new RegExp(`^\\s*(?:${LABELS})\\b`, 'i').test(l)).join(' ').trim() : '';
  const loc = f('LOCATION');
  return { lead: [f('TYPE OF INCIDENT'), loc && `Location: ${loc}`].filter(Boolean).join('. ').replace(/[\s,;:]+$/, '').replace(/([^.!?])$/, '$1.'), body };
}

/**
 * Build a 1–2 sentence teaser.
 * @param {string} raw  feed description / content (HTML ok)
 * @param {{title?:string, source?:string, max?:number}} opts
 */
export function summarize(raw, { title = '', source = '', max = 280 } = {}) {
  let s = cleanText(raw);
  if (!s) return '';
  const pr = pressRelease(s);
  if (pr) s = pr.body && pr.body.replace(/(…|\.\.\.)\s*$/, '').split(/\s+/).length > 12 ? pr.body : pr.lead;
  // Syndication notes: "This story was originally published by X." / "It is republished here with permission."
  const repub = s.match(/\bThis (?:story|article) (?:was )?(?:originally )?(?:published|produced) (?:by|in|on) ([^.]{2,60}?)\.\s*/i);
  if (repub) { s = s.replace(repub[0], ' ').replace(new RegExp(`^([^\\n]{0,120}?),\\s*${repub[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s)`, 'u'), '$1'); }
  s = s.replace(/[\w.#-]*\s*\{[^}]*(\}|$)/g, ' '); // leaked inline CSS rules
  s = s.replace(/\b(It is |It's )?(re)?published here with permission[^.]*\.\s*/gi, ' ').replace(/https?:\/\/\S+/g, ' ').trim();
  for (let k = 0; k < 4; k++) { const before = s; for (const r of LEADING) s = s.replace(r, ''); if (s === before) break; }
  s = s.replace(/\s*\n\s*/g, ' ');
  for (let k = 0; k < 4; k++) { const before = s; for (const r of LEADING) s = s.replace(r, ''); if (s === before) break; }
  let truncated = false;
  for (const r of BOILERPLATE) { const t = s.replace(r, ''); if (t !== s) { if (r.source.includes('…')) truncated = true; s = t.trim(); } }
  // Trailing source credit, e.g. " - KSBW" or " | Monterey County NOW"
  if (source) { const short = source.split(/[(/–—-]/)[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); s = s.replace(new RegExp(`\\s*[|–—-]\\s*${short}[^.]{0,40}$`, 'i'), ''); }
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/(\p{Ll}{2})\.(\p{Lu}\p{Ll})/gu, '$1. $2').trim();
  // Drop a lead that just repeats the headline.
  const t = cleanText(title).replace(/\s+/g, ' ').trim();
  if (t && s.toLowerCase().startsWith(t.toLowerCase()) && s.length > t.length + 40 && /^\s*([:.—–|-]|\p{Lu})/u.test(s.slice(t.length))) { s = s.slice(t.length).replace(/^[\s:.—–|-]+/, ''); for (const r of LEADING) s = s.replace(r, ''); }
  if (!s || (t && s.toLowerCase() === t.toLowerCase())) return '';

  const sents = sentences(s);
  let out = '';
  for (const x of sents.slice(0, 2)) {
    const next = out ? `${out} ${x}` : x;
    if (next.length > max) break;
    out = next;
    if (out.length >= 140) break;          // one solid sentence is enough
  }
  // Ended on an incomplete (feed-truncated) fragment? Keep only complete sentences if we have one.
  if (out && (truncated || out.length < s.length) && !/[.!?]["”’)\]]*$/.test(out)) {
    const complete = sentences(out).filter(x => /[.!?]["”’)\]]*$/.test(x));
    if (complete.length) out = complete.join(' '); else out = '';
  }
  if (!out) {                              // first sentence too long (or no boundary): cut on a word
    if (s.length <= max && !truncated) return s;
    const cut = s.slice(0, max - 1); const sp = cut.lastIndexOf(' ');
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:—–-]+$/, '') + '…';
  }
  return out;
}
