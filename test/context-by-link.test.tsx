import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContextByLink } from "@/components/topic/ContextByLink";
import { ClipCard } from "@/components/topic/ClipCard";
import type { Clip } from "@/lib/data/types";

// ── D3 (issue #54, AC6 / CURATION §5.4): the public "context by <curator>" attribution element. ──
// The VERBATIM strings, the IN-link target, the accessible name, and the `@prototype` non-linked
// label are the editorial contract; this pins them. The DISTINCTNESS from the §5.2 creator credit
// (which links OUT) is verified on a rendered ClipCard.

describe("ContextByLink — real curator (links IN to the profile)", () => {
  it('renders "context by <username>" with the username as a link to /contributor/<username>', () => {
    render(<ContextByLink curatedBy="Marcus" surface="light" />);
    // The link's visible text is the username; the accessible name is the verbatim §5.4 string.
    const link = screen.getByRole("link", {
      name: "context by Marcus, view their curations",
    });
    // next/link normalizes the trailing slash off the rendered client href; the server
    // canonicalizes either form. Assert the IN-link path (slash-tolerant).
    expect(link.getAttribute("href")).toMatch(/^\/contributor\/Marcus\/?$/);
    expect(link).toHaveTextContent("Marcus");
    // The fixed "context by " label is present (the WORD carries the meaning, not color).
    expect(screen.getByText(/context by/i)).toBeInTheDocument();
    // The underline marks it a link (never color-alone) — class carries `underline`.
    expect(link.className).toMatch(/underline/);
  });

  it("encodes a username with a space into a single path segment (Wikipedia-style)", () => {
    render(<ContextByLink curatedBy="Marcus Aurelius" surface="light" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toMatch(
      /^\/contributor\/Marcus_Aurelius\/?$/
    );
  });

  it("on the indigo band the link is white + underlined (AA-safe on indigo)", () => {
    render(<ContextByLink curatedBy="Marcus" surface="indigo" />);
    const link = screen.getByRole("link");
    expect(link.className).toMatch(/text-white/);
    expect(link.className).toMatch(/underline/);
  });
});

describe("ContextByLink — legacy @prototype / no curator (non-linked label)", () => {
  it('renders the verbatim non-linked "seed clip · no curator" label for @prototype', () => {
    render(<ContextByLink curatedBy="@prototype" surface="light" />);
    expect(screen.getByText("seed clip · no curator")).toBeInTheDocument();
    // No link — the stub has no browsable profile (Decision 4 / AC4).
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders the same non-linked label when curatedBy is absent", () => {
    render(<ContextByLink curatedBy={undefined} surface="indigo" />);
    expect(screen.getByText("seed clip · no curator")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

const baseClip: Clip = {
  id: "c1",
  topicQid: "Q11982",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  caption: "Photosynthesis explained",
  creator: {
    handle: "@crashcourse",
    name: "CrashCourse",
    platform: "youtube",
    url: "https://youtube.com/@crashcourse",
  },
  contextNote: "An accurate overview.",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: false,
  sectionSlug: "calvin-cycle",
  sectionLabel: "Calvin cycle",
  curatedBy: "Marcus",
  createdAt: new Date().toISOString(),
};

describe("ClipCard — curator attribution is DISTINCT from the creator credit (CURATION §5.4)", () => {
  it("creator credit links OUT (_blank, the platform); curator attribution links IN (the profile)", () => {
    render(
      <ClipCard clip={baseClip} active={false} onPlay={() => {}} onGoToSection={() => {}} />
    );
    // §5.2 creator credit — links OUT to the platform, new tab.
    const out = screen.getByRole("link", { name: /crashcourse/i });
    expect(out).toHaveAttribute("href", "https://youtube.com/@crashcourse");
    expect(out).toHaveAttribute("target", "_blank");
    // §5.4 curator attribution — links IN to the wiki+ profile, NOT a new tab.
    const inLink = screen.getByRole("link", {
      name: "context by Marcus, view their curations",
    });
    expect(inLink.getAttribute("href")).toMatch(/^\/contributor\/Marcus\/?$/);
    expect(inLink).not.toHaveAttribute("target", "_blank");
    // They are two distinct links — never merged.
    expect(out).not.toBe(inLink);
  });
});
