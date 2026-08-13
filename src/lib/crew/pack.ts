// ═══════════ ئەو ماددەیەی دەچێتە ناو پرۆمپتەکانەوە ═══════════
//
// دوو شت هەن کە هەموو ئەیجێنتێکی نووسەر پێویستیانە:
//
//   ١) سەرچاوە هێنراوەکانی ئەم بەشە — بە پوختەوە، چونکە پوختەکە
//      تاکە بەشێکە کە دۆزینەوەی ڕاستەقینەی تێدایە
//   ٢) ئەوەی **پێشتر وتراوە** — بەبێ ئەمە نووسەری بەشی پێنجەم
//      نازانێت بەشی دووەم چی وتووە، و هەمانی دەڵێتەوە
//
// دووەمیان هەر ئەو شتەیە کە خاوەنی بەرهەمەکە نیگەرانی لێی بوو:
// «details about each outline without duplicate». دووبارەنەبوونەوە
// بە داواکردن جێبەجێ نابێت — بە **پیشاندانی ئەوەی وتراوە** جێبەجێ
// دەبێت.

import { envelope } from '../sanitize';
import { mkId, type Id } from '../deck/model';
import type { Paper } from '../tools/academic';
import type { Slide } from '../types';
import type { Brief } from './types';

/** ناسنامەی توێژینەوەیەک بەپێی شوێنی لە لیستەکەدا */
export const idOfPaper = (i: number): Id => mkId('s', i);

/**
 * سەرچاوەکان بۆ ناو پرۆمپتێک.
 *
 * ئەگەر `ids` بەتاڵ بوو، هەموویان دەنێردرێن — بەشێک بەبێ سەرچاوەی
 * تایبەت هێشتا پێویستی بە بینینی ئەوانی تر هەیە، چونکە دەکرێت
 * یەکێکیان بەکەڵکی بێت.
 */
export function sourcePack(papers: Paper[], ids: Id[] = []): string {
  if (!papers.length) return '';

  const want = new Set(ids);
  const rows = papers
    .map((p, i) => ({ p, id: idOfPaper(i) }))
    .filter(x => !want.size || want.has(x.id))
    .slice(0, 8)
    .map(({ p, id }) => {
      const who = p.authors?.length
        ? `${p.authors[0]}${p.authors.length > 1 ? ' et al.' : ''}` : '';
      const head = [`[${id}]`, p.title, who && `— ${who}`, p.year && `(${p.year})`,
                    p.venue && `· ${p.venue}`].filter(Boolean).join(' ');
      // پوختەکە ئەوەیە کە بەڕاستی بەکەڵک دێت — بەبێی تەنها ناوێکە
      return p.abstract ? `${head}\n    ${p.abstract}` : head;
    });

  if (!rows.length) return '';

  return [
    '── SOURCES RETRIEVED FOR THIS SECTION ──',
    'Real records from academic databases, fetched seconds ago. Build from them.',
    '',
    envelope('find_papers', rows.join('\n')),
    '',
    '- Where a claim rests on one of these, put its id in that slide\'s "cites".',
    '  An id that is not in this list is DROPPED, so inventing one loses the',
    '  citation rather than gaining anything.',
    '- Attribute in the slide text the way a lecturer expects: "Kumar et al.',
    '  (2021) measured…". Attribute only to the author and year shown here.',
    '- Cite only what a slide ACTUALLY rests on. Slides built from ordinary',
    '  knowledge cite nothing, and that is correct.',
    '- If a record is off-topic, ignore it. Retrieval is imperfect, and forcing',
    '  an irrelevant paper into the argument is worse than leaving it out.',
    '- Do NOT write a reference list. A separate step builds that page.',
    '',
  ].join('\n');
}

/** درێژی زۆرترین تۆماری «ئەوەی وتراوە» — بەبێ سنوور کۆنتێکست پڕ دەبێت */
const LEDGER_MAX = 4000;

/**
 * ئەوەی تا ئێستا نووسراوە — بۆ نووسەری بەشی دواتر.
 *
 * ═══ بۆچی ناونیشان و خاڵەکان، نەک تەنها ناونیشان ═══
 * دووبارەبوونەوەی ڕاستەقینە لە ناونیشاندا نییە — لە خاڵەکاندایە.
 * دوو سلاید دەتوانن ناونیشانی جیاوازیان هەبێت و هەمان سێ ڕستە
 * بڵێن. بۆیە خاڵەکانیش دەنێردرێن، بەڵام کورتکراوە.
 */
export function ledger(slides: Slide[], titleOf: (secId?: string) => string): string {
  if (!slides.length) return '';

  const rows: string[] = [];
  let size = 0;

  for (const s of slides) {
    const points = s.bullets.length ? s.bullets : s.body ? [s.body] : [];
    const line = `· [${titleOf(s.section)}] ${s.title}`
      + (points.length ? `\n    ${points.map(b => b.slice(0, 90)).join(' | ')}` : '');
    size += line.length;
    // کۆتاییەکان گرنگترن — بەشی پێش ئەمە نزیکترینە بە بابەتەکەوە.
    // بۆیە لە کۆتاییەوە پڕ دەکرێت و سەرەتاکە دەبڕدرێت.
    if (size > LEDGER_MAX) { rows.unshift('· …(earlier slides omitted)'); break; }
    rows.push(line);
  }

  return [
    '── ALREADY ON THE DECK — DO NOT SAY ANY OF IT AGAIN ──',
    'These slides are written and final. Your section comes after them.',
    '',
    ...rows,
    '',
    'If a point you were about to make appears above, it is TAKEN. Either go a',
    'level deeper on it — a mechanism, a figure, a named case the earlier slide',
    'did not have — or drop it and use the room for something the deck is still',
    'missing. Repeating an earlier slide in new words is the single most common',
    'way these presentations fail.',
    '',
  ].join('\n');
}

/**
 * پەیمانی بەشەکە بۆ ناو پرۆمپتی نووسەر.
 *
 * `covers` و `avoid` کلیلی دووبارەنەبوونەوەن: هەر ئادعایەک
 * خاوەنێکی هەیە، و نووسەر هەردوو لیستەکە دەبینێت.
 */
export function briefPack(b: Brief, total: number): string {
  return [
    `── YOUR SECTION: ${b.n} of ${total} — "${b.title}" ──`,
    '',
    `WHAT IT MUST ESTABLISH: ${b.establishes}`,
    b.dependsOn ? `WHAT THE READER ALREADY KNOWS: ${b.dependsOn}` : '',
    b.hint ? `THE BRIEF: ${b.hint}` : '',
    '',
    b.covers.length ? [
      'THIS SECTION OWNS THESE POINTS. Every one of them must appear:',
      ...b.covers.map(c => `  • ${c}`),
    ].join('\n') : '',
    '',
    b.avoid.length ? [
      'THESE BELONG TO OTHER SECTIONS. Do not cover them here, not even briefly:',
      ...b.avoid.map(c => `  ✕ ${c}`),
      '',
      'This is not a style preference. Another section is being written to carry',
      'each of those points. If you take one, the deck says it twice and the',
      'section that owns it is left with nothing.',
    ].join('\n') : '',
    '',
    `WRITE EXACTLY ${b.slides} SLIDE${b.slides === 1 ? '' : 'S'} for this section, and nothing outside it.`,
  ].filter(Boolean).join('\n');
}
