"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

// ArticleNotFound (issue #19, design docs/design/article-not-found.md) — the HONEST,
// distinct full-page state for a well-formed but NONEXISTENT Wikipedia title (e.g.
// /topic/Asdfqwer). It is NOT the transient `ArticleError` card: the title definitively
// does not resolve, so there is no rail, no retry, and the copy must not imply a network
// blip. Pure/stateless presentational component — props in, no data fetching, no store
// reads. Rendered by TopicView ABOVE the split-pane shell (the page IS this state).

export type ArticleNotFoundKind = "missing" | "no-identifier";

export interface ArticleNotFoundProps {
  /** "missing" — a title/`?qid=` that Wikipedia could not resolve to a real page.
   *  "no-identifier" — a /topic/ URL with no title and no `?qid=` to resolve at all. */
  kind: ArticleNotFoundKind;
  /** The title the reader attempted (space-form path title). Present for "missing"
   *  arrivals via /topic/<Title>; omitted for "no-identifier" and unresolvable `?qid=`. */
  attemptedTitle?: string;
  /** Push the attempted title (or "" for empty) into the site topic-search + focus it. */
  onSearch: (prefill: string) => void;
}

// Verbatim microcopy (design §4 — use EXACTLY). Honesty bar (§4): never "Couldn't load",
// "reach Wikipedia", "just now", or "Try again" — those frame a permanent absence as a
// transient failure, which is precisely the confusion #19 exists to remove.
const KICKER = "Topic not found";
const HEADLINE_MISSING = "There's no Wikipedia article by that title";
const HEADLINE_NO_ID = "That's not a topic we can open";
const BODY_MISSING_GENERIC =
  "We couldn't find a Wikipedia article for this topic. It may not exist, or the link may be out of date.";
const BODY_NO_ID =
  "This link doesn't point to a Wikipedia article. Search for a topic to get started.";

export function ArticleNotFound({
  kind,
  attemptedTitle,
  onSearch,
}: ArticleNotFoundProps) {
  // Focus management (design §8): this state replaces the WHOLE Topic page on navigation,
  // so its headline is the page's single <h1>. Move focus to it on render (tabIndex={-1})
  // so a keyboard / screen-reader user lands on the explanation, not at <body> top —
  // mirroring TopicView's "move focus sensibly" pattern. NOT a dialog (no focus trap), and
  // NOT role="alert" (this is not a transient/error condition that should interrupt).
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const hasTitle = kind === "missing" && !!attemptedTitle;
  const headline = kind === "missing" ? HEADLINE_MISSING : HEADLINE_NO_ID;

  // Shared button treatments (design §3.2 — reuse, don't invent). Primary = action-blue
  // (#1F6F95) navigational action; secondaries = ink-on-white, the same treatment
  // ArticleError's "Open on Wikipedia" uses. No gold (gold stays the wordmark-only accent).
  const primaryClass =
    "border-2 border-ink bg-action px-4 py-2 text-sm font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]";
  const secondaryClass =
    "border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]";

  return (
    <div className="mx-auto max-w-[34rem] px-5 py-16 sm:py-24">
      <div className="plus-card p-6 sm:p-8">
        {/* Text-labeled kicker (NOT a heading, NOT a colored icon — color independence, §8). */}
        <p className="text-xs font-bold uppercase tracking-wide text-ink2">
          {KICKER}
        </p>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-2xl font-bold leading-tight text-ink outline-none"
        >
          {headline}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink2">
          {kind === "missing" ? (
            hasTitle ? (
              <>
                We looked for &ldquo;{attemptedTitle}&rdquo; on Wikipedia and
                didn&apos;t find an article with that title. It may be
                misspelled, or the page may not exist yet.
              </>
            ) : (
              BODY_MISSING_GENERIC
            )
          ) : (
            BODY_NO_ID
          )}
        </p>

        {/* Action row (design §5) — primary first, wraps to stacked on narrow widths. */}
        <div className="mt-6 flex flex-wrap gap-3">
          {hasTitle ? (
            <>
              {/* Primary: keep the reader in-app, prefilled (the cheapest fix for a typo). */}
              <button
                type="button"
                onClick={() => onSearch(attemptedTitle as string)}
                className={primaryClass}
              >
                Search Wikipedia
              </button>
              {/* Secondary: Wikipedia's SEARCH (not /wiki/<Title>, which would just land on
                  Wikipedia's own red "page does not exist" screen). The ↗ glyph + the word
                  "Wikipedia" mark "opens externally" — never color alone (§5/§8). */}
              <a
                href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(
                  attemptedTitle as string
                )}`}
                target="_blank"
                rel="noopener"
                className={secondaryClass}
              >
                Open search on Wikipedia ↗
              </a>
            </>
          ) : (
            // No title to search or open externally → a single empty-search primary.
            <button
              type="button"
              onClick={() => onSearch("")}
              className={primaryClass}
            >
              Search topics
            </button>
          )}

          <Link href="/" className={secondaryClass}>
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
