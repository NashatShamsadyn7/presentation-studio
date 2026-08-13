'use client';

// ═══════════ تۆمارکردنی کارکەری خزمەتگوزاری ═══════════
//
// دوو کار دەکات:
//   ١) `sw.js` تۆمار دەکات، بۆیە ئەپەکە بەبێ ئینتەرنێت دەکرێتەوە.
//   ٢) کاتێک ئینتەرنێت دەپچڕێت، نیشانەیەکی بچووک پیشان دەدات — تا
//      بەکارهێنەر بزانێت بۆچی دوگمەی «دروستکردن بە AI» کار ناکات.
//
// تۆمارکردنەکە تەنها لە دۆخی بەرهەمهێناندا ڕوودەدات: لە `next dev` دا
// کارکەرێکی خزمەتگوزاری فایلە کۆنەکان دەگرێت و گۆڕانکارییەکان نابیندرێن.

import { useEffect, useState } from 'react';

export default function Offline() {
  const [off, setOff] = useState(false);

  useEffect(() => {
    setOff(!navigator.onLine);
    const on = () => setOff(false);
    const down = () => setOff(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', down);

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // تۆمارنەکردن کێشەیەکی گەورە نییە — ئەپەکە بە ئینتەرنێت کاردەکات
      });
    }

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (!off) return null;

  return (
    <div className="offline" role="status">
      <b>بێ ئینتەرنێت</b>
      دەستکاری و هەناردەکردن کاردەکەن. دروستکردن بە AI و گەڕان ناتوانرێت.
    </div>
  );
}
