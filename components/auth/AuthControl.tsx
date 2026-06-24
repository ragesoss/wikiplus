"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { currentCallbackUrl } from "@/lib/auth/callback-url";
import { contributorHref } from "@/lib/wiki/topicRoute";
import { WikiGlyph } from "./WikiGlyph";

// ── AuthControl (issue C, design §1 / §9). ────────────────────────────────────────────────
// The header sign-in affordance — one component, three skins (variant), three states. Reads
// session state from the JWT (useSession → /api/auth/session, NOT a per-render DB hit — AC4).
//
// No-flash first render (design §7): while the session is `loading` we render a NEUTRAL chip,
// not the signed-out button — so a signed-in reader never sees "Log in" flash then swap to
// their username (and a signed-out reader sees the button only once we know there's no
// session). The signed-out → signed-in transition is one clean step.
//
// Microcopy (design §5) is used VERBATIM. The glyph is decorative (`aria-hidden`); the WORD
// "Log in with Wikipedia" / the username / "Connecting…" is always the label (never color
// alone — design §7).

type Variant = "home" | "topic-plus" | "topic-compact";

export function AuthControl({
  variant,
  forceIconOnly = false,
}: {
  variant: Variant;
  /** topic-mobile-search §3.3: while the narrow (< md) search disclosure is OPEN, collapse the
   *  login to ICON-ONLY — hide the visible "Log in" word (logged-out) / username (logged-in),
   *  keep the WikiGlyph "W" / avatar + ▾ and the FULL aria-label (the meaning is always in the
   *  accessible tree — AC6/AC7). A CSS/visibility swap so SSR/hydration markup is identical (no
   *  flash). Only set on the topic-compact skin (< md); inert on the other skins / states. */
  forceIconOnly?: boolean;
}) {
  const { data: session, status } = useSession();
  const [connecting, setConnecting] = useState(false);

  // The login click does a full-page redirect to en.wikipedia.org; `connecting` is one-way set
  // true on that click (label → "Connecting…", disabled, aria-busy). If the user then hits browser
  // Back, the page is restored from the bfcache with React state intact, so the button would stay
  // stuck on "Connecting…" and disabled. `pageshow` fires on every show INCLUDING a bfcache restore
  // (`event.persisted`), so resetting here releases the stuck state on back-navigation. Resetting
  // unconditionally is safe — a fresh load already has `connecting === false`.
  useEffect(() => {
    const reset = () => setConnecting(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const compact = variant === "topic-compact";
  // Icon-only collapse applies only to the compact skin (the < md Topic chrome), and only while the
  // narrow search disclosure is open. On the other skins it is inert.
  const iconOnly = compact && forceIconOnly;
  // The login button reads against its surface: white-on-indigo inside the ＋plus block,
  // indigo-on-light elsewhere (design §8; AA verified in the design spec §7).
  const onIndigo = variant === "topic-plus";

  if (status === "loading") {
    // Neutral placeholder chip — never the signed-out button (no flash, §7).
    return (
      <span
        aria-hidden
        className={`inline-block h-[34px] min-h-[34px] w-20 animate-pulse rounded ${
          onIndigo ? "bg-surface-raised/25" : "bg-hardbox/10"
        }`}
      />
    );
  }

  if (status === "authenticated" && session?.user?.username) {
    return (
      <SignedIn
        username={session.user.username}
        onIndigo={onIndigo}
        compact={compact}
        iconOnly={iconOnly}
      />
    );
  }

  // Signed-out: the single "Log in with Wikipedia" action (§1a).
  // On the HOME header the lockup is left-anchored on the same 56px row as this right-anchored
  // button; on the narrowest phones the full label is too wide and would collide with the wordmark
  // (§4.5 — the auth must stay one row, right-anchored, and must not push the lockup off its anchor).
  // So the home button drops " with Wikipedia" below 480px (the width where the lockup also scales
  // down) and shows just "Log in" — a CSS-only swap so SSR/hydration markup is identical at every
  // width. The full phrase always remains the accessible name (the visible "Wikipedia" word is
  // hidden, never the meaning). The topic-compact variant keeps its always-short "Log in".
  const responsiveLabel = variant === "home" && !compact;
  const label = compact ? "Log in" : "Log in with Wikipedia";
  // Icon-only (§3.3): centre the "W" in a square ≥ 44×44 target (the px-3 padding would otherwise
  // make it a wide pill with no word). min-w-[44px] + justify-center guarantees the touch target
  // (AC14) while the glyph stays centred.
  const base = iconOnly
    ? "inline-flex min-h-[44px] min-w-[44px] items-center justify-center border-2 border-hardbox px-2 py-1.5 text-sm font-bold transition hover:shadow-[2px_2px_0_var(--color-hardbox-offset)] disabled:cursor-progress disabled:opacity-80"
    : "inline-flex min-h-[44px] items-center gap-1.5 border-2 border-hardbox px-3 py-1.5 text-sm font-bold transition hover:shadow-[2px_2px_0_var(--color-hardbox-offset)] disabled:cursor-progress disabled:opacity-80";
  const skin = onIndigo
    ? "bg-surface-raised text-action" // white fill on the indigo block (AA-safe; never indigo-on-indigo)
    : "bg-brand text-white"; // canonical plus login button on light surfaces (AA 4.70)

  return (
    <button
      type="button"
      // The accessible name is always the full phrase. compact, responsiveLabel, and iconOnly all
      // hide part/all of the visible word but never the meaning, so each carries the full aria-label.
      aria-label={
        compact || responsiveLabel || iconOnly ? "Log in with Wikipedia" : undefined
      }
      aria-busy={connecting}
      disabled={connecting}
      onClick={() => {
        setConnecting(true);
        // Full-page redirect to en.wikipedia.org, returning to THIS page (§3). The
        // callbackUrl is read from the live location at click time (no useSearchParams hook,
        // so the statically-prerendered home page needs no Suspense bailout).
        void signIn("wikimedia", { callbackUrl: currentCallbackUrl() });
      }}
      className={`${base} ${skin}`}
    >
      <WikiGlyph className="h-4 w-4 shrink-0" />
      {connecting ? (
        // While connecting, the word is informative — show it even in the icon-only state.
        "Connecting…"
      ) : responsiveLabel ? (
        <span className="whitespace-nowrap">
          Log in<span className="hidden min-[480px]:inline"> with Wikipedia</span>
        </span>
      ) : (
        // §3.3: hide the visible "Log in" word while icon-only — a CSS/visibility swap (the word
        // is always in the DOM, hidden via `hidden`), so SSR/hydration markup is identical (no
        // flash) and the accessible name (the aria-label) is untouched.
        <span className={iconOnly ? "hidden" : undefined}>{label}</span>
      )}
    </button>
  );
}

// Signed-in: avatar/initial + username, a disclosure menu (WAI-ARIA menu-button via Radix)
// with one item for C — Sign out (design §1a; built as a MENU so D's "My curations"/"Profile"
// slot in additively — §9).
function SignedIn({
  username,
  onIndigo,
  compact,
  iconOnly,
}: {
  username: string;
  onIndigo: boolean;
  compact: boolean;
  iconOnly: boolean;
}) {
  const router = useRouter();
  const initial = username.slice(0, 1).toUpperCase();
  const textColor = onIndigo ? "text-white" : "text-ink-plus";
  const ring = onIndigo ? "border-white" : "border-hardbox";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Account: ${username}`}
          className={`auth-account-trigger inline-flex min-h-[44px] items-center gap-1.5 px-1.5 py-1 text-sm font-bold ${textColor} ${
            iconOnly ? "min-w-[44px] justify-center" : ""
          }`}
        >
          <span
            aria-hidden
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${ring} bg-gradient-to-br from-brand to-violet text-[12px] font-bold text-white`}
          >
            {initial}
          </span>
          {/* The username hides behind the avatar on the narrowest compact bar (`< sm`); and while
              the narrow search disclosure is open it hides UNCONDITIONALLY up to `< md` (`iconOnly`,
              §3.3) so it never re-appears in the 640–767px band and crowds the open field — the
              avatar + ▾ + the aria-label still carry the account identity (AC7). The word is always
              in the DOM, hidden via `hidden`, so the SSR/hydration markup is unchanged (no flash). */}
          <span
            className={
              iconOnly ? "hidden" : compact ? "hidden sm:inline" : "inline"
            }
          >
            {username}
          </span>
          <span aria-hidden className="text-[10px]">
            ▾
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[10rem] border-2 border-hardbox bg-surface-raised p-1 text-ink-plus shadow-[3px_3px_0_var(--color-hardbox-offset)]"
        >
          {/* D3 (issue #54, design §7): "My curations" → the viewer's OWN public profile, reached
              as the owner. Signed-in only (the SignedIn component only mounts then — AC5). In-SPA
              navigation to `/contributor/<own-username>` (Decision 1's deterministic resolve maps
              this username to one profile, the viewer's own). Above "Sign out", with a hairline
              divider so the exit action stays last. The WORD is the label (never an icon alone). */}
          <DropdownMenu.Item
            onSelect={() => router.push(contributorHref(username))}
            className="cursor-pointer select-none px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-surface-2"
          >
            My curations
          </DropdownMenu.Item>
          {/* #66 (design §4.4): the signed-in convenience link to the persistent data notice —
              reaches /about/data from the Topic page too (whose chrome carries no footer). Reuses
              the EXACT item styling so the menu reads as one. The WORD is the label (no icon alone).
              Ordered: My curations → About your data → (divider) → Sign out (the exit stays last). */}
          <DropdownMenu.Item
            onSelect={() => router.push("/about/data")}
            className="cursor-pointer select-none px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-surface-2"
          >
            About your data
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-hardbox/15" />
          <DropdownMenu.Item
            onSelect={() => void signOut({ callbackUrl: "/" })}
            className="cursor-pointer select-none px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-surface-2"
          >
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
