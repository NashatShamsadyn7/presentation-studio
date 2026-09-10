// ═══════════ پێوەری هەر بوارێک ═══════════
//
// کێشەکە: مۆدێل هەموو بابەتێک بە یەک شێواز دەنووسێت. پێشکەشکردنێک
// لەسەر سینەما هەمان پێکهاتەی وەردەگرت وەکو یەکێک لەسەر ئەندازیاری
// شارستانی — ناونیشان، سێ خاڵ، وێنەیەک. بەڵام ئەوەی مامۆستای
// سینەما دەیەوێت هەرگیز ئەوە نییە کە مامۆستای ئەندازیاری دەیەوێت.
//
// ئەم دەقە هەم لە پێڕستەکەدا بەکاردێت هەم لە سلایدەکاندا، تاکو
// هەردووکیان یەک پێوەریان هەبێت. بە ئینگلیزییە چونکە پرۆمپتەکان
// بە ئینگلیزین.
//
// لیستەکە داخراو نییە بە ئەنقەست — دوا دێڕەکە داوا لە مۆدێل دەکات
// بۆ بوارێکی نەناسراویش هەمان پرسیار بکات.

export const DOMAIN_RULES = `
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
`.trim();
