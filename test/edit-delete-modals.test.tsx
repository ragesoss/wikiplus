import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditModal } from "@/components/topic/EditModal";
import { DeleteConfirmDialog } from "@/components/topic/DeleteConfirmDialog";
import type { ClipEditFormPatch } from "@/components/topic/curate-clip";
import type { SubmitOutcome } from "@/components/topic/useCurateSubmit";
import type { Clip } from "@/lib/data/types";

// D2 (issue #53) component tests: the Edit modal's pre-fill + the CONDITIONAL §5.3 re-agreement
// (design §4 / §6 — AC9/AC10 client side), and the Delete confirm dialog's Cancel-as-default
// safety + states (design §9 — AC3). The server-side ownership gate + the persisted re-stamp
// are covered in test/clip-edit-delete.test.ts (the node/pglite tests).

const sections = [
  { slug: "glycolysis", title: "Glycolysis" },
  { slug: "calvin-cycle", title: "Calvin cycle" },
];

const ownedClip: Clip = {
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
  curatedBy: "@me",
  curatorId: 7,
  createdAt: new Date().toISOString(),
};

type EditSubmit = (patch: ClipEditFormPatch, agreed: boolean) => Promise<SubmitOutcome>;
const okEdit = () => vi.fn<EditSubmit>(async () => ({ outcome: "added" }));

describe("EditModal — pre-fill + conditional §5.3 re-agreement (AC1/AC9/AC10)", () => {
  function renderEdit(onSubmit: ReturnType<typeof okEdit> = okEdit(), onClose = vi.fn()) {
    render(
      <EditModal clip={ownedClip} sections={sections} onClose={onClose} onSubmit={onSubmit} />
    );
    return { onSubmit, onClose };
  }

  it('titles the dialog "Edit curation" and shows the read-only clip summary WITHOUT the "auto-suggested" line', () => {
    renderEdit();
    expect(screen.getByRole("dialog", { name: "Edit curation" })).toBeInTheDocument();
    expect(screen.getByText(/Your curation · CrashCourse · YouTube/)).toBeInTheDocument();
    expect(screen.queryByText(/auto-suggested/)).toBeNull();
  });

  it("pre-fills the note, stance, accuracy, and section from the clip (§6.2)", () => {
    renderEdit();
    expect(screen.getByRole("textbox")).toHaveValue("An accurate, energetic overview.");
    expect(screen.getByRole("combobox", { name: "Stance" })).toHaveValue("explainer");
    expect(screen.getByRole("combobox", { name: "Accuracy" })).toHaveValue("accurate");
    expect(screen.getByRole("combobox", { name: "Section" })).toHaveValue("calvin-cycle");
  });

  it("HIDES the agreement on open and keeps Save enabled (the clip already carries an agreement)", () => {
    renderEdit();
    expect(
      screen.queryByRole("checkbox", {
        name: "I agree to release my context note under CC BY-SA 4.0.",
      })
    ).toBeNull();
    // Save is enabled for a no-op / chip-only edit (a non-empty note, agreement not required).
    expect(screen.getByRole("button", { name: /Save changes/ })).toBeEnabled();
  });

  it("REVEALS + REQUIRES the agreement once the note changes materially, then SAVE gates on it (AC9)", async () => {
    renderEdit();
    const note = screen.getByRole("textbox");
    await userEvent.clear(note);
    await userEvent.type(note, "A materially rewritten note.");
    // Agreement appears (the verbatim §5.3 strings) and is unchecked.
    const box = await screen.findByRole("checkbox", {
      name: "I agree to release my context note under CC BY-SA 4.0.",
    });
    expect(box).not.toBeChecked();
    // Save is now BLOCKED until the agreement is checked.
    expect(screen.getByRole("button", { name: /Save changes/ })).toBeDisabled();
    await userEvent.click(box);
    expect(screen.getByRole("button", { name: /Save changes/ })).toBeEnabled();
  });

  it("HIDES the agreement again when the note reverts to the original (no re-agreement needed — AC10)", async () => {
    renderEdit();
    const note = screen.getByRole("textbox");
    await userEvent.type(note, " extra"); // material → reveals
    expect(
      await screen.findByRole("checkbox", {
        name: "I agree to release my context note under CC BY-SA 4.0.",
      })
    ).toBeInTheDocument();
    // Revert exactly to the stored note → the agreement hides; Save no longer requires it.
    await userEvent.clear(note);
    await userEvent.type(note, "An accurate, energetic overview.");
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", {
          name: "I agree to release my context note under CC BY-SA 4.0.",
        })
      ).toBeNull()
    );
    expect(screen.getByRole("button", { name: /Save changes/ })).toBeEnabled();
  });

  it("submits the editable-set patch + agreed; a chip-only edit needs no agreement (AC10)", async () => {
    const onSubmit = okEdit();
    renderEdit(onSubmit);
    // Change only the stance — no note change → agreement not required → Save works.
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Stance" }),
      "opinion"
    );
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [patch, agreed] = onSubmit.mock.calls[0];
    expect(patch).toMatchObject({
      contextNote: "An accurate, energetic overview.",
      stance: "opinion",
      accuracyFlag: "accurate",
      general: false,
      sectionSlug: "calvin-cycle",
    });
    // agreed is false (the box was never shown/checked) — the server leaves the license as-is.
    expect(agreed).toBe(false);
  });

  it("keeps the modal OPEN with the edits intact on a server error, no false 'saved' (AC11)", async () => {
    const onSubmit = vi.fn<EditSubmit>(async () => {
      throw new Error("DB down");
    });
    const onClose = vi.fn();
    renderEdit(onSubmit, onClose);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Accuracy" }),
      "mixed"
    );
    await userEvent.click(screen.getByRole("button", { name: /Save changes/ }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn.t save/);
    expect(screen.getByRole("combobox", { name: "Accuracy" })).toHaveValue("mixed");
  });
});

describe("DeleteConfirmDialog — Cancel-as-default destructive confirm (AC3, design §9)", () => {
  function renderDelete(
    onConfirm: ReturnType<typeof vi.fn> = vi.fn(async () => ({ outcome: "added" })),
    onClose = vi.fn()
  ) {
    render(
      <DeleteConfirmDialog clip={ownedClip} onClose={onClose} onConfirm={onConfirm} />
    );
    return { onConfirm, onClose };
  }

  it("names the consequence (no-undo) + the clip, with both Cancel and Delete clip buttons", () => {
    renderDelete();
    expect(
      screen.getByRole("dialog", { name: "Delete this curation?" })
    ).toBeInTheDocument();
    expect(screen.getByText(/This can.t be undone/)).toBeInTheDocument();
    expect(screen.getByText("Photosynthesis explained")).toBeInTheDocument();
    expect(screen.getByTestId("delete-cancel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete clip" })).toBeInTheDocument();
  });

  it("initial focus lands on CANCEL (the safe default — a reflexive Enter cancels, never destroys)", () => {
    renderDelete();
    expect(screen.getByTestId("delete-cancel")).toHaveFocus();
  });

  it("runs onConfirm only when Delete clip is activated; shows the busy word while pending", async () => {
    let resolve: ((o: SubmitOutcome) => void) | undefined;
    const onConfirm = vi.fn(
      () => new Promise<SubmitOutcome>((r) => (resolve = r))
    );
    const onClose = vi.fn();
    renderDelete(onConfirm, onClose);
    await userEvent.click(screen.getByRole("button", { name: "Delete clip" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Pending: the busy WORD is shown + the control is disabled (no double-submit, §9.3).
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    // Cancel stays enabled (abandon mid-flight).
    expect(screen.getByTestId("delete-cancel")).toBeEnabled();
    resolve?.({ outcome: "added" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("keeps the dialog open with a role=alert message on a server error (no false 'deleted')", async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error("DB down");
    });
    const onClose = vi.fn();
    renderDelete(onConfirm, onClose);
    await userEvent.click(screen.getByRole("button", { name: "Delete clip" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn.t delete/);
    expect(screen.getByRole("button", { name: "Delete clip" })).toBeEnabled();
  });

  it("Cancel closes without deleting", async () => {
    const { onConfirm, onClose } = renderDelete();
    await userEvent.click(screen.getByTestId("delete-cancel"));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
