"use client";

import { useSession } from "next-auth/react";
import { useId, useState } from "react";
import { parseVideoUrl, type ParsedVideo } from "@/lib/embed/facade";
import type { Clip, Platform } from "@/lib/data/types";
import { AUTH_COPY } from "@/lib/auth/microcopy";
import { CurateFields } from "./CurateForm";
import { ModalActionRow } from "./ModalActionRow";
import { ModalShell } from "./ModalShell";
import { useCurateSubmit, type SubmitOutcome } from "./useCurateSubmit";
import { clipFromForm, type ClipMediaSource } from "./curate-clip";

const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Link",
};

// "Add a video" by-link modal (design §6.9 + D1). Detect platform from the link, mock a preview
// (no network — the honest "no network call" path, AC5/§8), reveal the curate fields, then
// persist (issue #52 / D1, AC4): assemble a `Clip` from the parsed link + curate values, require
// the CC BY-SA agreement (AC6), run the real submit lifecycle (§§5–7). The host (TopicView) owns
// the write — including upserting the topic first if it is not yet in the store — plus the
// clip-state update, the duplicate-suggestion dedup, and the expired-session gate.
// Reached ONLY when signed in (the gate is at the trigger in TopicView); the "signed in as"
// pill shows the REAL Wikimedia username from the session (design §1d).
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
  const [parsed, setParsed] = useState<ParsedVideo | null>(null);
  const [linkError, setLinkError] = useState(false);
  const submit = useCurateSubmit();

  function fetchDetails() {
    const result = parseVideoUrl(link.trim());
    if (!result) {
      // Unrecognized link: the modal's OWN pre-persistence validation (design §8 / AC5).
      // Persistence is never reached; distinct from the §6 server error + §7 auth error.
      setLinkError(true);
      setParsed(null);
      return;
    }
    setLinkError(false);
    setParsed(result);
  }

  // Build the media source from the parsed link + the mock preview (design §8). The watch URL
  // is the pasted link; creator credit is the minimal interim "Pasted clip" + the platform
  // (improves when a real oEmbed lands later, no shape change needed). Orientation defaults to
  // vertical (creator-driven, vertical-first — VISION) for the prototype.
  function mediaSource(p: ParsedVideo): ClipMediaSource {
    const platformLabel = PLATFORM_LABEL[p.platform];
    return {
      topicQid,
      platform: p.platform,
      platformLabel,
      orientation: "vertical",
      watchUrl: link.trim(),
      embedUrl: p.embedUrl,
      thumbnailUrl: p.thumbnailUrl,
      caption: "Pasted clip (mock preview)",
      creator: {
        handle: "pasted",
        name: `Pasted ${platformLabel} clip`,
        platform: p.platform,
      },
    };
  }

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
          if (!parsed) return;
          const form = e.currentTarget;
          void submit.run(
            () => onSubmit(clipFromForm(form, mediaSource(parsed), sections), submit.agreed),
            onClose,
            // add-by-link extra precondition: a recognized link has resolved (design §3.3/AC5).
            parsed !== null
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
                className="shrink-0 border-2 border-ink bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:shadow-[2px_2px_0_#2C2C2C]"
              >
                Fetch details
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              We detect the platform from the link and mock a preview — no network
              call.
            </p>
          </label>

          {linkError && (
            <div
              role="alert"
              className="border-2 border-accred bg-[#FDEDED] px-3 py-2 text-[12px] font-semibold text-accred"
            >
              Unrecognized link — paste a YouTube or TikTok URL.
            </div>
          )}

          {parsed && (
            <>
              <div className="flex gap-3 border-l-4 border-brand bg-bg2 p-3">
                <span
                  aria-hidden
                  className="candthumb relative block h-16 w-24 shrink-0 border-2 border-ink bg-gradient-to-br from-brand to-violet"
                />
                <div className="min-w-0">
                  <span className="inline-block bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {PLATFORM_LABEL[parsed.platform]}
                  </span>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet">
                    resolved via oEmbed
                  </p>
                  <p className="text-[13px] font-bold text-ink">
                    Pasted clip (mock preview)
                  </p>
                  <p className="truncate text-[11px] text-muted">{link.trim()}</p>
                </div>
              </div>

              <CurateFields
                sections={sections}
                onPreconditionsChange={submit.setPreconditions}
                licenseStatementId={licenseStatementId}
              />

              <ModalActionRow
                publishIdleLabel="＋ Add & curate"
                publishBusyLabel="Adding…"
                canPublish={
                  submit.hasNote &&
                  (!submit.materialNote || submit.agreed) &&
                  parsed !== null
                }
                pending={submit.pending}
                error={submit.error}
                // D5a (design §5.1): calm limit notice on the rate-limit outcome (covers a limited
                // `upsertTopic` sub-step too — one string, one treatment for "you're going too fast").
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
