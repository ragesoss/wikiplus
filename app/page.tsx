"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/data";
import type { TopicWithStats } from "@/lib/data/types";
import { TopicSearch } from "@/components/search/TopicSearch";
import { AuthControl } from "@/components/auth/AuthControl";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import { TopicCard } from "@/components/home/TopicCard";

// The landing page — the product's FRONT DOOR, top to bottom (design §2):
//   Daylight Projector header (host="home", Tier A at every width) → a SIMPLIFIED search segment
//   (just the search bar — the first, primary action, sitting inside the projected light) → the
//   "Wiki, plus video." intro hero (eyebrow, the locked headline with the Indigo-Press "plus" block,
//   a subheading, and two offset-shadow CTAs) → the demoted "Recently curated" topic list (all four
//   data states, recency-ordered).
//
// The search is REUSED unforked (one TopicSearch, variant="home"). The hero's secondary CTA focuses
// that search via the component's prefill+focus signal (a nonce bump seeds an empty field and moves
// focus into it, which scrolls it back into view); the primary CTA links to /about ("How it works").
//
// ── Header layout (design §7.5 / §4.7): ──
//   • The projector renders Tier A at EVERY width (no tier-drop), beam drawn TRUE-SCALE with the apex
//     on the LIVE aperture x (asymmetrical arms).
//   • ONE ROW at every width — the lockup + a single AuthControl, no top strip, no second row:
//       - desktop (≥ md): lockup CENTERED in the band, auth pinned top-right.
//       - narrow  (< md): lockup LEFT-anchored, auth at the RIGHT of the same row.
//   • The search hero is pulled UP so its top sits just below the burn boundary (burnY=104px), INSIDE
//     the bracket arms — the beam burns into the search, not a far-off underline (§4.4).
// See docs/specs/landing-page.md + docs/design/landing-page.md.

export default function HomePage() {
  const [topics, setTopics] = useState<TopicWithStats[] | null>(null);
  // Read-error floor (design §6.1): a server read can fail (DB down) — show an honest line
  // rather than hang on "Loading…" forever (AC7).
  const [loadError, setLoadError] = useState(false);
  // "Find a topic" hero CTA → focus the search field above. null until the first click so the field
  // never auto-focuses on load; each click bumps the nonce, which TopicSearch's prefill effect reads
  // to (re-)focus the input. Empty `value` so the focus brings a fresh field.
  const [searchFocus, setSearchFocus] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // The "Recently curated" read (issue #126): topics WITH their at-a-glance counts, already
        // filtered to videos ≥ 1 and recency-ordered by ONE grouped aggregate (no N-per-topic
        // reads, no zero-curation topics — see the card + ARCHITECTURE "Recently-curated read").
        // Seeded topics come from shared storage (the DB seed) — no per-browser seedIfEmpty.
        const list = await store.listCuratedTopics();
        if (alive) setTopics(list);
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main>
      {/* Visually-hidden top-level heading so the document has an <h1> for landmarks WITHOUT
          adding visible prose above the search (design §2 / OQ-3). */}
      <h1 className="sr-only">wiki+</h1>

      {/* ── The shared Daylight Projector header, Home host (full-bleed so the gold border runs
          off both real page edges). The wordmark links home. ── */}
      <SiteHeader host="home" auth={<AuthControl variant="home" />} />

      {/* ── The simplified search segment — paints --content-white so the beam's burn-to-white
          resolves into it (design §4.4). Pulled UP (small top padding) so the search field sits just
          below the burn boundary, INSIDE the projected light. The search is the dominant, full-width
          focus and the first, primary action (AC1); the orienting prose now lives in the hero below. ── */}
      <div className="bg-[var(--color-content-white)]">
        <div className="mx-auto max-w-[640px] px-4 pb-12 pt-4">
          <TopicSearch
            variant="home"
            prefill={searchFocus === null ? undefined : { value: "", nonce: searchFocus }}
          />
        </div>
      </div>

      {/* ── The "Wiki, plus video." intro hero — orients a first-time visitor who scrolls past the
          search. Sits on the body grey (a quiet break from the white search spotlight), left-aligned
          in the reading column. Built from the committed Indigo-Press hardbox language: the "plus"
          zine block (indigo fill, 2px ink border, hard offset shadow, "plus" in Source Sans 900 white)
          and two offset-shadow CTAs that press into their shadow on hover. ── */}
      <section className="mx-auto max-w-[640px] px-4 pb-14 pt-10 sm:pt-14">
        <p className="flex items-center text-xs font-bold uppercase tracking-[0.18em] text-ink2">
          {/* Indigo accent rule (gold is reserved for the wordmark — VISUAL_IDENTITY §9.1). */}
          <span aria-hidden className="mr-3 h-[2px] w-8 bg-brand" />
          {/* The last word catches a slow, occasional warm beam pass — the projector light crossing
              the word that names it. The effect is CSS-only (.tagline-illuminated, globals.css):
              gated behind no-preference + background-clip:text support, and it rests at the eyebrow's
              ink2 color, so contrast and the read are unchanged when motion/support is off. */}
          The encyclopedia, {" "}
          <span className="tagline-illuminated">illuminated</span>
        </p>

        <h2
          aria-label="Wiki, plus video."
          className="projector-serif mt-5 text-[2.5rem] font-bold leading-[1.05] text-ink-plus sm:text-[3.25rem]"
        >
          <span className="block">Wiki,</span>
          <span className="mt-3 flex items-center gap-3">
            <span className="plus-disp inline-flex items-center border-2 border-hardbox bg-brand px-3 py-0.5 text-[1.7rem] font-black leading-none text-white shadow-[4px_4px_0_var(--color-hardbox-offset)] sm:text-[2.25rem]">
              plus
            </span>
            <span>video.</span>
          </span>
        </h2>

        <p className="mt-7 max-w-[46ch] text-[1.05rem] leading-relaxed text-ink2">
          Shared knowledge is more than just words on a page. For any Wikipedia topic, find and
          curate the best video content from creators who know what they&rsquo;re talking about.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          {/* Primary — "How it works" → /about (the orientation path). */}
          <Link
            href="/about"
            className="inline-flex min-h-[48px] items-center gap-2 border-2 border-hardbox bg-brand px-5 py-2.5 text-base font-bold text-white shadow-[4px_4px_0_var(--color-hardbox-offset)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hardbox"
          >
            How it works <span aria-hidden>→</span>
          </Link>
          {/* Secondary — "Find a topic" focuses the search above (no new navigation). */}
          <button
            type="button"
            onClick={() => setSearchFocus((n) => (n === null ? 1 : n + 1))}
            className="inline-flex min-h-[48px] items-center border-2 border-hardbox bg-surface-raised px-5 py-2.5 text-base font-bold text-ink-plus shadow-[4px_4px_0_var(--color-hardbox-offset)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hardbox"
          >
            Find a topic
          </button>
        </div>
      </section>

      {/* ── The DEMOTED "Recently curated" topic list (AC7) — the page's third and last beat. Per
          the owner revision (topic-card-redesign.md §6.1.1), the section chrome above the grid is
          the `Recently curated` <h2> ALONE — the eyebrow device + the supporting/disclaimer line
          are removed. The grid follows the heading directly. The data path (store.listCuratedTopics
          — recency-ordered + filtered to videos ≥ 1 by one grouped aggregate, §4/§4.1) drives the
          redesigned TopicCard; the three section-level state strings are unchanged (§6.1). ── */}
      <section className="mx-auto mt-4 max-w-5xl border-t border-hardbox/15 px-4 pb-12 pt-10 sm:pt-14">
        {/* The section heading + the in-context bridge to the cross-topic /recent feed (issue #160,
            design §5.2 secondary entry): this section shows recently-curated TOPICS; the feed shows
            recently-curated CLIPS — complementary. A text-forward link in the action-blue link tone,
            the word carries the meaning (the → is decorative). */}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-xl font-bold text-ink-plus sm:text-2xl">Recently curated</h2>
          <Link
            href="/recent"
            aria-label="See all recent curations"
            className="text-sm font-bold text-link hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
          >
            See all recent curations <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-6">
          {loadError ? (
            <p className="text-sm text-ink-plus/50">Couldn&apos;t load topics — please refresh.</p>
          ) : topics === null ? (
            <p className="text-sm text-ink-plus/50">Loading recently curated topics…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-ink-plus/50">
              No topics curated yet — be the first by searching for one above.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {topics.map((t) => (
                <li key={t.qid}>
                  <TopicCard topic={t} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* The slim shared footer (issue #66, design §4.3) — the persistent, signed-out-reachable
          home for the "About your data" notice link (AC2). Aligned to the explore-section width. */}
      <SiteFooter containerClassName="mx-auto max-w-5xl px-4" />
    </main>
  );
}
