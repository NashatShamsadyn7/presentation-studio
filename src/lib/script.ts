// ═══════════ دەقی پێشکەشکردن و دابەشکردنی قسەکەران ═══════════
//
// پێشکەشکردنی زانکۆیی زۆرجار گرووپییە: چوار خوێندکار، هەرکەسە
// چەند سلایدێک و چەند خولەکێک. تا ئێستا ئەپەکە هیچی لەوە نەدەزانی —
// دێککێکی بێ خاوەنی دروست دەکرد و خوێندکارەکان خۆیان دابەشیان
// دەکرد.
//
// ئەم مۆدیوولە دوو شت دەکات:
//   ١) دەقی خوێندکار دەخوێنێتەوە و ئەو زانیارییانەی تێدایە دەردەهێنێت
//      (ناوەکان، مەودای سلایدەکان، خولەکەکان) — ئەگەر هەبوون
//   ٢) ئەوەی نەبوو، بە دادپەروەری دابەشی دەکات
//
// دەقەکە خۆی **ناچێتە ناو تێبینییەکانەوە**. تەنها پرۆمپتەکە
// دەوڵەمەندتر دەکات، و سلایدەکان پاک دەمێننەوە.

import type { Speaker } from './types';

/** ژمارە عەرەبی و فارسییەکان دەکاتە ئاسایی — «٥» → «5» */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

/**
 * ڕێژەی سلاید بۆ خولەک.
 *
 * ڕێنمایی باوی پێشکەشکردن: نزیکەی سلایدێک بۆ هەر خولەکێک. لێرەدا
 * ١.٢ بەکاردێت — کەمێک لەوە هێواشتر، چونکە سلایدی زانکۆیی زیاتر
 * دەق و ڕوونکردنەوەی تێدایە لە سلایدێکی بازرگانی.
 */
const MIN_PER_SLIDE = 1.2;

/** لە کاتەوە ژمارەی گونجاوی سلاید پێشنیار دەکات */
export function suggestSlides(minutes: number): number {
  if (!minutes || minutes <= 0) return 0;
  return Math.min(40, Math.max(6, Math.round(minutes / MIN_PER_SLIDE)));
}

/** پێچەوانەکەی — لە ژمارەی سلایدەوە کاتی چاوەڕوانکراو */
export const expectedMinutes = (slides: number) =>
  Math.round(slides * MIN_PER_SLIDE);

// ─────────── خوێندنەوەی دەقەکە ───────────

/**
 * جیاکەرەوەکانی مەودا. جگە لە هێمای بڕگە، وشەی «بۆ»ی کوردی و
 * «إلى»ی عەرەبی و «to»ی ئینگلیزیش ڕێپێدراون، چونکە خوێندکار
 * بە هەر شێوەیەک دەینووسێت.
 */
const RANGE = /(\d{1,3})\s*(?:-|–|—|\.\.|to|تا|بۆ|إلى|الى)\s*(\d{1,3})/;

/** «١٠ خولەک»، «10 min»، «5m»، «دقيقتين» — تەنها ژمارە + یەکە */
const MINUTES = /(\d{1,3})\s*(?:min(?:ute)?s?\b|m\b|خولەک|دەقیقە|دقيقة|دقائق|دقيقه)/i;

/** کۆی کات لە دەقەکەدا — «کۆی کات: ٢٠ خولەک» */
const TOTAL = /(?:total|کۆ|کۆی کات|المجموع|إجمالي|اجمالي)\D{0,12}(\d{1,3})/i;

/** ناوێک بەکار دێت؟ ژمارە و هێما ڕەت دەکرێنەوە */
function cleanName(raw: string): string {
  const n = raw
    .replace(/[.:،,;()[\]{}«»"'—–\-]+/g, ' ')
    .replace(/\b(?:slide|slides|سلاید|شريحة|شرائح|من|لە)\b/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // ناوێکی مرۆڤ لە ٢ پیتەوە تا ٤٠، زۆرترین چوار وشە
  if (n.length < 2 || n.length > 40) return '';
  if (n.split(' ').length > 4) return '';
  return n;
}

export interface ParsedScript {
  speakers: Speaker[];
  /** کۆی کات ئەگەر لە دەقەکەدا نووسرابوو */
  totalMinutes: number;
  /** ئەو ناوانەی دۆزرانەوە بەڵام مەودایان نەبوو */
  namesOnly: string[];
}

/**
 * دەقەکە دەپشکنێت بۆ دابەشکردنێکی نووسراو.
 *
 * دەگەڕێت بۆ دێڕانێکی وەک:
 *   Sara 1-5          سارا: ١–٥ (١٠ خولەک)
 *   Ali: slides 6 to 8        علي 9-15  ٨ دقائق
 *
 * ئەگەر ناوی خوێندکارەکان پێشتر زانرابێت (لە فۆرمەکەوە)، ئەوانە
 * پێش هەر ناوێکی تر دەگیرێن — چونکە دەقەکە دەکرێت ناوی کەسانی تری
 * تێدابێت (نموونە: ناوی توێژەرێک).
 */
export function parseScript(text: string, known: string[] = []): ParsedScript {
  const src = toLatinDigits(text || '');
  const out: Speaker[] = [];
  const namesOnly: string[] = [];
  const seen = new Set<string>();

  const knownClean = known.map(n => n.trim()).filter(Boolean);
  const findKnown = (line: string) =>
    knownClean.find(n => line.toLowerCase().includes(n.toLowerCase()));

  let totalMinutes = 0;
  const t = TOTAL.exec(src);
  if (t) totalMinutes = Number(t[1]) || 0;

  for (const line of src.split(/\r?\n/)) {
    if (line.trim().length < 3) continue;

    const r = RANGE.exec(line);
    const m = MINUTES.exec(line);

    // ناوەکە: یەکەم لە ناوە زانراوەکان، ئەگەرنا ئەوەی پێش مەودایەکە
    const name = findKnown(line)
      ?? (r ? cleanName(line.slice(0, r.index)) : '');
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    if (!r) {
      // ناو هەیە بەڵام مەودا نا — دواتر خۆکار دابەش دەکرێت
      if (!namesOnly.includes(name)) namesOnly.push(name);
      continue;
    }

    const a = Number(r[1]), b = Number(r[2]);
    if (!a || !b) continue;

    seen.add(key);
    out.push({
      name,
      from: Math.min(a, b),
      to: Math.max(a, b),
      minutes: m ? Number(m[1]) || 0 : 0,
    });
  }

  // ئەو ناوانەی مەودایان دۆزرایەوە، لە لیستی «تەنها ناو» دەردەکرێن
  return {
    speakers: out.sort((x, y) => x.from - y.from),
    totalMinutes,
    namesOnly: namesOnly.filter(n => !seen.has(n.toLowerCase())),
  };
}

// ─────────── دابەشکردنی خۆکار ───────────

/**
 * سلایدەکان بە دادپەروەری بەسەر خوێندکاراندا دابەش دەکات.
 *
 * ئەوانەی دەمێننەوە دەچنە سەر یەکەمەکان — واتە ئەگەر ١٤ سلاید و
 * ٤ خوێندکار هەبن، دەبێتە ٤ / ٤ / ٣ / ٣، نەک ٣ / ٣ / ٣ / ٥.
 *
 * کاتیش بە ڕێژەی سلایدەکان دابەش دەکرێت، نەک بە یەکسانی — ئەوەی
 * سلایدی زیاتری هەیە کاتی زیاتریشی دەوێت.
 *
 * ─── بۆچی کات بە کۆکراوە دەژمێردرێت ───
 * ئەگەر بەشی هەرکەسێک بە جیا خڕ بکرێتەوە، کۆکەیان لەگەڵ کۆی کاتدا
 * ناگونجێت. نموونەی ڕاستەقینە: ١٧ سلاید، ٢٠ خولەک، ٤ خوێندکار →
 * ٦ + ٥ + ٥ + ٥ = ٢١. بەکارهێنەر ٢٠ ـی نووسیوە و ٢١ دەبینێت.
 *
 * بۆیە لەبری خڕکردنەوەی بەشەکان، **خاڵە کۆکراوەکان** خڕ دەکرێنەوە و
 * جیاوازییان وەردەگیرێت. بەمە کۆکەیان هەمیشە بە تەواوی دەگاتە
 * `minutes`.
 */
export function autoSplit(names: string[], slides: number, minutes = 0): Speaker[] {
  const use = names.map(n => n.trim()).filter(Boolean);
  if (!use.length || slides < 1) return [];

  const each = Math.floor(slides / use.length);
  const extra = slides % use.length;

  const out: Speaker[] = [];
  let at = 1, doneSlides = 0, doneMin = 0;

  for (let i = 0; i < use.length; i++) {
    const n = each + (i < extra ? 1 : 0);
    if (n < 1) continue;                       // خوێندکار زیاترە لە سلاید

    doneSlides += n;
    const upto = minutes ? Math.round(minutes * doneSlides / slides) : 0;

    out.push({ name: use[i], from: at, to: at + n - 1, minutes: upto - doneMin });
    at += n;
    doneMin = upto;
  }
  return out;
}

// ─────────── پشکنین ───────────

/**
 * کێشەکانی دابەشکردنەکە دەگەڕێنێتەوە، بە کوردی.
 *
 * ئەمانە **ئاگاداری**ن نەک هەڵە — دەکرێت خوێندکار بەئەنقەست
 * سلایدێک بەبێ خاوەن بهێڵێتەوە. بۆیە دروستکردن ناوەستێت.
 */
export function checkSpeakers(sp: Speaker[], total: number): string[] {
  const out: string[] = [];
  if (!sp.length) return out;

  const sorted = [...sp].sort((a, b) => a.from - b.from);

  for (const s of sorted) {
    if (s.from < 1 || s.to > total)
      out.push(`${s.name}: مەودای ${s.from}–${s.to} لە دەرەوەی ١–${total} ـە.`);
    if (s.from > s.to)
      out.push(`${s.name}: سەرەتاکە لە کۆتاییەکە گەورەترە.`);
  }

  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    if (b.from <= a.to)
      out.push(`${a.name} و ${b.name} لەسەر سلایدی ${b.from} دووبارە بوونەتەوە.`);
    else if (b.from > a.to + 1)
      out.push(`سلایدی ${a.to + 1}–${b.from - 1} خاوەنی نییە.`);
  }

  const first = sorted[0], last = sorted[sorted.length - 1];
  if (first.from > 1) out.push(`سلایدی ١–${first.from - 1} خاوەنی نییە.`);
  if (last.to < total) out.push(`سلایدی ${last.to + 1}–${total} خاوەنی نییە.`);

  return out;
}

/** کام خوێندکار ئەم سلایدە پێشکەش دەکات؟ (ژمارەی بینراو، ١-بنەڕەت) */
export const speakerAt = (sp: Speaker[] | undefined, n: number): Speaker | undefined =>
  sp?.find(s => n >= s.from && n <= s.to);

// ─────────── بۆ پرۆمپتەکە ───────────

/**
 * دابەشکردنەکە دەکاتە ڕێنمایی بۆ مۆدێل، بە ئینگلیزی.
 *
 * @param contentStart ژمارەی بینراوی یەکەم سلایدی ناوەڕۆک. لاپەڕەی
 *        سەرەتا ١ ـە و ناوەڕۆک ٢، بۆیە ئەمە ٣ ـە. مۆدێل تەنها
 *        سلایدەکانی ناوەڕۆک دەنووسێت، بۆیە ژمارەکان دەگۆڕدرێن.
 */
export function speakerBrief(
  sp: Speaker[], contentStart: number, contentCount: number,
): string {
  const rows: string[] = [];

  for (const s of sp) {
    // بەشی ئەم خوێندکارە لە سلایدەکانی ناوەڕۆکدا
    const a = Math.max(1, s.from - contentStart + 1);
    const b = Math.min(contentCount, s.to - contentStart + 1);
    if (b < 1 || a > contentCount) continue;   // تەنها لاپەڕەی سەرەتا/کۆتایی

    const n = b - a + 1;
    const pace = s.minutes
      ? ` — ${s.minutes} minutes for these, about ${(s.minutes / n).toFixed(1)} min per slide`
      : '';
    rows.push(`  content slides ${a}-${b}: ${s.name}${pace}`);
  }

  if (!rows.length) return '';

  return [
    'This deck is presented by several students, one after another:',
    ...rows,
    '',
    'Because of this:',
    '- Each student\'s run of slides must read as one coherent section with its',
    '  own beginning and end, not as isolated slides.',
    '- Do not split a single idea across a handover. The last slide before a',
    '  handover should close its point.',
    '- Where a student has clearly more than 1.5 minutes per slide, give those',
    '  slides more substance. Where they have less than 1 minute, keep them lean.',
  ].join('\n');
}
