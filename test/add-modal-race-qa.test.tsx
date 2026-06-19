import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// QA & Review hardening for issue #64 (independent, non-author): the design's "Resolved via
// oEmbed shows ONLY in state C" invariant (AC3) checked across the OTHER states, and the
// failure→placeholder ("Add anyway") transition leaving NO dead end. The resolver is
// module-mocked (vi.mock is hoisted) so this lives in its own file, mirroring the author's
// test/add-modal-resolve.test.tsx split.

const resolveOEmbed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/embed/oembed", () => ({ resolveOEmbedAction: resolveOEmbed }));

import { AddModal } from "@/components/topic/AddModal";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import type { Clip } from "@/lib/data/types";

const sections = [{ slug: "sharpening", title: "Sharpening" }];
type OnSubmit = (
  clip: Omit<Clip, "id" | "createdAt">,
  agreed: boolean
) => Promise<SubmitOutcome>;

function renderAdd() {
  const onSubmit = vi.fn<OnSubmit>(async () => ({ outcome: "added" }));
  const onClose = vi.fn();
  render(
    <AddModal
      sections={sections}
      topicQid="Q189603"
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
  return { onSubmit, onClose };
}

describe("AddModal — 'Resolved via oEmbed' eyebrow appears ONLY in state C (QA, AC3)", () => {
  beforeEach(() => resolveOEmbed.mockReset());

  it("the eyebrow is absent in entry (A) and the unsupported placeholder arm (G)", async () => {
    resolveOEmbed.mockResolvedValue({ ok: false, reason: "unsupported" });
    renderAdd();
    // Entry (A): nothing resolved yet.
    expect(screen.queryByText("Resolved via oEmbed")).toBeNull();

    // Placeholder arm (G — unsupported Instagram): honest placeholder, still NO eyebrow.
    await userEvent.type(
      screen.getByPlaceholderText(/youtu\.be/),
      "https://www.instagram.com/reel/ABC123/"
    );
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));
    expect(
      await screen.findByText("Unresolved Instagram clip")
    ).toBeInTheDocument();
    expect(screen.queryByText("Resolved via oEmbed")).toBeNull();
    // The unsupported arm offers NO "Try again" (retrying a support limitation won't help — AC6).
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("the eyebrow is absent in the failure state (D) and after 'Add anyway' → placeholder (E)", async () => {
    resolveOEmbed.mockResolvedValue({ ok: false, reason: "failed" });
    renderAdd();
    await userEvent.type(
      screen.getByPlaceholderText(/youtu\.be/),
      "https://youtu.be/zzz"
    );
    await userEvent.click(screen.getByRole("button", { name: "Fetch details" }));

    // State D (failure): the honest failure notice, NO eyebrow.
    expect(
      await screen.findByText("Couldn't fetch video details")
    ).toBeInTheDocument();
    expect(screen.queryByText("Resolved via oEmbed")).toBeNull();

    // "Add anyway" → state E (accepted placeholder): a reachable, non-dead-end path, still NO
    // eyebrow and the curate fields now appear (the invariant: fields only in C or E).
    await userEvent.click(screen.getByRole("button", { name: "Add anyway" }));
    expect(await screen.findByText("Unresolved YouTube clip")).toBeInTheDocument();
    expect(screen.queryByText("Resolved via oEmbed")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Stance" })).toBeInTheDocument();
  });
});
