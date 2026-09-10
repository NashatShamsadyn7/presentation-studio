// ═══════════ شێوەکانی پاشبنەما — کۆرێۆگرافی Morph ═══════════
//
// Morph چۆن کاردەکات: PowerPoint شێوەکانی دوو سلایدی یەک لەدوای یەک
// بەیەکەوە دەبەستێتەوە بە ناو (option="byObject"). ئەگەر شێوەیەک لە
// هەردووکیاندا هەبێت، لە نێوانیاندا دەجوڵێت — شوێن، قەبارە، خولانەوە،
// **و تەنانەت جۆری شێوەکەش**. سێگۆشەیەک دەبێتە شەشگۆشە بە نەرمی.
//
// سێ بنەمای ئەم فایلە:
//
//   ١) گەشت — هەر شێوەیەک لە دەرەوەی سلایدەوە دێت، تێدەپەڕێت، دەڕوات.
//      لە هەموو سلایدەکاندا هەیە (بۆیە Morph دەیجوڵێنێت)، بەڵام تەنها
//      لە ماوەی خۆیدا بەدیارە.
//
//   ٢) قووڵایی — شێوەی نزیک خێراتر دەجوڵێت لە شێوەی دوور (parallax).
//      ئەمە هەستی قووڵایی دەدات، وەک کامێرایەک بەناو شوێنێکدا بڕوات.
//
//   ٣) گۆڕانی شێوە — هەندێک شێوە جۆریان دەگۆڕێت بەپێی سلاید.
//      Morph ئەو گۆڕانە بە نەرمی دەکات، نەک بە قەڵشتن.

/** جۆرەکانی شێوە — هەریەکە هەم لە CSS و هەم لە PowerPoint دا هەیە */
export type DecoKind =
  | 'circle' | 'round' | 'triangle' | 'diamond' | 'hexagon'
  | 'pentagon' | 'star' | 'blob' | 'chevron' | 'arrow' | 'arc';

export interface DecoShape {
  /** ناوێکی جێگیر — Morph شێوەکان بەمە دەناسێتەوە */
  name: string;
  kind: DecoKind;
  x: number; y: number; size: number;
  tone: '--pri' | '--pri-soft' | '--acc';
  opacity: number;
  rotate: number;
}

const W = 1920, H = 1080;

interface Seed {
  /** جۆرەکان بەپێی ڕیز — Morph لە نێوانیاندا دەگۆڕێت */
  kinds: DecoKind[];
  size: number;
  tone: DecoShape['tone'];
  opacity: number;
  /** ٠ = دوور و هێواش · ١ = نزیک و خێرا (parallax) */
  depth: number;
  /** لە کام سلایدەوە دەستی بە هاتن کرد */
  enter: number;
  /** چەند سلاید لەسەر شاشە دەمێنێتەوە */
  stay: number;
  /** ڕێڕەوی سێ قۆناغی: لە دەرەوە → شوێنی خۆی → دەرەوەی لایەکی تر */
  from: [number, number];
  at: [number, number];
  out: [number, number];
  spin: number;
}

// شوێنەکان بە ڕێژەی قەبارەی سلاید. ٠–١ = لەناو سلایددا.
// دەرەوەی ئەو مەودایە = بەدەر، واتە نادیار — بەڵام هێشتا هەیە،
// بۆیە Morph دەتوانێت بیجوڵێنێت.
const SEEDS: Seed[] = [
  { kinds: ['diamond', 'hexagon'],  size: 320, tone: '--acc',      opacity: .52, depth: .9, enter: -1, stay: 4,
    from: [ .58, -.46], at: [ .52,  .04], out: [ .46,  1.18], spin:  46 },
  { kinds: ['circle'],              size: 170, tone: '--pri-soft', opacity: .85, depth: 1,  enter: -1, stay: 5,
    from: [-.22,  .40], at: [ .04,  .52], out: [ 1.16,  .66], spin:   0 },
  { kinds: ['round', 'blob'],       size: 300, tone: '--acc',      opacity: .66, depth: .5, enter: -1, stay: 6,
    from: [-.26,  .68], at: [ .01,  .78], out: [-.30,   .94], spin: -34 },
  { kinds: ['hexagon', 'circle'],   size: 210, tone: '--pri',      opacity: .44, depth: .3, enter: 2, stay: 3,
    from: [1.18,  .06], at: [ .84,  .12], out: [-.26,   .22], spin:  58 },
  { kinds: ['triangle', 'chevron'], size: 240, tone: '--acc',      opacity: .58, depth: .8, enter: 3, stay: 3,
    from: [1.26,  .78], at: [ .80,  .70], out: [ .34,   1.22], spin: -72 },
  { kinds: ['circle', 'star'],      size: 150, tone: '--pri',      opacity: .52, depth: 1,  enter: 4, stay: 4,
    from: [ .26, 1.22], at: [ .32,  .74], out: [ .40,  -.28], spin:   0 },
  { kinds: ['star', 'pentagon'],    size: 190, tone: '--acc',      opacity: .48, depth: .6, enter: 5, stay: 3,
    from: [ .96, 1.24], at: [ .72,  .80], out: [ 1.24,  .30], spin:  90 },
  { kinds: ['pentagon', 'arrow'],   size: 200, tone: '--pri-soft', opacity: .50, depth: .4, enter: 6, stay: 3,
    from: [-.26,  .08], at: [ .06,  .16], out: [ .52,  -.30], spin:  40 },
  { kinds: ['blob', 'arc'],         size: 270, tone: '--acc',      opacity: .56, depth: .7, enter: 7, stay: 4,
    from: [1.24,  .36], at: [ .86,  .40], out: [ 1.28,  .82], spin:  26 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * ڕوونی شێوەکان — بە دوو خانەی دەیی، و هەرگیز سفر.
 *
 * بە خولکردنی یەک خانە، شێوازی «سادە» (چڕی ٠.١٨) هەندێک شێوەی
 * دەگەیاندە ٠.٠ — واتە بەتەواوی نەدەبینران. ئەوە دوو کێشەی دەخولقاند:
 * شێوازەکە شێوەی لێ ون دەبوو، و گرنگتر، Morph شێوەیەکی نەدەما کە
 * لە نێوان سلایدەکاندا بیجوڵێنێت.
 */
const opac = (n: number) => Math.max(0.04, Math.round(n * 100) / 100);

/**
 * جوڵەی کامێرا — پانێکی هێواش بەسەر هەموو پێشکەشکردنەکەدا.
 *
 * هەموو شێوەکان پێکەوە کەمێک دەجوڵێن، بۆیە گواستنەوەکان وەک یەک
 * جوڵەی بەردەوامی کامێرا دەردەکەون، نەک وەک سلایدی جیاواز.
 * شێوەی نزیک زیاتر دەجوڵێت لە شێوەی دوور — ئەوە parallax ـە.
 */
function camera(index: number, depth: number): [number, number] {
  const t = index * 0.5;
  return [Math.sin(t * 0.7) * 62 * depth, Math.cos(t * 0.55) * 38 * depth];
}

/**
 * شێوەکان بۆ سلایدی ژمارە `index` (لاپەڕەی سەرەتا = ٠).
 * ئەنجامەکە دووبارەبووەوەیە: هەمان ژمارە هەمان شێوەکان.
 *
 * `intensity` ڕوونی شێوەکان دەگۆڕێت (شێوازی «سادە» = ٠.١٨).
 * شێوەکان هەرگیز بەتەواوی لانابرێن — Morph پێویستی بەوانە هەیە
 * تا شتێکی هەبێت کە بیجوڵێنێت لە نێوان سلایدەکاندا.
 */
export function decoFor(index: number, intensity = 1): DecoShape[] {
  return SEEDS.map((s, k) => {
    // ─── لە کوێی گەشتەکەدایە؟ ───
    //   p < 0        هێشتا نەهاتووە   → لەسەر `from` دەوەستێت
    //   0 ≤ p < 1    دێتە ژوورەوە     → from → at
    //   1 ≤ p < 1+stay  لەسەر شاشەیە  → لە دەوری `at` هێواش دەجوڵێت
    //   p ≥ 1+stay   دەڕوات           → at → out
    const p = index - s.enter;
    let pos: [number, number];
    let phase: number;                          // ٠–١ بۆ هەڵبژاردنی شێوە

    if (p < 0) {
      pos = s.from; phase = 0;
    } else if (p < 1) {
      pos = [lerp(s.from[0], s.at[0], p), lerp(s.from[1], s.at[1], p)];
      phase = p * 0.4;
    } else if (p < 1 + s.stay) {
      // لەسەر شاشە — کەمێک دەجوڵێت تا ڕەق نەبێت
      const q = (p - 1) / s.stay;
      pos = [s.at[0] + Math.sin(q * Math.PI) * 0.05,
             s.at[1] + Math.cos(q * Math.PI) * 0.035];
      phase = 0.4 + q * 0.4;
    } else {
      const q = Math.min(1, p - 1 - s.stay);
      pos = [lerp(s.at[0], s.out[0], q), lerp(s.at[1], s.out[1], q)];
      phase = 0.8 + q * 0.2;
    }

    const [cx, cy] = camera(index, s.depth);

    // ─── قووڵایی ───
    // شتی دوور کەمتر دەجوڵێت. مەودای گەشتەکەی بەرەو شوێنی خۆی
    // دەگوشرێت، بۆیە بە هێواشی دەخلیسکێت لەبری ئەوەی بەخێرایی تێبپەڕێت.
    // ئەمە parallax ـی ڕاستەقینەیە — نەک تەنها لادانێکی بچووکی کامێرا.
    const reach = 0.35 + s.depth * 0.65;
    pos = [s.at[0] + (pos[0] - s.at[0]) * reach,
           s.at[1] + (pos[1] - s.at[1]) * reach];

    // شێوەکە بەپێی قۆناغی گەشتەکە دەگۆڕێت — Morph بە نەرمی دەیگۆڕێت
    const kind = s.kinds[Math.min(s.kinds.length - 1, Math.floor(phase * s.kinds.length))];

    // شێوەی دوور بچووکترە و کاڵترە — قووڵایی
    const scale = 0.72 + s.depth * 0.28;
    const onScreen = p >= 0 && p < 1 + s.stay + 1;

    return {
      name: `deco${k}`,
      kind,
      x: r1(pos[0] * W + cx),
      y: r1(pos[1] * H + cy),
      size: Math.round(s.size * scale),
      tone: s.tone,
      opacity: opac((onScreen ? s.opacity : s.opacity * 0.5) * (0.6 + s.depth * 0.4) * intensity),
      rotate: Math.round(lerp(0, s.spin, Math.max(0, Math.min(1, p / (s.stay + 2))))),
    };
  });
}

/** ڕێڕەوی بڕین بۆ CSS — لە بۆشایی ١٠٠×١٠٠ */
export const CLIP: Record<DecoKind, string> = {
  circle:   'circle(50% at 50% 50%)',
  round:    'inset(0 round 18%)',
  triangle: 'polygon(50% 2%, 98% 96%, 2% 96%)',
  diamond:  'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  hexagon:  'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)',
  pentagon: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  star:     'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  blob:     'ellipse(50% 42% at 50% 50%)',
  chevron:  'polygon(0% 0%, 62% 0%, 100% 50%, 62% 100%, 0% 100%, 38% 50%)',
  arrow:    'polygon(0% 30%, 62% 30%, 62% 4%, 100% 50%, 62% 96%, 62% 70%, 0% 70%)',
  arc:      'path("M 0 100 A 100 100 0 0 1 100 0 L 100 34 A 66 66 0 0 0 34 100 Z")',
};

/**
 * هەمان شێوەکان وەک خاڵی چوارگۆشە (٠–١)، بۆ PDF ـی ڤێکتەری.
 * `null` = بازنە یان هێلکە — بە ڕێگایەکی تر دەکێشرێت.
 */
export const POLY: Record<DecoKind, [number, number][] | null> = {
  circle:   null,
  blob:     null,
  round:    [[0, 0], [1, 0], [1, 1], [0, 1]],
  triangle: [[.5, .02], [.98, .96], [.02, .96]],
  diamond:  [[.5, 0], [1, .5], [.5, 1], [0, .5]],
  hexagon:  [[.25, .03], [.75, .03], [1, .5], [.75, .97], [.25, .97], [0, .5]],
  pentagon: [[.5, 0], [1, .38], [.82, 1], [.18, 1], [0, .38]],
  star:     [[.5, 0], [.61, .35], [.98, .35], [.68, .57], [.79, .91],
             [.5, .7], [.21, .91], [.32, .57], [.02, .35], [.39, .35]],
  chevron:  [[0, 0], [.62, 0], [1, .5], [.62, 1], [0, 1], [.38, .5]],
  arrow:    [[0, .3], [.62, .3], [.62, .04], [1, .5], [.62, .96], [.62, .7], [0, .7]],
  arc:      [[0, 1], [0, .66], [.34, .34], [.66, 0], [1, 0], [1, .34], [.34, 1]],
};

/** ناوی شێوەی PowerPoint بۆ هەر جۆرێک */
export const PPTX_SHAPE: Record<DecoKind, string> = {
  circle:   'ellipse',
  round:    'roundRect',
  triangle: 'triangle',
  diamond:  'diamond',
  hexagon:  'hexagon',
  pentagon: 'pentagon',
  star:     'star5',
  blob:     'ellipse',
  chevron:  'chevron',
  arrow:    'rightArrow',
  arc:      'blockArc',
};
