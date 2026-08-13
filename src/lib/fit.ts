// ═══════════ گونجاندنی دەق لەگەڵ خانەکەی ═══════════
//
// کێشەی یەکەم: لە وێبگەڕدا دەقی زیادە دەبڕدرێت (.fitbox{overflow:hidden})،
// بەڵام PowerPoint دەیهێڵێت بەدەر بێت. بۆیە پێشبینین جوان دەردەکەوت و
// فایلی داگیراو تێکچوو.
//
// کێشەی دووەم: دەقی کورت لە سەرەوەی خانەکە دەمایەوە و خوارەوەی سلاید
// بەتاڵ دەبوو. سلایدێکی زانکۆیی دەبێت پڕ بێت — نەک دەقێکی بچووک لە
// سەرەوە و نیوەی خوارەوە بەتاڵ.
//
// pptxgenjs ی fit:'shrink' چارەسەر نییە — PowerPoint تەنها لە کاتی
// دەستکاریکردندا ڕێژەکە دەژمێرێت، نەک لە کاتی کردنەوەدا.
//
// چارەسەرەکە: هەردوو ژمارە — قەبارەی فۆنت و بۆشایی نێوان خاڵەکان —
// لێرەدا دەژمێردرێن، و هەردوو لا (پێشبینین و هەناردەکردن) هەمانیان
// بەکاردەهێنن. بۆیە بەبنەڕەت وەک یەکن.

/** ڕێژەی پانی پیتێکی مامناوەند بۆ قەبارەی فۆنت.
 *  بۆ Georgia و فۆنتە عەرەبییەکان نزیکەی نیوەیە. */
const CHAR_W = 0.52;

export interface FitOpts {
  /** دێڕەکان — هەر خاڵێک یان پەرەگرافێک */
  lines: string[];
  /** پانی خانەکە بە پیکسڵ (لە بۆشایی ١٩٢٠×١٠٨٠) */
  width: number;
  /** بەرزی خانەکە بە پیکسڵ */
  height: number;
  /** قەبارەی فۆنتی خواستراو */
  size: number;
  /** بەرزی دێڕ وەک ڕێژە */
  lineHeight?: number;
  /** بۆشایی نێوان خاڵەکان بە پیکسڵ */
  gap?: number;
  /** بۆشایی پێش دەقی خاڵ (خاڵەکە خۆی) */
  indent?: number;
  /** بچووکترین قەبارە — لەوە خوارتر دەق ناخوێندرێتەوە */
  min?: number;
  /**
   * دەقی کوردی/عەرەبی.
   *
   * پیتەکانی وەک ڕ ڵ ۆ ژ ێ دوو شتیان هەیە کە پیتی لاتینی نییەتی:
   * خاڵ و نیشانە لە ژوورەوە، و دوو لە ژێرەوە. بە بەرزی دێڕی ١.٢
   * ـەوە یەک دێڕ دەچێتە ناو ئەوی تری. بۆیە لێرەدا سنوورێکی خوارەوە
   * دادەنرێت کە هەرگیز نابڕدرێت.
   */
  rtl?: boolean;
}

/** کەمترین بەرزی دێڕ بۆ نووسینی کوردی/عەرەبی */
export const RTL_MIN_LH = 1.4;

/** ژمارەی دێڕەکان کاتێک دەق دەپێچرێتەوە */
function wrapped(lines: string[], width: number, size: number, indent: number): number {
  const perLine = Math.max(1, Math.floor((width - indent) / (size * CHAR_W)));
  let n = 0;
  for (const l of lines) n += Math.max(1, Math.ceil(l.length / perLine));
  return n;
}

/**
 * گەورەترین قەبارەی فۆنت کە دەق پێی دەگونجێت.
 * ئەگەر بەهەر شێوەیەک نەگونجا، `min` دەگەڕێنێتەوە.
 */
export function fitSize(o: FitOpts): number {
  const lh = o.lineHeight ?? 1.4;
  const gap = o.gap ?? 0;
  const indent = o.indent ?? 0;
  const min = o.min ?? Math.max(14, Math.round(o.size * 0.55));
  const items = o.lines.filter(Boolean);
  if (!items.length) return o.size;

  for (let s = o.size; s > min; s -= 1) {
    const rows = wrapped(items, o.width, s, indent);
    if (rows * s * lh + gap * (items.length - 1) <= o.height) return s;
  }
  return min;
}

export interface BlockFit {
  /** قەبارەی فۆنت بە پیکسڵ */
  size: number;
  /** بۆشایی نێوان خاڵەکان بە پیکسڵ */
  gap: number;
  /** بەرزی ڕاستەقینەی بلۆکەکە بە پیکسڵ */
  used: number;
  /**
   * دەقەکە تەنانەت بە بچووکترین قەبارەشەوە نەگونجا.
   *
   * ئەمە بێدەنگ نییە: `fix_overflow` ی ئەیجێنت بەمە دەزانێت کە
   * سلایدەکە دەقی زۆرە و پێویستە تەختەبەندەکەی بگۆڕدرێت.
   */
  overflow: boolean;
}

/**
 * قەبارە **و** بۆشایی، بەجۆرێک کە بلۆکەکە خانەکەی پڕ بکاتەوە.
 *
 * جیاوازی لەگەڵ `fitSize`: ئەوە تەنها بچووک دەبێتەوە. ئەمە هەردوو
 * ئاراستە دەڕوات —
 *
 *   • دەقی زۆر  → فۆنت بچووک دەبێتەوە تا دەگونجێت (وەک پێشوو)
 *   • دەقی کەم  → فۆنت گەورە دەبێت **و** بۆشاییەکان فراوان دەبن،
 *                 تا خوارەوەی سلاید بەتاڵ نەمێنێتەوە
 *
 * دوو سنوور هەن کە پارێزراون:
 *   ١) فۆنت لە `max` تێناپەڕێت — بەبێ ئەوە دوو خاڵی کورت دەبنە
 *      ناونیشانی گەورە و سلایدەکە جوان نامێنێت.
 *   ٢) بۆشایی لە ٢.٢ ئەوەندەی قەبارەی فۆنت تێناپەڕێت — بەبێ ئەوە
 *      دوو خاڵ لە سەرەوە و خوارەوەی سلاید دەنووسێن و پەیوەندییان
 *      لەگەڵ یەکتردا لەدەست دەدەن.
 *
 * ئەوەی لە هەردووکیان دەمێنێتەوە بە ناوەڕاستکردن دەبڕدرێت — بۆیە
 * بۆشایی سەرەوە و خوارەوە یەکسان دەبن.
 */
export function fitBlock(o: FitOpts & {
  max?: number;
  /**
   * قەبارەیەکی دەستی لە بەکارهێنەرەوە — ئەگەر دانرابێت، **هەڵنابژێردرێت**،
   * تەنها بۆشایی و `overflow` دەژمێردرێن.
   *
   * ─── بۆچی پێویست بوو ───
   * `SlotOverride.fontSize` هەبوو و لە `Studio` دا دەگۆڕدرا، بەڵام هیچ
   * کاریگەرییەکی نەبوو: `ov()` قەبارەکەی دەخستە سەر **پێچەرەکە**، و
   * `Pts`/`Prose` قەبارەی خۆیان بە ستایلی ناوەکی دەخستە سەر منداڵەکە —
   * و ستایلی ناوەکی منداڵ بەسەر میراتی باوکدا زاڵ دەبێت. واتە
   * بەکارهێنەر ژمارەکەی دەگۆڕی و هیچ ڕووی نەدەدا.
   */
  fixed?: number;
}): BlockFit {
  if (o.fixed) return fixedBlock(o, o.fixed);
  return autoBlock(o);
}

/** قەبارەکە دیاریکراوە — تەنها دەپێورێت، ناگۆڕدرێت */
function fixedBlock(o: FitOpts & { max?: number }, size: number): BlockFit {
  const lh = Math.max(o.lineHeight ?? 1.4, o.rtl ? RTL_MIN_LH : 0);
  const gap = o.gap ?? 0;
  const items = o.lines.filter(Boolean);
  if (!items.length) return { size, gap, used: 0, overflow: false };

  const slots = items.length - 1;
  const used = wrapped(items, o.width, size, o.indent ?? 0) * size * lh + gap * slots;
  // بەکارهێنەر خۆی هەڵیبژاردووە — ناگۆڕدرێت، بەڵام ئەگەر بەدەر بێت
  // پێی دەڵێین. `overflow` لە ئێدیتەردا دەردەکەوێت.
  return { size, gap, used: Math.round(used), overflow: used > o.height + 0.5 };
}

function autoBlock(o: FitOpts & { max?: number }): BlockFit {
  // بەرزی دێڕ بۆ نووسینی کوردی/عەرەبی هەرگیز لە ١.٤ کەمتر نابێت
  const lh = Math.max(o.lineHeight ?? 1.4, o.rtl ? RTL_MIN_LH : 0);
  const baseGap = o.gap ?? 0;
  const indent = o.indent ?? 0;
  const items = o.lines.filter(Boolean);
  if (!items.length) return { size: o.size, gap: baseGap, used: 0, overflow: false };

  const min = o.min ?? Math.max(14, Math.round(o.size * 0.55));
  const max = Math.max(o.size, o.max ?? Math.round(o.size * 1.55));
  const slots = items.length - 1;

  // گەورەترین قەبارە کە هێشتا بە کەمترین بۆشاییەوە دەگونجێت
  let size = min;
  let fitted = false;
  for (let s = max; s >= min; s -= 1) {
    const rows = wrapped(items, o.width, s, indent);
    if (rows * s * lh + baseGap * slots <= o.height) { size = s; fitted = true; break; }
  }

  // ئەوەی ماوەتەوە بەسەر بۆشاییەکاندا دابەش دەکرێت
  const text = wrapped(items, o.width, size, indent) * size * lh;
  const free = o.height - text;

  // ئەگەر نەگونجا، بۆشایی سفر دەبێت — سلایدی پڕ باشترە لە سلایدی بەدەر.
  // `overflow` بۆ بانگکەر دەمێنێتەوە، بۆیە کێشەکە بێدەنگ نامێنێتەوە.
  const gap = !fitted        ? 0
            : slots > 0      ? Math.max(baseGap, Math.min(size * 2.2, free / slots))
            :                  baseGap;

  const used = text + gap * slots;

  // پارێزەری کۆتایی: هەرگیز نابێت لە خانەکە تێپەڕێت.
  // بەبێ ئەمە، هەڵەیەکی ژمێردن دەبێتە دەقێکی بەدەرچوو لە PowerPoint دا،
  // کە لە پێشبینیندا نابیندرێت چونکە CSS ـەکە دەیبڕێت.
  return {
    size, gap: Math.round(gap),
    used: Math.round(used),
    overflow: !fitted || used > o.height + 0.5,
  };
}
