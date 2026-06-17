import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerModal } from "@/components/topic/PlayerModal";
import { CurateModal } from "@/components/topic/CurateModal";
import { AddModal } from "@/components/topic/AddModal";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import type { Candidate, Clip } from "@/lib/data/types";

const sections = [
  { slug: "glycolysis", title: "Glycolysis" },
  { slug: "calvin-cycle", title: "Calvin cycle" },
];

// The modal `onSubmit` contract (issue #52 / D1): assemble-clip + consent → outcome.
type OnSubmit = (
  clip: Omit<Clip, "id" | "createdAt">,
  agreed: boolean
) => Promise<SubmitOutcome>;

// Default submit stub: resolves "added" so a successful publish closes the modal. Tests that
// need error/expired behavior pass their own typed stub.
const makeOk = () => vi.fn<OnSubmit>(async () => ({ outcome: "added" }));

describe("PlayerModal (AC11 — embedded player, no host)", () => {
  it("creates the iframe ON OPEN with the youtube-nocookie src + autoplay", () => {
    render(
      <PlayerModal
        clip={{
          embedUrl: "https://www.youtube-nocookie.com/embed/abc",
          caption: "Clip",
          orientation: "horizontal",
        }}
        onClose={vi.fn()}
      />
    );
    const frame = screen.getByTitle("Clip") as HTMLIFrameElement;
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/abc?autoplay=1"
    );
  });

  it("is a labelled dialog and closes on Esc (AC21)", async () => {
    const onClose = vi.fn();
    render(
      <PlayerModal
        clip={{ embedUrl: "https://www.youtube-nocookie.com/embed/x", caption: "C", orientation: "horizontal" }}
        onClose={onClose}
      />
    );
    expect(screen.getByRole("dialog", { name: "Video player" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("CurateModal — Promote target (AC19 / CURATION §1–§5; D1)", () => {
  const cand: Candidate = {
    id: "cand1",
    topicQid: "Q189603",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=abc",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc",
    caption: "Glycolysis Explained",
    creator: { handle: "@x", name: "Creator X", platform: "youtube" },
    vetted: false,
    source: "YouTube",
    matchReason: "match",
    general: false,
    sectionSlug: "glycolysis",
    sectionLabel: "Glycolysis",
  };

  function renderCurate(onSubmit: ReturnType<typeof makeOk> = makeOk(), onClose = vi.fn()) {
    render(
      <CurateModal candidate={cand} sections={sections} onClose={onClose} onSubmit={onSubmit} />
    );
    return { onSubmit, onClose };
  }

  it("renders the closed STANCE enum labels (incl. Myth-busting; no 'Documentary')", () => {
    renderCurate();
    const stance = screen.getByRole("combobox", { name: "Stance" });
    const opts = within(stance).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual([
      "Explainer",
      "Short",
      "Demonstration",
      "Classroom",
      "Opinion",
      "Myth-busting",
      "Personal experiment",
    ]);
    expect(opts).not.toContain("Documentary");
  });

  it("renders the closed ACCURACY enum labels (no free-text 'Anecdotal')", () => {
    renderCurate();
    const acc = screen.getByRole("combobox", { name: "Accuracy" });
    const opts = within(acc).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual([
      "Accurate",
      "Accurate, with a caveat",
      "Primary footage",
      "Opinion",
      "Mixed",
      "Misleading",
      "Inaccurate",
    ]);
    expect(opts).not.toContain("Anecdotal");
  });

  it("populates the Section select with General + article sections, defaulting to the candidate section", () => {
    renderCurate();
    const sel = screen.getByRole("combobox", { name: "Section" }) as HTMLSelectElement;
    const opts = within(sel).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual(["General", "Glycolysis", "Calvin cycle"]);
    expect(sel.value).toBe("glycolysis");
  });

  // ── D1: the required CC BY-SA agreement (AC6 / CURATION §5.3 verbatim strings). ──
  it("shows the always-visible license statement VERBATIM (CURATION §5.3)", () => {
    renderCurate();
    expect(
      screen.getByText("Your context note will be released under CC BY-SA 4.0.")
    ).toBeInTheDocument();
  });

  it("renders the required agreement checkbox VERBATIM, unchecked on open (AC6)", () => {
    renderCurate();
    const box = screen.getByRole("checkbox", {
      name: "I agree to release my context note under CC BY-SA 4.0.",
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });

  it("disables publish until note AND agreement are both present (AC6/AC10)", async () => {
    renderCurate();
    const publish = screen.getByRole("button", { name: /Publish curation/ });
    expect(publish).toBeDisabled();

    // Note alone is not enough.
    await userEvent.type(screen.getByRole("textbox"), "A real context note.");
    expect(publish).toBeDisabled();

    // Agreement + note → enabled.
    await userEvent.click(screen.getByRole("checkbox"));
    expect(publish).toBeEnabled();
  });

  it("publishes once preconditions are met: calls onSubmit with the assembled clip + agreed=true, then closes (AC1/AC11)", async () => {
    const onSubmit = makeOk();
    const onClose = vi.fn();
    renderCurate(onSubmit, onClose);
    await userEvent.type(screen.getByRole("textbox"), "Solid explainer; minor caveat.");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Publish curation/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [clip, agreed] = onSubmit.mock.calls[0];
    expect(agreed).toBe(true);
    expect(clip).toMatchObject({
      topicQid: "Q189603",
      platform: "youtube",
      watchUrl: "https://www.youtube.com/watch?v=abc",
      contextNote: "Solid explainer; minor caveat.",
      stance: "explainer",
      accuracyFlag: "accurate",
      general: false,
      sectionSlug: "glycolysis",
      sectionLabel: "Glycolysis",
    });
    // The client supplies NO attribution / license (the boundary owns both — C AC6 / D1 §3.5).
    expect(clip.curatedBy).toBeUndefined();
    expect(clip.noteLicense).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the modal OPEN on a server error with the note intact, no false 'saved' (AC11)", async () => {
    const onSubmit = vi.fn<OnSubmit>(async () => {
      throw new Error("DB down");
    });
    const onClose = vi.fn();
    renderCurate(onSubmit, onClose);
    await userEvent.type(screen.getByRole("textbox"), "My note text.");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Publish curation/ }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn.t publish/);
    // The typed note is preserved (the modal stayed mounted).
    expect(screen.getByRole("textbox")).toHaveValue("My note text.");
    // Publish returns to idle so the curator can retry.
    expect(screen.getByRole("button", { name: /Publish curation/ })).toBeEnabled();
  });

  it("closes WITHOUT an in-modal error when the host reports an expired session (AC9)", async () => {
    const onSubmit = vi.fn<OnSubmit>(async () => ({ outcome: "expired" }));
    const onClose = vi.fn();
    renderCurate(onSubmit, onClose);
    await userEvent.type(screen.getByRole("textbox"), "note");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Publish curation/ }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("AddModal — add by link (AC18 / AC19; D1)", () => {
  function renderAdd(onSubmit: ReturnType<typeof makeOk> = makeOk(), onClose = vi.fn()) {
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

  it("shows an error alert for an unrecognized link, hiding the curate fields (never persists — AC5)", async () => {
    const onSubmit = makeOk();
    renderAdd(onSubmit);
    await userEvent.type(screen.getByRole("textbox"), "https://evil.test/x");
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Unrecognized link/);
    expect(screen.queryByRole("combobox", { name: "Stance" })).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reveals the preview + curate fields (incl. the required agreement) for a recognized YouTube link", async () => {
    renderAdd();
    const input = screen.getByPlaceholderText(/youtu\.be/);
    await userEvent.type(input, "https://youtu.be/abc123");
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Stance" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "I agree to release my context note under CC BY-SA 4.0.",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add & curate/ })).toBeDisabled();
  });

  it("persists a recognized link: onSubmit gets the parsed-link clip + agreed=true, then closes (AC4)", async () => {
    const onSubmit = makeOk();
    const onClose = vi.fn();
    renderAdd(onSubmit, onClose);
    await userEvent.type(screen.getByPlaceholderText(/youtu\.be/), "https://youtu.be/abc123");
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));
    // Fill the note (revealed after a recognized link) + agree.
    const note = screen.getByPlaceholderText(/Separate fact/);
    await userEvent.type(note, "A clip the suggester missed.");
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "I agree to release my context note under CC BY-SA 4.0.",
      })
    );
    await userEvent.click(screen.getByRole("button", { name: /Add & curate/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [clip, agreed] = onSubmit.mock.calls[0];
    expect(agreed).toBe(true);
    expect(clip).toMatchObject({
      topicQid: "Q189603",
      platform: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/abc123",
      watchUrl: "https://youtu.be/abc123",
      contextNote: "A clip the suggester missed.",
    });
    expect(onClose).toHaveBeenCalled();
  });
});
