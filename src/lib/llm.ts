// ═══════════ دەروازەی یەکگرتوو بۆ هەموو دابینکەرەکان ═══════════
//
// هەموو داواکارییەک لە وێبگەڕی بەکارهێنەرەوە دەچێت، ڕاستەوخۆ بۆ دابینکەرەکە.
// هیچ سێرڤەرێکی ئێمە نایبینێت — چونکە هیچ سێرڤەرێکمان نییە.

import { fetchWithTimeout, isDailyQuota, MODEL_FETCH } from './net';
import { callGemini, streamGemini, generateImage as geminiImage, GeminiError } from './gemini';
import { parseJson as parseJsonRaw, ParseError } from './json';
import { sseLines } from './stream';
import { providerById, type ProviderId } from './providers';
import type { GroundingSource } from './gemini';

export { ParseError };
export type { GroundingSource };

/**
 * `parseJson` بەڵام بە ناسنامەی دابینکەرەوە.
 *
 * بانگکەرەکان (`generate`, `research`, `translate`) هەمووان ناسنامەی
 * دابینکەریان لەبەردەستدایە، بۆیە پەیامی هەڵە دەتوانێت ناوی ڕاست
 * بڵێت — نەک «Gemini» بۆ هەموو کەس.
 */
export function parseJson<T>(text: string, provider?: ProviderId): T {
  return parseJsonRaw<T>(text, provider ? providerById(provider).name : undefined);
}

export class LlmError extends Error {
  provider?: ProviderId;
  status?: number;
  constructor(message: string, provider?: ProviderId, status?: number) {
    super(message);
    this.name = 'LlmError';
    this.provider = provider;
    this.status = status;
  }
}

export interface Keys {
  /** کلیل بۆ هەر دابینکەرێک */
  keys: Partial<Record<ProviderId, string>>;
  /** مەکینەی گەڕانی هەڵبژێردراو — بەتاڵ = Gemini بەکاردێت */
  searchEngine?: 'tavily' | 'brave' | 'serper' | '';
  searchKeys?: Partial<Record<'tavily' | 'brave' | 'serper', string>>;
  /** دابینکەری دەق بۆ ئینگلیزی — کوردی و عەرەبی هەمیشە Gemini */
  textProvider: ProviderId;
  textModel: string;
  /** دابینکەری وێنە */
  imageProvider: ProviderId;
  /** مێشکی ئەیجێنت — بەتاڵ = هەمان دابینکەری دەق */
  agentProvider?: ProviderId;
  agentModel?: string;
}

export const EMPTY_KEYS: Keys = {
  keys: {},
  searchEngine: '',
  searchKeys: {},
  textProvider: 'gemini',
  textModel: 'gemini-2.5-pro',
  imageProvider: 'gemini',
};

export interface CallOpts {
  provider: ProviderId;
  key: string;
  model?: string;
  prompt: string;
  schema?: object;
  /** گەڕان لە ئینتەرنێت — تەنها Gemini پشتگیری دەکات */
  search?: boolean;
  temperature?: number;
  /**
   * سنووری ڕێژە (٤٢٩) و چاوەڕوانی پێش هەوڵی دواتر — بە میلی چرکە.
   * بڕوانە `net.ts` › `retryDelayMs`.
   */
  onWait?: (ms: number) => void;
  /**
   * وەستاندنی دەرەکی — دوگمەی «وەستاندن»ی بەکارهێنەر.
   *
   * `streamModel` هەمیشە ئەمەی هەبوو. `callModel` نەیبوو، چونکە
   * دروستکردنی دێکک یەک بانگکردنی ڕەشەبا بوو. تیمی ئەیجێنت
   * (`crew/`) دەیان بانگکردنی ئاسایی دەکات، بۆیە بەبێ ئەمە
   * «وەستاندن» هیچ ناوەستێنێت.
   */
  signal?: AbortSignal;
}

export interface CallResult {
  text: string;
  sources: GroundingSource[];
}

/** پەیامی هەڵە بە کوردی، بەپێی دابینکەر و کۆدی وەڵام */
function explain(id: ProviderId, status: number, raw: string): string {
  const p = providerById(id);
  const body = raw.slice(0, 300);

  if (status === 401 || /invalid[_ ]api[_ ]key|incorrect api key|Unauthorized/i.test(body))
    return `کلیلی ${p.name} دروست نییە. لە ${p.site} کلیلێکی نوێ دروست بکە.`;
  if (status === 402 || /insufficient|quota|billing|credit/i.test(body))
    return `کرێدیتی ${p.name} تەواو بووە. لە ${p.site} کرێدیت زیاد بکە.`;
  // ٤٢٩: `net.ts` پێشتر چاوەڕوانی کردووە بەو کاتەی سێرڤەرەکە داوای
  // کردبوو و دووبارە هەوڵی داوەتەوە. ئەگەر هێشتا ئێرە بێت، ئەو
  // چاوەڕوانییە بەس نەبووە — بۆیە «چەند خولەکێک چاوەڕێ بکە» پەیامێکی
  // هەڵەیە، ئێمە هەر ئەوەمان کرد.
  if (status === 429)
    return isDailyQuota(body)
      ? `سنووری ڕۆژانەی ${p.name} تەواو بووە بۆ ئەم مۆدێلە. هەر مۆدێلێک `
        + `سنووری خۆی هەیە، بۆیە لە ڕێکخستن مۆدێلێکی تر تاقی بکەرەوە — `
        + `یان سبەی بگەڕێوە.`
      : `سنووری هەر خولەکێکی ${p.name} تێپەڕێندرا. چاوەڕوانی کرا و دووبارە `
        + `هەوڵدرایەوە، بەڵام هێشتا سنوورەکە بەردەوامە. نیو خولەک بوەستە.`;
  if (status === 403)
    return `کلیلەکە ڕێگەی پێنەدراوە بۆ ئەم مۆدێلە لە ${p.name}.`;
  if (status === 404)
    return `مۆدێلەکە لە ${p.name} نەدۆزرایەوە. ناوی مۆدێل بگۆڕە.`;
  if (status >= 500)
    return `سێرڤەری ${p.name} وەڵامی نەدایەوە. دواتر هەوڵ بدەرەوە.`;
  return `هەڵەی ${p.name} (${status}): ${body}`;
}

// ─────────── OpenAI و هەموو ئەوانەی هاوشێوەن ───────────
// OpenAI، OpenRouter، DeepSeek و Groq هەمان API یان هەیە،
// بۆیە یەک ئەدەپتەر بەشیان دەکات.

/**
 * ناونیشانی **تەواو** — نەک ڕەگ. هەڵەیەکی ڕاستەقینە لێرەوە هات:
 * ڕەشەباکە `/chat/completions` ـی بۆ زیاد دەکرد، بۆیە ناونیشانەکە
 * دووبارە دەبووەوە و ٤٠٤ ـی دەدایەوە. بۆیە ئێستا هەردوو ڕێڕەو
 * (ئاسایی و ڕەشەبا) بە `openAiUrl` دەڕۆن، و `check-core` دەیپشکنێت.
 */
export const OPENAI_COMPATIBLE: Partial<Record<ProviderId, string>> = {
  openai:     'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  deepseek:   'https://api.deepseek.com/chat/completions',
  groq:       'https://api.groq.com/openai/v1/chat/completions',
};

/** یەک سەرچاوەی ڕاستی بۆ ناونیشانی دابینکەرە هاوشێوەکانی OpenAI */
export const openAiUrl = (p: ProviderId): string | undefined => OPENAI_COMPATIBLE[p];

async function callOpenAiStyle(o: CallOpts): Promise<CallResult> {
  const url = openAiUrl(o.provider)!;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${o.key}`,
  };
  // OpenRouter داوای ئەم دووانە دەکات بۆ ناسینەوەی داواکارییەکە
  if (o.provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    headers['X-Title'] = 'Presentation Studio';
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    ...MODEL_FETCH,
    outerSignal: o.signal,
    onRetry: (_n, ms) => o.onWait?.(ms),
    body: JSON.stringify({
      model: o.model,
      messages: [{ role: 'user', content: o.prompt }],
      temperature: o.temperature ?? 0.7,
      ...(o.schema ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new LlmError(explain(o.provider, res.status, raw), o.provider, res.status);

  const data = JSON.parse(raw) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new LlmError(`${providerById(o.provider).name} وەڵامێکی بەتاڵی گەڕاندەوە.`, o.provider);
  return { text, sources: [] };
}

// ─────────── Anthropic ───────────

async function callAnthropic(o: CallOpts): Promise<CallResult> {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': o.key,
      'anthropic-version': '2023-06-01',
      // بەبێ ئەمە Anthropic ڕێگە بە داواکاری لە وێبگەڕەوە نادات
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    ...MODEL_FETCH,
    outerSignal: o.signal,
    onRetry: (_n, ms) => o.onWait?.(ms),
    body: JSON.stringify({
      model: o.model,
      max_tokens: 8192,
      temperature: o.temperature ?? 0.7,
      messages: [{ role: 'user', content: o.prompt }],
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new LlmError(explain('anthropic', res.status, raw), 'anthropic', res.status);

  const data = JSON.parse(raw) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('');
  if (!text) throw new LlmError('Claude وەڵامێکی بەتاڵی گەڕاندەوە.', 'anthropic');
  return { text, sources: [] };
}

// ─────────── دەروازە ───────────

export async function callModel(o: CallOpts): Promise<CallResult> {
  if (!o.key?.trim())
    throw new LlmError(`کلیلی ${providerById(o.provider).name} دانەنراوە.`, o.provider);

  try {
    if (o.provider === 'gemini') {
      return await callGemini({
        key: o.key, model: o.model, prompt: o.prompt,
        schema: o.schema, search: o.search, temperature: o.temperature,
        onWait: o.onWait, signal: o.signal,
      });
    }
    if (o.provider === 'anthropic') return await callAnthropic(o);
    if (OPENAI_COMPATIBLE[o.provider]) return await callOpenAiStyle(o);
    throw new LlmError(`دابینکەری ${o.provider} پشتگیری نەکراوە.`, o.provider);
  } catch (e) {
    if (e instanceof GeminiError) throw new LlmError(e.message, 'gemini', e.status);
    throw e;
  }
}

// ─────────── ڕەشەبا ───────────
//
// بۆچی: دروستکردنی دێککێک ٣٠ تا ٦٠ چرکە دەخایەنێت. بەبێ ڕەشەبا
// بەکارهێنەر لە بەرامبەر شریتێکدا دادەنیشێت و هیچ نابینێت، ئینجا
// هەموو شتێک یەکجارە دەردەکەوێت. لەگەڵ ڕەشەبا، سلایدەکان یەک بە یەک
// دەردەکەون بە هەمان خێرایی کە مۆدێل دەیاننووسێت.
//
// ئەمە **هیچ خەرجییەکی زیادە نییە**: هەمان بانگکردنە، هەمان تۆکن.
// تەنها وەڵامەکە بە پارچە دێت لەبری یەکجارە.

export interface StreamOpts extends CallOpts {
  signal?: AbortSignal;
  /** دوای هەر پارچەیەک — بە **هەموو** دەقی کۆکراوە */
  onText: (all: string) => void;
}

/** ئایا ئەم دابینکەرە ڕەشەبای هەیە؟ */
export const canStream = (p: ProviderId) =>
  p === 'gemini' || !!OPENAI_COMPATIBLE[p];

async function streamOpenAiStyle(o: StreamOpts): Promise<CallResult> {
  // هەمان ناونیشانی `callOpenAiStyle` — یەک سەرچاوە، بۆیە ناتوانن جیا ببنەوە
  const url = openAiUrl(o.provider)!;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${o.key}`,
  };
  if (o.provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'http://localhost';
    headers['X-Title'] = 'Presentation Studio';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal: o.signal,
    body: JSON.stringify({
      model: o.model,
      messages: [{ role: 'user', content: o.prompt }],
      temperature: o.temperature ?? 0.7,
      stream: true,
      ...(o.schema ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok)
    throw new LlmError(explain(o.provider, res.status, await res.text()), o.provider, res.status);

  let text = '';
  for await (const chunk of sseLines(res)) {
    let d: { choices?: { delta?: { content?: string } }[] };
    try { d = JSON.parse(chunk); } catch { continue; }
    const part = d.choices?.[0]?.delta?.content ?? '';
    if (part) { text += part; o.onText(text); }
  }
  if (!text)
    throw new LlmError(`${providerById(o.provider).name} وەڵامێکی بەتاڵی گەڕاندەوە.`, o.provider);
  return { text, sources: [] };
}

/**
 * وەک `callModel`، بەڵام بە پارچە.
 *
 * ئەگەر دابینکەرەکە ڕەشەبای نەبێت (Anthropic لە وێبگەڕدا)، خۆکار
 * دەگەڕێتەوە بۆ بانگکردنی ئاسایی — بەکارهێنەر تەنها ڕەشەباکە
 * لەدەست دەدات، نەک تایبەتمەندییەکە.
 */
export async function streamModel(o: StreamOpts): Promise<CallResult> {
  if (!o.key?.trim())
    throw new LlmError(`کلیلی ${providerById(o.provider).name} دانەنراوە.`, o.provider);

  try {
    if (o.provider === 'gemini')
      return await streamGemini({
        key: o.key, model: o.model, prompt: o.prompt,
        schema: o.schema, search: o.search, temperature: o.temperature,
        signal: o.signal, onText: o.onText,
      });
    if (OPENAI_COMPATIBLE[o.provider]) return await streamOpenAiStyle(o);
    // ڕەشەبای نییە — یەکجارە، بەڵام هەر کاردەکات
    const r = await callModel(o);
    o.onText(r.text);
    return r;
  } catch (e) {
    if (e instanceof GeminiError) throw new LlmError(e.message, 'gemini', e.status);
    throw e;
  }
}

// ─────────── وێنە ───────────

async function openAiImage(key: string, prompt: string): Promise<string> {
  const res = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    ...MODEL_FETCH,
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 }),
  });
  const raw = await res.text();
  if (!res.ok) throw new LlmError(explain('openai', res.status, raw), 'openai', res.status);

  const data = JSON.parse(raw) as { data?: { b64_json?: string; url?: string }[] };
  const first = data.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new LlmError('هیچ وێنەیەک نەگەڕێندرایەوە.', 'openai');
}

export async function makeImage(provider: ProviderId, key: string, prompt: string): Promise<string> {
  if (!key?.trim())
    throw new LlmError(`کلیلی ${providerById(provider).name} بۆ وێنە دانەنراوە.`, provider);
  if (provider === 'gemini') {
    try { return await geminiImage(key, prompt); }
    catch (e) {
      if (e instanceof GeminiError) throw new LlmError(e.message, 'gemini', e.status);
      throw e;
    }
  }
  if (provider === 'openai') return openAiImage(key, prompt);
  throw new LlmError(`${providerById(provider).name} دروستکردنی وێنەی نییە.`, provider);
}

// ─────────── پشکنینی کلیل ───────────

/** هەڵەیەک کە دەربارەی **مۆدێلەکەیە**، نەک کلیلەکە */
const modelFault = (msg: string) =>
  /not a valid model|model.*not found|unknown model|does not exist|نەدۆزرایەوە|چیتر بەردەست نییە/i
    .test(msg);

/**
 * پشکنینی کلیل.
 *
 * ═══ کلیلێکی دروست نابێت وەک خراپ پیشان بدرێت ═══
 * پێشتر `model ?? p.models[0].id` بەکاردەهات و بەس. واتە ئەگەر
 * یەکەم مۆدێلی کاتالۆگەکە کۆن ببووایە یان ناوەکەی هەڵە بووایە،
 * **هەموو کلیلێکی ئەو دابینکەرە بە «کار ناکات»** نیشانە دەکرا.
 * ئەمە بەڕاستی ڕوویدا: `google/gemini-3.1-pro` بوونی نەبوو، و
 * کلیلێکی تەواو دروستی OpenRouter وەک شکاو دەرکەوت.
 *
 * ئێستا مۆدێلەکانی کاتالۆگ بە ڕیز تاقی دەکرێنەوە — بەڵام **تەنها**
 * ئەگەر هەڵەکە دەربارەی مۆدێلەکە بێت. هەڵەی کلیل، سنوور یان تۆڕ
 * دەستبەجێ دەگەڕێنەوە، چونکە دووبارەکردنەوەیان هیچ ناگۆڕێت.
 */
export async function testKey(provider: ProviderId, key: string, model?: string): Promise<
  { ok: true; model: string } | { ok: false; reason: string }
> {
  const p = providerById(provider);
  const chain = model
    ? [model, ...p.models.map(m => m.id).filter(id => id !== model)]
    : p.models.map(m => m.id);

  let last = 'هیچ مۆدێلێک نییە بۆ تاقیکردنەوە.';
  for (const id of chain) {
    try {
      await callModel({
        provider, key, model: id,
        prompt: 'Reply with the single word: ok',
        temperature: 0,
      });
      return { ok: true, model: id };
    } catch (e) {
      last = (e as Error).message;
      if (!modelFault(last)) return { ok: false, reason: last };
    }
  }
  return {
    ok: false,
    reason: `کلیلەکە لەوانەیە دروست بێت، بەڵام هیچ مۆدێلێکی ناو لیستەکە `
          + `کارنەکرد. ناوی مۆدێلێک بە دەست بنووسە. (${last.slice(0, 120)})`,
  };
}

/**
 * دابینکەری دروست بۆ زمانێک هەڵدەبژێرێت.
 * کوردی و عەرەبی هەمیشە Gemini، چونکە باشترین ئەنجام دەدات.
 */
export function pickTextProvider(lang: string, keys: Keys): { provider: ProviderId; model: string } {
  if (lang === 'ckb' || lang === 'ar')
    return {
      provider: 'gemini',
      // ئەگەر بەکارهێنەر مۆدێلێکی Gemini هەڵبژاردبێت، هەمانی بەکاردەهێنین
      model: keys.textProvider === 'gemini' && keys.textModel
        ? keys.textModel : 'gemini-2.5-pro',
    };
  return { provider: keys.textProvider, model: keys.textModel };
}
