import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemoveConfirmDialog } from "@/components/topic/RemoveConfirmDialog";
import { ReviewRow } from "@/components/topic/ReviewRow";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import type { Clip } from "@/lib/data/types";

// D5c (issue #59) component tests: the moderator Remove affordance (ReviewRow §4.2/§4.3) and the
// RemoveConfirmDialog's Cancel-as-default safety, the soft/reversible copy, the OPTIONAL audit-only
// reason capture (§5.2 — never gates, never pre-filled), and the states (§5.5). The SERVER-SIDE
// role-gate (the security control — AC2/AC3) is covered in test/moderator-removal.test.ts; this
// covers the affordance + confirm UI the moderator sees.

const clip: Clip = {
  id: "c1",
  topicQid: "Q11982",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "vertical",
  watchUrl: "https://youtu.be/abc",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc",
  caption: "Photosynthesis explained",
  creator: { handle: "@crashcourse", name: "CrashCourse", platform: "youtube" },
  contextNote: "An accurate, energetic overview.",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: false,
  sectionSlug: "calvin-cycle",
  sectionLabel: "Calvin cycle",
  curatedBy: "@someone",
  curatorId: 7,
  createdAt: new Date().toISOString(),
};

type Confirm = (reason: string | null) => Promise<SubmitOutcome>;
const ok = () => vi.fn<Confirm>(async () => ({ outcome: "added" }));

describe("ReviewRow — the moderator Remove affordance (§4.2/§4.3)", () => {
  it("renders 'Remove (moderator)' last (after Hold/Approve) when canRemove, with the moderator-scoped a11y name", () => {
    render(
      <ReviewRow
        clip={clip}
        canHold
        canApprove={false}
        canRemove
        onHold={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const remove = screen.getByRole("button", {
      name: `Remove this clip (moderator action): ${clip.caption}`,
    });
    expect(remove).toBeInTheDocument();
    expect(remove).toHaveTextContent("Remove (moderator)");
    // Placed LAST: the Hold button precedes Remove in DOM order (least- → most-destructive).
    const group = screen.getByRole("group", { name: "Review this clip" });
    const buttons = group.querySelectorAll("button");
    expect(buttons[buttons.length - 1]).toBe(remove);
  });

  it("does NOT render the row at all when canHold/canApprove/canRemove are all false", () => {
    const { container } = render(
      <ReviewRow clip={clip} canHold={false} canApprove={false} canRemove={false} />
    );
    expect(container.querySelector('[aria-label="Review this clip"]')).toBeNull();
  });

  it("renders the row for a moderator on a clip they cannot hold/approve (Remove-only)", () => {
    render(<ReviewRow clip={clip} canHold={false} canApprove={false} canRemove onRemove={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Remove this clip \(moderator action\)/ })).toBeInTheDocument();
  });

  it("activating Remove calls onRemove with the clip (opens the confirm; does not remove directly)", async () => {
    const onRemove = vi.fn();
    render(<ReviewRow clip={clip} canHold={false} canApprove={false} canRemove onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: /Remove this clip \(moderator action\)/ }));
    expect(onRemove).toHaveBeenCalledWith(clip);
  });
});

describe("RemoveConfirmDialog — safety, soft copy, optional reason, states (§5)", () => {
  function renderDialog(onConfirm: ReturnType<typeof ok> = ok(), onClose = vi.fn()) {
    render(<RemoveConfirmDialog clip={clip} onClose={onClose} onConfirm={onConfirm} />);
    return { onConfirm, onClose };
  }

  it('titles the dialog "Remove this clip?" and shows the clip caption', () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Remove this clip?" })).toBeInTheDocument();
    expect(screen.getByText(clip.caption)).toBeInTheDocument();
  });

  it("shows the SOFT/REVERSIBLE body copy (a tombstone, not a permanent erase)", () => {
    renderDialog();
    expect(
      screen.getByText(/can be restored by an admin — not\s+permanently deleted/i)
    ).toBeInTheDocument();
    // It must NOT use D2's permanent-erase framing.
    expect(screen.queryByText(/can't be undone/i)).toBeNull();
  });

  it("focuses Cancel by default (the safe default — a reflexive Enter cancels, never removes)", async () => {
    renderDialog();
    await waitFor(() =>
      expect(screen.getByTestId("remove-cancel")).toHaveFocus()
    );
  });

  it("renders the OPTIONAL reason capture: the audit-only eyebrow, a category select defaulting to 'No reason given', and an optional note", () => {
    renderDialog();
    expect(
      screen.getByText("Reason (optional — for moderators only, not shown to readers)")
    ).toBeInTheDocument();
    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.value).toBe(""); // "No reason given" default → no reason sent
    expect(screen.getByRole("option", { name: "No reason given" })).toBeInTheDocument();
    // The C9 §7 category labels are present, verbatim.
    expect(screen.getByRole("option", { name: "Spam" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Self/affiliate promotion" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Other (see note)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Add a note (optional)")).toBeInTheDocument();
  });

  it("Remove clip is enabled with NO reason chosen, and confirms with reason=null (the reason never gates)", async () => {
    const { onConfirm } = renderDialog();
    const removeBtn = screen.getByRole("button", { name: "Remove clip" });
    expect(removeBtn).toBeEnabled();
    await userEvent.click(removeBtn);
    expect(onConfirm).toHaveBeenCalledWith(null); // no reason → null
  });

  it("passes the composed §7 category + free-text note to onConfirm (audit-only)", async () => {
    const { onConfirm } = renderDialog();
    await userEvent.selectOptions(screen.getByLabelText("Category"), "spam");
    await userEvent.type(screen.getByLabelText("Add a note (optional)"), "bulk junk");
    await userEvent.click(screen.getByRole("button", { name: "Remove clip" }));
    expect(onConfirm).toHaveBeenCalledWith("spam: bulk junk");
  });

  it("the reason is NEVER pre-filled from the clip's chips (default is always 'No reason given')", () => {
    // The clip's stance/accuracy are explainer/accurate — the category must NOT be pre-selected.
    renderDialog();
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("");
  });

  it("on a generic error keeps the dialog open with a role=alert 'Couldn't remove' message; the clip is not removed", async () => {
    const onConfirm = vi.fn<Confirm>(async () => {
      throw new Error("boom");
    });
    const onClose = vi.fn();
    render(<RemoveConfirmDialog clip={clip} onClose={onClose} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove clip" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't remove/);
    expect(onClose).not.toHaveBeenCalled(); // dialog stays open
  });

  it("on the rate-limit outcome keeps the dialog open with the calm role=status notice (not red, not the gate)", async () => {
    const onConfirm = vi.fn<Confirm>(async () => ({ outcome: "limited" }));
    const onClose = vi.fn();
    render(<RemoveConfirmDialog clip={clip} onClose={onClose} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove clip" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled(); // dialog stays open, clip unchanged
  });

  it("on success closes the dialog (the disappearance is the confirmation — no toast)", async () => {
    const { onConfirm, onClose } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Remove clip" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Cancel closes without removing (no onConfirm call)", async () => {
    const { onConfirm, onClose } = renderDialog();
    await userEvent.click(screen.getByTestId("remove-cancel"));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
