import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// Drizzle schema for the wiki+ shared, multi-user data store (issue #45 / epic #35 B).
// This replaces the per-browser localStorage DataStore: topics, clips, contributors,
// and sticky candidate dismissals now live in ONE shared Postgres on the VPS, reached
// through a server data-access boundary (Server Actions — see lib/server/actions.ts).
//
// Shape per docs/ARCHITECTURE.md "Data model (initial)" + lib/data/types.ts. Deliberate
// B-scope choices, recorded here so QA can check the schema against the spec (AC2):
//   - topic carries NO `article_index` — the server never fetches Wikipedia in B (AC8);
//     the lead/section-list cache belongs to the deferred production read-path.
//   - clip carries EVERY field on the current Clip type (lib/data/types.ts), so the
//     localStorage store ports with no data loss (AC2).
//   - account is Auth.js-adapter-shaped (provider + providerAccountId, unique together,
//     linked to a contributor) so issue C (real sign-in) adopts it additively (AC2/AC13).
//   - dismissed_candidate carries the (topic, provider, provider_video_id) sticky identity
//     (AC5), matching lib/candidates/dismissals.ts.

/** A wiki+ topic — a real Wikipedia article we curate over. Keyed by Wikidata QID. */
export const topic = pgTable("topic", {
  id: serial("id").primaryKey(),
  /** Wikidata QID — the canonical, stable, language-independent key (unique). */
  wikidataQid: text("wikidata_qid").notNull().unique(),
  /** Wikipedia article title (display attribute). */
  title: text("title").notNull(),
  /** Article language (display attribute). Defaults to English for the MVP. */
  lang: text("lang").notNull().default("en"),
  /** Short Wikidata description (display attribute; nullable). */
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A curated, contextualized social video. Carries every field the app's `Clip` type
 * carries today (lib/data/types.ts), so the localStorage store ports 1:1. Media +
 * creator fields are stored inline (creators are referenced, never hosted; per
 * ARCHITECTURE they get their own table only if creator-level views become a feature).
 */
export const clip = pgTable("clip", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topic.id, { onDelete: "cascade" }),

  // ── Media / platform fields (VideoBase) ───────────────────────────────────────
  platform: text("platform").notNull(), // youtube | tiktok | instagram | other
  platformLabel: text("platform_label").notNull(), // "YouTube" | "TikTok" …
  orientation: text("orientation").notNull(), // vertical | horizontal
  watchUrl: text("watch_url").notNull(),
  embedUrl: text("embed_url"),
  thumbnailUrl: text("thumbnail_url"),
  thumbGrad: text("thumb_grad"),
  caption: text("caption").notNull(),

  // ── Creator (the external person we credit, stored inline) ────────────────────
  creatorHandle: text("creator_handle").notNull(),
  creatorName: text("creator_name").notNull(),
  creatorPlatform: text("creator_platform").notNull(),
  creatorUrl: text("creator_url"),
  creatorAvatarGrad: text("creator_avatar_grad"),
  creatorFollowerCount: integer("creator_follower_count"),

  // ── Section anchoring ─────────────────────────────────────────────────────────
  general: boolean("general").notNull().default(false),
  sectionSlug: text("section_slug"),
  sectionLabel: text("section_label"),

  // ── wiki+'s contribution: context note + the closed curation vocabularies ──────
  contextNote: text("context_note").notNull(),
  stance: text("stance").notNull(),
  stanceModifier: text("stance_modifier"),
  accuracyFlag: text("accuracy_flag").notNull(),
  accuracyModifier: text("accuracy_modifier"),
  upvotes: integer("upvotes"),

  /** wiki+ curator handle (display-only string today; the FK below is the durable link). */
  curatedBy: text("curated_by"),
  /** Decorative relative-date label carried by the seed (e.g. "2 days ago"). */
  curatedAt: text("curated_at"),

  // ── Review-state / vouch hold (issue #58 / D5b — Decision 1, AC1/AC6) ──────────────────
  // The "is this clip's vouch reviewer-confirmed?" flag — the THIRD clip-state (CURATION §7.1
  // / Decision C8). `vetted = true` ≙ PUBLISHED / live / fully curated (carries the site's full
  // vouch); `vetted = false` ≙ HELD / "in review · not yet vouched" (a real curated clip — note
  // + chips + curator intact — whose vouch a reviewer has not yet confirmed). This is DISTINCT
  // from `Candidate.vetted: false` in lib/data/types.ts: a candidate is an auto-suggested
  // suggestion that is NOT a clip row (no note, no chips, no curator); this is a property of a
  // real `clip` row. `NOT NULL DEFAULT true` so every NEW add publishes by default (D1 Decision
  // D1-2 preserved — the hold is an available action, never auto-on) AND every existing/seeded
  // clip backfills to PUBLISHED when the column lands (the column default + the migration's
  // non-null backfill) so NO live clip goes dark (AC6). The held-state rides the clip read
  // (`listClips` → the client `Clip.held` flag — Decision 4); the cached read path does NO
  // per-user work to render it. Hold/approve are role-gated SERVER-SIDE in lib/server/actions.ts
  // (hold = moderator OR the clip's own curator; approve = moderator-only — Decision 3 / AC4/AC5).
  vetted: boolean("vetted").notNull().default(true),

  // ── Note-license agreement (issue #52 / D1 — Decision D1-1, AC7) ───────────────
  // The contributor's per-submit CC BY-SA agreement, captured at publish time. A
  // VERSION STRING (not a bare boolean) so a future license bump is expressible
  // (`CC-BY-SA-4.0`), plus the agreement timestamp — together they bind "this note,
  // by this contributor (curator_id / curated_by), under this license, at this time"
  // (CURATION §5.3). Nullable: seed/stub clips and any non-agreed path carry no
  // license record, so a D1-published clip is distinguishable from a seeded one (AC7).
  noteLicense: text("note_license"),
  noteLicenseAgreedAt: timestamp("note_license_agreed_at", {
    withTimezone: true,
  }),

  // ── Soft-removal tombstone (issue #59 / D5c — Decision 1, AC1/AC6/AC7) ─────────────────
  // The §7 "removable content" moderation enforcement: a MODERATOR removing an ABUSIVE clip
  // (CURATION §7.2 / Decision C9). A removal is a SOFT TOMBSTONE, NOT a hard delete (the
  // contrast with D2's owner-gated `deleteClip` — Decision 1): the clip STOPS SHOWING (the
  // read filters `removed_at IS NULL` — `listClips`/`listClipsByContributor`), but the row +
  // who/when/why PERSIST as the §7 audit trail (a privileged act on another person's work
  // must be auditable + attributable — CURATION §7.2). DISTINCT from the D5b `vetted` hold
  // (an INDEPENDENT column): `vetted` is the reversible "in review" review pause (the clip
  // STAYS visible, marked); `removed_at` takes an abusive clip DOWN (it stops showing). A clip
  // can be held (visible, in review) OR removed (not shown) OR both — they never collide
  // (AC5). The moderator-only role-gate lives SERVER-SIDE in `removeClipAction` (reusing the
  // D5b `isModeratorContributor` resolver — NO own-curator arm, the key contrast with the
  // hold); these columns are the persistence only. Restore is DEFERRED but TRIVIAL given the
  // tombstone (clear `removed_at`/`removed_by` — Decision 1); D5c builds removal only.
  //
  // `removed_at` is the SINGLE removed/live discriminant: NULL ≙ live; non-null ≙ removed (the
  // removal timestamp). All three default NULL (no migration backfill writes them), so every
  // existing/seeded clip lands LIVE (`removed_at IS NULL`) when the columns land — NO live clip
  // goes dark (AC6). The reason is OPTIONAL + AUDIT-ONLY + NEVER reader-facing (Decision 4 /
  // C9): the §7-category enum and/or a free-text note, captured for a future moderation
  // surface, never surfaced to a reader (a removed clip simply stops showing).
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedBy: integer("removed_by").references(() => contributor.id, {
    // `set null` so a removed contributor doesn't cascade-delete the tombstone (the audit
    // trail outlives the moderator's account — same posture as `curator_id`).
    onDelete: "set null",
  }),
  removedReason: text("removed_reason"),

  /**
   * Contributor who curated this clip. Nullable in B: interim writes are attributed to a
   * single seeded stub "prototype" contributor (AC13) until issue C wires real sign-in.
   */
  curatorId: integer("curator_id").references(() => contributor.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  // Additive, non-destructive index (issue #54 / D3, optional): the contributor profile's
  // `listClipsByContributor` query filters `clip.curator_id` (and the topic read filters
  // `clip.topic_id`). At prototype scale neither is required; these are cheap insurance for
  // the new by-contributor query as the clip set grows. No data migration / column change.
  index("clip_curator_id_idx").on(t.curatorId),
  index("clip_topic_id_idx").on(t.topicId),
]);

/** A wiki+ curator (distinct from the external creator referenced on a clip). */
export const contributor = pgTable("contributor", {
  id: serial("id").primaryKey(),
  /**
   * Display handle, e.g. "@sage" or a Wikimedia username — a NON-unique display column.
   * The durable trust anchor is the linked `account` row's (provider, provider_account_id),
   * NOT this string (issue C fix round): a Wikimedia username is mutable and reusable, so two
   * distinct subjects may legitimately present the same handle and must NOT merge onto one
   * contributor. The handle is what the header shows; it is never an identity key.
   */
  handle: text("handle").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  // ── Moderator/reviewer role (issue #58 / D5b — Decision 2, the shared prerequisite D5c reuses) ──
  // The minimal binary privileged role: `true` ⇒ this contributor is a moderator/reviewer (may
  // approve a held clip and hold any clip — CURATION §7.1). `NOT NULL DEFAULT false` so EVERY
  // existing/new contributor is a non-moderator until granted — the safe default; the feature
  // ships GREEN with NO moderator existing (the role-gate simply rejects everyone until one is
  // granted). NO in-app admin UI grants this (out of scope). It is granted OUT-OF-BAND, two ways
  // (either suffices; the action OR-combines them server-side — see lib/auth/moderators.ts):
  //   (a) a manual DB flag — an owner/ops sets `is_moderator = true` on a `contributor` row
  //       directly (e.g. `psql`), OR
  //   (b) the `WIKIPLUS_MODERATORS` env allowlist of Wikimedia usernames, resolved server-side
  //       into the `isModerator` session claim at login + re-checked at the write boundary.
  // The role-gate's AUTHORITY is always SERVER-SIDE — never a client-supplied flag (Decision 2).
  isModerator: boolean("is_moderator").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [
  // Additive index for the `getContributorByUsername` handle lookup (issue #54 / D3, optional;
  // the handle is non-unique → a plain index, not a UNIQUE). Non-destructive.
  index("contributor_handle_idx").on(t.handle),
]);

/**
 * An OAuth identity linked to a contributor — Auth.js-adapter-shaped so issue C adopts it
 * without a schema rewrite (AC2/AC13). UNUSED by writes in B (no sign-in is introduced);
 * the table simply exists so C is additive.
 */
export const account = pgTable(
  "account",
  {
    id: serial("id").primaryKey(),
    contributorId: integer("contributor_id")
      .notNull()
      .references(() => contributor.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // wikimedia | google | …
    providerAccountId: text("provider_account_id").notNull(),
    // Cached profile bits from the provider (granted later; nullable now).
    name: text("name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("account_provider_identity").on(t.provider, t.providerAccountId)]
);

/**
 * A ruled-out candidate suppressed so it doesn't resurface — the sticky-dismissal identity
 * is (topic, provider, provider_video_id). Shared + durable in B (AC5): a candidate
 * dismissed by anyone stays dismissed for everyone, matched on that triple.
 */
export const dismissedCandidate = pgTable(
  "dismissed_candidate",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // platform: youtube | tiktok | …
    providerVideoId: text("provider_video_id").notNull(),
    /** Who dismissed it; nullable in B (interim stub attribution, AC13). */
    contributorId: integer("contributor_id").references(() => contributor.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("dismissed_candidate_identity").on(
      t.topicId,
      t.provider,
      t.providerVideoId
    ),
  ]
);

/**
 * One contributor's upvote on one clip (issue #55 / D4 — Decision 1). The "I'm glad I watched
 * this" reader signal, tied to a real Wikimedia identity. ONE-PER-USER is a DB INVARIANT, not
 * app logic: the `unique(clip_id, contributor_id)` constraint makes a duplicate insert collide
 * on the constraint regardless of races, so a racing double-insert lands voted, never doubled
 * (AC3). The displayed count is DERIVED — `(clip.upvotes ?? 0) + COUNT(clip_vote rows)` — never
 * a mutated counter, so it cannot drift (Decision 2); the legacy `clip.upvotes` column stays a
 * FROZEN seed baseline and is never written by a vote. Same DB-enforced-uniqueness pattern as
 * `account_provider_identity` and `dismissed_candidate_identity`.
 */
export const clipVote = pgTable(
  "clip_vote",
  {
    id: serial("id").primaryKey(),
    clipId: integer("clip_id")
      .notNull()
      // Cascade: deleting a clip removes its votes (matches D2's hard delete + the clip→topic
      // cascade). A vote against a deleted clip is meaningless.
      .references(() => clip.id, { onDelete: "cascade" }),
    contributorId: integer("contributor_id")
      .notNull()
      // Cascade (Decision 1, the clean default): a null contributor cannot carry the
      // one-per-user meaning, so the FK is NOT NULL and a removed contributor drops their votes.
      .references(() => contributor.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The one-per-user enforcement (AC3) — a single (clip, contributor) row at most. This unique
    // index also serves the per-viewer `(contributor_id, clip_id)` voted-state lookup and is the
    // index backing the per-clip `COUNT(... WHERE clip_id = ?)` derivation.
    unique("clip_vote_identity").on(t.clipId, t.contributorId),
  ]
);

/**
 * The per-identity write rate-limit ledger (issue #57 / D5a — Decision 1). One row per COUNTED
 * gated write by a signed-in contributor; the limiter's window check is a
 * `COUNT(... WHERE contributor_id = ? AND created_at > now() - W)` over this table — NOT a Redis
 * counter (ARCHITECTURE reserves the deferred read-path Redis for the ISR cacheHandler; D5a must
 * not pull it forward). Postgres is already the shared store behind the Server Actions seam, so a
 * small indexed time-bounded slice is trivially cheap + correct at prototype scale, and the ledger
 * doubles as the §7 audit trail a future D5b/D5c or Analytics can read.
 *
 * The limit is keyed by `contributor.id` (Decision 4) — never global, never per-IP; the gate runs
 * first so the limiter only ever sees an authenticated identity. `kind` records WHICH gated write
 * each event was (`add` | `upsert` | `upvote` | `dismiss` | `edit` | `delete`) so a future
 * per-action budget split (Decision 2) needs NO schema change — the current limit draws from ONE
 * shared per-identity budget across all kinds. Append-mostly + self-bounding for the window check
 * (`created_at > now() - W` ignores old rows); a periodic prune of aged rows is an Ops follow-up,
 * not a correctness requirement.
 */
export const writeEvent = pgTable(
  "write_event",
  {
    id: serial("id").primaryKey(),
    contributorId: integer("contributor_id")
      .notNull()
      // Cascade (matches clip_vote): a removed contributor's events go with them; the limit only
      // ever counts a live identity's recent writes.
      .references(() => contributor.id, { onDelete: "cascade" }),
    /** Which counted gated write this was (Decision 2 — carried so a future per-action split is free). */
    kind: text("kind").notNull(), // add | upsert | upvote | dismiss | edit | delete
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The hot path: the window `COUNT(... WHERE contributor_id = ? AND created_at > ?)`. A composite
    // index on (contributor_id, created_at) lets the count scan only this identity's recent slice.
    index("write_event_contributor_created_idx").on(
      t.contributorId,
      t.createdAt
    ),
  ]
);

// ── Relations (typed joins; Drizzle relational queries) ─────────────────────────────
export const topicRelations = relations(topic, ({ many }) => ({
  clips: many(clip),
  dismissals: many(dismissedCandidate),
}));

export const clipRelations = relations(clip, ({ one, many }) => ({
  topic: one(topic, { fields: [clip.topicId], references: [topic.id] }),
  curator: one(contributor, {
    fields: [clip.curatorId],
    references: [contributor.id],
  }),
  votes: many(clipVote),
}));

export const contributorRelations = relations(contributor, ({ many }) => ({
  accounts: many(account),
  clips: many(clip),
  votes: many(clipVote),
  writeEvents: many(writeEvent),
}));

export const writeEventRelations = relations(writeEvent, ({ one }) => ({
  contributor: one(contributor, {
    fields: [writeEvent.contributorId],
    references: [contributor.id],
  }),
}));

export const clipVoteRelations = relations(clipVote, ({ one }) => ({
  clip: one(clip, { fields: [clipVote.clipId], references: [clip.id] }),
  contributor: one(contributor, {
    fields: [clipVote.contributorId],
    references: [contributor.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  contributor: one(contributor, {
    fields: [account.contributorId],
    references: [contributor.id],
  }),
}));

export const dismissedCandidateRelations = relations(
  dismissedCandidate,
  ({ one }) => ({
    topic: one(topic, {
      fields: [dismissedCandidate.topicId],
      references: [topic.id],
    }),
    contributor: one(contributor, {
      fields: [dismissedCandidate.contributorId],
      references: [contributor.id],
    }),
  })
);

// Re-export `sql` so callers needing raw expressions don't import drizzle-orm directly.
export { sql };

export type TopicRow = typeof topic.$inferSelect;
export type ClipRow = typeof clip.$inferSelect;
export type ContributorRow = typeof contributor.$inferSelect;
export type DismissedCandidateRow = typeof dismissedCandidate.$inferSelect;
export type ClipVoteRow = typeof clipVote.$inferSelect;
export type WriteEventRow = typeof writeEvent.$inferSelect;
