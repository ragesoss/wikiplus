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
