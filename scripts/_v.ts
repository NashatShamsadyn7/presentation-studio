import JSZip from 'jszip';
import { exportPptx } from '../src/lib/export/pptx';
import { newSlide } from '../src/lib/types';
import { buildDeck } from '../src/lib/generate';
const b = newSlide('L_bullets','ناونیشانی کوردی'); b.bullets=['یەکەم: ڕێکخستنی ڵۆژیک','دووەم: گۆڕانی ژینگە'];
const d = buildDeck({lang:'ckb',theme:'academic-blue',fontFamily:"Georgia,'Times New Roman',serif",
  titleInfo:{university:'EPU',institute:'',department:'',title:'ت',year:'',teacherPrefix:'',teacherName:'',students:[]},
  slides:[b]});
(async()=>{
  const z = await JSZip.loadAsync(Buffer.from(await (await exportPptx(d,{withMorph:true})).arrayBuffer()));
  const x = await z.file('ppt/slides/slide2.xml')!.async('string');
  const ps = x.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? [];
  console.log('paragraphs:', ps.length);
  for (const p of ps) console.log('  pPr count:', (p.match(/<a:pPr/g)??[]).length,
    '| bullets:', (p.match(/<a:bu[A-Za-z]+/g)??[]).join(','),
    '| spcAft:', /spcAft/.test(p));
  console.log('latin:', [...new Set([...x.matchAll(/<a:latin typeface="([^"]*)"/g)].map(m=>m[1]))]);
  console.log('cs   :', [...new Set([...x.matchAll(/<a:cs typeface="([^"]*)"/g)].map(m=>m[1]))]);
})();
