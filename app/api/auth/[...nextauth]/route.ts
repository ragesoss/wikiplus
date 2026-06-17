import { handlers } from "@/lib/auth/config";

// Auth.js (NextAuth v5) catch-all route handler (issue C). Serves the OAuth authorize/callback
// + session/signout endpoints under /api/auth/* — including the Wikimedia callback Auth.js
// uses by default: /api/auth/callback/wikimedia (the URL Ops registers at meta.wikimedia.org).
//
// This is a dynamic route (auth round-trip + session reads), kept OFF the cached read path:
// reading a Topic page never touches it (AC4/AC11).
export const { GET, POST } = handlers;
