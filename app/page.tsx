"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/data";
import type { Topic } from "@/lib/data/types";
import { topicHref } from "@/lib/wiki/topicRoute";
import { TopicSearch } from "@/components/search/TopicSearch";
import { AuthControl } from "@/components/auth/AuthControl";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";

// The landing page — the product's FRONT DOOR, top to bottom (design §2):
//   Daylight Projector header (host="home", Tier A at every width) → a SIMPLIFIED search segment
//   (just the search bar — the first, primary action, sitting inside the projected light) → the
//   "Wiki, plus video." intro hero (eyebrow, the locked headline with the Indigo-Press "plus" block,
//   a subheading, and two offset-shadow CTAs) → the demoted "Explore example topics" list (all four
//   data states).
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
  const [topics, setTopics] = useState<Topic[] | null>(null);
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
        // Seeded topics come from shared storage (the DB seed) — no per-browser seedIfEmpty.
        const list = await store.listTopics();
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
          The encyclopedia, illuminated
        </p>

        <h2
          aria-label="Wiki, plus video."
          className="projector-serif mt-5 text-[2.5rem] font-bold leading-[1.05] text-ink sm:text-[3.25rem]"
        >
          <span className="block">Wiki,</span>
          <span className="mt-3 flex items-center gap-3">
            <span className="plus-disp inline-flex items-center border-2 border-ink bg-brand px-3 py-0.5 text-[1.7rem] font-black leading-none text-white shadow-[4px_4px_0_var(--color-ink)] sm:text-[2.25rem]">
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
            className="inline-flex min-h-[48px] items-center gap-2 border-2 border-ink bg-brand px-5 py-2.5 text-base font-bold text-white shadow-[4px_4px_0_var(--color-ink)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            How it works <span aria-hidden>→</span>
          </Link>
          {/* Secondary — "Find a topic" focuses the search above (no new navigation). */}
          <button
            type="button"
            onClick={() => setSearchFocus((n) => (n === null ? 1 : n + 1))}
            className="inline-flex min-h-[48px] items-center border-2 border-ink bg-white px-5 py-2.5 text-base font-bold text-ink shadow-[4px_4px_0_var(--color-ink)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Find a topic
          </button>
        </div>
      </section>

      {/* ── The DEMOTED topic list (AC7) — secondary "explore" content below a quiet rule. The
          data path (store.listTopics) and all four states are unchanged. ── */}
      <section className="mx-auto max-w-5xl border-t border-ink/10 px-4 pb-12 pt-8">
        <h2 className="text-lg font-medium text-ink">Explore example topics</h2>
        <p className="mt-1 text-xs text-ink/50">
          (Prototype: curations are shared — everyone sees the same topics and clips.)
        </p>

        <div className="mt-4">
          {loadError ? (
            <p className="text-sm text-ink/50">Couldn&apos;t load topics — please refresh.</p>
          ) : topics === null ? (
            <p className="text-sm text-ink/50">Loading…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-ink/50">No topics yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {topics.map((t) => (
                <li key={t.qid}>
                  <Link
                    href={topicHref(t.title)}
                    className="block rounded-xl border border-ink/10 bg-white p-4 shadow-sm transition hover:border-brand/40"
                  >
                    <span className="block font-medium text-ink">{t.title}</span>
                    {t.description && (
                      <span className="mt-1 block text-sm text-ink/60">
                        {t.description}
                      </span>
                    )}
                    <span className="mt-2 block text-xs text-brand">{t.qid}</span>
                  </Link>
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
