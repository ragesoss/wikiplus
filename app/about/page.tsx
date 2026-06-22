import type { Metadata } from "next";
import { AuthControl } from "@/components/auth/AuthControl";
import { Centerpiece } from "@/components/about/Centerpiece";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";

// /about — "How it works". The product's one orientation surface: a single dark "theater" room that
// fills the whole page, with FOUR elements composed within that one warm-dark field — the
// "How it works" card, the projector, its beam, and the lit Topic-page miniature. The projector
// throws the beam onto the page (the indigo ＋plus layer of curated video reads as the projected
// light); the card is the room's only light surface. There is no separate scene "box": the field IS
// the page.
//
// Composition: the header is in "projector OFF" mode (host="flat" — the flat wordmark lockup, no
// header beam) because the page graphic IS a projector throwing a beam; a second beam in the header
// would read as two projectors. The <main> paints the full-page theater field (.about-theater-field)
// and centers the composition in it; <Centerpiece> arranges the four elements as a poster (card
// upper-left, projector lower-left, beam diagonal, miniature right) when wide, and reflows the card
// FIRST with the graphic below when narrow. The slim footer carries the persistent "About your data"
// link.

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

      {/* The full-bleed theater field (one warm-dark room). The content is vertically centered in it so
          the composition floats in the room; the field fills the viewport below the slim flat header. */}
      <main className="about-theater-field flex min-h-[calc(100vh-56px)] flex-col justify-center px-4 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1400px]">
          <Centerpiece />
        </div>
      </main>

      <SiteFooter containerClassName="mx-auto max-w-[1400px] px-4" />
    </>
  );
}
