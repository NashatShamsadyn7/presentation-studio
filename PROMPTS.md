# Prompts

Everything the model is told, in one place, so it can be improved without
reading the code.

There are now **two build paths**, and which prompts run depends on which one the
student picked in the wizard.

**Fast path** (the switch marked خێرا) — three calls, unchanged:

```
1. OUTLINE   research.ts  suggestOutline()   →  the section list
2. SLIDES    generate.ts  buildPrompt()      →  the slides themselves
```

**Agent crew** (the default) — the outline prompt is the same, and the single
slide prompt is replaced by eight smaller ones, each doing one job. They are
listed in § 5, and they import the *same* rule blocks that `buildPrompt()` uses:
`QUALITY_RULES`, `WRITING_RULES`, `REJECT_RULES`, `NO_CHARTS` and
`SHAPE_CATALOGUE` all live in `src/lib/crew/rules.ts` and appear in both. Editing
a rule there changes both paths at once, which is the point — `check-core`
asserts each block appears in the fast prompt **and** in the section-writer
prompt, so they cannot drift.

**The disconnection problem is fixed in both prompts** — see § 0 for what changed
and why. This file stays the place to iterate: the meta-prompt in § 3 rewrites
whatever is currently live.

---

## 0. What changed, and why

The complaint was that slides did not connect to each other. The cause was
visible in the prompts: nothing asked for continuity. Every rule in the slide
prompt was mechanical — layout variety, image count, bullet length, which fields
to fill. And the outline prompt asked for N sections each with a title and a
one-sentence description, with no requirement that they form an argument.
Disconnection started there and the slide prompt inherited it.

| Change | Where | Why |
|---|---|---|
| The model writes a **`thesis` first**, before any slide | slide prompt + JSON schema | A model generates in order. A claim written first conditions every slide after it. Written last it would be a summary and change nothing — hence `propertyOrdering: ['thesis','slides']`. |
| Each slide must **depend on the previous one**, and say each thing once | slide prompt | The two failures the user actually saw: no thread, and the same point restated. |
| Outline `hint` must say what a section **establishes and sets up next** | outline prompt | Same field, different demand. No JSON change needed. |
| "Shuffling the sections should visibly break the presentation" | outline prompt | A testable instruction beats "be coherent". |
| **Subject-specific standards** for six field groups, plus a fallback | both, via `domains.ts` | A deck on cinema was being built like a deck on civil engineering. |
| **Recency**: current figures, developments from the last two years | outline prompt, when search is on | Years are computed from the clock, not hardcoded. |
| Titles state a finding; figures beat adjectives; every bullet survives "so what?" | slide prompt | Slide craft the old prompt never mentioned. |
| Layout variety **reframed as a consequence**, floor scaled by deck length | slide prompt | See below — this rule was doing harm. |
| `L_divider` offered, but only for decks of 12+ | slide prompt | Dividers count toward N; on a short deck they eat content. |
| **Rejection criteria** — six checkable tests a slide must fail before it ships | slide prompt, before "CHOOSING A LAYOUT" | See below. |
| **Retrieved material now reaches the slide prompt** — papers with abstracts, plus live web sources | slide prompt, first block | The single biggest cause of weak content. See below. |

### The app researched twice and wrote from neither

This is the one that mattered. Trace the old pipeline:

1. `suggestOutline` searched the live web via Google Grounding and returned
   `{ items, sources }`. `Wizard` did `setOutline(r.items)` — **`r.sources` was
   discarded on the same line.**
2. `findReferences` queried OpenAlex, Crossref and DOAJ and returned real papers,
   each carrying up to 600 characters of abstract. It was called **after**
   `generateSlides` had already finished, and `toReference()` dropped the
   abstract anyway.

So the deck was written entirely from the model's parametric memory, while the
prompt was insisting:

> **NAME THINGS.** Real systems, tools, companies, people, versions, years.
> Never state a statistic you did not retrieve.

The model had nothing to name from and nothing it had retrieved. Its only two
options were to invent (forbidden) or to generalise. **Generalising is the
weakness users were seeing**, and no amount of prompt rewriting could have fixed
it, because the fault was in the order of operations, not the wording.

Now `findResearch()` runs **before** generation and returns both faces of the
result — `refs` for the references page and `papers` (with abstracts) for the
prompt. `researchPack()` renders them through `sanitize.envelope()`, because an
abstract is text fetched from the open web and must arrive as data, never as
instruction. The block is placed **first in the prompt**, for the same reason
`thesis` is ordered before `slides`: a model conditions everything it writes on
what it read earliest.

The instructions attached to the pack are as important as the pack:
attribute to the author and year actually shown; the abstracts carry findings and
a finding beats a definition; do not write a second reference list; and ignore a
record that is off-topic rather than forcing it into the argument.

Cost is unchanged — the same two searches happen, in a different order.

### Saying what a bad slide looks like, not only a good one

Everything above tells the model what to aim at. Nothing told it what to refuse.
That asymmetry matters because the two are not equally enforceable: "a title
states the finding" is a stylistic wish, while "a title that names a subject
instead of a finding is rejected" is a test the model can run on its own output
before emitting it.

The six criteria are deliberately mechanical — no name/number/year anywhere on
the slide; a comparison table whose cells are all adjectives; a bullet that only
defines what the next bullet uses; content already covered in different words; a
statistic the model is not confident in. Each restates an existing rule as
something checkable rather than something to admire.

Placed **before** `CHOOSING A LAYOUT` on purpose: the content must survive the
rejection pass before a layout is chosen for it, otherwise the model picks a
shape and then defends the weak content that fills it.

### The layout-variety rule was working against coherence

The old rule was *"VARY the layouts … use at least six different layouts across
the deck."* On a 6-slide deck that demands a different layout every single time,
and the way a model satisfies it is to pick an unused layout and then invent
content that fits it. That is precisely how a deck stops being an argument.

It now reads: content this varied will use several layouts by itself, with a
floor that scales — `min(6, max(3, round(N/2)))`, so 3 for six slides, 5 for ten,
6 for twenty. The image floor is untouched, because that one exists for a
measured reason (1 deck in 11 came out entirely text).

### Not yet verified against a live model

### Outlines were long sentences; they should be one-to-three-word labels

The owner supplied a reference file — `…\see\see .docx`, 100 real university
outlines — and the gap was immediate:

```
Artificial Intelligence   Introduction · History · How AI Works · Types ·
                          Applications · Risks · Future
Chemical Bonding          Atoms · Ionic Bonds · Covalent Bonds · Metallic Bonds ·
                          Polarity · Structure
```

The prompt was asking for *"a short section heading, at most 6 words"* and then
illustrating a good `hint` with **"the three properties that let it scale
horizontally, and the consistency it gives up to get them"** — a 20-word example
of what "specific" means. Between a 6-word ceiling and a 20-word model of good
writing, the model produced headings like *"Understanding the Fundamental
Principles of Chemical Bonding"*. The prompt was getting exactly what it asked
for.

**But the more important half of that file is its second half**, which is written
to the developer, not the model:

> *make the 100 examples different in presentation **structure**, not just
> different topics … it tests whether the AI can change its outline structure
> according to the subject instead of using the same generic
> Introduction → Body → Conclusion template for everything.*

That is a different axis from `domains.ts`. `DOMAIN_RULES` says what a good
*claim* looks like per field (engineering wants quantities, film wants one work
read closely). It says nothing about the **shape of the sequence** — and the same
subject takes a different shape depending on what the presenter is doing with it.

So the prompt now opens by choosing an archetype, with a worked example of each,
taken from that file:

| Archetype | Skeleton |
|---|---|
| Mechanism | Introduction · History · How It Works · Types · Applications · Risks · Future |
| Structure | Anatomy · Blood Flow · Electrical System · Diseases · Diagnosis · Prevention |
| Problem-driven | Problem · Traditional Cars · EV Concept · Battery · Motor · Charging · Comparison |
| Law or theory | Historical Context · First Law · Example · Second Law · Formula · Applications |
| Narrative | Before · Causes · Beginning · Major Inventions · Society · Economy · Long-Term Effects |
| Case study | Background · Problem · Business Model · Technology · Growth · Competition · Lessons |
| Research report | Research Question · Methodology · Data · Analysis · Findings · Limitations |
| Experiment | Question · Hypothesis · Equipment · Procedure · Variables · Data · Graph · Errors |

The examples carry a second lesson without being told: Chemical Bonding gives
each bond type its own section instead of one "Types of Bonds" holding all three.
Splitting is what makes a deck teachable, so the prompt names that too.

`shortTitle()` enforces the heading rule in code — leading verbs stripped,
everything after a colon dropped, hard cap of four words — and `tidyOutline()`
runs it on all three return paths, caps hints at 25 words and removes duplicate
sections. A checkable rule is obeyed where a stylistic wish is not; that is the
same reasoning as the rejection criteria in the slide prompt.

### The outline search was searching in the wrong language

`suggestOutline` put the topic into the prompt verbatim and let Gemini's
grounding search from it. For a topic written as «کاریگەری AI لەسەر پەروەردە»
that means searching the web in Kurdish — which returns almost nothing for most
academic subjects, so the "grounded" outline was grounded in five weak pages or
in nothing at all.

The project already knew this. `findReferences` runs `englishQuery()` before it
touches a database, with the comment *"a Kurdish/Arabic topic returns nothing on
its own — it must be converted"*. The lesson was learned on one path and never
carried to the other. And because C3 forces Gemini — and therefore search — for
`ckb` and `ar`, the users this app exists for were the ones getting the worst
search.

Three changes:

| | Was | Now |
|---|---|---|
| Query language | the raw Kurdish/Arabic topic | `englishQuery()` first, and the prompt says **SEARCH IN ENGLISH**, read English sources, write the outline in the deck language |
| Fallback prompt | the *same* prompt, search instructions and all, run without a search tool — so the model was told to report "current figures from 2026" with no way to look | `outlinePrompt({ search })` builds a genuinely different prompt with no search instructions |
| Failed JSON | discarded the entire search and restarted cold, silently | the searched text is passed into a schema-constrained second call as material, wrapped in `envelope()`; `grounded` reports the truth and the wizard says so |

Temperature dropped `0.8 → 0.6`: an outline is a structural task, not a creative one.

### Four smaller changes in the same direction

| Change | Was | Now |
|---|---|---|
| Slide-call temperature | `0.85` | `0.65` — high temperature buys variety, and this content has to be checkable. Compare translation at `0.3`, search-phrase extraction at `0`. |
| Outline length | `min(10, max(4, N/1.5))` | `min(12, max(5, N/1.25))` — a 12-slide deck got 8 one-sentence hints and had to invent the rest. That invented remainder is the generic part. |
| Extra slides trimmed | `slice(0, want)` | keeps the **last** slide. The prompt demands a closing slide ("what it costs, what is still unresolved") and trimming from the end deleted exactly that, leaving the deck stopping mid-argument. |
| Padded slides | silent | counted and reported. A slide the model never produced is filled from the outline hint, which is guaranteed weak; the wizard now says so instead of passing it off as generated content. |

### What was NOT changed, deliberately

The default model stays `gemini-3.6-flash`. A flash-tier model is a real ceiling
on content depth, and `gemini-2.5-pro` is in the catalogue — but it is marked
paid-plan, and C2 means every user brings their own key, most of them on the free
tier. Forcing a paid model on a student in Kurdistan to fix a quality complaint is
the wrong trade. Users who have a paid key can already select Pro in Settings.

The prompts are asserted structurally by 35 checks in `check-core.ts`, and the
whole suite passes. They have **not** been run against a real Gemini call — the
project ships no key (C2) and none was available. Generate one deck and judge the
result.

### The agent's system prompt is documented in the code, not here

`systemPrompt()` in `src/lib/agent.ts` is a third prompt, and it is not
reproduced in this file — it is generated per deck (title, slide count, language,
style, speakers are interpolated), so a static copy would drift immediately. The
comment above the function carries the reasoning for each block; `check-core.ts`
asserts the parts that must never disappear, in particular the
`UNTRUSTED DATA` contract, which is the model-side half of the injection defence
that `sanitize.ts` implements on the data side.

---

## 1. Outline prompt (`src/lib/research.ts`)

Placeholders in `${...}` are filled at runtime.

```
You are preparing an academic university presentation on: "${topic}"

${RESEARCH_RULES — only when web search is on}

Search the web before you write. Go for what is true NOW, not the framing a
model reaches for by default: current figures, developments from ${year-1}
and ${year}, findings and debates that are still live. Where the field moves
fast, a ${year-1} source beats a ${year-11} one that says the same thing.
Where the foundations are old and settled, say so plainly instead of dressing
them up as new.

An outline is not a list of subtopics. It is the order in which one claim gets
established. Decide what this presentation will argue, then lay out the
${count} steps that carry an audience to it.

Each section needs:
  - "title": a short section heading, at most 6 words
  - "hint":  one sentence saying what this section ESTABLISHES, and what it
             makes possible for the section after it — not merely what it is
             "about"

Hold yourself to this:
- The first section sets up the problem or the stake, so the audience knows why
  any of the detail matters before it arrives.
- Every section after it DEPENDS on the one before. Shuffling the order should
  visibly break the presentation. If it would not, the sections are a list, not
  an argument — rewrite them.
- The last section closes: what now follows, what it costs, what is still open.
- No section covers ground an earlier one already covered.

${DOMAIN_RULES  — the shared subject-standards block, see src/lib/domains.ts}

Write the "title" and "hint" values in ${langName}.

Return ONLY valid JSON in this exact shape, with no commentary and no markdown fence:
{"outline":[{"title":"...","hint":"..."}]}
```

`RESEARCH_RULES` is the banned-source list: Wikipedia, Quora, Reddit, Medium,
blogs, SlideShare, Chegg, W3Schools, GeeksforGeeks, TutorialsPoint, Studocu,
Scribd, CourseHero.

---

## 2. Slide prompt (`src/lib/generate.ts`)

Rendered below with real values — topic "The French New Wave", Kurdish Sorani,
14 content slides, normal density, no script, one presenter. The script block
appears only when the student pasted one, the speaker block only when several
students present, and the `L_divider` paragraph only from 12 slides up.

```
You are designing an academic university presentation on: "The French New Wave"

The agreed outline is:
1. Origins — Cahiers du Cinema and the politique des auteurs

Produce exactly 14 content slides.

── THE DECK ARGUES ONE THING ──
Before you write a single slide, settle what this presentation exists to
establish, and write it as "thesis": one sentence, specific enough that someone
could disagree with it. A topic restated is not a thesis.

  thesis:  "5G's sub-millisecond latency makes remote surgery clinically
            viable, but only inside the coverage limits of millimetre wave."
  not:     "5G technology in healthcare."

Then build a line of reasoning that arrives there:

- The FIRST slide sets up the problem or the stake. A room full of people has
  to know why this matters before any detail reaches them.
- Every MIDDLE slide moves the argument one step and DEPENDS on the slide
  before it. Someone who skipped the previous slide should feel the gap.
- The LAST slide closes it: what now follows, what it costs, what is still
  unresolved.
- Say each thing ONCE. A point already made is not made again later in
  different words. This is the most common way these decks fail.
- Before writing each slide, name to yourself what it adds that no earlier
  slide has. If there is no answer, that slide is filler — replace it with the
  step the argument is actually missing.

── THE SUBJECT DECIDES WHAT A GOOD SLIDE IS ──
Work out which field this topic belongs to, and hold the whole deck to that
field's standard:

  engineering · computing · physical sciences
      Mechanism and architecture, trade-offs stated as quantities, one worked
      example carried through, and the limits — where it fails, what it costs,
      what it cannot do. A claim with no number in it is weak here.

  medicine · biology · health
      Mechanism first, then the evidence and how strong it actually is (study
      type, size, population), the effect on a real patient, current clinical
      guidance, and the risks and contraindications. Never present a finding as
      settled when it is contested.

  film · literature · art · music · media
      The movement and its period, the technique that defines it, ONE named
      work read closely rather than five mentioned in passing, its influence on
      what came after, and how it was received at the time versus now.

  business · economics · law · policy
      The forces at work, figures over time rather than a single snapshot, one
      real case examined properly, the risk, and what a decision-maker actually
      does differently because of this.

  history · geography · social sciences
      Causes and consequences, who the actors were, dated evidence, where
      historians or researchers disagree, and why the question still matters.

If the topic sits in none of these, or straddles two, ask what a specialist in
that field would insist a student include — and include it.

── HOW TO WRITE THEM ──
- A title states the finding, not the subject. "Latency falls to 1 ms" earns
  its place; "Latency" does not. (L_divider, L_quote and L_def are exempt —
  they name a section, carry a quotation, or introduce a term.)
- Prefer a figure to an adjective. "10 Gbit/s" not "very fast". "in 43% of
  cases" not "often". "since 2019" not "recently".
- Every bullet must survive the question "so what?". A bullet that only defines
  or labels something belongs folded into the bullet that uses it.

── BEFORE YOU EMIT A SLIDE, REJECT IT IF ──
The rules above say what a good slide is. These say what a bad one looks like,
because a checkable test is obeyed where a stylistic wish is not. Any slide that
matches one of these is rejected and rewritten BEFORE it goes into the output —
you do not ship it and apologise later:

- Its title names a subject instead of stating a finding, outside the three
  exempt layouts (L_divider, L_quote, L_def). "Advantages" is a reject.
  "Writes scale linearly to 40 nodes" is not.
- It contains no name, no number, no year and no named example — nothing a reader
  could look up or check.
- Every cell of its table or comparison is an adjective ("fast", "good",
  "flexible") rather than a value, a figure, a name or a year.
- One of its bullets is a definition or a label that the next bullet then uses.
  Fold them into one.
- Its content already appeared on an earlier slide in different words, and it is
  not the drilling-into-a-list case described above.
- It claims a statistic, a percentage or a date you are not actually confident
  in. Drop the claim or make the caption say it is illustrative — never round an
  invented figure to make it look researched.

── CHOOSING A LAYOUT ──
The shape of the content picks the layout — never the wish for variety. Two
things being weighed is L_two. A process is L_steps or L_flow. A number that
carries weight is L_kpi. A trend over time is L_line. Reaching for a layout you
have not used yet and then inventing content to fill it is the fastest way to
break the argument.

L_bullets   — heading + 2-4 bullet points + one image on the right
L_bulletsL  — same, image on the left
L_text      — heading + one lead sentence + one flowing paragraph
L_bar       — heading + vertical bar chart (needs chart data)
L_line      — heading + line chart showing a trend (needs chart data)
L_donut     — heading + donut chart + 2-4 bullets explaining the slices
L_hero      — full-bleed image with a heading and one paragraph on top
L_two       — heading + exactly 2 comparison columns (2 bullets, "Label: text")
L_three     — heading + exactly 3 numbered cards (3 bullets, "Label: text")
L_steps     — heading + exactly 4 sequential steps (needs steps)
L_cycle     — heading + 4 stages arranged in a repeating circle (needs steps)
L_flow      — heading + 4 boxes in a left-to-right process chain (needs steps)
L_time      — heading + 4 dated milestones (needs timeline)
L_table     — heading + a data table (needs table)
L_compare   — heading + feature matrix where cells are "yes"/"no" (needs table)
L_kpi       — heading + exactly 3 large headline figures (needs kpis)
L_progress  — heading + 4 labelled percentage bars (needs chart, values 0-100)
L_quote     — a single memorable quotation with attribution (needs quote)
L_state     — one short powerful sentence, nothing else (needs body)
L_def       — a term, its pronunciation line, and its definition (needs body)
L_code      — heading + a short code block or formula (needs body)
L_proscons  — heading + strengths list and weaknesses list (needs pros and cons)
L_pyramid   — heading + exactly 3 bullets, ordered top (narrow) to bottom (wide)
L_venn      — heading + exactly 2 bullets representing two overlapping sets
L_icons     — heading + exactly 6 short cards (6 bullets, "Label: text")
L_grid      — heading + a grid of 4 images
L_ba        — heading + exactly 2 bullets: before then after
L_divider   — a section break, title only

You may spend up to 2 slides on L_divider to mark where a new part of the
argument begins. They count toward the 14.

Rules:
- Content this varied will use several layouts by itself. As a floor: at least
  6 different layouts across the deck, and never the same one three
  times running.
- A presentation of only text is a bad presentation. At least 5
  of the 14 slides MUST use a layout that shows a picture — L_bullets,
  L_bulletsL, or L_hero — and each of those MUST include an "imagePrompt".
- Only fill the fields that the chosen layout actually needs. Leave the rest out.
- Bullets that describe a labelled idea must use the form "Label: explanation".
- For chart slides invent plausible, clearly-labelled illustrative figures and say so
  in the caption. For L_progress every value must be between 0 and 100.
- L_compare table cells must contain only "yes" or "no".
- LENGTH: Each bullet is one complete sentence of 10-18 words.
  Give each ordinary content slide 3-5 bullets. Layouts that
  demand an exact count (L_two, L_three, L_steps, L_icons, L_venn, L_pyramid, L_ba)
  keep their own count — that rule wins over this one.
  Every bullet on a slide should be roughly the same length as its neighbours; one
  long bullet next to three short ones makes the slide look broken.
- For every slide that shows an image, add "imagePrompt": a short English description
  of a clean, professional, academic illustration. Never put words or letters in the image.
- Write ALL visible text (titles, bullets, body, captions, labels) in Kurdish Sorani (کوردی سۆرانی), written right-to-left in the Arabic script,
  and the "thesis" in Kurdish Sorani (کوردی سۆرانی), written right-to-left in the Arabic script too.
  Keep technical terms, formulas, and code identifiers in their original form.
- Never invent a citation, author, DOI, or year.

Return ONLY valid JSON, no markdown fence. "thesis" comes first:
{"thesis":"...","slides":[{"layout":"L_bullets","title":"...","bullets":["..."]}]}
```

---

## 3. Meta-prompt — ask an AI to rewrite both

Paste sections 1 and 2 above where marked.

```
You are a prompt engineer. I am going to give you two prompts from a working
product and ask you to rewrite them so the output is better. Read all the
constraints before you write anything.

=== THE PRODUCT ===

A browser-only AI presentation generator for university students in the
Kurdistan Region of Iraq. The user types a topic, optionally pastes the script
they will actually speak, and gets an editable deck they export as .pptx and
present in class. Output language is Kurdish Sorani, Arabic, or English. The
reader is a lecturer marking an academic assignment.

There is no backend. The prompt is sent from the browser straight to the model,
and the JSON that comes back is rendered as slides. One call produces the whole
deck — there is no second pass to fix things afterwards.

=== THE PROBLEM I WANT FIXED ===

The slides do not connect to each other. Each one is a reasonable slide about
the topic in isolation, but read in sequence they do not build an argument.
Points get restated. There is no thread from the first slide to the last. It
reads like a pile of facts, not a presentation.

Neither prompt currently asks for continuity at all. That is the primary thing
to fix.

=== THE TWO PROMPTS ===

--- OUTLINE PROMPT ---
[[PASTE SECTION 1 HERE]]

--- SLIDE PROMPT ---
[[PASTE SECTION 2 HERE]]

=== WHAT YOU MAY NOT CHANGE ===

These are load-bearing. Break any one and the product stops working.

1. The JSON contract. Both prompts must still end by demanding exactly the same
   JSON shape, with no markdown fence. Do not rename, add, or remove a field.
   The parser is strict.
2. The layout catalogue. The layout IDs (L_bullets, L_kpi, L_steps, ...) and
   what each one needs are fixed by the rendering code. You may change how you
   describe them or how you tell the model to choose between them. You may not
   invent a layout or change what a layout requires.
3. "Produce exactly N content slides" must survive. The user picked N.
4. All visible text in the requested language, with technical terms, formulas
   and code identifiers left in their original form.
5. "Never invent a citation, author, DOI, or year." References come from real
   bibliographic databases elsewhere in the app. The model must never produce
   one.
6. Wikipedia is banned as a source, along with Quora, Reddit, Medium, blogs,
   SlideShare, Chegg, W3Schools, GeeksforGeeks, TutorialsPoint, Studocu,
   Scribd and CourseHero.
7. The script-handling block, when a script is supplied: follow its order,
   cover every substantive point, fill gaps from your own knowledge, and the
   script wins over the outline.
8. The speaker-allocation block, when several students present.

=== WHAT I WANT YOU TO ADD ===

A. CONTINUITY — the main goal.
   Make the deck read as one argument. Consider: a stated through-line that the
   whole deck serves; each slide advancing from the previous rather than
   restarting; an explicit opening, development and close; no point made twice;
   handovers between sections a speaker could actually say out loud. Decide for
   yourself what mechanism enforces this best inside a single generation call —
   remember there is no second pass.

B. DOMAIN ADAPTATION.
   A deck about cinema should not be built like a deck about civil engineering.
   Make the prompt infer the subject area from the topic and adapt what a good
   slide looks like for it. As illustrations, not a closed list:
     technology / engineering  — architecture, trade-offs, measured figures,
                                 a worked example, limits and failure modes
     medicine / health         — mechanism, evidence and its strength, patient
                                 impact, guidelines, contraindications
     cinema / arts             — movement and period, technique, one named work
                                 analysed closely, influence, reception
     business / economics      — market forces, figures over time, a case,
                                 risk, what a decision-maker does with it
   Write it so an unlisted subject is handled sensibly too.

C. RECENCY.
   Where the outline prompt has web search available, make it pull genuinely
   current material — this year's developments, current figures, recent
   findings — instead of the textbook framing a model reaches for by default.
   Say how recent is recent. Keep the banned-source rule intact.

D. SLIDE CRAFT.
   Titles that state a claim rather than name a topic. Concrete numbers instead
   of vague quantifiers. No filler. Whatever else you know raises the quality of
   a slide a lecturer will grade.

=== HOW TO ANSWER ===

Give me the two rewritten prompts in full, ready to paste, with runtime
placeholders in ${...} kept exactly as they are. After each, list in three or
four lines what you changed and why. Do not explain prompt engineering to me in
general.
```

---

## 4. Where the result goes

| Prompt | File | Function |
|---|---|---|
| Outline | `src/lib/research.ts` | `suggestOutline()` |
| Slides | `src/lib/generate.ts` | `buildPrompt()` |

After editing, run `npm run check`. `check-core.ts` asserts that the slide
prompt still carries the script fence, the speaker allocation, the exact slide
count, and the "never invent a citation" rule — so a rewrite that quietly drops
one of them fails before it reaches a student.

---

## 5. The agent crew (`src/lib/crew/`)

Eight prompts, in the order they run. Two of them (`editor`, `polish`) are
conditional and cost nothing when there is nothing to fix.

| # | File | Function | Sends | Asks for |
|---|---|---|---|---|
| 1 | `architect.ts` | `architect()` | topic, outline, web sources, script | thesis · deck kind · angle |
| 2 | `linker.ts` | `linker()` | thesis, outline | per section: establishes · dependsOn · covers · weight |
| 3 | `librarian.ts` | `sectionQueries()` | section titles + covers | one English search phrase per section |
| 4 | `writer.ts` | `sectionPrompt()` | thesis, brief, ledger, that section's sources, all shared rules | the slides of that section |
| 5 | `editor.ts` | `editor()` | only the slide pairs a word-overlap check flagged | different / drilling / repeat, plus a rewrite |
| 6 | `curator.ts` | `curator()` | every title with its section | only the titles that are broken |
| 7 | `visual.ts` | `visual()` | every title, shape and first two bullets | which slides get a picture, and the search phrase |
| 8 | `critic.ts` | `critic()` | the whole deck + `verify()` defects + image status | up to 8 problems, each with what to do |
| 9 | `polish.ts` | `polish()` | only the flagged slides + their notes | those slides, rewritten |

### 5.1 The three that carry the most weight

**`linker` — where duplication is actually prevented.** It writes `covers`: 3–6
specific points each section owns. The prompt is explicit that ownership is
exclusive:

> Every point in the deck belongs to exactly ONE section. Before you write a
> point here, check that no earlier section already claims it. […] Overlap here
> becomes a repeated slide later, and a repeated slide is the failure a marker
> notices first.

It also asks that nothing fall *between* sections — read end to end, the `covers`
lists must be the whole deck.

`avoid` is not asked for. It is computed as the union of the other sections'
`covers`, after `ownClaims()` has made ownership exclusive. See README § 28.4 for
why that must be code and not a prompt.

**`writer` — one section, with everything the deck already said.** The prompt is
assembled as: thesis and angle → `ledger()` → `briefPack()` → `sourcePack()` →
the shared rule blocks → shape catalogue → length and language. The ledger block
is blunt on purpose:

> If a point you were about to make appears above, it is TAKEN. Either go a level
> deeper on it — a mechanism, a figure, a named case the earlier slide did not
> have — or drop it and use the room for something the deck is still missing.

**`critic` — reports, never rewrites.** Asked to find problems and fix them in
one response, a model writes the fix first and reverse-engineers a problem to
match, because it generates in sequence. Splitting them means the critic's answer
cannot change anything, so it has nothing to justify. Its list is capped at 8:

> More than 8 items. If everything is a problem, nothing is — pick the ones that
> actually matter.

### 5.2 Editing them

Same rule as § 3: change the shared blocks in `crew/rules.ts` and both paths
follow. Change a stage prompt in its own file and only that stage changes. After
either, run `npm run check` — `check-core` asserts the ledger, the section
contract, the slide count, the language and every shared rule reach the writer's
prompt, so a rewrite that drops one fails before a student sees it.
