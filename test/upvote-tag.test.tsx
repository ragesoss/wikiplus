import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpvoteControl } from "@/components/topic/UpvoteControl";

// ── general-hero-layout AC4: the chip-row `appearance="tag"` upvote. ──────────────────────────────
// The hero + curated General tiles render the upvote inline with the Stance/Accuracy chips as a
// chip-height OUTLINE tag. The state semantics MUST be identical to the default `inline` control:
//   signed-in  → an interactive `aria-pressed` toggle (▲/△ shape + the "Voted" word, never color-alone);
//   logged-out → a NON-interactive figure (a <span>, never announced as a button), count 0 → nothing.
// The existing upvote-control.test.tsx pins the `inline` appearance; this pins the net-new `tag` arm.

describe("UpvoteControl appearance=tag — signed-in interactive toggle (AC4)", () => {
  it("not voted: a real aria-pressed=false button, outline △, count, NO 'Voted' word", () => {
    render(
      <UpvoteControl
        count={5}
        voted={false}
        signedIn
        surface="light"
        appearance="tag"
        onActivate={() => {}}
      />
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveAccessibleName("Upvote this clip — 5 upvotes");
    expect(btn).toHaveTextContent("5");
    expect(btn).toHaveTextContent("△"); // outline glyph = a shape difference, not only color
    expect(btn).not.toHaveTextContent("Voted");
  });

  it("voted: aria-pressed=true, filled ▲, the visible 'Voted' word (never color-alone)", () => {
    render(
      <UpvoteControl
        count={6}
        voted
        signedIn
        surface="light"
        appearance="tag"
        onActivate={() => {}}
      />
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAccessibleName(
      "You upvoted this clip — 6 upvotes. Activate to remove your upvote."
    );
    expect(btn).toHaveTextContent("▲");
    expect(btn).toHaveTextContent("Voted");
  });

  it("activates by keyboard (native button — Enter and Space)", async () => {
    const onActivate = vi.fn();
    render(
      <UpvoteControl
        count={2}
        voted={false}
        signedIn
        surface="indigo"
        appearance="tag"
        onActivate={onActivate}
      />
    );
    const btn = screen.getByRole("button");
    btn.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("a signed-in tag at count 0 still renders the toggle (so the first vote is castable)", () => {
    // The 0→nothing rule is the LOGGED-OUT figure's; a signed-in user must be able to cast vote #1.
    render(
      <UpvoteControl
        count={0}
        voted={false}
        signedIn
        surface="light"
        appearance="tag"
        onActivate={() => {}}
      />
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn).toHaveTextContent("△");
  });
});

describe("UpvoteControl appearance=tag — logged-out figure (AC4)", () => {
  it("renders a non-interactive figure (a span, NOT a button) with the sr-only 'N upvotes' noun", () => {
    const { container } = render(
      <UpvoteControl
        count={9}
        voted={false}
        signedIn={false}
        surface="indigo"
        appearance="tag"
        onActivate={() => {}}
      />
    );
    // Never announced as a control.
    expect(screen.queryByRole("button")).toBeNull();
    // The honest noun is present for AT (sr-only), so the figure is self-describing.
    expect(screen.getByText("9 upvotes")).toBeInTheDocument();
    const span = container.querySelector("span");
    expect(span?.tagName).toBe("SPAN");
    expect(span).not.toHaveAttribute("role");
    expect(span).not.toHaveAttribute("tabindex");
    expect(span).not.toHaveAttribute("aria-pressed");
    expect(span).not.toHaveAttribute("onclick");
  });

  it("count 0 logged-out renders NOTHING (no '0 upvotes', no glyph — §2.3)", () => {
    const { container } = render(
      <UpvoteControl
        count={0}
        voted={false}
        signedIn={false}
        surface="indigo"
        appearance="tag"
        onActivate={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
