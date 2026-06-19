"use client";

import Link from "next/link";
import { AuthControl } from "@/components/auth/AuthControl";

// ── SiteHeader (issue #66, design §5.1). ──────────────────────────────────────────────────
// The minimal app header used by the constrained-container, non-Topic routes: a "wiki+" home
// lockup on the left + the AuthControl identity affordance on the right, on one quiet row. This
// is the shared shape `/contribute` (`ContributeHeader`) and the profile (`ProfileHeader`)
// already use; `/about/data` (#66) reuses it so a person who lands cold on a shared notice link
// can get home and see their auth state. It is NOT the full Topic split-header.
//
// `containerClassName` lets each route match its own reading-column width (the contribute/profile
// routes keep their existing widths via their own headers; the notice route uses max-w-[640px]).
export function SiteHeader({
  containerClassName = "mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 px-4 py-3",
}: {
  containerClassName?: string;
}) {
  return (
    <header className="border-b border-ink/10">
      <div className={containerClassName}>
        <Link href="/" className="text-lg font-semibold text-brand">
          wiki<span className="text-sprout">+</span>
        </Link>
        <AuthControl variant="home" />
      </div>
    </header>
  );
}
