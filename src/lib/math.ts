// ═══════════ فۆرمووڵی بیرکاری ═══════════
//
// خوێندکاری زانکۆ فۆرموول دەنووسێت. تا ئێستا وەک دەقی سادە دەنووسران:
//     E = mc^2        →  «E = mc^2»
// کە نە دروستە و نە جوانە.
//
// ئێستا دوو لا هەن، و هەردووکیان دەبێت هەمان شت پیشان بدەن:
//
//   ١) پێشبینین — KaTeX فۆرموولەکە دەکاتە HTML ـێکی جوان.
//
//   ٢) PowerPoint — فۆرموولەکە دەبێتە **هاوکێشەیەکی ڕەسەنی Office**
//      (OMML)، نەک وێنە. واتە خوێندکار دەتوانێت لە PowerPoint دا
//      دەستکاری بکات، و لەسەر پڕۆجێکتەر ڕوونە لە هەر قەبارەیەکدا.
//      ئەمە هەمان مەرجی C9 ـە: «توخمی ڕەسەن، نەک وێنە».
//
// ─── ڕێگای دووەم چۆن کاردەکات ───
//   TeX → (KaTeX) → MathML → (ئەم فایلە) → OMML → ناو فایلی .pptx
//
// pptxgenjs هیچ ڕووکارێکی هاوکێشەی نییە، بۆیە نیشانەیەک لە دەقەکەدا
// دادەنرێت و لە دوا هەنگاوی هەناردەکردندا (`finalizePptx`) دەگۆڕدرێت
// بە XML ـی ڕاستەقینە — هەمان تەکنیکی فۆنتی cs.

import katex from 'katex';

/** ناوچەی ناوی OMML */
export const NS_M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
/** ناوچەی ناوی a14 — پێچانەوەی هاوکێشە لەناو شێوەیەکدا */
export const NS_A14 = 'http://schemas.microsoft.com/office/drawing/2010/main';

// ─────────── دۆزینەوەی فۆرموول لە دەقدا ───────────

export interface Piece {
  kind: 'text' | 'math';
  value: string;
  /** $$…$$ = دیاریکراو (لە دێڕی خۆیدا) */
  display?: boolean;
}

/**
 * دەقێک دەکاتە پارچە.
 *
 *   $…$    فۆرموولی ناو دێڕ
 *   $$…$$  فۆرموولی سەربەخۆ
 *   \$     دۆلاری ڕاستەقینە — فۆرموول نییە
 *
 * ئەگەر هیچ فۆرموولێک نەبوو، یەک پارچەی دەق دەگەڕێتەوە. بۆیە
 * بانگکەرەکان پێویستیان بە حاڵەتی تایبەت نییە.
 */
export function split(text: string): Piece[] {
  const out: Piece[] = [];
  let buf = '';
  let i = 0;

  const flush = () => { if (buf) { out.push({ kind: 'text', value: buf }); buf = ''; } };

  while (i < text.length) {
    const c = text[i];

    // دۆلاری ئیسکەیپکراو — دەقە، نەک دەستپێکی فۆرموول
    if (c === '\\' && text[i + 1] === '$') { buf += '$'; i += 2; continue; }

    if (c === '$') {
      const display = text[i + 1] === '$';
      const mark = display ? '$$' : '$';
      const end = findClose(text, i + mark.length, mark);
      if (end > 0) {
        const body = text.slice(i + mark.length, end).trim();
        if (body) { flush(); out.push({ kind: 'math', value: body, display }); }
        i = end + mark.length;
        continue;
      }
      // دۆلارێکی داخراو نییە — وەک دەق دەیهێڵینەوە
    }

    buf += c;
    i++;
  }

  flush();
  return out.length ? out : [{ kind: 'text', value: text }];
}

function findClose(s: string, from: number, mark: string): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s.startsWith(mark, i)) return i;
  }
  return -1;
}

/** ئایا دەقەکە فۆرموولی تێدایە؟ */
export const hasMath = (text: string) => split(text).some(p => p.kind === 'math');

/** دەقی سادە — فۆرموولەکان بە TeX ی خۆیان دەمێننەوە */
export const plain = (text: string) =>
  split(text).map(p => (p.kind === 'math' ? p.value : p.value)).join('');

// ─────────── ١) پێشبینین ───────────

/**
 * فۆرموول → HTML.
 * `throwOnError: false` واتە TeX ـێکی تێکچوو بە سوور دەردەکەوێت
 * لەبری ئەوەی هەموو سلایدەکە تێک بچێت.
 */
export function toHtml(tex: string, display = false): string {
  try {
    return katex.renderToString(tex, {
      displayMode: display, throwOnError: false, output: 'html', strict: false,
    });
  } catch {
    return escapeHtml(tex);
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ─────────── ٢) OMML بۆ PowerPoint ───────────

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** ڕەوانەیەکی OMML */
function run(text: string, italic = false): string {
  if (!text) return '';
  const rPr = italic ? '' : '<m:rPr><m:sty m:val="p"/></m:rPr>';
  return `<m:r>${rPr}<m:t xml:space="preserve">${esc(text)}</m:t></m:r>`;
}

/** ئەو ئۆپەراتۆرانەی خۆیان سنووریان هەیە (∑ ∏ ∫ …) */
const NARY = new Set(['∑', '∏', '∐', '∫', '∬', '∭', '∮', '⋃', '⋂', '⨁', '⨂', '⨀']);

/**
 * نیشانەکانی سەرەوەی پیت.
 * KaTeX بۆ \bar و \hat و \vec پیتی جیاواز بەکاردەهێنێت لەوەی
 * چاوەڕوان دەکرێت (بۆ نموونە ˉ نەک ¯)، بۆیە هەموویان لێرەدان.
 */
const ACCENT = new Set([
  '¯', 'ˉ', '‾', '^', 'ˆ', '~', '˜', '˙', '¨', '˚', '˝', '`', '´',
  '→', '⃗', '←', '↔', '⌢', '⃑',
]);

/** ئایا ئەم نۆدە ئۆپەراتۆرێکی n-ary ـە؟ */
function naryChar(n: Node2 | undefined): string | null {
  if (!n || n.tag === '#text') return null;
  if (n.tag === 'mrow' || n.tag === 'mstyle') return naryChar(n.kids[0]);
  if (n.tag !== 'mo') return null;
  const c = textOf(n).trim();
  return NARY.has(c) ? c : null;
}

/** n-ary بە سنوورەکانییەوە */
function nary(chr: string, sub: string, sup: string, loc: 'undOvr' | 'subSup'): string {
  return `<m:nary><m:naryPr><m:chr m:val="${esc(chr)}"/>` +
         `<m:limLoc m:val="${loc}"/>` +
         (sub ? '' : '<m:subHide m:val="1"/>') +
         (sup ? '' : '<m:supHide m:val="1"/>') +
         `</m:naryPr><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup><m:e/></m:nary>`;
}

interface El {
  tag: string;
  attrs: Record<string, string>;
  kids: Node2[];
}
type Node2 = El | { tag: '#text'; text: string };

const isEl = (n: Node2): n is El => n.tag !== '#text';

/**
 * شیکەرەوەیەکی بچووکی XML.
 *
 * DOMParser لێرەدا بەکارنایەت: هەناردەکردن لە سکریپتی پشکنیندا
 * (Node) ـیش دەڕوات، و لەوێدا DOM نییە. MathML ـی KaTeX دیاریکراو و
 * سادەیە، بۆیە شیکەرەوەیەکی تایبەت بەسە.
 */
function parse(xml: string): Node2[] {
  const out: Node2[] = [];
  const stack: El[] = [];
  const push = (n: Node2) => (stack.length ? stack[stack.length - 1].kids : out).push(n);

  const re = /<\/?([\w:]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml))) {
    const [all, tag, rawAttrs, selfClose, text] = m;
    if (text !== undefined) {
      const t = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      if (t.trim()) push({ tag: '#text', text: t });
      continue;
    }
    if (all.startsWith('</')) { stack.pop(); continue; }

    const attrs: Record<string, string> = {};
    for (const a of (rawAttrs ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];

    const el: El = { tag: tag.replace(/^\w+:/, ''), attrs, kids: [] };
    push(el);
    if (!selfClose) stack.push(el);
  }
  return out;
}

const textOf = (n: Node2): string =>
  isEl(n) ? n.kids.map(textOf).join('') : n.text;

/** لیستی منداڵ → OMML */
const seq = (kids: Node2[]): string => kids.map(conv).join('');

/** یەک نۆد → OMML */
function conv(n: Node2): string {
  if (!isEl(n)) return run(n.text);

  const k = n.kids;
  switch (n.tag) {
    case 'math':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'semantics':
      return seq(k);

    // شیکردنەوەی TeX ـی سەرەکی — ناوەڕۆکی نییە بۆ ئێمە
    case 'annotation':
    case 'annotation-xml':
    case 'mspace':
      return '';

    case 'mi': {
      const t = textOf(n);
      // ناوی نووسراو (sin، log …) ڕاست دەنووسرێت، پیتی تاک لار
      return run(t, t.length === 1 && /[a-zA-Zα-ωΑ-Ω]/.test(t));
    }
    case 'mn':   return run(textOf(n));
    case 'mtext':return run(textOf(n));
    case 'mo':   return run(textOf(n));

    case 'mfrac':
      return `<m:f><m:fPr><m:type m:val="bar"/></m:fPr>` +
             `<m:num>${conv(k[0])}</m:num><m:den>${conv(k[1])}</m:den></m:f>`;

    // ژێرنووس و سەرنووس — بەڵام ئەگەر بنکەکە ∑ یان ∫ بێت، لە OMML دا
    // ئەوە n-ary ـە. sSubSup ـی سادە لە PowerPoint دا هەڵە دەردەکەوێت.
    case 'msup': {
      const c = naryChar(k[0]);
      if (c) return nary(c, '', conv(k[1]), 'subSup');
      return `<m:sSup><m:e>${conv(k[0])}</m:e><m:sup>${conv(k[1])}</m:sup></m:sSup>`;
    }
    case 'msub': {
      const c = naryChar(k[0]);
      if (c) return nary(c, conv(k[1]), '', 'subSup');
      return `<m:sSub><m:e>${conv(k[0])}</m:e><m:sub>${conv(k[1])}</m:sub></m:sSub>`;
    }
    case 'msubsup': {
      const c = naryChar(k[0]);
      if (c) return nary(c, conv(k[1]), conv(k[2]), 'subSup');
      return `<m:sSubSup><m:e>${conv(k[0])}</m:e>` +
             `<m:sub>${conv(k[1])}</m:sub><m:sup>${conv(k[2])}</m:sup></m:sSubSup>`;
    }

    case 'msqrt':
      return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr>` +
             `<m:deg/><m:e>${seq(k)}</m:e></m:rad>`;
    case 'mroot':
      return `<m:rad><m:deg>${conv(k[1])}</m:deg><m:e>${conv(k[0])}</m:e></m:rad>`;

    // ∑ و ∫ سنووریان لە ژێر و سەرەوەیە — لە OMML دا n-ary ـن
    case 'munderover': {
      const c = naryChar(k[0]);
      if (c) return nary(c, conv(k[1]), conv(k[2]), 'undOvr');
      return `<m:limUpp><m:e><m:limLow><m:e>${conv(k[0])}</m:e>` +
             `<m:lim>${conv(k[1])}</m:lim></m:limLow></m:e>` +
             `<m:lim>${conv(k[2])}</m:lim></m:limUpp>`;
    }
    case 'munder': {
      const c = naryChar(k[0]);
      if (c) return nary(c, conv(k[1]), '', 'undOvr');
      return `<m:limLow><m:e>${conv(k[0])}</m:e><m:lim>${conv(k[1])}</m:lim></m:limLow>`;
    }
    case 'mover': {
      const c = naryChar(k[0]);
      if (c) return nary(c, '', conv(k[1]), 'undOvr');
      const acc = textOf(k[1]).trim();
      // ¯ و ^ و → لەسەر پیت = نیشانە، نەک سنوور
      if (acc.length === 1 && (ACCENT.has(acc) || /[̀-ͯ]/.test(acc)))
        return `<m:acc><m:accPr><m:chr m:val="${esc(acc)}"/></m:accPr>` +
               `<m:e>${conv(k[0])}</m:e></m:acc>`;
      return `<m:limUpp><m:e>${conv(k[0])}</m:e><m:lim>${conv(k[1])}</m:lim></m:limUpp>`;
    }

    // خشتە (خانەکانی چەند دێڕی)
    case 'mtable':
      return `<m:m>${k.map((r: Node2) => `<m:mr>${
        isEl(r) ? r.kids.map(c => `<m:e>${conv(c)}</m:e>`).join('') : ''
      }</m:mr>`).join('')}</m:m>`;

    default:
      return seq(k);
  }
}

/**
 * TeX → OMML.
 *
 * ئەگەر KaTeX نەیتوانی شیبکاتەوە، دەقی خاوی TeX دەگەڕێتەوە وەک
 * ڕەوانەیەکی ئاسایی — سلایدەکە هەرگیز بەتاڵ نامێنێتەوە.
 */
export function toOmml(tex: string): string {
  let mathml = '';
  try {
    mathml = katex.renderToString(tex, {
      output: 'mathml', throwOnError: false, strict: false, displayMode: false,
    });
  } catch {
    return `<m:oMath xmlns:m="${NS_M}">${run(tex)}</m:oMath>`;
  }

  // KaTeX ی MathML لەناو <span class="katex"> دایە
  const inner = mathml.match(/<math[\s\S]*?<\/math>/)?.[0] ?? '';
  if (!inner) return `<m:oMath xmlns:m="${NS_M}">${run(tex)}</m:oMath>`;

  const body = seq(parse(inner));
  return `<m:oMath xmlns:m="${NS_M}">${body || run(tex)}</m:oMath>`;
}

// ─────────── نیشانەی ناو دەقەکە ───────────
//
// pptxgenjs ناتوانێت هاوکێشە بنووسێت، بۆیە لە جێی خۆیدا نیشانەیەک
// دادەنرێت و دواتر دەگۆڕدرێت. base64 بەکاردێت تا هیچ پیتێکی XML
// لەناویدا نەبێت.

const B64 = typeof btoa === 'function'
  ? (s: string) => btoa(unescape(encodeURIComponent(s)))
  : (s: string) => Buffer.from(s, 'utf8').toString('base64');

const UNB64 = typeof atob === 'function'
  ? (s: string) => decodeURIComponent(escape(atob(s)))
  : (s: string) => Buffer.from(s, 'base64').toString('utf8');

export const mark = (tex: string) => `[[math:${B64(tex)}]]`;

/** هەموو نیشانەکان دەگۆڕێت بە XML ـی هاوکێشەی ڕەسەن */
export const MARK_RE = /\[\[math:([A-Za-z0-9+/=]+)\]\]/g;

/**
 * ڕەوانەیەکی دەق کە تەنها نیشانەیەکی هاوکێشەی تێدایە دەگۆڕێت بە
 * هاوکێشەیەکی ڕەسەنی Office.
 *
 * `mc:AlternateContent` بەکاردێت تا وەشانە کۆنەکان دەقەکە ببینن
 * لەبری ئەوەی فایلەکە ڕەت بکەنەوە.
 */
export function injectMath(xml: string): string {
  // <a:r> …<a:t>[[math:…]]</a:t></a:r>  →  <a14:m>…</a14:m>
  return xml.replace(
    /<a:r>(?:(?!<\/a:r>)[\s\S])*?<a:t[^>]*>\[\[math:([A-Za-z0-9+/=]+)\]\]<\/a:t>\s*<\/a:r>/g,
    (_all, b64: string) => {
      let tex = '';
      try { tex = UNB64(b64); } catch { return _all; }
      return `<a14:m xmlns:a14="${NS_A14}">${toOmml(tex)}</a14:m>`;
    },
  );
}
