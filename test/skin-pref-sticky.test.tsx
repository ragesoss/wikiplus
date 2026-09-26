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

describe("the toggle re-signs the session", () => {
  it("signed in: a toggle calls update({ skinPreference: next })", async () => {
    const update = vi.fn(async () => null);
    render(<FooterSkinToggle />, { wrapper: withSession("authenticated", update) });
    const btn = await screen.findByRole("button");
    await waitFor(() => expect(btn.textContent).toMatch(/dark/i));
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute("data-skin")).toBe("zine-dark");
    expect(update).toHaveBeenCalledWith({ skinPreference: "zine-dark" });
  });

  it("signed out: no session update (and none needed without a provider)", async () => {
    const update = vi.fn(async () => null);
    render(<FooterSkinToggle />, { wrapper: withSession("unauthenticated", update) });
    fireEvent.click(await screen.findByRole("button"));
    expect(update).not.toHaveBeenCalled();
    // No SessionProvider at all: the toggle still works.
    clearAll();
    render(<FooterSkinToggle />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(getCookie()).toBe("zine-dark");
  });
});

describe("reload after a signed-in toggle keeps the new skin", () => {
  it("a remounted SkinSync with the re-signed session does not revert the cookie", async () => {
    // Session stamped dark at sign-in; the user toggles to light.
    let pref = "zine-dark";
    const update = vi.fn(async (d: { skinPreference: string }) => {
      pref = d.skinPreference;
      return null;
    });
    document.cookie = "wikiplus-skin=zine-dark; Path=/";
    document.documentElement.setAttribute("data-skin", "zine-dark");
    const { unmount } = render(<FooterSkinToggle />, {
      wrapper: withSession("authenticated", update as unknown as Ctx["update"]),
    });
    const btn = await screen.findByRole("button");
    await waitFor(() => expect(btn.textContent).toMatch(/light/i));
    fireEvent.click(btn);
    expect(getCookie()).toBe("zine");
    expect(pref).toBe("zine");
    unmount();

    // "Reload": a fresh SkinSync mount reading the (re-signed) session.
    const sessionValue = {
      data: { user: { skinPreference: pref }, expires: "" },
      status: "authenticated",
      update,
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
