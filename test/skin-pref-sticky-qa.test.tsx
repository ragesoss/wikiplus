import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// QA (fresh eyes) — docs/design/skin-pref-sticky.md against the REAL next-auth/react
// SessionProvider + `update()` (only the network is faked). Exercises the in-flight window of
// `update`, which the author's suite stubs away.

vi.mock("@/lib/data", () => ({ store: { setSkinPreference: async () => {} } }));
vi.mock("next-auth/react", async () => await vi.importActual("next-auth/react"));

import { SessionProvider, useSession } from "next-auth/react";
import { FooterSkinToggle } from "@/components/chrome/FooterSkinToggle";

let jwtSkin = "zine-dark";
const posts: unknown[] = [];
let releasePost: (() => void) | null = null;

function sessionBody() {
  return { user: { name: "Reader", skinPreference: jwtSkin }, expires: "2099-01-01T00:00:00.000Z" };
}
function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  jwtSkin = "zine-dark";
  posts.length = 0;
  document.cookie = "wikiplus-skin=zine-dark; Path=/";
  document.documentElement.setAttribute("data-skin", "zine-dark");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/csrf")) return json({ csrfToken: "t" });
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        posts.push(body.data);
        // Hold the POST open to model the network round-trip.
        await new Promise<void>((r) => (releasePost = r));
        if (body.data?.skinPreference) jwtSkin = body.data.skinPreference;
        return json(sessionBody());
      }
      return json(sessionBody());
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-skin");
  document.cookie = "wikiplus-skin=; Max-Age=0; Path=/";
});

const statuses: string[] = [];
function StatusProbe() {
  const { status } = useSession();
  statuses.push(status);
  return <span data-testid="status">{status}</span>;
}

async function mountSignedIn() {
  render(
    <SessionProvider>
      <StatusProbe />
      <FooterSkinToggle />
    </SessionProvider>
  );
  await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
  return screen.getByRole("button");
}

describe("QA — real SessionProvider update() window", () => {
  it("a toggle re-signs the JWT (baseline — the fix works for a single toggle)", async () => {
    const btn = await mountSignedIn();
    fireEvent.click(btn);
    await waitFor(() => expect(posts).toEqual([{ skinPreference: "zine" }]));
    await act(async () => releasePost?.());
    await waitFor(() => expect(jwtSkin).toBe("zine"));
  });

  it("DEFECT: the app-wide session status must stay 'authenticated' during a skin toggle", async () => {
    const btn = await mountSignedIn();
    statuses.length = 0;
    fireEvent.click(btn);
    await waitFor(() => expect(posts.length).toBe(1));
    // update() sets the provider's loading flag → every useSession() consumer sees "loading"
    // (AuthControl → neutral chip, /contribute → form swapped for a skeleton, /watchlist → panel).
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    await act(async () => releasePost?.());
  });

  it("DEFECT: a second toggle while the first update is in flight must also re-sign the JWT", async () => {
    const btn = await mountSignedIn();
    fireEvent.click(btn); // → light
    await waitFor(() => expect(posts.length).toBe(1));
    fireEvent.click(screen.getByRole("button")); // → dark again, before the POST resolves
    expect(document.cookie).toContain("wikiplus-skin=zine-dark");
    await act(async () => releasePost?.());
    await new Promise((r) => setTimeout(r, 20));
    await act(async () => releasePost?.());
    // Cookie says dark; the JWT must too, or the next reload's SkinSync mirror reverts to light.
    expect(jwtSkin).toBe("zine-dark");
  });
});
