"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopicView } from "./topic/TopicView";
import { ArticleSkeleton } from "@/components/topic/ArticleBody";
import { barePathRedirectTarget } from "@/lib/routing/reserved";

// SPA fallback + bare-path redirect (issue #13). See docs/specs/bare-path-redirect.md
// and docs/design/bare-path-redirect.md; recorded in docs/ARCHITECTURE.md
// ("Prototype phase → routing").
//
// Under `output: "export"` Next emits this component as the default `404.html`, which
// GitHub Pages serves for any path with no pre-built page (and which `next dev` renders
// for any unmatched path) — so ONE code path covers both static-export and local-dev
// (spec AC9). deploy.yml NO LONGER overwrites 404.html with the topic shell: this
// component is a strict superset of that shell — it runs the bare-path redirect AND, for
// every other unmatched path (notably unseeded `/topic/<Title>/` deep links), renders
// `TopicView`, exactly as the old shell-as-404 did. (#11 deep-link/refresh preserved.)
//
// The ONE critical ordering requirement (design spec): for a bare title that is a real
// topic, the user must NEVER see the "Topic not found." flash. We decide the redirect on
// mount and, while a redirect is pending, render a neutral Topic loading state (the
// existing ArticleSkeleton) — never `TopicView`'s resolveError branch — so the hop reads
// as one continuous load. Non-redirect paths fall through to `TopicView`, whose own
// loading → resolve flow (incl. the graceful "Topic not found. Back home" dead end for a
// bare title that turns out not to be a real article) is unchanged by this spec.
export default function NotFound() {
  const router = useRouter();
  // Start "true" so the very first client paint after a redirect-eligible boot is the
  // loading shell, not TopicView. Resolved synchronously in the mount effect below; the
  // server/prerender pass renders the neutral shell too (no flash, no hydration flip to
  // not-found). `null` = undecided (pre-mount), only on the server prerender.
  const [redirecting, setRedirecting] = useState<boolean | null>(null);
  // Fire the redirect at most once per mount — belt-and-suspenders for the loop guard
  // (AC4): even if the effect re-runs (StrictMode double-invoke, a re-render before the
  // navigation commits), `router.replace` is called exactly once.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const target = barePathRedirectTarget(
      window.location.pathname,
      window.location.search,
      window.location.hash
    );
    if (target) {
      setRedirecting(true);
      // `replace`, not `push`: the transient bare URL is dropped from history so Back
      // returns to where the user came from (spec Open questions; matches the existing
      // ?qid= canonicalization). The target is under the reserved `/topic` prefix, so
      // the rule cannot re-fire on it (loop guard, AC4).
      router.replace(target);
    } else {
      setRedirecting(false);
    }
  }, [router]);

  // Pending (or undecided on the prerender): render the neutral Topic loading state and
  // a polite, screen-reader-only announcement of the hop. A client-side `router.replace`
  // skips the browser's native page-change announcement, and TopicView's existing live
  // region is gated to `mode === "empty"` and won't cover a curated/just-redirected
  // topic — so we announce "Loading topic…" here at the redirect boundary (design spec,
  // Accessibility). Honest ("loading", not "found"); not contradicted by a later
  // not-found. Focus is not stranded: the document stays mounted through the hop.
  if (redirecting === true || redirecting === null) {
    return (
      <>
        <p className="sr-only" role="status" aria-live="polite">
          Loading topic…
        </p>
        <div className="mx-auto max-w-[1200px] px-5 pt-6">
          <ArticleSkeleton />
        </div>
      </>
    );
  }

  // Not a bare-title redirect: serve the SPA shell. For `/topic/<Title>/` deep links and
  // refreshes (#11) this renders the topic; for a genuinely unresolvable path it ends in
  // TopicView's graceful "Topic not found. Back home" state — unchanged by this spec.
  return <TopicView />;
}
