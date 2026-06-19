import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Issue #64 — resolve real video metadata on add-by-link (PART 2): the AddModal A→B→{C|D|E|F|G}
// state machine. The resolve server action is MOCKED at the module level (vi.mock is hoisted, so
// this lives in its own file separate from the resolver's REAL unit tests in
// test/add-link-metadata.test.tsx). No live network. Verifies AC1–AC6 + AC9 through the modal.

// ── 3. The AddModal state machine (mock the resolve server action) ───────────────────────────
const resolveOEmbed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/embed/oembed", () => ({ resolveOEmbedAction: resolveOEmbed }));

import { AddModal } from "@/components/topic/AddModal";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import type { Clip } from "@/lib/data/types";

const sections = [{ slug: "sharpening", title: "Sharpening" }];

type OnSubmit = (
  clip: Omit<Clip, "id" | "createdAt">,
  agreed: boolean
) => Promise<SubmitOutcome>;
const makeOk = () => vi.fn<OnSubmit>(async () => ({ outcome: "added" }));

function renderAdd(onSubmit = makeOk(), onClose = vi.fn()) {
  render(
    <AddModal
      sections={sections}
      topicQid="Q189603"
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
  return { onSubmit, onClose };
}

async function fetchDetailsFor(url: string) {
  await userEvent.type(screen.getByPlaceholderText(/youtu\.be/), url);
  await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));
}

async function fillNoteAndAgree() {
  await userEvent.type(
    screen.getByPlaceholderText(/Separate fact/),
    "A context note for this clip."
  );
  await userEvent.click(
    screen.getByRole("checkbox", {
      name: "I agree to release my context note under CC BY-SA 4.0.",
    })
  );
}

describe("AddModal — #64 resolve → preview → persist (AC1/AC2/AC3)", () => {
  beforeEach(() => {
    resolveOEmbed.mockReset();
  });

  it("AC1/AC2/AC3 — a YouTube link resolves real metadata into the preview AND the persisted clip; NO mock strings", async () => {
    resolveOEmbed.mockResolvedValue({
      ok: true,
      meta: {
        title: "Real Sharpening Guide",
        authorName: "Sharp Channel",
        authorUrl: "https://www.youtube.com/@sharpchannel",
        thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      },
    });
    const onSubmit = makeOk();
    const onClose = vi.fn();
    renderAdd(onSubmit, onClose);
    await fetchDetailsFor("https://youtu.be/abc123");

    // AC1/AC3 — the real preview shows BEFORE submit, with the honest eyebrow.
    expect(await screen.findByText("Real Sharpening Guide")).toBeInTheDocument();
    expect(screen.getByText("Sharp Channel")).toBeInTheDocument();
    expect(screen.getByText("Resolved via oEmbed")).toBeInTheDocument();
    expect(screen.queryByText(/mock preview/i)).toBeNull();
    // The credit links OUT to the real author_url (C10 minimum credit).
    const credit = screen.getByText("Sharp Channel").closest("a");
    expect(credit).toHaveAttribute(
      "href",
      "https://www.youtube.com/@sharpchannel"
    );

    await fillNoteAndAgree();
    await userEvent.click(screen.getByRole("button", { name: /Add & curate/ }));

    // AC2 — the persisted clip carries the real metadata, not the mock.
    const [clip] = onSubmit.mock.calls[0];
    expect(clip.caption).toBe("Real Sharpening Guide");
    expect(clip.thumbnailUrl).toBe("https://i.ytimg.com/vi/abc123/hqdefault.jpg");
    expect(clip.creator).toMatchObject({
      name: "Sharp Channel",
      handle: "@sharpchannel",
      url: "https://www.youtube.com/@sharpchannel",
    });
    expect(clip.caption).not.toBe("Pasted clip (mock preview)");
    expect(clip.creator.handle).not.toBe("pasted");
    expect(clip.creator.name).not.toBe("Pasted YouTube clip");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("AddModal — #64 failure → fallback (state D / E, AC4/AC5, C10)", () => {
  beforeEach(() => resolveOEmbed.mockReset());

  it("AC4 — a recognized link whose fetch fails shows the labeled failure state, NOT 'resolved via oEmbed'", async () => {
    resolveOEmbed.mockResolvedValue({ ok: false, reason: "failed" });
    renderAdd();
    await fetchDetailsFor("https://youtu.be/zzz");

    expect(
      await screen.findByText("Couldn't fetch video details")
    ).toBeInTheDocument();
    // Distinct from success: no false "resolved via oEmbed" claim (AC3/AC4).
    expect(screen.queryByText("Resolved via oEmbed")).toBeNull();
    // The three recovery controls exist — never a dead end (AC5).
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add anyway" })).toBeInTheDocument();
    // No curate fields yet — the failure is undecided (design invariant §2).
    expect(screen.queryByRole("combobox", { name: "Stance" })).toBeNull();
  });

  it("AC5 — 'Try again' re-runs the resolve and can recover to the resolved preview", async () => {
    resolveOEmbed
      .mockResolvedValueOnce({ ok: false, reason: "failed" })
      .mockResolvedValueOnce({
        ok: true,
        meta: {
          title: "Recovered Title",
          authorName: "Sharp Channel",
          authorUrl: "https://www.youtube.com/@sharpchannel",
        },
      });
    renderAdd();
    await fetchDetailsFor("https://youtu.be/zzz");
    await screen.findByText("Couldn't fetch video details");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Recovered Title")).toBeInTheDocument();
    expect(screen.getByText("Resolved via oEmbed")).toBeInTheDocument();
  });

  it("AC4/AC5/C10 — 'Add anyway' yields an honest unresolved placeholder clip (no fake name/link, no false oEmbed claim)", async () => {
    resolveOEmbed.mockResolvedValue({ ok: false, reason: "failed" });
    const onSubmit = makeOk();
    renderAdd(onSubmit);
    await fetchDetailsFor("https://youtu.be/zzz");
    await screen.findByText("Couldn't fetch video details");
    await userEvent.click(screen.getByRole("button", { name: "Add anyway" }));

    // The honest placeholder preview (state E): no "resolved via oEmbed".
    expect(await screen.findByText("Unresolved YouTube clip")).toBeInTheDocument();
    expect(screen.getByText("Creator not resolved")).toBeInTheDocument();
    expect(screen.queryByText("Resolved via oEmbed")).toBeNull();

    await fillNoteAndAgree();
    await userEvent.click(screen.getByRole("button", { name: /Add & curate/ }));

    // The persisted placeholder clip reads as unresolved, never as a real creator (C10).
    const [clip] = onSubmit.mock.calls[0];
    expect(clip.caption).toBe("Unresolved YouTube clip");
    expect(clip.creator.name).toBe("Creator not resolved");
    expect(clip.creator.url).toBeUndefined();
    expect(clip.creator.handle).toBe("");
    // The video still plays — embed/watch from the real parse (AC7).
    expect(clip.embedUrl).toBe("https://www.youtube-nocookie.com/embed/zzz");
    expect(clip.watchUrl).toBe("https://youtu.be/zzz");
  });
});

describe("AddModal — TikTok resolves through the YouTube path (D-TikTok: AC1/AC3/AC10)", () => {
  beforeEach(() => resolveOEmbed.mockReset());

  it("AC1/AC3 — a good TikTok resolve shows the real preview with the URL @handle (D1)", async () => {
    resolveOEmbed.mockResolvedValue({
      ok: true,
      meta: {
        // author_name DIVERGES from the URL handle — D1 must still show @junglygarden.
        title: "Repotting a Dendrobium kingianum",
        authorName: "Jungly Garden Official",
        authorUrl: "https://www.tiktok.com/@junglygarden",
        thumbnailUrl: "https://p16.tiktokcdn.com/thumb.jpg",
      },
    });
    const onSubmit = makeOk();
    renderAdd(onSubmit);
    await fetchDetailsFor(
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );

    expect(
      await screen.findByText("Repotting a Dendrobium kingianum")
    ).toBeInTheDocument();
    expect(screen.getByText("Jungly Garden Official")).toBeInTheDocument();
    expect(screen.getByText("Resolved via oEmbed")).toBeInTheDocument();
    // D1: the URL handle shows in the credit, not the author-name slug.
    expect(screen.getByText("@junglygarden · TikTok")).toBeInTheDocument();
    // AC10: no "we don't fetch TikTok" copy ever renders on the TikTok path.
    expect(
      screen.queryByText(/We don't fetch TikTok video details yet/)
    ).toBeNull();
    const credit = screen.getByText("Jungly Garden Official").closest("a");
    expect(credit).toHaveAttribute("href", "https://www.tiktok.com/@junglygarden");

    await fillNoteAndAgree();
    await userEvent.click(screen.getByRole("button", { name: /Add & curate/ }));
    // The persisted handle matches the previewed handle (D1).
    const [clip] = onSubmit.mock.calls[0];
    expect(clip.platform).toBe("tiktok");
    expect(clip.caption).toBe("Repotting a Dendrobium kingianum");
    expect(clip.creator).toMatchObject({
      name: "Jungly Garden Official",
      handle: "@junglygarden",
      url: "https://www.tiktok.com/@junglygarden",
    });
  });

  it("AC4 — a TikTok resolve missing author_url shows a non-linked credit (still state C)", async () => {
    resolveOEmbed.mockResolvedValue({
      ok: true,
      meta: {
        title: "No-link clip",
        authorName: "Jungly Garden",
        // no authorUrl, no thumbnailUrl
      },
    });
    renderAdd();
    await fetchDetailsFor(
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    expect(await screen.findByText("No-link clip")).toBeInTheDocument();
    expect(screen.getByText("Resolved via oEmbed")).toBeInTheDocument();
    // No outbound link — the name is NOT wrapped in an anchor (C10 name-without-link).
    expect(screen.getByText("Jungly Garden").closest("a")).toBeNull();
    // The URL handle still shows as text in the non-linked credit.
    expect(screen.getByText("@junglygarden · TikTok")).toBeInTheDocument();
  });

  it("AC6/D2 — a TikTok fetch failure routes to state D (Try again / Add anyway), never 'unsupported' copy", async () => {
    resolveOEmbed.mockResolvedValue({ ok: false, reason: "failed" });
    renderAdd();
    await fetchDetailsFor(
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    expect(
      await screen.findByText("Couldn't fetch video details")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add anyway" })).toBeInTheDocument();
    // AC10: never the "we don't fetch TikTok" line on a platform we now fetch.
    expect(
      screen.queryByText(/We don't fetch TikTok video details yet/)
    ).toBeNull();
    expect(screen.queryByText("Resolved via oEmbed")).toBeNull();
  });

  it("AC7 — Add anyway from a TikTok failure yields the honest placeholder (no fabricated handle)", async () => {
    resolveOEmbed.mockResolvedValue({ ok: false, reason: "failed" });
    const onSubmit = makeOk();
    renderAdd(onSubmit);
    await fetchDetailsFor(
      "https://www.tiktok.com/@junglygarden/video/7242553660062944558"
    );
    await screen.findByText("Couldn't fetch video details");
    await userEvent.click(screen.getByRole("button", { name: "Add anyway" }));
    expect(await screen.findByText("Unresolved TikTok clip")).toBeInTheDocument();
    expect(screen.getByText("Creator not resolved")).toBeInTheDocument();

    await fillNoteAndAgree();
    await userEvent.click(screen.getByRole("button", { name: /Add & curate/ }));
    const [clip] = onSubmit.mock.calls[0];
    expect(clip.platform).toBe("tiktok");
    expect(clip.caption).toBe("Unresolved TikTok clip");
    expect(clip.creator.name).toBe("Creator not resolved");
    expect(clip.creator.url).toBeUndefined();
    expect(clip.creator.handle).toBe(""); // never the URL handle on the unresolved placeholder.
  });
});

describe("AddModal — Instagram/other still use the unsupported placeholder arm (state G, AC8)", () => {
  beforeEach(() => resolveOEmbed.mockReset());

  it("a recognized Instagram link goes straight to the honest placeholder + MVP-limitation line (no 'Try again')", async () => {
    resolveOEmbed.mockResolvedValue({ ok: false, reason: "unsupported" });
    const onSubmit = makeOk();
    renderAdd(onSubmit);
    await userEvent.type(
      screen.getByPlaceholderText(/youtu\.be/),
      "https://www.instagram.com/reel/ABC123/"
    );
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));

    expect(
      await screen.findByText("Unresolved Instagram clip")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We don't fetch Instagram video details yet/)
    ).toBeInTheDocument();
    // No retry on the support-limitation arm (retrying won't help).
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByText("Resolved via oEmbed")).toBeNull();

    await fillNoteAndAgree();
    await userEvent.click(screen.getByRole("button", { name: /Add & curate/ }));
    const [clip] = onSubmit.mock.calls[0];
    expect(clip.platform).toBe("instagram");
    expect(clip.caption).toBe("Unresolved Instagram clip");
    expect(clip.creator.name).toBe("Creator not resolved");
    expect(clip.creator.url).toBeUndefined();
  });
});

describe("AddModal — #64 unrecognized-link no-regression (state F, AC9)", () => {
  beforeEach(() => resolveOEmbed.mockReset());

  it("AC9 — an unrecognized link keeps the existing red validation, never resolves, never persists", async () => {
    const onSubmit = makeOk();
    renderAdd(onSubmit);
    await userEvent.type(screen.getByRole("textbox"), "https://evil.test/x");
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unrecognized link — paste a YouTube or TikTok URL."
    );
    // Parse-first: the resolve action is never reached for an unrecognized link.
    expect(resolveOEmbed).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox", { name: "Stance" })).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
