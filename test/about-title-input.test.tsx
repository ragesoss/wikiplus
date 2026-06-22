import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Component tests for the About page's miniature title input (docs/specs/about-page.md AC9–AC12,
// AC16; docs/design/about-page.md §3). The Next router is MOCKED (no real navigation in CI — the
// established pattern). The input reuses ONLY topicHref + router.push (not the TopicSearch combobox);
// these assert the one real behavior: prepopulated default, Enter → topicHref(raw value),
// empty/whitespace no-op, and the programmatic accessible name + keyboard operability.

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

import { MiniatureTitleInput } from "@/components/about/MiniatureTitleInput";
import {
  DEFAULT_TITLE,
  TITLE_INPUT_HELP,
  TITLE_INPUT_LABEL,
} from "@/components/about/copy";

beforeEach(() => {
  routerPush.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

// ── AC9 — prepopulated with the handoff default ───────────────────────────────
describe("AC9 — prepopulated article title", () => {
  it("renders prepopulated with the default title 'Acer palmatum'", () => {
    render(<MiniatureTitleInput />);
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    expect(input).toHaveValue(DEFAULT_TITLE);
  });
});

// ── AC16 — named, keyboard-operable control (not relying on the visible value) ─
describe("AC16 — accessible name + keyboard operability", () => {
  it("has a programmatic accessible name independent of the visible value", () => {
    render(<MiniatureTitleInput />);
    // Found by the sr-only <label> name, NOT by the visible title value.
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    expect(input).toBeInTheDocument();
  });

  it("is a text input (not type=search) with the sr-only describedby helper", () => {
    render(<MiniatureTitleInput />);
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    expect(input).toHaveAttribute("type", "text");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      TITLE_INPUT_HELP
    );
  });
});

// ── AC11 — Enter navigates to topicHref(raw value) ────────────────────────────
describe("AC11 — Enter navigates to the topic page (raw title, no hand-encoding)", () => {
  it("Enter on the unchanged default navigates to /topic/Acer_palmatum/", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MiniatureTitleInput />);
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    input.focus();
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Acer_palmatum/");
  });

  it("Enter on an edited value navigates to the edited title's topic page", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MiniatureTitleInput />);
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    await user.clear(input);
    await user.type(input, "San Francisco");
    await user.keyboard("{Enter}");
    // Spaces → underscores via titleToSlug; the title is passed raw to topicHref.
    expect(routerPush).toHaveBeenCalledWith("/topic/San_Francisco/");
  });

  it("a title with reserved chars round-trips through topicHref (encoded once, single path segment)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MiniatureTitleInput />);
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    await user.clear(input);
    // "C++" / "AT&T"-class titles: reserved chars are percent-encoded by titleToSlug, not
    // hand-encoded by the component, and the result stays a single /topic/<segment>/ path.
    await user.type(input, "Foo & Bar+");
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledWith("/topic/Foo_%26_Bar%2B/");
  });
});

// ── Security — a user-controlled title cannot coerce an unsafe navigation ──────
// The input feeds router.push(topicHref(value.trim())); topicHref encodes via titleToSlug
// (encodeURIComponent then %20→_). encodeURIComponent escapes every URL-significant char
// (`:`, `/`, `//`), so a malicious title can never become a javascript:/data: scheme URL, an
// open redirect, or escape the /topic/ segment via path traversal — the result is always a
// same-origin relative path passed to client-side navigation.
describe("Security — title cannot produce an unsafe navigation", () => {
  it.each([
    ["javascript:alert(1)", "/topic/javascript%3Aalert(1)/"],
    ["//evil.com", "/topic/%2F%2Fevil.com/"],
    ["https://evil.com", "/topic/https%3A%2F%2Fevil.com/"],
    ["../../etc/passwd", "/topic/..%2F..%2Fetc%2Fpasswd/"],
    ["data:text/html,<x>", "/topic/data%3Atext%2Fhtml%2C%3Cx%3E/"],
  ])("neutralizes %j → a same-origin /topic/ path", async (evil, expected) => {
    const user = userEvent.setup({ delay: null });
    render(<MiniatureTitleInput />);
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    await user.clear(input);
    // user.type interprets `{` `[` as special; this corpus has none, so it types literally.
    await user.type(input, evil);
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenCalledTimes(1);
    const pushed = routerPush.mock.calls[0][0] as string;
    expect(pushed).toBe(expected);
    // Belt-and-braces: always a relative /topic/ path, never a scheme/protocol-relative URL.
    expect(pushed.startsWith("/topic/")).toBe(true);
    expect(pushed).not.toMatch(/^[a-z]+:/i); // no javascript:/data:/https: scheme
    expect(pushed.startsWith("//")).toBe(false); // no protocol-relative open redirect
  });
});

// ── AC12 — empty / whitespace-only is a graceful no-op ────────────────────────
describe("AC12 — empty/whitespace-only Enter is a no-op", () => {
  it("does not navigate when the field is cleared", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MiniatureTitleInput />);
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    await user.clear(input);
    await user.keyboard("{Enter}");
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("does not navigate for a whitespace-only value", async () => {
    const user = userEvent.setup({ delay: null });
    render(<MiniatureTitleInput />);
    const input = screen.getByRole("textbox", { name: TITLE_INPUT_LABEL });
    await user.clear(input);
    await user.type(input, "   ");
    await user.keyboard("{Enter}");
    expect(routerPush).not.toHaveBeenCalled();
  });
});
