"use client";

import { useEffect } from "react";
import { ssrSmokeAction } from "@/lib/server/smoke-action";

// SMOKE ARTIFACT (issue #37, AC7) — NOT a product feature. Renders NOTHING.
//
// Mounted once from app/layout.tsx so an app load exercises the Server Action and
// leaves console evidence that it executed on the server. This is the "enable, don't
// build" proof that Server Actions are an available capability for milestone items
// B/C/D. It is a no-op for the reader: no UI, no data, no reader-visible behavior.
//
// Remove this component (and lib/server/smoke-action.ts) when a real Server Action
// lands — at that point the capability is proven by the real feature.
export function SmokeActionProbe() {
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await ssrSmokeAction();
        if (!alive) return;
        // eslint-disable-next-line no-console
        console.info(
          `[wiki+ smoke] Server Action ran on server=${res.ranOnServer} at ${res.ranAt} (AC7; remove with the first real Server Action)`
        );
      } catch {
        // A swallowed failure here is the smoke alarm: Server Actions are NOT working.
        // eslint-disable-next-line no-console
        console.warn("[wiki+ smoke] Server Action did NOT execute (AC7 capability check failed)");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
