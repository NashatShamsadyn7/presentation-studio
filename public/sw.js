// ═══════════ کارکەری خزمەتگوزاری ═══════════
//
// مەبەست: خوێندکار لە هۆڵی زانکۆدا — کە ئینتەرنێت لاواز یان نییە —
// بتوانێت دێککەکەی بکاتەوە، دەستکاری بکات، و بیکاتە .pptx.
//
// چی کاردەکات بەبێ ئینتەرنێت:
//   • کردنەوەی ئەپەکە و هەموو ڕووکارەکەی
//   • دەستکاری دەق، تەختەبەند، پاشبنەما، شێواز
//   • دۆخی پێشکەشکار
//   • هەناردەکردنی .pptx و .pdf و .bib
//   (دێککەکان لە IndexedDB دان — ئەوانیش بەبێ ئینتەرنێت کاردەکەن)
//
// چی ناکات:
//   • دروستکردنی ناوەڕۆکی نوێ بە AI
//   • گەڕان بۆ بابەتی زانستی یان وێنە
//   ئەوانە داواکاری دەرەکین و ئینتەرنێتیان دەوێت. هیچ کات ناخرێنە
//   کاش — وەڵامێکی کۆنی API خراپترە لە هەڵەیەکی ڕوون.

const VERSION = 'ps-v2';
const SHELL = `${VERSION}-shell`;

/** ئەو شتانەی دەبێت لە دەستپێکەوە ئامادە بن */
const CORE = ['./', './manifest.webmanifest', './icon.svg'];

/**
 * کاش هەمیشە بەردەست نییە.
 *
 * لە هەندێک دۆخدا (گەڕانی نهێنی، خەزنکردن کوژێنراوەتەوە، ڕێژەی
 * پڕ) `caches.open` هەڵە دەداتەوە. ئەگەر ئەو هەڵەیە بگاتە
 * `respondWith`، **هەموو داواکارییەکە دەشکێت** — واتە هیچ
 * JS ـێک بار نابێت و ئەپەکە بە تەواوی سپی دەردەکەوێت.
 *
 * ئەمە بە ڕاستی ڕوویدا: لە وێبگەڕێکی بێ کاشدا لاپەڕەکە بەتاڵ
 * بوو، بەبێ هیچ هەڵەیەکی بەدیار. بۆیە هەموو دەستگەیشتنێکی کاش
 * لێرەدا دەگیرێت و بە `null` دەگەڕێتەوە — دواتر تۆڕ بەکاردێت.
 */
const safeOpen = () => caches.open(SHELL).catch(() => null);
const safeMatch = (req, opt) => caches.match(req, opt).catch(() => null);

self.addEventListener('install', e => {
  e.waitUntil(
    safeOpen()
      // هەر یەکێک بە جیا — ئەگەر یەکێکیان نەبوو، هەموو کارەکە ناشکێت
      .then(c => c ? Promise.allSettled(CORE.map(u => c.add(u))) : null)
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

/** ئایا ئەم داواکارییە بۆ سێرڤەرێکی دەرەکییە؟ */
function isExternal(url) {
  return url.origin !== self.location.origin;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ─── داواکاری API ───
  // هەرگیز کاش ناکرێن. کلیلی بەکارهێنەر و وەڵامی مۆدێل نابێت لەسەر
  // ئامێرەکە بمێننەوە، و وەڵامێکی کۆن لە هەڵەیەک خراپترە.
  if (isExternal(url)) return;

  // ─── لاپەڕەکە خۆی ───
  // «تۆڕ پێش هەموو شت»: ئەگەر ئینتەرنێت هەبوو، وەشانی نوێ؛ ئەگەرنا،
  // ئەوەی کاش کراوە. بەبێ ئەمە بەکارهێنەر وەشانێکی کۆن دەبینێت
  // تەنانەت کاتێک ئینتەرنێتی هەیە.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          safeOpen().then(c => c && c.put('./', copy)).catch(() => {});
          return res;
        })
        .catch(() => safeMatch('./', { ignoreSearch: true })
          .then(r => r ?? new Response(
            '<!doctype html><meta charset="utf-8">' +
            '<body style="font-family:sans-serif;direction:rtl;text-align:center;padding:40px">' +
            '<h2>ئەپەکە هێشتا بۆ دۆخی بێ ئینتەرنێت ئامادە نەکراوە</h2>' +
            '<p>جارێک بە ئینتەرنێتەوە بیکەرەوە، دواتر بەبێ ئینتەرنێتیش کاردەکات.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))),
    );
    return;
  }

  // ─── سەرچاوەکانی ئەپەکە (JS، CSS، فۆنت، وێنە) ───
  // «کاش پێش هەموو شت»: ناوی فایلەکان hash ـیان تێدایە، بۆیە
  // ناوەڕۆکیان هەرگیز ناگۆڕێت. کاشکردنیان بێمەترسییە و خێراترە.
  //
  // ئاگاداری: هەر بەڵێنێکی ڕەتکراوە لێرەدا داواکارییەکە دەکوژێت.
  // بۆیە `safeMatch` بەکاردێت، و لە کۆتاییدا `catch` هەیە کە
  // ڕاستەوخۆ دەچێتەوە سەر تۆڕ. کاش هەرگیز نابێتە هۆی شکستی
  // بارکردنی سەرچاوەیەک.
  e.respondWith(
    safeMatch(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          safeOpen().then(c => c && c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    }).catch(() => fetch(req)),
  );
});
