'use client';

// ═══════════ پیشاندانی سلاید ═══════════
// هەموو ٣٣ تەختەبەند لێرەدا وێنە دەکرێن.
// هەر توخمێکی گۆڕاو «slot» ـێکە — ئێدیتەر بەوانە دەیانگرێت.

import { memo, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { byId } from '@/lib/themes';
import { layoutById } from '@/lib/layouts';
import { iconSvg, shapeSvg } from '@/lib/icons';
import { fitBlock } from '@/lib/fit';
import { decoFor, CLIP } from '@/lib/deco';
import { styleById, densityById, type StylePack, type OutlineKind } from '@/lib/styles';
import { split, toHtml } from '@/lib/math';
import { styleById as citeStyleById, type CiteStyle } from '@/lib/citestyle';
import type { Deck, Slide, SlideElement, SlotId } from '@/lib/types';

// هەمان پێوانەکانی pptx.ts — کارت ١٥٩٦.٦×٨٥٩.٥ بە ناوەوەی ٧٦×٦٢،
// ناونیشان و هێڵەکە ١٢٨px لە سەرەوە دەگرن.
const BODY_W = 1596.6 - 76 * 2;
const BODY_H = 859.5 - 62 * 2 - 128;
/** بەرزی دێڕی پەرەگرافی درێژ — هەمان ژمارە لە pptx.ts و لە .prose دا */
const PROSE_LH = 1.55;


export interface SlideViewProps {
  deck: Deck;
  slide: Slide | null;          // null = لاپەڕەی سەرەتا
  /** دۆخی دەستکاری */
  editing?: boolean;
  selected?: SlotId | null;
  onSelect?: (slot: SlotId | null) => void;
  onSlotPointerDown?: (slot: SlotId, e: React.PointerEvent) => void;
  onResizeStart?: (slot: SlotId, e: React.PointerEvent) => void;
  innerRef?: React.Ref<HTMLDivElement>;
  /** ١ = قەبارەی تەواو (١٩٢٠×١٠٨٠). بۆ پێشبینین بچووک دەکرێتەوە. */
  scale?: number;
  /** توخمی زیادکراوی هەڵبژێردراو */
  selectedElement?: string | null;
  onElementPointerDown?: (id: string, e: React.PointerEvent) => void;
  onElementResize?: (id: string, e: React.PointerEvent) => void;

  /** داواکردنی وێنە ڕاستەوخۆ لە شوێنە بەتاڵەکەوە — بڕوانە `ImageAsk` */
  onImageAsk?: (prompt: string, mode: 'ai' | 'free') => void;
  imageBusy?: boolean;
  hasImageKey?: boolean;
}

/**
 * سلایدێک وێنە دەکات.
 *
 * بە `memo` پێچراوەتەوە: گەلەری ڕوخسار ٣٠ سلایدی زیندوو دەردەخات، و
 * هەریەکەیان دەیان توخمی DOM ـە لە بۆشایی ١٩٢٠×١٠٨٠ دا. بەبێ ئەوە،
 * گۆڕینی یەک پاشبنەما هەموو ٣٠ ـەکە لەنوێ وێنە دەکاتەوە.
 *
 * بەراوردی props ی بنەڕەتی (shallow) بەسە، بەڵام مەرجێکی هەیە:
 * گەلەرییەکە دەبێت `deck` ـەکان بە `useMemo` جێگیر بکات — ئەگەرنا هەر
 * ڕەندەرێک ئۆبجێکتێکی نوێ دروست دەکات و `memo` هیچ ناکات.
 */
function SlideViewBase(p: SlideViewProps) {
  const { deck, slide } = p;
  const theme = byId(deck.theme);
  const st = styleById(deck.style ?? 'glass');
  const dens = densityById(deck.density ?? 'normal');

  /**
   * ناسنامەی سەرچاوە → «نووسەر (ساڵ)».
   *
   * ═══ بۆچی لە دێککەکەوە، نەک لە سلایدەکەوە ═══
   * سلاید تەنها ناسنامەکان هەڵدەگرێت (`cites`). ناوەکە لە لاپەڕەی
   * سەرچاوەکانی **هەمان دێکک**ەوە دێت، بۆیە ئەوەی لەسەر سلایدەکە
   * دەردەکەوێت و ئەوەی لە لاپەڕەکەدایە هەرگیز جیا نابنەوە. ئەگەر
   * سەرچاوەیەک بسڕدرێتەوە، ئاماژەکەشی خۆی لادەچێت.
   */
  const refIndex = useMemo(() => {
    const page = deck.slides.find(x => x.layout === 'L_refs');
    if (!page?.refs?.length) return null;
    const m = new Map<string, string>();
    for (const r of page.refs) {
      if (!r.id) continue;
      const who = r.authors?.length
        ? `${r.authors[0].split(/[\s,]+/).pop()}${r.authors.length > 1 ? ' et al.' : ''}`
        : (r.title ?? r.text).slice(0, 24);
      m.set(r.id, r.year ? `${who} (${r.year})` : who);
    }
    return m.size ? m : null;
  }, [deck.slides]);
  const def = slide ? layoutById(slide.layout) : null;
  const rtl = deck.lang !== 'en';

  const styleVars = useMemo(() => {
    const v: Record<string, string | number> = { ...theme.v, '--serif': deck.fontFamily };
    if (p.scale !== undefined && p.scale !== 1) v.transform = `scale(${p.scale})`;
    return v as CSSProperties;
  }, [theme, deck.fontFamily, p.scale]);

  /** ستایلی زیادکراوی ئێدیتەر بۆ خانەیەک */
  const ov = (slot: SlotId): CSSProperties => {
    const o = slide?.overrides?.[slot];
    if (!o) return {};
    const s: CSSProperties = {};
    if (o.hidden) s.display = 'none';
    if (o.x !== undefined || o.y !== undefined) {
      s.position = 'absolute';
      s.left = o.x; s.top = o.y;
    }
    if (o.w !== undefined) s.width = o.w;
    if (o.h !== undefined) s.height = o.h;
    if (o.color) s.color = o.color;
    if (o.fontSize) s.fontSize = o.fontSize;
    if (o.fontFamily) s.fontFamily = o.fontFamily;
    if (o.rotate) s.transform = `rotate(${o.rotate}deg)`;
    return s;
  };

  const txt = (slot: SlotId, fallback: string) =>
    slide?.overrides?.[slot]?.text ?? fallback;

  /**
   * قەبارەی فۆنتی دەستی بۆ خانەیەک، ئەگەر بەکارهێنەر دایناوە.
   *
   * ئەمە دەچێتە ناو `fitBlock` ـەوە وەک `fixed` — نەک وەک ستایلێکی
   * CSS. ئەگەرنا هەڵبژاردنی خۆکار لەسەرەوە دەینووسێتەوە، کە ئەو
   * هەڵەیە بوو کە وای دەکرد گۆڕینی ژمارەکە هیچ نەکات.
   */
  const fixedSize = (slot: SlotId): number | undefined =>
    slide?.overrides?.[slot]?.fontSize;

  /** پێچانەوەی توخمێک بۆ ئێدیتەر */
  const Slot = ({ id, className = '', children, style }:
    { id: SlotId; className?: string; children: ReactNode; style?: CSSProperties }) => {
    const sel = p.editing && p.selected === id;
    return (
      <div
        className={`${className} ${p.editing ? 'slot' : ''} ${sel ? 'sel' : ''}`.trim()}
        style={{ ...style, ...ov(id) }}
        onPointerDown={p.editing ? e => { e.stopPropagation(); p.onSlotPointerDown?.(id, e); } : undefined}
      >
        {children}
        {sel && (
          <span
            className="handle"
            onPointerDown={e => { e.stopPropagation(); p.onResizeStart?.(id, e); }}
          />
        )}
      </div>
    );
  };

  const dir = rtl ? 'rtl' : 'ltr';

  return (
    <div
      ref={p.innerRef}
      className={`stage ${p.editing ? 'edit' : ''}`}
      data-st={st.id}
      style={styleVars}
      onPointerDown={() => p.onSelect?.(null)}
    >
      {/* شێوەکان گەشت دەکەن بەسەر سلایدەکاندا — بەبێ ئەوە Morph نادیارە */}
      {decoFor(slide ? deck.slides.findIndex(s => s.id === slide.id) + 1 : 0, st.deco).map(d => (
        <div key={d.name} className="deco"
          style={{ left: d.x, top: d.y, width: d.size, height: d.size,
                   background: `var(${d.tone})`, opacity: d.opacity,
                   clipPath: CLIP[d.kind],
                   transform: d.rotate ? `rotate(${d.rotate}deg)` : undefined }} />
      ))}

      {/* کرۆمی شێواز — هەمان شێوەکانی هەناردەکراوەکە */}
      {st.accent === 'edge' && (
        <div className="chrome edge" style={rtl ? { right: 0 } : { left: 0 }} />
      )}
      {st.accent === 'band' && (def?.card ?? true) && <div className="chrome band" />}

      {(def?.card ?? true) && st.card !== 'none' && <div className={`card c-${st.card}`} />}

      {slide === null
        ? <TitleSlide deck={deck} />
        : <Content slide={slide} dir={dir} rtl={rtl} Slot={Slot} txt={txt}
                   st={st} scale={dens.scale} cst={citeStyleById(deck.citeStyle)}
                   refIndex={refIndex}
                   editing={p.editing} onImageAsk={p.onImageAsk}
                   imageBusy={p.imageBusy} hasImageKey={p.hasImageKey} />}

      {/* توخمە زیادکراوەکان — هەمیشە لەسەرەوەن */}
      {slide?.elements?.map(el => (
        <Element
          key={el.id} el={el}
          editing={p.editing}
          selected={p.selectedElement === el.id}
          onDown={e => { e.stopPropagation(); p.onElementPointerDown?.(el.id, e); }}
          onResize={e => { e.stopPropagation(); p.onElementResize?.(el.id, e); }}
        />
      ))}
    </div>
  );
}

const SlideView = memo(SlideViewBase);
SlideView.displayName = 'SlideView';
export default SlideView;

// ─────────── توخمی زیادکراو ───────────

function Element({ el, editing, selected, onDown, onResize }: {
  el: SlideElement;
  editing?: boolean;
  selected?: boolean;
  onDown: (e: React.PointerEvent) => void;
  onResize: (e: React.PointerEvent) => void;
}) {
  const color = el.color || 'var(--pri)';
  const style: CSSProperties = {
    position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
    transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined,
    opacity: el.opacity ?? 1,
    color,
  };

  let inner: ReactNode = null;
  if (el.kind === 'image') {
    inner = (
      <img className={`el-img fr-${el.frame ?? 'none'}`} src={el.value} alt=""
        style={{
          border: el.borderWidth
            ? `${el.borderWidth}px solid ${el.borderColor || 'var(--pri)'}` : undefined,
        }} />
    );
  } else if (el.kind === 'icon') {
    inner = <span className="el-svg"
      dangerouslySetInnerHTML={{ __html: iconSvg(el.value, 'currentColor', el.strokeWidth ?? 2) }} />;
  } else if (el.kind === 'shape') {
    inner = <span className="el-svg"
      dangerouslySetInnerHTML={{ __html: shapeSvg(el.value, 'currentColor') }} />;
  } else {
    inner = (
      <div dir="auto" style={{
        fontSize: el.fontSize ?? 44, fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? 'italic' : 'normal', lineHeight: 1.25, width: '100%',
      }}>{el.value}</div>
    );
  }

  return (
    <div
      className={`el${editing ? ' slot' : ''}${selected ? ' sel' : ''}`}
      style={style}
      onPointerDown={editing ? onDown : undefined}
    >
      {inner}
      {selected && <span className="handle" onPointerDown={onResize} />}
    </div>
  );
}

// ─────────── لاپەڕەی سەرەتا ───────────

/**
 * لاپەڕەی سەرەتا هەمیشە LTR ـە، چونکە شوێنی هەموو توخمەکان
 * بە پیکسڵ دیاریکراوە (وەک دیزاینەکەی بەکارهێنەر).
 * بەڵام هەر دەقێک `dir="auto"` وەردەگرێت، تا وێبگەڕ خۆی بڕیار بدات:
 * ناوی کوردی → RTL، ناوی ئینگلیزی → LTR، و «Prepared:» دوونوکەکەی
 * لە شوێنی دروستدا دەمێنێتەوە.
 */
function TitleSlide({ deck }: { deck: Deck }) {
  const t = deck.titleInfo;
  const lines = [t.university, t.institute, t.department].filter(Boolean);
  return (
    <div className="tslide" dir="ltr">
      {t.logoUrl && <img className="logo" src={t.logoUrl} alt="" />}

      {lines.map((line, i) => (
        <div key={i} className="t" dir="auto"
             style={{ left: 255.4, top: 202.3 + i * 59.8, fontSize: 44, width: 1000 }}>
          {line}
        </div>
      ))}

      <div className="t" dir="auto"
           style={{ left: 0, top: 484.5, width: 1920, textAlign: 'center',
                    fontSize: 56, fontWeight: 700, fontStyle: 'italic' }}>
        {t.title}
      </div>

      <div className="t" dir="ltr"
           style={{ left: 211.2, top: 646.5, fontSize: 56, fontStyle: 'italic' }}>
        Prepared:
      </div>

      {t.students.filter(Boolean).map((name, i) => (
        <div key={i} className="t" dir="auto"
             style={{ left: 236.5 + 35.2 * i, top: 735 + 56.8 * i,
                      fontSize: 44, fontStyle: 'italic', width: 700 }}>
          {`${i + 1}- ${name}`}
        </div>
      ))}

      <div className="t" dir="auto" style={{ left: 1212.8, top: 794.3, fontSize: 56, width: 620 }}>
        {`${t.teacherPrefix} ${t.teacherName}`.trim()}
      </div>

      {t.year && (
        <div className="t" dir="ltr" style={{ left: 1212.8, top: 872, fontSize: 44 }}>{t.year}</div>
      )}
    </div>
  );
}

// ─────────── سلایدی ناوەڕۆک ───────────

interface CProps {
  slide: Slide;
  dir: 'rtl' | 'ltr';
  /** نووسینی کوردی/عەرەبی — بەرزی دێڕی کەمتر لە ١.٤ قبووڵ ناکات */
  rtl: boolean;
  Slot: (p: { id: SlotId; className?: string; children: ReactNode; style?: CSSProperties }) => ReactNode;
  txt: (slot: SlotId, fallback: string) => string;
  st: StylePack;
  /** ڕێژەی قەبارەی فۆنت لە چڕی دەقەوە */
  scale: number;
  /** شێوازی سەرچاوەنووسین — لاپەڕەی سەرچاوەکان بەمە دەگۆڕێت */
  cst: CiteStyle;
  /**
   * ناسنامەی سەرچاوە → «نووسەر (ساڵ)»، لە لاپەڕەی سەرچاوەکانی
   * هەمان دێککەوە. بەبێی، ئاماژەکانی سلاید پیشان نادرێن.
   */
  refIndex: Map<string, string> | null;

  /** دۆخی دەستکاری — شوێنی وێنە دەبێتە فۆرمێکی کارا */
  editing?: boolean;
  /**
   * داواکردنی وێنە لە شوێنە بەتاڵەکەوە.
   * `ai` = هەوڵی دروستکردن ئینجا بێبەرامبەر · `free` = ڕاستەوخۆ Openverse
   */
  onImageAsk?: (prompt: string, mode: 'ai' | 'free') => void;
  /** هێنانی وێنە بەڕێوەیە — دوگمەکان دەبەسترێن */
  imageBusy?: boolean;
  /** ئایا کلیلی وێنە دانراوە؟ ئەگەر نا، دوگمەی AI ناخرێتە ڕوو */
  hasImageKey?: boolean;
}

// ─────────── سلایدی «ناوەڕۆک» — چوار شێواز ───────────

/**
 * هەر شێوازێکی دیزاین ڕیزبەندییەکی جیاوازی هەیە بۆ ناوەڕۆک.
 * هەموویان یەک داتا پیشان دەدەن، بەڵام هیچیان وەک ئەوی تر نییە.
 */
function Outline({ items, kind, scale, rtl }:
  { items: string[]; kind: OutlineKind; scale: number; rtl: boolean }) {
  // ژمارەکە خۆی شوێن دەگرێت — بۆیە لە پێوانەی گونجاندندا دەژمێردرێت
  const indent = kind === 'cards' ? 0 : 84;
  const cols = kind === 'circles' || kind === 'cards' ? 2 : 1;
  const f = fitBlock({
    lines: items, indent,
    width: (BODY_W - (cols > 1 ? 66 : 0)) / cols,
    height: BODY_H * cols,
    size: Math.round(37 * scale), max: Math.round(52 * scale),
    lineHeight: 1.45, gap: 26, rtl,
  });
  const style = { fontSize: f.size, gap: f.gap } as CSSProperties;

  // `circles` بە `columns` کاردەکات — لەوێدا `gap` تەنها ستوونەکان
  // دەگرێتەوە، نەک ڕیزەکان. بۆیە بۆشاییەکە بە گۆڕاوێکی CSS دەنێردرێت.
  if (kind === 'circles')
    return (
      <ol className="outline"
          style={{ fontSize: f.size, ['--g' as string]: `${f.gap}px` } as CSSProperties}>
        {items.map((b, i) => <li key={i}>{b}</li>)}
      </ol>
    );

  if (kind === 'cards')
    return (
      <div className="ol-cards" style={style}>
        {items.map((b, i) => (
          <div className="oc" key={i}><span className="n">{i + 1}</span><span>{b}</span></div>
        ))}
      </div>
    );

  if (kind === 'rail')
    return (
      <div className="ol-rail" style={style}>
        <span className="spine" />
        {items.map((b, i) => (
          <div className="or" key={i}><span className="d" />{b}</div>
        ))}
      </div>
    );

  return (
    <div className="ol-rows" style={style}>
      {items.map((b, i) => (
        <div className="ow" key={i}>
          <span className="n">{String(i + 1).padStart(2, '0')}</span>
          <span className="tx">{b}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * بەستەرێک بۆ پیشاندان لەسەر سلاید.
 * `https://` لادەبرێت و ئەگەر زۆر درێژ بوو کورت دەکرێتەوە —
 * بەڵام هەمیشە بەشی ناسێنەری تێدا دەمێنێتەوە تا بپشکنرێت.
 */
function shortUrl(u: string): string {
  const bare = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return bare.length <= 58 ? bare : bare.slice(0, 55) + '…';
}

/** خاڵێک بە شێوەی «ناونیشان: ڕوونکردنەوە» دەشکێنێت */
function bulletParts(b: string) {
  const i = b.indexOf(':');
  return i > 0 && i < 40
    ? { head: b.slice(0, i + 1), rest: b.slice(i + 1).trim() }
    : { head: '', rest: b };
}

/**
 * دەقێک کە دەکرێت فۆرموولی تێدابێت.
 *
 * `$…$` و `$$…$$` بە KaTeX وێنە دەکرێن؛ ئەوانی تر دەقی سادەن.
 * ئەگەر هیچ فۆرموولێک نەبوو، هەمان دەق دەگەڕێتەوە — بۆیە هەموو
 * سلایدەکان دەتوانن بەمە بڕۆن بەبێ زیانی خێرایی.
 *
 * فۆرموولەکان هەمیشە LTR ـن، تەنانەت لە سلایدێکی کوردیشدا —
 * بیرکاری ئاراستەی خۆی هەیە.
 */
function MathText({ children }: { children: string }) {
  const parts = useMemo(() => split(children ?? ''), [children]);
  if (parts.length === 1 && parts[0].kind === 'text') return <>{children}</>;

  return (
    <>
      {parts.map((p, i) => p.kind === 'text'
        ? <span key={i}>{p.value}</span>
        : <span key={i} dir="ltr"
                className={`ktx${p.display ? ' blk' : ''}`}
                dangerouslySetInnerHTML={{ __html: toHtml(p.value, p.display) }} />)}
    </>
  );
}

/**
 * شوێنی وێنەی بەتاڵ — بەڵام کارا.
 *
 * ─── چی بوو ───
 * `<span>AI IMAGE</span>` ـێکی مردوو. سلایدەکە شوێنی وێنەی هەبوو،
 * وێنەکەی نەبوو، و بەکارهێنەر هیچ ڕێگایەکی نەبوو لە خودی سلایدەکەوە
 * — دەبوو بگەڕێت بۆ پانێڵێکی تر و بزانێت «وەسفی وێنە» لەکوێیە.
 * زۆربەیان هەرگیز نەیاندۆزییەوە و سلایدەکە بە خانەیەکی خۆڵەمێشی
 * دەمایەوە.
 *
 * ─── چی بوو بە ───
 * وەسفەکە لە خودی شوێنەکەدا دەنووسرێت، و دوو دوگمە: یەکێک دروستی
 * دەکات بە AI، ئەوی تر وێنەیەکی بێبەرامبەری Creative Commons دەهێنێت.
 * وەسفەکە پێشوەخت لە ناونیشانی سلایدەکەوە پڕ دەکرێتەوە، بۆیە
 * «هێنان» بە یەک کرتە کاردەکات.
 */
/**
 * شوێنی وێنە کاتێک وێنەیەک نییە — **بەڵام پرۆمپتێک هەیە**.
 *
 * ═══ داواکاری خاوەنی بەرهەم ═══
 * «ئەگەر وێنە زیاد نەکرا، با دەقەکە لە هەمان شوێنی وێنە بمێنێتەوە،
 * وەک پرۆمپتێک بۆ بەکارهێنەر — بڕوات بۆ هەر AI ـیەکی تر و
 * دروستی بکات.»
 *
 * بۆیە شوێنەکە بەتاڵ نامێنێتەوە و بێمانا نییە: دەقێکی ئامادەیە بۆ
 * لەبەرگرتنەوە. کرتەیەک لەبەری دەگرێتەوە، بۆیە بەکارهێنەر تەنها
 * دەیلکێنێت لە هەر ئامرازێکی وێنەدا.
 *
 * لە دۆخی دەستکاریدا `ImageAsk` جێگای دەگرێتەوە — ئەوە دەتوانێت
 * ڕاستەوخۆ وێنەکە بهێنێت، کە باشترە.
 */
function ImageBrief({ prompt }: { prompt: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="imgbrief" onPointerDown={e => e.stopPropagation()}>
      <span className="t">وێنە بۆ ئەم سلایدە</span>
      <p dir="ltr">{prompt}</p>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(prompt).then(
            () => { setDone(true); setTimeout(() => setDone(false), 1600); },
            () => { /* وێبگەڕ ڕێگەی نەدا — دەقەکە هێشتا دیارە */ },
          );
        }}>
        {done ? 'لەبەرگیرایەوە ✓' : 'لەبەرگرتنەوەی پرۆمپت'}
      </button>
      <span className="n">لە ChatGPT، Gemini یان هەر ئامرازێکی وێنەدا بیلکێنە</span>
    </div>
  );
}

function ImageAsk({ slide, busy, hasKey, onAsk }: {
  slide: Slide;
  busy: boolean;
  hasKey: boolean;
  onAsk: (prompt: string, mode: 'ai' | 'free') => void;
}) {
  const [q, setQ] = useState(slide.imagePrompt ?? '');
  // ناونیشانی سلایدەکە دەستپێکێکی باشە — بەتاڵی وا دەکات بەکارهێنەر
  // بوەستێت و بیربکاتەوە، لە کاتێکدا ٩٠٪ی جار ناونیشانەکە خۆی بەسە
  const text = q.trim() || slide.title.trim();

  return (
    <div className="imgask" onPointerDown={e => e.stopPropagation()}>
      <span className="t">وێنەی ئەم سلایدە</span>
      <textarea
        rows={2} value={q} dir="auto"
        placeholder={slide.title ? `بۆ نموونە: ${slide.title}` : 'وێنەکە چی پیشان بدات؟'}
        onChange={e => setQ(e.target.value)} />
      <div className="row">
        <button disabled={busy || !text} onClick={() => onAsk(text, 'free')}>
          {busy ? 'چاوەڕێ…' : 'وێنەی بێبەرامبەر'}
        </button>
        {hasKey && (
          <button className="pri" disabled={busy || !text} onClick={() => onAsk(text, 'ai')}>
            {busy ? 'چاوەڕێ…' : 'دروستکردن بە AI'}
          </button>
        )}
      </div>
      {!hasKey && <span className="n">بۆ دروستکردن بە AI، کلیلێکی وێنە لە ڕێکخستن دابنێ</span>}
    </div>
  );
}

function Content({ slide: s, dir, rtl, Slot, txt, st, scale, cst, refIndex,
                   editing, onImageAsk, imageBusy, hasImageKey }: CProps) {
  /**
   * قەبارەی فۆنتی دەستی بۆ خانەی ناوەڕۆک.
   *
   * پێشتر `SlotOverride.fontSize` تەنها لەسەر **پێچەری** خانەکە
   * دادەنرا، و `Pts`/`Prose` قەبارەی خۆکاری خۆیان بە ستایلی ناوەکی
   * لەسەر منداڵەکە دادەنا — کە بەسەر میراتی باوکدا زاڵ دەبێت. واتە
   * بەکارهێنەر ژمارەکەی دەگۆڕی و هیچ ڕووی نەدەدا.
   */
  const fixedSize = (slot: 'body' | 'title'): number | undefined =>
    s.overrides?.[slot]?.fontSize;

  const L = s.layout;
  const heading = (
    <>
      <Slot id="title"><div className="h2">{txt('title', s.title)}</div></Slot>
      <Slot id="rule"><div className="rule" /></Slot>
    </>
  );

  /**
   * خاڵەکان. `w`/`h` پێوانەی ئەو خانەیەن کە دەقەکەی تێدایە — هەمان
   * ژمارەکانی pptx.ts، تا قەبارەی فۆنت لە هەردوو لادا وەک یەک بێت.
   * بەبێ ئەمە پێشبینین دەقی زیادە دەبڕی و فایلەکە بەدەری دەهێشت.
   *
   * `fitBlock` هەردوو ئاراستە دەڕوات: دەقی زۆر بچووک دەکاتەوە، دەقی
   * کەم گەورە دەکات و بۆشاییەکان فراوان دەکات. بەبێ ئەوە دوو خاڵ لە
   * سەرەوەی سلایدەکە دەنووسان و نیوەی خوارەوە بەتاڵ دەمایەوە.
   */
  const Pts = ({ items, size = 35, w = BODY_W, h = BODY_H }:
    { items: string[]; size?: number; w?: number; h?: number }) => {
    // چڕی دەق دەبێت لەسەر سنووری سەرەوەش کاربکات — بڕوانە pptx.ts
    const base = Math.round(size * scale);
    const f = fitBlock({
      lines: items, width: w, height: h,
      size: base, max: Math.round(base * 1.35),
      lineHeight: 1.4, gap: 25, indent: 42, rtl,
      fixed: fixedSize('body'),
    });
    return (
      <ul className={`pts${f.overflow ? ' over' : ''}`}
          data-bul={st.bullet} style={{ fontSize: f.size, gap: f.gap }}>
        {items.map((b, i) => {
          const { head, rest } = bulletParts(b);
          return <li key={i}>{head && <b>{head} </b>}<MathText>{rest}</MathText></li>;
        })}
      </ul>
    );
  };

  /** پەرەگرافێکی درێژ کە خانەکەی پڕ دەکاتەوە */
  const Prose = ({ text, cls = 'prose', size = 32 }:
    { text: string; cls?: string; size?: number }) => {
    const base = Math.round(size * scale);
    const f = fitBlock({
      lines: [text], width: BODY_W, height: BODY_H,
      size: base, max: Math.round(base * 1.45), lineHeight: PROSE_LH, rtl,
      fixed: fixedSize('body'),
    });
    return <p className={`${cls}${f.overflow ? ' over' : ''}`} style={{ fontSize: f.size }}>
      <MathText>{text}</MathText></p>;
  };

  const Img = ({ alt = 'AI IMAGE' }: { alt?: string }) => (
    <div className="imgBox">
      {s.imageUrl
        ? <img src={s.imageUrl} alt="" />
        : editing && onImageAsk
          ? <ImageAsk slide={s} busy={!!imageBusy} hasKey={!!hasImageKey} onAsk={onImageAsk} />
          : s.imagePrompt
            ? <ImageBrief prompt={s.imagePrompt} />
          : <span>{alt}</span>}
      {/* مۆڵەتی وێنە — هەمان شوێنی هەناردەکراوەکە، تا پێشبینین و
          فایلی PowerPoint وەک یەک بن */}
      {s.imageUrl && s.imageCredit && (
        <span className="credit" dir="ltr">{s.imageCredit}</span>
      )}
    </div>
  );

  /**
   * ئاماژەی سەرچاوە لە ژێر سلایدەکەدا.
   *
   * ═══ بۆچی لەسەر سلایدەکە، نەک تەنها لە لاپەڕەی سەرچاوەکاندا ═══
   * پێشتر لاپەڕەی سەرچاوەکان لیستێکی گشتی بوو و هیچ شتێک نەیدەگوت
   * کام تۆمار بۆ کام ئادعا بوو. مامۆستا دەیپرسی «ئەم ژمارەیە
   * لەکوێوە هات؟» و وەڵامێک نەبوو.
   *
   * ئێستا هەر سلایدێک کە `cites` ـی هەیە، ناوی نووسەر و ساڵەکە
   * لە ژێرەوە پیشان دەدات — هەمان شێوەی پێشکەشکردنێکی ڕاستەقینە.
   * دەقی ئاسایییە، بۆیە لە PowerPoint دا دەستکاری دەکرێت (C9).
   */
  const Cited = () => {
    const ids = s.cites ?? [];
    if (!ids.length || !refIndex) return null;
    const bits = ids.map(id => refIndex.get(id)).filter(Boolean);
    if (!bits.length) return null;
    return <div className="cited" dir={dir}>{bits.join(' · ')}</div>;
  };

  const body = (inner: ReactNode) => (
    <div className="lay" dir={dir}>
      {heading}
      <Slot id="body"><div className="sbody">{inner}</div></Slot>
      <Cited />
    </div>
  );

  switch (L) {
    case 'L_outline':
      return body(<Outline items={s.bullets} kind={st.outline} scale={scale} rtl={rtl} />);

    case 'L_bullets':
    case 'L_bulletsL': {
      const img = <div className="media"><Slot id="image"><Img /></Slot></div>;
      const tx = <div className="txt"><Pts items={s.bullets} w={BODY_W - 545 - 54} /></div>;
      return body(<div className="split">{L === 'L_bulletsL' ? <>{img}{tx}</> : <>{tx}{img}</>}</div>);
    }

    case 'L_text':
      return body(
        <div className="proseWrap">
          {s.bullets[0] && <p className="lead">{s.bullets[0]}</p>}
          <Prose text={s.body ?? ''} />
        </div>);

    case 'L_two':
      return body(
        <div className="cols">
          {s.bullets.slice(0, 2).map((b, i) => {
            const { head, rest } = bulletParts(b);
            return (
              <div className="col" key={i}>
                <h3>{head.replace(/:$/, '') || `0${i + 1}`}</h3>
                <div className="bar" style={{ background: i ? 'var(--acc)' : 'var(--pri)' }} />
                <p>{rest}</p>
              </div>
            );
          })}
        </div>);

    case 'L_three':
      return body(
        <div className="three">
          {s.bullets.slice(0, 3).map((b, i) => {
            const { head, rest } = bulletParts(b);
            return (
              <div className="c" key={i}>
                <div className="ic">{`0${i + 1}`}</div>
                <h4>{head.replace(/:$/, '')}</h4>
                <p>{rest}</p>
              </div>
            );
          })}
        </div>);

    case 'L_steps':
      return body(
        <div className="steps">
          {(s.steps ?? []).slice(0, 4).map((st, i) => (
            <div className="step" key={i}>
              <div className="num">{st.n || i + 1}</div>
              <h4>{st.h}</h4><p>{st.p}</p>
            </div>
          ))}
        </div>);

    case 'L_cycle':
      return body(
        <div className="cycle"><div className="ring">
          {(s.steps ?? []).slice(0, 4).map((st, i) => (
            <div className={`nd n${i}${i % 2 ? ' a' : ''}`} key={i}>{st.h || st.p}</div>
          ))}
        </div></div>);

    case 'L_flow':
      return body(
        <div className="flow">
          {(s.steps ?? []).slice(0, 4).map((st, i, arr) => (
            <Fragment key={i}>
              <div className="bx"><b>{st.n || i + 1}</b>{st.h}{st.p && <><br />{st.p}</>}</div>
              {i < arr.length - 1 && <div className="ar">{dir === 'rtl' ? '←' : '→'}</div>}
            </Fragment>
          ))}
        </div>);

    case 'L_time':
      return body(
        <div className="tl">
          <div className="line" />
          <div className="items">
            {(s.timeline ?? []).map((it, i) => (
              <div className="it" key={i}>
                <div className="d" /><div className="y">{it.y}</div><div className="c">{it.c}</div>
              </div>
            ))}
          </div>
        </div>);

    case 'L_table':
      return body(
        <table className="tb"><tbody>
          <tr>{(s.table?.head ?? []).map((h, i) => <th key={i}>{h}</th>)}</tr>
          {(s.table?.rows ?? []).map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody></table>);

    case 'L_compare':
      return body(
        <table className="cmp"><tbody>
          <tr>{(s.table?.head ?? []).map((h, i) => <th key={i}>{h}</th>)}</tr>
          {(s.table?.rows ?? []).map((r, i) => (
            <tr key={i}>{r.map((c, j) => {
              const yes = /^(yes|✓|true|بەڵێ|نعم)$/i.test(c.trim());
              const no = /^(no|✕|false|نەخێر|لا)$/i.test(c.trim());
              return <td key={j} className={yes ? 'y' : no ? 'n' : ''}>
                {yes ? '✓' : no ? '✕' : c}</td>;
            })}</tr>
          ))}
        </tbody></table>);

    case 'L_kpi':
      return body(
        <div className="kpis">
          {(s.kpis ?? []).map((k, i) => (
            <div className="kpi" key={i}><div className="v">{k.v}</div><div className="k">{k.k}</div></div>
          ))}
        </div>);

    case 'L_progress':
      return body(
        <div className="bars2">
          {(s.chart?.labels ?? []).map((label, i) => {
            const pct = Math.max(0, Math.min(100, s.chart?.values[i] ?? 0));
            return (
              <div className="r" key={i}>
                <div className="lbl2"><span>{label}</span><span>{pct}%</span></div>
                <div className="track"><div className="fillb" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>);

    case 'L_bar':   return body(<Slot id="chart"><BarChart s={s} /></Slot>);
    case 'L_line':  return body(<Slot id="chart"><LineChart s={s} /></Slot>);
    case 'L_donut':
      return body(
        <div style={{ display: 'flex', alignItems: 'center', gap: 70, height: '100%' }}>
          <Slot id="chart"><DonutChart s={s} /></Slot>
          <div style={{ flex: 1 }}><Pts items={s.bullets} size={32} w={BODY_W / 2} /></div>
        </div>);

    case 'L_hero':
      return (
        <div className="lay full" dir={dir}>
          <div className="hero">
            <div className="bgimg">{s.imageUrl && <img src={s.imageUrl} alt="" />}</div>
            <div className="veil" />
            <div className="inner">
              <Slot id="title"><div className="h2">{txt('title', s.title)}</div></Slot>
              <Slot id="rule"><div className="rule" /></Slot>
              <Slot id="body"><p>{s.body}</p></Slot>
            </div>
          </div>
        </div>);

    case 'L_grid':
      return body(
        <div className="grid4">
          {[0, 1, 2, 3].map(i => (
            <div className="imgBox" key={i}>
              {s.imageUrl && i === 0 ? <img src={s.imageUrl} alt="" /> : <span>AI IMAGE {i + 1}</span>}
            </div>
          ))}
        </div>);

    case 'L_proscons':
      return body(
        <div className="pc">
          <div className="side good">
            <h4><span className="b" style={{ background: '#3F8A5F' }}>✓</span>{s.bullets[0] ?? 'Strengths'}</h4>
            <ul>{(s.pros ?? []).map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
          <div className="side bad">
            <h4><span className="b" style={{ background: '#A8434B' }}>✕</span>{s.bullets[1] ?? 'Weaknesses'}</h4>
            <ul>{(s.cons ?? []).map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        </div>);

    case 'L_pyramid': {
      const w = ['38%', '62%', '86%'];
      const bg = ['var(--acc)', 'var(--pri)', 'var(--pri-soft)'];
      return body(
        <div className="pyr">
          {s.bullets.slice(0, 3).map((b, i) => (
            <div className="lv" key={i}
                 style={{ width: w[i], background: bg[i], color: i === 0 ? '#141414' : '#fff' }}>
              {b}
            </div>
          ))}
        </div>);
    }

    case 'L_venn':
      return body(
        <div className="venn">
          <div className="cc" style={{ background: 'var(--pri-soft)', transform: 'translateX(-140px)', opacity: .85 }}>
            {s.bullets[0]}
          </div>
          <div className="cc" style={{ background: 'var(--acc)', transform: 'translateX(140px)', opacity: .85 }}>
            {s.bullets[1]}
          </div>
        </div>);

    case 'L_icons':
      return body(
        <div className="feat">
          {s.bullets.slice(0, 6).map((b, i) => {
            const { head, rest } = bulletParts(b);
            return (
              <div className="f2" key={i}>
                <div className="ic2">{i + 1}</div>
                <h5>{head.replace(/:$/, '')}</h5><p>{rest}</p>
              </div>
            );
          })}
        </div>);

    case 'L_ba':
      return body(
        <div className="ba">
          {s.bullets.slice(0, 2).map((b, i) => {
            const { head, rest } = bulletParts(b);
            return (
              <div className={`h${i ? ' aft' : ''}`} key={i}>
                <span className="tg">{i ? 'AFTER' : 'BEFORE'}</span>
                <h4>{head.replace(/:$/, '')}</h4><p>{rest}</p>
              </div>
            );
          })}
        </div>);

    case 'L_team':
      return body(
        <div className="team">
          {s.bullets.slice(0, 4).map((b, i) => {
            const { head, rest } = bulletParts(b);
            const name = head.replace(/:$/, '') || b;
            const initials = name.split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('');
            return (
              <div className="m" key={i}>
                <div className="av">{initials.toUpperCase()}</div>
                <div className="nm2">{name}</div><div className="rl">{rest}</div>
              </div>
            );
          })}
        </div>);

    case 'L_quote':
      return (
        <div className="lay" dir={dir}>
          <div className="quote">
            <div className="mk">&ldquo;</div>
            <Slot id="body"><p>{s.quote?.text ?? s.title}</p></Slot>
            {s.quote?.by && <div className="by">— {s.quote.by}</div>}
          </div>
        </div>);

    case 'L_state':
      return (
        <div className="lay" dir={dir}>
          <div className="state">
            <Slot id="body"><p>{s.body ?? s.title}</p></Slot>
          </div>
        </div>);

    case 'L_def':
      return (
        <div className="lay" dir={dir}>
          <div className="def">
            <Slot id="title"><div className="term">{txt('title', s.title)}</div></Slot>
            {s.bullets[0] && <div className="pron">{s.bullets[0]}</div>}
            <Slot id="body"><div className="desc"><MathText>{s.body ?? ''}</MathText></div></Slot>
          </div>
        </div>);

    case 'L_code':
      return body(<>
        <div className="code"><MathText>{s.body ?? ''}</MathText></div>
        {s.bullets[0] && (
          <div style={{ textAlign: 'center', fontSize: 60, marginTop: 28, fontStyle: 'italic' }}>
            {s.bullets[0]}
          </div>)}
      </>);

    case 'L_divider':
      return (
        <div className="lay" dir={dir}>
          <div className="divider">
            <div className="big">{s.bullets[0] || '01'}</div>
            <h2>{txt('title', s.title)}</h2>
            <div className="rule" />
          </div>
        </div>);

    case 'L_thanks':
      return (
        <div className="lay" dir={dir}>
          <div className="thanks">
            <div className="q">{s.bullets[0] || 'Any Questions?'}</div>
            <div className="t">{txt('title', s.title)}</div>
            <div className="rule" />
          </div>
        </div>);

    case 'L_refs': {
      const list = s.refs ?? [];
      // شێوازە ژمارەدارەکان (IEEE، Vancouver) نیشانەیەکیان لەپێشە؛
      // ئەوانی تر بە «هێڵی هەڵواسراو» دەنووسرێن — دێڕی یەکەم لە
      // لێوارەوە، ئەوانی تر بە ناوەوە. جیاوازییەکی بەرچاوی سەرچاوەیە.
      const ind = cst.numbered ? 52 : 46;
      const f = fitBlock({
        lines: list.map(r => r.text + (r.domain ?? '')),
        width: BODY_W, height: BODY_H, size: 25, max: 34, min: 19,
        lineHeight: 1.55, gap: 20, indent: ind, rtl,
      });
      return body(
        <ol className={`refs${cst.numbered ? '' : ' hang'}`}
            style={{ fontSize: f.size, gap: f.gap }}
            data-mark={cst.id}>
          {list.map((r, i) => (
            <li key={i}>
              {cst.numbered && <span className="rn">{cst.marker(i + 1)}</span>}
              {r.text}{' '}
              {/* بەستەرەکە بە تەواوی پیشان دەدرێت، نەک تەنها ناوی دۆمەین.
                  مامۆستا و خوێندکار هەردووکیان دەبێت بتوانن بیپشکنن —
                  و پێشتر تەنها «doi.org» دەردەکەوت، کە هیچ شوێنێک نییە. */}
              {r.url && <a className="src" href={r.url} dir="ltr"
                            target="_blank" rel="noreferrer noopener">{shortUrl(r.url)}</a>}
            </li>
          ))}
        </ol>);
    }

    default:
      return body(<Pts items={s.bullets} />);
  }
}

// ─────────── چارتەکان (SVG — لە هەموو قەبارەیەکدا ڕوون) ───────────

const Fragment = ({ children }: { children: ReactNode }) => <>{children}</>;

function BarChart({ s }: { s: Slide }) {
  const ch = s.chart;
  if (!ch?.values.length) return null;
  const max = Math.max(...ch.values, 1);
  const n = ch.values.length;
  const gw = 1270 / n;
  const bw = Math.min(170, gw * 0.55);

  return (
    <svg viewBox="0 0 1420 540" width="100%" height="100%" fontFamily="Georgia,serif">
      <g stroke="#B9C4D4" strokeWidth="1.5" opacity=".6">
        <line x1="120" y1="460" x2="1390" y2="460" opacity="1" />
        {[345, 230, 115].map(y => (
          <line key={y} x1="120" y1={y} x2="1390" y2={y} strokeDasharray="7 9" />
        ))}
      </g>
      <g fill="#5B6A83" fontSize="23" textAnchor="end">
        {[0, .25, .5, .75].map((f, i) => (
          <text key={i} x="100" y={468 - f * 460}>{Math.round(max * f)}</text>
        ))}
      </g>
      {ch.values.map((v, i) => {
        const h = (v / max) * 378;
        const x = 130 + gw * i + (gw - bw) / 2;
        return (
          <g key={i}>
            <rect x={x} y={460 - h} width={bw} height={h} rx="12"
                  fill={i % 2 ? 'var(--acc)' : 'var(--pri)'} />
            <text x={x + bw / 2} y={460 - h - 16} fill="var(--ink)" fontSize="25"
                  fontWeight="bold" textAnchor="middle">{v}</text>
            <text x={x + bw / 2} y="500" fill="var(--ink)" fontSize="26" textAnchor="middle">
              {ch.labels[i]}
            </text>
          </g>
        );
      })}
      {ch.caption && <text x="120" y="532" fill="#5B6A83" fontSize="20">{ch.caption}</text>}
    </svg>
  );
}

function LineChart({ s }: { s: Slide }) {
  const ch = s.chart;
  if (!ch?.values.length) return null;
  const max = Math.max(...ch.values, 1);
  const n = ch.values.length;
  const step = n > 1 ? 1140 / (n - 1) : 0;
  const pt = (v: number, i: number) => [190 + step * i, 440 - (v / max) * 378] as const;
  const pts = ch.values.map(pt);

  return (
    <svg viewBox="0 0 1420 520" width="100%" height="100%" fontFamily="Georgia,serif">
      <g stroke="#B9C4D4" strokeWidth="1.5" opacity=".6">
        <line x1="110" y1="440" x2="1390" y2="440" opacity="1" />
        {[330, 220, 110].map(y => (
          <line key={y} x1="110" y1={y} x2="1390" y2={y} strokeDasharray="7 9" />
        ))}
      </g>
      <polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none"
                stroke="var(--pri)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="11" fill="var(--pri)" />)}
      <g fill="#5B6A83" fontSize="24" textAnchor="middle">
        {ch.labels.map((l, i) => <text key={i} x={190 + step * i} y="482">{l}</text>)}
      </g>
      {ch.caption && <text x="110" y="514" fill="#5B6A83" fontSize="21">{ch.caption}</text>}
    </svg>
  );
}

function DonutChart({ s }: { s: Slide }) {
  const ch = s.chart;
  if (!ch?.values.length) return null;
  const total = ch.values.reduce((a, b) => a + b, 0) || 1;
  const colors = ['var(--pri)', 'var(--acc)', 'var(--pri-soft)', 'var(--ink-soft)'];
  let offset = 0;

  return (
    <svg viewBox="0 0 300 300" width="440" height="440" style={{ flex: '0 0 440px' }}>
      <g transform="translate(150,150) rotate(-90)" fill="none" strokeWidth="52">
        {ch.values.map((v, i) => {
          const len = (v / total) * 360;
          const el = (
            <circle key={i} r="104" stroke={colors[i % colors.length]}
                    strokeDasharray={`${len} 360`} strokeDashoffset={-offset} pathLength={360} />
          );
          offset += len;
          return el;
        })}
      </g>
      <text x="150" y="142" textAnchor="middle" fontFamily="Georgia" fontSize="52"
            fontWeight="bold" fill="var(--ink)">
        {Math.round((ch.values[0] / total) * 100)}%
      </text>
      <text x="150" y="176" textAnchor="middle" fontFamily="Georgia" fontSize="21" fill="var(--ink-soft)">
        {ch.labels[0]}
      </text>
    </svg>
  );
}
