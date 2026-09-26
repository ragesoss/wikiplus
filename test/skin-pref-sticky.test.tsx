import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { JWT } from "next-auth/jwt";

// docs/design/skin-pref-sticky.md — a signed-in skin toggle survives reload. The toggle re-signs the
// session JWT via Auth.js `update({ skinPreference })`, so SkinSync's load-time DB→cookie mirror
// (which runs on every mount) reads the CURRENT choice, never the stale sign-in-time one.

const setSkinPreference = vi.fn(async (_skin: string | null) => {});
vi.mock("@/lib/data", () => ({
  store: { setSkinPreference: (s: string | null) => setSkinPreference(s) },
}));

// `useSession` reads the provided SessionContext (the real hook's behavior), so SkinSync sees the
// session each test supplies rather than the global setup stub.
vi.mock("next-auth/react", async () => {
  const React = await import("react");
  const SessionContext = React.createContext<unknown>(undefined);
  return {
    SessionContext,
    useSession: () =>
      React.useContext(SessionContext) ?? { data: null, status: "unauthenticated" },
  };
});

import { SessionContext } from "next-auth/react";
import { authConfig } from "@/lib/auth/config";
import { FooterSkinToggle } from "@/components/chrome/FooterSkinToggle";
import { SkinSync } from "@/components/header/SkinSync";

function getCookie(): string | null {
  const m = document.cookie.match(/(?:^|; )wikiplus-skin=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function clearAll() {
  document.documentElement.removeAttribute("data-skin");
  document.cookie = "wikiplus-skin=; Max-Age=0; Path=/";
}
beforeEach(() => {
  clearAll();
  setSkinPreference.mockClear();
});
afterEach(clearAll);

type Jwt = NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>;
const jwt = authConfig.callbacks!.jwt as Jwt;
const base = (): JWT => ({
  contributorId: 7,
  username: "Reader",
  isModerator: false,
  skinPreference: "zine-dark",
});
async function runUpdate(session: unknown): Promise<JWT> {
  return (await jwt({ token: base(), trigger: "update", session } as Parameters<Jwt>[0])) as JWT;
}

describe("jwt `update` trigger — only a closed-set skinPreference is accepted", () => {
  it("re-stamps a valid skinPreference", async () => {
    expect((await runUpdate({ skinPreference: "zine" })).skinPreference).toBe("zine");
    expect((await runUpdate({ skinPreference: "zine-dark" })).skinPreference).toBe("zine-dark");
  });

  it("ignores identity/role claims in the client payload", async () => {
    const t = await runUpdate({
      skinPreference: "zine",
      contributorId: 999,
      username: "Admin",
      isModerator: true,
    });
    expect(t).toEqual({ ...base(), skinPreference: "zine" });
  });

  it("ignores an unknown / missing / non-string skin", async () => {
    for (const session of [{ skinPreference: "evil" }, { skinPreference: 1 }, {}, undefined, null]) {
      expect(await runUpdate(session)).toEqual(base());
    }
  });
});

type Ctx = NonNullable<React.ContextType<typeof SessionContext>>;
function withSession(status: Ctx["status"], update: Ctx["update"]) {
  const value = {
    data: status === "authenticated" ? { user: {}, expires: "" } : null,
    status,
    update,
  } as Ctx;
  return ({ children }: { children: React.ReactNode }) => (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// The re-sign POSTs Auth.js's session endpoint directly (not the provider's `update()`); capture it.
let jwtSkin = "zine-dark";
const posts: unknown[] = [];
beforeEach(() => {
  jwtSkin = "zine-dark";
  posts.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (String(url).endsWith("/api/auth/csrf")) return body({ csrfToken: "t" });
      if (String(url).endsWith("/api/auth/session") && init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        expect(payload.csrfToken).toBe("t");
        posts.push(payload.data);
        jwtSkin = payload.data.skinPreference;
      }
      return body({});
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("the toggle re-signs the session", () => {
  it("signed in: a toggle POSTs { skinPreference: next } with the CSRF token", async () => {
    const update = vi.fn(async () => null);
    render(<FooterSkinToggle />, { wrapper: withSession("authenticated", update) });
    const btn = await screen.findByRole("button");
    await waitFor(() => expect(btn.textContent).toMatch(/dark/i));
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute("data-skin")).toBe("zine-dark");
    await waitFor(() => expect(posts).toEqual([{ skinPreference: "zine-dark" }]));
    // The provider's `update()` (which flips every consumer to "loading") is never used.
    expect(update).not.toHaveBeenCalled();
  });

  it("signed out: no re-sign (and none needed without a provider)", async () => {
    render(<FooterSkinToggle />, { wrapper: withSession("unauthenticated", vi.fn()) });
    fireEvent.click(await screen.findByRole("button"));
    await new Promise((r) => setTimeout(r, 20));
    expect(posts).toEqual([]);
    // No SessionProvider at all: the toggle still works.
    clearAll();
    render(<FooterSkinToggle />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(getCookie()).toBe("zine-dark");
    await new Promise((r) => setTimeout(r, 20));
    expect(posts).toEqual([]);
  });
});

describe("reload after a signed-in toggle keeps the new skin", () => {
  it("a remounted SkinSync with the re-signed session does not revert the cookie", async () => {
    // Session stamped dark at sign-in; the user toggles to light.
    document.cookie = "wikiplus-skin=zine-dark; Path=/";
    document.documentElement.setAttribute("data-skin", "zine-dark");
    const { unmount } = render(<FooterSkinToggle />, {
      wrapper: withSession("authenticated", vi.fn()),
    });
    const btn = await screen.findByRole("button");
    await waitFor(() => expect(btn.textContent).toMatch(/light/i));
    fireEvent.click(btn);
    expect(getCookie()).toBe("zine");
    await waitFor(() => expect(jwtSkin).toBe("zine"));
    unmount();

    // "Reload": a fresh SkinSync mount reading the (re-signed) session.
    const sessionValue = {
      data: { user: { skinPreference: jwtSkin }, expires: "" },
      status: "authenticated",
      update: vi.fn(),
    } as unknown as Ctx;
    await act(async () => {
      render(
        <SessionContext.Provider value={sessionValue}>
          <SkinSync />
        </SessionContext.Provider>
      );
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(getCookie()).toBe("zine");
    expect(document.documentElement.hasAttribute("data-skin")).toBe(false);
  });
});
