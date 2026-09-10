// ═══════════ ئەیجێنتی ٩ — چاککەرەوە ═══════════
//
// ڕەخنەگر کێشەکانی ناودێر کرد. ئەمە چارەیان دەکات — و **تەنها**
// ئەوان. یەک بانگکردن بۆ هەموو چاککردنەوەکان پێکەوە.
//
// ─── بۆچی تەنها سلایدە نیشانەکراوەکان دەنێردرێن ───
// دوو هۆکار. یەکەم خەرجییە: ناردنەوەی ٢٠ سلاید بۆ چاککردنی ٣
// دانەیان تۆکنێکی زۆر دەخوات. دووەمیان گرنگترە — ئەگەر هەموو
// دێککەکە بنێردرێت و داوای «چاکترکردن» بکرێت، مۆدێل **هەموویان**
// دەگۆڕێت، تەنانەت ئەوانەی تەواو بوون. ئەوە دەبێتە چاککردنەوەی
// کوێرانە، و زۆرجار ئەنجامەکەی خراپتر دەبێت لەوەی هەبوو.
//
// ─── ئەگەر هیچ کێشەیەک نەبوو ───
// هیچ بانگکردنێک ناکرێت. ئەمە قۆناغێکی شەرتاوییە.

import { toSlide, type RawSlide } from '../generate';
import type { Slide } from '../types';
import { sourcePack } from './pack';
import { WRITING_RULES } from './rules';
import { ask } from './ask';
import type { Fix } from './critic';
import type { CrewOpts, Draft } from './types';

const SCHEMA = {
  type: 'object',
  properties: {
    slides: {
      type: 'array',
      items: {
        type: 'object',
        propertyOrdering: ['at', 'shape', 'title'],
        properties: {
          at: { type: 'number' },
          shape: { type: 'string' },
          title: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
          body: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: { n: { type: 'string' }, h: { type: 'string' }, p: { type: 'string' } },
            },
          },
          timeline: {
            type: 'array',
            items: { type: 'object', properties: { y: { type: 'string' }, c: { type: 'string' } } },
          },
          kpis: {
            type: 'array',
            items: { type: 'object', properties: { v: { type: 'string' }, k: { type: 'string' } } },
          },
          quote: {
            type: 'object',
            properties: { text: { type: 'string' }, by: { type: 'string' } },
          },
          pros: { type: 'array', items: { type: 'string' } },
          cons: { type: 'array', items: { type: 'string' } },
          cites: { type: 'array', items: { type: 'string' } },
        },
        required: ['at', 'title'],
      },
    },
  },
  required: ['slides'],
};

const show = (s: Slide, n: number, f: Fix) => [
  `── SLIDE ${n} ──`,
  `shape:  ${s.shape ?? 'list'}`,
  `title:  ${s.title}`,
  ...s.bullets.map(b => `  • ${b}`),
  s.body ? `  ${s.body}` : '',
  s.quote ? `  "${s.quote.text}" — ${s.quote.by}` : '',
  s.steps?.length ? `  steps: ${s.steps.map(x => `${x.h}: ${x.p}`).join(' → ')}` : '',
  s.kpis?.length ? `  figures: ${s.kpis.map(x => `${x.v} ${x.k}`).join(', ')}` : '',
  s.cites?.length ? `  cites: ${s.cites.join(', ')}` : '',
  '',
  `PROBLEM: ${f.problem}`,
  `WHAT TO DO: ${f.fix}`,
].filter(Boolean).join('\n');

export async function polish(d: Draft, o: CrewOpts, fixes: Fix[]): Promise<Draft> {
  if (!fixes.length) return d;

  // یەک کێشە بۆ هەر سلایدێک — ئەگەر ڕەخنەگر دوو جار ناوی
  // سلایدێکی هێنابێت، هەردووکیان یەک دەکرێن
  const byAt = new Map<number, Fix>();
  for (const f of fixes) {
    const old = byAt.get(f.at);
    byAt.set(f.at, old
      ? { ...old, problem: `${old.problem} · ${f.problem}`, fix: `${old.fix} · ${f.fix}` }
      : f);
  }

  const known = new Set(d.papers.map((_, i) => `s${i + 1}`));
  const cited = [...new Set([...byAt.keys()].flatMap(at => d.slides[at]?.cites ?? []))];

  const body = [...byAt.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, f]) => show(d.slides[at], at, f))
    .join('\n\n');

  const r = await ask<{ slides?: (RawSlide & { at?: number })[] }>(o, {
    schema: SCHEMA,
    temperature: 0.55,
    prompt: `
These slides are from a university presentation on "${o.topic}".
${d.thesis ? `The deck argues: ${d.thesis}` : ''}

A reviewer marked each one and said what to do. Rewrite exactly these slides —
no others — and change only what the note asks for. Anything the note does not
mention stays as it is.

${body}

${sourcePack(d.papers, cited)}${WRITING_RULES}

Rules for the rewrite:
- Keep the language: ${o.langName}.
- Keep roughly the same length. A slide that grows by three bullets no longer
  fits the space it was measured for.
- You may change "shape" if the note asks for content the old shape cannot
  carry — but give the data that shape needs (steps / timeline / kpis / quote).
- NEVER invent a figure, a percentage, a date, an author or a citation to
  satisfy a note. If the note asks for evidence you do not have, write the
  point without the number instead. An invented figure is a worse failure than
  the one being fixed.
- "cites" may only contain ids shown above. Any other id is dropped.
- No charts, no tables.

Return ONLY valid JSON, one entry per slide you rewrote:
{"slides":[{"at":3,"shape":"list","title":"...","bullets":["..."]}]}
`.trim(),
  });

  const slides = [...d.slides];
  let n = 0;

  for (const raw of r.slides ?? []) {
    const at = Math.round(Number(raw.at));
    if (!Number.isFinite(at) || at < 0 || at >= slides.length || !byAt.has(at)) continue;
    if (!raw.title?.trim()) continue;

    const before = slides[at];
    // هەمان گۆڕینکاری ڕێڕەوی دروستکردن — ناونیشانی کورتکراوە،
    // مرۆڤکراوە، ئاماژە پاڵاوتراوەکان (C6)
    const next = toSlide(raw, at, o.lang, o.applyHumanizer, 0, known);

    slides[at] = {
      ...next,
      // ئەمانە هی سلایدە کۆنەکەن و ناگۆڕدرێن: ناسنامە (مێژووی
      // دەستکاری پێی دەبەسترێتەوە)، بەشەکە، وێنە هێنراوەکە، و
      // دەستکارییەکانی بەکارهێنەر
      id: before.id,
      section: before.section,
      overrides: before.overrides,
      ...(before.imageUrl
        ? { imageUrl: before.imageUrl, imageCredit: before.imageCredit,
            imagePrompt: before.imagePrompt }
        : {}),
      ...(before.elements?.length ? { elements: before.elements } : {}),
    };
    n++;
  }

  o.onNote?.(n ? `${n} سلاید چاککرانەوە` : 'هیچ چاککردنەوەیەک نەکرا');
  o.onSlides?.(slides);
  return { ...d, slides };
}
