import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import type { Candidate, Clip } from "@/lib/data/types";

// QA — component-level matrix for the relocated "show suggestions anyway" toggle, the trailing item
// in the General strip's scroll row (design overview-card-cleanup.md §4). The TopicView integration
// suite (test/topic-complete-view.test.tsx) proves the end-to-end reveal; this isolates the
// GeneralStrip contract the design names: the presence gate (`complete && hasUnderlyingSuggestions`),
// the trailing position (the row's LAST <li>, after curated tiles), the label/aria flip across the
// override state, the minimal-band suppression of the empty-state bootstrap, and the a11y floor
// (native button, keyboard-operable, no gold in the toggle, AC5/AC6/AC7/AC8/AC9/AC11).

const clip: Clip = {
  id: "c1",
  topicQid: "Q11982",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  caption: "Curated overview clip",
  creator: { handle: "@cc", name: "CrashCourse", platform: "youtube" },
  contextNote: "note",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: true,
  createdAt: new Date().toISOString(),
};

const cand: Candidate = {
  id: "cand1",
  topicQid: "Q189603",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=def",
  caption: "Suggested overview candidate",
  creator: { handle: "@as", name: "Amoeba Sisters", platform: "youtube" },
  vetted: false,
  source: "YouTube",
  matchReason: "Top result",
  general: true,
};

const baseProps = {
  topicTitle: "Cellular respiration",
  onPlay: vi.fn(),
  onPromote: vi.fn(),
  onDismiss: vi.fn(),
  onAdd: vi.fn(),
};

const TOGGLE_SHOW = /Show suggestions for this topic in this session/i;
const TOGGLE_HIDE = /Hide suggestions again — return to the complete view/i;

function band(): HTMLElement {
  return document.getElementById("general-band") as HTMLElement;
}
/** The scroll row <ul> is the only <ul role="list"> directly under the band content box. */
function scrollRow(): HTMLElement {
  return within(band()).getByRole("list");
}

describe("GeneralStrip — trailing complete toggle: presence gate (AC5/AC7/AC9)", () => {
  it("AC5 — complete + curated + ≥1 underlying suggestion renders the toggle (default 'Show')", () => {
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        // suppressed for the reader → no candidate tiles, but there IS an underlying suggestion.
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions
        onToggleOverride={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: TOGGLE_SHOW })).toBeInTheDocument();
    expect(
      screen.getByText(/A curator marked this complete, so suggestions are hidden/i)
    ).toBeInTheDocument();
    // The eyebrow word carries the state (the ✓ is decorative).
    expect(screen.getByText(/Marked complete/i)).toBeInTheDocument();
  });

  it("AC7 — complete + curated + ZERO underlying suggestions: NO toggle (never a reveal that shows nothing)", () => {
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions={false}
        onToggleOverride={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: TOGGLE_SHOW })).toBeNull();
    expect(screen.queryByText(/Marked complete/i)).toBeNull();
    // The fully-curated band still renders its curated tile normally.
    expect(screen.getByText("Curated overview clip")).toBeInTheDocument();
  });

  it("AC9 — NOT complete: the toggle never renders even with underlying suggestions present", () => {
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[cand]}
        complete={false}
        hasUnderlyingSuggestions
        onToggleOverride={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: TOGGLE_SHOW })).toBeNull();
    expect(screen.queryByText(/Marked complete/i)).toBeNull();
    // The real suggestion tile still shows (no suppression when not complete).
    expect(screen.getByText("Suggested overview candidate")).toBeInTheDocument();
  });
});

describe("GeneralStrip — trailing complete toggle: position (AC5)", () => {
  it("AC5 — the toggle is the LAST item of the scroll row, after the curated tiles", () => {
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions
        onToggleOverride={vi.fn()}
      />
    );
    const items = within(scrollRow()).getAllByRole("listitem");
    const last = items[items.length - 1];
    // The trailing <li> holds the toggle button…
    expect(
      within(last).getByRole("button", { name: TOGGLE_SHOW })
    ).toBeInTheDocument();
    // …and the curated tile is NOT in the last item (it precedes the toggle).
    expect(within(last).queryByText("Curated overview clip")).toBeNull();
    expect(items.length).toBeGreaterThan(1);
  });

  it("AC5/§4.1 — when overridden, the toggle stays the LAST item, after the revealed suggestion tiles", () => {
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        // overridden → suppression lifted, so the host feeds the real suggestions through.
        generalCandidates={[cand]}
        complete
        overridden
        hasUnderlyingSuggestions
        onToggleOverride={vi.fn()}
      />
    );
    const items = within(scrollRow()).getAllByRole("listitem");
    const last = items[items.length - 1];
    expect(
      within(last).getByRole("button", { name: TOGGLE_HIDE })
    ).toBeInTheDocument();
    // The revealed suggestion candidate tile is present in the row but NOT in the trailing item.
    expect(screen.getByText("Suggested overview candidate")).toBeInTheDocument();
    expect(within(last).queryByText("Suggested overview candidate")).toBeNull();
  });
});

describe("GeneralStrip — trailing complete toggle: label/aria flip + wiring (AC6)", () => {
  it("AC6 — off state: visible 'Show suggestions anyway' + the 'Show…in this session' aria-label", () => {
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[]}
        complete
        overridden={false}
        hasUnderlyingSuggestions
        onToggleOverride={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: TOGGLE_SHOW });
    expect(btn).toHaveTextContent("Show suggestions anyway");
    expect(btn.getAttribute("aria-label")).toMatch(/in this session/i);
  });

  it("AC6 — on state: visible 'Hide suggestions again' + the 'return to the complete view' aria-label", () => {
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[cand]}
        complete
        overridden
        hasUnderlyingSuggestions
        onToggleOverride={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: TOGGLE_HIDE });
    expect(btn).toHaveTextContent("Hide suggestions again");
    expect(btn.getAttribute("aria-label")).toMatch(/return to the complete view/i);
  });

  it("AC6 — activating the toggle calls onToggleOverride (the host's session-local reveal)", async () => {
    const onToggleOverride = vi.fn();
    const user = userEvent.setup();
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions
        onToggleOverride={onToggleOverride}
      />
    );
    await user.click(screen.getByRole("button", { name: TOGGLE_SHOW }));
    expect(onToggleOverride).toHaveBeenCalledTimes(1);
  });
});

describe("GeneralStrip — minimal complete band: lone toggle, bootstrap suppressed (AC8)", () => {
  function renderMinimal(extra: Record<string, unknown> = {}) {
    render(
      <GeneralStrip
        {...baseProps}
        // zero curated + suppressed (no shown candidates) but an underlying suggestion exists.
        generalClips={[]}
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions
        onToggleOverride={vi.fn()}
        {...extra}
      />
    );
  }

  it("AC8 — the band renders the lone toggle and NO empty-state '＋ Suggested videos' bootstrap", () => {
    renderMinimal();
    expect(band()).not.toBeNull();
    expect(screen.getByRole("button", { name: TOGGLE_SHOW })).toBeInTheDocument();
    // The empty-state suggestion bootstrap is suppressed (no visible header, no uncurated pill).
    expect(screen.queryByText("＋ Suggested videos")).toBeNull();
    expect(screen.queryByText("uncurated")).toBeNull();
    // No "No videos found" honest zero line either — the toggle carries the state.
    expect(screen.queryByText(/No videos found/i)).toBeNull();
  });

  it("AC8 — even signed-in, the minimal band suppresses the Find-more cluster (no Search-platform links)", () => {
    renderMinimal({ signedIn: true });
    expect(screen.getByRole("button", { name: TOGGLE_SHOW })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Search TikTok/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Search YouTube/i })).toBeNull();
  });

  it("AC8 boundary — complete + zero curated + zero underlying: the toggle is omitted (the band is genuinely empty)", () => {
    // The host omits the band entirely in this case; here we assert the component itself shows no
    // toggle (and the minimal-band face does not appear) so a stray render would never strand a
    // reveal that shows nothing.
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[]}
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions={false}
        onToggleOverride={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: TOGGLE_SHOW })).toBeNull();
    expect(screen.queryByText(/Marked complete/i)).toBeNull();
  });
});

describe("GeneralStrip — trailing complete toggle: accessibility floor (AC11)", () => {
  it("AC11 — it is a native <button type=button> (not role=switch), keyboard-operable via Enter", async () => {
    const onToggleOverride = vi.fn();
    const user = userEvent.setup();
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions
        onToggleOverride={onToggleOverride}
      />
    );
    const btn = screen.getByRole("button", { name: TOGGLE_SHOW });
    // A plain action button — the design forbids role=switch / aria-pressed (the WORD carries state).
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.getAttribute("role")).toBeNull();
    expect(btn.getAttribute("aria-pressed")).toBeNull();
    // Keyboard-operable: focus it and press Enter → the host toggle fires.
    btn.focus();
    expect(btn).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onToggleOverride).toHaveBeenCalledTimes(1);
  });

  it("AC11 — keyboard-operable via Space", async () => {
    const onToggleOverride = vi.fn();
    const user = userEvent.setup();
    render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions
        onToggleOverride={onToggleOverride}
      />
    );
    const btn = screen.getByRole("button", { name: TOGGLE_SHOW });
    btn.focus();
    await user.keyboard(" ");
    expect(onToggleOverride).toHaveBeenCalledTimes(1);
  });

  it("AC11 — no gold encodes the toggle state (state is text-labeled, never color alone)", () => {
    const { container } = render(
      <GeneralStrip
        {...baseProps}
        generalClips={[clip]}
        generalCandidates={[]}
        complete
        hasUnderlyingSuggestions
        onToggleOverride={vi.fn()}
      />
    );
    const toggleLi = within(scrollRow())
      .getAllByRole("listitem")
      .find((li) => within(li).queryByRole("button", { name: TOGGLE_SHOW }));
    expect(toggleLi).toBeTruthy();
    // No gold class anywhere in the toggle card markup (VI: gold never carries a signal).
    expect(toggleLi!.querySelector('[class*="gold"]')).toBeNull();
    // Sanity: the card itself is in the DOM (so the assertion isn't vacuous).
    expect(container.querySelector('[class*="gold"]')).toBeNull();
  });
});
