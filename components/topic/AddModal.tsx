"use client";

import { useSession } from "next-auth/react";
import { useId, useState } from "react";
import { parseVideoUrl } from "@/lib/embed/facade";
import { CurateFields } from "./CurateForm";
import { ModalShell } from "./ModalShell";

// "Add a video" by-link modal (design §6.9, AC18/AC19). Detect platform from the
// link, mock a preview (no network — A7), then reveal the curate fields. Mock submit.
// Issue C: reached ONLY when signed in (the gate is at the trigger in TopicView); the
// "signed in as" pill now shows the REAL Wikimedia username from the session (design §1d).
export function AddModal({
  sections,
  onClose,
}: {
  sections: { slug: string; title: string }[];
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const identityHandle = session?.user?.username;
  const titleId = useId();
  const [link, setLink] = useState("");
  const [resolved, setResolved] = useState<{
    platform: string;
    url: string;
  } | null>(null);
  const [error, setError] = useState(false);

  function fetchDetails() {
    const parsed = parseVideoUrl(link.trim());
    if (!parsed) {
      setError(true);
      setResolved(null);
      return;
    }
    setError(false);
    setResolved({
      platform: parsed.platform === "youtube" ? "YouTube" : parsed.platform === "tiktok" ? "TikTok" : parsed.platform,
      url: link.trim(),
    });
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
          onClose(); // mock submit (A7)
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

          {error && (
            <div
              role="alert"
              className="border-2 border-accred bg-[#FDEDED] px-3 py-2 text-[12px] font-semibold text-accred"
            >
              Unrecognized link — paste a YouTube or TikTok URL.
            </div>
          )}

          {resolved && (
            <>
              <div className="flex gap-3 border-l-4 border-brand bg-bg2 p-3">
                <span
                  aria-hidden
                  className="candthumb relative block h-16 w-24 shrink-0 border-2 border-ink bg-gradient-to-br from-brand to-violet"
                />
                <div className="min-w-0">
                  <span className="inline-block bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {resolved.platform}
                  </span>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet">
                    resolved via oEmbed
                  </p>
                  <p className="text-[13px] font-bold text-ink">
                    Pasted clip (mock preview)
                  </p>
                  <p className="truncate text-[11px] text-muted">{resolved.url}</p>
                </div>
              </div>

              <CurateFields sections={sections} />

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="border-2 border-ink bg-brand px-3 py-2 text-sm font-bold text-white hover:shadow-[2px_2px_0_#2C2C2C]"
                >
                  ＋ Add &amp; curate
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </ModalShell>
  );
}
