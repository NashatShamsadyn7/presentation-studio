// ═══════════ ئەیجێنتی ٦ — ڕێکخەر ═══════════
//
// «one to organize slide and make all info to one page and reorganize».
//
// حەوت نووسەر حەوت پارچەیان نووسیوە. ئەمە دەیانکاتە **یەک دێکک**:
//
//   کۆد   ڕیزبەندی بەپێی بەشەکان · ژمارەی دیاریکراوی سلاید ·
//         سلایدی بەتاڵ لادەبرێت
//   مۆدێل ناونیشانەکان — تەنها ئەوانەی پێویستیان بە چاککردنە
//
// ─── بۆچی ناونیشان کاری ئێرەیە، نەک کاری نووسەرەکان ───
// نووسەری هەر بەشێک تەنها بەشەکەی خۆی دەبینێت، بۆیە ناتوانێت
// بزانێت ناونیشانەکەی وەک ناونیشانی سلایدێکی تر وایە یان نا. ئەمە
// یەکەم شوێنە کە هەموو ناونیشانەکان پێکەوە دەبیندرێن.

import { exactly } from '../generate';
import { slideTitle } from '../research';
import { humanize } from '../humanize';
import type { Slide } from '../types';
import { ask } from './ask';
import type { CrewOpts, Draft } from './types';

const SCHEMA = {
  type: 'object',
  properties: {
    titles: {
      type: 'array',
      items: {
        type: 'object',
        properties: { at: { type: 'number' }, title: { type: 'string' } },
        required: ['at', 'title'],
      },
    },
  },
  required: ['titles'],
};

/**
 * سلایدەکان بەپێی ڕیزی پێڕست ڕیز دەکرێنەوە.
 *
 * ═══ بۆچی پێویستە، لە کاتێکدا بە ڕیز نووسراون ═══
 * `writer` بە ڕیز کاردەکات، بۆیە زۆرجار ڕیزەکە دروستە. بەڵام
 * ئەگەر بەشێک شکستی هێنابێت و پڕکرابێتەوە، یان `polish` سلایدێکی
 * زیاد کردبێت، ڕیزەکە دەشکێت. ئەمە بێخەرجییە و دڵنیایی دەداتەوە
 * کە **هەرگیز** سلایدێکی بەشی ٥ پێش بەشی ٣ نەکەوێت — کە لاپەڕەی
 * ناوەڕۆک بە درۆ دەردەخات.
 */
export function inOutlineOrder(slides: Slide[], order: string[]): Slide[] {
  const at = new Map(order.map((id, i) => [id, i]));
  return slides
    .map((s, i) => ({ s, i, k: at.get(s.section ?? '') ?? Number.MAX_SAFE_INTEGER }))
    // ڕیزی ناوخۆی هەر بەشێک وەک خۆی دەمێنێتەوە — نووسەرەکە
    // بە ئەنقەست ئەو ڕیزەی داناوە
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map(x => x.s);
}

/** سلایدێک کە هیچی تێدا نییە — لە ژمارەکەدا نابێت بژمێردرێت */
const isEmpty = (s: Slide) =>
  !s.bullets.length && !s.body && !s.steps?.length && !s.timeline?.length
  && !s.kpis?.length && !s.quote && !(s.pros?.length && s.cons?.length)
  && s.shape !== 'divider';

export async function curator(d: Draft, o: CrewOpts): Promise<Draft> {
  // ─── ١) ڕیزبەندی و ژمارە ───
  let slides = inOutlineOrder(d.slides, d.sections.map(s => s.id));

  // سلایدی بەتاڵ لادەبرێت — بەڵام تەنها ئەگەر شتێکمان مابێت.
  // دێککێکی بەتاڵ لە سلایدێکی بەتاڵ خراپترە.
  const full = slides.filter(s => !isEmpty(s));
  if (full.length) slides = full;

  const covered = slides
    .map(s => d.sections.findIndex(x => x.id === s.section) + 1)
    .filter(n => n > 0);

  slides = exactly(slides, o.slideCount, d.outline, covered);

  // ─── ٢) ناونیشانەکان ───
  const titleOf = (id?: string) => d.sections.find(s => s.id === id)?.title ?? '—';
  const list = slides
    .map((s, i) => `[${i}] section "${titleOf(s.section)}"  →  ${s.title}`)
    .join('\n');

  try {
    const r = await ask<{ titles?: { at?: number; title?: string }[] }>(o, {
      schema: SCHEMA,
      temperature: 0.4,
      prompt: `
Here are all ${slides.length} slide titles of one presentation on "${o.topic}",
in order, each with the outline section it belongs to.

${list}

This is the first time anyone has seen them together. Fix ONLY the ones that
are actually broken. A title that works is left alone — a rewrite that changes
nothing costs the reader nothing and gains nothing.

Rewrite a title if:

- It runs over SEVEN WORDS. Five is the target.
- It shares no word with its section, so a reader cannot tell which promised
  section they are looking at.
      section "Neural Networks"  →  "Neural networks sum weighted inputs"
      NOT                        →  "Synaptic Integration via Weighted Sums"
- It names a subject instead of stating a finding. "Advantages" is broken;
  "Writes scale linearly to 40 nodes" is not. (Titles on divider, quote and
  definition slides are exempt — they name a section or introduce a term.)
- It is nearly the same as another title in the list. Two slides may share a
  heading only when the second drills into the first.
- It uses invented vocabulary — "mathematicalize", "operationalise". If a word
  would not appear in a textbook on this subject, it is the wrong word.

Also check the two slides that carry the most weight:
- [0] must set up the problem or the stake. A room has to know why this matters.
- [${slides.length - 1}] must close: what follows, what it costs, what is
  unresolved. If its title reads like a middle slide, retitle it.

Keep the language (${o.langName}). Return ONLY the titles you changed.

Return ONLY valid JSON: {"titles":[{"at":0,"title":"..."}]}
`.trim(),
    });

    let fixed = 0;
    for (const t of r.titles ?? []) {
      const at = Math.round(Number(t.at));
      const text = t.title?.trim();
      if (!Number.isFinite(at) || at < 0 || at >= slides.length || !text) continue;
      const clean = slideTitle(o.applyHumanizer ? humanize(text, o.lang) : text);
      if (!clean || clean === slides[at].title) continue;
      slides[at] = { ...slides[at], title: clean };
      fixed++;
    }
    o.onNote?.(fixed ? `${fixed} ناونیشان چاککرانەوە` : 'ناونیشانەکان تەواو بوون');
  } catch (e) {
    // ڕیزبەندی و ژمارەکە کرا — تەنها ناونیشانەکان نەپشکنران
    o.onNote?.(`پشکنینی ناونیشانەکان نەکرا: ${(e as Error).message}`);
  }

  o.onSlides?.(slides);
  return { ...d, slides };
}
