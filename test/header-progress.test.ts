import { describe, expect, it } from "vitest";
import {
  clamp,
  computeProgress,
  deriveHeaderProgress,
  easeInCubic,
  easeInQuad,
  easeOutCubic,
  quantizeProgress,
} from "@/lib/header/progress";

// Pure-function tests for the continuous header transition math (issue #96). The mapping and the
// eased curves are factored out as pure functions specifically so they are unit-testable here and
// QA can verify the §3 formulas without driving the DOM. Geometry constants match SiteHeader's
// TOPIC_BURN_Y (104) and SLIM_BAR_HEIGHT (56). ───────────────────────────────────────────────
const BURN_Y = 104;
const SLIM = 56;

describe("clamp", () => {
  it("clamps below, within, and above the range", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(2, 0, 1)).toBe(1);
  });
});

describe("easing curves (#96 §3.3)", () => {
  it("all map endpoints 0→0 and 1→1", () => {
    for (const f of [easeOutCubic, easeInCubic, easeInQuad]) {
      expect(f(0)).toBeCloseTo(0, 10);
      expect(f(1)).toBeCloseTo(1, 10);
    }
  });
  it("easeOutCubic is fast at the start (above linear early)", () => {
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
  });
  it("easeInCubic / easeInQuad are slow at the start (below linear early)", () => {
    expect(easeInCubic(0.25)).toBeLessThan(0.25);
    expect(easeInQuad(0.25)).toBeLessThan(0.25);
  });
  it("easeInCubic is the mirror of easeOutCubic: in(t) = 1 − out(1 − t)", () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(easeInCubic(t)).toBeCloseTo(1 - easeOutCubic(1 - t), 10);
    }
  });
});

describe("computeProgress (#96 §3.1) — p = clamp(scrollY / end, 0, 1)", () => {
  it("p = 0 at the very top (no dead zone — start is 0)", () => {
    expect(computeProgress(0, BURN_Y)).toBe(0);
  });
  it("p rises linearly with scrollY across the range", () => {
    expect(computeProgress(26, BURN_Y)).toBeCloseTo(0.25, 5);
    expect(computeProgress(52, BURN_Y)).toBeCloseTo(0.5, 5);
    expect(computeProgress(78, BURN_Y)).toBeCloseTo(0.75, 5);
    expect(computeProgress(104, BURN_Y)).toBe(1);
  });
  it("p clamps to 1 past the end (deep-link / refresh mid-article — §5)", () => {
    expect(computeProgress(500, BURN_Y)).toBe(1);
  });
  it("p is a pure function of scrollY (perfect reversibility, no hysteresis — §3.4)", () => {
    // Same scrollY → same p regardless of how it was reached.
    expect(computeProgress(60, BURN_Y)).toBe(computeProgress(60, BURN_Y));
  });
});

describe("quantizeProgress (#96 §7 — reduced motion) — snap to {0,1} with a tiny dead-band", () => {
  it("snaps to 1 at/above 0.55 and to 0 at/below 0.45", () => {
    expect(quantizeProgress(0.6, 0)).toBe(1);
    expect(quantizeProgress(0.3, 1)).toBe(0);
  });
  it("holds the previous value inside the 0.45–0.55 dead-band (no 1px chatter)", () => {
    expect(quantizeProgress(0.5, 0)).toBe(0);
    expect(quantizeProgress(0.5, 1)).toBe(1);
  });
});

describe("deriveHeaderProgress (#96 §3.2) — one p drives every property in lockstep", () => {
  it("p=0 is the full Tier-A end-state (band 104, beam 1, border 0)", () => {
    const d = deriveHeaderProgress(0, BURN_Y, SLIM);
    expect(d.bandHeight).toBe(104);
    expect(d.beamOpacity).toBeCloseTo(1, 5);
    expect(d.borderOpacity).toBe(0);
  });
  it("p=1 is the slim end-state (band 56, beam 0, border 1)", () => {
    const d = deriveHeaderProgress(1, BURN_Y, SLIM);
    expect(d.bandHeight).toBe(56);
    expect(d.beamOpacity).toBeCloseTo(0, 5);
    expect(d.borderOpacity).toBeCloseTo(1, 5);
  });

  it("band height & burn boundary are LINEAR and identical: 104 − 48·p (the crux pin, §4.2)", () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      expect(deriveHeaderProgress(p, BURN_Y, SLIM).bandHeight).toBeCloseTo(
        104 - 48 * p,
        5
      );
    }
  });

  it("the beam is fully gone by p ≈ 0.85 and stays 0 through the final stretch (§3.3)", () => {
    expect(deriveHeaderProgress(0.85, BURN_Y, SLIM).beamOpacity).toBeCloseTo(0, 5);
    expect(deriveHeaderProgress(0.9, BURN_Y, SLIM).beamOpacity).toBe(0);
    expect(deriveHeaderProgress(1, BURN_Y, SLIM).beamOpacity).toBe(0);
  });

  it("the border is HELD at 0 through the front half, then eases up over the back half (§3.3)", () => {
    expect(deriveHeaderProgress(0.4, BURN_Y, SLIM).borderOpacity).toBe(0);
    expect(deriveHeaderProgress(0.5, BURN_Y, SLIM).borderOpacity).toBe(0);
    const back = deriveHeaderProgress(0.75, BURN_Y, SLIM).borderOpacity;
    expect(back).toBeGreaterThan(0);
    expect(back).toBeLessThan(1);
  });

  it("the glow is well faded by the midpoint: at p=0.5 the beam opacity is low", () => {
    const d = deriveHeaderProgress(0.5, BURN_Y, SLIM);
    // The glow (lit aperture + beam) is nearly gone by the midpoint; the opaque card beneath holds.
    expect(d.beamOpacity).toBeLessThan(0.2);
  });

  it("beam opacity decreases monotonically across the whole range", () => {
    let prevBeam = Infinity;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const d = deriveHeaderProgress(Math.min(p, 1), BURN_Y, SLIM);
      expect(d.beamOpacity).toBeLessThanOrEqual(prevBeam + 1e-9);
      prevBeam = d.beamOpacity;
    }
  });
});
