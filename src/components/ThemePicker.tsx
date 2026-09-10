'use client';

// ═══════════ هەڵبژاردنی ڕوخسار ═══════════
//
// دوو شت جیاوازن:
//   • شێواز   — پێکهاتە: کارت، ناونیشان، نیشانەی خاڵ، ڕیزبەندی ناوەڕۆک
//   • پاشبنەما — تەنها ڕەنگ
//
// هەر کارتێک سلایدێکی ڕاستەقینەیە، بە SlideView ـی هەمان ئەپ نەخشێنراوە
// و بچووک کراوەتەوە. واتە ئەوەی دەیبینیت هەر ئەوەیە دەیدەستکەویت —
// نەک چەند خاڵێکی ڕەنگین کە هاناکەن.
//
// ─── بەڵام ئەوە بەخۆڕایی نییە ───
// ٦ شێواز + ٢٤ پاشبنەما = ٣٠ سلایدی زیندوو، هەریەکەیان دەیان توخمی
// DOM لە بۆشایی ١٩٢٠×١٠٨٠ دا. ئەگەر هەموویان پێکەوە وێنە بکرێن،
// گۆڕینی یەک هەڵبژاردە ڕووکارەکە دەبەستێتەوە. دوو چارەسەر:
//
//   ١) `deck` ـەکان بە `useMemo` جێگیر دەکرێن، بۆیە `memo(SlideView)`
//      کاردەکات — تەنها ئەو کارتانە لەنوێ وێنە دەکرێنەوە کە گۆڕاون.
//   ٢) کارتەکان تەنها کاتێک وێنە دەکرێن کە بێنە ناو دیمەنەوە
//      (IntersectionObserver). پێش ئەوە شوێنێکی بەتاڵن.

import { useEffect, useMemo, useRef, useState } from 'react';
import SlideView from './SlideView';
import { THEMES } from '@/lib/themes';
import { STYLES, type StyleId } from '@/lib/styles';
import { newSlide, type Deck, type Slide } from '@/lib/types';

/** «ناوەڕۆک» — چونکە هەر شێوازێک ڕیزبەندییەکی جیاوازی هەیە بۆی */
function outlineSample(lang: Deck['lang']) {
  const s = newSlide('L_outline', lang === 'en' ? 'Contents' : 'ناوەڕۆک');
  s.bullets = lang === 'en'
    ? ['Introduction', 'Background', 'Method', 'Results']
    : ['پێشەکی', 'پاشبنەما', 'ڕێباز', 'ئەنجام'];
  return s;
}

/**
 * پێشبینینی زیندوو کە **لەگەڵ پانی خۆیدا دەگونجێت**.
 *
 * ═══ ئەم باگە لە وێنەی بەکارهێنەرەوە هات ═══
 * پێشتر `LazyShot` بەکاردەهات، کە پانی و بەرزی بە پیکسڵێکی چەسپاو
 * (٣٠٦px) دادەنا. بەڵام `.th-shot{width:100%}` پانییەکەی دەگۆڕی و
 * بەرزییەکەی نەدەگۆڕی — واتە لە پانێڵێکی ٧٠٠px دا، چوارگۆشەیەکی
 * ٧٠٠×١٧٢ دروست دەبوو کە سلایدێکی ٣٠٦px ی تێدابوو.
 *
 * ئەنجام: **بۆشاییەکی گەورەی بەتاڵ لەتەنیشت سلایدەکەوە** — هەر
 * ئەو بۆشاییەی لە وێنەکەدا دیارە.
 *
 * ئێستا پانییەکە دەپێوردرێت و هەردوو بەرزی و ڕێژەی وردبینی
 * لەسەری دادەنرێن، بۆیە سلایدەکە هەمیشە شوێنەکەی پڕ دەکاتەوە.
 *
 * `LazyShot` سڕایەوە: بۆ ٣٠ کارت دروستکرابوو. بۆ یەک پێشبینین
 * تەنها ڕێگایەکی زیادەی شکستی هەبوو — ئەگەر `IntersectionObserver`
 * هەڵنەگیرسێت، چوارگۆشەکە بۆ هەمیشە بەتاڵ دەمێنێتەوە.
 */
function Preview({ deck, slide }: { deck: Deck; slide: Slide }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    // وێبگەڕی کۆن یان ڕەندەری سێرڤەر — پانییە یەکەمەکە بەسە
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="th-one" ref={ref}
         style={{ height: w ? Math.round(w * 1080 / 1920) : undefined }}>
      {w > 0 && <SlideView deck={deck} slide={slide} scale={w / 1920} />}
    </div>
  );
}

export default function ThemePicker({ value, style, lang, fontFamily, onPick, onPickStyle }: {
  value: string;
  style: StyleId;
  lang: Deck['lang'];
  fontFamily: string;
  onPick: (id: string) => void;
  onPickStyle: (id: StyleId) => void;
}) {
  // سلایدە نموونەکان یەکجار دروست دەکرێن — نەک بۆ هەر ٣٠ کارتێک
  const base = useMemo(() => ({
    outline: outlineSample(lang),
  }), [lang]);

  /**
   * دێککەکان جێگیر دەکرێن، بۆیە `memo(SlideView)` کاری هەیە.
   * ئەگەر لێرەدا `deckOf()` لە هەر ڕەندەرێکدا بانگ بکرێت، هەموو
   * کارتەکان ئۆبجێکتێکی نوێ وەردەگرن و `memo` بەبێ کەڵک دەبێت.
   */
  const mk = (theme: string, st: StyleId, slide: Slide): Deck => ({
    id: 'preview', createdAt: 0, updatedAt: 0,
    lang, theme, style: st, density: 'normal', fontFamily,
    titleInfo: { university: '', institute: '', department: '', title: '',
                 year: '', teacherPrefix: '', teacherName: '', students: [] },
    slides: [slide], buildMode: false, transitionMs: 0,
  });

  // ═══ یەک دێکک، نەک ٣٠ ═══
  // پێشتر بۆ هەر شێوازێک و هەر پاشبنەمایەک دێککێک دروست دەکرا تا
  // کارتێکی زیندووی پێ ڕەندەر بکرێت. ئێستا تەنها ئەوەی هەڵبژێردراوە
  // پیشان دەدرێت، بۆیە یەک دێکک بەسە.
  const preview = useMemo(
    () => mk(value, style, base.outline),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, style, base.outline, lang, fontFamily],
  );

  return (
    <>
      {/* ═══ لیستی داکشێن، نەک گەلەری کارت ═══
          پێشتر ٦ شێواز + ٢٤ پاشبنەما = ٣٠ سلایدی زیندوو دەردەکەوتن،
          هەریەکەیان دەیان توخمی DOM. ئەوە شوێنێکی زۆری دەگرت، لەسەر
          مۆبایل نەدەخوێندرایەوە، و بۆ هەڵبژاردنێکی ساکار زۆر بوو.

          ئێستا دوو لیستی داکشێن + **یەک** پێشبینینی زیندوو کە
          ئەوەی هەڵبژێردراوە پیشان دەدات. هەمان زانیاری، ٣٠ ئەوەندە
          کەمتر ڕەندەر. */}
      <div className="grp">شێوازی دیزاین</div>
      <label className="selrow">
        <select value={style} onChange={e => onPickStyle(e.target.value as StyleId)}>
          {STYLES.map(x => (
            <option key={x.id} value={x.id}>{x.name} — {x.desc}</option>
          ))}
        </select>
      </label>

      <div className="grp">پاشبنەما</div>
      <label className="selrow">
        <select value={value} onChange={e => onPick(e.target.value)}>
          <optgroup label="ڕووناک">
            {THEMES.filter(t => !t.dark).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
          <optgroup label="تاریک">
            {THEMES.filter(t => t.dark).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
        </select>
      </label>

      {/* پێشبینینی زیندوو — هەر ئەوەی دەیدەستکەویت، نەک وێنەیەکی نموونە */}
      <div className="grp">پێشبینین</div>
      <Preview deck={preview} slide={base.outline} />
    </>
  );
}
