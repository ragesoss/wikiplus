"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

export function AuthControl({ variant }: { variant: Variant }) {
  const { data: session, status } = useSession();
  const [connecting, setConnecting] = useState(false);

  const compact = variant === "topic-compact";
  // The login button reads against its surface: white-on-indigo inside the ＋plus block,
  // indigo-on-light elsewhere (design §8; AA verified in the design spec §7).
  const onIndigo = variant === "topic-plus";

  if (status === "loading") {
    // Neutral placeholder chip — never the signed-out button (no flash, §7).
    return (
      <span
        aria-hidden
        className={`inline-block h-[34px] min-h-[34px] w-20 animate-pulse rounded ${
          onIndigo ? "bg-white/25" : "bg-ink/10"
        }`}
      />
    );
  }

  if (status === "authenticated" && session?.user?.username) {
    return (
      <SignedIn username={session.user.username} onIndigo={onIndigo} compact={compact} />
    );
  }

  // Signed-out: the single "Log in with Wikipedia" action (§1a).
  const label = compact ? "Log in" : "Log in with Wikipedia";
  const base =
    "inline-flex min-h-[44px] items-center gap-1.5 border-2 border-ink px-3 py-1.5 text-sm font-bold transition hover:shadow-[2px_2px_0_#2C2C2C] disabled:cursor-progress disabled:opacity-80";
  const skin = onIndigo
    ? "bg-white text-action" // white fill on the indigo block (AA-safe; never indigo-on-indigo)
    : "bg-brand text-white"; // canonical plus login button on light surfaces (AA 4.70)

  return (
    <button
      type="button"
      aria-label={compact ? "Log in with Wikipedia" : undefined}
      aria-busy={connecting}
      disabled={connecting}
      onClick={() => {
        setConnecting(true);
        // Full-page redirect to meta.wikimedia.org, returning to THIS page (§3). The
        // callbackUrl is read from the live location at click time (no useSearchParams hook,
        // so the statically-prerendered home page needs no Suspense bailout).
        void signIn("wikimedia", { callbackUrl: currentCallbackUrl() });
      }}
      className={`${base} ${skin}`}
    >
      <WikiGlyph className="h-4 w-4 shrink-0" />
      {connecting ? "Connecting…" : label}
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
}: {
  username: string;
  onIndigo: boolean;
  compact: boolean;
}) {
  const router = useRouter();
  const initial = username.slice(0, 1).toUpperCase();
  const textColor = onIndigo ? "text-white" : "text-ink";
  const ring = onIndigo ? "border-white" : "border-ink";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Account: ${username}`}
          className={`auth-account-trigger inline-flex min-h-[44px] items-center gap-1.5 px-1.5 py-1 text-sm font-bold ${textColor}`}
        >
          <span
            aria-hidden
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${ring} bg-gradient-to-br from-brand to-violet text-[12px] font-bold text-white`}
          >
            {initial}
          </span>
          {/* The username may hide behind the avatar on the very narrowest compact bar; the
              menu and aria-label still carry it (design §6). */}
          <span className={compact ? "hidden sm:inline" : "inline"}>{username}</span>
          <span aria-hidden className="text-[10px]">
            ▾
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[10rem] border-2 border-ink bg-white p-1 text-ink shadow-[3px_3px_0_#2C2C2C]"
        >
          {/* D3 (issue #54, design §7): "My curations" → the viewer's OWN public profile, reached
              as the owner. Signed-in only (the SignedIn component only mounts then — AC5). In-SPA
              navigation to `/contributor/<own-username>` (Decision 1's deterministic resolve maps
              this username to one profile, the viewer's own). Above "Sign out", with a hairline
              divider so the exit action stays last. The WORD is the label (never an icon alone). */}
          <DropdownMenu.Item
            onSelect={() => router.push(contributorHref(username))}
            className="cursor-pointer select-none px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-bg2"
          >
            My curations
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-ink/15" />
          <DropdownMenu.Item
            onSelect={() => void signOut({ callbackUrl: "/" })}
            className="cursor-pointer select-none px-3 py-2 text-sm font-bold outline-none data-[highlighted]:bg-bg2"
          >
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
