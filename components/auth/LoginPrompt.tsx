"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useId, useState } from "react";
import { ModalShell } from "@/components/topic/ModalShell";
import { AUTH_COPY } from "@/lib/auth/microcopy";
import { currentCallbackUrl } from "@/lib/auth/callback-url";
import { WikiGlyph } from "./WikiGlyph";

// ── LoginPrompt (issue C, design §2 / §9). ────────────────────────────────────────────────
// The gate UI a logged-out contribute attempt resolves to (AC10 / D7): never a dead end, a
// silent no-op, a raw error, or a false "saved." Two forms:
//   - `LoginPromptPanel`  — inline panel (for /contribute).
//   - `LoginPromptDialog` — the same content inside ModalShell (Curate / Add gates, and the
//                            dismiss-gate fallback). Reuses ModalShell verbatim for the
//                            focus-trap / Esc / return-focus a11y (design §7).
// Both render the canonical login button (its click IS the redirect) and an optional error
// notice slot so an OAuth-return error / expired-session can be shown in the same component
// (design §4). Microcopy (design §5) is passed in verbatim by the caller.

/** The canonical "Log in with Wikipedia" button — its click is the full-page OAuth redirect.
 *  `callbackUrl` is optional: when omitted, the live URL is read at click time (no render-time
 *  useSearchParams, so a prerendered route needs no Suspense bailout — §3). */
function LoginButton({
  callbackUrl,
  onIndigo = false,
}: {
  callbackUrl?: string;
  onIndigo?: boolean;
}) {
  const [connecting, setConnecting] = useState(false);
  return (
    <button
      type="button"
      aria-busy={connecting}
      disabled={connecting}
      onClick={() => {
        setConnecting(true);
        void signIn("wikimedia", {
          callbackUrl: callbackUrl ?? currentCallbackUrl(),
        });
      }}
      className={`hardbox-sm inline-flex min-h-[44px] items-center gap-1.5 border-2 border-ink px-3 py-2 text-sm font-bold transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none disabled:cursor-progress disabled:opacity-80 ${
        onIndigo ? "bg-white text-action" : "bg-brand text-white"
      }`}
    >
      <WikiGlyph className="h-4 w-4 shrink-0" />
      {connecting ? "Connecting…" : "Log in with Wikipedia"}
    </button>
  );
}

/**
 * The gate data disclosure (issue #66, design §3.3–§3.4). Rendered ONCE here, below the gate's own
 * `{body}` and above the error slot, so EVERY gate (contribute / curate / add / dismiss / upvote)
 * inherits the same disclosure with no per-gate drift. A quiet secondary note (hairline top rule,
 * `text-ink2` body, the lead bold for legibility BY WEIGHT — never color), plus a real in-SPA
 * `<Link>` to the anonymous-reachable `/about/data` for the fuller read (AC1/AC2). The WORD "About
 * your data" is the complete accessible label; the trailing `→` is decorative reinforcement.
 */
function GateDataNotice() {
  return (
    <div className="border-t border-ink/15 pt-3">
      <p className="text-[12px] leading-relaxed text-ink2">
        <span className="font-bold text-ink">{AUTH_COPY.dataNotice.gateLead}</span>{" "}
        {AUTH_COPY.dataNotice.gateBody}
      </p>
      <Link
        href="/about/data"
        className="mt-1 inline-block text-[12px] font-bold text-link hover:underline focus-visible:underline"
      >
        {AUTH_COPY.dataNotice.gateLinkLabel}{" "}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

/** An honest, non-blocking error notice (design §4 / §8). Full sentence, never color alone. */
function ErrorNotice({ message }: { message: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="border-2 border-accred bg-[#FDEDED] px-3 py-2 text-[12px] font-semibold text-accred"
    >
      {message}
    </p>
  );
}

/** Inline gate panel — replaces the /contribute form when logged out (design §2a). */
export function LoginPromptPanel({
  title,
  body,
  callbackUrl,
  secondaryHref,
  secondaryLabel,
  error,
}: {
  title: string;
  body: string;
  callbackUrl?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  error?: string | null;
}) {
  return (
    <section className="plus-card overflow-hidden">
      <div className="flex items-center gap-2 border-b-2 border-ink bg-brand px-3 py-2 text-white">
        <WikiGlyph className="h-5 w-5 shrink-0" />
        <h2 className="plus-disp text-lg font-bold">{title}</h2>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm leading-relaxed text-ink2">{body}</p>
        <GateDataNotice />
        {error && <ErrorNotice message={error} />}
        <div className="flex flex-wrap items-center gap-3">
          <LoginButton callbackUrl={callbackUrl} />
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              className="text-sm font-bold text-link hover:underline"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** Modal gate — the same content inside ModalShell (Curate / Add / dismiss-fallback, §2b–d). */
export function LoginPromptDialog({
  title,
  body,
  callbackUrl,
  onClose,
  error,
}: {
  title: string;
  body: string;
  callbackUrl?: string;
  onClose: () => void;
  error?: string | null;
}) {
  const titleId = useId();
  return (
    <ModalShell onClose={onClose} labelledBy={titleId} className="w-full max-w-md">
      <div className="plus-card max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-brand px-3 py-2 text-white">
          <h2 id={titleId} className="plus-disp text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="text-lg font-bold"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm leading-relaxed text-ink2">{body}</p>
          <GateDataNotice />
          {error && <ErrorNotice message={error} />}
          <div className="flex flex-wrap gap-2">
            <LoginButton callbackUrl={callbackUrl} />
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-ink bg-white px-3 py-2 text-sm font-bold text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
