// ═══════════ هەناردەکردن بۆ PDF ═══════════
//
// دوو ڕێگا هەیە، و هەردووکیان پێویستن:
//
//   ڤێکتەری  دەق وەک دەق دەنووسرێت — دەتوانرێت هەڵبژێردرێت، بگەڕێدرێت
//            و لە هەر زوومێکدا ڕوونە. قەبارەی فایل بچووکە.
//
//   وێنەیی   هەر سلایدێک وەک وێنە دەگیرێت (html2canvas). دیزاینەکە
//            ١٠٠٪ وەک خۆی دەمێنێتەوە، بەڵام دەق تەم دەبێت لە زوومدا.
//
// ─── بۆچی هەردووکیان؟ ───
//
// jsPDF تەنها فۆنتی WinAnsi ی خۆی هەیە (Helvetica، Times، Courier).
// هیچیان پیتی عەرەبی نییە. زیاتر لەوە، jsPDF شێوەپێدانی پیتی عەرەبی
// (joining) و ئاراستەی دوولایەنە (bidi) ناکات — واتە «کوردی» دەبێتە
// «ی د ر و ک» بە پیتی جیاجیا، ئەگەر هەر دەربکەوێت.
//
// بۆیە:
//   • ئینگلیزی  → ڤێکتەری (بنەڕەت)
//   • کوردی/عەرەبی → وێنەیی، بەبێ هەڵبژاردن
//
// ئەمە سنوورێکی jsPDF ـە، نەک هەڵبژاردنی ئێمە. بەکارهێنەر لە ڕووکاردا
// پێی دەوترێت، نەک بێدەنگ فایلێکی شکاوی پێبدرێت.

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { byId } from '../themes';
import { layoutById, textBox, BODY } from '../layouts';
import { styleById, densityById, BULLET_CHAR } from '../styles';
import { decoFor, POLY } from '../deco';
import { fitBlock } from '../fit';
import { plain } from '../math';
import { styleById as citeStyleById } from '../citestyle';
import type { Deck, Slide } from '../types';

const W = 13.333, H = 7.5;
/** پیکسڵ (لە بۆشایی ١٩٢٠×١٠٨٠) → ئینچ */
const I = (px: number) => px / 144;
/** پیکسڵ → پۆینتی فۆنت */
const PT = (px: number) => px / 2;

const CARD = { x: 154.5, y: 136.4, w: 1596.6, h: 859.5 };
const PAD_X = 76, PAD_Y = 62;
const BODY_X = CARD.x + PAD_X;
const BODY_Y = CARD.y + PAD_Y + 128;

export interface PdfOpts {
  /** ٢ = وردەکاری دووهێندە — تەنها بۆ ڕێگای وێنەیی */
  scale?: number;
  /** ناچار بکە بە وێنە، تەنانەت بۆ ئینگلیزیش */
  raster?: boolean;
  onProgress?: (done: number, total: number) => void;
}

/**
 * ئایا ئەم دێککە دەتوانێت ڤێکتەری بێت؟
 * تەنها ئینگلیزی — بڕوانە سەرەوە بۆ هۆکارەکەی.
 */
export const canVector = (deck: Deck) => deck.lang === 'en';

// ─────────── یاریدەدەری ڕەنگ ───────────

/** '#5C77BC' → [92, 119, 188] */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h.slice(0, 6);
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

// ─────────── ڕێگای ڤێکتەری ───────────

interface Ctx {
  p: jsPDF;
  t: ReturnType<typeof byId>;
  st: ReturnType<typeof styleById>;
  scale: number;
}

function fill(c: Ctx, hex: string, alpha = 1) {
  const [r, g, b] = rgb(hex);
  c.p.setFillColor(r, g, b);
  // GState تەنها لە jsPDF ٢+ دا هەیە؛ ئەگەر نەبوو، ڕوونی پشتگوێ دەخرێت
  const G = (c.p as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState;
  if (G) c.p.setGState(new G({ opacity: alpha }) as never);
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, r = 0) {
  if (r > 0) c.p.roundedRect(I(x), I(y), I(w), I(h), I(r), I(r), 'F');
  else c.p.rect(I(x), I(y), I(w), I(h), 'F');
}

/** پاشبنەما، شێوەکان، کرۆم و کارت — هەمان ژمارەکانی pptx.ts */
function background(c: Ctx, slideIndex: number, withCard: boolean) {
  fill(c, c.t.v['--slide-bg']);
  c.p.rect(0, 0, W, H, 'F');

  for (const d of decoFor(slideIndex, c.st.deco)) {
    fill(c, c.t.v[d.tone], d.opacity);
    const poly = POLY[d.kind];
    if (!poly) {
      c.p.ellipse(I(d.x + d.size / 2), I(d.y + d.size / 2), I(d.size / 2),
                  I(d.kind === 'blob' ? d.size * 0.42 : d.size / 2), 'F');
      continue;
    }
    // خولانەوە بە دەست — jsPDF شێوەی خولاوی ئامادەی نییە
    const rad = (d.rotate * Math.PI) / 180;
    const cx = d.x + d.size / 2, cy = d.y + d.size / 2;
    const pts = poly.map(([px, py]) => {
      const dx = (px - .5) * d.size, dy = (py - .5) * d.size;
      return [cx + dx * Math.cos(rad) - dy * Math.sin(rad),
              cy + dx * Math.sin(rad) + dy * Math.cos(rad)] as [number, number];
    });
    polygon(c, pts);
  }

  if (c.st.accent === 'edge') {
    fill(c, c.t.v['--pri']);
    rect(c, 0, 0, 26, 1080);
  }
  if (withCard && c.st.accent === 'band') {
    fill(c, c.t.v['--pri']);
    rect(c, CARD.x, CARD.y, CARD.w, 196);
  }

  if (withCard && c.st.card !== 'none') {
    if (c.st.card === 'outline') {
      const [r, g, b] = rgb(c.t.v['--pri']);
      c.p.setDrawColor(r, g, b);
      c.p.setLineWidth(0.03);
      c.p.rect(I(CARD.x), I(CARD.y), I(CARD.w), I(CARD.h), 'S');
    } else {
      fill(c, c.t.dark ? '#000000' : '#FFFFFF', c.st.card === 'solid' ? 0.94 : 0.45);
      rect(c, CARD.x, CARD.y, CARD.w, CARD.h, c.st.card === 'solid' ? 12 : 52);
    }
  }
  fill(c, '#000000', 1);            // ڕوونی دەگەڕێتەوە بۆ ئاسایی
}

function polygon(c: Ctx, pts: [number, number][]) {
  if (pts.length < 3) return;
  const [x0, y0] = pts[0];
  const rel = pts.slice(1).map(([x, y], i) => {
    const [px, py] = pts[i];
    return [I(x - px), I(y - py)] as [number, number];
  });
  c.p.lines(rel, I(x0), I(y0), [1, 1], 'F', true);
}

/** دەق — بە ژمێرەری هاوبەشی `fit.ts` */
function text(c: Ctx, s: string, x: number, y: number, w: number, size: number,
              o: { bold?: boolean; italic?: boolean; color?: string; align?: 'left' | 'center';
                   lineHeight?: number } = {}) {
  if (!s.trim()) return 0;
  const [r, g, b] = rgb(o.color ?? c.t.v['--ink']);
  c.p.setTextColor(r, g, b);
  c.p.setFont('times', o.bold && o.italic ? 'bolditalic' : o.bold ? 'bold'
                     : o.italic ? 'italic' : 'normal');
  c.p.setFontSize(PT(size));

  const lh = o.lineHeight ?? 1.4;
  const lines = c.p.splitTextToSize(s, I(w)) as string[];
  const ax = o.align === 'center' ? I(x + w / 2) : I(x);
  lines.forEach((ln, i) => {
    c.p.text(ln, ax, I(y + size * lh * (i + 0.78)), { align: o.align ?? 'left' });
  });
  return lines.length * size * lh;
}

function heading(c: Ctx, s: Slide, title: string) {
  const onBand = c.st.accent === 'band';
  text(c, title, CARD.x + PAD_X, CARD.y + PAD_Y, BODY.w, 62, {
    bold: true, italic: c.st.titleItalic,
    color: onBand ? '#FFFFFF' : c.t.v['--ink'],
    align: c.st.accent === 'twin' ? 'center' : 'left',
    lineHeight: 1.1,
  });

  const wide = c.st.accent === 'none' || c.st.accent === 'side' || c.st.accent === 'twin';
  fill(c, wide && c.st.accent !== 'twin' ? c.t.v['--ink'] : c.t.v['--acc'], wide ? 0.35 : 1);
  const rw = wide ? BODY.w : c.st.accent === 'band' ? 120 : c.st.accent === 'edge' ? 96 : 148;
  rect(c, CARD.x + PAD_X, CARD.y + PAD_Y + 96, rw, wide ? 2 : 7, wide ? 0 : 3);
  fill(c, '#000000', 1);
  void s;
}

/** خاڵەکان بە نیشانەی شێوازەکەیەوە */
function bullets(c: Ctx, items: string[], x: number, y: number, w: number, h: number, size = 35) {
  const list = items.map(plain).filter(Boolean);
  if (!list.length) return;

  const base = Math.round(size * c.scale);
  const f = fitBlock({
    lines: list, width: w, height: h,
    size: base, max: Math.round(base * 1.35),
    lineHeight: 1.4, gap: 25, indent: 42,
  });

  // بلۆکەکە ناوەڕاست دەکرێت — وەک پێشبینین و وەک PowerPoint
  let used = 0;
  const heights = list.map(b => {
    c.p.setFontSize(PT(f.size));
    c.p.setFont('times', 'normal');
    const n = (c.p.splitTextToSize(b, I(w - 42)) as string[]).length;
    return n * f.size * 1.4;
  });
  used = heights.reduce((a, b) => a + b, 0) + f.gap * (list.length - 1);
  let cy = y + Math.max(0, (h - used) / 2);

  const marker = BULLET_CHAR[c.st.bullet];
  list.forEach((b, i) => {
    if (c.st.bullet === 'num') {
      text(c, `${i + 1}.`, x, cy, 42, f.size, { bold: true, color: c.t.v['--pri'] });
    } else if (marker === '●' || marker === '■' || marker === '○') {
      fill(c, c.t.v['--pri']);
      const d = f.size * 0.42;
      const my = cy + f.size * 0.62;
      if (marker === '●') c.p.ellipse(I(x + d / 2), I(my), I(d / 2), I(d / 2), 'F');
      else if (marker === '■') rect(c, x, my - d / 2, d, d, 1);
      else {
        const [r, g, bl] = rgb(c.t.v['--pri']);
        c.p.setDrawColor(r, g, bl); c.p.setLineWidth(0.02);
        c.p.ellipse(I(x + d / 2), I(my), I(d / 2), I(d / 2), 'S');
      }
      fill(c, '#000000', 1);
    } else {
      text(c, marker, x, cy, 42, f.size, { bold: true, color: c.t.v['--pri'] });
    }

    // «ناونیشان: ڕوونکردنەوە» — سەرەکە بە ڕەشی
    const j = b.indexOf(':');
    if (j > 0 && j < 40) {
      const head = b.slice(0, j + 1);
      c.p.setFont('times', 'bold'); c.p.setFontSize(PT(f.size));
      const hw = c.p.getTextWidth(head + ' ') * 144;
      text(c, head, x + 42, cy, hw + 4, f.size, { bold: true });
      text(c, b.slice(j + 1).trim(), x + 42 + hw, cy, w - 42 - hw, f.size);
    } else {
      text(c, b, x + 42, cy, w - 42, f.size);
    }
    cy += heights[i] + f.gap;
  });
}

/** چارتی ستوونی و هێڵی — ڤێکتەری */
function chart(c: Ctx, s: Slide) {
  const ch = s.chart;
  if (!ch?.values.length) return;
  const x0 = BODY_X + 90, y0 = BODY_Y + BODY.h - 70;
  const w = BODY.w - 140, h = BODY.h - 130;
  const max = Math.max(...ch.values, 1);

  fill(c, c.t.v['--ink'], 0.25);
  rect(c, x0, y0, w, 2);

  if (ch.kind === 'line') {
    const step = ch.values.length > 1 ? w / (ch.values.length - 1) : 0;
    const [r, g, b] = rgb(c.t.v['--pri']);
    c.p.setDrawColor(r, g, b); c.p.setLineWidth(0.055);
    ch.values.forEach((v, i) => {
      if (!i) return;
      c.p.line(I(x0 + step * (i - 1)), I(y0 - (ch.values[i - 1] / max) * h),
               I(x0 + step * i), I(y0 - (v / max) * h));
    });
    fill(c, c.t.v['--pri']);
    ch.values.forEach((v, i) =>
      c.p.ellipse(I(x0 + step * i), I(y0 - (v / max) * h), I(11), I(11), 'F'));
    ch.labels.forEach((l, i) =>
      text(c, l, x0 + step * i - 60, y0 + 14, 120, 26, { align: 'center',
        color: c.t.v['--ink-soft'] }));
  } else {
    const gw = w / ch.values.length;
    const bw = Math.min(170, gw * 0.55);
    ch.values.forEach((v, i) => {
      const bh = (v / max) * h;
      fill(c, i % 2 ? c.t.v['--acc'] : c.t.v['--pri']);
      rect(c, x0 + gw * i + (gw - bw) / 2, y0 - bh, bw, bh, 8);
      text(c, String(v), x0 + gw * i, y0 - bh - 42, gw, 26,
           { align: 'center', bold: true });
      text(c, ch.labels[i] ?? '', x0 + gw * i, y0 + 14, gw, 26,
           { align: 'center', color: c.t.v['--ink-soft'] });
    });
  }
  fill(c, '#000000', 1);
  if (ch.caption)
    text(c, ch.caption, BODY_X, BODY_Y + BODY.h - 22, BODY.w, 21,
         { color: c.t.v['--ink-soft'], italic: true });
}

function table(c: Ctx, s: Slide) {
  const t = s.table;
  if (!t?.head.length) return;
  const cols = t.head.length;
  const cw = BODY.w / cols;
  const rh = 62;

  fill(c, c.t.v['--pri']);
  rect(c, BODY_X, BODY_Y, BODY.w, rh, 6);
  t.head.forEach((hd, i) =>
    text(c, hd, BODY_X + cw * i + 20, BODY_Y + 12, cw - 40, 29,
         { bold: true, italic: true, color: '#FFFFFF' }));

  t.rows.slice(0, 7).forEach((row, r) => {
    const y = BODY_Y + rh + r * rh;
    fill(c, c.t.dark ? '#FFFFFF' : '#FFFFFF', c.t.dark ? 0.06 : 0.55);
    rect(c, BODY_X, y, BODY.w, rh - 3);
    fill(c, '#000000', 1);
    row.forEach((cell, i) =>
      text(c, cell, BODY_X + cw * i + 20, y + 14, cw - 40, 27));
  });
}

/** یەک سلاید بە ڤێکتەر */
function drawSlide(c: Ctx, deck: Deck, slide: Slide | null, index: number) {
  const def = slide ? layoutById(slide.layout) : null;
  background(c, index, def?.card ?? true);

  // ─── لاپەڕەی سەرەتا — دیزاینی جێگیر (C7) ───
  if (!slide) {
    const ti = deck.titleInfo;
    [ti.university, ti.institute, ti.department].filter(Boolean).forEach((l, i) =>
      text(c, l, 255.4, 202.3 + i * 59.8, 1000, 44));
    text(c, ti.title, 0, 484.5, 1920, 56, { bold: true, italic: true, align: 'center' });
    text(c, 'Prepared:', 211.2, 646.5, 500, 56, { italic: true });
    ti.students.filter(Boolean).forEach((n, i) =>
      text(c, `${i + 1}- ${n}`, 236.5 + 35.2 * i, 735 + 56.8 * i, 700, 44, { italic: true }));
    text(c, `${ti.teacherPrefix} ${ti.teacherName}`.trim(), 1212.8, 794.3, 620, 56);
    if (ti.year) text(c, ti.year, 1212.8, 872, 400, 44);
    return;
  }

  const noHeading = ['L_quote', 'L_state', 'L_def', 'L_divider', 'L_thanks', 'L_hero'];
  if (!noHeading.includes(slide.layout)) heading(c, slide, slide.title);

  const box = textBox(slide.layout);

  switch (slide.layout) {
    case 'L_bar': case 'L_line': case 'L_donut':
    case 'L_progress':
      chart(c, slide);
      break;

    case 'L_table': case 'L_compare':
      table(c, slide);
      break;

    case 'L_text': case 'L_hero': case 'L_def': case 'L_code': case 'L_state':
      text(c, plain(slide.body || slide.bullets.join(' ')), BODY_X, BODY_Y, BODY.w,
           Math.round(32 * c.scale), { lineHeight: 1.55 });
      break;

    case 'L_quote':
      text(c, plain(slide.quote?.text ?? slide.title), BODY_X, BODY_Y + 60, BODY.w, 48,
           { italic: true, lineHeight: 1.45 });
      if (slide.quote?.by)
        text(c, `— ${slide.quote.by}`, BODY_X, BODY_Y + 330, BODY.w, 29,
             { color: c.t.v['--ink-soft'] });
      break;

    case 'L_divider': case 'L_thanks':
      text(c, slide.title, 0, 430, 1920, 96, { bold: true, italic: true, align: 'center' });
      break;

    case 'L_refs': {
      // شێوازە ژمارەدارەکان نیشانەیان لەپێشە؛ ئەوانی تر بێ نیشانە
      const cst = citeStyleById(deck.citeStyle);
      bullets(c, (slide.refs ?? []).map((r, i) =>
        cst.numbered ? `${cst.marker(i + 1)}  ${r.text}` : r.text),
              BODY_X, BODY_Y, BODY.w, BODY.h, 25);
      break;
    }

    case 'L_bullets': case 'L_bulletsL': {
      const tw = box.w;
      const tx = slide.layout === 'L_bulletsL' ? BODY_X + 545 + 54 : BODY_X;
      const ix = slide.layout === 'L_bulletsL' ? BODY_X : BODY_X + tw + 54;
      bullets(c, slide.bullets, tx, BODY_Y, tw, BODY.h);
      if (slide.imageUrl) {
        try {
          c.p.addImage(slide.imageUrl, I(ix), I(BODY_Y), I(545), I(BODY.h),
                       undefined, 'FAST');
        } catch { /* وێنەیەکی تێکچوو — سلایدەکە بەبێی دەڕوات */ }
      }
      break;
    }

    default:
      bullets(c, slide.bullets, BODY_X, BODY_Y, BODY.w, BODY.h);
  }
}

/**
 * PDF ـێکی ڤێکتەری لە دێککەکەوە — نەک لە DOM ـەوە.
 * دەقەکە دەق دەمێنێتەوە: هەڵبژێردراو، گەڕاوە، و ڕوون لە هەر زوومێکدا.
 */
export async function exportPdfVector(deck: Deck, filename: string, o: PdfOpts = {}) {
  const p = new jsPDF({ orientation: 'landscape', unit: 'in', format: [W, H] });
  const c: Ctx = {
    p, t: byId(deck.theme), st: styleById(deck.style ?? 'glass'),
    scale: densityById(deck.density ?? 'normal').scale,
  };

  const all: (Slide | null)[] = [null, ...deck.slides];
  all.forEach((s, i) => {
    if (i > 0) p.addPage([W, H], 'landscape');
    drawSlide(c, deck, s, i);
    o.onProgress?.(i + 1, all.length);
  });

  p.setProperties({
    title: deck.titleInfo.title || 'Presentation',
    author: deck.titleInfo.students.filter(Boolean).join(', '),
  });
  p.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

// ─────────── ڕێگای وێنەیی ───────────

/**
 * سلایدەکان دەبێت لە DOM دا بن و قەبارەیان ١٩٢٠×١٠٨٠ بێت.
 * ئەگەر بە transform بچووک کرابنەوە، پێش گرتنی وێنە دەگەڕێنرێنەوە.
 */
export async function exportPdf(nodes: HTMLElement[], filename: string, o: PdfOpts = {}) {
  const scale = o.scale ?? 2;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: [W, H] });

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const prev = node.style.transform;
    node.style.transform = 'none';                 // بە قەبارەی تەواو بیگرە

    const canvas = await html2canvas(node, {
      scale,
      width: 1920,
      height: 1080,
      backgroundColor: null,
      useCORS: true,
      logging: false,
      windowWidth: 1920,
      windowHeight: 1080,
    });

    node.style.transform = prev;

    if (i > 0) pdf.addPage([W, H], 'landscape');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, W, H, undefined, 'FAST');
    o.onProgress?.(i + 1, nodes.length);
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
