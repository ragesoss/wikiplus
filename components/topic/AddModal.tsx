"use client";

import { useSession } from "next-auth/react";
import { useId, useRef, useState } from "react";
import { parseVideoUrl, type ParsedVideo } from "@/lib/embed/facade";
import { resolveOEmbedAction, type ResolvedMeta } from "@/lib/embed/oembed";
import type { Clip, Platform } from "@/lib/data/types";
import { AUTH_COPY } from "@/lib/auth/microcopy";
import { CurateFields } from "./CurateForm";
import { ModalActionRow } from "./ModalActionRow";
import { ModalShell } from "./ModalShell";
import { useCurateSubmit, type SubmitOutcome } from "./useCurateSubmit";
import { clipFromForm, type ClipMediaSource } from "./curate-clip";
import {
  deriveHandle,
  placeholderMediaSource,
  resolvedMediaSource,
} from "./add-media";

const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Link",
};

// "Add a video" by-link modal — the add-by-link metadata flow (issue #64, design
// docs/design/add-link-metadata.md; spec docs/specs/add-link-metadata.md AC1–AC10).
//
// The A→B→{C|D|E|F|G} state machine the design specifies:
//   A LINK ENTRY     — url field + "Fetch details"; no preview yet.
//   B RESOLVING      — fetch in flight (aria-busy + a polite "Fetching video details…").
//   C RESOLVED       — real title→caption, real creator name + outbound link (+ derived handle),
//                      real thumbnail; "Resolved via oEmbed" eyebrow shows HERE ONLY (AC3).
//   D FAILURE        — recognized link, fetch failed: "Couldn't fetch video details" + Try again /
//                      Add anyway / Cancel (blue/neutral, NOT red — distinct from F). No false
//                      "resolved via oEmbed".
//   E PLACEHOLDER    — "Add anyway" accepted: honest non-linked "Creator not resolved" credit (C10).
//   F UNRECOGNIZED   — existing red parse-error validation, UNCHANGED (AC9).
//   G TIKTOK/UNSUPP. — D-TikTok placeholder arm: a recognized TikTok/Instagram link skips B→C/D and
//                      resolves straight to the E placeholder + an MVP-limitation line (no Try again).
//
// The curate fields + Add row render ONLY once a media source the curator has SEEN is in hand —
// state C (resolved) or state E/G (accepted placeholder) — preserving AC9's "a recognized link must
// have resolved before submit is enabled". The host (TopicView) owns the write + upsert + state.
// Reached ONLY when signed in (the gate is at the trigger in TopicView).

/** The modal's resolve phase (the state machine above). */
type Phase =
  | { kind: "entry" } // A (also: an unrecognized link sets `linkError` while staying here — F)
  | { kind: "resolving"; parsed: ParsedVideo } // B
  | { kind: "resolved"; parsed: ParsedVideo; meta: ResolvedMeta } // C
  | { kind: "failed"; parsed: ParsedVideo } // D
  | { kind: "placeholder"; parsed: ParsedVideo; unsupported: boolean }; // E (Add anyway) / G (unsupported)

export function AddModal({
  sections,
  topicQid,
  onClose,
  onSubmit,
}: {
  sections: { slug: string; title: string }[];
  /** The page's resolved Wikidata QID — keys the clip's parent topic (AC4). */
  topicQid: string;
  onClose: () => void;
  /**
   * Persist the assembled clip (host owns the write + the upsert-if-new + state). Resolves
   * `{ outcome: "added" }` on success or `{ outcome: "expired" }` when the session expired
   * (host shows the gate); REJECTS on a generic server error (modal stays open + shows alert).
   */
  onSubmit: (
    clip: Omit<Clip, "id" | "createdAt">,
    agreed: boolean
  ) => Promise<SubmitOutcome>;
}) {
  const { data: session } = useSession();
  const identityHandle = session?.user?.username;
  const titleId = useId();
  const licenseStatementId = useId();
  const [link, setLink] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "entry" });
  const [linkError, setLinkError] = useState(false);
  const submit = useCurateSubmit();

  // Move focus to the Context note textarea on reveal (design §5/§7/§12.3): C/E/G land the
  // keyboard/AT user where the work continues. A ref to the curate region's first field.
  const noteRef = useRef<HTMLTextAreaElement>(null);
  // Move focus to "Try again" on entering D (design §6/§12.3): one-Enter recovery.
  const tryAgainRef = useRef<HTMLButtonElement>(null);

  // `alive` guard: a resolve that returns AFTER the modal is gone (cancelled mid-flight) must not
  // flip state. Bumped each resolve so a stale resolve (e.g. a slow attempt the curator superseded
  // by a re-fetch) is ignored. Mirrors useCurateSubmit's pattern.
  const resolveSeq = useRef(0);

  function focusNoteSoon() {
    // After the curate fields paint (next tick), move focus to the note (design §12.3).
    requestAnimationFrame(() => noteRef.current?.focus());
  }

  async function runResolve(parsed: ParsedVideo) {
    const seq = ++resolveSeq.current;
    setLinkError(false);
    setPhase({ kind: "resolving", parsed });
    const result = await resolveOEmbedAction(parsed.platform, link.trim());
    if (seq !== resolveSeq.current) return; // superseded/cancelled — ignore the late resolve.
    if (result.ok) {
      setPhase({ kind: "resolved", parsed, meta: result.meta });
      focusNoteSoon();
    } else if (result.reason === "unsupported") {
      // D-TikTok placeholder arm (state G): a recognized platform we don't fetch → honest
      // placeholder + MVP-limitation line, no "Try again".
      setPhase({ kind: "placeholder", parsed, unsupported: true });
      focusNoteSoon();
    } else {
      // A recognized link we tried and couldn't fetch (state D) → Try again / Add anyway / Cancel.
      setPhase({ kind: "failed", parsed });
      requestAnimationFrame(() => tryAgainRef.current?.focus());
    }
  }

  function fetchDetails() {
    const result = parseVideoUrl(link.trim());
    if (!result) {
      // Unrecognized link (state F / AC9): the modal's OWN pre-persistence validation. Persistence
      // is never reached; distinct from the §6 resolution failure (state D). UNCHANGED behavior.
      setLinkError(true);
      setPhase({ kind: "entry" });
      return;
    }
    void runResolve(result);
  }

  // The media source the curator has SEEN — resolved (C) or the accepted placeholder (E/G). Only
  // these phases render the curate fields + Add row, so `mediaSource()` is only ever called for one
  // of them; `entry` returns null (the form's submit guard also blocks it).
  function mediaSource(): ClipMediaSource | null {
    if (phase.kind === "resolved") {
      return resolvedMediaSource(
        phase.parsed,
        phase.meta,
        PLATFORM_LABEL[phase.parsed.platform],
        topicQid,
        link.trim()
      );
    }
    if (phase.kind === "placeholder") {
      return placeholderMediaSource(
        phase.parsed,
        PLATFORM_LABEL[phase.parsed.platform],
        topicQid,
        link.trim()
      );
    }
    return null;
  }

  const resolving = phase.kind === "resolving";
  // The curate surface renders once a media source is in hand (design invariant §2).
  const showCurate = phase.kind === "resolved" || phase.kind === "placeholder";

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={titleId}
      className="w-full max-w-lg"
      initialFocusSelector="input[name=link]"
    >
      <form
        className="plus-card max-h-[90vh] overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          const media = mediaSource();
          if (!media) return;
          const form = e.currentTarget;
          void submit.run(
            () => onSubmit(clipFromForm(form, media, sections), submit.agreed),
            onClose,
            // add-by-link extra precondition: a media source the curator has seen is in hand
            // (resolved OR an accepted placeholder) — the extended AC9 precondition.
            true
          );
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-brand px-3 py-2 text-white">
          <h2 id={titleId} className="plus-disp text-lg font-bold">
            Add a video
          </h2>
          <div className="flex items-center gap-2">
            {identityHandle && (
              <span className="border border-white/60 px-1.5 py-0.5 text-[10px] font-bold">
                signed in as {identityHandle}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel"
              className="text-lg font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-violet">
              Paste a YouTube or TikTok share link
            </span>
            <div className="flex gap-2">
              <input
                name="link"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://youtu.be/… or https://www.tiktok.com/@user/video/…"
                className="field"
              />
              <button
                type="button"
                onClick={fetchDetails}
                disabled={resolving}
                className="shrink-0 border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
              >
                {resolving ? "Fetching…" : "Fetch details"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              We&apos;ll look up the video&apos;s title, creator, and thumbnail
              from the platform.
            </p>
          </label>

          {/* State F — Unrecognized link (AC9), UNCHANGED: red accred validation alert. */}
          {linkError && (
            <div
              role="alert"
              className="border-2 border-accred bg-[#FDEDED] px-3 py-2 text-[12px] font-semibold text-accred"
            >
              Unrecognized link — paste a YouTube or TikTok URL.
            </div>
          )}

          {/* State B — Resolving (design §4): a polite, accessible, reduced-motion-safe panel in
              the SAME container as the preview so the layout doesn't jump when it resolves into C. */}
          {resolving && (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="flex items-center gap-3 border-l-4 border-brand bg-bg2 p-3"
            >
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink border-t-transparent motion-reduce:hidden"
              />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-ink">
                  Fetching video details…
                </p>
                <p className="truncate text-[11px] text-ink2">{link.trim()}</p>
              </div>
            </div>
          )}

          {/* State C — Resolved preview (design §5): real thumbnail + title + outbound creator
              credit mirroring ClipCard; "Resolved via oEmbed" eyebrow renders HERE ONLY (AC3). */}
          {phase.kind === "resolved" && (
            <ResolvedPreview
              meta={phase.meta}
              parsed={phase.parsed}
              platformLabel={PLATFORM_LABEL[phase.parsed.platform]}
            />
          )}

          {/* State D — Resolution failure (design §6, AC4/AC5): blue/neutral (NOT red) notice +
              Try again / Add anyway / Cancel. No "resolved via oEmbed", no fabricated metadata. */}
          {phase.kind === "failed" && (
            <div
              role="alert"
              className="space-y-3 border-2 border-action bg-bg2 px-3 py-3"
            >
              <div>
                <p className="text-[13px] font-bold text-ink">
                  Couldn&apos;t fetch video details
                </p>
                <p className="mt-1 text-[12px] text-ink2">
                  We recognized the link but couldn&apos;t load its title,
                  creator, or thumbnail right now. Check your connection and try
                  again, or add it with the details unresolved.
                </p>
                <p className="mt-2 truncate text-[11px] text-ink2">
                  {link.trim()}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  ref={tryAgainRef}
                  onClick={() => void runResolve(phase.parsed)}
                  className="border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase({
                      kind: "placeholder",
                      parsed: phase.parsed,
                      unsupported: false,
                    });
                    focusNoteSoon();
                  }}
                  className="border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
                >
                  Add anyway
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* State E / G — Unresolved placeholder (design §7/§8, AC5/AC6; C10): honest, non-linked
              "Creator not resolved" credit; dashed (un-vouched) container; "Not resolved" eyebrow. */}
          {phase.kind === "placeholder" && (
            <PlaceholderPreview
              platformLabel={PLATFORM_LABEL[phase.parsed.platform]}
              link={link.trim()}
              unsupported={phase.unsupported}
            />
          )}

          {showCurate && (
            <>
              <CurateFields
                sections={sections}
                onPreconditionsChange={submit.setPreconditions}
                licenseStatementId={licenseStatementId}
                noteRef={noteRef}
              />

              <ModalActionRow
                publishIdleLabel="＋ Add & curate"
                publishBusyLabel="Adding…"
                canPublish={
                  submit.hasNote &&
                  (!submit.materialNote || submit.agreed) &&
                  showCurate
                }
                pending={submit.pending}
                error={submit.error}
                // D5a (design §5.1): calm limit notice on the rate-limit outcome.
                variant={submit.errorKind === "limited" ? "limit" : "error"}
                errorMessage={
                  submit.errorKind === "limited"
                    ? AUTH_COPY.rateLimit.notice
                    : undefined
                }
                licenseStatementId={licenseStatementId}
                onCancel={onClose}
              />
            </>
          )}
        </div>
      </form>
    </ModalShell>
  );
}

/**
 * State C resolved preview (design §5). Mirrors ClipCard's credit anatomy so the curator previews
 * what the reader will see: a real thumbnail (with a gradient fallback if it 404s — a missing
 * thumbnail is NOT a resolution failure), the platform pill, the "Resolved via oEmbed" eyebrow
 * (HERE ONLY — AC3), the real title (clamped), and the outbound creator credit (name + derived
 * handle · platform, name-only when no handle derives — C10).
 */
function ResolvedPreview({
  meta,
  parsed,
  platformLabel,
}: {
  meta: ResolvedMeta;
  parsed: ParsedVideo;
  platformLabel: string;
}) {
  const [thumbBroken, setThumbBroken] = useState(false);
  const thumb = meta.thumbnailUrl ?? parsed.thumbnailUrl;
  const handle = deriveHandle(meta.authorName);
  return (
    <>
      {/* Polite success announcement (design §5 a11y / copy #8). */}
      <p role="status" aria-live="polite" className="sr-only">
        Video details resolved: {meta.title} by {meta.authorName}.
      </p>
      <div className="flex gap-3 border-l-4 border-brand bg-bg2 p-3">
        {thumb && !thumbBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            onError={() => setThumbBroken(true)}
            className="h-16 w-24 shrink-0 border-2 border-ink object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="candthumb relative block h-16 w-24 shrink-0 border-2 border-ink bg-gradient-to-br from-brand to-violet"
          />
        )}
        <div className="min-w-0">
          <span className="inline-block bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {platformLabel}
          </span>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet">
            Resolved via oEmbed
          </p>
          <p className="line-clamp-2 text-[13px] font-bold text-ink">
            {meta.title}
          </p>
          {/* Creator credit mirroring ClipCard (CURATION §5.2 / C10): outbound author_url link,
              name + "{handle} · {platform}" (name-only when no handle derives). */}
          {meta.authorUrl ? (
            <a
              href={meta.authorUrl}
              target="_blank"
              rel="noopener"
              className="mt-1 block min-w-0"
            >
              <span className="block truncate text-[12px] font-bold text-ink">
                {meta.authorName}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {handle ? `${handle} · ${platformLabel}` : platformLabel}
              </span>
            </a>
          ) : (
            <span className="mt-1 block min-w-0">
              <span className="block truncate text-[12px] font-bold text-ink">
                {meta.authorName}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {handle ? `${handle} · ${platformLabel}` : platformLabel}
              </span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * State E / G placeholder preview (design §7/§8; C10). Dashed (un-vouched) container; a "Not
 * resolved" eyebrow (text, not color); an "Unresolved {Platform} clip" caption; a NON-LINKED
 * "Creator not resolved" credit (no avatar, no @handle, no outbound link — honest stand-in); the
 * pasted link kept visible; a reassurance line; and (state G only) the MVP-limitation line.
 */
function PlaceholderPreview({
  platformLabel,
  link,
  unsupported,
}: {
  platformLabel: string;
  link: string;
  unsupported: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-2 border-dashed border-ink/30 bg-bg2 p-3"
    >
      <span className="inline-block bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        {platformLabel}
      </span>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted">
        Not resolved
      </p>
      <p className="text-[13px] font-bold text-ink">
        Unresolved {platformLabel} clip
      </p>
      {/* Non-linked placeholder credit (C10) — the credit analogue of "seed clip · no curator". */}
      <p className="mt-1 text-[12px] font-bold text-ink">Creator not resolved</p>
      <p className="text-[11px] text-ink2">{platformLabel}</p>
      <p className="mt-1 truncate text-[11px] text-ink2">{link}</p>
      {unsupported && (
        <p className="mt-2 text-[12px] text-ink2">
          We don&apos;t fetch {platformLabel} video details yet — you can still
          add and curate this clip.
        </p>
      )}
      <p className="mt-1 text-[12px] text-ink2">
        You can still add and curate this clip — the video plays, but its title
        and creator weren&apos;t fetched.
      </p>
    </div>
  );
}
