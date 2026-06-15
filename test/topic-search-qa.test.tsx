import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// QA & Review hardening tests for the navbar topic search (#12) — additional, non-
// author coverage layered on the dev's test/topic-search.test.tsx. Closes thin spots
// the AC→test audit found:
//   - AC5 at the COMPONENT level (dev only covered it via e2e): an unseeded title's
//     navigation target is title-only with NO qid= (the create-on-demand contract).
//   - AC10 ABORT-ON-CHANGE proven directly: a superseded in-flight request's signal is
//     actually aborted when the query changes (dev only asserted a signal is passed).
//   - AC4/AC11 disclosure FOCUS MANAGEMENT: expand moves focus into the input; Escape
//     and the ✕ close return focus to the trigger (design §Placement Host 2, binding).
//   - AC2 select uses the suggestion's EXACT title, not the typed prefix.
//   - AC8 the Search BUTTON (not just Enter) is also a no-op on whitespace.

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

const fetchTopicSuggestions = vi.fn();
vi.mock("@/lib/wiki/suggest", () => ({
  fetchTopicSuggestions: (...a: unknown[]) => fetchTopicSuggestions(...a),
}));

import { TopicSearch } from "@/components/search/TopicSearch";

function suggestion(title: string, description?: string) {
  return description ? { title, description } : { title };
}

beforeEach(() => {
  routerPush.mockReset();
  fetchTopicSuggestions.mockReset();
  fetchTopicSuggestions.mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── AC5 (component level) — unseeded title → title-only target, no QID ─────────
describe("AC5 — create-on-demand: unseeded title navigates title-only (no qid)", () => {
  it("an arbitrary unseeded title navigates to /topic/<Title>/ with no qid= and no /contribute", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "Obscure unseeded subject"
    );
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledTimes(1);
    const target = routerPush.mock.calls[0][0] as string;
    // Title-only, space→underscore via #11 encoding; never a QID, never /contribute.
    expect(target).toBe("/topic/Obscure_unseeded_subject/");
    expect(target).not.toMatch(/qid=|Q\d+/);
    expect(target).not.toContain("/contribute");
  });
});

// ── AC10 — abort-on-change actually aborts the superseded request ──────────────
describe("AC10 — a superseded in-flight request is aborted on query change", () => {
  it("the first fetch's AbortSignal becomes aborted once the query changes", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    // Capture each call's signal; never resolve (keep it 'in flight').
    fetchTopicSuggestions.mockImplementation(
      (_q: string, opts: { signal?: AbortSignal }) => {
        if (opts?.signal) signals.push(opts.signal);
        return new Promise(() => {});
      }
    );
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", {
      name: /find a topic/i,
    }) as HTMLInputElement;

    // Type "Ca", let the debounce fire the first request.
    fireEvent.change(input, { target: { value: "Ca" } });
    vi.advanceTimersByTime(250);
    expect(signals.length).toBe(1);
    expect(signals[0].aborted).toBe(false);

    // Change the query → the prior in-flight request must be aborted, and a new
    // (debounced) request fires for the new value.
    fireEvent.change(input, { target: { value: "Cat" } });
    expect(signals[0].aborted).toBe(true); // superseded request aborted immediately
    vi.advanceTimersByTime(250);
    expect(signals.length).toBe(2);
    expect(signals[1].aborted).toBe(false);

    vi.useRealTimers();
  });
});

// ── AC4 / AC11 — disclosure (topic-header < md) focus management ───────────────
describe("AC4/AC11 — disclosure focus moves in on expand and returns on close", () => {
  it("expanding the disclosure moves focus into the revealed input", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="topic-disclosure" />);
    await user.click(screen.getByRole("button", { name: /search topics/i }));
    const input = await screen.findByRole("combobox", {
      name: /search wikipedia topics/i,
    });
    await waitFor(() => expect(input).toHaveFocus());
  });

  it("Escape (with the listbox closed) collapses the disclosure and returns focus to the trigger", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="topic-disclosure" />);
    await user.click(screen.getByRole("button", { name: /search topics/i }));
    const input = await screen.findByRole("combobox", {
      name: /search wikipedia topics/i,
    });
    await waitFor(() => expect(input).toHaveFocus());
    // Listbox is closed (empty value) — Escape collapses the disclosure.
    await user.keyboard("{Escape}");
    const trigger = await screen.findByRole("button", {
      name: /search topics/i,
    });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("the ✕ close control collapses the disclosure and returns focus to the trigger", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="topic-disclosure" />);
    await user.click(screen.getByRole("button", { name: /search topics/i }));
    await screen.findByRole("combobox", { name: /search wikipedia topics/i });
    await user.click(screen.getByRole("button", { name: /close search/i }));
    const trigger = await screen.findByRole("button", {
      name: /search topics/i,
    });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

// ── AC2 — select uses the suggestion's EXACT title, not the typed prefix ───────
describe("AC2 — selecting routes to the suggestion's exact title", () => {
  it("typing 'Cat' then selecting 'Catalonia' (with a description) routes to the exact title", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([
      suggestion("Cat", "domestic species"),
      suggestion("Catalonia", "autonomous community in Spain"),
    ]);
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "Cat"
    );
    await screen.findByRole("option", { name: /Catalonia/ });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    // Exact suggestion title, not the "Cat" prefix the user typed.
    expect(routerPush).toHaveBeenCalledWith("/topic/Catalonia/");
  });
});

// ── AC8 — the Search BUTTON is also a no-op on whitespace ──────────────────────
describe("AC8 — the Search button (not only Enter) no-ops on whitespace", () => {
  it("clicking Search with a whitespace-only value does not navigate", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "   "
    );
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(routerPush).not.toHaveBeenCalled();
  });
});
