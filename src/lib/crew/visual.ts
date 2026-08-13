// ═══════════ ئەیجێنتی ٧ — وێنەگەڕ ═══════════
//
// «another agent search for image».
//
// ─── دوو کاری جیاواز، و دووەمیان نوێیە ───
//   ١) **بڕیاردان** — کام سلاید بەڕاستی وێنەی دەوێت؟ ئەمە
//      یەکەم جارە کە هەموو دێککەکە پێکەوە دەبیندرێت. نووسەری
//      بەشێک نازانێت سێ بەشی تر وێنەیان داواکردووە یان نا.
//   ٢) **دەستەواژەکە** — پرۆمپتێکی خراپ («illustration of the
//      concept») هیچ ناگەڕێنێتەوە لە Openverse. پرۆمپتێکی
//      دیاریکراو («fiber optic cable cross section») دەگەڕێنێتەوە.
//
// ─── سنووری وێنە ───
// ١ لە ١١ دێکک سەرتاپا دەق دەردەچوو، بۆیە سنوورێکی خوارەوە هەیە:
// کەمترین `N/3`. مۆدێل دەکرێت کەمتر بنێرێت — کۆد پڕی دەکاتەوە.
//
// ─── Openverse یەکەم ───
// بڕیاری خاوەنی بەرهەمەکە: لە ڕێڕەوی خۆکاردا وێنەی ڕاستەقینەی
// مۆڵەتدار پێش وێنەی دروستکراو دێت. بڕوانە `resolveImage.prefer`.

import { layoutById } from '../layouts';
import { compose } from '../deck/compose';
import { promptFromTitle, resolveImage } from '../tools/slideImage';
import type { Slide } from '../types';
import { ask, checkStop } from './ask';
import type { CrewOpts, Draft } from './types';

const SCHEMA = {
  type: 'object',
  properties: {
    images: {
      type: 'array',
      items: {
        type: 'object',
        properties: { at: { type: 'number' }, prompt: { type: 'string' } },
        required: ['at', 'prompt'],
      },
    },
  },
  required: ['images'],
};

/**
 * ئایا وێنە بەم سلایدە دەگونجێت؟
 *
 * چارت، خشتە، هەنگاو، KPI و وتە شوێنەکەیان پڕکردووە — وێنە
 * شتێکی زیادە دەبێت کە هیچ ناڵێت، و `compose()` هەر شوێنی
 * بۆ نادۆزێتەوە.
 */
const suits = (s: Slide) =>
  !s.chart && !s.table && !s.steps?.length && !s.kpis?.length
  && !s.timeline?.length && !s.quote && s.shape !== 'divider';

export async function visual(d: Draft, o: CrewOpts): Promise<Draft> {
  const floor = Math.max(1, Math.round(d.slides.length / 3));

  // ─── ١) بڕیاردان ───
  const wanted = new Map<number, string>();
  try {
    const list = d.slides
      .map((s, i) => {
        const gist = (s.bullets.length ? s.bullets : s.body ? [s.body] : [])
          .slice(0, 2).map(b => b.slice(0, 70)).join(' | ');
        return `[${i}] (${s.shape ?? 'list'}) ${s.title}${gist ? `\n     ${gist}` : ''}`;
      })
      .join('\n');

    const r = await ask<{ images?: { at?: number; prompt?: string }[] }>(o, {
      schema: SCHEMA,
      temperature: 0.3,
      prompt: `
A presentation on "${o.topic}" has these ${d.slides.length} content slides:

${list}

Choose which slides get a picture, and write the search phrase for each.

── WHICH SLIDES ──
Pick AT LEAST ${floor} and at most ${Math.max(floor, Math.round(d.slides.length / 2))}.
A deck of only text is a bad deck; a deck where every slide has a stock photo
is worse. Choose the slides where a picture carries information the words
cannot: a physical object, a real place, a structure, a piece of apparatus, a
historical scene, a named organism, a diagram of a mechanism.

Do NOT choose a slide where the picture would only decorate — a list of
advantages, a definition, an abstract argument. On those, a photo costs the
reader attention and returns nothing.

── THE PHRASE ──
This goes to an image search of real photographs (Openverse: museums, NASA,
universities, Wikimedia Commons). Write what a photograph of the thing would
be catalogued as, NOT an art direction:

  right:   "fiber optic cable cross section"
  right:   "wind turbine nacelle interior"
  right:   "Egyptian papyrus Rhind mathematical"
  wrong:   "a clean modern illustration representing data flow"
  wrong:   "conceptual image of innovation"

ENGLISH ONLY — the archives are catalogued in English. 3 to 6 words. Concrete
nouns. No adjectives about style, no "illustration", no "concept", and never
ask for words or letters inside the image.

If a slide genuinely has nothing photographable, leave it out — but you must
still reach ${floor}.

Return ONLY valid JSON: {"images":[{"at":0,"prompt":"..."}]}
`.trim(),
    });

    for (const g of r.images ?? []) {
      const at = Math.round(Number(g.at));
      const prompt = g.prompt?.trim();
      if (!Number.isFinite(at) || at < 0 || at >= d.slides.length || !prompt) continue;
      if (!suits(d.slides[at])) continue;      // شوێنەکەی پڕە — بێسوودە
      wanted.set(at, prompt.slice(0, 200));
    }
  } catch (e) {
    o.onNote?.(`هەڵبژاردنی وێنەکان نەکرا: ${(e as Error).message}`);
  }

  // ─── ٢) سنوورەکە بە کۆد جێبەجێ دەکرێت ───
  // تاقیکراوەتەوە: ١ لە ١١ دێکک بێ وێنە دەردەچوو. داواکاری
  // پرۆمپت بەس نییە بۆ ئەوەی دووبارە نەبێتەوە.
  for (let i = 0; i < d.slides.length && wanted.size < floor; i++) {
    if (wanted.has(i) || !suits(d.slides[i])) continue;
    wanted.set(i, promptFromTitle(d.slides[i].title, o.topic));
  }

  // ─── ٣) بەڵێنەکان دادەنرێن ───
  // ئەوانەی هەڵنەبژێردران `imagePrompt` ـیان لادەبرێت: نووسەرەکە
  // دەکرێت داوای وێنەیەکی کردبێت کە ئێستا ڕەت کراوەتەوە، و
  // بەڵێنێکی نەبڕاو `compose()` بەرەو تەختەبەندێکی وێنەدار
  // دەبات — واتە هەر ئەو چوارگۆشە خۆڵەمێشییە.
  let slides = d.slides.map((s, i) => {
    const p = wanted.get(i);
    if (p) return { ...s, imagePrompt: p };
    return s.imagePrompt ? { ...s, imagePrompt: undefined } : s;
  });

  // تەختەبەندەکان دەگۆڕدرێن تاکو شوێنی وێنە هەبێت — بەبێ ئەمە
  // سلایدێکی «list» بە وێنەیەکەوە دەکەوێتە `L_icons` کە شوێنی
  // وێنەی نییە، و وێنە هێنراوەکە ون دەبێت
  slides = compose(slides, { lang: o.lang });

  if (!o.images) {
    o.onNote?.('وێنە داوا نەکراوە — تەنها دەستەواژەکان دانران');
    return { ...d, slides };
  }

  // ─── ٤) هێنان ───
  const need = slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => layoutById(s.layout).needs.includes('image') || s.imagePrompt);

  const ai = o.imageKey && o.imageProvider
    ? { provider: o.imageProvider, key: o.imageKey } : undefined;

  let done = 0, failed = 0, last = '';
  for (const [n, { s, i }] of need.entries()) {
    checkStop(o);
    o.onNote?.(`وێنە ${n + 1} لە ${need.length}…`);
    const prompt = s.imagePrompt || promptFromTitle(s.title, o.topic);
    try {
      const r = await resolveImage({
        prompt, ai,
        // بڕیاری خاوەنی بەرهەمەکە — بڕوانە سەرەوە
        prefer: 'free',
        onNote: t => o.onNote?.(`وێنە ${n + 1} لە ${need.length} — ${t}`),
      });
      slides[i] = { ...slides[i], imagePrompt: prompt, imageUrl: r.dataUrl, imageCredit: r.credit };
      done++;
    } catch (e) {
      failed++;
      last = (e as Error).message;
    }
  }

  const notes = [...d.notes];
  if (failed && !done) notes.push(`هیچ وێنەیەک دانەنراوە. هۆکار: ${last}`);
  else if (failed) notes.push(`${done} وێنە دانرا، ${failed} شکستی هێنا.`);

  o.onSlides?.(slides);
  return { ...d, slides, notes };
}
