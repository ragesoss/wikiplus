import { describe, expect, it, vi, beforeAll } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { CitationLayer } from "@/components/topic/CitationLayer";

// Article-fidelity #24 (design §3.3): the citation popover layer. We mount realistic
// post-transform markup (the marker `<a href="#cite_note-N" data-cite-marker>`
// + reference list `<li id="cite_note-N">`) and exercise the open/close + the
// load-bearing "doesn't move scroll" contract (A2).

// Radix Popover uses ResizeObserver; jsdom lacks it. Stub it (no-op).
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  }
});

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      <p>
        Carbon is fixed
        <sup className="mw-ref reference" id="cite_ref-12" data-cite-marker="">
          <a href="#cite_note-12" data-cite-marker="" aria-label="Citation 12">
            <span className="mw-reflink-text">[12]</span>
          </a>
        </sup>
        .
      </p>
      <ol className="mw-references references">
        <li id="cite_note-12" data-mw-footnote-number="12">
          <span className="mw-cite-backlink">
            <a href="#cite_ref-12" data-cite-backref="" aria-label="Back to citation">
              ↑
            </a>
          </span>{" "}
          <span className="mw-reference-text reference-text">
            Smith, J. (2020). The Calvin cycle explained.
          </span>
        </li>
      </ol>
      <CitationLayer containerRef={ref} />
    </div>
  );
}

describe("CitationLayer (article-fidelity #24, §3.3)", () => {
  it("A2 opens a non-modal popover with the citation text on marker activation", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Citation 12"));
    let dialog!: HTMLElement;
    await waitFor(() => {
      dialog = screen.getByRole("dialog", { name: "Citation 12" });
      expect(dialog).toBeInTheDocument();
    });
    // The citation text is cloned into the popover body (it also remains in the foot
    // reference list), so scope the assertion to the dialog.
    expect(within(dialog).getByText(/Smith, J\. \(2020\)/)).toBeInTheDocument();
    // non-modal: NO aria-modal on the dialog (design §3.3 — not a modal)
    expect(dialog).not.toHaveAttribute("aria-modal", "true");
  });

  it("A2 opening the popover does NOT scroll the page (scroll-sync untouched)", async () => {
    const scrollSpy = vi.spyOn(window, "scrollTo");
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Citation 12"));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    );
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("A2 offers a 'View in References' control to reach the foot entry", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Citation 12"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /View in References/ })
      ).toBeInTheDocument()
    );
  });

  it("A7 closes on Escape and the dialog goes away", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Citation 12"));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  // DEF-1 (a11y, design §3.3 "Esc returns focus to the marker", A7/U7). Radix can't
  // auto-return focus to a trigger that doesn't exist (the marker lives in
  // dangerouslySetInnerHTML, the anchor is a virtualRef), so the layer focuses the
  // marker EXPLICITLY in onCloseAutoFocus. Without the fix, focus reset to <body>.
  it("A7/DEF-1 returns focus to the triggering marker on Escape", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const marker = screen.getByLabelText("Citation 12");
    await user.click(marker);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    // Focus lands back on the marker — NOT on <body> (the pre-fix behavior).
    await waitFor(() => expect(marker).toHaveFocus());
  });

  // DEF-1, sibling path: the explicit close-focus must also fire for the in-popover
  // Close (×) button, not only Esc — same onCloseAutoFocus path.
  it("DEF-1 returns focus to the marker when the Close button is used", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const marker = screen.getByLabelText("Citation 12");
    await user.click(marker);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Close citation/ }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await waitFor(() => expect(marker).toHaveFocus());
  });

  // DEF-2 (a11y, design §3.3 "jumps to AND focuses the matching entry", A4). The
  // <li> focus is recorded and applied in onCloseAutoFocus (after Radix's close-focus
  // settles); a synchronous li.focus() before setOpen(null) was clobbered to <body>.
  it("A4/DEF-2 moves focus to the reference entry on 'View in References'", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Citation 12"));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /View in References/ }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    // Focus lands on the reference list entry <li id="cite_note-12">, made focusable
    // via tabindex="-1" — NOT on <body>.
    const li = document.getElementById("cite_note-12")!;
    expect(li).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(li).toHaveFocus());
  });

  // A2 regression guard: the close-focus fix must NOT make the popover modal. While
  // open, the page is not focus-trapped — a non-popover element outside it is still
  // focusable (no page-level focus trap, no aria-modal).
  it("A2 stays non-modal with the close-focus fix (no page focus trap)", async () => {
    render(<Harness />);
    // The marker link (role=link); the open dialog ALSO carries aria-label
    // "Citation 12", so query the link role specifically once it's open.
    const marker = screen.getByRole("link", { name: "Citation 12" });
    await userEvent.click(marker);
    const dialog = await waitFor(() => screen.getByRole("dialog"));
    expect(dialog).not.toHaveAttribute("aria-modal", "true");
    // An element outside the popover can still take focus (no trap on the page).
    marker.focus();
    expect(marker).toHaveFocus();
  });

  // A2 regression guard: the View-in-References close-focus path scrolls the <li> into
  // view (its own scroll), but must not trigger window.scrollTo on OPEN. Opening the
  // popover (which now wires onCloseAutoFocus) still does not scroll the page.
  it("A2/DEF guard: opening the popover still does not scroll the page", async () => {
    const scrollSpy = vi.spyOn(window, "scrollTo");
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Citation 12"));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("closes on a scroll gesture (the anchored marker scrolls away, §3.3)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Citation 12"));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});
