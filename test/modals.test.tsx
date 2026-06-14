import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerModal } from "@/components/topic/PlayerModal";
import { CurateModal } from "@/components/topic/CurateModal";
import { AddModal } from "@/components/topic/AddModal";
import type { Candidate } from "@/lib/data/types";

const sections = [
  { slug: "glycolysis", title: "Glycolysis" },
  { slug: "calvin-cycle", title: "Calvin cycle" },
];

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

describe("CurateModal — Promote target (AC19 / CURATION §1–§5)", () => {
  const cand: Candidate = {
    id: "cand1",
    topicQid: "Q189603",
    platform: "youtube",
    platformLabel: "YouTube",
    orientation: "horizontal",
    watchUrl: "https://www.youtube.com/watch?v=abc",
    caption: "Glycolysis Explained",
    creator: { handle: "@x", name: "Creator X", platform: "youtube" },
    vetted: false,
    source: "YouTube",
    matchReason: "match",
    general: false,
    sectionSlug: "glycolysis",
    sectionLabel: "Glycolysis",
  };

  it("renders the closed STANCE enum labels (incl. Myth-busting; no 'Documentary')", () => {
    render(<CurateModal candidate={cand} sections={sections} onClose={vi.fn()} />);
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
    render(<CurateModal candidate={cand} sections={sections} onClose={vi.fn()} />);
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
    render(<CurateModal candidate={cand} sections={sections} onClose={vi.fn()} />);
    const sel = screen.getByRole("combobox", { name: "Section" }) as HTMLSelectElement;
    const opts = within(sel).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual(["General", "Glycolysis", "Calvin cycle"]);
    expect(sel.value).toBe("glycolysis");
  });

  it("shows the CC BY-SA submit notice (CURATION §5.3 / C5)", () => {
    render(<CurateModal candidate={cand} sections={sections} onClose={vi.fn()} />);
    expect(
      screen.getByText(/release your context note under CC BY-SA 4\.0/)
    ).toBeInTheDocument();
  });

  it("has a live note character counter toward the 320-char soft cap (C1)", async () => {
    render(<CurateModal candidate={cand} sections={sections} onClose={vi.fn()} />);
    const note = screen.getByRole("textbox");
    expect(screen.getByText("0/320")).toBeInTheDocument();
    await userEvent.type(note, "hello");
    expect(screen.getByText("5/320")).toBeInTheDocument();
  });

  it("submits as a mock (closes; no persistence — A7)", async () => {
    const onClose = vi.fn();
    render(<CurateModal candidate={cand} sections={sections} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /Publish curation/ }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("AddModal — add by link (AC18 / AC19)", () => {
  it("shows an error alert for an unrecognized link, hiding the curate fields", async () => {
    render(<AddModal sections={sections} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox"), "https://evil.test/x");
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Unrecognized link/);
    // curate fields stay hidden (no Stance select yet)
    expect(screen.queryByRole("combobox", { name: "Stance" })).toBeNull();
  });

  it("reveals the preview + curate fields for a recognized YouTube link", async () => {
    render(<AddModal sections={sections} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/youtu\.be/);
    await userEvent.type(input, "https://youtu.be/abc123");
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Stance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add & curate/ })).toBeInTheDocument();
  });
});
