// ═══════════ وەرگێڕانی دێکک ═══════════
//
// خوێندکار دێککێکی ئینگلیزی دروست دەکات و مامۆستا داوای کوردی دەکات —
// یان بەپێچەوانەوە. لەبری دروستکردنەوەی هەمووی لە نوێوە (کە واتای
// وێنە و چارت و سەرچاوە نوێیە)، تەنها دەقەکە دەگۆڕدرێت.
//
// ─── چی وەردەگێڕدرێت و چی نا ───
//
//   دەگۆڕێت    ناونیشان، خاڵ، دەق، ناونیشانی چارت، خانەی خشتە،
//              هەنگاو، هێڵی کات، KPI، وتە، تێبینی قسەکەر
//
//   نەگۆڕ      • ڕستەی سەرچاوەکان — APA شێوازێکی نێودەوڵەتییە و
//                ناوی نووسەر و ناوی گۆڤار هەرگیز وەرناگێڕدرێن (C6)
//              • DOI و بەستەرەکان
//              • فۆرموولی بیرکاری ($…$)
//              • کورتکراوەی تەکنیکی (IoT, DNS, HTTP …)
//              • ژمارەکانی چارت
//
// ─── C3 ───
// ئەگەر ئامانج کوردی یان عەرەبی بێت، دەبێت Gemini بێت. ئەمە لێرەدا
// جێبەجێ ناکرێت — `pickTextProvider` ـە کە بڕیار دەدات، و ئەم فایلە
// ئەوەی پێدەدرێت بەکاردەهێنێت.

import { callModel, parseJson } from './llm';
import type { ProviderId } from './providers';
import { LANG_NAME } from './gemini';
import { split } from './math';
import type { Deck, Lang, Slide } from './types';

/** یەک پارچە دەق کە دەبێت وەربگێڕدرێت */
interface Cell { path: string; text: string }

/**
 * هەموو ئەو دەقانەی سلایدێک کە دەبێت وەربگێڕدرێن.
 * `path` دواتر بەکاردێت بۆ گەڕاندنەوەی وەرگێڕدراوەکە بۆ شوێنی خۆی.
 */
function cells(s: Slide): Cell[] {
  const out: Cell[] = [];
  const add = (path: string, text?: string) => {
    if (text && text.trim()) out.push({ path, text });
  };

  add('title', s.title);
  s.bullets.forEach((b, i) => add(`b${i}`, b));
  add('body', s.body);
  add('notes', s.notes);

  s.chart?.labels.forEach((l, i) => add(`cl${i}`, l));
  add('cc', s.chart?.caption);

  s.table?.head.forEach((h, i) => add(`th${i}`, h));
  s.table?.rows.forEach((r, i) => r.forEach((c, j) => add(`td${i}_${j}`, c)));

  s.steps?.forEach((st, i) => { add(`sh${i}`, st.h); add(`sp${i}`, st.p); });
  s.timeline?.forEach((t, i) => add(`tc${i}`, t.c));
  s.kpis?.forEach((k, i) => add(`kk${i}`, k.k));
  add('qt', s.quote?.text);
  s.pros?.forEach((p, i) => add(`pr${i}`, p));
  s.cons?.forEach((c, i) => add(`cn${i}`, c));

  // ئاگاداری: `refs` لێرەدا نییە بە ئەنقەست. بڕوانە سەرەوە.
  return out;
}

/** وەرگێڕدراوەکان دەگەڕێنێتەوە شوێنی خۆیان */
function apply(s: Slide, tr: Record<string, string>): Slide {
  const g = (path: string, fallback: string) => tr[path]?.trim() || fallback;
  const out: Slide = { ...s };

  out.title = g('title', s.title);
  out.bullets = s.bullets.map((b, i) => g(`b${i}`, b));
  if (s.body)  out.body  = g('body', s.body);
  if (s.notes) out.notes = g('notes', s.notes);

  if (s.chart) out.chart = {
    ...s.chart,
    labels: s.chart.labels.map((l, i) => g(`cl${i}`, l)),
    caption: s.chart.caption ? g('cc', s.chart.caption) : s.chart.caption,
  };

  if (s.table) out.table = {
    head: s.table.head.map((h, i) => g(`th${i}`, h)),
    rows: s.table.rows.map((r, i) => r.map((c, j) => g(`td${i}_${j}`, c))),
  };

  if (s.steps) out.steps = s.steps.map((st, i) =>
    ({ ...st, h: g(`sh${i}`, st.h), p: g(`sp${i}`, st.p) }));
  if (s.timeline) out.timeline = s.timeline.map((t, i) => ({ ...t, c: g(`tc${i}`, t.c) }));
  if (s.kpis) out.kpis = s.kpis.map((k, i) => ({ ...k, k: g(`kk${i}`, k.k) }));
  if (s.quote) out.quote = { ...s.quote, text: g('qt', s.quote.text) };
  if (s.pros) out.pros = s.pros.map((p, i) => g(`pr${i}`, p));
  if (s.cons) out.cons = s.cons.map((c, i) => g(`cn${i}`, c));

  return out;
}

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
      },
    },
  },
  required: ['items'],
};

export interface TranslateOpts {
  key: string;
  provider: ProviderId;
  model: string;
  to: Lang;
  slides: Slide[];
  onProgress?: (done: number, total: number) => void;
}

/**
 * کۆمەڵێک سلاید وەردەگێڕێت.
 *
 * سلایدەکان بە دەستە دەنێردرێن — نەک هەموویان پێکەوە (وەڵامەکە زۆر
 * درێژ دەبێت و شکستی JSON زیاد دەکات)، و نەک یەک بە یەک (زۆر
 * داواکاری، و مۆدێل کۆنتێکستی سلایدەکانی دەوروبەری نابینێت).
 */
export async function translateSlides(o: TranslateOpts): Promise<Slide[]> {
  const target = LANG_NAME[o.to];
  const out: Slide[] = [];
  const BATCH = 4;

  for (let start = 0; start < o.slides.length; start += BATCH) {
    const group = o.slides.slice(start, start + BATCH);

    // هەر سلایدێک پێشگرێکی خۆی هەیە، بۆیە دەستەیەک بە یەک داواکاری
    const all: Cell[] = [];
    group.forEach((s, gi) =>
      cells(s).forEach(c => all.push({ path: `${gi}.${c.path}`, text: c.text })));

    if (!all.length) { out.push(...group); o.onProgress?.(out.length, o.slides.length); continue; }

    const payload = all.map(c => ({ id: c.path, text: c.text }));

    const prompt = `
Translate the "text" of each item into ${target}.

Return the SAME ids, in the same order, with only the text translated.

Rules:
- Keep technical acronyms exactly as they are: IoT, DNS, HTTP, AI, API, GPU, DNA, pH.
- Keep anything between dollar signs untouched — that is a mathematical formula.
  "$E = mc^2$" must come back as "$E = mc^2$", byte for byte.
- Keep numbers, units, dates, DOIs, URLs, code identifiers and file names unchanged.
- Keep proper names of people, universities, journals and companies unchanged.
- Do NOT translate a citation or a reference list entry. If an item looks like a
  citation (author, year, journal), return it unchanged.
- Keep the meaning and the length. A slide has fixed space — do not expand the text.
- Preserve a leading "Label: " prefix as a label: translate it, keep the colon.
- If an item is already in ${target}, return it unchanged.

Items:
${JSON.stringify(payload, null, 0)}

Return ONLY valid JSON, no markdown fence:
{"items":[{"id":"...","text":"..."}]}
`.trim();

    const { text } = await callModel({
      provider: o.provider, key: o.key, model: o.model,
      prompt, schema: SCHEMA, temperature: 0.3,
    });

    const got = parseJson<{ items?: { id?: string; text?: string }[] }>(text, o.provider).items ?? [];
    const map = new Map(got.filter(i => i.id).map(i => [i.id!, i.text ?? '']));

    group.forEach((s, gi) => {
      const tr: Record<string, string> = {};
      for (const [k, v] of map) {
        if (!k.startsWith(`${gi}.`)) continue;
        tr[k.slice(String(gi).length + 1)] = keepMath(
          all.find(c => c.path === k)?.text ?? '', v);
      }
      out.push(apply(s, tr));
    });

    o.onProgress?.(out.length, o.slides.length);
  }

  return out;
}

/**
 * فۆرموولەکان دەپارێزێت.
 *
 * مۆدێل جارجار ناو ناو فۆرموولەکە دەگۆڕێت (`\frac` → `\ratio`) یان
 * ئاراستەکەی هەڵدەگەڕێنێتەوە. ئەگەر ژمارەی فۆرموولەکان لە هەردوو
 * لادا یەکسان بێت، ئەوانی ڕەسەن دەگەڕێنرێنەوە شوێنی خۆیان.
 */
export function keepMath(original: string, translated: string): string {
  const src = split(original).filter(p => p.kind === 'math');
  if (!src.length) return translated;

  const dst = split(translated);
  const gotMath = dst.filter(p => p.kind === 'math').length;

  // ژمارەکە جیاوازە — ناتوانین بە دڵنیاییەوە بەرامبەریان بکەین.
  // ڕستەی ڕەسەن دەگەڕێنینەوە، چونکە فۆرموولێکی شێواو لە دەقێکی
  // وەرنەگێڕدراو خراپترە.
  if (gotMath !== src.length) return original;

  let i = 0;
  return dst.map(p => {
    if (p.kind === 'text') return p.value;
    const m = src[i++];
    return m.display ? `$$${m.value}$$` : `$${m.value}$`;
  }).join('');
}

/** ناونیشانی لاپەڕەی سەرەتا دەستکاری ناکرێت — C7 */
export function translatedDeck(d: Deck, slides: Slide[], to: Lang): Deck {
  return { ...d, slides, lang: to };
}
