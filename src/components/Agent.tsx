'use client';

// ═══════════ پانێلی ئەیجێنت ═══════════
// هەموو هەنگاوێک دەردەکەوێت: بیرکردنەوە، بانگکردنی ئامراز، و ئەنجام.

import { useEffect, useRef, useState } from 'react';
import { runAgent, type AgentEvent, type AgentTurn } from '@/lib/agent';
import { providerById, type ProviderId } from '@/lib/providers';
import type { Deck } from '@/lib/types';

type Row =
  | { r: 'me'; text: string }
  | { r: 'think'; text: string }
  | { r: 'tool'; label: string; args: string; ok?: boolean; result?: string }
  | { r: 'say'; text: string }
  | { r: 'err'; text: string };

const SUGGESTIONS = [
  'سەرچاوە ئەکادیمییە ڕاستەقینەکان بدۆزەرەوە و دایانبنێ',
  'ئاماری ڕاستەقینەی بانکی جیهانی زیاد بکە',
  'وێنەی بێبەرامبەر بدۆزەرەوە بۆ سلایدەکان',
  'سلایدەکان کورتتر بکە',
  'چارتێک زیاد بکە بۆ بەراوردکردن',
  'ئایکۆنی گونجاو دابنێ لەسەر سلایدەکان',
  'سلایدێکی کۆتایی زیاد بکە بۆ ئەنجامەکان',
];

/** ئارگیومێنتەکان بە شێوەیەکی کورت */
function brief(args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null || v === '') continue;
    let s = Array.isArray(v) ? `${v.length} دانە` : String(v);
    if (s.length > 46) s = s.slice(0, 46) + '…';
    parts.push(`${k}: ${s}`);
  }
  return parts.join(' · ');
}

export default function Agent({ deck, provider, apiKey, model, engine, onDeck }: {
  deck: Deck;
  /** دابینکەری مێشکی ئەیجێنت */
  provider?: ProviderId;
  apiKey: string;
  model?: string;
  engine?: { id: 'tavily' | 'brave' | 'serper'; key: string };
  onDeck: (d: Deck) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<AgentTurn[]>([]);
  const deckRef = useRef(deck);
  const endRef = useRef<HTMLDivElement>(null);

  // ئەیجێنت هەمیشە نوێترین دێک دەبینێت
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [rows]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    if (!apiKey) {
      setRows(r => [...r, { r: 'err',
        text: `کلیلی ${providerById(provider ?? 'gemini').name} دانەنراوە. بڕۆ بۆ تابی «ڕێکخستن».` }]);
      return;
    }

    setInput('');
    setRows(r => [...r, { r: 'me', text: msg }]);
    setBusy(true);

    const emit = (e: AgentEvent) => setRows(rows => {
      switch (e.kind) {
        case 'thinking': return [...rows, { r: 'think', text: e.text }];
        case 'say':      return [...rows, { r: 'say', text: e.text }];
        case 'error':    return [...rows, { r: 'err', text: e.text }];
        case 'tool':     return [...rows, { r: 'tool', label: e.label, args: brief(e.args) }];
        case 'result': {
          // ئەنجام دەچەسپێت بە دوایین ئامرازەوە
          const out = [...rows];
          for (let i = out.length - 1; i >= 0; i--) {
            if (out[i].r === 'tool' && (out[i] as { ok?: boolean }).ok === undefined) {
              out[i] = { ...(out[i] as Row & { r: 'tool' }), ok: e.ok, result: e.text };
              break;
            }
          }
          return out;
        }
        default: return rows;
      }
    });

    historyRef.current = await runAgent({
      ctx: {
        key: apiKey,
        provider,
        model,
        engine,
        get deck() { return deckRef.current; },
        apply: d => { deckRef.current = d; onDeck(d); },
      },
      message: msg,
      history: historyRef.current,
      emit,
    });

    setBusy(false);
  }

  return (
    <div className="agent">
      <div className="agent-log">
        {rows.length === 0 && (
          <div className="agent-empty">
            <div className="ae-title">ئەیجێنتی پێشکەشکردن</div>
            <p>
              داوای هەر گۆڕانکارییەک بکە. ئەیجێنت خۆی بڕیار دەدات کام ئامرازە
              بەکاربهێنێت — گەڕان لە ئینتەرنێت، دەستکاری سلاید، زیادکردنی چارت،
              دانانی ئایکۆن — و هەموو هەنگاوێکت پیشان دەدات.
            </p>
            <div className="sugs">
              {SUGGESTIONS.map(s => (
                <button key={s} className="sug" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {rows.map((row, i) => {
          if (row.r === 'me')    return <div key={i} className="bubble me">{row.text}</div>;
          if (row.r === 'say')   return <div key={i} className="bubble ai">{row.text}</div>;
          if (row.r === 'err')   return <div key={i} className="bubble err">{row.text}</div>;
          if (row.r === 'think') return (
            <details key={i} className="think">
              <summary><span className="ti">◈</span> بیرکردنەوە</summary>
              <div>{row.text}</div>
            </details>
          );
          return (
            <div key={i} className={`tool${row.ok === false ? ' bad' : row.ok ? ' good' : ''}`}>
              <div className="th">
                <span className="tdot">{row.ok === undefined ? '◐' : row.ok ? '✓' : '✕'}</span>
                <b>{row.label}</b>
              </div>
              {row.args && <div className="ta">{row.args}</div>}
              {row.result && <div className="tr">{row.result}</div>}
            </div>
          );
        })}

        {busy && <div className="bubble ai busy"><span className="spin dark" /> کار دەکات…</div>}
        <div ref={endRef} />
      </div>

      <form className="agent-in" onSubmit={e => { e.preventDefault(); send(input); }}>
        <textarea
          value={input}
          placeholder="داوای گۆڕانکاری بکە…"
          rows={2}
          disabled={busy}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
        />
        <button className="btn pri" type="submit" disabled={busy || !input.trim()}>
          {busy ? <span className="spin" /> : 'ناردن'}
        </button>
      </form>
    </div>
  );
}
