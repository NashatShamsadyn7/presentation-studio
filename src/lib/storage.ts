// ═══════════ خەزنکردن — تەنها لە وێبگەڕی بەکارهێنەردا ═══════════
// هیچ سێرڤەرێک، هیچ داتابەیسێک، هیچ هەژمارێک.
//   • کلیلەکانی API → localStorage
//   • پرۆژەکان      → IndexedDB (خۆکار پاشەکەوت دەکرێت)
//   • هەناردە/هاوردە → فایلی .json

import type { Deck, Lang, SlideElement, TitleInfo } from './types';
import { LAYOUTS } from './layouts';
import { upgradeDeck } from './deck/model';
import { compressImage, dataUrlBytes } from './imagetool';
import { EMPTY_KEYS, type Keys } from './llm';

const KEYS_LS = 'ps.keys.v2';
const KEYS_LS_OLD = 'ps.keys.v1';
const DB_NAME = 'presentation-studio';
const STORE   = 'decks';

// ─────────── کلیلەکان ───────────

export function loadKeys(): Keys {
  if (typeof window === 'undefined') return EMPTY_KEYS;
  try {
    const raw = localStorage.getItem(KEYS_LS);
    if (raw) {
      const k = JSON.parse(raw) as Partial<Keys>;
      return { ...EMPTY_KEYS, ...k, keys: { ...k.keys } };
    }

    // گواستنەوە لە شێوازی کۆنەوە — بەکارهێنەر کلیلەکەی لەدەست نادات
    const old = localStorage.getItem(KEYS_LS_OLD);
    if (old) {
      const o = JSON.parse(old) as { gemini?: string; openai?: string };
      const migrated: Keys = {
        ...EMPTY_KEYS,
        keys: { gemini: o.gemini ?? '', openai: o.openai ?? '' },
      };
      localStorage.setItem(KEYS_LS, JSON.stringify(migrated));
      return migrated;
    }
  } catch { /* داتای تێکچوو — بە بەتاڵی دەستپێدەکەینەوە */ }
  return EMPTY_KEYS;
}

export function saveKeys(k: Keys) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS_LS, JSON.stringify(k));
}

export function clearKeys() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS_LS);
  localStorage.removeItem(KEYS_LS_OLD);
}

// ─────────── پرۆفایلی زانکۆ ───────────
//
// ناوی زانکۆ، بەش، مامۆستا و خوێندکارەکان لە هەموو پێشکەشکردنێکی
// هەمان بەکارهێنەردا هەمان شتن — تەنها ناونیشانەکە دەگۆڕێت.
// بۆیە جارێک پڕ دەکرێنەوە و دواتر خۆکار دێنە ناوەوە.

const PROFILE_LS = 'ps.profile.v1';

/** هەرچی دووبارە دەبێتەوە — ناونیشان تێدا نییە، چونکە هەر جارە دەگۆڕێت */
export type Profile = Omit<TitleInfo, 'title'> & { lang: Lang };

export function loadProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_LS);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    // بەلایەنی کەمەوە ناوی زانکۆ — ئەگەرنا پرۆفایلەکە بەکەڵک نایەت
    return p && typeof p.university === 'string' && p.university.trim() ? p : null;
  } catch { return null; }
}

export function saveProfile(ti: TitleInfo, lang: Lang) {
  if (typeof window === 'undefined') return;
  const { title: _t, ...rest } = ti;
  const p: Profile = { ...rest, lang };
  try {
    localStorage.setItem(PROFILE_LS, JSON.stringify(p));
  } catch {
    // لۆگۆکە data: URI ـە و دەتوانێت localStorage پڕ بکات.
    // پرۆفایلی بێ لۆگۆ لە هیچ باشترە.
    try { localStorage.setItem(PROFILE_LS, JSON.stringify({ ...p, logoUrl: undefined })); }
    catch { /* شوێن نەما — بەبێ پاشەکەوت بەردەوام دەبین */ }
  }
}

export function clearProfile() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROFILE_LS);
}

// ─────────── IndexedDB ───────────

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);

    // پێشتر `close()` تەنها لە `oncomplete` دا بوو. ئەگەر مامەڵەکە
    // شکستی بهێنایە — کە لەگەڵ وێنەی گەورە و ڕێژەی پڕ دا زۆر ڕوودەدات —
    // پەیوەندییەکە بۆ هەتاهەتایە کراوە دەمایەوە، و پەیوەندییەکی کراوە
    // **ڕێگری لە بەرزکردنەوەی وەشانی داتابەیس دەکات**. واتە هەر
    // گۆڕانکارییەکی داهاتوو لە پێکهاتەی خەزنەکە دا بێدەنگ ڕادەوەستێت.
    const done = () => db.close();
    t.oncomplete = done;
    t.onerror = done;
    t.onabort = done;
  }));
}

export const saveDeck = (d: Deck) =>
  tx('readwrite', s => s.put({ ...d, updatedAt: Date.now() }));

/**
 * دێککێک دەخوێنێتەوە **و دەیهێنێتە شێوەی نوێ**.
 *
 * ═══ بۆچی لێرەدا، نەک لە شوێنێکی تر ═══
 * ئەمە تاکە ڕێگایە بۆ ناو ئەپەکە. ئەگەر هێنانەکە لێرەدا نەبێت،
 * دێککی کۆنی بەکارهێنەر سەرچاوەکانی بەبێ ناسنامە دەمێننەوە و
 * ئاماژەکانی سەر سلاید **بێدەنگ** کار ناکەن — تایبەتمەندییەک کە
 * بۆ دێککی نوێ هەیە و بۆ کۆنەکان نا.
 */
export const loadDeck = (id: string) =>
  tx<Deck | undefined>('readonly', s => s.get(id))
    .then(d => (d ? upgradeDeck(d) : d));

export const listDecks = () =>
  tx<Deck[]>('readonly', s => s.getAll()).then(all =>
    all.sort((a, b) => b.updatedAt - a.updatedAt).map(upgradeDeck));

export const deleteDeck = (id: string) =>
  tx('readwrite', s => s.delete(id));

// ─────────── قەبارەی دێکک ───────────

/** کۆی بایتی هەموو وێنەکانی دێککێک — بۆ پیشاندان بە بەکارهێنەر */
export function deckImageBytes(d: Deck): number {
  let n = d.titleInfo.logoUrl ? dataUrlBytes(d.titleInfo.logoUrl) : 0;
  for (const s of d.slides) {
    if (s.imageUrl) n += dataUrlBytes(s.imageUrl);
    for (const e of s.elements ?? [])
      if (e.kind === 'image') n += dataUrlBytes(e.value);
  }
  return n;
}

/**
 * هەموو وێنەکانی دێککێک دەگوشێت.
 *
 * وێنەکان لە سەرچاوەوە دەگوشرێن (`slideImage.ts` و `readImage`)، بۆیە
 * ئەمە بۆ ئەو ڕێگایانەیە کە کۆنترۆڵمان بەسەریاندا نییە: فایلێکی
 * هاوردەکراو، یان دێککێکی کۆن کە پێش گوشین دروستکراوە.
 */
export async function compressDeck(d: Deck): Promise<Deck> {
  const slides = await Promise.all(d.slides.map(async s => {
    const out = { ...s };
    if (s.imageUrl) out.imageUrl = await compressImage(s.imageUrl);
    if (s.elements?.some(e => e.kind === 'image'))
      out.elements = await Promise.all(s.elements.map(async e =>
        e.kind === 'image' ? { ...e, value: await compressImage(e.value) } : e));
    return out;
  }));

  const logoUrl = d.titleInfo.logoUrl
    ? await compressImage(d.titleInfo.logoUrl, 512)
    : d.titleInfo.logoUrl;

  return { ...d, slides, titleInfo: { ...d.titleInfo, logoUrl } };
}

// ─────────── هەناردە / هاوردە ───────────

export function exportDeck(deck: Deck) {
  const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
  const name = (deck.titleInfo.title || 'presentation')
    .replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 60) || 'presentation';
  download(blob, `${name}.psproj.json`);
}

/** ٦٠ مێگابایت — لەوە گەورەتر پێش شیکردنەوە ڕەت دەکرێتەوە،
 *  چونکە JSON.parse لەسەر فایلێکی گەورە وێبگەڕەکە دەبەستێتەوە. */
const MAX_IMPORT = 60 * 1024 * 1024;

/** تەنها ئەم جۆرانەی وێنە ڕێپێدراون.
 *
 *  image/svg+xml بە ئەنقەست نییە: SVG فۆرماتێکی چالاکە و دەتوانێت
 *  <script> لەخۆبگرێت. پرۆژەیەکی هاوردەکراو فایلێکی بێگانەیە —
 *  نابێت کۆدی تێدابێت. */
const IMG_OK = /^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,/i;

const cleanImage = (v: unknown) =>
  typeof v === 'string' && IMG_OK.test(v) ? v : undefined;

/** ژمارەیەکی سەلامەت — `NaN`، `Infinity` و زنجیرە ڕەت دەکرێنەوە */
const num = (v: unknown, fallback: number, lo = -10_000, hi = 10_000): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/**
 * توخمە زیادکراوەکانی سلایدێکی هاوردەکراو پاک دەکاتەوە.
 *
 * ─── بۆچی ئەمە پێویست بوو ───
 * پێشتر `imageUrl` دەپشکنرا بەڵام `elements` بە تەواوی بەبێ پشکنین
 * تێدەپەڕی، لە کاتێکدا سەرەوەی خۆی دەیوت «هەر خانەیەک دەپشکنرێت».
 * دوو ئەنجامی ڕاستەقینەی هەبوو:
 *
 *   ١) توخمێکی وێنە دەیتوانی ناونیشانی **دەرەکی** هەڵبگرێت (نەک
 *      `data:`). فایلێکی .psproj.json کە خوێندکارەکان لەنێوان
 *      خۆیاندا دەیگۆڕنەوە، بە کردنەوەی خۆی داواکارییەکی تۆڕی لە
 *      وێبگەڕی بەکارهێنەرەوە دەنارد — واتە IP و کاتی کردنەوە بۆ
 *      کەسێکی نەناسراو. ئەمە دژی بنەمای سەرەکی پرۆژەکەیە: هیچ شتێک
 *      وێبگەڕەکە بەجێناهێڵێت.
 *
 *   ٢) `x/y/w/h` دەیتوانن `NaN` یان زنجیرە بن. ئەو کاتە شێوازی CSS
 *      پووچ دەبێت، توخمەکە لە شوێنێکی نادیار دەردەکەوێت، و لە
 *      هەناردەی pptx ـدا XML ـێکی پووچ دروست دەکات.
 */
function cleanElements(raw: unknown): SlideElement[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const out: SlideElement[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const el = e as Partial<SlideElement>;
    if (!['icon', 'shape', 'text', 'image'].includes(el.kind as string)) continue;
    if (typeof el.value !== 'string') continue;

    // وێنە دەبێت `data:` بێت و لە جۆرە ڕێپێدراوەکان بێت — وەک `imageUrl`.
    // ئایکۆن و شێوە بە ناسنامە دەگەڕێن (ناسنامەیەکی نەناسراو بەتاڵ
    // دەگەڕێتەوە، بۆیە مەترسی نییە)، و دەق تەنها دەقە.
    if (el.kind === 'image' && !IMG_OK.test(el.value)) continue;

    out.push({
      id: typeof el.id === 'string' && el.id ? el.id : Math.random().toString(36).slice(2, 10),
      kind: el.kind as SlideElement['kind'],
      value: el.value.slice(0, el.kind === 'image' ? Infinity : 2000),
      x: num(el.x, 0), y: num(el.y, 0),
      w: num(el.w, 200, 1, 4000), h: num(el.h, 200, 1, 4000),
      ...(el.frame && ['none', 'round', 'circle', 'square'].includes(el.frame)
        ? { frame: el.frame } : {}),
      ...(typeof el.borderColor === 'string' ? { borderColor: el.borderColor.slice(0, 40) } : {}),
      ...(el.borderWidth !== undefined ? { borderWidth: num(el.borderWidth, 0, 0, 100) } : {}),
      ...(el.rotate !== undefined ? { rotate: num(el.rotate, 0, -360, 360) } : {}),
      ...(typeof el.color === 'string' ? { color: el.color.slice(0, 40) } : {}),
      ...(el.strokeWidth !== undefined ? { strokeWidth: num(el.strokeWidth, 2, 0.5, 10) } : {}),
      ...(el.fontSize !== undefined ? { fontSize: num(el.fontSize, 44, 6, 400) } : {}),
      ...(typeof el.bold === 'boolean' ? { bold: el.bold } : {}),
      ...(typeof el.italic === 'boolean' ? { italic: el.italic } : {}),
      ...(el.opacity !== undefined ? { opacity: num(el.opacity, 1, 0, 1) } : {}),
    });
  }

  return out.length ? out : undefined;
}

export function importDeck(file: File): Promise<Deck> {
  if (file.size > MAX_IMPORT)
    return Promise.reject(new Error(
      `فایلەکە زۆر گەورەیە (${Math.round(file.size / 1048576)} مێگابایت). زۆرترین ٦٠ مێگابایتە.`));

  return file.text().then(t => {
    let raw: unknown;
    try { raw = JSON.parse(t); }
    catch { throw new Error('ئەم فایلە JSON ـێکی دروست نییە.'); }

    const d = raw as Deck;
    if (!d || typeof d !== 'object' || !Array.isArray(d.slides))
      throw new Error('ئەم فایلە پرۆژەیەکی دروست نییە.');

    // ناوەڕۆکەکە لە دەرەوەوە هاتووە — هەر خانەیەک دەپشکنرێت.
    // تەختەبەندێکی نەناسراو لە ڕەندەرەکەدا سلایدێکی بەتاڵ دەردەخات،
    // بۆیە دەگەڕێتەوە بۆ تەختەبەندێکی سەلامەت لەبری ئەوەی تێک بچێت.
    d.slides = d.slides.filter(s => s && typeof s === 'object').map(s => ({
      ...s,
      id: typeof s.id === 'string' && s.id ? s.id : Math.random().toString(36).slice(2, 10),
      layout: LAYOUTS.some(l => l.id === s.layout) ? s.layout : 'L_bullets',
      title: typeof s.title === 'string' ? s.title : '',
      bullets: Array.isArray(s.bullets) ? s.bullets.filter(b => typeof b === 'string') : [],
      imageUrl: cleanImage(s.imageUrl),
      elements: cleanElements(s.elements),
      overrides: s.overrides && typeof s.overrides === 'object' ? s.overrides : {},
    }));

    if (!d.slides.length) throw new Error('ئەم پرۆژەیە هیچ سلایدێکی تێدا نییە.');
    if (!['ckb', 'ar', 'en'].includes(d.lang)) d.lang = 'ckb';

    // دەق و دابەشکردنی قسەکەران — ئەمانیش لە دەرەوەوە هاتوون.
    // ئەگەر `speakers` ڕیزە نەبێت، `speakerAt` لە دۆخی پێشکەشکاردا
    // دەشکێت. بۆیە یان ڕیزەیەکی پاککراوە، یان هیچ.
    d.script = typeof d.script === 'string' ? d.script.slice(0, 100_000) : undefined;
    d.thesis = typeof d.thesis === 'string' ? d.thesis.slice(0, 400) : undefined;
    // `Number(...)` نەک `Number.isFinite(...)` — تاکو وەک ژمارەکانی
    // قسەکەران هەڵسوکەوت بکرێت. فایلێکی دەستی دەکرێت «١٥»ی وەک
    // زنجیرە تێدابێت، و ڕەتکردنەوەی ئەوە هیچ سوودێکی نییە.
    const mins = Number(d.totalMinutes);
    d.totalMinutes = Number.isFinite(mins) && mins > 0
      ? Math.min(600, Math.round(mins)) : undefined;
    d.speakers = Array.isArray(d.speakers)
      ? d.speakers
          .filter(s => s && typeof s === 'object' && typeof s.name === 'string')
          .map(s => ({
            name: s.name.slice(0, 60),
            from: Math.max(1, Math.round(Number(s.from)) || 1),
            to: Math.max(1, Math.round(Number(s.to)) || 1),
            minutes: Math.max(0, Math.round(Number(s.minutes)) || 0),
          }))
      : undefined;
    if (!d.speakers?.length) d.speakers = undefined;

    d.id = Math.random().toString(36).slice(2, 10);   // ناسنامەی نوێ وەردەگرێت
    d.updatedAt = Date.now();

    // بەشەکان لە دەرەوەوە هاتوون — تەنها ئەوانەی شێوەیان دروستە
    d.sections = Array.isArray(d.sections)
      ? d.sections
          .filter(x => x && typeof x === 'object' && typeof x.id === 'string'
                       && typeof x.title === 'string')
          .map(x => ({
            id: x.id.slice(0, 40),
            title: x.title.slice(0, 120),
            hint: typeof x.hint === 'string' ? x.hint.slice(0, 400) : '',
            sources: Array.isArray(x.sources)
              ? x.sources.filter(v => typeof v === 'string').map(v => v.slice(0, 40))
              : [],
          }))
      : undefined;
    if (!d.sections?.length) d.sections = undefined;

    // فایلێکی هاوردەکراو دەکرێت وێنەی خاوی تێدابێت — لێرەدا دەگوشرێن،
    // ئەگەرنا لە IndexedDB و لە دەستەی پووچکردنەوەدا دەمێننەوە.
    return compressDeck(upgradeDeck(d));
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
