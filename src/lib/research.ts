// ═══════════ گەڕانی ئەکادیمی ═══════════
// یاسای سەرەکی: ویکیپیدیا بە تەواوی قەدەغەیە.

import { callModel, parseJson, type GroundingSource } from './llm';
import { providerById, type ProviderId } from './providers';
import type { Reference } from './types';
import type { Paper, OnSource } from './tools/academic';
import type { SearchEngine } from './tools/data';
import type { CiteStyleId, SourceKind } from './citestyle';
import { DOMAIN_RULES } from './domains';
// دەقی گەڕاو لە ئینتەرنێتەوە هاتووە — بە چوارچێوەی «داتا، نەک فەرمان»
import { envelope } from './sanitize';

/** دۆمەینە قەدەغەکراوەکان — نە وەک سەرچاوە و نە وەک بنچینەی گەڕان */
export const BLOCKED = [
  'wikipedia.org', 'wikimedia.org', 'wiktionary.org', 'wikibooks.org',
  'simple.wikipedia.org', 'ckb.wikipedia.org', 'ar.wikipedia.org',
  'quora.com', 'answers.com', 'reddit.com', 'medium.com',
  'blogspot.com', 'wordpress.com', 'slideshare.net', 'coursehero.com',
  'studocu.com', 'scribd.com', 'chegg.com', 'geeksforgeeks.org',
  'w3schools.com', 'tutorialspoint.com', 'javatpoint.com',
];

/** دۆمەینە متمانەپێکراوە ئەکادیمییەکان */
export const TRUSTED_PATTERNS = [
  /\.edu$/, /\.edu\./, /\.ac\.[a-z]{2}$/, /\.ac\./, /\.gov$/, /\.gov\./,
  /^ieee\.org$/, /ieeexplore\.ieee\.org$/, /^dl\.acm\.org$/, /^acm\.org$/,
  /sciencedirect\.com$/, /link\.springer\.com$/, /^springer\.com$/,
  /^arxiv\.org$/, /^nature\.com$/, /^science\.org$/, /^jstor\.org$/,
  /^tandfonline\.com$/, /^wiley\.com$/, /onlinelibrary\.wiley\.com$/,
  /^cambridge\.org$/, /^oup\.com$/, /academic\.oup\.com$/,
  /^mdpi\.com$/, /^plos\.org$/, /^doi\.org$/, /^ncbi\.nlm\.nih\.gov$/,
  /^pubmed\.ncbi\.nlm\.nih\.gov$/, /^scholar\.google\.com$/,
  /^nist\.gov$/, /csrc\.nist\.gov$/, /^who\.int$/, /^un\.org$/,
  /^iso\.org$/, /^rfc-editor\.org$/, /^ietf\.org$/,
];

export const isBlocked = (domain: string) =>
  BLOCKED.some(b => domain === b || domain.endsWith('.' + b));

export const isTrusted = (domain: string) =>
  TRUSTED_PATTERNS.some(p => p.test(domain));

/** پاڵاوتنی سەرچاوەکان — قەدەغەکراوەکان دەردەکات، متمانەپێکراوەکان دەخاتە پێشەوە */
export function filterSources(sources: GroundingSource[]): GroundingSource[] {
  const clean = sources.filter(s => s.domain && !isBlocked(s.domain));
  return [...clean].sort((a, b) => Number(isTrusted(b.domain)) - Number(isTrusted(a.domain)));
}

const RESEARCH_RULES = `
STRICT SOURCE POLICY — this is not optional:
- NEVER cite, quote, summarise, or rely on Wikipedia or any Wikimedia site.
- NEVER cite Quora, Reddit, Medium, personal blogs, SlideShare, Course Hero,
  Studocu, Scribd, Chegg, GeeksforGeeks, W3Schools, or TutorialsPoint.
- ONLY use: peer-reviewed journals and conference papers, academic publishers
  (IEEE, ACM, Springer, Elsevier/ScienceDirect, Wiley, Cambridge, Oxford, MDPI, PLOS),
  preprint servers (arXiv), university sites (.edu / .ac.*), government and
  standards bodies (.gov, NIST, ISO, IETF/RFC), and recognised academic textbooks.
- If you cannot find a credible academic source for a claim, leave it out.
- Never invent a citation, DOI, author, year, or page number.
`.trim();

// ─────────── دروستکردنی ناوەڕۆک ───────────

export interface OutlineItem { title: string; hint: string }

/**
 * ناونیشانی بەشێک کورت دەکاتەوە.
 *
 * ═══ بۆچی لە کۆدەوە، نەک تەنها لە پرۆمپتەوە ═══
 * پرۆمپتەکە داوای «یەک تا سێ وشە» دەکات، بەڵام مۆدێل زۆرجار
 * ڕستەیەکی تەواو دەنووسێت — «تێگەیشتن لە بنەماکانی بەستنی کیمیایی».
 * ئەوە پێڕستەکە درێژ دەکات، لاپەڕەی ناوەڕۆک تێکدەدات، و دەبێتە
 * ناونیشانی سلایدیش. یاسایەک کە بپشکنرێت جێبەجێ دەکرێت؛ داواکارییەکی
 * شێوازی نا.
 *
 * چی لادەبرێت:
 *   • دەستەواژەی کردار — «تێگەیشتن لە»، «Understanding», «Exploring»
 *   • هەرچی دوای دوونوک دێت — «AI: مێژوو و داهاتوو» → «AI»
 *   • زیاتر لە چوار وشە
 */
const LEAD_VERBS =
  /^(?:understanding|exploring|examining|introduction to|an? overview of|a look at|discussing|analysing|analyzing|the study of|what is|how to)\s+/i;

export function shortTitle(raw: string): string {
  let t = String(raw ?? '').trim().replace(/^[-–—•\d.\s)]+/, '').trim();

  t = t.replace(LEAD_VERBS, '');
  // دوونوک: ئەوەی پێش دوونوکەکە زۆرجار ناونیشانە خۆی.
  // `>= 2` تاکو «AI: …» ـیش بگرێتەوە — کورتکراوەی دوو پیتی زۆرن.
  const colon = t.search(/[:：]/);
  if (colon >= 2) t = t.slice(0, colon).trim();

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 4) t = words.slice(0, 4).join(' ');

  // خاڵی کۆتایی لە ناونیشاندا شوێنی نییە
  return t.replace(/[.،,؛;]+$/, '').trim();
}

/**
 * وشەی بەستەر — شوێنی سروشتی بڕین لە ناونیشانێکی درێژدا.
 *
 * ئەمانە دەستەواژەیەکی لاوەکی دەست پێدەکەن («… via weighted sums»،
 * «… لە ڕێگەی …»). ئەوەی پێش وشەکە دێت خۆی ناونیشانێکی تەواوە؛
 * ئەوەی دوای دێت زیادەیە. بۆیە بڕین لێرەدا مانا ناشکێنێت، بەڵام
 * بڕینی ساکار بە ژمارەی وشە دەیشکێنێت.
 */
const TAIL_WORDS = new Set([
  'via', 'across', 'through', 'throughout', 'with', 'within', 'using', 'by',
  'for', 'in', 'into', 'on', 'from', 'between', 'among', 'toward', 'towards',
  'under', 'over', 'during', 'against', 'about', 'and', 'or', 'while', 'that',
  'which', 'when', 'where',
  // کوردی
  'لە', 'بە', 'بۆ', 'لەگەڵ', 'بەهۆی', 'لەڕێگەی', 'لەسەر', 'لەناو', 'وە', 'یان',
  // عەرەبی
  'عبر', 'في', 'من', 'إلى', 'عن', 'بين', 'مع', 'خلال', 'حول', 'على', 'و', 'أو',
]);

/**
 * ناونیشانی سلایدێک کورت دەکاتەوە.
 *
 * ═══ بۆچی جیایە لە `shortTitle` ═══
 * ناونیشانی بەشێکی پێڕست ناوێکە — «Neural Networks» — بۆیە چوار وشە
 * بەسە. ناونیشانی سلاید دەبێت **دۆزینەوەیەک** بڵێت — «Weighted sums
 * fire the neuron» — کە شوێنی زیاتری دەوێت. بەڵام بێ سنوور نا:
 *
 *   «Artificial Neurons Mathematicalize Synaptic Integration via
 *    Weighted Sums»
 *
 * ئەمە هەشت وشەیە و دوو دێڕ دەگرێت لەسەر شاشە، لە کاتێکدا هەمان
 * بەش لە لاپەڕەی ناوەڕۆکدا بە دوو وشە نووسراوە. بینەر وا دەبینێت
 * کە دوو دێککی جیاوازن.
 *
 * دوو سنوور هەیە، چونکە وشە بەتەنها بەس نییە — حەوت وشەی درێژ
 * هێشتا دوو دێڕ دەگرن:
 *   • ژمارەی وشە (`max`)
 *   • درێژی پیت (`MAX_CHARS`) — نزیکەی ئەوەی لە یەک دێڕدا دەگونجێت
 *
 * بڕین بە ژمارەی وشە بەتەنها دەستەواژە دەشکێنێت، بۆیە یەکەم لە
 * کۆما دەبڕدرێت (دەستەواژەی لاوەکی)، ئینجا لە **وشەی بەستەر**
 * (`TAIL_WORDS`)، و تەنها ئەگەر هیچیان نەبوون بە زۆر.
 */
const MAX_CHARS = 64;
/** ناونیشان هەرگیز بە دوو وشە نامێنێتەوە — ئەوە بابەتێکە، نەک ئادعایەک */
const MIN_WORDS = 3;

export function slideTitle(raw: string, max = 7): string {
  let t = String(raw ?? '').trim().replace(/^[-–—•\d.\s)]+/, '').trim();
  t = t.replace(LEAD_VERBS, '');
  // خاڵی کۆتایی لە ناونیشاندا شوێنی نییە — بەڵام ? و ! مانایان هەیە
  t = t.replace(/[.。]+$/, '').trim();

  const w = t.split(/\s+/).filter(Boolean);
  const fits = (s: string) =>
    s.split(/\s+/).filter(Boolean).length <= max && s.length <= MAX_CHARS;
  if (fits(t)) return t;

  /** پاککردنەوەی خاڵبەندی لە کۆتایی بڕینەکەدا */
  const cut = (n: number) => w.slice(0, n).join(' ').replace(/[,،:؛;\-–—]+$/, '').trim();
  const bare = (s: string) => s.toLowerCase().replace(/[,،:؛;]+$/, '');

  // ١) کۆما — «X, which had dominated …» → «X». دەستەواژەی لاوەکی
  //    هەمیشە دوای کۆما دێت، بۆیە ئەمە پاکترین بڕینە.
  for (let i = MIN_WORDS - 1; i < Math.min(max, w.length); i++)
    if (/[,،;؛]$/.test(w[i]) && fits(cut(i + 1))) return cut(i + 1);

  // ٢) وشەی بەستەر — لە سنوورەوە بەرەو دواوە، چونکە درێژترین
  //    بڕینی سروشتی زۆرترین مانا دەپارێزێت
  for (let i = Math.min(max, w.length - 1); i >= MIN_WORDS; i--)
    if (TAIL_WORDS.has(bare(w[i])) && fits(cut(i))) return cut(i);

  // ٣) بە زۆر — بەڵام هێشتا سنووری پیتەکان ڕەچاو دەکرێت
  let n = Math.min(max, w.length);
  while (n > MIN_WORDS && cut(n).length > MAX_CHARS) n--;
  return cut(n);
}

/**
 * پێڕستێکی خاو ڕێک دەخاتەوە پێش گەڕاندنەوە.
 *
 *   • ناونیشانەکان کورت دەکرێنەوە (`shortTitle`)
 *   • ڕێنماییەکان کورت دەکرێنەوە — ٢٥ وشە بەسە بۆ تێبینییەکی کاری
 *   • بەشە دووبارە و بەتاڵەکان لادەبرێن
 *
 * ئەمە لە هەر سێ ڕێڕەوی گەڕانەوەدا دەڕوات، بۆیە هیچ پێڕستێک
 * بەبێ پاککردنەوە دەرناچێت.
 */
function tidyOutline(items: OutlineItem[]): OutlineItem[] {
  const out: OutlineItem[] = [];
  const seen = new Set<string>();

  for (const it of items ?? []) {
    if (!it || typeof it.title !== 'string') continue;
    const title = shortTitle(it.title);
    if (!title) continue;

    const key = title.toLowerCase();
    if (seen.has(key)) continue;             // دوو بەشی هاوناو بێکەڵکن
    seen.add(key);

    // ═══ ٦٠ وشە، نەک ٢٥ ═══
    // خاوەنی بەرهەمەکە ڕێنمایی **ورد** دەخوازێت: ئەم ڕستەیە تاکە
    // شتێکە کە نووسەری سلایدەکان لەسەری کاردەکات. «ڕوونکردنەوەی
    // سوودەکان» هیچ ناڵێت؛ «سێ سوودەکە: خێرایی، نرخ، فراوانبوون —
    // بە ژمارەی ٢٠٢٤ ـەوە» دەڵێت چی بنووسرێت.
    const words = String(it.hint ?? '').trim().split(/\s+/).filter(Boolean);
    const hint = words.length > 60 ? words.slice(0, 60).join(' ') + '…' : words.join(' ');

    out.push({ title, hint });
  }
  return out;
}

const OUTLINE_SCHEMA = {
  type: 'object',
  properties: {
    outline: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, hint: { type: 'string' } },
        required: ['title', 'hint'],
      },
    },
  },
  required: ['outline'],
};

export interface OutlineOpts {
  key: string; provider: ProviderId; model: string;
  topic: string; langName: string; count: number; useSearch: boolean;
  /** سنووری ڕێژە — چاوەڕوانی چەند میلی چرکە دەکرێت پێش هەوڵی دواتر */
  onWait?: (ms: number) => void;
}

export interface OutlineResult {
  items: OutlineItem[];
  sources: GroundingSource[];
  /**
   * ئایا ئەم پێڕستە بەڕاستی لەسەر گەڕانێکی زیندوو دروستکرا؟
   *
   * پێشتر ئەمە نەبوو، و ئەوە کێشەیەکی ڕاستەقینە بوو: کاتێک گەڕان
   * سەرکەوتوو نەدەبوو، بێدەنگ دەگەڕایەوە سەر بانگکردنێکی بێ گەڕان و
   * بەکارهێنەر هەمان ڕووکاری «گەڕان کرا» ـی دەبینی. ئێستا دەزانرێت.
   */
  grounded: boolean;
  /**
   * ئەگەر گەڕان شکستی هێنا — بۆچی.
   *
   * ─── بۆچی ئەمە پێویست بوو ───
   * `catch { }` هۆکارەکەی دەخوارد. بەکارهێنەر «گەڕان سەرکەوتوو نەبوو»ی
   * دەبینی و هیچی تر — نە دەیزانی کلیلەکە تەواو بووە، نە مۆدێلەکە
   * گەڕانی نییە، نە تۆڕەکە کێشەی هەیە. بەبێ هۆکار، چارەسەریش نییە.
   */
  reason?: string;
}

/**
 * پرۆمپتی پێڕست.
 *
 * ─── بۆچی `search` پارامەترێکە، نەک `opts.useSearch` ───
 * پێشتر یەک پرۆمپت دروست دەکرا و **هەمان پرۆمپت** لە پاشەکشەکەشدا
 * بەکاردەهێنرا — واتە مۆدێل پێی دەوترا «پێش نووسین لە ئینتەرنێت
 * بگەڕێ» و «ژمارەی ئەمساڵ بهێنە»، لە کاتێکدا هیچ ئامرازێکی گەڕانی
 * نەبوو. مۆدێلێک کە فەرمانی گەڕانی پێدەدرێت و ناتوانێت بگەڕێت،
 * نوێیی هەڵدەبەستێت. ئێستا پاشەکشەکە پرۆمپتێکی جیاوازی هەیە کە
 * داوای گەڕان ناکات.
 */
export function outlinePrompt(o: OutlineOpts & { search: boolean; enQuery?: string }): string {
  const year = new Date().getFullYear();

  return `
You are preparing an academic university presentation on: "${o.topic}"

${o.search ? `${RESEARCH_RULES}

Search the web before you write. Go for what is true NOW, not the framing a
model reaches for by default: current figures, developments from ${year - 1}
and ${year}, findings and debates that are still live. Where the field moves
fast, a ${year - 1} source beats a ${year - 11} one that says the same thing.
Where the foundations are old and settled, say so plainly instead of dressing
them up as new.

SEARCH IN ENGLISH.${o.enQuery ? ` Start from this phrase: "${o.enQuery}".` : ''}
The academic web is overwhelmingly English, and searching in the language the
slides will be written in returns almost nothing for most subjects. Run your
queries in English, read English sources, and then write the outline in
${o.langName}. Searching in ${o.langName} and finding little is not evidence
that little exists.
` : ''}
Produce ${o.count} sections.

── FIRST DECIDE WHAT KIND OF PRESENTATION THIS IS ──
This matters more than the subject. The same topic gets a different skeleton
depending on what the presenter is doing with it, and the commonest failure by
far is forcing every topic into Introduction → Body → Conclusion.

Pick the shape that fits, or blend two. These are real university outlines:

  MECHANISM — how a thing works
    Artificial Intelligence
      Introduction · History · How AI Works · Types · Applications · Risks · Future
    Humanoid Robots
      Introduction · Mechanical Structure · Sensors · Actuators · Control · AI ·
      Walking · Applications · Challenges

  STRUCTURE — a thing made of parts, taken part by part
    Chemical Bonding
      Atoms · Ionic Bonds · Covalent Bonds · Metallic Bonds · Comparison · Examples
    The Human Heart
      Anatomy · Blood Flow · Electrical System · Diseases · Diagnosis · Prevention

  PROBLEM-DRIVEN — what was wrong, and what replaced it
    How Electric Cars Work
      Problem · Traditional Cars · EV Concept · Battery · Motor · Charging ·
      Regenerative Braking · Comparison · Future

  LAW OR THEORY — stated, then shown working
    Newton's Laws of Motion
      Historical Context · First Law · Example · Second Law · Formula · Example ·
      Third Law · Applications · Experiment

  NARRATIVE — something that moved through time
    The Industrial Revolution
      Before · Causes · Beginning · Major Inventions · Society · Economy ·
      Problems · Long-Term Effects

  CASE STUDY — one named organisation or event, examined
    Tesla: Startup to Global EV Maker
      Background · Problem · Business Model · Technology · Growth · Competition ·
      Challenges · Lessons

  RESEARCH REPORT — a study, reported in its own order
    Impact of Social Media on Students
      Research Question · Background · Methodology · Data · Analysis · Findings ·
      Limitations · Recommendations

  EXPERIMENT — a procedure and its result
    Testing Newton's Second Law
      Question · Hypothesis · Equipment · Procedure · Variables · Data · Graph ·
      Analysis · Errors · Conclusion

── WHAT A SECTION HEADING LOOKS LIKE ──
Read the headings above again. Every one is a LABEL, not a sentence. One to
three words. Nouns.

They are NOT "Understanding the Fundamental Principles of Chemical Bonding",
not "An Examination of Battery Technology and Its Role in Modern Vehicles".
Those are sentences wearing a heading's clothes. Cut every heading to its noun.

Note also what the good outlines do with parts: Chemical Bonding gives each bond
type its own section instead of one "Types of Bonds" section holding all three,
and Electric Cars gives Battery, Motor and Charging separate sections. Splitting
is what makes a deck teachable.

── THE TWO FIELDS ──
  - "title": the section heading. ONE TO THREE WORDS. Four is the absolute
             maximum and should be rare. No colons, no "and", no verbs like
             "Understanding" or "Exploring".
  - "hint":  THE BRIEF for whoever writes this section's slides — 25 to 50 words,
             and the most valuable field on this page. Name the actual content:
             the specific concepts, the named systems or people, the years, the
             comparison to draw, the example to work through.

             right:   "The four bond types — ionic, covalent, metallic, hydrogen
                       — with the electronegativity difference that produces each,
                       and NaCl vs diamond as the worked contrast."
             useless: "Explain the types of bonds."

             A one-line hint produces a one-line slide. The writer sees only the
             section title and this note, so anything you leave out here is
             something they will have to invent.

── ORDER ──
- The first section grounds the topic: what it is, or what problem it answers.
- Every section after it DEPENDS on the one before. Shuffling the order should
  visibly break the presentation.
- The last section closes: what follows, what it costs, or what is still open.
- No section covers ground an earlier one already covered. If two headings could
  be swapped without anyone noticing, merge them.
- Where a thing has parts, give each part ITS OWN SECTION rather than one
  "Features" section holding all four. That is what the examples above do.
- A section named "Conclusion" is only worth a slot if it says something the
  deck has not already said. "Future", "Challenges", "Prevention" or "Lessons"
  usually earn the last slot better.

${DOMAIN_RULES}

── HOW MUCH DETAIL ──
The titles are short. The hints are NOT. A reader of this outline should be able
to tell, from the hints alone, what the finished presentation will actually say —
which systems get named, which years appear, which comparison is drawn. If two
different people wrote decks from your outline and got decks about different
things, the hints were too thin.

Write the "title" and "hint" values in ${o.langName}.

Return ONLY valid JSON in this exact shape, with no commentary and no markdown fence:
{"outline":[{"title":"...","hint":"..."}]}
`.trim();
}

/**
 * AI پێڕستی ناوەڕۆک پێشنیار دەکات.
 *
 * ═══ سێ کێشەی ئەم فەنکشنە هەبوو ═══
 *
 * ١) **بە کوردی/عەرەبی دەگەڕا.** بابەتەکە وەک خۆی دەچووە ناو
 *    پرۆمپتەکەوە و Gemini بە هەمان زمان دەگەڕا. وێبی ئەکادیمی بە
 *    ڕێژەیەکی زۆر ئینگلیزییە، بۆیە ئەنجامەکە هەژار بوو یان هیچ.
 *    ئەمە **پێشتر فێربووین** — `findReferences` هەر لەبەر ئەم
 *    هۆکارە `englishQuery()` بەکاردەهێنێت، بەڵام هەرگیز نەهاتە
 *    ئێرە. و بەپێی C3، کوردی و عەرەبی هەمیشە Gemini ـن، واتە
 *    گەڕان هەمیشە چالاکە — بۆیە **سەرەکیترین بەکارهێنەرانمان
 *    خراپترین گەڕانیان وەردەگرت**.
 *
 * ٢) **پاشەکشەکە هەمان پرۆمپتی گەڕانی بەکاردەهێنا** بەبێ ئامرازی
 *    گەڕان. مۆدێلێک کە داوای «ژمارەی ئەمساڵ»ی لێدەکرێت و ناتوانێت
 *    بگەڕێت، هەڵیدەبەستێت.
 *
 * ٣) **پاشەکشەکە بێدەنگ بوو.** توێژینەوەکە فڕێدەدرا و بەکارهێنەر
 *    هەمان ڕووکاری دەبینی. ئێستا `grounded` دەگەڕێتەوە.
 */
export async function suggestOutline(opts: OutlineOpts): Promise<OutlineResult> {
  // ─── ١) دەستەواژەیەکی ئینگلیزی بۆ بابەتی کوردی/عەرەبی ───
  // یەک بانگکردنی هەرزان بە پلەی ٠، و گەڕانەکەی دوایی چەند قاتێک
  // باشتر دەکات. تەنها کاتێک پێویستە کە بەڕاستی پێویستە.
  let enQuery: string | undefined;
  if (opts.useSearch && isArabicScript(opts.topic)) {
    try { enQuery = (await englishQuery(opts)) || undefined; }
    catch { /* نەکرا — بە بابەتەکەی خۆی دەگەڕێین */ }
  }

  // ─── ٢) هەوڵی یەکەم، بە گەڕان ───
  // ئاگاداری: Gemini ڕێگە نادات `responseSchema` و Google Search پێکەوە
  // بن، بۆیە لێرەدا سکێما نییە و وەڵامەکە دەقی ئازادە.
  let searched = '';
  let sources: GroundingSource[] = [];
  /** هۆکاری شکست — دەگاتە بەکارهێنەر، ناخورێت */
  let reason: string | undefined;

  if (opts.useSearch) {
    try {
      const r = await callModel({
        provider: opts.provider, key: opts.key, model: opts.model,
        prompt: outlinePrompt({ ...opts, search: true, enQuery }),
        search: true, onWait: opts.onWait,
        // پێشتر ٠٫٨ بوو. پێڕست کارێکی پێکهاتەییە نەک داهێنەرانە.
        temperature: 0.6,
      });
      searched = r.text;
      sources = filterSources(r.sources);

      const parsed = parseJson<{ outline: OutlineItem[] }>(searched, opts.provider);
      if (parsed.outline?.length)
        return { items: tidyOutline(parsed.outline), sources, grounded: true };
      reason = 'وەڵامی گەڕان بە شێوەی JSON نەبوو.';
    } catch (e) { reason = (e as Error).message; }
  }

  // ─── ٣) گەڕان کرا، بەڵام JSON ـەکە شکا ───
  // پێشتر لێرەدا هەموو توێژینەوەکە **فڕێدەدرا** و لە سفرەوە دەستی
  // پێدەکردەوە بەبێ گەڕان. ئەوە خراپترین هەڵبژاردە بوو: بەکارهێنەر
  // چاوەڕێی گەڕانێکی کرد و پێڕستێکی بێ بنەمای وەرگرت.
  //
  // ئێستا دەقە گەڕاوەکە خۆی دەبێتە ماددەی بانگکردنێکی دووەم کە
  // سکێمای هەیە. هەمان زانیاری، بەڵام بە شێوەیەکی خوێندراوە.
  if (searched.trim()) {
    try {
      const { text } = await callModel({
        provider: opts.provider, key: opts.key, model: opts.model,
        schema: OUTLINE_SCHEMA, temperature: 0.4, onWait: opts.onWait,
        prompt: [
          'Below is research and a draft outline produced from a live web search',
          `for the presentation topic "${opts.topic}". It is not valid JSON.`,
          '',
          envelope('search_web', searched),
          '',
          `Rewrite it as the outline JSON. Keep the sections, their order and their`,
          `meaning — you are reformatting, not rethinking. Write "title" and "hint"`,
          `in ${opts.langName}. If the material contains fewer than ${opts.count}`,
          `usable sections, add what is missing from your own knowledge.`,
          '',
          'Return ONLY valid JSON: {"outline":[{"title":"...","hint":"..."}]}',
        ].join('\n'),
      });
      const parsed = parseJson<{ outline: OutlineItem[] }>(text, opts.provider);
      // بنەمای گەڕان پارێزراوە — بۆیە هێشتا `grounded`
      if (parsed.outline?.length)
        return { items: tidyOutline(parsed.outline), sources, grounded: true };
    } catch (e) { reason = (e as Error).message; }
  }

  // ─── ٤) دوا هەوڵ: بەبێ گەڕان، بە سکێما ───
  // پرۆمپتێکی **جیاواز** — بەبێ ڕێنمایی گەڕان، چونکە ئامرازێک نییە.
  const { text } = await callModel({
    provider: opts.provider, key: opts.key, model: opts.model,
    prompt: outlinePrompt({ ...opts, search: false }),
    schema: OUTLINE_SCHEMA, temperature: 0.6, onWait: opts.onWait,
  });
  const parsed = parseJson<{ outline: OutlineItem[] }>(text, opts.provider);
  return { items: tidyOutline(parsed.outline ?? []), sources, grounded: false, reason };
}

// ─────────── سەرچاوە ئەکادیمییەکان ───────────
//
// ئەم بەشە جارێکی تر نووسرایەوە. پێشتر داوامان لە مۆدێل دەکرد سەرچاوەکان
// بنووسێت، کە دوو کێشەی گەورەی هەبوو:
//
//   ١) لاپەڕەکە هەمیشە بەتاڵ دەبووەوە. هیچ سکێمایەک نەدەنێردرا، بۆیە
//      مۆدێل بە دەقی ئاسایی وەڵامی دەدایەوە، `parseJson` تێکدەشکا، و
//      پاشەکشەکە پشتی بە `sources` دەبەست — کە بۆ هەموو دابینکەرێک
//      جگە لە Gemini بەتاڵە. ئەنجام: هەمیشە [].
//
//   ٢) سەرچاوەی نووسراو لەلایەن مۆدێلەوە پێچەوانەی C6 بوو. ئەو
//      سەرچاوانە دەکرێ بوونیان نەبێت، و خانەی پێکهاتەییان نییە بۆ
//      BibTeX/RIS.
//
// ئێستا ڕاستەوخۆ لە داتابەیسە زانستییە ڕاستەقینەکان دەگەڕێین
// (OpenAlex، Crossref، DOAJ) — بێبەرامبەر، بێ کلیل، و هەموو ئەنجامێک
// DOI و نووسەر و ساڵی ڕاستەقینەی هەیە. مۆدێل تەنها بۆ یەک کار
// بەکاردێت: وەرگێڕانی بابەتەکە بۆ دەستەواژەیەکی گەڕانی ئینگلیزی.

/** نووسینی عەرەبی/کوردی — داتابەیسە زانستییەکان بە زۆری ئینگلیزین */
const isArabicScript = (s: string) => /[؀-ۿݐ-ݿ]/.test(s);

/** وشە بێکەڵکەکان — لە کورتکردنەوەی پرسیاردا دەردەچن */
const STOP = new Set([
  'a', 'an', 'and', 'the', 'of', 'in', 'on', 'for', 'to', 'with', 'about',
  'its', 'their', 'is', 'are', 'по', 'introduction', 'overview', 'study',
]);

/** پرسیاری گەڕان کورت دەکاتەوە.
 *  داتابەیسەکان بە دەستەواژەی کورت باشتر کاردەکەن — ڕستەی درێژ
 *  زۆرجار هیچ ناگەڕێنێتەوە. */
function shorten(q: string, words: number): string {
  const keep = q
    .replace(/["'“”‘’(),.:؛،]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP.has(w.toLowerCase()));
  return keep.slice(0, words).join(' ');
}

/** بابەتەکە دەکاتە دەستەواژەیەکی گەڕانی ئینگلیزی.
 *  ئاگاداری: مۆدێل لێرەدا سەرچاوە نانووسێت — تەنها وشەی گەڕان. */
async function englishQuery(opts: {
  key: string; provider: ProviderId; model: string; topic: string;
  onWait?: (ms: number) => void;
}): Promise<string> {
  const { text } = await callModel({
    provider: opts.provider, key: opts.key, model: opts.model,
    temperature: 0, onWait: opts.onWait,
    schema: {
      type: 'object',
      properties: { q: { type: 'string' } },
      required: ['q'],
    },
    prompt: `
Turn this presentation topic into a short English search phrase for an
academic database (OpenAlex / Crossref). Use 3–6 content words, no quotes,
no boolean operators, no year. Translate to English if it is not already.

Topic: "${opts.topic}"

Return ONLY valid JSON: {"q":"..."}
`.trim(),
  });
  return parseJson<{ q: string }>(text, opts.provider).q?.trim() ?? '';
}

/** توێژینەوەیەکی ڕاستەقینە دەکاتە سەرچاوەیەکی سلاید.
 *  خانە پێکهاتەییەکان دەپارێزرێن — بەبێ ئەوان BibTeX/RIS ناکرێت،
 *  و بەبێ ئەوان ناتوانرێت شێوازەکە دواتر بگۆڕدرێت. */
/**
 * بەستەرێکی سەردانکراو بۆ سەرچاوەیەک — یان `null` ئەگەر نەبوو.
 *
 * ─── بۆچی DOI یەکەم دێت ───
 * DOI ئەرکی هەمیشەیی بەستەرە: `doi.org/10.…` هەمیشە دەگاتە لاپەڕەی
 * ناشرەکە، تەنانەت ئەگەر ماڵپەڕەکە گۆڕابێت. `p.url` جارجار
 * بەستەرێکی ناوخۆیی API ـە یان بەردەست نییە.
 *
 * پێشتر `url` ـەکە `p.url ?? p.openAccess` بوو — بۆیە توێژینەوەیەکی
 * خاوەن DOI کە `url` ـی نەبوو، **هیچ بەستەرێکی نەدەبوو** و
 * بەکارهێنەر نەیدەتوانی بیپشکنێت.
 */
export function citeUrl(p: { doi?: string; url?: string; openAccess?: string }): string | null {
  if (p.doi) {
    const d = p.doi.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
    if (/^10\.\d{4,9}\//.test(d)) return `https://doi.org/${d}`;
  }
  for (const u of [p.url, p.openAccess]) {
    if (!u) continue;
    try { const x = new URL(u); if (x.protocol === 'https:' || x.protocol === 'http:') return u; }
    catch { /* ناونیشانی ناتەواو */ }
  }
  return null;
}

/**
 * توێژینەوەیەک دەکاتە تۆمارێکی سەرچاوە.
 *
 * ─── بۆچی هەناردە کراوە ───
 * `crew/librarian.ts` سەرچاوەکان لە چەند گەڕانێکەوە کۆدەکاتەوە
 * (یەکێک بۆ بابەتەکە، یەکێک بۆ هەر بەشێک) و ئینجا هەموویان
 * پێکەوە دەنووسێت. بەبێ ئەمە دەبوایە دووەم جار هەمان
 * گۆڕینکاری بنووسرێتەوە — و ئەوە هەر ئەو دووبارەنووسینەیە کە
 * دواتر لێک جیا دەبنەوە.
 */
export function toReference(p: Paper, style: CiteStyleId, write: Writer): Reference {
  const url = citeUrl(p) ?? undefined;
  let domain: string | undefined;
  if (url) {
    try { domain = new URL(url).hostname.replace(/^www\./, ''); }
    catch { /* بەتاڵ */ }
  }
  return {
    text: write(p, style),
    url,
    domain,
    authors: p.authors,
    year: p.year,
    title: p.title,
    venue: p.venue,
    doi: p.doi,
    kind: p.kind,
    publisher: p.publisher,
    edition: p.edition,
    volume: p.volume,
    issue: p.issue,
    pages: p.pages,
    isbn: p.isbn,
  };
}

type Writer = (p: Paper, style: CiteStyleId) => string;

export interface FindRefsOpts {
  key: string;
  provider: ProviderId;
  model: string;
  topic: string;
  count: number;
  /** شێوازی نووسین — بەکارهێنەر لە سەرەتادا هەڵیدەبژێرێت */
  style?: CiteStyleId;
  /** جۆری سەرچاوە — توێژینەوە، کتێب، یان ماڵپەڕی فەرمی */
  kind?: SourceKind;
  /** ڕاپۆرتی هەنگاوەکان — بۆ پیشاندانی زیندوو */
  onNote?: (msg: string) => void;
  /** دوای وەڵامی هەر داتابەیسێک */
  onSource?: OnSource;
  /** بۆ جۆری «ماڵپەڕ» — بەبێ ئەمانە ناتوانرێت گەڕان بکرێت */
  engine?: SearchEngine;
  engineKey?: string;
}

/**
 * ئەنجامی گەڕانی ئەکادیمی، بە هەردوو ڕووەکەیەوە.
 *
 * ─── بۆچی دووانە، نەک تەنها `refs` ───
 * پێشتر تەنها `Reference[]` دەگەڕێندرایەوە — واتە ڕستەی نووسراوی
 * APA. ئەوە بۆ لاپەڕەی سەرچاوەکان بەسە، بەڵام **پوختەی توێژینەوەکان
 * تێیدا نییە**، لە کاتێکدا `Paper.abstract` تا ٦٠٠ پیت لە OpenAlex و
 * Crossref و DOAJ ـەوە دەهێنرا و ڕاستەوخۆ فڕێدەدرا.
 *
 * ئەو پوختانە بەنرخترین شتن کە هەمانە: دۆزینەوەی ڕاستەقینە، بە
 * ژمارە و ناوەوە. ئێستا دەچنە ناو پرۆمپتی ناوەڕۆکەوە، بۆیە سلایدەکان
 * لەسەر شتێکی خوێندراوە دروست دەبن نەک لەسەر بیرەوەری مۆدێل.
 */
export interface Research {
  /** بۆ لاپەڕەی سەرچاوەکان — ڕستەی نووسراو بە شێوازی هەڵبژێردراو */
  refs: Reference[];
  /** بۆ پرۆمپتەکە — خانە خاوەکان، بە پوختەوە */
  papers: Paper[];
}

/** سەرچاوەکانی لاپەڕەی کۆتایی — ڕووکەشی سادەی `findResearch` */
export async function findReferences(opts: FindRefsOpts): Promise<Reference[]> {
  return (await findResearch(opts)).refs;
}

/** گەڕانی ئەکادیمی — هەم ڕستەکان هەم داتا خاوەکە */
export async function findResearch(opts: FindRefsOpts): Promise<Research> {
  const empty: Research = { refs: [], papers: [] };
  const topic = opts.topic.trim();
  if (!topic) return empty;
  const style = opts.style ?? 'apa';
  const kind: SourceKind = opts.kind ?? 'paper';

  // `tools/academic` خۆی `isBlocked` لەم فایلەوە دەهێنێت. هێنانی
  // ئاسایی بازنەیەک دروست دەکات؛ هێنانی داینەمیک ئەوە دەبڕێت و
  // بەستەی سەرەکیش سووکتر دەکات — تەنها لە کاتی پێویستدا بار دەبێت.
  const { searchPapers, toCite, fromHits } = await import('./tools/academic');

  // پرسیارەکان لە وردەوە بۆ فراوان. یەکەم ئەنجامی ناوچەوان بردنەوەیە.
  const tries: string[] = [];
  const add = (q: string) => {
    const t = q.trim();
    if (t.length > 2 && !tries.includes(t)) tries.push(t);
  };

  // ═══ بابەتی ئینگلیزیش ڕێکخستنی دەوێت ═══
  // پێشتر تەنها بۆ نووسینی عەرەبی/کوردی دەڕۆیشت. بەڵام بابەتی
  // خوێندکار زۆرجار ڕستەیەکی ناڕێکی ئینگلیزییە — «Network Concept
  // you must known» — و داتابەیسە ئەکادیمییەکان بۆ ئەوە هیچ
  // ناگەڕێننەوە. وەرگێڕانەکە بۆ دەستەواژەیەکی گەڕان («computer
  // network fundamentals») جیاوازییەکی گەورە دەکات، و خەرجییەکەی
  // یەک بانگکردنی پلە-سفرە.
  try {
    const q = await englishQuery(opts);
    if (q) { add(q); add(shorten(q, 4)); }
  } catch { /* بێ ئینتەرنێت یان کلیل — بە بابەتەکەی خۆی هەوڵ دەدەین */ }
  add(topic);
  add(shorten(topic, 5));
  add(shorten(topic, 3));

  // ─── ماڵپەڕی فەرمی ───
  // داتابەیسە ئەکادیمییەکان ماڵپەڕ ناگرنەوە، بۆیە ڕێڕەوێکی جیاوازە.
  /**
   * هەمان لیست، بە هەردوو شێوەکەیەوە.
   *
   * ─── ئەوانەی بەستەریان نییە دەردەکرێن ───
   * C6 دەڵێت سەرچاوە هەرگیز هەڵنابەسترێت. بەڵام سەرچاوەیەکی
   * ڕاستەقینەش کە **ناتوانرێت بپشکنرێت** هەمان کێشەی هەیە بۆ
   * مامۆستایەک: بەبێ DOI و بەبێ بەستەر، نە خوێندکار و نە مامۆستا
   * ناتوانن سەردانی بکەن. بۆیە ئەوانەی هیچ ناونیشانێکی چالاکیان
   * نییە دەردەکرێن، لەبری ئەوەی وەک ڕستەیەکی مردوو بمێننەوە.
   */
  const pack = (found: Paper[]): Research => {
    const usable = found.filter(p => citeUrl(p) !== null);
    const papers = usable.slice(0, opts.count);
    return { papers, refs: papers.map(p => toReference(p, style, toCite)) };
  };

  if (kind === 'web') return pack(await webSources(opts, tries));

  for (const q of tries) {
    let papers: Paper[] = [];
    opts.onNote?.(`گەڕان بۆ «${q}»…`);
    try { papers = await searchPapers(q, opts.count, kind, opts.onSource); }
    catch { continue; }                       // ئەم پرسیارە شکستی هێنا، ئەوی تر
    if (!papers.length) continue;

    // ═══ ئەمە باگێکی ڕاستەقینە بوو ═══
    // پێشتر `return pack(papers)` بوو — بەڵام `pack` ئەوانە
    // دەردەکات کە بەستەری پشکنینیان نییە. واتە ئەگەر پرسیارێک ٥
    // توێژینەوەی بگەڕاندایەوە و هەموویان بەبێ DOI و بەستەر بوونایە،
    // ئەنجامەکە بەتاڵ دەبوو **و پرسیارەکانی دواتر هەرگیز تاقی
    // نەدەکرانەوە**. بەکارهێنەر لاپەڕەیەکی سەرچاوەی بەتاڵی
    // دەبینی، لە کاتێکدا پرسیاری فراوانتر ئەنجامی هەبوو.
    const got = pack(papers);
    if (got.refs.length) return got;
  }

  // هیچ نەدۆزرایەوە. وەک دواهەمین هەوڵ، ئەنجامی گەڕانی ڕاستەقینەی
  // وێبگەڕ بەکاردەهێنین — ئەمانە بەستەری ڕاستەقینەن، نەک دەقی مۆدێل.
  return pack(await webSources(opts, tries).catch(() => []));
}

/** ماڵپەڕە فەرمییەکان — لە مەکینەی گەڕانەوە، یان لە ڕەگەزی گەڕانی Gemini.
 *  هەردووکیان بەستەری ڕاستەقینە دەدەن؛ هیچیان لە مۆدێلەوە نەنووسراون. */
async function webSources(o: FindRefsOpts, queries: string[]): Promise<Paper[]> {
  const { fromHits } = await import('./tools/academic');
  const q = queries[0] ?? o.topic;

  // ١) مەکینەی گەڕان، ئەگەر کلیلی هەبێت — وردترین ئەنجام
  if (o.engine && o.engineKey) {
    try {
      const { webSearch } = await import('./tools/data');
      const hits = await webSearch(o.engine, o.engineKey, `${q} site:.edu OR site:.gov`,
                                   Math.max(8, o.count * 2));
      const out = fromHits(hits);
      if (out.length) return out;
    } catch { /* دەچینە سەر ڕەگەزی گەڕان */ }
  }

  // ٢) ڕەگەزی گەڕانی مۆدێل — تەنها Gemini ئەمەی هەیە
  if (!providerById(o.provider).search) return [];
  try {
    const { sources } = await callModel({
      provider: o.provider, key: o.key, model: o.model,
      search: true, temperature: 0.2,
      prompt: `${RESEARCH_RULES}

Search for authoritative material about: "${q}"
Prefer university, government and standards-body pages.
List the sources you found. Do not invent anything.`,
    });
    return fromHits(filterSources(sources).map(s => ({
      title: s.title, url: s.url, domain: s.domain,
    })));
  } catch { return []; }
}
