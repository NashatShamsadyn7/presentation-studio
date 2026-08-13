// پشکنینی ئایکۆن و شێوەکان و ئامرازەکانی ئەیجێنت.
//   npx tsx scripts/check-icons.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICONS, ICON_GROUPS, SHAPES, iconSvg, shapeSvg, iconById, shapeById } from '../src/lib/icons';

let pass = 0, fail = 0;
const check = (ok: boolean, label: string, extra = '') => {
  if (!ok) console.log(`  FAIL  ${label}${extra ? '  →  ' + extra : ''}`);
  ok ? pass++ : fail++;
};

console.log('\n─── ئایکۆنەکان ───');
console.log(`  ${ICONS.length} ئایکۆن لە ${ICON_GROUPS.length} کۆمەڵدا`);

const seen = new Set<string>();
for (const ic of ICONS) {
  check(!seen.has(ic.id), 'ناسنامەی دووبارە', ic.id);
  seen.add(ic.id);
  check(ic.p.length > 0, 'ئایکۆنی بەتاڵ', ic.id);
  check(!!ic.name && !!ic.group, 'ناو یان کۆمەڵ نییە', ic.id);

  const svg = iconSvg(ic.id);
  check(svg.startsWith('<svg') && svg.endsWith('</svg>'), 'SVG ناتەواو', ic.id);
  check(svg.includes('viewBox="0 0 24 24"'), 'viewBox هەڵە', ic.id);

  // هەموو ژمارەکان دەبێت لە سنووری ٢٤×٢٤ دا بن (کەمێک لێبوردەیی)
  for (const p of ic.p) {
    const nums =
      p.t === 'circle' ? [p.cx, p.cy, p.r]
    : p.t === 'rect'   ? [p.x, p.y, p.w, p.h]
    : p.t === 'line'   ? [p.x1, p.y1, p.x2, p.y2]
    : p.t === 'poly'   ? p.pts.split(/[\s,]+/).map(Number)
    : [];
    for (const n of nums) {
      check(Number.isFinite(n) && n >= -3 && n <= 27,
        'ژمارەی دەرەوەی سنوور', `${ic.id}: ${n}`);
    }
  }
}

console.log('\n─── شێوەکان ───');
console.log(`  ${SHAPES.length} شێوە`);
const seenS = new Set<string>();
for (const sh of SHAPES) {
  check(!seenS.has(sh.id), 'ناسنامەی دووبارە', sh.id);
  seenS.add(sh.id);
  check(/^M[\s\d.-]/.test(sh.d), 'ڕێگای SVG بە M دەست پێناکات', sh.id);
  check(/[Zz]\s*$/.test(sh.d.trim()), 'ڕێگاکە داخراو نییە', sh.id);
  check(!!sh.pptx, 'ناوی PowerPoint نییە', sh.id);
  const svg = shapeSvg(sh.id);
  check(svg.includes('<path'), 'SVG ناتەواو', sh.id);
}

console.log('\n─── گەڕان ───');
check(!!iconById('search'), 'دۆزینەوەی ئایکۆن بە ناسنامە');
check(!iconById('nope'), 'ئایکۆنی نەبوو undefined دەگەڕێنێتەوە');
check(!!shapeById('circle'), 'دۆزینەوەی شێوە بە ناسنامە');
check(iconSvg('nope') === '', 'ئایکۆنی نەبوو دەقی بەتاڵ دەداتەوە');

console.log('\n─── ئامرازەکانی ئەیجێنت ───');
const agentSrc = readFileSync(join(process.cwd(), 'src/lib/agent.ts'), 'utf8');
const declared = [...agentSrc.matchAll(/name: '(\w+)',\n\s+description:/g)].map(m => m[1]);
const handled = [...agentSrc.matchAll(/case '(\w+)': \{|case '(\w+)':/g)]
  .map(m => m[1] ?? m[2]).filter(Boolean);
console.log(`  ${declared.length} ئامراز پێناسەکراوە`);
for (const t of declared) {
  check(handled.includes(t), 'ئامرازێک پێناسەکراوە بەڵام جێبەجێ ناکرێت', t);
}
check(declared.includes('search_web'), 'ئامرازی گەڕان هەیە');
check(agentSrc.includes('includeThoughts: true'), 'بیرکردنەوە چالاککراوە');

console.log(`\n${pass} pass / ${fail} fail\n`);
process.exit(fail ? 1 : 0);
