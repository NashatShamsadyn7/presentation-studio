'use client';

// ═══════════ لاپەڕەی دەستپێک ═══════════
//
// فۆرم نییە — گفتوگۆیەکە. ئەیجێنت پرسیارێک دەکات، تۆ وەڵام دەدەیتەوە،
// وەڵامەکە دەبێتە بابڵێکی بچووک و پرسیاری دواتر دێت. هەر بابڵێکی
// تەواوبوو کلیکی لێدەکرێت بۆ گەڕانەوە و گۆڕینی.
//
// زانیاری زانکۆ لە هەموو پێشکەشکردنێکدا هەمانە، بۆیە جارێک دەپرسرێت
// و دواتر تەنها پشتڕاست دەکرێتەوە.

import { useEffect, useMemo, useRef, useState } from 'react';
import { suggestOutline, findResearch, type OutlineItem, type Research } from '@/lib/research';
import { compose } from '@/lib/deck/compose';
import { citedRefs, mkId, type Section } from '@/lib/deck/model';
import { verify, summarise } from '@/lib/deck/verify';
import type { GroundingSource } from '@/lib/llm';
import { defaultFontFor, fontsFor, DECK_FONTS } from '@/lib/fonts';
import { generateSlides, buildDeck } from '@/lib/generate';
import { runCrew, STAGES } from '@/lib/crew/run';
import type { StageReport } from '@/lib/crew/types';
import { pickTextProvider, type Keys } from '@/lib/llm';
import { resolveImage, promptFromTitle } from '@/lib/tools/slideImage';
import { layoutById } from '@/lib/layouts';
import { providerById, requiresGemini, type ProviderId } from '@/lib/providers';
import KeyPanel, { ProviderPicker } from './KeyPanel';
import Mascot from './Mascot';
import ThemePicker from './ThemePicker';
import { THEMES } from '@/lib/themes';
import { styleById as deckStyleById, DENSITIES, type StyleId, type Density } from '@/lib/styles';
import {
  CITE_STYLES, SOURCE_KINDS, DEMO, formatCite, styleById,
  type CiteStyleId, type SourceKind,
} from '@/lib/citestyle';
import { newSlide, type Deck, type Lang, type Reference, type Slide, type Speaker,
         type TitleInfo } from '@/lib/types';
import {
  parseScript, autoSplit, checkSpeakers, suggestSlides, expectedMinutes,
} from '@/lib/script';
import { saveKeys, loadProfile, saveProfile, clearProfile } from '@/lib/storage';
import { compressImage } from '@/lib/imagetool';

const PREFIXES = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Assist. Lect.'];

/** ژمارە بە پیتی عەرەبی — وەک هەموو ڕووکارەکە */
/** ناوی خوێندنەوەیی فۆنتێک لە بەهای CSS ـەکەیەوە */
const fontName = (v: string) => DECK_FONTS.find(f => f.v === v)?.n ?? v.split(',')[0];

const AR = (n: number | string) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);

/** قەبارەکان بە ناو — «١٤ سلاید» هیچ ناڵێت، «ئاسایی» دەڵێت */
const SIZES = [
  { id: 'short',    name: 'کورت',   range: '٨–١٠',  n: 10 },
  { id: 'normal',   name: 'ئاسایی', range: '١٢–١٥', n: 14 },
  { id: 'detailed', name: 'ورد',    range: '١٨–٢٥', n: 20 },
];

/** ئەو سلایدانەی هەمیشە هەن: سەرەتا، ناوەڕۆک، سوپاس، سەرچاوەکان.
 *  بەکارهێنەر کۆی گشتی دەڵێت، بۆیە ئەمانە لێی کەم دەکرێنەوە. */
const FIXED = 4;

const themeName = (id: string) => THEMES.find(t => t.id === id)?.name ?? id;

const EMPTY_TITLE: TitleInfo = {
  university: '', institute: '', department: '', title: '', year: '',
  teacherPrefix: 'Mr.', teacherName: '', students: [''],
};

/** ساڵی خوێندنی ئێستا — لە مانگی ٩ ـەوە ساڵی نوێ دەستپێدەکات */
function currentYear(): string {
  const d = new Date(), y = d.getFullYear();
  const start = d.getMonth() >= 8 ? y : y - 1;
  return `${start} – ${start + 1}`;
}

/** لۆگۆ بچووک دەکرێتەوە پێش خەزنکردن — data: URI ـێکی گەورە
 *  هەم localStorage پڕ دەکات هەم قەبارەی پرۆژەکە.
 *
 *  لۆگۆی زانکۆ زۆرجار PNG ـی شەفافە، بۆیە `compressImage` شەفافییەکە
 *  دەپارێزێت و تەنها بچووکی دەکاتەوە. */
function shrinkLogo(file: File, max = 512): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error('فایلەکە نەخوێندرایەوە'));
    fr.onload = () => {
      compressImage(String(fr.result), max)
        .then(res)
        .catch(() => rej(new Error('ئەمە وێنەیەکی دروست نییە')));
    };
    fr.readAsDataURL(file);
  });
}

type StepId = 'key' | 'title' | 'who' | 'look' | 'plan' | 'talk' | 'build';

// ─────────── پارچەکانی گفتوگۆ ───────────
//
// ئەمانە دەبێت لە دەرەوەی کۆمپۆنێنتەکەدا بن.
// ئەگەر لە ناویدا بنووسرێن، React لە هەر ڕەندەرێکدا وەک جۆرێکی نوێی
// کۆمپۆنێنت دەیانبینێت و هەموو ناوەڕۆکەکەیان لەنوێ دروست دەکاتەوە —
// واتە خانەی نووسین فۆکەس لەدەست دەدات لەگەڵ هەر پیتێک.

const Ask = ({ children }: { children: React.ReactNode }) => (
  <div className="say ai"><span className="dot" /><div className="bub">{children}</div></div>
);

/** وەڵامێکی تەواوبوو — کلیکی لێبکە بۆ گەڕانەوە */
const Answer = ({ label, value, onClick }:
  { label: string; value: React.ReactNode; onClick: () => void }) => (
  <div className="say me">
    <button className="bub done" onClick={onClick} title="گۆڕینی">
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </button>
  </div>
);

export default function Wizard({ keys, onKeys, onDone, onCancel }: {
  keys: Keys;
  onKeys: (k: Keys) => void;
  onDone: (d: Deck) => void;
  onCancel?: () => void;
}) {
  const [k, setK] = useState<Keys>(keys);
  const [lang, setLang] = useState<Lang>('ckb');
  const [ti, setTi] = useState<TitleInfo>({ ...EMPTY_TITLE, year: currentYear() });

  const [saved, setSaved] = useState(false);
  const [editInfo, setEditInfo] = useState(false);

  const [topic, setTopic] = useState('');
  // بنەڕەت «ئاسایی» ـە، نەک «کورت». پێشتر ١٠ بوو — واتە شەش سلایدی
  // ناوەڕۆک، کە خاوەنی بەرهەمەکە بە ڕاستی وەک «سلایدەکان زۆر کەمن»
  // ناوی برد کاتێک بەراوردی کرد لەگەڵ دێککێکی ١٢ سلایدی.
  const [count, setCount] = useState(14);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  /**
   * سەرچاوەکانی گەڕانی ئینتەرنێت لە قۆناغی پێڕستەوە.
   *
   * پێشتر `suggestOutline` ئەمانەی دەگەڕاندەوە و هەر لەو دێڕەدا
   * فڕێدەدران. ئێستا دەمێننەوە و لەگەڵ توێژینەوەکاندا دەچنە ناو
   * پرۆمپتی ناوەڕۆکەوە — بڕوانە `researchPack` لە `generate.ts`.
   */
  const [webSources, setWebSources] = useState<GroundingSource[]>([]);
  const [useSearch, setUseSearch] = useState(true);
  const [withImages, setWithImages] = useState(true);
  const [humanizeOn, setHumanizeOn] = useState(true);
  /**
   * تیمی ئەیجێنت — ١٠ ئەیجێنت بە ڕیز، لەبری یەک بانگکردنی گەورە.
   *
   * ─── بۆچی هەڵبژاردەیەکە و نەک تاکە ڕێگا ───
   * تیمەکە ١٢ تا ١٨ بانگکردن دەکات. ئەوە بۆ کلیلێکی بێبەرامبەری
   * Gemini دەکرێت بەر سنووری هەر خولەکێک بکەوێت — و ئەو کاتە
   * بەکارهێنەر پێویستی بە ڕێگایەکی خێرا هەیە کە هەر ئێستا
   * دێککێکی بداتێ. ئەوە ڕێڕەوی کۆنە، و هێشتا بەردەستە.
   */
  const [crewOn, setCrewOn] = useState(true);
  /** دۆخی قۆناغەکان لە کاتی کارکردندا — بۆ پیشاندان */
  const [stages, setStages] = useState<StageReport[]>([]);
  const [more, setMore] = useState(false);
  const [theme, setTheme] = useState('academic-blue');
  const [style, setStyle] = useState<StyleId>('glass');
  const [density, setDensity] = useState<Density>('normal');
  /** فۆنتی دێکک — بنەڕەتەکەی لەگەڵ زمانەکە دەگۆڕێت، بڕوانە `fonts.ts` */
  const [font, setFont] = useState<string>(() => defaultFontFor('ckb'));
  /** ئایا بەکارهێنەر خۆی فۆنتێکی هەڵبژاردووە؟ ئەگەر نا، لەگەڵ زماندا دەڕوات */
  const [fontTouched, setFontTouched] = useState(false);
  const [citeStyle, setCiteStyle] = useState<CiteStyleId>('apa');
  const [refKind, setRefKind] = useState<SourceKind>('paper');

  /** دەقی خۆنووسراوی خوێندکار — هەڵبژاردەییە */
  const [script, setScript] = useState('');
  /** دابەشکردنی سلایدەکان — بەتاڵ = دابەش نەکراوە */
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [minutes, setMinutes] = useState(0);
  /** ئایا بەکارهێنەر دەستی لە دابەشکردنەکە وەشاندووە؟
   *  ئەگەر بەڵێ، دابەشکردنی خۆکار نایگۆڕێت. */
  const [touched, setTouched] = useState(false);
  /** ئەوەی لە دەقەکەوە دەرهێنرا — بۆ پیشاندان بە بەکارهێنەر */
  const [found, setFound] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [prog, setProg] = useState(0);
  /** چەند سلاید تەواو بوون — بۆ پیشاندانی زیندوو */
  const [filled, setFilled] = useState(0);
  /** چرکەکانی تێپەڕیو — بەبێی ڕووکارەکە وەک مردوو دەردەکەوێت */
  const [secs, setSecs] = useState(0);
  /** سلایدەکان وەک مۆدێل دەیاننووسێت — ڕەشەبا */
  const [live, setLive] = useState<Slide[]>([]);
  const [thesis, setThesis] = useState('');
  /** کام داتابەیس وەڵامی دایەوە و چەند ئەنجامی هەبوو */
  const [hits, setHits] = useState<{ name: string; n: number; ok: boolean }[]>([]);
  /** بۆ وەستاندنی دروستکردن لە ناوەڕاستدا */
  const stopRef = useRef<AbortController | null>(null);

  const hasKey = (kk: Keys) => (kk.keys.gemini ?? '').length > 20;
  const [step, setStep] = useState<StepId>('key');
  const [ready, setReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      const { lang: pl, ...rest } = p;
      setTi({ ...EMPTY_TITLE, ...rest, title: '', year: rest.year || currentYear() });
      setLang(pl);
      setSaved(true);
    }
    setStep(hasKey(keys) ? 'title' : 'key');
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // هەر پرسیارێکی نوێ دەبێت بەدیار بێت
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [step, outline.length, busy]);

  // کاتژمێری دروستکردن
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const setStudentCount = (n: number) =>
    setTi(t => ({ ...t, students: Array.from({ length: n }, (_, i) => t.students[i] ?? '') }));

  /** بەکارهێنەر کۆی سلایدەکان دیاری دەکات — ئەمە ئەوەیە دەبێت AI دروستی بکات */
  const bodyCount = Math.max(1, count - FIXED);

  /** جۆری «ماڵپەڕ» بەبێ یەکێک لەمانە کار ناکات */
  const canWeb = !!(k.searchEngine && k.searchKeys?.[k.searchEngine]) || !!k.keys.gemini;

  /** نموونەی زیندووی شێوازەکە — بەکارهێنەر جیاوازییەکە دەبینێت
   *  پێش ئەوەی پێشکەشکردنەکە دروست بکات */
  const demoCite = useMemo(
    () => formatCite(DEMO[refKind], citeStyle), [refKind, citeStyle]);

  // ─────────── دەق و دابەشکردن ───────────

  const names = useMemo(
    () => ti.students.map(s => s.trim()).filter(Boolean), [ti.students]);

  /** ئاگاداری دابەشکردن — بۆشایی، دووبارەبوونەوە، لە دەرەوەی مەودا */
  const splitWarn = useMemo(
    () => checkSpeakers(speakers, count), [speakers, count]);

  /**
   * دابەشکردنی خۆکار.
   *
   * تەنها تا ئەو کاتەی بەکارهێنەر دەستی لێنەداوە. دوای یەکەم
   * دەستکاری، ژمارەکانی خۆی دەمێننەوە — هیچ شتێک ناخۆشتر نییە
   * لەوەی ڕێکخستنێکی دەستی خۆکار بسڕدرێتەوە.
   */
  useEffect(() => {
    if (touched || !names.length) return;
    setSpeakers(autoSplit(names, count, minutes));
  }, [names, count, minutes, touched]);

  const editSpeaker = (i: number, patch: Partial<Speaker>) => {
    setTouched(true);
    setSpeakers(sp => sp.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };

  /** دەقەکە دەخوێنێتەوە و ئەوەی تێدایە دەیخاتە فۆرمەکەوە */
  function readScript() {
    const r = parseScript(script, names);
    const bits: string[] = [];

    if (r.totalMinutes) { setMinutes(r.totalMinutes); bits.push(`کۆی کات ${r.totalMinutes} خولەک`); }
    if (r.speakers.length) {
      setSpeakers(r.speakers);
      setTouched(true);
      bits.push(`${r.speakers.length} دابەشکردن`);
    } else if (r.namesOnly.length) {
      // ناوەکان هەن بەڵام مەودا نا — خۆمان دابەشی دەکەین
      setSpeakers(autoSplit(r.namesOnly, count, r.totalMinutes || minutes));
      setTouched(true);
      bits.push(`${r.namesOnly.length} ناو (مەودا خۆکار)`);
    }

    setFound(bits.length
      ? `لە دەقەکەدا دۆزرایەوە: ${bits.join(' · ')}`
      : 'هیچ ناو یان کاتێک لە دەقەکەدا نەدۆزرایەوە — لە خوارەوە دایبنێ.');
  }

  async function askOutline() {
    setErr(''); setBusy(true); setMsg('گەڕان بۆ ناوەڕۆک…');
    try {
      const { provider, model } = pickTextProvider(lang, k);
      const r = await suggestOutline({
        provider, model, key: k.keys[provider] ?? '',
        topic: topic || ti.title,
        langName: lang === 'ckb' ? 'Kurdish Sorani' : lang === 'ar' ? 'Arabic' : 'English',
        // پێشتر `/1.5` بوو بە سنووری ١٠. بۆ دێککێکی ١٢ سلایدی ئەوە
        // دەبووە ٨ بەش، هەر یەکێک بە یەک ڕستەی ڕێنمایی — واتە ٨ ڕستە
        // دەبوو ١٢ سلایدی ناوەڕۆکدار بەرهەم بهێنن، و ئەوەی دەمایەوە
        // مۆدێل خۆی هەڵیدەبەست. ئەو بەشە هەڵبەستراوە هەر ئەوەیە
        // گشتگۆ دەردەچێت.
        count: Math.min(12, Math.max(5, Math.round(bodyCount / 1.25))),
        useSearch: useSearch && providerById(provider).search,
        // سنووری ڕێژە: چاوەڕوانی دەکرێت، نەک شکست. بەبێ ئەم پەیامە
        // ڕووکارەکە بۆ ٣٠ چرکە دەبەستێت بەبێ هۆکار و بەکارهێنەر
        // دووبارە دوگمەکە لێدەدات — کە هەمان سنوور دووبارە دەخاتەوە کار.
        onWait: ms => setMsg(`سنووری داواکاری — چاوەڕوانی ${Math.ceil(ms / 1000)} چرکە…`),
      });
      setOutline(r.items);
      // سەرچاوەکان دەپارێزرێن — دواتر دەچنە ناو پرۆمپتی ناوەڕۆکەوە
      setWebSources(r.sources);
      // ئەگەر گەڕان داواکرا و نەکرا، بەکارهێنەر دەبێت بزانێت.
      // پێشتر بێدەنگ بوو و پێڕستێکی بێ بنەما وەک گەڕاو پیشان دەدرا.
      if (useSearch && providerById(provider).search && !r.grounded)
        setErr('گەڕان لە ئینتەرنێت سەرکەوتوو نەبوو — ئەم پێڕستە لەسەر زانیاری '
             + 'مۆدێلەکە دروستکراوە، نەک لەسەر سەرچاوەی زیندوو.'
             // هۆکارەکە پیشان دەدرێت. بەبێی بەکارهێنەر نازانێت
             // «دووبارە هەوڵ بدە» چارەسەرە یان مۆدێل گۆڕین.
             + (r.reason ? ` هۆکار: ${r.reason}` : '')
             + ' دووبارە هەوڵ بدە، یان لە ڕێکخستن مۆدێلێکی تر هەڵبژێرە.');
    } catch (e) { setErr(String((e as Error).message)); }
    finally { setBusy(false); setMsg(''); }
  }

  /**
   * ئەنجامی هەر دوو ڕێڕەوەکە — تیمی ئەیجێنت و ڕێڕەوی خێرا.
   *
   * هەردووکیان هەمان شت دەگەڕێننەوە، بۆیە ئەوەی دوایان دێت
   * (لاپەڕەی ناوەڕۆک، سوپاس، سەرچاوەکان، پشکنین) **یەک جار**
   * نووسراوە. پێشتر ئەگەر ڕێڕەوێکی نوێ زیاد بکرایە، دەبوایە
   * هەموو ئەو کۆتاییە دووبارە بنووسرایەتەوە — و ئەوە شوێنێکە
   * کە دوو ڕێڕەو لێک جیا دەبنەوە بەبێ ئەوەی کەس بزانێت.
   */
  type BuiltDeck = {
    slides: Slide[];
    thesis?: string;
    /** سەرچاوەکان، بە ناسنامەوە — ئامادە بۆ لاپەڕەی کۆتایی */
    refs: Reference[];
    sections: Section[];
    uncovered: string[];
    /** ئاگادارییەکان — پێکەوە پیشان دەدرێن */
    notes: string[];
  };

  async function build() {
    setErr(''); setBusy(true); setProg(5); setFilled(0); setSecs(0);
    setLive([]); setThesis(''); setHits([]); setStages([]); setStep('build');
    stopRef.current = new AbortController();
    const stopped = () => stopRef.current?.signal.aborted;
    saveProfile(ti, lang);   // جاری داهاتوو خۆکار دێتەوە
    try {
      const subject = topic || ti.title;
      const { provider, model } = pickTextProvider(lang, k);
      const textKey = k.keys[provider] ?? '';

      const built = crewOn
        ? await buildWithCrew(subject, provider, model, textKey)
        : await buildFast(subject, provider, model, textKey);

      if (stopped()) return;
      setProg(88); setFilled(count - 1);

      const outlineSlide = newSlide('L_outline', lang === 'en' ? 'Outline' : 'ناوەڕۆک');
      outlineSlide.bullets = (outline.length ? outline : built.slides.map(s => ({ title: s.title })))
        .map(o => o.title);

      const thanks = newSlide('L_thanks', lang === 'en' ? 'Thank You' : 'سوپاس');
      thanks.bullets = [lang === 'en' ? 'Any Questions?' : 'پرسیارێک هەیە؟'];

      // ═══ لاپەڕەی سەرچاوەکان — تەنها ئەگەر سەرچاوە هەبێت ═══
      //
      // پێشتر هەمیشە دروست دەکرا، جا سەرچاوەی تێدابێت یان نا.
      // لاپەڕەیەکی سەرچاوەی بەتاڵ لە پێشکەشکردنێکی زانکۆییدا
      // خراپترە لە نەبوونی: دەڵێت «توێژینەوەم کردووە» و ئینجا
      // هیچ پیشان نادات.
      const refsSlide = built.refs.length
        ? (() => {
            const sl = newSlide('L_refs', lang === 'en' ? 'References' : 'سەرچاوەکان');
            // ═══ لاپەڕەکە ئەنجامێکە، نەک لیستێک ═══
            // تەنها ئەو تۆمارانە دەمێننەوە کە سلایدێک بەڕاستی
            // ناوی هێناون، بە ڕیزی یەکەم بەکارهێنان.
            sl.refs = citedRefs(built.refs, built.slides.map(x => x.cites));
            return sl;
          })()
        : null;
      setProg(96); setFilled(count);

      if (stopped()) return;

      const all = [outlineSlide, ...built.slides, thanks, ...(refsSlide ? [refsSlide] : [])];

      // لاپەڕەی ناوەڕۆک هەموو بەشەکان پیشان دەدات — بۆیە بەشێکی
      // بێ سلاید دەبێتە بەڵێنێکی نەبڕاو لەبەرچاوی مامۆستادا
      const gapWarning = built.uncovered.length
        ? `ئەم بەشانەی پێڕست سلایدیان بۆ نەنووسرا: ${built.uncovered.join('، ')}. `
          + 'یان لە ستودیۆدا زیادیان بکە، یان لە لاپەڕەی ناوەڕۆک لایانبە.'
        : '';

      // ═══ پشکنینی کۆتایی ═══
      // پێشتر دێککەکە بێدەنگ دەردەچوو، جا تەواو بێت یان نا.
      // ئێستا هەموو کێشەیەکی میکانیکی ڕادەگەیەنرێت — بۆشایی،
      // دەقی بەدەرچوو، شوێنی بەتاڵ، سەرچاوەی ناپشکنراو.
      const defects = verify({
        slides: all, lang, sections: built.sections, contentStart: 2,
      });

      const notes = [...built.notes, gapWarning, summarise(defects)].filter(Boolean);
      if (notes.length) setErr(notes.join(' · '));

      onDone(buildDeck({
        lang, theme, style, density, citeStyle, refKind,
        script, speakers, totalMinutes: minutes, thesis: built.thesis,
        fontFamily: font,
        titleInfo: ti, sections: built.sections,
        slides: all,
      }));
    } catch (e) {
      // ─── وەستاندن هەڵە نییە ───
      // پێش ڕەشەبا، «وەستاندن» تەنها ئاڵایەک بوو و بانگکردنەکە لە
      // پشتەوە تەواو دەبوو. ئێستا `AbortController` بەکاردێت، بۆیە
      // `fetch` ڕاستەوخۆ هەڵە دەداتەوە — و ئەو هەڵەیە پەیامێکی
      // ئینگلیزی وێبگەڕە («The user aborted a request»), نەک شتێک
      // کە بەکارهێنەر پێویستی پێی بێت.
      const aborted = stopRef.current?.signal.aborted
        || (e as Error).name === 'AbortError'
        || (e as Error).name === 'Stopped';
      if (!aborted) setErr(String((e as Error).message));
      setBusy(false); setProg(0); setStep('talk');
    }
  }

  /**
   * ═══ ڕێڕەوی تیمی ئەیجێنت ═══
   *
   * هەموو کارەکە لە `crew/run.ts` دایە. ئەمە تەنها بەستەرەکەیە
   * بۆ ڕووکار: پێشکەوتن، سلایدە زیندووەکان، و ئاگادارییەکان.
   */
  async function buildWithCrew(
    subject: string, provider: ProviderId, model: string, textKey: string,
  ): Promise<BuiltDeck> {
    const r = await runCrew({
      provider, model, key: textKey,
      topic: subject, lang,
      langName: lang === 'ckb' ? 'Kurdish Sorani' : lang === 'ar' ? 'Arabic' : 'English',
      outline: outline.length ? outline : [{ title: subject, hint: subject }],
      slideCount: bodyCount,
      applyHumanizer: humanizeOn,
      density, citeStyle, refKind,
      webSources,
      script: script.trim() || undefined,
      speakers: speakers.length ? speakers : undefined,
      // ١ = لاپەڕەی سەرەتا، ٢ = ناوەڕۆک، بۆیە ناوەڕۆک لە ٣ ـەوە
      contentStart: 3,
      images: withImages,
      imageProvider: k.imageProvider,
      imageKey: k.keys[k.imageProvider] ?? '',
      engine: k.searchEngine || undefined,
      engineKey: k.searchEngine ? k.searchKeys?.[k.searchEngine] : undefined,
      signal: stopRef.current!.signal,
      onStage: s => {
        setStages(list => [...list.filter(x => x.id !== s.id), s]);
        setProg(p => Math.max(p, s.state === 'run' ? p : s.pct));
        if (s.state === 'run') setMsg(s.label + '…');
      },
      onNote: setMsg,
      onThesis: setThesis,
      onSlides: got => { setLive(got); setFilled(2 + got.length); },
      onSource: (name, n, ok) =>
        setHits(h => [...h.filter(x => x.name !== name), { name, n, ok }]),
    });

    return {
      slides: r.slides,
      thesis: r.thesis,
      refs: r.refs,
      sections: r.sections,
      uncovered: r.uncovered,
      notes: r.notes,
    };
  }

  /**
   * ═══ ڕێڕەوی خێرا — یەک بانگکردن ═══
   *
   * ئەمە ڕێڕەوە کۆنەکەیە و وەک خۆی ماوەتەوە. شوێنی: کاتێک
   * سنووری کلیلەکە تەواو بووە و بەکارهێنەر ئێستا دێککێکی
   * پێویستە. کەمتر ورد، بەڵام سێ بانگکردن لە ١٥ بانگکردن
   * زۆر ئاسانترە بۆ کلیلێکی بێبەرامبەر.
   */
  async function buildFast(
    subject: string, provider: ProviderId, model: string, textKey: string,
  ): Promise<BuiltDeck> {
    const stopped = () => stopRef.current?.signal.aborted;
      let imageWarning = '';
      let lastImageError = '';

      // ═══ توێژینەوە پێش نووسین ═══
      //
      // ڕیزبەندییەکە پێشتر بەپێچەوانە بوو: سلایدەکان دەنووسران، ئینجا
      // سەرچاوەکان دەگەڕدران. واتە نووسەری ناوەڕۆک هەرگیز ئەو
      // توێژینەوانەی نەدەبینی کە دواتر لە هەمان لاپەڕەدا ناویان
      // دەهێنرا — و پرۆمپتەکە داوای «ناوی ڕاستەقینە و ژمارە»ی
      // دەکرد بەبێ ئەوەی هیچی پێبدات.
      //
      // ئێستا یەکەم دەگەڕێین، ئینجا دەنووسین. هەمان ژمارە داواکاری،
      // هەمان خەرجی — تەنها ڕیزبەندییەکە گۆڕا.
      const kindName = SOURCE_KINDS.find(s => s.id === refKind)!.name;
      setMsg(`گەڕان بۆ ${kindName}…`);
      let research: Research = { refs: [], papers: [] };
      let refWarning = '';
      try {
        research = await findResearch({
          provider, model, key: textKey, topic: subject, count: 5,
          style: citeStyle, kind: refKind,
          onNote: setMsg,
          // هەر داتابەیسێک هەر کاتێک وەڵامی دایەوە دەردەکەوێت —
          // نەک هەموویان دوای تەواوبوون
          onSource: (name, n, ok) =>
            setHits(h => [...h.filter(x => x.name !== name), { name, n, ok }]),
          engine: k.searchEngine || undefined,
          engineKey: k.searchEngine ? k.searchKeys?.[k.searchEngine] : undefined,
        });
        if (!research.refs.length)
          refWarning = `هیچ ${kindName}ێک بۆ ئەم بابەتە نەدۆزرایەوە. `
                     + 'لە ستودیۆدا جۆرێکی تر تاقی بکەرەوە، یان داوا لە '
                     + 'یاریدەدەر بکە بە دەستەواژەیەکی ئینگلیزی بگەڕێت.';
      } catch (e) {
        refWarning = `سەرچاوەکان نەهێنران: ${(e as Error).message}`;
      }
      setProg(20);

      setMsg('دروستکردنی سلایدەکان…');
      const { slides, thesis, filled, uncovered, sections } = await generateSlides({
        provider, model, key: textKey, topic: subject, lang,
        outline: outline.length ? outline : [{ title: subject, hint: subject }],
        slideCount: bodyCount, applyHumanizer: humanizeOn, density,
        // ئەمە ئەو ماددەیەیە کە سلایدەکان لەسەری دروست دەبن
        papers: research.papers,
        sources: webSources,
        script: script.trim() || undefined,
        speakers: speakers.length ? speakers : undefined,
        // ١ = لاپەڕەی سەرەتا، ٢ = ناوەڕۆک، بۆیە ناوەڕۆک لە ٣ ـەوە
        contentStart: 3,
        onProgress: setMsg,
        // ڕەشەبا — سلایدەکان یەک بە یەک دەردەکەون
        signal: stopRef.current!.signal,
        onThesis: setThesis,
        onSlides: got => {
          setLive(got);
          // شریتەکە لەگەڵ ڕاستییەکە دەڕوات، نەک بە کاتژمێر
          setProg(20 + Math.round(got.length / Math.max(1, bodyCount) * 30));
          setMsg(`سلایدی ${got.length} لە ${bodyCount}…`);
        },
      });
      setProg(52); setFilled(2 + slides.length);

      // ئەو سلایدانەی مۆدێل نەینارد و بە پێڕستەکە پڕکرانەوە — لاوازن
      // بە دڵنیاییەوە، بۆیە بەکارهێنەر دەبێت بزانێت لە کامیان بڕوانێت
      const fillWarning = filled
        ? `${filled} سلاید لە مۆدێلەوە نەهات و لە پێڕستەکەوە پڕکرایەوە — `
          + 'پێویستیان بە دەستکاری هەیە. لە ستودیۆدا داوا لە یاریدەدەر بکە ناوەڕۆکیان بۆ بنووسێت.'
        : '';

      // ─── وێنەکان ───
      // هەر سلایدێک کە تەختەبەندی شوێنی وێنەی تێدایە، دەبێت وێنەی هەبێت.
      // مۆدێل زۆرجار imagePrompt فەرامۆش دەکات، بۆیە خۆمان دروستی دەکەین.
      const needsImage = slides.filter(s => layoutById(s.layout).needs.includes('image'));
      for (const s of needsImage) {
        if (!s.imagePrompt) s.imagePrompt = promptFromTitle(s.title, subject);
      }

      if (withImages && needsImage.length) {
        const aiKey = k.keys[k.imageProvider] ?? '';
        let done = 0, failed = 0;

        for (let i = 0; i < needsImage.length; i++) {
          if (stopped()) break;           // بەکارهێنەر وەستاندی
          const s = needsImage[i];
          setMsg(`وێنە ${i + 1} لە ${needsImage.length}…`);
          try {
            const r = await resolveImage({
              prompt: s.imagePrompt!,
              ai: aiKey ? { provider: k.imageProvider, key: aiKey } : undefined,
              // بڕیاری خاوەنی بەرهەمەکە: لە ڕێڕەوی خۆکاردا وێنەی
              // ڕاستەقینەی مۆڵەتدار پێش وێنەی دروستکراو دێت
              prefer: 'free',
              onNote: n => setMsg(`وێنە ${i + 1} لە ${needsImage.length} — ${n}`),
            });
            s.imageUrl = r.dataUrl;
            s.imageCredit = r.credit;
            done++;
          } catch (e) {
            failed++;
            lastImageError = (e as Error).message;
          }
          // ٥٢ → ٨٧ · سلایدەکان لە ٥٢ کۆتاییان هات (توێژینەوە ٥ → ٢٠)
          setProg(52 + Math.round((i + 1) / needsImage.length * 35));
        }

        if (failed && !done)
          imageWarning = `هیچ وێنەیەک دانەنراوە. هۆکار: ${lastImageError}`;
        else if (failed)
          imageWarning = `${done} وێنە دانرا، ${failed} شکستی هێنا.`;
      }
      // ═══ دووبارە دانانی تەختەبەند، ئێستا کە وێنەکان دیارن ═══
      //
      // ئەمە ئەو دێڕەیە کە چوارگۆشە خۆڵەمێشییەکە دەکوژێت. جاری
      // یەکەم `imagePrompt` وەک بەڵێنێک ژمێردرا؛ ئێستا بەڵێنە
      // نەبڕاوەکان دەردەکەون و ئەو سلایدانە دەکەونەوە سەر
      // تەختەبەندێکی دەقی — نەک شوێنێکی بەتاڵ.
      const finalSlides = compose(slides, { lang, imagesResolved: true });

      // ناسنامەکان لێرەدا دادەنرێن، تاکو خاڵەکانی سلاید بتوانن
      // ئاماژەیان پێبدەن (بڕوانە `deck/model.ts`). تیمی ئەیجێنت
      // ئەمە خۆی دەکات، بۆیە دوو ڕێڕەوەکە هەمان شت دەگەڕێننەوە.
      return {
        slides: finalSlides,
        thesis,
        refs: research.refs.map((r, i) => ({ ...r, id: mkId('s', i) })),
        sections,
        uncovered,
        notes: [imageWarning, refWarning, fillWarning].filter(Boolean),
      };
  }

  const needed = requiresGemini(lang) ? 'gemini' : k.textProvider;
  const langName = lang === 'ckb' ? 'کوردی سۆرانی' : lang === 'ar' ? 'العربية' : 'English';
  const whoLine = [ti.university, ti.department].filter(Boolean).join(' · ');

  const ORDER: StepId[] = ['key', 'title', 'who', 'look', 'plan', 'talk', 'build'];
  const at = ORDER.indexOf(step);
  const done = (s: StepId) => ORDER.indexOf(s) < at;

  const Said = ({ to, label, value }: { to: StepId; label: string; value: React.ReactNode }) => (
    <Answer label={label} value={value} onClick={() => !busy && setStep(to)} />
  );

  const fullForm = <>
    <div className="f"><label>ناوی زانکۆ</label>
      <input value={ti.university} placeholder="Erbil Polytechnic University"
        onChange={e => setTi({ ...ti, university: e.target.value })} /></div>
    <div className="frow">
      <div className="f"><label>پەیمانگا</label>
        <input value={ti.institute} placeholder="Technical College"
          onChange={e => setTi({ ...ti, institute: e.target.value })} /></div>
      <div className="f"><label>بەش</label>
        <input value={ti.department} placeholder="AIRE"
          onChange={e => setTi({ ...ti, department: e.target.value })} /></div>
    </div>
    <div className="frow">
      <div className="f" style={{ flex: '0 0 128px' }}><label>پلە</label>
        <select value={ti.teacherPrefix} onChange={e => setTi({ ...ti, teacherPrefix: e.target.value })}>
          {PREFIXES.map(p => <option key={p}>{p}</option>)}
        </select></div>
      <div className="f"><label>ناوی مامۆستا</label>
        <input value={ti.teacherName} onChange={e => setTi({ ...ti, teacherName: e.target.value })} /></div>
      <div className="f" style={{ flex: '0 0 128px' }}><label>ساڵی خوێندن</label>
        <input value={ti.year} placeholder={currentYear()}
          onChange={e => setTi({ ...ti, year: e.target.value })} /></div>
    </div>
    <div className="f"><label>خوێندکارەکان</label>
      <div className="namelist">
        {ti.students.map((s, i) => (
          <input key={i} value={s} placeholder={`ناوی ${i + 1}`} onChange={e => {
            const st = [...ti.students]; st[i] = e.target.value; setTi({ ...ti, students: st });
          }} />
        ))}
        <div className="nameadd">
          {ti.students.length > 1 && (
            <button type="button" className="btn icon sm" title="لابردن"
              onClick={() => setStudentCount(ti.students.length - 1)}>−</button>)}
          {ti.students.length < 8 && (
            <button type="button" className="btn sm"
              onClick={() => setStudentCount(ti.students.length + 1)}>+ خوێندکار</button>)}
        </div>
      </div>
    </div>
    <div className="f"><label>لۆگۆی زانکۆ</label>
      <div className="logorow">
        {ti.logoUrl ? <img className="logoprev" src={ti.logoUrl} alt="" />
                    : <span className="logoprev empty">؟</span>}
        <input type="file" accept="image/*" onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          try { const url = await shrinkLogo(f); setTi(t => ({ ...t, logoUrl: url })); }
          catch (ex) { setErr((ex as Error).message); }
        }} />
        {ti.logoUrl && <button type="button" className="btn sm"
          onClick={() => setTi(t => ({ ...t, logoUrl: undefined }))}>لابردن</button>}
      </div>
    </div>
  </>;

  if (!ready) return null;

  return (
    <div className="intake">
      <header className="intake-top">
        <span className="mk">P</span>
        <b>ستودیۆی پێشکەشکردن</b>
        <span className="spacer" />
        {onCancel && <button className="ghost" onClick={onCancel} disabled={busy}>داخستن</button>}
      </header>

      <div className="thread">
        <div className="lane">

          {/* ═══ کلیل ═══ */}
          {step === 'key' ? <>
            <Ask>
              <b>سڵاو 👋</b>
              <p>من پێشکەشکردنەکەت بۆ دروست دەکەم — دەق، وێنە، چارت و سەرچاوەی ڕاستەقینە.</p>
              <p>بۆ دەستپێکردن کلیلێکی <b>Gemini</b> پێویستە. ئەم وێبسایتە هیچ کلیلێکی خۆی نییە —
                 کلیلەکەت تەنها لە وێبگەڕەکەی خۆتدا دەمێنێتەوە و بۆ هیچ سێرڤەرێک نانێردرێت.</p>
              <div className="inpanel">
                <KeyPanel keys={k} onChange={n => { setK(n); saveKeys(n); onKeys(n); }} />
              </div>
            </Ask>
          </> : done('key') && hasKey(k) && (
            <Said to="key" label="کلیل" value={<>Gemini <span className="ok">پەیوەندی هەیە</span></>} />
          )}

          {/* ═══ ناونیشان ═══ */}
          {at >= 1 && (step === 'title' ? (
            <Ask>
              <b>باشە. پێشکەشکردنەکەت لەسەر چییە؟</b>
              <p>ناونیشانەکە بنووسە — هەمان ئەوەی لە یەکەم سلایددا دەردەکەوێت.</p>
            </Ask>
          ) : done('title') && (
            <Said to="title" label="ناونیشان" value={ti.title} />
          ))}

          {/* ═══ زانیاری زانکۆ ═══ */}
          {at >= 2 && (step === 'who' ? (
            <Ask>
              {saved && !editInfo ? <>
                <b>ئەم زانیارییانەم پاشەکەوت کردبوو — هێشتا دروستن؟</b>
                <div className="card-sum">
                  {ti.logoUrl && <img src={ti.logoUrl} alt="" />}
                  <div className="txt">
                    <b>{ti.university}</b>
                    <span>{[ti.institute, ti.department].filter(Boolean).join(' · ')}</span>
                    <span>{[`${ti.teacherPrefix} ${ti.teacherName}`.trim(),
                            ti.students.filter(Boolean).join('، '), ti.year]
                            .filter(Boolean).join('  ·  ')}</span>
                  </div>
                </div>
              </> : <>
                <b>زانیاری لاپەڕەی سەرەتا</b>
                <p>ئەمانە جارێک پڕ دەکرێنەوە و پاشەکەوت دەکرێن — جاری داهاتوو تەنها پشتڕاستیان دەکەیتەوە.</p>
                <div className="inpanel">{fullForm}</div>
                {saved && (
                  <button className="lnk danger" onClick={() => {
                    clearProfile(); setSaved(false);
                    setTi({ ...EMPTY_TITLE, title: ti.title, year: currentYear() });
                  }}>سڕینەوەی زانیارییە پاشەکەوتکراوەکان</button>
                )}
              </>}
            </Ask>
          ) : done('who') && (
            <Said to="who" label="زانکۆ" value={whoLine} />
          ))}

          {/* ═══ پاشبنەما ═══ */}
          {at >= 3 && (step === 'look' ? (
            <Ask>
              <b>ڕوخسارەکەی هەڵبژێرە</b>
              <p>
                <b>شێواز</b> پێکهاتەکە دەگۆڕێت — کارت، ناونیشان، نیشانەی خاڵ.
                {' '}<b>پاشبنەما</b> تەنها ڕەنگ. هەر کارتێک سلایدێکی ڕاستەقینەیە،
                نەک نموونەیەکی نزیک.
              </p>
              <div className="inpanel">
                <ThemePicker value={theme} style={style} lang={lang}
                  fontFamily={font}
                  onPick={setTheme} onPickStyle={setStyle} />
              </div>

              {/* فۆنت — پێشتر Georgia بۆ هەموو زمانێک زۆرەملێ دەکرا،
                  و Georgia هیچ پیتێکی کوردی نییە. بڕوانە `fonts.ts`. */}
              <div className="qrow">
                <span className="qlab">فۆنت</span>
                <div className="chips">
                  {fontsFor(lang).map(f => (
                    <button key={f.v} className={`chip${font === f.v ? ' on' : ''}`}
                      style={{ fontFamily: f.v }}
                      onClick={() => { setFont(f.v); setFontTouched(true); }}>{f.n}</button>
                  ))}
                </div>
              </div>
            </Ask>
          ) : done('look') && (
            <Said to="look" label="ڕوخسار"
              value={`${deckStyleById(style).name} · ${themeName(theme)} · ${fontName(font)}`} />
          ))}

          {/* ═══ پلان ═══ */}
          {at >= 4 && (step === 'plan' ? (
            <Ask>
              <b>دوا شت — چۆن دروستی بکەم؟</b>

              <div className="qrow">
                <span className="qlab">زمان</span>
                <div className="chips">
                  {([['ckb', 'کوردی سۆرانی'], ['ar', 'العربية'], ['en', 'English']] as const).map(([v, n]) => (
                    <button key={v} className={`chip${lang === v ? ' on' : ''}`}
                      onClick={() => {
                        setLang(v);
                        // فۆنتەکە لەگەڵ زماندا دەڕوات — تا کاتێک بەکارهێنەر
                        // خۆی هەڵیبژێرێت. بەبێ ئەمە دێککێکی کوردی بە
                        // Georgia دەمێنێتەوە، کە هیچ پیتێکی کوردی نییە.
                        if (!fontTouched) setFont(defaultFontFor(v));
                      }}>{n}</button>
                  ))}
                </div>
              </div>

              <div className="qrow">
                <span className="qlab">درێژی</span>
                <div className="chips">
                  {SIZES.map(z => (
                    <button key={z.id} className={`chip two${count === z.n ? ' on' : ''}`}
                      onClick={() => setCount(z.n)}>
                      {/* ─── ژمارەی سلایدی **ناوەڕۆک** پیشان دەدرێت ───
                          پێشتر تەنها کۆی گشتی دەگوترا. بەکارهێنەر «١٠
                          سلاید»ی هەڵدەبژارد و شەش سلایدی ناوەڕۆکی
                          وەردەگرت (سەرەتا، ناوەڕۆک، سوپاس و
                          سەرچاوەکان چوار دانەیان دەبەن) — و ئەوە وەک
                          دێککێکی کورت دەردەکەوت بەبێ ئەوەی بزانرێت
                          بۆچی. */}
                      <b>{z.name}</b><i>{AR(z.n - FIXED)} سلایدی ناوەڕۆک</i>
                    </button>
                  ))}
                </div>
              </div>

              {/* چڕی دەق — درێژی هەر خاڵێک، نەک ژمارەی سلایدەکان */}
              <div className="qrow">
                <span className="qlab">دەق</span>
                <div className="chips">
                  {DENSITIES.map(d => (
                    <button key={d.id} className={`chip two${density === d.id ? ' on' : ''}`}
                      onClick={() => setDensity(d.id)}>
                      <b>{d.name}</b><i>{d.words[0]}–{d.words[1]} وشە بۆ هەر خاڵێک</i>
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── سەرچاوەکان ───
                  دوو شتی جیاواز: لە کوێوە بێن، و چۆن بنووسرێن.
                  مامۆستا زۆرجار شێوازێکی دیاریکراو داوا دەکات. */}
              <div className="qrow">
                <span className="qlab">سەرچاوە</span>
                <div className="chips">
                  {SOURCE_KINDS.map(s => (
                    <button key={s.id} className={`chip two${refKind === s.id ? ' on' : ''}`}
                      onClick={() => setRefKind(s.id)} title={s.where}>
                      <b>{s.name}</b><i>{s.note}</i>
                    </button>
                  ))}
                </div>
              </div>

              {refKind === 'web' && !canWeb && <div className="warn">
                جۆری «ماڵپەڕ» پێویستی بە مەکینەی گەڕان یان بە Gemini هەیە.
                بەبێ ئەوان هیچ بەستەرێکی ڕاستەقینە نادۆزرێتەوە — و ئێمە
                هەرگیز بەستەر هەڵنابەستین.
              </div>}

              <div className="qrow">
                <span className="qlab">شێوازی ژێدەر</span>
                <div className="chips">
                  {CITE_STYLES.map(s => (
                    <button key={s.id} className={`chip two${citeStyle === s.id ? ' on' : ''}`}
                      onClick={() => setCiteStyle(s.id)}>
                      <b>{s.name}</b><i>{s.note}</i>
                    </button>
                  ))}
                </div>
              </div>

              {/* نموونەیەکی ڕاستەقینە — بەکارهێنەر پێش دروستکردن دەیبینێت */}
              <div className="citedemo inpanel">
                <span className="mark">{styleById(citeStyle).numbered
                  ? styleById(citeStyle).marker(1) : '•'}</span>
                <p>{demoCite}</p>
              </div>

              <div className="qrow">
                <span className="qlab">بابەت</span>
                <input className="qin" value={topic} placeholder={ti.title}
                  onChange={e => setTopic(e.target.value)} />
              </div>

              {lang === 'en' && <div className="inpanel">
                <ProviderPicker keys={k} onChange={n => { setK(n); saveKeys(n); onKeys(n); }} />
              </div>}
              {!(k.keys[needed] ?? '') && <div className="warn">
                کلیلی <b>{providerById(needed).name}</b> دانەنراوە.
                <button className="lnk" onClick={() => setStep('key')}>دایبنێ</button>
              </div>}

              <div className="qrow">
                <span className="qlab">ناوەڕۆک</span>
                <button className="btn pri sm" onClick={askOutline} disabled={busy}>
                  {busy ? <span className="spin" /> : null}
                  {outline.length ? 'دووبارە پێشنیار بکە' : 'با AI پێشنیاری بکات'}
                </button>
              </div>

              {outline.length > 0 && <div className="olist inpanel">
                {outline.map((o, i) => (
                  <div className="oitem" key={i}>
                    <span className="n">{i + 1}</span>
                    <input value={o.title} onChange={e => {
                      const n = [...outline]; n[i] = { ...n[i], title: e.target.value }; setOutline(n);
                    }} />
                    <button className="btn icon sm" title="سڕینەوە"
                      onClick={() => setOutline(outline.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <button className="btn sm" style={{ alignSelf: 'flex-start' }}
                  onClick={() => setOutline([...outline, { title: '', hint: '' }])}>+ زیادکردن</button>
              </div>}

              {/* ═══ چۆن دروست بکرێت ═══
                  تیمەکە ١٢–١٨ بانگکردن دەکات، ڕێڕەوی خێرا ٣.
                  ژمارەکە دەگوترێت، چونکە بەکارهێنەرێکی خاوەن
                  کلیلێکی بێبەرامبەر دەبێت بزانێت چی هەڵدەبژێرێت. */}
              <div className="qrow">
                <span className="qlab">شێوازی دروستکردن</span>
                <div className="chips">
                  <button className={`chip two${crewOn ? ' on' : ''}`}
                    onClick={() => setCrewOn(true)}>
                    <b>تیمی ئەیجێنت</b><i>١٠ ئەیجێنت · باشترین ئەنجام</i>
                  </button>
                  <button className={`chip two${crewOn ? '' : ' on'}`}
                    onClick={() => setCrewOn(false)}>
                    <b>خێرا</b><i>یەک بانگکردن · کەمترین سنوور</i>
                  </button>
                </div>
              </div>

              <div className="crew inpanel">
                {crewOn ? <>
                  <b>دە ئەیجێنت بە ڕیز کار دەکەن</b>
                  <p>
                    هەریەکەیان یەک کار دەکات و ئەوەی پێشووی دەخوێنێتەوە:
                    بەڵگە دیاری دەکرێت، بەشەکان دەبەسترێن تاکو هیچ شتێک
                    دوو جار نەوترێت، سەرچاوە بۆ هەر بەشێک دەگەڕدرێت،
                    ئینجا هەر بەشێک بە جیا دەنووسرێت، دووبارەکان
                    لادەبرێن، وێنە دەگەڕدرێن، و لە کۆتاییدا هەموو
                    دێککەکە دەخوێندرێتەوە و چاک دەکرێتەوە.
                  </p>
                  <i>
                    نزیکەی {AR(STAGES.length + Math.max(1, outline.length))} داواکاری
                    بۆ مۆدێلەکە — درێژتر دەخایەنێت. ئەگەر سنووری کلیلەکەت
                    تەواو بوو، «خێرا» هەڵبژێرە.
                  </i>
                </> : <>
                  <b>یەک بانگکردن</b>
                  <p>
                    هەموو دێککەکە بە یەک داواکاری دەنووسرێت. خێراترە و
                    سنووری کەمتر دەخوات، بەڵام پێداچوونەوە و پشکنینی
                    دووبارەبوونەوەی تێدا نییە.
                  </p>
                </>}
              </div>

              <button className="lnk" onClick={() => setMore(!more)}>
                {more ? '▾' : '▸'} هەڵبژاردنی زیاتر
              </button>
              {more && <div className="inpanel">
                <label className="chk"><input type="checkbox" checked={useSearch}
                  onChange={e => setUseSearch(e.target.checked)} />
                  گەڕان لە ئینتەرنێت (سەرچاوەی ئەکادیمی — بێ ویکیپیدیا)</label>
                <label className="chk"><input type="checkbox" checked={withImages}
                  onChange={e => setWithImages(e.target.checked)} /> دانانی وێنە لە سلایدەکاندا</label>
                <label className="chk"><input type="checkbox" checked={humanizeOn}
                  onChange={e => setHumanizeOn(e.target.checked)} /> پاککردنەوەی شێوازی AI لە دەقەکاندا</label>
              </div>}
            </Ask>
          ) : done('plan') && (
            <Said to="plan" label="پلان" value={`${langName} · ${count} سلاید`} />
          ))}

          {/* ═══ دەق و قسەکەران ═══
              ئەمە دوای «پلان» دێت چونکە دابەشکردن پێویستی بە
              ژمارەی سلایدەکان هەیە، و ئەو لەوێدا دیاری دەکرێت. */}
          {at >= 5 && (step === 'talk' ? (
            <Ask>
              <b>دەقەکەت و کێ چی دەڵێت</b>
              <p>
                ئەگەر دەقی قسەکردنت نووسیوە، لێرەی دابنێ — سلایدەکان
                لەو دەقەوە دروست دەکرێن، بە هەمان ڕیزبەندی. ئەگەر
                نەتنووسیوە، بەجێی بهێڵە و تەنها دابەشکردنەکە ڕێکبخە.
              </p>

              <div className="f">
                <label>دەقی پێشکەشکردن <i>(هەڵبژاردەیی)</i></label>
                <textarea className="qin script" rows={7} value={script}
                  placeholder={'ئەو شتەی دەیڵێیت لێرە بنووسە…\n\nدەتوانیت دابەشکردنەکەشی تێدا بنووسیت:\nسارا ١–٥ (٦ خولەک)\nعەلی ٦–٨'}
                  onChange={e => setScript(e.target.value)} />
              </div>

              {!!script.trim() && (
                <div className="qrow">
                  <span className="qlab">لە دەقەکەوە</span>
                  <button className="btn sm" onClick={readScript}>
                    ناو و کاتەکانی تێدا بخوێنەوە
                  </button>
                </div>
              )}
              {found && <div className="inpanel note">{found}</div>}

              {/* ─── کات ───
                  کات ژمارەی سلایدەکان پێشنیار دەکات، بەڵام بەزۆر
                  نایگۆڕێت — لەوانەیە مامۆستا ژمارەیەکی داوا کردبێت. */}
              <div className="qrow">
                <span className="qlab">کۆی کات</span>
                <div className="chips">
                  {[0, 5, 10, 15, 20, 30].map(m => (
                    <button key={m} className={`chip${minutes === m ? ' on' : ''}`}
                      onClick={() => setMinutes(m)}>
                      {m ? `${m} خولەک` : 'دیاری نەکراوە'}
                    </button>
                  ))}
                </div>
              </div>

              {minutes > 0 && (() => {
                const want = suggestSlides(minutes);
                const mine = expectedMinutes(count);
                if (Math.abs(want - count) <= 2) return (
                  <div className="inpanel note">
                    {count} سلاید بۆ {minutes} خولەک گونجاوە.
                  </div>
                );
                return (
                  <div className="warn">
                    {minutes} خولەک نزیکەی <b>{want}</b> سلاید دەگرێت، بەڵام
                    {' '}{count} سلایدت هەڵبژاردووە (نزیکەی {mine} خولەک).
                    <button className="lnk" onClick={() => setCount(want)}>
                      بیکە {want}
                    </button>
                    <button className="lnk" onClick={() => setStep('plan')}>
                      گەڕانەوە بۆ درێژی
                    </button>
                  </div>
                );
              })()}

              {/* ─── دابەشکردن ───
                  ژمارەکان ئەوانەن کە لە ستودیۆدا دەبینرێن:
                  ١ = لاپەڕەی سەرەتا، دواتر ناوەڕۆک، … تا {count}. */}
              <div className="qrow">
                <span className="qlab">دابەشکردن</span>
                <div className="chips">
                  <button className="chip" onClick={() => {
                    setTouched(false);
                    setSpeakers(autoSplit(names, count, minutes));
                  }}>دابەشی بکە بە یەکسانی</button>
                </div>
              </div>

              {!names.length ? (
                <div className="warn">
                  هیچ ناوی خوێندکارێک دانەنراوە.
                  <button className="lnk" onClick={() => setStep('who')}>دایانبنێ</button>
                </div>
              ) : (
                <div className="spk inpanel">
                  <div className="shead">
                    <span>خوێندکار</span><span>لە</span><span>بۆ</span><span>خولەک</span>
                  </div>
                  {speakers.map((s, i) => (
                    <div className="srow" key={i}>
                      <input value={s.name} onChange={e => editSpeaker(i, { name: e.target.value })} />
                      <input type="number" min={1} max={count} value={s.from}
                        onChange={e => editSpeaker(i, { from: Number(e.target.value) || 1 })} />
                      <input type="number" min={1} max={count} value={s.to}
                        onChange={e => editSpeaker(i, { to: Number(e.target.value) || 1 })} />
                      <input type="number" min={0} value={s.minutes || ''}
                        placeholder="—"
                        onChange={e => editSpeaker(i, { minutes: Number(e.target.value) || 0 })} />
                      <button className="btn icon sm" title="لابردن" onClick={() => {
                        setTouched(true);
                        setSpeakers(sp => sp.filter((_, j) => j !== i));
                      }}>×</button>
                    </div>
                  ))}
                  <button className="btn sm" style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      setTouched(true);
                      const last = speakers[speakers.length - 1];
                      const from = Math.min(count, (last?.to ?? 0) + 1);
                      setSpeakers([...speakers, { name: '', from, to: count, minutes: 0 }]);
                    }}>+ قسەکەر</button>
                </div>
              )}

              {splitWarn.length > 0 && <div className="warn">
                {splitWarn.map((w, i) => <div key={i}>{w}</div>)}
                <i>دروستکردن بەردەوام دەبێت — ئەمانە تەنها ئاگادارین.</i>
              </div>}
            </Ask>
          ) : done('talk') && (
            <Said to="talk" label="قسەکەران"
              value={speakers.length
                ? `${speakers.length} خوێندکار${minutes ? ` · ${minutes} خولەک` : ''}${script.trim() ? ' · بە دەق' : ''}`
                : 'دابەش نەکراوە'} />
          ))}

          {/* ═══ دروستکردن ═══ */}
          {step === 'build' && (
            <Ask>
              <b>دەستم پێکرد…</b>
              <div className="work">
                <span className="spin" /> {msg}
                <span className="spacer" />
                <span className="cnt">
                  {count} سلاید · {prog}٪ · {secs > 59
                    ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
                    : `${secs}چ`}
                </span>
              </div>
              {/* دوای ٤٥ چرکە: بەکارهێنەر دەبێت بزانێت کێشە نییە */}
              {secs > 45 && (
                <p className="fine">
                  زیاتر لە ئاسایی خایاند. مۆدێلەکە هێشتا کار دەکات —
                  دەتوانیت چاوەڕوان بکەیت یان بیوەستێنیت.
                </p>
              )}
              <div className="progress"><i style={{ width: `${prog}%` }} /></div>

              {/* ─── قۆناغەکانی تیمەکە ───
                  بەکارهێنەر دەبینێت کام ئەیجێنت ئێستا کاردەکات، و
                  کامیان شکستی هێناوە. ئەمە گرنگە چونکە قۆناغێکی
                  شکاو **دێککەکە ناوەستێنێت** — بەبێ ئەم لیستە
                  بەکارهێنەر هەرگیز نازانێت پێداچوونەوە کرا یان نا. */}
              {crewOn && stages.length > 0 && (
                <div className="stages">
                  {STAGES.map(s => {
                    const at = stages.find(x => x.id === s.id);
                    const state = at?.state ?? 'wait';
                    return (
                      <div key={s.id} className={`stg ${state}`}>
                        <span className="mk">
                          {state === 'ok' ? '✓' : state === 'fail' ? '×'
                            : state === 'skip' ? '–' : state === 'run' ? <span className="spin" /> : ''}
                        </span>
                        <b>{s.label}</b>
                        {at?.detail && <i>{at.detail}</i>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ─── بەڵگەی دێککەکە ───
                  یەکەم شتە مۆدێل دەینووسێت، بۆیە زووترین شتێکە
                  بەکارهێنەر دەیبینێت — و ئەوەی پێی دەڵێت دێککەکە
                  ڕووی لە کوێیە. */}
              {/* ─── داتابەیسەکان لە کاتی گەڕاندا ───
                  پێشتر تەنها «گەڕان بۆ توێژینەوە…» دەردەدەکەوت و
                  هیچی تر. ئێستا دەردەکەوێت کە بەڕاستی سێ داتابەیسی
                  جیاواز پرسیاریان لێدەکرێت، و کامەیان وەڵامی نەدایەوە. */}
              {hits.length > 0 && (
                <div className="dbs">
                  {hits.map(h => (
                    <span key={h.name} className={`db${h.ok ? '' : ' bad'}`}>
                      {h.ok ? '✓' : '×'} {h.name}
                      {h.ok && <i>{AR(h.n)}</i>}
                    </span>
                  ))}
                </div>
              )}

              {thesis && (
                <div className="thesis">
                  <span className="lbl">بەڵگەی سەرەکی</span>
                  <p>{thesis}</p>
                </div>
              )}

              {/* ─── سلایدەکان وەک دەنووسرێن ───
                  پێشتر لێرەدا تەنها چوارگۆشەی بەتاڵ بوو کە دوای
                  تەواوبوونی هەموو شتێک یەکجارە ✓ ـیان دەگرت. ئێستا
                  ناوەڕۆکی ڕاستەقینە دەردەکەوێت — ناونیشان و خاڵەکان —
                  هەر ئەو کاتەی مۆدێل دەیاننووسێت. */}
              <div className="skel live">
                {Array.from({ length: count }, (_, i) => {
                  // ١ = لاپەڕەی سەرەتا، ٢ = ناوەڕۆک، دواتر ناوەڕۆک
                  const s = live[i - 2];
                  const done = i < filled;
                  return (
                    <div key={i} className={`sk${s || done ? ' on' : ''}${s ? ' has' : ''}`}>
                      <span className="n">{AR(i + 1)}</span>
                      {s ? <>
                        <b className="ttl">{s.title}</b>
                        {s.bullets.slice(0, 3).map((b, j) => (
                          <span className="bl" key={j}>{b}</span>
                        ))}
                        {!s.bullets.length && s.body && <span className="bl">{s.body}</span>}
                        <span className="lay">{layoutById(s.layout).name}</span>
                      </> : <>
                        <span className="ln" /><span className="ln s" />
                      </>}
                      {done && !s && <span className="tick">✓</span>}
                    </div>
                  );
                })}
              </div>
              <p className="fine">لاپەڕەکە دامەخە تا تەواو دەبێت.</p>
            </Ask>
          )}

          {err && <div className="say ai"><span className="dot err" /><div className="bub bad">{err}</div></div>}
          <div ref={endRef} />
        </div>
      </div>

      {/* ═══ شریتی وەڵام ═══ */}
      {/* لە کاتی دروستکردندا: تاکە کارێک هەیە — وەستاندن */}
      {step === 'build' && busy && (
        <div className="composer">
          <div className="lane cbtns">
            <span className="spacer" />
            <button className="btn" onClick={() => {
              stopRef.current?.abort();
              setBusy(false); setProg(0); setStep('talk');
              setErr('دروستکردن وەستێنرا.');
            }}>وەستاندن</button>
          </div>
        </div>
      )}

      {step !== 'build' && (
        <div className="composer">
          <div className="lane">
            {step === 'title' ? (
              <div className="cbox">
                <input autoFocus value={ti.title}
                  placeholder="بۆ نموونە: DNS and Changing IP"
                  onChange={e => setTi({ ...ti, title: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter' && ti.title.trim()) setStep('who'); }} />
                <button className="send" disabled={!ti.title.trim()} onClick={() => setStep('who')}>↵</button>
              </div>
            ) : (
              <div className="cbtns">
                {at > 0 && step !== 'key' && (
                  <button className="btn" disabled={busy}
                    onClick={() => setStep(ORDER[at - 1])}>گەڕانەوە</button>
                )}
                <span className="spacer" />
                {step === 'who' && saved && !editInfo && (
                  <button className="btn" onClick={() => setEditInfo(true)}>دەستکاری</button>
                )}
                <button className="btn pri lg" disabled={busy || !canGo()} onClick={next}>
                  {label()}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* یاریدەدەرەکە دۆخی ڕاستەقینەی فۆرمەکە دەبینێت — بۆیە
          تەنها ئەو شتە دەڵێت کە لەم ساتەدا سوودی هەیە */}
      <Mascot state={{
        screen: 'wizard',
        step,
        lang,
        hasKey: !!(k.keys[needed] ?? ''),
        isGemini: needed === 'gemini',
        busy: busy ? msg : undefined,
        error: err || undefined,
      }} />
    </div>
  );

  function canGo(): boolean {
    if (step === 'key')   return hasKey(k);
    if (step === 'title') return !!ti.title.trim();
    if (step === 'who')   return !!ti.university.trim();
    if (step === 'look')  return true;
    if (step === 'plan')  return !!(k.keys[needed] ?? '') && (topic || ti.title).trim().length > 2;
    // ئاگاداری دابەشکردن ڕێگری ناکات — بڕوانە `checkSpeakers`
    if (step === 'talk')  return true;
    return false;
  }

  function label(): string {
    if (step === 'who')  return saved && !editInfo ? 'بەڵێ، دروستن' : 'پاشەکەوت و بەردەوامبوون';
    if (step === 'talk') return 'دروستکردنی پێشکەشکردن';
    return 'دواتر';
  }

  function next() {
    if (step === 'key')   return setStep('title');
    if (step === 'title') return setStep('who');
    if (step === 'who')   { setEditInfo(false); return setStep('look'); }
    if (step === 'look')  return setStep('plan');
    if (step === 'plan')  return setStep('talk');
    if (step === 'talk')  return void build();
  }
}
