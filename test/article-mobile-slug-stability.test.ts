import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFullArticle } from "@/lib/wiki/article";
import {
  groupSectionsByH2,
  ownerH2SlugMap,
} from "@/components/topic/ArticleBody";

// AC2 — section anchors unchanged. The mobile path groups the flat section stream into `h2`
// disclosure runs for the collapse wrapper, but must NOT add, remove, or rename any `sec-{slug}`
// id: the kebab slug set the section walk produces is identical with and without the mobile
// grouping (the walk in lib/wiki/article.ts is untouched). This pins that invariant for a sample
// of representative articles (Earthquake, Lion, Marie Curie) shaped with nested `h3`/`h4` so the
// grouping logic is genuinely exercised. The live MediaWiki fetch is MOCKED (no network egress).

function mockArticleHtml(body: string): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(`<html><body>${body}</body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    })
  );
}

afterEach(() => vi.restoreAllMocks());

// Representative fixtures: each has a lead, several `h2` sections, and `h3`/`h4` nesting under some
// `h2`s — the exact shape the `h2` disclosure grouping has to handle (collapse `h2`, nest `h3`/`h4`).
const FIXTURES: Record<string, { html: string; slugs: string[] }> = {
  Earthquake: {
    html: `
      <section><p>An earthquake is the shaking of the surface of Earth.</p></section>
      <section><h2>Causes</h2><p>Tectonic.</p>
        <section><h3>Naturally occurring earthquakes</h3><p>Faults.</p>
          <section><h4>Fault types</h4><p>Normal, reverse.</p></section>
        </section>
        <section><h3>Induced seismicity</h3><p>Human activity.</p></section>
      </section>
      <section><h2>Effects</h2><p>Shaking and ground rupture.</p></section>
      <section><h2>Measurement</h2><p>Seismometers.</p>
        <section><h3>Magnitude</h3><p>Moment magnitude.</p></section>
      </section>
      <section><h2>See also</h2><p>Links.</p></section>
    `,
    slugs: [
      "causes",
      "naturally-occurring-earthquakes",
      "fault-types",
      "induced-seismicity",
      "effects",
      "measurement",
      "magnitude",
      "see-also",
    ],
  },
  Lion: {
    html: `
      <section><p>The lion is a large cat of the genus Panthera.</p></section>
      <section><h2>Etymology</h2><p>From Latin leo.</p></section>
      <section><h2>Taxonomy</h2><p>Felidae.</p>
        <section><h3>Subspecies</h3><p>Two recognised.</p></section>
        <section><h3>Evolution</h3><p>Pleistocene.</p></section>
      </section>
      <section><h2>Characteristics</h2><p>Mane.</p></section>
      <section><h2>References</h2><p>Cited works.</p></section>
    `,
    slugs: [
      "etymology",
      "taxonomy",
      "subspecies",
      "evolution",
      "characteristics",
      "references",
    ],
  },
  "Marie Curie": {
    html: `
      <section><p>Marie Curie was a physicist and chemist.</p></section>
      <section><h2>Early life</h2><p>Warsaw.</p></section>
      <section><h2>Scientific work</h2><p>Radioactivity.</p>
        <section><h3>Discovery of polonium and radium</h3><p>1898.</p></section>
        <section><h3>Nobel Prizes</h3><p>Two.</p></section>
      </section>
      <section><h2>Legacy</h2><p>Curie Institute.</p></section>
    `,
    slugs: [
      "early-life",
      "scientific-work",
      "discovery-of-polonium-and-radium",
      "nobel-prizes",
      "legacy",
    ],
  },
};

describe("AC2 — mobile `h2` grouping preserves the section slug set", () => {
  for (const [title, fx] of Object.entries(FIXTURES)) {
    it(`${title}: the fetched slug set is the desktop baseline`, async () => {
      mockArticleHtml(fx.html);
      const a = await fetchFullArticle(title);
      expect(a.sections.map((s) => s.slug)).toEqual(fx.slugs);
    });

    it(`${title}: grouping into h2 runs adds/removes/renames NO slug`, async () => {
      mockArticleHtml(fx.html);
      const a = await fetchFullArticle(title);
      // The grouping the mobile disclosure uses for the wrapper. Flattening every group's members
      // back out must reproduce the EXACT ordered slug list — grouping is purely structural.
      const grouped = groupSectionsByH2(a.sections);
      const flattened = grouped.flatMap((g) => g.members.map((m) => m.slug));
      expect(flattened).toEqual(a.sections.map((s) => s.slug));
      // And byte-for-byte equal to the committed baseline (the assertion QA reads).
      expect(flattened).toEqual(fx.slugs);
    });
  }

  it("maps each h3/h4 to its parent h2 slug (the goTo expand-on-jump owner map)", async () => {
    mockArticleHtml(FIXTURES.Earthquake.html);
    const a = await fetchFullArticle("Earthquake");
    const owner = ownerH2SlugMap(a.sections);
    // An `h2` owns itself.
    expect(owner.get("causes")).toBe("causes");
    expect(owner.get("effects")).toBe("effects");
    // An `h3` / `h4` maps to its enclosing `h2` group — so a jump to it expands the right group.
    expect(owner.get("naturally-occurring-earthquakes")).toBe("causes");
    expect(owner.get("fault-types")).toBe("causes");
    expect(owner.get("induced-seismicity")).toBe("causes");
    expect(owner.get("magnitude")).toBe("measurement");
  });

  it("a leading h3 before the first h2 forms a loose self-owned group (defensive)", () => {
    const sections = [
      { slug: "intro-note", title: "Intro note", level: 3 },
      { slug: "history", title: "History", level: 2 },
      { slug: "details", title: "Details", level: 3 },
    ].map((s) => ({ ...s, html: "<p>x</p>" }));
    const groups = groupSectionsByH2(sections);
    expect(groups[0].h2).toBeNull();
    expect(groups[0].members.map((m) => m.slug)).toEqual(["intro-note"]);
    expect(groups[1].h2?.slug).toBe("history");
    expect(groups[1].members.map((m) => m.slug)).toEqual(["history", "details"]);
    const owner = ownerH2SlugMap(sections);
    expect(owner.get("intro-note")).toBe("intro-note"); // loose member owns itself
    expect(owner.get("details")).toBe("history");
  });
});
