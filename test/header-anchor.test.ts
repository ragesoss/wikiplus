import { describe, expect, it } from "vitest";
import {
  computeWordmarkAnchor,
  topicLeftInset,
  DEFAULT_NARROW_BELOW,
  TOPIC_NARROW_BELOW,
} from "@/lib/header/anchor";

// Pure-function tests for the header wordmark anchor/apex placement (issue #144). jsdom does NO
// layout (getBoundingClientRect / offsetWidth return 0), so rendered-pixel assertions are impossible
// in vitest — the placement decision is factored out as a pure function specifically so this is the
// machine-verifiable offline gate (mirroring test/header-progress.test.ts). It proves the md–lg fix:
// the Topic lockup left-anchors past the inline search (no overlap) across the whole `< lg` band,
// while ≥ lg (seam-on-divider), < md (magnifier reserve), and Home (centered ≥ md) are unchanged.

// ── The lockup-width + auth-width estimates from the design spec's non-overlap proof (#144 §3.2).
// They mirror HeaderProjector's intrinsic lockup geometry (constants are intrinsic to the mark, not
// layout, so they are duplicated here as the proof's stated values rather than imported). ─────────
const WIKI_W_EST = 95; // "Wiki" serif advance (Georgia 600 42px), SSR estimate
const CUT_CX = 27; // aperture x within the indigo block
// Aperture x within the lockup = "Wiki" advance + the block's 2px margin + the cut inset.
const APERTURE_X = WIKI_W_EST + 2 + CUT_CX; // 124
// Lockup intrinsic width ≈ "Wiki" advance + 2px block margin + block bw (CUT_CX 27 + ARM_B 18 + 13
// + 64 = 122) ≈ 219px (spec §3.2).
const LOCKUP_W = WIKI_W_EST + 2 + (CUT_CX + 18 + 13 + 64); // 219
// The single right-anchored auth, px-5 (20) from the right edge. Logged-out "Log in with Wikipedia"
// is the WIDER, governing case (~194px); logged-in SignedIn (~150px) is roomier (spec §3.2).
const PAGE_INSET = 20;
const AUTH_W_LOGGED_OUT = 194;
const AUTH_W_LOGGED_IN = 150;

// The Topic md–lg reserves (#144 §3.2): 320 clears the topic-inline max-w-[280px] field at ≥ md.
const SEARCH_RESERVE_INLINE = 320;
const SEARCH_RESERVE_MAGNIFIER = 64;
const MD = 768;
const REPRESENTATIVE_MDLG = [768, 834, 1023];

/** Auth box left edge for a viewport width + auth width (right-anchored, px-5 inset). */
function authLeft(cw: number, authW: number): number {
  return cw - PAGE_INSET - authW;
}

describe("topicLeftInset (#144 §3.2) — width-aware search reserve", () => {
  it("is the inline-field reserve (320) at ≥ md", () => {
    expect(topicLeftInset(MD, MD, SEARCH_RESERVE_MAGNIFIER, SEARCH_RESERVE_INLINE)).toBe(320);
    expect(topicLeftInset(1023, MD, SEARCH_RESERVE_MAGNIFIER, SEARCH_RESERVE_INLINE)).toBe(320);
  });
  it("is the magnifier reserve (64) < md (unchanged)", () => {
    expect(topicLeftInset(767, MD, SEARCH_RESERVE_MAGNIFIER, SEARCH_RESERVE_INLINE)).toBe(64);
    expect(topicLeftInset(375, MD, SEARCH_RESERVE_MAGNIFIER, SEARCH_RESERVE_INLINE)).toBe(64);
  });
});

describe("computeWordmarkAnchor (#144) — Topic host, md–lg left-anchored, NO overlap (AC1)", () => {
  // The Topic host below lg: narrowBelow = lg (1024), leftInset = 320 (the inline reserve), so the
  // lockup left-anchors past the inline search at every md–lg width.
  for (const cw of REPRESENTATIVE_MDLG) {
    it(`width ${cw}: left-anchored, lockup left edge ≥ search reserve AND right edge < auth left`, () => {
      const { apexX, mode } = computeWordmarkAnchor({
        cw,
        viewportWidth: cw,
        narrowBelow: TOPIC_NARROW_BELOW,
        apertureX: APERTURE_X,
        leftInset: SEARCH_RESERVE_INLINE,
        projectionX: undefined,
      });
      expect(mode).toBe("left");
      // apex = leftInset + apertureX (left-anchored).
      expect(apexX).toBe(SEARCH_RESERVE_INLINE + APERTURE_X);
      // The lockup's left edge ("Wiki" begins) = leftInset = the search reserve. So it never lays
      // out over the inline search field (which occupies [page-inset, page-inset + 280]).
      const lockupLeft = apexX - APERTURE_X;
      const lockupRight = lockupLeft + LOCKUP_W;
      expect(lockupLeft).toBe(SEARCH_RESERVE_INLINE);
      expect(lockupLeft).toBeGreaterThanOrEqual(SEARCH_RESERVE_INLINE);
      // The lockup's right edge stays LEFT of the auth box (no collision) — the governing logged-out
      // case (the wider auth) at the tightest width is the worst case.
      expect(lockupRight).toBeLessThan(authLeft(cw, AUTH_W_LOGGED_OUT));
      // Logged-in (narrower auth) is even roomier.
      expect(lockupRight).toBeLessThan(authLeft(cw, AUTH_W_LOGGED_IN));
    });
  }

  it("the tightest case (768 logged-out) has a positive lockup→auth gap", () => {
    const { apexX } = computeWordmarkAnchor({
      cw: 768,
      viewportWidth: 768,
      narrowBelow: TOPIC_NARROW_BELOW,
      apertureX: APERTURE_X,
      leftInset: SEARCH_RESERVE_INLINE,
      projectionX: undefined,
    });
    const lockupRight = apexX - APERTURE_X + LOCKUP_W;
    const gap = authLeft(768, AUTH_W_LOGGED_OUT) - lockupRight;
    expect(gap).toBeGreaterThan(0);
  });
});

describe("computeWordmarkAnchor (#144) — ≥ lg seam-on-divider unchanged (AC2)", () => {
  it("an explicit projectionX wins: apex = projectionX · cw (not the left-anchor)", () => {
    // ≥ lg the Topic host drives projectionX onto the gutter divider; the left-anchor must NOT apply.
    const projectionX = 0.7;
    const { apexX, mode } = computeWordmarkAnchor({
      cw: 1280,
      viewportWidth: 1280,
      narrowBelow: TOPIC_NARROW_BELOW,
      apertureX: APERTURE_X,
      leftInset: SEARCH_RESERVE_INLINE,
      projectionX,
    });
    expect(mode).toBe("projection");
    expect(apexX).toBeCloseTo(projectionX * 1280, 5);
  });

  it("projectionX takes priority even at a < lg viewport width (the fraction is the driver)", () => {
    // Defensive: if a projectionX is ever present it always wins regardless of width — the regime
    // is decided by the presence of the seam fraction, never overridden by the narrow threshold.
    const { mode } = computeWordmarkAnchor({
      cw: 800,
      viewportWidth: 800,
      narrowBelow: TOPIC_NARROW_BELOW,
      apertureX: APERTURE_X,
      leftInset: SEARCH_RESERVE_INLINE,
      projectionX: 0.6,
    });
    expect(mode).toBe("projection");
  });
});

describe("computeWordmarkAnchor (#144) — < md left-anchored at the magnifier reserve unchanged (AC3)", () => {
  for (const cw of [375, 600, 767]) {
    it(`width ${cw}: left-anchored at leftInset = 64 (apex = 64 + apertureX)`, () => {
      const { apexX, mode } = computeWordmarkAnchor({
        cw,
        viewportWidth: cw,
        narrowBelow: TOPIC_NARROW_BELOW,
        apertureX: APERTURE_X,
        leftInset: SEARCH_RESERVE_MAGNIFIER,
        projectionX: undefined,
      });
      expect(mode).toBe("left");
      expect(apexX).toBe(SEARCH_RESERVE_MAGNIFIER + APERTURE_X);
    });
  }
});

describe("computeWordmarkAnchor (#144) — Home keeps the md threshold, centered ≥ md unchanged (AC4)", () => {
  it("Home (narrowBelow = md) centers at cw/2 for ≥ 768 (the AC4 guardrail)", () => {
    for (const cw of [768, 960, 1280]) {
      const { apexX, mode } = computeWordmarkAnchor({
        cw,
        viewportWidth: cw,
        narrowBelow: DEFAULT_NARROW_BELOW,
        apertureX: APERTURE_X,
        leftInset: 16, // LANDING_PAD_X
        projectionX: undefined,
      });
      expect(mode).toBe("center");
      expect(apexX).toBe(cw / 2);
    }
  });

  it("Home left-anchors only below md (768) — its narrow regime is unchanged", () => {
    const { apexX, mode } = computeWordmarkAnchor({
      cw: 600,
      viewportWidth: 600,
      narrowBelow: DEFAULT_NARROW_BELOW,
      apertureX: APERTURE_X,
      leftInset: 16,
      projectionX: undefined,
    });
    expect(mode).toBe("left");
    expect(apexX).toBe(16 + APERTURE_X);
  });

  it("the md–lg band is the DIFFERENCE: Home centers there, Topic left-anchors there", () => {
    // At 834 (md–lg) the SAME inputs differ ONLY by narrowBelow → opposite regimes. This is the bug
    // fix: Topic must not fall into Home's centered path in the packed md–lg chrome row.
    const common = {
      cw: 834,
      viewportWidth: 834,
      apertureX: APERTURE_X,
      projectionX: undefined,
    };
    const home = computeWordmarkAnchor({
      ...common,
      narrowBelow: DEFAULT_NARROW_BELOW,
      leftInset: 16,
    });
    const topic = computeWordmarkAnchor({
      ...common,
      narrowBelow: TOPIC_NARROW_BELOW,
      leftInset: SEARCH_RESERVE_INLINE,
    });
    expect(home.mode).toBe("center");
    expect(home.apexX).toBe(834 / 2);
    expect(topic.mode).toBe("left");
    expect(topic.apexX).toBe(SEARCH_RESERVE_INLINE + APERTURE_X);
  });
});
