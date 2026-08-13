'use client';

// ═══════════ ستودیۆ — ڕووکاری سەرەکی ═══════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SlideView from './SlideView';
import Wizard from './Wizard';
import ThemePicker from './ThemePicker';
import { LAYOUTS, layoutById, wireSvg } from '@/lib/layouts';
import { THEMES } from '@/lib/themes';
import { DENSITIES, type Density } from '@/lib/styles';
import { EMPTY_KEYS, pickTextProvider, type Keys } from '@/lib/llm';
import { resolveImage, promptFromTitle } from '@/lib/tools/slideImage';
import { PROVIDERS, IMAGE_PROVIDERS, providerById, requiresGemini, type ProviderId } from '@/lib/providers';
import { ENGINES } from '@/lib/tools/data';
import KeyPanel, { ProviderPicker, ExternalIcon } from './KeyPanel';
import Agent from './Agent';
import Toolbar, { ContextMenu, type ToolAction, type ToolAnchor, type ToolGroup } from './Toolbar';
import { canRunAgent } from '@/lib/agent';
import { verifyDeck, type Defect } from '@/lib/deck/verify';
import { mkId } from '@/lib/deck/model';
import { DeckHistory } from '@/lib/history';
import { csFontFor, glyphReport } from '@/lib/fonts';
import { FORMATS, build, collect, isStructured, restyle } from '@/lib/cite';
import { CITE_STYLES, type CiteStyleId } from '@/lib/citestyle';
import PresenterMode, { AudienceWindow } from './PresenterMode';
import Mascot from './Mascot';
import { primaryFont } from '@/lib/export/pptx';
import { ICONS, ICON_GROUPS, SHAPES, iconSvg, shapeSvg , ALL_ICON_GROUPS, findIcons } from '@/lib/icons';
import { readImage, eraseAreas } from '@/lib/imagetool';
import { exportPptx } from '@/lib/export/pptx';
import { exportPdf, exportPdfVector, canVector } from '@/lib/export/pdf';
import { download, importDeck, exportDeck, loadKeys, saveDeck, saveKeys, listDecks }
  from '@/lib/storage';
import { newElement, newSlide, retarget, reorder, type Deck, type LayoutId, type Reference, type Slide, type SlideElement, type SlotId } from '@/lib/types';

const AR = (n: number | string) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);

const FONTS = [
  { v: "Georgia,'Times New Roman',serif", n: 'Georgia' },
  { v: "'Times New Roman',serif", n: 'Times New Roman' },
  { v: "'Palatino Linotype',Palatino,serif", n: 'Palatino' },
  { v: "'Book Antiqua',serif", n: 'Book Antiqua' },
  { v: "Cambria,Georgia,serif", n: 'Cambria' },
  { v: "Constantia,Georgia,serif", n: 'Constantia' },
  { v: "'Segoe UI',sans-serif", n: 'Segoe UI' },
  { v: "'Trebuchet MS',sans-serif", n: 'Trebuchet MS' },
  { v: "Verdana,sans-serif", n: 'Verdana' },
  { v: "Calibri,sans-serif", n: 'Calibri' },
];

type Tab = 'agent' | 'lay' | 'th' | 'txt' | 'ins' | 'set';

/**
 * هەناردەکردنی سەرچاوەکان بۆ .bib / .ris / .txt
 *
 * تەنها ئەو سەرچاوانە دەڕۆنە ناو .bib و .ris ـەوە کە خانەی
 * پێکهاتەییان هەیە — واتە لە `find_papers` ـەوە هاتوون. ئەوانی تر
 * دەردەچن و ژمارەکەیان بە بەکارهێنەر دەوترێت.
 */
function CiteExport({ deck, keys, onStyle, onRefs }:
  { deck: Deck; keys: Keys; onStyle: (id: CiteStyleId) => void;
    onRefs: (refs: Reference[]) => void }) {
  const refs = collect(deck.slides);
  const style = deck.citeStyle ?? 'apa';

  /**
   * هێنانی سەرچاوەکان **ڕاستەوخۆ**.
   *
   * ═══ بۆچی دوگمە، نەک ڕێنمایی بۆ ئەیجێنت ═══
   * پێشتر پەیامەکە دەیگوت «لە تابی ئەیجێنت داوا بکە». بەڵام ئەمە
   * کارێکی چەسپاوە کە یەک ئامرازی هەیە و هیچ بڕیارێکی تێدا نییە —
   * داوای لە مۆدێلێک بکەیت کە بانگی بکات تەنها هەنگاوێکی زیادەیە،
   * تۆکنی زیادەیە، و ڕێگایەکی زیادەیە بۆ شکستن.
   *
   * هەمان فەنکشنە کە `Wizard` بەکاریدەهێنێت، بۆیە ئەنجامەکەش
   * هەمانە: تۆمار لە OpenAlex و Crossref و DOAJ ـەوە، بە DOI ـەوە.
   */
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function fetchRefs() {
    const { provider, model } = pickTextProvider(deck.lang, keys);
    const key = keys.keys[provider as keyof typeof keys.keys] ?? '';
    if (!key) { setNote(`کلیلی ${providerById(provider).name} دانەنراوە.`); return; }

    setBusy(true); setNote('گەڕان لە داتابەیسە زانستییەکان…');
    try {
      const { findResearch } = await import('@/lib/research');
      const r = await findResearch({
        provider, model, key,
        topic: deck.titleInfo.title || '',
        count: 5, style, kind: deck.refKind ?? 'paper',
        onNote: setNote,
      });
      if (!r.refs.length) {
        setNote('هیچ سەرچاوەیەک نەدۆزرایەوە. ناونیشانی پرۆژەکە ڕوونتر بکە و '
              + 'دووبارە هەوڵ بدە.');
        return;
      }
      onRefs(r.refs.map((x, i) => ({ ...x, id: mkId('s', i) })));
      setNote('');
    } catch (e) {
      setNote((e as Error).message);
    } finally { setBusy(false); }
  }

  if (!refs.length)
    return (
      <div className="hint">
        هێشتا هیچ سەرچاوەیەک نییە. هەموویان لە داتابەیسی زانستی
        ڕاستەقینەوە دێن — OpenAlex، Crossref، DOAJ.
        <button className="btn pri sm" style={{ marginTop: 9 }}
          disabled={busy} onClick={fetchRefs}>
          {busy ? <span className="spin" /> : null}
          {busy ? 'دەگەڕێم…' : 'سەرچاوەکان بهێنە'}
        </button>
        {note && <div className="n" style={{ marginTop: 7 }}>{note}</div>}
      </div>
    );

  const structured = refs.filter(isStructured).length;
  const name = (deck.titleInfo.title || 'references')
    .replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'references';

  return (
    <>
      {/* شێوازەکە دوای دروستکردنیش دەگۆڕدرێت — خانە پێکهاتەییەکان
          مانەوە، بۆیە پێویست ناکات دووبارە بگەڕێین. */}
      <div className="f"><label>شێوازی ژێدەر</label>
        <select value={style} onChange={e => onStyle(e.target.value as CiteStyleId)}>
          {CITE_STYLES.map(s => (
            <option key={s.id} value={s.id}>{s.name} — {s.note}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FORMATS.map(f => (
          <button key={f.id} className="btn sm" title={f.note}
            onClick={() => {
              const r = build(refs, f.id, style);
              download(new Blob([r.text], { type: f.mime }), `${name}.${f.ext}`);
            }}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="hint">
        {AR(refs.length)} سەرچاوە.
        {structured < refs.length && (
          <> تەنها <b>{AR(structured)}</b> ـیان خانەی پێکهاتەییان هەیە، بۆیە
          {' '}<b>BibTeX</b> و <b>RIS</b> هەر ئەوانە دەگرنەوە، و تەنها ئەوانە
          شێوازیان دەگۆڕێت. ئەوانی تر لە گەڕانی ئاسایییەوە هاتوون و DOI یان
          نییە — بە داتای هەڵبەستراو پڕ ناکرێنەوە.</>
        )}
      </div>
    </>
  );
}

/**
 * ئاگادارکردنەوەی پیتی کوردی.
 *
 * ئەمە پێویستە چونکە شکستەکە بێدەنگە: ئەپەکە دەڵێت «تەواو بوو»،
 * فایلەکە دادەبەزێت، و خوێندکار تەنها لە ڕۆژی پێشکەشکردندا دەبینێت
 * کە هەندێک پیت بوونەتە چوارگۆشەی بەتاڵ.
 *
 * پێوانەکە بە canvas ـە، بۆیە ڕاستییەکەی سەر ئەم کۆمپیوتەرە دەڵێت —
 * نەک خشتەیەکی گشتی.
 */
function FontCheck({ deck }: { deck: Deck }) {
  const [miss, setMiss] = useState<string[]>([]);
  const cs = csFontFor(deck.lang);

  useEffect(() => {
    if (!cs) { setMiss([]); return; }
    setMiss(glyphReport(primaryFont(deck.fontFamily)).missing);
  }, [deck.fontFamily, cs]);

  if (!cs) return null;

  return miss.length ? (
    <div className="hint warn-soft">
      <b>{primaryFont(deck.fontFamily)}</b> ئەم پیتانەی نییە: <b>{miss.join(' ')}</b>.
      <br />
      لە PowerPoint دا دەقی کوردی بە <b>{cs}</b> دەنووسرێت — کە هەیانە.
      دەقی ئینگلیزی وەک خۆی دەمێنێتەوە.
    </div>
  ) : (
    <div className="hint">
      <b>{primaryFont(deck.fontFamily)}</b> هەموو پیتە کوردییەکانی هەیە.
    </div>
  );
}

/**
 * لیستی ئەو کێشانەی لە پێشکەشکردنەکەدا ماون.
 *
 * ═══ بۆچی لێرەدا، نەک تەنها لە کاتی دروستکردندا ═══
 * `Wizard` یەک جار پشکنینی دەکات و پەیامێک پیشان دەدات. بەڵام
 * بەکارهێنەر دوای ئەوە دەستکاری دەکات — دەق زیاد دەکات، سلاید
 * دەسڕێتەوە، سەرچاوە دەگۆڕێت. ئەو پەیامە کۆن دەبێت.
 *
 * ئەمە **زیندووە**: هەر جارێک دێککەکە بگۆڕێت، دووبارە دەژمێردرێت.
 * بۆیە بەکارهێنەر هەمیشە دەزانێت پێشکەشکردنەکەی ئامادەیە یان نا،
 * و کرتەیەک دەیباتە سەر ئەو سلایدەی کێشەکەی تێدایە.
 */
function DeckHealth({ deck, onGo }: { deck: Deck; onGo: (n: number) => void }) {
  const found = useMemo(() => verifyDeck(deck, deck.sections), [deck]);

  if (!found.length)
    return (
      <>
        <div className="grp">دۆخی پێشکەشکردن</div>
        <div className="health ok">هەموو پشکنینەکان تێپەڕێندران.</div>
      </>
    );

  return (
    <>
      <div className="grp">دۆخی پێشکەشکردن — {found.length}</div>
      <ul className="health">
        {found.map((d: Defect, i: number) => (
          <li key={i} className={d.level}>
            {d.slide
              ? <button onClick={() => onGo(d.slide!)}>{d.message}</button>
              : <span>{d.message}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Studio() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [keys, setKeys] = useState<Keys>(EMPTY_KEYS);
  const [wizard, setWizard] = useState(false);
  const [iconQ, setIconQ] = useState('');
  /** مێنیوی کلیکی ڕاست */
  const [menu, setMenu] = useState<ToolAnchor | null>(null);
  /** پانێڵەکان — هەڵبژاردەکە پاشەکەوت دەکرێت */
  const [railOpen, setRailOpen] = useState(true);
  const [inspOpen, setInspOpen] = useState(true);
  const [inspLeft, setInspLeft] = useState(true);
  /** دەقی ناو سلاید کە ئێستا دەنووسرێت */
  const [editText, setEditText] = useState<string | null>(null);
  /** دۆخی سڕینەوەی نیشانەی ئاوی */
  const [erase, setErase] = useState(false);
  const [brush, setBrush] = useState(10);
  const [idx, setIdx] = useState(-1);                 // -1 = لاپەڕەی سەرەتا
  const [tab, setTab] = useState<Tab>('agent');
  const [selEl, setSelEl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<SlotId | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [autoZoom, setAutoZoom] = useState(true);
  const [busy, setBusy] = useState('');
  const [ready, setReady] = useState(false);
  const [present, setPresent] = useState(false);
  /** `?present=1` = ئەم پەنجەرەیە هی بینەرانە، نەک هی پێشکەشکار */
  const [audience, setAudience] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  /** مێژوو — وێنەکان لە حەوزێکدا دەمێننەوە، نەک لە هەر سنێپشاتێکدا.
   *  بڕوانە history.ts بۆ هۆکارەکەی. */
  const histRef = useRef(new DeckHistory());
  const dragRef = useRef<{ slot: SlotId; mode: 'move' | 'resize'; sx: number; sy: number;
                           ox: number; oy: number; ow: number; oh: number } | null>(null);

  // ─── دامەزراندن ───
  useEffect(() => {
    // پەنجەرەی بینەران بە `?present=1` دەناسرێتەوە. لێرەدا دەخوێندرێتەوە
    // نەک لە کاتی ڕەندەری سێرڤەردا — `location` لەوێدا نییە.
    if (new URLSearchParams(location.search).get('present') === '1') setAudience(true);
    setKeys(loadKeys());
    listDecks().then(all => {
      if (all[0]) { setDeck(all[0]); setIdx(-1); }
      else setWizard(true);
      setReady(true);
    }).catch(() => { setWizard(true); setReady(true); });
  }, []);

  // ─── پاشەکەوتی خۆکار ───
  useEffect(() => {
    if (!deck) return;
    const t = setTimeout(() => { saveDeck(deck).catch(() => {}); }, 900);
    return () => clearTimeout(t);
  }, [deck]);

  // ─── گونجاندنی زووم ───
  const fit = useCallback(() => {
    if (!autoZoom) return;
    const w = window.innerWidth - 190 - 312 - 52;
    const h = window.innerHeight - 58 - 52;
    setZoom(Math.max(.1, Math.min(w / 1920, h / 1080)));
  }, [autoZoom]);
  useEffect(() => { fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, [fit]);

  // ─── مێژوو ───
  const push = useCallback((next: Deck) => {
    setDeck(cur => {
      if (cur) histRef.current.push(cur);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setDeck(cur => (cur ? histRef.current.undo(cur) ?? cur : cur));
  }, []);

  const redo = useCallback(() => {
    setDeck(cur => (cur ? histRef.current.redo(cur) ?? cur : cur));
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        // F5 = پێشکەشکردن، وەک PowerPoint. وێبگەڕ بە بنەڕەت لاپەڕەکە
        // نوێ دەکاتەوە، بۆیە ڕێگری لێدەکرێت.
        if (e.key === 'F5') { e.preventDefault(); setPresent(true); return; }
        if (e.key === 'Delete' && editing) {
          if (selEl) { setElements(l => l.filter(x => x.id !== selEl)); setSelEl(null); }
          else if (sel) { patch(sel, { hidden: true }); setSel(null); }
          return;
        }

        // ─── تیرەکان: جوڵاندنی ورد ───
        // بەبێ ئەمە شوێندانانی ورد بە ماوس مەحاڵە. Shift = ١٠ پیکسڵ.
        // ئەگەر بەکارهێنەر لە خانەیەکی نووسیندا بێت، تیرەکان هی ئەون.
        if (editing && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
          const t = e.target as HTMLElement | null;
          if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
          if (!selEl && !sel) return;
          e.preventDefault();
          const d = e.shiftKey ? 10 : 1;
          nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0,
                e.key === 'ArrowUp'   ? -d : e.key === 'ArrowDown'  ? d : 0);
        }
        return;
      }
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      if (e.key.toLowerCase() === 'c' && editing && selEl) { e.preventDefault(); copyEl(); }
      if (e.key.toLowerCase() === 'v' && editing) { e.preventDefault(); pasteEl(); }
      if (e.key.toLowerCase() === 'd' && editing && selEl) { e.preventDefault(); duplicate(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ─── گۆڕینی سلاید ───
  const cur: Slide | null = deck && idx >= 0 ? deck.slides[idx] ?? null : null;

  const setSlide = (fn: (s: Slide) => Slide) => {
    if (!deck || idx < 0) return;
    const slides = [...deck.slides];
    slides[idx] = fn(slides[idx]);
    push({ ...deck, slides });
  };

  const patch = (slot: SlotId, o: Partial<NonNullable<Slide['overrides'][SlotId]>>) =>
    setSlide(s => ({ ...s, overrides: { ...s.overrides, [slot]: { ...s.overrides[slot], ...o } } }));

  // ─── ڕاکێشان و گەورەکردن ───
  const onSlotDown = (slot: SlotId, e: React.PointerEvent) => {
    if (!editing) return;
    setSel(slot);
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const o = cur?.overrides[slot] ?? {};
    dragRef.current = {
      slot, mode: 'move', sx: e.clientX, sy: e.clientY,
      ox: o.x ?? el.offsetLeft, oy: o.y ?? el.offsetTop,
      ow: o.w ?? r.width / zoom, oh: o.h ?? r.height / zoom,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onResizeDown = (slot: SlotId, e: React.PointerEvent) => {
    if (!editing || !cur) return;
    const el = (e.currentTarget as HTMLElement).parentElement!;
    const r = el.getBoundingClientRect();
    const o = cur.overrides[slot] ?? {};
    dragRef.current = {
      slot, mode: 'resize', sx: e.clientX, sy: e.clientY,
      ox: o.x ?? el.offsetLeft, oy: o.y ?? el.offsetTop,
      ow: o.w ?? r.width / zoom, oh: o.h ?? r.height / zoom,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.sx) / zoom;
      const dy = (e.clientY - d.sy) / zoom;
      const id = String(d.slot).startsWith('__el:') ? String(d.slot).slice(5) : null;
      const next = d.mode === 'move'
        ? { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) }
        : { w: Math.max(40, Math.round(d.ow + dx)), h: Math.max(40, Math.round(d.oh + dy)) };
      if (id) patchEl(id, next); else patch(d.slot, next);
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  });

  // ─── توخمە زیادکراوەکان ───
  const elements = cur?.elements ?? [];
  const activeEl = elements.find(e => e.id === selEl) ?? null;

  const setElements = (fn: (list: SlideElement[]) => SlideElement[]) =>
    setSlide(s => ({ ...s, elements: fn(s.elements ?? []) }));

  const patchEl = (id: string, o: Partial<SlideElement>) =>
    setElements(list => list.map(e => (e.id === id ? { ...e, ...o } : e)));

  const addElement = (kind: SlideElement['kind'], value: string) => {
    if (idx < 0) return;
    const el = newElement(kind, value);
    setElements(list => [...list, el]);
    setSelEl(el.id);
    setEditing(true);
    return el;
  };

  /** وێنە لە کۆمپیوتەری بەکارهێنەرەوە */
  async function insertImage(file: File) {
    try {
      const { url, w, h } = await readImage(file);
      const el = addElement('image', url);
      if (!el) return;
      // ڕێژەی ڕەسەنی وێنەکە دەپارێزرێت — ئەگەرنا دەپەستێت
      const box = 560, k = Math.min(box / w, box / h);
      patchEl(el.id, { w: Math.round(w * k), h: Math.round(h * k) });
    } catch (e) { alert((e as Error).message); }
  }

  /**
   * سڕینەوە لەسەر وێنەکە.
   * شوێنی کلیک لە پیکسڵی شاشەوە دەکرێتە ڕێژەی ٠–١ لەسەر وێنەکە خۆی،
   * تا زووم و قەبارەی توخمەکە کاری تێنەکەن.
   */
  async function eraseAt(e: React.PointerEvent) {
    if (!erase || !activeEl || activeEl.kind !== 'image' || !stageRef.current) return;
    const box = stageRef.current.getBoundingClientRect();
    const px = (e.clientX - box.left) / zoom - activeEl.x;
    const py = (e.clientY - box.top) / zoom - activeEl.y;
    if (px < 0 || py < 0 || px > activeEl.w || py > activeEl.h) return;

    try {
      const next = await eraseAreas(activeEl.value, [
        { x: px / activeEl.w, y: py / activeEl.h, r: brush / 200 },
      ]);
      patchEl(activeEl.id, { value: next });
    } catch (ex) { alert((ex as Error).message); }
  }

  /** ڕیزی چینەکان */
  const layer = (to: 'front' | 'back' | 'forward' | 'backward') => {
    if (!selEl) return;
    setElements(list => reorder(list, selEl, to));
  };

  const duplicate = () => {
    if (!activeEl) return;
    const copy = { ...activeEl, id: Math.random().toString(36).slice(2, 10),
                   x: activeEl.x + 28, y: activeEl.y + 28 };
    setElements(list => [...list, copy]);
    setSelEl(copy.id);
  };

  const removeSel = () => {
    if (selEl) { setElements(l => l.filter(x => x.id !== selEl)); setSelEl(null); }
    else if (sel) { patch(sel, { hidden: true }); setSel(null); }
    setMenu(null);
  };

  // ─── ڕێککەوتن لەگەڵ سلایدەکە ───
  //
  // ڕاکێشان بە ماوس هەرگیز تەواو ڕێک نابێت — لە ٠.٤٩ زووم، یەک
  // پیکسڵی شاشە دەکاتە دوو پیکسڵ لەسەر سلایدەکە. بۆیە ئەمانە
  // پێویستن، نەک ڕازاندنەوە.
  const SLIDE_W = 1920, SLIDE_H = 1080;

  type Align = 'left' | 'cx' | 'right' | 'top' | 'cy' | 'bottom';

  const alignEl = (how: Align) => {
    if (!activeEl) return;
    const e = activeEl;
    const at =
      how === 'left'   ? { x: 0 }
    : how === 'cx'     ? { x: Math.round((SLIDE_W - e.w) / 2) }
    : how === 'right'  ? { x: SLIDE_W - e.w }
    : how === 'top'    ? { y: 0 }
    : how === 'cy'     ? { y: Math.round((SLIDE_H - e.h) / 2) }
    :                    { y: SLIDE_H - e.h };
    patchEl(e.id, at);
  };

  /**
   * جوڵاندن بە تیرەکان.
   *
   * بۆ توخمە زیادکراوەکان `x/y` ی خۆیان دەگۆڕێت. بۆ خانەکانی
   * تەختەبەند، ئەگەر هێشتا `x/y` یان نەبێت، شوێنی ئێستایان لە
   * DOM ـەوە وەردەگیرێت — ئەگەرنا خانەکە دەبڕێت بۆ گۆشەی ٠،٠.
   */
  const nudge = (dx: number, dy: number) => {
    if (selEl && activeEl) {
      patchEl(activeEl.id, { x: activeEl.x + dx, y: activeEl.y + dy });
      return;
    }
    if (!sel || !cur) return;
    const o = cur.overrides[sel] ?? {};
    if (o.x === undefined || o.y === undefined) {
      const node = stageRef.current?.querySelector<HTMLElement>('.slot.sel');
      const stage = stageRef.current;
      if (!node || !stage) return;
      const a = node.getBoundingClientRect(), b = stage.getBoundingClientRect();
      patch(sel, {
        x: Math.round((a.left - b.left) / zoom) + dx,
        y: Math.round((a.top - b.top) / zoom) + dy,
        w: o.w ?? Math.round(a.width / zoom),
      });
      return;
    }
    patch(sel, { x: o.x + dx, y: o.y + dy });
  };

  /** توخمی کۆپیکراو — لە نێوان سلایدەکاندا دەمێنێتەوە */
  const clip = useRef<SlideElement | null>(null);

  const copyEl = () => { if (activeEl) clip.current = activeEl; };

  const pasteEl = () => {
    if (!clip.current || idx < 0) return;
    const copy = { ...clip.current, id: Math.random().toString(36).slice(2, 10),
                   x: clip.current.x + 28, y: clip.current.y + 28 };
    setElements(list => [...list, copy]);
    setSelEl(copy.id);
    setEditing(true);
  };

  // ─── شریتی ئامراز ───

  /** شوێنی شریتەکە: لە سەرەوەی توخمە هەڵبژێردراوەکە، بە پیکسڵی شاشە */
  function toolAt(): ToolAnchor | null {
    if (!editing || (!selEl && !sel) || !stageRef.current) return null;
    const box = stageRef.current.getBoundingClientRect();
    if (activeEl)
      return { x: box.left + (activeEl.x + activeEl.w / 2) * zoom - 150,
               y: box.top + activeEl.y * zoom - 52 };
    const o = sel ? cur?.overrides?.[sel] : null;
    return { x: box.left + ((o?.x ?? 240) + (o?.w ?? 600) / 2) * zoom - 150,
             y: box.top + (o?.y ?? 200) * zoom - 52 };
  }

  /** ئامرازەکانی گونجاو بۆ ئەوەی هەڵبژێردراوە */
  function toolGroup(): ToolGroup {
    const acts: ToolAction[] = [];

    if (activeEl) {
      const e = activeEl;
      if (e.kind === 'text') {
        acts.push(
          { id: 'b', label: 'ئەستوور', icon: 'B', active: e.bold,
            run: () => patchEl(e.id, { bold: !e.bold }) },
          { id: 'i', label: 'لار', icon: 'I', active: e.italic,
            run: () => patchEl(e.id, { italic: !e.italic }) },
        );
      }
      if (e.kind === 'image') {
        for (const [f, ic] of [['none', '▭'], ['round', '▢'], ['circle', '◯']] as const)
          acts.push({ id: f, label: `چوارچێوە ${f}`, icon: ic, active: (e.frame ?? 'none') === f,
                      run: () => patchEl(e.id, { frame: f }) });
      }
      // ڕێککەوتن — سێ ئاسۆیی و سێ ستوونی
      for (const [id, ic, lb] of [
        ['al', '⇤', 'چەپ'], ['ac', '⇹', 'ناوەڕاستی ئاسۆیی'], ['ar', '⇥', 'ڕاست'],
        ['at', '⤒', 'سەرەوە'], ['am', '⇳', 'ناوەڕاستی ستوونی'], ['ab', '⤓', 'خوارەوە'],
      ] as const)
        acts.push({ id, label: `ڕێککەوتن: ${lb}`, icon: ic,
          run: () => alignEl(({ al: 'left', ac: 'cx', ar: 'right',
                                at: 'top', am: 'cy', ab: 'bottom' } as const)[id]) });

      acts.push(
        { id: 'fw', label: 'بۆ پێشەوە', icon: '↑', run: () => layer('forward') },
        { id: 'bw', label: 'بۆ دواوە', icon: '↓', run: () => layer('backward') },
        { id: 'dup', label: 'لێکۆپیکردن', icon: '⧉', run: duplicate },
        { id: 'del', label: 'سڕینەوە', icon: '🗑', danger: true, run: removeSel },
      );
      return {
        color: { value: e.color ?? '', onChange: v => patchEl(e.id, { color: v }) },
        size: e.kind === 'text'
          ? { value: e.fontSize ?? 44, min: 12, max: 160,
              onChange: v => patchEl(e.id, { fontSize: v }) }
          : undefined,
        actions: acts,
      };
    }

    // خانەیەکی تەختەبەند
    const o = sel ? cur?.overrides?.[sel] : null;
    return {
      color: { value: o?.color ?? '', onChange: v => sel && patch(sel, { color: v }) },
      size: { value: o?.fontSize ?? 35, min: 12, max: 160,
              onChange: v => sel && patch(sel, { fontSize: v }) },
      select: { value: o?.fontFamily ?? deck?.fontFamily ?? '',
                onChange: v => sel && patch(sel, { fontFamily: v }),
                options: FONTS },
      actions: [
        { id: 'reset', label: 'گەڕاندنەوە بۆ بنەڕەت', icon: '↺',
          run: () => sel && setSlide(s => {
            const ov = { ...s.overrides }; delete ov[sel]; return { ...s, overrides: ov };
          }) },
        { id: 'hide', label: 'شاردنەوە', icon: '🗑', danger: true, run: removeSel },
      ],
    };
  }

  /** مێنیوی کلیکی ڕاست — هەمان کارەکان بە ناوی تەواو */
  function menuActions(): ToolAction[] {
    if (activeEl) {
      const e = activeEl;
      return [
        ...(e.kind === 'text' ? [{ id: 'ed', label: 'دەستکاری دەق', icon: '✎',
              run: () => setEditText(e.value) }] : []),
        { id: 'f',  label: 'بۆ سەرەوەی هەمووان', icon: '⤒', run: () => layer('front') },
        { id: 'fw', label: 'یەک چین بۆ پێشەوە',  icon: '↑', run: () => layer('forward') },
        { id: 'bw', label: 'یەک چین بۆ دواوە',   icon: '↓', run: () => layer('backward') },
        { id: 'b',  label: 'بۆ ژێری هەمووان',    icon: '⤓', run: () => layer('back') },
        { id: 'd',  label: 'لێکۆپیکردن',          icon: '⧉', run: duplicate },
        { id: 'x',  label: 'سڕینەوە', icon: '🗑', danger: true, run: removeSel },
      ];
    }
    return [
      { id: 'reset', label: 'گەڕاندنەوە بۆ بنەڕەت', icon: '↺',
        run: () => sel && setSlide(s => {
          const ov = { ...s.overrides }; delete ov[sel]; return { ...s, overrides: ov };
        }) },
      { id: 'hide', label: 'شاردنەوە', icon: '🗑', danger: true, run: removeSel },
    ];
  }

  const onElDown = (id: string, e: React.PointerEvent) => {
    if (!editing) return;
    setSel(null); setSelEl(id);
    const el = elements.find(x => x.id === id);
    if (!el) return;
    dragRef.current = {
      slot: '__el:' + id as SlotId, mode: 'move',
      sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onElResize = (id: string, e: React.PointerEvent) => {
    const el = elements.find(x => x.id === id);
    if (!el) return;
    dragRef.current = {
      slot: '__el:' + id as SlotId, mode: 'resize',
      sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  // ─── هەناردەکردن ───
  async function doPptx() {
    if (!deck) return;
    setBusy('دروستکردنی PowerPoint…');
    try {
      const blob = await exportPptx(deck, {
        withMorph: deck.buildMode,
        onProgress: (d, t) => setBusy(`سلاید ${AR(d)} لە ${AR(t)}…`),
      });
      download(blob, `${deck.titleInfo.title || 'presentation'}.pptx`);
    } catch (e) { alert('هەڵە: ' + (e as Error).message); }
    finally { setBusy(''); }
  }

  /**
   * @param vector `true` = دەق وەک دەق بنووسە (تەنها ئینگلیزی).
   *   بۆ کوردی و عەرەبی jsPDF پیتەکان شێوە نادات و ئاراستەکەیان
   *   هەڵدەگەڕێنێتەوە، بۆیە ڕێگای وێنەیی بەکاردێت. بڕوانە pdf.ts.
   */
  async function doPdf(vector = false) {
    if (!deck || !stageRef.current) return;

    if (vector) {
      setBusy('نووسینی PDF ـی ڤێکتەری…');
      try {
        await exportPdfVector(deck, deck.titleInfo.title || 'presentation',
          { onProgress: (d, t) => setBusy(`لاپەڕە ${AR(d)} لە ${AR(t)}…`) });
      } catch (e) { alert('هەڵە: ' + (e as Error).message); }
      finally { setBusy(''); }
      return;
    }

    setBusy('ئامادەکردنی PDF…');
    try {
      // هەموو سلایدەکان یەک بە یەک وێنە دەگیرێن
      const nodes: HTMLElement[] = [];
      for (let i = -1; i < deck.slides.length; i++) {
        setIdx(i);
        await new Promise(r => setTimeout(r, 140));
        if (stageRef.current) nodes.push(stageRef.current.cloneNode(true) as HTMLElement);
      }
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-99999px;top:0';
      nodes.forEach(n => { n.style.transform = 'none'; holder.appendChild(n); });
      document.body.appendChild(holder);
      await exportPdf(nodes, deck.titleInfo.title || 'presentation',
        { onProgress: (d, t) => setBusy(`لاپەڕە ${AR(d)} لە ${AR(t)}…`) });
      holder.remove();
    } catch (e) { alert('هەڵە: ' + (e as Error).message); }
    finally { setBusy(''); }
  }

  const imageKey = keys.keys[keys.imageProvider] ?? '';
  /**
   * مێشکی ئەیجێنت: هەڵبژاردنی تایبەت، ئەگەرنا Gemini.
   *
   * ─── C3 لێرەدا بەزێنرابوو ───
   * ویزارد بە `pickTextProvider` زۆرەملێ دەکات، و ئامرازی وەرگێڕانیش
   * خۆی دەیپشکنێت — بەڵام `edit_slide` و `add_slide` نا. واتە
   * بەکارهێنەرێک کە OpenAI ـی وەک مێشکی ئەیجێنت هەڵبژاردبوو،
   * دەقی کوردی سلایدەکانی بە OpenAI دەنووسرا. C3 دەڵێت «بێ
   * جیاوازی، بێ سەرپێچی بەکارهێنەر» — بۆیە لێرەش زۆرەملێ دەکرێت.
   */
  const agentProv: ProviderId = deck && requiresGemini(deck.lang)
    ? 'gemini'
    : keys.agentProvider ?? 'gemini';

  /**
   * @param mode 'ai' = هەوڵی AI ئینجا بێبەرامبەر · 'free' = ڕاستەوخۆ بێبەرامبەر
   * @param ask  وەسفێک لە بەکارهێنەرەوە — لە شوێنی وێنەکەی سەر سلایدەوە دێت.
   *             بەتاڵ = ئەوەی لە پانێڵەکەدا نووسراوە، یان لە ناونیشانەکەوە.
   */
  async function fetchImage(mode: 'ai' | 'free', ask?: string) {
    if (!cur || !deck) return;
    const prompt = ask?.trim()
      || cur.imagePrompt
      || promptFromTitle(cur.title, deck.titleInfo.title);
    setBusy('وێنە…');
    try {
      const r = await resolveImage({
        prompt,
        ai: mode === 'ai' && imageKey ? { provider: keys.imageProvider, key: imageKey } : undefined,
        onNote: setBusy,
      });
      setSlide(s => ({
        ...s,
        imageUrl: r.dataUrl,
        imagePrompt: prompt,
        imageCredit: r.credit,
      }));
    } catch (e) { alert('وێنە نەدۆزرایەوە: ' + (e as Error).message); }
    finally { setBusy(''); }
  }

  if (!ready) return null;

  if (wizard || !deck) {
    return (
      <Wizard keys={keys} onKeys={setKeys}
        onCancel={deck ? () => setWizard(false) : undefined}
        onDone={d => { setDeck(d); setIdx(-1); setWizard(false); saveDeck(d).catch(() => {}); }} />
    );
  }

  // پەنجەرەی دووەم — تەنها سلایدەکە، بۆ پڕۆجێکتەر
  if (audience) return <AudienceWindow deck={deck} />;

  if (present)
    return <PresenterMode deck={deck} start={idx + 1} onExit={() => setPresent(false)} />;

  const layDef = cur ? layoutById(cur.layout) : null;

  return (
    <div className="app">
      {/* یاریدەدەرەکە — لە دۆخی پێشکەشکردن و پەنجەرەی بینەراندا
          هەرگیز نایەت، چونکە ئەوانە پێشتر گەڕاونەتەوە */}
      <Mascot state={{
        screen: 'studio',
        hasDeck: true,
        refCount: deck.slides.reduce((n, s) => n + (s.refs?.length ?? 0), 0),
        busy: busy || undefined,
      }} />

      {/* ═══ سەرەوە ═══ */}
      <header className="top">
        <div className="brand"><div className="mk">P</div><span>ستودیۆی پێشکەشکردن</span></div>
        <div className="vline" />
        <div className="crumb">
          {deck.titleInfo.title || 'بێ ناونیشان'} — {AR(deck.slides.length + 1)} سلاید
        </div>
        <div className="spacer" />

        {/* پانێڵەکان — بۆ ئەوەی سلاید گەورەتر بێت */}
        <button className={`btn icon${railOpen ? ' pri' : ''}`} title="لیستی سلایدەکان"
          onClick={() => setRailOpen(!railOpen)}>▤</button>
        <button className={`btn icon${inspOpen ? ' pri' : ''}`} title="پانێڵی ئامرازەکان"
          onClick={() => setInspOpen(!inspOpen)}>▥</button>
        <button className="btn icon" title="گواستنەوەی پانێڵ بۆ لای تر"
          onClick={() => setInspLeft(!inspLeft)}>⇄</button>
        <div className="vline" />

        <button className="btn icon" title="پووچکردنەوە (Ctrl+Z)" onClick={undo}>↺</button>
        <button className="btn icon" title="دووبارەکردنەوە (Ctrl+Y)" onClick={redo}>↻</button>
        <button className="btn" title="پێشکەشکردن لە وێبگەڕدا (F5)"
          onClick={() => setPresent(true)}>▶ پێشکەشکردن</button>
        <button className={`btn${editing ? ' pri' : ''}`} onClick={() => { setEditing(!editing); setSel(null); }}>
          {editing ? 'کۆتایی دەستکاری' : 'دەستکاری'}
        </button>
        <div className="vline" />
        <button className="btn" onClick={() => setWizard(true)}>نوێ</button>
        {/* ڤێکتەری تەنها بۆ ئینگلیزی بەردەستە — jsPDF پیتی عەرەبی
            شێوە نادات. بۆ کوردی و عەرەبی تەنها ڕێگای وێنەیی هەیە. */}
        {canVector(deck) && (
          <button className="btn" onClick={() => doPdf(true)} disabled={!!busy}
            title="دەق وەک دەق دەمێنێتەوە — دەتوانرێت هەڵبژێردرێت و بگەڕێدرێت">
            PDF ڤێکتەری
          </button>
        )}
        <button className="btn" onClick={() => doPdf(false)} disabled={!!busy}
          title={canVector(deck)
            ? 'وێنە — دیزاینەکە ١٠٠٪ وەک خۆی'
            : 'کوردی و عەرەبی تەنها بەم ڕێگایە دەردەچن'}>
          PDF{canVector(deck) ? ' وێنەیی' : ''}
        </button>
        <button className="btn pri" onClick={doPptx} disabled={!!busy}>
          {busy ? <span className="spin" /> : null}{busy || 'PowerPoint'}
        </button>
      </header>

      <main className={`work${inspLeft ? '' : ' flip'}`}>
        {/* ═══ لیستی سلایدەکان ═══ */}
        <nav className={`rail${railOpen ? '' : ' off'}`}>
          <div className="lbl"><span>سلایدەکان</span><span>{AR(deck.slides.length + 1)}</span></div>

          <div className={`thumb${idx === -1 ? ' on' : ''}`} onClick={() => setIdx(-1)}>
            <div className="n">١</div>
            <div dangerouslySetInnerHTML={{ __html: wireSvg(LAYOUTS[0].wire) }} />
            <div className="cap">لاپەڕەی سەرەتا</div>
          </div>

          {deck.slides.map((s, i) => (
            <div key={s.id} className={`thumb${idx === i ? ' on' : ''}`} onClick={() => setIdx(i)}>
              <div className="n">{AR(i + 2)}</div>
              <button className="del" title="سڕینەوە" onClick={e => {
                e.stopPropagation();
                push({ ...deck, slides: deck.slides.filter((_, j) => j !== i) });
                if (idx >= deck.slides.length - 1) setIdx(deck.slides.length - 2);
              }}>×</button>
              <div dangerouslySetInnerHTML={{ __html: wireSvg(layoutById(s.layout).wire) }} />
              <div className="cap">{s.title || layoutById(s.layout).name}</div>
            </div>
          ))}

          <button className="btn sm" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => push({ ...deck, slides: [...deck.slides, newSlide('L_bullets', 'سلایدی نوێ')] })}>
            + سلایدی نوێ
          </button>
        </nav>

        {/* ═══ کانڤاس ═══ */}
        <div className="canvas"
          onContextMenu={e => {
            if (!editing || (!selEl && !sel)) return;
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY });
          }}>
          <div className={`fitbox${erase ? ' erasing' : ''}`}
            style={{ width: 1920 * zoom, height: 1080 * zoom }}
            onPointerDown={erase ? eraseAt : undefined}
            onPointerMove={erase ? e => { if (e.buttons === 1) eraseAt(e); } : undefined}
            onDoubleClick={() => {
              if (editing && activeEl?.kind === 'text') setEditText(activeEl.value);
            }}>
            <SlideView
              deck={deck} slide={cur} innerRef={stageRef} scale={zoom}
              editing={editing} selected={sel}
              onSelect={s => { setSel(s); if (!s) { setSelEl(null); setEditText(null); } }}
              onSlotPointerDown={onSlotDown} onResizeStart={onResizeDown}
              selectedElement={selEl}
              onElementPointerDown={onElDown} onElementResize={onElResize}
              // شوێنی وێنەی بەتاڵ لە دۆخی دەستکاریدا دەبێتە فۆرمێکی کارا
              onImageAsk={(prompt, mode) => fetchImage(mode, prompt)}
              imageBusy={!!busy} hasImageKey={!!imageKey}
            />
          </div>

          {/* ─── لاپەڕەی سەرەتا لە دۆخی دەستکاریدا ───
              پێشتر لێرەدا هیچ ڕوونەدەدا: کلیک هیچ هەڵنەدەبژارد، شریتی
              ئامراز نەدەهات، و تەنها ئاماژەیەکی بچووک لە پانێڵەکەدا
              هەبوو — کە بەکارهێنەر نەیدەبینی. ئەنجام: «ئامرازەکان
              کارناکەن».

              ناوەڕۆکەکەی لێرەدا دەستکاری ناکرێت بە ئەنقەست: دیزاینی
              سلایدی یەکەم چەسپاوە (C7)، و `titleSlide()` لە pptx.ts
              دا هیچ `override` ـێک ناخوێنێتەوە — بۆیە هەر جوڵاندنێک
              لێرەدا لە فایلی PowerPoint دا ون دەبوو، کە خراپترە لەوەی
              هەر نەکرێت. لەبری ئەوە ڕێگای ڕاست پیشان دەدرێت. */}
          {editing && idx < 0 && (
            <button className="titlelock" onClick={() => { setTab('set'); setInspOpen(true); }}>
              <b>لاپەڕەی سەرەتا دیزاینێکی چەسپاوی هەیە</b>
              <span>
                دەقەکانی — زانکۆ، بەش، ناونیشان، مامۆستا، خوێندکارەکان —
                لە تابی <b>ڕێکخستن</b> دەگۆڕدرێن. کلیک لێرە بکە بۆ کردنەوەی.
              </span>
            </button>
          )}

          {/* شریتی ئامراز — لەسەر توخمی هەڵبژێردراو */}
          {editing && <Toolbar at={toolAt()} group={toolGroup()} onClose={() => setSelEl(null)} />}

          {/* دوو کلیک لەسەر دەق = نووسین لە شوێنی خۆیدا */}
          {editText !== null && activeEl?.kind === 'text' && (
            <div className="inline-edit" style={{ left: 16, right: 16, bottom: 62 }}>
              <textarea autoFocus rows={2} value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={() => { patchEl(activeEl.id, { value: editText }); setEditText(null); }}
                onKeyDown={e => {
                  if (e.key === 'Escape') setEditText(null);
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.blur();
                }} />
              <span className="fine">Ctrl+Enter بۆ تەواوکردن · Esc بۆ پاشگەزبوونەوە</span>
            </div>
          )}
          <div className="zoom">
            <button onClick={() => { setAutoZoom(false); setZoom(z => Math.max(.1, z - .1)); }}>−</button>
            <span>{AR(Math.round(zoom * 100))}٪</span>
            <button onClick={() => { setAutoZoom(false); setZoom(z => Math.min(1.5, z + .1)); }}>+</button>
            <button title="گونجاندن" onClick={() => { setAutoZoom(true); fit(); }}>⤢</button>
          </div>
        </div>

        {/* ═══ ئینسپێکتەر ═══ */}
        <aside className={`insp${inspOpen ? '' : ' off'}`}>
          <div className="tabs">
            {([['agent', 'ئەیجێنت'], ['lay', 'تەختەبەند'], ['ins', 'ئایکۆن'],
               ['th', 'پاشبنەما'], ['txt', 'ناوەڕۆک'], ['set', 'ڕێکخستن']] as const)
              .map(([id, label]) => (
                <button key={id} className={`tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
          </div>

          <div className="pane" style={tab === 'agent' ? { padding: 0, display: 'flex' } : undefined}>
            {/* ── ئەیجێنت ── */}
            {tab === 'agent' && (
              <Agent
                deck={deck}
                provider={agentProv}
                apiKey={keys.keys[agentProv] ?? ''}
                model={keys.agentModel || (agentProv === keys.textProvider ? keys.textModel : undefined)}
                engine={keys.searchEngine && keys.searchKeys?.[keys.searchEngine]
                  ? { id: keys.searchEngine, key: keys.searchKeys[keys.searchEngine]! }
                  : undefined}
                onDeck={push}
              />
            )}

            {/* ── تەختەبەند ── */}
            {tab === 'lay' && <DeckHealth deck={deck} onGo={n => setIdx(n - 2)} />}
            {tab === 'lay' && (cur ? <>
              <div className="grp">تەختەبەندی ئەم سلایدە</div>
              <div className="gal">
                {LAYOUTS.filter(l => l.id !== 'L_title').map(l => (
                  <button key={l.id} className={`lay-card${cur.layout === l.id ? ' on' : ''}`}
                    onClick={() => setSlide(s => retarget(s, l.id as LayoutId))}>
                    <span dangerouslySetInnerHTML={{ __html: wireSvg(l.wire) }} />
                    <div className="nm">{l.name}</div>
                  </button>
                ))}
              </div>
              <div className="hint">
                گۆڕینی تەختەبەند ناوەڕۆکەکە نافەوتێنێت — هەمان دەق بە شێوەیەکی نوێ دەردەکەوێت.
              </div>
            </> : <div className="hint">لاپەڕەی سەرەتا تەختەبەندی جێگیری هەیە.</div>)}


            {/* ── ئایکۆن و شێوە ── */}
            {tab === 'ins' && (cur ? <>
              <div className="grp">شێوەکان</div>
              <div className="pick-grid">
                {SHAPES.map(sh => (
                  <button key={sh.id} className="pick" title={sh.name}
                    onClick={() => addElement('shape', sh.id)}
                    dangerouslySetInnerHTML={{ __html: shapeSvg(sh.id, 'currentColor') }} />
                ))}
              </div>

              <div className="grp">دەق و وێنە</div>
              <button className="btn sm" style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => addElement('text', 'دەقی نوێ')}>+ زیادکردنی دەق</button>
              <label className="btn sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                + هاوردەکردنی وێنە
                <input type="file" accept="image/*" hidden onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) insertImage(f);
                  e.target.value = '';
                }} />
              </label>

              {/* ─── ئەوەی بۆ هەموو جۆرە توخمێک کاردەکات ───
                  ئەمانە لە شریتی سەرەوەدا شوێنیان نییە — درێژن و
                  بەردەوام دەگۆڕدرێن، بۆیە لێرەن. */}
              {activeEl && <>
                <div className="grp">توخمی هەڵبژێردراو</div>

                <div className="f"><label>شوێن و قەبارە</label>
                  <div className="frow">
                    {([['x', 'X'], ['y', 'Y'], ['w', 'پانی'], ['h', 'بەرزی']] as const).map(([k, n]) => (
                      <div className="f" key={k}><label>{n}</label>
                        <input type="number" value={Math.round(activeEl[k])}
                          onChange={e => patchEl(activeEl.id, { [k]: +e.target.value || 0 })} /></div>
                    ))}
                  </div>
                </div>

                <div className="f"><label>خولانەوە: {AR(activeEl.rotate ?? 0)}°</label>
                  <input type="range" min={-180} max={180} value={activeEl.rotate ?? 0}
                    onChange={e => patchEl(activeEl.id, { rotate: +e.target.value })} /></div>

                <div className="f"><label>ڕوونی: {AR(Math.round((activeEl.opacity ?? 1) * 100))}٪</label>
                  <input type="range" min={10} max={100} value={Math.round((activeEl.opacity ?? 1) * 100)}
                    onChange={e => patchEl(activeEl.id, { opacity: +e.target.value / 100 })} /></div>

                <div className="f"><label>ڕێککەوتن لەگەڵ سلایدەکە</label>
                  <div className="chips">
                    {([['left', '⇤ چەپ'], ['cx', '⇹ ناوەڕاست'], ['right', '⇥ ڕاست'],
                       ['top', '⤒ سەرەوە'], ['cy', '⇳ ناوەڕاست'], ['bottom', '⤓ خوارەوە']] as const)
                      .map(([a, n]) => (
                        <button key={a} className="chip" onClick={() => alignEl(a)}>{n}</button>
                      ))}
                  </div>
                </div>

                <div className="hint">
                  تیرەکان بۆ جوڵاندنی ورد — <b>Shift</b> بۆ ١٠ پیکسڵ.
                  {' '}<b>Ctrl+D</b> لێکۆپیکردن · <b>Ctrl+C/V</b> کۆپی بۆ سلایدێکی تر.
                </div>
              </>}

              {activeEl?.kind === 'image' && <>
                <div className="grp">ئامرازی وێنە</div>
                <div className="f"><label>چوارچێوە</label>
                  <div className="chips">
                    {([['none', 'بێ'], ['round', 'خڕ'], ['circle', 'بازنە'], ['square', 'چوارگۆشە']] as const)
                      .map(([f, n]) => (
                        <button key={f} className={`chip${(activeEl.frame ?? 'none') === f ? ' on' : ''}`}
                          onClick={() => patchEl(activeEl.id, { frame: f })}>{n}</button>
                      ))}
                  </div>
                </div>
                <div className="frow">
                  <div className="f"><label>ئەستووری هێڵ</label>
                    <input type="number" min={0} max={24} value={activeEl.borderWidth ?? 0}
                      onChange={e => patchEl(activeEl.id, { borderWidth: +e.target.value })} /></div>
                  <div className="f"><label>ڕەنگی هێڵ</label>
                    <input type="color" value={activeEl.borderColor ?? '#3B5BDB'}
                      onChange={e => patchEl(activeEl.id, { borderColor: e.target.value })} /></div>
                </div>
                <button className={`btn sm${erase ? ' pri' : ''}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setErase(!erase)}>
                  {erase ? 'کۆتایی سڕینەوە' : '🧹 سڕینەوەی نیشانەی ئاوی'}
                </button>
                {erase && <>
                  <div className="f" style={{ marginTop: 10 }}>
                    <label>قەبارەی فرچە — {AR(brush)}</label>
                    <input type="range" min={2} max={30} value={brush}
                      onChange={e => setBrush(+e.target.value)} />
                  </div>
                  <div className="hint">
                    لەسەر وێنەکە ڕایبکێشە بۆ سڕینەوە. ڕەنگی دەوروبەری تێدا دەچێنرێت.
                  </div>
                </>}
              </>}

              <div className="grp">ئایکۆنەکان</div>
              <div className="f">
                <input value={iconQ} placeholder="گەڕان بە ئینگلیزی — database, brain, users…"
                  onChange={e => setIconQ(e.target.value)} />
              </div>

              {iconQ.trim() ? (
                (() => {
                  const hits = findIcons(iconQ);
                  return hits.length ? (
                    <div className="pick-grid">
                      {hits.map(id => (
                        <button key={id} className="pick" title={id}
                          onClick={() => addElement('icon', id)}
                          dangerouslySetInnerHTML={{ __html: iconSvg(id, 'currentColor', 2) }} />
                      ))}
                    </div>
                  ) : <div className="hint">هیچ ئایکۆنێک بۆ «{iconQ}» نەدۆزرایەوە.</div>;
                })()
              ) : ALL_ICON_GROUPS.map(g => (
                <div key={g.name}>
                  <div className="gname">{g.name}</div>
                  <div className="pick-grid">
                    {g.ids.map(id => (
                      <button key={id} className="pick" title={id}
                        onClick={() => addElement('icon', id)}
                        dangerouslySetInnerHTML={{ __html: iconSvg(id, 'currentColor', 2) }} />
                    ))}
                  </div>
                </div>
              ))}

              {activeEl && <>
                <div className="grp">توخمی هەڵبژێردراو</div>
                {activeEl.kind === 'text' && (
                  <div className="f"><label>دەق</label>
                    <textarea rows={2} value={activeEl.value}
                      onChange={e => patchEl(activeEl.id, { value: e.target.value })} /></div>
                )}
                <div className="frow">
                  <div className="f"><label>ڕەنگ</label>
                    <input type="color" value={activeEl.color ?? '#5C77BC'}
                      onChange={e => patchEl(activeEl.id, { color: e.target.value })} /></div>
                  <div className="f"><label>قەبارە</label>
                    <input type="number" value={activeEl.w}
                      onChange={e => {
                        const n = Math.max(40, +e.target.value || 40);
                        patchEl(activeEl.id, activeEl.kind === 'text' ? { w: n } : { w: n, h: n });
                      }} /></div>
                </div>
                <div className="f"><label>خولانەوە: {activeEl.rotate ?? 0}°</label>
                  <input type="range" min={-180} max={180} value={activeEl.rotate ?? 0}
                    onChange={e => patchEl(activeEl.id, { rotate: +e.target.value })} /></div>
                <div className="f"><label>ڕوونی: {Math.round((activeEl.opacity ?? 1) * 100)}٪</label>
                  <input type="range" min={10} max={100} value={Math.round((activeEl.opacity ?? 1) * 100)}
                    onChange={e => patchEl(activeEl.id, { opacity: +e.target.value / 100 })} /></div>
                {activeEl.kind === 'icon' && (
                  <div className="f"><label>ئەستووری هێڵ: {activeEl.strokeWidth ?? 2}</label>
                    <input type="range" min={1} max={4} step={0.5} value={activeEl.strokeWidth ?? 2}
                      onChange={e => patchEl(activeEl.id, { strokeWidth: +e.target.value })} /></div>
                )}
                <button className="btn sm" onClick={() => {
                  setElements(l => l.filter(x => x.id !== activeEl.id)); setSelEl(null);
                }}>سڕینەوەی توخم</button>
              </>}

              <div className="hint">
                دوای زیادکردن، دۆخی <b>دەستکاری</b> کاردەکات — دەتوانیت توخمەکە
                بجوڵێنیت و قەبارەکەی بگۆڕیت بە ماوس.
              </div>
            </> : <div className="hint">سلایدێک هەڵبژێرە.</div>)}

            {/* ── پاشبنەما ── */}
            {tab === 'th' && <>
              <ThemePicker value={deck.theme} style={deck.style ?? 'glass'}
                lang={deck.lang} fontFamily={deck.fontFamily}
                onPick={id => push({ ...deck, theme: id })}
                onPickStyle={id => push({ ...deck, style: id })} />
              <div className="grp">فۆنت</div>
              <div className="f">
                <select value={deck.fontFamily} onChange={e => push({ ...deck, fontFamily: e.target.value })}>
                  {FONTS.map(f => <option key={f.v} value={f.v}>{f.n}</option>)}
                </select>
              </div>
              <FontCheck deck={deck} />
              {/* چڕی دەق — قەبارەی فۆنت لە هەموو سلایدەکاندا دەگۆڕێت.
                  دەقی نووسراو نەگۆڕ دەمێنێتەوە؛ تەنها چۆنیەتی نیشاندانی دەگۆڕێت. */}
              <div className="grp">چڕی دەق</div>
              <div className="f">
                <select value={deck.density ?? 'normal'}
                  onChange={e => push({ ...deck, density: e.target.value as Density })}>
                  {DENSITIES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </>}

            {/* ── ناوەڕۆک ── */}
            {tab === 'txt' && (cur ? <>
              <div className="grp">دەق</div>
              <div className="f"><label>ناونیشان</label>
                <input value={cur.title} onChange={e => setSlide(s => ({ ...s, title: e.target.value }))} /></div>

              {layDef?.needs.includes('bullets') || cur.bullets.length ? (
                <div className="f"><label>خاڵەکان — هێڵێک بۆ هەر خاڵێک</label>
                  <textarea rows={6} value={cur.bullets.join('\n')}
                    onChange={e => setSlide(s => ({ ...s, bullets: e.target.value.split('\n') }))} /></div>
              ) : null}

              {(cur.body !== undefined || layDef?.needs.includes('text')) && (
                <div className="f"><label>دەقی سەرەکی</label>
                  <textarea rows={5} value={cur.body ?? ''}
                    onChange={e => setSlide(s => ({ ...s, body: e.target.value }))} /></div>
              )}

              {cur.chart && <>
                <div className="grp">داتای چارت</div>
                <div className="f"><label>ناونیشانەکان — بە کۆما</label>
                  <input value={cur.chart.labels.join(', ')} onChange={e => setSlide(s => ({
                    ...s, chart: { ...s.chart!, labels: e.target.value.split(',').map(x => x.trim()), source: 'user' },
                  }))} /></div>
                <div className="f"><label>ژمارەکان — بە کۆما</label>
                  <input value={cur.chart.values.join(', ')} onChange={e => setSlide(s => ({
                    ...s, chart: { ...s.chart!, values: e.target.value.split(',').map(x => Number(x.trim()) || 0), source: 'user' },
                  }))} /></div>
                <div className="hint">
                  ژمارەکان لە <b>{cur.chart.source === 'ai' ? 'AI' : 'تۆ'}</b>ـەوە هاتوون.
                  دەستکاریان بکەیت، دەبنە هی تۆ.
                </div>
              </>}

              <div className="grp">وێنە</div>
              <div className="f"><label>وەسفی وێنە — بۆ AI و بۆ گەڕان</label>
                <textarea rows={2} value={cur.imagePrompt ?? ''}
                  onChange={e => setSlide(s => ({ ...s, imagePrompt: e.target.value }))} /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm" onClick={() => fetchImage('ai')}
                  disabled={!imageKey || !!busy} title={imageKey ? '' : 'کلیل دانەنراوە'}>
                  دروستکردن بە AI
                </button>
                <button className="btn sm" onClick={() => fetchImage('free')} disabled={!!busy}>
                  وێنەی بێبەرامبەر
                </button>
                <label className="btn sm" style={{ cursor: 'pointer' }}>
                  بارکردن
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader();
                    r.onload = ev => setSlide(s => ({ ...s, imageUrl: String(ev.target?.result) }));
                    r.readAsDataURL(f);
                  }} />
                </label>
                {cur.imageUrl && <button className="btn sm"
                  onClick={() => setSlide(s => ({ ...s, imageUrl: undefined }))}>سڕینەوە</button>}
              </div>

              {editing && sel && <>
                <div className="grp">توخمی هەڵبژێردراو: {sel}</div>
                <div className="frow">
                  <div className="f"><label>ڕەنگ</label>
                    <input type="color" value={cur.overrides[sel]?.color ?? '#000000'}
                      onChange={e => patch(sel, { color: e.target.value })} /></div>
                  <div className="f"><label>قەبارەی فۆنت</label>
                    <input type="number" value={cur.overrides[sel]?.fontSize ?? ''} placeholder="خۆکار"
                      onChange={e => patch(sel, { fontSize: Number(e.target.value) || undefined })} /></div>
                </div>
                <div className="f"><label>خولانەوە: {cur.overrides[sel]?.rotate ?? 0}°</label>
                  <input type="range" min={-45} max={45} value={cur.overrides[sel]?.rotate ?? 0}
                    onChange={e => patch(sel, { rotate: +e.target.value })} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn sm" onClick={() => { patch(sel, { hidden: true }); setSel(null); }}>
                    سڕینەوەی توخم
                  </button>
                  <button className="btn sm" onClick={() => setSlide(s => {
                    const o = { ...s.overrides }; delete o[sel]; return { ...s, overrides: o };
                  })}>گەڕاندنەوە</button>
                </div>
              </>}

              {editing && !sel && <div className="hint">
                کلیک لەسەر هەر توخمێکی سلایدەکە بکە بۆ هەڵبژاردنی.
                ئینجا دەتوانیت بیجوڵێنیت، گەورەی بکەیت، ڕەنگی بگۆڕیت یان بیسڕیتەوە.
              </div>}
            </> : <div className="hint">لاپەڕەی سەرەتا لە تابی «ڕێکخستن» دەستکاری دەکرێت.</div>)}

            {/* ── ڕێکخستن ── */}
            {tab === 'set' && <>
              <div className="grp">ئەنیمەیشن</div>
              <label className="chk"><input type="checkbox" checked={deck.buildMode}
                onChange={e => push({ ...deck, buildMode: e.target.checked })} />
                Morph لە PowerPoint دا</label>
              <div className="f"><label>ماوەی گواستنەوە: {AR(deck.transitionMs)} ms</label>
                <input type="range" min={500} max={4000} step={250} value={deck.transitionMs}
                  onChange={e => push({ ...deck, transitionMs: +e.target.value })} /></div>
              <div className="hint">
                <b>Morph</b> توخمەکان بە نەرمی لە سلایدێکەوە بۆ سلایدێکی تر دەجوڵێنێت.
                لە PDF دا کار ناکات — تەنها لە PowerPoint دا.
              </div>

              <div className="grp">لاپەڕەی سەرەتا</div>
              {([['university', 'زانکۆ'], ['institute', 'پەیمانگا'], ['department', 'بەش'],
                 ['title', 'ناونیشان'], ['year', 'ساڵ'], ['teacherName', 'مامۆستا']] as const)
                .map(([k, label]) => (
                  <div className="f" key={k}><label>{label}</label>
                    <input value={deck.titleInfo[k]} onChange={e =>
                      push({ ...deck, titleInfo: { ...deck.titleInfo, [k]: e.target.value } })} /></div>
                ))}

              <div className="grp">ئێکسپۆرتکردنی سەرچاوەکان</div>
              <CiteExport deck={deck} keys={keys} onRefs={list => {
                // ═══ لاپەڕەی سەرچاوەکان دەکرێتەوە یان دروست دەکرێت ═══
                // دێککێک کە بەبێ سەرچاوە دروستکرا، لاپەڕەکەی نییە —
                // بۆیە زیادکردنی سەرچاوە واتای زیادکردنی لاپەڕەکەشە.
                const at = deck.slides.findIndex(x => x.layout === 'L_refs');
                if (at >= 0) {
                  const slides = [...deck.slides];
                  slides[at] = { ...slides[at], refs: list };
                  push({ ...deck, slides });
                } else {
                  const page = newSlide('L_refs',
                    deck.lang === 'en' ? 'References' : 'سەرچاوەکان');
                  page.refs = list;
                  push({ ...deck, slides: [...deck.slides, page] });
                }
              }} onStyle={id => push({
                ...deck, citeStyle: id,
                // دەقی سەر سلایدەکانیش لەنوێ دەنووسرێتەوە، نەک تەنها فایلەکە
                slides: deck.slides.map(s =>
                  s.refs?.length ? { ...s, refs: restyle(s.refs, id) } : s),
              })} />

              <div className="grp">پرۆژە</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => exportDeck(deck)}>هەناردەی پرۆژە</button>
                <label className="btn sm" style={{ cursor: 'pointer' }}>
                  هاوردەکردن
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    try { const d = await importDeck(f); setDeck(d); setIdx(-1); saveDeck(d); }
                    catch (er) { alert((er as Error).message); }
                  }} />
                </label>
              </div>
              <div className="hint warn">
                شتەکانت تەنها لەم وێبگەڕەدا پاشەکەوت دەبن.
                ئەگەر داتای وێبگەڕەکە بسڕیتەوە، لەدەست دەچن —
                بۆیە <b>هەناردەی پرۆژە</b> بکە پێش ئەوەی کۆتایی بێت.
              </div>

              <div className="grp">دابینکەری دەق — ئینگلیزی</div>
              <ProviderPicker keys={keys} onChange={n => { setKeys(n); saveKeys(n); }} />
              <div className="hint">
                کوردی و عەرەبی هەمیشە <b>Gemini</b> بەکاردەهێنن.
              </div>

              <div className="grp">دابینکەری وێنە</div>
              <div className="f">
                <select value={keys.imageProvider} onChange={e => {
                  const n = { ...keys, imageProvider: e.target.value as typeof keys.imageProvider };
                  setKeys(n); saveKeys(n);
                }}>
                  {IMAGE_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {!imageKey && (
                <div className="hint warn">
                  کلیلی <b>{providerById(keys.imageProvider).name}</b> دانەنراوە،
                  بۆیە وێنە دروست ناکرێت.
                </div>
              )}

              <div className="grp">مێشکی ئەیجێنت</div>
              <div className="frow">
                <div className="f"><label>دابینکەر</label>
                  <select value={agentProv} onChange={e => {
                    const id = e.target.value as ProviderId;
                    const n = { ...keys, agentProvider: id, agentModel: providerById(id).models[0].id };
                    setKeys(n); saveKeys(n);
                  }}>
                    {PROVIDERS.filter(p => canRunAgent(p.id))
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
                <div className="f"><label>مۆدێل</label>
                  <select value={keys.agentModel ?? providerById(agentProv).models[0].id}
                    onChange={e => { const n = { ...keys, agentModel: e.target.value };
                      setKeys(n); saveKeys(n); }}>
                    {providerById(agentProv).models.map(m =>
                      <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select></div>
              </div>
              {!keys.keys[agentProv] && (
                <div className="hint err">
                  کلیلی <b>{providerById(agentProv).name}</b> دانەنراوە — ئەیجێنت کار ناکات.
                </div>
              )}
              <div className="hint">
                ئەگەر <b>Gemini</b> سنووری تێپەڕاند، لێرەوە بیگۆڕە بۆ
                <b> Groq</b> (بێبەرامبەر) یان دابینکەرێکی تر و ئەیجێنت بەردەوام دەبێت.
                <br /><br />
                ئامرازەکانی <b>سەرچاوە</b>، <b>ئامار</b> و <b>وێنەی بێبەرامبەر</b>
                هەرگیز پێویستیان بە AI نییە — لە داتابەیسی سەربەخۆوە دێن.
              </div>

              <div className="grp">مەکینەی گەڕان</div>
              <div className="f">
                <select value={keys.searchEngine ?? ''} onChange={e => {
                  const n = { ...keys, searchEngine: e.target.value as typeof keys.searchEngine };
                  setKeys(n); saveKeys(n);
                }}>
                  <option value="">Gemini (بنەڕەت)</option>
                  {ENGINES.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}
                </select>
              </div>
              {keys.searchEngine && (() => {
                const en = ENGINES.find(x => x.id === keys.searchEngine)!;
                return <>
                  <div className="f"><label>کلیلی {en.name}</label>
                    <input type="password" value={keys.searchKeys?.[en.id] ?? ''}
                      onChange={e => {
                        const n = { ...keys, searchKeys: { ...keys.searchKeys, [en.id]: e.target.value } };
                        setKeys(n); saveKeys(n);
                      }} /></div>
                  <div className="howto">
                    <div className="howto-head">
                      <b>چۆن کلیلی {en.name} وەربگریت؟</b>
                      <span className="pill ok">{en.free}</span>
                    </div>
                    <ol className="howto-steps">
                      {en.howTo.map((st, i) => <li key={i}>{st}</li>)}
                    </ol>
                    <a className="btn pri" href={en.keyUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalIcon /> کردنەوەی {en.site}
                    </a>
                  </div>
                </>;
              })()}
              <div className="hint">
                مەکینەیەکی تایبەت گەڕان خێراتر و وردتر دەکات، و سنووری
                <b> Gemini</b> بۆ نووسینی دەق دەهێڵێتەوە.
              </div>

              <div className="grp">کلیلەکان</div>
              <KeyPanel keys={keys} onChange={n => { setKeys(n); saveKeys(n); }} />
              <div className="hint">
                هەموو کلیلەکان تەنها لە وێبگەڕی خۆتدان.
                ئێمە هیچ سێرڤەرێکمان نییە کە بیانگاتێ.
              </div>
            </>}
          </div>
        </aside>
        {/* مێنیوی کلیکی ڕاست */}
        <ContextMenu at={menu} actions={menuActions()} onClose={() => setMenu(null)} />
      </main>
    </div>
  );
}

