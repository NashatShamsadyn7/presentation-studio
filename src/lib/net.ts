// ═══════════ داواکاری بە کاتی سنووردار و دووبارەهەوڵدانەوە ═══════════
//
// `fetch` بە بنەڕەت هیچ کاتێکی سنووردار نییە. ئەگەر داواکارییەک
// ڕایوەستا — پەیوەندی لاواز، سێرڤەر وەڵام نادات، تابەکە لە پشتەوەیە —
// بۆ هەتاهەتایە چاوەڕوان دەکات و ڕووکارەکە دەمرێت بەبێ هیچ هۆکارێک.
//
// کێشەی دووەم: سنووری بەکارهێنان. Crossref، OpenAlex، Gemini و Groq
// هەموویان ٤٢٩ دەدەنەوە کاتێک داواکاری زۆر بێت — و ئەوە زۆرجار تەنها
// چەند چرکەیەکە. پێشتر ئەو ٤٢٩ ـە ڕاستەوخۆ دەگەیشتە بەکارهێنەر و
// دروستکردنی دێککەکە دەوەستا، لە کاتێکدا هەوڵێکی دووەم سەرکەوتوو دەبوو.
//
// بۆیە هەموو داواکارییەکانی دەرەوە بەم ڕێگایە دەڕۆن.

/** کاتی چاوەڕوانی بنەڕەت — مۆدێلی گەورە دەکرێت ٦٠ چرکە بخایەنێت */
const DEFAULT_MS = 90_000;

/** پشوو پێش هەر هەوڵێکی نوێ — میلی چرکە */
const BACKOFF = [1000, 2500, 5000];

/** ئەو کۆدانەی مانایان «دووبارە هەوڵ بدە» ـیە، نەک «هەڵەت کردووە» */
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * سیاسەتی دووبارەهەوڵدانەوە بۆ داواکاری **پارەدار** (مۆدێلەکان).
 *
 * بۆچی جیاوازە: داتابەیسە زانستییەکان (OpenAlex، Crossref، DOAJ) بێبەرامبەرن
 * و دووبارەکردنەوەیان هیچ خەرجییەکی نییە. بەڵام مۆدێلێک کە ٥٠٠ دەداتەوە
 * دەکرێت پێشتر بەشێکی وەڵامەکەی دروستکردبێت — و ئەو تۆکنانە **لەسەر
 * بەکارهێنەر ژمێردراون**. دووبارە ناردنی سێ جار خەرجییەکە چوار قات دەکات
 * بۆ داواکارییەک کە لەوانەیە هەرگیز سەرکەوتوو نەبێت.
 *
 * بۆیە بۆ مۆدێلەکان تەنها ئەو کۆدانە دووبارە دەکرێنەوە کە بە دڵنیاییەوە
 * مانایان «هێشتا دەستم پێنەکردووە» ـیە — سنووری ڕێژە و کاتی چاوەڕوانی.
 * ٥٠٠ و ٥٠٢ ڕاستەوخۆ دەگەڕێنەوە بۆ بەکارهێنەر.
 */
export const MODEL_FETCH: Pick<FetchOpts, 'retries' | 'retryOn'> = {
  retries: 1,
  retryOn: new Set([408, 425, 429]),
};

export class TimeoutError extends Error {
  constructor(public ms: number) {
    super(`داواکارییەکە زیاتر لە ${Math.round(ms / 1000)} چرکە خایاند و وەستێنرا.`);
    this.name = 'TimeoutError';
  }
}

export interface FetchOpts extends RequestInit {
  /** میلی چرکە — بەتاڵ = ٩٠ چرکە */
  timeoutMs?: number;
  /** ڕەتکردنەوەی دەرەکی — بۆ دوگمەی «وەستاندن» */
  outerSignal?: AbortSignal;
  /**
   * چەند جار دووبارە هەوڵ بدرێتەوە لەسەر ٤٢٩/٥٠٣.
   * ٠ = هیچ. بەتاڵ = ٣.
   */
  retries?: number;
  /** کام کۆدی دۆخ دووبارە بکرێتەوە — بەتاڵ = `RETRY_STATUS` */
  retryOn?: ReadonlySet<number>;
  /** ڕاپۆرتی چاوەڕوانی — بۆ پیشاندان بە بەکارهێنەر */
  onRetry?: (attempt: number, waitMs: number, status: number) => void;
}

/** یەک هەوڵ — بەبێ دووبارەکردنەوە */
async function once(url: string | URL, o: FetchOpts, timeoutMs: number): Promise<Response> {
  const { timeoutMs: _t, outerSignal, retries: _r, retryOn: _s, onRetry: _o, ...init } = o;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new TimeoutError(timeoutMs)), timeoutMs);

  // ڕەتکردنەوەی دەرەکی — بەکارهێنەر دوگمەی «وەستاندن»ی لێدا
  const onOuter = () => ctrl.abort(outerSignal?.reason);
  outerSignal?.addEventListener('abort', onOuter, { once: true });

  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    // AbortError ی خاو هیچ ناڵێت — دەیگۆڕین بۆ هۆکاری ڕاستەقینە
    if (ctrl.signal.reason instanceof TimeoutError) throw ctrl.signal.reason;
    if ((e as Error).name === 'AbortError') throw new Error('داواکارییەکە وەستێنرا.');
    throw e;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onOuter);
  }
}

/**
 * سەرپەڕەی `Retry-After` — دوو شێواز هەیە:
 *   چرکە          Retry-After: 120
 *   ڕێکەوتی HTTP  Retry-After: Wed, 21 Oct 2026 07:28:00 GMT
 * ئەگەر نەبوو یان تێکچووبوو، `null` دەگەڕێنێتەوە.
 */
export function retryAfterMs(h: Headers | null): number | null {
  const v = h?.get('retry-after');
  if (!v) return null;

  const secs = Number(v.trim());
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000;

  const at = Date.parse(v);
  if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  return null;
}

/**
 * چاوەڕوانییەکەی **ناو لاشەی وەڵامەکە** — نەک سەرپەڕەکە.
 *
 * ═══ بۆچی ئەمە پێویست بوو ═══
 * Google API ـەکان لە ٤٢٩ ـدا `Retry-After` **نانێرن**. لەبری ئەوە
 * کاتەکە دەخەنە ناو JSON ـەکەوە:
 *
 *   {"error":{"code":429,"details":[
 *     {"@type":"type.googleapis.com/google.rpc.RetryInfo",
 *      "retryDelay":"31s"}]}}
 *
 * بەبێ خوێندنەوەی ئەمە، `waitFor` دەکەوتەوە سەر `BACKOFF[0]` — واتە
 * **یەک چرکە**. سنووری Gemini ی بێبەرامبەر سنوورێکی هەر خولەکێکە،
 * بۆیە هەوڵی دووەم دوای یەک چرکە بە دڵنیاییەوە هەر ٤٢٩ ی دەدایەوە.
 * دووبارەهەوڵدانەوەکە هەبوو، بەڵام هەرگیز شانسی سەرکەوتنی نەبوو.
 */
export function retryDelayMs(body: string): number | null {
  if (!body) return null;
  // «31s»، «1.5s»، یان «31.5s»
  const m = /"retryDelay"\s*:\s*"?(\d+(?:\.\d+)?)s"?/.exec(body);
  if (m) return Math.round(Number(m[1]) * 1000);
  // شێوازی گەردوونی protobuf — {"seconds": 31}
  const s = /"retryDelay"\s*:\s*\{[^{}]*"seconds"\s*:\s*"?(\d+)"?/.exec(body);
  return s ? Number(s[1]) * 1000 : null;
}

/**
 * زۆرترین چاوەڕوانی. پێشتر ٣٠ چرکە بوو — کەمتر لەوەی سنوورێکی
 * هەر خولەکێک پێویستی پێیەتی، بۆیە چاوەڕوانییەکە هەرگیز بەسنەبوو.
 */
const MAX_WAIT = 65_000;

/**
 * ئایا ئەم ٤٢٩ ـە سنووری **ڕۆژانە**یە؟
 *
 * جیاکردنەوەکە گرنگە: سنووری هەر خولەکێک بە چاوەڕوانی چارەسەر
 * دەبێت، بەڵام سنووری ڕۆژانە نا — چاوەڕوانی ٦٥ چرکە تەنها کاتی
 * بەکارهێنەر دەخوات و ئینجا هەر هەمان هەڵە دەداتەوە.
 *
 * Google ناوی مەترەکە دەنێرێت:
 *   GenerateRequestsPerDayPerProjectPerModel
 *   GenerateRequestsPerMinutePerProjectPerModel
 */
export const isDailyQuota = (body: string) => /per\s*day/i.test(body);

/** پشووی هەوڵی ژمارە `i` — بە لەرزەوە، تا هەموو تابەکان پێکەوە نەگەڕێنەوە */
function waitFor(i: number, res: Response | null, body = ''): number {
  // سێرڤەرەکە خۆی زانیاری باشتری هەیە — بەڵام ناهێڵین بەبێ سنوور بێت
  const server = retryAfterMs(res?.headers ?? null) ?? retryDelayMs(body);
  // ١ چرکە زیاد دەکرێت: کاتژمێری سێرڤەرەکە و هی ئێمە ڕێک وەک یەک نین،
  // و گەڕانەوە یەک میلی چرکە زوو هەمان ٤٢٩ دەهێنێتەوە
  if (server !== null) return Math.min(server + 1000, MAX_WAIT);
  const base = BACKOFF[Math.min(i, BACKOFF.length - 1)];
  return base + Math.random() * base * 0.4;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    if (signal?.aborted) return rej(new Error('داواکارییەکە وەستێنرا.'));
    const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); res(); }, ms);
    function onAbort() { clearTimeout(t); rej(new Error('داواکارییەکە وەستێنرا.')); }
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * وەک `fetch`، بەڵام:
 *   • دوای `timeoutMs` خۆی دەوەستێت
 *   • دەتوانرێت لە دەرەوە ڕەت بکرێتەوە
 *   • هەڵەی کاتی سنووردار جیا دەکرێتەوە لە هەڵەی تۆڕ
 *   • لەسەر ٤٢٩ و ٥٠٣ خۆی دووبارە هەوڵ دەداتەوە بە پشووی زیادبوو
 *
 * ئاگاداری: تەنها **کۆدی دۆخ** دووبارە هەوڵ دەدرێتەوە، نەک هەڵەی تۆڕ.
 * هەڵەیەکی تۆڕی زۆرجار مانای CORS یان کێشەی DNS ـە — دووبارەکردنەوە
 * تەنها کات بەفیڕۆ دەدات.
 */
export async function fetchWithTimeout(url: string | URL, o: FetchOpts = {}): Promise<Response> {
  const timeoutMs = o.timeoutMs ?? DEFAULT_MS;
  const retries = o.retries ?? BACKOFF.length;
  const retryOn = o.retryOn ?? RETRY_STATUS;

  let res = await once(url, o, timeoutMs);

  for (let i = 0; i < retries && retryOn.has(res.status); i++) {
    // لاشەکە **پێش** حیسابکردنی چاوەڕوانی دەخوێندرێتەوە — کاتی Google
    // لەوێدایە، نەک لە سەرپەڕەکاندا.
    //
    // لە `clone()` ـەوە دەخوێندرێتەوە، نەک لە خودی وەڵامەکە: ئەگەر
    // لێرەدا بگەڕێینەوە، بانگخوازەکە دەبێت بتوانێت هەمان لاشە
    // بخوێنێتەوە بۆ پەیامی هەڵەکە. لاشەیەکی خوێندراوە دووەم جار
    // بەتاڵە، و ئەوە هەڵەکە بێدەنگ دەکات.
    let body = '';
    try { body = await res.clone().text(); } catch { /* گرنگ نییە */ }

    // سنووری ڕۆژانە بە چاوەڕوانی چارەسەر نابێت — دەستبەجێ بگەڕێوە
    if (res.status === 429 && isDailyQuota(body)) break;

    const ms = waitFor(i, res, body);
    o.onRetry?.(i + 1, ms, res.status);
    // ئازادکردنی پەیوەندییەکە — ئەم وەڵامە فڕێدەدرێت
    try { await res.text(); } catch { /* گرنگ نییە */ }
    await sleep(ms, o.outerSignal);
    res = await once(url, o, timeoutMs);
  }

  return res;
}
