// <HowItWorks> — the §B explainer (docs/design/about-page.md §6.1; AC19). The LOAD-BEARING,
// accessibility-anchored "How it works": the real, reliable explainer a screen-reader / keyboard /
// mobile user reads, on the light page canvas where AA contrast is easy to guarantee (always present
// at every width, unlike the §A in-scene card which is desktop-only decoration). Both read from the
// SAME HOW_IT_WORKS copy object, so a copy edit updates both at once.
//
// Structure is the contract (AC19): a heading + a real <ol> of numbered steps, each an eyebrow
// number + a label + a body slot. Copy lives in HOW_IT_WORKS (copy.ts), isolated from layout so real
// copy drops into the text values only — no structural change. 3 steps now; 3–4 supported.
//
// A11y (§9.1): the eyebrow text is the brand indigo on body grey — that pair is 4.39:1, just under
// AA 4.5:1, so per the §9.1 Dev action the eyebrow TEXT is darkened to --color-violet (6.75:1, AA),
// and the gold stays a thin DECORATIVE rule only. The <ol> carries order semantically; the visible
// number glyph is decorative styling on top (aria-hidden), never the sole carrier of order (§9.4).

import { HOW_IT_WORKS } from "./copy";

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="mx-auto max-w-[760px] px-4">
      {/* Eyebrow — gold accent rule + label. The word carries the meaning; the rule colour is
          decorative. Text is --color-violet for AA on the body grey (§9.1). */}
      <p className="plus-disp flex items-center text-xs font-bold uppercase tracking-[0.18em] text-violet">
        <span aria-hidden className="mr-3 h-[2px] w-6 bg-[var(--color-gold-accent)]" />
        {HOW_IT_WORKS.eyebrow}
      </p>

      <h2
        id="how-it-works-heading"
        className="plus-disp mt-4 text-[1.75rem] font-extrabold leading-tight tracking-[-0.01em] text-ink"
      >
        {HOW_IT_WORKS.heading}
      </h2>

      <p className="mt-4 max-w-[62ch] text-[1.0625rem] leading-relaxed text-ink2">
        {HOW_IT_WORKS.lead}
      </p>

      <ol className="mt-8 flex flex-col gap-7">
        {HOW_IT_WORKS.steps.map((step) => (
          <li key={step.n} className="flex gap-4">
            <span aria-hidden className="bignum shrink-0 text-2xl leading-none text-brand">
              {step.n}
            </span>
            <div>
              <h3 className="plus-disp text-base font-bold text-ink">{step.label}</h3>
              <p className="mt-1 text-[0.95rem] leading-relaxed text-ink2">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
