// ═══════════ گەڕانی ئەکادیمی ڕاستەقینە ═══════════
//
// ئەمانە داتابەیسی ڕاستەقینەی توێژینەوەن — نەک وەڵامی مۆدێلێک.
// واتە هەموو سەرچاوەیەک بوونی هەیە: DOI، نووسەر، ساڵ و گۆڤاری ڕاستەقینە.
// ئەمە کێشەی «سەرچاوەی هەڵبەستراو» بە تەواوی نامێنێت.
//
// هەموویان بێبەرامبەرن و کلیلیان ناوێت، و CORS یان کراوەیە
// (پشکنراوە: Crossref، OpenAlex، DOAJ هەموویان `access-control-allow-origin: *`).

import { isBlocked, isTrusted } from '../research';
import { fetchWithTimeout } from '../net';
import { formatCite, type SourceKind, type CiteSource, type CiteStyleId } from '../citestyle';

export interface Paper {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;          // ناوی گۆڤار یان کۆنفرانس · ناوی ماڵپەڕ
  doi?: string;
  url?: string;
  citations?: number;
  abstract?: string;
  openAccess?: string;     // بەستەری خوێندنەوەی بێبەرامبەر
  source: 'crossref' | 'openalex' | 'doaj' | 'openlibrary' | 'web';

  /** جۆری سەرچاوە — شێوازی نووسینەکەی پێی دیاری دەکرێت */
  kind: SourceKind;

  // ئەمانە بۆ IEEE، Vancouver، MLA و Harvard پێویستن — بەبێ ئەوان
  // ژمارەی بەرگ و لاپەڕە لە ژێدەرەکەدا کەم دەبن
  volume?: string;
  issue?: string;
  pages?: string;

  // تەنها بۆ کتێب
  publisher?: string;
  edition?: string;
  isbn?: string;
}

const UA = 'PresentationStudio/1.0 (academic presentation tool)';

/** ناونیشانەکان بە HTML دێن — «RFID &amp; blockchain» نابێت وا بمێنێتەوە،
 *  چونکە ڕاستەوخۆ دەچێتە ناو APA و BibTeX ـەوە. */
const ENTITY: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
};

const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, g: string) => {
  if (g[0] === '#') {
    const n = g[1] === 'x' || g[1] === 'X'
      ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
  }
  return ENTITY[g.toLowerCase()] ?? m;
});

const clean = (s: unknown) =>
  typeof s === 'string'
    ? decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    : '';

/** ئایا ئەمە بەڕاستی ناوی کەسێکە؟
 *  هەندێک تۆماری OpenAlex ناونیشانی تەواوی دامەزراوە لە خانەی نووسەردا
 *  دادەنێن («Department of … University of …»). ئەوە لە APA دا دەبێتە
 *  ڕستەیەکی بێمانا، بۆیە دەردەچێت. */
const isPerson = (n: string) =>
  n.length > 1 && n.length <= 60 && n.trim().split(/\s+/).length <= 6;

// ─────────── Crossref ───────────
// ١٦٠ ملیۆن بابەتی زانستی بە DOI ـەوە

interface CrossrefItem {
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  issued?: { 'date-parts'?: number[][] };
  DOI?: string;
  'container-title'?: string[];
  'is-referenced-by-count'?: number;
  abstract?: string;
  type?: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  ISBN?: string[];
  edition?: string;
}

/** جۆرەکانی Crossref بەپێی ئەوەی داوامان کردووە.
 *  بەبێ ئەم پاڵاوتنە، پۆست و داتاست و پێشچاپیش دێن. */
const CR_TYPES: Record<'paper' | 'book', string> = {
  paper: 'type:journal-article,type:proceedings-article',
  book:  'type:book,type:monograph,type:reference-book,type:edited-book,type:book-chapter',
};

export async function crossref(
  query: string, rows = 6, kind: 'paper' | 'book' = 'paper',
): Promise<Paper[]> {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.bibliographic', query);
  url.searchParams.set('rows', String(rows));
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('filter', CR_TYPES[kind]);
  // ئاگاداری: هەر ناوێکی نەناسراو لێرەدا وا دەکات Crossref بە ٤٠٠
  // وەڵام بداتەوە — واتە بێدەنگ لە ئەنجامەکاندا دەردەچێت.
  // `edition-number` بەردەست نییە، تاقی مەکەوە.
  url.searchParams.set('select',
    'title,author,issued,DOI,container-title,is-referenced-by-count,abstract,type,' +
    'volume,issue,page,publisher,ISBN');

  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Crossref ${res.status}`);

  const data = await res.json() as { message?: { items?: CrossrefItem[] } };
  return (data.message?.items ?? []).map(it => ({
    title: clean(it.title?.[0]),
    authors: (it.author ?? [])
      .map(a => a.name ?? [a.given, a.family].filter(Boolean).join(' '))
      .filter(isPerson),
    year: it.issued?.['date-parts']?.[0]?.[0],
    // کتێب ناوی بەرگی نییە، بەڵکو بڵاوکەرەوە
    venue: kind === 'book' ? '' : clean(it['container-title']?.[0]),
    publisher: kind === 'book' ? cleanPublisher(it.publisher ?? '') : undefined,
    isbn: it.ISBN?.[0],
    volume: it.volume, issue: it.issue, pages: it.page,
    doi: it.DOI,
    url: it.DOI ? `https://doi.org/${it.DOI}` : undefined,
    citations: it['is-referenced-by-count'],
    abstract: clean(it.abstract).slice(0, 600) || undefined,
    kind: kind as SourceKind,
    source: 'crossref' as const,
  })).filter(p => p.title);
}

/**
 * ئایا ئەم DOI ـە بەڕاستی تۆمارکراوە؟
 *
 * ═══ ئەمە تاکە پشکنینی «سەرچاوەی ڕاستەقینە»یە کە لە وێبگەڕدا دەکرێت ═══
 * خاوەنی بەرهەمەکە داوای ئەیجێنتێکی کرد کە «real working source»
 * بپشکنێت. بەڵام لە وێبگەڕێکدا ناتوانرێت `HEAD` بۆ ماڵپەڕی
 * ناشرێک بنێردرێت — CORS ڕێگری لێدەکات، و ئەنجامەکە هەمیشە
 * هەڵەیەکی تۆڕە جا بەستەرەکە چاک بێت یان نا. بۆیە ئەو
 * پشکنینە **هەمیشە** دەریدەخات کە هەموو سەرچاوەکان شکاون.
 *
 * Crossref بەڵام API ـێکی کراوەی CORS ـی هەیە، و DOI ـەکان
 * لەوێدا تۆمارکراون. بۆیە ئەمە پشکنینێکی ڕاستەقینەیە کە
 * بەڕاستی کاردەکات.
 *
 * ─── ئاگاداری گرنگ ───
 * `false` واتای «هەڵبەستراوە» **نییە**. DataCite و هەندێک
 * ناشری بچووک DOI ـەکانیان لە Crossref دا نین. بۆیە ئەنجامەکە
 * وەک **ئاگاداری** بەکاردێت، نەک وەک سڕینەوە — سڕینەوەی
 * سەرچاوەیەکی ڕاستەقینە زیانێکی گەورەترە لە هێشتنەوەی
 * سەرچاوەیەکی نەپشکنراو.
 */
export async function doiRegistered(doi: string): Promise<boolean> {
  const d = doi.trim().replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
  if (!/^10\.\d{4,9}\//.test(d)) return false;
  try {
    const res = await fetchWithTimeout(
      `https://api.crossref.org/works/${encodeURIComponent(d)}?select=DOI`,
      { headers: { 'User-Agent': UA }, timeoutMs: 12_000, retries: 0 },
    );
    return res.ok;
  } catch {
    // تۆڕ نەبوو یان کاتەکە تەواو بوو — ئەمە هیچ ناڵێت دەربارەی
    // DOI ـەکە، بۆیە وەک «نەپشکنرا» دەژمێردرێت نەک وەک شکست
    return true;
  }
}

// ─────────── OpenAlex ───────────
// ٢٥٠ ملیۆن بابەت، بە ژمارەی ئاماژەپێکردن و بەستەری کراوەوە

interface OpenAlexWork {
  title?: string;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  doi?: string;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { source?: { display_name?: string }; landing_page_url?: string };
  open_access?: { oa_url?: string | null };
  abstract_inverted_index?: Record<string, number[]>;
  biblio?: { volume?: string | null; issue?: string | null;
             first_page?: string | null; last_page?: string | null };
}

/** «10–28» لە دوو خانەی جیاوازەوە */
function pageRange(b?: OpenAlexWork['biblio']): string | undefined {
  const a = b?.first_page, z = b?.last_page;
  if (!a) return undefined;
  return z && z !== a ? `${a}-${z}` : a;
}

/** OpenAlex پوختەکە بە شێوەی پێچەوانە هەڵدەگرێت — دەیگەڕێنینەوە بۆ دەق */
function rebuildAbstract(inv?: Record<string, number[]>): string | undefined {
  if (!inv) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv))
    for (const i of positions) words[i] = word;
  const text = words.filter(Boolean).join(' ').trim();
  return text ? text.slice(0, 600) : undefined;
}

export async function openalex(query: string, rows = 6): Promise<Paper[]> {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', String(rows));
  url.searchParams.set('sort', 'relevance_score:desc');
  url.searchParams.set('select',
    'id,doi,title,display_name,publication_year,cited_by_count,authorships,primary_location,open_access,abstract_inverted_index,biblio');

  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`);

  const data = await res.json() as { results?: OpenAlexWork[] };
  return (data.results ?? []).map(w => ({
    title: clean(w.title ?? w.display_name),
    authors: (w.authorships ?? []).map(a => a.author?.display_name ?? '').filter(isPerson),
    year: w.publication_year,
    venue: clean(w.primary_location?.source?.display_name),
    doi: w.doi?.replace('https://doi.org/', ''),
    url: w.doi ?? w.primary_location?.landing_page_url,
    citations: w.cited_by_count,
    abstract: rebuildAbstract(w.abstract_inverted_index),
    openAccess: w.open_access?.oa_url ?? undefined,
    volume: w.biblio?.volume ?? undefined,
    issue: w.biblio?.issue ?? undefined,
    pages: pageRange(w.biblio),
    kind: 'paper' as SourceKind,
    source: 'openalex' as const,
  })).filter(p => p.title);
}

// ─────────── DOAJ ───────────
// تەنها گۆڤاری کراوەی محکەمکراو — هەموویان بێبەرامبەر دەخوێندرێنەوە

interface DoajArticle {
  bibjson?: {
    title?: string;
    year?: string;
    author?: { name?: string }[];
    journal?: { title?: string };
    abstract?: string;
    identifier?: { type?: string; id?: string }[];
    link?: { url?: string; type?: string }[];
  };
}

export async function doaj(query: string, rows = 6): Promise<Paper[]> {
  const res = await fetchWithTimeout(
    `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=${rows}`,
    { headers: { 'User-Agent': UA } },
  );
  if (!res.ok) throw new Error(`DOAJ ${res.status}`);

  const data = await res.json() as { results?: DoajArticle[] };
  return (data.results ?? []).map(a => {
    const b = a.bibjson ?? {};
    const doi = b.identifier?.find(i => i.type === 'doi')?.id;
    return {
      title: clean(b.title),
      authors: (b.author ?? []).map(x => x.name ?? '').filter(isPerson),
      year: b.year ? Number(b.year) : undefined,
      venue: clean(b.journal?.title),
      doi,
      url: doi ? `https://doi.org/${doi}` : b.link?.find(l => l.type === 'fulltext')?.url,
      abstract: clean(b.abstract).slice(0, 600) || undefined,
      openAccess: b.link?.find(l => l.type === 'fulltext')?.url,
      kind: 'paper' as SourceKind,
      source: 'doaj' as const,
    };
  }).filter(p => p.title);
}

// ─────────── Open Library ───────────
// کتێبخانەی ئینتەرنێتی — ٤٠ ملیۆن تۆماری کتێب، بێبەرامبەر و بێ کلیل.
// Crossref تەنها ئەو کتێبانەی DOI یان هەیە دەناسێت، کە زۆربەی
// کتێبە خوێندنەوەییە کۆنەکان نایانگرێتەوە. ئەمە ئەو کەلێنە پڕ دەکاتەوە.

interface OlDoc {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
  key?: string;
  edition_count?: number;
  language?: string[];
}

/** Open Library هەندێک ناوی بڵاوکەرەوەی پیس هەیە —
 *  «Brand: MIT Press» و «Publisher: Wiley». ئەو پێشگرانە لادەبرێن. */
const cleanPublisher = (s: string) =>
  clean(s).replace(/^(brand|publisher|imprint|distributed by)\s*:?\s*/i, '').trim();

export async function openLibrary(query: string, rows = 6): Promise<Paper[]> {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(rows));
  url.searchParams.set('fields',
    'title,author_name,first_publish_year,publisher,isbn,key,edition_count,language');

  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`OpenLibrary ${res.status}`);

  const data = await res.json() as { docs?: OlDoc[] };
  return (data.docs ?? []).map(d => ({
    title: clean(d.title),
    authors: (d.author_name ?? []).filter(isPerson),
    year: d.first_publish_year,
    publisher: cleanPublisher(d.publisher?.[0] ?? ''),
    isbn: d.isbn?.[0],
    url: d.key ? `https://openlibrary.org${d.key}` : undefined,
    // ژمارەی چاپەکان نیشانەی ناوبانگی کتێبەکەیە — لێرەدا جێی
    // ژمارەی ئاماژەپێکردن دەگرێتەوە لە ڕیزکردندا
    citations: d.edition_count,
    kind: 'book' as SourceKind,
    source: 'openlibrary' as const,
  })).filter(p => p.title);
}

// ─────────── یەکخستن ───────────

const keyOf = (p: Paper) =>
  (p.doi ?? p.title).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);

/** خانە بەتاڵەکانی یەکەم لە دووبارەکەیەوە پڕ دەکاتەوە.
 *  Crossref زۆرجار DOI ـی هەیە کە OpenAlex نییەتی، و بەپێچەوانە —
 *  بەبێ ئەم تێکەڵکردنە خانەیەکی چاک لەدەست دەچێت. */
function enrich(into: Paper, from: Paper): void {
  if (!into.doi && from.doi) into.doi = from.doi;
  if (!into.url && from.url) into.url = from.url;
  if (!into.year && from.year) into.year = from.year;
  if (!into.venue && from.venue) into.venue = from.venue;
  if (!into.abstract && from.abstract) into.abstract = from.abstract;
  if (!into.openAccess && from.openAccess) into.openAccess = from.openAccess;
  if (!into.authors.length && from.authors.length) into.authors = from.authors;
  if (!into.volume && from.volume) into.volume = from.volume;
  if (!into.issue && from.issue) into.issue = from.issue;
  if (!into.pages && from.pages) into.pages = from.pages;
  if (!into.publisher && from.publisher) into.publisher = from.publisher;
  if (!into.edition && from.edition) into.edition = from.edition;
  if (!into.isbn && from.isbn) into.isbn = from.isbn;
  if ((from.citations ?? 0) > (into.citations ?? 0)) into.citations = from.citations;
}

/** هێمای ڕیزبەندی — ژمارەی گەورەتر ڕیزی نزمتر لاواز دەکات */
const RRF_K = 10;

/** کێشی سەرچاوەکان. DOAJ بچووکترە و ڕیزبەندییەکەی لاوازترە،
 *  بۆیە دەنگی کەمترە — نەک هیچ. */
const WEIGHT: Record<Paper['source'], number> = {
  openalex: 1, crossref: 1, doaj: 0.55, openlibrary: 0.9, web: 1,
};

/** وشە بەکارهاتووەکانی پرسیارەکە — بۆ پێوانی جووتبوونی ناونیشان */
const terms = (q: string) =>
  [...new Set(q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter(w => w.length > 3))];

/** چەند لە سەدی وشەکانی پرسیارەکە لە ناونیشانەکەدان؟
 *  ئەمە هێمایەکی ڕاستەوخۆی پەیوەندییە کە هیچ API ـێک نایداتێ. */
function overlap(title: string, qs: string[]): number {
  if (!qs.length) return 0;
  const t = title.toLowerCase();
  return qs.filter(w => t.includes(w)).length / qs.length;
}

/**
 * لە هەر سێ سەرچاوەکەوە دەگەڕێت و ئەنجامەکان تێکەڵ دەکات.
 * ئەگەر یەکێکیان شکستی هێنا، ئەوانی تر بەردەوام دەبن.
 *
 * ڕیزکردن: پێشتر تەنها بە ژمارەی ئاماژەپێکردن ڕیزدەکران، بەڵام ئەوە
 * پەیوەندی بە بابەتەکەوە لەناو دەبرد — بابەتێکی ناوداری بێپەیوەند
 * دەچووە سەرەوەی ئەو توێژینەوەیەی ڕێک لەسەر هەمان بابەت بوو.
 * ئێستا ڕیزی هەر API ـێک (کە خۆی وەڵامی «پەیوەندی» یە) کۆدەکرێتەوە،
 * و ئاماژەپێکردن تەنها وەک جیاکەرەوەی نێوان دوو هاوشێوە کاردەکات.
 */
/** ڕاپۆرتی زیندوو لە کاتی گەڕاندا — کام داتابەیس، چەند ئەنجام */
export type OnSource = (name: string, found: number, ok: boolean) => void;

export async function searchPapers(
  query: string, limit = 8, kind: 'paper' | 'book' = 'paper',
  onSource?: OnSource,
): Promise<Paper[]> {
  // کتێب لە دوو شوێنەوە دێت: Crossref (ئەوانەی DOI یان هەیە) و
  // Open Library (ئەوانەی نایانەوێت، کە زۆربەی کتێبە خوێندنەوەییەکانن)
  //
  // هەریەکەیان بە ناوی خۆیەوە ڕاپۆرت دەکرێت هەر کاتێک وەڵام بدات —
  // بەکارهێنەر دەبینێت گەڕان بەڕاستی ڕوودەدات، و کام سەرچاوە
  // وەڵامی نەدایەوە.
  const jobs: [string, Promise<Paper[]>][] = kind === 'book'
    ? [['Crossref', crossref(query, limit, 'book')],
       ['Open Library', openLibrary(query, limit)]]
    : [['OpenAlex', openalex(query, limit)],
       ['Crossref', crossref(query, limit)],
       ['DOAJ', doaj(query, Math.ceil(limit / 2))]];

  const settled = await Promise.allSettled(jobs.map(async ([name, job]) => {
    try {
      const r = await job;
      onSource?.(name, r.length, true);
      return r;
    } catch (e) {
      onSource?.(name, 0, false);
      throw e;
    }
  }));

  const pool = new Map<string, { p: Paper; score: number }>();
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    r.value.forEach((p, rank) => {
      const k = keyOf(p);
      if (!k) return;
      const add = WEIGHT[p.source] / (RRF_K + rank + 1);
      const hit = pool.get(k);
      // لە زیاتر لە داتابەیسێکدا دەرکەوتن نیشانەیەکی بەهێزی پەیوەندییە
      if (hit) { hit.score += add; enrich(hit.p, p); }
      else pool.set(k, { p: { ...p }, score: add });
    });
  }

  const qs = terms(query);
  // ئاماژەپێکردن بەهایەکی زۆر بچووکە — تەنها جیاکەرەوەی دوو هاوشێوەیە
  const rank = ({ p, score }: { p: Paper; score: number }) =>
    score + overlap(p.title, qs) * 0.06 + Math.log10(1 + (p.citations ?? 0)) / 150;

  return [...pool.values()]
    // دۆمەینی قەدەغەکراو دەربکە
    .filter(({ p }) => {
      if (!p.url) return true;
      try { return !isBlocked(new URL(p.url).hostname.replace(/^www\./, '')); }
      catch { return true; }
    })
    .sort((a, b) => rank(b) - rank(a))
    .map(({ p }) => p)
    .slice(0, limit);
}

// ─────────── ماڵپەڕە فەرمییەکان ───────────
//
// ئەمە جیاوازە لەوانی تر: هیچ داتابەیسێکی ئەکادیمی ماڵپەڕ ناگرێتەوە.
// بۆیە لە ئەنجامی گەڕانی ڕاستەقینەوە دێت — نەک لە مۆدێلەوە.
//
// دۆمەینە قەدەغەکراوەکان دەردەچن (C4)، و ئەوانەی متمانەپێکراون
// (.edu · .gov · .ac.* · ڕێکخراوە جیهانییەکان) دەخرێنە پێشەوە.
// ئەگەر هیچ ماڵپەڕێکی متمانەپێکراو نەبوو، هیچ ناگەڕێنێتەوە —
// بەستەرێکی بلۆگ لە هیچ خراپترە بۆ پێشکەشکردنێکی زانکۆ.

/** ئەنجامی گەڕان دەکاتە سەرچاوەیەکی ماڵپەڕ */
export function fromHits(
  hits: { title: string; url: string; domain: string }[],
): Paper[] {
  const good = hits.filter(h => h.url && h.title && h.domain && !isBlocked(h.domain));
  const ranked = [...good].sort(
    (a, b) => Number(isTrusted(b.domain)) - Number(isTrusted(a.domain)));

  return ranked.filter(h => isTrusted(h.domain)).map(h => ({
    title: h.title,
    authors: [],
    // ناوی ماڵپەڕەکە جێی گۆڤارەکە دەگرێتەوە لە هەموو شێوازەکاندا
    venue: h.domain,
    url: h.url,
    year: new Date().getFullYear(),
    kind: 'web' as SourceKind,
    source: 'web' as const,
  }));
}

/** توێژینەوەیەک دەکاتە ئەو زانیارییەی شێوازنووسەکە دەیخوازێت */
export const toSource = (p: Paper): CiteSource => ({
  kind: p.kind ?? 'paper',
  title: p.title,
  authors: p.authors,
  year: p.year,
  venue: p.venue,
  publisher: p.publisher,
  edition: p.edition,
  volume: p.volume,
  issue: p.issue,
  pages: p.pages,
  doi: p.doi,
  url: p.url ?? p.openAccess,
  isbn: p.isbn,
});

/** ژێدەرێک بە هەر شێوازێک — APA بنەڕەتە */
export const toCite = (p: Paper, style: CiteStyleId = 'apa') =>
  formatCite(toSource(p), style);

/** ژێدەرێک بە شێوازی APA 7 — ناوێکی کۆنە، هێشتا بەکاردێت */
export const toApa = (p: Paper) => toCite(p, 'apa');
