"use client";

// ── SkinSync (issue #143 — the DB→cookie mirror at login, spec §6.1). ───────────────────────────
// A render-free client step that, once a session is established carrying a stored `skinPreference`,
// MIRRORS it into the `wikiplus-skin` cookie (and flips `data-skin` live) so the next paint's
// pre-paint bootstrap reads the cookie alone — making a fresh browser/device that logs in end up in
// the user's stored skin (AC6/AC7/AC8). This is the documented Auth.js mechanism the spec leaves to
// Dev: the preference is surfaced on the session (lib/auth/config.ts), and this thin post-login
// effect sets the cookie when it does not already carry that value.
//
// WHY THIS PRESERVES THE CACHE-AGNOSTIC GUARANTEE: the server NEVER reads the cookie/DB to render
// `data-skin` (AC9/AC10). This runs only client-side, after the session resolves. It adds no work to
// the cached read path — it rides the one `/api/auth/session` fetch the auth provider already makes.
//
// CONFLICT RULE (spec §6.1): the cookie is authoritative for rendering; login seeds it from the DB.
// A subsequent same-device toggle writes both (cookie immediately + DB), so the cookie then differs
// from the just-mirrored value — that is the user's newer explicit intent and must NOT be re-stomped.
// We therefore mirror DB→cookie ONLY ONCE per established session (guarded by a ref), at the moment
// the session first resolves: the stored preference takes effect on this device at login, and any
// later toggle on this device wins from then on (the toggle updates both, and we do not re-run).

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  applySkinToDocument,
  readSkinCookie,
  writeSkinCookie,
  type Skin,
} from "@/lib/skin/client";

export function SkinSync() {
  const { data: session, status } = useSession();
  // Mirror at most once per established session (see CONFLICT RULE above), so a later same-device
  // toggle is never re-stomped by this effect.
  const mirrored = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (mirrored.current) return;
    const pref = session?.user?.skinPreference;
    // Only a non-null stored preference seeds the cookie. A user with no stored preference falls
    // through to whatever the cookie / OS default already resolved (we touch nothing).
    if (pref !== "zine" && pref !== "zine-dark") return;
    mirrored.current = true;
    // If the cookie already carries this exact preference, the bootstrap already painted correctly —
    // nothing to do. Otherwise mirror DB→cookie and flip `data-skin` live so THIS paint is correct
    // too (not just the next navigation).
    if (readSkinCookie() === pref) return;
    const skin = pref as Skin;
    writeSkinCookie(skin);
    applySkinToDocument(skin);
  }, [status, session?.user?.skinPreference]);

  return null;
}
