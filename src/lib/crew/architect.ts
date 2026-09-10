// ═══════════ ئەیجێنتی ١ — تەلارساز ═══════════
//
// یەک پرسیار وەڵام دەداتەوە: **ئەم پێشکەشکردنە بۆچی هەیە؟**
//
// ─── بۆچی جیا کرایەوە بۆ قۆناغێکی سەربەخۆ ───
// پێشتر `thesis` خانەی یەکەمی هەمان بانگکردنی گەورە بوو، و
// ڕیزبەندییەکەی بە ئەنقەست بوو: مۆدێل بە ڕیز دەنووسێت، بۆیە
// ئەوەی یەکەم بێت ئەوانی دواتر شێوە دەدات.
//
// ئەو بیرۆکەیە دروست بوو — بەڵام نیوەی ڕێگای بڕی. بەڵگەکە تەنها
// ئەو سلایدانەی شێوە دەدا کە **لە هەمان بانگکردندا** دەنووسران.
// ئێستا ٧ بانگکردنی جیاواز سلایدەکان دەنووسن، بۆیە بەڵگەکە
// دەبێت پێشتر هەبێت و بچێتە ناو هەموویانەوە. ئەگەرنا هەر
// بەشێک بەڵگەی خۆی دادەهێنێت و دێککەکە حەوت ئاراستەی جیاوازی
// دەبێت.
//
// خەرجی: یەک بانگکردنی بچووک. وەڵامەکە دوو ڕستەیە.

import { envelope } from '../sanitize';
import { ask } from './ask';
import type { CrewOpts, Draft } from './types';

/** جۆرەکانی پێکهاتە — هەمان لیستی `outlinePrompt` لە `research.ts` */
const KINDS = [
  'mechanism', 'structure', 'problem-driven', 'law-or-theory',
  'narrative', 'case-study', 'research-report', 'experiment',
] as const;

const SCHEMA = {
  type: 'object',
  // `thesis` یەکەم — هەمان هۆکاری `SLIDES_SCHEMA`. ئەوەی یەکەم
  // بنووسرێت ئەوانی دواتری شێوە دەدات.
  propertyOrdering: ['thesis', 'kind', 'angle'],
  properties: {
    thesis: { type: 'string' },
    kind: { type: 'string' },
    angle: { type: 'string' },
  },
  required: ['thesis', 'kind'],
};

interface Out { thesis?: string; kind?: string; angle?: string }

export async function architect(d: Draft, o: CrewOpts): Promise<Draft> {
  const outlineText = d.outline.map((s, i) => `${i + 1}. ${s.title} — ${s.hint}`).join('\n');

  const material = o.webSources?.length
    ? envelope('search_web',
        o.webSources.slice(0, 10).map(s => `${s.title} — ${s.domain}`).join('\n'))
    : '';

  const script = o.script?.trim()
    ? [
        'The student has written the script they will speak. It is the primary',
        'source, and the thesis must be the argument THEY are making.',
        '',
        envelope('student_script', o.script.trim().slice(0, 6000)),
      ].join('\n')
    : '';

  const r = await ask<Out>(o, {
    schema: SCHEMA,
    // بەڵگە کارێکی بڕیاردانە، نەک داهێنانی ئازاد
    temperature: 0.4,
    prompt: `
You are the architect of an academic university presentation on: "${o.topic}"

${material}${script}
The agreed outline is:
${outlineText}

Decide two things, and nothing else. Seven other writers will each write one
section of this deck without seeing the others. What you write here is the only
thing they all share, so it has to hold the deck together on its own.

── 1. THE THESIS ──
One sentence: the single claim this presentation exists to establish. Specific
enough that a reasonable person could disagree with it. A topic restated is not
a thesis.

  thesis:  "5G's sub-millisecond latency makes remote surgery clinically
            viable, but only inside the coverage limits of millimetre wave."
  not:     "5G technology in healthcare."

It must be answerable from the outline above — do not promise an argument the
sections cannot deliver. Write it in ${o.langName}.

── 2. THE KIND ──
What shape of presentation this is. Exactly one word from this list:
${KINDS.join(' · ')}

  mechanism        how a thing works, part by part
  structure        a thing made of parts, taken part by part
  problem-driven   what was wrong, and what replaced it
  law-or-theory    stated, then shown working
  narrative        something that moved through time
  case-study       one named organisation or event, examined
  research-report  a study, reported in its own order
  experiment       a procedure and its result

── 3. THE ANGLE (optional, one short sentence) ──
What this deck does that a generic deck on the same topic would not: the named
case it works through, the comparison it draws, the limit it is honest about.
Write it in ${o.langName}.

Return ONLY valid JSON: {"thesis":"...","kind":"...","angle":"..."}
`.trim(),
  });

  const thesis = r.thesis?.trim().slice(0, 400) ?? '';
  const kind = String(r.kind ?? '').trim().toLowerCase();

  if (thesis) o.onThesis?.(thesis);

  return {
    ...d,
    thesis: thesis || d.thesis,
    // ناوێکی نەناسراو پشتگوێ دەخرێت — جۆرێکی هەڵە لە جۆرێکی
    // نەبوو خراپترە، چونکە `linker` پێکهاتەکەی لەسەر دادەنێت
    kind: (KINDS as readonly string[]).includes(kind) ? kind : d.kind,
    // ئاگاداری: ئەمە **ناچێتە** ناو `Deck.thesis` ـەوە. بەڵگەکە
    // شتێکە بەکارهێنەر دەیبینێت؛ ئەمە ڕێنماییەکی ناوخۆییە بۆ
    // نووسەرەکان و شوێنی لەسەر سلایدێک نییە.
    angle: r.angle?.trim().slice(0, 200) ?? d.angle,
  };
}
