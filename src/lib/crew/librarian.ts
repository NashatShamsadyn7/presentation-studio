// ═══════════ ئەیجێنتی ٣ — کتێبخانەوان ═══════════
//
// «one to save all website and books and source to put in referanse
//  in last slide» — داواکاری خاوەنی بەرهەمەکە.
//
// ─── جیاوازییەکەی لەگەڵ ڕێڕەوی کۆن ───
// پێشتر **یەک** گەڕان بۆ هەموو دێککەکە دەکرا: بابەتەکە دەچووە ناو
// OpenAlex/Crossref/DOAJ ـەوە و پێنج توێژینەوە دەگەڕانەوە. ئەوە بۆ
// لاپەڕەی سەرچاوەکان بەسە، بەڵام بۆ **نووسین** نا: بەشی «مێژوو» و
// بەشی «مەترسییەکان» هەردووکیان هەمان پێنج توێژینەوەیان دەبینی، و
// زۆرجار هیچیان پەیوەندییان بەو بەشەوە نەبوو.
//
// ئێستا هەر بەشێک گەڕانی خۆی هەیە. خەرجی زیادە: **یەک** بانگکردنی
// مۆدێل بۆ هەموویان پێکەوە (دەستەواژەکانی گەڕان). گەڕانەکان خۆیان
// بێبەرامبەرن و کلیلیان ناوێت.
//
// ─── C6 لێرەدا دەستپێدەکات ───
// هەر تۆمارێک کە بەستەرێکی کراوەی نییە (`citeUrl`) دەردەچێت.
// سەرچاوەیەکی ڕاستەقینەی نەپشکنراو هەمان کێشەی سەرچاوەیەکی
// هەڵبەستراوی هەیە لەبەرچاوی مامۆستادا.

import { citeUrl, findResearch, toReference, type Research } from '../research';
import { toCite, type Paper } from '../tools/academic';
import { ask } from './ask';
import { idOfPaper } from './pack';
import type { CrewOpts, Draft } from './types';

/** زۆرترین سەرچاوە لە کۆگاکەدا — زیاتر لەمە کۆنتێکست دەخوات */
const POOL_MAX = 12;
/** چەند سەرچاوە بۆ هەر بەشێک دیاری دەکرێت */
const PER_SECTION = 3;

const QUERY_SCHEMA = {
  type: 'object',
  properties: {
    queries: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'number' }, q: { type: 'string' } },
        required: ['n', 'q'],
      },
    },
  },
  required: ['queries'],
};

/** ناسنامەی یەکخستن — DOI یەکەم، چونکە ناونیشان دەگۆڕدرێت */
const keyOf = (p: Paper) =>
  (p.doi ?? p.title).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);

/** وشە بەکارهاتووەکان — بۆ پێوانی پەیوەندی */
const terms = (s: string) =>
  new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter(w => w.length > 3));

/**
 * چەند لە وشەکانی بەشەکە لەم توێژینەوەیەدان؟
 *
 * ئەمە هێمایەکی ساکارە — بەڵام لە هیچ باشترە، و **بێ بانگکردنی
 * مۆدێلە**. داوای دابەشکردن لە مۆدێل واتای بانگکردنێکی زیادە
 * بۆ کارێک کە کۆد بە ٩٠٪ ی دروستی دەیکات.
 */
function relevance(p: Paper, want: Set<string>): number {
  if (!want.size) return 0;
  const have = terms(`${p.title} ${p.abstract ?? ''}`);
  let hit = 0;
  for (const w of want) if (have.has(w)) hit++;
  return hit / want.size;
}

/** دەستەواژەی گەڕان بۆ هەر بەشێک — بە ئینگلیزی، بە یەک بانگکردن */
async function sectionQueries(d: Draft, o: CrewOpts): Promise<Map<number, string>> {
  const rows = d.briefs
    .filter(b => b.slides > 0)
    .map(b => `${b.n}. ${b.title} — ${b.covers.slice(0, 3).join('; ') || b.hint}`)
    .join('\n');

  const r = await ask<{ queries?: { n?: number; q?: string }[] }>(o, {
    schema: QUERY_SCHEMA,
    // گەڕان کارێکی مەکانیکییە — داهێنان لێرەدا تەنها زیانی هەیە
    temperature: 0,
    prompt: `
Presentation topic: "${o.topic}"

Sections:
${rows}

For each section write ONE English search phrase for an academic database
(OpenAlex / Crossref / DOAJ).

- 3 to 6 content words. No quotes, no boolean operators, no year, no site:.
- ENGLISH ONLY, whatever language the sections are written in. The academic web
  is overwhelmingly English and searching in another language returns almost
  nothing for most subjects.
- Make it about THAT SECTION, not the whole topic. A section on risks should
  search for the risks, not for the topic again — otherwise every section gets
  the same five papers and none of them fit.
- Add the topic's own words only where the section title alone would be
  ambiguous ("History" → "history of artificial neural networks").

Return ONLY valid JSON: {"queries":[{"n":1,"q":"..."}]}
`.trim(),
  });

  const out = new Map<number, string>();
  for (const q of r.queries ?? []) {
    const n = Math.round(Number(q.n));
    const text = String(q.q ?? '').trim();
    if (Number.isFinite(n) && text.length > 2) out.set(n, text.slice(0, 120));
  }
  return out;
}

export async function librarian(d: Draft, o: CrewOpts): Promise<Draft> {
  const style = o.citeStyle ?? 'apa';
  const kind = o.refKind ?? 'paper';

  // ─── ١) گەڕانی بابەتەکە — هەمان ڕێڕەوی جاران ───
  // ئەمە پاشەکشەکەشە: ئەگەر گەڕانی بەشەکان هیچ نەدۆزنەوە، هێشتا
  // لاپەڕەی سەرچاوەکان پڕ دەبێتەوە.
  let base: Research = { refs: [], papers: [] };
  try {
    base = await findResearch({
      provider: o.provider, key: o.key, model: o.model,
      topic: o.topic, count: 6, style, kind,
      onNote: o.onNote, onSource: o.onSource,
      engine: o.engine, engineKey: o.engineKey,
    });
  } catch (e) {
    o.onNote?.(`گەڕانی گشتی سەرکەوتوو نەبوو: ${(e as Error).message}`);
  }

  const pool: Paper[] = [];
  const seen = new Set<string>();
  const add = (p: Paper) => {
    const k = keyOf(p);
    // C6: بەبێ بەستەرێکی کراوە، سەرچاوەکە ناپشکندرێت — بۆیە ناچێتە ناو
    if (!k || seen.has(k) || pool.length >= POOL_MAX || citeUrl(p) === null) return;
    seen.add(k);
    pool.push(p);
  };
  base.papers.forEach(add);

  // ─── ٢) گەڕانی هەر بەشێک ───
  // داتابەیسەکان بێبەرامبەرن، بۆیە ژمارەی گەڕانەکان گرنگ نییە —
  // تەنها **یەک** بانگکردنی مۆدێل بۆ دەستەواژەکان خەرجی هەیە.
  const perSection = new Map<number, Paper[]>();
  try {
    const queries = await sectionQueries(d, o);
    if (queries.size) {
      const { searchPapers } = await import('../tools/academic');
      // ماڵپەڕ لە داتابەیسی زانستیدا نییە — ئەو ڕێڕەوە هی
      // `findResearch` ـە و لە خاڵی ١ دا کراوە
      const dbKind = kind === 'web' ? 'paper' : kind;

      for (const [n, q] of queries) {
        o.onNote?.(`گەڕان بۆ بەشی ${n}: «${q}»…`);
        try {
          const found = await searchPapers(q, 4, dbKind, o.onSource);
          perSection.set(n, found.filter(p => citeUrl(p) !== null));
          found.forEach(add);
        } catch { /* ئەم بەشە هیچی نەدۆزییەوە — ئەوانی تر بەردەوامن */ }
      }
    }
  } catch (e) {
    o.onNote?.(`گەڕانی بەشەکان نەکرا: ${(e as Error).message}`);
  }

  // ─── ٣) دابەشکردن بەسەر بەشەکاندا ───
  // یەکەم ئەوانەی گەڕانی خودی بەشەکە دۆزیونیەتەوە، ئینجا ئەوانەی
  // لە کۆگاکەدا پەیوەندییان هەیە. بەشێک بەبێ سەرچاوە کێشە نییە.
  const idOf = new Map(pool.map((p, i) => [keyOf(p), idOfPaper(i)]));

  const briefs = d.briefs.map(b => {
    const want = terms(`${b.title} ${b.covers.join(' ')}`);
    const mine = (perSection.get(b.n) ?? [])
      .map(p => idOf.get(keyOf(p)))
      .filter((x): x is string => !!x);

    const rest = pool
      .map((p, i) => ({ id: idOfPaper(i), score: relevance(p, want) }))
      .filter(x => x.score > 0.12 && !mine.includes(x.id))
      .sort((a, b2) => b2.score - a.score)
      .map(x => x.id);

    return { ...b, sources: [...new Set([...mine, ...rest])].slice(0, PER_SECTION) };
  });

  const refs = pool.map((p, i) => ({ ...toReference(p, style, toCite), id: idOfPaper(i) }));

  return {
    ...d,
    briefs,
    papers: pool,
    refs,
    notes: refs.length
      ? d.notes
      : [...d.notes,
         'هیچ سەرچاوەیەک بۆ ئەم بابەتە نەدۆزرایەوە. لە ستودیۆدا جۆرێکی تر '
         + 'تاقی بکەرەوە، یان دوگمەی هێنانی سەرچاوەکان لە لاپەڕەی کۆتاییدا لێبدە.'],
  };
}
