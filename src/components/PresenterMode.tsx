'use client';

// ═══════════ دۆخی پێشکەشکار ═══════════
//
// خوێندکار پێش ئەوەی فایلەکە دابەزێنێت، دەتوانێت لێرەدا مەشق بکات و
// پێشکەشی بکات — بەبێ ئەوەی PowerPoint هەبێت.
//
// ─── دوو شاشە ───
// پەنجەرەیەکی دووەم دەکرێتەوە (`window.open`) کە تەنها سلایدەکە پیشان
// دەدات — ئەوە دەخرێتە سەر پڕۆجێکتەر. پەنجەرەی یەکەم دەمێنێتەوە لەسەر
// لاپتۆپەکە و سلایدی داهاتوو و تێبینییەکان و کاتژمێر پیشان دەدات.
//
// هەردووکیان بە `BroadcastChannel` هاوکات دەکرێن — API ـێکی وێبگەڕە،
// هیچ سێرڤەرێکی ناوێت (C1). ئەگەر وێبگەڕەکە پشتگیری نەکات، دۆخی یەک
// شاشەیی هەر کاردەکات.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SlideView from './SlideView';
import { speakerAt } from '@/lib/script';
import type { Deck, Slide } from '@/lib/types';

const CHANNEL = 'ps-present';

type Msg = { type: 'goto'; index: number } | { type: 'close' } | { type: 'ping' };

/** ژمارە بە پیتی عەرەبی — وەک هەموو ڕووکارەکە */
const AR = (n: number) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const two = (n: number) => AR(n).padStart(2, '٠');
  return (h ? `${two(h)}:` : '') + `${two(m)}:${two(x)}`;
};

// ─────────── قەڵەم و پۆینتەر ───────────

interface Mark { x: number; y: number }

/**
 * ڕووپۆشی کێشان.
 *
 * دوو ئامراز: پۆینتەری لەیزەری (خاڵێکی سوور کە دوای ماوس دەکەوێت) و
 * قەڵەم (هێڵی چەسپاو). هەردووکیان بە ڕێژە خەزن دەکرێن — نەک پیکسڵ —
 * بۆیە لە هەر قەبارەیەکی شاشەدا لە شوێنی خۆیان دەمێننەوە.
 */
function Ink({ tool, color }: { tool: 'none' | 'laser' | 'pen'; color: string }) {
  const [paths, setPaths] = useState<Mark[][]>([]);
  const [dot, setDot] = useState<Mark | null>(null);
  const drawing = useRef(false);

  // گۆڕینی ئامراز کێشانێکی نیوەچڵ دەبڕێت
  useEffect(() => { drawing.current = false; }, [tool]);

  const at = (e: React.PointerEvent): Mark => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  if (tool === 'none') return null;

  return (
    <div className="ink"
      onPointerDown={e => {
        if (tool !== 'pen') return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        setPaths(p => [...p, [at(e)]]);
      }}
      onPointerMove={e => {
        const p = at(e);
        setDot(p);
        if (!drawing.current) return;
        setPaths(all => {
          const out = [...all];
          out[out.length - 1] = [...out[out.length - 1], p];
          return out;
        });
      }}
      onPointerUp={() => { drawing.current = false; }}
      onPointerLeave={() => { drawing.current = false; setDot(null); }}
      onDoubleClick={() => setPaths([])}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {paths.map((p, i) => (
          <polyline key={i} points={p.map(m => `${m.x * 100},${m.y * 100}`).join(' ')}
            fill="none" stroke={color} strokeWidth="0.35"
            strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {tool === 'laser' && dot && (
        <span className="laser" style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }} />
      )}
    </div>
  );
}

// ─────────── سلاید لە ناو چوارچێوەیەکدا ───────────

/** سلایدەکە بە قەبارەی خۆی دەکێشێت و دەیگونجێنێت لەگەڵ چوارچێوەکە */
function Fit({ deck, slide, className = '' }:
  { deck: Deck; slide: Slide | null; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.2);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setK(Math.min(r.width / 1920, r.height / 1080));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`pfit ${className}`} ref={box}>
      <div className="pslide" style={{ width: 1920 * k, height: 1080 * k }}>
        <SlideView deck={deck} slide={slide} scale={k} />
      </div>
    </div>
  );
}

// ─────────── پەنجەرەی سەرەکی ───────────

export interface PresenterProps {
  deck: Deck;
  /** لە کام سلایدەوە دەست پێبکات — ٠ = لاپەڕەی سەرەتا */
  start?: number;
  onExit: () => void;
}

export default function PresenterMode({ deck, start = 0, onExit }: PresenterProps) {
  // ٠ = لاپەڕەی سەرەتا، ١..n = سلایدەکانی ناوەڕۆک
  const total = deck.slides.length + 1;
  const [i, setI] = useState(Math.min(Math.max(0, start), total - 1));
  const [tool, setTool] = useState<'none' | 'laser' | 'pen'>('none');
  const [grid, setGrid] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);

  // کاتژمێر
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setMs(v => v + 1000), 1000);
    return () => clearInterval(t);
  }, [running]);

  const at = useCallback((n: number) => (n === 0 ? null : deck.slides[n - 1] ?? null), [deck]);
  const cur = at(i);
  const next = i + 1 < total ? at(i + 1) : null;

  // ─── پەنجەرەی دووەم ───
  const chan = useRef<BroadcastChannel | null>(null);
  const win = useRef<Window | null>(null);
  const [dual, setDual] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const c = new BroadcastChannel(CHANNEL);
    chan.current = c;
    return () => { c.close(); chan.current = null; };
  }, []);

  const send = useCallback((m: Msg) => { chan.current?.postMessage(m); }, []);
  useEffect(() => { send({ type: 'goto', index: i }); }, [i, send]);

  const openSecond = () => {
    const w = window.open(`${location.pathname}?present=1`, 'ps-audience',
      'width=1280,height=720');
    if (!w) { alert('وێبگەڕەکە ڕێگەی بە پەنجەرەی نوێ نەدا. ڕێگە بدە و دووبارە هەوڵ بدە.'); return; }
    win.current = w;
    setDual(true);
    // پەنجەرەی نوێ کاتێکی دەوێت تا ئامادە بێت
    setTimeout(() => send({ type: 'goto', index: i }), 700);
  };

  const closeSecond = useCallback(() => {
    send({ type: 'close' });
    win.current?.close();
    win.current = null;
    setDual(false);
  }, [send]);

  useEffect(() => () => { win.current?.close(); }, []);

  // ─── کیبۆرد ───
  const go = useCallback((d: number) =>
    setI(v => Math.min(total - 1, Math.max(0, v + d))), [total]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
          e.preventDefault(); go(1); break;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
          e.preventDefault(); go(-1); break;
        case 'Home': setI(0); break;
        case 'End':  setI(total - 1); break;
        case 'Escape':
          if (grid) setGrid(false); else { closeSecond(); onExit(); }
          break;
        case 'g': case 'G': setGrid(v => !v); break;
        case 'l': case 'L': setTool(v => (v === 'laser' ? 'none' : 'laser')); break;
        case 'p': case 'P': setTool(v => (v === 'pen' ? 'none' : 'pen')); break;
        case 'n': case 'N': setNotesOpen(v => !v); break;
        case 't': case 'T': setRunning(v => !v); break;
        case 'r': case 'R': setMs(0); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [go, total, grid, onExit, closeSecond]);

  const notes = cur?.notes?.trim();

  // ─── کێ ئێستا قسە دەکات ───
  // `i + 1` ژمارەی بینراوی سلایدەکەیە (٠ = لاپەڕەی سەرەتا)، و
  // `Speaker.from/to` بە هەمان ژمارەن — بڕوانە تێبینییەکەی `types.ts`.
  const mine = speakerAt(deck.speakers, i + 1);
  const after = deck.speakers?.find(s => s.from > (mine?.to ?? i + 1));

  return (
    <div className="present">
      <div className="pmain">
        <Fit deck={deck} slide={cur} className="big" />
        <Ink tool={tool} color="#E23B3B" />
      </div>

      <aside className="pside">
        {mine && (
          <div className="pspeak">
            <b>{mine.name}</b>
            <span>
              سلایدی {AR(i + 1 - mine.from + 1)} لە {AR(mine.to - mine.from + 1)}
              {mine.minutes ? ` · ${AR(mine.minutes)} خولەک` : ''}
            </span>
            {/* ئاگاداری گۆڕین — خوێندکار دەبێت پێش وەخت بزانێت */}
            {i + 1 === mine.to && after && (
              <i className="hand">دوای ئەمە: {after.name}</i>
            )}
          </div>
        )}

        <div className="ptimer">
          <b>{clock(ms)}</b>
          <div className="row">
            <button className="btn icon sm" title="ڕاگرتن / بەردەوامبوون (T)"
              onClick={() => setRunning(v => !v)}>{running ? '❚❚' : '▶'}</button>
            <button className="btn icon sm" title="سفرکردنەوە (R)"
              onClick={() => setMs(0)}>↺</button>
          </div>
        </div>

        <div className="plbl">سلایدی داهاتوو</div>
        {next !== undefined && i + 1 < total
          ? <Fit deck={deck} slide={next} className="mini" />
          : <div className="pend">کۆتایی</div>}

        <div className="plbl row">
          <span>تێبینی قسەکەر</span>
          <button className="btn icon sm" onClick={() => setNotesOpen(v => !v)}>
            {notesOpen ? '−' : '+'}
          </button>
        </div>
        {notesOpen && (
          <div className="pnotes">
            {notes || <i>هیچ تێبینییەک بۆ ئەم سلایدە نییە.</i>}
          </div>
        )}
      </aside>

      <div className="pbar">
        <button className="btn sm" onClick={() => go(-1)} disabled={i === 0}>‹ پێشوو</button>
        <span className="pnum">{AR(i + 1)} / {AR(total)}</span>
        <button className="btn sm" onClick={() => go(1)} disabled={i === total - 1}>دواتر ›</button>

        <span className="vline" />

        <button className={`btn sm${grid ? ' pri' : ''}`} onClick={() => setGrid(v => !v)}
          title="تۆڕی سلایدەکان (G)">▦</button>
        <button className={`btn sm${tool === 'laser' ? ' pri' : ''}`}
          onClick={() => setTool(v => (v === 'laser' ? 'none' : 'laser'))}
          title="پۆینتەری لەیزەری (L)">●</button>
        <button className={`btn sm${tool === 'pen' ? ' pri' : ''}`}
          onClick={() => setTool(v => (v === 'pen' ? 'none' : 'pen'))}
          title="قەڵەم — دوو کلیک بۆ سڕینەوە (P)">✎</button>

        <span className="vline" />

        {dual
          ? <button className="btn sm" onClick={closeSecond}>داخستنی شاشەی دووەم</button>
          : <button className="btn sm" onClick={openSecond}
              disabled={typeof BroadcastChannel === 'undefined'}>شاشەی دووەم</button>}

        <span className="spacer" />
        <button className="btn sm" onClick={() => { closeSecond(); onExit(); }}>دەرچوون (Esc)</button>
      </div>

      {grid && (
        <div className="pgrid" onClick={() => setGrid(false)}>
          <div className="inner" onClick={e => e.stopPropagation()}>
            {Array.from({ length: total }, (_, n) => (
              <button key={n} className={`gcell${n === i ? ' on' : ''}`}
                onClick={() => { setI(n); setGrid(false); }}>
                <Fit deck={deck} slide={at(n)} className="cell" />
                <span className="gn">{AR(n + 1)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── پەنجەرەی دووەم (تەنها سلاید) ───────────

/**
 * ئەوەی لەسەر پڕۆجێکتەر دەردەکەوێت: تەنها سلایدەکە، بەبێ هیچ.
 * گوێ لە کەناڵەکە دەگرێت و لەگەڵ پەنجەرەی سەرەکیدا دەگۆڕێت.
 */
export function AudienceWindow({ deck }: { deck: Deck }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const c = new BroadcastChannel(CHANNEL);
    c.onmessage = (e: MessageEvent<Msg>) => {
      if (e.data?.type === 'goto') setI(e.data.index);
      if (e.data?.type === 'close') window.close();
    };
    return () => c.close();
  }, []);

  const slide = useMemo(() => (i === 0 ? null : deck.slides[i - 1] ?? null), [deck, i]);
  return <div className="audience"><Fit deck={deck} slide={slide} className="big" /></div>;
}
