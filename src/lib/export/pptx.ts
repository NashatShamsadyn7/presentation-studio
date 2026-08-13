// ═══════════ هەناردەکردن بۆ PowerPoint ═══════════
// سلایدەکان بە شێوەی توخمی ڕەسەن دەنووسرێن — نەک وێنە.
// واتە بەکارهێنەر دەتوانێت لە PowerPoint دا دەقەکان دەستکاری بکات.

import PptxGenJS from 'pptxgenjs';
import { byId } from '../themes';
import { layoutById } from '../layouts';
import { iconSvg, shapeById, svgToPng } from '../icons';
import { fitBlock } from '../fit';
import { decoFor, PPTX_SHAPE } from '../deco';
import { styleById, densityById, BULLET_CODE, type StylePack } from '../styles';
import type { Deck, Slide, SlideElement, SlotId } from '../types';
import { csFontFor } from '../fonts';
import { split, mark } from '../math';
import { styleById as citeStyleById, type CiteStyle } from '../citestyle';
import { finalizePptx } from './morph';

/** پیکسڵ (لە بۆشایی ١٩٢٠×١٠٨٠) → ئینچ */
const I = (px: number) => px / 144;
/** پیکسڵ → پۆینتی فۆنت */
const PT = (px: number) => px / 2;

const W = 1920, H = 1080;
const CARD = { x: 154.5, y: 136.4, w: 1596.6, h: 859.5 };
const PAD_X = 76, PAD_Y = 62;
const BODY_Y = CARD.y + PAD_Y + 128;          // ژێر ناونیشان و هێڵەکە
const BODY_H = CARD.h - PAD_Y * 2 - 128;
const BODY_X = CARD.x + PAD_X;
const BODY_W = CARD.w - PAD_X * 2;

const hex = (c: string) => c.replace('#', '').toUpperCase();

/** بەرزی دێڕی پەرەگرافی درێژ — هەمان ژمارە لە globals.css دا (.prose).
 *  ئەگەر جیا بن، ژمێردنی گونجاندن لە هەردوو لادا جیاواز دەبێت. */
const PROSE_LH = 1.55;

/**
 * PowerPoint تەنها یەک ناوی فۆنت قبووڵ دەکات — نەک زنجیرەی CSS.
 * "Georgia,'Times New Roman',serif" → "Georgia"
 * بەبێ ئەمە PowerPoint فۆنتەکە نادۆزێتەوە و دەگەڕێتەوە بۆ Calibri،
 * واتە هەناردەکراوەکە هەرگیز لە پێشبینینەکە ناچێت.
 */
export function primaryFont(cssStack: string): string {
  const first = cssStack.split(',')[0].trim().replace(/^["']|["']$/g, '');
  return first || 'Georgia';
}

/**
 * سنووری ناوەوەی خانەی دەق.
 * CSS ی ئێمە padding نییە لەسەر دەقەکان، بەڵام PowerPoint بە بنەڕەت
 * ٠.٠٥ ئینچ دادەنێت — کە دەق لە شوێنی خۆی لادەدات.
 */
const NOPAD: [number, number, number, number] = [0, 0, 0, 0];

/**
 * ئاراستەی دەق لە ناوەڕۆکەکەیەوە دەخوێنێتەوە — نەک لە زمانی دێککەوە.
 * لە لاپەڕەی سەرەتادا ناوی زانکۆ زۆرجار ئینگلیزییە بەڵام ناوی خوێندکار
 * کوردی — بۆیە هەر دەقێک ئاراستەی خۆی دەوێت، نەک یەک ئاراستە بۆ هەموویان.
 */
const RTL_CHARS = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const isRtl = (text: string) => RTL_CHARS.test(text);


interface Ctx {
  pptx: PptxGenJS;
  s: PptxGenJS.Slide;
  t: ReturnType<typeof byId>;
  font: string;
  rtl: boolean;
  /** شێوازی دیزاین — هەمان پاکێجی پێشبینین */
  st: StylePack;
  /** ڕێژەی قەبارەی فۆنت لە چڕی دەقەوە */
  scale: number;
  /** شێوازی سەرچاوەنووسین — لاپەڕەی ژێدەرەکان بەمە دەگۆڕێت */
  cite: CiteStyle;
  /**
   * دەستکارییەکانی ئێدیتەر بۆ ئەم سلایدە.
   *
   * ═══ ئەمە بە تەواوی ون دەبوو ═══
   * `pptx.ts` هەرگیز `overrides` ـی نەدەخوێندەوە — نە دەقی
   * دەستکاریکراو، نە قەبارەی فۆنت، نە شاردنەوە. واتە خوێندکار
   * ناونیشانێکی سلاید لەسەر کەنڤاسەکە دەگۆڕی، فایلەکەی هەناردە
   * دەکرد، و **ناونیشانە کۆنەکەی تێدا بوو** — بەبێ هیچ
   * ئاگادارکردنەوەیەک. تێبینییەکەی `CLAUDE.md` تەنها باسی
   * لاپەڕەی سەرەتای دەکرد؛ کێشەکە هەموو دێککەکەی دەگرتەوە.
   */
  ov?: Slide['overrides'];
}

/** دەستکاریی خانەیەک — بەتاڵ ئەگەر نەگۆڕدرابێت */
const slotOf = (c: Ctx, slot: SlotId) => c.ov?.[slot];

/** ئایا ئەم خانەیە لە ئێدیتەردا شاردراوەتەوە؟ */
const isHidden = (c: Ctx, slot: SlotId) => !!slotOf(c, slot)?.hidden;

/**
 * ڕیزبەندی خاڵ بۆ PowerPoint.
 * `num` لیستی ژمارەیی ڕەسەنە؛ ئەوانی تر نیشانەیەکی Unicode ـن.
 *
 * ئاگاداری: `{ type: 'bullet', code: … }` هیچ ناکات. pptxgenjs یەکەم
 * جار `bullet.type` دەپشکنێت، و ئەگەر 'number' نەبوو هیچ نانووسێت —
 * و بەهۆی `else if` ـەکە هەرگیز ناگاتە `code`. ئەنجامەکە `<a:buNone/>`
 * ـە. بۆیە دەبێت `characterCode` بەبێ `type` بنێردرێت.
 */
function bulletOpt(st: StylePack): PptxGenJS.TextPropsOptions['bullet'] {
  return st.bullet === 'num'
    ? { type: 'number' }
    : { characterCode: BULLET_CODE[st.bullet] };
}

// ─────────── پارچە هاوبەشەکان ───────────

function background(c: Ctx, withCard: boolean, slideIndex = 0) {
  const { s, t } = c;
  s.background = { color: hex(t.v['--slide-bg']) };

  // ڕازاندنەوەکان — هەمان ژمێرەری پێشبینین، بۆیە دەقاودەق وەک یەکن.
  //
  // ناوی شێوەکان گرنگە: Morph بە option="byObject" شێوەکان بە ناو
  // دەناسێتەوە. هەمان ناو لە هەموو سلایدەکاندا = PowerPoint دەیانجوڵێنێت
  // لەبری ئەوەی بیانسڕێتەوە و لەنوێ دروستیان بکاتەوە.
  for (const d of decoFor(slideIndex, c.st.deco)) {
    s.addShape(PPTX_SHAPE[d.kind] as PptxGenJS.SHAPE_NAME, {
      objectName: d.name,
      x: I(d.x), y: I(d.y), w: I(d.size), h: I(d.size),
      rotate: d.rotate,
      fill: { color: hex(t.v[d.tone]), transparency: Math.round((1 - d.opacity) * 100) },
      line: { type: 'none' },
      ...(d.kind === 'round' ? { rectRadius: 0.18 } : {}),
    });
  }

  // ─── کرۆمی شێواز — دەقاودەق وەک CSS ی پێشبینین ───
  if (c.st.accent === 'edge')
    s.addShape('rect', {
      objectName: 'chromeEdge',
      x: I(c.rtl ? W - 26 : 0), y: 0, w: I(26), h: I(H),
      fill: { color: hex(t.v['--pri']) }, line: { type: 'none' },
    });

  if (withCard && c.st.accent === 'band')
    s.addShape('rect', {
      objectName: 'chromeBand',
      x: I(CARD.x), y: I(CARD.y), w: I(CARD.w), h: I(196),
      fill: { color: hex(t.v['--pri']) }, line: { type: 'none' },
    });

  if (withCard && c.st.card !== 'none') {
    // کارتەکە — سێ چێژ، هەمان چوارچێوە
    if (c.st.card === 'outline')
      s.addShape('rect', {
        objectName: 'cardFrame',
        x: I(CARD.x), y: I(CARD.y), w: I(CARD.w), h: I(CARD.h),
        fill: { type: 'none' }, line: { color: hex(t.v['--pri']), width: 3 },
      });
    else if (c.st.card === 'solid')
      s.addShape('roundRect', {
        objectName: 'cardSheet',
        x: I(CARD.x), y: I(CARD.y), w: I(CARD.w), h: I(CARD.h), rectRadius: 0.02,
        fill: { color: t.dark ? '181A1E' : 'FFFFFF', transparency: t.dark ? 8 : 6 },
        line: { color: t.dark ? 'FFFFFF' : '000000', transparency: 88, width: 1 },
      });
    else
      s.addShape('roundRect', {
        objectName: 'cardGlass',
        x: I(CARD.x), y: I(CARD.y), w: I(CARD.w), h: I(CARD.h), rectRadius: 0.12,
        fill: { color: t.dark ? '000000' : 'FFFFFF', transparency: t.dark ? 92 : 55 },
        line: { color: 'FFFFFF', transparency: t.dark ? 86 : 40, width: 1.5 },
      });
  }
}

function heading(c: Ctx, text: string) {
  const { s, t, st } = c;
  // خانەی شاردراوە هەرگیز نانووسرێت — پێشتر لە پێشبینیندا نەدەبیندرا
  // بەڵام لە فایلی هەناردەکراودا هەر دەردەکەوت
  if (isHidden(c, 'title')) return;

  const o = slotOf(c, 'title');
  // دەقی دەستکاریکراو زاڵە — هەمان یاسای `txt()` لە `SlideView`
  const shown = o?.text ?? text;

  // لەسەر تەریقی ڕەق دەقەکە دەبێت سپی بێت، نەک بە ڕەنگی مرەکەب
  const onBand = st.accent === 'band';
  s.addText(shown, {
    x: I((o?.x ?? CARD.x + PAD_X)), y: I(o?.y ?? CARD.y + PAD_Y),
    w: I(o?.w ?? BODY_W), h: I(o?.h ?? 84),
    fontFace: o?.fontFamily ? primaryFont(o.fontFamily) : c.font,
    margin: NOPAD, fontSize: PT(o?.fontSize ?? 62), bold: true, italic: st.titleItalic,
    color: o?.color ? hex(o.color) : onBand ? 'FFFFFF' : hex(t.v['--ink']),
    ...(o?.rotate ? { rotate: o.rotate } : {}),
    align: st.accent === 'twin' ? 'center' : c.rtl ? 'right' : 'left',
    valign: 'top', rtlMode: c.rtl,
  });

  if (st.accent === 'none' || st.accent === 'side') {
    // هێڵێکی باریکی تەواو — تەنها بۆ جیاکردنەوە
    s.addShape('rect', {
      x: I(CARD.x + PAD_X), y: I(CARD.y + PAD_Y + 99), w: I(BODY_W), h: I(2),
      fill: { color: hex(t.v['--ink']), transparency: 72 }, line: { type: 'none' },
    });
  } else if (st.accent === 'twin') {
    s.addShape('rect', {
      x: I(CARD.x + PAD_X), y: I(CARD.y + PAD_Y + 99), w: I(BODY_W), h: I(2),
      fill: { color: hex(t.v['--pri']), transparency: 55 }, line: { type: 'none' },
    });
  } else {
    const rw = st.accent === 'band' ? 120 : st.accent === 'edge' ? 96 : 148;
    s.addShape('roundRect', {
      x: I(c.rtl ? CARD.x + CARD.w - PAD_X - rw : CARD.x + PAD_X),
      y: I(CARD.y + PAD_Y + 96), w: I(rw), h: I(7),
      rectRadius: 0.5,
      fill: { color: hex(st.accent === 'edge' ? t.v['--pri'] : t.v['--acc']) },
      line: { type: 'none' },
    });
  }

  // «پەڕە» هێڵێکی ستوونی ئەستوور لەپاڵ ناونیشانەکەوە هەیە
  if (st.accent === 'side')
    s.addShape('rect', {
      x: I(c.rtl ? CARD.x + CARD.w - PAD_X - 10 : CARD.x + PAD_X - 26),
      y: I(CARD.y + PAD_Y), w: I(10), h: I(76),
      fill: { color: hex(t.v['--pri']) }, line: { type: 'none' },
    });
}

/**
 * خاڵەکان وەک لیستێکی ڕەسەنی PowerPoint.
 *
 * `fitBlock` هەردوو قەبارە و بۆشایی دەداتەوە. بۆشاییەکە دەبێتە
 * `paraSpaceAfter` و خانەکە بە `valign:'middle'` ناوەڕاست دەکرێت —
 * بۆیە دەقی کورت لە ناوەڕاستی سلایددا دەبێت، نەک چەسپاو بە سەرەوەوە.
 */
function bullets(c: Ctx, items: string[], x: number, y: number, w: number, h: number, size = 35) {
  if (!items.length) return;
  const { s, t } = c;
  // هەمان ژمێرەری پێشبینین — بۆیە فایلەکە وەک ئەوەی لەسەر شاشە دەیبینیت
  // چڕی دەق دەبێت لەسەر سنووری سەرەوەش کاربکات، نەک تەنها لەسەر
  // خاڵی دەستپێک — ئەگەر نا، خانەیەکی فراوان هەردووکیان دەگەیەنێتە
  // یەک ژمارە و هەڵبژاردنەکەی بەکارهێنەر هیچ کاریگەرییەکی نابێت.
  const base = Math.round(size * c.scale);
  const f = fitBlock({
    lines: items, width: w, height: h,
    size: base, max: Math.round(base * 1.35),
    lineHeight: 1.4, gap: 25, indent: 42, rtl: c.rtl,
    // قەبارەی دەستی — دەبێت **هەمان** ژمارەی پێشبینین بێت، ئەگەرنا
    // بەکارهێنەر شتێک دەبینێت و فایلەکە شتێکی تر دەردەخات
    fixed: slotOf(c, 'body')?.fontSize,
  });
  s.addText(
    items.map(b => {
      const i = b.indexOf(':');
      const head = i > 0 && i < 40 ? b.slice(0, i + 1) + ' ' : '';
      const rest = head ? b.slice(i + 1).trim() : b;

      // فۆرموولەکان دەبنە ڕەوانەیەکی جیا بە نیشانەیەکەوە. دواتر لە
      // `finalizePptx` دا دەگۆڕدرێن بە هاوکێشەی ڕەسەنی Office.
      const body = split(rest).map(p => ({
        text: p.kind === 'math' ? mark(p.value) : p.value,
      }));

      return head ? [{ text: head, options: { bold: true } }, ...body] : body;
    }).flatMap((parts, idx) => parts.map((p, j) => ({
      text: p.text,
      options: {
        ...('options' in p ? p.options : {}),
        breakLine: j === parts.length - 1 && idx < items.length - 1,
        // بۆشاییەکە دوای هەر خاڵێک — نەک دوای ئەوی کۆتایی
        ...(j === parts.length - 1 && idx < items.length - 1
          ? { paraSpaceAfter: PT(f.gap) } : {}),
        // نیشانەی خاڵ دەبێت لەسەر **هەموو** ڕەوانەکان دابنرێت.
        //
        // دوو هۆکار:
        //   ١) ئەگەر تەنها لە ڕێکخستنی گشتیدا دابنرێت، pptxgenjs تەنها بۆ
        //      یەکەم دانە دایدەنێت (`idx === 0`)، و ئەویش بەهۆی ئەوەی
        //      `align` لە ئاستی گشتیدا هەیە هەرگیز جێبەجێ نەدەکرا.
        //   ٢) pptxgenjs بۆ هەر ڕەوانەیەک `<a:pPr>` ـێک دەنووسێت، تەنانەت
        //      لە ناو یەک پەرەگرافدا. ئەگەر تەنها یەکەمیان خاڵی هەبێت،
        //      دووەمیان `<a:buNone/>` دەنووسێت و یەکەمی پووچ دەکاتەوە.
        //
        // ئەنجامی هەردووکیان: `<a:buNone/>` لەسەر هەموو پەرەگرافێک —
        // فایلی داگیراو هیچ خاڵێکی نەبوو، لە کاتێکدا پێشبینین خاڵی هەبوو.
        bullet: bulletOpt(c.st),
      },
    }))) as PptxGenJS.TextProps[],
    {
      x: I(x), y: I(y), w: I(w), h: I(h),
      fontFace: c.font, margin: NOPAD, fontSize: PT(f.size), color: hex(t.v['--ink']),
      lineSpacingMultiple: 1.4,
      align: c.rtl ? 'right' : 'left', valign: 'middle', rtlMode: c.rtl,
    },
  );
}

function para(c: Ctx, text: string, x: number, y: number, w: number, h: number, size = 32) {
  const base = Math.round(size * c.scale);
  const f = fitBlock({
    lines: [text], width: w, height: h,
    size: base, max: Math.round(base * 1.45), lineHeight: PROSE_LH, rtl: c.rtl,
    fixed: slotOf(c, 'body')?.fontSize,     // وەک `Prose` لە پێشبینیندا
  });
  // پەرەگرافێکی درێژیش دەکرێت فۆرموولی تێدابێت
  const runs = split(text).map(p => ({
    text: p.kind === 'math' ? mark(p.value) : p.value,
  })) as PptxGenJS.TextProps[];
  c.s.addText(runs.length > 1 ? runs : text, {
    x: I(x), y: I(y), w: I(w), h: I(h),
    fontFace: c.font, margin: NOPAD, fontSize: PT(f.size), color: hex(c.t.v['--ink']),
    align: c.rtl ? 'right' : 'left', valign: 'middle',
    lineSpacingMultiple: PROSE_LH, rtlMode: c.rtl,
  });
}

function panel(c: Ctx, x: number, y: number, w: number, h: number, fill?: string) {
  c.s.addShape('roundRect', {
    x: I(x), y: I(y), w: I(w), h: I(h), rectRadius: 0.1,
    fill: fill
      ? { color: hex(fill) }
      : { color: c.t.dark ? '000000' : 'FFFFFF', transparency: c.t.dark ? 92 : 50 },
    line: { color: 'FFFFFF', transparency: c.t.dark ? 88 : 25, width: 1.5 },
  });
}


/**
 * توخمە زیادکراوەکان: ئایکۆن، شێوە و دەق.
 *   • شێوەکان → شێوەی ڕەسەنی PowerPoint (دەستکاریکراو)
 *   • ئایکۆنەکان → PNG ی ڕوون، چونکە PowerPoint SVG بە متمانە پیشان نادات
 *   • دەق → خانەی دەقی ڕەسەن
 */
async function drawElements(c: Ctx, sl: Slide) {
  for (const el of sl.elements ?? []) {
    const color = el.color ?? c.t.v['--pri'];
    const box = { x: I(el.x), y: I(el.y), w: I(el.w), h: I(el.h) };
    const rot = el.rotate ? { rotate: Math.round(el.rotate) } : {};
    const alpha = el.opacity !== undefined && el.opacity < 1
      ? { transparency: Math.round((1 - el.opacity) * 100) } : {};

    if (el.kind === 'image') {
      // چوارچێوە: PowerPoint شێوەی بڕین لەسەر وێنە پشتگیری دەکات
      const shape = el.frame === 'circle' ? 'ellipse'
                  : el.frame === 'round'  ? 'roundRect' : undefined;
      c.s.addImage({
        data: el.value, ...box, ...rot, ...alpha,
        sizing: { type: 'cover', w: I(el.w), h: I(el.h) },
        ...(shape ? { rounding: el.frame === 'circle' } : {}),
      });
      if (el.borderWidth) {
        c.s.addShape((shape ?? 'rect') as PptxGenJS.SHAPE_NAME, {
          ...box, ...rot,
          fill: { type: 'none' },
          line: { color: hex(el.borderColor ?? c.t.v['--pri']), width: el.borderWidth / 2 },
          ...(el.frame === 'round' ? { rectRadius: 0.08 } : {}),
        });
      }
    } else if (el.kind === 'shape') {
      const sh = shapeById(el.value);
      c.s.addShape((sh?.pptx ?? 'rect') as PptxGenJS.SHAPE_NAME, {
        ...box, ...rot,
        fill: { color: hex(color), ...alpha },
        line: { type: 'none' },
      });
    } else if (el.kind === 'icon') {
      try {
        const png = await svgToPng(iconSvg(el.value, color, el.strokeWidth ?? 2), 512);
        c.s.addImage({ data: png, ...box, ...rot, ...alpha });
      } catch { /* ئایکۆن نەکرا بە وێنە — سلاید بەبێی دەڕوات */ }
    } else {
      c.s.addText(el.value, {
        ...box, ...rot,
        fontFace: c.font, margin: NOPAD,
        fontSize: PT(el.fontSize ?? 44),
        bold: el.bold, italic: el.italic,
        color: hex(color), align: 'center', valign: 'middle',
        rtlMode: isRtl(el.value),
      });
    }
  }
}

// ─────────── لاپەڕەی سەرەتا ───────────

function titleSlide(c: Ctx, d: Deck) {
  const { s, t } = c;
  const ti = d.titleInfo;
  background(c, true);

  if (ti.logoUrl) {
    // CSS ی پێشبینین `object-fit:contain` بەکاردەهێنێت. بەبێ sizing،
    // pptxgenjs لۆگۆکە بە زۆر دەکاتە چوارگۆشە و لۆگۆی نەچوارگۆشە دەپەستێت.
    s.addImage({
      data: ti.logoUrl, x: I(1368), y: I(154.2), w: I(342.9), h: I(342.9),
      sizing: { type: 'contain', w: I(342.9), h: I(342.9) },
    });
  }

  const lines = [ti.university, ti.institute, ti.department].filter(Boolean);
  lines.forEach((line, i) => {
    s.addText(line, {
      x: I(255.4), y: I(202.3 + i * 59.8), w: I(760), h: I(68),
      fontFace: c.font, margin: NOPAD, fontSize: PT(44), color: hex(t.v['--ink']),
      align: 'left', valign: 'top', rtlMode: isRtl(line),
    });
  });

  s.addText(ti.title, {
    x: 0, y: I(484.5), w: I(W), h: I(90),
    fontFace: c.font, margin: NOPAD, fontSize: PT(56), bold: true, italic: true,
    color: hex(t.v['--ink']), align: 'center', valign: 'top', rtlMode: isRtl(ti.title),
  });

  s.addText('Prepared:', {
    x: I(211.2), y: I(646.5), w: I(400), h: I(84),
    fontFace: c.font, margin: NOPAD, fontSize: PT(56), italic: true,
    color: hex(t.v['--ink']), align: 'left', valign: 'top',
  });

  ti.students.filter(Boolean).forEach((name, i) => {
    s.addText(`${i + 1}- ${name}`, {
      x: I(236.5 + 35.2 * i), y: I(735 + 56.8 * i), w: I(560), h: I(68),
      fontFace: c.font, margin: NOPAD, fontSize: PT(44), italic: true,
      color: hex(t.v['--ink']), align: 'left', valign: 'top', rtlMode: isRtl(name),
    });
  });

  s.addText(`${ti.teacherPrefix} ${ti.teacherName}`.trim(), {
    x: I(1212.8), y: I(794.3), w: I(560), h: I(84),
    fontFace: c.font, margin: NOPAD, fontSize: PT(56), color: hex(t.v['--ink']),
    align: 'left', valign: 'top', rtlMode: isRtl(ti.teacherName),
  });

  if (ti.year) {
    s.addText(ti.year, {
      x: I(1212.8), y: I(872), w: I(560), h: I(68),
      fontFace: c.font, margin: NOPAD, fontSize: PT(44), color: hex(t.v['--ink']),
      align: 'left', valign: 'top',
    });
  }
}

// ─────────── سلایدی ناوەڕۆک ───────────

/**
 * سلایدی «ناوەڕۆک» — چوار شێواز، هەریەکە بۆ شێوازێکی دیزاین.
 * هەمان ڕیزبەندی و هەمان ژمارەکانی `SlideView.Outline`.
 */
function outlineSlide(c: Ctx, items: string[]) {
  const { s, t } = c;
  if (!items.length) return;
  const kind = c.st.outline;
  const ink = hex(t.v['--ink']);

  const label = (text: string, x: number, y: number, w: number, h: number,
                 size: number, o: Partial<PptxGenJS.TextPropsOptions> = {}) =>
    s.addText(text, {
      x: I(x), y: I(y), w: I(w), h: I(h),
      fontFace: c.font, margin: NOPAD, fontSize: PT(size), color: ink,
      align: c.rtl ? 'right' : 'left', valign: 'middle', lineSpacingMultiple: 1.35,
      rtlMode: c.rtl, ...o,
    });

  // ─── دوو ستوون: بازنەی ژماردراو ───
  if (kind === 'circles' || kind === 'cards') {
    const rows = Math.ceil(items.length / 2);
    const cw = (BODY_W - 66) / 2;
    const rh = BODY_H / rows;
    const f = fitBlock({
      lines: items, width: cw - (kind === 'cards' ? 96 : 84), height: BODY_H * 2,
      size: Math.round((kind === 'cards' ? 35 : 37) * c.scale),
      max: Math.round(50 * c.scale), lineHeight: 1.4, gap: 22,
    });

    items.forEach((b, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = BODY_X + col * (cw + 66);
      const y = BODY_Y + row * rh;
      const chip = f.size * 1.5;
      // لە RTL دا ژمارەکە لە ڕاستەوەیە
      const chipX = c.rtl ? x + cw - chip : x;
      const textX = c.rtl ? x : x + chip + 26;

      if (kind === 'cards')
        s.addShape('roundRect', {
          x: I(x), y: I(y), w: I(cw), h: I(rh - 18), rectRadius: 0.08,
          fill: { color: t.dark ? '000000' : 'FFFFFF', transparency: t.dark ? 92 : 50 },
          line: { color: 'FFFFFF', transparency: t.dark ? 88 : 25, width: 1.5 },
        });

      s.addShape(kind === 'cards' ? 'roundRect' : 'ellipse', {
        x: I(chipX + (kind === 'cards' ? 20 : 0)), y: I(y + (rh - 18 - chip) / 2),
        w: I(chip), h: I(chip), rectRadius: 0.1,
        fill: { color: hex(t.v['--pri']) }, line: { type: 'none' },
      });
      label(String(i + 1), chipX + (kind === 'cards' ? 20 : 0), y + (rh - 18 - chip) / 2,
            chip, chip, f.size * 0.78,
            { color: 'FFFFFF', bold: true, align: 'center', rtlMode: false });

      label(b, textX + (kind === 'cards' ? 26 : 0), y,
            cw - chip - 26 - (kind === 'cards' ? 46 : 0), rh - 18, f.size);
    });
    return;
  }

  // ─── یەک ستوون: ڕیز یان ڕێڵ ───
  const n = items.length;
  const rh = BODY_H / n;
  const lead = 84;
  const f = fitBlock({
    lines: items, width: BODY_W - lead, height: BODY_H,
    size: Math.round(37 * c.scale), max: Math.round(50 * c.scale),
    lineHeight: 1.4, gap: 20,
  });

  if (kind === 'rail')
    s.addShape('rect', {
      x: I(c.rtl ? BODY_X + BODY_W - 18 : BODY_X + 16), y: I(BODY_Y + rh * 0.3),
      w: I(3), h: I(BODY_H - rh * 0.6),
      fill: { color: hex(t.v['--pri-soft']) }, line: { type: 'none' },
    });

  items.forEach((b, i) => {
    const y = BODY_Y + i * rh;
    const textX = c.rtl ? BODY_X : BODY_X + lead;

    if (kind === 'rail') {
      s.addShape('ellipse', {
        x: I(c.rtl ? BODY_X + BODY_W - 28 : BODY_X + 6), y: I(y + rh / 2 - 11),
        w: I(22), h: I(22),
        fill: { color: hex(t.v['--pri']) }, line: { type: 'none' },
      });
    } else {
      // ڕیز — ژمارەی گەورە و هێڵێکی باریک لە ژێری
      label(String(i + 1).padStart(2, '0'),
            c.rtl ? BODY_X + BODY_W - lead : BODY_X, y, lead, rh,
            f.size * 1.16,
            { bold: true, color: hex(t.v['--pri']), rtlMode: false,
              align: c.rtl ? 'right' : 'left' });
      s.addShape('rect', {
        x: I(BODY_X), y: I(y + rh - 10), w: I(BODY_W), h: I(1.5),
        fill: { color: hex(t.v['--pri-soft']) }, line: { type: 'none' },
      });
    }

    label(b, textX, y, BODY_W - lead, rh - 10, f.size);
  });
}

function contentSlide(c: Ctx, sl: Slide, slideIndex: number) {
  const { s, t } = c;
  const def = layoutById(sl.layout);
  background(c, def.card, slideIndex);

  // ئەو تەختەبەندانەی ناونیشانێکی ئاسایییان نییە
  const noHeading = ['L_quote', 'L_state', 'L_def', 'L_divider', 'L_thanks', 'L_hero'];
  if (!noHeading.includes(sl.layout)) heading(c, sl.title);

  switch (sl.layout) {
    // ── دەق و خاڵ ──
    case 'L_outline':
      outlineSlide(c, sl.bullets);
      break;

    // ═══ کارتی تایبەتمەندی — وەک پێشبینینەکە ═══
    // پێشتر لێرەدا تەنها دوو ستوونی خاڵی سادە دەنووسرا، لە کاتێکدا
    // پێشبینینەکە کارتی ژمارەدار بە سەردێڕ و ڕوونکردنەوەوە پیشان
    // دەدا (`.feat` لە `SlideView`). واتە سلایدەکە لە شاشەدا جوان
    // بوو و لە PowerPoint دا سادە — و PowerPoint ئەوەیە کە
    // مامۆستا دەیبینێت.
    case 'L_icons': {
      const items = sl.bullets.filter(Boolean).slice(0, 6);
      const cols = items.length <= 2 ? items.length : items.length === 4 ? 2 : 3;
      const rows = Math.ceil(items.length / cols);
      const gx = 34, gy = 28;
      const cw = (BODY_W - gx * (cols - 1)) / cols;
      const chh = (BODY_H - gy * (rows - 1)) / rows;

      items.forEach((b, i) => {
        const x = BODY_X + (cw + gx) * (i % cols);
        const y = BODY_Y + (chh + gy) * Math.floor(i / cols);
        panel(c, x, y, cw, chh);

        // ژمارەکە جێی ئایکۆنەکە دەگرێتەوە — هەمان شتی `.ic2`
        s.addShape('roundRect', {
          x: I(x + 28), y: I(y + 26), w: I(56), h: I(56), rectRadius: 0.16,
          fill: { color: hex(i % 2 ? t.v['--acc'] : t.v['--pri']) }, line: { type: 'none' },
        });
        s.addText(String(i + 1), {
          x: I(x + 28), y: I(y + 26), w: I(56), h: I(56),
          fontFace: c.font, margin: NOPAD, fontSize: PT(28), bold: true,
          color: i % 2 ? '141414' : 'FFFFFF', align: 'center', valign: 'middle',
        });

        const ci = b.indexOf(':');
        const head = ci > 0 ? b.slice(0, ci).trim() : '';
        const rest = ci > 0 ? b.slice(ci + 1).trim() : b;

        if (head) s.addText(head, {
          x: I(x + 28), y: I(y + 96), w: I(cw - 56), h: I(52),
          fontFace: c.font, margin: NOPAD, fontSize: PT(28), bold: true,
          color: hex(t.v['--ink']), align: c.rtl ? 'right' : 'left', rtlMode: c.rtl,
        });
        para(c, rest, x + 28, y + (head ? 152 : 96), cw - 56, chh - (head ? 172 : 116), 24);
      });
      break;
    }
    case 'L_bullets':
    case 'L_bulletsL': {
      const imgFirst = sl.layout === 'L_bulletsL';
      const tw = BODY_W - 545 - 54;
      const tx = imgFirst ? BODY_X + 545 + 54 : BODY_X;
      const ix = imgFirst ? BODY_X : BODY_X + tw + 54;
      bullets(c, sl.bullets, tx, BODY_Y, tw, BODY_H);
      addImage(c, sl, ix, BODY_Y, 545, BODY_H);
      break;
    }
    case 'L_text':
      if (sl.bullets[0]) para(c, sl.bullets[0], BODY_X, BODY_Y, BODY_W, 70, 39);
      para(c, sl.body ?? '', BODY_X, BODY_Y + (sl.bullets[0] ? 84 : 0), BODY_W, BODY_H - 84);
      break;

    // ═══ خاڵەکان پشتگوێ نەخرێن ═══
    // پێشتر ئەم دوو تەختەبەندە تەنها `body` یان دەخوێندەوە. سلایدێک
    // کە خاڵی هەبوو و `body` ـی نەبوو **بە تەواوی بەتاڵ** هەناردە
    // دەکرا — و پێشبینینەکە باش دەردەکەوت، چونکە `linesOf` لە
    // `compose.ts` دا هەردووکیان دەخوێنێتەوە. بۆیە کێشەکە تەنها
    // لە فایلە داگیراوەکەدا دەردەکەوت.
    case 'L_state':
      s.addText(sl.body || sl.bullets.filter(Boolean).join(' ') || sl.title, {
        x: I(CARD.x + 100), y: I(CARD.y), w: I(CARD.w - 200), h: I(CARD.h),
        fontFace: c.font, margin: NOPAD, fontSize: PT(64), italic: true, color: hex(t.v['--ink']),
        align: 'center', valign: 'middle', lineSpacingMultiple: 1.35, rtlMode: c.rtl,
      });
      break;

    case 'L_def':
      s.addText(sl.title, {
        x: I(BODY_X), y: I(CARD.y + 230), w: I(BODY_W), h: I(120),
        fontFace: c.font, margin: NOPAD, fontSize: PT(90), bold: true, italic: true,
        color: hex(t.v['--ink']), align: c.rtl ? 'right' : 'left', rtlMode: c.rtl,
      });
      s.addShape('rect', {
        x: I(c.rtl ? BODY_X + BODY_W - 8 : BODY_X), y: I(CARD.y + 380), w: I(8), h: I(160),
        fill: { color: hex(t.v['--acc']) }, line: { type: 'none' },
      });
      para(c, sl.body || sl.bullets.filter(Boolean).join(' '),
           BODY_X + (c.rtl ? 0 : 32), CARD.y + 390, BODY_W - 32, 170, 35);
      break;

    case 'L_code':
      panel(c, BODY_X, BODY_Y, BODY_W, BODY_H - 90);
      s.addText(sl.body ?? '', {
        x: I(BODY_X + 40), y: I(BODY_Y + 34), w: I(BODY_W - 80), h: I(BODY_H - 160),
        fontFace: 'Consolas', fontSize: PT(31), color: hex(t.v['--ink']),
        align: 'left', valign: 'top', lineSpacingMultiple: 1.8,
      });
      break;

    // ── ستوونەکان ──
    case 'L_two':
    case 'L_three':
    case 'L_ba':
    case 'L_venn': {
      const n = sl.layout === 'L_three' ? 3 : 2;
      const gap = 50, cw = (BODY_W - gap * (n - 1)) / n;
      sl.bullets.slice(0, n).forEach((b, i) => {
        const x = BODY_X + (cw + gap) * i;
        const isAfter = sl.layout === 'L_ba' && i === 1;
        panel(c, x, BODY_Y, cw, BODY_H, isAfter ? t.v['--pri'] : undefined);
        const ci = b.indexOf(':');
        const head = ci > 0 ? b.slice(0, ci) : `0${i + 1}`;
        const rest = ci > 0 ? b.slice(ci + 1).trim() : b;
        s.addText(head, {
          x: I(x + 36), y: I(BODY_Y + 34), w: I(cw - 72), h: I(56),
          fontFace: c.font, margin: NOPAD, fontSize: PT(38), italic: true,
          color: isAfter ? 'FFFFFF' : hex(t.v['--ink']),
          align: c.rtl ? 'right' : 'left', rtlMode: c.rtl,
        });
        s.addText(rest, {
          x: I(x + 36), y: I(BODY_Y + 106), w: I(cw - 72), h: I(BODY_H - 140),
          fontFace: c.font, margin: NOPAD, fontSize: PT(29),
          color: isAfter ? 'FFFFFF' : hex(t.v['--ink-soft']),
          align: c.rtl ? 'right' : 'left', valign: 'top',
          lineSpacingMultiple: 1.5, rtlMode: c.rtl,
        });
      });
      break;
    }

    case 'L_pyramid': {
      const widths = [0.38, 0.62, 0.86];
      const colors = [t.v['--acc'], t.v['--pri'], t.v['--pri-soft']];
      sl.bullets.slice(0, 3).forEach((b, i) => {
        const w = BODY_W * widths[i];
        s.addShape('roundRect', {
          x: I(BODY_X + (BODY_W - w) / 2), y: I(BODY_Y + i * 126), w: I(w), h: I(112),
          rectRadius: 0.12, fill: { color: hex(colors[i]) }, line: { type: 'none' },
        });
        s.addText(b, {
          x: I(BODY_X + (BODY_W - w) / 2), y: I(BODY_Y + i * 126), w: I(w), h: I(112),
          fontFace: c.font, margin: NOPAD, fontSize: PT(31), bold: true, italic: true,
          color: i === 0 ? '141414' : 'FFFFFF', align: 'center', valign: 'middle', rtlMode: c.rtl,
        });
      });
      break;
    }

    case 'L_proscons': {
      const gap = 42, cw = (BODY_W - gap) / 2;
      ([['✓', sl.pros ?? [], '3F8A5F'], ['✕', sl.cons ?? [], 'A8434B']] as const)
        .forEach(([mark, items, color], i) => {
          const x = BODY_X + (cw + gap) * i;
          panel(c, x, BODY_Y, cw, BODY_H);
          s.addShape('roundRect', {
            x: I(x + 32), y: I(BODY_Y + 30), w: I(46), h: I(46),
            rectRadius: 0.14, fill: { color }, line: { type: 'none' },
          });
          s.addText(mark, {
            x: I(x + 32), y: I(BODY_Y + 30), w: I(46), h: I(46),
            fontFace: c.font, margin: NOPAD, fontSize: PT(25), bold: true, color: 'FFFFFF',
            align: 'center', valign: 'middle',
          });
          bullets(c, items, x + 32, BODY_Y + 100, cw - 64, BODY_H - 130, 27);
        });
      break;
    }

    // ── هەنگاو، سوڕ، جوڵە ──
    case 'L_steps':
    case 'L_cycle':
    case 'L_flow': {
      const steps = sl.steps ?? [];
      const n = Math.min(4, steps.length) || 1;
      const gap = 26, cw = (BODY_W - gap * (n - 1)) / n;
      steps.slice(0, n).forEach((st, i) => {
        const x = BODY_X + (cw + gap) * i;
        panel(c, x, BODY_Y, cw, BODY_H);
        s.addShape('roundRect', {
          x: I(x + 26), y: I(BODY_Y + 32), w: I(64), h: I(64), rectRadius: 0.16,
          fill: { color: hex(i % 2 ? t.v['--acc'] : t.v['--pri']) }, line: { type: 'none' },
        });
        s.addText(st.n || String(i + 1), {
          x: I(x + 26), y: I(BODY_Y + 32), w: I(64), h: I(64),
          fontFace: c.font, margin: NOPAD, fontSize: PT(32), bold: true,
          color: i % 2 ? '141414' : 'FFFFFF', align: 'center', valign: 'middle',
        });
        s.addText(st.h, {
          x: I(x + 26), y: I(BODY_Y + 116), w: I(cw - 52), h: I(50),
          fontFace: c.font, margin: NOPAD, fontSize: PT(31), italic: true, color: hex(t.v['--ink']),
          align: c.rtl ? 'right' : 'left', rtlMode: c.rtl,
        });
        s.addText(st.p, {
          x: I(x + 26), y: I(BODY_Y + 176), w: I(cw - 52), h: I(BODY_H - 210),
          fontFace: c.font, margin: NOPAD, fontSize: PT(24), color: hex(t.v['--ink-soft']),
          align: c.rtl ? 'right' : 'left', valign: 'top', lineSpacingMultiple: 1.45, rtlMode: c.rtl,
        });
      });
      break;
    }

    case 'L_time': {
      const tl = sl.timeline ?? [];
      const n = Math.max(1, tl.length);
      const midY = BODY_Y + BODY_H / 2;
      s.addShape('roundRect', {
        x: I(BODY_X + 40), y: I(midY - 3), w: I(BODY_W - 80), h: I(6), rectRadius: 0.5,
        fill: { color: hex(t.v['--pri-soft']) }, line: { type: 'none' },
      });
      const cw = BODY_W / n;
      tl.forEach((it, i) => {
        const cx = BODY_X + cw * i + cw / 2;
        s.addShape('ellipse', {
          x: I(cx - 21), y: I(midY - 21), w: I(42), h: I(42),
          fill: { color: hex(i % 2 ? t.v['--acc'] : t.v['--pri']) },
          line: { color: hex(t.v['--slide-bg']), width: 5 },
        });
        s.addText(it.y, {
          x: I(cx - cw / 2), y: I(midY + 34), w: I(cw), h: I(48),
          fontFace: c.font, margin: NOPAD, fontSize: PT(34), bold: true,
          color: hex(t.v['--ink']), align: 'center',
        });
        s.addText(it.c, {
          x: I(cx - cw / 2 + 14), y: I(midY + 86), w: I(cw - 28), h: I(110),
          fontFace: c.font, margin: NOPAD, fontSize: PT(24), color: hex(t.v['--ink-soft']),
          align: 'center', valign: 'top', lineSpacingMultiple: 1.4, rtlMode: c.rtl,
        });
      });
      break;
    }

    // ── خشتەکان ──
    case 'L_table':
    case 'L_compare': {
      const tb = sl.table;
      if (!tb) break;
      const rows: PptxGenJS.TableRow[] = [
        tb.head.map(h => ({
          text: h,
          options: {
            bold: true, italic: true, color: 'FFFFFF',
            fill: { color: hex(t.v['--pri']) }, fontSize: PT(29),
            align: (c.rtl ? 'right' : 'left') as PptxGenJS.HAlign,
            rtlMode: c.rtl,
          },
        })),
        ...tb.rows.map(r => r.map((cell, ci) => {
          const yes = /^(yes|✓|true|بەڵێ|نعم)$/i.test(cell.trim());
          const no  = /^(no|✕|false|نەخێر|لا)$/i.test(cell.trim());
          return {
            text: yes ? '✓' : no ? '✕' : cell,
            options: {
              fontSize: PT(28), bold: ci === 0 || yes || no,
              color: yes ? '3F8A5F' : no ? 'A8434B' : hex(t.v['--ink']),
              align: (ci === 0 ? (c.rtl ? 'right' : 'left') : 'center') as PptxGenJS.HAlign,
              rtlMode: c.rtl,
              fill: { color: t.dark ? '000000' : 'FFFFFF', transparency: t.dark ? 92 : 50 },
            },
          };
        })),
      ];
      s.addTable(rows, {
        x: I(BODY_X), y: I(BODY_Y), w: I(BODY_W),
        fontFace: c.font, margin: NOPAD, border: { type: 'solid', color: 'FFFFFF', pt: 1 },
        rowH: I(Math.min(90, (BODY_H - 20) / rows.length)),
        valign: 'middle',
      });
      break;
    }

    case 'L_kpi': {
      const items = sl.kpis ?? [];
      const n = Math.max(1, items.length);
      const gap = 34, cw = (BODY_W - gap * (n - 1)) / n;
      items.forEach((k, i) => {
        const x = BODY_X + (cw + gap) * i;
        panel(c, x, BODY_Y, cw, BODY_H);
        s.addText(k.v, {
          x: I(x), y: I(BODY_Y + BODY_H / 2 - 130), w: I(cw), h: I(120),
          fontFace: c.font, margin: NOPAD, fontSize: PT(96), bold: true,
          color: hex(t.v['--pri']), align: 'center', valign: 'bottom',
        });
        s.addText(k.k, {
          x: I(x + 20), y: I(BODY_Y + BODY_H / 2 + 10), w: I(cw - 40), h: I(120),
          fontFace: c.font, margin: NOPAD, fontSize: PT(27), color: hex(t.v['--ink-soft']),
          align: 'center', valign: 'top', lineSpacingMultiple: 1.35, rtlMode: c.rtl,
        });
      });
      break;
    }

    case 'L_progress': {
      const ch = sl.chart;
      if (!ch) break;
      const n = ch.labels.length || 1;
      const rowH = Math.min(110, BODY_H / n);
      ch.labels.forEach((label, i) => {
        const y = BODY_Y + rowH * i;
        const pct = Math.max(0, Math.min(100, ch.values[i] ?? 0));
        s.addText(label, {
          x: I(BODY_X), y: I(y), w: I(BODY_W - 140), h: I(44),
          fontFace: c.font, margin: NOPAD, fontSize: PT(30), color: hex(t.v['--ink']),
          align: c.rtl ? 'right' : 'left', rtlMode: c.rtl,
        });
        s.addText(`${pct}%`, {
          x: I(BODY_X + BODY_W - 140), y: I(y), w: I(140), h: I(44),
          fontFace: c.font, margin: NOPAD, fontSize: PT(30), color: hex(t.v['--ink']),
          align: c.rtl ? 'left' : 'right',
        });
        s.addShape('roundRect', {
          x: I(BODY_X), y: I(y + 52), w: I(BODY_W), h: I(28), rectRadius: 0.5,
          fill: { color: t.dark ? '000000' : 'FFFFFF', transparency: t.dark ? 88 : 32 },
          line: { type: 'none' },
        });
        s.addShape('roundRect', {
          x: I(BODY_X), y: I(y + 52), w: I(BODY_W * pct / 100), h: I(28), rectRadius: 0.5,
          fill: { color: hex(i % 2 ? t.v['--acc'] : t.v['--pri']) }, line: { type: 'none' },
        });
      });
      break;
    }

    // ── چارتەکان: چارتی ڕەسەنی PowerPoint، دەستکاریکراو ──
    case 'L_bar':
    case 'L_line':
    case 'L_donut': {
      const ch = sl.chart;
      if (!ch) break;
      const type = ch.kind === 'line' ? 'line' : ch.kind === 'donut' ? 'doughnut' : 'bar';
      const isDonut = type === 'doughnut';
      s.addChart(
        type as PptxGenJS.CHART_NAME,
        [{ name: sl.title, labels: ch.labels, values: ch.values }],
        {
          x: I(BODY_X), y: I(BODY_Y),
          w: I(isDonut ? BODY_W * 0.5 : BODY_W),
          h: I(BODY_H - (ch.caption ? 46 : 0)),
          chartColors: [t.v['--pri'], t.v['--acc'], t.v['--pri-soft'], t.v['--ink-soft']]
            .map(hex),
          showLegend: isDonut, legendPos: 'r',
          showValue: !isDonut, dataLabelFontFace: c.font,
          dataLabelFontSize: PT(24), dataLabelColor: hex(t.v['--ink']),
          catAxisLabelFontFace: c.font, catAxisLabelFontSize: PT(24),
          catAxisLabelColor: hex(t.v['--ink']),
          valAxisLabelFontFace: c.font, valAxisLabelFontSize: PT(22),
          valAxisLabelColor: hex(t.v['--ink-soft']),
          barDir: 'col', barGapWidthPct: 60,
          lineSize: 8, lineSmooth: false,
          holeSize: 55,
        },
      );
      if (isDonut && sl.bullets.length)
        bullets(c, sl.bullets, BODY_X + BODY_W * 0.55, BODY_Y + 60, BODY_W * 0.45, BODY_H - 60, 32);
      if (ch.caption)
        s.addText(ch.caption, {
          x: I(BODY_X), y: I(BODY_Y + BODY_H - 40), w: I(BODY_W), h: I(40),
          fontFace: c.font, margin: NOPAD, fontSize: PT(20), color: hex(t.v['--ink-soft']),
          align: c.rtl ? 'right' : 'left', rtlMode: c.rtl,
        });
      break;
    }

    // ── وێنە ──
    case 'L_hero': {
      if (sl.imageUrl) {
        s.addImage({ data: sl.imageUrl, x: 0, y: 0, w: I(W), h: I(H), sizing: { type: 'cover', w: I(W), h: I(H) } });
      } else {
        s.addShape('rect', { x: 0, y: 0, w: I(W), h: I(H), fill: { color: hex(t.v['--pri']) }, line: { type: 'none' } });
      }
      s.addShape('rect', {
        x: 0, y: 0, w: I(W * 0.72), h: I(H),
        fill: { color: '0C1422', transparency: 25 }, line: { type: 'none' },
      });
      s.addText(sl.title, {
        x: I(180), y: I(360), w: I(1050), h: I(110),
        fontFace: c.font, margin: NOPAD, fontSize: PT(70), bold: true, italic: true,
        color: 'FFFFFF', align: c.rtl ? 'right' : 'left', rtlMode: c.rtl,
      });
      s.addText(sl.body ?? '', {
        x: I(180), y: I(500), w: I(1050), h: I(220),
        fontFace: c.font, margin: NOPAD, fontSize: PT(33), color: 'FFFFFF',
        align: c.rtl ? 'right' : 'left', valign: 'top',
        lineSpacingMultiple: 1.55, rtlMode: c.rtl,
      });
      break;
    }

    case 'L_grid': {
      const g = 22, cw = (BODY_W - g) / 2, chh = (BODY_H - g) / 2;
      for (let i = 0; i < 4; i++) {
        const x = BODY_X + (cw + g) * (i % 2);
        const y = BODY_Y + (chh + g) * Math.floor(i / 2);
        if (sl.imageUrl && i === 0) s.addImage({ data: sl.imageUrl, x: I(x), y: I(y), w: I(cw), h: I(chh) });
        else panel(c, x, y, cw, chh);
      }
      break;
    }

    // ── تایبەتەکان ──
    case 'L_quote':
      s.addText('"', {
        x: I(BODY_X), y: I(CARD.y + 90), w: I(200), h: I(200),
        fontFace: 'Georgia', fontSize: PT(210), color: hex(t.v['--acc']),
        align: c.rtl ? 'right' : 'left',
      });
      s.addText(sl.quote?.text ?? sl.title, {
        x: I(BODY_X), y: I(CARD.y + 300), w: I(BODY_W), h: I(280),
        fontFace: c.font, margin: NOPAD, fontSize: PT(48), italic: true, color: hex(t.v['--ink']),
        align: c.rtl ? 'right' : 'left', valign: 'top', lineSpacingMultiple: 1.45, rtlMode: c.rtl,
      });
      if (sl.quote?.by)
        s.addText(`— ${sl.quote.by}`, {
          x: I(BODY_X), y: I(CARD.y + 620), w: I(BODY_W), h: I(60),
          fontFace: c.font, margin: NOPAD, fontSize: PT(29), color: hex(t.v['--ink-soft']),
          align: c.rtl ? 'right' : 'left', rtlMode: c.rtl,
        });
      break;

    case 'L_divider':
      s.addText(sl.bullets[0] || '01', {
        x: 0, y: I(CARD.y + 130), w: I(W), h: I(200),
        fontFace: c.font, margin: NOPAD, fontSize: PT(190), bold: true,
        color: hex(t.v['--pri']), transparency: 72, align: 'center',
      });
      s.addText(sl.title, {
        x: 0, y: I(CARD.y + 380), w: I(W), h: I(110),
        fontFace: c.font, margin: NOPAD, fontSize: PT(78), italic: true,
        color: hex(t.v['--ink']), align: 'center', rtlMode: c.rtl,
      });
      break;

    case 'L_thanks':
      s.addText(sl.bullets[0] || 'Any Questions?', {
        x: 0, y: I(CARD.y + 230), w: I(W), h: I(80),
        fontFace: c.font, margin: NOPAD, fontSize: PT(52), italic: true,
        color: hex(t.v['--ink-soft']), align: 'center', rtlMode: c.rtl,
      });
      s.addText(sl.title, {
        x: 0, y: I(CARD.y + 330), w: I(W), h: I(180),
        fontFace: c.font, margin: NOPAD, fontSize: PT(132), bold: true, italic: true,
        color: hex(t.v['--ink']), align: 'center', rtlMode: c.rtl,
      });
      break;

    case 'L_refs': {
      const list = sl.refs ?? [];
      // ژێدەرەکان دەبێت بخوێندرێنەوە — بۆیە سنووری خوارەوە بەرزترە
      const f = fitBlock({
        lines: list.map(r => r.text + (r.domain ?? '')),
        width: BODY_W, height: BODY_H, size: 25, max: 34, min: 19,
        lineHeight: 1.55, gap: 20, indent: c.cite.numbered ? 52 : 46,
      });
      // شێوازە ژمارەدارەکان نیشانەکەیان لە دەقەکەدایە.
      // ئەوانی تر «هێڵی هەڵواسراو» ـن — لە PowerPoint دا بە
      // indent ـی نەرێنی لەسەر دێڕی یەکەم دەکرێت.
      const hang = I(f.size * 1.9);
      s.addText(
        list.map((r, i) => ({
          text: c.cite.numbered ? `${c.cite.marker(i + 1)}  ${r.text}` : r.text,
          options: {
            breakLine: true, paraSpaceAfter: PT(f.gap),
            ...(c.cite.numbered ? {} : { indentLevel: 0, hangingIndent: hang }),
          },
        })) as PptxGenJS.TextProps[],
        {
          x: I(BODY_X), y: I(BODY_Y), w: I(BODY_W), h: I(BODY_H),
          fontFace: c.font, margin: NOPAD, fontSize: PT(f.size), color: hex(t.v['--ink']),
          align: c.rtl ? 'right' : 'left', valign: 'middle',
          lineSpacingMultiple: 1.4, rtlMode: c.rtl,
        },
      );
      break;
    }

    default:
      bullets(c, sl.bullets, BODY_X, BODY_Y, BODY_W, BODY_H);
  }
}

function addImage(c: Ctx, sl: Slide, x: number, y: number, w: number, h: number) {
  if (!sl.imageUrl) { panel(c, x, y, w, h); return; }

  c.s.addImage({ data: sl.imageUrl, x: I(x), y: I(y), w: I(w), h: I(h), rounding: false });

  // مۆڵەتی Creative Commons داوای ناوی خاوەن دەکات، و دەبێت لەگەڵ وێنەکەدا
  // بەدیار بێت. لە تێبینییەکاندا بەس نییە — بۆیە هێڵێکی بچووک لە ژێرەوە.
  if (!sl.imageCredit) return;
  const H = 26;
  c.s.addText(sl.imageCredit, {
    x: I(x), y: I(y + h - H), w: I(w), h: I(H),
    fontFace: c.font, margin: [0, PT(8), 0, PT(8)],
    fontSize: PT(15), color: 'FFFFFF', align: 'left', valign: 'middle',
    fill: { color: '000000', transparency: 45 },
  });
}

/**
 * ئاماژەی سەرچاوە لە ژێر سلایدەکەدا — وەک ئەوەی لە پێشبینیندا.
 *
 * ═══ C9 ═══
 * دەقی ڕاستەقینەیە، نەک وێنە — بۆیە لە PowerPoint دا دەستکاری
 * دەکرێت. بەبێ ئەمە، ئاماژەکان تەنها لە وێبگەڕدا دەبینران و
 * فایلە داگیراوەکە — ئەوەی بەڕاستی پێشکەش دەکرێت — بێ بەڵگە بوو.
 */
function cited(c: Ctx, sl: Slide, index: Map<string, string> | undefined) {
  if (!index || !sl.cites?.length) return;
  const bits = sl.cites.map(id => index.get(id)).filter(Boolean);
  if (!bits.length) return;

  const H = 30;
  c.s.addText(bits.join(' · '), {
    x: I(BODY_X), y: I(1080 - 64 - H), w: I(BODY_W), h: I(H),
    fontFace: c.font, fontSize: PT(15), color: hex(c.t.v['--ink-soft']),
    align: c.rtl ? 'right' : 'left', valign: 'middle',
    rtlMode: c.rtl,
  });
}

/** ناسنامەی سەرچاوە → «نووسەر (ساڵ)» — هەمان لۆژیکی `SlideView` */
function refIndexOf(deck: Deck): Map<string, string> | undefined {
  const page = deck.slides.find(x => x.layout === 'L_refs');
  if (!page?.refs?.length) return undefined;
  const m = new Map<string, string>();
  for (const r of page.refs) {
    if (!r.id) continue;
    const who = r.authors?.length
      ? `${r.authors[0].split(/[\s,]+/).pop()}${r.authors.length > 1 ? ' et al.' : ''}`
      : (r.title ?? r.text).slice(0, 24);
    m.set(r.id, r.year ? `${who} (${r.year})` : who);
  }
  return m.size ? m : undefined;
}

// ─────────── دەروازە ───────────

export interface ExportOpts {
  withMorph: boolean;
  onProgress?: (done: number, total: number) => void;
}

export async function exportPptx(deck: Deck, opts: ExportOpts): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'HD', width: 13.333, height: 7.5 });
  pptx.layout = 'HD';
  pptx.title = deck.titleInfo.title || 'Presentation';
  pptx.author = deck.titleInfo.students.filter(Boolean).join(', ');

  const t = byId(deck.theme);
  const rtl = deck.lang !== 'en';
  const total = deck.slides.length + 1;

  const font = primaryFont(deck.fontFamily);
  const st = styleById(deck.style ?? 'glass');
  const scale = densityById(deck.density ?? 'normal').scale;
  const cite = citeStyleById(deck.citeStyle);
  const refIndex = refIndexOf(deck);
  const titleCtx: Ctx = { pptx, s: pptx.addSlide(), t, font, rtl, st, scale, cite };
  titleSlide(titleCtx, deck);
  opts.onProgress?.(1, total);

  for (let i = 0; i < deck.slides.length; i++) {
    const sl = deck.slides[i];
    // `overrides` دەچێتە ناو سیاقەکەوە — بەبێ ئەمە هەموو دەستکارییەکی
    // ئێدیتەر لە فایلی هەناردەکراودا بێدەنگ ون دەبێت
    const ctx: Ctx = { pptx, s: pptx.addSlide(), t, font, rtl, st, scale, cite,
                       ov: sl.overrides };
    contentSlide(ctx, sl, i + 1);
    cited(ctx, sl, refIndex);
    await drawElements(ctx, sl);

    // تێبینییەکانی قسەکەر — پێشتر هەرگیز هەناردە نەدەکران، واتە هەرچی
    // بەکارهێنەر لە ئێدیتەردا دەینووسی لە فایلی PowerPoint دا ون دەبوو.
    const notes = [sl.notes, sl.imageCredit && `وێنە: ${sl.imageCredit}`]
      .filter(Boolean).join('\n');
    if (notes) ctx.s.addNotes(notes);

    opts.onProgress?.(i + 2, total);
  }

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;

  // دوا هەنگاو — هەمیشە دەڕوات، نەک تەنها کاتێک Morph داواکراوە:
  //   • ڕێکخستنی پەرەگراف پێویستییەکی سکیمایە
  //   • فۆنتی پیتە ئاڵۆزەکان کێشەی چوارگۆشە بەتاڵەکان چارەسەر دەکات
  // Morph و ئەنیمەیشن هەر هەڵبژاردەن.
  return finalizePptx(blob, {
    durationMs: deck.transitionMs,
    morph: opts.withMorph,
    builds: opts.withMorph,
    csFont: csFontFor(deck.lang),
  });
}
