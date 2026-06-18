# wiki+ — Curation Standard

- **Status:** v1, committed (Phase 2 / Curation-Editorial, build-loop for Topic Page v1)
- **Owner:** Curation / Editorial
- **Inputs:** `docs/VISION.md`, `docs/specs/topic-page-v1.md`, `docs/TOPIC_PAGE_DESIGN.md`,
  `docs/ARCHITECTURE.md`, reference mockups `mockups/inline-indigo-sync.html` /
  `inline-indigo-empty-v2.html` and their data (`mockups/data/content.js`,
  `content-empty.js`).
- **Feeds:** UX (form fields + microcopy), Development (schema enums + limits), Product
  (policy → roadmap/criteria).

This is the source of truth for **what good curation is** on wiki+: the context-note
standard, the controlled **stance** and **accuracy** vocabularies that render as chips, the
attribution and creator-credit norms, the unvetted-candidate rule, and the moderation
posture. UX embodies it in form fields and microcopy; Development encodes the vocabularies
as schema enums and enforces the limits; a reviewer judges notes against it.

The standard is deliberately scoped to what **this build** needs to be correct. Where a
choice was not settled by the mockups, it is recorded below as a **Decision** so Product and
UX can react.

---

## 1. The context-note standard

The **context note** is wiki+'s original contribution and the core of the product (VISION
§"Core concepts"). It is the curator's human-written contextualization of a clip: it tells a
reader **what in the clip is established fact, what is the creator's opinion or framing, how
reliable the clip is, and why it is worth their time** for this section of the article.

A note is not a summary of the video and not a review-score. It is the editorial bridge
between an engaging-but-unvetted creator clip and the encyclopedia article beside it.

### 1.1 What a good note must do

A passing note does **all** of the following:

1. **Separate fact from the creator's take.** State plainly which claims in the clip are
   established/article-supported and which are the creator's opinion, framing, emphasis, or
   self-presentation. This is the non-negotiable core — a note that does not draw this line
   fails, regardless of how well-written it is. (VISION: "separates the creator's take from
   the established facts.")
2. **State relevance to this section.** Say why the clip is worth watching *here* — what it
   adds that the article text does not (a visual, a worked example, a demonstration, a
   plain-language on-ramp), and who it is best for.
3. **Flag reliability honestly.** Name the clip's limits as well as its strengths:
   simplifications, omissions, dated visuals, exam-narrow framing, things to pair with the
   article. The accuracy chip (§3) is the machine-readable summary of this; the note carries
   the human nuance.
4. **Be specific to *this* clip.** Reference what actually happens in it (the analogy used,
   the step it covers, the footage it shows), not boilerplate that would fit any clip.

### 1.2 What a good note must not contain

- **Promotion or hype.** No "amazing," "must-watch," clickbait, or affiliate/creator
  promotion language. Enthusiasm is fine; salesmanship is not.
- **Unsupported factual claims by the curator.** The note adds *context*, not new
  encyclopedic facts. If a correction is needed, frame it as "the clip says X; the article's
  *Section* explains Y," not as the curator's own authority.
- **Personal attacks on the creator.** Critique the content, not the person. "Light on
  mechanism" is fine; disparaging the creator is not.
- **Copy-paste of the video title/description** as the note. That is metadata, not
  contextualization.
- **Anything that depends on color or chips to be understood.** The note must stand on its
  own as text (see §4).

### 1.3 Length & tone

- **Length:** roughly **1–3 sentences, ~40–320 characters** of body text. Long enough to
  draw the fact/opinion line and state relevance; short enough to read at a glance beside the
  article. (The reference clips run ~120–320 chars; treat **320 as the soft cap UX should
  size the card for** and Development should set as the field maxlength. A hard ceiling
  prevents notes from becoming essays.) **Decision C1.**
- **Tone:** plain, neutral, editorial — the register of a knowledgeable librarian, not a fan
  and not a critic. Wikipedia's neutral-point-of-view spirit applies to *our* prose even
  though we are describing opinionated source video.
- **Person:** write about the clip and creator in the third person; do not address the reader
  as "you" beyond light guidance ("a good first watch").

### 1.4 Exemplars (from the committed mockup; these pass)

> "Hank Green's energetic, accurate run through the whole process — best once you already
> have the gist. Covers both the light-dependent and light-independent reactions at speed.
> This is the 2012 Crash Course Biology episode, so the visuals predate the newer Crash
> Course Botany series."
> — *Why it passes:* names the creator's strength (accurate, energetic), states who it's for
> and when, flags a real limit (dated visuals) honestly, specific to the clip.

> "Made for young children — bright and narrative. Accurate at a high level but deliberately
> omits the light/dark-reaction split and the biochemistry. A gentle intro for newcomers, not
> a study source."
> — *Why it passes:* separates "accurate at a high level" (fact) from the framing choice
> ("made for young children," "deliberately omits"), states relevance and audience, honest
> about the limit.

> "Not an explainer but a live demonstration: oxygen bubbles streaming off an aquatic plant
> under light — photosynthesis you can actually see. A genuine primary-source visual for the
> oxygen-evolving (water-splitting) step."
> — *Why it passes:* sets expectations (not an explainer), states the unique value (you can
> see it), anchors to the exact mechanism, specific.

### 1.5 Anti-patterns (these fail)

- *"Great video, you have to watch this one!"* — hype, no fact/opinion line, no relevance,
  not specific. **Fail (§1.1.1, §1.2).**
- *"Photosynthesis is how plants make food from sunlight."* — restates the topic; says
  nothing about the clip, its reliability, or the creator's take. **Fail (§1.1.1, §1.1.4).**
- *"This creator clearly doesn't understand biology."* — personal attack; asserts a judgment
  without drawing the fact/opinion line in the content. **Fail (§1.2).**
- *"Covers the Calvin cycle, light reactions, and chlorophyll."* — a contents list (metadata),
  not contextualization; no reliability signal, no fact/opinion separation. **Fail
  (§1.1.1, §1.1.3).**

---

## 2. Stance vocabulary (the stance chip)

`stance` is a **fixed controlled enum** describing **what kind of clip this is / how to read
it**. It is the indigo chip in the design. **Decision C2:** stance is a closed vocabulary,
**not** free-form — this is required for consistent filtering, for the empty-state/curated
distinction, and for any future AI-assisted drafting (ARCHITECTURE open question, now
resolved here and recorded in ARCHITECTURE §"Open questions").

A clip carries **exactly one** stance value. An optional **free-form `stance_modifier`**
(≤24 chars, e.g. "kids", "AP-level", "primary") may be displayed after the label as
"*Label · modifier*", reproducing the mockup's display strings without polluting the enum.
The modifier is **display sugar only** — never filtered on, never required.

| Value (enum) | Label (chip text) | Definition |
|---|---|---|
| `explainer` | **Explainer** | Teaches the topic — walks through mechanism, concepts, or process. The default for instructional content. |
| `short` | **Short** | A very brief clip (Short/Reel format): a hook, definition, recap, or summary that compresses by design. Read as a teaser, not a full explanation. |
| `demonstration` | **Demonstration** | Shows a phenomenon or experiment happening — primary visual evidence rather than narrated teaching. |
| `classroom` | **Classroom** | Recorded teaching aimed at a specific course/exam context; framing reflects a syllabus, not a general audience. |
| `opinion` | **Opinion** | Led by the creator's argument, take, or perspective — the point of the clip is the view, not neutral exposition. |
| `myth_busting` | **Myth-busting** | Frames itself against a common misconception; corrects or debunks. |
| `personal_experiment` | **Personal experiment** | The creator tries something themselves; value is the first-person attempt, with the creator's interpretation attached. |

**Reconciliation vs. mockups.** The mockup display strings (`Explainer · conceptual`,
`Short · exam recap`, `Demonstration · primary`, `Classroom`, …) map onto this enum as
**base value + modifier**: everything `Explainer · *` → `explainer`; every `Short · *` →
`short`; `Demonstration · primary` → `demonstration` + modifier "primary"; `Classroom` →
`classroom`. The mockups never showed `opinion` / `myth_busting` / `personal_experiment`
(Photosynthesis is a benign, consensus topic), but they are core to the product thesis
(VISION: creators "blend personal opinion and perspective with factual content") and are
**retained** so the vocabulary works on contested topics. The provisional `lib/data/types.ts`
enum (`explainer | opinion | myth-busting | personal-experiment | primary-source`) is
superseded by this set: `primary-source` becomes the **`demonstration`** stance (primary
*footage* is a stance) and/or the **`primary_source` accuracy value** (§3) — see Decision C4.

---

## 3. Accuracy vocabulary (the accuracy chip)

`accuracy_flag` is a **fixed controlled enum** describing **how well the clip matches
established/source material** — the honest reliability signal. It is the colored chip whose
buckets are committed in `TOPIC_PAGE_DESIGN.md` §"Fact-vs-opinion signal." **Decision C2**
applies: closed vocabulary, not free-form, for the same filtering/consistency/AI reasons.

A clip carries **exactly one** accuracy value. As with stance, an optional free-form
**`accuracy_modifier`** (≤24 chars: "fast-paced", "simplified", "big-picture", "exam-framed",
…) may render after the label as "*Label · modifier*", reproducing the mockup strings.
**Modifier is display only**; the enum value carries the meaning and the color.

| Value (enum) | Label (chip text) | Color (per design) | Definition |
|---|---|---|---|
| `accurate` | **Accurate** | teal `#2A8270` | Matches the established material; no notable errors or distorting omissions. |
| `accurate_with_caveat` | **Accurate, with a caveat** | action blue `#1F6F95` | Correct but **simplified, condensed, big-picture, exam-framed, or fast-paced** — true as far as it goes, with a limit the note must name. |
| `primary_source` | **Primary footage** | teal `#2A8270` | Real footage of the phenomenon (a demonstration / live capture) rather than a claim to fact-check; reliability is "this is genuinely what it shows." |
| `opinion` | **Opinion** | red `#C44949` | The clip's substance is the creator's view/argument/anecdote — weigh as perspective, not as established fact. Carries a mild "weigh this" tone, **not** "wrong." |
| `mixed` | **Mixed** | red `#C44949` | Blends accurate content with errors, overreach, or unsupported claims; parts hold up, parts do not — the note must say which. |
| `misleading` | **Misleading** | red `#C44949` | Technically-defensible pieces assembled to leave a false overall impression, or material omissions that distort. |
| `inaccurate` | **Inaccurate** | red `#C44949` | Contains clear factual errors against the established material. (Curated only when worth showing *with* the correction in the note — e.g. a popular-but-wrong clip readers will meet anyway.) |

**Reconciliation vs. mockups.** Every mockup accuracy string collapses to one of these:
`"Accurate"`, `"Accurate · academic/AP-level/thorough"` → **`accurate`**; `"Accurate but
simplified"`, `"Accurate · fast-paced / condensed / big-picture / definitional /
beginner-friendly / exam-framed / ultra-condensed / teaching context"` → **`accurate_with_caveat`**
(qualifier becomes the modifier); `"Real footage · phenomenon"` → **`primary_source`**. The
mockups carried no red-group examples (benign topic); `opinion` / `mixed` / `misleading` /
`inaccurate` are retained from the design's red bucket and the product thesis so honest
flagging is possible on contested clips. The design doc's open note ("red for the opinion
group is provisional; revisit if it reads as 'error'") is addressed by **Decision C3**: the
red group is split so `opinion` (weigh-as-perspective) is **labeled distinctly** from
`mixed`/`misleading`/`inaccurate` (real reliability problems) — same color family, different
text — so color is never the sole carrier of that difference (§4).

> **Note for UX/Dev — color is a *secondary* cue.** Per §4, the **label text** is the signal;
> the color (teal / blue / red) reinforces three coarse tiers (sound · sound-with-a-limit ·
> weigh-carefully). Confirm **AA contrast** for every chip text-on-fill combination
> (TOPIC_PAGE_DESIGN.md and AC21 require it).

---

## 4. Text-label + non-color rule (accessibility)

**Every fact-vs-opinion signal must carry a text label and must never rely on color alone.**
This restates AC21 and the CLAUDE.md/TOPIC_PAGE_DESIGN.md accessibility baseline as a curation
standard, because the signals are *our* editorial output, not just UI decoration.

- Each stance chip and accuracy chip renders its **Label** text from §2/§3 (plus optional
  modifier). The label is always present and legible; a reader who cannot perceive the chip
  color, or who is reading via a screen reader, gets the full meaning from the words.
- Color (indigo for stance; teal / blue / red for accuracy tiers) is a **reinforcing**
  signal only. Two values in the same color (e.g. `opinion` vs `misleading`, both red) must be
  **distinguishable by their label text**, never by shade alone (**Decision C3**).
- The **canonical label text** each value uses is the **Label** column in §2 and §3.
  Development should derive chip text from the enum value via a single label map (so the label
  text is consistent everywhere); UX writes no alternate label strings.
- Chips need an accessible name in the DOM (e.g. visible text, or `aria-label` echoing the
  label) and chip text must meet **WCAG AA** contrast against its fill.

---

## 5. CC BY-SA + creator-credit norms

These set *what* attribution must appear and *how* creators are credited. UX places it and
Development renders it; this section is the standard they implement against.

### 5.1 Wikipedia article attribution (CC BY-SA)

On **every view that shows Wikipedia article content**, the article side must render
**attribution to Wikipedia under CC BY-SA**, with a link to the source article (AC4,
ARCHITECTURE §"Licensing & attribution"):

- Visible credit line on the article column: **"From Wikipedia"** with the **CC BY-SA 4.0**
  license named and a **link to the source article** (and, where practical, its
  history/license page). The committed wording is **"From Wikipedia · CC BY-SA 4.0"**
  (TOPIC_PAGE_DESIGN.md §Layout).
- The topic's **Wikidata QID** is shown on the article side (AC4).
- **Wikimedia Commons images** displayed in the article carry their **own** credit + license +
  file-page link — the article text license does **not** cover its images. (In this build the
  article body is fetched client-side and Commons figures render inline with their captions;
  preserve the figure's source/credit link from the article HTML rather than stripping it.)
- Share-alike obligations attach to any **derivative article text** we publish. Our context
  notes are about the clip, not derivatives of the article text, so this primarily means: do
  not relicense or obscure the article's CC BY-SA status.

### 5.2 Creator credit (reference, never host)

Creators are **external people we reference and credit, never host** (VISION; ARCHITECTURE
"embed, never host"). Every curated clip must visibly credit its creator:

- **Display name + handle + platform** are shown on the card (AC9): e.g. "Crash Course ·
  @crashcourse · YouTube". Platform is named in words (not by icon alone — §4 spirit).
- The creator's **avatar** and (where known) **follower count** may accompany the credit
  (design supports them); they are enrichment, not a substitute for the name/handle/platform.
- The credit **links out** to the creator/clip on its platform; wiki+ does not present the
  video as its own. Playback is **click-to-load / embed-never-host** (AC11).
- We **do not** imply creator endorsement of wiki+ or of the curator's note. The context note
  is clearly wiki+'s editorial voice, distinct from the creator's content.

### 5.3 License of wiki+ context notes — **Decision C5 (closes an ARCHITECTURE open question)**

**Context notes (and the curator-authored stance/accuracy assessments) are released under
CC BY-SA 4.0** — the same license as the surrounding Wikipedia content.

- *Rationale:* share-alike keeps our editorial layer **compatible with and reusable alongside**
  the Wikipedia text it sits beside, matches the Wikimedia-adjacent ethos, and prevents a
  curator's note from being enclosed. It is the "natural fit" ARCHITECTURE flagged.
- *Attribution of notes:* a context note is attributable to its **curator/contributor** (the
  wiki+ identity), distinct from the **creator** of the video — see §5.2. The note-license
  agreement is the **curator's** act over **their own note**; it is **not** a creator
  attribution and must never be conflated with crediting the video's creator. The creator
  agreed to nothing here: we reference and credit them (§5.2); the curator licenses their note
  (this section). The public realization of this attribution is the **"context by &lt;curator&gt;"**
  line specified in **§5.4**.

### 5.4 Public "context by &lt;curator&gt;" attribution — **Decision C7** (realizes §5.3 in public)

§5.3 said the build should be "ready to show 'context by &lt;curator&gt;'." With a real
contributor identity now persisted, that attribution becomes **public, visible, and browsable**.
This subsection fixes the editorial contract UX and Development implement against; it does not
reopen §5.2/§5.3.

- **Canonical microcopy.** The curator attribution on a curated clip reads exactly:
  **"context by &lt;username&gt;"** — lowercase "context by", followed by the curator's public
  Wikimedia username (`clip.curatedBy`). The username is the link target/text; "context by" is
  the fixed, always-present label. Use this string verbatim (UX writes no alternate phrasing).
  The word "context" carries the meaning, never color alone (§4); the link is keyboard-operable
  with an accessible name (e.g. "context by &lt;username&gt;, view their curations").

- **The load-bearing rule — curator attribution and creator credit must stay distinct.** On every
  public surface (the clip card, the General-band tile, the profile), the **curator attribution**
  and the **creator credit** are two separate, non-mergeable things, and a reader must never
  conflate "who made the video" with "who wrote the note":
  - **Creator credit (§5.2)** names the *video's maker* (display name + handle + platform) and
    **links OUT** to that creator on their platform. It is unchanged by D3.
  - **Curator attribution (§5.3, this section)** names the *wiki+ curator who wrote the note* and
    **links IN** to that curator's wiki+ profile (`/contributor/<username>`).
  - **Direction is the editorial tell:** creator credit points *out* to the platform; curator
    attribution points *in* to wiki+. The two must be **visually and textually distinct** and
    must never be merged into one line, share one link, or imply the creator wrote the note (or
    the curator made the video). The "context by" wording does this work textually; UX places
    them so the distinction is also visual.

- **Public profile exposes only public identity.** A curator's profile (`/contributor/<username>`)
  is a **public attribution surface**: it may show only what the contributor presents publicly —
  their **Wikimedia username** (the public handle) and their **avatar if one was granted**. It must
  **never** expose non-public profile data — in particular **email**, or any other private OAuth
  profile field — in the page, the read's return shape, or the client bundle. A public attribution
  page asserts "here is a curator and the clips they vouched for," not the person's contact
  details. (This is the editorial basis for the spec's AC2.)

- **Legacy `@prototype` provenance label.** The seeded `@prototype` stub is a placeholder, not a
  real curator with a voice or a browsable profile (C Decision D6; spec Decision 4). A clip
  attributed to it must **not** show a linked "context by" attribution implying a real author.
  Instead it shows a **non-linked** provenance label, verbatim: **"seed clip · no curator"**. This
  is honest about provenance (it was seeded, not vouched for by a person), implies no real curator
  or voice, and carries **no link** (no dead or misleading profile link). It is plainly distinct
  from a real "context by &lt;username&gt;" attribution.
- *Contributor agreement — required and captured (resolves the C5 "capture arrives with
  persistence" carry-open):* a contributor must **affirmatively agree to release their context
  note under CC BY-SA 4.0 at the moment they publish**. This is a **required precondition of
  the write**, not a passive notice: publishing is blocked until the curator agrees, on both
  the Promote ("Curate this clip") and Add-video modals.
  - **Canonical microcopy (UX uses these strings verbatim on both modals):**
    - *License statement* (always visible at the submit control): **"Your context note will be
      released under CC BY-SA 4.0."**
    - *Required agreement act* (the checkbox label / equivalent affirmative control):
      **"I agree to release my context note under CC BY-SA 4.0."**
  - **What the captured agreement must editorially bind (the standard behind AC7 / Decision
    D1-1):** the persisted record must tie the agreement to **this note, by this contributor,
    under this license version, at this time** — i.e. it captures (a) that the contributor
    agreed, (b) the license identifier/version `CC-BY-SA-4.0` (a version string, not a bare
    boolean, so a future license bump is expressible), and (c) the agreement timestamp, bound
    to the clip and its contributor. A per-submit (per-note) capture is required; an
    account-level "I agree to license all my contributions" toggle does **not** satisfy this
    standard, because it would not bind the agreement to the specific note text and time. The
    persisted *shape* (columns vs. a record) is Development's call; the *facts bound* are fixed
    here.
  - **On a future edit (forward note for D2 — not D1 scope):** a **material change to the note
    text re-affirms the agreement** (a new note license act + timestamp), since the agreement
    binds to the note as published. A trivial/typo fix or a stance/accuracy chip change that
    leaves the note text substantively unchanged does **not** require re-affirmation. D2 sets
    the edit mechanics; this is the standard's position so D2 need not reopen it.

---

## 6. Unvetted-candidate rule

Auto-suggested **candidates** (the empty-state suggestions, and any uncurated suggestion) are
**not curated clips** and must be rendered as visibly un-vouched-for (AC15, AC16;
TOPIC_PAGE_DESIGN.md §Empty state; ARCHITECTURE §Candidate suggestion). As a curation
standard:

- A candidate carries **no stance chip and no accuracy chip** — those signals are *earned by
  curation* and asserting them on un-reviewed content would be a trust violation.
- A candidate carries **no context note**. In its place it shows an **auto-suggest reason**
  (`match_reason`): why it matched (e.g. *"Mentions 'light-dependent reactions' in
  description"*, *"YouTube search 'photosynthesis explained'"*). The "no context yet — a human
  hasn't reviewed this" message that makes the absence explicit and invites curation is asserted
  **once per context** (in the set header / band / panel), not repeated on every card (issue #14
  declutter); the candidate's own source is shown as a small text-labeled pill.
- A candidate is **visually unmistakable** from a curated clip: dashed (not solid) border, no
  solid offset shadow, desaturated/hatched thumbnail (AC15). The visual distinction is UX/Dev's
  to render; the **rule that the distinction must exist, and that chips/notes must be absent on
  candidates, is the standard**. (The per-card "SUGGESTED" badge that earlier renderings used was
  removed in #14 — the dashed container plus the once-per-context "Suggested · uncurated" headers
  carry the signal — but the *requirement that candidates read as un-vouched-for* is unchanged.)
- A candidate becomes a curated clip only by **promotion**: a human writes the context note
  and sets stance + accuracy to this standard (then it earns its chips). Until then it is a
  suggestion, not an endorsement.

> **A candidate is not the same not-curated thing as a *held* clip (§7.1).** A candidate is
> auto-found and has *no* human behind it (no note, no chips, no curator) — its honesty is
> "no one has looked at this." A **held** clip is the reverse: a real curator *did* vouch
> (it keeps its note, chips, and curator attribution) but the vouch has **not yet been
> confirmed by a reviewer**. Both are "not yet fully curated," but for opposite reasons, and
> they must be **distinguishable from each other and from a fully-curated clip** (§7.1, §4).
> The candidate language below ("Suggested · uncurated") is for candidates **only** — a held
> clip never uses it.

---

## 7. Abuse / spam / moderation policy

Full enforcement (rate limits, login-gating, moderation tooling) lands with auth and
persistence and is **Operations'/Development's to build**; this section sets the **policy**
those mechanisms enforce. (ARCHITECTURE open question "Abuse/spam handling," addressed at the
policy level here.)

- **Contribution is gated by login; reading is anonymous.** Curate / Add-video / write-a-note
  require a logged-in (OAuth/Wikimedia) identity (VISION non-goals; ARCHITECTURE §Auth). Login
  gating buys us **accountability** (an action ties to an identity), a **moderation signal**
  (e.g. account age / edit count), and a natural **rate-limit subject**. (In the current
  prototype these are UI entry points only — A7; the policy is stated for when persistence
  lands.)
- **Removable content** (a curator/moderator may remove, or it may be rejected at submission):
  spam and self/affiliate promotion; clips with no genuine topical relevance; context notes
  that violate §1.2 (hype, personal attacks, unsupported curator claims, copied metadata);
  hateful, harassing, or illegal content; manipulated/deceptive media presented as genuine
  without disclosure; copyright-circumventing embeds (we embed official sources only).
- **Honest flagging is allowed, not removable.** A clip that is `opinion`, `mixed`, or even
  `inaccurate` is **legitimately curatable** when the context note does the work of weighing
  it (§3). We curate *with* context; we do not hide opinionated or imperfect clips — we
  contextualize them. Removal is for abuse, not for disagreement.
- **Rate-limit posture (for Ops/Dev to implement):** per-identity write limits (Redis-backed)
  to blunt spam floods; a light **`vetted` hold** is available to queue a freshly added clip
  for review before it shows as fully curated (the `clip.vetted` flag already exists in the
  data model). MVP-appropriate; reputation/roles scale later (VISION "Possible future
  directions").
- **Wikimedia etiquette applies to our fetches**, not just contributions: descriptive
  User-Agent, respect rate limits / `maxlag`, lazy caching (CLAUDE.md; ARCHITECTURE
  §Wikipedia integration) — abuse of the upstream APIs is also out of bounds.

### 7.1 The review-hold — the "held" third state (Decision C8)

§7's posture ("a light `vetted` hold is **available** to queue a freshly added clip for
review before it shows as fully curated") is realized as a workflow in milestone D5b (spec
`docs/specs/vetted-review-hold.md`). This subsection is the **editorial contract** for what a
held clip *means* and *reads as* — UX renders the weight, Dev/QA know what the state asserts.
It does not reopen §7's posture (the hold exists; contribution is gated; reading is anonymous)
or §6 (candidates).

**What "held" means editorially — the third clip-state.** A held clip is a **real curated
clip whose vouch has not yet been confirmed**. A curator wrote a context note (§1) and set the
stance/accuracy chips (§2/§3) — so a held clip **keeps all of them**, plus its curator
attribution (§5.4) — but a **reviewer has not yet approved it**, so it does **not** carry the
site's full vouch. It is a third state, and its trust weight sits **between** the other two:

| | A fully-curated clip | A **held** clip (§7.1) | An unvetted candidate (§6) |
|---|---|---|---|
| Context note | yes | **yes** | no |
| Stance / accuracy chips | yes | **yes** | no |
| Named curator behind it | yes | **yes** | no (auto-found) |
| Reviewer-confirmed vouch | yes | **not yet** | n/a — no vouch to confirm |
| Honest tell to the reader | "a person vouched for this and it passed review" | "a person vouched for this; **the vouch is still in review**" | "no one has reviewed this yet" |

So a held clip differs from **(a)** a fully-curated clip in *one* thing only — the vouch is
unconfirmed, not the content — and from **(b)** a candidate in *almost everything* — a held
clip has a human's full curation; a candidate has none. The reader must be able to tell all
three apart, **from the text/marking, never color alone** (§4). This is the standard behind
spec AC1/AC2.

**The held-state marking — canonical microcopy (UX uses verbatim; Dev derives from the held
flag).** A held clip shows a short, text-labeled, non-alarming marking. It must read as
"in review," **never** as "this was removed / this is bad" (see the boundary below). It must
be **distinct from** the §6 candidate language ("Suggested · uncurated"), because a held clip
is not a candidate.

- **Eyebrow label (the chip/badge text), verbatim:** **"In review · not yet vouched"**
  — the canonical short marking on the held clip's card and General-band tile. "In review"
  carries the meaning as a *word* (§4 — not color-alone); "not yet vouched" ties it to the
  vouch language §6 already uses ("Curate one to vouch for it") and keeps the tone calibrated
  ("not *yet*"), not punitive.
- **One-line explainer (where space allows — the held echo of §6's once-per-context line),
  verbatim:** **"A curator added this and wrote a note, but it hasn't passed review yet —
  weigh it accordingly."** This is the honest tell from the table above; it states the
  calibrated-trust value plainly and is the held analogue of §6's "No context notes yet — a
  human hasn't reviewed these."
- **Accessible name** for the marking (e.g. `aria-label` / `sr-only`), verbatim:
  **"In review — not yet vouched for by a reviewer."**
- **Tone guard:** no alarm words ("flagged," "rejected," "warning," "problem"), no color as
  the sole signal, gold is not a functional signal (CLAUDE.md). The marking is a *neutral
  status*, the register of §1.3 (a knowledgeable librarian: "this is still being checked").

**Who may hold / who may approve — the accountability line (confirms spec Decision 3).** This
split is the right editorial line and follows directly from §7's accountability rationale
("login gating buys us accountability — an action ties to an identity") and §5.4's
vouch-is-attributable principle:

- **Hold** (move a clip into review, `vetted → held`) may be done by **a moderator/reviewer on
  any clip**, **or by the clip's own curator on their own clip**. A curator holding their own
  clip is the editorial parallel of §5.4/D2's "a curator may revise or retract **their own**
  vouch" — pulling your own clip into review is a self-limiting act (you can only hold what you
  authored), so it needs no privileged role.
- **Approve** (confirm the vouch, `held → fully curated`) is **moderator/reviewer only — a
  curator may not approve, including their own held clip.** This is the load-bearing editorial
  rule: **the vouch must be confirmed by someone other than the person who made it.** Approval
  is the act of granting the site's full vouch; if a curator could clear their own hold, the
  hold would assert nothing and the "reviewed" signal would be hollow. Independent confirmation
  is exactly what makes the held → curated transition trustworthy. (A curator who has second
  thoughts about their own held clip uses D2 edit/delete; *restoring* the full vouch is a
  reviewer's call.)

**Held is a review pause, not a removal — keep the two editorially distinct.** A hold is
**not** the §7 "removable content" abuse mechanism (that is milestone D5c). The two must never
read as the same thing:

- A **hold** is a **reversible review pause**, available for **any reason a reviewer (or the
  curator) wants a second look** — a fresh add a contributor is unsure of, a clip a reviewer
  wants to check before it carries the full vouch, a borderline note. It asserts **"not yet
  confirmed,"** not "this is bad." A held clip stays visible (shown-but-marked, spec Decision
  3b) and a moderator can flip it live at any time.
- **Removal** (§7 "Removable content") is for **abuse** — spam, promotion, hate/harassment,
  §1.2 violations, deceptive media — and is the §7 line "**removal is for abuse, not for
  disagreement.**" Removal is **not** the hold's job, and a held clip must **never** read as
  "this was removed/rejected." The marking copy above is chosen specifically so a held clip
  reads as *in review*, never as *judged and found wanting*. (A clip that is honestly
  `opinion` / `mixed` / `inaccurate` is **legitimately curatable** — §7 — and being held is
  about *review status*, not about the accuracy flag's value.)

---

## 8. Decisions log (for Product / UX / Dev to react to)

| ID | Decision | Why / impact |
|---|---|---|
| **C1** | Context note **~40–320 chars**, 1–3 sentences (soft cap 320). | UX sizes the card and writes a counter; Dev sets the field maxlength. |
| **C2** | `stance` and `accuracy_flag` are **fixed controlled enums**, not free-form. | Resolves the ARCHITECTURE open question. Enables filtering, consistency, future AI-assist. Dev encodes as schema enums. |
| **C3** | The accuracy **red group is split by label** (`opinion` vs `mixed`/`misleading`/`inaccurate`); same color, distinct text. | Closes the design doc's "red reads as error?" open note; satisfies the non-color rule (§4). |
| **C4** | The provisional `primary-source` becomes the **`demonstration` stance** and the **`primary_source` accuracy** value. | A primary clip is *a kind of clip* (stance) and *a reliability mode* (accuracy); the mockup's "Demonstration · primary" + "Real footage" needs both. Dev updates `lib/data/types.ts`. |
| **C5** | wiki+ **context notes are licensed CC BY-SA 4.0**; the contributor's agreement is a **required precondition of publishing** and is **captured per-submit** (license version + timestamp, bound to this note + contributor). The note-license agreement is the *curator's* act, distinct from *creator* credit (§5.2). | Closes the ARCHITECTURE open question and the "capture arrives with persistence" carry-open. UX uses the §5.3 canonical agreement strings (required control, not a passive line); Dev captures per D1-1 / AC7. |
| **C6** | Stance/accuracy support an optional **free-form modifier** (≤24 chars) shown after the label, never filtered on. | Reproduces the mockup display strings ("Accurate · fast-paced") without breaking the enum. Dev adds `stance_modifier` / `accuracy_modifier` optional fields; UX renders "Label · modifier". |
| **C7** | The §5.3 attribution is realized in public as **"context by &lt;username&gt;"** (verbatim), linking IN to the curator's wiki+ profile — **distinct** from the §5.2 creator credit, which links OUT to the platform. The public profile exposes **only** public identity (username + granted avatar), **never email**. A `@prototype` clip shows a non-linked **"seed clip · no curator"** label, no profile link. | Realizes §5.3 / §5.4 for the D3 public attribution + profile (spec #54). UX uses the canonical strings verbatim and keeps curator attribution visually/textually distinct from creator credit; Dev links "context by" to `/contributor/<username>`, suppresses the link for the `@prototype` stub, and ensures the profile read never selects/serializes email (AC2/AC6). |
| **C8** | The §7 review-hold is defined as the **"held" third clip-state** (§7.1): a real curated clip — note + chips + curator intact — whose **vouch is not yet reviewer-confirmed**; distinct from a fully-curated clip (vouch confirmed) and a §6 candidate (no human behind it). Canonical marking microcopy, verbatim: eyebrow **"In review · not yet vouched"**; explainer **"A curator added this and wrote a note, but it hasn't passed review yet — weigh it accordingly."**; a11y name **"In review — not yet vouched for by a reviewer."** **Hold** = moderator (any clip) OR the curator (own clip); **approve** = moderator-only (no self-approve — the vouch is confirmed by someone other than its author). A hold is a **reversible review pause, not the §7 abuse removal** (that is D5c) — it must never read as "removed/bad." | Realizes §7's review-hold posture + §6's not-vouched-for language for D5b (spec `vetted-review-hold.md`). UX uses the canonical strings verbatim and keeps the held state distinct (by text, never color-alone — §4) from both a curated clip and a §6 candidate; Dev derives the marking from the held flag and gates approve on moderator-only / hold on moderator-or-own-curator server-side; the held marking carries no alarm/removal tone. |

---

## 9. Hand-off — what each role needs from this standard

- **UX (design spec + microcopy):** context-note form field sized to §1.3 (1–3 sentences,
  ~320-char soft cap) with a live counter and the §1 helper text; the two chips rendering the
  §2/§3 **Label** text (+ optional modifier) per §4; the CC BY-SA article line (§5.1) and
  creator credit (name + handle + platform, §5.2); the §5.3 **required** submit-time license
  agreement using the canonical strings (license statement + agreement-act label, verbatim);
  the
  candidate treatment showing `match_reason` + "no context yet" and **no chips** (§6); and the
  **held third state** (§7.1) — a curated clip (note + chips + curator intact) marked with the
  verbatim **"In review · not yet vouched"** eyebrow (+ the explainer / a11y name strings),
  text-labeled and AA, distinct from both a fully-curated clip and a §6 candidate, with the
  reviewer-only **Hold** / **Approve** affordances (hold: moderator-or-own-curator; approve:
  moderator-only).
- **Development (schema + limits):** encode the §2 stance enum and §3 accuracy enum as the
  controlled vocabulary in `lib/data/types.ts` (replacing the provisional sets), with a single
  enum→label map driving chip text (§4); add optional `*_modifier` fields (C6); enforce the
  note length (C1); ensure candidates carry no stance/accuracy/context (§6); render attribution
  per §5; for the **held state** (§7.1) derive the marking from the clip's held flag (the
  verbatim §7.1 strings), keep the note/chips/curator intact, and gate the two actions
  server-side — **approve = moderator-only**, **hold = moderator OR the clip's own curator**.
- **Product (policy → roadmap/criteria):** the moderation policy (§7) and the licensing
  decision (§5.3) become roadmap items when auth/persistence land; the note standard (§1) is
  the **definition of "good curation"** Product/Analytics will later measure against.
