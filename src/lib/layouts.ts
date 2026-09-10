import type { LayoutId } from './types';

// ═══════════ ٣٣ تەختەبەند ═══════════

/** جۆری داتا کە تەختەبەندێک پێویستی پێیەتی — AI بەمە تەختەبەندی گونجاو هەڵدەبژێرێت */
export type Need =
  | 'bullets' | 'text' | 'image' | 'chart' | 'table' | 'steps'
  | 'timeline' | 'kpis' | 'quote' | 'proscons' | 'refs' | 'none';

export interface LayoutDef {
  id: LayoutId;
  name: string;                       // کوردی
  needs: Need[];
  /** ژمارەی خاڵی گونجاو — AI ڕێنمایی پێدەکرێت */
  bulletRange?: [number, number];
  /** ئایا کارتی شووشەیی دەردەکەوێت */
  card: boolean;
  /** وایەرفرەیم: [x, y, w, h, jor] لە بۆشایی ٩٦×٥٠ */
  wire: [number, number, number, number, string][];
}

export const LAYOUTS: LayoutDef[] = [
 { id:'L_title', name:'لاپەڕەی سەرەتا', needs:['none'], card:true, wire:
   [[8,10,44,3.4,'x'],[8,16,38,3.4,'x'],[30,26,36,5,'t'],[8,34,20,3.4,'p'],[10,39,26,2.6,'x'],[12,43,28,2.6,'x'],[60,38,28,3.4,'x'],[68,6,22,22,'o']] },

 { id:'L_outline', name:'ناوەڕۆک', needs:['bullets'], bulletRange:[4,8], card:true, wire:
   [[8,7,34,4,'t'],[8,17,36,3.4,'p'],[8,25,36,3.4,'p'],[8,33,36,3.4,'p'],[52,17,36,3.4,'p'],[52,25,36,3.4,'p'],[52,33,36,3.4,'p']] },

 { id:'L_bullets', name:'خاڵ + وێنە', needs:['bullets','image'], bulletRange:[2,4], card:true, wire:
   [[8,7,30,4,'t'],[8,17,42,3,'x'],[8,24,42,3,'x'],[8,31,36,3,'x'],[57,15,31,26,'i']] },

 { id:'L_bulletsL', name:'وێنە + خاڵ', needs:['bullets','image'], bulletRange:[2,4], card:true, wire:
   [[8,7,30,4,'t'],[8,15,31,26,'i'],[46,17,42,3,'x'],[46,24,42,3,'x'],[46,31,36,3,'x']] },

 { id:'L_text', name:'دەقی درێژ', needs:['text'], card:true, wire:
   [[8,7,30,4,'t'],[8,16,60,3.4,'p'],[8,24,80,2.6,'x'],[8,29,80,2.6,'x'],[8,34,80,2.6,'x'],[8,39,62,2.6,'x']] },

 { id:'L_bar', name:'چارتی ستوونی', needs:['chart'], card:true, wire:
   [[8,7,30,4,'t'],[14,30,10,12,'p'],[28,24,10,18,'p'],[42,16,10,26,'a'],[56,20,10,22,'p'],[8,43,80,1,'x']] },

 { id:'L_line', name:'چارتی هێڵی', needs:['chart'], card:true, wire:
   [[8,7,30,4,'t'],[10,40,78,1.4,'x'],[12,34,16,1.6,'p'],[28,26,18,1.6,'p'],[46,20,20,1.6,'p'],[66,16,20,1.6,'p'],[12,38,74,1.4,'a']] },

 { id:'L_donut', name:'چارتی بازنە', needs:['chart','bullets'], bulletRange:[2,4], card:true, wire:
   [[8,7,28,4,'t'],[10,16,26,26,'o'],[46,20,40,3,'x'],[46,27,40,3,'x'],[46,34,30,3,'x']] },

 { id:'L_hero', name:'وێنەی گەورە', needs:['text','image'], card:false, wire:
   [[0,0,96,50,'i'],[8,16,42,5,'t'],[8,26,44,3,'x'],[8,32,40,3,'x']] },

 { id:'L_two', name:'دوو ستوون', needs:['bullets'], bulletRange:[2,2], card:true, wire:
   [[8,7,38,4,'t'],[8,16,38,26,'b'],[50,16,38,26,'b']] },

 { id:'L_three', name:'سێ ستوون', needs:['bullets'], bulletRange:[3,3], card:true, wire:
   [[8,7,30,4,'t'],[8,16,25,26,'b'],[36,16,25,26,'b'],[64,16,25,26,'b']] },

 { id:'L_steps', name:'هەنگاوەکان', needs:['steps'], card:true, wire:
   [[8,7,30,4,'t'],[8,16,18,26,'b'],[29,16,18,26,'b'],[50,16,18,26,'b'],[71,16,18,26,'b']] },

 { id:'L_time', name:'هێڵی کات', needs:['timeline'], card:true, wire:
   [[8,7,30,4,'t'],[10,28,76,2,'p'],[16,25,7,7,'o'],[36,25,7,7,'o'],[56,25,7,7,'o'],[76,25,7,7,'o']] },

 { id:'L_table', name:'خشتە', needs:['table'], card:true, wire:
   [[8,7,30,4,'t'],[8,16,80,5,'p'],[8,23,80,4,'x'],[8,29,80,4,'x'],[8,35,80,4,'x']] },

 { id:'L_compare', name:'بەراوردکردن', needs:['table'], card:true, wire:
   [[8,7,34,4,'t'],[8,16,80,5,'p'],[8,23,80,4,'x'],[8,29,80,4,'x'],[8,35,80,4,'x'],[8,41,80,4,'x']] },

 { id:'L_kpi', name:'ئامارەکان', needs:['kpis'], card:true, wire:
   [[8,7,30,4,'t'],[8,17,24,24,'b'],[36,17,24,24,'b'],[64,17,24,24,'b']] },

 { id:'L_quote', name:'وتە', needs:['quote'], card:true, wire:
   [[14,12,10,10,'a'],[14,25,68,4,'t'],[14,32,58,4,'t'],[14,40,22,3,'x']] },

 { id:'L_grid', name:'تۆڕی وێنە', needs:['image'], card:true, wire:
   [[8,7,30,4,'t'],[8,16,38,12,'i'],[50,16,38,12,'i'],[8,30,38,12,'i'],[50,30,38,12,'i']] },

 { id:'L_divider', name:'بەشکەر', needs:['none'], card:true, wire:
   [[36,12,24,16,'a'],[28,31,40,6,'t'],[42,40,12,2,'p']] },

 { id:'L_thanks', name:'سوپاس', needs:['none'], card:true, wire:
   [[34,14,28,4,'x'],[22,23,52,10,'t'],[42,38,12,2,'a']] },

 { id:'L_refs', name:'سەرچاوەکان', needs:['refs'], card:true, wire:
   [[8,7,30,4,'t'],[8,16,78,2.6,'x'],[8,22,74,2.6,'x'],[8,28,80,2.6,'x'],[8,34,70,2.6,'x'],[8,40,76,2.6,'x']] },

 { id:'L_def', name:'پێناسە', needs:['text'], card:true, wire:
   [[8,14,46,8,'t'],[8,25,26,2.6,'x'],[8,32,3,12,'a'],[15,33,64,3,'x'],[15,39,52,3,'x']] },

 { id:'L_code', name:'فۆرموول', needs:['text'], card:true, wire:
   [[8,7,30,4,'t'],[8,16,80,18,'b'],[30,38,36,5,'p']] },

 { id:'L_proscons', name:'باش و خراپ', needs:['proscons'], card:true, wire:
   [[8,7,34,4,'t'],[8,16,38,26,'b'],[50,16,38,26,'b'],[12,20,14,3,'p'],[54,20,14,3,'a']] },

 { id:'L_cycle', name:'سوڕ', needs:['steps'], card:true, wire:
   [[8,7,30,4,'t'],[34,14,28,28,'o'],[42,10,12,7,'p'],[42,38,12,7,'p'],[26,24,12,7,'a'],[58,24,12,7,'a']] },

 { id:'L_pyramid', name:'هەرەم', needs:['bullets'], bulletRange:[3,3], card:true, wire:
   [[8,7,30,4,'t'],[34,15,28,7,'a'],[26,24,44,7,'p'],[16,33,64,7,'i']] },

 { id:'L_venn', name:'ڤێن', needs:['bullets'], bulletRange:[2,2], card:true, wire:
   [[8,7,30,4,'t'],[26,16,26,26,'o'],[44,16,26,26,'o']] },

 { id:'L_flow', name:'خشتەی جوڵە', needs:['steps'], card:true, wire:
   [[8,7,32,4,'t'],[8,22,17,14,'b'],[28,22,17,14,'b'],[48,22,17,14,'b'],[68,22,17,14,'b']] },

 { id:'L_state', name:'ڕستەی سەرەکی', needs:['text'], card:true, wire:
   [[16,18,64,6,'t'],[24,28,48,6,'t']] },

 { id:'L_team', name:'تیم', needs:['none'], card:true, wire:
   [[8,7,30,4,'t'],[18,18,16,16,'o'],[40,18,16,16,'o'],[62,18,16,16,'o'],[18,38,16,2.4,'x'],[40,38,16,2.4,'x'],[62,38,16,2.4,'x']] },

 { id:'L_progress', name:'پێوەر', needs:['chart'], card:true, wire:
   [[8,7,30,4,'t'],[8,17,50,3.4,'p'],[8,24,66,3.4,'a'],[8,31,40,3.4,'p'],[8,38,78,3.4,'a']] },

 // ═══ پێشتر [٦,٦] بوو — واتە **ڕێک شەش** خاڵ ═══
 // ئەمە هۆکاری «هیچ ئایکۆنێک نییە» بوو. مۆدێل بە دەگمەن ڕێک شەش
 // خاڵ دەنووسێت؛ بە سێ یان چوار خاڵ ئەم تەختەبەندە بە تەواوی
 // دەردەچوو و سلایدەکە دەکەوتە سەر `L_bullets` یان `L_text` — کە
 // نە کارتی تایبەتمەندی هەیە و نە ژمارە. کۆگای ئایکۆنەکە (١٠٠١
 // پشکنین) هەبوو و هەرگیز شوێنێکی نەدەبوو بۆ دەرکەوتن.
 { id:'L_icons', name:'تایبەتمەندی', needs:['bullets'], bulletRange:[3,6], card:true, wire:
   [[8,7,30,4,'t'],[8,16,25,12,'b'],[36,16,25,12,'b'],[64,16,25,12,'b'],[8,30,25,12,'b'],[36,30,25,12,'b'],[64,30,25,12,'b']] },

 { id:'L_ba', name:'پێش و پاش', needs:['bullets'], bulletRange:[2,2], card:true, wire:
   [[8,7,30,4,'t'],[8,16,40,26,'b'],[48,16,40,26,'p']] },
];

export const layoutById = (id: LayoutId) =>
  LAYOUTS.find(l => l.id === id) ?? LAYOUTS[1];

// ─────────── توانای دەق ───────────
//
// هەمان ژمارەکانی `SlideView` و `pptx.ts`. لێرەدان تا `fix_overflow`
// بتوانێت پێش وەخت بزانێت دەقەکە دەگونجێت یان نا — بەبێ ئەوەی
// پێویستی بە DOM بێت.

/** ناوچەی ناوەڕۆک — ژێر ناونیشان و هێڵەکە */
export const BODY = { w: 1596.6 - 76 * 2, h: 859.5 - 62 * 2 - 128 };

export interface TextBox {
  /** پانی خانەی دەق بە پیکسڵ */
  w: number;
  /** بەرزی خانەی دەق */
  h: number;
  /** قەبارەی دەستپێکی فۆنت */
  size: number;
  gap: number;
  indent: number;
  /** چەند خاڵ لە یەک خانەدا دەبن — بۆ تەختەبەندی ستوونی */
  per: number;
}

const BOX = (w: number, h: number, size: number, gap = 25, indent = 42, per = 99): TextBox =>
  ({ w, h, size, gap, indent, per });

/**
 * خانەی دەقی تەختەبەندێک.
 *
 * بۆ تەختەبەندی ستوونی، `w`/`h` هی **یەک** ستوونن و `per` دەڵێت چەند
 * خاڵ لە هەر ستوونێکدا دەبێت — بۆیە ژمێردنەکە دروستە.
 */
export function textBox(id: LayoutId): TextBox {
  switch (id) {
    // وێنە ٥٤٥px دەگرێت + ٥٤px بۆشایی
    case 'L_bullets':
    case 'L_bulletsL': return BOX(BODY.w - 545 - 54, BODY.h, 35);
    case 'L_donut':    return BOX(BODY.w / 2, BODY.h, 32);
    case 'L_hero':     return BOX(1596.6 * 0.64 - 176, 859.5 - 184, 33, 0, 0, 1);
    case 'L_text':     return BOX(BODY.w, BODY.h, 32, 0, 0, 1);
    case 'L_outline':  return BOX((BODY.w - 66) / 2, BODY.h, 37, 26, 84, 2);
    case 'L_refs':     return BOX(BODY.w, BODY.h, 25, 20, 52);
    // ستوونەکان — پان بەشکراوە، بەرزی تەواو
    case 'L_two':      return BOX((BODY.w - 50) / 2 - 72, BODY.h - 76, 29, 0, 0, 1);
    case 'L_three':    return BOX((BODY.w - 64) / 3 - 60, BODY.h - 100, 24, 0, 0, 1);
    case 'L_ba':       return BOX((BODY.w - 40) / 2 - 72, BODY.h - 76, 29, 0, 0, 1);
    case 'L_icons':    return BOX((BODY.w - 56) / 3 - 48, BODY.h / 2 - 40, 24, 0, 0, 1);
    case 'L_steps':    return BOX((BODY.w - 78) / 4 - 52, BODY.h - 176, 24, 0, 0, 1);
    case 'L_flow':     return BOX((BODY.w - 60) / 4 - 40, BODY.h / 2, 24, 0, 0, 1);
    case 'L_pyramid':  return BOX(BODY.w * 0.62, 112, 30, 0, 0, 1);
    case 'L_venn':     return BOX(430, 430, 30, 0, 0, 1);
    case 'L_quote':    return BOX(BODY.w - 140, 280, 48, 0, 0, 1);
    case 'L_state':    return BOX(BODY.w - 200, 240, 56, 0, 0, 1);
    case 'L_def':      return BOX(BODY.w, 300, 32, 0, 0, 1);
    default:           return BOX(BODY.w, BODY.h, 35);
  }
}

/** تەختەبەندەکانی گونجاو بۆ ناوەڕۆکی ئاسایی — AI لەمانە هەڵدەبژێرێت */
export const CONTENT_LAYOUTS: LayoutId[] = [
  'L_bullets','L_bulletsL','L_text','L_bar','L_line','L_donut','L_hero',
  'L_two','L_three','L_steps','L_time','L_table','L_compare','L_kpi',
  'L_quote','L_grid','L_def','L_code','L_proscons','L_cycle','L_pyramid',
  'L_venn','L_flow','L_state','L_progress','L_icons','L_ba','L_divider',
];

/** وێنەی وایەرفرەیم وەک SVG string */
const FILL: Record<string, string> = {
  t:'#2E3B52', x:'#93A0B5', i:'#C3CCDA', a:'#E0B44F', p:'#5C77BC', b:'#DEE5EF', o:'#5C77BC',
};

export function wireSvg(wire: LayoutDef['wire'], W = 96, H = 50) {
  const parts = wire.map(([x, y, w, h, k]) =>
    k === 'o'
      ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}" fill="none" stroke="${FILL[k]}" stroke-width="${Math.max(1.6, w / 5)}"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(2.2, h / 2)}" fill="${FILL[k]}"${k === 'b' ? ' stroke="#C6D0DE" stroke-width=".7"' : ''}/>`
  );
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}
