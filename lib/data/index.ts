import { LocalStorageDataStore } from "./local-store";
import type { DataStore } from "./store";
import type { Clip, Topic } from "./types";

// Prototype phase: localStorage. Production swaps this single line for a
// Drizzle/Postgres store invoked via Server Actions — see docs/ARCHITECTURE.md.
export const store: DataStore = new LocalStorageDataStore();

/** Seed data for "Photosynthesis" (Q34887) with section-anchored clips for demonstrable scroll-sync. */
const SEED_TOPICS: Topic[] = [
  { qid: "Q34887", title: "Photosynthesis", description: "Process used by plants to convert light into chemical energy" },
  { qid: "Q146", title: "Cat", description: "Domesticated small carnivorous mammal" },
];

type SeedClip = Omit<Clip, "id" | "createdAt">;

const SEED_CLIPS: SeedClip[] = [
  // General clips (no sectionAnchor) — appear in the General strip
  {
    topicQid: "Q34887",
    videoUrl: "https://www.youtube.com/watch?v=CMHGpBCQRMc",
    platform: "youtube",
    videoId: "CMHGpBCQRMc",
    title: "Photosynthesis: Crash Course Biology",
    creator: { handle: "crashcourse", displayName: "CrashCourse", platform: "youtube" },
    contextNote: "Excellent overview of photosynthesis fundamentals. The creator accurately explains both light-dependent and light-independent reactions. Slight simplification of the Z-scheme is acceptable for an introductory audience.",
    stance: "explainer",
    accuracyFlag: "mostly-accurate",
    orientation: "landscape",
    upvotes: 42,
  },
  {
    topicQid: "Q34887",
    videoUrl: "https://www.youtube.com/watch?v=eo-xKoFDlOs",
    platform: "youtube",
    videoId: "eo-xKoFDlOs",
    title: "What is Photosynthesis?",
    creator: { handle: "kurzgesagt", displayName: "Kurzgesagt", platform: "youtube" },
    contextNote: "Beautifully animated introduction. Accurately conveys the core concept that plants convert sunlight to chemical energy. The creator's enthusiasm is genuine, not opinion.",
    stance: "explainer",
    accuracyFlag: "accurate",
    orientation: "landscape",
    upvotes: 87,
  },
  // Section-anchored clips — appear in the right rail, synced to article sections
  {
    topicQid: "Q34887",
    videoUrl: "https://www.youtube.com/watch?v=uixA8ZXx0KU",
    platform: "youtube",
    videoId: "uixA8ZXx0KU",
    title: "Light-dependent reactions explained",
    creator: { handle: "amoeba_sisters", displayName: "Amoeba Sisters", platform: "youtube" },
    contextNote: "Solid explanation of the light-dependent reactions. The analogy of photosystems as 'light-harvesting antennae' is accurate and helpful. The creator stays factual throughout this section.",
    stance: "explainer",
    accuracyFlag: "accurate",
    sectionAnchor: "Light-dependent_reactions",
    orientation: "landscape",
    upvotes: 31,
  },
  {
    topicQid: "Q34887",
    videoUrl: "https://www.youtube.com/watch?v=slm6D2VEXYs",
    platform: "youtube",
    videoId: "slm6D2VEXYs",
    title: "The Calvin Cycle: Carbon fixation",
    creator: { handle: "bozeman_science", displayName: "Bozeman Science", platform: "youtube" },
    contextNote: "Clear walkthrough of the Calvin cycle (light-independent reactions). The creator correctly identifies RuBisCO as the key enzyme. The claim that the cycle 'runs continuously' needs context — it depends on light-derived ATP/NADPH.",
    stance: "explainer",
    accuracyFlag: "mostly-accurate",
    sectionAnchor: "Calvin_cycle",
    orientation: "landscape",
    upvotes: 19,
  },
  {
    topicQid: "Q34887",
    videoUrl: "https://www.youtube.com/watch?v=P7l8b9OoXWw",
    platform: "youtube",
    videoId: "P7l8b9OoXWw",
    title: "Chloroplasts and their structure",
    creator: { handle: "professor_dave", displayName: "Professor Dave Explains", platform: "youtube" },
    contextNote: "Good structural overview of the chloroplast. The distinction between grana/stroma lamellae and the stroma is accurate. This is factual explanation with no notable editorial stance.",
    stance: "explainer",
    accuracyFlag: "accurate",
    sectionAnchor: "In_plants",
    orientation: "landscape",
    upvotes: 14,
  },
];

/** Seed topics and clips so the prototype is usable on first load. */
export async function seedIfEmpty(): Promise<void> {
  const topics = await store.listTopics();
  if (topics.length > 0) return;

  for (const topic of SEED_TOPICS) {
    await store.upsertTopic(topic);
  }

  const LocalStore = store as LocalStorageDataStore;
  if (typeof (LocalStore as { _seedClips?: unknown })._seedClips === "function") {
    // Future: dedicated seed method
  }

  // Add seed clips directly
  for (const clip of SEED_CLIPS) {
    await store.addClip(clip);
  }
}

export type { DataStore } from "./store";
