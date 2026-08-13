'use client';

// ═══════════ یاریدەدەری ڕۆبۆت ═══════════
//
// ڕۆبۆتەکە لە گۆشەی خوارەوەی دەستەڕاستدا دەوەستێت (ڕووکار RTL ـە،
// بۆیە ئەوە لای «سەرەتا» ی چاوە) و کاتێک شتێکی سوودبەخشی هەیە
// بابڵێک دەردەکەوێت.
//
// بڕوانە `lib/mascot.ts` بۆ ئەوەی کەی چی دەڵێت.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  tipFor, poseSrc, seen, markSeen, isOff, setOff, POSES,
  type AppState, type Pose,
} from '@/lib/mascot';

/** پۆزەکان پێشوەخت بار دەکرێن — بەبێ ئەوە گۆڕینی پۆز تروسکەیەکی هەیە */
function usePreload() {
  useEffect(() => {
    const imgs = POSES.map(p => {
      const i = new Image();
      i.src = poseSrc(p);
      return i;
    });
    return () => imgs.forEach(i => { i.src = ''; });
  }, []);
}

/** دۆخی ئینتەرنێت — لێرەدا دەپێوردرێت، نەک لە هەر شوێنێکەوە
 *  بنێردرێت. وا هەردوو ویزارد و ستودیۆ بەبێ دووبارەکردنەوە
 *  هەمان ڕەفتاریان دەبێت. */
function useOffline(): boolean {
  const [off, setOff_] = useState(false);
  useEffect(() => {
    const set = () => setOff_(!navigator.onLine);
    set();
    addEventListener('online', set); addEventListener('offline', set);
    return () => { removeEventListener('online', set); removeEventListener('offline', set); };
  }, []);
  return off;
}

export default function Mascot({ state }: { state: AppState }) {
  const [off, setOffState] = useState(false);
  const [open, setOpen] = useState(true);
  const [pose, setPose] = useState<Pose>('idle');
  const shown = useRef<string | null>(null);
  const offline = useOffline();

  usePreload();
  useEffect(() => { setOffState(isOff()); }, []);

  const tip = useMemo(
    () => tipFor({ ...state, offline: state.offline || offline }),
    [state, offline]);

  /**
   * ئایا ئەم ئامۆژگارییە پیشان بدرێت؟
   *
   * ئامۆژگاری ئاسایی تەنها یەک جار — دوای ئەوە بەکارهێنەر
   * دەیزانێت. ئەوانەی `sticky` ـن (هەڵە، بێ ئینتەرنێتی، خەریکی
   * کارە) هەموو جارێک، چونکە ئەوانە دۆخن نەک فێرکاری.
   */
  const visible = !!tip && !off && open && (tip.sticky || !seen(tip.id));

  useEffect(() => {
    if (!tip) return;
    if (tip.id !== shown.current) {
      shown.current = tip.id;
      setOpen(true);
      setPose(tip.pose);
      if (!tip.sticky) markSeen(tip.id);
    }
  }, [tip]);

  // پۆزی بنەڕەت کاتێک هیچ ئامۆژگارییەک نییە
  const current: Pose = visible ? pose : offline ? 'sleep' : 'idle';

  if (off) return null;

  return (
    <div className="mascot" data-open={visible ? '1' : '0'}>
      {visible && tip && (
        <div className="mtip" role="status">
          <p>{tip.text}</p>
          <div className="mact">
            <button className="mx" onClick={() => setOpen(false)}>باشە</button>
            <button className="mx off" title="یاریدەدەر بکوژێنەوە"
              onClick={() => { setOff(true); setOffState(true); }}>
              نەیخەرەوە
            </button>
          </div>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mbot" src={poseSrc(current)} alt=""
           width={150} height={150} draggable={false}
           onClick={() => setOpen(o => !o)} />
    </div>
  );
}
