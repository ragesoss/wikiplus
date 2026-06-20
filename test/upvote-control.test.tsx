import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpvoteControl } from "@/components/topic/UpvoteControl";

// ── D4 (issue #55) / #71 — the upvote control's a11y + state contract (design §3/§6/§9; #71 §4). ──
// QA verifies the server-side gate + the DB invariant at the action (test/upvotes.test.ts); these
// pin the UI contract that the signed-in voted-state is carried by MORE THAN COLOR (the "Voted"
// word + `aria-pressed` + a filled-vs-outline glyph), the count is always visible, and (#71) the
// LOGGED-OUT form is a STATIC READ-ONLY count figure — NOT a control, no button, not focusable,
// count 0 → nothing — plus the verbatim §6.1 accessible names.

describe("UpvoteControl — signed-in toggle states (3a/3b)", () => {
  it("not voted (3a): outline glyph, count, aria-pressed=false, 'Upvote this clip' name, NO 'Voted' word", () => {
    render(
      <UpvoteControl
        count={5}
        voted={false}
        signedIn
        surface="light"
        onActivate={() => {}}
      />
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAccessibleName("Upvote this clip — 5 upvotes");
    expect(btn).toHaveTextContent("5");
    expect(btn).not.toHaveTextContent("Voted");
    expect(btn).toHaveTextContent("△"); // outline glyph (a shape difference, not only color)
  });

  it("voted (3b): filled glyph, the visible 'Voted' word, aria-pressed=true, the 'You upvoted' name", () => {
    render(
      <UpvoteControl
        count={6}
        voted
        signedIn
        surface="light"
        onActivate={() => {}}
      />
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAccessibleName(
      "You upvoted this clip — 6 upvotes. Activate to remove your upvote."
    );
    expect(btn).toHaveTextContent("Voted"); // the visible state word (never color-alone)
    expect(btn).toHaveTextContent("▲"); // filled glyph
  });

  it("pluralizes honestly: '1 upvote' at a count of 1", () => {
    render(
      <UpvoteControl
        count={1}
        voted={false}
        signedIn
        surface="light"
        onActivate={() => {}}
      />
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "Upvote this clip — 1 upvote"
    );
  });

  it("activating fires onActivate (keyboard Enter/Space via a native button)", async () => {
    const onActivate = vi.fn();
    render(
      <UpvoteControl
        count={5}
        voted={false}
        signedIn
        surface="light"
        onActivate={onActivate}
      />
    );
    const btn = screen.getByRole("button");
    btn.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});

describe("UpvoteControl — logged-out read-only count (#71 §4, AC1/AC2/AC9)", () => {
  it("renders the count as a static figure, NOT a button (no control, no gate trigger)", () => {
    render(
      <UpvoteControl
        count={9}
        voted={false}
        signedIn={false}
        surface="light"
        onActivate={() => {}}
      />
    );
    // AC1/AC2: no focusable action element — the count is text, not a control.
    expect(screen.queryByRole("button")).toBeNull();
    // It must not be the old "Log in to upvote" gate trigger.
    expect(screen.queryByText(/log in to upvote/i)).toBeNull();
  });

  it("shows the honest 'N upvotes' noun (count > 0), pluralized, with no button chrome", () => {
    const { container } = render(
      <UpvoteControl
        count={9}
        voted={false}
        signedIn={false}
        surface="light"
        onActivate={() => {}}
      />
    );
    // The visible word makes the figure self-describing (text-labeled, never color-alone).
    expect(screen.getByText("9 upvotes")).toBeInTheDocument();
    const label = container.querySelector("span");
    // AC9: static text, not a named/disabled widget — no role/tabindex/aria-pressed.
    expect(label).not.toHaveAttribute("role");
    expect(label).not.toHaveAttribute("tabindex");
    expect(label).not.toHaveAttribute("aria-pressed");
  });

  it("pluralizes honestly: '1 upvote' at a count of 1", () => {
    render(
      <UpvoteControl
        count={1}
        voted={false}
        signedIn={false}
        surface="light"
        onActivate={() => {}}
      />
    );
    expect(screen.getByText("1 upvote")).toBeInTheDocument();
  });

  it("count 0 logged out renders NOTHING (no '0 upvotes', no glyph — §4.1)", () => {
    const { container } = render(
      <UpvoteControl
        count={0}
        voted={false}
        signedIn={false}
        surface="light"
        onActivate={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("on the indigo band the figure is white and carries NO actionable underline", () => {
    const { container } = render(
      <UpvoteControl
        count={4}
        voted={false}
        signedIn={false}
        surface="indigo"
        onActivate={() => {}}
      />
    );
    const label = container.querySelector("span");
    expect(label?.className).toContain("text-white");
    expect(label?.className).not.toContain("underline");
  });
});

describe("UpvoteControl — indigo band surface (§5)", () => {
  it("voted on the band carries the underline cue (not a color shift) + the 'Voted' word", () => {
    render(
      <UpvoteControl
        count={3}
        voted
        signedIn
        surface="indigo"
        onActivate={() => {}}
      />
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("Voted");
    expect(btn.className).toContain("underline"); // the toggled cue on indigo is the underline
    expect(btn.className).toContain("text-white"); // white on the indigo band
  });

  it("the light surface uses the AA-safe deep-violet token (#5248AF), not the lighter brand indigo", () => {
    render(
      <UpvoteControl
        count={3}
        voted={false}
        signedIn
        surface="light"
        onActivate={() => {}}
      />
    );
    expect(screen.getByRole("button").className).toContain("text-violet");
  });
});
