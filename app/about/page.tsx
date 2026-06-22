import type { Metadata } from "next";
import { AuthControl } from "@/components/auth/AuthControl";
import { Centerpiece } from "@/components/about/Centerpiece";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";

// /about — "How it works". The product's one orientation surface: a single dark-theater scene where a
// projector throws a beam onto a Wikipedia Topic page (the indigo ＋plus layer of curated video reads
// as the projected light), paired with the one plain-language "How it works" card. The card is the
// only light surface; everything else on the page is the dark theater.
//
// Composition: the header is in "projector OFF" mode (host="flat" — the flat wordmark lockup, no
// header beam) because the page graphic IS a projector throwing a beam; a second beam in the header
// would read as two projectors. The <main> is the full-bleed dark theater, with the content centered
// in it; <Centerpiece> lays the card + graphic side by side when wide and reflows the card FIRST,
// graphic below, when narrow. The slim footer carries the persistent "About your data" link.

export const metadata: Metadata = {
  title: "How it works",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader host="flat" auth={<AuthControl variant="home" />} />
      {/* Visually-hidden top-level heading so the document has an <h1> landmark; the card's heading is
          the page's primary VISIBLE heading (an <h2>), mirroring the home page's sr-only <h1>. */}
      <h1 className="sr-only">How it works — wiki+</h1>

      {/* The full-bleed dark theater. The content is vertically centered in it so the scene floats in
          the dark room; the dark fills the viewport below the slim flat header. */}
      <main className="flex min-h-[calc(100vh-56px)] flex-col justify-center bg-[var(--color-theater-3)] px-4 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1400px]">
          <Centerpiece />
        </div>
      </main>

      <SiteFooter containerClassName="mx-auto max-w-[1400px] px-4" />
    </>
  );
}
