import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeneralStrip } from "@/components/topic/GeneralStrip";
import { GENERAL_SUGGESTION_DEFAULT } from "@/lib/candidates";
import type { Candidate, Clip } from "@/lib/data/types";

const clip: Clip = {
  id: "c1",
  topicQid: "Q11982",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=abc",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc",
  thumbnailUrl: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  caption: "Overview clip",
  creator: { handle: "@cc", name: "CrashCourse", platform: "youtube" },
  contextNote: "note",
  stance: "explainer",
  accuracyFlag: "accurate",
  general: true,
  createdAt: new Date().toISOString(),
};

const cand: Candidate = {
  id: "cand1",
  topicQid: "Q189603",
  platform: "youtube",
  platformLabel: "YouTube",
  orientation: "horizontal",
  watchUrl: "https://www.youtube.com/watch?v=def",
  caption: "Suggested overview",
  creator: { handle: "@as", name: "Amoeba Sisters", platform: "youtube" },
  vetted: false,
  source: "YouTube",
  matchReason: "Top result",
  general: true,
};

/** Build N distinct general candidates (for the see-more cap tests). */
function candidates(n: number): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({
    ...cand,
    id: `cand_${i + 1}`,
    watchUrl: `https://www.youtube.com/watch?v=v${i + 1}`,
    caption: `Suggested ${i + 1}`,
  }));
}

describe("GeneralStrip — fully-curated (AC3/AC8)", () => {
  it("renders general overview tiles with a video count", () => {
    render(
      <GeneralStrip
        topicTitle="Photosynthesis"
        generalClips={[clip]}
        generalCandidates={[]}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText("＋ General")).toBeInTheDocument();
    // grammatical count at 1 (defect N3): "1 video", not "1 videos"
    expect(screen.getByText("1 video")).toBeInTheDocument();
    expect(screen.getByText("Overview clip")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  // AC3: fully-curated is visually clean — no divider, no see-more, no uncurated pill.
  it("shows no suggestion chrome when there are no candidates (AC3)", () => {
    // Signed in: a curator keeps the standing ＋ Add video; the Search links drop in
    // fully-curated. (The logged-out Find-more gating is its own test below — #164.)
    render(
      <GeneralStrip
        topicTitle="Photosynthesis"
        generalClips={[clip]}
        generalCandidates={[]}
        signedIn
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.queryByText("uncurated")).toBeNull();
    expect(screen.queryByText(/Suggested · uncurated/)).toBeNull();
    expect(screen.queryByRole("button", { name: /See \d+ more/ })).toBeNull();
    // Add-video stays reachable for a curator; the empty-state Search links do NOT (§7.3).
    expect(screen.getByRole("button", { name: /Add video/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Search YouTube/ })).toBeNull();
  });
});

describe("GeneralStrip — empty / Suggested (AC1, AC16, AC18)", () => {
  // `signedIn` so the on-tile Curate CTA renders for the CTA-label assertion below; the
  // logged-out watch-only gating is its own describe block (#71).
  function setup(onAdd = vi.fn()) {
    render(
      <GeneralStrip
        topicTitle="Cellular respiration"
        generalClips={[]}
        generalCandidates={[cand]}
        signedIn
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={onAdd}
      />
    );
    return { onAdd };
  }

  it("reads 'Suggested videos · uncurated' and states the kind once (AC16)", () => {
    setup();
    expect(screen.getByText("＋ Suggested videos")).toBeInTheDocument();
    expect(screen.getByText("uncurated")).toBeInTheDocument();
  });

  // #14 AC6: the General band does not render a "N candidates" count label.
  it("does NOT render a 'N candidates' count label on the band (#14 AC6)", () => {
    setup();
    expect(screen.queryByText(/\d+\s+candidates?/)).toBeNull();
  });

  // #164 (AC5 / the adversarial trap): trimming the curated-state subtitle must NOT also
  // remove the EMPTY-state "— auto-found candidates, not yet vetted" line — that text IS the
  // once-per-context unvetted signal in the empty band (a required signal, not chrome). It
  // must still render here, in words.
  it("KEEPS the empty-state 'auto-found candidates, not yet vetted' unvetted subtitle (#164 AC5)", () => {
    setup();
    expect(
      screen.getByText("— auto-found candidates, not yet vetted")
    ).toBeInTheDocument();
  });

  // #14 AC1 / #60 §5.3: no per-tile "SUGGESTED" badge. In the empty band there is also no
  // "Suggested · uncurated" divider (the band header is the once-per-context signal).
  it("renders NO per-tile 'SUGGESTED' badge and no inline divider in empty (#14 AC1)", () => {
    setup();
    expect(screen.queryByText("Suggested")).toBeNull();
    expect(screen.queryByText("Suggested · uncurated")).toBeNull();
  });

  // #14 AC8: the candidate tile retains the dashed/unvetted candcard distinction.
  it("renders candidate tiles on the dashed candcard surface (#14 AC8)", () => {
    const { container } = render(
      <GeneralStrip
        topicTitle="Cellular respiration"
        generalClips={[]}
        generalCandidates={[cand]}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(container.querySelector(".candcard")).not.toBeNull();
  });

  // #14 AC9: the candidate tile CTA reads "Curate" (was "Promote").
  it("labels the candidate-tile CTA 'Curate' with the right aria-label (#14 AC9)", () => {
    setup();
    const curate = screen.getByRole("button", {
      name: `Curate this clip: ${cand.caption}`,
    });
    expect(curate).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("button", { name: /Promote/ })).toBeNull();
  });

  it("offers Search TikTok / Search YouTube deep-links in a new tab (AC18)", () => {
    setup();
    const tiktok = screen.getByRole("link", { name: /Search TikTok/ });
    const youtube = screen.getByRole("link", { name: /Search YouTube/ });
    for (const a of [tiktok, youtube]) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener");
    }
    expect(tiktok.getAttribute("href")).toContain("tiktok.com/search?q=");
    expect(youtube.getAttribute("href")).toContain(
      "youtube.com/results?search_query="
    );
  });

  it("opens the Add-video modal via its trigger (AC18)", async () => {
    const { onAdd } = setup();
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: /Add video/ }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

// Issue #60 §2.1 — the mixed band: curated FIRST, then the divider, then suggestions.
describe("GeneralStrip — mixed state (AC2/AC4)", () => {
  // `signedIn` so the curator-only Find-more cluster renders (its presence is asserted
  // below); the curated/suggestion rendering + ordering tests are agnostic to it.
  function setup() {
    render(
      <GeneralStrip
        topicTitle="Photosynthesis"
        generalClips={[clip]}
        generalCandidates={[cand]}
        signedIn
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
  }

  it("renders BOTH the curated clip and the suggestion (AC2)", () => {
    setup();
    expect(screen.getByText("Overview clip")).toBeInTheDocument();
    expect(screen.getByText("Suggested overview")).toBeInTheDocument();
  });

  it("heads the band '＋ General' (not 'Suggested videos') in mixed (§5.3)", () => {
    setup();
    expect(screen.getByText("＋ General")).toBeInTheDocument();
    expect(screen.queryByText("＋ Suggested videos")).toBeNull();
  });

  it("renders the inline 'Suggested · uncurated' divider between the groups (§2.1)", () => {
    setup();
    expect(screen.getByText("Suggested · uncurated")).toBeInTheDocument();
  });

  it("renders the curated tile BEFORE the suggestion tile in source order (AC4)", () => {
    setup();
    const curated = screen.getByText("Overview clip");
    const suggested = screen.getByText("Suggested overview");
    // Curated precedes suggested in the document (DOCUMENT_POSITION_FOLLOWING = 4).
    expect(
      curated.compareDocumentPosition(suggested) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("keeps the Find-more cluster (Search links + Add) available in mixed (§7.2)", () => {
    setup();
    expect(screen.getByRole("link", { name: /Search YouTube/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add video/ })).toBeInTheDocument();
  });

  // #164 (AC5 / the adversarial trap, other arm): in a CURATED band the descriptive
  // subtitle is trimmed (it added words, not signal) — AND the empty-state unvetted line
  // must NOT bleed into the curated band (it belongs ONLY to the empty state).
  it("renders NO descriptive subtitle in a curated band (#164 AC5)", () => {
    setup();
    expect(screen.queryByText(/quick visual overview/)).toBeNull();
    expect(
      screen.queryByText(/auto-found candidates, not yet vetted/)
    ).toBeNull();
  });
});

// Issue #60 §3 — the generous default + the "See N more" control.
describe("GeneralStrip — see-more cap (AC6/AC7/AC15)", () => {
  it("shows no see-more control at or below the default", () => {
    render(
      <GeneralStrip
        topicTitle="X"
        generalClips={[]}
        generalCandidates={candidates(GENERAL_SUGGESTION_DEFAULT)}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /See \d+ more/ })).toBeNull();
    // every tile shows (the cap is not hit)
    expect(screen.getByText(`Suggested ${GENERAL_SUGGESTION_DEFAULT}`)).toBeInTheDocument();
  });

  it("caps at the default and exposes 'See N more' when the pool overflows (AC6/AC7)", () => {
    render(
      <GeneralStrip
        topicTitle="X"
        generalClips={[]}
        generalCandidates={candidates(GENERAL_SUGGESTION_DEFAULT + 3)}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    // The remaining count = total − default (3 here).
    const seeMore = screen.getByRole("button", { name: /See 3 more/ });
    expect(seeMore).toHaveAttribute("aria-expanded", "false");
    expect(seeMore).toHaveAttribute("aria-controls", "general-suggestion-group");
    // The overflow tiles are hidden until expanded.
    expect(
      screen.queryByText(`Suggested ${GENERAL_SUGGESTION_DEFAULT + 1}`)
    ).toBeNull();
    // The default-th tile IS shown.
    expect(screen.getByText(`Suggested ${GENERAL_SUGGESTION_DEFAULT}`)).toBeInTheDocument();
  });

  it("reveals the rest on expand and collapses back (reversible — AC7/AC15)", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <GeneralStrip
        topicTitle="X"
        generalClips={[]}
        generalCandidates={candidates(GENERAL_SUGGESTION_DEFAULT + 3)}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /See 3 more/ }));
    // Expanded: the overflow tile now shows; the label flips to "See fewer".
    expect(
      screen.getByText(`Suggested ${GENERAL_SUGGESTION_DEFAULT + 3}`)
    ).toBeInTheDocument();
    const collapse = screen.getByRole("button", { name: /See fewer/ });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    // Collapse: back to the default; the overflow tile is hidden again.
    await userEvent.click(collapse);
    expect(
      screen.queryByText(`Suggested ${GENERAL_SUGGESTION_DEFAULT + 1}`)
    ).toBeNull();
    expect(screen.getByRole("button", { name: /See 3 more/ })).toBeInTheDocument();
  });

  it("never caps curated general clips (AC6)", () => {
    const manyClips: Clip[] = Array.from(
      { length: GENERAL_SUGGESTION_DEFAULT + 5 },
      (_, i) => ({ ...clip, id: `clip_${i + 1}`, caption: `Clip ${i + 1}` })
    );
    render(
      <GeneralStrip
        topicTitle="X"
        generalClips={manyClips}
        generalCandidates={[]}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    // Every curated tile renders; no see-more applies to curated content.
    expect(
      screen.getByText(`Clip ${GENERAL_SUGGESTION_DEFAULT + 5}`)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /See \d+ more/ })).toBeNull();
  });
});

// New runtime faces from the live source (youtube-autosuggest design §5.2 / §5.4).
describe("GeneralStrip — loading face (design §5.4 / AC2/AC11)", () => {
  it("shows skeleton tiles, the 'Finding videos…' tag, and aria-busy (empty + loading)", () => {
    render(
      <GeneralStrip
        topicTitle="Cellular respiration"
        generalClips={[]}
        generalCandidates={[]}
        loading
        signedIn
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText("Finding videos…")).toBeInTheDocument();
    const skeletonRow = screen.getByRole("list", { name: /Looking for suggested videos/ });
    expect(skeletonRow).toHaveAttribute("aria-busy", "true");
    // The honest zero line must NOT show while loading (no flash of "nothing here").
    expect(screen.queryByText(/No videos found/)).not.toBeInTheDocument();
    // "Find more" stays available during loading.
    expect(screen.getByRole("button", { name: /Add video/ })).toBeInTheDocument();
  });

  // Issue #60 §7.4: the candidate fetch never disturbs the curated group.
  it("keeps curated tiles painted while candidates load (mixed loading — AC10/§7.4)", () => {
    render(
      <GeneralStrip
        topicTitle="Photosynthesis"
        generalClips={[clip]}
        generalCandidates={[]}
        loading
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    // The curated clip renders regardless of the in-flight candidate fetch.
    expect(screen.getByText("Overview clip")).toBeInTheDocument();
    // The band reads as curated ("＋ General"), not the empty "Finding videos…" face.
    expect(screen.getByText("＋ General")).toBeInTheDocument();
  });
});

describe("GeneralStrip — zero-results face (design §5.2 / AC2 zero case)", () => {
  it("shows the honest line and keeps 'Find more' for a curator (no candidate count — #14 AC6)", () => {
    render(
      <GeneralStrip
        topicTitle="Obscurium"
        generalClips={[]}
        generalCandidates={[]}
        loading={false}
        signedIn
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText(/No videos found for this topic yet/)).toBeInTheDocument();
    // #14 AC6: the band does not show a candidate count, even at zero.
    expect(screen.queryByText(/\d+\s+candidates?/)).toBeNull();
    expect(screen.getByRole("link", { name: /Search YouTube/ })).toBeInTheDocument();
  });

  it("logged out: the honest line does NOT point at the hidden Find-more controls (#164)", () => {
    render(
      <GeneralStrip
        topicTitle="Obscurium"
        generalClips={[]}
        generalCandidates={[]}
        loading={false}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(screen.getByText(/No videos found for this topic yet/)).toBeInTheDocument();
    // The dangling "try a manual search below" must NOT show (those controls are hidden).
    expect(screen.queryByText(/manual search below/)).toBeNull();
    expect(screen.queryByRole("link", { name: /Search YouTube/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add video/ })).toBeNull();
  });
});

describe("GeneralStrip — logged-out tile gating (#71 §4/§5, AC1/AC2/AC3/AC8)", () => {
  // A curated general clip carrying an upvote count, to exercise the read-only-count surface.
  const curatedWithVotes: Clip = { ...clip, upvotes: 12 };

  function renderStrip(signedIn: boolean, clips: Clip[], cands: Candidate[]) {
    return render(
      <GeneralStrip
        topicTitle="Cellular respiration"
        generalClips={clips}
        generalCandidates={cands}
        signedIn={signedIn}
        votedClip={() => false}
        onUpvote={vi.fn()}
        onPlay={vi.fn()}
        onPromote={vi.fn()}
        onDismiss={vi.fn()}
        onAdd={vi.fn()}
      />
    );
  }

  it("logged out: a candidate tile renders NO Curate / Not-relevant button (AC3)", () => {
    renderStrip(false, [], [cand]);
    expect(screen.queryByRole("button", { name: /Curate this clip/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Dismiss as not relevant/ })
    ).toBeNull();
    // Caption + creator credit still render; the per-tile match-reason line is gone
    // (#164 — the "Why suggested" reason lives in the player now, not on the tile).
    expect(screen.getByText("Suggested overview")).toBeInTheDocument();
    expect(screen.queryByText(/Top result/)).toBeNull();
  });

  it("logged out: hides the curator-only Find-more cluster entirely (#164)", () => {
    // Empty (all-suggestions) — the band a logged-out reader is most likely to meet.
    renderStrip(false, [], [cand]);
    expect(screen.queryByRole("link", { name: /Search YouTube/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Search TikTok/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add video/ })).toBeNull();
  });

  it("signed in: shows the Find-more cluster the logged-out reader does not (#164)", () => {
    renderStrip(true, [], [cand]);
    expect(
      screen.getByRole("link", { name: /Search YouTube/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add video/ })
    ).toBeInTheDocument();
  });

  it("logged out: a curated tile renders the read-only count, NO upvote button (AC1/AC2)", () => {
    renderStrip(false, [curatedWithVotes], []);
    // Read-only static figure, not a control.
    expect(screen.getByText("12 upvotes")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upvote/i })
    ).toBeNull();
  });

  it("signed in: the curated tile renders the upvote TOGGLE and candidate the Curate CTA (AC8)", () => {
    renderStrip(true, [curatedWithVotes], [cand]);
    expect(
      screen.getByRole("button", { name: /Upvote this clip/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Curate this clip/ })
    ).toBeInTheDocument();
  });
});
