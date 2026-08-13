// ═══════════ چاندنی Morph لە ناو فایلی PPTX ═══════════
//
// pptxgenjs پشتگیری گواستنەوە (transition) ناکات. بەڵام فایلێکی .pptx
// لە بنەڕەتدا ZIP ـێکە پڕ لە XML. بۆیە دوای دروستکردنی فایلەکە،
// ZIP ـەکە دەکەینەوە و <p:transition> ی خۆمان دەخەینە ناو هەر سلایدێک.
//
// ئەمە هەمان تەکنیکە کە لە فایلی بەکارهێنەردا دۆزراوەیە:
//   <p:transition spd="slow" p14:dur="2000">
//     <p159:morph option="byObject"/>
//     <p:fade/>
//   </p:transition>

import JSZip from 'jszip';
import { injectMath } from '../math';

const NS_P   = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
const NS_P159= 'http://schemas.microsoft.com/office/powerpoint/2015/09/main';
const NS_MC  = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

export interface MorphOpts {
  durationMs: number;
  /** byObject = توخمەکان بە ناو دەناسرێنەوە (باشترینە بۆ دەق) */
  option?: 'byObject' | 'byWord' | 'byChar';
  /** ئەنیمەیشنی ناو سلاید — ناوەڕۆک یەک لەدوای یەک دەردەکەوێت */
  builds?: boolean;
  /** گواستنەوەی Morph — بەتاڵ = بەڵێ */
  morph?: boolean;
  /**
   * فۆنتی «Complex Script» بۆ دەقی کوردی و عەرەبی.
   *
   * pptxgenjs هەر سێ خانەکەی فۆنت (latin/ea/cs) لە یەک ناوەوە پڕ
   * دەکاتەوە، بۆیە Georgia — کە هیچ پیتێکی عەرەبی نییە — دەچێتە ناو
   * خانەی `cs` ـەوە. ئەوە هۆکاری چوارگۆشە بەتاڵەکانە.
   */
  csFont?: string | null;
}

// ─────────── ڕێکخستنی پەرەگرافەکان ───────────
//
// pptxgenjs بۆ **هەر ڕەوانەیەک** `<a:pPr>` ـێک دەنووسێت، تەنانەت
// کاتێک هەموویان لە یەک پەرەگرافدان. بەڵام سکیمای OOXML دەڵێت:
//
//     CT_TextParagraph ::= (a:pPr)? (a:r | a:br | a:fld)* (a:endParaRPr)?
//
// واتە `pPr` دەبێت یەکجار بێت، و لە سەرەتاوە. زیاتر لەوە ناتەواوە.
// PowerPoint لێی خۆشدەبێت، بەڵام پشکنەرە توندەکان نا — و ئەوەی دوایی
// دێت دەکرێت ئەوەی پێشوو پووچ بکاتەوە (نیشانەی خاڵ ونبوو بەمە).
//
// ئەم بەشە هەموویان دەکاتە یەکێک: یەکەم بەها دەبات بۆ هەر خانەیەک،
// بەڵام خانە بەتاڵەکان لە پەرەگرافەکانی دواتر پڕ دەکرێنەوە — بۆیە
// `spcAft` کە لەسەر دوا ڕەوانەیە نافەوتێت.

/** خانەکانی CT_TextParagraphProperties بە ڕیزبەندی سکیماکە */
const PPR_ORDER = [
  'lnSpc', 'spcBef', 'spcAft',
  'buClr', 'buSz', 'buFont', 'bullet',
  'tabLst', 'defRPr', 'extLst',
];

/** تاگ → خانە. هەندێک تاگ ئاڵترناتیڤی یەکترن و یەک خانە دەگرن. */
function slotOf(tag: string): string {
  if (tag === 'buNone' || tag === 'buAutoNum' || tag === 'buChar') return 'bullet';
  if (tag === 'buFontTx' || tag === 'buFont') return 'buFont';
  if (tag === 'buSzTx' || tag === 'buSzPct' || tag === 'buSzPts') return 'buSz';
  if (tag === 'buClrTx' || tag === 'buClr') return 'buClr';
  return tag;
}

const CHILD_RE = /<a:(\w+)(?:\s[^>]*?)?(?:\/>|>[\s\S]*?<\/a:\1>)/g;
const ATTR_RE = /([\w:]+)="([^"]*)"/g;
const PPR_RE = /<a:pPr(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/a:pPr>)/g;

/** هەموو `<a:pPr>` ـەکانی یەک پەرەگراف دەکاتە یەکێک لە سەرەتادا */
function mergeParagraph(p: string): string {
  const found = [...p.matchAll(PPR_RE)];
  if (found.length < 2) return p;

  const attrs = new Map<string, string>();
  const slots = new Map<string, string>();

  for (const m of found) {
    for (const a of (m[1] ?? '').matchAll(ATTR_RE))
      if (!attrs.has(a[1])) attrs.set(a[1], a[2]);

    for (const c of (m[2] ?? '').matchAll(CHILD_RE)) {
      const slot = slotOf(c[1]);
      if (!slots.has(slot)) slots.set(slot, c[0]);
    }
  }

  const attrXml = [...attrs].map(([k, v]) => ` ${k}="${v}"`).join('');
  const inner = PPR_ORDER.map(s => slots.get(s) ?? '').join('');
  const merged = inner ? `<a:pPr${attrXml}>${inner}</a:pPr>` : `<a:pPr${attrXml}/>`;

  // هەموو کۆنەکان لادەبرێن و یەکە نوێیەکە دەچێتە سەرەتاوە
  return p.replace('<a:p>', '<a:p>\u0000').replace(PPR_RE, '').replace('\u0000', merged);
}

/** هەموو پەرەگرافەکانی سلایدێک ڕێک دەخات */
export function normalizeParagraphs(xml: string): string {
  return xml.replace(/<a:p>[\s\S]*?<\/a:p>/g, mergeParagraph);
}

/**
 * فۆنتی عەرەبی/کوردی دەخاتە ناو خانەی `cs` ـەوە.
 * خانەی `latin` دەستی لێنادرێت — دەقی ئینگلیزی هەر بە فۆنتی
 * هەڵبژێردراوی خۆی دەمێنێتەوە.
 */
export function setComplexScriptFont(xml: string, font: string): string {
  return xml.replace(/<a:cs typeface="[^"]*"/g, `<a:cs typeface="${font}"`);
}

/**
 * XML ی گواستنەوە.
 * mc:AlternateContent بەکاردەهێنین تا ئەو وەشانانەی PowerPoint کە Morph
 * ناناسن، بکەونە سەر Fade ـی سادە لەبری ئەوەی فایلەکە تێک بچێت.
 */
function transitionXml(o: MorphOpts): string {
  const opt = o.option ?? 'byObject';
  return (
    `<mc:AlternateContent xmlns:mc="${NS_MC}">` +
      `<mc:Choice xmlns:p159="${NS_P159}" Requires="p159">` +
        `<p:transition xmlns:p14="${NS_P14}" spd="slow" p14:dur="${o.durationMs}">` +
          `<p159:morph option="${opt}"/>` +
        `</p:transition>` +
      `</mc:Choice>` +
      `<mc:Fallback>` +
        `<p:transition xmlns:p14="${NS_P14}" spd="slow" p14:dur="${o.durationMs}">` +
          `<p:fade/>` +
        `</p:transition>` +
      `</mc:Fallback>` +
    `</mc:AlternateContent>`
  );
}

/** دڵنیادەبێتەوە کە ناوبانگی p14 و mc لە تاگی سەرەکیدا هەن */
function ensureNamespaces(xml: string): string {
  return xml.replace(/<p:sld\b([^>]*)>/, (full, attrs: string) => {
    let a = attrs;
    if (!a.includes('xmlns:mc='))   a += ` xmlns:mc="${NS_MC}"`;
    if (!a.includes('xmlns:p14='))  a += ` xmlns:p14="${NS_P14}"`;
    if (!a.includes('xmlns:p='))    a += ` xmlns:p="${NS_P}"`;
    return `<p:sld${a}>`;
  });
}

/**
 * <p:transition> دەبێت **دوای** <p:cSld> و <p:clrMapOvr> بێت،
 * بەڵام **پێش** <p:timing>. ئەگەر ڕیزبەندییەکە هەڵە بێت PowerPoint
 * فایلەکە بە تێکچوو دەژمێرێت.
 */
function insertTransition(xml: string, tx: string): string {
  if (xml.includes('<p:transition') || xml.includes('p159:morph')) return xml;

  const closeMap = xml.indexOf('</p:clrMapOvr>');
  if (closeMap !== -1) {
    const at = closeMap + '</p:clrMapOvr>'.length;
    return xml.slice(0, at) + tx + xml.slice(at);
  }

  // clrMapOvr ی بەتاڵ: <p:clrMapOvr .../>
  const selfClose = xml.match(/<p:clrMapOvr\b[^>]*\/>/);
  if (selfClose) {
    const at = xml.indexOf(selfClose[0]) + selfClose[0].length;
    return xml.slice(0, at) + tx + xml.slice(at);
  }

  // پاشەکەوتی کۆتایی: پێش داخستنی <p:sld>
  const end = xml.lastIndexOf('</p:sld>');
  return end !== -1 ? xml.slice(0, end) + tx + xml.slice(end) : xml;
}

// ─────────── ئەنیمەیشنی ناو سلاید ───────────
//
// گواستنەوە جوڵەیە لە نێوان دوو سلاید. ئەمە جیاوازە: ناوەڕۆکی سلایدەکە
// خۆی یەک لەدوای یەک دەردەکەوێت — ناونیشان، ئینجا خاڵەکان، ئینجا وێنە.
//
// پێکهاتەکە لە ڕەسمی OOXML ـەوەیە. ڕیزبەندییەکە وردە و PowerPoint
// لێبوردەیی نییە:
//   p:timing → p:tnLst → p:par → p:cTn(tmRoot) → p:childTnLst
//            → p:seq(mainSeq) → p:cTn → p:childTnLst
//            → p:par (گروپی کلیک) → p:par (گروپی کاریگەری) → p:par (کاریگەرییەکە)
//
// presetID="10" presetClass="entr" = «Fade». هەڵبژێردراوە چونکە لە
// هەموو وەشانەکاندا هەیە و ئەگەر پشتگیری نەکرێت تەنها دەردەکەوێت.

/** ناسنامەی تایمنۆدەکان دەبێت یەکتا بن لەناو سلایدێکدا */
let tn = 0;
const nid = () => ++tn;

/**
 * جۆری کاریگەری بەپێی توخمەکە.
 *
 * دیزاینەری پیشەیی زۆر جۆر بەکارناهێنێت — تێکەڵاوێکی سنووردار:
 *   ~٩٠٪ Fade  ·  ~٥٪ Zoom  ·  ~٥٪ Float
 * ئەوەی دەگۆڕێت خێرایی و ڕیزبەندییە، نەک ژمارەی کاریگەرییەکان.
 */
type Fx = 'fade' | 'zoom' | 'float';

const PRESET: Record<Fx, { id: number; sub: number }> = {
  fade:  { id: 10, sub: 0 },     // Fade
  zoom:  { id: 23, sub: 0 },     // Zoom
  float: { id: 42, sub: 8 },     // Float In (Rise Up)
};

/** ناوەڕۆکی کاریگەرییەکە — لێڵبوونەوە هەمیشە هەیە، ئەوانی تر لەسەری */
function body(fx: Fx, spid: string, ms: number): string {
  const tgt = `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;

  // نەرمی: خێرا دەست پێدەکات، بەهێمنی دەوەستێت (ease-out).
  // بەهاکان لە هەزارەم ڕێژەدان: ٢٠٠٠٠ = ٢٠٪
  const ease = `accel="20000" decel="40000"`;

  const fade =
    `<p:animEffect transition="in" filter="fade">` +
      `<p:cBhvr><p:cTn id="${nid()}" dur="${ms}" ${ease}/>${tgt}</p:cBhvr>` +
    `</p:animEffect>`;

  if (fx === 'zoom')
    return fade +
      `<p:animScale>` +
        `<p:cBhvr><p:cTn id="${nid()}" dur="${ms}" fill="hold" ${ease}/>${tgt}</p:cBhvr>` +
        `<p:from x="72000" y="72000"/><p:to x="100000" y="100000"/>` +
      `</p:animScale>`;

  if (fx === 'float')
    return fade +
      `<p:anim calcmode="lin" valueType="num">` +
        `<p:cBhvr additive="base">` +
          `<p:cTn id="${nid()}" dur="${ms}" fill="hold" ${ease}/>${tgt}` +
          `<p:attrNameLst><p:attrName>ppt_y</p:attrName></p:attrNameLst>` +
        `</p:cBhvr>` +
        `<p:tavLst>` +
          `<p:tav tm="0"><p:val><p:strVal val="#ppt_y+.045"/></p:val></p:tav>` +
          `<p:tav tm="100000"><p:val><p:strVal val="#ppt_y"/></p:val></p:tav>` +
        `</p:tavLst>` +
      `</p:anim>`;

  return fade;
}

/** یەک کاریگەری «هاتنە ژوورەوە» بۆ شێوەیەک */
function effect(spid: string, fx: Fx, delay: number, ms: number, first: boolean): string {
  const p = PRESET[fx];
  return (
    `<p:par><p:cTn id="${nid()}" fill="hold">` +
      `<p:stCondLst><p:cond delay="${first ? 'indefinite' : '0'}"/></p:stCondLst>` +
      `<p:childTnLst>` +
        `<p:par><p:cTn id="${nid()}" fill="hold">` +
          `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
          `<p:childTnLst>` +
            `<p:par><p:cTn id="${nid()}" presetID="${p.id}" presetClass="entr" presetSubtype="${p.sub}"` +
              ` fill="hold" grpId="0" nodeType="${first ? 'clickEffect' : 'afterEffect'}">` +
              `<p:stCondLst><p:cond delay="${delay}"/></p:stCondLst>` +
              `<p:childTnLst>` +
                // یەکەم: توخمەکە دەکرێتە «بەدیار» — بەبێ ئەمە پێش کاتی خۆی دەردەکەوێت
                `<p:set><p:cBhvr>` +
                  `<p:cTn id="${nid()}" dur="1" fill="hold">` +
                    `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
                  `</p:cTn>` +
                  `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
                  `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>` +
                `</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>` +
                body(fx, spid, ms) +
              `</p:childTnLst>` +
            `</p:cTn></p:par>` +
          `</p:childTnLst>` +
        `</p:cTn></p:par>` +
      `</p:childTnLst>` +
    `</p:cTn></p:par>`
  );
}

/** بلۆکی تەواوی <p:timing> بۆ لیستێک لە شێوەکان */
function timingXml(targets: { id: string; fx: Fx }[]): string {
  if (!targets.length) return '';
  tn = 0;
  const root = nid(), seq = nid();

  // پێچەوانەی ڕیزبەندی: یەکەمیان بە کلیک، ئەوانی تر خۆکار بەدوایدا.
  // ماوەی نێوانیان ١٤٠ms ـە — بەس بۆ ئەوەی ڕیزەکە هەست پێبکرێت،
  // بەڵام نەک ئەوەندە کە بەکارهێنەر چاوەڕوان بکات.
  const kids = targets.map((t, i) =>
    effect(t.id, t.fx, i === 0 ? 0 : 140, t.fx === 'fade' ? 450 : 600, i === 0)).join('');

  return (
    `<p:timing><p:tnLst>` +
      `<p:par><p:cTn id="${root}" dur="indefinite" restart="never" nodeType="tmRoot">` +
        `<p:childTnLst>` +
          `<p:seq concurrent="1" nextAc="seek">` +
            `<p:cTn id="${seq}" dur="indefinite" nodeType="mainSeq">` +
              `<p:childTnLst>${kids}</p:childTnLst>` +
            `</p:cTn>` +
            `<p:prevCondLst><p:cond evt="onPrev" delay="0">` +
              `<p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
            `<p:nextCondLst><p:cond evt="onNext" delay="0">` +
              `<p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
          `</p:seq>` +
        `</p:childTnLst>` +
      `</p:cTn></p:par>` +
    `</p:tnLst></p:timing>`
  );
}

/**
 * ناسنامەی ئەو شێوانە کە دەبێت ئەنیمەیت بکرێن.
 *
 * شێوەکانی پاشبنەما (`deco*`) و کارتەکە بەجێدەهێڵرێن: ئەوانە Morph
 * دەیانجوڵێنێت، و ئەگەر ئەنیمەیتیش بکرێن جوڵەکە پێکەوە تێکەڵ دەبێت.
 */
function animatableIds(xml: string): { id: string; fx: Fx }[] {
  // spTree بە توخمی سەرەوە دەبڕدرێت، تا بزانین هەریەکەیان چییە:
  //   <p:pic>          → وێنە
  //   <p:graphicFrame> → چارت یان خشتە
  //   <p:sp>           → شێوە یان دەق
  const tree = xml.match(/<p:spTree[\s\S]*?<\/p:spTree>/)?.[0] ?? '';
  const nodes = tree.match(/<p:(sp|pic|graphicFrame)\b[\s\S]*?<\/p:\1>/g) ?? [];

  const out: { id: string; fx: Fx }[] = [];
  for (const node of nodes) {
    const m = node.match(/<p:cNvPr\s+id="(\d+)"\s+name="([^"]*)"/);
    if (!m) continue;
    const [, id, name] = m;

    if (/^deco\d/.test(name)) continue;       // ئەمانە Morph دەیانجوڵێنێت
    if (id === '1') continue;                 // گروپی سەرەکی سلایدەکە

    // دیزاینەری پیشەیی زۆرترین شت بە Fade دەکات. Zoom تەنها بۆ وێنە،
    // Float تەنها بۆ شێوە بچووکەکان — واتە ~٩٠٪ Fade.
    const fx: Fx = node.startsWith('<p:pic')          ? 'zoom'
                 : node.startsWith('<p:graphicFrame') ? 'fade'
                 : isSmallShape(node)                 ? 'float'
                 :                                      'fade';
    out.push({ id, fx });
  }

  // ٦ بەس بەسە — زیاتری وا دەکات بەکارهێنەر چاوەڕوان بکات
  return out.slice(0, 6);
}

/** شێوەیەکی بچووکی بێدەق — ئایکۆن یان خاڵێکی ڕازاندنەوە */
function isSmallShape(node: string): boolean {
  if (/<a:t>/.test(node)) return false;                 // دەقی تێدایە
  const ext = node.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
  if (!ext) return false;
  return +ext[1] < 1_500_000 && +ext[2] < 1_500_000;    // < ~١.٦ ئینچ
}

/** <p:timing> ی هەیە دەگۆڕێتەوە، یان دوای گواستنەوەکە دایدەنێت */
function setTiming(xml: string, timing: string): string {
  if (!timing) return xml;
  if (/<p:timing[\s>]/.test(xml))
    return xml.replace(/<p:timing[\s\S]*?<\/p:timing>|<p:timing\s*\/>/, timing);
  const end = xml.lastIndexOf('</p:sld>');
  return end !== -1 ? xml.slice(0, end) + timing + xml.slice(end) : xml;
}

/** هەر شێوەیەکی داتای دووگۆشە بۆ ArrayBuffer — لە وێبگەڕ و لە Node دا کاردەکات */
type Binary = Blob | ArrayBuffer | Uint8Array;

async function toArrayBuffer(data: Binary): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    // کۆپییەکی سەربەخۆ، نەک دیمەنێک بۆ سەر بەفەرێکی گەورەتر
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  return data.arrayBuffer();
}

/**
 * دوا هەنگاوی هەناردەکردن — فایلەکە دەکرێتەوە و XML ـەکەی چاک دەکرێت.
 *
 * سێ شت لێرەدا ڕوودەدەن، و هەر سێکیان پێویستن:
 *
 *   ١) ڕێکخستنی پەرەگراف — هەمیشە. سکیمای OOXML ـە، نەک ڕازاندنەوە.
 *   ٢) فۆنتی cs — هەمیشە کاتێک دێککەکە کوردی/عەرەبییە. بەبێ ئەمە
 *      دەقەکە دەکرێت چوارگۆشەی بەتاڵ بێت لەسەر کۆمپیوتەرێکی تر.
 *   ٣) Morph و ئەنیمەیشن — بەپێی هەڵبژاردنی بەکارهێنەر.
 */
export async function finalizePptx(pptx: Binary, opts: MorphOpts): Promise<Blob> {
  const zip = await JSZip.loadAsync(await toArrayBuffer(pptx));
  const tx = transitionXml(opts);
  const morph = opts.morph !== false;

  const slidePaths = Object.keys(zip.files)
    .filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => num(a) - num(b));

  // تێبینییەکانی قسەکەریش دەقیان تێدایە — فۆنتی ئەوانیش ڕاست دەکرێت
  const notePaths = Object.keys(zip.files)
    .filter(p => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(p));

  for (const path of slidePaths) {
    const file = zip.file(path);
    if (!file) continue;
    let xml = await file.async('string');

    // ٠) فۆرموولەکان — نیشانەکان دەبنە هاوکێشەی ڕەسەنی Office.
    //    پێش ڕێکخستنی پەرەگراف، چونکە ڕەوانەیەک لادەبرێت.
    xml = injectMath(xml);

    // ١) سکیما — پێش هەر شتێکی تر، تا ئەوەی دوایی دێت لەسەر XML ـێکی
    //    ڕێکخراو کاربکات
    xml = normalizeParagraphs(xml);

    // ٢) فۆنتی پیتە ئاڵۆزەکان
    if (opts.csFont) xml = setComplexScriptFont(xml, opts.csFont);

    // ٣) گواستنەوە و ئەنیمەیشن
    if (morph || opts.builds !== false) xml = ensureNamespaces(xml);
    // سلایدی یەکەم شتێکی پێش خۆی نییە کە بۆی بجوڵێت
    if (morph && num(path) !== 1) xml = insertTransition(xml, tx);
    if (opts.builds !== false) xml = setTiming(xml, timingXml(animatableIds(xml)));

    zip.file(path, xml);
  }

  for (const path of notePaths) {
    const file = zip.file(path);
    if (!file) continue;
    let xml = normalizeParagraphs(await file.async('string'));
    if (opts.csFont) xml = setComplexScriptFont(xml, opts.csFont);
    zip.file(path, xml);
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
  });
}

/** ناوی کۆن — هێشتا کاردەکات */
export const injectTransitions = finalizePptx;

const num = (path: string) => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);

/**
 * پشکنین: دەڵێت چەند سلایدێک گواستنەوەیان لەسەرە.
 * بۆ دڵنیابوون لەوەی چاندنەکە سەرکەوتوو بووە.
 */
export async function countTransitions(data: Binary): Promise<number> {
  const zip = await JSZip.loadAsync(await toArrayBuffer(data));
  const paths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p));
  let n = 0;
  for (const p of paths) {
    const xml = await zip.file(p)!.async('string');
    if (xml.includes('p159:morph')) n++;
  }
  return n;
}
