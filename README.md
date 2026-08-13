# Presentation Studio — AI Academic Presentation Generator

> **This file is a briefing document for an AI code reviewer.**
> It describes what the project is, the hard constraints it must obey, every
> module and every item catalogue, the exact system prompts sent to the models,
> what is verified, and what is known to be weak.
> Read **§2 Hard Constraints** before proposing any change — several "obvious
> improvements" are explicitly forbidden by the product requirements.

---

## 1. What this is

A **100% browser-side** web app that generates academic presentations
(PowerPoint / PDF) for university students, with a full slide editor and a
tool-using AI agent.

Target user: university students in the Kurdistan Region of Iraq writing
presentations in **Kurdish Sorani**, **Arabic**, or **English**.

**The UI language is Kurdish Sorani (ckb), RTL.** All comments in the codebase
are written in Kurdish Sorani. This is intentional — do not suggest translating
the code comments to English.

**Live:** https://iosbb1.web.app
**Dev URL:** `http://localhost:3210`

---

## 2. Hard Constraints (non-negotiable — these come from the product owner)

| # | Constraint | Why it exists |
|---|-----------|---------------|
| C1 | **No backend. No server routes. No database.** Everything runs in the user's browser. `fetch()` goes directly from the browser to third-party APIs. | The app must deploy as a static site with zero hosting cost and zero liability. |
| C2 | **The project ships ZERO API keys.** Every user brings their own key. Keys live in `localStorage` only. | The owner will not pay for other people's usage. |
| C3 | **Kurdish (`ckb`) and Arabic (`ar`) MUST use Gemini.** No exceptions, no user override. English may use any provider. | Empirically, Gemini is the only model that writes acceptable Kurdish Sorani. Enforced in `pickTextProvider()`. |
| C4 | **Wikipedia is banned entirely** — as a citation, as a source, as grounding. Also banned: Quora, Reddit, Medium, blogs, SlideShare, Chegg, W3Schools, GeeksforGeeks, TutorialsPoint, Studocu, Scribd, CourseHero. | University credibility/plagiarism rules. |
| C5 | **No user accounts, no login, no sign-up.** Persistence is IndexedDB + a manual export/import button. | The owner explicitly rejected auth and Google Drive. |
| C6 | **The AI must never invent a citation.** References must come from real databases. | Fabricated DOIs get students failed. |
| C7 | **Slide 1 is a fixed design** reverse-engineered from the owner's own `.pptx`. Do not redesign it. | It is their university's required format. |
| C8 | **Animations/transitions are required, not optional.** | Explicit request: "نریدها ضروري، ضروري جدا". |
| C9 | Exported PPTX must be **natively editable** — real text boxes, real tables, real charts. Never export slides as images. | Students must be able to fix things in PowerPoint. |

**Anything that requires a server, a shared key, an account, or Wikipedia is
automatically out of scope.** If your best idea needs one of those, say so
explicitly and propose the closest client-side alternative instead.

---

## 3. Stack

```
Next.js        16.3.0   App Router, Turbopack, static-exportable
React          19.2.8
TypeScript     5.x      strict
pptxgenjs      4.0.1    PPTX generation
jszip          3.10.1   post-processing the PPTX ZIP (transitions + animations)
jspdf          4.2.1    PDF export (vector primitives + raster fallback)
html2canvas    1.4.1    slide → canvas for the raster PDF path
katex         0.18.1    MIT — TeX rendering; also the MathML source for OOXML equations

devDependencies
lucide-static  1.28.0   ISC — icon source, build-time only, NOT shipped
tsx            4.23.6   runs the check scripts
```

No state library, no UI library, no CSS framework. Plain React state and a
single `globals.css`. **~11,500 lines of TypeScript + CSS total.**

`lucide-static` is a **build-time** dependency only: `scripts/gen-icons.ts`
reads it and emits `src/lib/icons-lucide.ts` (184 icons, ~38 KB of path data).
The runtime bundle never imports the package.

> **Note on Next.js 16:** this version has breaking changes vs. older training
> data. `RootLayout` uses the generated `LayoutProps<'/'>` type, not
> `{ children: React.ReactNode }`. Docs live in `node_modules/next/dist/docs/`.
> Do not "fix" the layout signature.

---

## 4. Directory map

```
src/
├── app/
│   ├── layout.tsx         28 loc   RTL root, Vazirmatn font, suppressHydrationWarning
│   ├── page.tsx            5 loc   renders <Studio/>  — the only route
│
├── public/                        PWA shell
│   ├── manifest.webmanifest       installable app metadata
│   ├── mascot/                    9 robot poses, WebP with alpha — 172 KB total
│   ├── sw.js                      service worker — app cached, API never cached
│   └── icon.svg                   app icon
│   └── globals.css       941 loc   all styling; themes & styles via CSS custom properties
│
├── components/
│   ├── Studio.tsx      1 038 loc   editor shell: rail | canvas | inspector, 6 tabs
│   ├── SlideView.tsx     846 loc   renders all 33 layouts at 1920×1080, scaled (memoized)
│   ├── Wizard.tsx        636 loc   creation flow as a conversation, 6 steps
│   ├── KeyPanel.tsx      187 loc   BYO-key UI with per-provider "how to get a key"
│   ├── Agent.tsx         173 loc   agent chat panel + live thinking/tool trace
│   ├── PresenterMode.tsx 330 loc   ★ dual-screen presenting, timer, laser, pen, grid
│   ├── Toolbar.tsx       128 loc   floating format toolbar + right-click ContextMenu
│   ├── Offline.tsx        48 loc   service-worker registration + offline badge
│   ├── Mascot.tsx         96 loc   ★ robot helper — contextual tips, dismissible
│   └── ThemePicker.tsx   160 loc   style + theme gallery, lazy real SlideView previews
│
├── lib/
│   ├── agent.ts        1 085 loc   ★ the agent: 14 tools, 3 provider formats
│   ├── generate.ts       335 loc   deck generation (prompt → Slide[])
│   ├── icons.ts          291 loc   58 hand-drawn icons + 18 shapes + merge with Lucide
│   ├── llm.ts            246 loc   unified gateway — callModel / makeImage / testKey
│   ├── gemini.ts         232 loc   Gemini transport + the hardened JSON extractor
│   ├── icons-lucide.ts   207 loc   GENERATED — 184 Lucide paths
│   ├── providers.ts      201 loc   6 AI providers: metadata, models, key format, how-to
│   ├── deco.ts           199 loc   ★ Morph choreography — the travelling background shapes
│   ├── storage.ts        239 loc   localStorage keys/profile + IndexedDB decks + export/import
│   ├── imagetool.ts      189 loc   watermark eraser + compressImage (JPEG/PNG pipeline)
│   ├── history.ts        186 loc   ★ undo/redo with a content-addressed image pool
│   ├── fit.ts            156 loc   ★ shared text-fitting maths (preview == export)
│   ├── sanitize.ts       134 loc   ★ prompt-injection filter for tool results
│   ├── net.ts            130 loc   ★ timeout + 429/503 backoff — every request goes through it
│   ├── fonts.ts          122 loc   ★ Kurdish glyph coverage + complex-script font
│   ├── math.ts           330 loc   ★ TeX → KaTeX (preview) and → OMML (native PPTX)
│   ├── translate.ts      210 loc   ★ deck translation with formula/citation protection
│   ├── cite.ts           175 loc   ★ BibTeX / RIS / APA export from verified refs
│   ├── types.ts          197 loc   Deck, Slide, SlideElement, TitleInfo, SlotOverride
│   ├── research.ts       263 loc   source policy, outline suggestion, reference finding
│   ├── humanize.ts       161 loc   de-AI-ify generated text
│   ├── layouts.ts        203 loc   33 layout definitions + wireframes + textBox() capacity
│   ├── styles.ts         132 loc   ★ 6 design style packs + 3 text densities
│   ├── citestyle.ts      330 loc   ★ 6 citation styles × 3 source kinds
│   ├── mascot.ts         165 loc   ★ app state → which tip the robot says
│   ├── script.ts         230 loc   ★ the student's own script + who presents which slides
│   ├── domains.ts         45 loc   ★ per-field standards, shared by both prompts
│   ├── stream.ts         120 loc   ★ read JSON and SSE before the response finishes
│   ├── themes.ts         131 loc   24 colour palettes
│   ├── tools/
│   │   ├── data.ts       300 loc   Openverse images, World Bank stats, web search
│   │   ├── academic.ts   440 loc   OpenAlex + Crossref + DOAJ + Open Library, ranking
│   │   └── slideImage.ts  98 loc   AI-image → free-image fallback chain
│   └── export/
│       ├── pptx.ts       998 loc   ★ native PPTX writer for all 33 layouts × 6 styles
│       ├── morph.ts      440 loc   ★ Morph + builds + OOXML/font/math normalization
│       └── pdf.ts         46 loc   html2canvas + jspdf
│
└── scripts/
    ├── check-core.ts     870 loc   268 assertions — fit, cite styles, history, sanitize, net
    ├── check-export.ts   351 loc    94 assertions — PPTX structure, styles, bullets, OOXML
    ├── gen-icons.ts      111 loc   regenerates icons-lucide.ts from lucide-static
    ├── check-tools.ts    160 loc    67 LIVE assertions — hits the real free APIs
    └── check-icons.ts     75 loc  1000 assertions — every icon/shape renders to valid SVG
```

Commands:

```bash
npm run dev          # localhost:3200
npm run build
npm run check        # tsc --noEmit + check-core + check-icons + check-export   (offline)
npm run check:live   # check-tools — real network calls to the free APIs
```

---

## 5. Pages & screens

There is **one route** (`/`). `Studio.tsx` swaps between two screens.

### 5.1 Wizard — the creation flow

Rendered as a **conversation**, not a form. Each answered step collapses into a
one-line summary (`Said`) that can be clicked to reopen.

| Step | id | What it asks |
|---|---|---|
| 1 | `key` | The API key. `KeyPanel` shows a Kurdish step-by-step guide per provider. |
| 2 | `title` | Presentation title. |
| 3 | `who` | University / institute / department / teacher / students / year / logo. Saved to `localStorage` as a **Profile** and pre-filled next time. |
| 4 | `look` | **Style pack** (6, structure) then **theme** (24, colour). Every card is a real `SlideView` at `scale = 306/1920` or `232/1920` — not a mock. |
| 5 | `plan` | Language · deck size · **text density** · topic · provider (English only) · AI-suggested outline (editable, reorderable). |
| 6 | `build` | Live progress: percent, elapsed seconds, a "taking longer than usual" note after 45 s, and a **وەستاندن** (Stop) button. |

Deck size uses **named presets**, because "14 slides" says nothing:

```ts
const SIZES = [
  { id: 'short',    name: 'کورت',   range: '٨–١٠',  n: 10 },
  { id: 'normal',   name: 'ئاسایی', range: '١٢–١٥', n: 14 },
  { id: 'detailed', name: 'ورد',    range: '١٨–٢٥', n: 20 },
];
const FIXED = 4;   // title + outline + thanks + references are always added
```

> **Do not move `Ask` / `Said` inside the `Wizard` function.** React gives a
> component defined during render a new identity every render, unmounting its
> children — which made every text input lose focus after one keystroke. They
> live at module scope with a comment explaining why.

### 5.2 Studio — the editor

Three columns: **slide rail | canvas | inspector**. The inspector can be
collapsed and its tabs are a `grid-template-columns: repeat(3, 1fr)` (six tabs
in a 312 px panel clipped when they were `flex: 1`).

| Tab | id | Contents |
|---|---|---|
| ئەیجێنت | `agent` | Chat panel with live thinking + tool trace |
| تەختەبەند | `lay` | 33 layout cards as wireframe SVGs; switching calls `retarget()` |
| ئایکۆن | `ins` | 242 icons in 12 groups, 18 shapes, free text, image insert |
| پاشبنەما | `th` | Style gallery, theme gallery, font, text density |
| ناوەڕۆک | `txt` | Title, bullets, body, chart data, table data, speaker notes |
| ڕێکخستن | `set` | Transition ms, build mode, project export/import, deck list |

Editing affordances:

- **Double-click text → edit in place.**
- **Floating toolbar** (`Toolbar.tsx`) appears above the selection: colour, size,
  bold, italic, alignment, layer order (front / forward / backward / back),
  duplicate, delete.
- **Right-click → `ContextMenu`** with the same actions, context-sensitive.
- **Drag to move, corner handle to resize** — writes a `SlotOverride`.
- **Image tools**: insert, frame (`none | round | circle | square`), border
  colour/width, and a **watermark eraser** (`imagetool.ts`) — drag circles over
  the watermark and it inpaints from a sampled ring around each stroke.
- **Undo / redo** — `Ctrl+Z` / `Ctrl+Y`, full-deck snapshots, capped at 60.
- **Export**: `.pptx`, `.pdf`, and `.json` project file.

---

## 6. Item catalogues

Everything the user can pick from, and the file that owns it.

| Catalogue | Count | File | Notes |
|---|---|---|---|
| **Layouts** | 33 | `layouts.ts` | Each declares `needs[]`, an optional `bulletRange`, and a `wire[]` wireframe |
| **Themes** (colour) | 24 | `themes.ts` | 15 light + 9 dark; each is exactly 8 CSS custom properties |
| **Style packs** (structure) | 6 | `styles.ts` | card treatment, accent, title, bullet glyph, outline layout, deco intensity |
| **Text densities** | 3 | `styles.ts` | `short` / `normal` / `long` — affects the prompt *and* the rendered size |
| **Icons** | 242 | `icons.ts` + `icons-lucide.ts` | 58 hand-drawn from primitives + 184 Lucide (ISC), merged into 12 groups. The editor offers all 242; the agent may only use the 58 (§9.3) |
| **Shapes** | 18 | `icons.ts` | `rect roundRect circle triangle diamond pentagon hexagon star5 arrowR arrowL arrowU arrowD chevron callout banner plus parallel trapezoid` |
| **Deco shapes** | 11 kinds × 9 instances | `deco.ts` | `circle round triangle diamond hexagon pentagon star blob chevron arrow arc` |
| **Fonts** | 10 | `Studio.tsx` | 6 serif + 4 sans; exported via `primaryFont()` |
| **AI providers** | 6 | `providers.ts` | `gemini openai anthropic openrouter deepseek groq` |
| **World Bank indicators** | 13 | `tools/data.ts` | Real series, used by `get_statistics` |
| **Search engines** | 3 | `tools/data.ts` | `tavily brave serper` — optional, user's own key |

### 6.1 The 33 layouts

```
L_title      fixed title page (C7)          L_outline    contents
L_bullets    bullets + image right          L_bulletsL   image left + bullets
L_text       lead sentence + paragraph      L_hero       full-bleed image + text
L_bar        vertical bar chart             L_line       line chart
L_donut      donut chart + bullets          L_progress   4 percentage bars
L_two        2 comparison columns           L_three      3 numbered cards
L_steps      4 sequential steps             L_cycle      4 stages in a circle
L_flow       4 boxes, left→right chain      L_time       4 dated milestones
L_table      data table                     L_compare    yes/no feature matrix
L_kpi        3 headline figures             L_quote      quotation + attribution
L_grid       2×2 image grid                 L_icons      6 short feature cards
L_proscons   strengths vs weaknesses        L_pyramid    3 levels, narrow→wide
L_venn       2 overlapping sets             L_ba         before / after
L_def        term + pronunciation + meaning L_code       code block or formula
L_state      one powerful sentence          L_team       up to 4 members
L_divider    section break                  L_thanks     closing slide
L_refs       references
```

### 6.2 The 6 style packs

The theme changes **colour**. The style changes **structure**.

| id | name | card | accent | title | bullet | outline layout | deco |
|---|---|---|---|---|---|---|---|
| `glass` | شووشە | glass, r52 | short gold rule | italic | ● | numbered circles, 2 col | 1.00 |
| `edge` | لێوار | none | 26 px bar down the slide edge | upright | – | numbered rows | 0.55 |
| `band` | تەریق | none | solid band across the top, white title | upright | ■ | boxed cards, 2 col | 0.40 |
| `frame` | چوارچێوە | thin outline | rules above and below, centred | italic | ○ | vertical rail with dots | 0.70 |
| `paper` | پەڕە | solid sheet, sharp corners | thick vertical rule beside the title | upright | 1. 2. 3. | numbered rows | 0.25 |
| `plain` | سادە | none | one hairline | upright | – | numbered rows | 0.18 |

**Why the content frame does not change between styles.** All 33 layouts compute
their positions from `CARD = {154.5, 136.4, 1596.6, 859.5}` on both the DOM and
PPTX sides. Making that vary per style means re-verifying 33 × 6 position sets.
Instead the frame is fixed and everything *around* and *on top of* it changes —
which is what the eye actually reads. `.stage[data-st="…"]` drives the CSS side;
`Ctx.st` drives the exporter, emitting real named shapes (`chromeEdge`,
`chromeBand`, `cardGlass`, `cardSheet`, `cardFrame`).

**Deco intensity is never zero.** `plain` uses `0.18`, and `deco.ts` floors
opacity at `0.04`, because Morph needs shapes present in every slide to have
anything to interpolate. Rounding to one decimal used to send low-intensity
shapes to `0.0`; `check-core.ts` asserts all 9 survive in all 6 styles.

### 6.3 The 3 text densities

```ts
short   4–9 words/bullet    3–4 bullets   font ×1.16
normal  10–18 words         3–5 bullets   font ×1.00
long    18–32 words         4–6 bullets   font ×0.88
```

Density feeds **two** places: `den.hint` goes into the generation prompt, and
`den.scale` multiplies both the starting size and the growth cap in `fitBlock`.
Scaling only the starting size does nothing — a roomy box lets both densities
climb to the same cap.

---

## 7. Data model (`src/lib/types.ts`)

```ts
type Lang    = 'ckb' | 'ar' | 'en';
type StyleId = 'glass' | 'edge' | 'band' | 'frame' | 'paper' | 'plain';
type Density = 'short' | 'normal' | 'long';

interface Deck {
  id: string;
  createdAt: number; updatedAt: number;
  lang: Lang;
  theme: string;          // colour palette id
  style?: StyleId;        // structure — absent means 'glass' (older decks)
  density?: Density;      // absent means 'normal'
  fontFamily: string;     // CSS stack; primaryFont() reduces it for PowerPoint
  titleInfo: TitleInfo;   // the fixed slide-1 data
  slides: Slide[];
  buildMode: boolean;     // per-element entrance animations on export
  transitionMs: number;   // Morph duration
}

interface Slide {
  id: string;
  layout: LayoutId;              // one of 33
  title: string;
  bullets: string[];             // may use the form "Label: explanation"
  body?: string;
  notes?: string;                // exported as real speaker notes
  imageUrl?: string;             // data: URI — decks are self-contained
  imagePrompt?: string;
  imageCredit?: string;          // CC attribution, drawn ON the slide, not just in notes
  chart?: ChartData;
  table?: { head: string[]; rows: string[][] };
  steps?: { n: string; h: string; p: string }[];
  timeline?: { y: string; c: string }[];
  kpis?: { v: string; k: string }[];
  quote?: { text: string; by: string };
  pros?: string[]; cons?: string[];
  refs?: Reference[];
  elements?: SlideElement[];     // user-added icons / shapes / text / images
  overrides: Partial<Record<SlotId, SlotOverride>>;
}
```

**Coordinate system:** every position is in **pixels within a 1920×1080 space**,
in both the DOM renderer and the PPTX exporter. Conversions live in `pptx.ts`:

```ts
const I  = (px: number) => px / 144;   // px → inches (1920px = 13.333in)
const PT = (px: number) => px / 2;     // px → font points
// 1 px = 6350 EMU
```

The **`overrides` map is the editor's whole persistence story**: a layout renders
each slot at its default position, and any user edit is stored as a partial
override keyed by `SlotId`. Nothing is destructive, so "reset to layout" is just
deleting the override. `retarget()` drops the geometric keys when the layout
changes (a position from one layout is meaningless in another) but keeps
deliberate choices — text, colour, font, hidden.

---

## 8. Shared measurement — why preview and export agree

Three modules exist purely so the browser and PowerPoint compute the same
numbers. Any divergence between what the user sees and what they download is a
bug in one of these.

### 8.1 `fit.ts`

`fitSize()` shrinks text to fit. `fitBlock()` returns **both** a size and a gap
and runs in both directions:

```ts
export function fitBlock(o: FitOpts & { max?: number }): { size: number; gap: number }
```

- Too much text → font shrinks until it fits (as before).
- Too little text → font **grows** to `max`, **and** the leftover height is
  divided among the inter-bullet gaps.
- Gap is capped at `size × 2.2` so two bullets don't end up glued to opposite
  edges; whatever remains is absorbed by vertical centring.

The DOM applies this as `fontSize` + flex `gap` + `justify-content: center`; the
exporter applies the identical numbers as `fontSize` + `paraSpaceAfter` +
`valign: 'middle'`.

> The original bug: three short bullets sat at the top of the slide with the
> bottom half empty. `fitSize` started at 35 px and only ever went down.

### 8.2 `deco.ts`

The background shapes are a single choreography shared by both renderers, built
on three principles:

1. **Journey** — every shape enters from outside the slide, crosses, and leaves.
   It exists on *every* slide (that is what lets Morph move it) but is only
   visible during its own window.
2. **Depth / parallax** — `reach = 0.35 + depth * 0.65` compresses the journey
   itself for far shapes, so near shapes travel further per slide. A camera
   offset alone was 62 px against ~2000 px journeys, i.e. invisible.
3. **Shape morphing** — a seed lists several kinds (`['diamond','hexagon']`) and
   swaps between them by journey phase. Same name + different `prstGeom` is what
   makes PowerPoint tween one shape into another.

`CLIP` gives the CSS `clip-path` per kind; `PPTX_SHAPE` gives the PowerPoint
preset name. Shape **names** (`deco0 … deco8`) are load-bearing: Morph with
`option="byObject"` matches shapes across slides by name.

### 8.3 `net.ts`

`fetch` has no default timeout. A stalled request froze the generation screen
forever with no error and no way out. Every outbound call now goes through:

```ts
fetchWithTimeout(url, { timeoutMs = 90_000, outerSignal, ...init })
```

It distinguishes `TimeoutError` ("took longer than 90 s") from an external abort
("you pressed Stop"), and the Stop button passes an `AbortSignal` down.
Wired into all 5 LLM call sites (`gemini.ts` ×2, `llm.ts` ×3).

---

## 9. The AI layer

### 9.1 Provider abstraction (`providers.ts` → `llm.ts`)

Six providers: `gemini | openai | anthropic | openrouter | deepseek | groq`.
Each carries: display name, key-creation URL, accepted key prefixes, model list,
whether it has built-in search, whether it does images, free-tier status, and a
**Kurdish step-by-step guide to getting a key**.

```ts
export function pickTextProvider(lang, keys) {
  if (lang === 'ckb' || lang === 'ar') return { provider: 'gemini', … };  // C3
  return { provider: keys.textProvider, model: keys.textModel };
}
```

Gemini key prefixes are `['AIza', 'AQ.']` — Google has two key formats, and the
newer `AQ.` form used to trigger a false "invalid key" warning.

**Current Gemini models** (all verified live against a real free-tier key):
`gemini-3.6-flash` (default), `gemini-3.5-flash`, `gemini-3.5-flash-lite`,
`gemini-3.1-flash-lite`, `gemini-2.5-pro` (paid → 429 on free tier).
Image model: `gemini-3.1-flash-image`.
`gemini-2.5-flash` was **removed** — it returns 404 for new users.

### 9.2 The JSON extraction problem (`gemini.ts`)

Gemini **cannot use `responseSchema` together with `google_search`**. When
grounding is on, it returns prose wrapped around JSON. The original greedy regex
`[[{][\s\S]*[\]}]` grabbed too much and produced
`Expected ',' or '}' after property value at position 861`.

The fix is a three-stage pipeline:

1. `extractJson()` — a **brace-depth counter** that tracks string state and
   escapes, so braces inside string literals don't confuse it.
2. `repair()` — strips trailing commas, normalises curly quotes, removes control
   characters and zero-width spaces.
3. Fallbacks — retry **without** search using a strict schema; for references,
   fall back to the grounding metadata.

Verified against 12 real malformed responses.

### 9.3 The agent (`agent.ts`) — the most important file

A **real** agent loop: the model chooses tools, we execute them, feed results
back, and re-ask — up to `maxSteps = 12`.

**13 tools:**

| Tool | What it actually does |
|------|----------------------|
| `search_web` | Tavily / Brave / Serper if the user supplied a key, else Gemini grounding. Blocked domains filtered out. |
| `find_papers` | Real parallel query against **OpenAlex + Crossref + DOAJ** |
| `set_references` | Fills the references slide — **only from DOIs `find_papers` returned** |
| `find_image` | Openverse (Creative Commons, free, no watermark) |
| `get_statistics` | **Real World Bank data** → renders a chart |
| `read_deck` | Dumps every slide with number, layout and text |
| `edit_slide` | Replaces title / bullets / body |
| `set_layout` | Switches among the 33 layouts |
| `add_slide` / `delete_slide` | Structure |
| `fix_overflow` | Measures whether a slide's text actually fits its layout's real text box (`textBox()` + `fitBlock()`), and switches to a roomier layout when it does not. Optionally splits the slide. Never silently truncates — if nothing fits it says so. |
| `add_icon` | Places an icon — **restricted to the 58 hand-drawn `ICONS`**, not the merged 242. The system prompt lists exactly those ids and `add_icon` rejects anything else, so the model cannot name a Lucide icon it was never shown. |
| `set_theme` | Switches palette |
| `set_chart` | Sets chart data explicitly |

**Anti-hallucination guard** — this is the mechanism that satisfies C6:

```ts
let lastPapers: Paper[] = [];      // populated only by find_papers

// inside set_references:
const chosen = lastPapers.filter(p => wanted.includes(normDoi(p.doi ?? '')));
if (!chosen.length)
  return 'ERROR: none of those DOIs came from find_papers. Call find_papers first.';
```

The model is **structurally incapable** of citing a paper it did not retrieve.
This is a load-bearing invariant — do not refactor it away. `normDoi()` strips
`https://doi.org/`, `doi:` prefixes and trailing punctuation before comparing,
and `lastPapers` is cleared when a new conversation starts so research from one
topic cannot leak into another deck's references.

**Provider-neutral history.** Conversation is stored in a neutral shape and
converted per-provider at call time, so the user can switch providers mid-chat
(e.g. when Gemini hits its rate limit):

```ts
export type Turn =
  | { role: 'user';      text: string }
  | { role: 'assistant'; text?: string; calls?: ToolCall[] }
  | { role: 'tool';      id: string; name: string; result: string };

export const canRunAgent = (p: ProviderId) => p === 'gemini' || !!OPENAI_URLS[p];
```

`toGemini()` maps to `functionCall` / `functionResponse` (and merges consecutive
tool results into one `user` turn, which Gemini requires);
`toOpenAi()` maps to `tool_calls` / `tool_call_id`;
`toAnthropic()` maps to `tool_use` / `tool_result` content blocks.

**Anthropic specifics** — three things it does differently, all load-bearing:

1. Tool results are `tool_result` blocks inside a **`user`** message, not a
   dedicated `tool` role. All results from one assistant turn must sit in **one**
   message or the API returns 400.
2. `system` is a top-level field, not the first message. `max_tokens` is required.
3. From a browser it needs `anthropic-dangerous-direct-browser-access: true`, or
   CORS blocks the request. Under C1 there is no server to proxy through, so this
   header is not optional.

### 9.4 Prompt-injection defence (`sanitize.ts`)

Paper abstracts and web snippets go straight into the model's context. A page
that says *"Ignore all previous instructions"* would otherwise read as a user
command. Two layers, both required:

- **`clean()`** replaces instruction-shaped passages with `[پاککراوە]` and strips
  invisible characters. Bidi overrides (`U+202A–202E`, `U+2066–2069`) matter
  especially here: the UI is RTL, so text can be made to *display* differently
  from what the model reads.
- **`envelope()`** wraps external content in a fenced block labelled
  `UNTRUSTED DATA`, tells the model to treat it as information rather than
  instruction, strips the fence from the body so it cannot be closed early, and
  reports how many passages were removed.

Only tools in `EXTERNAL_TOOLS` get the envelope; everything is cleaned. The
filter matches **imperatives**, not mentions — a paper about prompt engineering
survives intact, and `check-core.ts` asserts both directions (10/10 attacks
caught, 0/4 legitimate passages damaged).

**Gemini 3 `thoughtSignature`.** Gemini 3 attaches a `thoughtSignature` to each
`functionCall` part and returns `400: Function call is missing a thought_signature`
if it is not echoed back verbatim on the next turn. `ToolCall` carries it as
`sig?: string`. This is not in the `generateContent` docs — it was found by live
testing against a real key.

**Everything streams to the UI** via a typed event channel, so the user watches
the agent think instead of staring at a spinner:

```ts
type AgentEvent =
  | { kind:'thinking'; text }        // Gemini thinkingConfig.includeThoughts
  | { kind:'tool';   tool; label; args }
  | { kind:'result'; tool; ok; text }
  | { kind:'say'; text } | { kind:'error'; text } | { kind:'done' };
```

`explainHttp()` converts raw HTTP failures into Kurdish explanations
(401 → "your key is wrong", 429 → "you hit the limit, try later or switch provider").

---

## 10. System prompts (verbatim)

Four prompts are sent to models. They are reproduced in full because the
constraints in §2 are enforced *inside them*, not only in code.

### 10.1 Agent system instruction — `agent.ts › systemPrompt(deck)`

Sent as `systemInstruction` on every agent turn. `${layoutList}`, `${iconList}`,
`${themeList}` and the indicator codes are interpolated from the live
catalogues, so the model can never name something that does not exist.

```text
You are the assistant inside a presentation studio. You improve the user's academic
presentation by calling tools. You never describe an edit you could just make.

The presentation is written in ${LANG_NAME[deck.lang]}.
ALWAYS write slide text in that language. Keep technical terms and formulas as-is.

Slide numbering matches what the user sees: slide 1 is the fixed title page and
CANNOT be edited by these tools. Content slides start at 2.

Available layouts: ${layoutList}
Available icons: ${iconList}
Available themes: ${themeList}

World Bank indicator codes you may use:
${INDICATORS.map(i => i.code).join(', ')}

Working rules:
- Call read_deck before any change that refers to existing slides.
- REFERENCES: never write a citation yourself. Call find_papers (real academic
  databases), then set_references with the DOIs you chose. A citation you typed
  from memory may not exist; one from find_papers always does.
- NUMBERS: prefer get_statistics (real World Bank data) over inventing figures.
  If you must estimate, say so in the chart caption.
- IMAGES: prefer find_image (free Creative Commons photos, no cost, no watermark)
  over generating one.
- FACTS: use search_web for anything current. Never state a statistic you did not retrieve.
- Never invent a citation, author, DOI or year.
- Make every change with a tool, then finish with one short sentence in
  ${LANG_NAME[deck.lang]} telling the user what you did.
- If a request is ambiguous, make the most reasonable interpretation and say what
  you assumed. Do not stop to ask unless the request is genuinely impossible.
```

### 10.2 Source policy — `research.ts › RESEARCH_RULES`

Injected into both research prompts below. This is C4 in prompt form; the
`BLOCKED` array in the same file is the same rule in code form, applied to
whatever the model returns anyway.

```text
STRICT SOURCE POLICY — this is not optional:
- NEVER cite, quote, summarise, or rely on Wikipedia or any Wikimedia site.
- NEVER cite Quora, Reddit, Medium, personal blogs, SlideShare, Course Hero,
  Studocu, Scribd, Chegg, GeeksforGeeks, W3Schools, or TutorialsPoint.
- ONLY use: peer-reviewed journals and conference papers, academic publishers
  (IEEE, ACM, Springer, Elsevier/ScienceDirect, Wiley, Cambridge, Oxford, MDPI, PLOS),
  preprint servers (arXiv), university sites (.edu / .ac.*), government and
  standards bodies (.gov, NIST, ISO, IETF/RFC), and recognised academic textbooks.
- If you cannot find a credible academic source for a claim, leave it out.
- Never invent a citation, DOI, author, year, or page number.
```

### 10.3 Outline suggestion — `research.ts › suggestOutline()`

```text
You are preparing an academic university presentation on: "${topic}"

${useSearch ? RESEARCH_RULES + '\n\nSearch the web for current, credible academic material on this topic.\n' : ''}
Produce an outline of exactly ${count} sections that a student would present.
Each section needs:
  - "title": a short section heading (max 6 words)
  - "hint":  one sentence describing what that section covers

Write the "title" and "hint" values in ${langName}.

Return ONLY valid JSON in this exact shape, with no commentary and no markdown fence:
{"outline":[{"title":"...","hint":"..."}]}
```

If grounding returns unparseable JSON, it retries **without** search but **with**
`OUTLINE_SCHEMA`, because an empty outline is worse than an ungrounded one.

### 10.4 Reference finding — `research.ts › findReferences()`

**There is no citation prompt any more.** This function used to ask the model to
write APA entries; it now queries the same real databases `find_papers` uses.

```
topic ──(Arabic script only)──► model: "short English search phrase"
      │
      └─► searchPapers()  ──►  OpenAlex · Crossref · DOAJ  ──►  Reference[]
```

Two defects forced the rewrite:

1. **The slide was always empty.** No `schema` was ever passed, so the model
   answered in prose, `parseJson` threw, and the fallback used grounding
   `sources` — which are empty for every provider except Gemini. Both branches
   converged on `[]`, silently, because `Wizard` caught the failure and moved on.
2. **Model-written citations violate C6.** They may not exist, and they carry no
   separated fields, so every one of them was dropped from `.bib`/`.ris` export.

The model is now used for exactly one thing: turning a Kurdish or Arabic topic
into an English search phrase, because the databases are indexed in English. If
that call fails — no key, no network — the raw topic is tried anyway, then
progressively shorter versions of it (5 words, then 3), since long sentences
often return nothing. A web-search fallback runs only if every database query
came back empty, and it uses real result URLs, never model prose.

Each result arrives with authors, year, venue and DOI, so references generated
this way export cleanly to BibTeX and RIS (§19.3).

**Ranking** (`tools/academic.ts › searchPapers`) was also wrong. Sorting purely
by citation count meant a famous unrelated paper outranked the paper written
exactly on the topic — a search for SME cybersecurity risk management returned
*An Overview of Data Warehouse and Data Lake* first. The score is now:

| Signal | Weight | Why |
|---|---|---|
| Rank returned by each API (RRF) | 1.0, DOAJ 0.55 | each API's own relevance answer; DOAJ is smaller and ranks worse |
| Appearing in more than one database | additive | strong independent-agreement signal |
| Query words present in the title | 0.06 | direct relevance, which no API exposes |
| `log10(1 + citations)` | 1/150 | separates two equally relevant papers; cannot overturn relevance |

Measured across six topics, 30/30 top results are on-topic. Duplicates across
databases are merged rather than discarded, so a DOI from Crossref fills a gap
in the OpenAlex record. Author strings longer than six words are dropped —
OpenAlex sometimes puts a full department address in the author field, which
turned into nonsense APA. HTML entities in titles are decoded, since the title
goes straight into the citation.

### 10.5 Slide generation — `generate.ts › generateSlides()`

The largest prompt. `${LAYOUT_CATALOGUE}` is a 28-line description of every
content layout and what data it needs; `${den.hint}` is the text-density rule
from §6.3.

```text
You are designing an academic university presentation on: "${topic}"

The agreed outline is:
${outlineText}

Produce exactly ${slideCount} content slides that cover this outline in order.

Choose the most fitting layout for each slide from this catalogue:
${LAYOUT_CATALOGUE}

Rules:
- VARY the layouts. Never use the same layout more than twice in a row, and use at
  least six different layouts across the deck.
- A presentation of only text is a bad presentation. At least ${ceil(n/3)}
  of the ${slideCount} slides MUST use a layout that shows a picture — L_bullets,
  L_bulletsL, or L_hero — and each of those MUST include an "imagePrompt".
- Only fill the fields that the chosen layout actually needs. Leave the rest out.
- Bullets that describe a labelled idea must use the form "Label: explanation".
- For chart slides invent plausible, clearly-labelled illustrative figures and say so
  in the caption. For L_progress every value must be between 0 and 100.
- L_compare table cells must contain only "yes" or "no".
- LENGTH: ${den.hint}
  Give each ordinary content slide ${den.points[0]}-${den.points[1]} bullets. Layouts that
  demand an exact count (L_two, L_three, L_steps, L_icons, L_venn, L_pyramid, L_ba)
  keep their own count — that rule wins over this one.
  Every bullet on a slide should be roughly the same length as its neighbours; one
  long bullet next to three short ones makes the slide look broken.
- For every slide that shows an image, add "imagePrompt": a short English description
  of a clean, professional, academic illustration. Never put words or letters in the image.
- Write ALL visible text (titles, bullets, body, captions, labels) in ${langName}.
  Keep technical terms, formulas, and code identifiers in their original form.
- Never invent a citation, author, DOI, or year.

Return ONLY valid JSON, no markdown fence:
{"slides":[{"layout":"L_bullets","title":"...","bullets":["..."]}]}
```

**The prompt is not trusted.** Three code-level safety nets run on the result:

- `exactly()` — the model routinely returns more or fewer slides than asked.
  The user picked a number; it is enforced by truncation or by padding from the
  outline.
- `withImages()` — only 4 of the 33 layouts have an image slot, so the model
  produces text-only decks (measured: **1 image slide in 11**). Any slide whose
  data survives the move is retargeted to `L_bullets` / `L_bulletsL` / `L_hero`
  until at least ⅓ of the deck has pictures. Slides carrying chart, table,
  steps, timeline, KPI or quote data are never touched — that data would be lost.
- `toSlide()` — if the chosen layout needs data the model did not supply, the
  slide falls back to `L_bullets` or `L_text` instead of rendering empty.

### 10.6 Humanizer (`humanize.ts`) — not a prompt

Post-processing, not instruction. Based on the *Signs of AI writing* rule set,
extended with Arabic and Kurdish patterns that the English-only original does
not cover. Regex replacements only — `delve into → examine`, `leverage → use`,
`it is important to note that → ∅`. **Rule: no fact is ever removed, only
phrasing is changed.** Toggleable in the wizard.

---

## 11. Free APIs used (all verified CORS-clean from a browser)

| API | Purpose | Key needed | Notes |
|-----|---------|-----------|-------|
| **OpenAlex** | papers, citation counts | no | abstracts arrive as an inverted index; `rebuildAbstract()` reassembles them |
| **Crossref** | papers, DOIs | no | rate-limits to 429 under bursty use; degrades, does not break |
| **DOAJ** | open-access journals | no | |
| **Openverse** | CC-licensed images | no | `ACAO: *` confirmed on both full and thumbnail URLs. Aggregates Flickr, Wikimedia, the Met, NASA, Smithsonian, Europeana — see § 13.1 for the licence filter |
| **World Bank** | 13 real indicators | no | |
| Tavily / Brave / Serper | web search | user's own | optional; falls back to Gemini grounding |

Rejected after probing, so they are not re-evaluated from a list:

| API | Why not |
|---|---|
| Met Museum, NASA Images | both are already inside Openverse; a separate integration duplicates it |
| REST Countries | `301`s to a `files-*` host that returns **no `Access-Control-Allow-Origin`** — unusable from a browser, and C1 forbids a proxy |
| Semantic Scholar | throttles hard without a key |
| arXiv | no CORS headers |
| CORE, Unpaywall | require a key or an email parameter — C2 |

`searchPapers()` merges all three academic sources with `Promise.allSettled`,
dedupes by DOI, and sorts by citation count — so one source rate-limiting
degrades the result instead of failing the run.

**Deliberately excluded after live testing:**
- **arXiv** — no `Access-Control-Allow-Origin` header → unusable from a browser.
- **Semantic Scholar** — returns 429 without a key.

Every one of these was tested with a real request before being committed. Do not
suggest adding an API without checking its CORS headers — under C1 there is no
server to proxy through.

---

## 12. PPTX export

### 12.1 Native output

`pptx.ts` writes each of the 33 layouts, in each of the 6 styles, as native
PowerPoint objects: real `addText`, real `addTable`, real `addChart`, real
`addShape`, real `addNotes`. Icons are the one exception — they are rasterised
to PNG via `svgToPng()`, because PowerPoint has no SVG shape equivalent that
survives round-tripping.

Fidelity bugs found and fixed. They are worth knowing because they are easy to
reintroduce:

1. **`primaryFont()`** — PowerPoint accepts one font *name*, not a CSS stack.
   Passing `"Georgia,'Times New Roman',serif"` silently falls back to Calibri.
2. **`margin: NOPAD`** on every `addText` call — PowerPoint's default 0.05 in
   text-box inset shifts every string off its designed position.
3. **Per-string RTL, not per-deck.** The title slide mixes an English university
   name with Kurdish student names. Deck-level `rtl` turned `Prepared:` into
   `:Prepared`. Fixed with a per-string test (`isRtl()` against the Arabic/Hebrew
   Unicode blocks). The DOM side uses `dir="auto"` per element, with `dir="ltr"`
   on the title-slide container.
4. `rtlMode` is a **cell**-level option in pptxgenjs tables, not a table-level one.
5. **Bullet glyphs never rendered.** `{ type: 'bullet', code: '25CF' }` produces
   *nothing*: pptxgenjs checks `bullet.type` first, does nothing when it is not
   `'number'`, and its `else if (bullet.code)` branch is therefore unreachable.
   Every paragraph got `<a:buNone/>` — the preview showed dots, the file had
   none. Correct form is `{ characterCode: '25CF' }` with **no** `type`.
6. **Bullets must be set on every run, not just the first.** pptxgenjs only
   inherits the parent `bullet` for item 0, and it emits an `<a:pPr>` per run
   inside a paragraph — so a second run without a bullet writes `<a:buNone/>`
   and cancels the first.
7. **`fit: 'shrink'` is not a solution.** pptxgenjs's own docs say PowerPoint
   only recomputes autofit on edit, not on open. Hence `fit.ts`.
8. **Logo aspect ratio** — CSS `object-fit: contain` versus pptx forcing a
   square. Fixed with `sizing: { type: 'contain', … }`.

### 12.2 Morph transitions + build animations (`morph.ts`)

pptxgenjs has **no transition or animation API**. But a `.pptx` is a ZIP of XML,
so after generation the ZIP is reopened and XML is injected into each slide —
`<p:transition>` after `</p:clrMapOvr>`, and a full `<p:timing>` tree after it.

```xml
<mc:AlternateContent>
  <mc:Choice Requires="p159">
    <p:transition spd="slow" p14:dur="2000"><p159:morph option="byObject"/></p:transition>
  </mc:Choice>
  <mc:Fallback>
    <p:transition spd="slow" p14:dur="2000"><p:fade/></p:transition>
  </mc:Fallback>
</mc:AlternateContent>
```

`mc:AlternateContent` means older PowerPoint versions degrade to a plain Fade
instead of refusing to open the file.

The `<p:timing>` tree is `tnLst → par → cTn(tmRoot) → seq(mainSeq) → par ×3 →
cTn(presetClass="entr")`. Effects are chosen by element type, implementing the
professional ratio the owner specified — **90 % Fade, 5 % Zoom, 5 % Morph**:

```ts
const fx: Fx = node.startsWith('<p:pic')          ? 'zoom'    // presetID 23
             : node.startsWith('<p:graphicFrame') ? 'fade'    // presetID 10
             : isSmallShape(node)                 ? 'float'   // presetID 42, subtype 8
             :                                      'fade';
```

The first build waits for a click; the rest follow automatically at 140 ms
stagger with `accel="20000" decel="40000"` easing. Measured on a real export:
`Fade 24 · Zoom 1 · Float 5`.

This technique was reverse-engineered from the owner's own `.pptx` — Morph
between near-duplicate slides is how they animate manually.

`toArrayBuffer()` normalises `Blob | ArrayBuffer | Uint8Array`, because JSZip in
Node throws *"Can't read the data of 'the loaded zip file'"* on a Blob.

---

## 13. Image pipeline (`tools/slideImage.ts`)

Original bug: **slides came out with no images at all**, from three compounding
causes — a bare `catch {}` that swallowed every error, a filter on
`s.imagePrompt` (which the model usually omits), and a `slice(0, 6)` cap.

Current behaviour:

```
every layout whose needs[] includes 'image'
  → prompt backfilled from the slide title if the model omitted it
  → AI generation (if a key exists)
       ↓ fail (429 / no credit / any error)
  → Openverse free image, largest-first
       ↓ host refuses the download
  → try the next candidate (4 attempts)
       ↓ all fail
  → surface the exact reason to the user — never silent
```

`toQuery()` strips AI-prompt vocabulary (`clean`, `professional`, `minimalist`,
`illustration`, `no text`, …) before searching, because those words are useless
as a photo search query.

Creative Commons requires visible attribution, so `imageCredit` is drawn as a
strip **on the slide** in both the preview and the export — notes alone are not
compliant.

### 13.1 Licence filtering — why `all-cc` was wrong

The search originally passed `license_type=all-cc`, which means *every* Creative
Commons licence. Measured over three topics, **15–35 % of the results carried an
ND (No Derivatives) licence** — and this app crops images: PPTX places them with
`sizing: { type: 'cover' }`, which crops to the frame's aspect ratio. Cropping is
a derivative. Those slides were not licence-compliant.

The filter is now `license_type=commercial,modification`, which admits `cc0`,
`pdm`, `by` and `by-sa` and excludes both NC and ND. `isND()` re-checks every
result client-side, because the filter is the API's promise and the check is
ours.

Two other filters were added at the same time:

| Filter | Reason |
|---|---|
| `size=large` | median result width was **1024 px** — visibly soft on a 1596 px card and worse in a 13.3 in slide. It is now **4000 px**. |
| `extension=jpg,png` + an `.svg` guard | an SVG `data:` URI reaches PPTX as `image/svg+xml`, which PowerPoint renders broken — the same reason `compressImage()` produces JPEG (§ image compression). The API filter is not reliable, hence the client-side guard. |

If the strict query returns almost nothing — a narrow topic — a second, looser
query tops the list up. ND is still excluded on the way through: the fallback
relaxes quality, never licensing.

### 13.2 Tried and rejected: preferring museums

Openverse also indexes institutional collections — `met` (497 k images), `nasa`
(132 k), Rijksmuseum, Wellcome, Europeana, Smithsonian. Ranking those above
Flickr looked like an easy quality win for academic work.

It was measured and it failed. A `source=`-restricted query returned **nothing**
for three of four test topics, and for the fourth ("human anatomy") it returned a
Rijksmuseum painting titled *"Olympische goden in de wolken"* — Olympic gods in
the clouds. Museum holdings are mostly historical art, not subject illustrations
for a deck on renewable energy or machine learning. Boosting them inside the
general query never fired either, because Openverse's relevance ranking does not
surface them in the first page at all.

No code shipped for this. The note stays so it is not re-attempted blind.

Verified live, 8/8, including the "AI fails → falls back to free" path.
There is also a manual **وێنەی بێبەرامبەر** ("free image") button in the editor
that costs no quota.

---

## 14. Storage & security (`storage.ts`)

| What | Where | Notes |
|---|---|---|
| API keys | `localStorage` | C2 — never leave the browser except to the provider |
| Profile (university, department, teacher, students, logo) | `localStorage` | pre-fills the wizard next time |
| Decks | IndexedDB | `data:` URIs included, so a deck is self-contained |
| Project export | `.json` download | manual — C5 forbids accounts |

Import is hardened, because an imported file is untrusted input:

```ts
const MAX_IMPORT = 60 * 1024 * 1024;
// image/svg+xml deliberately excluded: SVG is an active format and can carry <script>
const IMG_OK = /^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,/i;
```

`saveProfile()` retries without `logoUrl` when the quota is exceeded, rather
than losing the whole profile to one oversized logo.

---

## 15. Known issues / open backlog

Ranked. **These are the highest-value places for a reviewer to focus.**

1. **No exported deck has been opened in PowerPoint yet.** Morph, the `<p:timing>`
   tree, bullet glyphs, style chrome, the `cs` font swap and the fill maths are
   all verified at the XML level only. **This is now the top item.**
2. **The Kurdish glyph check is per-machine, not per-deck.** `missingGlyphs()`
   measures the font on *this* computer via canvas. It cannot know what is
   installed on the machine the deck will be presented from. The `cs` font swap
   (→ Tahoma) is the real mitigation; the warning is advisory.
3. **`Tahoma` is an educated choice, not a measured one.** It has the broadest
   Arabic coverage among fonts that ship with Windows, but its coverage of the
   Kurdish-specific range has not been byte-verified against a font file.
4. **No streaming for deck generation.** The wizard blocks until the whole JSON
   arrives. Mitigated (elapsed counter, 45 s note, Stop button) but not solved.
5. **`maxSteps = 12`** is a hard stop with no partial-progress recovery.
6. **Prompt-injection filtering is pattern-based.** `sanitize.ts` catches known
   shapes and the envelope reframes the rest, but a novel phrasing can still get
   through. The `find_papers` → `set_references` guard remains the only
   *structural* protection, and it only covers citations.
7. **The `html2canvas` PDF path** is the least-tested exporter, and it *does*
   rasterise (unlike PPTX), so PDF output is not editable. Acceptable by design,
   but print-resolution quality has not been audited.
8. **`fix_overflow` measures, it does not render.** `textBox()` hard-codes each
   layout's text area. If a layout's CSS changes and `textBox()` is not updated,
   the tool will confidently give the wrong answer.
9. **Image compression drops alpha** on anything without detected transparency
   (it becomes JPEG on white). PNG is kept when alpha is found, but detection is
   a full pixel scan — a few ms per image.

---

## 16. Things that look like bugs but are not

- `suppressHydrationWarning` on `<html>` and `<body>` in `layout.tsx` — a browser
  extension injects `rtl-enabled` onto `<html>` before React hydrates. Scoped to
  those two tags only; it does not mask application-level mismatches.
- `LayoutProps<'/'>` in `RootLayout` — Next.js 16 generated type, correct.
- The dev port is **3200** — 3000 and 3100 both had zombie listeners on the
  owner's machine (npm leaves an orphaned `next dev` child on kill).
- `bulletOpt()` returns `{ characterCode }` with **no** `type` field. Adding
  `type: 'bullet'` back silently disables every bullet marker — pptxgenjs checks
  `type` first and never reaches the `code` branch. See §12.1 item 5.
- All source files are **LF**. An edit script once rewrote six of them as CRLF,
  which broke the tool-declaration scraper in `check-tools.ts` (`0 ئامراز`). The
  regex is now whitespace-tolerant, but keep the files LF.
- `injectTransitions` is an alias for `finalizePptx`. The finalize pass runs on
  **every** export, not only when Morph is on, because the OOXML paragraph
  normalization and the `cs` font swap are correctness fixes, not decoration.
- `GeminiError` declares `status` as an explicit field rather than a constructor
  parameter property — Node's strip-only TypeScript loader rejects parameter
  properties, and the check scripts run under `tsx`.
- `Ask` / `Said` / `Answer` are defined at module scope in `Wizard.tsx`, not
  inside the component. Moving them in breaks input focus. There is a comment.
- Header height is hard-coded at 128 px in **every** style. `BODY_H` derives from
  it on both sides; changing it per style silently desynchronises preview and
  export. There is a comment in `globals.css` saying so.
- All code comments are Kurdish Sorani. Intentional.

---

## 17. What good feedback looks like

Useful:
- Concrete bugs, with the failing input and the wrong output.
- Correctness risks in `agent.ts` (the tool loop), `pptx.ts` (coordinate math),
  `morph.ts` (XML injection), or `fit.ts` (shared by both renderers) — these
  four carry the most complexity.
- Security issues given C1/C2: keys in `localStorage`, `data:` URI handling, and
  especially **prompt injection from tool results**.
- Robustness: what happens on a 429 mid-agent-run, a truncated JSON response, a
  layout whose `needs[]` the model ignored, a `Slide` with a chart but no data.
- Performance: the 1920×1080 DOM render is re-scaled on every state change, and
  `ThemePicker` mounts 30 live `SlideView`s at once.
- Accessibility of an RTL Kurdish UI.

Not useful:
- "Add a backend / API routes / a database" — violates C1.
- "Ship a shared API key" or "use a server-side proxy" — violates C2.
- "Let the user pick any model for Kurdish" — violates C3.
- "Use Wikipedia for quick facts" — violates C4.
- "Add authentication" — violates C5.
- "Export slides as images for perfect fidelity" — violates C9.
- "Import Slidesgo / SlidesCarnival templates" — they are free to *use*, not to
  redistribute inside a product. Researched and rejected; the 6 style packs were
  built instead.
- "Translate the Kurdish comments" — intentional.
- Adding a dependency that only saves a few dozen lines.

---

## 18. Verification status

```
npm run build         ✓ compiled successfully
tsc --noEmit          ✓ no type errors
check-core.ts        268 pass / 0 fail   math, cite styles, translate, history, sanitize, net
check-icons.ts      1000 pass / 0 fail   every icon and shape renders to valid SVG
check-export.ts       94 pass / 0 fail   PPTX structure, styles, OOXML, cs font, equations
check-tools.ts        67 pass / 0 fail   LIVE network — APIs, relevance, books, styles
image fallback         8 pass / 0 fail   live, includes the AI-fails path
```

The timeout / backoff / cancel tests moved from `check-tools.ts` into
`check-core.ts` and now run against a **local `node:http` server** instead of
`httpbin.org`. httpbin intermittently answers 503 to everything, which produced
false failures in our own code. Same code path, deterministic result.

There is **no unit test framework** — the four `scripts/check-*.ts` files are
assertion scripts run under `tsx`. Adding a real test runner is a reasonable
suggestion; replacing the live `check-tools.ts` with mocks is not, because its
entire purpose is catching upstream API and CORS changes.

`check-tools.ts` intermittently returns `Crossref 429` on the first run of a
session. Re-running passes. This reflects real rate limiting, not a defect —
and `searchPapers()` degrades rather than fails when it happens in production.

---

## 19. Phase 2 capabilities

### 19.1 Mathematics (`math.ts`)

Students write `$E = mc^2$` or `$$\frac{d}{dx}e^x = e^x$$` anywhere in a title,
bullet, or body. Two renderers, one source:

```
TeX ──► KaTeX ──► HTML     the browser preview
    └─► KaTeX ──► MathML ──► OMML ──► .pptx
```

The second path matters: the formula lands in PowerPoint as a **native Office
equation** (`<a14:m><m:oMath>`), not a picture. It stays editable and stays
crisp on a projector — the same reasoning as C9.

Covered: fractions, super/subscripts, roots (including nth), n-ary operators
(`∑ ∏ ∫` become `<m:nary>`, not a plain `sSubSup`), accents, matrices, Greek,
operator names. Unknown TeX degrades to a plain run rather than breaking export.

`\$` is a literal dollar; an unclosed `$` is treated as text.

### 19.2 Presenter mode (`PresenterMode.tsx`)

Full presenting inside the browser, before anyone opens PowerPoint.

| | |
|---|---|
| Presenter screen | current slide, next slide, speaker notes, elapsed timer |
| Audience screen | second window (`?present=1`), slide only, synced over `BroadcastChannel` |
| Tools | laser pointer, freehand pen (double-click clears), slide-jump grid |
| Keys | `←/→` `space` navigate · `G` grid · `L` laser · `P` pen · `N` notes · `T` pause timer · `R` reset · `Esc` exit · `F5` enter |

`BroadcastChannel` is a browser API — no server, so C1 holds. If the browser
lacks it, single-screen mode still works and the button is disabled.

### 19.3 Citation export (`cite.ts`)

**BibTeX**, **RIS** and a plain **APA 7** list, from the Settings tab.

The rule that shapes this module: `.bib` and `.ris` need separated fields
(author, year, journal, DOI). Those exist only on references that came from
`find_papers`. A reference without them is **excluded and counted**, never
padded with invented data — C6 applies to export as much as to generation.
`Reference` therefore carries optional structured fields alongside the APA
string, populated by `set_references`.

LaTeX special characters (`& % $ # _ { }`) are escaped; RIS is emitted with CRLF
as its specification requires.

### 19.4 Vector PDF (`export/pdf.ts`)

Two paths, and the choice is not cosmetic:

- **Vector** — draws from the `Deck` model with jsPDF primitives, sharing
  `fit.ts`, `textBox()` and `deco.ts` with the other two renderers. Text stays
  selectable and searchable, and file size drops sharply.
- **Raster** — `html2canvas`, pixel-perfect to the preview.

**Vector is English-only, and that is a hard limit of jsPDF**, not a choice:
its built-in fonts are WinAnsi with no Arabic glyphs, and it performs no Arabic
shaping or bidi reordering. Kurdish would come out as disconnected letters in
the wrong order. `canVector(deck)` gates the button, and Kurdish/Arabic decks
only ever see the raster path.

Vector output uses Times rather than Georgia — embedding Georgia would require
shipping the TTF.

### 19.5 Offline PWA (`public/sw.js`, `Offline.tsx`)

Installable, and usable in a lecture hall with no network.

| Works offline | Needs network |
|---|---|
| open the app, edit text/layout/theme/style | generate a deck with AI |
| presenter mode | find papers, images, statistics |
| export `.pptx`, `.pdf`, `.bib`, project JSON | translate |

Caching strategy is deliberately split: **network-first** for the page (so an
online user never sees a stale build) and **cache-first** for hashed assets.
**Requests to external origins are never cached** — a stale API response is
worse than an honest error, and user keys must not linger on disk.

The service worker registers only in production; in `next dev` it would serve
stale bundles. An offline badge appears when the connection drops, so the user
knows why the AI buttons stopped working.

### 19.6 Deck translation (`translate.ts`, `translate_deck`)

Translates an existing deck between English, Kurdish Sorani and Arabic without
regenerating it — images, charts and references are kept.

**Left untouched, by design:**

- reference entries, author names, journal names, DOIs — translating a citation
  breaks it (C6)
- formulas — `keepMath()` compares the formula count before and after and
  restores the originals; if the count changed, the original sentence is kept
  rather than risk a mangled equation
- technical acronyms, numbers, units, URLs, code identifiers
- **the title page** — C7

C3 is enforced at the tool boundary: translating *into* Kurdish or Arabic with a
non-Gemini agent provider returns an error telling the user to switch, rather
than quietly producing bad Kurdish.

---

## 20. Citation styles and source kinds

The user picks **two independent things** on the creation page, before the deck
is built:

```
شێوازی ژێدەر   APA 7 · IEEE · MLA 9 · Harvard · Chicago · Vancouver
سەرچاوە        توێژینەوە (papers) · کتێب (books) · ماڵپەڕ (official sites)
```

A live sample of a real citation renders under the pickers, so the difference is
visible before anything is generated.

### 20.1 What actually differs between the styles

Not punctuation — **author naming rules**, and each one is the style's real rule:

| Style | Author rule | Marker |
|---|---|---|
| APA 7 | up to 20 names, `&` before the last | none, alphabetical |
| MLA 9 | **3 or more → first author + `et al.`** | none, alphabetical |
| IEEE | given name **first** (`F. A. Alaba`), 7+ → `et al.`, no comma before `and` for two | `[1]` |
| Harvard | **4 or more → first + `et al.`**, initials with no spaces | none, alphabetical |
| Chicago | first author inverted, the rest natural order | none, alphabetical |
| Vancouver | `Stinson DR` — no periods, no spaces between initials | `1.` |

Each style also has its own template per source kind, so a book is never written
as if it were a journal article:

```
APA   book   Stinson, D. R., & Paterson, M. B. (2018). Cryptography (4th ed.). CRC.
IEEE  book   D. R. Stinson and M. B. Paterson, Cryptography, 4th ed. CRC, 2018.
IEEE  web    NIST, "Cybersecurity Framework." [Online]. Available: … [Accessed: …].
```

The slide layout follows too: numbered styles print `[1]` / `1.`, the others use
a real **hanging indent** — first line at the margin, continuation lines
indented. Same in the preview, in PowerPoint (`hangingIndent`) and in the vector
PDF.

### 20.2 Two deliberate deviations

**Titles are not case-converted.** APA formally wants sentence case, but that
transform turns `IoT` into `Iot` and `COVID-19` into `Covid-19`. A wrong title is
worse than a title in the source's own case. The one exception is a title that is
entirely uppercase — that is a database defect (Crossref has such records), and
it is corrected.

**At most 6 authors are shown on a slide**, even where the style formally allows
more (APA allows 20). This is a readability limit for a projected slide. The
`.bib` and `.ris` exports carry **every** author, because there the completeness
matters and the space exists.

### 20.3 Where books come from

`kind: 'book'` queries a different pair of sources:

| | |
|---|---|
| Crossref | `type:book, monograph, reference-book, edited-book, book-chapter` — only books that have a DOI |
| Open Library | 40 M book records, free, keyless, CORS-open — covers the textbooks Crossref does not |

Open Library publisher strings arrive with noise (`Brand: MIT Press`), which is
stripped. `edition_count` stands in for citation count when ranking, since a book
reprinted many times is a book that matters.

> **Do not add `edition-number` to the Crossref `select` list.** It is not a
> valid field and Crossref answers the whole request with `400`, which silently
> removes Crossref from every result set. This happened once and was caught only
> because the relevance check dropped from 5/5 to 3/5.

### 20.4 Where web sources come from

No academic database indexes web pages, so this kind has its own path: a search
engine key if the user has one, otherwise Gemini's grounding. Both return **real
URLs** — nothing is written by the model.

Results are filtered by `isBlocked()` (C4) and then **restricted to trusted
domains** — `.edu`, `.gov`, `.ac.*`, standards bodies. If nothing trusted comes
back, nothing is returned. A blog link is worse than an empty slide for a
university presentation.

Web sources have no DOI and no separated author, so they are excluded from
`.bib`/`.ris` by the existing rule in §19.3 — and the count is reported.

### 20.5 Changing the style after generation

Because every reference keeps its structured fields, the style can be changed at
any time with **no new search**: Settings → `شێوازی ژێدەر`, or ask the agent
(`set_cite_style`). Both rewrite the slide text and the export. References that
came from a plain web search have no fields to rewrite from, so they are left
exactly as they are rather than being reformatted from a guess.

---

## 21. Deployment

**Live:** https://iosbb1.web.app
(also reachable at `presentation-studio-ku.web.app` — the project's default site,
which Firebase does not allow renaming.)

```
npm run deploy      # check → next build → firebase deploy
npm run preview     # serve out/ locally on :3400 before publishing
```

### 21.1 Static export is mandatory, not a preference

`next.config.ts` sets `output: 'export'`, so `next build` emits plain HTML and JS
into `out/` with no Node server anywhere. This is C1 expressed in config. The app
has no API routes, no server actions and no `next/image`, so nothing is lost.

`trailingSlash: true` is set because most static hosts resolve `/page/` to
`/page/index.html` without extra rewrite rules.

Build output: **4.0 MB**, 104 files — 11 JS chunks and 64 font files (Vazirmatn
for the UI, the KaTeX faces for equations). The fonts are bundled rather than
fetched, which is what makes §19.5 offline mode work.

### 21.2 Cache headers are load-bearing

`firebase.json` sets three rules, and each one prevents a specific failure:

| Path | Header | Without it |
|---|---|---|
| `/sw.js` | `no-cache, no-store, must-revalidate` | a stale service worker pins an old build on the user's device for as long as it lives |
| `/` and `**/*.html` | `no-cache` | the HTML shell is served from CDN cache for an hour, so a redeploy does not reach anyone |
| `/_next/static/**`, fonts | `max-age=31536000, immutable` | every visit re-downloads 2.5 MB of content-hashed chunks that can never change |

> `"source": "/index.html"` alone does **not** cover the home page — Firebase
> serves it as `/`, and header rules match the request path, not the file. Both
> patterns are needed. This was caught by checking the live response, not by
> reading the config.

### 21.3 The domain

A Firebase site id *is* the `.web.app` subdomain, and it is globally unique. The
project's default site cannot be renamed, so a second site (`iosbb1`) was created
and `firebase.json` points at it via `"site": "iosbb1"`. Both URLs serve the same
release.

To attach a custom domain later: `firebase hosting:sites:get iosbb1`, then add
the domain in the console — no code change, because every asset path is
root-absolute.

**If you ever deploy to a sub-path** (GitHub Pages project sites, for example),
`basePath` and `assetPrefix` must both be set, and the service worker scope has
to move with them. The current build assumes the root.

### 21.4 What was verified on the live URL

Not assumed — measured against `https://iosbb1.web.app`:

```
/                      200 · text/html · Cache-Control: no-cache
/sw.js                 200 · no-cache, no-store, must-revalidate
/manifest.webmanifest  200 · application/manifest+json
hashed chunk           200 · max-age=31536000, immutable
14 referenced assets   200 · 0 missing
KaTeX_Main-Regular     200 · 26 KB
/nope/                 404 · the real 404 page
<html lang="ckb" dir="rtl">  ·  <title>ستودیۆی پێشکەشکردن</title>
```

The page was also rendered in headless Chrome and the screenshot inspected: the
wizard, the Gemini key panel and the RTL layout all appear. A blank first capture
turned out to be DNS for the just-created hostname, not a fault — running the old
and new URLs with identical flags produced byte-identical output.

---

## 22. The robot helper

A small 3D-rendered robot sits in the corner and speaks only when it has
something worth saying.

### 22.1 Why sprites and not a 3D model

The reference art the owner supplied was already a 3D render exported to PNG, so
the *look* costs nothing. A real GLB plus `three` would add roughly 2–5 MB and a
new dependency to gain one thing the character never needs: rotation under the
mouse. Nine poses in WebP come to **172 KB**.

Source art was generated in Gemini, one hero image first, then each pose with the
hero attached as a reference so the character stays identical.

### 22.2 Getting the art usable

Two problems arrived with the images, and both are worth recording because they
will recur with any AI-generated asset:

**Gemini painted the transparency checkerboard as pixels.** The files were JPEG —
a format with no alpha at all — with a grey-and-black checker drawn into the
image. Three removal attempts failed before the art was re-cut with an external
background eraser, which was the right call:

| Attempt | Why it failed |
|---|---|
| Colour filter over the whole image | ate the robot's dark face screen, which is the same black as the checker |
| Flood fill, tolerance 34 | JPEG ringing puts intermediate values (68, 102) between the two checker levels, so the fill stopped at every square edge |
| Synthetic checker, period 20 | the real period is **20.5** (runs alternate 20, 21) — the pattern desynchronises after ~40 squares |

**The poses were not the same size.** `search` and `present` came back as
close-ups cropped at the thigh while the rest were full body — the character
would visibly jump between states. They are normalised on the one measurement
that is constant across every pose: **the width of the dark face screen**. Body
height cannot be used (sitting, jumping) and neither can overall height (the
antenna bends). Each image is scaled so the face is 115 px, centred on the face,
and stood on a common baseline.

A bust framing was also produced and compared. It reads better — the eyes carry
the expression and they are much clearer — but it cuts the pointing hand off
`present` and the raised hands off `cheer`, so full body ships.

### 22.3 What makes it useful rather than decorative

Every line is tied to real application state, never to a timer:

| State | Pose | Says |
|---|---|---|
| no API key | wave | you need a key, it is free and stays in your browser |
| Kurdish/Arabic on a non-Gemini provider | present | switch provider (C3) |
| generating / searching | think / search | the live progress message |
| references slide empty | search | ask the agent, sources come from real databases |
| slide overflows | present | ask the agent to fix it, or pick a roomier layout |
| deck ready | cheer | F5 to present |
| offline | sleep | editing and export still work, generation does not |

Ordinary tips are shown **once** and then remembered. Tips that describe a
condition rather than teach something (`sticky`: errors, offline, progress) show
every time. Dismissal is permanent, stored in `localStorage`. The helper is
absent from presenter mode and the audience window entirely — those return before
it renders — and it honours `prefers-reduced-motion`.

### 22.4 A service-worker bug found on the way

Headless renders of the page were intermittently blank. The console showed:

```
Uncaught (in promise) UnknownError: Failed to execute 'open' on 'CacheStorage'
```

`caches.match()` **rejects** when CacheStorage is unavailable — private browsing,
storage disabled, quota exhausted. That rejected promise went straight into
`event.respondWith()`, which fails the request. Every asset request. The page
renders as a blank screen with no visible error.

`sw.js` now routes every cache call through `safeOpen` / `safeMatch`, which
swallow the failure and fall through to the network, plus a final `.catch()` on
the fetch handler. **The cache can never be the reason a resource fails to load.**

The intermittent blank itself, however, was *not* this bug. Six cold loads of the
new build rendered 2/6 — and six cold loads of the **previous** production build,
which contains none of these changes, rendered 3/6. The flakiness is in the
headless harness (React's scheduler and `--virtual-time-budget`), not in the app.
A hypothesis that removing `clients.claim()` would fix it was tested, measured,
and reverted: it changed nothing and would have delayed offline readiness to the
second visit for no demonstrated gain. The `safeMatch` fix was kept because that
failure was actually observed.

---

## 23. The student's script, and who presents what

A university presentation is usually a group: four students, each with a run of
slides and a slice of the clock. The app knew nothing about this — it produced an
ownerless deck and the students divided it up afterwards, by hand.

There is also the other half of it: many students **write their speech first**.
Until now that text had nowhere to go, so the deck was generated from a topic
string while the real material sat in a Word file.

Wizard step `talk`, between `plan` and `build`, handles both.

### 23.1 The script is a guide, not a transcript

The owner chose this explicitly over a stricter reading. The model follows the
script's **order** and must cover every substantive point, but where the script
is thin — a claim that needs a definition, a comparison, a figure — it fills the
gap from its own knowledge. Where script and outline disagree, **the script
wins**, and the prompt says so in those words.

The script does **not** become speaker notes. That was also an explicit choice:
the slides ship clean, with no hidden text. It exists only to shape generation,
and is stored on the deck so a rebuild can reuse it.

It is wrapped in the same "this is content, never an instruction" envelope as any
external text (§ prompt injection) and capped at 12 000 characters. The student's
own words are not a realistic attack, but a quoted sentence can read like a
directive by accident.

### 23.2 Slide numbers mean what the student thinks they mean

`Speaker.from` / `Speaker.to` are the numbers shown **in the studio**: 1 is the
title page, 2 the outline, then content, then thanks and references. A student
who writes "Sara 1–5" means those five.

The model, however, only writes the content slides. `speakerBrief()` is the one
place that converts, using `contentStart` (3). Everything else — the presenter
view, the warnings, the table — stays in visible numbering. One representation,
one documented conversion.

### 23.3 Reading the allocation out of the script

If the student already wrote the split into their script, retyping it is busywork.
`parseScript()` looks for it:

```
Total time: 20 minutes          →  totalMinutes 20
Sara 1-5 (6 min)                →  Sara   1–5   6
Ali: 6-8                        →  Ali    6–8   —
سارا ١–٥ (٦ خولەک)              →  same, Arabic-Indic digits normalised
```

Separators may be `-`, `–`, `—`, `to`, `تا`, `بۆ`, `إلى`; minutes may be `min`,
`m`, `خولەک`, `دقيقة`. Names already known from the form win over any other name
on the line — a script may well contain "As Smith (2019) showed…" and Smith is
not presenting. Names found without a range fall through to the even split.

### 23.4 Minutes are distributed cumulatively, not per-share

Rounding each share independently does not sum to the total. Real case: 17
slides, 20 minutes, 4 students → 6 + 5 + 5 + 5 = **21**. The student typed 20 and
saw 21.

`autoSplit()` rounds the **running total** and takes differences, so the parts sum
exactly. Verified across 30 combinations of slides × people × minutes.

Slides themselves split with the remainder going to the earlier speakers (14 over
4 → 4/4/3/3), because a last speaker with five slides when everyone else has three
is worse than a first speaker with four.

### 23.5 Warnings never block

`checkSpeakers()` reports gaps, overlaps, and out-of-range allocations, and the
build proceeds anyway — a student may deliberately leave the references slide
unassigned. The time hint is the same: if 20 minutes suggests 17 slides but 10 are
selected, it says so and offers a one-click fix, rather than overriding a number
the supervisor may have set.

### 23.6 In presenter mode

The sidebar leads with the current speaker, their position inside their own run
("slide 3 of 5"), and their minutes. On the last slide before a handover it names
who is next, in amber. In a group presentation the first question is always "is it
my turn yet" — so it sits above the clock, not below it.

### 23.7 Verified by driving the real app

The wizard was driven end to end in a headless Chrome: seed a key, fill the title
and four student names, walk to the `talk` step, paste a Kurdish script with
Arabic-Indic digits, and read back the parsed table. That run is what surfaced the
minute-rounding drift — 6/5/5/5 against a stated 20 — which is now guarded by a
unit check instead. `playwright-core` was installed for it and removed afterwards;
the permanent guard lives in `check-core.ts`.

---

## 24. Making the deck argue one thing

The complaint was blunt and correct: *"the inside text or info does not have any
connection with other slides."*

The cause was visible in the prompt. Every rule under `Rules:` was mechanical —
vary the layouts, at least N images, 10–18 words per bullet, fill only the fields
the layout needs. **Not one rule asked for continuity.** And it started earlier
than that: the outline prompt asked for N sections, each a title plus a
one-sentence description, with nothing requiring them to form an argument. The
slide prompt then faithfully rendered a list of disconnected sections.

### 24.1 A thesis, written first

The model now writes a `thesis` before any slide: one sentence, specific enough
that someone could disagree with it.

The ordering is the entire mechanism. A model generates in sequence, so a claim
committed to first conditions every slide that follows. The same field written
*last* would be a summary of what was already produced and would change nothing.
`SLIDES_SCHEMA` therefore carries `propertyOrdering: ['thesis','slides']` —
Gemini honours it; OpenAI ignores the schema entirely (it only gets
`json_object`), so nothing breaks there.

The thesis is stored on the deck, so the studio agent can hold the same line when
it edits later.

### 24.2 The rules that were missing

```
- Every MIDDLE slide moves the argument one step and DEPENDS on the slide
  before it. Someone who skipped the previous slide should feel the gap.
- Say each thing ONCE. A point already made is not made again later in
  different words. This is the most common way these decks fail.
- Before writing each slide, name to yourself what it adds that no earlier
  slide has. If there is no answer, that slide is filler.
```

The outline prompt gets the matching demand without any schema change — the
existing `hint` field must now say what a section *establishes and makes possible
for the next one*, and "shuffling the sections should visibly break the
presentation" gives the model something it can actually check itself against.

### 24.3 The variety rule was doing harm

The old text was *"VARY the layouts … use at least six different layouts across
the deck."* On a six-slide deck that demands a different layout every single
slide, and the cheapest way for a model to comply is to pick an unused layout and
invent content that fits it. That is exactly how a deck stops being an argument.

Rewritten as a consequence rather than a goal — *"the shape of the content picks
the layout, never the wish for variety"* — with a floor that scales,
`min(6, max(3, round(N/2)))`: 3 for six slides, 5 for ten, 6 for twenty.

The **image** floor is untouched. That one exists for a measured reason: 1 deck
in 11 came back entirely text.

### 24.4 The subject decides what a good slide is

`domains.ts` holds one block used by both prompts. A deck on cinema was being
built like a deck on civil engineering — heading, three bullets, a picture —
when what a film lecturer wants is one named work read closely, and what an
engineering lecturer wants is a quantified trade-off and a failure mode.

Six field groups (engineering/computing, medicine/biology, film/literature/art,
business/economics/law, history/geography/social science) each state what that
field demands. The list is deliberately open-ended: an unlisted topic is handled
by *"ask what a specialist in that field would insist a student include."*

### 24.5 Recency

Where the outline prompt has web search, it now asks for what is true now —
current figures, developments from the last two years, live debates — and says
that a recent source beats an older one saying the same thing, while telling it
to say so plainly where the foundations are old and settled. Years come from the
clock, not from a hardcoded string.

### 24.6 What is verified, and what is not

Thirty checks in `check-core.ts` assert the prompt still carries the thesis
demand and its ordering, the dependency and no-repetition rules, all six domain
blocks and the fallback, the scaled variety floor, the conditional `L_divider`
paragraph — and that none of the older load-bearing rules were lost in the
rewrite (image requirement, `Label:` form, `L_compare` yes/no, `L_progress`
0–100, never invent a citation).

What is **not** verified: a real generation. The project ships no key (C2) and
none was available, so no deck has been produced from these prompts and read.
That judgement needs a human with a key and a topic.

`PROMPTS.md` carries both prompts in rendered form plus a meta-prompt for
rewriting them again.

---

## 25. Editor tools — audited, fixed, extended

### 25.1 What "the tools don't work" actually was

Every tool was driven in a real browser against the built site. Result:

```
selecting a slot · toolbar appearing · font size · font family
colour · adding shapes · adding text · duplicate · delete
undo · redo · right-click menu (7 items)          all PASS
title page                                             FAIL — 0 slots, no toolbar
```

One defect, and it was the first thing anyone sees: the studio opens on the title
page (`idx = -1`). A user presses **دەستکاری**, clicks the title, and nothing at
all responds. The only guidance was a line of hint text in the inspector, on a
tab they were probably not looking at.

A colour-change failure also showed up in the first audit run and was **not** a
product bug — it was the test. React keeps a value tracker on controlled inputs,
so assigning `input.value` directly and dispatching an event is ignored. Driving
it through the prototype's native setter makes it pass. Worth recording: the same
mistake will look like a real bug next time.

### 25.2 Why the title page still is not canvas-editable

Because `titleSlide()` in `export/pptx.ts` reads no `overrides` at all. Making
slots draggable there would let a student move their name, see it move, export the
deck — and find it back where it started. Silent divergence between preview and
export is worse than a control that is honestly absent, and § 8 exists to prevent
exactly that. C7 also fixes that slide's design.

So edit mode now renders a `.titlelock` panel over the title slide saying the
design is fixed and its text lives in the **ڕێکخستن** tab, and clicking it opens
that tab. The capability was always there; only the path to it was missing.

To make it truly editable, teach `titleSlide()` to honour overrides *first*.

### 25.3 Tools added

| Tool | Where | Why |
|---|---|---|
| Arrow-key nudge, 1 px (10 px with Shift) | keyboard | At 0.49 zoom one screen pixel is two slide pixels — the mouse cannot place anything precisely. |
| Align to slide, 6 directions | toolbar + panel | Centring by eye is guesswork. |
| X / Y / width / height number fields | panel | Exact placement, and reading back what a drag produced. |
| Rotation, −180°…180° | panel | Elements carried `rotate` in the type but nothing set it. |
| Opacity, 10–100 % | panel | Same — `opacity` existed, unreachable. |
| `Ctrl+C` / `Ctrl+V` | keyboard | Copy an element **to another slide**; duplicate could only copy in place. |
| `Ctrl+D` | keyboard | Duplicate without reaching for the toolbar. |

Nudging a layout slot that has no `x`/`y` yet reads its current position out of the
DOM first — otherwise the first arrow press would teleport it to the top-left
corner.

### 25.4 Six more design styles

Twelve now, up from six. Styles change **structure**, not colour: card treatment,
where the accent sits, title face, bullet mark, how the outline slide is drawn.

| Style | Card | Accent | Bullet | Reads as |
|---|---|---|---|---|
| **ڕەق** mono | none | side rule | ▸ | technical documentation, no ornament |
| **ستودیۆ** studio | glass | top band | ○ | strongest header/body separation |
| **نامە** thesis | outline | thin rule | 1. 2. 3. | a master's dissertation page |
| **پۆستەر** poster | solid | thick edge | ■ | built to read from the back of a hall |
| **تێبینی** note | solid | none | ● | quiet, no accent colour at all |
| **تۆڕ** grid | outline | top band | – | geometric, clearly structured |

All six reuse `card` and `accent` values `pptx.ts` already understands, so they
export correctly with no export work. That is a deliberate constraint: a new enum
value there would render in the browser and come out **blank** in PowerPoint.
`check-export.ts` now asserts every style emits more than 20 KB of slide XML, plus
per-style chrome and card assertions, so that failure cannot ship quietly.

### 25.5 Verified how

The audit and the re-test were run against `out/` in headless Chrome via
`playwright-core`, installed for the run and removed after. All twelve styles were
switched through the real picker and screenshotted; the six new ones were checked
by eye, not by file size. The permanent guards live in `check-core.ts` and
`check-export.ts`.

One pre-existing oddity was noticed and left alone: on a slide with an image slot
but no image, the placeholder collapses to a thin strip along the bottom instead
of filling its box. It affects every style equally, including the six original
ones, so it is not a regression from this work.

---

## 26. Watching it happen

The complaint: *"must show the user the searching and slides making lively, not one
time."* Generation took thirty to sixty seconds behind a progress bar and a row of
empty grey boxes, and then the whole deck appeared at once. Nothing about that told
a student the thing was working, or what it was producing.

### 26.1 One call, streamed — not many calls

The deck is still generated in a **single** model call. Splitting it into one call
per slide would have been the easy way to show progress and it would have cost
more, run slower, and destroyed the coherence work in § 24 — each call would have
had no idea what the previous slide argued.

Instead the response is streamed. Gemini's `streamGenerateContent?alt=sse` and the
OpenAI-compatible `stream: true` both deliver the same tokens in the same order,
just in pieces. **Same call, same tokens, same cost.** Only the arrival changes.

`streamModel()` in `llm.ts` handles both and falls back to a plain call for
providers without streaming in the browser, so the feature degrades to the old
behaviour rather than breaking.

### 26.2 Reading JSON that has not finished arriving

`JSON.parse` is all-or-nothing, and a half-delivered response looks like this:

```
{"thesis":"…","slides":[{"layout":"L_bullets","title":"یەکەم",…},{"lay
                                                                 ↑ stopped here
```

One slide is complete and can be shown now. `partialArray()` in `stream.ts` walks
the text counting braces and yields every closed object inside the named array —
respecting string context, so a title containing `{AI}` or an escaped `\"` does not
derail the counter. `partialString()` does the same for `thesis`, and deliberately
returns nothing until the closing quote arrives, so the user never watches a
sentence grow letter by letter.

It is checked at **every one of the 200 truncation points** of a sample response:
the extracted count never decreases, never exceeds the real total, and never yields
an object missing its fields.

`sseLines()` handles the other half — the network splits lines mid-character, so it
buffers the tail and decodes with `{ stream: true }`. That is checked with a
Kurdish word cut across two chunks.

### 26.3 What the student now sees

```
✓ OpenAlex ٨   ✓ Crossref ٥   × DOAJ          ← each database as it answers
─────────────────────────────────────
بەڵگەی سەرەکی: …                              ← the thesis, before any slide
─────────────────────────────────────
[ ١ ] [ ٢ ] [ ٣ ]                              ← real titles and bullets,
  appearing one at a time as the model writes them
```

The progress bar is driven by slides actually parsed, not by a timer. A database
that fails shows in red rather than vanishing — a student should know that DOAJ
returned nothing rather than assume it was never asked.

Measured with a faked SSE response in a real browser: card count moved
`0 → 1 → 2 → 3 → 4 → 5 → 6` across polls, titles rendered as real text, and the
thesis was on screen before the first slide.

### 26.4 Stopping now really stops

Before this, **وەستاندن** only set a flag — the request kept running in the
background and kept burning quota. It now passes an `AbortSignal` down to `fetch`,
and `sseLines` cancels the reader on the way out.

That introduced a wart worth recording: an aborted `fetch` rejects with
`AbortError`, whose message is browser English (*"The user aborted a request"*).
The wizard checks for it and stays quiet — a cancellation the user asked for is not
an error to report back to them.

### 26.5 A test that should not go red for someone else's reasons

`check-tools.ts` hits the live free APIs. Repeated runs during this work got
Openverse to rate-limit the IP with a `429` — reproducible with plain `curl`, so
not a code fault. The image block now reports `SKIP` on a 429 and fails on anything
else, because a suite that goes red for an external throttle teaches people to
ignore it.

---

## 27. What "the content is bad" actually meant

The owner supplied eight real university decks — lecture slides and student
group projects from their own institute — and said the generated content and
outlines were worse. Reading them side by side made the gap specific rather than
a matter of taste.

### 27.1 What the real decks do that ours did not

| The real decks | Our output |
|---|---|
| Name things: MongoDB, Cassandra, Redis, Neo4j; Armin Ronacher, 2010, Pocoo, WSGI | "various NoSQL databases", "developed by a programmer" |
| Work an example through: a Student table and a Department table with real rows, and the report they produce together | describes the mechanism, never runs it |
| Compare against the obvious rival on real criteria: SQL vs NoSQL across schema, scaling, transactions, data model, use case, examples | occasionally a ✓/✕ grid |
| A full slide of disadvantages — seven specific ones for NoSQL | benefits only |
| "Popular apps: Facebook → MySQL, Netflix → Cassandra, Uber → MySQL" | nothing |
| Expand the term: "NoSQL — Not Only SQL"; "the key text *runs* alongside the message" | uses the term undefined |
| Four types → one overview slide plus one slide per type | tries to fit four types on one slide |

Notice that the last row is something our own § 24 rule was actively
**preventing**. "Say each thing once" is right about content and wrong about
structure: repeating a heading while drilling into successive list items is how a
lecture deck is built. The rule now carries that exception explicitly.

### 27.2 A restriction we invented and never needed

The prompt said *"L_compare table cells must contain only yes or no."* The
renderer never required it — `SlideView` matches yes/no to render ✓/✕ and falls
through to plain text for anything else, and `pptx.ts` writes the cell text
either way. Every one of the eight reference decks uses descriptive cells.

So the single layout best suited to the comparison table these decks all contain
had been restricted to ticks by a prompt rule with no basis in the code. Cells
now carry real values, with ✓/✕ still available where the question genuinely is
binary.

### 27.3 The outline was the deeper problem

Asking for "N sections" produced N topic labels. The outline prompt now carries
the shape a marked student deck actually has — ground the term, why it exists,
how it works **one section per part**, a worked example, the comparison, what it
costs, who really uses it, what is unresolved — with the instruction to adapt or
drop per subject, and a demand that hints be checkable:

> A "hint" that says "explain the advantages" is worthless; "the three properties
> that let it scale horizontally, and the consistency it gives up to get them"
> tells the next step exactly what to write.

### 27.4 Status

Twelve new assertions in `check-core.ts` hold each demand in place, including
that the yes/no restriction stays gone. The prompt is 10 KB.

Still unverified against a live model, for the same reason as § 24.6: the project
ships no key. The evidence this is aimed at is real and specific, but whether the
model obeys it needs one generated deck and a human reading it.


---

## 28. Ten agents instead of one call

### 28.1 What was asked for

> "make my website like some agent working together — one agent for outline,
> another for linking outlines and get details about each outline without
> duplicate, another for organized data, one to save all website and books and
> source to put in reference in last slide, one to organize slide and make all
> info to one page and reorganize, another agent search for image, one other
> thinking and review the text and image and real working source, and finally
> output be like professional not simple."

That is a description of a pipeline, and it maps almost exactly onto the failure
modes § 24 and § 27 had already identified but could only address by asking a
single call to do everything at once.

### 28.2 Why one call had a ceiling

The old path was three model calls: outline, research, deck. The deck was one
streamed call producing every slide, and that was the right decision at the time
for three measured reasons — cost, latency, and coherence (§ 26).

But it put every decision in the same moment. Thesis, structure, what each
section says, what it must *not* say, which slides earn an image, which claims
rest on which paper — all of it resolved in one forward pass, with no point at
which anything already written could be read back and rejected. Three
consequences followed, and all three are in the owner's complaints:

- **Nothing could be reconsidered.** A model generates in sequence. Slide 11
  cannot cause slide 3 to be rewritten, so a deck that drifts stays drifted.
- **"Say each thing once" was unenforceable.** It was a stylistic wish in a
  prompt. Nothing owned a claim, so nothing was violated by saying it twice.
- **Later slides were measurably thinner.** By slide 11 the context is full of
  the deck's own output, and quality falls off. The last slides are the ones a
  presentation ends on.

### 28.3 The shape of the fix

One `Draft` moves through ten stages. Each does one job and reads what came
before.

| # | Agent | Model calls | What it decides |
|---|---|---|---|
| 1 | `architect` | 1 | thesis + deck kind, **before** any slide exists |
| 2 | `linker` | 1 | per-section contract: establishes · dependsOn · covers · weight |
| 3 | `librarian` | 1 | one English search phrase per section; the searches themselves are free |
| 4 | `writer` | 1 per section | the slides of that section, and nothing outside it |
| 5 | `editor` | 0–1 | duplicate pairs found in code, judged and rewritten by the model |
| 6 | `curator` | 1 | order, exact count, and the first look at all titles together |
| 7 | `visual` | 1 | which slides earn a picture, and the phrase to search for it |
| 8 | `critic` | 1 | reads the finished deck and reports what would cost marks |
| 9 | `polish` | 0–1 | rewrites only the slides the critic flagged |
| 10 | `verifier` | 0 | `compose()` + `verify()` — measurement, no model |

For a 10-slide deck over 7 sections that is 13–15 requests against 3.

### 28.4 The part that actually removes duplication

Not the prompt. Ownership.

`linker` gives every section a `covers` list — 3 to 6 specific points that
section, and only that section, is responsible for. `ownClaims()` then enforces
uniqueness in code: normalise each claim to its first six significant words, and
if two sections claim the same thing, the earlier one keeps it.

`Brief.avoid` is then **derived**, never asked for: it is the union of every
other section's `covers`. Two reasons it must be computed rather than generated.
The cheap one is tokens — asking each section to restate what the others own is
N× the same information. The one that matters is correctness: because
`ownClaims()` already made ownership exclusive, a derived `avoid` cannot contain
something the section also `covers`. A model-written one could, and the writer
would receive "write this" and "never write this" about the same claim, with no
correct output available.

On top of that, every writer receives `ledger()` — the actual title and bullets
of every slide already written, with the note that repeating any of it is the
single most common way these decks fail. In the single call that knowledge was
implicit in the context window. Here it is stated.

### 28.5 Splitting the call without losing coherence

`CLAUDE.md` carries a rule: **the deck is one model call, never one per slide.**
It still holds, and the crew does not break it.

The split is per outline *section*, not per slide — a 12-slide deck makes 6–7
writer calls. And the reason the old rule gave for not splitting ("each call
would not know what the previous slide argued") is the exact thing `ledger` and
`avoid` supply. What is lost is three seconds per section; what is gained is that
the last section has as much room to think as the first.

### 28.6 Checking a source that actually resolves

The request included "real working source". In a browser that is harder than it
sounds: a `HEAD` request to a publisher's site is blocked by CORS, so a
reachability check would report **every** reference as broken, valid or not.

Crossref sends `access-control-allow-origin: *`. So `doiRegistered()` asks
Crossref whether the DOI is registered — a real check that really runs, from a
static page, with no key and no server (C1, C2).

It is deliberately a **warning**, never a deletion. DataCite and small publishers
are not in Crossref, so a `false` means "not confirmed", not "invented". Dropping
a real source costs more than displaying an unverified one.

### 28.7 Nothing may kill the deck

`stage()` in `run.ts` catches every error, records a note, and returns the
previous draft. A failed `librarian` means a deck without citations, not no deck.
A failed `critic` means an unreviewed deck, not no deck. The stage list in the
wizard shows which agents ran, which were skipped and which failed — because a
pipeline that silently degrades is worse than one that visibly does.

Two deliberate exceptions:

- **`Stopped` propagates.** The user's cancel must not be swallowed as "this
  stage failed, carry on", or ten more requests run against a deck nobody wants.
- **Zero slides after `writer` throws.** The six stages after it would all
  operate on an empty list and spend ten requests producing nothing.

### 28.8 The fast path stays

The crew is the default; a switch in the wizard runs the old single call. The
reason is quota, not doubt: 13–15 requests can hit a free Gemini key's
per-minute limit, and a student who needs a deck now needs the three-call path to
still exist. Both paths return the same `BuiltDeck` shape and share one tail —
outline slide, thanks, references page, `verify()`, `buildDeck` — so they cannot
drift apart.

It also makes the improvement measurable: same topic, same key, one switch.

### 28.9 Status

48 assertions in `check-core.ts`: stage coverage, slide-budget arithmetic that
sums exactly, claim ownership uniqueness, `avoid` containing no claim the section
also owns, the ledger and the contract reaching the writer's prompt, and every
shared rule appearing in **both** prompts.

Unverified live, for the same reason as § 24.6 and § 27.4: the project ships no
key. Two questions can only be answered with one: whether 13–15 requests clear a
free key's per-minute limit, and whether the sections read better than the single
call they replaced.
