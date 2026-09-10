// ═══════════ تیمی ئەیجێنت — جۆرەکان و پەیماننامە ═══════════
//
// ─── کێشەی ڕێڕەوی کۆن ───
// دێککەکە بە **یەک** بانگکردن دەنووسرا. ئەوە بۆ ڕەشەبا و کۆهێرێنسی
// باش بوو، بەڵام واتای ئەوەش بوو کە هەموو بڕیارێک لە یەک ساتدا
// دەدرا: بەڵگە، پێکهاتە، ناوەڕۆکی هەر بەشێک، دووبارەنەبوونەوە،
// وێنە و ئاماژە — هەموویان تێکەڵ. هیچ قۆناغێک نەبوو کە بتوانێت
// ئەوەی پێشتر نووسراوە **بخوێنێتەوە و ڕەتی بکاتەوە**.
//
// ─── چارەسەرەکە ───
// یەک `Draft` هەیە و ئەیجێنتەکان بە ڕیز بەسەریدا تێدەپەڕن. هەر
// یەکێکیان یەک کاری دیاریکراو دەکات و ئەوەی پێشووی دەبینێت:
//
//   architect  بەڵگە و جۆری پێشکەشکردن
//   linker     پەیمانی هەر بەشێک — چی دەسەلمێنێت، چی **نا**
//   librarian  سەرچاوە ڕاستەقینەکان، و دابەشکردنیان بەسەر بەشەکاندا
//   writer     سلایدەکانی هەر بەشێک — بەشێک بە بانگکردنێک
//   editor     دووبارەبوونەوە
//   curator    ڕیزبەندی، ژمارە، ناونیشان
//   visual     کام سلاید وێنەی دەوێت، و هێنانیان
//   critic     خوێندنەوەی هەموو دێککەکە و دیاریکردنی کێشەکان
//   polish     چاککردنەوەی ئەوانەی نەقەندران
//   verifier   پێوان و پشکنینی کۆتایی (بێ مۆدێل)
//
// ─── یاسای زێڕین ───
// **هیچ قۆناغێک ناتوانێت دێککەکە بکوژێت.** ئەگەر یەکێکیان شکستی
// هێنا، مسۆگەرەکەی پێشوو وەک خۆی دەمێنێتەوە و ئاگادارییەک بۆ
// بەکارهێنەر تۆمار دەکرێت. بۆیە تەنانەت کلیلێکی سنووردار هێشتا
// دێککێک دەردەهێنێت.

import type { Lang, Reference, Slide, Speaker } from '../types';
import type { Id, Section } from '../deck/model';
import type { OutlineItem } from '../research';
import type { Paper, OnSource } from '../tools/academic';
import type { ProviderId } from '../providers';
import type { Density } from '../styles';
import type { CiteStyleId, SourceKind } from '../citestyle';
import type { GroundingSource } from '../llm';
import type { SearchEngine } from '../tools/data';

/** ناسنامەی قۆناغەکان — ڕیزبەندییەکەیان لە `run.ts` دایە */
export type StageId =
  | 'architect' | 'linker' | 'librarian' | 'writer' | 'editor'
  | 'curator' | 'visual' | 'critic' | 'polish' | 'verifier';

/** دۆخی قۆناغێک لە کاتی کارکردندا */
export type StageState = 'run' | 'ok' | 'skip' | 'fail';

export interface StageReport {
  id: StageId;
  /** ناوی کوردی — بۆ پیشاندان بە بەکارهێنەر */
  label: string;
  state: StageState;
  /** وردەکاری — «٧ بەش نووسرا» یان هۆکاری شکستەکە */
  detail?: string;
  /** ٠–١٠٠ — بۆ شریتی پێشکەوتن */
  pct: number;
}

/**
 * پەیمانی یەک بەش — بەرهەمی `linker`.
 *
 * ═══ ئەمە ئەو شتەیە کە دووبارەبوونەوە ڕێگری لێدەکات ═══
 * پێشتر پرۆمپتەکە دەیوت «هەر شتێک یەک جار بڵێ» و بەس. ئەوە
 * داواکارییەکی شێوازییە کە **ناپشکنرێت**، بۆیە جێبەجێ نەدەکرا.
 *
 * ئێستا هەر ئادعایەک خاوەنێکی هەیە: `covers` ئەو شتانەن کە ئەم
 * بەشە **خۆی** دەیانڵێت، و `avoid` ئەوانەن کە بەشەکانی تر
 * خاوەنیانن. نووسەری هەر بەشێک هەردوو لیستەکە دەبینێت، بۆیە
 * دووبارەبوونەوە نەک قەدەغەیە — **شوێنی نییە**.
 *
 * ئاگاداری: `avoid` **لە کۆدەوە** دەردەهێنرێت (`deriveAvoid`)، نەک
 * لە مۆدێلەوە. مۆدێل ناتوانێت لیستێک بنووسێت کە دژی لیستەکانی
 * تری خۆی نەبێت — و ئەگەر هەوڵ بدات، دەبێتە دووبارەکردنەوەیەکی
 * درێژ لە هەر پرۆمپتێکدا.
 */
export interface Brief {
  id: Id;
  /** ژمارەی بەشەکە لە پێڕستدا — ١-بنەڕەت */
  n: number;
  title: string;
  hint: string;
  /** ئەو شتەی ئەم بەشە دەیسەلمێنێت — یەک ڕستە */
  establishes: string;
  /** ئەوەی خوێنەر پێشتر دەیزانێت، لە بەشەکانی پێشووەوە */
  dependsOn: string;
  /** ئادعا دیاریکراوەکانی ئەم بەشە — سێ تا شەش */
  covers: string[];
  /** ئادعای بەشەکانی تر — لێرەدا قەدەغەن. لە کۆدەوە دەردەهێنراوە. */
  avoid: string[];
  /** ژمارەی سلایدی ئەم بەشە — کۆیان `slideCount` ـە */
  slides: number;
  /** ناسنامەی سەرچاوەکان — «s1»، «s3»… بڕوانە `Draft.papers` */
  sources: Id[];
}

/**
 * ئەو دێککەی لەژێر کاردایە.
 *
 * هەر قۆناغێک وەشانێکی نوێی دەگەڕێنێتەوە — هەرگیز شتێک لە
 * جێی خۆیدا ناگۆڕدرێت، تاکو شکستی قۆناغێک نەتوانێت وەشانی
 * پێشووی تێک بدات.
 */
export interface Draft {
  topic: string;
  lang: Lang;
  /** بەڵگەی سەرەکی — `architect` دەینووسێت، پێش هەموو سلایدێک */
  thesis: string;
  /** جۆری پێکهاتەی پێشکەشکردنەکە — mechanism · narrative · case-study … */
  kind: string;
  /**
   * ئەوەی ئەم دێککە دەیکات و دێککێکی گشتی ناینەکات.
   *
   * جیایە لە `thesis` چونکە `thesis` دەچێتە ناو دێککەکەوە و
   * بەکارهێنەر دەیبینێت؛ ئەمە تەنها ڕێنمایی ناوخۆییە بۆ نووسەرەکان.
   */
  angle: string;
  outline: OutlineItem[];
  sections: Section[];
  briefs: Brief[];
  /**
   * سەرچاوە هێنراوەکان، بە ڕیز.
   *
   * ناسنامەی `papers[i]` هەمیشە `mkId('s', i)` ـە. ئەمە هەمان
   * پەیمانی `generate.ts` و `Wizard` ـە — بۆیە `Slide.cites` و
   * لاپەڕەی سەرچاوەکان بەبێ نەخشەیەکی زیادە دەبەسترێنەوە.
   */
  papers: Paper[];
  /** هەمان لیست، بەڵام وەک ڕستەی نووسراوی شێوازەکە */
  refs: Reference[];
  slides: Slide[];
  /** ئاگاداری بۆ بەکارهێنەر — لە کۆتاییدا پیشان دەدرێن */
  notes: string[];
}

export interface CrewOpts {
  key: string;
  provider: ProviderId;
  model: string;

  topic: string;
  lang: Lang;
  /** «Kurdish Sorani» · «Arabic» · «English» — بۆ پرۆمپتەکان */
  langName: string;
  outline: OutlineItem[];
  slideCount: number;
  applyHumanizer: boolean;
  density?: Density;
  citeStyle?: CiteStyleId;
  refKind?: SourceKind;

  /** سەرچاوەکانی گەڕانی ئینتەرنێت لە قۆناغی پێڕستەوە */
  webSources?: GroundingSource[];
  /** دەقی خۆنووسراوی خوێندکار — ئەگەر هەبێت، سەرچاوەی سەرەکییە */
  script?: string;
  speakers?: Speaker[];
  contentStart?: number;

  /** وێنە دابنرێت؟ */
  images: boolean;
  imageProvider?: ProviderId;
  imageKey?: string;

  /** مەکینەی گەڕان بۆ ماڵپەڕە فەرمییەکان */
  engine?: SearchEngine;
  engineKey?: string;

  signal?: AbortSignal;

  /** دۆخی قۆناغەکان — ڕووکار بەمە شریتەکە و لیستەکە نوێ دەکاتەوە */
  onStage?: (r: StageReport) => void;
  /** سلایدەکان هەر کاتێک نوێ بوونەوە — بۆ پیشاندانی زیندوو */
  onSlides?: (slides: Slide[]) => void;
  /** بەڵگەکە، هەر کە نووسرا */
  onThesis?: (thesis: string) => void;
  /** پەیامێکی کورت بۆ ژێر شریتەکە */
  onNote?: (note: string) => void;
  /** وەڵامی هەر داتابەیسێکی زانستی */
  onSource?: OnSource;
  /** سنووری ڕێژە — چاوەڕوانی دەکرێت */
  onWait?: (ms: number) => void;
}

export interface CrewResult {
  /** سلایدەکانی ناوەڕۆک — پێواندراو و ئامادە */
  slides: Slide[];
  thesis: string;
  /** بۆ لاپەڕەی سەرچاوەکان — بە ناسنامەوە */
  refs: Reference[];
  sections: Section[];
  /** بەشەکانی پێڕست کە هیچ سلایدێکیان بۆ نەنووسرا */
  uncovered: string[];
  /** ئاگادارییەکان — هەموویان پێکەوە پیشان دەدرێن */
  notes: string[];
  /** شوێنپێی قۆناغەکان — بۆ پیشاندان و بۆ تاقیکردنەوە */
  trace: StageReport[];
}

/**
 * وەستاندن — بەڵام وەک هەڵەیەکی ناسراو.
 *
 * `run.ts` هەموو هەڵەیەکی قۆناغێک دەگرێت و بەردەوام دەبێت. بەڵام
 * وەستاندنی بەکارهێنەر **نابێت** وا مامەڵەی لەگەڵ بکرێت — ئەگەر
 * بکرێت، ئەیجێنتی دواتر دەست پێدەکات و بەکارهێنەر چاوەڕێی
 * ١٥ بانگکردنی تر دەکات کە هەموویان دەشکێن.
 */
export class Stopped extends Error {
  constructor() {
    super('دروستکردنەکە وەستێنرا.');
    this.name = 'Stopped';
  }
}

/** ئایا ئەم هەڵەیە وەستاندنە؟ — هەر سێ سەرچاوەکەی دەگرێتەوە */
export const isStop = (e: unknown, signal?: AbortSignal): boolean =>
  e instanceof Stopped
  || !!signal?.aborted
  || (e as Error)?.name === 'AbortError';
