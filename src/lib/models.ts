// ═══════════ لیستی زیندووی مۆدێلەکان ═══════════
//
// ─── بۆچی ئەم فایلە هەیە ───
// کاتالۆگی `providers.ts` بە دەست نووسراوە، و ئەوە دوو کێشەی هەیە:
//
//   ١) کۆن دەبێت. دابینکەرەکان مۆدێل زیاد دەکەن و لادەبەن بەبێ
//      ئاگادارکردنەوە، بۆیە لیستێکی چەسپاو هەمیشە لە دواوەیە.
//   ٢) ناتوانرێت بپشکنرێت. C2 دەڵێت هیچ کلیلێکمان نییە، بۆیە هیچ
//      ناوێک لە تاقیکردنەوەدا تاقی ناکرێتەوە — و ناوێکی هەڵە لە
//      سەرەوەی لیستەکەدا وا دەکات `testKey` کلیلێکی دروست وەک
//      شکاو پیشان بدات. ئەمە **بەڕاستی ڕوویدا**.
//
// چارەسەرەکە: لە خودی دابینکەرەکەوە بیانپرسە. OpenRouter لیستەکەی
// بەبێ کلیل دەداتەوە — واتە بەکارهێنەر پێش هەبوونی کلیلیش دەیبینێت.
//
// C1 پارێزراوە: ئەمە لە وێبگەڕەوە دەڕوات، وەک هەموو داواکارییەکی تر.

import { fetchWithTimeout } from './net';
import type { ProviderId } from './providers';

export interface LiveModel {
  id: string;
  name: string;
  /** بێبەرامبەر — نرخی تێچوو سفرە */
  free: boolean;
  /** درێژی سیاق بە تۆکن، ئەگەر ڕایگەیاندبێت */
  context?: number;
}

/**
 * ناونیشانی لیستی مۆدێلەکان بۆ هەر دابینکەرێک.
 *
 * `key: false` واتە بەبێ کلیل کاردەکات — ئەوە OpenRouter ـە، و
 * هەر ئەویشە کە بەکارهێنەر زۆرترین مۆدێلی تێدا دەدۆزێتەوە.
 */
const LIST: Partial<Record<ProviderId, { url: string; key: boolean }>> = {
  openrouter: { url: 'https://openrouter.ai/api/v1/models',        key: false },
  groq:       { url: 'https://api.groq.com/openai/v1/models',      key: true  },
  openai:     { url: 'https://api.openai.com/v1/models',           key: true  },
  deepseek:   { url: 'https://api.deepseek.com/models',            key: true  },
};

/** ئایا لیستی زیندوو بۆ ئەم دابینکەرە هەیە؟ */
export const hasLiveList = (p: ProviderId) => !!LIST[p];

/** ئایا بەبێ کلیل دەکرێت؟ */
export const listNeedsKey = (p: ProviderId) => LIST[p]?.key ?? true;

interface RawModel {
  id?: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
  architecture?: { output_modalities?: string[] };
}

/**
 * ئایا ئەم مۆدێلە **تەنها دەق** دەردەکات؟
 *
 * ═══ بۆچی پێویستە ═══
 * لیستەکە مۆدێلی مۆسیقا و وێنەش لەخۆدەگرێت. نموونە:
 * `google/lyria-3-pro-preview` نرخی «٠» ی هەیە (چونکە بە چرکە
 * دەژمێردرێت، نەک بە تۆکن) و `text+audio` دەردەکات — بۆیە وەک
 * «بێبەرامبەر» دەردەکەوت لە لیستەکەدا و بۆ سلاید هیچ کاری نەدەکرد.
 *
 * ئێمە تەنها دەقمان دەوێت. ئەگەر خانەکە نەبوو، ڕەتی ناکەینەوە —
 * فلتەرێکی توند مۆدێلی بەکارهاتووش دەردەکات.
 */
const textOnly = (m: RawModel) => {
  const out = m.architecture?.output_modalities;
  return !out?.length || (out.length === 1 && out[0] === 'text');
};

/** نرخێک کە سفرە — OpenRouter بە زنجیرە دەینێرێت («0») */
const isZero = (v: string | number | undefined) =>
  v === undefined || Number(v) === 0;

/**
 * لیستی مۆدێلەکان لە دابینکەرەکەوە دەهێنێت.
 *
 * بێبەرامبەرەکان یەکەم دێن — ئەوانە ئەوانەن کە خوێندکارێک
 * بەکاریان دەهێنێت. لە ناو هەر کۆمەڵێکدا بە ناو ڕیز دەکرێن.
 */
export async function liveModels(p: ProviderId, key?: string): Promise<LiveModel[]> {
  const spec = LIST[p];
  if (!spec) throw new Error('ئەم دابینکەرە لیستی زیندووی نییە.');
  if (spec.key && !key?.trim()) throw new Error('بۆ لیستی مۆدێلەکان کلیل پێویستە.');

  const res = await fetchWithTimeout(spec.url, {
    timeoutMs: 15_000,
    headers: spec.key ? { Authorization: `Bearer ${key}` } : undefined,
  });
  if (!res.ok) throw new Error(`لیستی مۆدێلەکان نەهێنرا (${res.status}).`);

  const body = await res.json() as { data?: RawModel[] };
  const rows = Array.isArray(body.data) ? body.data : [];

  const out = rows
    .filter(m => typeof m.id === 'string' && m.id && textOnly(m))
    .map<LiveModel>(m => ({
      id: m.id!,
      name: m.name?.trim() || m.id!,
      // بەبێ زانیاری نرخ، بێبەرامبەر ناژمێردرێت — درۆیەکی خۆشحاڵکەر
      // خراپترە لە هیچ نەڵێن
      free: !!m.pricing && isZero(m.pricing.prompt) && isZero(m.pricing.completion),
      context: m.context_length,
    }));

  out.sort((a, b) =>
    a.free !== b.free ? (a.free ? -1 : 1) : a.id.localeCompare(b.id));
  return out;
}
