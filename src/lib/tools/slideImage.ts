// ═══════════ دابینکردنی وێنە بۆ سلاید ═══════════
//
// یەک ڕێگا بۆ هەموو شوێنێک: ویزارد، ئێدیتەر و ئەیجێنت.
//
// هەڵسوکەوت:
//   ١) ئەگەر AI داواکراوە و کلیل هەیە → هەوڵی دروستکردن بدە
//   ٢) ئەگەر شکستی هێنا (سنوور، کرێدیت، هەڵە) → بگەڕێوە بۆ Openverse
//   ٣) هەرگیز بێدەنگ مەبە — هۆکاری شکستەکە بگەڕێنەوە
//
// بەمە سلاید بەبێ هۆکاری ڕوون بێ وێنە نامێنێتەوە.

import { makeImage } from '../llm';
import { compressImage } from '../imagetool';
import type { ProviderId } from '../providers';
import { searchImages, imageToDataUrl } from './data';

/**
 * پانتایی وێنە لە سلایددا هەرگیز لە ١٥٩٦px تێناپەڕێت (پانی کارتەکە)،
 * بۆیە ١٩٢٠ زیادەیە بۆ چاپکردنیش. لەوە گەورەتر تەنها قەبارە زیاد دەکات.
 */
const MAX_DIM = 1920;

export interface ImageResult {
  dataUrl: string;
  source: 'ai' | 'free';
  /** ناوی خاوەن و مۆڵەت — بۆ وێنەی Creative Commons پێویستە */
  credit?: string;
}

export interface ResolveOpts {
  /** وەسفی وێنەکە بە ئینگلیزی */
  prompt: string;
  /** دروستکردن بە AI — ئەگەر نەبێت، ڕاستەوخۆ Openverse */
  ai?: { provider: ProviderId; key: string };
  /**
   * کام سەرچاوە یەکەم تاقی بکرێتەوە.
   *
   * ─── بۆچی هەڵبژاردنێکە، نەک ڕیزێکی چەسپاو ───
   * `'ai'` بۆ ئەو کاتەیە کە بەکارهێنەر **خۆی** دوگمەی «وێنە بە AI
   * دروست بکە» لێدەدات — لەوێدا داواکە ڕوونە و پاشەکشە بۆ
   * Openverse تەنها تۆڕی سەلامەتییە.
   *
   * `'free'` بۆ ڕێڕەوی خۆکارە (ویزارد و تیمی ئەیجێنت)، بە داوای
   * خاوەنی بەرهەمەکە. سێ هۆکار: وێنەیەکی ڕاستەقینەی مۆڵەتدار بۆ
   * پێشکەشکردنێکی زانکۆیی ڕاستگۆترە لە وێنەیەکی دروستکراو، خەرجی
   * نییە، و سنووری کلیلەکە ناخوات — کە لە دێککێکی پڕ بانگکردندا
   * گرنگە.
   */
  prefer?: 'ai' | 'free';
  /** ڕاپۆرتی هەنگاوەکان */
  onNote?: (note: string) => void;
}

/** پرۆمپتی وێنەی AI دەکاتە دەستەواژەیەکی گونجاو بۆ گەڕان */
function toQuery(prompt: string): string {
  return prompt
    // ئەو وشانەی تەنها بۆ ستایلی AI بەکاردێن، بۆ گەڕان بێسوودن
    .replace(/\b(clean|professional|academic|minimal(ist)?|illustration|vector|flat|3d|render(ing)?|high[- ]quality|detailed|realistic|style|no text|without text|white background)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 6)
    .join(' ')
    .trim();
}

/** وێنەی دروستکراو — هەڵە دەداتەوە ئەگەر کلیل نەبوو یان سنوور تەواو بوو */
async function aiImage(o: ResolveOpts): Promise<ImageResult> {
  if (!o.ai?.key) throw new Error('کلیلی دروستکردنی وێنە دانەنراوە');
  o.onNote?.('دروستکردنی وێنە بە AI…');
  const raw = await makeImage(o.ai.provider, o.ai.key, o.prompt);
  // هەموو وێنەیەک لێرەوە دەڕوات — بۆیە گوشین لێرەدایە، نەک لە
  // هەر بانگکەرێکدا. دێککەکە دەبێت سووک بێت لە هەموو ڕێگایەکەوە.
  return { dataUrl: await compressImage(raw, MAX_DIM), source: 'ai' };
}

/** وێنەی بێبەرامبەری Openverse — مۆڵەتی بازرگانی و دەستکاری */
async function freeImage(o: ResolveOpts): Promise<ImageResult> {
  const query = toQuery(o.prompt) || o.prompt.slice(0, 60);
  o.onNote?.('گەڕان بۆ وێنەی بێبەرامبەر…');
  const hits = await searchImages(query, 10);
  if (!hits.length) throw new Error(`هیچ وێنەیەک بۆ «${query}» نەدۆزرایەوە`);

  // ڕیزبەندییەکە لە `searchImages` ـەوە دێت و هەرسێ شت تێکەڵ دەکات:
  // جۆری سەرچاوە (مۆزەخانە/NASA پێش Flickr)، مۆڵەت (گشتی پێش
  // ناوهێنان)، و پانتایی. پێشتر لێرەدا تەنها بەپێی پانتایی دووبارە
  // ڕیزبەند دەکران — کە ئەو هەڵبژاردنانەی تر پووچ دەکردەوە.
  for (const hit of hits.slice(0, 4)) {
    try {
      return {
        dataUrl: await compressImage(await imageToDataUrl(hit.url), MAX_DIM),
        source: 'free',
        credit: hit.attribution,
      };
    } catch {
      // ئەم هۆستە ڕێگە نەدا — دواتری تاقی بکەرەوە
    }
  }
  throw new Error('وێنەکان دۆزرانەوە بەڵام دانەگیران');
}

export async function resolveImage(o: ResolveOpts): Promise<ImageResult> {
  const errors: string[] = [];

  // ڕیزەکە لە `prefer` ـەوە دێت. ئەوەی دووەم هەمیشە پاشەکشەیە،
  // بۆیە سلاید تەنها کاتێک بێ وێنە دەمێنێتەوە کە **هەردووکیان**
  // شکستیان هێنابێت — و ئەو کاتە هۆکاری هەردووکیان دەگەڕێتەوە.
  const order = o.prefer === 'free' ? [freeImage, aiImage] : [aiImage, freeImage];

  for (const step of order) {
    // بەبێ کلیل، هەوڵی AI تەنها هەڵەیەکی بێمانا زیاد دەکات
    if (step === aiImage && !o.ai?.key) continue;
    try { return await step(o); }
    catch (e) {
      errors.push((e as Error).message);
      o.onNote?.('نەکرا — ڕێگایەکی تر تاقی دەکرێتەوە');
    }
  }

  throw new Error(errors.join(' · ') || 'هیچ سەرچاوەیەکی وێنە بەردەست نییە');
}

/**
 * وەسفێکی وێنە دروست دەکات لە ناونیشانی سلایدەکەوە.
 * پێویستە چونکە مۆدێل زۆرجار `imagePrompt` فەرامۆش دەکات،
 * و ئەو کاتە تەختەبەندێکی وێنەیی بەتاڵ دەمێنێتەوە.
 */
export function promptFromTitle(title: string, topic: string): string {
  const clean = title.replace(/[«»"'?!:.]/g, ' ').trim();
  return `A clean, professional academic illustration about ${clean || topic}. ` +
    'Simple composition, no text or letters in the image.';
}
