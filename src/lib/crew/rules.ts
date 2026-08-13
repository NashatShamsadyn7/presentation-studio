// ═══════════ یاسا هاوبەشەکانی نووسینی سلاید ═══════════
//
// ─── بۆچی ئەم فایلە هەیە ───
// ئێستا **دوو** ڕێڕەوی نووسین هەن:
//
//   ١) `generate.ts` › `buildPrompt()` — یەک بانگکردن بۆ هەموو دێککەکە
//   ٢) `crew/writer.ts`               — یەک بانگکردن بۆ هەر بەشێک
//
// یاساکانی «سلایدێکی باش چییە» بۆ هەردووکیان یەکن. ئەگەر لە دوو
// شوێندا بنووسرێن، دوای دوو دەستکاری جیاواز دەبنەوە — و ئەوە هەر
// ئەو کێشەیەیە کە پێشتر لەم پڕۆژەیەدا ڕوویدا: مرۆڤکەرەوەکە
// بەستەرە لۆژیکییەکانی دەسڕییەوە لە کاتێکدا پرۆمپتەکە داوای
// دەکردن. دوو بەش لە کۆدەکە دژی یەکتر کاریان دەکرد.
//
// بۆیە یاساکان **لێرەدان و تەنها لێرە**. هەردوو ڕێڕەو هێنانیان
// دەکەن، بۆیە ناتوانن جیا ببنەوە.
//
// ئاگاداری: دەقەکان بە وردی وەک خۆیان مانەوە کاتێک لە
// `buildPrompt` ـەوە هێنرانە ئێرە. `check-core` بەسەر دەرئەنجامی
// `buildPrompt` دا دەگەڕێت، بۆیە گۆڕینی یەک وشە لێرەدا پشکنینێک
// دەشکێنێت — کە بە ئەنقەستە.

/**
 * کاتالۆگی **شێوەکان** بۆ مۆدێل — نەک تەختەبەندەکان.
 *
 * ═══ بۆچی گۆڕا ═══
 * پێشتر ٢٨ تەختەبەند لێرەدا بوون و مۆدێل یەکێکی هەڵدەبژارد. بەڵام
 * مۆدێل تەختەبەندی هەڵدەبژارد **پێش** ئەوەی بزانێت چەند دەق
 * دەنووسێت، و ناتوانێت پیکسڵ بپێوێت. ئەنجامەکەی سێ شت بوو:
 * دەقی بەدەرچوو، نیوەی سلاید بەتاڵ، و شوێنی وێنەی بێ وێنە.
 *
 * ئێستا مۆدێل دەڵێت ناوەڕۆکەکە **چییە** و کۆد تەختەبەندەکە
 * بە پێوانە هەڵدەبژێرێت (`deck/compose.ts`). لیستێکی کورتتر
 * هەڵبژاردنێکی باشتریش دەکات: ١٣ شێوە لە ٢٨ تەختەبەند ئاسانترن
 * بۆ هەڵبژاردنی دروست.
 */
export const SHAPE_CATALOGUE = `
statement   one short, powerful sentence and nothing else
list        3-6 parallel items of the same kind
compare2    exactly two things weighed against each other
compareN    three or more things across the same criteria (3 or 6 bullets)
process     ordered steps that must happen in sequence     (give "steps")
timeline    dated milestones in order                      (give "timeline")
figures     2-4 headline numbers you actually retrieved    (give "kpis")
breakdown   the parts of one whole                         (3 or 6 bullets)
quote       a memorable quotation with its attribution     (give "quote")
definition  a term and what it actually means              (give "body")
example     the thing shown running: code, a formula, a worked case
divider     a section break, title only
`.trim();

/**
 * ئەوەی دێککێکی ڕاستەقینە لە دێککێکی گشتی جیا دەکاتەوە.
 *
 * ئەمە لە هەشت دێککی زانکۆیی ڕاستەقینەوە هاتووە کە خاوەنی
 * بەرهەمەکە دایناون — بڕوانە README § ٢٧.
 */
export const QUALITY_RULES = `
── WHAT SEPARATES A REAL DECK FROM A GENERIC ONE ──
Vague competence is the failure mode. A deck can be tidy, correct and
well-ordered and still be worthless, because it never says anything a reader
could not have guessed. These are what a lecturer actually marks:

- NAME THINGS. Real systems, tools, companies, people, versions, years.
  "MongoDB, Cassandra, Redis, Neo4j" beats "various NoSQL databases".
  "Armin Ronacher released it in 2010" beats "developed by a programmer".
  If you cannot name a single real instance of what you are describing, you do
  not understand it well enough to present it.

- WORK ONE EXAMPLE ALL THE WAY THROUGH. Somewhere in this deck, show the thing
  actually happening with concrete values — a small table with real rows, a
  short calculation carried to its answer, a code fragment, a before and after.
  Describing a mechanism in the abstract is not the same as showing it run.

- COMPARE IT AGAINST THE OBVIOUS ALTERNATIVE. Nearly every topic has one.
  Use L_compare or L_table with rows that carry real values — schema, cost,
  speed, when to use which — not a column of adjectives.

- SAY WHAT IT COSTS. Limits, failure modes, disadvantages, when NOT to use it.
  A deck that lists only benefits reads as advertising, and is marked as such.

- SHOW WHO ACTUALLY USES IT, by name, and for what.

- GROUND THE TERM. Where the name carries a meaning, give it: "NoSQL — Not Only
  SQL". "Running key — the key text runs alongside the message and never
  repeats." A term left undefined makes everything after it guesswork.

Not every point suits every subject — a deck on a film movement names
directors, works and years rather than versions and benchmarks. But the demand
is the same: specific, named, checkable.
`.trim();

/**
 * چۆن ناونیشان و خاڵ بنووسرێت.
 *
 * سنووری ٧ وشە لێرەدا و لە `slideTitle()` دا **دەبێت یەک ژمارە
 * بن**. ئەگەر پرۆمپتەکە ٨ ڕێگە بدات و کۆدەکە لە ٧ ببڕێت، هەموو
 * ناونیشانێکی گوێڕایەڵ دەبڕدرێت.
 */
export const WRITING_RULES = `
── HOW TO WRITE THEM ──
- A title states the finding, not the subject. "Latency falls to 1 ms" earns
  its place; "Latency" does not. (divider, quote and definition are exempt —
  they name a section, carry a quotation, or introduce a term.)
- A title is a HEADLINE, not a sentence. SEVEN WORDS IS THE CEILING and five is
  the target. Count them before you move to the next field.
      good:  "Weighted sums decide when a neuron fires"        (7 words)
      bad:   "Artificial Neurons Mathematicalize Synaptic Integration via
              Weighted Sums"                                   (8, and unreadable)
  A title that wraps onto a second line on screen has already failed. The
  contents page names each section in two or three words; a body slide whose
  title runs four times longer looks like it came from a different deck.
- THE TITLE MUST SHOW WHICH SECTION IT IS. Carry the section's own key word
  into it, so someone glancing at the slide knows where they are in the deck
  without going back to the contents page.
      section "Neural Networks"  →  "Neural networks sum weighted inputs"
      NOT                        →  "Synaptic Integration via Weighted Sums"
  Same words, same deck. This is what makes the contents page true.
- Use ordinary words. If a word would not appear in a textbook on this subject,
  it is the wrong word. Invented vocabulary — "mathematicalize", "operationalise
  the paradigm" — reads as a machine straining to sound expert, and a marker
  spots it in one line. Plain verbs carry more authority than long ones.
- Prefer a figure to an adjective. "10 Gbit/s" not "very fast". "in 43% of
  cases" not "often". "since 2019" not "recently".
- Every bullet must survive the question "so what?". A bullet that only defines
  or labels something belongs folded into the bullet that uses it.
`.trim();

/**
 * پێوەرەکانی ڕەتکردنەوە.
 *
 * ═══ ڕیزبەندی گرنگە ═══
 * ئەمە دەبێت **پێش** «هەڵبژاردنی شێوە» بێت. ناوەڕۆکەکە دەبێت لەم
 * پشکنینە دەرباز بێت پێش ئەوەی شێوەیەکی بۆ هەڵبژێردرێت. بەپێچەوانە،
 * مۆدێل یەکەم شێوەیەک هەڵدەبژێرێت و ئینجا بەرگری لە هەرچی
 * پڕیدەکاتەوە دەکات.
 */
export const REJECT_RULES = `
── BEFORE YOU EMIT A SLIDE, REJECT IT IF ──
The rules above say what a good slide is. These say what a bad one looks like,
because a checkable test is obeyed where a stylistic wish is not. Any slide that
matches one of these is rejected and rewritten BEFORE it goes into the output —
you do not ship it and apologise later:

- It carries an image the point does not need. A picture that only decorates is
  a picture that costs the reader attention and returns nothing.
- Its title names a subject instead of stating a finding, outside the three
  exempt shapes (divider, quote, definition). "Advantages" is a reject.
  "Writes scale linearly to 40 nodes" is not.
- Its title runs over seven words. Rewrite it shorter — do not ship it and hope.
- Its title shares no word with the outline section it is tagged with, so a
  reader cannot tell which promised section they are looking at.
- It contains no name, no number, no year and no named example — nothing a reader
  could look up or check.
- Its comparison is a row of adjectives ("fast", "good", "flexible") rather than
  values, figures, names or years. "MongoDB, since 2009, document store" is a
  comparison; "flexible and modern" is an opinion.
- One of its bullets is a definition or a label that the next bullet then uses.
  Fold them into one.
- Its content already appeared on an earlier slide in different words, and it is
  not the drilling-into-a-list case described above.
- It claims a statistic, a percentage or a date you are not actually confident
  in. Drop the claim or make the caption say it is illustrative — never round an
  invented figure to make it look researched.
- IT IS EMPTY OR NEARLY EMPTY. A title with one bullet under it is not a slide,
  it is a heading. If you have only one thing to say about this point, it is not
  a slide — fold it into the neighbouring slide and use the space for something
  that needs it. See the section below on how much a slide carries.
`.trim();

/**
 * چەندێک ناوەڕۆک لەسەر یەک سلاید.
 *
 * ═══ ئەم بەشە لە دێککێکی ڕاستەقینەی خاوەنی بەرهەمەکەوە هات ═══
 * دوو دێکک لەسەر هەمان بابەت بەراورد کران: ئەوەی ئەم ئەپە
 * دەریکردبوو، و ئەوەی خاوەنەکە دەیویست.
 *
 *   ئەم ئەپە      ٦ سلایدی ناوەڕۆک · نزیکەی **١٠ وشە** لەسەر هەریەکەیان
 *                 دوو سلاید بە تەواوی بەتاڵ (تەنها ناونیشان و ژێدەر)
 *   ئەوەی دەیویست ١٢ سلایدی ناوەڕۆک · نزیکەی **٧٠ وشە** لەسەر هەریەکەیان
 *
 * جیاوازییەکە شێواز نەبوو — قەبارە بوو. و لەبەر ئەوەی دەقەکە
 * کەم بوو، `compose()` هەموو سلایدێکی دەخستە سەر `L_text`
 * (فراوانترین تەختەبەند)، کە نە شوێنی وێنەی هەیە و نە ئایکۆن.
 * بۆیە «بێ وێنە» و «بێ ئایکۆن» و «دیزاینی سادە» هەموویان یەک
 * هۆکاریان هەبوو: **ناوەڕۆکی کەم**.
 */
export const SUBSTANCE_RULES = `
── HOW MUCH GOES ON A SLIDE ──
This is the single most common way these decks fail, and it is not a matter of
taste. A title with one line under it is a heading, not a slide. It also makes
the deck look broken: the layout engine measures your text and puts a sparse
slide on the plainest layout there is, with no room for an image and no icons —
so a thin deck is also an ugly one.

EVERY content slide carries THREE THINGS unless its shape says otherwise:

  1. A LEAD — one sentence that states the point of the slide in full. Not a
     fragment, not a label. This is the sentence the presenter would actually
     say first.
  2. THE SUBSTANCE — 3 to 5 items. Each item is "Label: explanation", and the
     explanation is a REAL SENTENCE carrying a name, a figure, a year or a named
     case. A three-word phrase is not an item. (The exact length is set by the
     LENGTH rule further down — follow that number, but never fewer items.)
  3. WHAT IT MEANS — where the slide supports a step in the argument, close it
     with the consequence: "Targeted data fixes beat larger models below 10B
     parameters."

Worked example of a slide that is the right weight:

  title:    "Data fixes beat compute below 10B parameters"
  bullets:  ["Labelled samples: adding 50,000 examples for one weak class cut
              false negatives by 42%, where a larger model gave about 10%",
             "Label noise: cleaning 5% of mislabelled rows raised precision by
              18 points, while extra training epochs gave under 5%",
             "Cost: annotation runs $0.01 for binary tasks and $1-$2 for complex
              ones, against $1-10M for a frontier pretraining run",
             "When it stops: past roughly 10B parameters the ordering reverses
              and scale wins again"]

That is about 90 words. Compare it with what a failing slide looks like:

  title:    "Data quality matters"
  bullets:  ["Good data improves models"]

Both are "correct". Only one is a presentation.

A slide that genuinely has less to say than this does not exist — it is two
half-slides that should be one, or a point that belongs inside another slide.
Merge it and give the room to something that earns it.
`.trim();

/**
 * چارت و خشتەی مۆدێل قەدەغەن — بڕیاری خاوەنی بەرهەمەکە.
 *
 * مۆدێل ژمارەی نییە. چارتێکی دروستکراو سێ ڕێژەی هەڵبەستراوە کە
 * ڕێکەوت کۆیان ١٠٠ ـە، و خشتەیەکی دروستکراو تۆڕێکی هاوەڵناوە.
 * هەردووکیان **وەک بەڵگە دەردەکەون** و نین — کە خراپترە لەوەی
 * هەمان شت بە ڕستەیەک بوترێت.
 */
export const NO_CHARTS = `
── NO CHARTS. NO TABLES. ──
Do not produce chart data or table data. There is no field for them and there
will not be one.

The reason is not style, it is honesty: you do not have the numbers. A chart you
generate is three invented percentages that happen to sum to 100, and a table you
generate is a grid of adjectives. Both LOOK like evidence and are not, which is
worse than plainly saying the same thing in a sentence — a marker who checks one
figure and finds it unsourced discounts the whole deck.

Where you would have reached for a chart, write the finding as text and name the
source: "Kumar et al. (2021) measured a 43% drop". Where you would have reached
for a table, use compare2 or compareN and put a real value in each item.

(The student can add a real chart from real data in the editor. That path exists
and is not yours.)
`.trim();
