// ═══════════ داتای ڕاستەقینە و وێنەی بێبەرامبەر ═══════════
// هیچ کلیلێکیان ناوێت و CORS یان کراوەیە (پشکنراوە).

import { fetchWithTimeout } from '../net';

// ─────────── Openverse — وێنەی Creative Commons ───────────
// بێبەرامبەر، بێ کلیل، بێ نیشانەی ئاوی، مۆڵەتی ڕوونی هەیە.
// جیاوازە لە وێنەی AI: ئەمانە وێنەی ڕاستەقینەن و خۆڕاییش.

export interface FreeImage {
  title: string;
  url: string;
  thumb: string;
  license: string;
  creator: string;
  attribution: string;
  width: number;
  height: number;
  /** ناوی سەرچاوەکە لای Openverse — met، nasa، flickr… */
  provider: string;
}

const LICENSE_NAME: Record<string, string> = {
  'cc0': 'CC0 — بێ مەرج',
  'pdm': 'Public Domain',
  'by': 'CC BY — ناوی خاوەنەکەی بنووسە',
  'by-sa': 'CC BY-SA',
  'by-nc': 'CC BY-NC — نەبێت بۆ بازرگانی',
  'by-nd': 'CC BY-ND',
  'by-nc-sa': 'CC BY-NC-SA',
  'by-nc-nd': 'CC BY-NC-ND',
};

/**
 * ئایا ئەم مۆڵەتە «گۆڕانکاری» قەدەغە دەکات؟ (ND = No Derivatives)
 *
 * ئەمە گرنگە چونکە ئێمە وێنەکان **دەبڕین**: لە PPTX دا
 * `sizing: { type: 'cover' }` بەکاردێت، واتە وێنەکە بۆ ڕێژەی
 * چوارچێوەکە دەبڕدرێت. بڕین گۆڕانکارییە، و ND ڕێگەی پێنادات.
 *
 * پێشتر `license_type=all-cc` بەکاردەهات، کە ND ـیش لەخۆ دەگرێت —
 * لە پێوانەیەکدا ١٥٪ تا ٣٥٪ی ئەنجامەکان ND بوون.
 */
const isND = (lic: string) => lic.split('-').includes('nd');

/** مۆڵەتی گشتی — ناوهێنان پێویست ناکات (بەڵام هەر دەینووسین) */
const PD = new Set(['cc0', 'pdm']);

// ─── تاقیکراوەتەوە و ڕەتکراوەتەوە: پێشخستنی مۆزەخانەکان ───
//
// Openverse مۆزەخانەکانیش فێرست دەکات — met (٤٩٧ هەزار وێنە)،
// nasa (١٣٢ هەزار)، Rijksmuseum، Wellcome، Europeana. بیرۆکەکە ئەوە
// بوو کە ئەمانە پێش Flickr بخرێن، چونکە بۆ کارێکی زانکۆیی جێی
// متمانەترن.
//
// پێوانە کرا، و شکستی هێنا. بە `source=` ـەوە سێ لە چوار بابەت هیچ
// ئەنجامێکیان نەبوو، و لەوەی مایەوە («human anatomy») تابلۆیەکی
// Rijksmuseum هاتەوە بە ناوی «خواوەندەکانی ئۆلێمپ لە هەوردا» — هیچ
// پەیوەندییەکی نەبوو. کۆکراوەی مۆزەخانەکان زۆربەی هونەری مێژووییە،
// نەک وێنەی ڕوونکەرەوەی بابەتێکی وەک وزەی نوێبووەوە.
//
// بۆیە نەخرایە کۆدەوە. ئەم تێبینییە دەمێنێتەوە تا دووبارە تاقی
// نەکرێتەوە.

interface RawImage {
  title?: string; url?: string; thumbnail?: string; license?: string;
  creator?: string; width?: number; height?: number; source?: string;
}

async function openverse(query: string, count: number, strict: boolean): Promise<RawImage[]> {
  const url = new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(count));
  url.searchParams.set('mature', 'false');

  if (strict) {
    // `commercial,modification` واتە: بازرگانی ڕێپێدراوە **و** گۆڕانکاری
    // ڕێپێدراوە. ئەمە NC و ND هەردووکیان دەردەکات و cc0، pdm، by، by-sa
    // بەجێدەهێڵێت — تەنها ئەوانەی دەتوانین ببڕین و بڵاویان بکەینەوە.
    url.searchParams.set('license_type', 'commercial,modification');
    // وێنەی بچووک لەسەر کارتێکی ١٥٩٦px تەم دەردەکەوێت. بەبێ ئەم
    // پاڵاوتنە پانی ناوەند ١٠٢٤px بوو.
    url.searchParams.set('size', 'large');
    // SVG نابێت بچێتە PPTX ـەوە — PowerPoint بە شکاوی پیشانی دەدات
    // (بڕوانە تێبینییەکانی گوشین لە imagetool.ts). ئەم پاڵاوتنە
    // تەواو دڵنیا نییە، بۆیە خوارەوەش دووبارە دەپشکنرێت.
    url.searchParams.set('extension', 'jpg,png');
  }

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const data = await res.json() as { results?: RawImage[] };
  return data.results ?? [];
}

/**
 * پلەبەندی: مۆڵەتی گشتی پێش ناوهێنان، گەورە پێش بچووک.
 *
 * بەهاکان بچووکن بە ئەنقەست — ڕیزبەندی پەیوەندیداری Openverse
 * سەرەکییە، و ئەمانە تەنها نێوان دوو ئەنجامی هاوشێوە جیا دەکەنەوە.
 * ئەگەر گەورە بن، وێنەیەکی گەورەی بێپەیوەند دەبێتە یەکەم.
 */
function score(r: RawImage): number {
  return (PD.has((r.license ?? '').toLowerCase()) ? 0.15 : 0)
    + Math.min(0.20, Math.log10(1 + (r.width ?? 0)) / 22);
}

export async function searchImages(query: string, count = 8): Promise<FreeImage[]> {
  // پاڵاوتنی توند سەرەتا. ئەگەر هیچی نەهێنا — بابەتێکی تەسک، یان
  // پاڵاوتنەکان زۆر توند بوون — پاڵاوتنی سووکتر تاقی دەکەینەوە،
  // بەڵام ND هەرگیز ڕێگەی پێنادرێت.
  let raw = await openverse(query, count * 2, true);
  if (raw.length < Math.min(3, count)) {
    const loose = await openverse(query, count * 3, false);
    const seen = new Set(raw.map(r => r.url));
    raw = raw.concat(loose.filter(r => r.url && !seen.has(r.url)));
  }

  return raw
    .filter(r => !!r.url && !isND((r.license ?? '').toLowerCase()))
    .filter(r => !/\.svg(\?|$)/i.test(r.url!))
    .sort((a, b) => score(b) - score(a))
    .slice(0, count)
    .map(r => ({
      title: r.title ?? 'بێ ناونیشان',
      url: r.url!,
      thumb: r.thumbnail ?? r.url!,
      license: LICENSE_NAME[r.license ?? ''] ?? (r.license ?? '').toUpperCase(),
      creator: r.creator ?? 'نەناسراو',
      attribution: `${r.title ?? ''} — ${r.creator ?? ''} (${(r.license ?? '').toUpperCase()})`.trim(),
      width: r.width ?? 0,
      height: r.height ?? 0,
      provider: r.source ?? '',
    }));
}

/** وێنە دەکاتە data: URI تا لە PPTX و PDF دا بمێنێتەوە */
export async function imageToDataUrl(url: string): Promise<string> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`وێنەکە دانەگیرا (${res.status})`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('وێنەکە خوێندنەوەی بۆ نەکرا'));
    fr.readAsDataURL(blob);
  });
}

// ─────────── World Bank — ئاماری ڕاستەقینە ───────────
// لەبری ئەوەی AI ژمارە هەڵبەستێت، ژمارەی ڕاستەقینە دەهێنین.

export interface Indicator { code: string; name: string }

/** ئەو پێوەرانەی زۆرترین بەکارهێنانیان هەیە لە پێشکەشکردنی خوێندکاریدا */
export const INDICATORS: Indicator[] = [
  { code: 'IT.NET.USER.ZS',      name: 'ڕێژەی بەکارهێنەرانی ئینتەرنێت (٪)' },
  { code: 'IT.CEL.SETS.P2',      name: 'بەشداربووی مۆبایل بۆ هەر ١٠٠ کەس' },
  { code: 'SP.POP.TOTL',         name: 'ژمارەی دانیشتوان' },
  { code: 'NY.GDP.MKTP.CD',      name: 'GDP بە دۆلار' },
  { code: 'NY.GDP.PCAP.CD',      name: 'GDP بۆ هەر کەسێک' },
  { code: 'SE.ADT.LITR.ZS',      name: 'ڕێژەی خوێندەواری (٪)' },
  { code: 'SE.XPD.TOTL.GD.ZS',   name: 'خەرجی پەروەردە (٪ی GDP)' },
  { code: 'EG.ELC.ACCS.ZS',      name: 'دەستڕاگەیشتن بە کارەبا (٪)' },
  { code: 'SL.UEM.TOTL.ZS',      name: 'ڕێژەی بێکاری (٪)' },
  { code: 'SP.DYN.LE00.IN',      name: 'چاوەڕوانی ژیان (ساڵ)' },
  { code: 'EN.GHG.CO2.PC.CE.AR5',name: 'دەردانی CO₂ بۆ هەر کەسێک' },
  { code: 'SH.XPD.CHEX.GD.ZS',   name: 'خەرجی تەندروستی (٪ی GDP)' },
  { code: 'GB.XPD.RSDV.GD.ZS',   name: 'خەرجی توێژینەوە (٪ی GDP)' },
];

export interface StatSeries {
  country: string;
  indicator: string;
  labels: string[];    // ساڵەکان، لە کۆنەوە بۆ نوێ
  values: number[];
  source: string;
}

/**
 * @param country کۆدی وڵات — IRQ، USA، WLD (جیهان)، ARB (وڵاتانی عەرەبی)
 */
export async function worldBank(
  country: string, indicator: string, from = 2010, to = 2023,
): Promise<StatSeries> {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(country)}` +
    `/indicator/${encodeURIComponent(indicator)}` +
    `?format=json&per_page=100&date=${from}:${to}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`World Bank ${res.status}`);

  const json = await res.json() as [
    unknown,
    { country?: { value?: string }; indicator?: { value?: string }; date?: string; value?: number | null }[] | null,
  ];
  const rows = json[1] ?? [];
  if (!rows.length) throw new Error('هیچ داتایەک بۆ ئەم وڵات و پێوەرە نییە');

  // تەنها ساڵانی داتادار، لە کۆنەوە بۆ نوێ
  const usable = rows
    .filter(r => typeof r.value === 'number')
    .sort((a, b) => Number(a.date) - Number(b.date));

  if (!usable.length) throw new Error('هەموو ساڵەکان بەتاڵن بۆ ئەم پێوەرە');

  return {
    country: usable[0].country?.value ?? country,
    indicator: usable[0].indicator?.value ?? indicator,
    labels: usable.map(r => r.date ?? ''),
    values: usable.map(r => Math.round((r.value as number) * 100) / 100),
    source: 'World Bank Open Data (data.worldbank.org)',
  };
}

// ─────────── گەڕانی وێب بە کلیلی بەکارهێنەر ───────────
// ئەمانە Gemini سووکتر دەکەن — گەڕان لە خزمەتێکی تایبەتەوە دێت،
// و Gemini تەنها دەقەکە دەنووسێت.

export type SearchEngine = 'tavily' | 'brave' | 'serper';

export interface SearchHit { title: string; url: string; snippet: string; domain: string }

export interface EngineInfo {
  id: SearchEngine;
  name: string;
  keyUrl: string;
  site: string;
  free: string;
  prefix: string;
  howTo: string[];
}

export const ENGINES: EngineInfo[] = [
  {
    id: 'tavily', name: 'Tavily', site: 'tavily.com',
    keyUrl: 'https://app.tavily.com/home',
    free: '١٠٠٠ گەڕان لە مانگێکدا بێبەرامبەر', prefix: 'tvly-',
    howTo: [
      'بڕۆ بۆ app.tavily.com',
      'بە Google بچۆ ژوورەوە',
      'کلیلەکە لە داشبۆردەکە کۆپی بکە',
    ],
  },
  {
    id: 'brave', name: 'Brave Search', site: 'brave.com/search/api',
    keyUrl: 'https://api-dashboard.search.brave.com/register',
    free: '٢٠٠٠ گەڕان لە مانگێکدا بێبەرامبەر', prefix: 'BSA',
    howTo: [
      'بڕۆ بۆ api-dashboard.search.brave.com',
      'هەژمارێک دروست بکە و پلانی Free هەڵبژێرە',
      'لە بەشی API Keys کلیلێک دروست بکە',
    ],
  },
  {
    id: 'serper', name: 'Serper (Google)', site: 'serper.dev',
    keyUrl: 'https://serper.dev/api-key',
    free: '٢٥٠٠ گەڕانی سەرەتایی بێبەرامبەر', prefix: '',
    howTo: [
      'بڕۆ بۆ serper.dev',
      'بە Google بچۆ ژوورەوە',
      'کلیلەکە لە لاپەڕەی API Key کۆپی بکە',
    ],
  },
];

const domainOf = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
};

export async function webSearch(
  engine: SearchEngine, key: string, query: string, count = 8,
): Promise<SearchHit[]> {
  if (!key) throw new Error('کلیلی مەکینەی گەڕان دانەنراوە.');

  if (engine === 'tavily') {
    const res = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, max_results: count, search_depth: 'basic' }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const d = await res.json() as { results?: { title?: string; url?: string; content?: string }[] };
    return (d.results ?? []).map(r => ({
      title: r.title ?? '', url: r.url ?? '',
      snippet: (r.content ?? '').slice(0, 400), domain: domainOf(r.url ?? ''),
    }));
  }

  if (engine === 'brave') {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(count));
    const res = await fetchWithTimeout(url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    });
    if (!res.ok) throw new Error(`Brave ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const d = await res.json() as {
      web?: { results?: { title?: string; url?: string; description?: string }[] };
    };
    return (d.web?.results ?? []).map(r => ({
      title: r.title ?? '', url: r.url ?? '',
      snippet: (r.description ?? '').replace(/<[^>]+>/g, '').slice(0, 400),
      domain: domainOf(r.url ?? ''),
    }));
  }

  // serper
  const res = await fetchWithTimeout('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
    body: JSON.stringify({ q: query, num: count }),
  });
  if (!res.ok) throw new Error(`Serper ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const d = await res.json() as { organic?: { title?: string; link?: string; snippet?: string }[] };
  return (d.organic ?? []).map(r => ({
    title: r.title ?? '', url: r.link ?? '',
    snippet: (r.snippet ?? '').slice(0, 400), domain: domainOf(r.link ?? ''),
  }));
}
