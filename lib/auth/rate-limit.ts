import "server-only";

import { and, count, eq, gt } from "drizzle-orm";
import { RATE_LIMITED_MARKER } from "./auth-error";
import type { Db } from "@/lib/db/client";
import { writeEvent } from "@/lib/db/schema";

// ── The per-identity write rate-limit (issue #57 / D5a — Decisions 1–4). ───────────────────
// The server-side enforcement of CURATION §7's already-set posture: "per-identity write limits to
// blunt spam floods; contribution is gated, reading is anonymous." This lives at the gated write
// boundary (lib/server/actions.ts), AFTER `requireContributor()` resolves the identity and BEFORE
// any persisting DB write — the gate-then-limit-then-write contract (Decision 2). An over-limit
// write is rejected (throws `RateLimitedError`) and writes NOTHING (AC2, the load-bearing
// integrity AC); a write at/below the cap proceeds unchanged (AC1).
//
// Backing: Postgres, the `write_event` ledger (Decision 1) — NOT Redis. ARCHITECTURE reserves the
// deferred read-path Redis for the ISR cacheHandler; D5a must not pull it forward. The window
// check is a `COUNT(... WHERE contributor_id = ? AND created_at > now() - W)` over the indexed
// `(contributor_id, created_at)` slice — trivially cheap + correct at prototype scale.
//
// Scope: per `contributor.id` (Decision 4) — never global (which would let one flood throttle every
// honest curator), never per-IP (an anonymous write is already impossible — the gate stops it; the
// authenticated identity is the better, accountable subject). One identity hitting the cap never
// blocks another (AC5).

/** The error a gated write raises when the per-identity window cap is exceeded. */
export class RateLimitedError extends Error {
  readonly code = RATE_LIMITED_MARKER;
  constructor(
    message = `${RATE_LIMITED_MARKER}: too many writes in the window — slow down and retry shortly.`
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

/**
 * Which counted gated write an event was (Decision 2). All kinds draw from ONE shared per-identity
 * budget today; `kind` is recorded so a future per-action split needs no schema change.
 */
export type WriteKind =
  | "add"
  | "upsert"
  | "upvote"
  | "dismiss"
  | "edit"
  | "delete"
  // D5b (issue #58): the two role-gated review-hold writes. Counted gated writes like the rest —
  // they draw from the SAME shared per-identity budget; `kind` is recorded so a future per-action
  // split needs no schema change (the `write_event.kind` column already exists — no migration).
  | "hold"
  | "review"
  // D5c (issue #59): the moderator-only soft-removal write. A counted gated write like the rest —
  // same shared per-identity budget; `kind` is recorded so a future per-action split / a moderation
  // surface's removal-rate read needs no schema change (the column already exists — no migration).
  | "remove"
  // Issue #159: the curator "mark/un-mark complete" write (`closed_to_suggestions`). A counted gated
  // write like the rest — same shared per-identity budget; `kind` is recorded so a future per-action
  // split needs no schema change (the `write_event.kind` column already exists — no migration).
  | "topic-complete"
  // Issue #158: the curator "mark/unmark hero" write (`hero_clip_id`). A counted gated write like the
  // rest — same shared per-identity budget; `kind` is recorded so a future per-action split needs no
  // schema change (the `write_event.kind` column already exists — no migration).
  | "hero"
  // Issue #162: the per-user "watch/un-watch topic" write (the `watchlist` join). A counted gated
  // write like the rest — same shared per-identity budget; `kind` is recorded so a future per-action
  // split needs no schema change (the `write_event.kind` column already exists — no migration).
  | "watch";

/**
 * The default per-identity cap (Product Decision 2): N writes per window W. Tuned high enough that
 * a human curating/reading at ANY natural rate never trips it (AC1 — 60/min is ~1/sec sustained,
 * unambiguously non-human at the content-write level), low enough that a flood-script trips it
 * almost immediately. ENV-OVERRIDABLE for staging tuning (Out of scope: no runtime admin UI); the
 * shipped defaults are recorded in ARCHITECTURE (AC7).
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  // Guard against a malformed/non-positive override silently disabling the limit.
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Max counted writes per window, per identity. Default 60. Override: `WRITE_RATE_LIMIT_MAX`. */
export function rateLimitMax(): number {
  return envInt("WRITE_RATE_LIMIT_MAX", 60);
}

/** Window length in seconds. Default 60. Override: `WRITE_RATE_LIMIT_WINDOW_SECONDS`. */
export function rateLimitWindowSeconds(): number {
  return envInt("WRITE_RATE_LIMIT_WINDOW_SECONDS", 60);
}

/**
 * The "limit" step of the gate→limit→write contract: enforce the per-identity write cap. Call
 * AFTER `requireContributor()` and BEFORE any persisting write (and before validation, so an
 * over-cap call does the minimum work and never even validates input). It does NOT write — the
 * over-cap path rejects with NO side effect at all (AC2). The successful path records its event
 * separately via `recordWriteEvent` AFTER the write lands.
 *
 * Mechanism — a FIXED-from-now sliding window (not a calendar bucket): count this identity's events
 * with `created_at > now() - W`; if that count is already at/over the cap, throw `RateLimitedError`
 * (the (N+1)th write is rejected and writes nothing — AC2). The window resets naturally: once W
 * elapses, the earlier events age out of `created_at > now() - W` and the identity can write again
 * (AC4) — a momentary brake, not a ban.
 *
 * Counting only SUCCESSFUL writes (record-after-write) — not rejected attempts or validation
 * failures — keeps the ledger an honest record of writes that actually happened and means a
 * validation error surfaces cleanly (the limit step has no side effect); Decision 2 explicitly
 * leaves attempt-vs-success counting to Dev, requiring only that the rejected write's target row is
 * never written (AC2 — guaranteed here: the check is a pure read).
 */
export async function checkWriteRateLimit(
  db: Db,
  contributorId: number
): Promise<void> {
  const windowStart = new Date(Date.now() - rateLimitWindowSeconds() * 1000);
  const rows = await db
    .select({ n: count() })
    .from(writeEvent)
    .where(
      and(
        eq(writeEvent.contributorId, contributorId),
        gt(writeEvent.createdAt, windowStart)
      )
    );
  const recent = Number(rows[0]?.n ?? 0);
  if (recent >= rateLimitMax()) {
    // Over the cap: reject with NO side effect — no validation, no write, no ledger row (AC2). The
    // caller catches this; the client surfaces the calm "too fast" notice via `isRateLimited` (AC3).
    throw new RateLimitedError();
  }
}

/**
 * Record one counted gated write in the ledger — call AFTER the write successfully lands. This is
 * what the next `checkWriteRateLimit` counts. `kind` is recorded so a future per-action budget
 * split needs no schema change (Decision 2; all kinds share one budget today).
 */
export async function recordWriteEvent(
  db: Db,
  contributorId: number,
  kind: WriteKind
): Promise<void> {
  await db.insert(writeEvent).values({ contributorId, kind });
}
