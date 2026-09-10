// پشکنینی ئامرازە بێبەرامبەرەکان — بە داتای ڕاستەقینە.
//   npx tsx scripts/check-tools.ts

import { readFileSync } from 'node:fs';
import { fetchWithTimeout, retryAfterMs, TimeoutError } from '../src/lib/net';
import { join } from 'node:path';
import { searchPapers, crossref, openalex, openLibrary, toApa, toCite }
  from '../src/lib/tools/academic';
import { CITE_STYLES } from '../src/lib/citestyle';
import { searchImages, worldBank, INDICATORS, ENGINES } from '../src/lib/tools/data';
import { findReferences } from '../src/lib/research';
import { isStructured, toBibtex } from '../src/lib/cite';

let pass = 0, fail = 0;
const check = (ok: boolean, label: string, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  →  ' + extra : ''}`);
  ok ? pass++ : fail++;
};

async function main() {
  console.log('\n─── گەڕانی زانستی ───');
  const papers = await searchPapers('internet of things security', 6);
  check(papers.length >= 3, 'بابەتی زانستی گەڕێندرایەوە', `${papers.length} دانە`);
  check(papers.every(p => p.title.length > 5), 'هەموویان ناونیشانیان هەیە');
  check(papers.some(p => p.doi), 'لانیکەم یەکێکیان DOI ی هەیە');
  check(papers.some(p => p.year && p.year > 1990 && p.year <= new Date().getFullYear() + 1),
        'ساڵەکان ڕاستیانە');
  check(papers.some(p => p.authors.length > 0), 'ناوی نووسەران هەیە');
  check(new Set(papers.map(p => p.title)).size === papers.length, 'دووبارە نییە');
  check(!papers.some(p => (p.url ?? '').includes('wikipedia')), 'ویکیپیدیا نییە');

  console.log(`\n  نموونە: ${papers[0].title.slice(0, 70)}`);
  console.log(`           ${papers[0].venue || '—'} · ${papers[0].year} · ${papers[0].citations ?? 0} ئاماژە`);

  console.log('\n─── پەیوەندی ئەنجامەکان ───');
  // پێشتر تەنها بە ژمارەی ئاماژەپێکردن ڕیزدەکران، بۆیە بابەتی ناوداری
  // بێپەیوەند دەچووە سەرەوە. ئەم پشکنینە ڕێگری لە گەڕانەوەی ئەوە دەکات.
  const Q = 'cybersecurity risk management in small and medium enterprises';
  const rel = await searchPapers(Q, 5);
  const words = Q.split(' ').filter(w => w.length > 4);
  const onTopic = rel.filter(p =>
    words.filter(w => p.title.toLowerCase().includes(w)).length >= 2);
  check(rel.length >= 3, 'ئەنجام هەیە', `${rel.length}`);
  check(onTopic.length === rel.length, 'هەموو ئەنجامەکان پەیوەندیدارن',
        `${onTopic.length}/${rel.length}`);
  check(!rel.some(p => /&(amp|lt|gt|quot|#\d+);/.test(p.title)),
        'ناونیشانەکان HTML ـیان تێدا نییە');
  check(!rel.some(p => p.authors.some(a => a.split(/\s+/).length > 6)),
        'ناوی دامەزراوە لە خانەی نووسەردا نییە');

  console.log('\n─── سەرچاوەکانی لاپەڕەی کۆتایی ───');
  // ئەم ڕێڕەوە پێشتر هەمیشە [] دەگەڕاندەوە — لە مۆدێلەوە دەهات و
  // بەبێ سکێما بوو. ئێستا ڕاستەوخۆ لە داتابەیسەکانەوە دێت.
  const refs = await findReferences({
    provider: 'gemini', model: '', key: '', count: 5,
    topic: 'machine learning for early detection of diabetic retinopathy',
  });
  check(refs.length > 0, 'لاپەڕەی سەرچاوەکان بەتاڵ نییە', `${refs.length}`);
  check(refs.every(r => isStructured(r)), 'خانە پێکهاتەییەکان هەن (BibTeX دەکرێت)');
  check(refs.some(r => r.doi), 'DOI ی ڕاستەقینەیان هەیە');
  check(toBibtex(refs).skipped === 0, 'هیچ سەرچاوەیەک لە .bib دەرناکرێت');
  console.log(`  ${refs[0]?.text.slice(0, 110)}`);

  console.log('\n─── کتێبەکان ───');
  // ڕێڕەوێکی سەربەخۆیە: Crossref تەنها کتێبی DOI ـدار دەناسێت،
  // بۆیە Open Library کەلێنەکە پڕ دەکاتەوە.
  const books = await searchPapers('cryptography theory and practice', 5, 'book');
  check(books.length >= 3, 'کتێب دۆزرایەوە', `${books.length}`);
  check(books.every(b => b.kind === 'book'), 'هەموویان وەک کتێب نیشان کراون');
  check(books.some(b => b.publisher), 'بڵاوکەرەوەیان هەیە');
  check(books.some(b => b.year && b.year > 1950), 'ساڵیان هەیە');
  check(!books.some(b => /^(brand|publisher)\s*:/i.test(b.publisher ?? '')),
        'ناوی بڵاوکەرەوە پاککراوەتەوە');
  console.log(`  نموونە: ${books[0]?.title.slice(0, 56)} · ${books[0]?.publisher || '—'}`);

  const ol = await openLibrary('introduction to algorithms', 3);
  check(ol.length > 0, 'Open Library کاردەکات', `${ol.length}`);
  check(ol.every(b => b.kind === 'book'), 'Open Library کتێب دەداتەوە');

  // شێوازەکان لەسەر داتای ڕاستەقینە — نەک تەنها نموونە
  const real = books.find(b => b.authors.length && b.year);
  if (real) {
    const six = CITE_STYLES.map(s => toCite(real, s.id));
    // ئاگاداری: بۆ کتێبێکی سادە (یەک نووسەر، بێ چاپ) MLA و Chicago
    // بەڕاستی وەک یەکن — جیاوازییەکەیان لار-نووسینی ناونیشانەکەیە،
    // کە لە دەقی ساکاردا دەرناکەوێت. ئەمە هەڵە نییە.
    check(new Set(six).size >= 5, 'شێوازەکان لەسەر کتێبێکی ڕاستەقینە جیاوازن',
          `${new Set(six).size}/6`);
    check(six.every(t => t.includes(String(real.year))), 'ساڵەکە لە هەموویاندا');
    check(six.every(t => !/\.\.|\(\)/.test(t)), 'هیچیان خانەی بەتاڵیان نییە');
    console.log(`  IEEE: ${toCite(real, 'ieee').slice(0, 96)}`);
    console.log(`  APA : ${toCite(real, 'apa').slice(0, 96)}`);
  }

  console.log('\n─── بەرگ و لاپەڕە ───');
  // بەبێ ئەمانە IEEE و Vancouver و MLA ناتەواون
  const withBiblio = await searchPapers('internet of things security survey', 6);
  check(withBiblio.some(p => p.volume), 'ژمارەی بەرگ هێنراوە');
  check(withBiblio.some(p => p.pages), 'ژمارەی لاپەڕە هێنراوە');
  const vp = withBiblio.find(p => p.volume && p.pages);
  if (vp) {
    check(toCite(vp, 'ieee').includes(`vol. ${vp.volume}`), 'IEEE بەرگەکە دەنووسێت');
    check(toCite(vp, 'vancouver').includes(`;${vp.volume}`), 'Vancouver بەرگەکە دەنووسێت');
    // لەسەر توێژینەوەیەکی تەواو هەر شەشەکە دەبێت جیاواز بن
    const six = CITE_STYLES.map(s => toCite(vp, s.id));
    check(new Set(six).size === 6, 'شەش شێوازی جیاواز لەسەر توێژینەوەیەکی ڕاستەقینە',
          `${new Set(six).size}/6`);
  }

  console.log('\n─── شێوازی APA ───');
  const apa = toApa(papers[0]);
  check(apa.length > 25, 'ژێدەرەکە دروست بوو');
  check(/\(\d{4}\)|n\.d\./.test(apa), 'ساڵ لە کەوانەدایە');
  console.log(`  ${apa.slice(0, 110)}`);

  console.log('\n─── سەرچاوە جیاکانەکان ───');
  const [cr, oa] = await Promise.all([
    crossref('machine learning', 3),
    openalex('machine learning', 3),
  ]);
  check(cr.length > 0, 'Crossref کاردەکات', `${cr.length}`);
  check(oa.length > 0, 'OpenAlex کاردەکات', `${oa.length}`);
  check(oa.some(p => p.abstract), 'OpenAlex پوختەی هەیە');

  console.log('\n─── وێنەی بێبەرامبەر ───');
  // Openverse سنووری داواکاری هەیە بۆ هەر IP ـێک. ئەگەر ٤٢٩ بێت،
  // ئەوە دۆخی ژینگەیە نەک شکستی کۆد — بۆیە تێپەڕی لێدەکرێت لەبری
  // ئەوەی هەموو سویتەکە سوور بکات. هەر هەڵەیەکی تر دەردەچێت.
  let imgs: Awaited<ReturnType<typeof searchImages>> = [];
  let rateLimited = false;
  try {
    imgs = await searchImages('technology laboratory', 5);
  } catch (e) {
    if (!/\b429\b/.test((e as Error).message)) throw e;
    rateLimited = true;
    console.log('  SKIP  Openverse سنووری داواکاری — دواتر هەوڵ بدەرەوە');
  }

  if (!rateLimited) {
  check(imgs.length > 0, 'وێنە دۆزرایەوە', `${imgs.length}`);
  check(imgs.every(i => i.url.startsWith('http')), 'بەستەرەکان دروستن');
  check(imgs.every(i => i.license), 'مۆڵەتی هەموویان دیارە');

  // ئێمە وێنەکان دەبڕین (`sizing: cover` لە PPTX)، بۆیە ND ڕێگەپێدراو
  // نییە. ئەمە پشکنینێکی یاسایییە، نەک جوانکاری.
  check(imgs.every(i => !/\bND\b/i.test(i.license)), 'هیچ مۆڵەتێکی ND نییە',
    imgs.map(i => i.license.split(' ')[0]).join(', '));
  check(imgs.every(i => !/\.svg(\?|$)/i.test(i.url)), 'هیچ SVG ـێک نییە');

  // وێنەی بچووک لە سلایددا تەم دەردەکەوێت. پێش پاڵاوتنی `size=large`
  // پانی ناوەند ١٠٢٤px بوو.
  const widths = imgs.map(i => i.width).sort((a, b) => a - b);
  check(widths[Math.floor(widths.length / 2)] >= 1600, 'پانی ناوەند گەورەیە',
    `${widths[Math.floor(widths.length / 2)]}px`);

  console.log(`  نموونە: ${imgs[0].title.slice(0, 50)} · ${imgs[0].license} · ` +
    `${imgs[0].width}×${imgs[0].height} · ${imgs[0].provider}`);
  }

  console.log('\n─── ئاماری ڕاستەقینە ───');
  const stat = await worldBank('IRQ', 'IT.NET.USER.ZS', 2012, 2022);
  check(stat.values.length >= 5, 'ساڵی پێویست هەیە', `${stat.values.length} خاڵ`);
  check(stat.labels.length === stat.values.length, 'ساڵ و بەها یەک ژمارەن');
  check(stat.values.every(v => typeof v === 'number' && isFinite(v)), 'هەموو بەهاکان ژمارەن');
  check(Number(stat.labels[0]) < Number(stat.labels[stat.labels.length - 1]), 'ڕیزبەندی ساڵ دروستە');
  check(stat.country.toLowerCase().includes('iraq'), 'ناوی وڵات دروستە', stat.country);
  console.log(`  ${stat.indicator}`);
  console.log(`  ${stat.labels[0]}: ${stat.values[0]}  →  ${stat.labels.at(-1)}: ${stat.values.at(-1)}`);

  console.log('\n─── ڕێکخستن ───');
  check(INDICATORS.length >= 10, 'پێوەرەکان بەردەستن', `${INDICATORS.length}`);
  check(INDICATORS.every(i => /^[A-Z]{2}\./.test(i.code)), 'کۆدەکان شێوازیان دروستە');
  check(ENGINES.length === 3, 'سێ مەکینەی گەڕان');
  check(ENGINES.every(e => e.keyUrl.startsWith('https://')), 'بەستەری کلیلەکان دروستن');

  console.log('\n─── ئامرازەکانی ئەیجێنت ───');
  const src = readFileSync(join(process.cwd(), 'src/lib/agent.ts'), 'utf8');
  // \s+ لەبری \n — بۆیە شێوازی دێڕی CRLF یان LF گرنگ نییە
  const declared = [...src.matchAll(/name: '(\w+)',\s+description:/g)].map(m => m[1]);
  const handled = [...src.matchAll(/case '(\w+)':/g)].map(m => m[1]);
  console.log(`  ${declared.length} ئامراز`);
  for (const t of declared) check(handled.includes(t), 'جێبەجێکراوە', t);
  check(declared.includes('find_papers'), 'گەڕانی زانستی هەیە');
  check(declared.includes('get_statistics'), 'ئاماری ڕاستەقینە هەیە');
  check(declared.includes('find_image'), 'وێنەی بێبەرامبەر هەیە');
  check(src.includes('lastPapers.filter'), 'سەرچاوە تەنها لە گەڕانی ڕاستەقینەوە دێت');

  // تێبینی: پشکنینی کاتی سنووردار و دووبارەهەوڵدانەوە لە check-core.ts دان.
  // پێشتر لێرە بوون و بە httpbin.org دەیانپشکنی — بەڵام ئەو سێرڤەرە
  // جارجار ٥٠٣ دەداتەوە، و ئەوە دەبووە شکستێکی درۆیین لە کۆدی ئێمەدا.
  // ئێستا سێرڤەرێکی ناوخۆیی بەکاردێت: هەمان کۆد، ئەنجامی دڵنیا.

  console.log(`\n${pass} pass / ${fail} fail\n`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('\nهەڵە:', e.message); process.exit(1); });
