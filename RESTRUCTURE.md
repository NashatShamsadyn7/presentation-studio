# Restructure: research + content + design → one pipeline

Merging parts 2 (research), 3 (content), 4 (design) — 7,577 lines — into a single
module with one spine. Written because the three parts do not currently share a
data model, so nothing in them can be linked to anything else.

Read `CLAUDE.md` first. Every hard constraint (C1–C9) still holds.

---

## 1. Diagnosis — measured, not guessed

Three complaints, three root causes. Each is in the *type definitions*, not in the
prompts, which is why prompt edits have not fixed them.

### "not have real link"

Nothing in the model has an identity.

```ts
interface Slide {          // types.ts:125
  id: string;
  layout: LayoutId;
  title: string;
  bullets: string[];       // ← a bullet is a STRING
  refs?: Reference[];      // ← on ONE slide, the references page
}

interface Reference {      // types.ts:44
  text: string;            // ← no id
  url?: string;
}
```

- A bullet is a plain string. It **cannot** carry a source, because a string has
  no fields.
- `Slide` has **no `section`**. The generator asks the model for one
  (`RawSlide.section`), uses it once to compute `uncovered`, and throws it away.
  After generation the deck does not know which outline section a slide belongs to.
- `Reference` has no id, so nothing can point at it.

The outline, the slides and the references are three lists that never reference
each other. There is no link to fix — there is no link to begin with.

### "ugly / overwrite / overloading / empty"

**The model picks the layout before it knows how much text there will be.**

`layout: 'L_kpi'` is emitted by the model. `fit.ts` measures afterwards and can
only shrink the font. So:

- too much text → overflow, or a font small enough to be unreadable
- too little → an empty slot
- an image layout with no image → the grey box in the screenshots

A model cannot measure pixels. Code can. The decision is on the wrong side.

### "all things in my agent are bad"

The agent has 16 tools that write **straight into the deck**, bypassing every rule
`generate.ts` enforces. `edit_slide` will happily put 400 characters into an
`L_kpi`. `set_layout` will pick a layout with no data for it. The agent is a
second, worse path into the same deck.

---

## 2. The spine

One module, `src/lib/deck/`. Everything carries an id, so everything can be linked.

```ts
type Id = string;

/** Retrieved, never invented (C6). The only place a citation may come from. */
interface Source {
  id: Id;                       // "s3"
  kind: 'paper' | 'web' | 'book' | 'data';
  title: string;
  authors: string[];
  year?: number;
  doi?: string; url?: string; venue?: string;
  abstract?: string;            // the part with findings in it
}

interface Section {
  id: Id;                       // "sec2"
  title: string;                // ≤ 4 words — shortTitle() already enforces this
  hint: string;
  sources: Id[];                // which retrieved sources cover this section
}

/** One claim. Replaces `bullets: string[]`. */
interface Point {
  text: string;
  sources: Id[];                // [] = general knowledge, allowed and normal
  figure?: string;              // "43%", "2019", "10 Gbit/s" — the checkable part
}

interface SlidePlan {
  id: Id;
  section: Id;                  // ← a real link, not a discarded number
  adds: string;                 // what this slide adds that no other slide does
  shape: Shape;                 // semantic — NOT a layout id
  points: Point[];
  wantsImage: boolean;
}
```

### `Shape` — the change that fixes the visual failures

The model never names a layout again. It names what the content **is**:

```
statement · list · compare2 · compareN · process · timeline
figures · quote · definition · data · breakdown · example
```

Then code picks the layout by **measuring**:

```ts
pickLayout(shape, points, hasImage, density, lang): LayoutId
```

| Situation | Result |
|---|---|
| `compare2`, both sides short | `L_two` |
| `compare2`, 3+ rows of values | `L_table` |
| `list` of 6 short items | `L_icons` |
| `list` of 3 | `L_three` |
| `process` of 4 | `L_steps` |
| `wantsImage` but no image resolved | falls to the text sibling — **never an empty box** |
| content exceeds the best layout | split into two slides, or move to a roomier one |

Overflow is checked **before** the layout is chosen, not patched after. This one
inversion removes ugly, overwrite, overloading and empty at the source, because
the decision moves from something that cannot measure to something that can.

---

## 3. The pipeline — 5 stages, and still only 2–3 model calls

**Hard constraint:** the call count must not rise. The free Gemini tier rate-limits
per minute and the owner already hits 429 (see `net.ts` › `retryDelayMs`). Extra
stages must be free.

| Stage | Model calls | Output |
|---|---|---|
| **A · Retrieve** | 0–1 (English query only) | `Source[]` with ids — OpenAlex, Crossref, DOAJ, grounded search |
| **B · Outline** | 1 (grounded) | `Section[]`, each with `sources: Id[]` — the model sees the source list *with its ids* and must attach them |
| **C · Write** | 1 (streamed) | `thesis` → `plan` → `slides`, in that field order |
| **D · Compose** | 0 | `pickLayout()` per slide, split/merge to the exact count, resolve images |
| **E · Verify** | 0 | a defect list, shown to the student |

Stage C's field ordering is the same trick that already works for `thesis`
(`SLIDES_SCHEMA.propertyOrdering`): a model generates in sequence, so `plan`
written **before** `slides` designs the deck before writing it. Written after, it
would be a summary that changes nothing.

### Stage E — the checks

Every one is mechanical. No model, no judgement, runs offline in tests.

1. Every `Section` has ≥ 1 slide.
2. Every `slide.section` resolves to a real `Section.id`.
3. Every `point.sources[]` entry resolves to a real `Source.id`
   — **this makes an invented citation structurally impossible**, which is C6
   enforced by types instead of by asking the model nicely.
4. Every `point.figure` has a source, or the slide is marked illustrative.
5. No two slides share ≥ 70% of their tokens.
6. No overflow. No empty slot.
7. The references page lists **only** cited sources, and **all** of them.

Check 7 is the answer to "references be better": the references page stops being a
separate list that a model writes. It becomes a **projection** of the sources the
deck actually used, ordered by first appearance. A reference nobody cited cannot
appear; a citation with no reference cannot happen.

---

## 4. Per-slide citations

`Point.sources` renders as a small marker after the claim. Numbering comes from
order of first use across the deck. Clicking one in the studio jumps to that entry
on the references page. In PPTX it exports as real text, never an image (C9).

This is what "each slide have links" means concretely: the claim, the section it
serves, and the paper it came from are one chain, and every link in it is checked
by stage E.

---

## 5. The agent, rebuilt on the same path

The rule: **the agent may not reach the deck except through stages D and E.**

| Now | After |
|---|---|
| `set_layout` | deleted — stage D owns layout |
| `fix_overflow` | deleted — cannot overflow any more |
| `add_icon`, `set_theme` | moved to direct UI controls, not agent tools |
| `edit_slide(text)` | `revise_points(slideId, Point[])` — typed, re-verified |
| `add_slide(layout)` | `add_slide(sectionId, adds, shape)` |
| `set_references` | deleted — references are a projection, not a settable list |
| `search_web`, `find_papers` | `retrieve(query)` — appends to `Source[]`, ids and all |

16 tools → 8. Every mutation re-runs `compose()` + `verify()`. The agent then
*cannot* produce a slide the pipeline would not have produced. That is the fix —
not a better prompt.

---

## 6. UI

- **Template and colour become `<select>` dropdowns** with one live preview beside
  them, replacing the 30-card gallery (6 styles × 24 themes, each a live
  `SlideView` at 1920×1080). Smaller, faster, and usable on a phone.
- The stage-E defect list is shown as a checklist the student can act on, instead
  of the deck silently shipping with gaps.

---

## 7. Phases

Each phase ships on its own and is testable offline. Nothing is a big-bang rewrite.

| # | Phase | Ships | Risk |
|---|---|---|---|
| **0** | ✅ New types beside the old ones | `Slide.section`, `Reference.id`, `Point`, `Source` | done |
| **1** | ✅ **Compose + Verify** | overflow, empty slots and gaps stop | done |
| **2** | ✅ `Shape` replaces `layout` in the schema | the model no longer picks visuals | done |
| **3** | ✅ Source ids; per-slide citations; references as a projection | claim → paper is one chain | done |
| **4** | ✅ Agent rebuilt onto `settle()` | 2nd path into the deck deleted | done |
| **5** | ✅ Dropdowns + live health panel | 30 cards → 2 selects + 1 preview | done |

**Phase 1 was done first, deliberately** — the only phase that improves what the
owner sees without touching a prompt, which de-risked everything after it.

### What the phases actually changed

| Before | After |
|---|---|
| model wrote `"layout":"L_kpi"` | model writes `"shape":"figures"`; layout is measured |
| `Slide.section` discarded after one use | kept; `verify` checks every link resolves |
| references = every record found | references = only what a slide cited, in order of use |
| a citation was a string in a bullet | `Slide.cites: Id[]`, filtered against retrieved ids |
| agent had `set_layout` + its own measurer | agent has `set_shape`; every edit re-runs `compose()` |
| 30 live preview cards | 2 dropdowns + 1 live preview |
| deck shipped silently, complete or not | live health panel, click a defect to jump to the slide |

`check-core` went 651 → 766. Model call count is unchanged.

### The one real migration risk

`types.ts` changes touch `storage.ts` — decks already saved in the user's IndexedDB
have `bullets: string[]` and no ids. A version field and an upgrade path
(`bullets → Point[]` with empty `sources`) must land in **phase 0**, before
anything writes the new shape. Old decks must keep opening. This is the single
place where getting it wrong loses the user's work.

---

## 8. Settled scope

"Really working, not only making slides" was answered by the owner as: **the deck
comes out correct — no gaps, no overflow, no empty references.** That is what
phases 1, 3 and 5 deliver, and what `verify()` now enforces mechanically.

## 9. Not done, and deliberately so

**`bullets: string[]` is still a string array.** `Point` exists in `model.ts` and is
tested, but the renderer, both exporters, the agent and storage all read `bullets`.
Converting them is a large blast radius across the C9 surface, and slide-level
`cites` already delivers the linkage the owner asked for. Do that conversion as its
own phase, with the storage migration first.
