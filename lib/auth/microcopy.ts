// ── Auth microcopy (issue C, design §5 — VERBATIM). ───────────────────────────────────────
// The single source of the exact strings Dev must use unchanged. Centralized so the gates,
// the contribute panel, and the error notices can't drift from the design contract.

export const AUTH_COPY = {
  signInFull: "Log in with Wikipedia",
  signInCompact: "Log in",
  connecting: "Connecting…",
  signOut: "Sign out",
  signedOutAnnounce: "Signed out.",
  contributeGateHeading: "Add a clip",

  gates: {
    contribute: {
      title: "Log in with Wikipedia to contribute",
      body: "Contributing — adding a clip and writing its context note — requires a Wikipedia login, so your curation is tied to your Wikimedia identity. Reading stays anonymous.",
      secondaryLabel: "Browse topics instead →",
    },
    curate: {
      title: "Log in to curate",
      body: "Writing a context note and vouching for a clip requires a Wikipedia login. Log in to curate this clip.",
    },
    add: {
      title: "Log in to add a video",
      body: "Adding a video by link requires a Wikipedia login. Log in to add and curate a clip.",
    },
    dismiss: {
      title: "Log in to dismiss this suggestion",
      body: "Ruling a suggestion out is a curation action and requires a Wikipedia login.",
    },
    // Issue #55 / D4 (design §6.2 — verbatim). The upvote is a gated contribution (CURATION §7):
    // casting/toggling a vote ties it to a real Wikimedia identity; reading the count stays
    // anonymous. Matches the C/D1 gate language + the existing gate shape.
    upvote: {
      title: "Log in to upvote",
      body: "Upvoting a clip ties your vote to your Wikimedia identity, so the count means one real person, once. Reading the count stays anonymous — only voting needs a login.",
    },
  },

  errors: {
    cancelled: "Login cancelled. You can try again whenever you're ready.",
    provider: "Couldn't sign in just now — please try again.",
    expiredSession: "Your session ended — please log in again.",
  },

  // Issue #66 (design §3.2 — VERBATIM). The data disclosure shown on EVERY contribute gate,
  // below the gate's own body, so a signed-out visitor reads — before completing sign-in — what a
  // contribution stores and that reading is anonymous (AC1). The fuller, linkable notice lives at
  // /about/data (AC2). Rendered once by LoginPromptPanel / LoginPromptDialog so the five gates can't
  // drift. The WORDS carry the meaning (never color): a plain summary + a real, labeled link.
  dataNotice: {
    gateLead: "What contributing stores:",
    gateBody:
      "Logging in links your Wikimedia account so your curation is credited to you, and sets a session cookie that keeps you signed in. Your username and your curations are public; your email is never shown. Reading needs no login and stores no identity.",
    gateLinkLabel: "About your data",
  },

  // Issue #57 / D5a (design §3 — VERBATIM). The per-identity write rate-limit notice. A SIBLING of
  // `gates.*` (login prompts) and `errors.*` (failures), distinct from both: this user IS signed in
  // (so it is NOT a login gate) and nothing is broken (so it is NOT a generic failure) — a calm,
  // momentary "too fast" signal that tells the (almost always honest) contributor the benign truth
  // and the action: wait a moment, then retry. Reused on every gated-write surface (the in-modal
  // calm notice + the polite page-level notice). The WORDS carry the meaning + the distinctness
  // (AC3 / CURATION §4) — never color: it says neither "log in" nor "error/failed/blocked".
  rateLimit: {
    notice: "You're doing that a bit too fast — give it a moment, then try again.",
  },
} as const;

export type GateKind = keyof typeof AUTH_COPY.gates;
