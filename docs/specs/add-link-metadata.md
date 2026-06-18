# Spec — Resolve real video metadata on add-by-link (issue #64)

**Status:** Product spec — ready for UX (modal-flow update) + Development.
**Feature area:** Topic page → "Add a video" (add-by-link curation flow).
**Relates to:** `docs/VISION.md` (MVP loop step 4 — "paste a video URL → we pull the creator
and embed metadata"); `docs/ARCHITECTURE.md` *Video handling — embed, never host*, *Wikipedia
integration → Etiquette*, *Prototype phase*; `docs/TOPIC_PAGE_DESIGN.md` "Add video";
`docs/specs/curate-add-persistence.md` (D1, the flow this completes).

## Problem

When a logged-in curator adds a video by **pasting a YouTube/TikTok share link**, the resulting
clip is labeled with **placeholder mock metadata** instead of the real video. Today
`components/topic/AddModal.tsx` (`mediaSource()`) hard-codes `caption: "Pasted clip (mock
preview)"`, `creator.handle: "pasted"`, and `creator.name: "Pasted {platform} clip"` — an
**intentional interim stopgap** (per the in-code comment) that anticipated a real oEmbed
integration landing later. Worse, the modal preview already *claims* "resolved via oEmbed" while
showing the mock caption — a visible contradiction.

This is no longer hypothetical. The **first live curation** (a test user on
`/topic/Japanese_kitchen_knife/`) pasted a real YouTube link, and the curated card now reads
**"Pasted clip (mock preview) · pasted · YouTube."** The curator did real work — wrote a context
note, set stance/accuracy/section — and it sits on a video that is mislabeled to every reader.

Auto-suggested candidates already carry real metadata (the YouTube search pipeline in
`lib/candidates/youtube.ts` populates real `caption`/`creator`/`thumbnailUrl`). **Only the paste
path is mock** — so add-by-link is the one curation entry point that produces a wrong label.

## User value

- **For the curator:** the clip they add is correctly identified — real title, real creator, real
  thumbnail — so their curation lands on a recognizable video, not a placeholder. Their effort is
  not undercut by a "(mock preview)" label.
- **For the reader:** the curated card names the actual creator and video, which is foundational to
  the product's promise — you can't weigh a creator's take if the card doesn't even say who they
  are or what the video is. This is a direct **trust** lever: "what good looks like" (VISION) is a
  reader who understands *how to weigh each clip*, and that starts with honest attribution.
- **For the product:** closes the last gap between the two add paths (promote-a-candidate vs.
  add-by-link), so both produce equally trustworthy clips.

## What this is (and isn't) about

The clip media shape already exists and is sufficient. `ClipMediaSource`
(`components/topic/curate-clip.ts`) and the persisted `Clip` already carry `caption`, `creator`
(`name` / `handle` / `url` / `platform`), `thumbnailUrl`, `watchUrl`, and `embedUrl`. The
candidate pipeline already proves the shape with real values. So this work is about **populating
real values into the existing fields** — *not* reshaping data, adding columns, or changing the
persisted contract. The in-code comment is explicit: this "improves when a real oEmbed lands
later, no shape change needed."

YouTube **oEmbed** (`https://www.youtube.com/oembed?url=<watchUrl>&format=json`) returns `title`,
`author_name`, `author_url`, and `thumbnail_url` with **no API key required** — exactly the fields
add-by-link is missing. This is distinct from the YouTube **Data API search** key used by
auto-suggestion: oEmbed needs **no key, no quota, no secret**.

## Scope

- Resolving **real** title, creator (name + handle + profile URL), and thumbnail for a recognized
  pasted **YouTube** link, via oEmbed (no API key).
- Populating those real values into (a) the **in-modal preview** shown *before* submit, and (b) the
  **persisted clip** media fields — replacing the mock `caption`/`creator`.
- A **graceful, clearly-labeled fallback** when resolution fails (network error, unsupported, or
  offline) — the curator can still proceed to a sensible outcome; the failure is *surfaced*, never
  a silent mock pretending to be real.
- **TikTok** handled per a recorded decision (see *Decisions* below): resolve via TikTok oEmbed if
  practical, else the same graceful labeled fallback (TikTok support is already partial elsewhere —
  ARCHITECTURE notes TikTok auto-suggestion is deferred).
- Preserving **embed-never-host** (we still embed by reference; oEmbed gives us *metadata only*, we
  do not fetch or store the media) and **Wikimedia-style etiquette** (a descriptive User-Agent on
  any server-side fetch we add).
- Keeping the existing **pre-persistence link validation** intact (an unrecognized link still gets
  the "Unrecognized link" error and never reaches persistence).

## Out of scope

- **Auto-suggested candidates.** They already carry real metadata; this spec does not touch the
  candidate pipeline.
- **Embedding / playback itself.** The click-to-load facade and the embed already work from the
  parsed `embedUrl`; this spec changes *labeling/metadata*, not how the video plays.
- **The curator-authored fields** (context note, stance, accuracy flag, section). Those are written
  in the curate form and edited via the Edit modal (D2) — unchanged here.
- **Bulk / batch import** of multiple links.
- **No new persisted schema** — no new column, no shape change to `Clip` / `ClipMediaSource`.
- **No new secret** — oEmbed needs no API key; do not introduce one, and do not change how the
  existing YouTube **Data API** key is handled.
- **No read-path caching work.** This is a write-time, per-add resolution. The deferred production
  read-path (ISR/Redis/`embed_meta` caching) is explicitly out of scope; do not stand up Redis or a
  cache layer for this. (Thumbnail/oEmbed caching is an *open question*, below — not built here.)
- **No auth change.** Add-by-link is already login-gated at the boundary; this spec does not touch
  the auth gate, sessions, or attribution.
- **Instagram.** The parser recognizes Instagram, but it is not in this issue's "YouTube at
  minimum, TikTok per decision" frame; treat an Instagram (or other) recognized-but-unresolved link
  under the same graceful labeled fallback as an unresolved TikTok. Real Instagram resolution
  (token-gated oEmbed — ARCHITECTURE) stays deferred.

## Acceptance criteria

Testable conditions QA & Review verifies against. "Resolve" = obtain real metadata from the
provider's oEmbed; "the preview" = the in-modal preview block shown after "Fetch details" and
before submit; "the persisted clip" = the `Clip` written by the add flow.

- **AC1 — YouTube resolves into the preview (real title + creator + thumbnail).** When a curator
  pastes a recognized YouTube link and triggers detail-fetch, the modal preview shows the **real
  video title** (not "Pasted clip (mock preview)"), the **real creator name**, and a **real
  thumbnail** for that video — all sourced from the resolved metadata, before the curator submits.

- **AC2 — YouTube resolves into the persisted clip.** On submit of that add, the persisted clip's
  `caption` is the real title, its `creator.name` / `creator.handle` / `creator.url` reflect the
  real channel (author name, a real handle derived from it, and the `author_url`), and its
  `thumbnailUrl` is a real thumbnail. The strings **"Pasted clip (mock preview)"**, **"pasted"**
  (as the handle), and **"Pasted {platform} clip"** (as the name) **do not appear** on a
  successfully-resolved clip.

- **AC3 — The preview updates before submit, not after.** The real metadata is visible in the
  modal **before** the curator commits the add (i.e. the curator sees what they're curating). The
  preview's "resolved via oEmbed" claim is only shown when metadata was actually resolved; it is
  not shown over mock/placeholder text.

- **AC4 — Resolution failure falls back to a clear, labeled state (never a silent mock).** When
  resolution fails — provider error, malformed/empty oEmbed response, network failure, or offline —
  the modal shows a **clear labeled** fallback (e.g. "Couldn't fetch video details" with the
  pasted link still visible) rather than presenting placeholder metadata as if it were real. The
  fallback is **distinguishable** from a successful resolve (it must not falsely claim "resolved via
  oEmbed"). The exact fallback copy + treatment is UX's to specify.

- **AC5 — Failure never traps the curator; a graceful outcome is always reachable.** A resolution
  failure does **not** block the modal: the curator can either retry, or proceed with a clearly
  marked unresolved clip (a labeled placeholder caption/creator, not one masquerading as real), or
  cancel. No state leaves the modal stuck with no path forward. *(Whether "proceed unresolved" is
  offered, vs. retry-only, is a UX call — see Open questions; whichever is chosen must satisfy "a
  graceful outcome is always reachable" and "never a silent mock.")*

- **AC6 — TikTok handled per the recorded decision.** A recognized TikTok link is handled per
  *Decisions → D-TikTok* below: it either resolves real metadata via TikTok oEmbed, **or** lands on
  the same clearly-labeled graceful placeholder as AC4/AC5 (with the MVP limitation visible to the
  curator). Either way it never produces a clip that *claims* real metadata it doesn't have, and
  never throws an unhandled error.

- **AC7 — Embed-never-host preserved.** No media file is fetched, stored, or proxied. The clip's
  `embedUrl` / `watchUrl` and the click-to-load facade behavior are unchanged; only metadata text +
  a thumbnail URL (a reference, not a stored image) are populated. oEmbed is used for *metadata*,
  not to host or re-serve video.

- **AC8 — Descriptive User-Agent on any server-side fetch.** If the oEmbed fetch runs server-side
  (server action / route handler — see Open questions), the request sends a **descriptive
  User-Agent / Api-User-Agent** identifying wiki+ and a contact, consistent with the etiquette
  already used by `lib/wiki/article.ts` and the topic-search fetch. (If resolution runs entirely
  client-side, this AC is satisfied vacuously — but the chosen approach must be recorded.)

- **AC9 — Unrecognized links still hit the existing validation (no regression).** A link the parser
  does not recognize still produces the existing **"Unrecognized link — paste a YouTube or TikTok
  URL"** pre-persistence error and **never reaches persistence**. The add path's existing
  precondition (a recognized link must have resolved before submit is enabled) is preserved.
  Distinct from AC4: AC9 is *parse* failure (not a video link at all); AC4 is *resolution* failure
  (a valid link whose metadata couldn't be fetched).

- **AC10 — No schema change, no new secret.** The persisted `Clip` / `ClipMediaSource` shape is
  unchanged (this is a stateless deploy — no migration). No new API key, token, or secret is
  introduced; the YouTube oEmbed call uses no key.

## Success metric

**Primary:** the share of add-by-link clips that carry **real** metadata.
- *Definition:* of clips created via the add-by-link path after this ships, the fraction whose
  `caption` is **not** `"Pasted clip (mock preview)"` and whose `creator.handle` is **not**
  `"pasted"`. **Target: ~100% for YouTube adds** (every YouTube add resolves, save genuine fetch
  failures); a non-trivial mock rate on YouTube adds signals a resolution defect.
- *Leading proxy at prototype scale (low volume):* a manual check that **zero** newly-added YouTube
  clips on live topics read "Pasted clip (mock preview)" — starting with re-curating /
  spot-checking the `Japanese_kitchen_knife` clip that surfaced this issue.

**Guardrail:** the add-by-link flow does not get *less* completable. The rate of started
add-by-link sessions that reach a persisted clip should not drop after this ships — i.e. resolution
failures must not strand curators (AC5). (Analytics-as-a-role is deferred; until then this is a
defined metric Product checks by inspection / store query, not an instrumented dashboard.)

## Decisions to record (resolve in this build loop)

These are decisions the build loop must *land and record* (in this spec and, if architectural, in
`docs/ARCHITECTURE.md`), not leave open.

- **D-YouTube — resolution source.** YouTube metadata comes from **YouTube oEmbed**
  (`https://www.youtube.com/oembed?url=…&format=json`), **no API key**. Map `title → caption`,
  `author_name → creator.name`, `author_url → creator.url`, derive `creator.handle` from the author
  (consistent with how the candidate pipeline derives a handle), and prefer `thumbnail_url` for
  `thumbnailUrl` (falling back to the existing `i.ytimg.com/.../hqdefault.jpg` derivation already in
  the parser). This is **independent of** the YouTube Data API search key.

- **D-TikTok — resolve or graceful placeholder.** Dev/UX decide whether TikTok oEmbed
  (`https://www.tiktok.com/oembed?url=…`) is practical enough to resolve real metadata in this loop.
  If yes, TikTok resolves like YouTube (AC6 first arm). If not practical (CORS, script/embed
  fragility, reliability), TikTok lands on the **clearly-labeled graceful placeholder** (AC6 second
  arm), with the MVP limitation visible to the curator — consistent with TikTok being already
  partial in the product (auto-suggestion deferred per ARCHITECTURE). **Record which arm was
  chosen** in this spec or ARCHITECTURE. Either arm satisfies AC6.

## Open questions for later refinement

- **Where the fetch runs — client vs. server (CORS).** A browser oEmbed fetch to
  `youtube.com/oembed` may hit **CORS**; resolving via a small **server action / route handler** is
  a legitimate option and is the natural place to attach the descriptive User-Agent (AC8). This is a
  **UX/Dev call** — either is acceptable as long as the ACs hold; it stays a **stateless** change
  (no schema, no secret). Record the chosen approach.
- **The exact "proceed unresolved" affordance** (AC5): retry-only vs. an explicit "add anyway with
  a labeled placeholder" path, and the precise fallback copy/treatment. UX owns this.
- **Thumbnail / oEmbed caching & expiry.** Whether to cache resolved metadata (e.g. the deferred
  `embed_meta` cache, oEmbed thumbnail expiry/CDN-host changes) is a **production read-path**
  concern, explicitly out of scope here; revisit when the production caching layer lands.
- **Handle quality.** oEmbed gives `author_name` + `author_url` but not always a clean `@handle`;
  the derived handle should be good enough to label a card, with handle normalization a possible
  later refinement.

## Hand-off

- **UX / Design** — update the "Add a video" modal flow for the *resolved* preview state (real
  title/creator/thumbnail) and, crucially, the **resolution-failure** states (AC4/AC5): the labeled
  "couldn't fetch details" treatment, whether/how a curator may proceed unresolved, and the
  TikTok-limitation messaging if D-TikTok lands on the placeholder arm. Reconcile against the
  existing modal copy that currently (mis)states "resolved via oEmbed" and "we … mock a preview —
  no network call." These flows feed Development.
- **Development** — populate real `caption` / `creator` / `thumbnailUrl` into `ClipMediaSource` from
  a YouTube oEmbed resolve (replacing the `mediaSource()` mock), wire the resolve into the
  "Fetch details" step so the preview updates before submit, implement the graceful fallback, decide
  + record the CORS approach (client vs. server action) and the D-TikTok arm, and keep the
  pre-persistence validation intact. **No migration, no new secret** — stateless deploy. Tests:
  parse → resolve → fallback, and the no-regression of the unrecognized-link path. Hand to QA &
  Review.
