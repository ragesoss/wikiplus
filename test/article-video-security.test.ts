import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFullArticle } from "@/lib/wiki/article";

// ─────────────────────────────────────────────────────────────────────────────
// INDEPENDENT QA — adversarial security probes for article-embedded native media
// (docs/specs/article-video.md AC5). Written by the QA/Review role (NOT the author)
// to attack the newly-allowed <video>/<audio>/<source>/<track> tags + attrs and the
// extended `uponSanitizeAttribute` force-keep hook in lib/wiki/article.ts.
//
// The article HTML is injected via dangerouslySetInnerHTML, so the DOMPurify allowlist
// is the XSS boundary. These complement the author's tests in test/article.test.ts;
// they focus on the vectors the author's suite did NOT cover:
//   - data: URIs on media src (the DOMPurify DATA_URI_TAGS exemption) — inert vs. exec.
//   - `poster` with javascript:/data: (poster is NOT a data-uri src attr).
//   - the force-keep hook cannot be tricked into keeping a URL/handler attr, and a
//     force-kept inert attr's value cannot break out of attribute serialization.
//   - case/uppercase tricks on the tag and on on*/autoplay.
//   - <audio>/<track> parity with <video> for on*/autoplay stripping.
//   - X4 (script/iframe/style/inline-style) still holds inside the media path.
// The live MediaWiki fetch is MOCKED (no network egress).
// ─────────────────────────────────────────────────────────────────────────────

function mockArticleHtml(body: string): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(`<html><body>${body}</body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    })
  );
}
afterEach(() => vi.restoreAllMocks());

async function sanitize(body: string): Promise<string> {
  mockArticleHtml(body);
  const a = await fetchFullArticle("X");
  return a.lead.leadHtml + a.sections.map((s) => s.html).join("\n");
}
const parse = (out: string): Document =>
  new DOMParser().parseFromString(out, "text/html");

describe("article-video SECURITY — force-keep hook cannot be abused", () => {
  it("does NOT force-keep a URL-bearing attr (poster/src) — those stay URI-validated", async () => {
    // The hook only force-keeps INERT enumerated attrs. javascript: on poster/src must
    // still be dropped by _isValidAttribute (the hook must not shield it).
    const out = await sanitize(
      `<section><figure typeof="mw:File/Thumb"><span>` +
        `<video controls poster="javascript:alert(1)">` +
        `<source src="javascript:alert(2)" type="video/webm"/>` +
        `</video></span></figure></section>`
    );
    expect(out.toLowerCase()).not.toContain("javascript:");
    const video = parse(out).querySelector("video")!;
    expect(video.hasAttribute("poster")).toBe(false); // javascript: poster dropped
  });

  it("drops a data: poster (poster is NOT a DATA_URI_TAGS src attribute — stricter than src)", async () => {
    const out = await sanitize(
      `<section><figure typeof="mw:File/Thumb"><span>` +
        `<video controls poster="data:image/svg+xml,<svg onload=alert(1)>">` +
        `<source src="//upload.wikimedia.org/x.webm" type="video/webm"/>` +
        `</video></span></figure></section>`
    );
    const video = parse(out).querySelector("video")!;
    expect(video.hasAttribute("poster")).toBe(false);
    expect(out.toLowerCase()).not.toContain("data:image/svg");
  });

  it("a force-kept inert media attr (label/type/kind) cannot break out of attribute serialization", async () => {
    // `label` is force-kept on media tags WITHOUT value validation (forceKeepAttr bypasses
    // _isValidAttribute). Prove a hostile value stays an inert, entity-encoded attribute
    // value — it can neither inject an element nor a live handler.
    const out = await sanitize(
      `<section><figure typeof="mw:File/Thumb"><span><video controls>` +
        `<track kind="subtitles" srclang="en" label='&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'/>` +
        `<source type='video/webm"&gt;&lt;script&gt;alert(2)&lt;/script&gt;' src="//upload.wikimedia.org/x.webm"/>` +
        `</video></span></figure></section>`
    );
    const doc = parse(out);
    expect(doc.querySelectorAll("script").length).toBe(0); // no injected <script>
    expect(doc.querySelectorAll("img").length).toBe(0); // no injected <img> via label break-out
    const track = doc.querySelector("track");
    if (track) expect(track.hasAttribute("onerror")).toBe(false);
  });

  it("no on* handler is promoted onto video/audio/source/track (case-insensitive)", async () => {
    const doc = parse(
      await sanitize(
        `<section><figure typeof="mw:File/Thumb"><span>` +
          `<VIDEO controls ONERROR="alert(1)" onLoadStart="alert(2)">` +
          `<SOURCE src="//upload.wikimedia.org/x.webm" type="video/webm" onerror="alert(3)"/>` +
          `<TRACK kind="subtitles" srclang="en" onload="alert(4)"/>` +
          `</VIDEO></span></figure></section>`
      )
    );
    const video = doc.querySelector("video");
    expect(video).not.toBeNull(); // tag survives uppercase
    for (const el of Array.from(doc.querySelectorAll("video, source, track"))) {
      for (const name of el.getAttributeNames()) {
        expect(name.startsWith("on")).toBe(false); // no event handler survives
      }
    }
  });

  it("autoplay never survives — not lowercase, not uppercase, not autoplay='autoplay'", async () => {
    const doc = parse(
      await sanitize(
        `<section><figure typeof="mw:File/Thumb"><span>` +
          `<video controls autoplay AUTOPLAY="autoplay" preload="none">` +
          `<source src="//upload.wikimedia.org/x.webm" type="video/webm"/>` +
          `</video>` +
          `<audio controls autoplay><source src="//upload.wikimedia.org/x.oga" type="audio/ogg"/></audio>` +
          `</span></figure></section>`
      )
    );
    expect(doc.querySelector("video")!.hasAttribute("autoplay")).toBe(false);
    expect(doc.querySelector("audio")!.hasAttribute("autoplay")).toBe(false);
  });

  it("<audio> gets the same treatment as <video> (allowed tag, on*/autoplay stripped)", async () => {
    const doc = parse(
      await sanitize(
        `<section><figure typeof="mw:File/Thumb"><span>` +
          `<audio controls preload="none" onplay="alert(1)">` +
          `<source src="//upload.wikimedia.org/x.oga" type="audio/ogg"/>` +
          `</audio></span></figure></section>`
      )
    );
    const audio = doc.querySelector("audio")!;
    expect(audio).not.toBeNull();
    expect(audio.hasAttribute("preload")).toBe(true);
    expect(audio.hasAttribute("onplay")).toBe(false);
    expect(
      (doc.querySelector("audio source")!.getAttribute("src") || "").startsWith(
        "https://"
      )
    ).toBe(true);
  });
});

describe("article-video SECURITY — data: on media src is RETAINED but INERT", () => {
  // DOCUMENTED KNOWN BEHAVIOR (parallels the existing <img src=data:> N2 finding):
  // DOMPurify's DATA_URI_TAGS default set includes video/audio/source/track/img, so a
  // `data:` value on their `src` is KEPT (NOT dropped). This is NOT a script-exec vector:
  // a <source>/<video>/<audio> src is decoded by the media pipeline (never parsed as
  // HTML/SVG, so an embedded onload never fires), and a <track> src is rendered as
  // restricted WebVTT cue text (not a script sink). These tests pin that it stays inert.
  //
  // NOTE (routed to Development): the code comment in lib/wiki/article.ts claims a
  // "data:-script source is rejected exactly as on a link" — that is INACCURATE. On a
  // link (<a href>) data: is rejected; on media src it is retained (but inert). The
  // comment should describe the accurate behavior.

  it("retains a data:image/svg src on a <source> but injects no live SVG/script (inert)", async () => {
    const out = await sanitize(
      `<section><figure typeof="mw:File/Thumb"><span><video controls>` +
        `<source src="data:image/svg+xml,<svg onload=alert(1)>" type="image/svg+xml"/>` +
        `</video></span></figure></section>`
    );
    const doc = parse(out);
    // The data: value survives inside the src attribute (media candidate)…
    const source = doc.querySelector("video source");
    expect(source).not.toBeNull();
    expect((source!.getAttribute("src") || "").startsWith("data:")).toBe(true);
    // …but nothing is promoted to live markup / handlers.
    expect(doc.querySelectorAll("svg").length).toBe(0);
    expect(doc.querySelectorAll("script").length).toBe(0);
    expect(source!.hasAttribute("onload")).toBe(false);
    expect(source!.getAttributeNames().some((n) => n.startsWith("on"))).toBe(false);
  });

  it("a data:text/html src carrying </script> is stripped by SAFE_FOR_XML (defense in depth)", async () => {
    const out = await sanitize(
      `<section><figure typeof="mw:File/Thumb"><span><video controls>` +
        `<source src="data:text/html,<script>alert(1)</script>" type="video/webm"/>` +
        `</video></span></figure></section>`
    );
    const doc = parse(out);
    expect(doc.querySelectorAll("script").length).toBe(0);
    // The offending src is removed (the closing-tag guard fires), leaving no data:text/html.
    expect(out.toLowerCase()).not.toContain("data:text/html");
  });

  it("retains a data:text/vtt <track> src but renders no script (inert VTT)", async () => {
    const out = await sanitize(
      `<section><figure typeof="mw:File/Thumb"><span><video controls>` +
        `<track kind="subtitles" srclang="en" src="data:text/vtt,WEBVTT"/>` +
        `</video></span></figure></section>`
    );
    const doc = parse(out);
    const track = doc.querySelector("video track");
    expect(track).not.toBeNull();
    expect((track!.getAttribute("src") || "").startsWith("data:text/vtt")).toBe(true);
    expect(doc.querySelectorAll("script").length).toBe(0);
  });
});

describe("article-video SECURITY — X4 unchanged inside the media path", () => {
  it("still drops <script>/<iframe>/<object>/<embed> nested in a media figure", async () => {
    const out = await sanitize(
      `<section><figure typeof="mw:File/Thumb"><span><video controls>` +
        `<source src="//upload.wikimedia.org/x.webm" type="video/webm"/>` +
        `<script>window.__pwn=1</script>` +
        `<iframe src="https://evil.test"></iframe>` +
        `<object data="x"></object><embed src="x"/>` +
        `</video></span></figure></section>`
    );
    expect(out).not.toContain("__pwn");
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out.toLowerCase()).not.toContain("<object");
    expect(out.toLowerCase()).not.toContain("<embed");
    // but the legit video survives
    expect(parse(out).querySelector("video source")).not.toBeNull();
  });

  it("still drops an inline style attribute on a media element (no CSS injection)", async () => {
    const out = await sanitize(
      `<section><figure typeof="mw:File/Thumb"><span>` +
        `<video controls style="position:fixed;background:url(//evil.test)">` +
        `<source src="//upload.wikimedia.org/x.webm" type="video/webm"/>` +
        `</video></span></figure></section>`
    );
    expect(out).not.toMatch(/style=/i);
    expect(out).not.toContain("evil.test");
  });
});
