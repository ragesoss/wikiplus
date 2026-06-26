import { eq } from "drizzle-orm";
import { seedClips } from "@/lib/data/seed";
import { STUB_HANDLE } from "@/lib/curation/curator-attribution";
import type { Db } from "./client";
import { clipToInsert } from "./mappers";
import { clip, contributor, topic } from "./schema";

// Environment-agnostic DB seed (issue #45 — deliverable 5). Works against ANY Drizzle
// Postgres handle: the live VPS Postgres (scripts/seed.ts → scripts/migrate.ts on deploy)
// AND the in-memory pglite handle in tests. So the seed is exercised in CI with no live DB.
//
// Ports lib/data/seed.ts (the prototype's localStorage seed) so the deployed app opens
// NON-EMPTY for everyone (AC10) — the three demo topics + the curated Photosynthesis clips —
// replacing the retired per-browser `seedIfEmpty`. IDEMPOTENT: it checks for the seed marker
// (the stub contributor + the seed clips) and no-ops if already present, so re-running on
// every deploy is safe.
//
// `STUB_HANDLE` is the canonical client-safe constant (lib/curation/curator-attribution.ts),
// shared with the store + the client `ContextByLink` so the stub handle is defined once.

// The three seeded topics — kept in sync with the prototype seed (lib/data/seed.ts +
// SEEDED_TITLES). Photosynthesis is fully curated; the other two render the empty state.
const SEED_TOPICS = [
  {
    qid: "Q11982",
    title: "Photosynthesis",
    description: "Biological process converting light into chemical energy",
  },
  {
    qid: "Q189603",
    title: "Cellular respiration",
    description: "How cells release energy from nutrients",
  },
  { qid: "Q146", title: "Cat", description: undefined },
];

/** Seed the shared DB idempotently. Returns true if it inserted, false if already seeded. */
export async function seedDatabase(db: Db): Promise<boolean> {
  // ── Idempotency guard: if the curated Photosynthesis topic already has clips, skip. ──
  const existing = await db
    .select({ id: topic.id })
    .from(topic)
    .where(eq(topic.wikidataQid, "Q11982"))
    .limit(1);
  if (existing[0]) {
    const someClip = await db
      .select({ id: clip.id })
      .from(clip)
      .where(eq(clip.topicId, existing[0].id))
      .limit(1);
    if (someClip[0]) return false; // already seeded
  }

  // ── Stub "prototype" contributor (interim attribution; preserved post-C per D6). ──
  // `contributor.handle` is non-unique now (issue C fix round — the identity anchor is the
  // account row, not the handle), so we read-first / insert-if-absent rather than ON CONFLICT
  // (handle). The seed is idempotent (it bails above once the curated topic has clips), so the
  // stub is inserted at most once.
  let stub = await db
    .select({ id: contributor.id })
    .from(contributor)
    .where(eq(contributor.handle, STUB_HANDLE))
    .limit(1);
  if (!stub[0]) {
    stub = await db
      .insert(contributor)
      .values({ handle: STUB_HANDLE, displayName: "Prototype curator" })
      .returning({ id: contributor.id });
  }
  const stubId = stub[0]?.id ?? null;

  // ── Topics (upsert by QID). ──
  const qidToId = new Map<string, number>();
  for (const t of SEED_TOPICS) {
    const rows = await db
      .insert(topic)
      .values({
        wikidataQid: t.qid,
        title: t.title,
        description: t.description ?? null,
      })
      .onConflictDoUpdate({
        target: topic.wikidataQid,
        set: { title: t.title, description: t.description ?? null },
      })
      .returning({ id: topic.id, qid: topic.wikidataQid });
    qidToId.set(rows[0].qid, rows[0].id);
  }

  // ── Curated clips (Photosynthesis). createdAt staggered so listClips ordering matches
  //    the prototype (newest first), exactly as the old seedIfEmpty did. ──
  const now = Date.now();
  const clipRows = seedClips
    .map((c, i) => {
      const topicId = qidToId.get(c.topicQid);
      if (topicId === undefined) return null;
      return {
        ...clipToInsert(c, topicId, stubId),
        createdAt: new Date(now - i * 3_600_000),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (clipRows.length > 0) {
    const inserted = await db
      .insert(clip)
      .values(clipRows)
      .returning({ id: clip.id, watchUrl: clip.watchUrl });
    // ── Seed a HERO (issue #158) for the curated Photosynthesis demo. ─────────────────────────
    // The fixture carries one topic with a hero set so the prominent General-strip block + the
    // signed-in mark/unmark control are exercised in tests and captured in the screenshot baseline.
    // The hero is the first GENERAL seed clip (the Crash Course intro — a fitting "start here"),
    // matched by its stable `watchUrl` so it survives any re-ordering of the seed array.
    const heroSeed = seedClips.find((c) => c.general);
    const heroQid = heroSeed?.topicQid;
    const heroTopicId = heroQid ? qidToId.get(heroQid) : undefined;
    const heroRow = heroSeed
      ? inserted.find((r) => r.watchUrl === heroSeed.watchUrl)
      : undefined;
    if (heroRow && heroTopicId !== undefined) {
      await db
        .update(topic)
        .set({ heroClipId: heroRow.id })
        .where(eq(topic.id, heroTopicId));
    }
  }

  // NOTE: seeded mock CANDIDATES (lib/data/seed.ts `seedCandidates`) are intentionally NOT
  // inserted — candidates are computed + cached, never DB rows (ARCHITECTURE). The empty-state
  // suggestions come from the live client-side YouTube pipeline; with no key they are simply
  // absent (the seeded mock set was a localStorage-only demo convenience).

  return true;
}
