// ═══════════ هەڵبژاردنی تەختەبەند بە پێوانە ═══════════
//
// ─── کێشەکە ───
// مۆدێل تەختەبەندەکەی هەڵدەبژارد **پێش** ئەوەی بزانێت چەند دەق
// دەنووسێت. `fit.ts` دواتر دەیپێوا و تەنها یەک کاری لەدەست دەهات:
// بچووککردنەوەی فۆنت. ئەنجامەکەی سێ شت بوو کە بەکارهێنەر ناوی
// هێنان — «تێکەڵ، بەدەرچوو، بەتاڵ»:
//
//   دەقی زۆر    → بەدەر دەچوو، یان فۆنت هێندە بچووک دەبوو کە
//                 نەدەخوێندرایەوە
//   دەقی کەم    → نیوەی سلاید بەتاڵ
//   بەبێ وێنە   → ئەو چوارگۆشە خۆڵەمێشییە لە وێنەکانی بەکارهێنەردا
//
// مۆدێل ناتوانێت پیکسڵ بپێوێت. کۆد دەتوانێت. بڕیارەکە لای هەڵە بوو.
//
// ─── چارەسەرەکە ───
// تەختەبەند لە **شێوەی ناوەڕۆکەوە** هەڵدەبژێردرێت، نەک بە ئارەزوو:
//
//   ١) شێوەی سلایدەکە دیاری دەکرێت (`shapeOf`)
//   ٢) هەموو تەختەبەندەکانی ئەو شێوەیە کە داتاکەیان هەیە دەپێوردرێن
//   ٣) یەکەمیان کە **بەڕاستی دەگونجێت** هەڵدەبژێردرێت
//   ٤) ئەگەر هیچیان نەگونجان، فراوانترینیان
//
// ─── فراوانبوون ───
// زیادکردنی تەختەبەندێکی نوێ = یەک دێڕ لە `BY_SHAPE` دا. پشکنینێک
// هەیە کە دڵنیا دەبێتەوە هیچ تەختەبەندێکی ناوەڕۆک لەبیر نەکراوە،
// بۆیە تەختەبەندی نوێی بێ شێوە ناتوانێت بێدەنگ بمێنێتەوە.

import { fitBlock } from '../fit';
import { layoutById, textBox, CONTENT_LAYOUTS } from '../layouts';
import type { Lang, LayoutId, Shape, Slide } from '../types';

export type { Shape };

/**
 * تەختەبەندەکانی هەر شێوەیەک — بە ڕیزی «گونجاوترین یەکەم».
 *
 * ڕیزبەندییەکە گرنگە: یەکەمیان تایبەتترینە، کۆتاییان فراوانترین.
 * ئەلگۆریتمەکە بەم ڕیزە دەڕوات و یەکەم گونجاو هەڵدەبژێرێت، بۆیە
 * سلایدێکی کورت تەختەبەندی جوان وەردەگرێت و سلایدێکی درێژ
 * دەگەڕێتەوە بۆ ئەوەی شوێنی هەیە.
 */
const BY_SHAPE: Record<Shape, LayoutId[]> = {
  // ئاگاداری: کۆتا تەختەبەندی هەر لیستێک **فراوانترینە** — ئەوەیە
  // کە هەڵدەبژێردرێت کاتێک هیچیان نەگونجان. بۆیە `L_text` لە
  // کۆتایی زۆربەیاندایە: هەمیشە بەردەستە و هەمیشە شوێنی هەیە.
  statement: ['L_state', 'L_text'],
  list:      ['L_icons', 'L_three', 'L_pyramid', 'L_bullets', 'L_bulletsL', 'L_text'],
  compare2:  ['L_proscons', 'L_two', 'L_ba', 'L_venn', 'L_compare', 'L_text'],
  compareN:  ['L_three', 'L_icons', 'L_compare', 'L_table', 'L_text'],
  process:   ['L_steps', 'L_flow', 'L_cycle', 'L_bullets', 'L_text'],
  timeline:  ['L_time', 'L_bullets', 'L_text'],
  figures:   ['L_kpi', 'L_progress', 'L_bar', 'L_bullets', 'L_text'],
  quote:     ['L_quote', 'L_state', 'L_text'],
  definition:['L_def', 'L_state', 'L_text'],
  data:      ['L_bar', 'L_line', 'L_donut', 'L_progress', 'L_table', 'L_text'],
  breakdown: ['L_three', 'L_icons', 'L_donut', 'L_bullets', 'L_text'],
  example:   ['L_code', 'L_hero', 'L_grid', 'L_table', 'L_text'],
  divider:   ['L_divider'],
};

/** پێچەوانەکەی — لە تەختەبەندەوە بۆ شێوە */
const SHAPE_OF = new Map<LayoutId, Shape>();
for (const [shape, ids] of Object.entries(BY_SHAPE) as [Shape, LayoutId[]][])
  for (const id of ids) if (!SHAPE_OF.has(id)) SHAPE_OF.set(id, shape);

/**
 * شێوەی سلایدێک.
 *
 * `s.shape` سەرەکییە — مۆدێل دەینێرێت. بۆ دێککی کۆن کە شێوەی
 * نییە، لە تەختەبەندەکەیەوە دەردەهێنرێت، بۆیە هەموو دێککێک
 * کاردەکات.
 */
export const shapeOfSlide = (s: Slide): Shape => s.shape ?? shapeOf(s.layout);

export const shapeOf = (id: LayoutId): Shape => SHAPE_OF.get(id) ?? 'list';

/** هەموو شێوەکان — بۆ کاتالۆگی پرۆمپت و بۆ پشکنین */
export const SHAPES = Object.keys(BY_SHAPE) as Shape[];

/** ئایا ئەم ناوە شێوەیەکی ناسراوە؟ */
export const isShape = (x: unknown): x is Shape =>
  typeof x === 'string' && x in BY_SHAPE;

/**
 * یەکەم تەختەبەندی شێوەیەک — تەنها وەک تۆوێک بەکاردێت پێش پێوانە.
 * `pickLayout` هەر دەیگۆڕێت ئەگەر نەگونجا.
 */
export const seedOf = (sh: Shape): LayoutId => BY_SHAPE[sh][0];

/** هەموو تەختەبەندێکی ناوەڕۆک دەبێت شێوەیەکی هەبێت — بۆ پشکنین */
export const shapedLayouts = (): LayoutId[] => [...SHAPE_OF.keys()];

/** ئەو تەختەبەندانەی ناوەڕۆکیان هەیە بەڵام شێوەیان نییە */
export const unshaped = (): LayoutId[] =>
  CONTENT_LAYOUTS.filter(id => !SHAPE_OF.has(id));

// ─────────── ئایا داتاکەی هەیە؟ ───────────

/**
 * ئایا ئەم سلایدە ئەو داتایەی هەیە کە ئەم تەختەبەندە پێویستی پێیەتی؟
 *
 * ئەمە ئەو پشکنینەیە کە چوارگۆشە خۆڵەمێشییەکە دەکوژێت: تەختەبەندی
 * وێنەدار تەنها کاتێک بەردەستە کە وێنەیەک هەبێت — یان بەڵێنی
 * وێنەیەک، ئەگەر هێشتا نەهێنراون.
 */
function hasData(s: Slide, id: LayoutId, imagesResolved: boolean): boolean {
  const needs = layoutById(id).needs;
  for (const n of needs) {
    switch (n) {
      case 'bullets':  if (!s.bullets.length) return false; break;
      case 'text':     if (!s.body && !s.bullets.length) return false; break;
      case 'chart':    if (!s.chart?.values?.length) return false; break;
      case 'table':    if (!s.table?.head?.length) return false; break;
      case 'steps':    if (!s.steps?.length) return false; break;
      case 'timeline': if (!s.timeline?.length) return false; break;
      case 'kpis':     if (!s.kpis?.length) return false; break;
      case 'quote':    if (!s.quote?.text) return false; break;
      case 'proscons': if (!(s.pros?.length && s.cons?.length)) return false; break;
      case 'refs':     if (!s.refs?.length) return false; break;
      case 'image':
        // پێش هێنانی وێنەکان، بەڵێنێک بەسە. دوای ئەوە، نا —
        // ئەمە ئەو دێڕەیە کە شوێنی بەتاڵ ڕێگری لێدەکات.
        if (imagesResolved ? !s.imageUrl : !(s.imageUrl || s.imagePrompt)) return false;
        break;
    }
  }
  // ژمارەی خاڵەکان — L_three بە دوو خاڵ ستوونێکی بەتاڵی دەبێت
  const range = layoutById(id).bulletRange;
  if (range && needs.includes('bullets')) {
    const n = s.bullets.length;
    if (n < range[0] || n > range[1]) return false;
  }
  return true;
}

// ─────────── پێوان ───────────

/** ئەو دێڕانەی لە خانەی دەقەکەدا دادەنرێن */
function linesOf(s: Slide, id: LayoutId): string[] {
  if (id === 'L_text' || id === 'L_hero' || id === 'L_state' || id === 'L_def')
    return s.body ? [s.body] : s.bullets;
  if (id === 'L_quote') return s.quote ? [s.quote.text] : s.bullets;
  return s.bullets.length ? s.bullets : s.body ? [s.body] : [];
}

/** ئایا ناوەڕۆکەکە بەڕاستی لەم تەختەبەندەدا دەگونجێت؟ */
export function fitsIn(s: Slide, id: LayoutId, lang: Lang): boolean {
  const lines = linesOf(s, id);
  if (!lines.length) return true;                 // هیچ دەقێک نییە بۆ گونجاندن
  const b = textBox(id);
  // `per` = چەند خاڵ لە **یەک** خانەدا دادەنرێن. بۆ تەختەبەندی
  // ستوونی ئەمە ١ ـە، بۆیە تەنها یەک خاڵ دەپێوردرێت — نەک هەموویان.
  const chunk = lines.slice(0, Math.max(1, Math.min(b.per, lines.length)));
  return !fitBlock({
    lines: chunk,
    width: b.w, height: b.h, size: b.size,
    gap: b.gap, indent: b.indent,
    rtl: lang !== 'en',
  }).overflow;
}

// ─────────── هەڵبژاردن ───────────

export interface ComposeOpts {
  lang: Lang;
  /**
   * ئایا وێنەکان هێنراون؟
   *
   * پێش هێنان `imagePrompt` وەک بەڵێنێک دەژمێردرێت. دوای هێنان،
   * سلایدێک کە وێنەکەی نەهات دەکەوێتەوە سەر تەختەبەندێکی دەقی —
   * بۆیە هەرگیز چوارگۆشەیەکی بەتاڵ نامێنێتەوە.
   */
  imagesResolved?: boolean;
}

/**
 * باشترین تەختەبەند بۆ ئەم سلایدە.
 *
 * ڕیزبەندی بڕیارەکە:
 *   ١) داتاکەی هەیە؟        نا → لابدە
 *   ٢) دەگونجێت؟            بەڵێ → هەڵیبژێرە (یەکەم گونجاو باشترینە)
 *   ٣) هیچیان نەگونجان      → فراوانترین کە داتاکەی هەیە
 */
export function pickLayout(s: Slide, o: ComposeOpts): LayoutId {
  const resolved = !!o.imagesResolved;
  const usable = BY_SHAPE[shapeOfSlide(s)].filter(id => hasData(s, id, resolved));

  // شێوەکە هیچ تەختەبەندێکی بەردەستی نییە — بگەڕێوە بۆ ئەوانەی
  // هەمیشە کاردەکەن. دەق هەمیشە دەتوانرێت پیشان بدرێت.
  if (!usable.length)
    return s.bullets.length ? 'L_text' : 'L_text';

  const fits = usable.filter(id => fitsIn(s, id, o.lang));

  // ═══ وێنە بەفیڕۆ نادرێت ═══
  // ئەگەر سلایدەکە وێنەیەکی هەیە، تەختەبەندێک کە بەکاری دەهێنێت
  // پێشتری هەیە. بەبێ ئەمە، سلایدێکی «list» بە وێنەیەکەوە دەکەوێتە
  // L_icons — کە شوێنی وێنەی نییە — و وێنە هێنراوەکە ون دەبێت.
  const wantsImage = !!(s.imageUrl || (!resolved && s.imagePrompt));
  if (wantsImage) {
    const withImg = fits.find(id => layoutById(id).needs.includes('image'));
    if (withImg) return withImg;
  }

  // ئەوەی کۆتایی لیستەکەیە فراوانترینە — بڕوانە ڕیزبەندی `BY_SHAPE`
  return fits[0] ?? usable[usable.length - 1];
}

/**
 * تەختەبەندی هەموو سلایدەکان لەسەر پێوانە دادەنرێتەوە.
 *
 * دوو جار بانگ دەکرێت: یەکجار دوای دروستکردن (بۆ پێکهاتە)، و
 * دووەم جار دوای هێنانی وێنەکان بە `imagesResolved: true`.
 * جاری دووەم ئەوەیە کە شوێنە بەتاڵەکان لادەبات.
 */
export function compose(slides: Slide[], o: ComposeOpts): Slide[] {
  return slides.map(s => {
    // سلایدە چەسپاوەکان دەستیان لێنادرێت — سەرەتا، ناوەڕۆک،
    // سوپاس و سەرچاوەکان تەختەبەندی خۆیانە و هەڵنابژێردرێن
    if (!CONTENT_LAYOUTS.includes(s.layout)) return s;
    const to = pickLayout(s, o);
    return to === s.layout ? s : { ...s, layout: to };
  });
}
