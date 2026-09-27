import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { clip } from "./schema";
import { resolveInstagram, type InstagramMeta } from "@/lib/embed/instagram";

// Deploy-time upgrade of Instagram placeholder clips (docs/specs/instagram-resolve.md AC6).
//
// An Instagram clip added while its details could not be resolved carries the honest placeholder
// credit (components/topic/add-media.ts `placeholderMediaSource`). Run by the migrate one-shot, this
// resolves each such clip from Instagram's public embed page and, on success, replaces ONLY the
// auto-metadata — caption, creator name/handle/url, thumbnail (CURATION §5.5 Instagram rule). The
// curator's note, stance, accuracy flag, and section are never touched.
//
// Idempotent (an upgraded clip no longer matches the placeholder), bounded (at most MAX_ROWS per run,
// each fetch timeout-bounded in resolveInstagram), and it never throws: a failure logs and leaves the
// row as it is, so it can never block a deploy.

const PLACEHOLDER_CAPTION = "Unresolved Instagram clip";
const PLACEHOLDER_CREATOR = "Creator not resolved";
const MAX_ROWS = 50;

type Resolve = (watchUrl: string) => Promise<InstagramMeta | null>;

/** Upgrade stored Instagram placeholder clips; returns how many were upgraded. Never throws. */
export async function backfillInstagramPlaceholders(
  db: Db,
  resolve: Resolve = resolveInstagram
): Promise<number> {
  let upgraded = 0;
  try {
    const rows = await db
      .select({ id: clip.id, watchUrl: clip.watchUrl })
      .from(clip)
      .where(
        and(
          eq(clip.platform, "instagram"),
          eq(clip.caption, PLACEHOLDER_CAPTION),
          eq(clip.creatorName, PLACEHOLDER_CREATOR)
        )
      )
      .limit(MAX_ROWS);
    for (const row of rows) {
      const meta = await resolve(row.watchUrl).catch(() => null);
      if (!meta) {
        console.log(`[wiki+ migrate] Instagram clip ${row.id}: not resolvable — left as placeholder.`);
        continue;
      }
      await db
        .update(clip)
        .set({
          caption: meta.title,
          creatorName: meta.authorName,
          creatorHandle: `@${meta.authorName}`,
          creatorUrl: meta.authorUrl,
          thumbnailUrl: meta.thumbnailUrl ?? null,
        })
        .where(eq(clip.id, row.id));
      upgraded += 1;
    }
    if (rows.length) {
      console.log(`[wiki+ migrate] upgraded ${upgraded}/${rows.length} Instagram placeholder clip(s).`);
    }
  } catch (err) {
    console.error("[wiki+ migrate] Instagram backfill skipped:", err);
  }
  return upgraded;
}
