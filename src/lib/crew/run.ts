// ═══════════ ڕێکخەری تیمی ئەیجێنت ═══════════
//
// ─── یاسای سەرەکی: هیچ قۆناغێک دێککەکە ناکوژێت ───
// هەر قۆناغێک `Draft` وەردەگرێت و `Draft` دەگەڕێنێتەوە. ئەگەر
// شکستی هێنا، ئەوەی پێشووی وەک خۆی دەمێنێتەوە و ئاگادارییەک
// تۆمار دەکرێت. بۆیە:
//
//   • کلیلێکی سنووردار هێشتا دێککێک دەردەهێنێت
//   • بەکارهێنەرێکی بێ ئینتەرنێت لە ناوەڕاستی کارەکەدا
//     ئەوەی تا ئێستا نووسراوە لەدەست نادات
//   • قۆناغێکی نوێ دەکرێت زیاد بکرێت بەبێ مەترسی
//
// تاکە شتێک کە ڕێڕەوەکە دەوەستێنێت، وەستاندنی خودی بەکارهێنەرە.
//
// ─── ڕیزبەندی، و بۆچی وایە ───
// architect  بەڵگە دەبێت پێش هەموو شتێک هەبێت — حەوت نووسەری
//            جیاواز پێویستیان بە یەک ئاراستەیە
// linker     پەیمانەکان دەبێت پێش نووسین دیاری بکرێن، ئەگەرنا
//            دووبارەبوونەوە دوای ڕوودان چارەسەر دەکرێت
// librarian  سەرچاوەکان دەبێت پێش نووسین بێن — ئەمە هەر ئەو
//            یاسایەیە کە پێشتر فێری بووین (README § ٢٠)
// writer     ...
// editor     دووبارەبوونەوەی ماوە
// curator    ڕیزبەندی و ناونیشان — یەکەم بینینی هەموویان پێکەوە
// visual     وێنە دوای ئەوەی دەقەکە یەکلا بووەوە، نەک پێشی
// critic     پێداچوونەوە دوای ئەوەی هەموو شتێک شوێنی خۆی گرت
// polish     چاککردنەوە
// verifier   پێوان — بێ مۆدێل

import { compose } from '../deck/compose';
import { sectionsOf } from '../deck/model';
import { architect } from './architect';
import { linker } from './linker';
import { librarian } from './librarian';
import { writer } from './writer';
import { editor } from './editor';
import { curator } from './curator';
import { visual } from './visual';
import { critic, type Fix } from './critic';
import { polish } from './polish';
import { isStop, Stopped, type CrewOpts, type CrewResult, type Draft, type StageId,
         type StageReport } from './types';

/** ناوی کوردی و شوێنی هەر قۆناغێک لەسەر شریتی پێشکەوتن */
export const STAGES: { id: StageId; label: string; pct: number }[] = [
  { id: 'architect', label: 'دیاریکردنی بەڵگە',        pct: 8 },
  { id: 'linker',    label: 'بەستنی بەشەکان',          pct: 16 },
  { id: 'librarian', label: 'گەڕان بۆ سەرچاوەکان',     pct: 30 },
  { id: 'writer',    label: 'نووسینی بەشەکان',         pct: 62 },
  { id: 'editor',    label: 'لابردنی دووبارەبوونەوە',  pct: 68 },
  { id: 'curator',   label: 'ڕێکخستنی سلایدەکان',      pct: 74 },
  { id: 'visual',    label: 'هێنانی وێنەکان',          pct: 88 },
  { id: 'critic',    label: 'پێداچوونەوە',             pct: 93 },
  { id: 'polish',    label: 'چاککردنەوە',              pct: 97 },
  { id: 'verifier',  label: 'پشکنینی کۆتایی',          pct: 100 },
];

const stageAt = (id: StageId) => STAGES.find(s => s.id === id)!;

/**
 * ئایا هەموو قۆناغەکان جێبەجێکەرێکیان هەیە؟
 *
 * `check-core` ئەمە دەپشکنێت. قۆناغێکی بێ جێبەجێکەر بێدەنگ
 * تێدەپەڕێت — و ئەوە هەر ئەو جۆرە باگەیە کە `unshaped()` بۆ
 * تەختەبەندەکان دەیگرێت.
 */
export const stageIds = (): StageId[] => STAGES.map(s => s.id);

export async function runCrew(o: CrewOpts): Promise<CrewResult> {
  const trace: StageReport[] = [];

  const report = (id: StageId, state: StageReport['state'], detail?: string) => {
    const r: StageReport = { id, label: stageAt(id).label, state, pct: stageAt(id).pct, detail };
    trace.push(r);
    o.onStage?.(r);
  };

  /**
   * یەک قۆناغ.
   *
   * هەڵەکان لێرەدا دەگیرێن — تەنها لێرە. ئەگەر ئەیجێنتەکان خۆیان
   * هەڵەیان بگرتایە، شکستێک وەک سەرکەوتنێک دەردەکەوت و
   * بەکارهێنەر هەرگیز نەیدەزانی بۆچی دێککەکە لاوازە.
   */
  async function stage(id: StageId, fn: (d: Draft) => Promise<Draft>, d: Draft): Promise<Draft> {
    report(id, 'run');
    try {
      const next = await fn(d);
      report(id, 'ok');
      return next;
    } catch (e) {
      if (isStop(e, o.signal)) throw new Stopped();
      const msg = (e as Error).message;
      report(id, 'fail', msg);
      // ئاگادارییەکە دەگاتە بەکارهێنەر، بەڵام کارەکە بەردەوامە
      return { ...d, notes: [...d.notes, `${stageAt(id).label}: ${msg}`] };
    }
  }

  const sections = sectionsOf(o.outline);

  let d: Draft = {
    topic: o.topic,
    lang: o.lang,
    thesis: '',
    kind: 'mechanism',
    angle: '',
    outline: o.outline,
    sections,
    // پەیمانی سەرەتایی — ئەگەر `linker` شکستی هێنا، ئەمە
    // بەکاردێت و نووسەرەکان هێشتا کاردەکەن
    briefs: sections.map((sec, i) => ({
      id: sec.id, n: i + 1, title: sec.title, hint: sec.hint,
      establishes: sec.hint || sec.title, dependsOn: '',
      covers: [], avoid: [],
      slides: 0, sources: [],
    })),
    papers: [],
    refs: [],
    slides: [],
    notes: [],
  };

  // ─── دابەشکردنی سەرەتایی ───
  // ئەگەر `linker` شکستی هێنا، سلایدەکان بەبێ ئەمە هەموویان
  // سفر دەبن و هیچ نانووسرێت. یەکسان دابەش دەکرێن.
  const even = (n: number, total: number) =>
    Array.from({ length: n }, (_, i) =>
      Math.round(((i + 1) * total) / n) - Math.round((i * total) / n));
  const fair = even(Math.max(1, sections.length), o.slideCount);
  d.briefs = d.briefs.map((b, i) => ({ ...b, slides: fair[i] ?? 1 }));

  d = await stage('architect', x => architect(x, o), d);
  d = await stage('linker',    x => linker(x, o),    d);
  d = await stage('librarian', x => librarian(x, o), d);
  d = await stage('writer',    x => writer(x, o),    d);

  // ─── نووسین شکستی هێنا بە تەواوی ───
  // بەردەوامبوون بێمانایە: ئێدیتەر، ڕێکخەر و ڕەخنەگر هەموویان
  // لەسەر سلایدی نەبوو کاردەکەن و ١٠ بانگکردنی تر بەفیڕۆ دەڕوات.
  if (!d.slides.length) throw new Error('هیچ سلایدێک نەنووسرا. کلیل و مۆدێلەکە بپشکنە.');

  d = await stage('editor',  x => editor(x, o),  d);
  d = await stage('curator', x => curator(x, o), d);
  d = await stage('visual',  x => visual(x, o),  d);

  // ─── ڕەخنە و چاککردنەوە ───
  // ڕەخنەگر `fixes` دەگەڕێنێتەوە، کە بەشێکی `Draft` نییە — تەنها
  // چاککەرەوە پێویستی پێیەتی و دواتر بەکارنایەت.
  let fixes: Fix[] = [];
  d = await stage('critic', async x => {
    const r = await critic(x, o);
    fixes = r.fixes;
    return r;
  }, d);

  if (fixes.length) d = await stage('polish', x => polish(x, o, fixes), d);
  else report('polish', 'skip', 'هیچ کێشەیەک نەدۆزرایەوە');

  // ─── پشکنینی کۆتایی — بێ مۆدێل ───
  report('verifier', 'run');

  // ═══ ئەمە ئەو دێڕەیە کە چوارگۆشە خۆڵەمێشییەکە دەکوژێت ═══
  // ئێستا وێنەکان هێنراون، بۆیە بەڵێنێکی نەبڕاو ڕەت دەکرێتەوە و
  // ئەو سلایدە دەکەوێتەوە سەر تەختەبەندێکی دەقی.
  const slides = compose(d.slides, { lang: o.lang, imagesResolved: true });

  const covered = new Set(slides.map(s => s.section).filter(Boolean));
  const uncovered = d.sections.filter(s => !covered.has(s.id)).map(s => s.title);

  report('verifier', 'ok', `${slides.length} سلاید`);
  o.onSlides?.(slides);

  return {
    slides,
    thesis: d.thesis,
    refs: d.refs,
    sections: d.sections,
    uncovered,
    notes: d.notes,
    trace,
  };
}
