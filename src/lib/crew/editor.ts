// ═══════════ ئەیجێنتی ٥ — ئێدیتەری دووبارەبوونەوە ═══════════
//
// «without dublicate» — داواکاری خاوەنی بەرهەمەکە، دووەم جار.
//
// ─── بۆچی قۆناغێکی سەربەخۆ، لە کاتێکدا `linker` پێشتر چارەی کردووە ───
// `linker` **پێش** نووسین کاردەکات: ئادعاکان دابەش دەکات تاکو
// دووبارەبوونەوە شوێنی نەبێت. ئەمە کاریگەرە، بەڵام تەواو نییە —
// دوو نووسەری جیاواز دەتوانن دوو ئادعای جیاواز بە هەمان ڕستە
// بنووسن، بەتایبەتی لە پێشەکی و کۆتاییدا.
//
// بۆیە ئەمە **دوای** نووسین کاردەکات و ئەوەی ڕوویداوە دەپێوێت،
// نەک ئەوەی پلانی بۆ دانرابوو.
//
// ─── خەرجی: زۆرجار سفر ───
// دۆزینەوەکە بە کۆدە (`overlapOf`). ئەگەر هیچ جووتێک لە سنوورەکە
// نەدا، **هیچ بانگکردنێک ناکرێت**. تەنها ئەو سلایدانە دەنێردرێن
// کە نیشانە کراون، نەک هەموو دێککەکە.

import { overlapOf, slideWords } from '../deck/verify';
import { humanize } from '../humanize';
import { slideTitle } from '../research';
import type { Slide } from '../types';
import { ask } from './ask';
import type { CrewOpts, Draft } from './types';

/**
 * سنووری گومان.
 *
 * `verify()` لە ٠٫٧ ڕادەگەیەنێت — ئەوە «بە دڵنیاییەوە دووبارەیە».
 * ئێدیتەر لە ٠٫٥ دەست پێدەکات، چونکە دەیخوێنێتەوە و بڕیار دەدات
 * لەبری ئەوەی ڕایبگەیەنێت. مۆدێل دەتوانێت بڵێت «ئەمانە جیاوازن»
 * و هیچ ناگۆڕێت — بەڵام ٠٫٧ زۆر درەنگە بۆ گرتنی هاوشێوەیی نەرم.
 */
const SUSPECT = 0.5;

const SCHEMA = {
  type: 'object',
  properties: {
    fixes: {
      type: 'array',
      items: {
        type: 'object',
        propertyOrdering: ['at', 'verdict', 'title', 'bullets'],
        properties: {
          at: { type: 'number' },
          verdict: { type: 'string' },
          title: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
        required: ['at', 'verdict'],
      },
    },
  },
  required: ['fixes'],
};

interface Fix { at?: number; verdict?: string; title?: string; bullets?: string[] }

/** جووتە گومانلێکراوەکان — بە کۆد، بێ مۆدێل */
export function suspects(slides: Slide[], min = SUSPECT): [number, number][] {
  const sets = slides.map(slideWords);
  const out: [number, number][] = [];
  for (let a = 0; a < sets.length; a++) {
    if (sets[a].size < 6) continue;
    for (let b = a + 1; b < sets.length; b++) {
      if (sets[b].size < 6) continue;
      if (overlapOf(sets[a], sets[b]) >= min) out.push([a, b]);
    }
  }
  return out;
}

const show = (s: Slide, n: number) =>
  [`[${n}] ${s.title}`, ...s.bullets.map(b => `      • ${b}`), s.body ? `      ${s.body}` : '']
    .filter(Boolean).join('\n');

export async function editor(d: Draft, o: CrewOpts): Promise<Draft> {
  const pairs = suspects(d.slides);
  if (!pairs.length) {
    o.onNote?.('هیچ دووبارەبوونەوەیەک نەدۆزرایەوە');
    return d;
  }

  // تەنها سلایدە پەیوەندیدارەکان دەنێردرێن — نەک هەموو دێککەکە
  const involved = [...new Set(pairs.flat())].sort((a, b) => a - b);
  const body = pairs
    .map(([a, b]) => `── PAIR ──\n${show(d.slides[a], a)}\n${show(d.slides[b], b)}`)
    .join('\n\n');

  const r = await ask<{ fixes?: Fix[] }>(o, {
    schema: SCHEMA,
    temperature: 0.5,
    prompt: `
These slides come from one presentation on "${o.topic}".
${d.thesis ? `The deck argues: ${d.thesis}` : ''}

A word-overlap check flagged these pairs as possibly saying the same thing
twice. The check is mechanical and it is often wrong — your job is to decide.

${body}

For each pair, decide which of three cases it is:

  "different"  They only share vocabulary. Nothing to do.

  "drilling"   The second slide goes DEEPER into something the first
               introduced — four types listed, then one slide per type. This is
               correct lecture structure and must be left alone. Only call it
               drilling if the second slide really does add a mechanism, a
               figure or a named case the first did not have.

  "repeat"     The second slide restates the first in different words. This is
               the failure. Rewrite the SECOND slide so it says something the
               deck still needs — go one level deeper on the same point, or
               take the next step in the argument. Give the new "title" and
               "bullets".

Report one entry per slide you actually changed, using the number in brackets
as "at". If nothing needs changing, return {"fixes":[]}.

Rewrites keep the same language (${o.langName}), the same length as the slide
they replace, and never invent a figure, a date or a citation.

Return ONLY valid JSON:
{"fixes":[{"at":${involved[0]},"verdict":"repeat","title":"...","bullets":["..."]}]}
`.trim(),
  });

  const slides = [...d.slides];
  let changed = 0;

  for (const f of r.fixes ?? []) {
    const at = Math.round(Number(f.at));
    if (!Number.isFinite(at) || at < 0 || at >= slides.length) continue;
    if (String(f.verdict ?? '').toLowerCase() !== 'repeat') continue;

    const title = f.title?.trim();
    const bullets = (f.bullets ?? []).map(String).map(b => b.trim()).filter(Boolean);
    if (!title && !bullets.length) continue;

    const H = (s: string) => (o.applyHumanizer ? humanize(s, o.lang) : s);
    slides[at] = {
      ...slides[at],
      // هەمان سنووری ناونیشان کە لە هەموو ڕێڕەوەکاندا هەیە —
      // بەبێی، ئێدیتەر دەتوانێت ناونیشانێکی هەشت وشەیی بنووسێت
      // کە هەموو یاساکانی تر ڕەتی دەکەنەوە
      ...(title ? { title: slideTitle(H(title)) || slides[at].title } : {}),
      ...(bullets.length ? { bullets: bullets.map(H) } : {}),
    };
    changed++;
  }

  o.onNote?.(changed
    ? `${changed} سلایدی دووبارە نووسرانەوە`
    : `${pairs.length} جووت پشکنران — دووبارە نەبوون`);

  return {
    ...d,
    slides,
    notes: changed ? [...d.notes] : d.notes,
  };
}
