import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompleteToggleCard } from "@/components/topic/CompleteToggleCard";

// QA — component-level matrix for the marked-complete "show suggestions anyway" reveal card, the plus
// rail's home for the per-viewer reveal (design complete-toggle-rail.md). The TopicView integration
// suite (test/topic-complete-view.test.tsx) proves the gate, the rail PLACEMENT (after the curated
// cards), and the end-to-end reveal; this isolates the card's own contract: the honest framing copy
// (unchanged in both states), the label/aria flip across the override state, the host wiring, and the
// a11y floor (native button, keyboard-operable, no gold — AC3/AC4/AC5/AC9).

const TOGGLE_SHOW = /Show suggestions for this topic in this session/i;
const TOGGLE_HIDE = /Hide suggestions again — return to the complete view/i;

describe("CompleteToggleCard — honest framing copy (AC3)", () => {
  it("shows the 'Marked complete' eyebrow + the verbatim body line, identical in both states", () => {
    const { rerender } = render(<CompleteToggleCard overridden={false} onToggle={vi.fn()} />);
    expect(screen.getByText(/Marked complete/i)).toBeInTheDocument();
    expect(
      screen.getByText(/A curator marked this complete, so suggestions are hidden/i)
    ).toBeInTheDocument();
    // The body line does NOT change when overridden (the topic is still complete — only the button flips).
    rerender(<CompleteToggleCard overridden onToggle={vi.fn()} />);
    expect(
      screen.getByText(/A curator marked this complete, so suggestions are hidden/i)
    ).toBeInTheDocument();
  });
});

describe("CompleteToggleCard — label/aria flip (AC4)", () => {
  it("off state: visible 'Show suggestions anyway' + the 'in this session' aria-label", () => {
    render(<CompleteToggleCard overridden={false} onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: TOGGLE_SHOW });
    expect(btn).toHaveTextContent("Show suggestions anyway");
    expect(btn.getAttribute("aria-label")).toMatch(/in this session/i);
  });

  it("on state: visible 'Hide suggestions again' + the 'return to the complete view' aria-label", () => {
    render(<CompleteToggleCard overridden onToggle={vi.fn()} />);
    const btn = screen.getByRole("button", { name: TOGGLE_HIDE });
    expect(btn).toHaveTextContent("Hide suggestions again");
    expect(btn.getAttribute("aria-label")).toMatch(/return to the complete view/i);
  });
});

describe("CompleteToggleCard — host wiring + a11y floor (AC5/AC9)", () => {
  it("AC5 — clicking the toggle calls onToggle (the host's session-local reveal)", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<CompleteToggleCard overridden={false} onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: TOGGLE_SHOW }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("AC9 — native <button type=button> (not role=switch / aria-pressed), keyboard-operable (Enter + Space)", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<CompleteToggleCard overridden={false} onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: TOGGLE_SHOW });
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.getAttribute("role")).toBeNull();
    expect(btn.getAttribute("aria-pressed")).toBeNull();
    btn.focus();
    expect(btn).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("AC9 — no gold encodes the toggle state (state is text-labeled, never color alone)", () => {
    const { container } = render(<CompleteToggleCard overridden={false} onToggle={vi.fn()} />);
    expect(container.querySelector('[class*="gold"]')).toBeNull();
  });
});
