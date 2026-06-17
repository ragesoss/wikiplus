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
  },

  errors: {
    cancelled: "Login cancelled. You can try again whenever you're ready.",
    provider: "Couldn't sign in just now — please try again.",
    expiredSession: "Your session ended — please log in again.",
  },
} as const;

export type GateKind = keyof typeof AUTH_COPY.gates;
