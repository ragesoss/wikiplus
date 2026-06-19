# Spec — TikTok detail fetching on add-by-link (D-TikTok reversal)

**Status:** ready for UX + Dev
**Owner role:** Product
**Branch:** `tiktok-detail-fetching`
**Builds on:** issue #64 / `docs/specs/add-link-metadata.md` (D-YouTube resolve loop), CURATION §5.5 / C10
**Related code:** `lib/embed/oembed.ts`, `lib/embed/facade.ts`, `components/topic/add-media.ts`, `components/topic/AddModal.tsx`

## Problem

The add-by-link flow already resolves **real** metadata for YouTube via a server-side
oEmbed call (issue #64). TikTok links **parse and can be curated**, but
`resolveOEmbedAction()` deliberately returns `{ ok: false, reason: "unsupported" }`
for TikTok (the "D-TikTok deferral"), so every TikTok add lands on the honest
unresolved placeholder: a "Creator not resolved" credit, no caption, no thumbnail.

The owner wants to **reverse that deferral**: resolve real title, creator, and
thumbnail for TikTok from TikTok's public oEmbed endpoint
(`https://www.tiktok.com/oembed`), reusing the YouTube server-action architecture.
TikTok oEmbed is documented as less reliable for our use (CORS posture, variable
`author_url`/`thumbnail_url` availability), so a clean, fabrication-free fallback to
the **existing** behavior when resolution fails or is incomplete is part of the
feature, not an afterthought.

Concrete motivating case the feature must satisfy end-to-end in production:
adding `https://www.tiktok.com/@junglygarden/video/7242553660062944558` to the
"Dendrobium kingianum" topic.

## User value

**Curators** adding TikTok clips get the same trustworthy, low-effort experience they
already get for YouTube: a recognized TikTok share link previews the real caption,
real creator (name + outbound link), and a real thumbnail before they commit — so the
clip they curate carries correct attribution (C10) instead of a "Creator not resolved"
stand-in they would otherwise have to live with. TikTok is a primary platform for the
short vertical clips wiki+ curates, so this closes a major gap. **Readers** benefit
downstream: TikTok clips on a Topic page now show a real creator credit and thumbnail
rather than an unresolved placeholder.

## Scope

In scope:
- Make `resolveOEmbedAction()` fetch and map TikTok oEmbed (`https://www.tiktok.com/oembed`),
  reusing the YouTube server-action pattern: server-side fetch (CORS sidestep), descriptive
  User-Agent, stateless, no key, `cache: "no-store"`, not auth-gated.
- Field mapping: `title → caption`, `author_name → creator.name`, `author_url → creator.url`,
  `thumbnail_url → thumbnailUrl` — identical to the YouTube mapping.
- Graceful degradation when oEmbed returns partial data (missing `author_url` and/or
  `thumbnail_url`) and clean failure routing when the fetch fails.
- Update the AddModal copy that currently tells curators TikTok details aren't fetched.
- The "Resolved via oEmbed" affordance now appears on a real TikTok resolve.

Out of scope (explicitly):
- **TikTok auto-suggestion stays deferred** — this is the add-by-link path only. The
  candidate pipeline / "Search TikTok" deep-link behavior is unchanged (ARCHITECTURE
  "TikTok auto-suggestion is deferred").
- **No schema change.** Persisted `Clip` / `ClipMediaSource` shape is unchanged; only the
  *values* in `caption`/`creator`/`thumbnailUrl` and the modal *state* differ.
- **No Instagram change.** Instagram oEmbed needs a Facebook/Instagram app token (a real
  integration dependency — ARCHITECTURE provider notes); it stays on `unsupported` →
  placeholder. (If, while touching `resolveOEmbedAction`, an Instagram path falls out
  trivially-free with *no* token and *no* added risk, Dev may include it — but it is NOT
  a goal and must not expand scope or testing burden. Default: leave Instagram unchanged.)
- **No read-path caching, no ISR/Redis** (still deferred project-wide).
- TikTok embed-script rendering / playback fidelity is unchanged — this feature resolves
  *metadata* only; the click-to-load facade and `embedUrl` are untouched.

## Decisions (owner-open questions, resolved by Product — do not re-open)

**D1 — Creator handle source for TikTok: use the parsed URL `@handle`, falling back to
the C10 derivation.** TikTok share URLs already carry the real, canonical handle
(`https://www.tiktok.com/@junglygarden/video/…` → `@junglygarden`). This is *more
accurate* than the C10 author-name slug derivation (`@` + author_name lowercased,
spaces removed), which for TikTok display names can diverge from the real handle.
Therefore:
- The TikTok parse (`parseVideoUrl`) captures the URL handle (the `@…` segment) onto
  `ParsedVideo` as an optional `creatorHandle`.
- On a resolved TikTok clip, `creator.handle` = the parsed URL handle when present;
  otherwise fall back to `deriveHandle(author_name)`; otherwise omit (name-only).
- This is still **C10-consistent**: C10 names the handle as *display sugar, not an
  identity key*, and the YouTube derivation as the floor *when no better handle exists*.
  A real platform handle from the URL is a strictly-better display label than a derived
  slug; the **name + `author_url` link still carries the attribution weight**, exactly as
  C10 requires. The literal `"pasted"` placeholder must never appear on a resolved clip.
- YouTube behavior is unchanged (YouTube watch URLs do not carry a clean handle; it keeps
  the existing `deriveHandle` path).

**D2 — Failure / non-200 / timeout routes to the existing state D (Try again / Add anyway /
Cancel), exactly like YouTube.** TikTok does NOT keep the old state-G "unsupported →
straight to placeholder" path now that we fetch it. A recognized TikTok link that we *try*
and can't resolve is a `{ ok: false, reason: "failed" }` (state D), giving the curator a
retry and an honest "Add anyway" → placeholder. This is consistent with how YouTube
failures behave and avoids a confusing "we don't fetch TikTok" message on a platform we now
*do* fetch. The state-G `unsupported` arm remains in the code for Instagram/other.
Rationale: TikTok's documented unreliability makes transient failure *more* likely, so the
retry affordance is exactly what's wanted; a dead-end placeholder on every hiccup would be a
regression.

**D3 — Resolve floor is the same as YouTube: a non-empty `title` AND `author_name`.**
A 200 response missing either load-bearing field is `{ ok: false, reason: "failed" }`
(state D), never a half-empty "resolved" credit. `author_url` and `thumbnail_url` are
optional and degrade gracefully (D1 / AC3 below).

**D4 — Add a request timeout to the server fetch.** TikTok oEmbed can hang; an
unbounded fetch would leave the modal stuck in state B (Resolving). Dev adds a bounded
timeout (suggested ~5s via `AbortSignal.timeout`) to `resolveOEmbedAction`; a timeout is a
`{ ok: false, reason: "failed" }` (state D), same as any other failure. This SHOULD apply
to the YouTube branch too (same loop) since it is a pure robustness improvement with no
behavior change on success — Dev's call, but preferred.

## Acceptance criteria

Each is independently verifiable by QA with a test. "oEmbed endpoint" = `https://www.tiktok.com/oembed`;
TikTok responses should be stubbed/mocked in tests (no live network in CI).

1. **Good resolve.** Given a recognized TikTok link whose oEmbed returns a non-empty
   `title`, `author_name`, `author_url`, and `thumbnail_url`, `resolveOEmbedAction("tiktok", url)`
   returns `{ ok: true, meta }` with `meta.title`, `meta.authorName`, `meta.authorUrl`,
   `meta.thumbnailUrl` set from those fields (trimmed). The modal reaches state C (resolved)
   showing the real caption, creator name, outbound creator link, and thumbnail.

2. **Field mapping into the persisted media source.** For a good TikTok resolve,
   `resolvedMediaSource(...)` produces `caption = title`, `creator.name = author_name`,
   `creator.url = author_url`, `thumbnailUrl = thumbnail_url` — identical mapping to YouTube.
   The mock strings (`"Pasted clip (mock preview)"`, `creator.handle: "pasted"`,
   `"Pasted {platform} clip"`, `"Unresolved … clip"`, `"Creator not resolved"`) do **not**
   appear on a resolved TikTok clip.

3. **Handle source (D1).** For the URL
   `https://www.tiktok.com/@junglygarden/video/7242553660062944558`, the resolved clip's
   `creator.handle` is `@junglygarden` (the URL handle), regardless of what `author_name`
   slugifies to. When a TikTok URL form carries no `@handle` segment, `creator.handle`
   falls back to `deriveHandle(author_name)`; when neither yields a handle, the credit is
   name-only (handle omitted) — never `"pasted"`, never an empty `@`.

4. **Partial data — missing `author_url`.** When oEmbed returns a good `title` + `author_name`
   but no `author_url`, the resolve still succeeds (`ok: true`, `authorUrl` undefined). The
   resolved preview and the persisted credit show name + handle/platform with **no outbound
   link** (a non-linked span — the C10 name-without-link degradation), never a fabricated or
   dead link.

5. **Partial data — missing `thumbnail_url`.** When oEmbed returns good `title` + `author_name`
   but no `thumbnail_url`, the resolve still succeeds; `meta.thumbnailUrl` is undefined and the
   preview/persist falls back to `parsed.thumbnailUrl` (undefined for TikTok → the gradient
   fallback). A missing thumbnail is **not** a resolution failure.

6. **Failure routes to state D (D2).** A non-200 response, a network error, malformed/empty
   JSON, a response missing `title` or `author_name`, or a timeout (D4) all return
   `{ ok: false, reason: "failed" }`, and the modal shows the **state-D** failure panel
   ("Couldn't fetch video details" + **Try again / Add anyway / Cancel**) — the same as a
   YouTube failure. It is never a dead end and never shows fabricated metadata or a false
   "Resolved via oEmbed".

7. **No fabrication on the placeholder path.** If the curator chooses "Add anyway" from
   state D, the persisted clip uses `placeholderMediaSource(...)` ("Unresolved TikTok clip"
   caption, "Creator not resolved" name, no `creator.url`, no handle) — unchanged behavior.
   The video still plays (real `embedUrl`/`watchUrl` preserved).

8. **Etiquette preserved.** The TikTok oEmbed fetch runs **server-side** (in
   `resolveOEmbedAction`), sends the descriptive `User-Agent` (`UA` constant), uses no API
   key/secret, uses `cache: "no-store"`, and is not auth-gated. No client-side fetch to
   `tiktok.com/oembed` is introduced (no CORS dependency).

9. **"Resolved via oEmbed" only on a real resolve (AC3 of #64 preserved).** The
   "Resolved via oEmbed" eyebrow renders only in state C, for TikTok exactly as for YouTube —
   never on the state-D failure panel or the placeholder.

10. **AddModal copy updated.** No surface in AddModal tells the curator that TikTok details
    aren't / can't be fetched. Specifically, the state-G `unsupported` MVP-limitation line
    ("We don't fetch {platformLabel} video details yet…") must **not** appear for TikTok
    (TikTok no longer reaches the `unsupported` arm — D2). The link-entry hint copy remains
    accurate for both YouTube and TikTok.

11. **Persisted shape unchanged (AC10 of #64 preserved).** The `Clip` / `ClipMediaSource`
    TypeScript shape is unchanged; no migration, no new column, no new persisted field. (The
    new `ParsedVideo.creatorHandle` is an in-memory parse field, not persisted shape.)

12. **YouTube unchanged.** All existing YouTube add-by-link acceptance criteria from #64 still
    pass: YouTube resolves real metadata, YouTube handle still derives via `deriveHandle`,
    YouTube failures still reach state D.

## Success metric

**Primary:** TikTok add-by-link resolve success rate — of TikTok links pasted and
"Fetch details" attempts, the share of attempts that reach state C (resolved) vs. land in
state D (failure). Target: a clear majority of well-formed TikTok share links from major
creators resolve real caption + creator + thumbnail. (Analytics is deferred; this is the
defined metric to wire up when instrumentation lands. Until then, the **end-to-end
acceptance gate** is the metric: the `@junglygarden` clip above resolves real metadata and
curates onto "Dendrobium kingianum" in production.)

**Guardrail:** zero fabricated-metadata incidents — no resolved TikTok clip ever ships a
fake creator name, a dead/empty `creator.url`, or a false "Resolved via oEmbed" (C10). A
failure must always degrade to state D / honest placeholder, never a fabricated success.

## Doc update Dev must make

`docs/ARCHITECTURE.md`'s **D-TikTok decision** record (the *Prototype phase* → D-add-link
section, ~lines 1175–1180, and the *Candidate suggestion* → "Add by link" note ~lines
364–370) currently states TikTok lands on the honest placeholder and is **not** fetched.
Dev must rewrite those to reflect the **current state** after this feature: TikTok now
resolves real metadata via the same server-side oEmbed loop, with state-D failure fallback;
Instagram/other remain on the `unsupported` placeholder arm. Per the CLAUDE.md "no history
cruft" rule, state what it *is* now — do not narrate "used to defer / now reverses".
(`CURATION_STANDARD.md` C10 already covers TikTok generically as "an oEmbed-resolved clip"
and needs no change; if Dev finds C10 prose that names YouTube as the *only* resolved
platform, generalize it.)

## Assumptions recorded

- TikTok's public oEmbed endpoint (`https://www.tiktok.com/oembed?url=<share-url>`) returns
  JSON with `title`, `author_name`, `author_url`, `thumbnail_url` for public videos without
  an app token. (Documented behavior; field availability is variable — hence the graceful
  degradation ACs. Dev verifies against the live endpoint for the `@junglygarden` case.)
- The existing `parseVideoUrl` TikTok branch correctly recognizes the canonical
  `tiktok.com/@user/video/<id>` share form (confirmed in `lib/embed/facade.ts`); short
  `vm.tiktok.com` / `vt.tiktok.com` redirect links are **not** in scope (they don't parse
  today and resolving redirect URLs is a separate concern — they continue to hit the
  existing state-F unrecognized-link error, unchanged).
- The honest placeholder + state-D machinery from #64 is the right fallback substrate and is
  reused as-is (no new failure UI is needed).

## Hand-off

- **UX:** the flow is the established #64 A→B→{C|D|E} state machine — no new states. UX work is
  light: (1) confirm the TikTok resolved preview (state C) and failure (state D) read correctly
  with TikTok content and the URL-derived `@handle` (D1); (2) update the AddModal copy per AC10
  so nothing implies TikTok is unfetched; (3) evaluate the built UI against C10 attribution.
  TikTok now uses the *same* C/D/E surfaces as YouTube — the only TikTok-specific copy change is
  removing the "we don't fetch TikTok yet" line.
- **Development:** flip the platform gate in `resolveOEmbedAction` to fetch the TikTok oEmbed
  endpoint (D2/D3/D4); add `creatorHandle` to `ParsedVideo` from the TikTok URL and thread it
  through `resolvedMediaSource` (D1); update `components/topic/AddModal.tsx` copy (AC10); update
  the `docs/ARCHITECTURE.md` D-TikTok record (current-state). Keep YouTube and the persisted
  shape unchanged. Unit-test the oEmbed mapping + handle source + failure routing with stubbed
  responses; QA verifies AC1–AC12.
