// ═══════════ بانگکردنی مۆدێل بۆ ئەیجێنتەکان ═══════════
//
// هەموو ئەیجێنتەکان لەم دەروازەیەوە دەڕۆن، بۆیە:
//
//   • وەستاندن لە هەموو شوێنێکدا یەک هەڵسوکەوتی هەیە
//   • هەموویان سکێمایان هەیە — بەبێ سکێما مۆدێل بە دەقی ئاسایی
//     وەڵام دەداتەوە و `parseJson` دەشکێت. ئەوە هەر ئەو باگە بوو
//     کە لاپەڕەی سەرچاوەکانی بۆ ماوەیەک بەتاڵ کردبووەوە.
//   • پلەی گەرمی بە بنەڕەت **نزمە** (٠٫٣). ئەیجێنتەکان کاری
//     ڕێکخستن دەکەن، نەک نووسینی داهێنەرانە — تەنها `writer`
//     پلەیەکی بەرزتری هەیە و خۆی دایدەنێت.

import { callModel, parseJson } from '../llm';
import { Stopped, type CrewOpts } from './types';

export interface AskOpts {
  prompt: string;
  schema: object;
  temperature?: number;
  /** گەڕان لە ئینتەرنێت — تەنها Gemini */
  search?: boolean;
}

/** ئەگەر بەکارهێنەر وەستاندی، دەستبەجێ دەربچۆ */
export function checkStop(o: CrewOpts): void {
  if (o.signal?.aborted) throw new Stopped();
}

/**
 * پرسیارێکی سکێمادار لە مۆدێل.
 *
 * ئاگاداری: هەڵەکان **ناگیردرێن** لێرەدا. `run.ts` هەڵەی هەر
 * قۆناغێک دەگرێت و بەردەوام دەبێت — گرتنی هەڵە لە دوو شوێندا
 * واتای ئەوەیە کە قۆناغێک بێدەنگ شکست بهێنێت و وا دەربکەوێت
 * کە سەرکەوتووە.
 */
export async function ask<T>(o: CrewOpts, p: AskOpts): Promise<T> {
  checkStop(o);
  const { text } = await callModel({
    provider: o.provider, key: o.key, model: o.model,
    prompt: p.prompt,
    // Gemini ڕێگە نادات سکێما و گەڕان پێکەوە بن — بۆیە لە دۆخی
    // گەڕاندا سکێماکە نانێردرێت و JSON بە دەست دەردەهێنرێت
    ...(p.search ? { search: true } : { schema: p.schema }),
    temperature: p.temperature ?? 0.3,
    signal: o.signal,
    onWait: o.onWait,
  });
  checkStop(o);
  return parseJson<T>(text, o.provider);
}
