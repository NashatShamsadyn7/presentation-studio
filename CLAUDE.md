@AGENTS.md

# Presentation Studio

An AI presentation generator for university students in the Kurdistan Region of
Iraq. Kurdish Sorani / Arabic / English. **Everything runs in the user's browser.**

Live at **https://iosbb1.web.app** · not a git repository.

Three docs, three jobs:

| File | What it holds |
|---|---|
| `CLAUDE.md` (this) | constraints, commands, landmines. Read first, it is short. |
| `README.md` | 27 numbered sections. Every decision with its measurement. |
| `PROMPTS.md` | both prompts rendered in full, plus a meta-prompt to rewrite them. |
| `RESTRUCTURE.md` | the plan merging research + content + design into one pipeline. **All phases done.** |

---

## Hard constraints — from the product owner, not negotiable

| # | Rule |
|---|---|
| **C1** | **No backend, no server routes, no database.** Static export only. If a feature needs a proxy, the feature does not ship. |
| **C2** | **Ship zero API keys.** Every user brings their own; keys live in `localStorage` only. Never hardcode one, never commit one, never add an API that requires a key we hold. |
| **C3** | **Kurdish (`ckb`) and Arabic (`ar`) must use Gemini.** No exceptions, no user override. |
| **C4** | **Wikipedia is banned** as citation, source, or grounding target. Also: Quora, Reddit, Medium, blogs, SlideShare, Chegg, W3Schools, GeeksforGeeks, TutorialsPoint, Studocu, Scribd, CourseHero. (Wikimedia *Commons* images via Openverse are allowed — a licensed photo is not a cited claim.) |
| **C5** | **No accounts, no login, no sign-up.** Persistence is IndexedDB + manual `.json` export/import. |
| **C6** | **Never invent a citation.** References come from real bibliographic databases or they do not exist. |
| **C7** | **Slide 1 has a fixed design.** Do not redesign it. |
| **C8** | **Animations and transitions are required**, not optional polish. |
| **C9** | **Exported PPTX must be natively editable** — real text boxes, tables, charts. Never export a slide as an image. |

## Language rules

- **UI text is Kurdish Sorani, RTL.**
- **All code comments are Kurdish Sorani.** Do not translate existing ones to
  English. New comments are written in Kurdish too.
- **Documentation (`README.md`, `PROMPTS.md`, this file) is English.**
- **Replies to the user are Arabic.**

---

## Commands

```bash
npm run dev          # localhost:3210
npm run check        # tsc + check-core + check-icons + check-export  (offline)
npm run check:live   # check-tools — hits the real free APIs
npm run build        # static export to out/
npm run preview      # serve out/ on 3400
npm run deploy       # check + build + firebase deploy --only hosting
```

Expected pass counts — a drop is a regression, not a flaky test:

```
check-core   892    check-icons  1001
check-export 123    check-tools    64
```

`check-tools` reports `SKIP` when Openverse rate-limits the IP (`429`). That is
an environment condition, not a failure — anything else in that block still
fails hard.

Firebase site id is `iosbb1` (the id *is* the subdomain, globally unique; the
default site cannot be renamed). Preview channels need `--site iosbb1`.

---

## Where things are

```
src/lib/
  generate.ts     buildPrompt() + generateSlides() — the deck, one streamed call
  research.ts     suggestOutline() + findResearch() — real databases, never the model
  domains.ts      per-field standards, shared by both prompts
  stream.ts       read JSON and SSE before the response has finished arriving
  script.ts       the student's own script + who presents which slides
  llm.ts          provider dispatch, callModel + streamModel
  gemini.ts       callGemini + streamGemini      providers.ts  provider catalogue
  json.ts         parseJson — provider-neutral, was inside gemini.ts
  agent.ts        the 15-tool studio agent, maxSteps 12 — every edit re-runs compose()
  citestyle.ts    6 citation styles × 3 source kinds
  cite.ts         BibTeX / RIS / text export + restyle
  styles.ts       12 design styles (structure)    themes.ts   colour only
  mascot.ts       app state → which tip the robot says
  fit.ts          overflow detection              layouts.ts  33 slide layouts
  crew/           the ten-agent pipeline — DEFAULT build path
    run.ts        the orchestrator. STAGES · every stage degrades to the last draft
    types.ts      Draft · Brief · StageReport — the contract between agents
    rules.ts      the quality rules BOTH paths import. Single source, on purpose.
    ask.ts        one door to the model for every agent   pack.ts  prompt material
    architect.ts  thesis + deck kind, before anything is written
    linker.ts     per-section contract: establishes · covers · avoid · slide budget
    librarian.ts  one search per section, pooled and assigned
    writer.ts     ONE CALL PER SECTION, each seeing the ledger of what came before
    editor.ts     duplicate pairs found in code, rewritten by the model
    curator.ts    order · exact count · the first look at all titles together
    visual.ts     which slides earn an image, then Openverse-first fetch
    critic.ts     reads the whole deck + verify() + live DOI check. Reports only.
    polish.ts     applies the critic's fixes to the flagged slides only
  deck/
    model.ts      Id · Source · Section · Point — the spine everything links through
    compose.ts    Shape → layout BY MEASUREMENT. The model no longer picks layouts.
    verify.ts     6 mechanical checks — gaps, overflow, empty slots, refs, duplicates
  tools/
    academic.ts   OpenAlex + Crossref + DOAJ + Open Library, RRF ranking
    data.ts       Openverse images, World Bank stats, web search engines
    slideImage.ts one image path for wizard, editor and agent
  export/
    pptx.ts       pptxgenjs — the C9 surface
    pdf.ts
src/components/   Wizard.tsx  Studio.tsx  SlideView.tsx  PresenterMode.tsx
                  Toolbar.tsx  ThemePicker.tsx  Mascot.tsx
public/           sw.js  mascot/*.webp (9 poses, 172 KB total)
scripts/          check-core · check-icons · check-export · check-tools
```

Wizard steps: `key → title → who → look → plan → talk → build`.
Studio slide index: **`idx = -1` is the title page**; `deck.slides[0]` is the
outline. User-visible slide `n` maps to `deck.slides[n - 2]`.

---

## Landmines

Each cost real time to find. Do not rediscover them.

### The agent crew — `src/lib/crew/`

**The default build path is now ten agents, not one call.** The Wizard has a
`crewOn` switch (default on) and a "fast" mode that is the old single
`generateSlides` call verbatim. Both paths end in the same tail — outline slide,
thanks, refs page, `verify()`, `buildDeck` — written **once**, in `build()`. If
you add a third path, return the `BuiltDeck` shape; do not copy the tail.

**"The deck is ONE model call, never one per slide" still holds — this is not
that.** The split is per *outline section*, not per slide: a 12-slide deck makes
6–7 writer calls, not 12. And the stated reason the old rule existed — "each call
would not know what the previous slide argued" — is answered explicitly rather
than assumed: every writer receives `ledger()`, the full text of every slide
already written, plus `avoid`, the claims other sections own. In the single call
that knowledge was implicit; here it is on the page.

**`Brief.avoid` is DERIVED IN CODE (`deriveAvoid`), never asked of the model.**
Asking each section for its own "do not cover" list means writing the same
information N times, at N× the tokens, with N chances to contradict. Worse:
`ownClaims()` enforces that a claim belongs to exactly one section, so a
model-written `avoid` could contain a claim that section also `covers` — the
writer would get "write this" and "never write this" in the same prompt, and
every possible output would be wrong. Asserted in `check-core`.

**Every quality rule lives in `crew/rules.ts` and is imported by BOTH paths.**
`buildPrompt()` in `generate.ts` and `sectionPrompt()` in `crew/writer.ts` share
`QUALITY_RULES`, `WRITING_RULES`, `REJECT_RULES`, `NO_CHARTS` and
`SHAPE_CATALOGUE` as literal constants. `check-core` asserts each string appears
in both prompts. Do not fix a prompt in one place — that is exactly how the
humanizer ended up deleting the connectives the slide prompt demanded.

**No stage may kill the deck.** `stage()` in `run.ts` catches every error, pushes
a note, and returns the *previous* draft. The one exception is `Stopped` — the
user's own cancel — which must propagate, or the remaining agents run against a
deck nobody is waiting for. The other exception is deliberate: if `writer`
produced zero slides, `runCrew` throws, because the six stages after it would all
operate on nothing and burn ten more requests to produce an empty deck.

**`callModel` now takes a `signal`, and it had to.** Streaming always had one
because generation was a single streamed call. The crew makes a dozen
non-streaming calls; without threading `outerSignal` into `fetchWithTimeout`,
"Stop" was a flag that changed nothing while the requests — and their cost —
continued.

**The critic reports, the polisher rewrites, and they are separate calls for a
reason.** Asked to find problems *and* fix them in one response, a model writes
the fix first and reverse-engineers the problem to match, because it generates in
sequence. The critic's response cannot change anything, so it has nothing to
justify.

**`polish` only ever sees the flagged slides.** Sending the whole deck and asking
for improvement gets the whole deck rewritten, including the slides that were
already right — and the average result is worse than what you had. Slide
identity, section, fetched image and user overrides are carried over from the old
slide, not taken from the model's reply.

**`doiRegistered()` returning `false` does NOT mean the citation is fake.**
DataCite and small publishers are not in Crossref. It is a *warning*, never a
deletion — dropping a real source is a bigger loss than showing an unverified
one. And it exists at all only because Crossref sends CORS headers: a `HEAD` to a
publisher's own site from the browser fails for every source, valid or not, so
that check would report the entire reference list as broken (C1).

**Openverse before AI on the automatic path.** `resolveImage({ prefer: 'free' })`
in both the crew's `visual` and the fast path. The editor's explicit "generate
with AI" button keeps `prefer` unset, because there the user asked for AI by
name. Owner's decision: a licensed photograph is more honest in a university deck
than a generated one, costs nothing, and does not eat the key's quota.

### Prompts and content quality

**Reference decks live in `C:\Users\nasha\OneDrive\Desktop\slides`** — eight real
university decks from the owner's institute. They are the standard the content
prompts aim at: named systems and years, one example worked through, a comparison
table with real values, a disadvantages slide, "who actually uses it". Read them
before touching content quality. → README § 27.

**The model writes `thesis` before `slides`, and the order is the point.** A model
generates in sequence, so a claim written first conditions every slide after it;
written last it is a summary that changes nothing. Hence
`propertyOrdering: ['thesis','slides']` in `SLIDES_SCHEMA`. Do not reorder.

**"Say each thing once" must keep its drilling exception.** Repeating a heading
across slides while walking successive list items (four types → four slides) is
correct lecture structure. Remove the exception and the model crams four types
onto one slide.

**Never restore "L_compare cells must be yes or no".** The renderer accepts plain
text and always did; the rule was invented in the prompt and crippled the one
layout best suited to the comparison table every reference deck contains.

**Do not restore "use at least six different layouts".** On a short deck that
forces a different layout every slide, and the model complies by inventing
content to fill an unused one. The floor scales: `min(6, max(3, round(N/2)))`.
The *image* floor is separate and stays — 1 deck in 11 came out entirely text.

**Research runs BEFORE generation, and its output goes into the prompt.** This is
the fix for "the content is weak", and it is an ordering fact, not a wording one.
The old pipeline searched twice and used neither result: `Wizard` discarded
`suggestOutline`'s `sources` on the line it received them, and `findReferences`
ran *after* `generateSlides`, so the deck's author never saw the papers the deck
would go on to cite. Meanwhile the prompt demanded named systems, years and
retrieved figures. The model had nothing to name from — so it generalised, and
generalising is the weakness. `findResearch()` now returns `{ refs, papers }`;
`researchPack()` in `generate.ts` renders the papers **with their abstracts**
through `envelope()` and places them first in the prompt. Do not reorder these
two steps back.

**A slide title is capped in code, not only in the prompt — `slideTitle()` in
`research.ts`.** "A title states the finding, not the subject" is a good rule with
one blind spot: nothing bounds it, so the model writes the finding as a full
sentence. The owner shipped a deck whose contents page said **Neural Networks**
(2 words) and whose body slide said *"Artificial Neurons Mathematicalize Synaptic
Integration via Weighted Sums"* (8 words, two lines, and "mathematicalize" is not
a word). Same section, and it reads like two different decks. Two ceilings apply —
7 words **and** 64 characters, because seven long words still wrap. Truncating by
word count alone breaks phrases, so the cut is taken at a comma first, then at a
`TAIL_WORDS` connective (`via`, `across`, `لە ڕێگەی`, `عبر` …), and only then by
force. Never below 3 words: two words is a subject again, which is the failure the
title rule exists to prevent. The prompt's ceiling and `slideTitle`'s `max` must
stay the same number — if the prompt allows 8 and the code cuts at 7, every
compliant title gets truncated.

**The title must carry the section's own words.** The contents page is a promise;
a body slide the reader cannot map back to a listed section breaks it even when
the content is right. `section` tagging alone does not fix this, because the
number is invisible to the audience. This is enforced in the prompt only — a code
check would need morphology (`تۆڕەکان` vs `تۆڕ`) and would fire on correct decks.

**`findResearch` must not stop at the first query that returns rows.** It did
`if (papers.length) return pack(papers)` — but `pack()` then drops every paper with
no DOI and no URL (unverifiable is as useless as invented, C6). So a query returning
five link-less papers produced an **empty** result *and* skipped the broader queries
that would have worked. That is the "references page is empty" the owner reported.
Now it only returns when `pack()` actually yields refs.

**`englishQuery` runs for English topics too, not just Arabic-script ones.** A
student's topic is often a malformed English phrase — "Network Concept you must
known" — and academic databases return nothing for it. Normalising it to a real
search phrase costs one temperature-0 call and is the difference between five
references and none.

**Fetching references is a BUTTON, not an agent request.** The empty state used to
say "ask the assistant". That is a fixed job with one tool and no decision in it —
routing it through a model adds tokens, a step, and a way to fail. `CiteExport`
calls `findResearch()` directly, the same function the Wizard uses, and creates the
`L_refs` page if the deck has none.

**`toReference()` drops the abstract — that is why `papers` is returned
separately.** `Reference` is the citation record for the references page. The
abstract is the only part with actual findings in it, and it exists only on
`Paper`. Anything that needs substance wants `Paper`, not `Reference`.

**`exactly()` keeps the LAST slide when trimming.** It used to `slice(0, want)`,
which always cut from the end — deleting precisely the closing slide the prompt
asks for ("what it costs, what is still unresolved"), so an over-length deck
ended mid-argument.

**The humanizer must not delete logical connectives.** `furthermore`, `moreover`,
`additionally`, `هەروەها`, `علاوة على ذلك` were being stripped as "AI tells".
They are not tells, they are the links in the chain of reasoning that the slide
prompt spends a whole section demanding. Two parts of the codebase were working
against each other. Empty filler ("شایەنی باسە کە", "it is important to note
that") is still removed — that carries no meaning.

**The outline is a CONTRACT with the contents page, and it has to be stated as
one.** Without a script, the old prompt passed the outline as bare context —
`The agreed outline is: …` and nothing else, no directive at all. Meanwhile the
script branch got "FOLLOW ITS ORDER" and "every substantive point must appear".
So the agenda slide (built from `outline.map(o => o.title)`, always) promised
sections the deck was free to skip — and a marker sees that before anything else.
The prompt now requires every section to get at least one slide, in order, with
no invented sections, and each slide carries `"section"`: its 1-based outline
index, ordered **first** in the item schema for the same reason `thesis` comes
before `slides`. `generateSlides` returns `uncovered` and the wizard names the
missing sections instead of shipping a broken promise silently.

**`exactly()` fills gaps from UNCOVERED sections, not `i % outline.length`.** The
modulo wrapped around, so a short deck ended by repeating its own opening
sections — a presentation finishing on "Introduction". It now takes the sections
that have no slide, which is both correct and what the contents page needs.

**Outline headings are ONE TO THREE WORDS, and there are reference examples for
it.** `C:\Users\nasha\Downloads\website last update\see\see .docx` holds 100 real
university outlines from the owner — `Introduction · History · How AI Works ·
Types · Applications · Risks · Future`. That is the target. The prompt used to
say "at most 6 words" and illustrate a good `hint` with a 20-word example, so the
model wrote headings like *"Understanding the Fundamental Principles of Chemical
Bonding"* — a sentence wearing a heading's clothes. Eight of those examples are
now few-shot material in the prompt, chosen to span mechanism, history, research
and case-study shapes, because the same file makes the point that **the outline
structure must change with the subject** rather than defaulting to
Introduction → Body → Conclusion.

`shortTitle()` enforces it in code — leading verbs (`Understanding`,
`Introduction to`, `An Overview of`) stripped, everything after a colon dropped,
hard cap of four words — because a checkable rule is obeyed where a stylistic
wish is not. `tidyOutline()` runs it on all three return paths and also caps
hints at 25 words and drops duplicate sections.

**Gemini's search tool has two names, and sending the wrong one kills the whole
call.** `google_search` on 2.0+, `google_search_retrieval` on 1.5 — and the
provider catalogue offers models from both eras. A fixed name means a 400 for
half the models, and that 400 does not merely disable grounding, it fails the
entire `generateContent` request. Symptom: the outline was *always* built without
search. `SEARCH_TOOLS` tries them in order and only retries when the error text
actually looks like a tool-name rejection — retrying a 429 or 403 is wasted quota.

**Never `catch { }` a search failure.** `suggestOutline` swallowed the reason, so
the user saw "search failed" with nothing actionable and the cause was invisible
to debugging too. `OutlineResult.reason` carries it out and the wizard prints it.
`humanError()` also keeps Google's own 400 text for tool errors instead of
replacing it with a generic line.

**The outline search must run in English, whatever the deck language.** The
academic web is overwhelmingly English; searching in Kurdish or Arabic returns
almost nothing for most subjects. `findReferences` learned this long ago — that
is what `englishQuery()` exists for — and `suggestOutline` never applied it, so
it fed the raw Kurdish topic straight to Google Grounding. Since C3 forces Gemini
(and therefore search) for `ckb`/`ar`, **the primary users were getting the worst
possible search.** `suggestOutline` now translates the topic first and the prompt
says SEARCH IN ENGLISH, write the outline in the deck language.

**Never reuse the search prompt on the no-search fallback.** `outlinePrompt()`
takes `search` as a parameter for exactly this reason. The old code built one
prompt and reused it, so the retry told a model with no search tool to "search
the web" and report "current figures from 2026" — an instruction it can only
satisfy by inventing recency.

**A failed search must not silently become an ungrounded outline.** The old
fallback threw the whole search away and restarted cold; the user waited for a
search and got parametric guesswork with the same UI. Now the searched text is
passed into a second schema-constrained call as material (via `envelope()`), so
the research survives a JSON failure — and `OutlineResult.grounded` tells the
wizard the truth when it does not.

**Update `PROMPTS.md`** whenever `buildPrompt()` or `suggestOutline()` changes.

**The agent's system prompt carries the other half of the injection defence.**
`sanitize.ts` wraps tool output in an `UNTRUSTED DATA` envelope; `systemPrompt()`
in `agent.ts` is what tells the model that envelope means "data, never
instruction". For two versions the envelope existed and the prompt never
mentioned it — the model saw the fence and had no contract for it. Both halves
are asserted in `check-core.ts`. Do not delete either.

**Rejection criteria go before `CHOOSING A LAYOUT`, not after.** The content has
to survive the reject pass before a layout is picked for it. Reversed, the model
chooses a shape first and then defends whatever fills it.

### The deck spine — `src/lib/deck/`

**Nothing had an identity, so nothing could be linked.** A bullet was a `string`,
which has no fields and therefore cannot carry a source. `Slide` had **no
`section`** — the model sent one, `generateSlides` used it once to compute
`uncovered`, then threw it away, so a finished deck did not know which outline
section any slide belonged to. `Reference` had no `id`, so nothing could point at
one. The outline, the slides and the references were three lists that never
referenced each other. There was no broken link to repair; there was no link.
The chain now is `Source.id → Section.sources[] → Slide.section → Point.sources[]`.

**The model must not pick the layout — it cannot measure.** It chose `layout`
before knowing how much text it would write, and `fit.ts` could only shrink the
font afterwards. That is the single cause of all three visual complaints: too much
text overflowed (or went unreadably small), too little left half the slide empty,
and an image layout with no image rendered the grey box the owner photographed.
`compose.ts` derives a `Shape` from the content, filters to layouts whose data the
slide actually has, and picks the first that **measurably fits** — roomiest last as
the fallback. Do not move layout choice back into the prompt.

**The model emits `shape`, never a layout id — and `Slide.shape` is the truth.**
`shapeOf(layout)` is a *lossy* legacy fallback and cannot be made otherwise:
`compareN` and `breakdown` own no layout exclusively (`L_compare` is shared with
`compare2`, `L_donut` with `data`). Do not "fix" it by trying to derive shape from
layout — that is why the field exists. `seedOf(shape)` gives a starting layout only;
`compose()` replaces it by measurement.

**A slide with an image must land on a layout that HAS an image slot.** Without the
`wantsImage` branch in `pickLayout`, a `list` slide carrying an `imagePrompt` gets
`L_icons` — no image slot — and the fetched image is silently discarded after you
paid for it.

**`withImages()` adds image PROMPTS, not layouts.** It used to switch layouts; then
`compose()` started running after it and overwrote every one of those switches. The
image floor now works by ensuring enough slides carry an `imagePrompt`, and
`compose()` places them.

**Only retrieved source ids survive `toSlide`.** `cites` entries are filtered
against the ids actually in `researchPack`. This is C6 enforced by types rather than
by asking the model nicely: a hallucinated citation has nowhere to land. The prompt
says so explicitly, so inventing an id loses the citation rather than gaining one.

**The references page is a PROJECTION (`citedRefs`), not a list.** Only sources some
slide cited appear, ordered by first use. Two guards: with zero citations anywhere it
returns everything (a deck without citations still has sources), and unknown ids
never empty the page.

**The agent's only door into the deck is `settle()`.** It used to carry its own
measurement engine (`measure`/`roomier`/`linesOf`) — a second implementation of what
`compose()` does, free to drift. That is deleted. `edit_slide`, `add_slide` and
`set_shape` all end in `settle(slides, d.lang)`, so the agent cannot produce a slide
the generation pipeline would not have. `set_layout` and `fix_overflow` are gone:
layout and overflow are no longer its business.

**The model does not produce charts or tables. The schema has no field for them.**
Owner's ruling, and it is correct: a model has no numbers. A generated chart is
three invented percentages that sum to 100; a generated table is a grid of
adjectives. Both *look* like evidence, which is worse than saying the same thing in
a sentence — a marker who checks one figure and finds it unsourced discounts the
whole deck. `toSlide` also drops `chart`/`table` if a schema-ignoring provider sends
them anyway. The *layouts* stay, and `set_chart` stays, because the student and the
agent can supply real data. Do not put the fields back in `SLIDES_SCHEMA`.

**Outline `hint` is the brief, not a label — 25-50 words, capped at 60.** It was
"under 20 words", which produced hints like "Explain the advantages" and therefore
slides that said nothing. The writer of a section sees only its title and this note,
so anything missing here gets invented.

**An image slot with no image shows the PROMPT.** `ImageBrief` renders
`imagePrompt` as copyable text so the student can take it to any image tool. Empty
decoration helps nobody; a ready-to-paste prompt is a task they can finish.

**Default model is Pro, not Flash** — owner sized it at 1-3 decks per week, so
throughput is worthless and quality is everything. `gemini-2.5-pro`.

**NEVER put an unverified model id first in a provider's list.** `testKey` calls
`p.models[0].id`, so a wrong id at the top makes **every valid key for that provider
report "doesn't work"**. This happened: `gemini-3.1-pro` was added on request, does
not exist, and OpenRouter answered `"google/gemini-3.1-pro is not a valid model ID"`
— against a perfectly good key. Two defences now: `testKey` walks the whole catalogue
and only gives up when a failure is *not* about the model (`modelFault`), and
`FALLBACK_MODELS` in `gemini.ts` does the same for generation. Add a new id to the
list, verify it in the UI, and only then move it to the top.

**Every provider card has a free-text model box, and a LIVE model list.**
Catalogues go stale — providers add and remove models without notice, and C2 means
they cannot be verified from here. `lib/models.ts` asks the provider itself:
OpenRouter's `/api/v1/models` needs **no key** (so it works before the user has one);
Groq/OpenAI/DeepSeek use the key already entered. Free models sort first.

**Filter the live list to text-only outputs.** `google/lyria-3-pro-preview` reports
`pricing: 0` — because it is billed per second, not per token — and would appear as a
free option. It is a music model. `textOnly()` keeps only `output_modalities: ['text']`;
a missing field is kept, since over-filtering hides working models.

**A CSS class name defined twice is a silent, invisible bug — and it happened
TWICE here.** `check-core` now asserts no bare `.x{` block appears more than once in
`globals.css`. Both cases cost real debugging time:

- `.pick` — the Studio's icon/shape buttons carry `aspect-ratio:1`. Naming the new
  theme dropdowns `.pick` turned each `<label>` into a **square the width of the
  panel**: the select at the top and ~250px of nothing under it. That is the empty
  space the owner photographed twice. Renamed `.selrow`.
- `.split` — `SlideView` uses it for the bullets+image two-column layout
  (`display:flex;gap:54px`); `Wizard`'s speaker table redefined it lower down as
  `flex-direction:column`. The later block won for **both**, so every `L_bullets`
  slide stacked its image *under* the bullets instead of beside them. Renamed the
  Wizard one `.spk`. This one was pre-existing and had been shipping.

Neither produced an error, a warning, or a failing test. Only a wrong-looking page.

**A `var()` with no fallback and no declaration fails SILENTLY.** `--bg-1`, `--ln`
and `--tx-1` were written into `globals.css` and never existed — the real names are
`--surface`, `--line`, `--tx`. No build error, no console warning; the borders and
colours just vanished. `check-core` now greps every `var(--x)` **without a fallback**
against the declared set. `var(--panel,#fff)` is fine and is skipped; `--font-ui`
(next/font) and `--g` (inline style in `SlideView`) are declared outside the file
and allowlisted.

**A preview whose width is CSS and whose height is JS will be mostly empty.**
`LazyShot` set both from a fixed `w`, but `.th-shot{width:100%}` overrode the width
— so in a full-width panel you got a 700×172 box holding a 306px slide, which is
the empty space the owner photographed. `Preview` now measures with a
`ResizeObserver` and derives both height and `scale` from the real width. Do not
reintroduce a fixed-width preview inside a fluid container.

**`Deck.sections` must be persisted or the gap check is dead.** `Slide.section`
holds `"sec2"`, and nothing mapped that back to a title after generation — so
`verifyDeck(deck)` in the Studio ran with no sections and the gap check silently
never fired. It ran exactly once, in the Wizard, and never again. `buildDeck` now
stores them and `importDeck` validates them.

**`Section.sources` is DERIVED (`sectionSources`), never filled by hand.** It was
declared and left `[]` forever — a link that claimed to exist and did not. It is now
computed from the `cites` of that section's slides, so it cannot lie and costs no
model call.

**`compose()` runs TWICE, and the second run is the one that matters.** Before
images are fetched, an `imagePrompt` counts as a promise. After
(`imagesResolved: true`), a promise that did not resolve is rejected and the slide
drops to its text sibling. Delete the second call in `Wizard` and the grey box
returns.

**Every `CONTENT_LAYOUTS` entry needs a `BY_SHAPE` entry.** `unshaped()` is
asserted empty by `check-core` — it caught `L_proscons` being forgotten within
minutes of the map being written. A layout with no shape is invisible to
`pickLayout()` and would silently never be chosen again.

**An empty references page is worse than none.** It claims research was done and
then shows nothing. `Wizard` builds the page only when `research.refs.length`, and
`verify()` raises `refs-empty` as an *error*, `refs-unverifiable` as a warning when
a reference has neither DOI nor author+year — because that is exactly what a marker
checks first.

### Streaming

**Google puts the retry delay in the BODY, not in `Retry-After`.** Gemini's 429
carries `google.rpc.RetryInfo` — `{"retryDelay":"31s"}` — and sends no header at
all. `waitFor()` only read headers, so it fell through to `BACKOFF[0]` and retried
a **per-minute** quota after **one second**. The retry existed and could never
succeed; the owner saw "search failed, quota exceeded" while the ungrounded
fallback went through, because by then the minute had rolled over. `retryDelayMs()`
now parses the body, `MAX_WAIT` is 65s (30s could not cover a per-minute window),
and one second is added because the two clocks are not identical.

**Read the retry body from `res.clone()`.** Reading `res.text()` on the response
you are about to return empties it, and the caller's error message becomes blank —
a silent failure that looks like a working error path.

**A per-day 429 must not be retried.** `isDailyQuota()` breaks out immediately:
waiting 65 seconds to be told the same thing wastes a minute of the user's time.
The two messages differ accordingly, and neither says "wait a few minutes" any
more — `net.ts` already waited, so that instruction was a lie. `check-core` greps
both files (comments stripped) to keep it from coming back.

**`OPENAI_COMPATIBLE` holds the FULL URL, not a base.** `streamOpenAiStyle` used
to append `/chat/completions` to it, producing
`…/v1/chat/completions/chat/completions` → 404 → and `explain()` rendered that
404 as "model not found, change the model name". Streaming was broken for
**every** provider except Gemini, and nothing tested it. Both paths now go
through `openAiUrl()`, and `check-core` asserts the URL is complete and
non-duplicated for all four providers.

**Model calls use `MODEL_FETCH`, not the default retry policy.** Free databases
(OpenAlex, Crossref, DOAJ) can be retried on 5xx for nothing. A model that
answered 500 may already have generated — and billed — tokens, so retrying three
times can quadruple the cost of a request that may never succeed. `MODEL_FETCH`
retries once, and only on 408/425/429.

**The deck is ONE model call, streamed — never one call per slide.** Splitting it
costs more, runs slower, and breaks coherence, because each call would not know
what the previous slide argued. `partialArray()` in `stream.ts` extracts finished
slides from half-arrived JSON; it is checked at all 200 truncation points of a
sample response. → README § 26.

**An aborted `fetch` rejects with `AbortError`** and a browser-English message.
A cancellation the user asked for is not an error to show them — `Wizard` checks
the signal and stays quiet.

### References and data

**References were empty** because no `schema` reached `callModel`, so the model
answered in prose and the grounding fallback was `[]` for every non-Gemini
provider. Fixed by querying real databases; the model only writes an English
*search phrase* now. → README § 20.

**Never add `edition-number` to the Crossref `select` list.** Not a valid field —
Crossref returns **HTTP 400 for the whole request**, silently dropping Crossref
from every result.

**Openverse licence filter: `license_type=commercial,modification`, never
`all-cc`.** `all-cc` admits ND licences (15–35 % of results) and PPTX crops with
`sizing: cover`, which is a derivative. → README § 13.1.

**Preferring museum sources in Openverse does not work.** Measured: `source=met,nasa,…`
returned nothing for 3 of 4 topics and an irrelevant painting for the fourth.

**Rejected APIs** — REST Countries (no CORS after redirect), Semantic Scholar
(throttles), arXiv (no CORS), CORE / Unpaywall (need a key). → README § 11.

**Titles are not case-converted** in citations — it would turn `IoT` into `Iot`
and `COVID-19` into `Covid-19`. Only all-caps titles are fixed.

**MLA and Chicago are identical for a plain book.** Correct, not a bug. Style
distinctness assertions must use a real paper.

### Imported files and storage

**Everything in an imported `.psproj.json` is hostile until checked, including
`elements`.** `imageUrl` was filtered and `elements` was not, despite the comment
claiming otherwise. An element of `kind:'image'` whose `value` is an `https:` URL
becomes `<img src>` in `SlideView` — so opening a shared project file fired a
network request from the student's browser to a stranger's server. `x/y/w/h`
were equally unchecked and `NaN` reaches both CSS and the pptx XML.
`cleanElements()` is the single gate; do not bypass it.

**`db.close()` runs on `oncomplete`, `onerror` AND `onabort`.** It used to run
only on completion. A failed transaction — routine once a deck carries large
data-URI images — leaked an open connection, and an open connection **blocks any
future IndexedDB version upgrade**, silently.

**Invisible characters in source files are written as `\u` escapes, never
literally.** `sanitize.ts` once held real U+202E / U+200B characters inside its
character class. Any formatter, copy-paste, or Unicode normalisation would strip
them, emptying the defence while leaving a file that still compiles and still
passes every old test. `check-core` now scans `sanitize.ts` and `json.ts` for
literal invisible characters and fails if it finds any.

**`parseJson` lives in `json.ts` and takes the provider.** It used to be in
`gemini.ts` and threw `GeminiError`, so a JSON failure from DeepSeek told the
user to turn off a Gemini search they had never enabled.

### Fonts, fitting, the empty image slot

**Georgia has no Arabic glyphs, and the wizard used to force it on every deck.**
`NO_ARABIC` in `fonts.ts` says so explicitly, and the wizard hardcoded
`Georgia,'Times New Roman',serif` regardless of language. On screen the browser
silently substituted whatever Arabic font the machine happened to have — which is
why the app "used one really ugly font". In the .pptx it looked fine, because
`morph.ts` patches the `cs` slot to Tahoma, so the fault only ever showed in the
preview. `defaultFontFor(lang)` now picks Tahoma for `ckb`/`ar` — the same font
`csFontFor()` writes into the export, so preview and file agree — and the wizard
offers a picker filtered by `fontsFor(lang)`.

**A manual `fontSize` override must go into `fitBlock({ fixed })`, never into
CSS.** `ov()` put the user's size on the slot *wrapper*, while `Pts`/`Prose` set
the auto-fitted size as an *inline style on the child* — and an inline style on
the child beats inheritance from the parent. The number changed and nothing
happened. With `fixed`, the chosen size is kept and `overflow` is still computed,
so the user is told when their choice does not fit.

**`fitBlock().overflow` is now rendered, not just returned.** It was computed
correctly and thrown away by every caller. The browser clipped the excess with
CSS, so the preview looked healthy and only PowerPoint showed the damage.
`.edit .over` marks it while editing.

**An empty image slot collapsed because `Slot` sits between `.media` and
`.imgBox`.** `.imgBox{height:100%}` against a wrapper of `height:auto` resolves to
`auto`. With an image present the image supplied the height, so the bug was
invisible exactly half the time. Fixed with `.split .media > *{height:100%}`.

**The empty image slot is an interactive form in edit mode** (`ImageAsk`), not a
dead `AI IMAGE` label. The prompt box is prefilled from the slide title, and the
two buttons reuse `fetchImage(mode, ask)` — the same path the panel uses. Do not
add a second image-fetching route.

### References and charts

**Every reference must have a URL a human can open.** `citeUrl()` builds
`https://doi.org/<doi>` first, because a DOI outlives the publisher's URLs, and
falls back to `url` then `openAccess`, rejecting anything that is not http(s).
A paper with no resolvable locator is dropped by `pack()` rather than shown — C6
says never invent a citation, and a real citation nobody can check fails the same
test in front of a lecturer. The refs slide renders the URL as a link; it used to
print only the bare domain (`doi.org`), which points nowhere.

**`meaningfulChart()` drops decorative charts.** A chart whose values are all
equal, or which has fewer than two points, or whose spread is under 2%, has no
shape to show — it is padding. The prompt forbids it; this is the safety net for
when the model does it anyway, and the slide falls back to text.

### Editor, export, styles

**`pptx.ts` reads `overrides` — it used not to, and that lost every canvas
edit.** The note below says `titleSlide()` ignores overrides; the truth was worse:
*nothing* in the exporter read them. A student retitled a slide on the canvas,
exported, and got the **old title** in the .pptx with no warning, because the
preview was right. `Ctx.ov` now carries `slide.overrides`, and `heading()`
honours `text`, `fontSize`, `fontFamily`, `color`, `rotate`, `x/y/w/h` and
`hidden`; `bullets()` and `para()` pass `fontSize` into `fitBlock({ fixed })` so
preview and file compute the same number. `check-export` asserts all of it.
Position overrides on non-title slots are still unimplemented — that is the one
remaining gap.

**C3 is enforced in three places, and the agent was the one that missed it.**
`pickTextProvider` covers the wizard and the `translate` tool checks itself, but
`edit_slide`/`add_slide` ran on whatever `agentProvider` the user picked — so a
Kurdish deck could have its slide text written by OpenAI. `Studio` now forces
`gemini` whenever `requiresGemini(deck.lang)`. C3 says "no user override"; that
includes the agent brain dropdown.

**Slide 1 is not editable on the canvas, deliberately.** `titleSlide()` in
`export/pptx.ts` reads no `overrides`, so a canvas edit would silently vanish
from the .pptx. Edit mode shows a `.titlelock` panel that opens the Settings tab.
Do not "fix" this without first teaching `titleSlide()` to honour overrides.

**A new design style needs no pptx work if it reuses existing `card` / `accent`
values** — `pptx.ts` switches on those enums, not on style ids. A *new* enum value
exports blank. `check-export.ts` asserts every style emits >20 KB of slide XML.

**Firebase header rules match the request path.** `"source": "/index.html"` does
not cover the home page — Firebase serves it as `/`. Both `/` and `**/*.html`.

**The CSP cannot drop `'unsafe-inline'` for scripts.** Next's static export emits
an inline bootstrap script and there is no way to nonce it on static hosting.
What the policy *does* buy is `script-src 'self'` — no third-party script can
load, which is the route by which an XSS would exfiltrate the API keys sitting in
`localStorage`. `'unsafe-eval'` is deliberately absent; the bundle contains no
`eval` or `new Function`, verified against `out/_next/static`. `connect-src` and
`img-src` stay open to `https:` because the user picks their own model provider
and Openverse serves images from dozens of hosts.

### Speakers

**`Speaker.from`/`to` are the numbers shown in the studio** — 1 is the title page.
The model writes only content slides, so `speakerBrief()` is the single place that
converts, via `contentStart` (3). Do not add a second representation.

**Distribute minutes cumulatively, never per-share.** Rounding each share
independently does not sum to the total: 17 slides / 4 people / 20 min gave 21.
`autoSplit()` rounds the running total and takes differences.

### Service worker and testing

**`caches.match()` rejects** when CacheStorage is unavailable (private browsing,
storage off, quota full). A rejected promise inside `respondWith()` fails the
request — *every asset*, blank page, no visible error. All cache access goes
through `safeOpen` / `safeMatch`. Do not remove them.

**`clients.claim()` stays.** Removing it was tried, measured, reverted.

**Blank headless screenshots are the harness, not the app.** Controlled test: new
build 2/6, *previous production build with none of the changes* 3/6. Do not debug
the app from that signal. Check for orphaned dev servers before blaming localhost.

**React ignores `input.value` set directly** — the value tracker suppresses the
event. UI tests must use the prototype's native setter, or a working colour
picker looks broken.

**`playwright-core` + installed Chrome** is how the UI has been driven (install,
run, uninstall). It found the minute-rounding drift and the dead title page that
unit tests missed.

### Mascot

**Background removal failed three ways** (colour filter ate the face screen; flood
fill stalled on JPEG ringing; synthetic checker desynced — real period 20.5 px).
The sprites are already cut. Normalised on **face-screen width**, the only
constant across sitting/jumping/standing poses. → README § 22.

---

## Working style that has paid off

Measure before concluding. Dump the OOXML, probe CORS with an explicit `Origin`,
count actual results, A/B against the previous build, drive the real UI. Several
confident hypotheses — mine and the owner's — have been disproven that way, and
two of my own "fixes" were reverted after measurement showed they did nothing.

When something is tried and rejected, **write it into the README with the
measurement**. That is what those sections are for.

---

## Open backlog

Verification gaps, in rough order of how much they matter:

- **The current prompts have never been run against a live model.** The project
  ships no key (C2). The thesis/coherence work (§ 24) and the content-quality work
  (§ 27) are asserted structurally by `check-core.ts` only. One generated deck read
  by a human is the missing step.
- **The agent crew has never run end to end.** Same cause — no key. Every stage is
  asserted structurally (48 checks in `check-core`), the whole pipeline typechecks
  and builds, but no deck has come out of it. Two things can only be measured live:
  whether 12–18 requests clear a free Gemini key's per-minute limit, and whether
  the per-section writers actually read better than the single call they replaced.
  The `crewOn` switch exists so the second question can be A/B'd on one topic.
- **Nothing since the licence fix has been deployed.** Script + speakers, both
  prompt rewrites, editor tools, six new styles, streaming, and now the whole
  bug-fix round (streaming URL, import validation, CSP, agent prompt) are all
  local. The streaming fix alone means every non-Gemini user is currently on a
  build where English decks fail outright.
- **The CSP has not been exercised in a real browser.** It is reasoned from the
  build output (no `eval`, one inline script) but not observed. Load the deployed
  page with the console open and check for CSP violations before trusting it.
- No exported deck has been opened in real PowerPoint.
- The Kurdish glyph check is per-machine, not per-deck.
- `Tahoma` is an educated choice, not byte-verified in the OOXML.
- `maxSteps = 12` is a hard stop for the studio agent.
- Prompt-injection filtering is pattern-based.
- `textBox()` hard-codes layout areas and can drift from the CSS.
- On a slide with an image slot but no image, the placeholder collapses to a thin
  strip. Pre-existing, affects every style equally.
