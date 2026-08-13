// ═══════════ پشکنینی دێکک پێش ناردنی بۆ بەکارهێنەر ═══════════
//
// ─── بۆچی ───
// پێشتر دێککەکە بێدەنگ دەردەچوو، جا تەواو بێت یان نا. بەشێکی
// پێڕست کە سلایدی نەبوو، دەقێکی بەدەرچوو، لاپەڕەیەکی سەرچاوەی
// بەتاڵ — هیچیان ڕانەدەگەیەنران. بەکارهێنەر خۆی دەیدۆزییەوە، یان
// مامۆستاکەی.
//
// هەموو پشکنینەکان **میکانیکین**: بەبێ مۆدێل، بەبێ ئینتەرنێت،
// بەبێ حوکم. بۆیە لە تاقیکردنەوەدا دەڕۆن و هەرگیز ناچنە سەر
// ژمارەی داواکارییەکان.
//
// ─── فراوانبوون ───
// پشکنینێکی نوێ = فەنکشنێک کە `Defect[]` دەگەڕێنێتەوە و ناوی
// دەچێتە `CHECKS` ـەوە. هیچ شوێنێکی تر گۆڕانی ناوێت.

import { layoutById } from '../layouts';
import type { Deck, Lang, Slide } from '../types';
import { fitsIn } from './compose';
import type { Section } from './model';
import { isReal } from './model';

/** توندی کێشەکە — دەق پێشکەشکردنەکە دەشکێنێت، ئاگاداری کەمی دەکات */
export type Level = 'error' | 'warn';

export interface Defect {
  level: Level;
  /** ناوی پشکنینەکە — بۆ تاقیکردنەوە و بۆ ڕیزکردن */
  check: string;
  /** پەیامێکی کوردی بۆ بەکارهێنەر — دەبێت بڵێت چی بکات */
  message: string;
  /** ژمارەی سلایدی بینراو، ئەگەر پەیوەندی بە سلایدێکەوە هەیە */
  slide?: number;
}

export interface VerifyInput {
  slides: Slide[];
  lang: Lang;
  /** بەشەکانی پێڕست — بەبێی، پشکنینی بۆشایی ناکرێت */
  sections?: Section[];
  /** ژمارەی یەکەم سلایدی بینراو — بڕوانە `Wizard` (٣ بە بنەڕەت) */
  contentStart?: number;
}

// ─────────── پشکنینەکان ───────────

/**
 * ١. هەموو بەشێکی پێڕست سلایدی هەیە؟
 *
 * لاپەڕەی ناوەڕۆک هەموو بەشەکان پیشان دەدات، جا سلایدیان هەبێت
 * یان نا. بەشێکی بێ سلاید بەڵێنێکە کە دێککەکە جێبەجێی ناکات —
 * و ئەوە یەکەم شتە مامۆستا دەیبینێت.
 */
function gaps(i: VerifyInput): Defect[] {
  if (!i.sections?.length) return [];
  const covered = new Set(i.slides.map(s => s.section).filter(Boolean));
  return i.sections
    .filter(sec => !covered.has(sec.id))
    .map(sec => ({
      level: 'error' as Level,
      check: 'gap',
      message: `بەشی «${sec.title}» لە لاپەڕەی ناوەڕۆکدایە بەڵام هیچ سلایدێکی نییە. `
             + 'یان سلایدێکی بۆ زیاد بکە، یان لە پێڕستەکە لایبە.',
    }));
}

/**
 * ٢. هەموو بەستەرێکی بەش دەگاتە بەشێکی ڕاستەقینە؟
 *
 * بەستەرێکی هەڵە لە بەستەرێکی نەبوو خراپترە: دەڵێت پەیوەندی
 * هەیە، بەڵام نییە.
 */
function brokenLinks(i: VerifyInput): Defect[] {
  if (!i.sections?.length) return [];
  const ids = new Set(i.sections.map(s => s.id));
  const start = i.contentStart ?? 3;
  return i.slides.flatMap((s, n) =>
    s.section && !ids.has(s.section)
      ? [{
          level: 'error' as Level,
          check: 'broken-link',
          message: `سلاید ${start + n} ئاماژە بە بەشێک دەکات کە بوونی نییە.`,
          slide: start + n,
        }]
      : []);
}

/**
 * ٣. دەق لە سلایدەکە بەدەر دەچێت؟
 *
 * لە وێبگەڕدا دەقی زیادە دەبڕدرێت (`overflow:hidden`)، بەڵام
 * PowerPoint دەیهێڵێت بەدەر بێت. بۆیە پێشبینینەکە جوان دەردەکەوت
 * و فایلە داگیراوەکە شکاو بوو — کێشەیەک کە تەنها دوای هەناردەکردن
 * دەردەکەوت.
 */
function overflow(i: VerifyInput): Defect[] {
  const start = i.contentStart ?? 3;
  return i.slides.flatMap((s, n) =>
    fitsIn(s, s.layout, i.lang)
      ? []
      : [{
          level: 'warn' as Level,
          check: 'overflow',
          message: `سلاید ${start + n} («${s.title}») دەقی زۆرە و لە شوێنەکەی `
                 + 'بەدەر دەچێت لە PowerPoint دا. کورتی بکەرەوە یان بیکە دوو سلاید.',
          slide: start + n,
        }]);
}

/**
 * ٤. شوێنێکی بەتاڵ ماوەتەوە؟
 *
 * ئەو چوارگۆشە خۆڵەمێشییەی کە بەکارهێنەر لە وێنەکانیدا پیشانی دا:
 * تەختەبەندی وێنەدار بەبێ وێنە.
 */
function emptySlots(i: VerifyInput): Defect[] {
  const start = i.contentStart ?? 3;
  return i.slides.flatMap((s, n) =>
    layoutById(s.layout).needs.includes('image') && !s.imageUrl
      ? [{
          level: 'error' as Level,
          check: 'empty-slot',
          message: `سلاید ${start + n} شوێنی وێنەی هەیە بەڵام وێنەی نییە. `
                 + 'لە ستودیۆدا وێنەیەکی بۆ دابنێ، یان تەختەبەندەکەی بگۆڕە.',
          slide: start + n,
        }]
      : []);
}

/**
 * ٥. لاپەڕەی سەرچاوەکان.
 *
 * دوو کێشەی جیاواز، هەردووکیان لە وێنەکانی بەکارهێنەردا بوون:
 *   • لاپەڕەیەکی بەتاڵ — هیچ سەرچاوەیەک نەدۆزرایەوە
 *   • سەرچاوەیەک بەبێ DOI و بەبێ نووسەر — واتە ناپشکندرێت،
 *     و مامۆستا ڕاستەوخۆ دەیپشکنێت
 */
function references(i: VerifyInput): Defect[] {
  const page = i.slides.find(s => s.layout === 'L_refs');
  if (!page) return [];

  const refs = page.refs ?? [];
  if (!refs.length)
    return [{
      level: 'error', check: 'refs-empty',
      message: 'لاپەڕەی سەرچاوەکان بەتاڵە. یان سەرچاوە زیاد بکە، یان لاپەڕەکە لابە — '
             + 'لاپەڕەیەکی بەتاڵ خراپترە لە نەبوونی.',
    }];

  const fake = refs.filter(r => !isReal(r));
  return fake.length
    ? [{
        level: 'warn', check: 'refs-unverifiable',
        message: `${fake.length} سەرچاوە نە DOI یان نە نووسەر و ساڵیان هەیە، بۆیە `
               + 'ناپشکندرێن. لە ستودیۆدا داوا لە یاریدەدەر بکە بەدوایاندا بگەڕێت.',
      }]
    : [];
}

/**
 * ٦. ئاماژەیەک بە سەرچاوەیەکی نەبوو؟
 *
 * `toSlide` ناسنامەی نەناسراو دەسڕێتەوە، بۆیە ئەمە نابێت هەرگیز
 * ڕووبدات لە ڕێڕەوی دروستکردندا. بەڵام ئەیجێنت و ئێدیتەریش
 * دەتوانن `cites` بگۆڕن — و ئەم پشکنینە ئەو ڕێڕەوانەش دەگرێتەوە.
 */
function citations(i: VerifyInput): Defect[] {
  const page = i.slides.find(s => s.layout === 'L_refs');
  const ids = new Set((page?.refs ?? []).map(r => r.id).filter(Boolean));
  if (!ids.size) return [];

  const start = i.contentStart ?? 3;
  const out: Defect[] = [];

  // ئاماژە بۆ سەرچاوەیەکی نەبوو
  for (const [n, s] of i.slides.entries())
    for (const id of s.cites ?? [])
      if (!ids.has(id)) {
        out.push({
          level: 'error', check: 'cite-unknown',
          message: `سلاید ${start + n} ئاماژە بە سەرچاوەیەک دەکات کە لە `
                 + 'لاپەڕەی سەرچاوەکاندا نییە.',
          slide: start + n,
        });
        break;
      }

  // سەرچاوەیەک کە هیچ سلایدێک بەکاری نەهێناوە
  const used = new Set(i.slides.flatMap(s => s.cites ?? []));
  // ئەگەر هیچ سلایدێک ئاماژەی نەداوە، ئەمە کێشە نییە — دێککێکی
  // بەبێ ئاماژە هێشتا بۆی هەیە سەرچاوەی هەبێت
  if (used.size) {
    const idle = [...ids].filter(id => !used.has(id!)).length;
    if (idle)
      out.push({
        level: 'warn', check: 'refs-uncited',
        message: `${idle} سەرچاوە لە لاپەڕەکەدان بەڵام هیچ سلایدێک بەکاری نەهێناون. `
               + 'یان لە سلایدێکدا ناویان بهێنە، یان لایانبە.',
      });
  }
  return out;
}

/**
 * ٧. دوو سلاید هەمان شت دەڵێن؟
 *
 * پرۆمپتەکە داوای «هەر شتێک یەک جار» دەکات. ئەمە دەیپشکنێت.
 * سنوورەکە ٧٠٪ ـە: کەمتر لەوە لقکردنەوەی ڕاستەقینەیە (چوار جۆر
 * لەسەر چوار سلاید)، کە پرۆمپتەکە بە ئەنقەست ڕێگەی پێدەدات.
 */
/**
 * ٨. سلایدێک کە هیچی لەسەر نییە؟
 *
 * ═══ ئەم پشکنینە لە دێککێکی ڕاستەقینەی خاوەنی بەرهەمەکەوە هات ═══
 * دێککێکی هەناردەکراو پیشان درا کە:
 *   • سلایدی ٣ و ٥ تەنها ناونیشان و ژێدەرێکیان هەبوو — چوارگۆشەی
 *     دەقەکە **بە تەواوی بەتاڵ** بوو، ٣٫٦ ئینچ بەرزی
 *   • سلایدی ٤، ٦، ٧، ٨ هەریەکەیان **یەک** خاڵیان هەبوو
 *
 * هیچ پشکنینێک ئەمەی نەگرت. `overflow` تەنها دەقی زۆر دەگرێت؛
 * دەقی کەم لە هیچ شوێنێکدا کێشە نەبوو. بۆیە دێککێکی بەتاڵ بێدەنگ
 * دەردەچوو و بەکارهێنەر لە PowerPoint دا دەیدۆزییەوە.
 *
 * سنوورەکە بە ئەنقەست نزمە — دوو خاڵ. مەبەست ئەوە نییە کە شێواز
 * دیاری بکرێت، بەڵکو ئەوەی سلایدێکی **بەتاڵ** ناتوانێت بێدەنگ
 * بشکێتەوە ناو دێککەکە.
 */
const MIN_POINTS = 2;

/** ئایا ئەم سلایدە داتای دیکەی هەیە جگە لە خاڵ و دەق؟ */
const hasStructure = (s: Slide) =>
  !!(s.steps?.length || s.timeline?.length || s.kpis?.length || s.quote?.text
     || s.chart?.values?.length || s.table?.head?.length
     || (s.pros?.length && s.cons?.length) || s.refs?.length);

/** ئەو تەختەبەندانەی بە بنەڕەت دەقی کەمیان هەیە — نابێت ڕاپۆرت بکرێن */
const SPARSE_OK = new Set(['L_divider', 'L_thanks', 'L_title', 'L_outline', 'L_state', 'L_quote']);

function thin(i: VerifyInput): Defect[] {
  const start = i.contentStart ?? 3;
  return i.slides.flatMap((s, n) => {
    if (SPARSE_OK.has(s.layout) || hasStructure(s)) return [];
    const points = s.bullets.filter(b => b.trim()).length;
    const words = (s.body ?? '').trim().split(/\s+/).filter(Boolean).length;

    // بە تەواوی بەتاڵ — ئەمە هەڵەیە، نەک ئاگاداری
    if (!points && words < 4)
      return [{
        level: 'error' as Level,
        check: 'empty-slide',
        message: `سلاید ${start + n} («${s.title}») هیچ ناوەڕۆکێکی نییە — تەنها ناونیشانێکە. `
               + 'یان بیسڕەوە، یان لە ستودیۆدا داوا لە یاریدەدەر بکە پڕی بکاتەوە.',
        slide: start + n,
      }];

    // یەک خاڵ لەسەر سلایدێکی تەواو — لاوازە بەڵام شکاو نییە
    if (points && points < MIN_POINTS && words < 12)
      return [{
        level: 'warn' as Level,
        check: 'thin-slide',
        message: `سلاید ${start + n} («${s.title}») تەنها یەک خاڵی هەیە. `
               + 'سلایدێکی زانکۆیی ٣ تا ٥ خاڵ دەگرێت — زیاتری بۆ زیاد بکە یان تێکەڵی سلایدێکی تری بکە.',
        slide: start + n,
      }];

    return [];
  });
}

/** وشە بەرچاوەکانی سلایدێک — بنەمای هەموو پێوانێکی هاوشێوەیی */
export const slideWords = (s: Slide): Set<string> =>
  new Set(`${s.title} ${s.bullets.join(' ')} ${s.body ?? ''}`
    .toLowerCase().split(/[\s،,.:؛;؟?!-]+/).filter(w => w.length > 3));

/**
 * چەند لە سەدی وشەکانیان هاوبەشە — ٠ تا ١.
 *
 * ─── بۆچی هەناردە کراوە ───
 * `crew/editor.ts` هەمان پێوانە بەکاردەهێنێت، بەڵام بە سنوورێکی
 * نزمتر (٠٫٥ لە جیاتی ٠٫٧): پشکنینەکە **ڕادەگەیەنێت**، ئێدیتەرەکە
 * **چاکی دەکاتەوە**، بۆیە دەتوانێت زیاتر گومان بکات. دوو
 * جێبەجێکردنی جیاواز واتای ئەوەیە کە ڕۆژێک لێک جیا دەبنەوە و
 * ئێدیتەر شتێک ڕەت بکاتەوە کە پشکنینەکە ڕازییە پێی.
 */
export function overlapOf(a: Set<string>, b: Set<string>): number {
  const small = Math.min(a.size, b.size);
  if (!small) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / small;
}

function duplicates(i: VerifyInput): Defect[] {
  const start = i.contentStart ?? 3;

  const out: Defect[] = [];
  const sets = i.slides.map(slideWords);
  for (let a = 0; a < sets.length; a++) {
    if (sets[a].size < 6) continue;              // زۆر کورتە بۆ بەراورد
    for (let b = a + 1; b < sets.length; b++) {
      if (sets[b].size < 6) continue;
      if (overlapOf(sets[a], sets[b]) >= 0.7)
        out.push({
          level: 'warn', check: 'duplicate',
          message: `سلاید ${start + a} و ${start + b} زۆربەی هەمان شت دەڵێن. `
                 + 'یەکێکیان بسڕەوە یان شتێکی نوێی پێبڵێ.',
          slide: start + b,
        });
    }
  }
  return out;
}

// ─────────── دەروازە ───────────

const CHECKS = [gaps, brokenLinks, overflow, emptySlots, references, citations,
                duplicates, thin];

/**
 * دێککەکە دەپشکنێت و لیستی کێشەکان دەگەڕێنێتەوە.
 *
 * لیستێکی بەتاڵ = دێککەکە تەواوە. هەرگیز فڕێنادات و هەرگیز
 * ناگۆڕێت — تەنها ڕادەگەیەنێت. چاککردنەوە کاری `compose()` و
 * بەکارهێنەرە.
 */
export function verify(i: VerifyInput): Defect[] {
  const out = CHECKS.flatMap(c => c(i));
  // هەڵەکان یەکەم — بەکارهێنەر لە سەرەوەی لیستەکەوە دەخوێنێتەوە
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}

/** ناوی هەموو پشکنینەکان — بۆ تاقیکردنەوە */
export const checkNames = (): string[] => CHECKS.map(c => c.name);

/** پوختەیەکی کوردی بۆ پیشاندان لە ڕووکاردا */
export function summarise(d: Defect[]): string {
  if (!d.length) return '';
  const errors = d.filter(x => x.level === 'error').length;
  const warns = d.length - errors;
  const bits = [
    errors ? `${errors} کێشەی گرنگ` : '',
    warns ? `${warns} ئاگاداری` : '',
  ].filter(Boolean);
  return `${bits.join(' و ')}: ${d.slice(0, 3).map(x => x.message).join(' · ')}`;
}

/** دێککێکی تەواو دەپشکنێت — ڕێگای ئاسان بۆ ستودیۆ */
export const verifyDeck = (deck: Deck, sections?: Section[]): Defect[] =>
  verify({ slides: deck.slides, lang: deck.lang, sections, contentStart: 2 });
