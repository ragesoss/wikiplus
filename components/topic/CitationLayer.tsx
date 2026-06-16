"use client";

import * as Popover from "@radix-ui/react-popover";
import { useCallback, useEffect, useRef, useState } from "react";

// Citation popover layer (article-fidelity #24, design §3.3). A SINGLE non-modal
// Radix Popover, repositioned to whichever inline `[n]` marker the reader activates.
//
// The markers themselves live inside the article's dangerouslySetInnerHTML body
// (rendered by ArticleSections / ArticleLeadBlock), tagged `data-cite-marker` by
// `lib/wiki/article.ts#prepCitations`. This layer attaches ONE delegated handler to
// the article container, so it works for every marker in the lead + every section
// without per-marker React nodes.
//
// THE LOAD-BEARING INTERACTION (design §3.3, A2): opening the popover must NOT move
// the page — it never scrolls, never calls goTo, never sets the active section.
// It is an overlay anchored to the marker; the scroll-sync highlight is untouched.
// A scroll gesture CLOSES it (the marker is scrolling away), then sync proceeds
// normally. It is NOT a modal: `modal={false}` → no focus trap on the page, no
// backdrop, no scroll-lock. Focus moves into the content on open and, on close,
// returns to the triggering marker — handled EXPLICITLY here (`onCloseAutoFocus`),
// not by Radix: there is no `Popover.Trigger` in the DOM for Radix to return focus
// to (markers live in dangerouslySetInnerHTML, the anchor is a virtualRef), so its
// default return lands on <body>. "View in References ↓" uses the ordinary in-page
// anchor path (a hash jump to the reference list entry) and routes its focus through
// the same explicit close-focus path so focus lands on the reference entry.

const VIEW_IN_REFS = "View in References";

interface OpenState {
  /** The activated marker element — the popover's virtual anchor. */
  marker: HTMLElement;
  /** The `#cite_note-N` target (the reference-list entry id, no leading #). */
  noteId: string;
  /** Sanitized citation text HTML pulled from the matching reference-list entry. */
  citationHtml: string;
  /** The visible reference label, e.g. "12" or "note 1" — for the dialog label. */
  label: string;
}

export function CitationLayer({
  containerRef,
}: {
  /**
   * The element scoping the rendered article HTML. The lead and the section body
   * live in SEPARATE grid columns, so a marker in the lead points at a reference
   * `<li>` rendered in the section block — therefore the layer scopes to a common
   * ancestor (the page root) when no narrower container is given. In TopicView this
   * is omitted (→ document.body); tests pass an explicit container.
   */
  containerRef?: React.RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState<OpenState | null>(null);
  // Radix anchors to a "virtual element" — we point it at the live marker node.
  const anchorRef = useRef<HTMLElement | null>(null);
  // Where focus must land when the popover closes. Radix CANNOT auto-return focus
  // to a trigger that doesn't exist (the markers live in dangerouslySetInnerHTML and
  // the anchor is a virtualRef — there is no `Popover.Trigger` in the DOM), so we
  // own close-focus explicitly via `onCloseAutoFocus`. By default (Esc / outside /
  // Close button) focus returns to the triggering marker (DEF-1, §3.3 "Esc returns
  // focus to the marker"); "View in References" overrides it to the reference <li>
  // (DEF-2, §3.3 "jumps to and focuses the matching entry"). Either way the explicit
  // focus runs INSIDE onCloseAutoFocus, after Radix's own close-focus settles, so it
  // is never clobbered.
  const closeFocusRef = useRef<HTMLElement | null>(null);
  const scope = useCallback(
    (): HTMLElement | null =>
      containerRef?.current ??
      (typeof document !== "undefined" ? document.body : null),
    [containerRef]
  );

  // Read the citation text for a marker from its reference-list <li>. The reference
  // text lives in `.mw-reference-text` inside the `<li id="cite_note-N">`; we clone
  // it so the popover shows the same links/markup (already routed by rewriteLinks/
  // externalize). Returns null if the entry isn't present (content-absent → no-op).
  const readCitation = useCallback(
    (container: HTMLElement, noteId: string): string | null => {
      const li = container.querySelector(`#${cssEscape(noteId)}`);
      if (!li) return null;
      const text = li.querySelector(".mw-reference-text, .reference-text");
      return (text ?? li).innerHTML || null;
    },
    []
  );

  useEffect(() => {
    const container = scope();
    if (!container) return;

    const activate = (e: Event, marker: HTMLElement) => {
      // The marker is an <a href="#cite_note-N"> inside <sup data-cite-marker>.
      const a = marker.closest("a[href^='#cite_note']") as HTMLAnchorElement | null;
      const href = a?.getAttribute("href") || "";
      const noteId = href.replace(/^#/, "");
      if (!noteId) return;
      const citationHtml = readCitation(container, noteId);
      if (!citationHtml) return; // no matching entry → let the browser jump normally
      e.preventDefault();
      const label = (a?.textContent || "").replace(/[[\]]/g, "").trim() || "reference";
      anchorRef.current = marker;
      setOpen({ marker, noteId, citationHtml, label });
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const marker = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-cite-marker]"
      );
      if (marker) activate(e, marker);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const marker = (e.target as HTMLElement).closest<HTMLElement>(
        "a[data-cite-marker]"
      );
      if (marker) activate(e, marker);
    };

    container.addEventListener("click", onClick);
    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("keydown", onKeyDown);
    };
  }, [scope, readCitation]);

  // A scroll gesture dismisses the popover (design §3.3): the anchor marker is
  // scrolling away, so close and let scroll-sync proceed. We DON'T move scroll.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () =>
      window.removeEventListener("scroll", close, { capture: true } as never);
  }, [open]);

  // "View in References ↓": jump to the reference list entry exactly like a normal
  // in-page anchor, then move focus to it (keyboard parity). Reuses the section
  // anchor path — no special scroll code, so scroll-sync highlights References (§3.3).
  //
  // DEF-2: we DON'T focus the <li> synchronously here — Radix's close-focus management
  // (triggered by setOpen(null)) would clobber it, resetting focus to <body>. Instead
  // we record the <li> as the close-focus target; the shared onCloseAutoFocus handler
  // focuses it AFTER the close-focus settles, so focus lands on the reference entry.
  const viewInReferences = useCallback(() => {
    if (!open) return;
    const container = scope();
    const li = container?.querySelector<HTMLElement>(`#${cssEscape(open.noteId)}`);
    if (li) {
      li.setAttribute("tabindex", "-1");
      li.scrollIntoView({ block: "center" });
      closeFocusRef.current = li; // focused in onCloseAutoFocus, not now
    }
    setOpen(null);
  }, [open, scope]);

  // The single explicit close-focus path (DEF-1 + DEF-2). Radix fires this when the
  // popover content unmounts; we suppress its built-in focus return (which would land
  // on <body>, since there is no trigger element) and focus our recorded target:
  // the reference <li> if "View in References" was used, otherwise the marker.
  const onCloseAutoFocus = useCallback((e: Event) => {
    e.preventDefault();
    const target = closeFocusRef.current ?? anchorRef.current;
    closeFocusRef.current = null;
    target?.focus();
  }, []);

  return (
    <Popover.Root
      open={!!open}
      onOpenChange={(o) => {
        if (!o) setOpen(null);
      }}
    >
      {/* Virtual anchor: positioned at the activated marker node. */}
      <Popover.Anchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
      {open && (
        <Popover.Portal>
          <Popover.Content
            role="dialog"
            aria-label={`Citation ${open.label}`}
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={16}
            // Non-modal: Radix Root default `modal` is false; reassert no scroll-lock.
            onOpenAutoFocus={(e) => {
              // Let focus move into the content (the close/“view” controls) — but
              // don't scroll the page to it (we anchored visually already).
              e.preventDefault();
              (e.currentTarget as HTMLElement)?.focus?.();
            }}
            // Own the close-focus return explicitly (DEF-1/DEF-2): Radix can't return
            // focus to a non-existent trigger, so we focus the marker (or the
            // reference <li> for "View in References") here, after its reset settles.
            onCloseAutoFocus={onCloseAutoFocus}
            className="wiki-cite-popover"
          >
            <div
              className="wiki-cite-popover-body wiki-body"
              dangerouslySetInnerHTML={{ __html: open.citationHtml }}
            />
            <div className="wiki-cite-popover-foot">
              <button
                type="button"
                onClick={viewInReferences}
                className="wiki-cite-viewrefs"
              >
                {VIEW_IN_REFS} ↓
              </button>
            </div>
            <Popover.Close aria-label="Close citation" className="wiki-cite-close">
              ×
            </Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}

// CSS.escape isn't in jsdom for older targets and ids like `cite_note-Bryant-2006_3`
// are query-safe except for a leading digit; escape defensively.
function cssEscape(id: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(id);
  }
  return id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}
