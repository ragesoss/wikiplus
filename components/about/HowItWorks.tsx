// <HowItWorks> — THE "How it works" card: the single, load-bearing explainer of the wiki+ thesis and
// the one light surface on the dark About page. A warm zine card (it reads as catching the
// projector's light) carrying the real heading + numbered steps. It is the page's primary VISIBLE
// heading (an <h2>) and the accessible <ol> of steps; the centerpiece graphic beside it is decoration.
// There is exactly ONE of these — no decorative in-scene duplicate to read twice.
//
// Layout-neutral: it owns the card chrome + content; the parent (<Centerpiece>) sizes and places it
// (a left column beside the graphic when wide; stacked FIRST, above the graphic, when it reflows
// narrow). `className` merges onto the card root for that placement.
//
// On the dark theater the card uses a warm outer glow + a thin ink edge — NOT the zine hard offset
// shadow, which (ink-on-near-black) doesn't read on the dark field; `.how-it-works-card` (globals.css)
// owns that surface. Copy lives in HOW_IT_WORKS (copy.ts), isolated from layout (3 steps; 3–4
// supported by a one-line array push).
//
// A11y: the eyebrow text is --color-violet on the warm card (AA ≥ 4.5:1) and the gold rule is a
// decorative accent only; the heading/body use ink / warm prose (AA on the warm fill). The <ol>
// carries step order semantically; the big number glyph is decorative styling (aria-hidden), never
// the sole carrier of order.

import { HOW_IT_WORKS } from "./copy";

export function HowItWorks({ className = "" }: { className?: string }) {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className={`how-it-works-card ${className}`}
    >
      {/* Eyebrow — gold accent rule + label. The word carries the meaning; the rule colour is
          decorative. Text is --color-violet for AA on the warm card fill. */}
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

      <p className="mt-4 text-[1.0625rem] leading-relaxed text-[color:var(--color-prose-warm)]">
        {HOW_IT_WORKS.lead}
      </p>

      <ol className="mt-7 flex flex-col gap-6">
        {HOW_IT_WORKS.steps.map((step) => (
          <li key={step.n} className="flex gap-4">
            <span aria-hidden className="bignum shrink-0 text-2xl leading-none text-brand">
              {step.n}
            </span>
            <div>
              <h3 className="plus-disp text-base font-bold text-ink">{step.label}</h3>
              <p className="mt-1 text-[0.95rem] leading-relaxed text-[color:var(--color-prose-warm)]">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
