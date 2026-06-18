import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import { ProfileClipRow } from "@/components/profile/ProfileClipRow";
import type { Clip, ContributorClip } from "@/lib/data/types";

// ── D3 (issue #54): the two NEW affordances D3 adds to the General-band tile + the profile row. ──
// These component surfaces were uncovered by the committed suite (general-strip.test.tsx predates
// D3; there is no profile-row test). QA extends coverage for:
//   - AC6: the "context by <curator>" attribution renders on the CURATED GeneralStrip tile, links
//          IN to the profile (real curator) and degrades to the non-linked label for `@prototype`.
//   - AC7: the owner Edit/Delete affordance reaches the GeneralStrip tile + the profile row, and is
//          OWNER-GATED (present only when `owned`; absent otherwise). The server gate (AC8) is the
//          real control and is tested at the action in contributor-profiles.test.ts; this verifies
//          the affordance presence/absence the design fixes (owner-only on these two new surfaces).

const generalClip: Clip = {
  id: "g1",
  topicQid: "Q11982",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  caption: "Overview clip",
  creator: { handle: "@cc", name: "CrashCourse", platform: "youtube" },
  contextNote: "note",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: true,
  curatedBy: "Marcus",
  curatorId: 7,
  createdAt: new Date().toISOString(),
};

function renderStrip(props: Partial<React.ComponentProps<typeof GeneralStrip>> = {}) {
  return render(
    <GeneralStrip
      topicTitle="Photosynthesis"
      generalClips={[generalClip]}
      generalCandidates={[]}
      onPlay={vi.fn()}
      onPromote={vi.fn()}
      onDismiss={vi.fn()}
      onAdd={vi.fn()}
      {...props}
    />
  );
}

describe("GeneralStrip — D3 'context by <curator>' on the curated tile (AC6)", () => {
  it("renders the linked 'context by <username>' attribution (links IN to the profile)", () => {
    renderStrip();
    const link = screen.getByRole("link", {
      name: "context by Marcus, view their curations",
    });
    expect(link.getAttribute("href")).toMatch(/^\/contributor\/Marcus\/?$/);
    // IN-link (the profile), never a new tab (distinct from the OUT creator credit).
    expect(link).not.toHaveAttribute("target", "_blank");
  });

  it("degrades to the non-linked 'seed clip · no curator' label for a @prototype tile", () => {
    renderStrip({ generalClips: [{ ...generalClip, curatedBy: "@prototype", curatorId: undefined }] });
    expect(screen.getByText("seed clip · no curator")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /context by/ })).toBeNull();
  });
});

describe("GeneralStrip — D3 owner Edit/Delete affordance is OWNER-GATED (AC7)", () => {
  it("shows Edit + Delete on a curated tile the viewer owns", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderStrip({ ownsClip: () => true, onEdit, onDelete });
    expect(
      screen.getByRole("button", { name: `Edit your curation: ${generalClip.caption}` })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Delete your curation: ${generalClip.caption}` })
    ).toBeInTheDocument();
  });

  it("shows NO owner affordance when the viewer does not own the tile (others' clip)", () => {
    renderStrip({ ownsClip: () => false, onEdit: vi.fn(), onDelete: vi.fn() });
    expect(screen.queryByRole("button", { name: /Edit your curation/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete your curation/ })).toBeNull();
  });

  it("shows NO owner affordance when logged out (no ownsClip predicate — the default)", () => {
    // TopicView omits ownsClip/onEdit/onDelete when logged out; the default `() => false`
    // means an anonymous reader's render carries no affordance (AC9 byte-for-byte).
    renderStrip();
    expect(screen.queryByRole("group", { name: "Manage your curated clip" })).toBeNull();
  });

  it("wires Edit/Delete on an owned tile to the host handlers", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderStrip({ ownsClip: () => true, onEdit, onDelete });
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(
      screen.getByRole("button", { name: `Edit your curation: ${generalClip.caption}` })
    );
    await userEvent.click(
      screen.getByRole("button", { name: `Delete your curation: ${generalClip.caption}` })
    );
    expect(onEdit).toHaveBeenCalledWith(generalClip);
    expect(onDelete).toHaveBeenCalledWith(generalClip);
  });
});

// ── The profile row (ProfileClipRow): the "On <Topic>" context, the suppressed per-row
//    attribution (design §5.4), and the owner-gated Edit/Delete (AC1/AC7). ──
const profileClip: ContributorClip = {
  ...generalClip,
  general: false,
  sectionSlug: "calvin-cycle",
  sectionLabel: "Calvin cycle",
  topicTitle: "Photosynthesis",
};

describe("ProfileClipRow — topic context + owner gating (AC1/AC7)", () => {
  it("renders the 'On <Topic>' link to the canonical topic route (AC1)", () => {
    render(<ProfileClipRow clip={profileClip} onPlay={vi.fn()} />);
    const link = screen.getByRole("link", {
      name: "On Photosynthesis — view this topic",
    });
    expect(link.getAttribute("href")).toMatch(/^\/topic\/Photosynthesis\/?$/);
  });

  it("SUPPRESSES the per-row 'context by' attribution (identity is asserted once in the header)", () => {
    render(<ProfileClipRow clip={profileClip} onPlay={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /context by/ })).toBeNull();
    expect(screen.queryByText(/context by/i)).toBeNull();
  });

  it("shows the owner Edit/Delete row ONLY when the viewer is the owner (AC7)", () => {
    const { rerender } = render(
      <ProfileClipRow clip={profileClip} owned={false} onPlay={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /Edit your curation/ })).toBeNull();
    rerender(
      <ProfileClipRow
        clip={profileClip}
        owned
        onPlay={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: `Edit your curation: ${profileClip.caption}` })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Delete your curation: ${profileClip.caption}` })
    ).toBeInTheDocument();
  });
});
