// ═══════════ شێوازەکانی سەرچاوەنووسین ═══════════
//
// هەر کۆلێژێک شێوازی خۆی داوا دەکات. مامۆستای ئەندازیاری IEEE دەڵێت،
// مامۆستای ئەدەب MLA، پزیشکی Vancouver. پێشتر تەنها APA هەبوو.
//
// ─── جیاوازی ڕاستەقینەی نێوانیان ───
//
// تەنها خاڵ و کۆما نییە — یاسای ناوی نووسەران بە تەواوی جیاوازە:
//
//   APA        تا ٢٠ نووسەر، `&` پێش دواهەمین
//   MLA        سێ یان زیاتر → تەنها یەکەم + et al.
//   IEEE       ناوی بچووک **پێش** ناوی خێزان، تا ٦ کەس
//   Harvard    چوار یان زیاتر → یەکەم + et al.
//   Chicago    یەکەم پێچەوانە، ئەوانی تر ئاسایی
//   Vancouver  بێ خاڵ لە نێوان پیتەکاندا: `Stinson DR`
//
// ─── دوو شت کە دەکرێت وابزانرێت هەڵەن ───
//
// ١) ناونیشانەکان **ناگۆڕدرێن**. APA بە ڕاستی داوای «سەنتەنس کەیس»
//    دەکات، بەڵام ئەو گۆڕینە `IoT` دەکاتە `Iot` و `COVID-19` دەکاتە
//    `Covid-19`. ناونیشانێکی بە هەڵە نووسراو خراپترە لە ناونیشانێکی
//    بە کەیسی سەرچاوەکەی خۆی. تەنها ئەوانەی بە تەواوی گەورەن
//    ڕاست دەکرێنەوە — ئەوە هەڵەی داتابەیسەکەیە، نەک هەڵبژاردنی کەس.
//
// ٢) لەسەر سلایددا نووسەرەکان لە ٦ زیاتر نابن. ئەمە بۆ خوێندنەوەیە.
//    هەناردەکردنی .bib و .ris هەموو ناوەکان دەگرێتەوە — لەوێ
//    شوێن هەیە و پێویستە تەواو بێت.

/** جۆری سەرچاوە — هەر جۆرێک شێوەی نووسینی جیاوازی هەیە */
export type SourceKind = 'paper' | 'book' | 'web';

export type CiteStyleId = 'apa' | 'mla' | 'ieee' | 'harvard' | 'chicago' | 'vancouver';

export interface CiteStyle {
  id: CiteStyleId;
  /** ناوی جیهانی — مامۆستاکان بەم ناوە داوای دەکەن */
  name: string;
  /** بۆ کێ گونجاوە */
  note: string;
  /** لیستەکە ژمارەدارە؟ ئەگەر نا، بە ئەلفوبێ ڕیزدەکرێت */
  numbered: boolean;
  /** شێوەی ژمارەکە لەسەر سلاید */
  marker: (n: number) => string;
}

export const CITE_STYLES: CiteStyle[] = [
  { id: 'apa',       name: 'APA 7',     note: 'زانست، ئەندازیاری، پەروەردە',
    numbered: false, marker: () => '' },
  { id: 'ieee',      name: 'IEEE',      note: 'ئەندازیاری و زانستی کۆمپیوتەر',
    numbered: true,  marker: n => `[${n}]` },
  { id: 'mla',       name: 'MLA 9',     note: 'ئەدەب و زمان',
    numbered: false, marker: () => '' },
  { id: 'harvard',   name: 'Harvard',   note: 'زانکۆ بەریتانییەکان، بازرگانی',
    numbered: false, marker: () => '' },
  { id: 'chicago',   name: 'Chicago',   note: 'مێژوو و زانستە مرۆییەکان — شێوازی کتێب',
    numbered: false, marker: () => '' },
  { id: 'vancouver', name: 'Vancouver', note: 'پزیشکی و زانستی ژیان',
    numbered: true,  marker: n => `${n}.` },
];

export const styleById = (id?: string): CiteStyle =>
  CITE_STYLES.find(s => s.id === id) ?? CITE_STYLES[0];

/** لە کوێوە سەرچاوەکان بێن — سێ ڕێڕەوی جیاواز، نەک یەک */
export const SOURCE_KINDS: {
  id: SourceKind; name: string; note: string; where: string;
}[] = [
  { id: 'paper', name: 'توێژینەوە', note: 'گۆڤاری محکەمکراو',
    where: 'OpenAlex · Crossref · DOAJ' },
  { id: 'book',  name: 'کتێب',      note: 'کتێبی خوێندن و سەرچاوە',
    where: 'Crossref · Open Library' },
  { id: 'web',   name: 'ماڵپەڕ',    note: 'زانکۆ و حکومەت و ڕێکخراو',
    where: 'مەکینەی گەڕان یان ڕەگەزی گەڕانی Gemini — تەنها .edu/.gov/.ac' },
];

export const kindById = (id?: string) =>
  SOURCE_KINDS.find(k => k.id === id) ?? SOURCE_KINDS[0];

/** نموونەی ڕاستەقینە بۆ پیشاندانی جیاوازی شێوازەکان پێش دروستکردن.
 *  هەرسێکیان سەرچاوەی ڕاستەقینەن — نەک دەقی داڕێژراو. */
export const DEMO: Record<SourceKind, CiteSource> = {
  paper: {
    kind: 'paper', title: 'Internet of Things security: A survey',
    authors: ['Fadele Ayotunde Alaba', 'Mazliza Othman', 'Ibrahim Abaker Targio Hashem'],
    year: 2017, venue: 'Journal of Network and Computer Applications',
    volume: '88', pages: '10-28', doi: '10.1016/j.jnca.2017.04.002',
  },
  book: {
    kind: 'book', title: 'Cryptography: Theory and Practice',
    authors: ['Douglas R. Stinson', 'Maura B. Paterson'],
    year: 2018, publisher: 'Chapman and Hall/CRC', edition: '4th ed.',
  },
  web: {
    kind: 'web', title: 'Cybersecurity Framework', authors: [],
    year: 2024, venue: 'nist.gov', url: 'https://www.nist.gov/cyberframework',
  },
};

/** ئەو زانیارییەی بۆ نووسینی سەرچاوەیەک پێویستە */
export interface CiteSource {
  kind: SourceKind;
  title: string;
  authors: string[];
  year?: number;
  /** گۆڤار یان کۆنفرانس (paper) · ناوی ماڵپەڕ (web) */
  venue?: string;
  /** بڵاوکەرەوە (book) */
  publisher?: string;
  edition?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  isbn?: string;
}

// ─────────── ناوەکان ───────────

interface Name { given: string[]; family: string }

/** «Douglas R. Stinson» → { given: ['Douglas','R.'], family: 'Stinson' }
 *
 *  ناوی وەک «van der Berg» و «de Souza» پارچە بچووکەکانیان بەشێکن
 *  لە ناوی خێزان، نەک ناوی بچووک. */
const PARTICLE = new Set(['van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da',
                          'du', 'la', 'le', 'bin', 'ibn', 'al', 'el', 'abu']);

function parse(full: string): Name {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { given: [], family: parts[0] ?? '' };

  let cut = parts.length - 1;
  while (cut > 1 && PARTICLE.has(parts[cut - 1].toLowerCase())) cut--;
  return { given: parts.slice(0, cut), family: parts.slice(cut).join(' ') };
}

/** پیتی یەکەمی ناوەکان — `['Douglas','Robert']` → `D. R.` */
const initials = (given: string[], dot = true, sep = ' ') =>
  given.map(g => g[0]?.toUpperCase() + (dot ? '.' : '')).filter(Boolean).join(sep);

/** «Stinson, D. R.» — شێوازی APA و Harvard */
const inverted = (n: Name, dot = true, sep = ' ') => {
  const i = initials(n.given, dot, sep);
  return i ? `${n.family}, ${i}` : n.family;
};

/** «D. R. Stinson» — شێوازی IEEE، ناوی بچووک پێشەوەیە */
const natural = (n: Name) => {
  const i = initials(n.given);
  return i ? `${i} ${n.family}` : n.family;
};

/** «Stinson DR» — شێوازی Vancouver، بێ خاڵ و بێ بۆشایی */
const compact = (n: Name) => {
  const i = initials(n.given, false, '');
  return i ? `${n.family} ${i}` : n.family;
};

/** «Douglas R. Stinson» — ناوی تەواو، بۆ MLA و Chicago */
const full = (n: Name) => [...n.given, n.family].join(' ');

/** سنووری پیشاندان لەسەر سلاید. هەناردەکردن هەموویان دەگرێتەوە. */
const CAP = 6;

/** یاسای هەر شێوازێک بۆ لیستی نووسەران */
function names(list: string[], style: CiteStyleId): string {
  const all = list.map(parse).filter(n => n.family);
  if (!all.length) return '';

  const etAl = (head: string) => `${head}, et al.`;

  switch (style) {
    case 'apa': {
      // تا ٢٠ نووسەر، بەڵام لەسەر سلاید لە ٦ زیاتر ناخوێندرێتەوە
      const use = all.slice(0, CAP).map(n => inverted(n));
      if (all.length > CAP) return `${use.join(', ')}, … ${inverted(all[all.length - 1])}`;
      if (use.length === 1) return use[0];
      return `${use.slice(0, -1).join(', ')}, & ${use[use.length - 1]}`;
    }

    case 'mla': {
      // سێ یان زیاتر → تەنها یەکەم. ئەمە یاسای ڕاستەقینەی MLA 9 ـە.
      if (all.length >= 3) return etAl(invertedFullFirst(all[0]));
      if (all.length === 2) return `${invertedFullFirst(all[0])}, and ${full(all[1])}`;
      return invertedFullFirst(all[0]);
    }

    case 'ieee': {
      const use = all.slice(0, CAP).map(natural);
      if (all.length > CAP) return `${use.join(', ')}, et al.`;
      if (use.length === 1) return use[0];
      // دوو نووسەر: بێ کۆما پێش «and» — یاسای IEEE
      if (use.length === 2) return `${use[0]} and ${use[1]}`;
      return `${use.slice(0, -1).join(', ')}, and ${use[use.length - 1]}`;
    }

    case 'harvard': {
      // چوار یان زیاتر → یەکەم + et al.
      if (all.length >= 4) return `${inverted(all[0], true, '')} et al.`;
      const use = all.map(n => inverted(n, true, ''));
      if (use.length === 1) return use[0];
      return `${use.slice(0, -1).join(', ')} and ${use[use.length - 1]}`;
    }

    case 'chicago': {
      // یەکەم پێچەوانەیە بۆ ڕیزکردن، ئەوانی تر ئاسایی
      const head = invertedFullFirst(all[0]);
      if (all.length === 1) return head;
      if (all.length > CAP) return etAl(head);
      const rest = all.slice(1).map(full);
      if (rest.length === 1) return `${head}, and ${rest[0]}`;
      return `${head}, ${rest.slice(0, -1).join(', ')}, and ${rest[rest.length - 1]}`;
    }

    case 'vancouver': {
      const use = all.slice(0, CAP).map(compact);
      return all.length > CAP ? `${use.join(', ')}, et al.` : use.join(', ');
    }
  }
}

/** «Stinson, Douglas R.» — ناوی تەواوی پێچەوانەکراو (MLA، Chicago) */
function invertedFullFirst(n: Name): string {
  const g = n.given.join(' ');
  return g ? `${n.family}, ${g}` : n.family;
}

// ─────────── پارچە هاوبەشەکان ───────────

/** ناونیشانی بە تەواوی گەورە ڕاست دەکاتەوە.
 *  ئەمە هەڵەی داتابەیسەکەیە — Crossref هەندێک تۆماری وا هەیە. */
function fixCaps(t: string): string {
  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length < 8 || letters !== letters.toUpperCase()) return t;
  const small = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for',
                         'to', 'with', 'at', 'by', 'from', 'as']);
  return t.toLowerCase().replace(/\b[a-z]/g, (c, i) => i === 0 ? c.toUpperCase() : c)
    .split(' ')
    .map((w, i) => i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w)
    .join(' ');
}

/** خاڵی کۆتایی — بەبێ دووبارەکردنەوەی ئەو خاڵەی خۆی هەیەتی */
const dot = (s: string) => /[.?!]$/.test(s.trim()) ? s.trim() : s.trim() + '.';

/** بەستەری DOI — هەمیشە پێشوازی تەواوی هەیە */
const doiUrl = (d: string) => `https://doi.org/${d.replace(/^https?:\/\/doi\.org\//, '')}`;

const link = (s: CiteSource) => s.doi ? doiUrl(s.doi) : (s.url ?? '');

/** ژمارەی بەرگ و ژمارە و لاپەڕە، ئەگەر هەبن */
const vol = (s: CiteSource) => s.volume ?? '';
const iss = (s: CiteSource) => s.issue ?? '';
const pg  = (s: CiteSource) => s.pages ?? '';

/** ڕێکەوتی ئەمڕۆ بە شێوازی خوێندنەوە — بۆ «Accessed» */
function today(style: CiteStyleId): string {
  const d = new Date();
  const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
             'August', 'September', 'October', 'November', 'December'];
  if (style === 'vancouver')
    return `${d.getFullYear()} ${M[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  if (style === 'ieee')
    return `${M[d.getMonth()].slice(0, 3)}. ${d.getDate()}, ${d.getFullYear()}`;
  if (style === 'harvard')
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
  return `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─────────── نووسینەکە ───────────

const join = (bits: (string | undefined | false)[]) =>
  bits.filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();

function paper(s: CiteSource, st: CiteStyleId, A: string, T: string, Y: string): string {
  const J = s.venue ?? '', L = link(s);
  const bare = T.replace(/\.$/, '');
  switch (st) {
    case 'apa':
      return join([A && dot(A), `(${Y}).`, dot(T),
                   J && (vol(s) ? `${J},` : `${J}.`),
                   vol(s) && (iss(s) ? `${vol(s)}(${iss(s)})` : vol(s)) + (pg(s) ? ',' : '.'),
                   pg(s) && `${pg(s)}.`, L]);
    case 'mla':
      return join([A && dot(A), `"${dot(T)}"`, J && `${J},`,
                   vol(s) && `vol. ${vol(s)},`, iss(s) && `no. ${iss(s)},`,
                   `${Y},`, pg(s) && `pp. ${pg(s)},`, L && dot(L)]);
    case 'ieee':
      return join([A && `${A},`, `"${bare},"`, J && `${J},`,
                   vol(s) && `vol. ${vol(s)},`, iss(s) && `no. ${iss(s)},`,
                   pg(s) && `pp. ${pg(s)},`, Y, s.doi ? `, doi: ${s.doi}.` : '.']);
    case 'harvard':
      return join([A, `(${Y})`, `'${bare}',`,
                   J && (vol(s) ? `${J},` : `${J}.`),
                   vol(s) && `${vol(s)}${iss(s) ? `(${iss(s)})` : ''}` + (pg(s) ? ',' : '.'),
                   pg(s) && `pp. ${pg(s)}.`, L && dot(L)]);
    case 'chicago':
      return join([A && dot(A), `"${dot(T)}"`, J,
                   vol(s) && `${vol(s)}${iss(s) ? `, no. ${iss(s)}` : ''}`,
                   `(${Y})`, pg(s) ? `: ${pg(s)}.` : '.', L && dot(L)]);
    case 'vancouver':
      return join([A && dot(A), dot(T), J && `${J}.`,
                   `${Y}${vol(s) ? `;${vol(s)}${iss(s) ? `(${iss(s)})` : ''}` : ''}${pg(s) ? `:${pg(s)}` : ''}.`,
                   s.doi && `doi:${s.doi}`]);
  }
}

function book(s: CiteSource, st: CiteStyleId, A: string, T: string, Y: string): string {
  const P = s.publisher ?? '', E = s.edition ?? '';
  const bare = T.replace(/\.$/, '');
  switch (st) {
    // Family, F. M. (2018). Title of book (4th ed.). Publisher.
    case 'apa':
      return join([A && dot(A), `(${Y}).`, E ? `${bare} (${E}).` : dot(T),
                   P && dot(P), s.doi ? doiUrl(s.doi) : '']);
    // Family, First. Title of Book. 4th ed., Publisher, 2018.
    case 'mla':
      return join([A && dot(A), dot(T), E && `${E},`, P && `${P},`, `${Y}.`]);
    // F. M. Family, Title of Book, 4th ed. Publisher, 2018.
    case 'ieee':
      return join([A && `${A},`, `${bare},`, E && dot(E), P && `${P},`, `${Y}.`]);
    // Family, F.M. (2018) Title of book. 4th edn. Publisher.
    case 'harvard':
      return join([A, `(${Y})`, dot(T), E && dot(E), P && dot(P)]);
    // Family, First. Title of Book. 4th ed. Publisher, 2018.
    case 'chicago':
      return join([A && dot(A), dot(T), E && dot(E), P && `${P},`, `${Y}.`]);
    // Family FM. Title of book. 4th ed. Publisher; 2018.
    case 'vancouver':
      return join([A && dot(A), dot(T), E && dot(E), P && `${P};`, `${Y}.`]);
  }
}

function web(s: CiteSource, st: CiteStyleId, A: string, T: string, Y: string): string {
  const site = s.venue ?? '', U = s.url ?? '';
  const who = A || site;
  switch (st) {
    case 'apa':
      return join([who && dot(who), `(${Y}).`, dot(T), A && site && dot(site), U]);
    case 'mla':
      return join([A && dot(A), `"${dot(T)}"`, site && `${site},`, `${Y},`, U && dot(U)]);
    case 'ieee':
      return join([who && `${who},`, `"${dot(T)}"`, `[Online]. Available:`, U + '.',
                   `[Accessed: ${today('ieee')}].`]);
    case 'harvard':
      return join([who, `(${Y})`, dot(T), `Available at:`, U,
                   `(Accessed: ${today('harvard')}).`]);
    case 'chicago':
      return join([A && dot(A), `"${dot(T)}"`, site && dot(site),
                   `Accessed ${today('chicago')}.`, U && dot(U)]);
    case 'vancouver':
      return join([who && dot(who), `${T.replace(/\.$/, '')} [Internet].`,
                   `${Y} [cited ${today('vancouver')}].`, `Available from: ${U}`]);
  }
}

/** سەرچاوەیەک دەنووسێت بە شێوازی داواکراو */
export function formatCite(src: CiteSource, style: CiteStyleId): string {
  const A = names(src.authors ?? [], style);
  const T = fixCaps((src.title ?? '').trim());
  const Y = src.year ? String(src.year) : (style === 'apa' || style === 'harvard' ? 'n.d.' : '');
  if (!T) return '';

  const out = src.kind === 'book' ? book(src, style, A, T, Y)
            : src.kind === 'web'  ? web(src, style, A, T, Y)
            : paper(src, style, A, T, Y);

  // پاککردنەوەی ئەو پارچانەی خانەیەکی بەتاڵ بەجێی هێشتوون
  return out
    .replace(/\(\)\s*\.?/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/^[,.\s]+/, '')
    .trim();
}

/** لیستێکی تەواو — ڕیزکردن و ژمارەکردن بەپێی شێوازەکە */
export function formatList(sources: CiteSource[], style: CiteStyleId): string[] {
  const st = styleById(style);
  const lines = sources.map(s => formatCite(s, style)).filter(Boolean);
  // شێوازە ژمارەدارەکان بە ڕیزی دەرکەوتن دەمێننەوە؛ ئەوانی تر بە ئەلفوبێ
  return st.numbered ? lines : lines.sort((a, b) => a.localeCompare(b, 'en'));
}
