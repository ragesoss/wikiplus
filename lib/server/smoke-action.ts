"use server";

// SMOKE ARTIFACT (issue #37, AC7) — NOT a product feature.
//
// This is throwaway evidence that the runtime can execute Server Actions, the
// capability the rest of the Functional-prototype milestone (B Drizzle, C Auth.js,
// D curation writes) sits behind. It runs ON THE SERVER (a static export cannot
// run this at all), takes no input that matters, touches no data, holds no session,
// and ships no reader-facing behavior. Delete it the moment a real Server Action
// lands (it has no other caller than the clearly-marked SmokeActionProbe).
//
// The `"use server"` directive marks every export here as a Server Action callable
// from a client component — the thing being proven available.

export async function ssrSmokeAction(): Promise<{
  ranOnServer: boolean;
  // typeof window is undefined on the server: positive proof this executed there.
  ranAt: string;
}> {
  return {
    ranOnServer: typeof window === "undefined",
    ranAt: new Date().toISOString(),
  };
}
