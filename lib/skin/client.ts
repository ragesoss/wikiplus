"use client";

// ── Skin client helper (issue #143). ────────────────────────────────────────────────────────────
// The ONE place the in-app skin control's mechanics live: the resolved-skin reader, the instant
// in-place flip + the `wikiplus-skin` cookie write, the fire-and-forget DB persist, and the
// `useSkin` hook the header toggle AND the account-menu mirror both consume (one action, one state —
// design §2). Keeping the cookie + flip + persist together here means the live switch (cookie +
// `data-skin`) ALWAYS happens first and never waits on the DB write (spec §6.1 / design §4.6).
//
// This NEVER touches server markup — the skin is resolved entirely client-side (the pre-paint
// bootstrap in app/layout.tsx sets the first frame; this flips it live), so the SSR shell stays
// skin-agnostic and the cache is never fragmented by skin (AC9/AC10).

import { useCallback, useEffect, useState } from "react";
import { store } from "@/lib/data";

/** The two skins (spec A3.2). `"zine"` = the light Indigo Press zine (the default — `data-skin`
 *  absent); `"zine-dark"` = the dark skin (`data-skin="zine-dark"`). */
export type Skin = "zine" | "zine-dark";

/** The first-party cookie the pre-paint bootstrap reads (app/layout.tsx). Non-`HttpOnly` so the
 *  browser script can read it; carries no PII, is not a security token (spec A3.5). */
export const SKIN_COOKIE = "wikiplus-skin";
/** ≈1 year (spec A3.5) so the preference survives. */
const SKIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Read the RESOLVED skin from `<html>` — what the pre-paint bootstrap actually applied (including
 *  the OS-default resolution — spec §6.2 / design §4.5). `data-skin="zine-dark"` ⇒ dark; absent or
 *  `"zine"` ⇒ light. SSR-safe (returns light when there is no document). */
export function resolvedSkin(): Skin {
  if (typeof document === "undefined") return "zine";
  return document.documentElement.getAttribute("data-skin") === "zine-dark"
    ? "zine-dark"
    : "zine";
}

/** Apply a skin to `<html>` IN PLACE — flip the `data-skin` attribute with no navigation / reload /
 *  remount (AC2/AC3). The whole page re-skins through the existing `[data-skin="zine-dark"]` CSS
 *  token cascade in one frame. Light removes the attribute (so the byte-identical light render
 *  returns — AC15). */
export function applySkinToDocument(skin: Skin): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (skin === "zine-dark") el.setAttribute("data-skin", "zine-dark");
  else el.removeAttribute("data-skin");
}

/** Write the `wikiplus-skin` cookie so the pre-paint bootstrap renders this skin on the next load
 *  (AC4/AC5). First-party, `SameSite=Lax`, `Path=/`, ≈1yr `Max-Age`, NOT `HttpOnly` (the bootstrap
 *  reads it). Dark stores `"zine-dark"`; light stores the explicit `"zine"` so an explicit-light
 *  choice survives and overrides the OS dark default (spec §6.2). `Secure` is added on HTTPS so the
 *  cookie is not stripped on a secure origin. */
export function writeSkinCookie(skin: Skin): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${SKIN_COOKIE}=${skin}; Max-Age=${SKIN_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

/** Read the `wikiplus-skin` cookie's current value (or null) — used by the login DB→cookie mirror to
 *  decide whether the cookie already carries an explicit choice (spec §6.1 conflict rule). */
export function readSkinCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )wikiplus-skin=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** The destination skin of a toggle from `current`. */
export function otherSkin(current: Skin): Skin {
  return current === "zine-dark" ? "zine" : "zine-dark";
}

/**
 * The shared toggle state + action (design §2 — one source of truth). Seeds from the RESOLVED skin
 * on `<html>` AFTER mount (the bootstrap has run), so the control is honest about the OS-default skin
 * (§4.5). `ready` is false until that first-mount read, so the no-flash first-frame pattern (§4.5)
 * can defer the directional word/icon until the resolved skin is known — a dark reader never sees
 * the light label flash. `toggle()` flips the live skin + writes the cookie FIRST, then persists to
 * the DB fire-and-forget (logged-in only; a logged-out persist is a server-side no-op behind the
 * gate — spec §6.1). It does not wait on the DB write (design §4.6).
 */
export function useSkin(): {
  skin: Skin;
  ready: boolean;
  toggle: () => void;
} {
  const [skin, setSkin] = useState<Skin>("zine");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Seed from the resolved skin the bootstrap applied (after mount, so it has run).
    setSkin(resolvedSkin());
    setReady(true);
    // Keep in sync if ANOTHER instance (the header chip vs. the account-menu item) toggles: both
    // mutate the same `data-skin`, so observe it and re-read. This is what makes the two controls
    // one state without shared context — whichever the reader uses, the other reflects it.
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver(() => setSkin(resolvedSkin()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-skin"],
    });
    return () => obs.disconnect();
  }, []);

  const toggle = useCallback(() => {
    const next = otherSkin(resolvedSkin());
    // 1+2. The INSTANT switch (AC2/AC3): flip the live skin + write the cookie. No await — the visual
    // change is immediate and the next paint is already correct from the cookie.
    applySkinToDocument(next);
    writeSkinCookie(next);
    setSkin(next);
    // 3. Persist to the contributor row (logged-in only — spec §6.1). Fire-and-forget: it never gates
    // the visual switch (design §4.6). A logged-out call rejects behind the auth gate (the write is a
    // no-op for a reader with no account); swallow it so the toggle never surfaces an error.
    void store.setSkinPreference(next).catch(() => {});
  }, []);

  return { skin, ready, toggle };
}
