import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Component tests for the navbar topic search (#12). The Wikipedia typeahead fetch
// and the Next router are MOCKED (no network / no real navigation in CI — the
// established pattern, docs/ARCHITECTURE.md "Testing"). We drive the SAME behavior
// from BOTH hosts (home header + topic header) for AC4. Query controls by accessible
// role/name (AC11) and drive selection by keyboard (AC13 aria-activedescendant).
//
// Maps Decisions 1–4 + AC1–AC13 of docs/specs/navbar-topic-search.md.

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  // AuthControl (issue C) lives in both headers and reads the path/query to build its OAuth
  // callbackUrl — provide stubs so rendering HomePage / TopicHeader doesn't need a router ctx.
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the suggest module so tests control the typeahead results deterministically.
const fetchTopicSuggestions = vi.fn();
vi.mock("@/lib/wiki/suggest", () => ({
  fetchTopicSuggestions: (...a: unknown[]) => fetchTopicSuggestions(...a),
}));

import { TopicSearch } from "@/components/search/TopicSearch";
import { TopicHeader } from "@/components/topic/TopicHeader";
import HomePage from "@/app/page";

function suggestion(title: string, description?: string) {
  return description ? { title, description } : { title };
}

beforeEach(() => {
  routerPush.mockReset();
  fetchTopicSuggestions.mockReset();
  // Default: no suggestions, resolved fast (tests override per-case).
  fetchTopicSuggestions.mockResolvedValue([]);
});
afterEach(() => {
  // Guarantee real timers are restored even if a fake-timer test throws before its
  // own restore — otherwise leaked fake timers would freeze every later test's
  // real-setTimeout debounce (the cascade-timeout failure mode).
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── AC1 — submit a title opens its Topic page ─────────────────────────────────
describe("AC1 — submit a typed title navigates to its Topic page", () => {
  it("Enter on raw text navigates to topicHref(title)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Photosynthesis");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Photosynthesis/");
  });

  it("activating the Search button submits the typed title", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "Photosynthesis"
    );
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(routerPush).toHaveBeenCalledWith("/topic/Photosynthesis/");
  });
});

// ── AC2 — selecting a suggestion opens that title ─────────────────────────────
describe("AC2 — selecting a suggestion navigates to that title", () => {
  it("arrow + Enter selects 'Catalonia' from [Cat, Catalonia]", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([
      suggestion("Cat"),
      suggestion("Catalonia"),
    ]);
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Cat");
    // Suggestions resolve after debounce.
    await screen.findByRole("option", { name: /Catalonia/ });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Catalonia/");
  });

  it("clicking a suggestion selects it", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([
      suggestion("Cat"),
      suggestion("Catalonia"),
    ]);
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "Cat"
    );
    const opt = await screen.findByRole("option", { name: /Catalonia/ });
    await user.click(opt);
    expect(routerPush).toHaveBeenCalledWith("/topic/Catalonia/");
  });
});

// ── AC3 — space-containing title routes via #11 encoding ──────────────────────
describe("AC3 — a space-containing title routes via the #11 encoding", () => {
  it("'San Francisco' → /topic/San_Francisco/ (space→underscore, not %20)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "San Francisco"
    );
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/San_Francisco/");
    expect(routerPush.mock.calls[0][0]).not.toContain("%20");
  });
});

// ── AC4 — works on BOTH hosts ─────────────────────────────────────────────────
describe("AC4 — search is present and operable on both hosts", () => {
  it("home host: a labeled search control is present and submits", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HomePage />);
    const input = await screen.findByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Photosynthesis");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Photosynthesis/");
  });

  it("topic host (inline, ≥ md): a labeled search control submits", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicHeader articleTitle="Photosynthesis" />);
    // Two TopicSearch instances render (inline + disclosure); the inline one is the
    // combobox; the disclosure one is collapsed to a trigger button until activated.
    const inputs = screen.getAllByRole("combobox", {
      name: /search wikipedia topics/i,
    });
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    await user.type(inputs[0], "San Francisco");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/San_Francisco/");
  });

  it("topic host (disclosure, < md): the labeled trigger expands to a working field", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicHeader articleTitle="Photosynthesis" />);
    // The degraded form: a labeled magnifier button that expands the same field (AC4).
    const trigger = screen.getByRole("button", { name: /search topics/i });
    await user.click(trigger);
    const inputs = screen.getAllByRole("combobox", {
      name: /search wikipedia topics/i,
    });
    // Drive AC1 through the revealed input (the last one — the now-expanded disclosure).
    await user.type(inputs[inputs.length - 1], "Cat");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Cat/");
  });
});

// ── AC6 — no /contribute, no write on navigation ──────────────────────────────
describe("AC6 — navigation is pure: no /contribute, no QID", () => {
  it("the only navigation is to /topic/<Title>/ (never /contribute, never qid=)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "Quantum entanglement"
    );
    await user.keyboard("{Enter}");
    const target = routerPush.mock.calls[0][0] as string;
    expect(target).toBe("/topic/Quantum_entanglement/");
    expect(target).not.toContain("/contribute");
    expect(target).not.toContain("qid=");
  });
});

// ── AC7 — no-results hint, still submittable ──────────────────────────────────
describe("AC7 — no-results hint, still submittable", () => {
  it("shows a non-blocking hint AND Enter still navigates to the typed title", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([]); // zero matches
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Asdkjfh");
    // The non-blocking hint row appears (verbatim microcopy).
    await screen.findByText(/No matching articles — press Enter to open/);
    expect(
      screen.getByText(/No matching articles — press Enter to open “Asdkjfh”/)
    ).toBeInTheDocument();
    // The hint is NOT a selectable option.
    expect(screen.queryByRole("option")).toBeNull();
    // Submitting still navigates.
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Asdkjfh/");
  });
});

// ── AC8 — empty/whitespace submit is a no-op ──────────────────────────────────
describe("AC8 — empty / whitespace submit is a graceful no-op", () => {
  it("Enter on an empty input does not navigate and keeps focus", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    input.focus();
    await user.keyboard("{Enter}");
    expect(routerPush).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it("Enter on a whitespace-only input does not navigate", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "   ");
    await user.keyboard("{Enter}");
    expect(routerPush).not.toHaveBeenCalled();
  });
});

// ── AC9 — suggestions are an enhancement, not a gate ──────────────────────────
describe("AC9 — submit works without ever opening/selecting a suggestion", () => {
  it("submits before suggestions resolve (slow fetch)", async () => {
    const user = userEvent.setup({ delay: null });
    // A fetch that never resolves during the test — suggestions never appear.
    fetchTopicSuggestions.mockReturnValue(new Promise(() => {}));
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Mitochondria");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Mitochondria/");
  });

  it("submits after a failed (degraded) fetch with no error UI", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([]); // suggest.ts swallows errors → []
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Mitochondria");
    await screen.findByTestId("topic-search-no-results");
    // No alert / error element rendered.
    expect(screen.queryByRole("alert")).toBeNull();
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Mitochondria/");
  });
});

// ── AC10 — debounce + abort + silent degrade ──────────────────────────────────
describe("AC10 — debounce + abort + silent degrade", () => {
  it("a burst of keystrokes fires fewer fetches than keystrokes (debounced)", async () => {
    fetchTopicSuggestions.mockResolvedValue([]);
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", {
      name: /find a topic/i,
    }) as HTMLInputElement;
    // Fire 5 input changes synchronously (a burst within the debounce window) — each
    // change clears the prior debounce timer, so only the final one survives.
    for (const v of ["C", "Ca", "Cat", "Cata", "Catal"]) {
      fireEvent.change(input, { target: { value: v } });
    }
    // After the debounce window, exactly one fetch fired (≪ 5 keystrokes).
    await waitFor(() => expect(fetchTopicSuggestions).toHaveBeenCalled(), {
      timeout: 1000,
    });
    expect(fetchTopicSuggestions.mock.calls.length).toBeLessThan(5);
    // The single fetch is for the final value, not the intermediate ones.
    expect(fetchTopicSuggestions.mock.calls[0][0]).toBe("Catal");
  });

  it("passes an AbortSignal so a superseded request can be aborted", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([]);
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Cat");
    await waitFor(() => expect(fetchTopicSuggestions).toHaveBeenCalled());
    const opts = fetchTopicSuggestions.mock.calls[0][1] as { signal?: AbortSignal };
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("renders NO error element when the suggest fetch degrades to []", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([]);
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "Xyzzy"
    );
    await screen.findByTestId("topic-search-no-results");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// ── AC11 — labeled + keyboard-operable ────────────────────────────────────────
describe("AC11 — labeled and keyboard-operable", () => {
  it("the input has an accessible name (visible label on home)", () => {
    render(<TopicSearch variant="home" />);
    expect(
      screen.getByRole("combobox", { name: "Find a topic" })
    ).toBeInTheDocument();
  });

  it("the input has an accessible name via aria-label on the topic header", () => {
    render(<TopicSearch variant="topic-inline" />);
    expect(
      screen.getByRole("combobox", { name: "Search Wikipedia topics" })
    ).toBeInTheDocument();
  });

  it("the whole flow (Tab → type → Arrow → Enter) is keyboard-operable", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([
      suggestion("Cat"),
      suggestion("Catalonia"),
    ]);
    render(
      <>
        <button>before</button>
        <TopicSearch variant="home" />
      </>
    );
    // Tab from the preceding control reaches the input.
    screen.getByText("before").focus();
    await user.tab();
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    expect(input).toHaveFocus();
    await user.keyboard("Cat");
    await screen.findByRole("option", { name: /Catalonia/ });
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Catalonia/");
  });

  it("Escape closes the listbox but keeps the typed value and focus", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([suggestion("Cat")]);
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Cat");
    await screen.findByRole("option", { name: "Cat" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input).toHaveValue("Cat");
    expect(input).toHaveFocus();
  });
});

// ── AC13 — suggestion list semantics + aria-activedescendant ──────────────────
describe("AC13 — listbox/option semantics + aria-activedescendant", () => {
  it("exposes role=listbox with role=option rows", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([
      suggestion("Cat"),
      suggestion("Catalonia"),
    ]);
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "Cat"
    );
    const listbox = await screen.findByRole("listbox", {
      name: "Article suggestions",
    });
    expect(within(listbox).getAllByRole("option")).toHaveLength(2);
  });

  it("aria-expanded + aria-controls wire the combobox to the listbox", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([suggestion("Cat")]);
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.type(input, "Cat");
    await screen.findByRole("listbox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(input).toHaveAttribute("aria-controls", listbox.id);
  });

  it("aria-activedescendant follows the active option on arrow navigation", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([
      suggestion("Cat"),
      suggestion("Catalonia"),
    ]);
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Cat");
    const options = await screen.findAllByRole("option");
    // Before arrowing, no active descendant.
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("the no-results hint row is NOT a role=option (arrows skip it)", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([]);
    render(<TopicSearch variant="home" />);
    const input = screen.getByRole("combobox", { name: /find a topic/i });
    await user.type(input, "Asdf");
    await screen.findByTestId("topic-search-no-results");
    expect(screen.queryByRole("option")).toBeNull();
    // ArrowDown does nothing harmful — still no active descendant, still no navigation.
    await user.keyboard("{ArrowDown}");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("announces the result count via a polite live region", async () => {
    const user = userEvent.setup({ delay: null });
    fetchTopicSuggestions.mockResolvedValue([
      suggestion("Cat"),
      suggestion("Catalonia"),
    ]);
    render(<TopicSearch variant="home" />);
    await user.type(
      screen.getByRole("combobox", { name: /find a topic/i }),
      "Cat"
    );
    const status = await screen.findByRole("status");
    await waitFor(() =>
      expect(status).toHaveTextContent("2 suggestions available")
    );
  });
});
