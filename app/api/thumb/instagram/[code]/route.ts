import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { clip } from "@/lib/db/schema";
import { instagramThumbResponse } from "@/lib/embed/instagram-thumb";

// GET /api/thumb/instagram/<code> — redirects to an Instagram post's current thumbnail on
// Instagram's CDN (lib/embed/instagram-thumb.ts). Dynamic: it reads Instagram on a cache miss.
export const dynamic = "force-dynamic";

/** Whether a stored wiki+ clip is this Instagram post (clips store the canonical watch URL). */
async function isCurated(code: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: clip.id })
    .from(clip)
    .where(
      inArray(clip.watchUrl, [
        `https://www.instagram.com/reel/${code}/`,
        `https://www.instagram.com/p/${code}/`,
      ])
    )
    .limit(1);
  return rows.length > 0;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<Response> {
  const { code } = await params;
  return instagramThumbResponse(code, isCurated);
}
