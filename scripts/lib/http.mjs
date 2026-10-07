// Shared HTTP helper: per-request timeout + retry with exponential backoff and jitter on 429 / 5xx
// (and transient network errors), honoring Retry-After, with a bounded total time.
export const BOT_UA = 'MontereyDaily/1.0 (+https://github.com/Calvickauer/monterey-daily; contact: calvickauer@users.noreply.github.com)';
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
export const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Headers for a source from sources.json: optional "user_agent" ("browser" or a literal UA) and "headers" {}. */
export function sourceHeaders(src = {}) {
  const ua = src.user_agent === 'browser' ? BROWSER_UA : src.user_agent || BOT_UA;
  return { 'User-Agent': ua, Accept: '*/*', ...(src.user_agent === 'browser' ? BROWSER_HEADERS : {}), ...(src.headers || {}) };
}

/** Parse Retry-After (seconds or HTTP date) into ms, or null. */
export function retryAfterMs(v, now = Date.now()) {
  if (v == null || v === '') return null;
  if (/^\d+(\.\d+)?$/.test(String(v).trim())) return Math.round(parseFloat(v) * 1000);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : Math.max(0, t - now);
}

const RETRYABLE = s => s === 429 || (s >= 500 && s <= 599);

/**
 * fetch with retries. Throws Error(status) after the last attempt (err.status set).
 * opts: headers, timeoutMs (per try, 20s), tries (3), baseMs (1000), maxWaitMs (per wait, 15s), budgetMs (total, 45s),
 *       fetchImpl, sleep, random (for tests).
 */
export async function fetchWithRetry(url, { headers = {}, timeoutMs = 20000, tries = 3, baseMs = 1000, maxWaitMs = 15000, budgetMs = 45000,
  fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), random = Math.random, log = () => {} } = {}) {
  const start = Date.now();
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    let res, wait = null;
    try {
      res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      if (res.ok) return res;
      lastErr = Object.assign(new Error(String(res.status)), { status: res.status });
      if (!RETRYABLE(res.status)) throw lastErr;
      wait = retryAfterMs(res.headers?.get?.('retry-after'));
    } catch (e) {
      if (e === lastErr && !RETRYABLE(e.status)) throw e;
      if (e !== lastErr) { // network error / timeout
        lastErr = e;
        if (e?.name === 'TimeoutError' || e?.name === 'AbortError') { if (attempt >= 2) throw e; }
      }
    }
    if (attempt === tries) break;
    const backoff = baseMs * 2 ** (attempt - 1) * (0.5 + random()); // exponential with jitter
    const ms = Math.min(maxWaitMs, wait != null ? Math.max(wait, backoff * 0.5) : backoff);
    if (Date.now() - start + ms > budgetMs) break; // keep total time bounded
    log(`retry ${attempt}/${tries - 1} in ${Math.round(ms)}ms: ${url} (${lastErr?.status || lastErr?.message})`);
    await sleep(ms);
  }
  throw lastErr;
}
