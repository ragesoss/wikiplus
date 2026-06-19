"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { useRequireLogin } from "@/components/auth/useRequireLogin";
import { DeleteConfirmDialog } from "@/components/topic/DeleteConfirmDialog";
import { EditModal } from "@/components/topic/EditModal";
import { PlayerModal } from "@/components/topic/PlayerModal";
import { ProfileClipRow } from "@/components/profile/ProfileClipRow";
import type { ClipEditFormPatch } from "@/components/topic/curate-clip";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import { isAuthRequired, isRateLimited } from "@/lib/auth/auth-error";
import { store } from "@/lib/data";
import type { Clip, ContributorClip, PublicContributor } from "@/lib/data/types";
import { pluralize } from "@/lib/format";
import { slugToTitle } from "@/lib/wiki/topicRoute";

// The public contributor profile (issue #54 / D3, AC1–AC7). A client view (paralleling TopicView)
// reached from the `/contributor/[username]` route; it reads the public-safe identity + the
// contributor's curated clips through the seam — ANONYMOUS, no login (AC1/AC2) — and renders ONE
// of four states (design §3):
//   - loading   → a neutral skeleton (never a "not found" flash, §3.5)
//   - not-found → "No such contributor" (unknown username OR the `@prototype` stub — AC3/AC4)
//   - empty     → the identity header + an "hasn't curated any clips yet" line (real, zero clips)
//   - populated → the identity header + the curated-clip list with topic context
//
// "My curations" (Decision 2 / AC5): this is the SAME page everyone sees. When the signed-in
// viewer IS the profile's owner (`session.user.contributorId === profile.id`) it additionally
// reframes the section label to "My curations" and surfaces the owner Edit/Delete affordances
// (§7.3 / §9.3) — reusing D2's EditModal / DeleteConfirmDialog and the unchanged server gate.
// There is NO per-user work on the cached topic read path: these reads run only on this route.

type State = "loading" | "notfound" | "empty" | "populated";

export function ProfileView() {
  const pathname = usePathname();
  // The route is `/contributor/<username>/`; decode the username (slug → space-form, same as a
  // title) so a Wikimedia username with a space (encoded `_`) round-trips. Null for a non-profile
  // path (defensive — the route only matches `/contributor/...`).
  const username = useMemo(() => {
    if (!pathname) return null;
    const m = pathname.match(/^\/contributor\/([^/?#]+)\/?$/);
    return m ? slugToTitle(m[1]) : null;
  }, [pathname]);

  // The signed-in viewer (already-authenticated client session — no read-path cost). Used ONLY to
  // decide owner framing + the owner affordance, the SAME compare D2 uses; never the security gate.
  const { data: session } = useSession();
  const myContributorId = session?.user?.contributorId;
  // Expired-session gate for the owner Edit/Delete writes (mirrors TopicView).
  const { showExpiredGate, gateElement } = useRequireLogin();

  const [state, setState] = useState<State>("loading");
  const [profile, setProfile] = useState<PublicContributor | null>(null);
  const [clips, setClips] = useState<ContributorClip[]>([]);
  const [readError, setReadError] = useState(false);

  // Modal state — the same shape TopicView uses for the owner Edit/Delete, plus the player.
  const [player, setPlayer] = useState<Clip | null>(null);
  const [editClip, setEditClip] = useState<ContributorClip | null>(null);
  const [deleteFor, setDeleteFor] = useState<ContributorClip | null>(null);

  // ── Resolve the profile + its clips (anonymous reads through the seam). ──
  useEffect(() => {
    if (username === null) {
      setState("notfound");
      return;
    }
    let alive = true;
    setState("loading");
    setReadError(false);
    (async () => {
      try {
        // `@prototype` (Decision 4) and any unknown username resolve to null → not-found (AC4/AC3).
        const resolved = await store.getContributorByUsername(username);
        if (!alive) return;
        if (!resolved) {
          setProfile(null);
          setClips([]);
          setState("notfound");
          return;
        }
        const cl = await store.listClipsByContributor(resolved.id);
        if (!alive) return;
        setProfile(resolved);
        setClips(cl);
        setState(cl.length > 0 ? "populated" : "empty");
      } catch {
        // A read failure (DB down) must not crash to a blank page; surface an honest line but
        // keep a coherent profile shell. Degrade to not-found-shaped read error (rare).
        if (alive) {
          setReadError(true);
          setState("notfound");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [username]);

  // Owner = the signed-in viewer is THIS profile's owner (Decision 2 / §7.3). Same id-based
  // compare the server gate uses (no username-collision corner case). Drives the framing + the
  // per-row affordance.
  const isOwner =
    typeof myContributorId === "number" &&
    profile !== null &&
    myContributorId === profile.id;

  // ── Post-delete focus anchor (design §9.4): the profile has no General band, so move focus to
  // the list `<h2>` (a focusListHeading() analog of TopicView's focusBandHeading()). The heading
  // is always present — even when the last clip's delete flips the list to the empty state. ──
  const focusListHeading = useCallback(() => {
    if (typeof document === "undefined") return;
    const heading = document.querySelector<HTMLElement>("#profile-list-heading");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  }, []);

  // Owner Edit — reuses D2's EditModal + the auth-gated updateClipAction via the seam, then
  // replaces the clip in place (no reload). The card is not removed → focus returns to the Edit
  // trigger (ModalShell prevActive). Mirrors TopicView.onEditSubmit. A section change re-anchors
  // the clip's "On <Topic> · …" line in place (the row re-renders from the updated object).
  const onEditSubmit = useCallback(
    (patch: ClipEditFormPatch, agreed: boolean): Promise<SubmitOutcome> => {
      const target = editClip;
      if (!target) return Promise.resolve<SubmitOutcome>({ outcome: "added" });
      return (async () => {
        try {
          const updated = await store.updateClip(target.id, patch, undefined, agreed);
          // `updateClip` returns a `Clip`; preserve the row's topic context (`topicTitle`) which
          // the edit can't change (the parent topic is not editable — D2 editable set).
          setClips((prev) =>
            prev.map((c) =>
              c.id === updated.id ? { ...updated, topicTitle: c.topicTitle } : c
            )
          );
          return { outcome: "added" } satisfies SubmitOutcome;
        } catch (err) {
          if (isAuthRequired(err)) {
            showExpiredGate();
            return { outcome: "expired" } satisfies SubmitOutcome;
          }
          // D5a §5.3: a rate-limited edit keeps the modal open with the calm limit notice.
          if (isRateLimited(err)) {
            return { outcome: "limited" } satisfies SubmitOutcome;
          }
          throw err;
        }
      })();
    },
    [editClip, showExpiredGate]
  );

  // Owner Delete — reuses D2's DeleteConfirmDialog + the auth-gated deleteClipAction, then removes
  // the clip (no reload; the last clip flips populated→empty via the state derive below) and moves
  // focus to the list heading (§9.4) after the shell's prevActive (rAF, the TopicView pattern).
  const onDeleteConfirm = useCallback((): Promise<SubmitOutcome> => {
    const target = deleteFor;
    if (!target) return Promise.resolve<SubmitOutcome>({ outcome: "added" });
    return (async () => {
      try {
        await store.deleteClip(target.id);
        setClips((prev) => {
          const next = prev.filter((c) => c.id !== target.id);
          setState(next.length > 0 ? "populated" : "empty");
          return next;
        });
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(() => focusListHeading());
        } else {
          focusListHeading();
        }
        return { outcome: "added" } satisfies SubmitOutcome;
      } catch (err) {
        if (isAuthRequired(err)) {
          showExpiredGate();
          return { outcome: "expired" } satisfies SubmitOutcome;
        }
        // D5a §5.3: a rate-limited delete keeps the confirm dialog open with the calm limit notice.
        if (isRateLimited(err)) {
          return { outcome: "limited" } satisfies SubmitOutcome;
        }
        throw err;
      }
    })();
  }, [deleteFor, focusListHeading, showExpiredGate]);

  // The Edit modal needs the topic's section list to populate its section <select>. On the
  // profile we don't have the article's sections; pass the clip's own section as the single known
  // option so re-filing to "General" or keeping the current section works (a richer section list
  // would require the article fetch, which the profile route deliberately avoids — read-path
  // discipline). General ⇄ its current section covers the owner's likely edit here.
  const editSections = useMemo(() => {
    if (!editClip || editClip.general || !editClip.sectionSlug) return [];
    return [{ slug: editClip.sectionSlug, title: editClip.sectionLabel ?? "Section" }];
  }, [editClip]);

  return (
    <>
      <ProfileHeader />
      <main className="mx-auto max-w-[760px] px-5 py-8">
        {state === "loading" && <ProfileSkeleton />}
        {state === "notfound" && <NotFoundBody readError={readError} />}
        {(state === "empty" || state === "populated") && profile && (
          <>
            <IdentityHeader profile={profile} isOwner={isOwner} />
            <h2
              id="profile-list-heading"
              className="plus-disp mt-7 text-xl font-bold text-ink"
            >
              {isOwner ? "My curations" : "Curated clips"}
              <span className="ml-2 align-middle text-sm font-normal text-muted">
                {pluralize(clips.length, "clip")}
              </span>
            </h2>
            {state === "empty" ? (
              <p className="py-10 text-center text-sm text-ink2">
                {isOwner
                  ? "You haven't curated any clips yet."
                  : `${profile.username} hasn't curated any clips yet.`}
              </p>
            ) : (
              <ul role="list" className="mt-4 space-y-4">
                {clips.map((clip) => (
                  <li key={clip.id} role="listitem">
                    <ProfileClipRow
                      clip={clip}
                      owned={isOwner}
                      onPlay={setPlayer}
                      onEdit={(c) => setEditClip(c)}
                      onDelete={(c) => setDeleteFor(c)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {/* The slim shared footer (issue #66, design §4.3) — present in every profile state, the
          persistent "About your data" link home (AC2). Matches the profile's reading column. */}
      <SiteFooter containerClassName="mx-auto max-w-[760px] px-5" />

      {player && <PlayerModal clip={player} onClose={() => setPlayer(null)} />}

      {/* Owner-only Edit modal (reused D2 — issue #54 §9.3). */}
      {editClip && (
        <EditModal
          clip={editClip}
          sections={editSections}
          onClose={() => setEditClip(null)}
          onSubmit={onEditSubmit}
        />
      )}
      {/* Owner-only Delete confirm dialog (reused D2 — issue #54 §9.3 / §9.4). */}
      {deleteFor && (
        <DeleteConfirmDialog
          clip={deleteFor}
          onClose={() => setDeleteFor(null)}
          onConfirm={onDeleteConfirm}
        />
      )}
      {/* Expired-session gate (shared with the owner write paths). */}
      {gateElement}
    </>
  );
}

// ── The simple app header (design §3.1): the profile is NOT a Topic page, so it uses the global
// header context (the AuthControl identity affordance is reachable — a signed-in viewer keeps
// their account menu; a logged-out reader sees "Log in with Wikipedia"), not the two-world
// TopicHeader. The profile itself requires no login.
function ProfileHeader() {
  return (
    <SiteHeader containerClassName="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-3 px-5 py-3" />
  );
}

// ── §4 the public identity header — public identity ONLY (AC2): username + granted avatar +
// the static "Curator on wiki+" descriptor. NEVER email or any non-public field (the profile is
// built from the public-safe projection — the read never selects email).
function IdentityHeader({
  profile,
  isOwner,
}: {
  profile: PublicContributor;
  isOwner: boolean;
}) {
  const initial = profile.username.slice(0, 1).toUpperCase();
  return (
    <header className="flex items-center gap-4">
      {profile.avatarUrl ? (
        // Granted avatar → decorative (alt=""): the username beside it carries the identity, so
        // the alt must not duplicate it (the non-redundant-alt rule, design §4 / §12).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full border-2 border-ink object-cover"
        />
      ) : (
        // No granted avatar → the same gradient-initial fallback the app uses, aria-hidden
        // (decorative; the username is the name). Graceful, no broken image, no layout shift.
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-gradient-to-br from-brand to-violet text-2xl font-bold text-white"
        >
          {initial}
        </span>
      )}
      <div className="min-w-0">
        {isOwner && (
          // §7.3 quiet honesty cue: this is the public profile everyone sees (the owner just has
          // controls on it). Optional; the section-label reframe is the required owner cue.
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Your public profile
          </p>
        )}
        <h1 className="plus-disp truncate text-3xl font-bold text-ink">
          {profile.username}
        </h1>
        <p className="text-sm text-muted">Curator on wiki+</p>
      </div>
    </header>
  );
}

// ── §3.4 not-found (unknown username OR `@prototype`, AC3/AC4). Same body for both — the stub is
// not profiled, not explained (Decision 4): a clear, calm page, never a 500 / blank / stack trace.
function NotFoundBody({ readError }: { readError: boolean }) {
  return (
    <div className="py-10">
      <h1 className="plus-disp text-2xl font-bold text-ink">No such contributor</h1>
      <p className="mt-2 text-sm text-ink2">
        {readError
          ? "Couldn't load that contributor right now — please try again."
          : "We couldn't find a contributor with that username."}
      </p>
      <p className="mt-3 text-sm">
        <Link href="/" className="text-action underline">
          Back home
        </Link>
      </p>
    </div>
  );
}

// ── §3.5 loading skeleton: a header-shaped block + 2 clip-row skeletons, with a polite sr-only
// status so a screen-reader user isn't left silent. NEVER shows "No such contributor" (an
// unresolved-yet read is not a not-found). Static blocks (no shimmer) honor reduced motion simply.
function ProfileSkeleton() {
  return (
    <div>
      <p className="sr-only" role="status" aria-live="polite">
        Loading profile…
      </p>
      <div className="flex items-center gap-4">
        <span aria-hidden className="h-14 w-14 shrink-0 rounded-full bg-ink/10" />
        <span aria-hidden className="h-7 w-40 rounded bg-ink/10" />
      </div>
      <div className="mt-7 space-y-4">
        {[0, 1].map((i) => (
          <div key={i} aria-hidden className="plus-card p-3">
            <div className="aspect-video w-full bg-ink/10" />
            <div className="mt-2 h-3 w-2/3 rounded bg-ink/10" />
            <div className="mt-2 h-3 w-1/2 rounded bg-ink/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
