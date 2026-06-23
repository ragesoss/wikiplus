import type { Metadata } from "next";
import { AuthControl } from "@/components/auth/AuthControl";
import { Centerpiece } from "@/components/about/Centerpiece";
import { DEFAULT_TITLE, TITLE_FIT_CAP } from "@/components/about/copy";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import { listCuratedTopicsAction } from "@/lib/server/actions";

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

// The dynamic miniature title (AC16–AC18): /about reads the recently-curated topics server-side and
// derives the eligible POOL — titles whose length fits the miniature's single title line (the
// TITLE_FIT_CAP filter; an over-long title is EXCLUDED, never truncated). The pool + the fallback
// `DEFAULT_TITLE` go to the client miniature, which (re)picks one per power-on; an empty pool ⇒ the
// fallback. This is a READ of existing data — no schema/policy/Server-Action change — so it shifts
// /about from static-prerender to a dynamic read (acceptable for the prototype; the production
// ISR/Redis read path is deferred per docs/ARCHITECTURE.md).
//
// DETERMINISTIC CAPTURE PIN (§7.2): the screenshot harness runs against a SEEDED Postgres whose
// curated topics (e.g. "Photosynthesis") DO fit the cap — so an unpinned pool would put a real,
// churning title in the About baseline and break AC2/AC11 (the committed poster `178c148` shows
// "Acer palmatum"). The capture path appends `?capture=poster`; under it we force the pool EMPTY so
// the client falls to the fallback `"Acer palmatum"` — a stable, deterministic pin, NOT a random
// pick, with no test-only branch inside the client component. An empty/failed read also falls back
// cleanly, so /about always renders (AC16).
async function eligibleTitlePool(pinFallback: boolean): Promise<string[]> {
  if (pinFallback) return [];
  try {
    const topics = await listCuratedTopicsAction();
    return topics
      .map((t) => t.title)
      .filter((title) => title.length > 0 && title.length <= TITLE_FIT_CAP);
  } catch {
    return []; // an unavailable read ⇒ the fallback, never a blank/broken page
  }
}

/** Pick the FIRST-power-on title once, server-side, so SSR + the client's first render agree (no
 *  hydration mismatch from a client random pick on first paint). Empty pool ⇒ the fallback (AC16). */
function pickInitial(pool: string[]): string {
  if (pool.length === 0) return DEFAULT_TITLE;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default async function AboutPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const pinFallback = params.capture === "poster";
  const titlePool = await eligibleTitlePool(pinFallback);
  const initialTitle = pinFallback ? DEFAULT_TITLE : pickInitial(titlePool);

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
          <Centerpiece
            titlePool={titlePool}
            fallbackTitle={DEFAULT_TITLE}
            initialTitle={initialTitle}
          />
        </div>
      </main>

      <SiteFooter containerClassName="mx-auto max-w-[1400px] px-4" />
    </>
  );
}
