// ═══════════ هەناردەکردنی سەرچاوەکان ═══════════
//
// مامۆستا زۆرجار داوای فایلی سەرچاوە دەکات لەگەڵ پێشکەشکردنەکەدا —
// .bib بۆ LaTeX، .ris بۆ Mendeley و EndNote و Zotero.
//
// ─── یاسای سەرەکی: هیچ داتایەک هەڵنابەسترێت ───
//
// BibTeX و RIS خانەی جیاکراوەیان دەوێت (نووسەر، ساڵ، گۆڤار، DOI).
// ئەو خانانە تەنها لەو سەرچاوانەدا هەن کە بە `find_papers` دۆزراونەتەوە —
// واتە لە OpenAlex/Crossref/DOAJ ـەوە هاتوون و ڕاستەقینەن (C6).
//
// سەرچاوەیەکی بەبێ ئەو خانانە **دەردەچێت**، و ژمارەکەی بە بەکارهێنەر
// دەوترێت. هەرگیز بە ژمارەی هەڵبەستراو پڕ ناکرێتەوە — سەرچاوەیەکی
// درۆ لە هیچ خراپترە.

import type { Reference } from './types';
import { formatCite, styleById, type CiteStyleId, type SourceKind } from './citestyle';

export interface CiteResult {
  text: string;
  /** چەند سەرچاوە هەناردە کران */
  count: number;
  /** چەندیان خانەی پێویستیان نەبوو */
  skipped: number;
}

/** ئایا ئەم سەرچاوەیە داتای پێکهاتەیی هەیە؟ */
export const isStructured = (r: Reference) =>
  !!(r.title && (r.authors?.length || r.year));

// ─────────── BibTeX ───────────

/**
 * کلیلی BibTeX — `family2024firstword`.
 * دەبێت تەنها پیتی ASCII بێت؛ LaTeX کلیلی یونیکۆد قبووڵ ناکات.
 */
function bibKey(r: Reference, i: number): string {
  const family = (r.authors?.[0] ?? '').trim().split(/\s+/).pop() ?? '';
  const word = (r.title ?? '').split(/\s+/).find(w => w.length > 3) ?? '';
  const key = `${family}${r.year ?? ''}${word}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');
  return key || `ref${i + 1}`;
}

/**
 * پیتە تایبەتەکانی LaTeX.
 * بەبێ ئەمە ناونیشانێک کە `&` یان `%` ـی تێدابێت فایلی .bib تێکدەدات.
 */
const texEsc = (s: string) =>
  s.replace(/\\/g, '\\textbackslash{}')
   .replace(/([&%$#_{}])/g, '\\$1')
   .replace(/~/g, '\\textasciitilde{}')
   .replace(/\^/g, '\\textasciicircum{}');

/** ناوەکان بە شێوازی BibTeX: `Family, Given and Family, Given` */
const bibAuthors = (a: string[]) =>
  a.map(full => {
    const parts = full.trim().split(/\s+/);
    if (parts.length < 2) return texEsc(full);
    const family = parts.pop()!;
    return `${texEsc(family)}, ${texEsc(parts.join(' '))}`;
  }).join(' and ');

/** جۆری تۆماری BibTeX — کتێبێک نابێت وەک وتارێکی گۆڤار تۆمار بکرێت،
 *  چونکە LaTeX خانەی جیاوازی لێ چاوەڕوان دەکات و بە هەڵە دەینووسێتەوە. */
const BIB_TYPE: Record<SourceKind, string> = {
  paper: 'article', book: 'book', web: 'misc',
};

export function toBibtex(refs: Reference[]): CiteResult {
  const good = refs.filter(isStructured);
  const out = good.map((r, i) => {
    const kind: SourceKind = r.kind ?? 'paper';
    const fields: [string, string][] = [];
    if (r.authors?.length) fields.push(['author', bibAuthors(r.authors)]);
    fields.push(['title', `{${texEsc(r.title ?? '')}}`]);
    if (r.year)  fields.push(['year', String(r.year)]);

    if (kind === 'book') {
      if (r.publisher) fields.push(['publisher', texEsc(r.publisher)]);
      if (r.edition)   fields.push(['edition', texEsc(r.edition)]);
      if (r.isbn)      fields.push(['isbn', r.isbn]);
    } else if (kind === 'web') {
      if (r.venue) fields.push(['howpublished', `{\\url{${r.url ?? ''}}}`]);
      fields.push(['note', `Accessed ${new Date().toISOString().slice(0, 10)}`]);
    } else {
      if (r.venue)  fields.push(['journal', texEsc(r.venue)]);
      if (r.volume) fields.push(['volume', r.volume]);
      if (r.issue)  fields.push(['number', r.issue]);
      if (r.pages)  fields.push(['pages', r.pages.replace('-', '--')]);
    }

    if (r.doi)   fields.push(['doi', r.doi]);
    if (r.url)   fields.push(['url', r.url]);

    const body = fields.map(([k, v]) => `  ${k} = {${v}}`).join(',\n');
    return `@${BIB_TYPE[kind]}{${bibKey(r, i)},\n${body}\n}`;
  });

  return {
    text: header('%') + out.join('\n\n') + '\n',
    count: good.length,
    skipped: refs.length - good.length,
  };
}

// ─────────── RIS ───────────
//
// شێوازێکی دێڕ-بە-دێڕە: `TAG  - value`. دوو بۆشایی پێویستە.
// Mendeley، EndNote، Zotero و RefWorks هەموویان دەیخوێننەوە.

/** جۆری تۆماری RIS. Zotero و Mendeley بەمە جیایان دەکەنەوە. */
const RIS_TYPE: Record<SourceKind, string> = {
  paper: 'JOUR', book: 'BOOK', web: 'ELEC',
};

export function toRis(refs: Reference[]): CiteResult {
  const good = refs.filter(isStructured);
  const out = good.map(r => {
    const kind: SourceKind = r.kind ?? 'paper';
    const L: string[] = [`TY  - ${RIS_TYPE[kind]}`];
    for (const a of r.authors ?? []) {
      const parts = a.trim().split(/\s+/);
      const family = parts.length > 1 ? parts.pop()! : a;
      L.push(`AU  - ${parts.length ? `${family}, ${parts.join(' ')}` : family}`);
    }
    L.push(`TI  - ${r.title ?? ''}`);
    if (r.year)  L.push(`PY  - ${r.year}`);

    if (kind === 'book') {
      if (r.publisher) L.push(`PB  - ${r.publisher}`);
      if (r.edition)   L.push(`ET  - ${r.edition}`);
      if (r.isbn)      L.push(`SN  - ${r.isbn}`);
    } else if (kind === 'web') {
      if (r.venue) L.push(`PB  - ${r.venue}`);
      L.push(`Y2  - ${new Date().toISOString().slice(0, 10)}`);
    } else {
      if (r.venue)  L.push(`JO  - ${r.venue}`);
      if (r.volume) L.push(`VL  - ${r.volume}`);
      if (r.issue)  L.push(`IS  - ${r.issue}`);
      if (r.pages) {
        const [a, b] = r.pages.split(/[-–]/);
        if (a) L.push(`SP  - ${a.trim()}`);
        if (b) L.push(`EP  - ${b.trim()}`);
      }
    }

    if (r.doi)   L.push(`DO  - ${r.doi}`);
    if (r.url)   L.push(`UR  - ${r.url}`);
    L.push('ER  - ');
    return L.join('\r\n');       // ڕێنماییەکەی RIS داوای CRLF دەکات
  });

  return {
    text: out.join('\r\n\r\n') + '\r\n',
    count: good.length,
    skipped: refs.length - good.length,
  };
}

// ─────────── لیستی ئامادە ───────────
//
// ئەمە هەموو سەرچاوەکان دەگرێتەوە — تەنانەت ئەوانەی خانەی پێکهاتەییان
// نییە — چونکە ڕستەکەیان پێشتر دروستکراوە.
//
// ئەگەر شێوازێک بنێردرێت، ئەوانەی خانەی پێکهاتەییان هەیە **لەنوێ**
// دەنووسرێنەوە بەو شێوازە. واتە بەکارهێنەر دەتوانێت دوای دروستکردنیش
// شێوازەکە بگۆڕێت بەبێ ئەوەی دووبارە بگەڕێت.

export function toTextList(refs: Reference[], style?: CiteStyleId): CiteResult {
  const st = styleById(style);
  const lines = restyle(refs, style).map(r => r.text.trim()).filter(Boolean);
  const ordered = st.numbered
    ? lines.map((l, i) => `${st.marker(i + 1)}  ${l}`)
    : [...lines].sort((a, b) => a.localeCompare(b, 'en'));

  return { text: header('', st.name) + ordered.join('\n\n') + '\n',
           count: ordered.length, skipped: 0 };
}

/** ناوی کۆنە — هێشتا APA دەداتەوە */
export const toApaList = (refs: Reference[]) => toTextList(refs, 'apa');

/**
 * سەرچاوەکان بە شێوازێکی تر دەنووسێتەوە.
 *
 * تەنها ئەوانەی خانەی پێکهاتەییان هەیە دەگۆڕدرێن — ئەوانی تر وەک
 * خۆیان دەمێننەوە. بەبێ نووسەر و ساڵ و ناونیشانی جیاکراوە ناتوانرێت
 * شێوازێکی نوێ دروست بکرێت، و ئێمە هەرگیز خانە هەڵنابەستین.
 */
export function restyle(refs: Reference[], style?: CiteStyleId): Reference[] {
  if (!style) return refs;
  return refs.map(r => {
    if (!isStructured(r)) return r;
    const text = formatCite({
      kind: r.kind ?? 'paper',
      title: r.title ?? '',
      authors: r.authors ?? [],
      year: r.year, venue: r.venue, publisher: r.publisher, edition: r.edition,
      volume: r.volume, issue: r.issue, pages: r.pages,
      doi: r.doi, url: r.url, isbn: r.isbn,
    }, style);
    return text ? { ...r, text } : r;
  });
}

/** سەردێڕێکی کورت — دەڵێت ئەم فایلە چۆن دروستبووە */
function header(comment: string, style?: string): string {
  const c = comment ? comment + ' ' : '';
  return `${c}Generated by Presentation Studio${style ? ` — ${style}` : ''}\n` +
         `${c}Sources: OpenAlex, Crossref, DOAJ, Open Library — every entry is real.\n\n`;
}

export type CiteFormat = 'bib' | 'ris' | 'txt';

export const FORMATS: { id: CiteFormat; name: string; ext: string; mime: string; note: string }[] = [
  { id: 'bib', name: 'BibTeX', ext: 'bib', mime: 'application/x-bibtex',
    note: 'بۆ LaTeX و Overleaf' },
  { id: 'ris', name: 'RIS',    ext: 'ris', mime: 'application/x-research-info-systems',
    note: 'بۆ Mendeley، EndNote، Zotero' },
  { id: 'txt', name: 'لیست',   ext: 'txt', mime: 'text/plain;charset=utf-8',
    note: 'بە شێوازی هەڵبژێردراو، ئامادە بۆ کۆپیکردن' },
];

export function build(refs: Reference[], f: CiteFormat, style?: CiteStyleId): CiteResult {
  return f === 'bib' ? toBibtex(restyle(refs, style))
       : f === 'ris' ? toRis(restyle(refs, style))
       : toTextList(refs, style);
}

/** هەموو سەرچاوەکانی دێککێک — لە هەموو سلایدەکانەوە، بەبێ دووبارە */
export function collect(slides: { refs?: Reference[] }[]): Reference[] {
  const seen = new Set<string>();
  const out: Reference[] = [];
  for (const s of slides)
    for (const r of s.refs ?? []) {
      const k = (r.doi ?? r.text).toLowerCase().trim();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  return out;
}
