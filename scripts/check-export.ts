// پشکنینی هەناردەکردن: فایلێکی PPTX دروست دەکات و ناوەوەی دەپشکنێت.
//   npx tsx scripts/check-export.ts

import JSZip from 'jszip';
import { exportPptx, primaryFont } from '../src/lib/export/pptx';
import { countTransitions } from '../src/lib/export/morph';
import { decoFor } from '../src/lib/deco';
import { STYLES, type StyleId } from '../src/lib/styles';

const DECO_N = decoFor(0).length;
import { buildDeck } from '../src/lib/generate';
import { newSlide, type Deck } from '../src/lib/types';

let pass = 0, fail = 0;
const check = (ok: boolean, label: string, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  →  ' + extra : ''}`);
  ok ? pass++ : fail++;
};

function makeDeck(): Deck {
  const bullets = newSlide('L_bullets', 'Key Features');
  bullets.bullets = ['High Security: the key text is long.', 'Ease of Use: any paragraph works.'];

  const chart = newSlide('L_bar', 'Security Comparison');
  chart.chart = { kind: 'bar', labels: ['Caesar', 'Vigenère', 'Running Key'],
                  values: [30, 42, 70], caption: 'illustrative', source: 'ai' };

  const table = newSlide('L_compare', 'Cipher Comparison');
  table.table = { head: ['Property', 'Caesar', 'OTP'], rows: [['Non-repeating key', 'no', 'yes']] };

  // ١×١ px PNG — بەس بۆ ئەوەی addImage شتێکی دروستی هەبێت
  bullets.imageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  bullets.imageCredit = 'Photo by A. Author (CC BY 2.0)';
  bullets.notes = 'ئەمە تێبینی قسەکەرە.';

  const kurdish = newSlide('L_text', 'پێشەکی');
  kurdish.bullets = ['کورتەیەک دەربارەی بابەتەکە'];
  kurdish.body = 'ئەمە دەقێکی کوردی سۆرانییە بۆ تاقیکردنەوەی ئاراستەی ڕاست بۆ چەپ.';

  const refs = newSlide('L_refs', 'References');
  refs.refs = [{ text: 'Stinson, D. R. (2018). Cryptography: Theory and Practice.', domain: 'crcpress.com' }];

  return buildDeck({
    lang: 'ckb',
    theme: 'academic-blue',
    fontFamily: "Georgia,'Times New Roman',serif",
    titleInfo: {
      university: 'Erbil Polytechnic University',
      institute: 'Technical College',
      department: 'AIRE',
      title: 'IoT',
      year: '2026-2027',
      teacherPrefix: 'Prof.',
      teacherName: 'Nashat Shamsadyn',
      students: ['Ali Masoud', 'ناشت شەمسەدین'],
    },
    slides: [bullets, chart, table, kurdish, refs],
  });
}

async function main() {
  console.log('\n─── ناوی فۆنت ───');
  check(primaryFont("Georgia,'Times New Roman',serif") === 'Georgia', 'زنجیرەی CSS → یەک ناو', primaryFont("Georgia,'Times New Roman',serif"));
  check(primaryFont("'Segoe UI',sans-serif") === 'Segoe UI', 'ناوی دوونووکدار پاک دەکرێتەوە');

  console.log('\n─── دروستکردنی فایل ───');
  const deck = makeDeck();
  const blob = await exportPptx(deck, { withMorph: true });
  const buf = Buffer.from(await blob.arrayBuffer());
  check(buf.length > 20000, 'قەبارەی فایل گونجاوە', `${Math.round(buf.length / 1024)} KB`);

  const zip = await JSZip.loadAsync(buf);
  const slidePaths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p));
  check(slidePaths.length === deck.slides.length + 1, 'ژمارەی سلایدەکان',
        `${slidePaths.length} بەرامبەر ${deck.slides.length + 1}`);

  const all = (await Promise.all(slidePaths.map(p => zip.file(p)!.async('string')))).join('');

  console.log('\n─── فۆنت و قەبارە ───');
  check(all.includes('typeface="Georgia"'), 'فۆنتی Georgia بەکارهاتووە');
  check(!all.includes('typeface="Georgia,'), 'زنجیرەی CSS نەچووەتە ناو فایلەکە');
  check(all.includes('sz="3100"'), 'ناونیشان ٦٢px = ٣١pt');
  check(all.includes('sz="2800"'), 'ناونیشانی سەرەتا ٥٦px = ٢٨pt');
  check(all.includes('sz="2200"'), 'ناوی زانکۆ ٤٤px = ٢٢pt');

  console.log('\n─── دەق دەستکاریکراوە (نەک وێنە) ───');
  check(all.includes('Erbil Polytechnic University'), 'ناوی زانکۆ وەک دەق');
  check(all.includes('Nashat Shamsadyn'), 'ناوی مامۆستا وەک دەق');
  check(all.includes('High Security'), 'خاڵەکان وەک دەق');
  check(all.includes('پێشەکی'), 'دەقی کوردی');
  check(/<a:tbl>/.test(all), 'خشتە وەک خشتەی ڕەسەن');
  check(Object.keys(zip.files).some(p => /^ppt\/charts\//.test(p)), 'چارت وەک چارتی ڕەسەن');

  console.log('\n─── ئاراستە ───');
  check(all.includes('rtl="1"'), 'دەقی کوردی RTL ـە');
  const titleXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  const prepared = titleXml.match(/<a:p>(?:(?!<\/a:p>)[\s\S])*?Prepared:[\s\S]*?<\/a:p>/);
  check(!!prepared && !/rtl="1"/.test(prepared[0]), '«Prepared:» بە LTR ماوەتەوە');

  console.log('\n─── تێبینی و مۆڵەت ───');
  const notePaths = Object.keys(zip.files).filter(p => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(p));
  check(notePaths.length > 0, 'تێبینی قسەکەر هەناردە کراوە', `${notePaths.length} پەڕە`);
  const noteXml = notePaths.length
    ? (await Promise.all(notePaths.map(p => zip.file(p)!.async('string')))).join('') : '';
  check(noteXml.includes('ئەمە تێبینی قسەکەرە'), 'دەقی تێبینی لە فایلەکەدایە');
  check(noteXml.includes('A. Author'), 'مۆڵەتی وێنە لە تێبینییەکاندا');
  check(all.includes('Photo by A. Author (CC BY 2.0)'), 'مۆڵەت لەسەر سلایدەکە بەدیارە');

  console.log('\n─── شێوەکانی پاشبنەما ───');
  {
    // Morph تەنها ئەو شتانە دەجوڵێنێت کە بەڕاستی گۆڕاون.
    // ئەگەر هەموو سلایدەکان هەمان شوێنیان بێت، گواستنەوەکە نادیارە.
    const pos: string[] = [];
    for (const path of slidePaths.slice(0, 4)) {
      const x = await zip.file(path)!.async('string');
      const first = x.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/g)?.slice(0, 5).join('|') ?? '';
      pos.push(first);
    }
    check(new Set(pos).size === pos.length, 'هەر سلایدێک شێوەی جیاوازی هەیە',
      `${new Set(pos).size} جیاواز لە ${pos.length}`);

    // ناوەکان دەبێت یەک بن، ئەگەرنا PowerPoint ناتوانێت بەیەکەوە بیانبەستێتەوە
    const s1 = await zip.file(slidePaths[1])!.async('string');
    const named = s1.match(/name="deco\d+"/g) ?? [];
    check(named.length === DECO_N, 'شێوەکان ناوی جێگیریان هەیە بۆ Morph', `${named.length}/${DECO_N}`);

    const t2 = await zip.file(slidePaths[2])!.async('string');
    const n2 = t2.match(/name="deco\d+"/g) ?? [];
    check(JSON.stringify(named) === JSON.stringify(n2), 'هەمان ناوەکان لە سلایدی دواتردا');
    check(/<a:xfrm rot="/.test(t2), 'شێوەکان خولاونەتەوە');

    // جۆری شێوەکان — نەک تەنها بازنە و چوارگۆشە
    const kinds = new Set([...s1.matchAll(/<a:prstGeom prst="([a-zA-Z0-9]+)"/g)].map(m => m[1]));
    check(kinds.size >= 4, 'چەند جۆری شێوە هەیە', [...kinds].join(', '));
    check(kinds.has('triangle') || kinds.has('diamond') || kinds.has('hexagon')
       || kinds.has('star5') || kinds.has('pentagon'), 'شێوەی لاکێشەیی هەیە');

    // گەشتەکە: شێوەکان دەبێت لە دەرەوەی سلایدەوە بێن
    let outside = 0;
    for (const p of slidePaths) {
      const x = await zip.file(p)!.async('string');
      for (const m of x.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/g)) {
        if (+m[1] < 0 || +m[2] < 0 || +m[1] > 12192000) outside++;
      }
    }
    check(outside > 0, 'هەندێک شێوە لە دەرەوەی سلایدەوە دێن', `${outside} جار`);
  }

  console.log('\n─── ئەنیمەیشنی ناو سلاید ───');
  {
    const x = await zip.file(slidePaths[1])!.async('string');
    check(x.includes('<p:timing>'), 'بلۆکی timing هەیە');
    check(x.includes('nodeType="tmRoot"'), 'ڕەگی تایملاین');
    check(x.includes('nodeType="mainSeq"'), 'ڕیزی سەرەکی');
    check(x.includes('presetClass="entr"'), 'کاریگەری هاتنە ژوورەوە');
    check(x.includes('<p:animEffect transition="in" filter="fade"'), 'لێڵبوونەوە');
    check(/<p:spTgt spid="\d+"\/>/.test(x), 'ئامانجەکە شێوەیەکی دیاریکراوە');

    // ناسنامەکان دەبێت یەکتا بن، ئەگەرنا PowerPoint فایلەکە ڕەت دەکاتەوە
    const ids = [...x.matchAll(/<p:cTn id="(\d+)"/g)].map(m => m[1]);
    check(new Set(ids).size === ids.length, 'ناسنامەی تایمنۆدەکان یەکتان', `${ids.length} دانە`);

    // شێوەکانی پاشبنەما نابێت ئەنیمەیت بکرێن — ئەوانە Morph دەیانجوڵێنێت
    const decoIds = [...x.matchAll(/<p:cNvPr id="(\d+)" name="deco\d+"/g)].map(m => m[1]);
    const targets = [...x.matchAll(/<p:spTgt spid="(\d+)"\/>/g)].map(m => m[1]);
    check(!decoIds.some(d => targets.includes(d)), 'شێوەی پاشبنەما ئەنیمەیت نەکراوە');
    check(targets.length > 0, 'شتێک ئەنیمەیت کراوە', `${new Set(targets).size} توخم`);

    // تەنها یەک <p:timing> — ئەوەی pptxgenjs گۆڕدرایەوە
    check((x.match(/<p:timing/g) ?? []).length === 1, 'تەنها یەک بلۆکی timing');

    // ─── ڕێسا پیشەییەکان ───
    // یەکەم کاریگەری بە کلیک، ئەوانی تر خۆکار — ئەگەرنا بەکارهێنەر
    // دەبێت بۆ هەر دێڕێک کلیک بکات
    check((x.match(/nodeType="clickEffect"/g) ?? []).length === 1, 'تەنها یەکەمیان بە کلیک');
    check((x.match(/nodeType="afterEffect"/g) ?? []).length >= 1, 'ئەوانی تر خۆکار بەدوایدا');

    // نەرمی — بەبێی جوڵەکە ڕەق دەردەکەوێت
    check(x.includes('accel="20000"') && x.includes('decel="40000"'), 'نەرمی (ease) دانراوە');

    // ڕیزبەندی — بۆشایی نێوانیان
    check(/<p:cond delay="140"\/>/.test(x), 'ڕیزبەندی ١٤٠ms لە نێوانیاندا');

    // تێکەڵاوی کاریگەرییەکان لەسەر هەموو سلایدەکان: زۆرینەیان دەبێت Fade بن
    const fades = (all.match(/presetID="10" presetClass="entr"/g) ?? []).length;
    const zooms = (all.match(/presetID="23" presetClass="entr"/g) ?? []).length;
    const floats = (all.match(/presetID="42" presetClass="entr"/g) ?? []).length;
    const total = fades + zooms + floats;
    check(total > 0, 'کاریگەرییەکان دانراون', `${total} دانە`);
    check(fades / total >= 0.7, 'زۆرینەیان Fade ـن (شێوازی پیشەیی)',
      `Fade ${fades} · Zoom ${zooms} · Float ${floats}`);

    // Zoom تەنها بۆ وێنە — نەک بۆ هەموو شتێک
    check(zooms > 0, 'وێنە بە Zoom دێتە ژوورەوە');
  }

  console.log('\n─── لۆگۆ ───');
  {
    const t1 = await zip.file('ppt/slides/slide1.xml')!.async('string');
    check(!t1.includes('srcRect') || t1.includes('srcRect'), 'لاپەڕەی سەرەتا نەخشێنراوە');
  }

  console.log('\n─── ئەنیمەیشنی Morph ───');
  const n = await countTransitions(new Blob([new Uint8Array(buf)]));
  check(n === slidePaths.length - 1, 'Morph لەسەر هەموو سلایدەکان بێجگە لە یەکەم',
        `${n} لە ${slidePaths.length - 1}`);
  check(all.includes('p159:morph'), 'تاگی morph هەیە');
  check(all.includes('<p:fade/>'), 'پاشەکەوتی Fade بۆ وەشانە کۆنەکان');
  check(all.includes('p14:dur="2000"'), 'ماوەی گواستنەوە ٢٠٠٠ms');

  console.log('\n─── شێوازەکانی دیزاین ───');
  {
    // هەر شێوازێک دەبێت فایلێکی جیاواز دەربکات — بەرامبەری تاقیکردنەوە
    // ئەوەیە کە هەموویان یەک شت دەربکەن و «شێواز» تەنها ناوێک بێت.
    const xmlOf = async (id: StyleId) => {
      const d = { ...makeDeck(), style: id };
      const z = await JSZip.loadAsync(Buffer.from(await (await exportPptx(d, { withMorph: false })).arrayBuffer()));
      const ps = Object.keys(z.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p));
      return (await Promise.all(ps.map(p => z.file(p)!.async('string')))).join('');
    };
    const out = new Map<StyleId, string>();
    for (const s of STYLES) out.set(s.id, await xmlOf(s.id));

    check(new Set([...out.values()].map(x => x.length)).size >= 5,
          'شێوازەکان فایلی جیاواز دەردەکەن',
          [...out.values()].map(x => Math.round(x.length / 1024) + 'KB').join(' · '));

    // کرۆمی هەر شێوازێک — شێوەی ڕاستەقینە، بە ناوی خۆیەوە
    check(out.get('edge')!.includes('chromeEdge'), '«لێوار» هێڵی لێواری هەیە');
    check(!out.get('glass')!.includes('chromeEdge'), '«شووشە» هێڵی لێواری نییە');
    check(out.get('band')!.includes('chromeBand'), '«تەریق» تەریقی هەیە');
    check(out.get('glass')!.includes('cardGlass'), '«شووشە» کارتی شووشەیی هەیە');
    check(out.get('paper')!.includes('cardSheet'), '«پەڕە» پەڕەی ڕەقی هەیە');
    check(out.get('frame')!.includes('cardFrame'), '«چوارچێوە» چوارچێوەی هەیە');
    check(!out.get('plain')!.includes('card'), '«سادە» هیچ کارتێکی نییە');

    // ─── شەش شێوازە نوێیەکە ───
    // ئەمانە لەبەر ئەوە زیاد کراون کە شێوازێکی نوێ دەکرێت لە
    // پێشبینیندا جوان بێت و لە PowerPoint دا بەتاڵ دەربکەوێت —
    // ئەگەر `card` یان `accent` ـەکەی جۆرێک بێت کە pptx.ts نایناسێت.
    check(out.get('studio')!.includes('chromeBand'), '«ستودیۆ» تەریقی هەیە');
    check(out.get('studio')!.includes('cardGlass'), '«ستودیۆ» کارتی شووشەیی هەیە');
    check(out.get('grid')!.includes('chromeBand'), '«تۆڕ» تەریقی هەیە');
    check(out.get('grid')!.includes('cardFrame'), '«تۆڕ» چوارچێوەی هەیە');
    check(out.get('poster')!.includes('chromeEdge'), '«پۆستەر» هێڵی لێواری هەیە');
    check(out.get('poster')!.includes('cardSheet'), '«پۆستەر» کارتی ڕەقی هەیە');
    check(out.get('note')!.includes('cardSheet'), '«تێبینی» کارتی ڕەقی هەیە');
    check(!out.get('note')!.includes('chrome'), '«تێبینی» هیچ کرۆمێکی نییە');
    check(out.get('thesis')!.includes('cardFrame'), '«نامە» چوارچێوەی هەیە');
    check(!out.get('mono')!.includes('card'), '«ڕەق» هیچ کارتێکی نییە');
    check(!out.get('mono')!.includes('chrome'), '«ڕەق» هیچ کرۆمێکی نییە');

    // هەموو شێوازێک — بەبێ ئەم پشکنینە شێوازێکی نوێ دەکرێت بێدەنگ
    // بەتاڵ دەربچێت
    for (const s of STYLES) {
      const xml = out.get(s.id)!;
      check(xml.length > 20000, `«${s.name}» ناوەڕۆکی تێدایە`,
        `${Math.round(xml.length / 1024)}KB`);
    }

    // نیشانەی خاڵ دەبێت بەڕاستی لە ناو فایلەکەدا بێت.
    //
    // ئەمە کێشەیەکی کۆنی دۆزییەوە: `{type:'bullet', code:…}` هیچی
    // نەدەنووسی، بۆیە هەموو پەرەگرافێک `<a:buNone/>` ـی دەگرت — واتە
    // پێشبینین خاڵی هەبوو بەڵام فایلی داگیراو هیچی نەبوو.
    const codes = (x: string) => [...new Set([...x.matchAll(/buChar char="&#x([0-9A-F]{4});"/g)]
                                             .map(m => m[1]))].sort().join(',');
    check(!!codes(out.get('glass')!), 'نیشانەی خاڵ نووسراوە', codes(out.get('glass')!));
    check(!out.get('glass')!.includes('buNone/></a:pPr><a:r><a:rPr lang="en-US" sz="26'),
          'هیچ پەرەگرافێکی خاڵ buNone ی نییە');
    check(codes(out.get('glass')!) === '25CF', '«شووشە» بازنەی پڕ', codes(out.get('glass')!));
    check(codes(out.get('band')!) === '25A0', '«تەریق» چوارگۆشە', codes(out.get('band')!));
    check(codes(out.get('edge')!) === '2013', '«لێوار» هێڵ', codes(out.get('edge')!));
    check(codes(out.get('frame')!) === '25CB', '«چوارچێوە» بازنەی بەتاڵ', codes(out.get('frame')!));
    check(out.get('paper')!.includes('buAutoNum'), '«پەڕە» لیستی ژمارەیی ڕەسەن');
    check(!codes(out.get('paper')!), '«پەڕە» نیشانەی جێگرەوەی نییە');

    // ناونیشانی لار تەنها لە شێوازی لاردا
    const it = (x: string) => (x.match(/i="1"/g) ?? []).length;
    check(it(out.get('glass')!) > it(out.get('plain')!),
          'ناونیشانی لار تەنها لە شێوازە لارەکاندا', `${it(out.get('glass')!)} > ${it(out.get('plain')!)}`);
  }

  console.log('\n─── پڕکردنەوەی سلاید ───');
  {
    // کێشەکە: دەقی کورت لە سەرەوە دەچەسپا و خوارەوە بەتاڵ دەمایەوە.
    // چارەسەرەکە دوو بەشی هەیە — ناوەڕاستکردن، و بۆشایی فراوانتر.
    check((all.match(/anchor="ctr"/g) ?? []).length > 0,
          'خانەکانی دەق ناوەڕاست کراون',
          `${(all.match(/anchor="ctr"/g) ?? []).length} خانە`);
    check(/spcAft/.test(all), 'بۆشایی نێوان خاڵەکان نووسراوە');

    // بۆشاییەکە دەبێت لە ژمێردنەکەوە هاتبێت، نەک ژمارەیەکی چەسپاو
    const spc = [...all.matchAll(/<a:spcAft><a:spcPts val="(\d+)"\/>/g)].map(m => +m[1]);
    check(spc.length > 0 && spc.some(v => v > 1250), 'بۆشایی ژمێردراوە، نەک ٢٥px ی چەسپاو',
          spc.length ? `${Math.min(...spc)}–${Math.max(...spc)} (سەدی پۆینت)` : '—');
  }

  console.log('\n─── چڕی دەق ───');
  {
    // دێککێکی پاک — تەنها ناونیشان و خاڵ، بەبێ وێنە و مۆڵەت، تا
    // ژمارە بچووکەکانی تر تێکەڵی پێوانەکە نەبن.
    const bodyOf = async (den: 'short' | 'long') => {
      const only = newSlide('L_bullets', 'Title');
      only.bullets = ['First point here.', 'Second point here.'];
      const d = { ...makeDeck(), density: den, slides: [only] };
      const z = await JSZip.loadAsync(Buffer.from(await (await exportPptx(d, { withMorph: false })).arrayBuffer()));
      const x = await z.file('ppt/slides/slide2.xml')!.async('string');
      // قەبارەی ئەو ڕەوانەیە کە خاڵەکەی تێدایە — نەک گەورەترین ژمارەی
      // پەڕەکە (ئەوە ناونیشانە) و نەک بچووکترین (مۆڵەتی وێنەیە)
      const before = x.slice(0, x.indexOf('<a:t>First point here.</a:t>'));
      return +[...before.matchAll(/sz="(\d+)"/g)].pop()![1];
    };
    const [sh, lo] = [await bodyOf('short'), await bodyOf('long')];
    check(sh > lo, 'دەقی کورت گەورەتر هەناردە دەکرێت', `${sh / 100}pt > ${lo / 100}pt`);
  }

  console.log('\n─── ڕێکی OOXML ───');
  {
    // سکیما: CT_TextParagraph ::= (a:pPr)? (a:r|a:br|a:fld)* (a:endParaRPr)?
    // pptxgenjs بۆ هەر ڕەوانەیەک pPr ـێک دەنووسێت — کە ناتەواوە، و
    // ئەوەی دوایی دێت ئەوەی پێشووی پووچ دەکردەوە (نیشانەی خاڵ ونبوو).
    let many = 0, notFirst = 0, paras = 0;
    for (const p of all.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []) {
      paras++;
      const n = (p.match(/<a:pPr/g) ?? []).length;
      if (n > 1) many++;
      if (n === 1 && !/^<a:p><a:pPr/.test(p)) notFirst++;
    }
    check(paras > 10, 'پەرەگرافی پێویست هەیە بۆ پشکنین', `${paras}`);
    check(many === 0, 'هیچ پەرەگرافێک زیاتر لە یەک pPr ی نییە', `${many} کێشە`);
    check(notFirst === 0, 'pPr هەمیشە لە سەرەتای پەرەگرافەکەیە', `${notFirst} کێشە`);

    // یەکخستنەکە نابێت شتێک بفەوتێنێت
    check(/spcAft/.test(all), 'بۆشایی نێوان خاڵەکان دوای یەکخستن ماوە');
    check(/buChar/.test(all), 'نیشانەی خاڵ دوای یەکخستن ماوە');
    check(/lnSpc/.test(all), 'بەرزی دێڕ دوای یەکخستن ماوە');
  }

  console.log('\n─── فۆنتی پیتە ئاڵۆزەکان ───');
  {
    // Georgia هیچ پیتێکی عەرەبی نییە. ئەگەر لە خانەی `cs` دا بمێنێتەوە،
    // دەقی کوردی لەسەر کۆمپیوتەرێکی تر دەبێتە چوارگۆشەی بەتاڵ.
    const latin = [...new Set([...all.matchAll(/<a:latin typeface="([^"]*)"/g)].map(m => m[1]))];
    const cs = [...new Set([...all.matchAll(/<a:cs typeface="([^"]*)"/g)].map(m => m[1]))];
    check(latin.includes('Georgia'), 'فۆنتی لاتینی نەگۆڕاوە', latin.join(','));
    check(cs.length === 1 && cs[0] === 'Tahoma', 'خانەی cs فۆنتی عەرەبی وەرگرتووە', cs.join(','));
    check(!cs.includes('Georgia'), 'Georgia لە خانەی cs دا نەماوە');

    // دێککی ئینگلیزی نابێت دەستکاری بکرێت
    const en = await JSZip.loadAsync(Buffer.from(await (await exportPptx(
      { ...makeDeck(), lang: 'en' }, { withMorph: false })).arrayBuffer()));
    const enXml = await en.file('ppt/slides/slide2.xml')!.async('string');
    check(/<a:cs typeface="Georgia"/.test(enXml), 'دێککی ئینگلیزی وەک خۆی ماوەتەوە');
  }

  console.log('\n─── هەناردەکردن بەبێ Morph ───');
  {
    // ڕێکخستنی سکیما و فۆنت نابێت بە Morph ـەوە بەند بن —
    // ئەوانە پێویستین، نەک ڕازاندنەوە.
    const z = await JSZip.loadAsync(Buffer.from(await (await exportPptx(
      makeDeck(), { withMorph: false })).arrayBuffer()));
    const x = await z.file('ppt/slides/slide2.xml')!.async('string');
    check(!x.includes('p159:morph'), 'Morph نەخراوەتە سەر');
    check(/<a:cs typeface="Tahoma"/.test(x), 'بەڵام فۆنتی cs هەر ڕاست کراوە');
    const many = (x.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? [])
      .filter(p => (p.match(/<a:pPr/g) ?? []).length > 1).length;
    check(many === 0, 'و پەرەگرافەکانیش ڕێکخراون');
  }

  console.log('\n─── هاوکێشە لە ناو PPTX دا ───');
  {
    const m = newSlide('L_bullets', 'Physics');
    m.bullets = [
      String.raw`Mass-energy: the relation $E = mc^2$ holds.`,
      String.raw`Derivative: $\frac{d}{dx}e^{x} = e^{x}$ everywhere.`,
      String.raw`Series: $\sum_{i=1}^{n} i$ grows fast.`,
    ];
    const t = newSlide('L_text', 'Roots');
    t.body = String.raw`The root is $\sqrt{b^2-4ac}$ and it costs \$5.`;

    const z = await JSZip.loadAsync(Buffer.from(await (await exportPptx(
      { ...makeDeck(), lang: 'en', slides: [m, t] }, { withMorph: true })).arrayBuffer()));
    const x = (await Promise.all(
      Object.keys(z.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
        .map(p => z.file(p)!.async('string')))).join('');

    check(!x.includes('[[math:'), 'هیچ نیشانەیەکی خاو نەماوەتەوە');
    check((x.match(/<a14:m/g) ?? []).length === 4, 'چوار هاوکێشە چێندران',
          `${(x.match(/<a14:m/g) ?? []).length}`);
    check((x.match(/<m:f>/g) ?? []).length === 1, 'کەسر وەک m:f');
    check((x.match(/<m:nary>/g) ?? []).length === 1, 'کۆکردنەوە وەک m:nary');
    check((x.match(/<m:rad>/g) ?? []).length === 1, 'ڕەگ وەک m:rad');
    // ئەمە C9 ـە: هاوکێشە توخمێکی ڕەسەنە، نەک وێنە
    check(!x.includes('<p:pic') || !/math/i.test(x.match(/<p:pic[\s\S]*?<\/p:pic>/)?.[0] ?? ''),
          'هاوکێشەکان وێنە نین');

    check(x.includes('Mass-energy:') && x.includes('holds.'), 'دەقی دەوروبەر ماوە');
    check(x.includes('$5'), 'دۆلاری ئیسکەیپکراو وەک دەق ماوەتەوە');

    // چاندنەکە نابێت سکیمای پەرەگرافەکان تێکبدات
    const bad = (x.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? [])
      .filter(p => (p.match(/<a:pPr/g) ?? []).length > 1).length;
    check(bad === 0, 'پەرەگرافەکان هێشتا ڕێکن');
    check(/buChar/.test(x), 'نیشانەی خاڵ ماوە');
  }

  // ═══════════ دەستکارییەکانی ئێدیتەر دەبێت بگەنە فایلەکە ═══════════
  //
  // ئەمە بێدەنگترین هەڵەی پرۆژەکە بوو: `pptx.ts` هەرگیز `overrides` ـی
  // نەدەخوێندەوە. خوێندکار ناونیشانێکی سلایدی لەسەر کەنڤاسەکە
  // دەگۆڕی، هەناردەی دەکرد، و **ناونیشانە کۆنەکەی تێدا بوو** — بەبێ
  // هیچ ئاگادارکردنەوەیەک، چونکە پێشبینینەکە ڕاست بوو.
  {
    console.log('\n─── دەستکاریی ئێدیتەر لە فایلەکەدا ───');

    const edited = newSlide('L_bullets', 'ناونیشانی کۆن');
    edited.bullets = ['خاڵی یەکەم', 'خاڵی دووەم'];
    edited.overrides = {
      title: { text: 'ناونیشانی نوێی بەکارهێنەر', fontSize: 48 },
      body: { fontSize: 27 },
    };

    const gone = newSlide('L_bullets', 'ئەم ناونیشانە شاردراوەتەوە');
    gone.bullets = ['خاڵێک'];
    gone.overrides = { title: { hidden: true } };

    const d = { ...makeDeck(), slides: [edited, gone] };
    const zip = await JSZip.loadAsync(
      Buffer.from(await (await exportPptx(d, { withMorph: false })).arrayBuffer()));
    const s1 = await zip.file('ppt/slides/slide2.xml')!.async('string');
    const s2 = await zip.file('ppt/slides/slide3.xml')!.async('string');

    check(s1.includes('ناونیشانی نوێی بەکارهێنەر'), 'دەقی دەستکاریکراو دەگاتە فایلەکە');
    check(!s1.includes('ناونیشانی کۆن'), 'دەقە کۆنەکە نامێنێتەوە');
    // ٤٨px → ٢٤pt (PT = px/2)
    check(/sz="2400"/.test(s1), 'قەبارەی فۆنتی دەستی بۆ ناونیشان', '48px → 24pt');
    // ٢٧px → ١٣.٥pt → ١٣٥٠. ئەگەر خۆکار بوایە، ژمارەیەکی تر دەبوو.
    check(/sz="1350"/.test(s1), 'قەبارەی فۆنتی دەستی بۆ ناوەڕۆک', '27px → 13.5pt');
    check(!s2.includes('ئەم ناونیشانە شاردراوەتەوە'), 'خانەی شاردراوە هەناردە ناکرێت');
    // سلایدەکە خۆی نابێت بەتاڵ بێت — تەنها ناونیشانەکە شاردراوەتەوە
    check(s2.includes('خاڵێک'), 'ئەوانی تر دەمێننەوە');
  }

  console.log(`\n${pass} pass / ${fail} fail\n`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
