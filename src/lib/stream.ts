// ═══════════ خوێندنەوەی JSON پێش تەواوبوونی ═══════════
//
// کێشەکە: مۆدێل هەموو دێککەکە لە یەک وەڵامدا دەنێرێت. بەکارهێنەر
// ٤٠ چرکە لە بەرامبەر شریتێکی تقدمدا دادەنیشێت و هیچ نابینێت، ئینجا
// هەموو شتێک یەکجارە دەردەکەوێت.
//
// چارەسەرەکە: وەڵامەکە بە پارچە پارچە دێت (SSE). دوای هەر پارچەیەک
// دەقی کۆکراوە هێشتا JSON ـێکی ناتەواوە:
//
//     {"thesis":"…","slides":[{"layout":"L_bullets","title":"یەکەم",…},{"lay
//                                                                      ↑ لێرەدا وەستاوە
//
// یەک سلاید تەواوە و دەکرێت ئێستا پیشان بدرێت. ئەمە ئەو کارە دەکات:
// کەوانەکان دەژمێرێت و هەر ئۆبجێکتێکی تەواو لە ڕیزەکەدا دەردەهێنێت.
//
// ─── بۆچی خۆمان دەینووسین؟ ───
// `JSON.parse` هەموو یان هیچ. پارسەرێکی پارچەیی لە npm ـەوە دەکرا
// بهێنرێت، بەڵام ئەمە ٦٠ دێڕە و تەنها یەک شتی دەوێت: ئۆبجێکتە
// تەواوەکانی ناو یەک ڕیزدا. یەکێکی گشتگیر زۆر گەورەترە لەوەی
// پێویستمانە.

/**
 * ئۆبجێکتە تەواوەکانی ناو ڕیزێکی JSON دەردەهێنێت، تەنانەت ئەگەر
 * دەقەکە لە ناوەڕاستدا بڕابێتەوە.
 *
 * @param raw  دەقی کۆکراوە تا ئێستا — ناتەواو بێت کێشە نییە
 * @param key  ناوی ئەو خانەیەی ڕیزەکەی تێدایە، بۆ نموونە "slides"
 * @returns    ئۆبجێکتە تەواوەکان، بە ڕیزبەندی
 *
 * دەقی ناوەوە ڕەچاو دەکرێت: کەوانەیەک لە ناو `"…"` دا نابێت بژمێردرێت،
 * و `\"` نابێت وەک کۆتایی دەق بژمێردرێت. بەبێ ئەمە ناونیشانێکی وەک
 * «کاریگەری {AI} لەسەر…» ژمێرەرەکە تێکدەدات.
 */
export function partialArray<T>(raw: string, key: string): T[] {
  const at = raw.indexOf(`"${key}"`);
  if (at < 0) return [];

  const open = raw.indexOf('[', at);
  if (open < 0) return [];

  const out: T[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;

  for (let i = open + 1; i < raw.length; i++) {
    const ch = raw[i];

    if (esc) { esc = false; continue; }
    if (ch === '\\') { if (inStr) esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try { out.push(JSON.parse(raw.slice(start, i + 1)) as T); }
        catch { /* پارچەیەکی تێکچوو — تێپەڕی لێدەکەین */ }
        start = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break;                                   // ڕیزەکە داخرا
    }
  }

  return out;
}

/**
 * بەهای یەک خانەی دەقی سەرەوە دەردەهێنێت، تەنانەت پێش تەواوبوونی
 * وەڵامەکە. بۆ `thesis` بەکاردێت — کە یەکەم شتە دەنووسرێت، بۆیە
 * دەکرێت زوو پیشان بدرێت.
 *
 * تەنها کاتێک دەیگەڕێنێتەوە کە دوونووکی داخستن هاتبێت — ئەگەرنا
 * بەکارهێنەر ڕستەیەکی نیوەچڵ دەبینێت کە دواتر درێژ دەبێتەوە.
 */
export function partialString(raw: string, key: string): string | null {
  const at = raw.indexOf(`"${key}"`);
  if (at < 0) return null;

  const colon = raw.indexOf(':', at + key.length + 2);
  if (colon < 0) return null;

  let i = colon + 1;
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (raw[i] !== '"') return null;

  let esc = false;
  for (let j = i + 1; j < raw.length; j++) {
    const ch = raw[j];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') {
      try { return JSON.parse(raw.slice(i, j + 1)) as string; }
      catch { return null; }
    }
  }
  return null;                                  // هێشتا داخراوە نییە
}

// ─────────── خوێندنەوەی SSE ───────────

/**
 * ڕەشەبای `text/event-stream` دەخوێنێتەوە و هەر دێڕێکی `data:`
 * دەگەڕێنێتەوە.
 *
 * دوو شتی گرنگ:
 *   • پارچەکانی تۆڕ لە ناوەڕاستی دێڕێکدا دەبڕدرێن، بۆیە دوایین
 *     دێڕی ناتەواو دەمێنێتەوە بۆ پارچەی داهاتوو
 *   • `[DONE]` هی OpenAI ـە، JSON نییە — پشتگوێ دەخرێت
 */
export async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) return;

  const dec = new TextDecoder();
  let buf = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        yield data;
      }
    }
  } finally {
    // ئەگەر بەکارهێنەر وەستاندی، پەیوەندییەکە دەبێت ببڕدرێت —
    // ئەگەرنا داواکارییەکە لە پشتەوە بەردەوام دەبێت و کریدیت دەخوات
    reader.cancel().catch(() => {});
  }
}
