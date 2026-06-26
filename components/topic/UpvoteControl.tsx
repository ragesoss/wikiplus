"use client";

import {
  VOTED_LABEL,
  readonlyUpvoteCount,
  upvoteAccessibleName,
} from "@/lib/curation/upvote-copy";

// ── The upvote control (issue #55 / D4, design §3–§5/§9; #71 design §4). ─────────────────────
// On both surfaces — the `ClipCard` footer (light, §4) and the curated `GeneralStrip` tile (indigo
// band, §5) — this renders one of two faces decided by `signedIn`:
//
//   SIGNED IN → an interactive, text-labeled, one-per-user TOGGLE. State is carried by MORE THAN
//     COLOR (CURATION §4 / §9): (1) a visible "Voted" WORD when voted; (2) `aria-pressed`
//     (true voted / false not — a real toggle button); (3) a filled-vs-outline GLYPH SHAPE
//     (▲ filled / △ outline). Color only reinforces. It is presentational: the host (TopicView)
//     owns the optimistic-with-rollback toggle; it is NEVER the security control — the server-side
//     `requireContributor()` gate inside `toggleUpvoteAction` is (AC4/AC5).
//
//   LOGGED OUT (#71 §4) → a STATIC READ-ONLY count label, NOT a control. The displayed count is
//     derived from distinct real identities (upvotes.md) and reading it is anonymous, so it stays
//     as social proof; only the "Log in to upvote" call-to-action is removed. It is a plain
//     `<span>` (no `role`, no `tabindex`, no `aria-pressed`, no button chrome — never announced as
//     a disabled control, §4.2/§9), text-labeled with the honest "N upvotes" noun. A count of 0
//     renders NOTHING (no "0 upvotes" — §4.1); `voted`/`onActivate` are unused logged out.

export function UpvoteControl({
  count,
  voted,
  signedIn,
  surface,
  onActivate,
  appearance = "inline",
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
  /**
   * Presentation. `inline` (default) is the borderless text control used on the rail card + the
   * legacy band tone. `tag` renders a chip-height OUTLINE pill so the upvote can sit inline with the
   * Stance/Accuracy chips on the General hero + curated tiles — same height as a chip, but white-fill
   * (an action) not a colored signal fill. State semantics are identical in both appearances.
   */
  appearance?: "inline" | "tag";
}) {
  const tag = appearance === "tag";
  // The chip-height outline pill (matches `Chips.tsx`'s box: border-2 hardbox, px-2 py-0.5, 10px bold
  // uppercase). White `surface-raised` fill + ink text reads as an ACTION beside the filled signal
  // chips; the ▲/△ glyph is violet. AA: ink on white (and on the indigo band the white pill clears it).
  const tagBase =
    "inline-flex items-center gap-1 border-2 border-hardbox bg-surface-raised px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-plus";
  // ── Logged-out branch (#71 §4): a STATIC READ-ONLY count label, NOT a control. ──
  // A clip with no upvotes shows nothing (no "0 upvotes" — §4.1); otherwise a plain `<span>`
  // carrying the honest "N upvotes" noun. No `role`/`tabindex`/`aria-pressed`/`onClick`/button
  // chrome — it must read as a figure and never be announced as a (disabled) control (§4.2/§9).
  // `voted`/`onActivate` are unused here.
  if (!signedIn) {
    if (count <= 0) return null;
    if (tag) {
      // Static figure styled as a tag — inline with the chips at chip height, but NOT a control
      // (a plain <span>, never announced as a button — #71 §4.2). Visible "▲ N"; the honest noun
      // is sr-only so AT still hears "N upvotes".
      return (
        <span className={tagBase}>
          <span aria-hidden className="text-[11px] leading-none text-violet">
            ▲
          </span>
          <span aria-hidden>{count}</span>
          <span className="sr-only">{readonlyUpvoteCount(count)}</span>
        </span>
      );
    }
    // The decorative filled `▲` is a typographic bullet matching the upvote family — NOT the
    // outline `△` (the control's "not-voted" shape, which would imply an actionable toggle, §4.2).
    // Tone: muted ink on the light card, white on the indigo band — quiet figure, never the
    // deep-violet the *control* uses and never the band's persistent underline (§4.2).
    const figureTone =
      surface === "indigo"
        ? "text-white"
        : "text-muted";
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-bold ${figureTone}`}
      >
        <span aria-hidden>▲</span>
        {readonlyUpvoteCount(count)}
      </span>
    );
  }

  const state: "not-voted" | "voted" = voted ? "voted" : "not-voted";
  const accessibleName = upvoteAccessibleName(state, count);
  // Filled (▲) when voted, outline (△) otherwise — a SHAPE difference, not only color (§4.2/§9).
  const glyph = state === "voted" ? "▲" : "△";

  if (tag) {
    // Interactive tag toggle — identical state model to the inline control (aria-pressed + the ▲/△
    // SHAPE + the visible "Voted" word; never color-alone), shaped as the chip-height outline pill so
    // it sits in the chips row. The hover offset-shadow + the global focus ring give the affordance.
    return (
      <button
        type="button"
        aria-pressed={voted}
        aria-label={accessibleName}
        onClick={onActivate}
        className={`${tagBase} hover:shadow-[2px_2px_0_var(--color-hardbox-offset)]`}
      >
        <span aria-hidden className="text-[11px] leading-none text-violet">
          {glyph}
        </span>
        <span aria-hidden>{count}</span>
        {state === "voted" && <span aria-hidden>· {VOTED_LABEL}</span>}
      </button>
    );
  }

  // Tone per surface. On light: the deep-violet `#5248AF` (the existing `--color-violet` token,
  // the design's AA-safe deep indigo) clears WCAG AA (≈5.9:1 on white) at 10–11px (§4.4 / §9.3) —
  // NOT the lighter brand `#676EB4` (≈4.0:1, below AA for normal text). On indigo: white, bold;
  // the voted state adds a persistent UNDERLINE (the underline, not a color shift, carries the
  // toggled/actionable cue on the band, AA-safe — §5.2/§5.4). A comfortable tap target (≥24px — §11).
  const base =
    "inline-flex items-center gap-1 font-bold text-[11px] py-1 -my-1 focus-visible:outline-none";
  const tone =
    surface === "indigo"
      ? `text-white ${state === "voted" ? "underline" : "hover:underline"}`
      : `text-violet ${state === "voted" ? "" : "hover:underline"}`;

  return (
    <button
      type="button"
      aria-pressed={voted}
      aria-label={accessibleName}
      onClick={onActivate}
      className={`${base} ${tone}`}
    >
      <span aria-hidden>{glyph}</span>
      <span aria-hidden>{count}</span>
      {/* The visible state WORD (text-carried signal, never color-alone — §9). */}
      {state === "voted" && <span aria-hidden>· {VOTED_LABEL}</span>}
    </button>
  );
}
