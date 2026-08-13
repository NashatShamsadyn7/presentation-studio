// ═══════════ ئەیجێنتی ٢ — بەستەرکەر ═══════════
//
// ئەمە ئەو ئەیجێنتەیە کە خاوەنی بەرهەمەکە داوای کرد:
// «another for linking outlines and get a details about each outline
//  without dublicate».
//
// ─── کێشەکە ───
// پێڕستێک لیستێکە. لیست هیچ ناڵێت دەربارەی ئەوەی بەشی سێیەم چی
// دەڵێت و بەشی پێنجەم چی **نا**. بۆیە کاتێک حەوت نووسەر هەریەکە
// بەشێک دەنووسن، سێ جار «سوودەکان» دەنووسرێت بە سێ شێوەی جیاواز.
//
// ─── چارەسەرەکە: خاوەندارێتی ───
// هەر ئادعایەک **خاوەنێکی** هەیە. `covers` ئەو شتانەن کە ئەم
// بەشە خۆی دەیانڵێت؛ `avoid` ئەوانەن کە بەشەکانی تر خاوەنیانن.
// نووسەری هەر بەشێک هەردوو لیستەکە دەبینێت.
//
// ═══ `avoid` لە کۆدەوە دەردەهێنرێت، نەک لە مۆدێلەوە ═══
// ئەمە بڕیارێکی گرنگە. ئەگەر داوا لە مۆدێل بکرێت بۆ هەر بەشێک
// لیستی «مەیڵێ» بنووسێت، دەبێت هەمان زانیاری حەوت جار بنووسێتەوە —
// خەرجی زیاد و شانسی ناکۆکی. لە کۆدەوە، `avoid` ـی بەشێک بە
// دڵنیاییەوە **ڕێک** ئەوەیە کە بەشەکانی تر خاوەنیانن. ناتوانێت
// درۆ بکات.

import { ask } from './ask';
import type { Brief, CrewOpts, Draft } from './types';

const SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        // `establishes` پێش `covers` — یەکەم دەبێت بزانرێت بەشەکە
        // بۆچی هەیە، ئینجا ئادعاکانی لەسەر ئەو بنەمایە دەردەکەون
        propertyOrdering: ['n', 'establishes', 'dependsOn', 'covers', 'weight'],
        properties: {
          n: { type: 'number' },
          establishes: { type: 'string' },
          dependsOn: { type: 'string' },
          covers: { type: 'array', items: { type: 'string' } },
          weight: { type: 'number' },
        },
        required: ['n', 'establishes', 'covers', 'weight'],
      },
    },
  },
  required: ['sections'],
};

interface RawSection {
  n?: number; establishes?: string; dependsOn?: string;
  covers?: string[]; weight?: number;
}

/**
 * دابەشکردنی سلایدەکان بەسەر بەشەکاندا بەپێی کێش.
 *
 * ═══ بە کۆکراوە دابەش دەکرێت، نەک بەشە بە بەشە ═══
 * هەمان کێشەی `autoSplit` لە `script.ts` دا: ئەگەر هەر بەشێک بە
 * تەنها ڕاست بکرێتەوە، کۆیان نابێتە ژمارە داواکراوەکە. ١٧ سلاید
 * بەسەر ٤ کەسدا دەبووە ٢١. بۆیە کۆی ڕۆیشتوو ڕاست دەکرێتەوە و
 * جیاوازییەکان وەردەگیرێن.
 *
 * ئەگەر بەشەکان لە سلایدەکان زۆرتر بن، ئەوانەی کێشیان کەمترە
 * سفر وەردەگرن — و `run.ts` وەک بەشی نەگیراو ڕایاندەگەیەنێت.
 * ئەوە لە دابەشکردنی ٠٫٦ سلاید بۆ هەموویان ڕاستگۆترە.
 */
export function budget(weights: number[], total: number): number[] {
  const n = weights.length;
  if (!n) return [];
  if (total <= 0) return weights.map(() => 0);

  // ─── بەشەکان زۆرترن لە سلایدەکان ───
  if (n > total) {
    const order = weights
      .map((w, i) => ({ w, i }))
      .sort((a, b) => b.w - a.w || a.i - b.i)
      .slice(0, total)
      .map(x => x.i);
    const keep = new Set(order);
    return weights.map((_, i) => (keep.has(i) ? 1 : 0));
  }

  // ─── یەک سلاید بۆ هەریەکەیان، ئینجا ئەوەی ماوە بەپێی کێش ───
  const spare = total - n;
  const w = weights.map(x => Math.max(0, Number.isFinite(x) ? x : 1));
  const sum = w.reduce((a, b) => a + b, 0) || n;

  const out: number[] = [];
  let run = 0, given = 0;
  for (let i = 0; i < n; i++) {
    run += w[i];
    const upto = Math.round((run / sum) * spare);
    out.push(1 + (upto - given));
    given = upto;
  }
  return out;
}

/** ئادعایەک بۆ بەراوردکردن — تەنها شەش وشە بەکاردێن */
const claimKey = (s: string) =>
  s.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 6)
    .join(' ');

/**
 * خاوەندارێتی یەکجارە: ئەگەر دوو بەش هەمان ئادعایان بێت،
 * یەکەمیان دەیهێڵێتەوە.
 *
 * بەبێ ئەمە، `avoid` ی بەشێک دەکرێت شتێکی تێدابێت کە `covers`
 * ی خۆشیەتی — واتە نووسەرەکە فەرمانی «بینووسە» و «مەینووسە»ی
 * پێکەوە وەردەگرێت، و هەرچی بکات هەڵەیە.
 */
export function ownClaims(covers: string[][]): string[][] {
  const taken = new Set<string>();
  return covers.map(list => {
    const kept: string[] = [];
    for (const c of list) {
      const text = c.trim();
      if (!text) continue;
      const key = claimKey(text);
      if (!key || taken.has(key)) continue;
      taken.add(key);
      kept.push(text.slice(0, 160));
    }
    return kept;
  });
}

/** لیستی «مەیڵێ» ی هەر بەشێک — ئادعای هەموو بەشەکانی تر */
export function deriveAvoid(covers: string[][], at: number, max = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < covers.length; i++) {
    if (i === at) continue;
    for (const c of covers[i]) {
      out.push(c);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export async function linker(d: Draft, o: CrewOpts): Promise<Draft> {
  const outlineText = d.outline.map((s, i) => `${i + 1}. ${s.title} — ${s.hint}`).join('\n');

  const r = await ask<{ sections?: RawSection[] }>(o, {
    schema: SCHEMA,
    temperature: 0.4,
    prompt: `
You are planning an academic presentation on "${o.topic}".

THE THESIS THE WHOLE DECK MUST ESTABLISH:
${d.thesis || '(none given — infer it from the outline)'}
${d.angle ? `THE ANGLE: ${d.angle}` : ''}
THE SHAPE OF THIS DECK: ${d.kind}

THE SECTIONS, IN ORDER:
${outlineText}

There are ${o.slideCount} content slides for ${d.outline.length} sections.

Each of these sections will be written by a DIFFERENT writer who will not see
the others' work. Your job is to make sure that when their sections are put
together they read as one deck instead of ${d.outline.length} overlapping ones.

For every section give four things:

── "establishes" ──
One sentence: what this section proves, and what the deck cannot claim without
it. If you cannot say why the thesis needs this section, say so plainly here —
that is more useful than inventing a purpose.

── "dependsOn" ──
One short sentence: what the reader already knows when they arrive, from the
earlier sections only. Section 1 has none, so write "".

── "covers" ──
THE MOST IMPORTANT FIELD. 3 to 6 specific points that this section — and ONLY
this section — is responsible for. Be concrete enough that two different writers
would produce the same content from them:

  right:   "The electronegativity threshold (1.7) that separates ionic from
            covalent, with NaCl and HCl on either side of it"
  useless: "Explain the difference between bond types"

Every point in the deck belongs to exactly ONE section. Before you write a point
here, check that no earlier section already claims it. If two sections would
naturally both cover something, give it to the one that needs it most and let
the other refer back to it. Overlap here becomes a repeated slide later, and a
repeated slide is the failure a marker notices first.

Nothing important may fall between two sections either. Read your "covers" lists
end to end: together they must be the whole deck.

── "weight" ──
A number 1 to 3. How much of the deck this section deserves: 3 for the sections
that carry the argument, 1 for the ones that just set up or close. Most sections
are 2. The slide counts are computed from these.

Write "establishes", "dependsOn" and "covers" in ${o.langName}.

Return ONLY valid JSON:
{"sections":[{"n":1,"establishes":"...","dependsOn":"","covers":["..."],"weight":2}]}
`.trim(),
  });

  // ─── بەشەکان بە ژمارە دەبەسترێنەوە، نەک بە ڕیزبەندی وەڵامەکە ───
  // مۆدێل دەکرێت ڕیزبەندییەکە بگۆڕێت یان بەشێک لەبیر بکات. ژمارەکە
  // تاکە بەستەری متمانەپێکراوە.
  const byN = new Map<number, RawSection>();
  for (const s of r.sections ?? []) {
    const n = Math.round(Number(s.n));
    if (Number.isFinite(n) && n >= 1 && n <= d.outline.length && !byN.has(n)) byN.set(n, s);
  }

  const raw = d.outline.map((_, i) => byN.get(i + 1));
  const covers = ownClaims(raw.map(s => (s?.covers ?? []).map(String)));
  const weights = raw.map(s => {
    const w = Math.round(Number(s?.weight));
    return Number.isFinite(w) ? Math.min(3, Math.max(1, w)) : 2;
  });
  const slides = budget(weights, o.slideCount);

  const briefs: Brief[] = d.sections.map((sec, i) => ({
    id: sec.id,
    n: i + 1,
    title: sec.title,
    hint: sec.hint,
    establishes: raw[i]?.establishes?.trim() || sec.hint || sec.title,
    dependsOn: raw[i]?.dependsOn?.trim() ?? '',
    covers: covers[i],
    avoid: deriveAvoid(covers, i),
    slides: slides[i],
    sources: [],
  }));

  const dropped = briefs.filter(b => !b.slides).map(b => b.title);

  return {
    ...d,
    briefs,
    notes: dropped.length
      ? [...d.notes,
         `${dropped.length} بەش شوێنیان نەبوو لە ${o.slideCount} سلایددا: `
         + `${dropped.join('، ')}. یان ژمارەی سلایدەکان زیاد بکە، یان لە پێڕست لایانبە.`]
      : d.notes,
  };
}
