// ═══════════ ئەیجێنتی ٤ — نووسەری بەشەکان ═══════════
//
// یەک بانگکردن بۆ هەر بەشێک. ئەمە گەورەترین گۆڕانکاریی ئەم
// پڕۆژەیەیە، بۆیە شایەنی ڕوونکردنەوەیەکی وردە.
//
// ═══ «دێککەکە یەک بانگکردنە، هەرگیز یەک بانگکردن بۆ هەر سلایدێک» ═══
// ئەو یاسایە لە CLAUDE.md دا ماوەتەوە و **هێشتا ڕاستە**. هۆکارەکەی
// سێ شت بوو: خەرجی، خێرایی، و کۆهێرێنس — «هەر بانگکردنێک نازانێت
// سلایدی پێشوو چی وتووە».
//
// ئەمە دابەشکردنێکی جیاوازە:
//
//   • **نەک بۆ هەر سلایدێک** — بۆ هەر بەشێکی پێڕست. دێککێکی ١٢
//     سلایدی ٦ یان ٧ بانگکردن دەکات، نەک ١٢.
//   • **کۆهێرێنس نەشکاوە**، چونکە هۆکاری شکانەکە لابرا: هەر
//     نووسەرێک `ledger` وەردەگرێت — دەقی هەموو ئەو سلایدانەی
//     پێشتر نووسراون — و `avoid`، واتە ئادعای بەشەکانی تر. بۆیە
//     نووسەری بەشی پێنجەم بە تەواوی دەزانێت بەشەکانی ١–٤ چییان
//     وتووە. لە بانگکردنێکی گەورەدا ئەو زانیارییە **بێدەنگ** بوو،
//     لێرەدا **ڕوونە**.
//   • بەڵگەکە (`thesis`) و پەیمانی بەشەکە پێشتر دیاریکراون، بۆیە
//     هەموویان یەک ئاراستەیان هەیە.
//
// ئەوەی دەیدۆزینەوە: هەر بەشێک تەواوی کۆنتێکستەکەی بۆ خۆیەتی.
// پێشتر ١٢ سلاید لە یەک وەڵامدا دەنووسران و ئەوانەی کۆتایی
// هەمیشە لاوازتر بوون — کۆنتێکست پڕ دەبوو و مۆدێل خێراتر
// دەبوو. ئێستا سلایدی کۆتایی هێندەی سلایدی یەکەم شوێنی هەیە.

import { streamModel, parseJson } from '../llm';
import { partialArray } from '../stream';
import { densityById } from '../styles';
import { DOMAIN_RULES } from '../domains';
import { toSlide, type RawSlide } from '../generate';
import type { Slide } from '../types';
import { NO_CHARTS, QUALITY_RULES, REJECT_RULES, SHAPE_CATALOGUE, SUBSTANCE_RULES,
         WRITING_RULES } from './rules';
import { briefPack, ledger, sourcePack } from './pack';
import { checkStop } from './ask';
import type { Brief, CrewOpts, Draft } from './types';

/** سکێمای سلایدەکانی یەک بەش — `section` نییە، چونکە دیارە */
const SCHEMA = {
  type: 'object',
  properties: {
    slides: {
      type: 'array',
      items: {
        type: 'object',
        propertyOrdering: ['shape', 'title'],
        properties: {
          shape: { type: 'string' },
          title: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
          body: { type: 'string' },
          imagePrompt: { type: 'string' },
          // ئاگاداری: `chart` و `table` بە ئەنقەست لێرەدا نین.
          // بڕوانە `NO_CHARTS` لە `rules.ts`.
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
          notes: { type: 'string' },
        },
        required: ['shape', 'title'],
      },
    },
  },
  required: ['slides'],
};

/** پرۆمپتی یەک بەش — جیا کراوەتەوە تاکو بەبێ کلیل بپشکنرێت */
export function sectionPrompt(d: Draft, b: Brief, o: CrewOpts, done: Slide[]): string {
  const den = densityById(o.density ?? 'normal');
  const titleOf = (id?: string) =>
    d.sections.find(s => s.id === id)?.title ?? '?';

  // چەند وێنە لەم بەشەدا. سنووری گشتی ١ لە ٣ ـە و `visual`
  // دواتر دڵنیای دەکاتەوە — ئەمە تەنها ئاماژەیەکە بۆ نووسەر.
  const wantImage = Math.round(b.slides / 3);

  return `
You are writing ONE section of an academic university presentation on:
"${o.topic}"

── THE ARGUMENT THE WHOLE DECK MAKES ──
${d.thesis || '(not stated)'}
${d.angle ? `What makes this deck different: ${d.angle}` : ''}
This deck is a ${d.kind} presentation. Your section has to move that argument
one step forward. Anything that does not is filler, however well written.

${ledger(done, titleOf)}${briefPack(b, d.outline.length)}

${sourcePack(d.papers, b.sources)}${QUALITY_RULES}

${SUBSTANCE_RULES}

${DOMAIN_RULES}

${WRITING_RULES}

${REJECT_RULES}

── NAMING THE SHAPE ──
You do NOT choose how a slide looks. You say what its content IS, and the layout
is computed from that — measured against the real slide, at the real font size,
in the real language. Code can measure pixels and you cannot.

Give every slide a "shape" from this list, and nothing outside it:

${SHAPE_CATALOGUE}

Pick the shape the content already has. Do not pick a shape and then invent
content to fill it. If this section's ${b.slides} slides genuinely take the same
shape, that is fine — but check first, because varied content rarely does.

${NO_CHARTS}
- Bullets that describe a labelled idea must use the form "Label: explanation".
- A "figures" slide carries only numbers you actually retrieved, each with what
  it measures. If you cannot attribute a number, it is not a figures slide.
- compare2 and compareN items carry real comparison values — "Fixed schema",
  "Horizontal", "MongoDB, Cassandra", "2010" — not adjectives.
- Give the data field the shape asks for and leave the rest out. A shape whose
  data is missing quietly becomes plain text, which wastes the slide.
- LENGTH: ${den.hint}
  Give each ordinary content slide ${den.points[0]}-${den.points[1]} bullets.
  compare2 takes exactly 2, and a "list" reads best at 3 or 6.
  Every bullet on a slide should be roughly the same length as its neighbours.
${wantImage > 0 ? `- Around ${wantImage} of your ${b.slides} slides should carry an "imagePrompt":
  a short ENGLISH description of a clean, professional academic illustration,
  with no words or letters in the image. Only where the point genuinely needs
  a picture — a decorative image is a rejected slide.` : `- Add an "imagePrompt" only if a slide genuinely needs a picture. A short
  section rarely does.`}
- Write ALL visible text (titles, bullets, body, captions) in ${o.langName}.
  Keep technical terms, formulas and code identifiers in their original form.
- Never invent a citation, author, DOI, or year.

Return ONLY valid JSON, ${b.slides} slide${b.slides === 1 ? '' : 's'}, no markdown fence:
{"slides":[{"shape":"list","title":"...","bullets":["..."]}]}
`.trim();
}

/**
 * سلایدەکانی هەموو بەشەکان دەنووسێت — بەشێک بە بەشێک، بە ڕیز.
 *
 * ─── بۆچی بە ڕیز و نەک هاوکات ───
 * دوو هۆکار، و هەردووکیان بەسن بە تەنها:
 *   ١) `ledger` — نووسەری بەشی n دەبێت ئەوەی بەشەکانی ١…n-1
 *      نووسیویانە ببینێت. هاوکات، هیچیان یەکتر نابینن.
 *   ٢) سنووری هەر خولەکێکی کلیلە بێبەرامبەرەکان. ٧ داواکاری
 *      هاوکات = ٤٢٩ بۆ زۆربەیان.
 */
export async function writer(d: Draft, o: CrewOpts): Promise<Draft> {
  const known = new Set(d.papers.map((_, i) => `s${i + 1}`));
  const out: Slide[] = [];

  const live = d.briefs.filter(b => b.slides > 0);
  let n = 0;

  for (const b of live) {
    checkStop(o);
    n++;
    o.onNote?.(`نووسینی بەشی ${b.n} لە ${d.outline.length} — «${b.title}»`);

    const prompt = sectionPrompt(d, b, o, out);
    let seen = -1;

    /** وەڵامی خاو → سلایدەکانی ئەم بەشە */
    const build = (raw: RawSlide[]): Slide[] =>
      raw.map((r, i) => {
        const s = toSlide(r, out.length + i, o.lang, o.applyHumanizer, 0, known);
        // بەشەکە لێرەدا دادەنرێت، نەک لە مۆدێلەوە — نووسەرەکە
        // تەنها یەک بەشی هەیە، بۆیە پرسیارکردنی لێی تەنها
        // ڕێگایەکە بۆ هەڵە
        s.section = b.id;
        return s;
      });

    try {
      const { text } = await streamModel({
        provider: o.provider, key: o.key, model: o.model,
        prompt, schema: SCHEMA,
        // هەمان پلەی ڕێڕەوی کۆن — ناوەڕۆکی ئەکادیمی، نەک شیعر
        temperature: 0.65,
        signal: o.signal,
        onText: all => {
          if (!o.onSlides) return;
          const part = partialArray<RawSlide>(all, 'slides');
          if (part.length === seen) return;
          seen = part.length;
          o.onSlides([...out, ...build(part)]);
        },
      });

      const parsed = parseJson<{ slides?: RawSlide[] }>(text, o.provider);
      const got = build(parsed.slides ?? []);
      if (!got.length) throw new Error('هیچ سلایدێک نەنووسرا');
      out.push(...got);
    } catch (e) {
      // ═══ بەشێکی شکاو دێککەکە ناکوژێت ═══
      // سلایدێکی کەمهێز لە بۆشاییەک باشترە: لاپەڕەی ناوەڕۆک
      // هەموو بەشەکان پیشان دەدات، بۆیە بەشێکی بێ سلاید
      // بەڵێنێکی نەبڕاوە لەبەرچاوی مامۆستادا.
      o.onNote?.(`بەشی ${b.n} نەنووسرا: ${(e as Error).message}`);
      const s = toSlide(
        { shape: 'list', title: b.title, bullets: b.covers.slice(0, 4) },
        out.length, o.lang, false, 0, known);
      s.section = b.id;
      out.push(s);
      d = { ...d, notes: [...d.notes,
        `بەشی «${b.title}» لە مۆدێلەوە نەهات و لە پەیمانەکەیەوە پڕکرایەوە — پێویستی بە دەستکاری هەیە.`] };
    }

    o.onSlides?.(out);
  }

  o.onNote?.(`${n} بەش نووسران، ${out.length} سلاید`);
  return { ...d, slides: out };
}
