// ═══════════ ئەیجێنتی ٨ — ڕەخنەگر ═══════════
//
// «one other thinking and reveiw the text and image and real working
//  source».
//
// ─── ئەمە تاکە ئەیجێنتێکە کە هەموو شتێک پێکەوە دەبینێت ───
// دەق، وێنە، ئاماژە، پێکهاتە — و ئەو کێشە میکانیکییانەی
// `verify()` دۆزیونیەتیەوە. هیچ نانووسێتەوە: تەنها **دەڵێت چی
// هەڵەیە**. نووسینەوە کاری `polish` ـە.
//
// ─── بۆچی دوو ئەیجێنتی جیاواز بۆ ڕەخنە و چاککردنەوە ───
// کاتێک داوا لە مۆدێل بکرێت لە یەک بانگکردندا کێشەکان بدۆزێتەوە
// **و** چارەسەریان بکات، ئەوەی ڕوودەدات ئەوەیە کە چارەسەرەکە
// یەکەم دەنووسرێت و کێشەکە دواتر بۆی دەدۆزرێتەوە — چونکە مۆدێل
// بە ڕیز دەنووسێت. لێرەدا کێشەکە بە تەواوی جیایە: بانگکردنی
// یەکەم هیچ ناتوانێت بگۆڕێت، بۆیە ناچارە ڕاست بێت.
//
// ─── پشکنینی سەرچاوە ڕاستەقینەکان ───
// بەشێکی ئەم قۆناغە **بێ مۆدێلە**: هەر DOI ـێک لە Crossref
// دەپشکنرێت. ئەوە تاکە پشکنینێکی ڕاستەقینەی «ئایا ئەم سەرچاوەیە
// بوونی هەیە؟» ـە کە لە وێبگەڕدا دەکرێت — بڕوانە `doiRegistered`.

import { verify, type Defect } from '../deck/verify';
import { layoutById } from '../layouts';
import { ask } from './ask';
import type { CrewOpts, Draft } from './types';

/** زۆرترین DOI کە دەپشکنرێت — Crossref سنووری ڕێژەی هەیە */
const DOI_MAX = 8;

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    fixes: {
      type: 'array',
      items: {
        type: 'object',
        // `problem` پێش `fix` — یەکەم دەبێت کێشەکە ناودێر بکرێت،
        // ئەگەرنا چارەسەرەکە یەکەم دێت و کێشەکە بۆی دادەتاشرێت
        propertyOrdering: ['at', 'problem', 'fix'],
        properties: {
          at: { type: 'number' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['at', 'problem', 'fix'],
      },
    },
  },
  required: ['verdict', 'fixes'],
};

export interface Fix { at: number; problem: string; fix: string }

/** DOI ـەکان دەپشکنرێن — هاوکات، چونکە هەموویان بێبەرامبەرن */
async function checkSources(d: Draft): Promise<string[]> {
  const withDoi = d.papers
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.doi)
    .slice(0, DOI_MAX);
  if (!withDoi.length) return [];

  const { doiRegistered } = await import('../tools/academic');
  const results = await Promise.all(
    withDoi.map(async x => ({ ...x, ok: await doiRegistered(x.p.doi!) })));

  const bad = results.filter(x => !x.ok);
  return bad.length
    // «نەدۆزرایەوە» واتای «هەڵبەستراوە» نییە — بڕوانە `doiRegistered`
    ? [`${bad.length} سەرچاوە DOI ـەکەیان لە Crossref دا نەدۆزرایەوە `
       + `(${bad.map(x => x.p.title.slice(0, 40)).join('، ')}). `
       + 'لەوانەیە لە تۆمارگەیەکی ترەوە بن — پێش ناردن بەستەرەکەیان بکەرەوە.']
    : [];
}

/** دێککەکە وەک دەقێکی خوێندراوە بۆ مۆدێل */
function render(d: Draft): string {
  const titleOf = (id?: string) => d.sections.find(s => s.id === id)?.title ?? '—';
  return d.slides.map((s, i) => {
    const bits = [
      `[${i}] (${s.shape ?? 'list'}) «${titleOf(s.section)}» — ${s.title}`,
      ...s.bullets.map(b => `      • ${b}`),
      s.body ? `      ${s.body}` : '',
      s.quote ? `      "${s.quote.text}" — ${s.quote.by}` : '',
      s.steps?.length ? `      steps: ${s.steps.map(x => x.h).join(' → ')}` : '',
      s.kpis?.length ? `      figures: ${s.kpis.map(x => `${x.v} ${x.k}`).join(', ')}` : '',
      s.timeline?.length ? `      timeline: ${s.timeline.map(x => x.y).join(', ')}` : '',
      s.cites?.length ? `      cites: ${s.cites.join(', ')}` : '',
      layoutById(s.layout).needs.includes('image')
        ? (s.imageUrl ? '      image: present' : '      image: MISSING')
        : '',
    ];
    return bits.filter(Boolean).join('\n');
  }).join('\n');
}

export interface CriticOut { fixes: Fix[]; verdict: string; defects: Defect[] }

export async function critic(d: Draft, o: CrewOpts): Promise<Draft & { fixes: Fix[] }> {
  // ─── ١) پشکنینە میکانیکییەکان — بێ مۆدێل ───
  const defects = verify({
    slides: d.slides, lang: o.lang, sections: d.sections,
    contentStart: o.contentStart ?? 3,
  });

  const sourceNotes = await checkSources(d).catch(() => []);

  const mech = defects.length
    ? ['── WHAT THE MECHANICAL CHECKS FOUND ──',
       ...defects.map(x => `${x.level === 'error' ? '!' : '·'} ${x.check}: ${x.message}`),
       ''].join('\n')
    : '';

  // ─── ٢) خوێندنەوەی مرۆیی ───
  let fixes: Fix[] = [];
  let verdict = '';
  try {
    const r = await ask<{ verdict?: string; fixes?: Partial<Fix>[] }>(o, {
      schema: SCHEMA,
      // ڕەخنە کارێکی حوکمدانە. پلەیەکی بەرز ڕەخنەی داهێنراو
      // دروست دەکات لەسەر سلایدی تەواو.
      temperature: 0.3,
      prompt: `
You are marking a university presentation on "${o.topic}" before the student
submits it. You are the last reader before the lecturer.

THE ARGUMENT IT CLAIMS TO MAKE:
${d.thesis || '(none stated)'}

THE ${d.slides.length} CONTENT SLIDES:
${render(d)}

${mech}── WHAT TO REPORT ──
List only problems that would cost marks. For each, name the slide number, say
what is wrong in one sentence, and say exactly what to do about it. Do not
rewrite anything — another pass does that.

Look for these, in this order of seriousness:

1. A slide that does not survive "so what?" — nothing a reader could look up:
   no name, no number, no year, no named example. This is the commonest fault
   and the most expensive.
2. A claim the deck cannot support: a statistic, a percentage or a date with no
   source behind it, or attributed to something not in the citation list.
3. A break in the argument: slide n does not follow from slide n-1, or the
   deck never actually reaches the thesis it opened with.
4. Two slides saying the same thing in different words. (Drilling into a list —
   four types introduced, then one slide each — is correct and is NOT this.)
5. A missing image where the layout has a slot, or an image the point does not
   need.
6. A title over seven words, or one sharing no word with its section.
7. Language that reads as machine-written: invented vocabulary, empty
   connectors, adjectives where a figure belongs.

── WHAT NOT TO REPORT ──
- Style preferences. If a slide works, leave it.
- Anything you would "improve" without being able to name what is wrong.
- More than 8 items. If everything is a problem, nothing is — pick the ones
  that actually matter.

"verdict": one sentence in ${o.langName}, honest. If the deck is ready, say so.

Return ONLY valid JSON:
{"verdict":"...","fixes":[{"at":3,"problem":"...","fix":"..."}]}
`.trim(),
    });

    verdict = r.verdict?.trim() ?? '';
    fixes = (r.fixes ?? [])
      .map(f => ({
        at: Math.round(Number(f.at)),
        problem: String(f.problem ?? '').trim(),
        fix: String(f.fix ?? '').trim(),
      }))
      .filter(f => Number.isFinite(f.at) && f.at >= 0 && f.at < d.slides.length
                && f.problem && f.fix)
      .slice(0, 8);
  } catch (e) {
    o.onNote?.(`پێداچوونەوە نەکرا: ${(e as Error).message}`);
  }

  o.onNote?.(fixes.length ? `${fixes.length} کێشە دۆزرایەوە` : 'پێداچوونەوە: هیچ کێشەیەک نەما');

  return {
    ...d,
    fixes,
    notes: [...d.notes, ...sourceNotes, ...(verdict ? [`پێداچوونەوە: ${verdict}`] : [])],
  };
}
