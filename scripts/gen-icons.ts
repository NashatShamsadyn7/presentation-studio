// دروستکردنی src/lib/icons-lucide.ts لە پاکێجی lucide-static ـەوە.
//   npx tsx scripts/gen-icons.ts
//
// lucide-static تەنها devDependency ـە: ئەم سکریپتە جارێک کاردەکات و
// ئەنجامەکەی دەخرێتە ناو کۆدەکەوە. واتە لە کاتی کارکردندا هیچ پاکێجێکی
// دەرەکی نییە و هیچ CDN ـێک بانگ ناکرێت — گونجاوە لەگەڵ C1.
//
// مۆڵەت: ISC (Lucide Icons and Contributors) — بەکارهێنان و دابەشکردن ڕێپێدراوە.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'node_modules/lucide-static/icons';
const OUT = 'src/lib/icons-lucide.ts';

/** تەنها ئەو ئایکۆنانەی بۆ پێشکەشکردنی ئەکادیمی بەکاردێن.
 *  ٢٠٠٠ ئایکۆن قەبارەی باندڵەکە بێهوودە گەورە دەکات. */
const GROUPS: Record<string, string[]> = {
  'گشتی': ['check', 'x', 'plus', 'minus', 'star', 'heart', 'flag', 'bookmark', 'bell',
           'info', 'circle-alert', 'circle-check', 'circle-help', 'lightbulb', 'sparkles',
           'target', 'zap', 'award', 'crown', 'gift', 'key', 'lock', 'unlock', 'shield',
           'shield-check', 'eye', 'eye-off', 'search', 'filter', 'settings', 'sliders-horizontal'],

  'زانست': ['atom', 'microscope', 'telescope', 'dna', 'flask-conical', 'test-tube',
            'beaker', 'brain', 'stethoscope', 'pill', 'syringe', 'thermometer',
            'magnet', 'orbit', 'radiation', 'biohazard'],

  'تەکنەلۆژیا': ['cpu', 'server', 'database', 'hard-drive', 'monitor', 'laptop', 'smartphone',
                 'tablet', 'keyboard', 'mouse', 'printer', 'router', 'wifi', 'bluetooth',
                 'cloud', 'cloud-upload', 'cloud-download', 'code', 'terminal', 'bug',
                 'git-branch', 'git-merge', 'network', 'globe', 'link', 'unlink',
                 'binary', 'bot', 'circuit-board', 'memory-stick', 'usb', 'satellite-dish'],

  'داتا': ['chart-bar', 'chart-line', 'chart-pie', 'chart-column', 'chart-area',
           'trending-up', 'trending-down', 'activity', 'gauge', 'percent', 'sigma',
           'calculator', 'table', 'list', 'layers', 'grid-3x3', 'scale'],

  'خوێندن': ['book', 'book-open', 'graduation-cap', 'school', 'library', 'notebook-pen',
             'pencil', 'pen-tool', 'ruler', 'clipboard-list', 'file-text', 'files',
             'folder', 'presentation', 'lectern', 'backpack', 'languages', 'quote'],

  'کار و کۆمەڵ': ['users', 'user', 'user-check', 'handshake', 'briefcase', 'building',
                  'building-2', 'factory', 'store', 'banknote', 'coins', 'credit-card',
                  'wallet', 'shopping-cart', 'truck', 'package', 'clock', 'calendar',
                  'map-pin', 'map', 'compass', 'plane', 'car', 'phone', 'mail',
                  'message-circle', 'megaphone', 'video', 'camera', 'mic'],

  'سروشت': ['leaf', 'tree-pine', 'flower', 'sprout', 'sun', 'moon', 'cloud-rain',
            'cloud-snow', 'wind', 'droplet', 'flame', 'mountain', 'waves', 'earth',
            'recycle', 'bird', 'fish', 'bug-play'],

  'ئاراستە': ['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'arrow-up-right',
              'arrow-down-right', 'chevron-right', 'chevron-left', 'move-right',
              'refresh-cw', 'rotate-cw', 'repeat', 'shuffle', 'split', 'merge',
              'corner-down-right', 'redo', 'undo', 'play', 'pause', 'square', 'circle'],
};

/** ناوەڕۆکی ناو <svg>…</svg> دەردەهێنێت — تەنها شێوەکان */
function inner(svg: string): string {
  const m = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!m) return '';
  return m[1]
    .replace(/<!--[\s\S]*?-->/g, '')   // مۆڵەتنامە
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

const available = new Set(readdirSync(SRC).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)));

const rows: string[] = [];
const groups: string[] = [];
let ok = 0;
const missing: string[] = [];

for (const [group, names] of Object.entries(GROUPS)) {
  const found: string[] = [];
  for (const n of names) {
    if (!available.has(n)) { missing.push(n); continue; }
    const body = inner(readFileSync(join(SRC, `${n}.svg`), 'utf8'));
    if (!body) { missing.push(n); continue; }
    rows.push(`  '${n}': ${JSON.stringify(body)},`);
    found.push(n);
    ok++;
  }
  groups.push(`  { name: ${JSON.stringify(group)}, ids: [${found.map(f => `'${f}'`).join(', ')}] },`);
}

const out = `// ⚠ ئەم فایلە خۆکار دروست کراوە — دەستی لێمەدە.
//   npx tsx scripts/gen-icons.ts
//
// سەرچاوە: Lucide Icons (lucide.dev) — مۆڵەتی ISC.
// تەنها ڕێڕەوی شێوەکان هەڵگیراون؛ ڕەنگ و ئەستووری هێڵ لە کاتی
// نەخشاندندا دادەنرێن، بۆیە هەمان ئایکۆن لە هەموو پاشبنەماکاندا دەگونجێت.

/** ناوەڕۆکی ناو <svg viewBox="0 0 24 24"> بۆ هەر ئایکۆنێک */
export const LUCIDE: Record<string, string> = {
${rows.join('\n')}
};

export const LUCIDE_GROUPS: { name: string; ids: string[] }[] = [
${groups.join('\n')}
];

export const LUCIDE_COUNT = ${ok};
`;

writeFileSync(OUT, out);
console.log(`  ${ok} ئایکۆن نووسرا بۆ ${OUT}`);
console.log(`  ${Object.keys(GROUPS).length} گروپ · ${Math.round(out.length / 1024)} KB`);
if (missing.length) console.log(`  ⚠ نەدۆزرانەوە (${missing.length}): ${missing.join(', ')}`);
