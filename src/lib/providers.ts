// ═══════════ دابینکەرەکانی AI ═══════════
//
// یاسای نەگۆڕ:
//   کوردی و عەرەبی → تەنها Gemini (باشترین مۆدێلە بۆ ئەم دوو زمانە)
//   ئینگلیزی        → بەکارهێنەر خۆی هەڵدەبژێرێت
//
// هەموو کلیلێک هی بەکارهێنەرە و لە وێبگەڕەکەی خۆیدا دەمێنێتەوە.

export type ProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'deepseek' | 'groq';

export interface ModelChoice { id: string; name: string }

export interface Provider {
  id: ProviderId;
  name: string;
  /** لینکی ڕاستەوخۆ بۆ دروستکردنی کلیل */
  keyUrl: string;
  /** ناوی ماڵپەڕەکە بۆ پیشاندان */
  site: string;
  /** سەرەتاکانی ڕێپێدراوی کلیل — بۆ ئاگادارکردنەوەی خێرا */
  prefix: string[];
  placeholder: string;
  models: ModelChoice[];
  /** گەڕانی ئینتەرنێتی ناوەوە هەیە؟ */
  search: boolean;
  /** دروستکردنی وێنە هەیە؟ */
  images: boolean;
  /** پلانی بێبەرامبەری هەیە؟ */
  free: 'yes' | 'limited' | 'no';
  /** چۆن کلیلەکە وەربگریت — بە کوردی */
  howTo: string[];
  note?: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    site: 'aistudio.google.com',
    keyUrl: 'https://aistudio.google.com/apikey',
    // Google دوو شێوازی کلیلی هەیە: AIza… ی کۆن و AQ.… ی نوێ
    prefix: ['AIza', 'AQ.'],
    placeholder: 'AIzaSy…  یان  AQ.…',
    // ═══ Pro لە سەرەوە، نەک Flash ═══
    // خاوەنی بەرهەمەکە: «مۆدێلێکی باشتر بۆ دروستکردنی سلاید، نەک
    // Flash. ئەگەر سنووری هەبێت کێشە نییە — بەکارهێنەر ١ بۆ ٣
    // پێشکەشکردن لە هەفتەیەکدا دروست دەکات.»
    //
    // ئەمە بڕیارێکی دروستە: Flash بۆ کاری زۆر و خێرا دروستکراوە.
    // ٣ پێشکەشکردن لە هەفتەیەکدا هیچ سنوورێکی ڕێژە ناشکێنێت، بۆیە
    // خێرایی هیچ نرخێکی نییە لێرەدا و کوالیتی هەموو شتێکە.
    //
    // ═══ `gemini-3.1-pro` لابرا ═══
    // زیادکرا بەپێی داواکاری، ئینجا OpenRouter بە ڕوونی وەڵامی
    // دایەوە: «google/gemini-3.1-pro is not a valid model ID». واتە
    // ئەم مۆدێلە بوونی نییە. دانانی ناوێکی پشکنین‌نەکراو لە سەرەوەی
    // لیستەکە واتای ئەوە بوو کە `testKey` (کە `models[0]` بەکاردەهێنێت)
    // **کلیلێکی دروستی وەک کلیلێکی خراپ** پیشان دەدا.
    //
    // ئەگەر Google مۆدێلێکی Pro ی نوێ دابنێت، لێرەدا زیادی بکە —
    // بەڵام یەکەم لە ڕووکارەکەدا تاقی بکەرەوە پێش ئەوەی بیکەیتە
    // یەکەمی لیستەکە.
    models: [
      { id: 'gemini-2.5-pro',        name: 'Gemini 2.5 Pro — پێشنیارکراو بۆ سلاید' },
      { id: 'gemini-3.6-flash',      name: 'Gemini 3.6 Flash — خێرا' },
      { id: 'gemini-3.5-flash',      name: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite — خێراترین' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
    ],
    search: true,
    images: true,
    free: 'yes',
    howTo: [
      'بڕۆ بۆ aistudio.google.com/apikey',
      'بە هەژماری Google خۆت بچۆ ژوورەوە',
      'کلیک لە «Create API key» بکە',
      'پرۆژەیەک هەڵبژێرە یان نوێیەک دروست بکە',
      'کلیلەکە کۆپی بکە و لێرە بیچەسپێنە',
    ],
    note: 'تاقە دابینکەرە کە گەڕانی ئینتەرنێت و دروستکردنی وێنەی تێدایە. بۆ کوردی و عەرەبی پێویستە.',
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    site: 'platform.openai.com',
    keyUrl: 'https://platform.openai.com/api-keys',
    prefix: ['sk-'],
    placeholder: 'sk-proj-…',
    models: [
      { id: 'gpt-4o',      name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini — هەرزانتر' },
      { id: 'gpt-4.1',     name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini',name: 'GPT-4.1 mini' },
    ],
    search: false,
    images: true,
    free: 'no',
    howTo: [
      'بڕۆ بۆ platform.openai.com/api-keys',
      'بچۆ ژوورەوە یان هەژمارێک دروست بکە',
      'کلیک لە «Create new secret key» بکە',
      'کلیلەکە کۆپی بکە — دوای داخستنی پەنجەرەکە جارێکی تر پیشان نادرێت',
      'لە Billing دا کرێدیت زیاد بکە — بەبێ ئەوە کار ناکات',
    ],
    note: 'پلانی بێبەرامبەری نییە — دەبێت کرێدیت بکڕیت.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    site: 'console.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    prefix: ['sk-ant-'],
    placeholder: 'sk-ant-…',
    models: [
      { id: 'claude-sonnet-5',           name: 'Claude Sonnet 5' },
      { id: 'claude-opus-5',             name: 'Claude Opus 5 — بەهێزترین' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 — خێراترین' },
    ],
    search: false,
    images: false,
    free: 'no',
    howTo: [
      'بڕۆ بۆ console.anthropic.com/settings/keys',
      'بچۆ ژوورەوە یان هەژمارێک دروست بکە',
      'کلیک لە «Create Key» بکە',
      'کلیلەکە کۆپی بکە',
      'لە Billing دا کرێدیت زیاد بکە',
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    site: 'openrouter.ai',
    keyUrl: 'https://openrouter.ai/keys',
    prefix: ['sk-or-'],
    placeholder: 'sk-or-v1-…',
    models: [
      { id: 'google/gemini-3.6-flash',    name: 'Gemini 3.6 Flash' },
      { id: 'google/gemini-3.5-flash',    name: 'Gemini 3.5 Flash' },
      { id: 'openai/gpt-4o-mini',         name: 'GPT-4o mini' },
      { id: 'anthropic/claude-sonnet-5',  name: 'Claude Sonnet 5' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
    ],
    search: false,
    images: false,
    free: 'limited',
    howTo: [
      'بڕۆ بۆ openrouter.ai/keys',
      'بە Google یان GitHub بچۆ ژوورەوە',
      'کلیک لە «Create Key» بکە',
      'کلیلەکە کۆپی بکە',
    ],
    note: 'یەک کلیل بۆ دەیان مۆدێلی جیاواز. هەندێک مۆدێل بێبەرامبەرن.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    site: 'platform.deepseek.com',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    prefix: ['sk-'],
    placeholder: 'sk-…',
    models: [
      { id: 'deepseek-chat',     name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner — بیرکردنەوەی قووڵ' },
    ],
    search: false,
    images: false,
    free: 'no',
    howTo: [
      'بڕۆ بۆ platform.deepseek.com/api_keys',
      'هەژمارێک دروست بکە',
      'کلیک لە «Create API key» بکە',
      'کلیلەکە کۆپی بکە',
    ],
    note: 'زۆر هەرزانە بەراورد بە هی تر.',
  },
  {
    id: 'groq',
    name: 'Groq',
    site: 'console.groq.com',
    keyUrl: 'https://console.groq.com/keys',
    prefix: ['gsk_'],
    placeholder: 'gsk_…',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant',    name: 'Llama 3.1 8B — زۆر خێرا' },
    ],
    search: false,
    images: false,
    free: 'yes',
    howTo: [
      'بڕۆ بۆ console.groq.com/keys',
      'بە Google بچۆ ژوورەوە',
      'کلیک لە «Create API Key» بکە',
      'کلیلەکە کۆپی بکە',
    ],
    note: 'بێبەرامبەرە و زۆر خێرایە، بەڵام سنووری داواکاری هەیە.',
  },
];

export const providerById = (id: ProviderId) =>
  PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0];

/** ئەو دابینکەرانەی دەقی ئینگلیزی دروست دەکەن */
export const TEXT_PROVIDERS = PROVIDERS;

/** ئەو دابینکەرانەی وێنە دروست دەکەن */
export const IMAGE_PROVIDERS = PROVIDERS.filter(p => p.images);

/** کوردی و عەرەبی تەنها Gemini قبووڵ دەکەن */
export const requiresGemini = (lang: string) => lang === 'ckb' || lang === 'ar';

/** پشکنینی سەرەتایی — پێش ئەوەی داواکارییەک بنێردرێت */
export function looksValid(id: ProviderId, key: string): boolean {
  const k = key.trim();
  if (k.length < 15) return false;
  return providerById(id).prefix.some(pre => k.startsWith(pre));
}
