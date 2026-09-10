'use client';

// ═══════════ پانێلی کلیلەکان ═══════════
// بۆ هەر دابینکەرێک: لینکی ڕاستەوخۆ، ڕێنمایی هەنگاو بە هەنگاو، و تاقیکردنەوە.

import { useState } from 'react';
import { PROVIDERS, providerById, looksValid, type Provider, type ProviderId }
  from '@/lib/providers';
import { testKey, type Keys } from '@/lib/llm';
import { hasLiveList, listNeedsKey, liveModels, type LiveModel } from '@/lib/models';

const FREE_LABEL: Record<Provider['free'], { text: string; cls: string }> = {
  yes:     { text: 'بێبەرامبەر',        cls: 'ok' },
  limited: { text: 'بەشێکی بێبەرامبەر', cls: '' },
  no:      { text: 'پارەدار',           cls: 'err' },
};

export function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

/** کارتی ڕێنمایی وەرگرتنی کلیل */
export function HowToGetKey({ provider }: { provider: Provider }) {
  const free = FREE_LABEL[provider.free];
  return (
    <div className="howto">
      <div className="howto-head">
        <b>چۆن کلیلی {provider.name} وەربگریت؟</b>
        <span className={`pill ${free.cls}`}>{free.text}</span>
      </div>

      <ol className="howto-steps">
        {provider.howTo.map((step, i) => <li key={i}>{step}</li>)}
      </ol>

      <a className="btn pri" href={provider.keyUrl} target="_blank" rel="noopener noreferrer">
        <ExternalIcon />
        کردنەوەی {provider.site}
      </a>

      {provider.note && <div className="howto-note">{provider.note}</div>}
    </div>
  );
}

export interface KeyPanelProps {
  keys: Keys;
  onChange: (k: Keys) => void;
  /** تەنها ئەم دابینکەرە پیشان بدە (بۆ ویزارد) */
  only?: ProviderId;
  /** پاش تاقیکردنەوەی سەرکەوتوو */
  onVerified?: (id: ProviderId) => void;
}

export default function KeyPanel({ keys, onChange, only, onVerified }: KeyPanelProps) {
  const [open, setOpen] = useState<ProviderId | null>(only ?? 'gemini');
  const [state, setState] = useState<Partial<Record<ProviderId, 'testing' | 'ok' | 'bad'>>>({});
  const [why, setWhy] = useState<Partial<Record<ProviderId, string>>>({});
  const [okModel, setOkModel] = useState<Partial<Record<ProviderId, string>>>({});
  /** لیستی زیندووی مۆدێلەکان — بڕوانە `lib/models.ts` */
  const [live, setLive] = useState<Partial<Record<ProviderId, LiveModel[]>>>({});
  const [listing, setListing] = useState<ProviderId | null>(null);
  const [listErr, setListErr] = useState<Partial<Record<ProviderId, string>>>({});
  /** تەنها بێبەرامبەرەکان پیشان بدە */
  const [freeOnly, setFreeOnly] = useState(true);

  async function loadModels(id: ProviderId) {
    setListing(id);
    setListErr(e => ({ ...e, [id]: '' }));
    try {
      // `await` دەبێت لە دەرەوەی `setLive` بێت — ئەو کۆڵبەکە
      // async نییە و ناتوانێت چاوەڕوانی بکات
      const got = await liveModels(id, keys.keys[id]);
      setLive(l => ({ ...l, [id]: got }));
    } catch (e) {
      setListErr(er => ({ ...er, [id]: (e as Error).message }));
    } finally { setListing(null); }
  }

  const list = only ? PROVIDERS.filter(p => p.id === only) : PROVIDERS;

  const setKey = (id: ProviderId, v: string) => {
    onChange({ ...keys, keys: { ...keys.keys, [id]: v } });
    setState(s => ({ ...s, [id]: undefined }));
  };

  async function check(id: ProviderId) {
    const key = keys.keys[id] ?? '';
    setState(s => ({ ...s, [id]: 'testing' }));
    const model = id === keys.textProvider ? keys.textModel : undefined;
    const r = await testKey(id, key, model);
    setState(s => ({ ...s, [id]: r.ok ? 'ok' : 'bad' }));
    // ═══ کام مۆدێل کاری کرد ═══
    // `testKey` مۆدێلەکانی کاتالۆگ بە ڕیز تاقی دەکاتەوە. ئەگەر
    // یەکەمیان کۆن بووبێت، بەکارهێنەر دەبێت بزانێت کامەیان کارا
    // بوو — ئەگەرنا هەمان هەڵە لە دروستکردندا دووبارە دەبێتەوە.
    setWhy(w => ({ ...w, [id]: r.ok ? '' : r.reason }));
    if (r.ok) {
      setOkModel(m => ({ ...m, [id]: r.model }));
      // مۆدێلی کارا دەبێتە هەڵبژاردەی بەکارهێنەر، ئەگەر ئەمە
      // دابینکەری دەقەکەیەتی — بۆیە دووبارە شکست نایەت
      if (id === keys.textProvider && r.model !== keys.textModel)
        onChange({ ...keys, textModel: r.model });
      onVerified?.(id);
    }
  }

  return (
    <div className="keys">
      {list.map(p => {
        const key = keys.keys[p.id] ?? '';
        const st = state[p.id];
        const expanded = only ? true : open === p.id;

        return (
          <div className={`kcard${expanded ? ' open' : ''}`} key={p.id}>
            {!only && (
              <button className="khead" onClick={() => setOpen(open === p.id ? null : p.id)}>
                <span className="knm">{p.name}</span>
                {key
                  ? <span className={`dot ${st === 'ok' ? 'ok' : st === 'bad' ? 'bad' : 'set'}`} />
                  : <span className="dot" />}
                <span className={`pill ${FREE_LABEL[p.free].cls}`}>{FREE_LABEL[p.free].text}</span>
                <span className="chev">{expanded ? '▾' : '▸'}</span>
              </button>
            )}

            {expanded && (
              <div className="kbody">
                <div className="caps">
                  {p.search && <span className="cap">گەڕانی ئینتەرنێت</span>}
                  {p.images && <span className="cap">دروستکردنی وێنە</span>}
                  {p.id === 'gemini' && <span className="cap hot">کوردی و عەرەبی</span>}
                </div>

                <div className="f">
                  <label>کلیلی API</label>
                  <input type="password" value={key} placeholder={p.placeholder}
                    onChange={e => setKey(p.id, e.target.value)} />
                </div>

                {key && !looksValid(p.id, key) && (
                  <div className="hint warn">
                    کلیلی {p.name} بەزۆری بە <b>{p.prefix}</b> دەست پێدەکات.
                    دڵنیابەرەوە کلیلی دروستت چەسپاندووە.
                  </div>
                )}

                {/* ═══ ناوی مۆدێل بە دەست ═══
                    کاتالۆگی مۆدێلەکان کۆن دەبێت — دابینکەرەکان
                    مۆدێل زیاد دەکەن و لادەبەن بەبێ ئاگادارکردنەوە.
                    بەبێ ئەم خانەیە، بەکارهێنەر چاوەڕوانی من دەکات
                    تا لیستەکە نوێ بکەمەوە. لەگەڵی، ناوەکە لە
                    ماڵپەڕی دابینکەرەکەوە کۆپی دەکات و کاردەکات. */}
                {(() => {
                  // ═══ لیستی زیندوو، ئەگەر هەبێت ═══
                  // کاتالۆگی چەسپاو کۆن دەبێت. لیستی زیندوو لە
                  // خودی دابینکەرەکەوە دێت، بۆیە هەمیشە ڕاستە.
                  const rows = live[p.id];
                  const shown = rows
                    ? (freeOnly ? rows.filter(m => m.free) : rows)
                    : [];
                  const opts = rows
                    ? shown.map(m => ({ id: m.id, name: m.free ? `${m.name} — بێبەرامبەر` : m.name }))
                    : p.models;

                  return (
                    <div className="f">
                      <label>مۆدێل — دەتوانیت ناوێکی تر بلکێنیت</label>
                      <input list={`ml-${p.id}`} dir="ltr" spellCheck={false}
                        value={p.id === keys.textProvider ? keys.textModel : ''}
                        placeholder={p.models[0].id}
                        onChange={e => onChange({
                          ...keys, textProvider: p.id, textModel: e.target.value,
                        })} />
                      <datalist id={`ml-${p.id}`}>
                        {opts.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </datalist>

                      {hasLiveList(p.id) && (
                        <div className="krow" style={{ marginTop: 7 }}>
                          <button className="btn sm" disabled={listing === p.id
                              || (listNeedsKey(p.id) && !key)}
                            onClick={() => loadModels(p.id)}>
                            {listing === p.id && <span className="spin dark" />}
                            {rows ? 'نوێکردنەوەی لیست' : 'هێنانی هەموو مۆدێلەکان'}
                          </button>
                          {rows && (
                            <label className="n" style={{ display: 'flex', gap: 5,
                                                          alignItems: 'center', cursor: 'pointer' }}>
                              <input type="checkbox" checked={freeOnly}
                                onChange={e => setFreeOnly(e.target.checked)} />
                              تەنها بێبەرامبەرەکان
                            </label>
                          )}
                          {rows && (
                            <span className="n">{shown.length} لە {rows.length}</span>
                          )}
                        </div>
                      )}
                      {listErr[p.id] && <div className="hint warn">{listErr[p.id]}</div>}
                      {hasLiveList(p.id) && listNeedsKey(p.id) && !key && (
                        <span className="n">بۆ لیستی مۆدێلەکان، سەرەتا کلیلەکە دابنێ.</span>
                      )}
                    </div>
                  );
                })()}

                <div className="krow">
                  <button className="btn sm" onClick={() => check(p.id)}
                    disabled={!key || st === 'testing'}>
                    {st === 'testing' && <span className="spin dark" />} تاقیکردنەوە
                  </button>
                  {st === 'ok'  && <span className="pill ok">✓ کاردەکات</span>}
                  {st === 'bad' && <span className="pill err">✕ کار ناکات</span>}
                  {st === 'ok' && okModel[p.id] && (
                    <span className="n" dir="ltr">{okModel[p.id]}</span>
                  )}
                </div>

                {st === 'bad' && why[p.id] && <div className="hint err">{why[p.id]}</div>}

                <HowToGetKey provider={p} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** هەڵبژاردنی دابینکەر و مۆدێل — تەنها بۆ ئینگلیزی */
export function ProviderPicker({ keys, onChange }: { keys: Keys; onChange: (k: Keys) => void }) {
  const p = providerById(keys.textProvider);
  const custom = !p.models.some(m => m.id === keys.textModel);

  return (
    <>
      <div className="frow">
        <div className="f">
          <label>دابینکەر</label>
          <select value={keys.textProvider} onChange={e => {
            const id = e.target.value as ProviderId;
            onChange({ ...keys, textProvider: id, textModel: providerById(id).models[0].id });
          }}>
            {PROVIDERS.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div className="f">
          <label>مۆدێل</label>
          <select value={custom ? '__custom' : keys.textModel} onChange={e => {
            const v = e.target.value;
            onChange({ ...keys, textModel: v === '__custom' ? '' : v });
          }}>
            {p.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            <option value="__custom">دیکە… (ناوی خۆت بنووسە)</option>
          </select>
        </div>
      </div>

      {custom && (
        <div className="f">
          <label>ناوی مۆدێل</label>
          <input value={keys.textModel} placeholder={p.models[0].id}
            onChange={e => onChange({ ...keys, textModel: e.target.value })} />
        </div>
      )}

      {!p.search && (
        <div className="hint warn">
          <b>{p.name}</b> گەڕانی ئینتەرنێتی ناوەوەی نییە.
          بۆ ناوەڕۆکی بەپێی سەرچاوەی ئەکادیمی، <b>Gemini</b> هەڵبژێرە.
        </div>
      )}
    </>
  );
}
