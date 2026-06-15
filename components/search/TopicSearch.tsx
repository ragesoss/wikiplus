"use client";

// TopicSearch — the navbar topic search (#12). ONE reusable client component placed
// on both hosts (home header + topic header); its chrome adapts per `variant` but the
// markup, roles, keyboard model, and behavior are identical (Decision 1, design §Framing).
//
// Contract (docs/specs/navbar-topic-search.md Decisions 1–4 + AC1–AC13;
// docs/design/navbar-topic-search.md states S0–S8, microcopy, the APG combobox+listbox
// a11y model and keyboard table):
//   - Debounced (~200ms) client fetch of Wikipedia typeahead suggestions (lib/wiki/suggest.ts),
//     abort-on-change, SILENT degrade to the no-results hint on error (never an error UI).
//   - On select (a suggestion) or submit (raw typed text), router.push(topicHref(<title>)) —
//     the RAW title, never hand-encoded (AC3 via titleToSlug). Empty/whitespace = no-op (AC8).
//   - No write, no /contribute, no QID in the URL (AC5/AC6) — it is a pure navigation.
//   - APG editable-combobox controlling a listbox popup via aria-activedescendant (AC11/AC13).

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { topicHref } from "@/lib/wiki/topicRoute";
import {
  fetchTopicSuggestions,
  type TopicSuggestion,
} from "@/lib/wiki/suggest";

// ── Verbatim microcopy (design §Microcopy — use EXACTLY). ─────────────────────
const PLACEHOLDER = "Search any Wikipedia topic…";
const LABEL_HOME = "Find a topic";
const LABEL_SR = "Search Wikipedia topics";
const SUBMIT_NAME = "Search";
const DISCLOSURE_OPEN_NAME = "Search topics";
const DISCLOSURE_CLOSE_NAME = "Close search";
/** No-results hint row + live-region copy. `{q}` = the trimmed typed text. */
const noMatchHint = (q: string) => `No matching articles — press Enter to open “${q}”`;
const noMatchLive = (q: string) =>
  `No matching articles. Press Enter to open “${q}”.`;
const countLive = (n: number) => `${n} suggestions available`;

const DEBOUNCE_MS = 200;
const MAX_SUGGESTIONS = 7;

export type TopicSearchVariant = "home" | "topic-inline" | "topic-disclosure";

interface TopicSearchProps {
  /** Host treatment (design §Placement). Default "home" (the must-ship full-width floor). */
  variant?: TopicSearchVariant;
}

// Magnifier glyph (decorative; the control always also carries an accessible name).
function MagnifierIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      width="18"
      height="18"
    >
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
      <line
        x1="13.5"
        y1="13.5"
        x2="18"
        y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TopicSearch({ variant = "home" }: TopicSearchProps) {
  const router = useRouter();

  // Stable, instance-unique ids so two TopicSearch instances (home + topic) never
  // collide on listbox / option / label ids (AC13 wiring; multiple-instance safety).
  const rawId = useId();
  const inputId = `topic-search-input-${rawId}`;
  const listboxId = `topic-search-listbox-${rawId}`;
  const labelId = `topic-search-label-${rawId}`;
  const optionId = (i: number) => `${rawId}-opt-${i}`;

  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  // `resolvedFor` = the trimmed query the current `suggestions` correspond to. Used to
  // show the no-results hint ONLY once a fetch has resolved for the current text (S4),
  // not during the in-flight gap (S2). null = no fetch has resolved for the value yet.
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // S2 decorative busy affordance (aria-hidden)
  const [open, setOpen] = useState(false); // listbox visibility (focused + value + content)
  const [activeIndex, setActiveIndex] = useState(-1); // active option (aria-activedescendant)
  // Topic-header `< md` disclosure: collapsed until the trigger is activated.
  const [expanded, setExpanded] = useState(false);
  const [live, setLive] = useState(""); // polite sr-only announcement (one region)

  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = value.trim();
  const isDisclosure = variant === "topic-disclosure";

  // S4 hint shows when a fetch has resolved for the *current* trimmed text and there
  // are zero matches (Decision 4 / silent degrade collapses error → S4, same row).
  const showHint = trimmed.length > 0 && resolvedFor === trimmed && suggestions.length === 0;
  const hasOptions = suggestions.length > 0;
  // Listbox is open when focused, value non-empty, and there is something to show.
  const listOpen = open && trimmed.length > 0 && (hasOptions || showHint);

  // ── Debounced + aborted suggestion fetch (AC10). ────────────────────────────
  useEffect(() => {
    // Cancel any pending debounce + in-flight request whenever the value changes.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!trimmed) {
      setSuggestions([]);
      setResolvedFor(null);
      setBusy(false);
      setActiveIndex(-1);
      return;
    }

    setBusy(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      void fetchTopicSuggestions(trimmed, {
        signal: controller.signal,
        limit: MAX_SUGGESTIONS,
      }).then((results) => {
        // Ignore a resolution from a request that has since been superseded/aborted.
        if (controller.signal.aborted) return;
        const list = results.slice(0, MAX_SUGGESTIONS);
        setSuggestions(list);
        setResolvedFor(trimmed);
        setActiveIndex(-1);
        setBusy(false);
        // Polite announcement on resolve (never during the in-flight gap; never an error).
        setLive(list.length > 0 ? countLive(list.length) : noMatchLive(trimmed));
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  // Abort any in-flight request on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Navigation (the only side effect of select/submit). ─────────────────────
  // Pure navigation: router.push(topicHref(raw title)). No write, no /contribute, no
  // QID — TopicView resolves title→QID under the hood (AC5/AC6). Empty trims to no-op.
  const navigateTo = useCallback(
    (title: string) => {
      const t = title.trim();
      if (!t) return; // AC8 — empty/whitespace submit is a graceful no-op.
      setOpen(false);
      setActiveIndex(-1);
      router.push(topicHref(t)); // raw title; titleToSlug encodes (AC3). No hand-encode.
    },
    [router]
  );

  const selectOption = useCallback(
    (i: number) => {
      const s = suggestions[i];
      if (!s) return;
      setValue(s.title);
      navigateTo(s.title);
    },
    [suggestions, navigateTo]
  );

  // ── Keyboard model (design §Keyboard interactions — binding). ───────────────
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        if (!listOpen) {
          // Closed but results exist → re-open and activate the first option.
          if (hasOptions) {
            setOpen(true);
            setActiveIndex(0);
          }
          return;
        }
        if (!hasOptions) return; // hint row is not arrow-focusable
        setActiveIndex((i) => (i + 1 >= suggestions.length ? i : i + 1)); // stop at end
        return;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (!listOpen || !hasOptions) return;
        setActiveIndex((i) => (i <= 0 ? 0 : i - 1)); // stop at start
        return;
      }
      case "Enter": {
        // An option is active → select it; otherwise submit the raw typed text.
        if (listOpen && hasOptions && activeIndex >= 0) {
          e.preventDefault();
          selectOption(activeIndex);
        } else {
          e.preventDefault();
          navigateTo(value); // AC1/AC7/AC9; empty → no-op (AC8)
        }
        return;
      }
      case "Escape": {
        if (listOpen) {
          // Close the listbox, keep the typed value + focus in the input.
          e.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        } else if (isDisclosure && expanded) {
          // Collapse the disclosure and return focus to the trigger.
          e.preventDefault();
          collapse();
        }
        return;
      }
      case "Tab": {
        // Move on; close the listbox (do not select).
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      default:
        return;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateTo(value); // search-action submit path (AC1); empty → no-op (AC8)
  }

  function onFocus() {
    if (trimmed.length > 0 && (hasOptions || showHint)) setOpen(true);
  }

  // Close on outside click / blur (Flow-preserving — does not navigate).
  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  // Disclosure (topic-header < md): expand moves focus into the input; collapse
  // returns focus to the trigger (design §Placement Host 2 / focus management).
  function expand() {
    setExpanded(true);
  }
  function collapse() {
    setExpanded(false);
    setOpen(false);
    setActiveIndex(-1);
    // Return focus to the trigger after it re-renders.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }
  useEffect(() => {
    if (isDisclosure && expanded) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isDisclosure, expanded]);

  const activeDescendant =
    listOpen && hasOptions && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  // ── Per-variant chrome (markup/roles/behavior identical; classes differ). ────
  const showVisibleLabel = variant === "home";
  const inputSize =
    variant === "home"
      ? "h-11 text-base"
      : "h-9 text-sm"; // topic inline + disclosure compact

  // The combobox + listbox markup, shared by every variant.
  const field = (
    <form
      role="search"
      aria-label={LABEL_SR}
      onSubmit={onSubmit}
      className={variant === "home" ? "w-full" : "w-full max-w-[280px]"}
    >
      {showVisibleLabel ? (
        <label
          id={labelId}
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-ink2"
        >
          {LABEL_HOME}
        </label>
      ) : (
        // Topic header: no visible label (saves space) — programmatic name via aria-label.
        <span id={labelId} className="sr-only">
          {LABEL_SR}
        </span>
      )}

      <div className="relative">
        <div className="flex items-stretch border-2 border-ink bg-white">
          <span
            aria-hidden="true"
            className="flex items-center pl-2.5 text-action"
          >
            <MagnifierIcon />
          </span>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            role="combobox"
            // Accessible name: visible <label for> (home) or aria-label (topic header).
            aria-label={showVisibleLabel ? undefined : LABEL_SR}
            aria-labelledby={showVisibleLabel ? labelId : undefined}
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            autoComplete="off"
            placeholder={PLACEHOLDER}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            className={`min-w-0 flex-1 bg-transparent px-2 ${inputSize} text-ink placeholder:text-muted focus:outline-none`}
          />
          {/* S2 decorative busy affordance — never an error; aria-hidden. */}
          {busy && (
            <span
              aria-hidden="true"
              data-testid="topic-search-busy"
              className="flex items-center pr-1 text-muted"
            >
              <span className="inline-flex gap-0.5">
                <span className="h-1 w-1 animate-pulse rounded-full bg-muted" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
              </span>
            </span>
          )}
          <button
            type="submit"
            aria-label={SUBMIT_NAME}
            className="flex items-center border-l-2 border-ink px-2.5 text-action hover:bg-bg2"
          >
            <MagnifierIcon />
          </button>
        </div>

        {/* Listbox popup — rendered only when open (design §Component anatomy). */}
        {listOpen && (
          <ul
            role="listbox"
            id={listboxId}
            aria-label="Article suggestions"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[60vh] overflow-auto border-2 border-ink bg-white shadow-[4px_4px_0_var(--color-ink)]"
          >
            {hasOptions
              ? suggestions.map((s, i) => {
                  const active = i === activeIndex;
                  return (
                    <li
                      key={`${s.title}-${i}`}
                      role="option"
                      id={optionId(i)}
                      aria-selected={active}
                      // Mouse: hover sets active; click selects (Flow 1). pointerdown so
                      // it fires before the input's blur closes the listbox.
                      onMouseEnter={() => setActiveIndex(i)}
                      onPointerDown={(e) => {
                        e.preventDefault(); // keep focus in the input
                        selectOption(i);
                      }}
                      className={`cursor-pointer border-l-[3px] px-3 py-2 ${
                        active
                          ? "border-brand bg-[#EEF0FB]"
                          : "border-transparent"
                      }`}
                    >
                      <span
                        className={`block text-sm text-ink ${active ? "font-semibold" : ""}`}
                      >
                        {s.title}
                      </span>
                      {s.description && (
                        <span className="block text-xs text-ink2">
                          {s.description}
                        </span>
                      )}
                    </li>
                  );
                })
              : (
                // S4/S5 non-interactive hint row — NOT a role="option" (arrows skip it,
                // a screen reader does not offer it as a choice). Non-blocking (AC7).
                <li
                  role="presentation"
                  data-testid="topic-search-no-results"
                  className="px-3 py-2 text-sm text-ink2"
                >
                  {noMatchHint(trimmed)}
                </li>
              )}
          </ul>
        )}
      </div>

      {/* One polite, sr-only live region for count / no-results announcements. */}
      <div role="status" aria-live="polite" className="sr-only">
        {live}
      </div>
    </form>
  );

  // Home + topic-inline render the field directly. Topic-disclosure wraps it behind
  // a labeled magnifier trigger that reveals the SAME field (Decision 1 degrade).
  if (!isDisclosure) {
    return (
      <div ref={rootRef} className={variant === "home" ? "w-full" : ""}>
        {field}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex items-center">
      {!expanded ? (
        <button
          ref={triggerRef}
          type="button"
          aria-label={DISCLOSURE_OPEN_NAME}
          aria-expanded={false}
          aria-controls={listboxId}
          onClick={expand}
          className="flex h-11 w-11 items-center justify-center text-action"
        >
          <MagnifierIcon />
        </button>
      ) : (
        <div className="flex w-full items-center gap-1">
          {field}
          <button
            type="button"
            aria-label={DISCLOSURE_CLOSE_NAME}
            onClick={collapse}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-ink"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ✕
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
