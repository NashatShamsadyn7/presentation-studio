// ═══════════ پاککەرەوەی شێوازی AI ═══════════
// بنەما: پرۆژەی blader/humanizer — «Signs of AI writing» ی ویکیپیدیا.
// بەڵام ئەو ٣٣ نیشانەیە هەموویان بۆ ئینگلیزی نووسراون، بۆیە لێرەدا
// لیستێکی تایبەت بۆ عەرەبی و کوردی زیادکراوە.
//
// یاسا: هیچ ڕاستییەک نافەوتێت. تەنها شێوازی دەربڕین چاک دەکرێت.

import type { Lang } from './types';

interface Rule { re: RegExp; to: string }

// ─────────── ئینگلیزی ───────────

/** وشە زۆر بەکارهاتووەکانی AI */
const EN_WORDS: Rule[] = [
  { re: /\bdelve into\b/gi,            to: 'examine' },
  { re: /\bdelving into\b/gi,          to: 'examining' },
  { re: /\bit is important to note that\b/gi, to: '' },
  { re: /\bit(?:'s| is) worth noting that\b/gi, to: '' },
  { re: /\bit should be noted that\b/gi, to: '' },
  { re: /\bin today's (?:fast-paced |ever-changing |modern )?world\b/gi, to: 'today' },
  { re: /\bin the realm of\b/gi,       to: 'in' },
  { re: /\bin the landscape of\b/gi,   to: 'in' },
  { re: /\bplays a (?:crucial|vital|pivotal|key) role in\b/gi, to: 'shapes' },
  { re: /\bserves as a testament to\b/gi, to: 'shows' },
  { re: /\bstands as a testament to\b/gi, to: 'shows' },
  { re: /\ba testament to\b/gi,        to: 'evidence of' },
  { re: /\bnavigate the complexities of\b/gi, to: 'handle' },
  { re: /\bunlock(?:ing)? the (?:full )?potential of\b/gi, to: 'make use of' },
  { re: /\bharness(?:ing)? the power of\b/gi, to: 'use' },
  { re: /\bleverage\b/gi,              to: 'use' },
  { re: /\bleveraging\b/gi,            to: 'using' },
  { re: /\butilize\b/gi,               to: 'use' },
  { re: /\butilizing\b/gi,             to: 'using' },
  { re: /\bfacilitate\b/gi,            to: 'help' },
  { re: /\bmyriad of\b/gi,             to: 'many' },
  { re: /\bplethora of\b/gi,           to: 'many' },
  { re: /\bcornerstone of\b/gi,        to: 'basis of' },
  { re: /\bever-(?:evolving|changing|growing)\b/gi, to: 'changing' },
  { re: /\bcutting-edge\b/gi,          to: 'new' },
  { re: /\bstate-of-the-art\b/gi,      to: 'leading' },
  { re: /\bgroundbreaking\b/gi,        to: 'new' },
  { re: /\brevolutionize\b/gi,         to: 'change' },
  { re: /\bseamless(?:ly)?\b/gi,       to: 'smoothly' },
  { re: /\brobust\b/gi,                to: 'strong' },
  { re: /\bcomprehensive\b/gi,         to: 'full' },
  { re: /\bmultifaceted\b/gi,          to: 'complex' },
  { re: /\bintricate\b/gi,             to: 'detailed' },
  { re: /\bnuanced\b/gi,               to: 'subtle' },
  { re: /\bunderscore(?:s|d)?\b/gi,    to: 'shows' },
  { re: /\bfoster(?:s|ing)?\b/gi,      to: 'builds' },
  { re: /\bembark(?:ing)? on\b/gi,     to: 'begin' },
  { re: /\bat the end of the day\b/gi, to: 'in the end' },
  { re: /\bin conclusion,\s*/gi,       to: '' },
];

// ─────────── ئەوەی لادەبرا و چیتر لانابرێت ───────────
//
// پێشتر ئەم سێ یاسایە لێرە بوون:
//
//     furthermore,  →  ''
//     moreover,     →  ''
//     additionally, →  ''
//
// و هاوتاکانیان بە کوردی (`هەروەها`، `سەرەڕای ئەوە`) و بە عەرەبی
// (`علاوة على ذلك`، `بالإضافة إلى ذلك`).
//
// ئەوان **نیشانەی AI نین — بەستەری لۆژیکین**. یاسای سەرەکی ئەم فایلە
// دەڵێت «هیچ ڕاستییەک نافەوتێت»، بەڵام سڕینەوەی بەستەرەکان ڕاستی
// نافەوتێنێت و **پەیوەندی** دەفەوتێنێت — کە هەر ئەو شتەیە پرۆمپتی
// ناوەڕۆک بە توندی داوای دەکات:
//
//     "Every MIDDLE slide moves the argument one step and DEPENDS on
//      the slide before it."
//
// واتە دوو بەشی هەمان کۆد پێچەوانەی یەکتر کاریان دەکرد: یەکێکیان
// خوازیاری زنجیرەی بەڵگە بوو، ئەوی تر حەلقەکانی زنجیرەکەی دەبڕی.
// ڕستە بەتاڵەکان («شایەنی باسە کە») هێشتا لادەبرێن — ئەوانە هیچ
// مانایەکیان نییە. بەستەرەکان دەمێننەوە.

/** دیارترین نیشانە: em dash — بە تەواوی لادەبرێت */
const EN_STYLE: Rule[] = [
  { re: /\s*—\s*/g, to: ', ' },
  { re: /\s*–\s*(?=[A-Za-z])/g, to: ', ' },
  { re: /[“”]/g, to: '"' },
  { re: /[‘’]/g, to: "'" },
  { re: /…/g, to: '...' },
];

// ─────────── عەرەبی ───────────
// ڕستە کلیشەییەکانی وەرگێڕانی ئۆتۆماتیکی

const AR_RULES: Rule[] = [
  { re: /من الجدير بالذكر أن\s*/g,        to: '' },
  { re: /تجدر الإشارة إلى أن\s*/g,        to: '' },
  { re: /من المهم أن نلاحظ أن\s*/g,       to: '' },
  { re: /لا بد من الإشارة إلى أن\s*/g,    to: '' },
  { re: /في الختام،?\s*/g,                to: '' },
  { re: /في نهاية المطاف،?\s*/g,          to: '' },
  { re: /وفي الختام يمكن القول إن\s*/g,   to: '' },
  // `علاوة على ذلك` و `بالإضافة إلى ذلك` لێرەدا نەماون — بەستەرن، نەک پڕکەرەوە
  { re: /وعلى الرغم من ذلك،?\s*/g,        to: 'لكن ' },
  { re: /يعتبر ([^\s]+) واحدًا من أهم/g,  to: '$1 من أهم' },
  { re: /يُعد ([^\s]+) من أهم/g,          to: '$1 من أهم' },
  { re: /يلعب دورًا (?:محوريًا|حاسمًا|مهمًا) في/g, to: 'يؤثر في' },
  { re: /في عالمنا (?:المعاصر|اليوم|الحديث)/g, to: 'اليوم' },
  { re: /في ظل التطور (?:التكنولوجي |التقني )?(?:المتسارع|الهائل)/g, to: 'مع تطور التقنية' },
  { re: /يشكل حجر الزاوية في/g,           to: 'أساس' },
  { re: /مما لا شك فيه أن\s*/g,           to: '' },
  { re: /بشكل عام،?\s*/g,                 to: '' },
  { re: /بصورة عامة،?\s*/g,               to: '' },
  { re: /الأمر الذي يجعله/g,              to: 'ما يجعله' },
];

// ─────────── کوردی سۆرانی ───────────
// هەمان کێشە: وەرگێڕانی ئۆتۆماتیکی چەند دەستەواژەیەکی دووبارە بەکاردەهێنێت

const CKB_RULES: Rule[] = [
  { re: /شایەنی باسە کە\s*/g,             to: '' },
  { re: /جێی ئاماژەپێدانە کە\s*/g,        to: '' },
  { re: /پێویستە ئاماژە بەوە بکرێت کە\s*/g, to: '' },
  { re: /گرنگە بزانرێت کە\s*/g,           to: '' },
  { re: /لە کۆتاییدا،?\s*/g,              to: '' },
  // `سەرەڕای ئەوە` دەمێنێتەوە بەڵام دەگۆڕدرێت — بەستەرێکی دژایەتییە
  { re: /سەرەڕای ئەوە،?\s*/g,             to: 'بەڵام ' },
  // `هەروەها` لێرەدا نەماوە — بەستەری زیادکردنە، نەک پڕکەرەوە
  { re: /بەگشتی،?\s*/g,                   to: '' },
  { re: /بە شێوەیەکی گشتی،?\s*/g,         to: '' },
  { re: /ڕۆڵێکی (?:سەرەکی|گرنگ|بنەڕەتی) دەگێڕێت لە/g, to: 'کاریگەری هەیە لەسەر' },
  { re: /یەکێکە لە گرنگترین/g,            to: 'لە گرنگترین' },
  { re: /لە جیهانی ئەمڕۆدا/g,             to: 'ئەمڕۆ' },
  { re: /لە سەردەمی (?:نوێ|هاوچەرخ)دا/g,  to: 'ئەمڕۆ' },
  { re: /بەردی بناغەی/g,                  to: 'بنەمای' },
  { re: /بێگومان\s*/g,                    to: '' },
];

// ─────────── جێبەجێکردن ───────────

function tidy(s: string): string {
  return s
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.،؛:!؟?])/g, '$1')
    .replace(/^[\s,،]+/, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

/** یەکەم پیت گەورە دەکاتەوە ئەگەر ڕستەکە بە ئینگلیزی بێت */
function recap(s: string, original: string): string {
  if (!/^[a-z]/.test(s)) return s;
  if (!/^[A-Z]/.test(original.trim())) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/** دەقێک پاک دەکاتەوە لە نیشانەکانی نووسینی AI */
export function humanize(text: string, lang: Lang): string {
  if (!text) return text;
  let out = text;

  const rules: Rule[] =
    lang === 'ar'  ? [...AR_RULES]
  : lang === 'ckb' ? [...CKB_RULES]
  :                  [...EN_WORDS, ...EN_STYLE];

  // em dash لە هەموو زمانێکدا لادەبرێت — دیارترین نیشانەی AI
  if (lang !== 'en') rules.push({ re: /\s*—\s*/g, to: ' – ' });

  for (const r of rules) out = out.replace(r.re, r.to);

  out = tidy(out);
  return recap(out, text);
}

/** لیستێکی دەق پاک دەکاتەوە */
export const humanizeAll = (items: string[], lang: Lang) =>
  items.map(t => humanize(t, lang));

/** ژمارەی نیشانەکانی AI کە هێشتا ماون — بۆ پیشاندان بە بەکارهێنەر */
export function auditText(text: string, lang: Lang): number {
  const rules = lang === 'ar' ? AR_RULES : lang === 'ckb' ? CKB_RULES : [...EN_WORDS, ...EN_STYLE];
  return rules.reduce((n, r) => n + (text.match(r.re)?.length ?? 0), 0);
}
