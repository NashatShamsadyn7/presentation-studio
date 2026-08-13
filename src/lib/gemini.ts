// ═══════════ پەیوەندی ڕاستەوخۆ لەگەڵ Gemini ═══════════
// گرنگ: هەموو بانگکردنێک لە وێبگەڕی بەکارهێنەرەوە دەچێت.
// هیچ کلیلێک ناگاتە هیچ سێرڤەرێکی ئێمە — چونکە هیچ سێرڤەرێکمان نییە.

import { fetchWithTimeout, isDailyQuota, MODEL_FETCH } from './net';
import { sseLines } from './stream';
import type { Lang } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const TEXT_MODEL  = 'gemini-2.5-pro';

/**
 * ئەگەر مۆدێلی هەڵبژێردراو نەبوو (٤٠٤)، ئەمانە بە ڕیز تاقی دەکرێنەوە.
 *
 * ═══ بۆچی ═══
 * کاتالۆگی مۆدێلەکان بە دەست دەنووسرێت و ناتوانرێت لێرەوە بپشکنرێت —
 * C2 دەڵێت هیچ کلیلێکمان نییە، بۆیە هیچ بانگکردنێکی ڕاستەقینە لە
 * تاقیکردنەوەدا ناکرێت. Google ناوی مۆدێلەکانیش دەگۆڕێت و کۆنەکان
 * لادەبات.
 *
 * بەبێ ئەمە، ناوێکی هەڵە واتای ئەوەیە کە **هەموو بەکارهێنەرێکی نوێ**
 * ڕاستەوخۆ ٤٠٤ وەردەگرێت و هیچی لەدەست نایەت. لەگەڵ ئەمە، تەنها
 * چرکەیەک زیاتر دەخایەنێت و کارەکە دەکرێت.
 */
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash'] as const;

/** ئایا ئەم هەڵەیە دەربارەی نەبوونی مۆدێلەکەیە؟ */
const isMissingModel = (status: number, raw: string) =>
  status === 404 || (status === 400 && /not found|not supported|unknown model/i.test(raw));
export const IMAGE_MODEL = 'gemini-3.1-flash-image';   // Nano Banana 2

export class GeminiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

/** پەیامی هەڵەی تێگەیشتراو بە کوردی */
function humanError(status: number, raw: string): string {
  if (status === 400 && /API key not valid/i.test(raw))
    return 'کلیلی API دروست نییە. تکایە لە Google AI Studio کلیلێکی نوێ دروست بکە.';
  // ٤٠٠ ـی گەڕان — پەیامەکەی Google لێرەدا دەمێنێتەوە، چونکە بەبێی
  // هۆکاری شکستی گەڕان بە تەواوی نادیارە
  if (status === 400 && /google_search|tool/i.test(raw))
    return 'گەڕان لە ئینتەرنێت لەم مۆدێلەدا کار ناکات. مۆدێلێکی تر هەڵبژێرە. ' +
           `(${raw.replace(/\s+/g, ' ').slice(0, 160)})`;
  // ٤٢٩: `net.ts` بەو کاتەی Google خۆی داوای کردبوو چاوەڕوانی کردووە و
  // دووبارە هەوڵی داوەتەوە پێش گەیشتن بە ئێرە (بڕوانە `retryDelayMs`).
  // بۆیە «چاوەڕێ بکە» بە تەنها ڕێنماییەکی هەڵەیە — کرا و بەس نەبوو.
  if (status === 429)
    return isDailyQuota(raw)
      ? 'سنووری ڕۆژانەی ئەم مۆدێلە تەواو بووە. هەر مۆدێلێک سنووری خۆی هەیە، '
        + 'بۆیە لە تابی «ڕێکخستن» مۆدێلێکی تر تاقی بکەرەوە — یان سبەی بگەڕێوە.'
      : 'سنووری هەر خولەکێک تێپەڕێندرا. چاوەڕوانی کرا و دووبارە هەوڵدرایەوە، '
        + 'بەڵام هێشتا بەردەوامە. نیو خولەک بوەستە و دووبارە هەوڵ بدە.';
  if (status === 403)
    return 'کلیلەکە ڕێگەی پێنەدراوە بۆ ئەم مۆدێلە. لە Google AI Studio چالاکی بکە.';
  if (status === 404)
    return 'ئەم مۆدێلە چیتر بەردەست نییە. لە تابی «ڕێکخستن» مۆدێلێکی نوێتر هەڵبژێرە ' +
           '(بۆ نموونە Gemini 3.6 Flash).';
  if (status >= 500)
    return 'سێرڤەری Gemini وەڵامی نەدایەوە. دواتر هەوڵ بدەرەوە.';
  return `هەڵەی Gemini (${status}): ${raw.slice(0, 200)}`;
}

interface CallOpts {
  key: string;
  prompt: string;
  system?: string;
  /** سکێمای JSON — وا لە مۆدێل دەکات دەرئەنجامێکی ڕێکخراو بداتەوە */
  schema?: object;
  /** گەڕان لە ئینتەرنێت بە Google Search */
  search?: boolean;
  temperature?: number;
  model?: string;
  /**
   * سنووری ڕێژە دەستی پێکرد و چاوەڕوانی دەکرێت.
   *
   * بەبێ ئەمە ڕووکارەکە بۆ ٣٠ چرکە دەبەستێت بەبێ هیچ هۆکارێک، و
   * بەکارهێنەر وا دەزانێت تەپەکە مردووە — ئینجا دووبارە دوگمەکە
   * لێدەدات، کە هەمان سنوور دووبارە دەخاتەوە کار.
   */
  onWait?: (ms: number) => void;
  /**
   * وەستاندنی دەرەکی.
   *
   * ─── بۆچی بۆ بانگکردنی ئاساییش پێویستە ───
   * پێشتر تەنها `streamGemini` وەستاندنی هەبوو، چونکە دروستکردنی
   * دێکک **یەک** بانگکردنی ڕەشەبا بوو. تیمی ئەیجێنت ١٢ تا ١٨
   * بانگکردن دەکات کە زۆربەیان ڕەشەبا نین — بەبێ ئەمە دوگمەی
   * «وەستاندن» تەنها ئاڵایەکە و بانگکردنەکە لە پشتەوە تەواو دەبێت،
   * لەگەڵ خەرجییەکەشی.
   */
  signal?: AbortSignal;
}

/**
 * ناوی ئامرازی گەڕان لە نەوەکانی Gemini دا **جیاوازە**:
 *
 *   google_search             Gemini 2.0 و دواتر
 *   google_search_retrieval   Gemini 1.5
 *
 * کاتالۆگی دابینکەرەکە هەردوو نەوە لەخۆدەگرێت (٢.٥ Pro تا ٣.٦ Flash)،
 * بۆیە ناوێکی چەسپاو بۆ هەندێک مۆدێل ٤٠٠ دەداتەوە — و ئەو ٤٠٠ ـە
 * **هەموو بانگکردنەکە** دەکوژێت، نەک تەنها گەڕانەکە. ئەنجامەکەی ئەوە
 * بوو کە پێڕستەکە هەمیشە بەبێ گەڕان دروست دەبوو.
 */
const SEARCH_TOOLS = ['google_search', 'google_search_retrieval'] as const;

/** ئایا ئەم هەڵەیە دەربارەی ناوی ئامرازەکەیە، نەک شتێکی تر؟ */
const isToolNameError = (status: number, raw: string) =>
  status === 400 && /unknown name|invalid json payload|google_search|not supported|tool/i.test(raw);

/** بانگکردنی سەرەکی — دەقی خاو دەگەڕێنێتەوە */
export async function callGemini(o: CallOpts): Promise<{ text: string; sources: GroundingSource[] }> {
  if (!o.key) throw new GeminiError('کلیلی Gemini دانەنراوە.');

  // مۆدێلی داواکراو یەکەم، ئینجا پاشەکشەکان — بڕوانە `FALLBACK_MODELS`
  const chain = [o.model ?? TEXT_MODEL,
                 ...FALLBACK_MODELS.filter(m => m !== (o.model ?? TEXT_MODEL))];
  let model = chain[0];

  /** یەک هەوڵ بە ناوێکی دیاریکراوی ئامرازی گەڕان */
  const attempt = async (tool: string | null) => {
    const url = `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(o.key)}`;
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: o.prompt }] }],
      generationConfig: {
        temperature: o.temperature ?? 0.7,
        ...(o.schema && !o.search
          ? { responseMimeType: 'application/json', responseSchema: o.schema }
          : {}),
      },
    };
    if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
    // تێبینی: Google Search و responseSchema پێکەوە کار ناکەن —
    // بۆیە لە دۆخی گەڕاندا JSON بە دەست لە وەڵامەکە دەردەهێنین.
    if (tool) body.tools = [{ [tool]: {} }];

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...MODEL_FETCH,
      outerSignal: o.signal,
      onRetry: (_n, ms) => o.onWait?.(ms),
      body: JSON.stringify(body),
    });
    return { res, raw: await res.text() };
  };

  /** هەموو هەوڵەکانی ئامرازی گەڕان بۆ **یەک** مۆدێل */
  const forModel = async (): Promise<{ res: Response; raw: string }> => {
    if (!o.search) return attempt(null);
    // ناوەکان بە ڕیزبەندی تاقی دەکرێنەوە تا یەکێکیان قبووڵ بکرێت
    let last: { res: Response; raw: string } | null = null;
    for (const tool of SEARCH_TOOLS) {
      last = await attempt(tool);
      if (last.res.ok) break;
      if (!isToolNameError(last.res.status, last.raw)) break;   // هەڵەیەکی تر — مەیگەڕێنەوە
    }
    return last!;
  };

  // ═══ مۆدێلی نەبوو دێککەکە ناکوژێت ═══
  // کاتالۆگەکە بە دەست نووسراوە و ناتوانرێت بپشکنرێت (C2 — کلیلمان
  // نییە). ئەگەر ناوێک هەڵە بێت، دەکەوینەوە سەر ئەوەی دواتر لەبری
  // ئەوەی بەکارهێنەر ٤٠٤ ـێک ببینێت و هیچی لەدەست نەیەت.
  let got = await forModel();
  for (let i = 1; i < chain.length && !got.res.ok; i++) {
    if (!isMissingModel(got.res.status, got.raw)) break;
    model = chain[i];
    got = await forModel();
  }

  const { res, raw } = got;
  if (!res.ok) throw new GeminiError(humanError(res.status, raw), res.status);

  let data: GeminiResponse;
  try { data = JSON.parse(raw); }
  catch { throw new GeminiError('وەڵامی Gemini خوێندنەوەی بۆ نەکرا.'); }

  const cand = data.candidates?.[0];
  if (!cand) throw new GeminiError('Gemini هیچ وەڵامێکی نەگەڕاندەوە.');
  if (cand.finishReason === 'SAFETY')
    throw new GeminiError('ناوەڕۆکەکە لەلایەن فلتەری سەلامەتییەوە ڕاگیرا. بابەتەکە بگۆڕە.');

  const text = (cand.content?.parts ?? []).map(p => p.text ?? '').join('');
  return { text, sources: extractSources(cand) };
}

/**
 * هەمان بانگکردن، بەڵام وەڵامەکە بە پارچە دێت.
 *
 * `?alt=sse` پێویستە — بەبێی Gemini ڕیزێکی JSON دەنێرێت کە تەنها
 * دوای تەواوبوونی دەکرێتەوە، واتە هیچ سوودێکی نییە.
 *
 * `onText` دوای هەر پارچەیەک بانگ دەکرێت بە **هەموو** دەقی کۆکراوە،
 * نەک تەنها پارچەی نوێ. بەمە بانگکەر ناچار نییە خۆی کۆی بکاتەوە،
 * و `partialArray` ڕاستەوخۆ لەسەری کاردەکات.
 *
 * `signal` بۆ وەستاندنە. بەبێی، ئەگەر بەکارهێنەر «وەستاندن» بکات،
 * داواکارییەکە لە پشتەوە بەردەوام دەبێت و کریدیت دەخوات.
 */
export async function streamGemini(
  o: CallOpts & { signal?: AbortSignal; onText: (all: string) => void },
): Promise<{ text: string; sources: GroundingSource[] }> {
  if (!o.key) throw new GeminiError('کلیلی Gemini دانەنراوە.');

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: o.prompt }] }],
    generationConfig: {
      temperature: o.temperature ?? 0.7,
      ...(o.schema && !o.search
        ? { responseMimeType: 'application/json', responseSchema: o.schema }
        : {}),
    },
  };
  if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
  if (o.search) body.tools = [{ google_search: {} }];

  const model = o.model ?? TEXT_MODEL;
  const res = await fetch(
    `${BASE}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(o.key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: o.signal,
    },
  );

  if (!res.ok) throw new GeminiError(humanError(res.status, await res.text()), res.status);

  let text = '';
  const sources: GroundingSource[] = [];
  const seen = new Set<string>();

  for await (const chunk of sseLines(res)) {
    let data: GeminiResponse;
    try { data = JSON.parse(chunk); }
    catch { continue; }                      // پارچەیەکی ناتەواو

    const cand = data.candidates?.[0];
    if (!cand) continue;
    if (cand.finishReason === 'SAFETY')
      throw new GeminiError('ناوەڕۆکەکە لەلایەن فلتەری سەلامەتییەوە ڕاگیرا. بابەتەکە بگۆڕە.');

    const part = (cand.content?.parts ?? []).map(p => p.text ?? '').join('');
    if (part) { text += part; o.onText(text); }

    // سەرچاوەکانی گەڕان لە کۆتایی ڕەشەباکەدا دێن
    for (const s of extractSources(cand))
      if (!seen.has(s.url)) { seen.add(s.url); sources.push(s); }
  }

  if (!text) throw new GeminiError('Gemini هیچ وەڵامێکی نەگەڕاندەوە.');
  return { text, sources };
}

// شیکردنەوەی JSON چیتر لێرە نییە — بڕوانە `json.ts`.
//
// هۆکارەکە: هەڵەکەی `GeminiError` بوو، بۆیە شکستی JSON لە DeepSeek یان
// OpenAI ـەوە وەک هەڵەیەکی Gemini پیشان دەدرا، لەگەڵ ئامۆژگارییەک بۆ
// کوژاندنەوەی گەڕانێک کە بەکارهێنەر هەرگیز نەیکردبووەوە. ئێستا
// `parseJson` ناوی دابینکەری ڕاستەقینە وەردەگرێت.

// ─────────── سەرچاوەکانی گەڕان ───────────

export interface GroundingSource {
  title: string;
  url: string;
  domain: string;
}

interface GeminiResponse {
  candidates?: {
    finishReason?: string;
    content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
}

function extractSources(cand: NonNullable<GeminiResponse['candidates']>[number]): GroundingSource[] {
  const chunks = cand.groundingMetadata?.groundingChunks ?? [];
  const out: GroundingSource[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    const url = c.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* ناونیشانی ناتەواو */ }
    out.push({ title: c.web?.title ?? domain, url, domain });
  }
  return out;
}

// ─────────── دروستکردنی وێنە ───────────

/** وێنەیەک دروست دەکات و وەک data: URI دەیگەڕێنێتەوە */
export async function generateImage(key: string, prompt: string): Promise<string> {
  if (!key) throw new GeminiError('کلیلی Gemini بۆ وێنە دانەنراوە.');

  const res = await fetchWithTimeout(`${BASE}/models/${IMAGE_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...MODEL_FETCH,
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new GeminiError(humanError(res.status, raw), res.status);

  const data: GeminiResponse = JSON.parse(raw);
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find(p => p.inlineData);
  if (!img?.inlineData) throw new GeminiError('هیچ وێنەیەک نەگەڕێندرایەوە.');

  return `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`;
}

/** پشکنینی خێرای کلیل */
export async function testKey(key: string): Promise<boolean> {
  try {
    await callGemini({ key, prompt: 'ok', temperature: 0 });
    return true;
  } catch { return false; }
}

/** ناوی زمان بۆ ناو پرۆمپتەکان */
export const LANG_NAME: Record<Lang, string> = {
  ckb: 'Kurdish Sorani (کوردی سۆرانی), written right-to-left in the Arabic script',
  ar:  'Modern Standard Arabic (العربية الفصحى), written right-to-left',
  en:  'English',
};
