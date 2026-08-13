// ═══════════ جۆرەکانی داتا ═══════════

import type { StyleId, Density } from './styles';
import type { CiteStyleId, SourceKind } from './citestyle';

export type Lang = 'ckb' | 'ar' | 'en';

/** ناسنامەی تەختەبەند */
export type LayoutId =
  | 'L_title' | 'L_outline' | 'L_bullets' | 'L_bulletsL' | 'L_text'
  | 'L_bar' | 'L_line' | 'L_donut' | 'L_hero' | 'L_two' | 'L_three'
  | 'L_steps' | 'L_time' | 'L_table' | 'L_compare' | 'L_kpi'
  | 'L_quote' | 'L_grid' | 'L_divider' | 'L_thanks' | 'L_refs'
  | 'L_def' | 'L_code' | 'L_proscons' | 'L_cycle' | 'L_pyramid'
  | 'L_venn' | 'L_flow' | 'L_state' | 'L_team' | 'L_progress'
  | 'L_icons' | 'L_ba';

/**
 * شێوەی ناوەڕۆکی سلایدێک — **چییە**، نەک چۆن دەردەکەوێت.
 *
 * ═══ بۆچی ئەمە لە `LayoutId` جیاوازە ═══
 * مۆدێل تەختەبەندی هەڵدەبژارد پێش ئەوەی بزانێت چەند دەق دەنووسێت،
 * و ناتوانێت پیکسڵ بپێوێت. ئێستا مۆدێل شێوەکە دەڵێت و کۆد
 * تەختەبەندەکە **بە پێوانە** هەڵدەبژێرێت. بڕوانە `deck/compose.ts`.
 */
export type Shape =
  | 'statement' | 'list' | 'compare2' | 'compareN' | 'process'
  | 'timeline' | 'figures' | 'quote' | 'definition' | 'data'
  | 'breakdown' | 'example' | 'divider';

/** ناوی خانەکانی ناو سلایدێک — ئێدیتەر بەمانە توخمەکان دەناسێتەوە */
export type SlotId =
  | 'title' | 'rule' | 'body' | 'image' | 'chart' | 'caption'
  | 'deco1' | 'deco2' | 'deco3' | 'deco4' | 'deco5' | 'card' | 'logo';

/** دەستکاری ئێدیتەر بۆ یەک خانە — هەرچی ناوێت null دەمێنێتەوە */
export interface SlotOverride {
  x?: number;  y?: number;          // پیکسڵ لە بۆشایی ١٩٢٠×١٠٨٠
  w?: number;  h?: number;
  color?: string;
  fontFamily?: string;
  fontSize?: number;                // پیکسڵ
  rotate?: number;                  // پلە
  hidden?: boolean;
  text?: string;                    // دەقی دەستکاریکراو
}

export interface ChartData {
  kind: 'bar' | 'line' | 'donut';
  labels: string[];
  values: number[];
  caption?: string;
  /** ئایا ژمارەکان لە AI ـەوە هاتوون یان بەکارهێنەر داویەتی */
  source: 'ai' | 'user';
}

export interface Reference {
  /**
   * ناسنامەی ناو دێککەکە — «s1»، «s2»…
   *
   * بەبێ ئەمە هیچ خاڵێکی سلاید نەیدەتوانی بڵێت «ئەم ئادعایە لەم
   * سەرچاوەیەوە هاتووە»، بۆیە لاپەڕەی سەرچاوەکان لیستێکی جیاواز
   * بوو کە پەیوەندی بە ناوەڕۆکەکەوە نەبوو. بڕوانە `deck/model.ts`.
   *
   * ئارەزوومەندانەیە — دێککی کۆن بەبێ ئەمە هێنراوە و کاردەکات.
   */
  id?: string;
  /** ڕستەی APA ی ئامادە — ئەوەی لەسەر سلایدەکە دەردەکەوێت */
  text: string;
  url?: string;
  domain?: string;

  /**
   * خانە پێکهاتەییەکان — تەنها ئەو سەرچاوانەیان هەیە کە لە
   * `find_papers` ـەوە هاتوون (واتە ڕاستەقینەن، C6).
   *
   * بەبێ ئەمانە ناتوانرێت BibTeX یان RIS دروست بکرێت: ئەو فۆرماتانە
   * خانەی جیاکراوەیان دەوێت، نەک یەک ڕستەی APA. سەرچاوەیەکی بەبێ
   * ئەمانە لە هەناردەکردنی .bib دا دەردەچێت — نەک بە داتای هەڵبەستراو
   * پڕ بکرێتەوە.
   */
  authors?: string[];
  year?: number;
  title?: string;
  venue?: string;
  doi?: string;

  /** جۆری سەرچاوە — شێوازی نووسینەکەی پێی جیاوازە.
   *  بەبێ ئەمە کتێبێک وەک گۆڤارێک دەنووسرێت. */
  kind?: SourceKind;
  publisher?: string;
  edition?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  isbn?: string;
}

/** توخمێکی زیادکراو لەسەر سلایدەکە — ئایکۆن، شێوە، یان دەقی ئازاد */
/** چوارچێوەی وێنە — هەمان بەها لە پێشبینین و لە PowerPoint دا */
export type Frame = 'none' | 'round' | 'circle' | 'square';

export interface SlideElement {
  id: string;
  kind: 'icon' | 'shape' | 'text' | 'image';
  /** ئایکۆن → ناسنامە · شێوە → ناسنامە · دەق → دەقەکە · وێنە → data: URI */
  value: string;
  /** تەنها وێنە — چوارچێوە و ڕەنگ و ئەستووری هێڵەکەی */
  frame?: Frame;
  borderColor?: string;
  borderWidth?: number;
  x: number; y: number; w: number; h: number;   // پیکسڵ لە ١٩٢٠×١٠٨٠
  rotate?: number;
  color?: string;                                // بەتاڵ = ڕەنگی پاشبنەما
  strokeWidth?: number;                          // تەنها ئایکۆن
  fontSize?: number;                             // تەنها دەق
  bold?: boolean;
  italic?: boolean;
  opacity?: number;
}

export function newElement(kind: SlideElement['kind'], value: string): SlideElement {
  const base = { id: Math.random().toString(36).slice(2, 10), kind, value, rotate: 0 };
  if (kind === 'icon')  return { ...base, x: 820, y: 440, w: 200, h: 200, strokeWidth: 2 };
  if (kind === 'shape') return { ...base, x: 800, y: 420, w: 240, h: 240 };
  if (kind === 'image') return { ...base, x: 660, y: 340, w: 600, h: 400, frame: 'round' };
  return { ...base, x: 700, y: 480, w: 520, h: 90, fontSize: 44 };
}

/**
 * جوڵاندنی توخمێک لە ڕیزبەندیدا.
 * ڕیزی لیستەکە = ڕیزی چینەکان: کۆتایی لیست = لە سەرەوەی هەمووان.
 */
export function reorder(list: SlideElement[], id: string,
                        to: 'front' | 'back' | 'forward' | 'backward'): SlideElement[] {
  const i = list.findIndex(e => e.id === id);
  if (i < 0) return list;
  const out = [...list];
  const [el] = out.splice(i, 1);
  const at = to === 'front'    ? out.length
           : to === 'back'     ? 0
           : to === 'forward'  ? Math.min(out.length, i + 1)
           :                     Math.max(0, i - 1);
  out.splice(at, 0, el);
  return out;
}

export interface Slide {
  id: string;
  /**
   * کام بەشی پێڕست ئەم سلایدە سەر بەوەیە — «sec2».
   *
   * ═══ ئەمە پێشتر فڕێدەدرا ═══
   * مۆدێل ژمارەی بەشەکەی دەنارد (`RawSlide.section`)، `generateSlides`
   * یەک جار بۆ ژمێردنی بەشە بەتاڵەکان بەکاریدەهێنا، **ئینجا
   * فڕێیدەدا**. دوای دروستکردن، دێککەکە نەیدەزانی کام سلاید سەر بە
   * کام بەشە — بۆیە لاپەڕەی ناوەڕۆک بەڵێنێک بوو کە هیچ شتێک
   * نەیدەتوانی بیپشکنێت.
   *
   * ئارەزوومەندانەیە: سلایدی سەرەتا و سوپاس و سەرچاوەکان سەر بە
   * هیچ بەشێک نین.
   */
  section?: string;
  /**
   * شێوەی ناوەڕۆک — مۆدێل ئەمە دەنێرێت، نەک `layout`.
   *
   * `layout` ئەنجامی پێوانەیە و دەکرێت بگۆڕدرێت (نموونە: کاتێک
   * وێنەکە نەهات). شێوەکە نامێنێت — ئەوە ئەو شتەیە کە ناوەڕۆکەکە
   * **هەیەتی**، بۆیە دوای هەر دەستکارییەک دەکرێت تەختەبەند
   * لەنوێ هەڵبژێردرێتەوە بەبێ لەدەستدانی مەبەستەکە.
   */
  shape?: Shape;
  layout: LayoutId;
  title: string;
  /** خاڵەکان — دەکرێت «ناونیشان: ڕوونکردنەوە» بێت */
  bullets: string[];
  body?: string;
  notes?: string;

  imageUrl?: string;                // data: URI
  imagePrompt?: string;
  /** خاوەن و مۆڵەتی وێنەکە — وێنەی Creative Commons بەبێ ئەمە بەکارناهێنرێت.
   *  دەبێت لە سلایدەکەدا بەدیار بێت، نەک تەنها لە تێبینییەکاندا. */
  imageCredit?: string;

  chart?: ChartData;
  table?: { head: string[]; rows: string[][] };
  steps?: { n: string; h: string; p: string }[];
  timeline?: { y: string; c: string }[];
  kpis?: { v: string; k: string }[];
  quote?: { text: string; by: string };
  pros?: string[];
  cons?: string[];
  refs?: Reference[];

  /**
   * ناسنامەی ئەو سەرچاوانەی ئەم سلایدە پشتی پێیان بەستووە — «s1»…
   *
   * ═══ ئەمە ئەو بەستەرەیە کە نەبوو ═══
   * پێشتر لاپەڕەی سەرچاوەکان لیستێکی گشتی بوو و هیچ سلایدێک
   * نەیدەزانی کام تۆماری بەکارهێناوە. بۆیە لاپەڕەکە دەیتوانی
   * سەرچاوەیەک پیشان بدات کە هیچ شوێنێک بەکارنەهاتووە — و ئەوە
   * یەکەم شتە مامۆستا دەیپشکنێت.
   *
   * تەنها ناسنامەی **هێنراو** لێرەدا دەمێنێتەوە. بڕوانە `toSlide`.
   */
  cites?: string[];

  /** ئایکۆن، شێوە و دەقی زیادکراو کە بەکارهێنەر داینابێت */
  elements?: SlideElement[];

  overrides: Partial<Record<SlotId, SlotOverride>>;
}

/**
 * بەشێکی پێڕست، وەک لە دێککەکەدا خەزن دەکرێت.
 *
 * ═══ بۆچی دەبێت خەزن بکرێت ═══
 * `Slide.section` ناسنامەیەک هەڵدەگرێت («sec2»)، بەڵام هیچ شوێنێک
 * نەبوو کە ئەو ناسنامەیە بە ناوێکەوە ببەستێتەوە دوای دروستکردن.
 * ئەنجام: پشکنینی بۆشایی **تەنها یەک جار** لە `Wizard` دا دەڕۆیشت
 * و لە ستودیۆدا هەرگیز — چونکە `verifyDeck(deck)` بەشەکانی نەبوو.
 *
 * ئێستا دەمێننەوە، بۆیە بەستەرەکە دوای پاشەکەوت و کردنەوەشدا
 * هێشتا دەپشکندرێت.
 */
export interface DeckSection {
  id: string;
  title: string;
  hint: string;
  /** ئەو سەرچاوانەی سلایدەکانی ئەم بەشە ئاماژەیان پێداوە */
  sources: string[];
}

export interface TitleInfo {
  university: string;
  institute: string;
  department: string;
  title: string;
  year: string;
  teacherPrefix: string;
  teacherName: string;
  students: string[];
  logoUrl?: string;                 // data: URI
}

/**
 * بەشی یەک خوێندکار لە پێشکەشکردنێکی گرووپیدا.
 *
 * `from` و `to` ژمارەی ئەو سلایدانەن کە **بەکارهێنەر دەیانبینێت** —
 * واتە ١ = لاپەڕەی سەرەتا، ٢ = ناوەڕۆک، دواتر سلایدەکانی ناوەڕۆک،
 * و لە کۆتاییدا سوپاس و سەرچاوەکان.
 *
 * ئەمە بە ئەنقەست وایە: خوێندکار دەڵێت «سارا ١–٥»، و ئەو ژمارانە
 * ئەوانەن کە لە ستودیۆدا دەیانبینێت. لە `deck.slides` دا نمرەی
 * سلاید n دەکاتە `slides[n - 2]` (چونکە لاپەڕەی سەرەتا لە
 * `slides` دا نییە — بڕوانە `idx = -1` لە Studio).
 */
export interface Speaker {
  name: string;
  /** یەکەم سلاید — ١-بنەڕەت، وەک بەکارهێنەر دەیبینێت */
  from: number;
  /** دواهەمین سلاید — لەخۆدەگرێت */
  to: number;
  /** کاتی قسەکردن بە خولەک */
  minutes: number;
}

export interface Deck {
  id: string;
  createdAt: number;
  updatedAt: number;
  lang: Lang;
  theme: string;                    // ناسنامەی پاشبنەما (ڕەنگ)
  /** ناسنامەی شێواز (پێکهاتە) — بەتاڵ = 'glass'، بۆ دێککی کۆن */
  style?: StyleId;
  /** چڕی دەق — بەتاڵ = 'normal' */
  density?: Density;
  /** شێوازی سەرچاوەنووسین — بەتاڵ = 'apa'.
   *  دەپارێزرێت تاکو دوای دروستکردنیش بگۆڕدرێت، چونکە خانە
   *  پێکهاتەییەکانی سەرچاوەکان دەمێننەوە. */
  citeStyle?: CiteStyleId;
  /** جۆری ئەو سەرچاوانەی داوا کراون — بەتاڵ = 'paper' */
  refKind?: SourceKind;

  /**
   * ئەو دەقەی خوێندکار خۆی نووسیویەتی و پێشکەشی دەکات.
   *
   * تەنها بۆ دروستکردنی سلایدەکان بەکاردێت — **ناچێتە ناو تێبینی
   * قسەکەرەوە**. بەکارهێنەر داوای سلایدی پاک و بێ دەقی شاراوەی کرد.
   * دەپارێزرێت تاکو دواتر بتوانرێت لەنوێ دروست بکرێتەوە.
   */
  script?: string;
  /** دابەشکردنی سلایدەکان بەسەر خوێندکاراندا */
  speakers?: Speaker[];
  /** کۆی کاتی پێشکەشکردن بە خولەک */
  totalMinutes?: number;
  /**
   * بەڵگەی سەرەکی — ئەو یەک شتەی دێککەکە دەیسەلمێنێت.
   *
   * مۆدێل ئەمە **پێش** سلایدەکان دەنووسێت، بۆیە هەموویان لەسەری
   * دروست دەبن. دەپارێزرێت تاکو یاریدەدەری ستودیۆش لە کاتی
   * دەستکاریدا هەمان خەت بپارێزێت.
   */
  thesis?: string;

  fontFamily: string;
  titleInfo: TitleInfo;
  /** بەشەکانی پێڕست — بڕوانە `DeckSection` */
  sections?: DeckSection[];
  slides: Slide[];
  /** شێوازی Morph — سلایدەکان ناوەڕۆک کۆدەکەنەوە و بە نەرمی دەجوڵێن */
  buildMode: boolean;
  transitionMs: number;
}

/** کلیلەکان — تەنها لە وێبگەڕی بەکارهێنەردا دەمێننەوە */
export interface Keys {
  gemini: string;
  openai: string;
  imageProvider: 'gemini' | 'openai';
  textProviderEn: 'gemini' | 'openai';
}

export const emptyOverrides = (): Slide['overrides'] => ({});

/**
 * سلاید بۆ تەختەبەندێکی نوێ دەگوازێتەوە.
 *
 * شوێن و قەبارە هی تەختەبەندەکەن، نەک هی سلایدەکە. ئەگەر بەکارهێنەر وێنەیەکی
 * جوڵاندبێت لە «خاڵ + وێنە» و ئینجا بیگۆڕێت بۆ «چارتی ستوونی»، ئەو شوێنە
 * لە تەختەبەندی نوێدا هیچ مانایەکی نییە — توخمەکە دەکەوێتە دەرەوەی سلاید.
 *
 * بۆیە پێوانەکان دەسڕدرێنەوە، بەڵام ئەوەی بەکارهێنەر بە ئەنقەست هەڵیبژاردووە
 * (دەق، ڕەنگ، فۆنت، شاردنەوە) دەمێنێتەوە.
 */
export function retarget(slide: Slide, layout: LayoutId): Slide {
  const kept: Slide['overrides'] = {};

  for (const [slot, o] of Object.entries(slide.overrides ?? {})) {
    if (!o) continue;
    const { x: _x, y: _y, w: _w, h: _h, rotate: _r, ...rest } = o;
    // ئەگەر تەنها پێوانە تێدابوو، هیچ نامێنێتەوە — خانەکە نەخشەی نوێ وەردەگرێت
    if (Object.keys(rest).length) kept[slot as SlotId] = rest;
  }

  return { ...slide, layout, overrides: kept };
}

export function newSlide(layout: LayoutId, title = ''): Slide {
  return {
    id: Math.random().toString(36).slice(2, 10),
    layout, title, bullets: [], overrides: emptyOverrides(),
  };
}
