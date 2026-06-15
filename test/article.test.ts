import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchFullArticle,
  qidToTitle,
  slugify,
  titleToQid,
} from "@/lib/wiki/article";

// AC3 (full sections + stable slugs), AC5 (internal wikilink rewrite + fallback),
// and the SECURITY review of the DOMPurify allowlist on Wikipedia HTML injected via
// dangerouslySetInnerHTML. The live MediaWiki fetch is MOCKED (no network egress).

function mockArticleHtml(body: string): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(`<html><body>${body}</body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    })
  );
}

afterEach(() => vi.restoreAllMocks());

describe("slugify (AC3 — stable anchor slugs)", () => {
  it("produces kebab-case slugs stripped of punctuation", () => {
    expect(slugify("Light-dependent reactions")).toBe("light-dependent-reactions");
    expect(slugify("  Calvin cycle  ")).toBe("calvin-cycle");
    expect(slugify("Order & kinetics")).toBe("order-kinetics");
  });
});

describe("fetchFullArticle — section structure (AC3)", () => {
  it("splits the lead (before the first h2) from the sections", async () => {
    mockArticleHtml(`
      <section><p>Lead paragraph one.</p><p>Lead two.</p></section>
      <section><h2 id="x">Light-dependent reactions</h2><p>Body A.</p></section>
      <section><h2>Calvin cycle</h2><p>Body B.</p></section>
    `);
    const a = await fetchFullArticle("Photosynthesis");
    expect(a.lead.leadHtml).toContain("Lead paragraph one.");
    expect(a.lead.leadHtml).not.toContain("Body A.");
    expect(a.sections.map((s) => s.slug)).toEqual([
      "light-dependent-reactions",
      "calvin-cycle",
    ]);
    expect(a.sections[0].title).toBe("Light-dependent reactions");
    expect(a.sections[0].html).toContain("Body A.");
    expect(a.sections[0].level).toBe(2);
  });

  it("derives a stable slug per heading and dedupes collisions", async () => {
    mockArticleHtml(`
      <section><h2>History</h2><p>One.</p></section>
      <section><h2>History</h2><p>Two.</p></section>
    `);
    const a = await fetchFullArticle("X");
    expect(a.sections.map((s) => s.slug)).toEqual(["history", "history-2"]);
  });

  it("KEEPS navigational/tail sections as real sections (article-fidelity #27 D1)", async () => {
    // Flipped from the v1 deferral: References / See also / etc. now come through the
    // section walk as ordinary entries (slug + heading + TOC row). See article-fidelity.test.ts.
    mockArticleHtml(`
      <section><h2>Overview</h2><p>Keep me.</p></section>
      <section><h2>References</h2><p>Now kept.</p></section>
      <section><h2>See also</h2><p>Also kept.</p></section>
    `);
    const a = await fetchFullArticle("X");
    expect(a.sections.map((s) => s.title)).toEqual([
      "Overview",
      "References",
      "See also",
    ]);
  });

  it("builds the canonical en.wikipedia source URL (AC4 attribution target)", async () => {
    mockArticleHtml(`<section><p>Lead.</p></section>`);
    const a = await fetchFullArticle("Photosynthesis");
    expect(a.url).toBe("https://en.wikipedia.org/wiki/Photosynthesis");
  });

  it("throws on a non-OK response (drives the error state, design §7.2)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 404 })
    );
    await expect(fetchFullArticle("X")).rejects.toThrow(/404/);
  });
});

describe("wikilink rewriting (AC5)", () => {
  it("rewrites ordinary article links to the canonical title-based /topic/<Title>/ route", async () => {
    mockArticleHtml(
      `<section><p><a href="./Chlorophyll">chlorophyll</a></p></section>`
    );
    const a = await fetchFullArticle("Photosynthesis");
    // Canonical title route (owner directive D1): /topic/<Title>/ — trailing slash so a
    // hard navigation resolves under the static-export basePath. NO QID in the href.
    expect(a.lead.leadHtml).toContain('href="/topic/Chlorophyll/"');
    expect(a.lead.leadHtml).not.toMatch(/qid=/);
    // the decoded title is stashed so the client router can route without a reload
    expect(a.lead.leadHtml).toContain('data-topic-title="Chlorophyll"');
    // internal links must NOT open in a new tab / carry rel
    expect(a.lead.leadHtml).not.toContain('target="_blank"');
  });

  it("rewrites absolute en.wikipedia article links to internal title routes", async () => {
    mockArticleHtml(
      `<section><p><a href="https://en.wikipedia.org/wiki/Calvin_cycle">cc</a></p></section>`
    );
    const a = await fetchFullArticle("X");
    expect(a.lead.leadHtml).toContain('href="/topic/Calvin_cycle/"');
  });

  it("does NOT route namespaced (File:/Help:/Category:) links internally", async () => {
    mockArticleHtml(
      `<section><p><a href="./File:Leaf.jpg">img</a> <a href="./Help:Contents">h</a></p></section>`
    );
    const a = await fetchFullArticle("X");
    expect(a.lead.leadHtml).not.toContain("/topic/File");
    expect(a.lead.leadHtml).not.toContain("/topic/Help");
    // kept as absolute Wikipedia links opening in a new tab with rel=noopener
    expect(a.lead.leadHtml).toContain('target="_blank"');
    expect(a.lead.leadHtml).toContain('rel="noopener"');
  });

  it("externalizes red links rather than producing broken /topic routes", async () => {
    mockArticleHtml(
      `<section><p><a class="new" href="./Nonexistent_thing">red</a></p></section>`
    );
    const a = await fetchFullArticle("X");
    expect(a.lead.leadHtml).not.toContain("/topic/Nonexistent_thing");
    expect(a.lead.leadHtml).toContain('target="_blank"');
  });

  it("KEEPS cite/backref in-page anchors functional (article-fidelity #24 A4/A6)", async () => {
    // Flipped: the marker↔reference round-trip is the whole point — `#cite_note-*` /
    // `#cite_ref-*` anchors are no longer de-linked. (Other bare `#` anchors still are.)
    mockArticleHtml(
      `<section><p>text<sup class="reference"><a href="./X#cite_note-1">[1]</a></sup>` +
        ` <a href="#section-jump">jump</a></p></section>`
    );
    const a = await fetchFullArticle("X");
    expect(a.lead.leadHtml).toContain('href="#cite_note-1"'); // normalized + kept
    expect(a.lead.leadHtml).toContain("[1]");
    expect(a.lead.leadHtml).not.toContain("#section-jump"); // non-cite anchor de-linked
  });
});

// ───────────────────────── SECURITY: XSS hunt ─────────────────────────
// The article HTML is injected with dangerouslySetInnerHTML. DOMPurify must strip
// every script-execution vector. Each test asserts the dangerous artifact is gone.
describe("DOMPurify allowlist — XSS vectors (SECURITY)", () => {
  async function sanitizedAll(body: string): Promise<string> {
    mockArticleHtml(body);
    const a = await fetchFullArticle("X");
    return a.lead.leadHtml + a.sections.map((s) => s.html).join("\n");
  }

  it("strips <script> tags", async () => {
    const out = await sanitizedAll(
      `<section><p>hi</p><script>window.__pwned=1</script></section>`
    );
    expect(out).not.toContain("__pwned");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("strips inline event-handler attributes (onerror/onclick/onload)", async () => {
    const out = await sanitizedAll(
      `<section><p>hi</p><img src="x" onerror="window.__x=1"><div onclick="evil()">z</div></section>`
    );
    expect(out).not.toMatch(/onerror=/i);
    expect(out).not.toMatch(/onclick=/i);
  });

  it("strips javascript: URIs on links", async () => {
    const out = await sanitizedAll(
      `<section><p><a href="javascript:alert(1)">x</a></p></section>`
    );
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("strips data:text/html and javascript:/vbscript: on <a href> (no exec/exfil)", async () => {
    const out = await sanitizedAll(
      `<section><p>` +
        `<a href="data:text/html,<script>alert(1)</script>">x</a>` +
        `<a href="javascript:alert(1)">j</a>` +
        `<a href="vbscript:msgbox(1)">v</a>` +
        `</p></section>`
    );
    expect(out.toLowerCase()).not.toContain("data:text/html");
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out.toLowerCase()).not.toContain("vbscript:");
  });

  it("strips data: URIs on srcset (no inert-SVG smuggling via srcset)", async () => {
    const out = await sanitizedAll(
      `<section><p><img srcset="data:image/svg+xml,<svg onload=alert(1)> 1x"></p></section>`
    );
    expect(out).not.toContain("data:image/svg");
  });

  // KNOWN BEHAVIOR (QA finding N2 — NOT a script-exec vector, documented for the
  // record): DOMPurify permits `data:image/...` on <img src> by default, and the
  // custom ALLOWED_URI_REGEXP does NOT override that. An <img>-loaded SVG runs in
  // the browser's restricted (script-disabled) image mode, so an embedded onload
  // does NOT execute — this is inert, not XSS. We assert it stays an <img src=>
  // (no event-handler attribute promoted out of the data URI).
  it("does not promote an <img src=data:image/svg> into a live event handler (inert)", async () => {
    const out = await sanitizedAll(
      `<section><p><img src="data:image/svg+xml,<svg onload=alert(1)>"></p></section>`
    );
    // The string "onload=" survives only INSIDE the src attribute value (inert),
    // never as a real attribute on the <img> element. Parse it back and check.
    const doc = new DOMParser().parseFromString(out, "text/html");
    const img = doc.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.hasAttribute("onload")).toBe(false);
    expect(img!.getAttributeNames()).not.toContain("onload");
  });

  it("strips <iframe>/<object>/<embed>/<form> tags (embed-never-host on article side)", async () => {
    const out = await sanitizedAll(
      `<section><p>hi</p><iframe src="https://evil.test"></iframe>` +
        `<object data="x"></object><embed src="x"><form action="x"></form></section>`
    );
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out.toLowerCase()).not.toContain("<object");
    expect(out.toLowerCase()).not.toContain("<embed");
    expect(out.toLowerCase()).not.toContain("<form");
  });

  it("strips <svg>/<math> (SVG/MathML script & foreignObject vectors)", async () => {
    const out = await sanitizedAll(
      `<section><p>hi</p><svg><script>alert(1)</script></svg>` +
        `<math><mtext><script>alert(1)</script></mtext></math></section>`
    );
    expect(out.toLowerCase()).not.toContain("<svg");
    expect(out.toLowerCase()).not.toContain("<math");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("drops <style> tags (no CSS injection / data exfil via @import)", async () => {
    const out = await sanitizedAll(
      `<section><p>hi</p><style>@import url(https://evil.test)</style></section>`
    );
    expect(out.toLowerCase()).not.toContain("<style");
    expect(out).not.toContain("evil.test");
  });

  it("does not allow a style attribute (inline style injection)", async () => {
    const out = await sanitizedAll(
      `<section><p style="background:url(javascript:alert(1))">hi</p></section>`
    );
    expect(out).not.toMatch(/style=/i);
  });

  it("upgrades protocol-relative image src to https (no mixed-content downgrade)", async () => {
    const out = await sanitizedAll(
      `<section><p><img src="//upload.wikimedia.org/x.jpg"></p></section>`
    );
    expect(out).toContain('src="https://upload.wikimedia.org/x.jpg"');
  });
});

describe("qidToTitle (AC20 — QID→title resolution path)", () => {
  it("returns the enwiki sitelink title for a QID", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          entities: { Q11982: { sitelinks: { enwiki: { title: "Photosynthesis" } } } },
        }),
        { status: 200 }
      )
    );
    expect(await qidToTitle("Q11982")).toBe("Photosynthesis");
  });

  it("returns null when no enwiki sitelink exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ entities: { Q1: { sitelinks: {} } } }), {
        status: 200,
      })
    );
    expect(await qidToTitle("Q1")).toBeNull();
  });
});

describe("titleToQid (AC5/AC23 — title→QID under the hood for the canonical route)", () => {
  it("returns the wikibase_item QID for a title via pageprops", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: { "1": { pageprops: { wikibase_item: "Q11982" } } },
          },
        }),
        { status: 200 }
      )
    );
    expect(await titleToQid("Photosynthesis")).toBe("Q11982");
  });

  it("returns null when the page has no Wikidata item", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ query: { pages: { "1": {} } } }), {
        status: 200,
      })
    );
    expect(await titleToQid("Some red article")).toBeNull();
  });
});
