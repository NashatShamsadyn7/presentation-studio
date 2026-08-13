// ═══════════ شێوازەکانی دیزاین ═══════════
//
// پاشبنەما (`themes.ts`) تەنها **ڕەنگ** دەگۆڕێت. شێواز ئەوەیە کە
// **پێکهاتەکە** دەگۆڕێت: کارت هەیە یان نا، ڕەنگی سەرەکی لە کوێدایە،
// ناونیشان چۆنە، خاڵەکان بە چ نیشانەیەکن، پاشبنەما چەند ڕازاوەیە.
//
// بۆیە یەک پاشبنەمای ڕەنگ × شەش شێواز = شەش دێککی جیاواز.
//
// ─── بۆچی ناوچەی ناوەڕۆک نەگۆڕە؟ ───
// هەر ٣٣ تەختەبەندەکە شوێنی خۆیان لە `CARD` ـەوە دەژمێرن، لە هەردوو
// لادا. ئەگەر هەر شێوازێک چوارچێوەیەکی جیاوازی هەبێت، هەموو ئەو
// ژمێردنانە دەبێت دووبارە پشکنین بکرێن بۆ شەش حاڵەت. لەبری ئەوە
// چوارچێوەکە یەکە و تەنها ئەوەی بەدەوریدایە دەگۆڕێت — کە ئەوەیە
// چاو دەیبینێت.

export type StyleId =
  | 'glass' | 'edge' | 'band' | 'frame' | 'paper' | 'plain'
  | 'mono' | 'studio' | 'thesis' | 'poster' | 'note' | 'grid';

/** نیشانەی خاڵ — کۆدی Unicode هەم بۆ CSS و هەم بۆ PowerPoint */
export type BulletKind = 'dot' | 'dash' | 'square' | 'arrow' | 'ring' | 'num';

/** شێوازی سلایدی «ناوەڕۆک» */
export type OutlineKind = 'circles' | 'rows' | 'cards' | 'rail';

export interface StylePack {
  id: StyleId;
  name: string;                       // کوردی
  desc: string;
  /** پێکهاتەی ناوەندی سلاید */
  card: 'glass' | 'solid' | 'outline' | 'none';
  /** ڕەنگی سەرەکی لە کوێ دەردەکەوێت */
  accent: 'rule' | 'edge' | 'band' | 'twin' | 'side' | 'none';
  titleItalic: boolean;
  /** ڕێژەی ڕوونی ڕازاندنەوەکان — ٠ = هیچ */
  deco: number;
  bullet: BulletKind;
  outline: OutlineKind;
}

export const STYLES: StylePack[] = [
  { id: 'glass',
    name: 'شووشە',
    desc: 'کارتی شووشەیی، ناونیشانی لار، شێوەی ڕازاوە. دیزاینی بنەڕەت.',
    card: 'glass', accent: 'rule', titleItalic: true, deco: 1,
    bullet: 'dot', outline: 'circles' },

  { id: 'edge',
    name: 'لێوار',
    desc: 'بەبێ کارت — هێڵێکی ئەستووری ڕەنگاوڕەنگ لە لێواری سلاید.',
    card: 'none', accent: 'edge', titleItalic: false, deco: .55,
    bullet: 'dash', outline: 'rows' },

  { id: 'band',
    name: 'تەریق',
    desc: 'تەریقێکی ڕەق لە سەرەوە، ناونیشان بە سپی لەسەری.',
    card: 'none', accent: 'band', titleItalic: false, deco: .4,
    bullet: 'square', outline: 'cards' },

  { id: 'frame',
    name: 'چوارچێوە',
    desc: 'چوارچێوەیەکی باریک، ناونیشان لە ناوەڕاست لەنێوان دوو هێڵدا.',
    card: 'outline', accent: 'twin', titleItalic: true, deco: .7,
    bullet: 'ring', outline: 'rail' },

  { id: 'paper',
    name: 'پەڕە',
    desc: 'پەڕەیەکی ڕەق بە گۆشەی تیژ — وەک لاپەڕەی توێژینەوە.',
    card: 'solid', accent: 'side', titleItalic: false, deco: .25,
    bullet: 'num', outline: 'rows' },

  { id: 'plain',
    name: 'سادە',
    desc: 'هیچ ڕازاندنەوەیەک — تەنها دەق. باشترینە بۆ پڕۆجێکتەری لاواز.',
    card: 'none', accent: 'none', titleItalic: false, deco: .18,
    bullet: 'dash', outline: 'rows' },

  // ─── شەش شێوازی زیادکراو ───
  //
  // هەموویان لە هەمان بنەمایە دروست کراون کە شەشە یەکەمەکە:
  // `card` و `accent` تەنها ئەو بەهایانە وەردەگرن کە pptx.ts
  // پێشتر دەیانناسێت. واتە هەناردەکردن بەبێ هیچ کارێکی زیادە
  // دروستە، و پێشبینین و فایلی PowerPoint هەمان شت دەڵێن (§٨).
  //
  // ئەگەر جۆرێکی نوێی `card` یان `accent` زیاد بکرێت، دەبێت
  // pptx.ts ـیش بزانێت — ئەگەرنا سلایدەکە لە PowerPoint دا
  // جیاواز دەردەکەوێت.

  { id: 'mono',
    name: 'ڕەق',
    desc: 'بێ کارت، بێ ڕازاندنەوە، هێڵێکی باریک لە کەنارەوە. ئەندازیاری.',
    card: 'none', accent: 'side', titleItalic: false, deco: 0,
    bullet: 'arrow', outline: 'rail' },

  { id: 'studio',
    name: 'ستودیۆ',
    desc: 'تەریقی سەرەوە لەگەڵ کارتی شووشەیی — ڕوونترین جیاوازی نێوان سەر و ناوەڕۆک.',
    card: 'glass', accent: 'band', titleItalic: true, deco: .85,
    bullet: 'ring', outline: 'cards' },

  { id: 'thesis',
    name: 'نامە',
    desc: 'چوارچێوەی باریک، خاڵی ژمارەدار، کەمترین ڕازاندنەوە. وەک نامەی ماستەر.',
    card: 'outline', accent: 'rule', titleItalic: false, deco: .12,
    bullet: 'num', outline: 'rows' },

  { id: 'poster',
    name: 'پۆستەر',
    desc: 'کارتی ڕەق و لێواری ئەستوور — بۆ هۆڵی گەورە و دوورەوە.',
    card: 'solid', accent: 'edge', titleItalic: true, deco: 1,
    bullet: 'square', outline: 'circles' },

  { id: 'note',
    name: 'تێبینی',
    desc: 'کارتی ڕەق بەبێ هیچ ڕەنگێکی سەرەکی — ئارام و بێدەنگ.',
    card: 'solid', accent: 'none', titleItalic: false, deco: .3,
    bullet: 'dot', outline: 'rail' },

  { id: 'grid',
    name: 'تۆڕ',
    desc: 'چوارچێوە لەگەڵ تەریقی سەرەوە — پێکهاتەیەکی ڕوونی ئەندازەیی.',
    card: 'outline', accent: 'band', titleItalic: false, deco: .5,
    bullet: 'dash', outline: 'cards' },
];

export const styleById = (id: string): StylePack =>
  STYLES.find(s => s.id === id) ?? STYLES[0];

/**
 * کۆدی نیشانەی خاڵ بۆ PowerPoint — بە شێوەی hex بەبێ `U+`.
 * `num` جیاوازە: PowerPoint لیستی ژمارەیی خۆی هەیە.
 */
export const BULLET_CODE: Record<Exclude<BulletKind, 'num'>, string> = {
  dot:    '25CF',   // ●
  dash:   '2013',   // –
  square: '25A0',   // ■
  arrow:  '25B8',   // ▸
  ring:   '25CB',   // ○
};

/** هەمان نیشانەکان بۆ CSS — لە `li::before` دا دەنووسرێن */
export const BULLET_CHAR: Record<BulletKind, string> = {
  dot: '●', dash: '–', square: '■', arrow: '▸', ring: '○', num: '',
};

// ─────────── چڕی دەق ───────────
//
// «کورت» و «درێژ» تەنها ژمارەی وشە نین — کاریگەرییان لەسەر ئەوەشە
// کە مۆدێل چەند خاڵ دەنووسێت و فۆنت چەند گەورە دەبێت.

export type Density = 'short' | 'normal' | 'long';

export interface DensitySpec {
  id: Density;
  name: string;
  /** ڕێنمایی بۆ مۆدێل */
  hint: string;
  /** سنووری وشە بۆ هەر خاڵێک */
  words: [number, number];
  /** ژمارەی خاڵی پێشنیارکراو بۆ سلایدێکی ئاسایی */
  points: [number, number];
  /** ڕێژەی قەبارەی فۆنت — دەقی کورت گەورەتر دەنووسرێت */
  scale: number;
}

export const DENSITIES: DensitySpec[] = [
  { id: 'short',  name: 'کورت',
    hint: 'Keep every bullet to a short phrase of 4-9 words. No sub-clauses. The slide is a cue card, not a paragraph.',
    words: [4, 9],   points: [3, 4], scale: 1.16 },

  { id: 'normal', name: 'ئاسایی',
    hint: 'Each bullet is one complete sentence of 10-18 words.',
    words: [10, 18], points: [3, 5], scale: 1 },

  { id: 'long',   name: 'درێژ',
    hint: 'Each bullet may run 18-32 words and carry a supporting detail, figure, or example. Prefer the form "Label: explanation".',
    words: [18, 32], points: [4, 6], scale: .88 },
];

export const densityById = (id: string): DensitySpec =>
  DENSITIES.find(d => d.id === id) ?? DENSITIES[1];
