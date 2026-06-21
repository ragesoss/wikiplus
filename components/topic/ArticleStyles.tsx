"use client";

import { useEffect, useRef } from "react";

// Mounts the article's reused, scoped TemplateStyles (`scopeArticleCss` output) into the
// `.wiki-body` article subtree so faithful clade/`.tmulti`/long-tail-table layout renders
// — see docs/ARCHITECTURE.md "TemplateStyles reuse mechanism" (#105).
//
// X4 GATE — application MUST be via `textContent`, never `dangerouslySetInnerHTML`.
// The scoped CSS is produced by a tolerant parser, so a crafted block can leave a literal
// `</style><script>…` substring in the string. Setting it as an element's `textContent`
// means the HTML parser never re-parses it as markup — the embedded `</style>` is inert
// text inside the stylesheet. Writing the same string as `<style>…</style>` HTML
// (innerHTML / dangerouslySetInnerHTML) would let the parser honor the embedded close tag
// and execute the following script. Do not change the application mechanism here.
//
// Empty `styleCss` (an article with no styled content) mounts NOTHING — no `<style>`
// artifact, no layout shift (design §8 "No-styled-content article", AC11).

/**
 * Render an inert host that creates ONE `<style>` element inside the `.wiki-body` article
 * subtree and sets its `textContent` to the scoped article CSS. The host renders no
 * visible box; it exists only as the in-`.wiki-body` mount point so the `.wiki-body `
 * scope prefix on every reused rule resolves correctly.
 */
export function ArticleStyles({ styleCss }: { styleCss: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!styleCss) return; // no styled content → mount nothing
    const styleEl = host.ownerDocument.createElement("style");
    // textContent — the X4 application gate. NEVER innerHTML / dangerouslySetInnerHTML.
    styleEl.textContent = styleCss;
    host.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [styleCss]);

  return <div ref={hostRef} hidden aria-hidden="true" />;
}
