import { describe, expect, it } from "vitest";
import { useState, useCallback } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  ArticleSections,
  ownerH2SlugMap,
} from "@/components/topic/ArticleBody";
import type { ArticleSectionBody } from "@/lib/wiki/article";

// AC1 / AC3 / AC9 — the mobile (`< md`) collapsible-section disclosure, at the component level.
// These exercise ArticleSections on the PHONE branch (`isPhone`) directly, driving its open-state
// from a tiny controller that mirrors TopicView's (`openH2Slugs` Set + a `requestExpand(slug)` that
// maps any slug → its owning `h2` via `ownerH2SlugMap`). The end-to-end `goTo` wiring through
// TopicView is covered in test/topic-view-mobile.test.tsx; here we pin the disclosure mechanics:
// default-collapsed, toggle on click/Enter/Space, `aria-expanded` flip, the body `hidden` (so its
// links leave the tab order), and the anchor-jump expand of a collapsed group (incl. a nested h3).

const SECTIONS: ArticleSectionBody[] = [
  { slug: "causes", title: "Causes", level: 2, html: "<p>Causes body.</p>" },
  {
    slug: "fault-types",
    title: "Fault types",
    level: 3,
    html: '<p>Fault body with a <a href="/topic/Fault/">link</a>.</p>',
  },
  { slug: "effects", title: "Effects", level: 2, html: "<p>Effects body.</p>" },
];

/** A controlled host that drives ArticleSections like TopicView does: a `Set` of open `h2` slugs, a
 *  toggle, and a `requestExpand(slug)` that opens the slug's OWNING `h2` group (design §5.4). */
function Harness({
  isPhone = true,
  expose,
}: {
  isPhone?: boolean;
  expose?: (api: { expand: (slug: string) => void }) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const owner = ownerH2SlugMap(SECTIONS);
  const toggle = useCallback((h2Slug: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(h2Slug)) next.delete(h2Slug);
      else next.add(h2Slug);
      return next;
    });
  }, []);
  const expand = useCallback(
    (slug: string) => {
      const h2 = owner.get(slug) ?? slug;
      setOpen((prev) => new Set(prev).add(h2));
    },
    [owner]
  );
  expose?.({ expand });
  return (
    <ArticleSections
      sections={SECTIONS}
      activeSlug={null}
      isPhone={isPhone}
      openH2Slugs={open}
      onToggleH2={toggle}
    />
  );
}

/** The `h2`'s disclosure button (the accessible name is the heading text). */
function toggleButton(name: RegExp): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}
/** The group body region controlled by a button (resolved via `aria-controls`). */
function bodyOf(btn: HTMLButtonElement): HTMLElement {
  const id = btn.getAttribute("aria-controls")!;
  return document.getElementById(id)!;
}

describe("ArticleSections — mobile disclosure (AC1)", () => {
  it("each h2 renders as a native <button> disclosure, collapsed by default", () => {
    render(<Harness />);
    const causes = toggleButton(/^Causes/);
    const effects = toggleButton(/^Effects/);
    expect(causes.tagName).toBe("BUTTON");
    expect(causes).toHaveAttribute("type", "button");
    // Collapsed by default — both bodies hidden (AC1: sections start collapsed; the lead is open).
    expect(causes).toHaveAttribute("aria-expanded", "false");
    expect(effects).toHaveAttribute("aria-expanded", "false");
    expect(bodyOf(causes)).not.toBeVisible(); // [hidden]
    expect(bodyOf(effects)).not.toBeVisible();
  });

  it("toggles open on click and back closed on a second click; aria-expanded flips", () => {
    render(<Harness />);
    const causes = toggleButton(/^Causes/);
    fireEvent.click(causes);
    expect(causes).toHaveAttribute("aria-expanded", "true");
    expect(bodyOf(causes)).toBeVisible();
    expect(within(bodyOf(causes)).getByText("Causes body.")).toBeInTheDocument();
    fireEvent.click(causes);
    expect(causes).toHaveAttribute("aria-expanded", "false");
    expect(bodyOf(causes)).not.toBeVisible();
  });

  it("multiple sections open independently (no accordion-collapse-others)", () => {
    render(<Harness />);
    const causes = toggleButton(/^Causes/);
    const effects = toggleButton(/^Effects/);
    fireEvent.click(causes);
    fireEvent.click(effects);
    expect(causes).toHaveAttribute("aria-expanded", "true");
    expect(effects).toHaveAttribute("aria-expanded", "true");
  });

  it("a nested h3 renders INSIDE its parent h2's body (not its own toggle)", () => {
    render(<Harness />);
    // There is no independent toggle for the h3 — only the two h2 rows toggle.
    expect(screen.queryByRole("button", { name: /^Fault types/ })).toBeNull();
    const causes = toggleButton(/^Causes/);
    fireEvent.click(causes);
    // Expanding Causes reveals the nested h3 heading + its body, in document order.
    const body = bodyOf(causes);
    expect(within(body).getByRole("heading", { name: "Fault types" })).toBeVisible();
    expect(within(body).getByText(/Fault body/)).toBeVisible();
  });
});

describe("ArticleSections — keyboard + ARIA (AC9)", () => {
  it("is a native button: Enter and Space activate it (jsdom fires click for both)", () => {
    render(<Harness />);
    const causes = toggleButton(/^Causes/);
    // A native <button> fires `click` on Enter/Space natively. jsdom does not synthesize that from
    // keydown, so we assert the native semantics that GUARANTEE it: type=button, focusable, in the
    // tab order (no tabindex=-1) — and that a `click` (what the browser dispatches) toggles it.
    expect(causes.tagName).toBe("BUTTON");
    expect(causes).not.toHaveAttribute("tabindex", "-1");
    causes.focus();
    expect(document.activeElement).toBe(causes);
    fireEvent.click(causes); // the event Enter/Space dispatch on a native button
    expect(causes).toHaveAttribute("aria-expanded", "true");
  });

  it("exposes disclosure ARIA: aria-expanded + aria-controls → the labelled body region", () => {
    render(<Harness />);
    const causes = toggleButton(/^Causes/);
    expect(causes).toHaveAttribute("aria-expanded", "false");
    const id = causes.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).not.toBeNull();
  });

  it("a collapsed body's links are OUT of the tab order (hidden); present when expanded", () => {
    render(<Harness />);
    const causes = toggleButton(/^Causes/);
    // Collapsed: the link inside the nested h3 body is not accessible (the region is [hidden]).
    expect(screen.queryByRole("link", { name: "link" })).toBeNull();
    fireEvent.click(causes);
    // Expanded: the link is now in the accessibility tree (and thus the tab order).
    expect(screen.getByRole("link", { name: "link" })).toBeInTheDocument();
  });

  it("conveys state by chevron SHAPE, not color: the chevron span is present and aria-hidden", () => {
    render(<Harness />);
    const causes = toggleButton(/^Causes/);
    const chevron = causes.querySelector(".sec-chevron");
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    // The CSS rotates the chevron on `[aria-expanded="true"]` — a shape change, asserted via the
    // aria-expanded flip the rule keys off (the rotation itself is a CSS transform; the STATE cue
    // that drives it is aria-expanded, which AT also announces).
    fireEvent.click(causes);
    expect(causes).toHaveAttribute("aria-expanded", "true");
  });
});

describe("ArticleSections — anchor-jump expansion (AC3)", () => {
  it("requestExpand(h3 slug) opens the OWNING h2 group, revealing the nested section", () => {
    let api!: { expand: (slug: string) => void };
    render(<Harness expose={(a) => (api = a)} />);
    const causes = toggleButton(/^Causes/);
    expect(bodyOf(causes)).not.toBeVisible();
    // A goTo/anchor to the nested h3 must expand its parent h2 ("causes") group (design §5.4).
    // `expand` is an imperative state update outside React's event system, so flush it via act().
    act(() => api.expand("fault-types"));
    expect(causes).toHaveAttribute("aria-expanded", "true");
    expect(bodyOf(causes)).toBeVisible();
    expect(within(bodyOf(causes)).getByRole("heading", { name: "Fault types" })).toBeVisible();
  });

  it("requestExpand(h2 slug) opens that h2 group", () => {
    let api!: { expand: (slug: string) => void };
    render(<Harness expose={(a) => (api = a)} />);
    const effects = toggleButton(/^Effects/);
    act(() => api.expand("effects"));
    expect(effects).toHaveAttribute("aria-expanded", "true");
    expect(bodyOf(effects)).toBeVisible();
  });
});

describe("ArticleSections — ≥ md desktop/tablet unchanged (AC6)", () => {
  it("renders plain headings with NO disclosure button/chevron and all bodies shown", () => {
    render(<Harness isPhone={false} />);
    // No toggle buttons at all — the headings are plain <h2>/<h3>.
    expect(screen.queryByRole("button", { name: /^Causes/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Effects/ })).toBeNull();
    expect(document.querySelector(".sec-chevron")).toBeNull();
    // All section bodies are present + visible (today's expanded column).
    expect(screen.getByText("Causes body.")).toBeVisible();
    expect(screen.getByText("Effects body.")).toBeVisible();
    expect(screen.getByText(/Fault body/)).toBeVisible();
    // The per-section ids are intact across the breakpoint (AC2/AC6).
    expect(document.getElementById("sec-causes")).not.toBeNull();
    expect(document.getElementById("sec-fault-types")).not.toBeNull();
    expect(document.getElementById("sec-effects")).not.toBeNull();
  });
});
