"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoginPromptPanel } from "@/components/auth/LoginPrompt";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { store } from "@/lib/data";
import { AUTH_COPY } from "@/lib/auth/microcopy";
import { isAuthRequired } from "@/lib/auth/auth-error";
import {
  ACCURACY_LABEL,
  ACCURACY_ORDER,
  STANCE_LABEL,
  STANCE_ORDER,
} from "@/lib/curation/labels";
import type { AccuracyFlag, Stance } from "@/lib/data/types";
import { parseVideoUrl } from "@/lib/embed/facade";

// Closed CURATION enums (docs/CURATION_STANDARD.md §2/§3). The Topic Page v1 build
// is the full curation UX; this lightweight form remains for the prototype's
// existing add path.
const STANCES: Stance[] = STANCE_ORDER;
const ACCURACY: AccuracyFlag[] = ACCURACY_ORDER;

// A minimal home-style header row so the auth affordance + the login gate have a home on
// /contribute (design §1b — the page had no app header before C). As of #66 this is the shared
// SiteHeader, aligned to the page's max-w-xl reading column.
function ContributeHeader() {
  return (
    <SiteHeader containerClassName="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 px-4 py-3" />
  );
}

export default function ContributePage() {
  const { status } = useSession();
  const [qid, setQid] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [stance, setStance] = useState<Stance>("explainer");
  const [accuracyFlag, setAccuracyFlag] = useState<AccuracyFlag>("accurate");
  const [error, setError] = useState<string | null>(null);
  const [savedQid, setSavedQid] = useState<string | null>(null);
  // Async-write state (design §"async write — awaited"). The add is now a server round-trip
  // that can be PENDING and can FAIL — localStorage could be neither. The write is AWAITED
  // (never optimistic): success shows only after the server confirms; on failure every typed
  // field is preserved and the submit re-enables as a retry (no silent loss of the note).
  const [submitting, setSubmitting] = useState(false);
  const [announce, setAnnounce] = useState("");
  const submitRef = useRef<HTMLButtonElement>(null);
  // Set when an awaited add fails, to return focus to the (re-enabled) submit button
  // AFTER it re-renders enabled (a disabled element can't take focus) — design §"Focus
  // management": a keyboard user can immediately retry instead of focus dropping to <body>.
  const refocusOnFail = useRef(false);
  // OAuth-return error (design §4): meta.wikimedia.org / Auth.js can bounce back with
  // ?error=… (cancelled or provider failure). Map it to the honest, non-blocking notice
  // shown above the login gate's "Log in with Wikipedia" Try-again button.
  const [oauthError, setOauthError] = useState<string | null>(null);
  // The URL to return to after login, preserving ?qid= so the form lands prefilled (§2a).
  // Built from the live location on the client (this page is a client component).
  const [callbackUrl, setCallbackUrl] = useState("/contribute");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("qid");
    if (p) setQid(p);
    setCallbackUrl(`${window.location.pathname}${window.location.search}`);
    const err = params.get("error");
    if (err) {
      setOauthError(
        err === "AccessDenied"
          ? AUTH_COPY.errors.cancelled
          : AUTH_COPY.errors.provider
      );
    }
  }, []);

  // After a failed add re-enables the submit, return focus to it (DEFECT-2). Runs once the
  // re-render with `submitting === false` has committed, so the button is focusable.
  useEffect(() => {
    if (!submitting && refocusOnFail.current) {
      refocusOnFail.current = false;
      submitRef.current?.focus();
    }
  }, [submitting]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // guard against a double-submit firing two addClips
    setError(null);
    // Client-side validation stays SYNCHRONOUS, BEFORE the round-trip (design parity).
    const id = qid.trim();
    if (!id) return setError("A topic Wikidata QID is required (e.g. Q146).");
    const parsed = parseVideoUrl(videoUrl);
    if (!parsed)
      return setError(
        "Unrecognized video URL — YouTube, TikTok, or Instagram supported."
      );
    if (!contextNote.trim())
      return setError("A context note is the point — please add one.");

    const platformLabel =
      parsed.platform === "youtube"
        ? "YouTube"
        : parsed.platform === "tiktok"
          ? "TikTok"
          : parsed.platform === "instagram"
            ? "Instagram"
            : "Video";

    setSubmitting(true);
    setAnnounce("Adding clip…");
    try {
      await store.upsertTopic({ qid: id, title: id });
      await store.addClip({
        topicQid: id,
        platform: parsed.platform,
        platformLabel,
        orientation: "horizontal",
        watchUrl: videoUrl,
        embedUrl: parsed.embedUrl,
        thumbnailUrl: parsed.thumbnailUrl,
        caption: contextNote.trim().slice(0, 80),
        creator: {
          handle: handle.trim() || "@unknown",
          name: handle.trim() || "Unknown creator",
          platform: parsed.platform,
        },
        contextNote: contextNote.trim(),
        stance,
        accuracyFlag,
        general: true,
      });
      setAnnounce("Clip added.");
      setSavedQid(id); // success view — only AFTER the server confirms (awaited)
    } catch (err) {
      // Issue C (design §4): a session that expired between render and submit is rejected at
      // the auth-gated boundary (AC7). Surface the expired-session prompt in the error slot
      // (every typed field is preserved; the form falls back to the gate on re-render once
      // the session is gone) rather than the generic save-failure copy.
      const message = isAuthRequired(err)
        ? AUTH_COPY.errors.expiredSession
        : "Couldn't save your clip — please try again.";
      // Write failure (DB down / network / constraint / expired auth). Keep every typed field,
      // show an honest error in the same red slot validation uses, re-enable submit as a retry,
      // and do NOT show the "Clip added." success (no false success, no silent loss).
      setError(message);
      setAnnounce(message);
      // Return focus to the submit (re-enabled below) so a keyboard user can retry without
      // focus dropping to <body> (DEFECT-2). The effect on `submitting` does the focus once
      // the button re-renders enabled.
      refocusOnFail.current = true;
    } finally {
      setSubmitting(false);
    }
  }

  if (savedQid) {
    return (
      <>
        <ContributeHeader />
        <div className="mx-auto max-w-xl space-y-3 px-4 py-8">
          <p className="text-sm text-ink">Clip added.</p>
          {/* Back-compat entry: this lightweight form only knows the QID, so it links via
              the ?qid= path; TopicView resolves QID→title and canonicalizes the URL. */}
          <Link
            href={`/topic/?qid=${encodeURIComponent(savedQid)}`}
            className="text-action underline"
          >
            View the topic →
          </Link>
        </div>
        <SiteFooter containerClassName="mx-auto max-w-xl px-4" />
      </>
    );
  }

  // ── Logged-out gate (AC10 / design §2a). Do NOT render the form fields to a logged-out
  // user (an unusable form is the dead-end / false-affordance D7 forbids); show the login
  // gate panel instead, keeping the "Add a clip" heading and preserving ?qid= via callbackUrl.
  // While the session is still resolving, hold a neutral placeholder to avoid a form↔gate flash.
  if (status !== "authenticated") {
    return (
      <>
        <ContributeHeader />
        <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
          <h1 className="text-2xl font-semibold text-ink">
            {AUTH_COPY.contributeGateHeading}
          </h1>
          {status === "loading" ? (
            <div
              aria-hidden
              className="h-40 w-full animate-pulse rounded-xl border-2 border-ink/10 bg-ink/5"
            />
          ) : (
            <LoginPromptPanel
              title={AUTH_COPY.gates.contribute.title}
              body={AUTH_COPY.gates.contribute.body}
              callbackUrl={callbackUrl}
              secondaryHref="/"
              secondaryLabel={AUTH_COPY.gates.contribute.secondaryLabel}
              error={oauthError}
            />
          )}
        </main>
        <SiteFooter containerClassName="mx-auto max-w-xl px-4" />
      </>
    );
  }

  return (
    <>
      <ContributeHeader />
      <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-semibold text-ink">Add a clip</h1>

      <Field label="Topic Wikidata QID">
        <input
          value={qid}
          onChange={(e) => setQid(e.target.value)}
          placeholder="Q146"
          className="input"
        />
      </Field>

      <Field label="Video URL">
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="input"
        />
      </Field>

      <Field label="Creator handle">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@creator"
          className="input"
        />
      </Field>

      <Field label="Context note — what's fact vs. the creator's opinion">
        <textarea
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          rows={4}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Stance">
          <select
            value={stance}
            onChange={(e) => setStance(e.target.value as Stance)}
            className="input"
          >
            {STANCES.map((s) => (
              <option key={s} value={s}>
                {STANCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Accuracy">
          <select
            value={accuracyFlag}
            onChange={(e) => setAccuracyFlag(e.target.value as AccuracyFlag)}
            className="input"
          >
            {ACCURACY.map((a) => (
              <option key={a} value={a}>
                {ACCURACY_LABEL[a]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {/* Polite live region (design a11y): announces the awaited write's pending→result
          transition for AT, mirroring what the sighted user sees on the button + success
          view. Reuses the project's polite-region pattern (not assertive). */}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <button
        ref={submitRef}
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-action focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Adding…" : "Add clip"}
      </button>
      </form>
      <SiteFooter containerClassName="mx-auto max-w-xl px-4" />
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
