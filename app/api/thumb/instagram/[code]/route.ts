import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { clip } from "@/lib/db/schema";
import { instagramThumbResponse, type InstagramKind } from "@/lib/embed/instagram-thumb";

// GET /api/thumb/instagram/<code> — redirects to an Instagram post's current thumbnail on
// Instagram's CDN (lib/embed/instagram-thumb.ts). Dynamic: it reads Instagram on a cache miss.
export const dynamic = "force-dynamic";

/** The embed form of the stored wiki+ clip for this post, or null (clips store the canonical URL). */
async function curatedKind(code: string): Promise<InstagramKind | null> {
  const reelUrl = `https://www.instagram.com/reel/${code}/`;
  const rows = await getDb()
    .select({ watchUrl: clip.watchUrl })
    .from(clip)
    .where(inArray(clip.watchUrl, [reelUrl, `https://www.instagram.com/p/${code}/`]))
    .limit(1);
  if (!rows.length) return null;
  return rows[0].watchUrl === reelUrl ? "reel" : "p";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<Response> {
  const { code } = await params;
  return instagramThumbResponse(code, curatedKind);
}
