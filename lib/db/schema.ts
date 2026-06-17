import { relations, sql } from "drizzle-orm";
import {
  boolean,
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
});

/** A wiki+ curator (distinct from the external creator referenced on a clip). */
export const contributor = pgTable("contributor", {
  id: serial("id").primaryKey(),
  /** Display handle, e.g. "@sage" — stable string identity for the stub + future users. */
  handle: text("handle").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

// ── Relations (typed joins; Drizzle relational queries) ─────────────────────────────
export const topicRelations = relations(topic, ({ many }) => ({
  clips: many(clip),
  dismissals: many(dismissedCandidate),
}));

export const clipRelations = relations(clip, ({ one }) => ({
  topic: one(topic, { fields: [clip.topicId], references: [topic.id] }),
  curator: one(contributor, {
    fields: [clip.curatorId],
    references: [contributor.id],
  }),
}));

export const contributorRelations = relations(contributor, ({ many }) => ({
  accounts: many(account),
  clips: many(clip),
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
