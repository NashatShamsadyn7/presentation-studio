// ═══════════ ئایکۆن و شێوەکان ═══════════
// هیچ کتێبخانەیەک لە کاتی کارکردندا بانگ ناکرێت — هەموو ئایکۆنێک
// لە باندڵەکەدایە، بۆیە سایتەکە ئۆفلاینیش کاردەکات.
//
// دوو سەرچاوە:
//   • ئەوانەی لێرەدا بە Prim دروست کراون
//   • icons-lucide.ts — لە Lucide (ISC) ـەوە لە کاتی بنیادناندا هێنراون
//     بە scripts/gen-icons.ts

import { LUCIDE, LUCIDE_GROUPS } from './icons-lucide';

/** پارچە بنەڕەتییەکانی وێنەکێشان لە بۆشایی ٢٤×٢٤ */
export type Prim =
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'poly'; pts: string; closed?: boolean }
  | { t: 'path'; d: string };

export interface IconDef {
  id: string;
  /** ناوی کوردی بۆ گەڕان */
  name: string;
  group: string;
  p: Prim[];
}

const c = (cx: number, cy: number, r: number): Prim => ({ t: 'circle', cx, cy, r });
const r_ = (x: number, y: number, w: number, h: number, rx?: number): Prim =>
  ({ t: 'rect', x, y, w, h, rx });
const l = (x1: number, y1: number, x2: number, y2: number): Prim =>
  ({ t: 'line', x1, y1, x2, y2 });
const pl = (pts: string, closed = false): Prim => ({ t: 'poly', pts, closed });
const pa = (d: string): Prim => ({ t: 'path', d });

// ─────────── کۆمەڵەی ئایکۆنەکان ───────────

export const ICONS: IconDef[] = [
  // ── ئەکادیمی ──
  { id:'graduation', name:'کڵاوی دەرچوون', group:'ئەکادیمی', p:[
    pl('2 8 12 3 22 8 12 13 2 8', true), pa('M6 10.5v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5'), l(22,8,22,14) ]},
  { id:'book', name:'کتێب', group:'ئەکادیمی', p:[
    pa('M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2z'), l(4,18,19,18) ]},
  { id:'library', name:'کتێبخانە', group:'ئەکادیمی', p:[
    r_(3,4,4,16,1), r_(9,4,4,16,1), pa('M16.5 4.6l3.6 1 -3.9 14.2 -3.6-1z') ]},
  { id:'pencil', name:'قەڵەم', group:'ئەکادیمی', p:[
    pa('M17 3l4 4L8 20H4v-4z'), l(14,6,18,10) ]},
  { id:'note', name:'تێبینی', group:'ئەکادیمی', p:[
    pa('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'),
    pl('14 2 14 8 20 8'), l(8,13,16,13), l(8,17,13,17) ]},
  { id:'lab', name:'تاقیگە', group:'ئەکادیمی', p:[
    pa('M9 2v7L4 19a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 19l-5-10V2'), l(8,2,16,2), l(7,15,17,15) ]},
  { id:'atom', name:'گەرد', group:'ئەکادیمی', p:[
    c(12,12,2), pa('M12 2c5 0 9 4.5 9 10s-4 10-9 10-9-4.5-9-10 4-10 9-10z'),
    pa('M3.5 7c2.5-4.3 8.5-5.5 13-3s6 8.5 3.5 12.8-8.5 5.5-13 3S1 11.3 3.5 7z') ]},
  { id:'brain', name:'مێشک', group:'ئەکادیمی', p:[
    pa('M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 5V3z'),
    pa('M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-4 5V3z') ]},

  // ── تەکنەلۆژیا ──
  { id:'cpu', name:'پرۆسێسەر', group:'تەکنەلۆژیا', p:[
    r_(4,4,16,16,2), r_(9,9,6,6), l(9,1,9,4), l(15,1,15,4), l(9,20,9,23), l(15,20,15,23),
    l(1,9,4,9), l(1,15,4,15), l(20,9,23,9), l(20,15,23,15) ]},
  { id:'server', name:'سێرڤەر', group:'تەکنەلۆژیا', p:[
    r_(2,2,20,8,2), r_(2,14,20,8,2), l(6,6,6.01,6), l(6,18,6.01,18) ]},
  { id:'database', name:'داتابەیس', group:'تەکنەلۆژیا', p:[
    { t:'path', d:'M3 5c0-1.7 4-3 9-3s9 1.3 9 3-4 3-9 3-9-1.3-9-3z' },
    pa('M21 5v6c0 1.7-4 3-9 3s-9-1.3-9-3V5'),
    pa('M21 11v6c0 1.7-4 3-9 3s-9-1.3-9-3v-6') ]},
  { id:'cloud', name:'هەور', group:'تەکنەلۆژیا', p:[
    pa('M18 17H7A4.5 4.5 0 0 1 7 8a5.5 5.5 0 0 1 10.5 1.5A3.8 3.8 0 0 1 18 17z') ]},
  { id:'wifi', name:'وایفای', group:'تەکنەلۆژیا', p:[
    pa('M2 8.5a15 15 0 0 1 20 0'), pa('M5.5 12a10 10 0 0 1 13 0'),
    pa('M9 15.5a5 5 0 0 1 6 0'), c(12,19.5,1) ]},
  { id:'code', name:'کۆد', group:'تەکنەلۆژیا', p:[
    pl('8 6 3 12 8 18'), pl('16 6 21 12 16 18'), l(14,4,10,20) ]},
  { id:'lock', name:'قفڵ', group:'تەکنەلۆژیا', p:[
    r_(4,11,16,10,2), pa('M8 11V7a4 4 0 0 1 8 0v4') ]},
  { id:'key', name:'کلیل', group:'تەکنەلۆژیا', p:[
    c(7,15,4), l(10,12,21,3), l(18,6,20,8), l(15,9,17,11) ]},
  { id:'shield', name:'قەڵغان', group:'تەکنەلۆژیا', p:[
    pa('M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z'), pl('9 12 11 14 15.5 9.5') ]},
  { id:'network', name:'تۆڕ', group:'تەکنەلۆژیا', p:[
    c(12,4,2.5), c(4,19,2.5), c(20,19,2.5), l(10.5,6,5.5,16.5), l(13.5,6,18.5,16.5), l(6.5,19,17.5,19) ]},
  { id:'mobile', name:'مۆبایل', group:'تەکنەلۆژیا', p:[
    r_(6,2,12,20,2), l(11,18,13,18) ]},
  { id:'monitor', name:'شاشە', group:'تەکنەلۆژیا', p:[
    r_(2,3,20,13,2), l(8,21,16,21), l(12,16,12,21) ]},
  { id:'robot', name:'ڕۆبۆت', group:'تەکنەلۆژیا', p:[
    r_(4,8,16,12,3), c(9,13,1.2), c(15,13,1.2), l(12,4,12,8), c(12,3,1.5),
    l(2,12,4,12), l(20,12,22,12), l(9,17,15,17) ]},
  { id:'chip', name:'چیپ', group:'تەکنەلۆژیا', p:[
    r_(6,6,12,12,1), l(3,10,6,10), l(3,14,6,14), l(18,10,21,10), l(18,14,21,14),
    l(10,3,10,6), l(14,3,14,6), l(10,18,10,21), l(14,18,14,21) ]},

  // ── داتا ──
  { id:'chart-bar', name:'چارتی ستوونی', group:'داتا', p:[
    l(3,21,21,21), r_(5,12,4,9), r_(11,7,4,14), r_(17,15,4,6) ]},
  { id:'chart-line', name:'چارتی هێڵی', group:'داتا', p:[
    pl('3 17 9 11 13 15 21 5'), l(3,21,21,21), c(9,11,1.3), c(13,15,1.3) ]},
  { id:'chart-pie', name:'چارتی بازنە', group:'داتا', p:[
    pa('M21 12A9 9 0 1 1 12 3v9z'), pa('M12 3a9 9 0 0 1 9 9h-9z') ]},
  { id:'trend-up', name:'بەرزبوونەوە', group:'داتا', p:[
    pl('3 17 9 11 13 15 21 7'), pl('16 7 21 7 21 12') ]},
  { id:'trend-down', name:'نزمبوونەوە', group:'داتا', p:[
    pl('3 7 9 13 13 9 21 17'), pl('16 17 21 17 21 12') ]},
  { id:'target', name:'ئامانج', group:'داتا', p:[ c(12,12,9), c(12,12,5), c(12,12,1.5) ]},
  { id:'percent', name:'ڕێژە', group:'داتا', p:[ l(19,5,5,19), c(7,7,2.5), c(17,17,2.5) ]},
  { id:'filter', name:'پاڵاوتن', group:'داتا', p:[ pl('3 4 21 4 14 12 14 20 10 18 10 12 3 4', true) ]},
  { id:'layers', name:'چینەکان', group:'داتا', p:[
    pl('12 2 22 8 12 14 2 8 12 2', true), pl('2 13 12 19 22 13'), pl('2 17.5 12 23.5 22 17.5') ]},

  // ── چالاکی ──
  { id:'search', name:'گەڕان', group:'چالاکی', p:[ c(11,11,7), l(16,16,21,21) ]},
  { id:'check', name:'دروستە', group:'چالاکی', p:[ pl('4 12 9 17 20 6') ]},
  { id:'check-circle', name:'بازنەی دروست', group:'چالاکی', p:[ c(12,12,9), pl('8 12 11 15 16 9') ]},
  { id:'x-circle', name:'بازنەی هەڵە', group:'چالاکی', p:[ c(12,12,9), l(9,9,15,15), l(15,9,9,15) ]},
  { id:'plus', name:'زیادکردن', group:'چالاکی', p:[ l(12,4,12,20), l(4,12,20,12) ]},
  { id:'minus', name:'کەمکردن', group:'چالاکی', p:[ l(4,12,20,12) ]},
  { id:'refresh', name:'نوێکردنەوە', group:'چالاکی', p:[
    pa('M21 12a9 9 0 1 1-2.6-6.4'), pl('21 3 21 9 15 9') ]},
  { id:'download', name:'داگرتن', group:'چالاکی', p:[
    pa('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), pl('7 10 12 15 17 10'), l(12,15,12,3) ]},
  { id:'upload', name:'بارکردن', group:'چالاکی', p:[
    pa('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), pl('7 8 12 3 17 8'), l(12,3,12,15) ]},
  { id:'send', name:'ناردن', group:'چالاکی', p:[ l(22,2,11,13), pl('22 2 15 22 11 13 2 9 22 2', true) ]},
  { id:'settings', name:'ڕێکخستن', group:'چالاکی', p:[
    c(12,12,3), pa('M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 9 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z') ]},
  { id:'link', name:'بەستەر', group:'چالاکی', p:[
    pa('M10 13a5 5 0 0 0 7.5.5l3-3A5 5 0 0 0 13.5 3.5l-1.7 1.7'),
    pa('M14 11a5 5 0 0 0-7.5-.5l-3 3A5 5 0 0 0 10.5 20.5l1.7-1.7') ]},

  // ── مرۆڤ ──
  { id:'user', name:'کەس', group:'مرۆڤ', p:[ c(12,8,4), pa('M4 21v-1a8 8 0 0 1 16 0v1') ]},
  { id:'users', name:'گروپ', group:'مرۆڤ', p:[
    c(9,8,3.5), pa('M2 21v-1a7 7 0 0 1 14 0v1'), pa('M17 4.5a3.5 3.5 0 0 1 0 7'),
    pa('M18 14a6 6 0 0 1 4 6v1') ]},
  { id:'presentation', name:'پێشکەشکردن', group:'مرۆڤ', p:[
    r_(2,3,20,12,1.5), l(12,15,12,18), l(8,21,12,18), l(16,21,12,18), pl('7 11 10 8 13 10 17 6') ]},
  { id:'message', name:'پەیام', group:'مرۆڤ', p:[
    pa('M21 12a8 8 0 0 1-8 8H8l-5 3v-4.6A8 8 0 0 1 13 4a8 8 0 0 1 8 8z') ]},
  { id:'globe', name:'جیهان', group:'مرۆڤ', p:[
    c(12,12,9), l(3,12,21,12), pa('M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z') ]},

  // ── نیشانە ──
  { id:'bulb', name:'گڵۆپ', group:'نیشانە', p:[
    pa('M9 18h6'), pa('M10 21h4'),
    pa('M12 2a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 2z') ]},
  { id:'star', name:'ئەستێرە', group:'نیشانە', p:[
    pl('12 2 15.1 8.6 22 9.5 17 14.4 18.2 21.5 12 18.1 5.8 21.5 7 14.4 2 9.5 8.9 8.6', true) ]},
  { id:'flag', name:'ئاڵا', group:'نیشانە', p:[ pa('M5 21V3h13l-3 5 3 5H5'), l(5,3,5,21) ]},
  { id:'alert', name:'ئاگاداری', group:'نیشانە', p:[
    pa('M12 3l9.5 17H2.5z'), l(12,10,12,14), c(12,17,.8) ]},
  { id:'info', name:'زانیاری', group:'نیشانە', p:[ c(12,12,9), l(12,11,12,16), c(12,8,.8) ]},
  { id:'clock', name:'کات', group:'نیشانە', p:[ c(12,12,9), pl('12 7 12 12 16 14') ]},
  { id:'calendar', name:'ڕۆژژمێر', group:'نیشانە', p:[
    r_(3,5,18,16,2), l(3,10,21,10), l(8,3,8,7), l(16,3,16,7) ]},
  { id:'rocket', name:'مووشەک', group:'نیشانە', p:[
    pa('M12 2c3.5 2.5 5 6 5 10l-2.5 4h-5L7 12c0-4 1.5-7.5 5-10z'),
    c(12,9,1.8), pa('M9.5 17L7 21l3-1 2 2 2-2 3 1-2.5-4') ]},
  { id:'zap', name:'برووسکە', group:'نیشانە', p:[ pl('13 2 4 14 11 14 10 22 20 10 13 10 13 2', true) ]},
  { id:'award', name:'خەڵات', group:'نیشانە', p:[ c(12,8,6), pl('8.5 13 7 22 12 19 17 22 15.5 13') ]},
];

export const ICON_GROUPS = [...new Set(ICONS.map(i => i.group))];
export const iconById = (id: string) => ICONS.find(i => i.id === id);

// ─────────── شێوەکان ───────────

export interface ShapeDef {
  id: string;
  name: string;
  /** ڕێگای SVG لە بۆشایی ١٠٠×١٠٠ — بە قەبارەی خانەکە دەگونجێت */
  d: string;
  /** ناوی هاوتای PowerPoint بۆ هەناردەکردنی ڕەسەن */
  pptx: string;
}

export const SHAPES: ShapeDef[] = [
  { id:'rect',      name:'چوارگۆشە',        d:'M0 0 H100 V100 H0 Z', pptx:'rect' },
  { id:'roundRect', name:'چوارگۆشەی خڕ',    d:'M14 0 H86 A14 14 0 0 1 100 14 V86 A14 14 0 0 1 86 100 H14 A14 14 0 0 1 0 86 V14 A14 14 0 0 1 14 0 Z', pptx:'roundRect' },
  { id:'circle',    name:'بازنە',           d:'M50 0 A50 50 0 1 1 49.9 0 Z', pptx:'ellipse' },
  { id:'triangle',  name:'سێگۆشە',          d:'M50 0 L100 100 L0 100 Z', pptx:'triangle' },
  { id:'diamond',   name:'ئەڵماس',          d:'M50 0 L100 50 L50 100 L0 50 Z', pptx:'diamond' },
  { id:'pentagon',  name:'پێنجگۆشە',        d:'M50 0 L100 38 L81 100 H19 L0 38 Z', pptx:'pentagon' },
  { id:'hexagon',   name:'شەشگۆشە',         d:'M25 0 H75 L100 50 L75 100 H25 L0 50 Z', pptx:'hexagon' },
  { id:'star5',     name:'ئەستێرەی پێنج',   d:'M50 0 L61 35 H98 L68 57 L79 92 L50 70 L21 92 L32 57 L2 35 H39 Z', pptx:'star5' },
  { id:'arrowR',    name:'تیری ڕاست',       d:'M0 30 H60 V0 L100 50 L60 100 V70 H0 Z', pptx:'rightArrow' },
  { id:'arrowL',    name:'تیری چەپ',        d:'M100 30 H40 V0 L0 50 L40 100 V70 H100 Z', pptx:'leftArrow' },
  { id:'arrowU',    name:'تیری سەرەوە',     d:'M30 100 V40 H0 L50 0 L100 40 H70 V100 Z', pptx:'upArrow' },
  { id:'arrowD',    name:'تیری خوارەوە',    d:'M30 0 V60 H0 L50 100 L100 60 H70 V0 Z', pptx:'downArrow' },
  { id:'chevron',   name:'چیڤرۆن',          d:'M0 0 H65 L100 50 L65 100 H0 L35 50 Z', pptx:'chevron' },
  { id:'callout',   name:'بۆڵەی قسە',       d:'M8 0 H92 A8 8 0 0 1 100 8 V62 A8 8 0 0 1 92 70 H40 L22 92 V70 H8 A8 8 0 0 1 0 62 V8 A8 8 0 0 1 8 0 Z', pptx:'wedgeRectCallout' },
  { id:'banner',    name:'ڕیبۆن',           d:'M0 0 H100 V100 L50 72 L0 100 Z', pptx:'flowChartExtract' },
  { id:'plus',      name:'کۆکردنەوە',       d:'M35 0 H65 V35 H100 V65 H65 V100 H35 V65 H0 V35 H35 Z', pptx:'mathPlus' },
  { id:'parallel',  name:'هاوتەریب',        d:'M22 0 H100 L78 100 H0 Z', pptx:'parallelogram' },
  { id:'trapezoid', name:'ترابیزۆید',       d:'M22 0 H78 L100 100 H0 Z', pptx:'trapezoid' },
];

export const shapeById = (id: string) => SHAPES.find(s => s.id === id);

// ─────────── دروستکردنی SVG ───────────

function primToSvg(p: Prim): string {
  switch (p.t) {
    case 'circle': return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}"/>`;
    case 'rect':   return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"${p.rx ? ` rx="${p.rx}"` : ''}/>`;
    case 'line':   return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}"/>`;
    case 'poly':   return p.closed
      ? `<polygon points="${p.pts}"/>`
      : `<polyline points="${p.pts}"/>`;
    case 'path':   return `<path d="${p.d}"/>`;
  }
}

/**
 * ئایکۆنێک وەک SVG ی تەواو — بۆ پیشاندان و بۆ هەناردەکردن.
 *
 * دوو سەرچاوە هەن، هەردووکیان هەمان viewBox و هەمان شێوازی هێڵیان هەیە:
 *   • ئەوانەی خۆمان دروستمان کردوون (Prim)
 *   • Lucide — ١٨٤ ئایکۆنی پیشەیی، لە کاتی بنیادناندا هێنراون
 * بۆیە هەردووکیان بە یەک ڕێگا نەخشێندراون و لە PPTX دا وەک یەک دەردەکەون.
 */
export function iconSvg(id: string, color = 'currentColor', stroke = 2): string {
  const icon = iconById(id);
  const body = icon ? icon.p.map(primToSvg).join('') : LUCIDE[id];
  if (!body) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">` +
    body + '</svg>';
}

/**
 * هەموو ئایکۆنەکان بە گروپ — خۆمان + Lucide.
 *
 * هەندێک ناوی گروپ لە هەردوو سەرچاوەدا هەیە («تەکنەلۆژیا»، «داتا»).
 * تێکەڵ دەکرێن، نەک دوو جار دەردەکەون — ئەگەرنا React دوو منداڵی
 * هاوکلیل دەبینێت و ئاگاداری دەداتەوە.
 */
export const ALL_ICON_GROUPS: { name: string; ids: string[] }[] = (() => {
  const byName = new Map<string, string[]>();
  const add = (name: string, ids: string[]) =>
    byName.set(name, [...(byName.get(name) ?? []), ...ids]);

  for (const g of ICON_GROUPS) add(g, ICONS.filter(i => i.group === g).map(i => i.id));
  for (const g of LUCIDE_GROUPS) add(g.name, g.ids);

  // ناسنامەی دووبارە لەناو یەک گروپدا لادەبرێت
  return [...byName].map(([name, ids]) => ({ name, ids: [...new Set(ids)] }));
})();

/** گەڕان بە ناو — Lucide ناوی ئینگلیزی هەیە، بۆیە گەڕان کاردەکات */
export function findIcons(q: string): string[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const hit = (id: string) => id.includes(s) || id.replace(/-/g, ' ').includes(s);
  return [...ICONS.map(i => i.id), ...Object.keys(LUCIDE)].filter(hit).slice(0, 60);
}

/** شێوەیەک وەک SVG */
export function shapeSvg(id: string, fill = 'currentColor', stroke = 'none', strokeWidth = 0): string {
  const sh = shapeById(id);
  if (!sh) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<path d="${sh.d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/></svg>`;
}

/**
 * SVG → PNG وەک data: URI.
 * PowerPoint پشتگیری SVG ناکات بە شێوەیەکی متمانەپێکراو، بۆیە پێش هەناردەکردن
 * ئایکۆنەکان دەکەینە وێنەی ڕوون بە قەبارەی چوارهێندە.
 */
export function svgToPng(svg: string, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas نەکرایەوە')); return; }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG بارنەکرا')); };
    img.src = url;
  });
}
