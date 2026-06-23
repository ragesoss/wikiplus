"use client";

// <MiniatureTitleInput> — the ONE real behavior in the otherwise-decorative centerpiece
// (docs/design/about-page.md §3; AC9–AC12, AC16). The miniature's article title is a real, editable
// text input that LOOKS EXACTLY like the static serif article title (AC10), and on Enter navigates
// to the corresponding Topic page via the app's existing navigation primitive.
//
// It reuses ONLY `topicHref` + `router.push` (NOT the TopicSearch combobox/typeahead/listbox — the
// header's own TopicSearch already provides full search on this page). The empty/whitespace guard is
// the SAME `value.trim()` no-op the TopicSearch navigateTo uses (AC12).
//
// A11y (§3.6): the visible title is ALSO the field's value, so it can't serve as the label — the
// control carries a programmatic sr-only <label> name + an sr-only aria-describedby helper. The
// input + label + helper are rendered together OUTSIDE any aria-hidden subtree (the decorative
// miniature siblings are individually aria-hidden — §4.3), so a screen-reader user meets exactly
// one meaningful control on the centerpiece.

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { topicHref } from "@/lib/wiki/topicRoute";
import { DEFAULT_TITLE, TITLE_INPUT_HELP, TITLE_INPUT_LABEL } from "./copy";

// `seedTitle` is the dynamic miniature title (AC16–AC18): the value chosen for the current power-on
// (the recently-curated pick, or the fallback). It SEEDS the editable field — it sets the initial /
// reseeded value but does NOT lock the input. On a fresh power-on the parent passes a new seed and
// the field reseeds to it; a user's own edit is NEVER clobbered (we reseed only while the field is
// untouched since the last seed — AC18). Defaults to the fallback so the input renders the same
// whether or not a pool is wired.
export function MiniatureTitleInput({
  seedTitle = DEFAULT_TITLE,
}: {
  seedTitle?: string;
}) {
  const router = useRouter();
  const rawId = useId();
  const inputId = `about-title-${rawId}`;
  const helpId = `about-title-help-${rawId}`;
  const [value, setValue] = useState(seedTitle);
  // Has the user edited since the last seed? While false, a new `seedTitle` (a fresh power-on's pick,
  // incl. the §5.3 old→new swap) reseeds the field; once true we leave the user's text alone until
  // the next seed change resets it (AC18 — the pick sets the INITIAL value only).
  const edited = useRef(false);
  const lastSeed = useRef(seedTitle);

  useEffect(() => {
    if (seedTitle === lastSeed.current) return;
    lastSeed.current = seedTitle;
    // A new power-on seed clears the user-edit guard and reseeds the displayed value.
    edited.current = false;
    setValue(seedTitle);
  }, [seedTitle]);

  function navigate() {
    const t = value.trim();
    if (!t) return; // AC12 — empty / whitespace-only Enter is a graceful no-op.
    // Raw title → topicHref (titleToSlug encodes; no hand-encoding — AC11).
    router.push(topicHref(t));
  }

  // No visible submit / search chrome — Enter is the only trigger. A <form role="search"> centralizes
  // the navigate so the on-screen keyboard's "Go" submits on touch too; it has NO visible submit
  // control and NO search affordance, so it still reads as the serif title (§3.1).
  return (
    <form
      role="search"
      className="about-title-block border-b border-wikirule pb-[9px]"
      onSubmit={(e) => {
        e.preventDefault(); // AC11 — prevent the default submit/reload; navigate via router.push.
        navigate();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {TITLE_INPUT_LABEL}
      </label>
      <input
        id={inputId}
        // A text input, NOT type="search" (no browser clear-✕ / search affordances — §3.1).
        type="text"
        value={value}
        onChange={(e) => {
          edited.current = true;
          setValue(e.target.value);
        }}
        aria-describedby={helpId}
        autoComplete="off"
        spellCheck={false}
        // .about-title-input (globals.css §3): transparent/borderless serif at rest; hover dotted
        // hint; the focus-visible brand ring lives on .about-title-block. .projector-serif = Georgia.
        className="about-title-input projector-serif text-[28px] font-normal leading-[1.12]"
      />
      <span id={helpId} className="sr-only">
        {TITLE_INPUT_HELP}
      </span>
    </form>
  );
}
