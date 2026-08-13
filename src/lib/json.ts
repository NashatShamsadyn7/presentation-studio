// ═══════════ خوێندنەوەی JSON لە وەڵامی مۆدێلێکەوە ═══════════
//
// ئەم کۆدە پێشتر لە `gemini.ts` دا بوو، و ئەوە هەڵەیەکی ڕاستەقینەی
// دروست دەکرد: هەڵەکەی `GeminiError` بوو، بۆیە بەکارهێنەرێک کە بە
// DeepSeek کاری دەکرد و هەرگیز گەڕانی چالاک نەکردبوو، ئەم پەیامەی
// دەبینی:
//
//     «وەڵامی Gemini بە شێوەی JSON نەبوو … گەڕان لە ئینتەرنێت بکوژێنەوە»
//
// دوو شتی هەڵە لە یەک ڕستەدا: ناوی دابینکەرێک کە بەکاری نەهێناوە، و
// ئامۆژگاری کوژاندنەوەی تایبەتمەندییەک کە نەیکردووەتەوە.
//
// بۆیە ئێستا لێرەیە، بێلایەنە، و ناوی دابینکەرەکە وەردەگرێت.

/** وەڵامەکە JSON نەبوو — هەڵەیەکی شیکردنەوەیە، نەک هەڵەی تۆڕ یان کلیل */
export class ParseError extends Error {
  /** ناوی دابینکەرەکە، ئەگەر زانرابێت */
  who?: string;
  constructor(message: string, who?: string) {
    super(message);
    this.name = 'ParseError';
    this.who = who;
  }
}

/**
 * یەکەم نرخی تەواوی JSON لە ناو دەقێکدا دەدۆزێتەوە.
 *
 * لە دۆخی گەڕاندا مۆدێلەکان زۆرجار دەقی زیادە لەگەڵ JSON ـەکەدا دەنێرن
 * (پێشەکی، ڕوونکردنەوە، یان چەند بلۆکێک). بۆیە ناتوانین بە ئاسانی
 * هەموو دەقەکە بخوێنینەوە — دەبێت کەوانەکان بژمێرین تا بلۆکی تەواو ببینین،
 * لەگەڵ ڕەچاوکردنی ئەو کەوانانەی کە لە ناو دەقی " " دان.
 */
export function extractJson(raw: string): string | null {
  for (const open of ['{', '[']) {
    const close = open === '{' ? '}' : ']';
    let i = raw.indexOf(open);

    while (i !== -1) {
      let depth = 0, inStr = false, esc = false;

      for (let j = i; j < raw.length; j++) {
        const ch = raw[j];

        if (esc) { esc = false; continue; }
        if (ch === '\\' && inStr) { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;

        if (ch === open) depth++;
        else if (ch === close) {
          depth--;
          if (depth === 0) return raw.slice(i, j + 1);
        }
      }
      i = raw.indexOf(open, i + 1);          // ئەم بلۆکە تەواو نەبوو — دواتری تاقی بکەرەوە
    }
  }
  return null;
}

/**
 * چاککردنی ئەو هەڵانەی مۆدێلەکان زۆرجار دەیانکەن.
 *
 * ئاگاداری: هەموو پیتە نەبینراوەکان بە `\u` دەنووسرێن، نەک بە خۆیان.
 * پیتێکی نەبینراوی ڕاستەقینە لە ناو فایلی سەرچاوەدا لەلایەن هەر
 * ئامێرێکەوە (کۆپی، فۆرماتکەر، ڕێکخستنی Unicode) بێدەنگ دەسڕدرێتەوە،
 * و ئەو کاتە ئەم پاککردنەوەیە کار ناکات بەبێ ئەوەی هیچ شتێک بشکێت.
 */
export function repair(s: string): string {
  return s
    // کۆمای زیادە پێش داخستنی کەوانە
    .replace(/,\s*([}\]])/g, '$1')
    // دوونوکەی خوار → دوونوکەی ئاسایی
    .replace(/[“”]/g, '"')
    // پیتی کۆنترۆڵ — بەبێ \t \n \r کە JSON خۆی ڕێگەیان پێدەدات
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    // بۆشایی پەنهان و نیشانەی ڕیزبەندی بایت
    .replace(/[\u00A0\u200B-\u200F\uFEFF]/g, ' ');
}

/**
 * JSON دەردەهێنێت، تەنانەت ئەگەر بە ```json یان بە دەقی زیادە دەوردرابێت.
 *
 * @param who ناوی دابینکەرەکە بۆ پەیامی هەڵە — بۆ نموونە «OpenAI».
 *        ئەگەر نەدرا، پەیامەکە بێ ناو دەبێت. هەرگیز ناوێکی هەڵبەستراو
 *        دانانرێت، چونکە ئەوە بەکارهێنەر بەرەو چارەسەری هەڵە دەبات.
 */
export function parseJson<T>(text: string, who?: string): T {
  // ١) بلۆکی ```json ئەگەر هەبێت
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fence?.[1], text].filter(Boolean) as string[];

  for (const c of candidates) {
    for (const attempt of [c.trim(), extractJson(c)]) {
      if (!attempt) continue;
      for (const final of [attempt, repair(attempt)]) {
        try { return JSON.parse(final) as T; } catch { /* دواتر */ }
      }
    }
  }

  throw new ParseError(
    `${who ? `وەڵامی ${who}` : 'وەڵامی مۆدێلەکە'} بە شێوەی JSON نەبوو. ` +
    'دووبارە هەوڵ بدە — ئەگەر دووبارە بووەوە، مۆدێلێکی بەهێزتر هەڵبژێرە ' +
    'یان «گەڕان لە ئینتەرنێت» بکوژێنەوە ئەگەر کراوەیە.',
    who,
  );
}
