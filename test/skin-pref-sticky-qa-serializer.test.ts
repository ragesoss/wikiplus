import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// QA (fresh eyes, fix round 2) — the latest-wins serializer in `resignSessionSkin`
// (lib/skin/client.ts). Module-level queue state, so each test imports a fresh module.

vi.mock("@/lib/data", () => ({ store: { setSkinPreference: async () => {} } }));

type Handler = (url: string, init?: RequestInit) => Promise<Response>;
const posted: string[] = [];
function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
async function load() {
  vi.resetModules();
  return await import("@/lib/skin/client");
}
function stub(h: Handler) {
  vi.stubGlobal("fetch", vi.fn(h));
}
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  posted.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("QA — resignSessionSkin serializer", () => {
  it("coalesces: A in flight, B then A' queued → sends A then only the latest", async () => {
    const { resignSessionSkin } = await load();
    let release!: () => void;
    stub(async (url, init) => {
      if (url.endsWith("/csrf")) return json({ csrfToken: "t" });
      posted.push(JSON.parse(String(init!.body)).data.skinPreference);
      if (posted.length === 1) await new Promise<void>((r) => (release = r));
      return json({});
    });
    const first = resignSessionSkin("zine");
    await tick();
    void resignSessionSkin("zine-dark");
    void resignSessionSkin("zine");
    void resignSessionSkin("zine-dark");
    release();
    await first;
    expect(posted).toEqual(["zine", "zine-dark"]);
  });

  it("the queue is not stuck after a failure: a later toggle is sent", async () => {
    const { resignSessionSkin } = await load();
    let fail = true;
    stub(async (url, init) => {
      if (url.endsWith("/csrf")) {
        if (fail) return new Response("<html>502</html>", { status: 502 });
        return json({ csrfToken: "t" });
      }
      posted.push(JSON.parse(String(init!.body)).data.skinPreference);
      return json({});
    });
    await resignSessionSkin("zine");
    fail = false;
    await resignSessionSkin("zine-dark");
    expect(posted).toEqual(["zine-dark"]);
  });

  it("FINDING: a failure of the in-flight send drops the queued LATER choice (never attempted)", async () => {
    const { resignSessionSkin } = await load();
    let rejectPost!: (e: Error) => void;
    stub(async (url, init) => {
      if (url.endsWith("/csrf")) return json({ csrfToken: "t" });
      posted.push(JSON.parse(String(init!.body)).data.skinPreference);
      if (posted.length === 1) return await new Promise<Response>((_, rej) => (rejectPost = rej));
      return json({});
    });
    const first = resignSessionSkin("zine");
    await tick();
    void resignSessionSkin("zine-dark"); // the user's LAST choice, queued
    rejectPost(new Error("network"));
    await first;
    // Documents current behavior: the last choice is silently discarded by `finally`.
    expect(posted).toEqual(["zine"]);
  });

  it("FINDING: a csrf response without a token mid-queue also drops the queued later choice", async () => {
    const { resignSessionSkin } = await load();
    let releaseCsrf!: (r: Response) => void;
    let n = 0;
    stub(async (url, init) => {
      if (url.endsWith("/csrf")) {
        n++;
        if (n === 1) return await new Promise<Response>((r) => (releaseCsrf = r));
        return json({ csrfToken: "t" });
      }
      posted.push(JSON.parse(String(init!.body)).data.skinPreference);
      return json({});
    });
    const first = resignSessionSkin("zine");
    await tick();
    void resignSessionSkin("zine-dark");
    releaseCsrf(json({}));
    await first;
    expect(posted).toEqual([]);
  });
});
