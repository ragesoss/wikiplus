import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CandidateCard,
  CandidateSetHeader,
} from "@/components/topic/CandidateBits";
import type { Candidate } from "@/lib/data/types";

const cand: Candidate = {
  id: "cand1",
  topicQid: "Q189603",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  caption: "Glycolysis Explained in 2 minutes",
  creator: {
    handle: "@2minuteclassroom",
    name: "2 Minute Classroom",
    platform: "youtube",
    url: "https://youtube.com/@2MinuteClassroom",
  },
  vetted: false,
  source: "YouTube",
  matchReason: "Mentions “glycolysis” in title",
  general: false,
  sectionSlug: "glycolysis",
  sectionLabel: "Glycolysis",
};

describe("CandidateCard — decluttered unvetted treatment (#14; CURATION §6)", () => {
  // These cases exercise the SIGNED-IN card (the on-tile actions render); the logged-out
  // watch-only gating is covered in its own describe block below (#71).
  function setup(candidate: Candidate = cand) {
    const onPromote = vi.fn();
    const onDismiss = vi.fn();
    const utils = render(
      <CandidateCard
        candidate={candidate}
        signedIn
        onPromote={onPromote}
        onDismiss={onDismiss}
      />
    );
    return { ...utils, onPromote, onDismiss };
  }

  // AC1 — no per-card "SUGGESTED" badge anywhere.
  it("renders NO per-card 'SUGGESTED' badge (AC1)", () => {
    setup();
    expect(screen.queryByText("Suggested")).toBeNull();
  });

  // AC2 — the repeated "Auto-suggested" eyebrow + "No context yet…" sentence are gone.
  it("renders neither the 'Auto-suggested' eyebrow nor the 'No context yet' sentence (AC2)", () => {
    setup();
    expect(screen.queryByText("Auto-suggested")).toBeNull();
    expect(
      screen.queryByText(/No context yet/)
    ).toBeNull();
  });

  // AC3 — a single compact match-reason line with an sr-only "Why suggested:" prefix.
  it("shows a compact match-reason line with an sr-only 'Why suggested:' prefix (AC3)", () => {
    setup();
    expect(screen.getByText(/Mentions/)).toBeInTheDocument();
    // The sr-only prefix makes the line self-describing to screen readers.
    expect(screen.getByText("Why suggested:")).toBeInTheDocument();
  });

  it("does NOT put the source value inside the match line (AC3 — source moves to the pill)", () => {
    setup();
    // The match line shows only the reason; the source ("YouTube") is in the pill,
    // not concatenated into the reason text.
    const reason = screen.getByText(/Mentions/);
    expect(reason.textContent).not.toContain("YouTube");
  });

  // AC4 / AC6 — text-labeled source pill, derived from the candidate's own `source`.
  // Scope by the pill's `title` (the source word also appears as the platformLabel in
  // the creator credit, so a bare getByText would be ambiguous — that's expected).
  it("renders a text-labeled source pill from candidate.source (AC4)", () => {
    setup();
    const pill = screen.getByTitle("Auto-suggested from YouTube");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent("YouTube");
  });

  it("renders the pill from the candidate's OWN source, not a hard-coded 'YouTube' (AC4/AC6)", () => {
    // A non-YouTube source must render that source verbatim — proving the value is
    // read from data and not a hard-coded literal. With a TikTok-source candidate the
    // pill reads "TikTok"; no "Auto-suggested from YouTube" pill exists.
    setup({ ...cand, source: "TikTok", platform: "tiktok", platformLabel: "TikTok" });
    const pill = screen.getByTitle("Auto-suggested from TikTok");
    expect(pill).toHaveTextContent("TikTok");
    expect(screen.queryByTitle("Auto-suggested from YouTube")).toBeNull();
  });

  // AC8 — dashed/unvetted distinction retained; no chips / context note.
  it("uses the dashed, shadow-less candcard treatment (AC8)", () => {
    const { container } = setup();
    expect(container.querySelector(".candcard")).not.toBeNull();
  });

  it("renders NO stance chip, NO accuracy chip, NO context note (AC8 / CURATION §6)", () => {
    setup();
    expect(screen.queryByText("Explainer")).toBeNull();
    expect(screen.queryByText("Accurate")).toBeNull();
    expect(screen.queryByText("Curator note")).toBeNull();
    expect(screen.queryByText("Context note")).toBeNull();
  });

  it("applies the active-pairing highlight when active (D2)", () => {
    const { rerender, container } = render(
      <CandidateCard candidate={cand} onPromote={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(container.querySelector(".candcard.active")).toBeNull();
    rerender(
      <CandidateCard candidate={cand} active onPromote={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(container.querySelector(".candcard.active")).not.toBeNull();
  });

  // AC9 — CTA verb is "Curate" with the exact aria-label and aria-haspopup.
  it("exposes a 'Curate' CTA with the right aria-label + aria-haspopup, and Not-relevant (AC9)", async () => {
    const { onPromote, onDismiss } = setup();
    const curate = screen.getByRole("button", {
      name: `Curate this clip: ${cand.caption}`,
    });
    expect(curate).toHaveAttribute("aria-haspopup", "dialog");
    expect(curate).toHaveTextContent("Curate");
    // The old "Promote" verb must be gone.
    expect(screen.queryByRole("button", { name: /Promote/ })).toBeNull();
    await userEvent.click(curate);
    expect(onPromote).toHaveBeenCalledWith(cand);

    await userEvent.click(
      screen.getByRole("button", { name: /Dismiss as not relevant/ })
    );
    expect(onDismiss).toHaveBeenCalledWith(cand);
  });
});

describe("CandidateCard — logged-out watch-only (#71 §5, AC3/AC4)", () => {
  function renderCard(signedIn: boolean) {
    return render(
      <CandidateCard
        candidate={cand}
        signedIn={signedIn}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
  }

  it("logged out: renders NO Curate and NO Not-relevant button (AC3)", () => {
    renderCard(false);
    expect(screen.queryByRole("button", { name: /Curate this clip/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Dismiss as not relevant/ })
    ).toBeNull();
  });

  it("logged out: keeps the weighing signals — match reason + source pill + caption + credit (AC4)", () => {
    renderCard(false);
    expect(screen.getByText(/Mentions/)).toBeInTheDocument(); // match reason
    expect(screen.getByTitle("Auto-suggested from YouTube")).toBeInTheDocument(); // source pill
    expect(screen.getByText(cand.caption)).toBeInTheDocument(); // caption
    expect(screen.getByText(/2minuteclassroom/)).toBeInTheDocument(); // creator credit
  });

  it("logged out: retains the dashed/unvetted candcard treatment (AC4 — distinction kept)", () => {
    const { container } = renderCard(false);
    expect(container.querySelector(".candcard")).not.toBeNull();
  });

  it("signed in: the Curate / Not-relevant buttons DO render (AC8 regression guard)", () => {
    renderCard(true);
    expect(
      screen.getByRole("button", { name: /Curate this clip/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Dismiss as not relevant/ })
    ).toBeInTheDocument();
  });
});

describe("CandidateSetHeader — one-time unvetted set header (#14 AC5)", () => {
  it("states 'Suggested · uncurated', names the sources from data, and carries no count", () => {
    render(<CandidateSetHeader sources="YouTube + TikTok" />);
    expect(screen.getByText("Suggested · uncurated")).toBeInTheDocument();
    expect(screen.getByText("YouTube + TikTok")).toBeInTheDocument();
    // It absorbs the per-card "no context yet" message (once, here).
    expect(
      screen.getByText(/No context notes yet — a human hasn't reviewed these/)
    ).toBeInTheDocument();
    // No numeric volume count lives in the set header (AC5/AC7).
    const { container } = render(<CandidateSetHeader sources="YouTube" />);
    expect(container.textContent).not.toMatch(/\d/);
  });
});
