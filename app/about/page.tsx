import type { Metadata } from "next";
import { AuthControl } from "@/components/auth/AuthControl";
import { Centerpiece } from "@/components/about/Centerpiece";
import { HowItWorks } from "@/components/about/HowItWorks";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";

// /about — "How it works". The product's one orientation surface (docs/specs/about-page.md;
// docs/design/about-page.md): a centerpiece illustration that makes the wiki+ thesis legible in one
// image (a projector throws a beam onto a Wikipedia Topic page; the indigo ＋plus layer of curated
// video reads as the projected light), paired with a plain-language "How it works" explainer.
//
// Composition (design §1): the universal projector header (host="page", which emits the beam-landing
// page-top surface) → §A the centerpiece hero → §B the "How it works" explainer → the slim footer.
// The page canvas is the app's body grey so the beam lands + falls off correctly (design §1.2). Copy
// is placeholder lorem ipsum this round (spec ★); the structure is copy-injection-ready (AC19).

export const metadata: Metadata = {
  title: "How it works",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader host="page" auth={<AuthControl variant="home" />} />
      {/* Visually-hidden top-level heading so the document has an <h1> landmark; §B's heading is the
          page's primary VISIBLE heading (an <h2>), mirroring the home page's sr-only <h1> (§10.1). */}
      <h1 className="sr-only">How it works — wiki+</h1>

      <main>
        {/* §A — the centerpiece hero. The dark panel fills the wide content measure at ≥ lg; the
            miniature-alone frame is centered < lg. Flush under the beam-landing surface. */}
        <section className="mx-auto max-w-[1100px] px-4 pt-8 sm:pt-10">
          <Centerpiece />
        </section>

        {/* §B — the load-bearing "How it works" explainer, in a comfortable reading measure. */}
        <div className="mt-12 pb-16 sm:mt-16">
          <HowItWorks />
        </div>
      </main>

      <SiteFooter containerClassName="mx-auto max-w-[1100px] px-4" />
    </>
  );
}
