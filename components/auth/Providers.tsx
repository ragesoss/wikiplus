"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

// Client session context (issue C). Wraps the whole tree in `app/layout.tsx` so any client
// component (`AuthControl`, the contribute gate, the TopicView gate seam) can read session
// state via `useSession()`. The session is resolved from the JWT cookie through Auth.js's
// /api/auth/session endpoint — NOT a per-render DB hit (AC4). It does NOT add work to the
// cached read path: the reader still loads the page anonymously; the session fetch is the one
// extra client request that resolves the header affordance.
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
