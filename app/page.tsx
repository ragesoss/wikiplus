"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { store } from "@/lib/data";
import type { Topic } from "@/lib/data/types";
import { topicHref } from "@/lib/wiki/topicRoute";
import { TopicSearch } from "@/components/search/TopicSearch";
import { AuthControl } from "@/components/auth/AuthControl";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { HeaderProjector } from "@/components/wordmark/HeaderProjector";

// The landing page (#15) — the product's FRONT DOOR. A single centered column (design §2):
//   Daylight Projector header (Tier A, the fluid beam at EVERY width) → "Find a topic" search
//   (the dominant focus, AC1, sitting INSIDE the projected light) → the concise VISION-sourced
//   explanation (AC6) → a quiet rule → the DEMOTED topic list under "Explore example topics"
//   (AC7, all four states preserved).
// The search is REUSED unforked (one TopicSearch import, variant="home" — AC2).
//
// ── Iteration 3 (PR #61, 3rd owner review — design §7.5 / §4.7): ──
//   • The projector renders Tier A at EVERY width (no tier-drop, design §4.7), with the beam
//     drawn TRUE-SCALE and the apex on the LIVE aperture x (asymmetrical arms).
//   • The header is ONE ROW at every width — the lockup + a single AuthControl. NO top strip,
//     NO folded second row (the Iteration-2 top-strip is RETRACTED, finding 5 + Iteration-3):
//       - desktop (≥ md): lockup CENTERED in the band, auth pinned top-right.
//       - narrow  (< md): lockup LEFT-anchored (HeaderProjector positions it left → off-center
//         apex → short left arm + long right arm), auth at the RIGHT of the same row.
//   • The "Contribute" link is REMOVED entirely (finding 4) — gone, not relocated.
//   • The hero (search) is pulled UP so its top sits just below the burn boundary (burnY=150px),
//     INSIDE the bracket arms — the beam burns into the search, not a far-off underline (§4.4).
// See docs/specs/landing-page.md + docs/design/landing-page.md.

export default function HomePage() {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  // Read-error floor (design §6.1): a server read can fail (DB down) — show an honest line
  // rather than hang on "Loading…" forever. Preserved verbatim from the prior page (AC7).
  const [loadError, setLoadError] = useState(false);

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
          adding visible prose above the search (design §2 / OQ-3). The visible "Find a topic"
          label remains the hero's heading. */}
      <h1 className="sr-only">wiki+</h1>

      {/* ── The Daylight Projector header (full-bleed so the gold border runs off both real
          page edges). The projector renders Tier A at EVERY width (true-scale beam — design §4.7),
          so the band is tall (burnY=150px) at every width and the header chrome is ONE ROW:
          the lockup (centered on desktop / LEFT-anchored at narrow — positioned by HeaderProjector
          on the live apex) + a single AuthControl right-anchored on the wordmark row. The auth
          slot is ABSOLUTELY positioned right + vertically centered on the wordmark row so it never
          pushes the lockup off its anchor and NEVER folds to its own row under the lockup — NO top
          strip, NO second row at any width (§7.5, findings 4–6 + Iteration-3). ── */}
      <div className="relative bg-[var(--color-header-field)]">
        <HeaderProjector variant="projector" />
        {/* The single AuthControl, right-anchored on the SAME row as the lockup at every width.
            No "Contribute" link (finding 4). The slot sits in the cool fluorescent band above the
            burn boundary, vertically centered on the wordmark row (~cyMid=44px) so it reads as a
            normal top-bar (lockup left, sign-in right) at narrow widths and as a top-right control
            at desktop. It is absolutely positioned so it never pushes the lockup off its anchor and
            NEVER folds to its own row beneath the lockup (§7.5). On the smallest phones the lockup
            scales down (`.projector-lockup-fit`) so the two coexist on one row without overlap. */}
        <div
          className="auth-slot absolute right-0 top-0 z-10 flex items-center justify-end px-3 sm:px-4 max-[479px]:max-w-[46%] max-[359px]:max-w-[120px]"
          style={{ height: 88 /* 2×cyMid → vertically centers the auth on the wordmark row (y≈44) */ }}
        >
          {/* On the smallest phones the wide "Log in with Wikipedia" button + the LEFT lockup are
              tight on one row; capping the slot lets the button label WRAP WITHIN the button (it
              stays on the lockup's row, just taller) — per §7.5 ("the button stays on the lockup's
              row; the label may wrap within the button") — rather than overlap the lockup. */}
          <AuthControl variant="home" />
        </div>
      </div>

      {/* ── The hero — paints --content-white so the beam's burn-to-white resolves into it
          (design §4.4). The hero is pulled UP (small top padding) so the search field sits just
          below the burn boundary, INSIDE the projected light (§2/§4.4) — not a far-off divider.
          The search is the dominant, full-width focus (AC1); the explanation sits directly under
          it (AC6). ── */}
      <div className="bg-[var(--color-content-white)]">
        <div className="mx-auto max-w-[640px] px-4 pb-10 pt-4">
          <TopicSearch variant="home" />
          <p className="mt-4 max-w-[60ch] text-center text-[0.95rem] text-ink2">
            <span className="font-medium text-ink">
              wiki+ is a curation and contextualization layer over Wikipedia.
            </span>{" "}
            It attaches creator-made videos to the topics you read about — each with a
            human-written note that separates the facts from the creator&apos;s opinion.
          </p>
        </div>
      </div>

      {/* ── The DEMOTED topic list (AC7) — secondary "explore" content below a quiet rule. The
          data path (store.listTopics) and all four states are unchanged; only prominence and
          framing change. The page sits on the body's #F7F7F7 from here down. ── */}
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
