// ═══════════ ئامرازەکانی وێنە ═══════════
//
// هەموویان لە وێبگەڕەکەی بەکارهێنەردا کاردەکەن — هیچ سێرڤەرێک، هیچ API ـێک.

/** خاڵێکی سڕینەوە — شوێن و تیرەیی، بە ڕێژەی ٠–١ لەسەر وێنەکە */
export interface Stroke { x: number; y: number; r: number }

const load = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('وێنەکە نەخوێندرایەوە'));
    img.src = src;
  });

/**
 * سڕینەوەی بەشێک لە وێنەکە.
 *
 * لەبری ئەوەی شوێنەکە بەتاڵ بێت — کە خراپتر دەردەکەوێت لە نیشانەی ئاوی —
 * ڕەنگی دەوروبەری تێدا دەچێنرێت. بۆ نیشانەی ئاوی لەسەر پاشبنەمایەکی
 * هاوڕەنگ باشە، کە باوترین حاڵەتە.
 *
 * ئەمە inpainting ـی ڕاستەقینە نییە — بەڵام سێرڤەری ناوێت.
 */
export async function eraseAreas(dataUrl: string, strokes: Stroke[]): Promise<string> {
  if (!strokes.length) return dataUrl;
  const img = await load(dataUrl);

  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas نەکرایەوە');
  ctx.drawImage(img, 0, 0);

  for (const s of strokes) {
    const cx = s.x * c.width, cy = s.y * c.height;
    const r = s.r * Math.max(c.width, c.height);

    // ڕەنگی دەوروبەر لە چوار لای بازنەکەوە وەردەگرین
    const ring = sampleRing(ctx, cx, cy, r * 1.35, c.width, c.height);

    // پڕکردنەوە بە لێڵی، تا کەناری دیار نەبێت
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgb(${ring[0]},${ring[1]},${ring[2]})`);
    g.addColorStop(0.72, `rgb(${ring[0]},${ring[1]},${ring[2]})`);
    g.addColorStop(1, `rgba(${ring[0]},${ring[1]},${ring[2]},0)`);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return c.toDataURL('image/png');
}

/** ڕەنگی مامناوەندی بازنەیەک بە دەوری خاڵێکدا */
function sampleRing(ctx: CanvasRenderingContext2D, cx: number, cy: number,
                    r: number, w: number, h: number): [number, number, number] {
  let R = 0, G = 0, B = 0, n = 0;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    const x = Math.round(Math.min(w - 1, Math.max(0, cx + Math.cos(a) * r)));
    const y = Math.round(Math.min(h - 1, Math.max(0, cy + Math.sin(a) * r)));
    const d = ctx.getImageData(x, y, 1, 1).data;
    R += d[0]; G += d[1]; B += d[2]; n++;
  }
  return n ? [Math.round(R / n), Math.round(G / n), Math.round(B / n)] : [255, 255, 255];
}

// ═══════════ گوشینی وێنە ═══════════
//
// کێشەکە: هەموو وێنەیەک وەک `data:` URI لەناو دێککەکەدا خەزن دەکرێت،
// بۆیە دێککێک خۆی تەواوە — بەڵام دێککێکی ١٢ سلایدی بە شەش وێنەی PNG
// ی خاوەوە دەگاتە دەیان مێگابایت لە IndexedDB، لە بیرەوەری، لە دەستەی
// پووچکردنەوە، و لە فایلی هەناردەکراوی .json دا.
//
// ─── بۆچی JPEG، نەک WebP؟ ───
// pptxgenjs جۆری وێنە لە `data:` URI ـەکەوە دەخوێنێتەوە
// (`/image\/(\w+);/`) و هەمان جۆر لە `[Content_Types].xml` دا ڕادەگەیەنێت.
// واتە WebP دەبێتە `ContentType="image/webp"` — کە PowerPoint 2016 و
// کۆنتر پشتگیری ناکەن و وێنەکە بە شکاوی دەردەکەوێت. خوێندکارەکان هەر
// وەشانێکی Office یان لەبەردەستدایە، بۆیە C9 (فایلێکی کارا) لە قەبارە
// گرنگترە. JPEG لە هەموو وەشانێکدا کاردەکات.
//
// شەفافی: JPEG ـی نییە. بۆیە ئەگەر وێنەکە شەفافی هەبوو، PNG دەمێنێتەوە
// (تەنها بچووک دەکرێتەوە). ئەگەرنا دەبێتە JPEG.

/** ئایا هیچ پیکسڵێکی ناتەواو-ڕەق تێدایە؟ */
function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

/**
 * قەبارەی `data:` URI ـێک بە بایت (نزیکەیی).
 * base64 هەر ٣ بایتێک دەکاتە ٤ پیت.
 */
export function dataUrlBytes(uri: string): number {
  const i = uri.indexOf(',');
  if (i < 0) return uri.length;
  const b64 = uri.length - i - 1;
  return Math.round(b64 * 0.75) - (uri.endsWith('==') ? 2 : uri.endsWith('=') ? 1 : 0);
}

/**
 * وێنە بچووک و گوشراو دەکاتەوە پێش خەزنکردن.
 *
 * ئەگەر وێنەکە پێشتر بچووک و گوشراو بێت، هەمان زنجیرە دەگەڕێتەوە —
 * گوشینی دووبارە تەنها جوانی لەدەست دەدات بەبێ سوود.
 *
 * لە دەرەوەی وێبگەڕ (سکریپتەکانی پشکنین) بەبێ گۆڕان دەگەڕێتەوە.
 */
export async function compressImage(
  dataUri: string, maxDim = 1920, quality = 0.82,
): Promise<string> {
  if (!dataUri.startsWith('data:image/')) return dataUri;
  // SVG بە ئەنقەست دەستی لێنادرێت — فۆرماتێکی ڕێژەییە، گوشین مانای نییە
  if (dataUri.startsWith('data:image/svg')) return dataUri;
  if (typeof document === 'undefined') return dataUri;

  try {
    const img = await load(dataUri);
    const src = dataUri.slice(11, dataUri.indexOf(';')).toLowerCase();
    const big = Math.max(img.naturalWidth, img.naturalHeight);
    const k = Math.min(1, maxDim / (big || 1));

    // ئاڵنگاری: وێنەیەکی بچووکی JPEG هەرگیز نابێت دووبارە بگوشرێت
    if (k === 1 && src === 'jpeg') return dataUri;

    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return dataUri;

    // JPEG پاشبنەمای ڕەش دەداتە شوێنی شەفاف — سپی دەخەینە ژێری
    const keepPng = src !== 'jpeg';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const alpha = keepPng && hasAlpha(ctx, c.width, c.height);

    if (alpha) {
      const out = c.toDataURL('image/png');
      return out.length < dataUri.length ? out : dataUri;
    }

    // شەفافی نییە — سپی لە ژێرەوە و ئینجا JPEG
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over';

    const out = c.toDataURL('image/jpeg', quality);
    // toDataURL دەکرێت شکست بێنێت و 'data:,' بگەڕێنێتەوە
    if (!out.startsWith('data:image/jpeg')) return dataUri;
    return out.length < dataUri.length ? out : dataUri;
  } catch {
    // هەر شتێک بشکێت، وێنە خاوەکە باشترە لە هیچ
    return dataUri;
  }
}

/**
 * وێنە دەخوێنێتەوە، بچووکی دەکاتەوە و دەیگوشێت.
 * وێنەی خاو دەتوانێت چەند مێگابایت بێت و پرۆژەکە قورس بکات.
 */
export function readImage(file: File, max = 1600): Promise<{ url: string; w: number; h: number }> {
  return new Promise((res, rej) => {
    if (!/^image\/(png|jpeg|jpg|gif|webp|avif)$/i.test(file.type))
      return rej(new Error('تەنها PNG، JPG، GIF، WEBP ڕێپێدراون'));

    const fr = new FileReader();
    fr.onerror = () => rej(new Error('فایلەکە نەخوێندرایەوە'));
    fr.onload = async () => {
      try {
        const raw = String(fr.result);
        const img = await load(raw);
        const url = await compressImage(raw, max);
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        res({
          url,
          w: Math.round(img.naturalWidth * k),
          h: Math.round(img.naturalHeight * k),
        });
      } catch (e) { rej(e as Error); }
    };
    fr.readAsDataURL(file);
  });
}
