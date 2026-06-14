import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageDataStore } from "@/lib/data/local-store";
import { deriveStats } from "@/lib/data";
import { seedCandidates, seedClips } from "@/lib/data/seed";
import type { Clip } from "@/lib/data/types";

// AC7 (infobox counts derived from clips), AC20 (DataStore seam integrity), and
// CURATION §6 (candidates carry NO stance/accuracy/contextNote).

describe("deriveStats (AC7 — counts derived from clips, never hardcoded)", () => {
  it("counts videos, distinct creators, and distinct curators", () => {
    const clips = [
      { creator: { handle: "@a" }, curatedBy: "@x" },
      { creator: { handle: "@a" }, curatedBy: "@y" }, // same creator, new curator
      { creator: { handle: "@b" }, curatedBy: "@x" }, // new creator, same curator
    ] as unknown as Clip[];
    const s = deriveStats(clips);
    expect(s.videos).toBe(3);
    expect(s.creators).toBe(2);
    expect(s.curators).toBe(2);
  });

  it("reports zero across the board for an empty clip set (drives empty state)", () => {
    const s = deriveStats([]);
    expect(s.videos).toBe(0);
    expect(s.creators).toBe(0);
    expect(s.curators).toBe(0);
  });
});

describe("LocalStorageDataStore (AC20 seam)", () => {
  let store: LocalStorageDataStore;
  beforeEach(() => {
    window.localStorage.clear();
    store = new LocalStorageDataStore();
  });

  it("round-trips topics by QID", async () => {
    await store.upsertTopic({ qid: "Q1", title: "One" });
    await store.upsertTopic({ qid: "Q1", title: "One (updated)" }); // upsert, not dup
    const all = await store.listTopics();
    expect(all).toHaveLength(1);
    expect((await store.getTopic("Q1"))?.title).toBe("One (updated)");
  });

  it("lists only the clips for the requested topic", async () => {
    await store.addClip({ ...(seedClips[0] as Omit<Clip, "id" | "createdAt">) });
    const got = await store.listClips(seedClips[0].topicQid);
    expect(got).toHaveLength(1);
    expect(await store.listClips("Q-other")).toHaveLength(0);
  });

  it("a topic with zero clips returns [] (the empty-state trigger, A6)", async () => {
    expect(await store.listClips("Q-empty")).toEqual([]);
  });
});

describe("seed data integrity (A3/A4)", () => {
  it("seeds a fully-curated Photosynthesis topic with both general and anchored clips", () => {
    const photo = seedClips.filter((c) => c.topicQid === "Q11982");
    expect(photo.length).toBeGreaterThanOrEqual(10);
    expect(photo.some((c) => c.general)).toBe(true);
    expect(photo.some((c) => !c.general && c.sectionSlug)).toBe(true);
  });

  it("every curated clip carries a context note + stance + accuracy (CURATION §1–§3)", () => {
    for (const c of seedClips) {
      expect(c.contextNote.length).toBeGreaterThan(20);
      expect(c.stance).toBeTruthy();
      expect(c.accuracyFlag).toBeTruthy();
    }
  });

  it("YouTube clips use a youtube-nocookie embed URL (AC11)", () => {
    for (const c of seedClips.filter((c) => c.platform === "youtube")) {
      expect(c.embedUrl).toContain("youtube-nocookie.com/embed/");
    }
  });

  it("candidates carry NO stance, accuracy, or context note (CURATION §6 / AC15)", () => {
    for (const cand of seedCandidates) {
      expect(cand).not.toHaveProperty("stance");
      expect(cand).not.toHaveProperty("accuracyFlag");
      expect(cand).not.toHaveProperty("contextNote");
      // ...but DO carry a source + match reason in their place
      expect(cand.source).toBeTruthy();
      expect(cand.matchReason).toBeTruthy();
      expect(cand.vetted).toBe(false);
    }
  });
});
