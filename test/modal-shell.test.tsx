import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ModalShell } from "@/components/topic/ModalShell";

// jsdom does not compute layout, so HTMLElement.offsetParent is always null —
// which would make the component's visibility filter (offsetParent !== null) drop
// every focusable. Stub offsetParent to a truthy value so the REAL focus-trap
// logic (which is correct in a browser) is exercised under test.
let restoreOffsetParent: () => void;
beforeAll(() => {
  const desc = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetParent"
  );
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return document.body;
    },
  });
  restoreOffsetParent = () => {
    if (desc) Object.defineProperty(HTMLElement.prototype, "offsetParent", desc);
  };
});
afterAll(() => restoreOffsetParent?.());

// AC21 §11.4: dialog role + aria-modal, focus moved in on open, Esc + backdrop
// close, and focus RETURNED to the triggering control on close.

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <ModalShell onClose={() => setOpen(false)} ariaLabel="Test dialog">
          <div>
            <button>first</button>
            <button>last</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

describe("ModalShell (AC21 — dialog semantics + focus management)", () => {
  it("renders role=dialog aria-modal with an accessible name", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("open"));
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus into the dialog on open", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("open"));
    expect(screen.getByText("first")).toHaveFocus();
  });

  it("closes on Esc and returns focus to the trigger", async () => {
    render(<Harness />);
    const trigger = screen.getByText("open");
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes on a backdrop click", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("open"));
    const dialog = screen.getByRole("dialog");
    // the backdrop is the dialog's parent overlay
    const backdrop = dialog.parentElement as HTMLElement;
    await userEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("traps Tab focus within the dialog (last → first)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("open"));
    screen.getByText("last").focus();
    await userEvent.tab();
    expect(screen.getByText("first")).toHaveFocus();
  });
});
