import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// QA & Review hardening for issue #64 (independent, non-author). The author's tests
// (test/add-link-metadata.test.tsx, test/add-modal-resolve.test.tsx, test/modals.test.tsx)
// cover AC1–AC6/AC9 and the C10 credit shape. These add the SECURITY + invariant guards QA
// owns: the SSRF posture of the new Server-Action fetch surface, AC10 (no schema field / no
// secret), and the C10 read-path realization on the card (a non-linked credit when
// `creator.url` is absent — never a dead/empty href).

import {
  placeholderMediaSource,
  resolvedMediaSource,
} from "@/components/topic/add-media";
import { parseVideoUrl } from "@/lib/embed/facade";
import { resolveOEmbedAction } from "@/lib/embed/oembed";
import { ClipCard } from "@/components/topic/ClipCard";
import type { ClipMediaSource } from "@/components/topic/curate-clip";
import type { Clip } from "@/lib/data/types";

afterEach(() => vi.restoreAllMocks());

// ── SECURITY: SSRF / open-proxy posture of resolveOEmbedAction ────────────────────────────────
// The Server Action fetches a remote URL derived from USER-PASTED input. A Server Action's args
// are fully client-controllable (the type signature is not a runtime guard), so QA treats both
// `platform` and `watchUrl` as attacker-controlled and proves the fetch can ONLY ever hit the
// fixed YouTube oEmbed host, with the pasted URL confined to a query parameter.
describe("resolveOEmbedAction — SSRF posture (QA security review, issue #64)", () => {
  function spyFetch(json: Record<string, unknown> = {}) {
    return vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        (async () => ({ ok: true, json: async () => json })) as unknown as typeof fetch
      );
  }

  it("fetches ONLY the fixed www.youtube.com/oembed host — the host is never user-controlled", async () => {
    const fetchSpy = spyFetch({ title: "T", author_name: "A" });
    await resolveOEmbedAction("youtube", "https://youtu.be/abc");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const fetched = new URL(fetchSpy.mock.calls[0][0] as string);
    // The fixed endpoint — host/origin/path are constants in the resolver, not from input.
    expect(fetched.origin).toBe("https://www.youtube.com");
    expect(fetched.pathname).toBe("/oembed");
  });

  it("confines a malicious pasted URL to the ?url= QUERY param — cannot redirect the fetch off-host", async () => {
    const fetchSpy = spyFetch({ title: "T", author_name: "A" });
    // A crafted watchUrl that tries to break out of the query (an internal-network target, an
    // @-userinfo host swap, a CRLF). encodeURIComponent must neutralize all of it.
    const evil =
      "http://169.254.169.254/latest/meta-data#@evil.test/?x=y&z\r\nHost: evil";
    await resolveOEmbedAction("youtube", evil);
    const fetched = new URL(fetchSpy.mock.calls[0][0] as string);
    // The host is STILL the fixed YouTube endpoint — the evil string never escapes the query.
    expect(fetched.origin).toBe("https://www.youtube.com");
    expect(fetched.pathname).toBe("/oembed");
    // The evil payload round-trips intact INSIDE the `url` query param (escaped), not as a host.
    expect(fetched.searchParams.get("url")).toBe(evil);
    expect(fetched.searchParams.get("format")).toBe("json");
  });

  it("makes NO fetch at all for any non-YouTube platform (gate is BEFORE the network call)", async () => {
    const fetchSpy = spyFetch();
    // Every non-youtube platform value — including a bogus/forged one — must short-circuit.
    for (const p of ["tiktok", "instagram", "other", "evil" as never]) {
      expect(await resolveOEmbedAction(p as never, "http://10.0.0.1/internal")).toEqual({
        ok: false,
        reason: "unsupported",
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does NOT re-fetch the response's author_url/thumbnail_url (no second-order SSRF)", async () => {
    // The resolver returns these as DATA; it must never use them as a fetch target itself.
    const fetchSpy = spyFetch({
      title: "T",
      author_name: "A",
      author_url: "http://127.0.0.1:6379/", // would be an SSRF target if re-fetched
      thumbnail_url: "http://169.254.169.254/",
    });
    const res = await resolveOEmbedAction("youtube", "https://youtu.be/abc");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // exactly one fetch — no follow-up to the URLs.
    expect(res.ok).toBe(true);
  });
});

// ── AC10: no schema change (no new ClipMediaSource field) + no new secret ─────────────────────
describe("AC10 — no schema change, no new secret (QA invariant guard)", () => {
  const parsed = parseVideoUrl("https://youtu.be/abc123")!;
  // The FULL allowed ClipMediaSource key set (curate-clip.ts). A resolve/placeholder may emit a
  // SUBSET (an optional field like thumbGrad is legitimately absent) but must never emit a key
  // OUTSIDE this set — a new key would be a NEW persisted field, the schema change AC10 forbids.
  const ALLOWED_KEYS = new Set([
    "topicQid",
    "platform",
    "platformLabel",
    "orientation",
    "watchUrl",
    "embedUrl",
    "thumbnailUrl",
    "thumbGrad",
    "caption",
    "creator",
  ]);

  it("resolvedMediaSource emits NO key outside the existing ClipMediaSource shape (no new column)", () => {
    const m: ClipMediaSource = resolvedMediaSource(
      parsed,
      { title: "T", authorName: "A", authorUrl: "https://x", thumbnailUrl: "https://t" },
      "YouTube",
      "Q1",
      "https://youtu.be/abc123"
    );
    const extra = Object.keys(m).filter((k) => !ALLOWED_KEYS.has(k));
    expect(extra).toEqual([]);
    // And the creator carries no field outside the existing Creator shape.
    const creatorExtra = Object.keys(m.creator).filter(
      (k) =>
        !["handle", "name", "platform", "url", "avatarGrad", "followerCount"].includes(k)
    );
    expect(creatorExtra).toEqual([]);
  });

  it("placeholderMediaSource emits NO key outside the existing ClipMediaSource shape (no new column)", () => {
    const m = placeholderMediaSource(parsed, "YouTube", "Q1", "https://youtu.be/abc123");
    const extra = Object.keys(m).filter((k) => !ALLOWED_KEYS.has(k));
    expect(extra).toEqual([]);
  });

  it("the resolver source reads NO API key/secret/token env var (oEmbed needs none — AC10)", () => {
    // A guard on the source text: oEmbed is key-less. Any process.env read in the resolver would
    // signal an introduced secret (the YouTube Data API key path lives elsewhere, untouched).
    // vitest runs from the repo root; resolve the resolver source off cwd (jsdom's import.meta.url
    // is an http: URL, not a file: URL, so fileURLToPath can't be used here).
    const src = readFileSync(resolve(process.cwd(), "lib/embed/oembed.ts"), "utf8");
    // Strip line + block comments so the scan sees CODE only — the file's prose legitimately
    // SAYS "no secret" (the resolver asserting its own statelessness), which must not trip a
    // code-level secret check.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/api[_-]?key|secret|token/i);
  });
});

// ── C10 read-path: the card credit degrades to a NON-LINKED span when creator.url is absent ───
// The design (§7) flags this as the read-path realization of "no fake/dead creator link". QA
// verifies the SHIPPED card, not just the modal preview.
describe("ClipCard creator credit — C10 read-path degradation (issue #64)", () => {
  const base: Clip = {
    id: "c1",
    topicQid: "Q1",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "vertical",
    watchUrl: "https://youtu.be/abc",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc",
    caption: "Unresolved YouTube clip",
    creator: { name: "Creator not resolved", handle: "", platform: "youtube" },
    general: true,
    contextNote: "A note.",
    stance: "explainer",
    accuracyFlag: "accurate",
    createdAt: "2026-06-18T00:00:00.000Z",
  };

  function renderCard(clip: Clip) {
    render(
      <ClipCard
        clip={clip}
        active={false}
        onPlay={vi.fn()}
        onGoToSection={vi.fn()}
      />
    );
  }

  it("an UNRESOLVED clip (no creator.url) renders the credit as plain text — never a dead/empty <a>", () => {
    renderCard(base);
    const name = screen.getByText("Creator not resolved");
    // The credit must NOT be wrapped in an anchor (no dead/empty href — C10).
    expect(name.closest("a")).toBeNull();
    // And no anchor anywhere carries an empty/undefined href (the dead-link failure mode).
    for (const a of document.querySelectorAll("a")) {
      const href = a.getAttribute("href");
      expect(href === "" || href === "undefined" || href === null).toBe(false);
    }
    // Name-only: the credit's platform line is the bare label (no "@handle ·" prefix — no fake
    // handle on an unresolved clip, C10).
    const platformLine = name.parentElement?.querySelector("span:last-child");
    expect(platformLine?.textContent).toBe("YouTube");
  });

  it("a RESOLVED clip (with creator.url) DOES render an outbound link with rel=noopener", () => {
    renderCard({
      ...base,
      caption: "Real Title",
      creator: {
        name: "Sharp Channel",
        handle: "@sharpchannel",
        platform: "youtube",
        url: "https://www.youtube.com/@sharpchannel",
      },
    });
    const link = screen.getByText("Sharp Channel").closest("a");
    expect(link).toHaveAttribute("href", "https://www.youtube.com/@sharpchannel");
    expect(link).toHaveAttribute("rel", "noopener");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
