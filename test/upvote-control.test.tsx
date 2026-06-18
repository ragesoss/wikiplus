import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpvoteControl } from "@/components/topic/UpvoteControl";

// ── D4 (issue #55) — the upvote control's a11y + state contract (design §3/§6/§9). ──────────
// QA verifies the server-side gate + the DB invariant at the action (test/upvotes.test.ts); these
// pin the UI contract that the voted-state is carried by MORE THAN COLOR (the "Voted" word +
// `aria-pressed` + a filled-vs-outline glyph), the count is always visible, the logged-out form is
// an ENABLED gate-trigger button WITHOUT `aria-pressed`, and the verbatim §6.1 accessible names.

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

describe("UpvoteControl — logged-out gate trigger (3d/3g)", () => {
  it("shows the count + 'Log in to upvote', is an ENABLED button with NO aria-pressed (a gate trigger, not a toggle)", () => {
    render(
      <UpvoteControl
        count={9}
        voted={false}
        signedIn={false}
        surface="light"
        onActivate={() => {}}
      />
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeEnabled(); // never `disabled` (a disabled button reads as inert — §3 note)
    expect(btn).not.toHaveAttribute("aria-pressed"); // a gate trigger, not a toggle
    expect(btn).toHaveTextContent("9"); // the count is still visible (reading is anonymous)
    expect(btn).toHaveTextContent("Log in to upvote");
    expect(btn).toHaveAccessibleName("Log in to upvote this clip — 9 upvotes");
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
