"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Shared dialog behavior (design §11.4 / AC21): role=dialog aria-modal, focus
// trap, Esc + backdrop close, focus returned to the trigger on close.
export function ModalShell({
  onClose,
  labelledBy,
  ariaLabel,
  className = "",
  initialFocusSelector,
  children,
  dark = false,
}: {
  onClose: () => void;
  labelledBy?: string;
  ariaLabel?: string;
  className?: string;
  /** Selector (within the dialog) to focus on open; defaults to first focusable. */
  initialFocusSelector?: string;
  children: ReactNode;
  /** Player modal sits on a near-black overlay; form modals on a dimmer one. */
  dark?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const prevActive = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const initial = initialFocusSelector
      ? dialog.querySelector<HTMLElement>(initialFocusSelector)
      : null;
    (initial ?? focusables()[0] ?? dialog).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [onClose, initialFocusSelector]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        dark ? "bg-black/80" : "bg-black/60"
      }`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={className}
      >
        {children}
      </div>
    </div>
  );
}
