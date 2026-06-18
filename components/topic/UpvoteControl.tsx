"use client";

import {
  LOGIN_TO_UPVOTE_LABEL,
  VOTED_LABEL,
  upvoteAccessibleName,
} from "@/lib/curation/upvote-copy";

// ── The upvote control (issue #55 / D4, design §3–§5/§9). ────────────────────────────────────
// One interactive, text-labeled, one-per-user TOGGLE that lives on two surfaces — the `ClipCard`
// footer (light, §4) and the curated `GeneralStrip` tile (indigo band, §5). The same behavior
// drives both; only tone/size differ (`surface`). It is a presentational control: the host
// (TopicView) owns the optimistic-with-rollback toggle + the logged-out gate route (it passes the
// already-reconciled `count`/`voted` and an `onActivate`). It is NEVER the security control — the
// server-side `requireContributor()` gate inside `toggleUpvoteAction` is (AC4/AC5).
//
// State carried by MORE THAN COLOR (CURATION §4 / §9, the load-bearing a11y rule):
//   (1) a visible "Voted" WORD when voted; (2) `aria-pressed` (true voted / false not — a real
//   toggle button); (3) a filled-vs-outline GLYPH SHAPE (▲ filled / △ outline). Color only
//   reinforces (indigo on light / white+underline on indigo). The logged-out form is the SAME
//   button WITHOUT `aria-pressed` (a gate trigger, not a toggle) and is NEVER `disabled` (a
//   disabled button is not focusable + reads as inert — §3 note). The count is ALWAYS visible.

export function UpvoteControl({
  count,
  voted,
  signedIn,
  surface,
  onActivate,
}: {
  /** The DISPLAYED derived total (seed baseline + distinct votes — Decision 2). Always shown. */
  count: number;
  /** Whether THIS viewer has voted (from `clip_vote` only — never the seed; §3 last note). */
  voted: boolean;
  /** Signed in → a real toggle (3a/3b); logged out → the "Log in to upvote" gate trigger (3d). */
  signedIn: boolean;
  /** Tone: light card (deep-indigo, §4.4) vs. indigo band (white bold+underline, §5.4). */
  surface: "light" | "indigo";
  /** Activate handler — the host's optimistic toggle (signed in) or gate route (logged out). */
  onActivate: () => void;
}) {
  const state: "not-voted" | "voted" | "logged-out" = !signedIn
    ? "logged-out"
    : voted
      ? "voted"
      : "not-voted";
  const accessibleName = upvoteAccessibleName(state, count);
  // Filled (▲) when voted, outline (△) otherwise — a SHAPE difference, not only color (§4.2/§9).
  const glyph = state === "voted" ? "▲" : "△";

  // Tone per surface. On light: the deep-violet `#5248AF` (the existing `--color-violet` token,
  // the design's AA-safe deep indigo) clears WCAG AA (≈5.9:1 on white) at 10–11px (§4.4 / §9.3) —
  // NOT the lighter brand `#676EB4` (≈4.0:1, below AA for normal text). On indigo: white, bold;
  // the voted state adds a persistent UNDERLINE (the underline, not a color shift, carries the
  // toggled/actionable cue on the band, AA-safe — §5.2/§5.4). The logged-out form on indigo is
  // also underlined (it is actionable). A comfortable tap target on both (≥24px — §11).
  const base =
    "inline-flex items-center gap-1 font-bold text-[11px] py-1 -my-1 focus-visible:outline-none";
  const tone =
    surface === "indigo"
      ? `text-white ${state !== "not-voted" ? "underline" : "hover:underline"}`
      : `text-violet ${state === "voted" ? "" : "hover:underline"}`;

  return (
    <button
      type="button"
      // `aria-pressed` ONLY for the signed-in toggle (3a/3b). The logged-out form omits it — it is
      // a gate trigger, not a toggle (§3 / §9). Setting it would mis-announce "not pressed".
      aria-pressed={signedIn ? voted : undefined}
      aria-label={accessibleName}
      onClick={onActivate}
      className={`${base} ${tone}`}
    >
      <span aria-hidden>{glyph}</span>
      <span aria-hidden>{count}</span>
      {/* The visible state WORD (text-carried signal, never color-alone — §9). */}
      {state === "voted" && <span aria-hidden>· {VOTED_LABEL}</span>}
      {state === "logged-out" && (
        <span aria-hidden>· {LOGIN_TO_UPVOTE_LABEL}</span>
      )}
    </button>
  );
}
