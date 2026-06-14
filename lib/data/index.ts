import { LocalStorageDataStore } from "./local-store";
import type { DataStore } from "./store";

// Prototype phase: localStorage. Production swaps this single line for a
// Drizzle/Postgres store invoked via Server Actions — see docs/ARCHITECTURE.md.
export const store: DataStore = new LocalStorageDataStore();

/** Seed one topic so the prototype isn't empty on first load. */
export async function seedIfEmpty(): Promise<void> {
  if ((await store.listTopics()).length > 0) return;
  await store.upsertTopic({ qid: "Q146", title: "Cat" });
}

export type { DataStore } from "./store";
