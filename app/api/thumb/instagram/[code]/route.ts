import { instagramThumbResponse } from "@/lib/embed/instagram-thumb";

// GET /api/thumb/instagram/<code> — redirects to an Instagram post's current thumbnail on
// Instagram's CDN (lib/embed/instagram-thumb.ts). Dynamic: it reads Instagram on a cache miss.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
): Promise<Response> {
  const { code } = await params;
  return instagramThumbResponse(code);
}
