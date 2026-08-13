// ═══════════ یاریدەدەری ڕۆبۆت ═══════════
//
// ڕۆبۆتێکی بچووک لە گۆشەی شاشەکەدا کە لە کاتی گونجاودا قسە دەکات.
//
// ─── یاسا سەرەکییەکە ───
//
// هەموو قسەیەک دەبێت بە **دۆخی ڕاستەقینەی ئەپەکەوە** بەستراو بێت،
// نەک بە کاتژمێرێک. یاریدەدەرێک کە هەر پێنج چرکە جارێک شتێک دەڵێت
// دەبێتە شتێکی بێزارکەر و بەکارهێنەر دایدەخات و جارێکی تر
// نایکاتەوە. ئەوەی لێرەدا هەیە تەنها کاتێک دەردەکەوێت کە
// ڕاستەقینە شتێکی سوودبەخشی هەیە بۆ وتن.
//
// ─── ئەدەبی یاریدەدەرەکە ───
//
//   • هەر ئامۆژگارییەک تەنها **یەک جار** دەڵێت
//   • داخستنی بۆ هەمیشەیە (لە localStorage دەمێنێتەوە)
//   • لە دۆخی پێشکەشکردندا بە تەواوی نادیارە — کەس نایەوێت
//     ڕۆبۆتێک لەبەردەم مامۆستاکەیدا بجوڵێت
//   • ڕێز لە `prefers-reduced-motion` دەگرێت

/** پۆزەکان — هەریەکەیان وێنەیەکە لە `public/mascot/` */
export type Pose =
  | 'idle' | 'wave' | 'think' | 'search' | 'present'
  | 'cheer' | 'sorry' | 'sleep' | 'book';

export const POSES: Pose[] = [
  'idle', 'wave', 'think', 'search', 'present', 'cheer', 'sorry', 'sleep', 'book',
];

export const poseSrc = (p: Pose) => `./mascot/${p}.webp`;

/** دۆخەکانی ئەپەکە کە یاریدەدەرەکە دەیانناسێت */
export interface AppState {
  /** لە کوێی ئەپەکەداین */
  screen: 'wizard' | 'studio';
  /** هەنگاوی ئێستای دروستکردن */
  step?: 'key' | 'title' | 'who' | 'look' | 'plan' | 'talk' | 'build';
  /** زمانی هەڵبژێردراو */
  lang?: 'ckb' | 'ar' | 'en';
  /** ئایا کلیلی پێویست دانراوە؟ */
  hasKey?: boolean;
  /** ئایا دابینکەری ئێستا Gemini ـە؟ */
  isGemini?: boolean;
  /** خەریکی کارە — ئەم دەقە پیشان دەدرێت */
  busy?: string;
  /** دێککێک ئامادەیە */
  hasDeck?: boolean;
  /** ژمارەی سەرچاوەکان */
  refCount?: number;
  /** ئایا سلایدی ئێستا دەقی زۆری هەیە؟ */
  overflow?: boolean;
  /** بێ ئینتەرنێت */
  offline?: boolean;
  /** دوایین هەڵە */
  error?: string;
}

export interface Tip {
  /** ناسنامەی جێگیر — بۆ «یەک جار بڵێ» و بۆ داخستن */
  id: string;
  pose: Pose;
  text: string;
  /** ئامۆژگاری گرنگ دووبارە دەردەکەوێتەوە تەنانەت دوای بینین */
  sticky?: boolean;
}

/**
 * دۆخ → ئامۆژگاری.
 *
 * ڕیزبەندییەکە گرنگە: یەکەم ئەوەی دەگونجێت هەڵدەبژێردرێت، بۆیە
 * ئەوانەی لە سەرەوەن گرنگترن. بێ ئینتەرنێتی و هەڵە لە هەموویان
 * پێشترن — ئەوانە ڕوونکردنەوەن، نەک ئامۆژگاری.
 */
export function tipFor(s: AppState): Tip | null {
  // ─── ڕوونکردنەوەکان ───
  if (s.offline)
    return { id: 'offline', pose: 'sleep', sticky: true,
      text: 'ئینتەرنێت نییە. دەستکاری و هەناردەکردن هێشتا کاردەکەن — '
          + 'بەڵام دروستکردن و گەڕان ناکرێن.' };

  if (s.error)
    return { id: 'err:' + s.error.slice(0, 24), pose: 'sorry', sticky: true,
      text: s.error };

  // ─── خەریکی کارە ───
  if (s.busy) {
    const b = s.busy;
    const pose: Pose = /گەڕان|سەرچاوە|وێنە/.test(b) ? 'search' : 'think';
    return { id: 'busy', pose, text: b, sticky: true };
  }

  // ─── لاپەڕەی دروستکردن ───
  if (s.screen === 'wizard') {
    if (!s.hasKey)
      return { id: 'need-key', pose: 'wave', sticky: true,
        text: 'سڵاو! بۆ دەستپێکردن کلیلێکی API پێویستە. بێبەرامبەرە، و '
            + 'تەنها لە وێبگەڕەکەی خۆتدا دەمێنێتەوە.' };

    if ((s.lang === 'ckb' || s.lang === 'ar') && s.isGemini === false)
      return { id: 'ckb-gemini', pose: 'present', sticky: true,
        text: 'کوردی و عەرەبی تەنها بە Gemini باش دەنووسرێن. دابینکەرەکە بگۆڕە.' };

    if (s.step === 'title')
      return { id: 'title', pose: 'book',
        text: 'ناونیشانێکی ورد بنووسە — «کاریگەری زیرەکی دەستکرد لەسەر '
            + 'پزیشکی» باشترە لە «زیرەکی دەستکرد».' };

    if (s.step === 'look')
      return { id: 'look', pose: 'present',
        text: 'شێواز پێکهاتەکە دەگۆڕێت، پاشبنەما تەنها ڕەنگ. هەر کارتێک '
            + 'سلایدێکی ڕاستەقینەیە.' };

    if (s.step === 'plan')
      return { id: 'plan', pose: 'book',
        text: 'شێوازی ژێدەر لەبیر مەکە — مامۆستاکەت لەوانەیە APA یان '
            + 'IEEE داوا بکات.' };

    if (s.step === 'talk')
      return { id: 'talk', pose: 'search',
        text: 'دەقەکەت لێرە دابنێ و سلایدەکان لەو دەقەوە دروست دەکرێن. '
            + 'ژمارەکانی دابەشکردن ئەوانەن کە لە ستودیۆدا دەیانبینیت.' };

    return { id: 'wizard', pose: 'idle', text: 'ئامادەم. با دەستپێبکەین.' };
  }

  // ─── ستودیۆ ───
  if (s.overflow)
    return { id: 'overflow', pose: 'present', sticky: true,
      // تەختەبەند ئێستا خۆکار دەپێوردرێت (`compose`)، بۆیە ئەمە
      // تەنها کاتێک دەردەکەوێت کە دەقەکە بۆ هیچ تەختەبەندێک نەگونجێت
      text: 'ئەم سلایدە دەقی زۆری هەیە بۆ هەموو تەختەبەندێک. کورتی '
          + 'بکەرەوە، یان بیکە دوو سلاید.' };

  if (s.hasDeck && s.refCount === 0)
    return { id: 'no-refs', pose: 'search', sticky: true,
      // پێشتر دەیگوت «داوا لە یاریدەدەر بکە». بەڵام ئەمە دوگمەیەکە
      // ئێستا — کارێکی چەسپاو بە یەک ئامراز، هیچ بڕیارێکی تێدا نییە.
      text: 'لاپەڕەی سەرچاوەکان بەتاڵە. لە تابی «ڕێکخستن» دوگمەی '
          + '«سەرچاوەکان بهێنە» لێبدە — لە داتابەیسی زانستییەوە دەیانهێنێت.' };

  if (s.hasDeck)
    return { id: 'ready', pose: 'cheer',
      text: 'پێشکەشکردنەکە ئامادەیە! F5 بۆ دەستپێکردنی پێشکەشکردن.' };

  return null;
}

// ─────────── بیرەوەری ───────────

const SEEN = 'ps-mascot-seen';
const OFF  = 'ps-mascot-off';

const read = (k: string): string[] => {
  try { return JSON.parse(localStorage.getItem(k) ?? '[]') as string[]; }
  catch { return []; }
};

/** ئایا ئەم ئامۆژگارییە پێشتر بینراوە؟ */
export const seen = (id: string) => read(SEEN).includes(id);

export function markSeen(id: string): void {
  try {
    const l = read(SEEN);
    if (!l.includes(id)) localStorage.setItem(SEEN, JSON.stringify([...l, id].slice(-80)));
  } catch { /* خەزنکردن بەردەست نییە — گرنگ نییە */ }
}

/** بەکارهێنەر یاریدەدەرەکەی داخستووە؟ */
export const isOff = () => {
  try { return localStorage.getItem(OFF) === '1'; } catch { return false; }
};

export function setOff(v: boolean): void {
  try { localStorage.setItem(OFF, v ? '1' : '0'); } catch { /* بەتاڵ */ }
}
