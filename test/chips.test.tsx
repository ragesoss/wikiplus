import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccuracyChip, StanceChip } from "@/components/topic/Chips";
import { ACCURACY_FILL, STANCE_FILL } from "@/lib/curation/labels";

// AC9 / AC21 / CURATION §4: each chip renders its LABEL text (signal survives with
// no color); color reinforces; modifier renders as "Label · modifier".

describe("StanceChip (AC9, AC21)", () => {
  it("renders the canonical stance label text", () => {
    render(<StanceChip stance="explainer" />);
    expect(screen.getByText("Explainer")).toBeInTheDocument();
  });

  it("appends the display-only modifier as 'Label · modifier' (C6)", () => {
    render(<StanceChip stance="short" modifier="exam recap" />);
    expect(screen.getByText("Short · exam recap")).toBeInTheDocument();
  });

  it("uses the AA-safe deep-violet fill (not the brand indigo)", () => {
    render(<StanceChip stance="opinion" />);
    const chip = screen.getByText("Opinion");
    expect(chip).toHaveStyle({ background: STANCE_FILL });
  });
});

describe("AccuracyChip (AC9, AC21)", () => {
  it("renders the canonical accuracy label text (red-group distinguished by words)", () => {
    render(<AccuracyChip flag="misleading" />);
    expect(screen.getByText("Misleading")).toBeInTheDocument();
  });

  it("colors by tier (teal-dk for the sound 'accurate' tier)", () => {
    render(<AccuracyChip flag="accurate" />);
    expect(screen.getByText("Accurate")).toHaveStyle({
      background: ACCURACY_FILL.accurate,
    });
  });

  it("renders the long 'Accurate, with a caveat' label in full", () => {
    render(<AccuracyChip flag="accurate_with_caveat" modifier="simplified" />);
    expect(
      screen.getByText("Accurate, with a caveat · simplified")
    ).toBeInTheDocument();
  });
});
