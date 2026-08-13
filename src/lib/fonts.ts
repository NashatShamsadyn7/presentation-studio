// ═══════════ فۆنت و پیتە کوردییەکان ═══════════
//
// کێشەکە، بە وردی:
//
// فۆنتی بنەڕەتی دێککەکان Georgia ـە. Georgia **هیچ پیتێکی عەرەبی
// نییە** — نە عەرەبی، نە فارسی، نە کوردی. کاتێک PowerPoint دەقێکی
// کوردی بە Georgia دەبینێت، خۆی فۆنتێکی جێگرەوە هەڵدەبژێرێت. ئەو
// هەڵبژاردنە لە کۆمپیوتەرێکەوە بۆ کۆمپیوتەرێکی تر دەگۆڕێت — و ئەگەر
// جێگرەوەکەش ئەو پیتانەی نەبوو، خوێندکار چوارگۆشەی بەتاڵ □ دەبینێت
// لە ڕۆژی پێشکەشکردندا، بەبێ هیچ ئاگادارکردنەوەیەکی پێشوەخت.
//
// ─── چۆن OOXML چارەسەری دەکات ───
// هەر خانەیەکی دەق سێ فۆنتی هەیە:
//     <a:latin>  پیتی لاتینی
//     <a:ea>     ئاسیای ڕۆژهەڵات
//     <a:cs>     «Complex Script» — عەرەبی، کوردی، فارسی، عیبری
//
// pptxgenjs هەر سێکیان لە `fontFace` ـەوە پڕ دەکاتەوە، بۆیە ئێستا
// `Georgia` دەچێتە ناو خانەی `cs` ـەوە — کە هەر ئەو فۆنتەیە کە ئەو
// پیتانەی نییە. ئەوە هەڵەکەیە. چارەسەرەکە: دوای دروستکردنی فایلەکە،
// خانەی `cs` بە فۆنتێکی عەرەبی دەگۆڕدرێت (بڕوانە `export/morph.ts`).
//
// ─── و بۆچی پێوانەی زیندووش پێویستە ───
// ئێمە ناتوانین لە کۆدەوە بزانین چ فۆنتێک لەسەر کۆمپیوتەری بەکارهێنەر
// دانراوە، یان چ وەشانێکی. بۆیە لە وێبگەڕدا بە canvas دەیپێوین و
// ڕاستییەکە بە بەکارهێنەر دەڵێین، لەبری ئەوەی پشت بە خشتەیەک ببەستین.

/** پیتە تایبەتەکانی کوردیی سۆرانی — ئەوانەی زۆرترین جار کەمن */
export const KU_GLYPHS = 'ڕڵۆژگچپڤێەڎ';

/** هەریەکە و ناوی خۆی — بۆ پیشاندان بە بەکارهێنەر */
export const KU_NAMES: Record<string, string> = {
  'ڕ': 'U+0695', 'ڵ': 'U+06B5', 'ۆ': 'U+06C6', 'ژ': 'U+0698',
  'گ': 'U+06AF', 'چ': 'U+0686', 'پ': 'U+067E', 'ڤ': 'U+06A4',
  'ێ': 'U+06CE', 'ە': 'U+06D5', 'ڎ': 'U+068E',
};

/** پیتە عەرەبییە باوەکان — بۆ پشکنینی زمانی عەرەبی */
export const AR_GLYPHS = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';

/**
 * فۆنتی «Complex Script» بۆ هەناردەکردن.
 *
 * ڕیزبەندی بەپێی ئەوەی چەند بەربڵاون لەسەر کۆمپیوتەری خوێندکاران
 * (Windows + Office) و چەند پیتی کوردییان تێدایە:
 *
 *   Tahoma            لە Windows 95 ـەوە هەیە، فراوانترین پیتی عەرەبی
 *   Arial             لە هەموو سیستەمێکدا هەیە
 *   Segoe UI          Windows Vista ـەوە
 *   Times New Roman   کلاسیک، بەڵام پیتی کوردیی کەمترە
 *
 * تێبینی: Vazirmatn — فۆنتی ڕووکاری ئەپەکە — لێرەدا نییە بە ئەنقەست.
 * فۆنتێکی وێبە و لە کۆمپیوتەری بەکارهێنەردا دانەنراوە، بۆیە لە
 * PowerPoint دا بەکارنایەت.
 */
export const CS_FONTS = ['Tahoma', 'Arial', 'Segoe UI', 'Times New Roman'] as const;

/** فۆنتی cs بۆ زمانێک — ئینگلیزی پێویستی پێی نییە */
export function csFontFor(lang: 'ckb' | 'ar' | 'en'): string | null {
  return lang === 'en' ? null : CS_FONTS[0];
}

/**
 * ئایا ئەم فۆنتە پیتی عەرەبی/کوردی هەیە؟
 *
 * ڕیزبەندییەکی جێگیر — لە `Studio` دا بەکاردێت بۆ ئاگادارکردنەوە.
 * ئەمە **نموونەیەکی گشتییە**، نەک پێوانە. پێوانەی ڕاستەقینە لە
 * `missingGlyphs()` دایە، کە تەنها لە وێبگەڕدا کاردەکات.
 */
export const NO_ARABIC = new Set([
  'Georgia', 'Palatino Linotype', 'Palatino', 'Book Antiqua',
  'Cambria', 'Constantia', 'Trebuchet MS', 'Verdana',
]);

/**
 * فۆنتی دێکک — بەپێی زمانەکە.
 *
 * ═══ ئەم هەڵەیە بەرچاوترین کێشەی جوانی ئەپەکە بوو ═══
 *
 * `Wizard` بۆ **هەموو** دێککێک `Georgia` ـی دادەنا، بە زمانەکەی
 * نەدەزانی. بەڵام Georgia لە `NO_ARABIC` دایە — هەر لەم فایلەدا
 * نووسراوە کە **هیچ پیتێکی عەرەبی نییە**.
 *
 * ئەنجامی ڕاستەقینە بۆ دێککێکی کوردی:
 *   • لە وێبگەڕدا: هیچ پیتێک لە Georgia ـەوە نایەت، بۆیە وێبگەڕ
 *     خۆی فۆنتێکی سیستەم هەڵدەبژێرێت — جارێک Times ـی عەرەبی،
 *     جارێک فۆنتێکی بنەڕەتی ناشیرین. بەکارهێنەر هیچ کۆنتڕۆڵێکی
 *     نەبوو و هەرگیز نەیدەزانی بۆچی.
 *   • لە PPTX دا: `morph.ts` خانەی `cs` چاک دەکاتەوە، بۆیە فایلی
 *     هەناردەکراو باش بوو — کە وای دەکرد کێشەکە تەنها لە پێشبینیندا
 *     بێت و دۆزینەوەی سەخت بێت.
 *
 * ئێستا فۆنتی بنەڕەتی لەگەڵ زمانەکە دەگونجێت، و بەکارهێنەریش
 * دەتوانێت لە ویزاردەکەدا بیگۆڕێت.
 */
export interface DeckFont { v: string; n: string; rtl: boolean }

/**
 * فۆنتەکانی دێکک. `rtl: true` واتە پیتی عەرەبی/کوردی هەیە.
 *
 * ئەوانەی RTL ـن هەموویان لەگەڵ Windows و Office ـدا دێن — چونکە
 * خوێندکار فایلەکە لەسەر کۆمپیوتەری زانکۆ دەکاتەوە، نەک لێرە.
 */
export const DECK_FONTS: DeckFont[] = [
  // ── پیتی کوردی/عەرەبییان هەیە ──
  { v: "Tahoma,'Segoe UI',sans-serif",                    n: 'Tahoma',          rtl: true },
  { v: "'Segoe UI',Tahoma,sans-serif",                    n: 'Segoe UI',        rtl: true },
  { v: "'Times New Roman',serif",                         n: 'Times New Roman', rtl: true },
  { v: "Arial,Helvetica,sans-serif",                      n: 'Arial',           rtl: true },
  { v: "'Traditional Arabic','Times New Roman',serif",    n: 'Traditional Arabic', rtl: true },
  { v: "'Sakkal Majalla',Tahoma,sans-serif",              n: 'Sakkal Majalla',  rtl: true },
  // ── تەنها لاتینی — بۆ دێککی ئینگلیزی ──
  { v: "Georgia,'Times New Roman',serif",                 n: 'Georgia',         rtl: false },
  { v: "'Palatino Linotype',Palatino,serif",              n: 'Palatino',        rtl: false },
  { v: "Cambria,Georgia,serif",                           n: 'Cambria',         rtl: false },
  { v: "Constantia,Georgia,serif",                        n: 'Constantia',      rtl: false },
  { v: "Calibri,'Segoe UI',sans-serif",                   n: 'Calibri',         rtl: false },
  { v: "Verdana,sans-serif",                              n: 'Verdana',         rtl: false },
];

/** ئەو فۆنتانەی بۆ ئەم زمانە گونجاون */
export const fontsFor = (lang: 'ckb' | 'ar' | 'en'): DeckFont[] =>
  lang === 'en' ? DECK_FONTS : DECK_FONTS.filter(f => f.rtl);

/**
 * فۆنتی بنەڕەتی بۆ زمانێک.
 * کوردی و عەرەبی → Tahoma (هەمان ئەوەی `csFontFor` بۆ PPTX هەڵیدەبژێرێت،
 * بۆیە پێشبینین و فایلی هەناردەکراو یەک شێوەیان دەبێت).
 */
export const defaultFontFor = (lang: 'ckb' | 'ar' | 'en'): string =>
  fontsFor(lang)[0].v;

// ─────────── پێوانەی زیندوو (تەنها وێبگەڕ) ───────────

/**
 * پانی دەقێک بە فۆنتێکی دیاریکراو.
 * فۆنتێکی نەناسراو دەکەوێتەوە سەر فۆنتی جێگرەوە، بۆیە بەراوردکردنی
 * دوو پێوانە دەریدەخات کە ئایا فۆنتەکە بەڕاستی بەکارهاتووە یان نا.
 */
function widthOf(ctx: CanvasRenderingContext2D, text: string, family: string): number {
  ctx.font = `72px ${family}`;
  return ctx.measureText(text).width;
}

/**
 * ئەو پیتانە دەگەڕێنێتەوە کە ئەم فۆنتە **نایانناسێت**.
 *
 * چۆن کاردەکات: هەر پیتێک دوو جار دەپێورێت — جارێک بە فۆنتەکەی خۆی،
 * جارێک بە فۆنتێکی نەبوو (`__ps_missing__`) کە هەمیشە دەکەوێتەوە سەر
 * جێگرەوەی سیستەم. ئەگەر هەردوو پانەکە یەکسان بوون، فۆنتەکە ئەو
 * پیتەی نەبووە و ئەویش دەکەوێتەوە سەر هەمان جێگرەوە.
 *
 * لە دەرەوەی وێبگەڕ لیستێکی بەتاڵ دەگەڕێنێتەوە — نەزانین، نەک «باشە».
 */
export function missingGlyphs(family: string, glyphs = KU_GLYPHS): string[] {
  if (typeof document === 'undefined') return [];
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) return [];

  const out: string[] = [];
  for (const g of glyphs) {
    const mine = widthOf(ctx, g, `"${family}", __ps_missing__`);
    const none = widthOf(ctx, g, '__ps_missing__');
    // هەمان پانی = فۆنتەکە بەشداری نەکردووە
    if (Math.abs(mine - none) < 0.01) out.push(g);
  }
  return out;
}

/** کورتەیەکی خوێندنەوەیی بۆ ڕووکار */
export function glyphReport(family: string): { ok: boolean; missing: string[] } {
  const missing = missingGlyphs(family);
  return { ok: missing.length === 0, missing };
}
