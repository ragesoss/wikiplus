"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { AUTH_COPY, type GateKind } from "@/lib/auth/microcopy";
import { LoginPromptDialog } from "./LoginPrompt";

// ── useRequireLogin (issue C, design §2 "implementation seam" / §9). ──────────────────────
// The single gate decision shared by every contribute entry point in TopicView (promote /
// curateFirst / onAdd / dismiss). `requireLogin({ gate, action })`:
//   - SIGNED IN  → runs `action()` immediately (the real modal opens / the dismiss runs).
//   - SIGNED OUT → opens the right `LoginPromptDialog` (gate-at-trigger, design §2; the action
//                  is NOT auto-resumed on return — UX-2) with the current URL as callbackUrl.
// It also exposes `showExpiredGate()` so a boundary `AuthRequiredError` caught mid-action
// (a session that expired between render and click) is surfaced as the expired-session gate
// (design §2d / §4 — "Your session ended — please log in again."), not a raw error.
//
// The hook returns `{ requireLogin, showExpiredGate, signedIn, gateElement }`. The host renders
// `gateElement` once; it is the modal (null when no gate is open).

interface OpenGate {
  title: string;
  body: string;
  error?: string;
}

export function useRequireLogin() {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const [gate, setGate] = useState<OpenGate | null>(null);

  /** Run `action` if signed in, else open the gate for `kind` (no auto-resume on return). */
  const requireLogin = useCallback(
    ({ gate: kind, action }: { gate: GateKind; action: () => void }) => {
      if (status === "authenticated") {
        action();
        return;
      }
      const copy = AUTH_COPY.gates[kind];
      setGate({ title: copy.title, body: copy.body });
    },
    [status]
  );

  /** Surface the expired-session gate (a boundary rejection mid-action — §2d/§4). */
  const showExpiredGate = useCallback(() => {
    setGate({
      title: AUTH_COPY.gates.curate.title,
      body: AUTH_COPY.gates.curate.body,
      error: AUTH_COPY.errors.expiredSession,
    });
  }, []);

  const gateElement = gate ? (
    <LoginPromptDialog
      title={gate.title}
      body={gate.body}
      error={gate.error}
      onClose={() => setGate(null)}
    />
  ) : null;

  return { requireLogin, showExpiredGate, signedIn, gateElement };
}
