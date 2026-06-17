import { describe, expect, it } from "vitest";

// QA (issue #37) — the Node SSR runtime-switch acceptance criteria that are best
// pinned as static-config / contract assertions: the catch-all routing config
// (AC1/AC3). These guard the foundational switch so a later edit that silently
// reverts to the static-export posture (`dynamicParams = false`, `output: 'export'`)
// fails a test instead of regressing the milestone gate.
//
// (The #37 smoke Server Action contract that lived here is GONE as of issue #45: the
// real Server-Actions boundary — lib/server/actions.ts — has landed, so the throwaway
// smoke action + its probe + this AC7 test were removed with it, as the smoke artifact's
// own comments instructed.)
//
// Runtime behavior (server serves the app, on-demand 200s, no not-found flash,
// no hydration mismatch) is verified out-of-band by QA against `next start`; this
// file pins the source-level invariants those behaviors depend on.

describe("AC3 — Topic catch-all renders unseeded titles on demand (dynamicParams)", () => {
  it("dynamicParams is TRUE (no static-export `dynamicParams = false` constraint)", async () => {
    const mod = await import("@/app/topic/[[...slug]]/page");
    // The whole point of #37: an unseeded `/topic/<Title>/` is rendered on demand,
    // not 404'd. A value of `false` would re-impose the static-export constraint.
    expect(mod.dynamicParams).toBe(true);
  });

  it("generateStaticParams still warms the bare /topic shell + each seeded title (AC1)", async () => {
    const { generateStaticParams } = await import("@/app/topic/[[...slug]]/page");
    const { SEEDED_TITLES } = await import("@/lib/data/seed");
    const { titleToSlug } = await import("@/lib/wiki/topicRoute");
    const params = generateStaticParams();

    // The bare `/topic` shell (slug omitted) is present so the `?qid=` entry is warm.
    const bare = params.filter(
      (p) => p.slug === undefined || (Array.isArray(p.slug) && p.slug.length === 0)
    );
    expect(bare.length).toBe(1);

    // One pre-rendered page per seeded title, each encoded as a single-segment slug
    // through the SAME `titleToSlug` the runtime href uses (so the warm path and the
    // runtime href can't drift — e.g. "Cellular respiration" → "Cellular_respiration").
    const seededSlugs = params
      .filter((p) => Array.isArray(p.slug) && p.slug.length === 1)
      .map((p) => (p.slug as string[])[0]);
    for (const title of SEEDED_TITLES) {
      expect(seededSlugs).toContain(titleToSlug(title));
    }
    // It is NOT an exhaustive list: warm set == bare shell + seeded titles only.
    expect(params.length).toBe(1 + SEEDED_TITLES.length);
  });
});
