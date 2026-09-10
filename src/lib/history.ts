// ═══════════ مێژووی پووچکردنەوە ═══════════
//
// کێشەکە: ئێدیتەرەکە تا ٦٠ وێنەی تەواوی دێککەکە هەڵدەگرت. وێنەکان وەک
// `data:` URI لەناو دێککەکەدان، بۆیە بەکارهێنەرێک کە شەش جار وێنەی
// سلایدێک بگۆڕێت، شەش وێنەکەی هەر شەشیان لە بیرەوەریدا دەمێننەوە —
// تەنانەت ئەوانەی هەرگیز ناگەڕێنەوە.
//
// دوو تێبینی وردتر:
//
//   ١) زنجیرەکان لە JavaScript دا هاوبەشن. ئەگەر تەنها پاشبنەما بگۆڕێت،
//      ٦٠ سنێپشاتەکە هەموویان هەمان زنجیرەی وێنە بەکاردەهێنن — واتە
//      کێشەکە تەنها کاتێک ڕوودەدات کە وێنە **بگۆڕدرێت**.
//
//   ٢) بەڵام دوای `importDeck` یان `compressDeck`، زنجیرەی وێکچوو
//      ئۆبجێکتی جیاوازن. بۆیە حەوزێکی ناوەڕۆک-ناونیشانکراو پێویستە،
//      نەک تەنها متمانە بە هاوبەشی زنجیرەکان.
//
// چارەسەرەکە:
//   • وێنەکان لە سنێپشاتەکاندا دەگۆڕدرێن بە ناسنامەیەکی کورت، و
//     ناوەڕۆکەکە یەکجار لە حەوزێکدا دەمێنێتەوە لەگەڵ ژمێرەری ئاماژە.
//   • سنووری مێژوو هەم بە ژمارە و هەم بە **بایت** ـە. دێککێکی دەقی
//     ٦٠ هەنگاو هەڵدەگرێت؛ دێککێکی پڕ وێنە کەمتر — بەڵام هەرگیز
//     زیاتر لە بودجەکە بەکارناهێنێت.

import type { Deck, Slide, SlideElement } from './types';

const IMG_RE = /^data:image\//;
/** ناسنامەی ناوەڕۆک — درێژی + سەرەتا + کۆتایی. بەبێ هاش کردنی
 *  زنجیرەیەکی چەند مێگابایتی لە هەر هەنگاوێکدا. */
const keyOf = (uri: string) =>
  `${uri.length}:${uri.slice(24, 56)}:${uri.slice(-24)}`;

const bytesOf = (uri: string) => Math.round((uri.length - 40) * 0.75);

/** ئاماژەیەک بۆ وێنەیەکی ناو حەوزەکە.
 *
 *  پیتی U+0000 بە `\u0000` دەنووسرێت، نەک بە خۆی. پێشتر پیتەکە خۆی
 *  لێرەدا بوو، و ئەگەر هەر ئامێرێک لایبردایە `REF` دەبووە `'img:'` ـی
 *  ساکار — ئەو کاتە هەر دەقێکی سلاید کە بە «img:» دەستپێبکات وەک
 *  ئاماژەیەکی وێنە لێکدەدرایەوە، و مێژووەکە بێدەنگ تێکدەچوو. */
const REF = '\u0000img:';

interface Entry { uri: string; n: number }

export interface HistoryOpts {
  /** زۆرترین ژمارەی هەنگاو */
  maxSteps?: number;
  /** زۆرترین بایتی وێنە کە مێژوو ڕێگای پێدەدات هەڵیبگرێت */
  maxBytes?: number;
}

/**
 * مێژووی دێکک بە حەوزی وێنەوە.
 *
 * `push` دەقاودەق وەک پێشوو بەکاردێت — بەڵام ئەوەی دەخەزنرێت
 * سنێپشاتێکی سووکە کە وێنەکانی لێ لابراون.
 */
export class DeckHistory {
  private undoStack: Deck[] = [];
  private redoStack: Deck[] = [];
  private pool = new Map<string, Entry>();
  private maxSteps: number;
  private maxBytes: number;

  constructor(o: HistoryOpts = {}) {
    this.maxSteps = o.maxSteps ?? 60;
    // ٦٤ مێگابایت — بەشی زۆربەی دێککەکان دەکات، و لە سنووری
    // بیرەوەری تابێکی وێبگەڕ زۆر خوارترە.
    this.maxBytes = o.maxBytes ?? 64 * 1024 * 1024;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get steps()   { return this.undoStack.length; }

  /** بایتی وێنەی خەزنکراو — ئەمە قەبارەی ڕاستەقینەی مێژووەکەیە */
  bytes(): number {
    let n = 0;
    for (const e of this.pool.values()) n += bytesOf(e.uri);
    return n;
  }

  /** گۆڕانێکی نوێ — دۆخی پێشوو تۆمار دەکرێت */
  push(previous: Deck) {
    this.undoStack.push(this.dehydrate(previous));
    for (const d of this.redoStack) this.release(d);
    this.redoStack = [];
    this.trim();
  }

  /** دۆخی پێشوو دەگەڕێنێتەوە. `current` دەچێتە ناو ڕیزی دووبارەکردنەوە. */
  undo(current: Deck): Deck | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(this.dehydrate(current));
    const out = this.hydrate(prev);
    this.release(prev);
    return out;
  }

  redo(current: Deck): Deck | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(this.dehydrate(current));
    const out = this.hydrate(next);
    this.release(next);
    return out;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.pool.clear();
  }

  // ─────────── ناوەوە ───────────

  /** هەنگاوی کۆن دەردەکرێن تا هەردوو سنوور ڕەچاو بکرێن */
  private trim() {
    while (this.undoStack.length > this.maxSteps) {
      const gone = this.undoStack.shift();
      if (gone) this.release(gone);
    }
    // بودجەی بایت — هەمیشە لانیکەم یەک هەنگاو دەمێنێتەوە، ئەگەرنا
    // وێنەیەکی گەورە پووچکردنەوە بەتەواوی لەکار دەخات.
    while (this.undoStack.length > 1 && this.bytes() > this.maxBytes) {
      const gone = this.undoStack.shift();
      if (gone) this.release(gone);
    }
  }

  private put(uri: string): string {
    const k = keyOf(uri);
    const e = this.pool.get(k);
    if (e) e.n++;
    else this.pool.set(k, { uri, n: 1 });
    return REF + k;
  }

  private get(ref: string): string {
    return this.pool.get(ref.slice(REF.length))?.uri ?? '';
  }

  private drop(ref: string) {
    const k = ref.slice(REF.length);
    const e = this.pool.get(k);
    if (!e) return;
    if (--e.n <= 0) this.pool.delete(k);
  }

  /** وێنەکان لە دێککێکدا دەگۆڕێت — `swap` بڕیار دەدات بۆ چی */
  private walk(d: Deck, swap: (v: string) => string | null): Deck {
    const slides: Slide[] = d.slides.map(s => {
      let out = s;
      if (s.imageUrl) {
        const v = swap(s.imageUrl);
        if (v !== null) out = { ...out, imageUrl: v };
      }
      if (s.elements?.some(e => e.kind === 'image')) {
        const els: SlideElement[] = s.elements.map(e => {
          if (e.kind !== 'image') return e;
          const v = swap(e.value);
          return v === null ? e : { ...e, value: v };
        });
        out = { ...out, elements: els };
      }
      return out;
    });

    let titleInfo = d.titleInfo;
    if (d.titleInfo.logoUrl) {
      const v = swap(d.titleInfo.logoUrl);
      if (v !== null) titleInfo = { ...titleInfo, logoUrl: v };
    }

    return { ...d, slides, titleInfo };
  }

  private dehydrate(d: Deck): Deck {
    return this.walk(d, v => (IMG_RE.test(v) ? this.put(v) : null));
  }

  private hydrate(d: Deck): Deck {
    return this.walk(d, v => (v.startsWith(REF) ? this.get(v) : null));
  }

  /** ئاماژەکانی سنێپشاتێک کەم دەکاتەوە — بەبێ ئەمە حەوزەکە پاک نابێتەوە */
  private release(d: Deck) {
    this.walk(d, v => { if (v.startsWith(REF)) this.drop(v); return null; });
  }
}
