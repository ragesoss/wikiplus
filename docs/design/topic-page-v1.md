# Design Spec: Topic Page v1 — the curated "Indigo Press" Topic page

- **Status:** v1, committed (Phase 2 / UX, build-loop for Topic Page v1)
- **Owner:** UX / Design
- **Inputs (read first):** `docs/specs/topic-page-v1.md` (Product spec — AC1–AC22 are the
  acceptance contract), `docs/CURATION_STANDARD.md` (stance/accuracy enums, note standard,
  candidate rule, credit + license microcopy), `docs/TOPIC_PAGE_DESIGN.md` (committed UX +
  Indigo Press identity), `docs/VISION.md`, `docs/ARCHITECTURE.md` (Prototype-phase + Article
  rendering), reference mockups `mockups/inline-indigo-sync.html` (curated) /
  `mockups/inline-indigo-empty-v2.html` (empty) and their data (`mockups/data/content.js`,
  `content-empty.js`).
- **Feeds:** Development (this is the buildable contract — build to **this spec**, not the mockup,
  wherever they differ; deviations are flagged in §13). Then QA & Review + UX evaluation.

> **This spec is the contract.** It is written *before* implementation. The mockups are the visual
> reference; where this spec pins a value the mockup left loose, or refines the mockup (§13), the
> spec wins. Every requirement is tagged with the Product AC(s) it makes buildable so Dev and QA
> can trace coverage.

---

## 1. Personas

Three personas; this round serves the first as the primary user and the second as a secondary
path. The third is named for context only (its tooling is deferred).

### P1 — Priya, the weighing reader (PRIMARY)
A motivated learner (student, lifelong-learner, or someone who just searched the topic). She reads
the real encyclopedia article and, beside it, wants short video that *helps* — but she has been
burned by confident-but-wrong creator content. Her core need: **"tell me what's fact vs. the
creator's take, and how much to trust this clip, without leaving the article."** She reads on
desktop/laptop most often but will land on a phone. She may be colorblind; she may navigate by
keyboard or screen reader. She is **anonymous** — she never has to log in to read and weigh.

### P2 — Marcus, the curator/contributor (SECONDARY this round)
A knowledgeable enthusiast or educator who knows good clips and wants to contextualize them. He
arrives at an **uncurated** topic, sees auto-suggested candidates, and wants an obvious, low-friction
path to (a) promote a good candidate with a context note, or (b) add a clip the suggester missed by
pasting a link. In the prototype his actions are **UI entry points only** (mock submit, no
persistence — spec A7); the flows must still feel real and teach the curation standard.

### P3 — Mod, the moderator (CONTEXT ONLY — out of scope)
Reviews/removes abuse once write-persistence + auth land. No tooling this round; named so the
candidate `vetted` distinction and the curation modal read as the front of a real moderation system.

---

## 2. User stories (each traces to ACs; Product owns acceptance criteria)

**Reader (P1):**
- **S1.** As a reader, I want to read the real Wikipedia article — title, lead, and its sections —
  undisturbed by video, so the page is still the encyclopedia. *(AC2, AC3)*
- **S2.** As a reader, I want each curated clip to carry a human note that separates what's fact
  from the creator's opinion, so I can weigh it. *(AC9; CURATION §1)*
- **S3.** As a reader, I want an at-a-glance reliability and clip-type signal that I can read as
  **words**, not just color, so I can judge a clip even if I'm colorblind or on a screen reader.
  *(AC9, AC21; CURATION §2–§4)*
- **S4.** As a reader, I want each clip anchored to the article section it's about, and I want the
  rail to follow me as I read, so the right clip is beside the right text. *(AC6, AC12, AC13)*
- **S5.** As a reader, I want a contents list that tells me how many videos sit under each section,
  so I can jump to the parts with the richest media. *(AC6)*
- **S6.** As a reader, I want a quick, scrollable strip of whole-topic overview clips up top, so I
  can get oriented before diving into sections. *(AC8)*
- **S7.** As a reader, I want nothing to autoplay; I click to play, and I'm told where a clip will
  open (embedded vs. a new tab), so I stay in control of my attention and data. *(AC11)*
- **S8.** As a reader on a phone, I want the page to collapse to one readable, operable column.
  *(AC1 narrow, AC21)*

**Curator (P2):**
- **S9.** As a curator landing on an uncurated topic, I want it to be obviously empty-but-useful:
  "0 curated", a clear invitation, and clearly-unvetted suggestions I could promote. *(AC14, AC15)*
- **S10.** As a curator, I want suggestions to never *look* endorsed — no chips, no note, an
  explicit "no context yet" — so I'm not misled and I know what's missing. *(AC15; CURATION §6)*
- **S11.** As a curator, I want to promote a candidate into a curated clip by writing a note and
  setting stance + accuracy from a fixed set, so my contribution matches the standard. *(AC19;
  CURATION §1–§3)*
- **S12.** As a curator, I want to add a clip the suggester missed by pasting a YouTube/TikTok link,
  and to search those platforms manually, so I'm not limited to the auto-found set. *(AC18, AC19)*
- **S13.** As a curator, I want to dismiss an irrelevant suggestion and see the counts drop, so the
  page reflects my judgment. *(AC19)*
- **S14.** As a contributor, I want to be told my note will be released CC BY-SA 4.0 at the moment I
  submit, so consent is informed. *(CURATION §5.3 / Decision C5)*

---

## 3. Information architecture & the four states

One route, one page component, **two render states** switched purely by whether the DataStore
returns curated clips for the topic (spec A6, AC20). On top of that, the **article fetch** is an
async resource with its own loading and error states. So Dev must build **four** visual states:

| State | Trigger | What renders |
|---|---|---|
| **Loading** | article HTML fetch in flight | full shell + plus-side chrome render immediately from store data; the **article column** shows a skeleton (§7.1) |
| **Error** | article fetch fails / aborts | the article column shows an inline error card with retry + a link out to Wikipedia; the plus side still renders from store (§7.2) |
| **Curated** | store returns ≥1 curated clip | full curated experience (§5) — infobox counts, General strip, anchored cards with chips + notes, sync |
| **Empty** | store returns zero curated clips | empty experience (§6) — "0 curated" + CTA, "Suggested · uncurated" band, candidate cards, dashed TOC badges, curate/add modals |

The plus-side chrome (header, infobox, TOC) is driven by **store data** (counts, section list,
clip/candidate sets), which is available synchronously in the prototype — so it does **not** wait on
the Wikipedia fetch. Only the **article body** (lead + sections) depends on the network fetch and
therefore owns the loading/error states. The TOC section list comes from the store's
`article_index` (lead + section headings) per ARCHITECTURE, so the contents panel can render before
the body HTML arrives.

### Page regions (top → bottom), both states
1. **Sticky header** (h-64px) with the split Wiki / ＋plus wordmark. *(AC1)*
2. **Masthead** (2-col): article title + attribution + lead (left); ＋plus infobox + Contents TOC
   (right, sticky). *(AC4, AC6, AC7/AC14)*
3. **General strip** — full-bleed band, the one crossover. *(AC8 / AC16)*
4. **Reader** (2-col): article body sections (left); sticky video/candidate rail with condensed
   mini-TOC (right). *(AC2, AC9–AC13 / AC15–AC17)*
5. **Modals** (overlay): player; curate ("Curate this clip"); add-by-link. *(AC11, AC18, AC19)*

---

## 4. Flows

### 4.1 Read-and-weigh (curated topic) — P1
1. Land on `/topic?qid=…`. Shell + plus chrome paint instantly; article column shows skeleton
   (Loading). Infobox shows real counts; TOC lists ＋General + sections with solid count badges.
2. Article HTML resolves → lead + sections render (Curated). General strip shows overview tiles.
3. Reader scrolls the article. As a section **with anchored clips** crosses the reading line
   (HEAD 64px + READ 120px from top — see §10), the rail auto-advances to that section's first card;
   the section heading, the active card, and the current TOC entry all take the indigo
   active-pairing highlight. *(AC12)*
4. Reader reads a card: thumbnail (facade), creator credit, **stance chip** + **accuracy chip**
   (text-labeled), the **curator note**. They can tell at a glance how to weigh it. *(AC9, S2, S3)*
5. Reader clicks the thumbnail → YouTube opens in the embedded player modal (no autoload until
   click); TikTok/other opens the watch URL in a new tab. *(AC11)*
6. Reader can instead drive from the rail: scroll the rail → article scrolls to the matching anchor;
   click a card's "↳ Section" link or a TOC entry → both sides jump. *(AC13)*

### 4.2 Encounter an uncurated topic → curate — P2
1. Land on an uncurated topic. Infobox shows **0 / "videos curated"** + **"✦ Be the first to
   curate"** CTA. Band reads **"＋ Suggested videos · uncurated"**. *(AC14, AC16)*
2. Suggestions render as unmistakably-unvetted candidate cards (dashed border, no offset shadow,
   desaturated/hatched thumbnail, outline **SUGGESTED** badge, **auto-suggest reason** + "no context
   yet", **no chips**). TOC badges are dashed/outline `~n`. *(AC15, AC17; CURATION §6)*
3. **Promote path:** click **✓ Promote** on a candidate → "Curate this clip" modal (note + stance +
   accuracy + section + CC BY-SA notice). Submit is a mock (closes; no persistence — A7). *(AC19,
   S11, S14)*
4. **Add path:** click **＋ Add video** → add-by-link modal. Paste a YouTube/TikTok link → "Fetch
   details" detects platform + mocks a preview → reveals the same curate fields → "＋ Add & curate"
   (mock). *(AC18, AC19, S12)*
5. **Search path:** **Search YouTube** / **Search TikTok** open the platform search for the topic in
   a new tab; per-section "Search TikTok for '<section>'" links find alternates. *(AC18, S12)*
6. **Dismiss path:** **✕ Not relevant** fades the candidate out and decrements the visible counts
   (band count, TOC badges, the CTA subline) everywhere that clip appears. *(AC19, S13)*

---

## 5. Component anatomy — curated state

Notation: **Indigo `#676EB4`**, **violet `#5248AF`**, **teal `#2A8270`**, **teal-dk `#1F6757`**,
**action `#1F6F95`**, **red `#C44949`**, **ink `#2C2C2C`**, **ink2 `#595959`**, **muted `#717171`**,
**bg `#F7F7F7`**, **bg2 `#F0F1F3`**, **border `#D9D9D9`**, **wikilink `#3366CC`**, **wiki-rule
`#A2A9B1`**. **Gold `#E5AB28` is forbidden.** Fonts: plus headings/labels **Source Sans Pro**, plus
body **Open Sans**, Wiki side **Georgia/serif**.

Shared "hardbox" language: `.plus-card` = white fill, **2px ink border, 4px 4px 0 ink offset
shadow**. Larger blocks (infobox, CTA button) may use **6px 6px 0 ink**. Section grid: container
`max-w-[1200px]`, `px-5`, columns `[1fr_360px]`, gap `28px (gap-7)`.

### 5.1 Two-world shell + split wordmark *(AC1)*
- Sticky `<header>` height **64px**, white, **2px ink bottom border**, `z-40`.
- Inner grid matches the page grid (`[1fr_360px]`, `gap-7`), so the wordmark halves sit over their
  columns.
- **Left half ("Wiki"):** serif, `text-2xl`, `font-semibold`, near-black. Sublabel "the
  encyclopedia article" — uppercase, `tracking-[0.18em]`, `text-[10px]`, slate-400, hidden `< sm`.
  Article title right-aligned, serif, slate-500, hidden `< md`.
- **Right half ("＋plus"):** indigo `hardbox-sm` block — white "＋" (`text-2xl`) + "plus"
  (plus-disp, white, `text-lg`) + label "curated video" (uppercase, `tracking-[0.18em]`,
  `text-[10px]`, white/90). Hidden `< lg` (single-column header collapses to the Wiki half only).

### 5.2 Masthead — article lead (Wiki) *(AC2, AC3, AC4)*
- `<h1>` serif, `~1.9rem`, line-height 1.2, **1px wiki-rule bottom border**, near-black.
- **Attribution line** (AC4, CURATION §5.1): `text-xs`, color `#54595D`, exact text:
  **"From [Wikipedia](article url) · CC BY-SA 4.0 · Wikidata <QID>"** — "Wikipedia" is a wikilink-blue
  link to the source article; license named in words; QID shown literally (e.g. "Q11982").
- **Lead image** (if present): `figure.wikifig` floated right, `width:300px; max-width:42%`, 1px
  wiki-rule border, `#F8F9FA` bg, 4px pad; `figcaption` `0.78rem` `#54595D` with a `.credit` span
  (`0.7rem`, `#72777D`) naming the Commons source/credit (preserve, do not strip — CURATION §5.1).
- **Lead paragraphs:** sans body, `0.95rem`, line-height 1.65. Wikilinks: color `#3366CC`, no
  underline, underline on hover; rewritten to internal `/topic/…` (AC5 — see §8).

### 5.3 ＋plus infobox (curated) *(AC7)*
- `.plus-card`, no inner padding; header band = indigo fill, white, **2px ink bottom border**:
  "＋plus" (plus-disp, `text-lg`) + "this topic" (uppercase, `tracking-widest`, `text-[11px]`,
  white/90).
- Body = **3 equal columns**, `divide-x-2 divide-ink`, each centered: a **big numeral**
  (`bignum`, Source Sans Pro 900, `text-3xl`, **indigo**) over an uppercase label (`text-[10px]`,
  bold, ink2). Columns, in order: **Videos** (= store `clipCount` / `stats.totalClips`),
  **Creators** (`creatorCount`), **Curators** (`curatorCount`). *(AC7)*
- **Synced footer:** `border-t-2 ink`, `text-[12px]` bold teal-dk, a teal status dot +
  **"synced <relative time> · <n> shown"** (from store stats). Decorative; not the fact-signal.

### 5.4 Contents / TOC *(AC6)*
- Card with **ink header band** ("Contents", plus-disp `text-base`, white) + scroll body
  (`max-h-[55vh]`, `overflow-y-auto`, `text-[13px]`).
- **First row always "＋ General"** (`data-target="__general"`), then one row per article section,
  indented by `(level − 2) × 12px` (so h3 indents one step under its h2, h4 two).
- Each row: a button-like `<a>` (semantics in §11), `font-semibold` ink, hover → indigo; truncating
  label on the left; **count badge** on the right when count > 0.
  - **Curated count badge (solid):** white fill, **2px solid ink border**, indigo numeral,
    `text-[10px]` bold, `px-1.5`. Plain integer (e.g. "3"). *(AC6)*
  - Zero-count sections render the row with **no badge** (AC6: still listed).
- Clicking a row jumps both columns to that section (§10 goTo). Current section row gets `.cur`
  (indigo, bold). *(AC6, AC13)*

### 5.5 General strip *(AC8)*
- Full-bleed `<section>` after the lead: **indigo fill**, white text, **2px ink top+bottom borders**,
  vertical margin `28px (my-7)`. Inner `max-w-[1200px]`, `px-5`, `py-4`.
- Header row: **"＋ General"** (plus-disp, `text-2xl sm:text-3xl`) + subtitle "— quick visual
  overview across both columns" (white/80) + a **count chip** (white fill, indigo text, 2px ink
  border, uppercase `text-[11px]`): **"<n> videos"**. Optional right-aligned "see all (<total>) →"
  link (scrolls to the strip; full browse is out of scope).
- Track: horizontally scrollable flex row, `gap-3`, `overflow-x-auto`, right-edge mask fade,
  `role="list"`.
- **Tile (`role="listitem"`, `w-44 / 176px`):** a uniform **search-result thumbnail** (`h-24 / 96px`,
  16:9-ish letterbox crop) using the facade (§5.7); below it a 2-line-clamped bold caption (white,
  `text-[12px]`) and a `creator.handle · platformLabel` subline (white/70, `text-[11px]`). General
  tiles are thumbnail-forward and carry **no chips/notes** (chips live on anchored cards).

### 5.6 Article body (Wiki) *(AC2, AC3)*
- Each section = `<section class="sec" id="sec-<slug>">` with `scroll-margin-top: 80px`.
- Heading element matches level: `<h2>`/`<h3>`/`<h4>` **serif**, `id="h-<slug>"`. Styling:
  - h2 `1.5rem`, **1px wiki-rule bottom border**, margins `1.4em 0 .5em`.
  - h3 `1.2rem`; h4 `1.05rem` `font-weight:700`.
- Body paragraphs sans, `0.95rem`/1.65; section figures `figure.wikifig` floated right exactly like
  the lead image, caption + credit preserved.
- **The article is never interrupted by a video card in the curated state** — the General strip is
  the only crossover. *(AC2)* (Contrast: the empty state *does* inline a candidate after a section's
  text — §6.4.)
- Active-pairing highlight: when a section is the active anchor, its heading gets a **−10px indigo
  left bar** (`box-shadow:-10px 0 0 indigo`) + a left-to-transparent indigo wash
  (`linear-gradient(90deg,#EEF0FB, transparent 60%)`), 0.25s transition (suppressed under
  reduced-motion → §10.4). *(AC12)*

### 5.7 Click-to-load video facade (shared) *(AC10, AC11)*
- The thumbnail is a **`<button>`**, not an `<a>` — it's an action, and nothing loads until clicked.
- Anatomy: 2px ink border; the real `<img loading="lazy">` (with an `onerror` gradient fallback from
  the clip's `thumbGrad`); an indigo **duotone** multiply overlay; a **platform tag** top-left
  (uppercase `text-[10px]`, platform-colored fill, white text — YouTube red, TikTok pink — **and the
  platform named in words**, not icon-only, per CURATION §5.2); a centered **play affordance** (48px
  indigo circle, 2px ink border, 3px ink offset, white triangle; scales 1.1 on hover only).
- **Aspect ratio by `orientation` (AC10):**
  - `vertical` → **9:16** frame. In the rail card: `aspect-[9/16] max-h-72 mx-auto w-44` (centered,
    capped height). In the General strip tile: fixed `h-24` letterbox is acceptable (uniform search
    row).
  - `horizontal` → **16:9** (`aspect-video`).
- **Activation (AC11):**
  - `platform === "youtube"` → open the **player modal** (§5.8) with a lazily-created iframe
    `embed_url + "?autoplay=1"`; vertical clips render the iframe at `aspect-[9/16] max-h-[80vh]`,
    horizontal at `aspect-video w-full`.
  - any other platform (`tiktok`/`instagram`/`other`) → `window.open(watch_url, "_blank",
    "noopener")`. (Embed-never-host; TikTok thumbnails/embeds are unreliable.)
- **Accessible name:** the button's `aria-label` states the action + caption, e.g.
  **"Play: <caption>"** for YouTube, **"Open on TikTok: <caption>"** for link-out. *(AC21)*

### 5.8 Player modal *(AC11)*
- Overlay `fixed inset-0`, `bg-black/80`, centered, `role="dialog" aria-modal="true"
  aria-label="Video player"`. Content max-width `48rem (max-w-3xl)`, black, 2px ink border.
- **"✕ close"** button (top-right, white). Closes on: button click, backdrop click, **Esc**. On
  open, move focus into the dialog (the close button) and **trap focus**; on close, **return focus**
  to the thumbnail that opened it. *(AC21 — see §11.4.)*
- The iframe is created **on open** and removed on close (no pre-mount, supports AC11's "no embed on
  initial render").

### 5.9 Anchored clip card (rail) *(AC9, AC10, AC12, AC13)*
The card is the heart of S2/S3. `<article class="plus-card vcard">`, `p-2.5`, vertical stack:
1. **Active nub** — a small indigo left-pointing triangle, `absolute -left-2.5 top-6`, opacity 0,
   becomes opacity 1 when the card is active. Decorative (`aria-hidden`).
2. **Section link** — `<button class="seclink">` "↳ <sectionLabel>", action-blue `text-[11px]`
   bold, underline on hover; jumps both columns (§10 goTo). *(AC13)*
3. **Thumbnail** — facade (§5.7), aspect by orientation.
4. **Creator credit** *(AC9, CURATION §5.2)* — a 28px round avatar (gradient from
   `creator.avatarGrad`, 2px ink border) + name (`text-[12px]` bold ink, truncate) + a subline
   **"<handle> · <platformLabel>"** (`text-[11px]` muted, truncate). Platform named in words. The
   credit area links out to the creator/clip on platform.
5. **Chips row** — `flex flex-wrap gap-1.5`, two chips (§9): the **stance chip** (indigo) then the
   **accuracy chip** (teal / action / red by enum). Both **text-labeled**. *(AC9, AC21)*
6. **Curator note** *(AC9, CURATION §1)* — a block with a **4px indigo left border**, bg2 fill,
   `pl-3 pr-2 py-2`: an eyebrow **"Curator note"** (uppercase `text-[10px]` bold violet) over the
   note text (`text-[12px]`/snug, ink2). Card is sized for the **~320-char soft cap** (CURATION
   §1.3 / C1) without truncation; longer text simply grows the card.
7. **Provenance footer** — `text-[11px]` muted: an upvote count (▲ <n>, indigo bold) + "<curatedBy>
   · <relative date>". Decorative enrichment.
- **Active state (AC12):** `.vcard.active` → indigo border; `.active-glow` → **6px 6px 0 indigo**
  offset shadow; nub opacity 1.

---

## 6. Component anatomy — empty / uncurated state

Reuses the same shell, masthead-left, TOC structure, body, and sync engine. Differences below.
The unvetted-candidate treatment is binding per CURATION §6 and AC15.

### 6.1 Header — signed-in affordance
The empty state depicts a **logged-in** curator (the curate/add actions are login-gated — CURATION
§7). Show a **user chip** at the right of the ＋plus header half: 28px gradient avatar (2px ink
border) + "@<handle>" (`text-[12px]` bold) + a teal status dot + "signed in" (uppercase
`text-[9px]` bold teal-dk). `aria-label="Signed in as @<handle>"`. In the prototype the identity is
the stubbed `@sage`; this chip is **presentational** (no real auth — A7). If no identity is
available, render the plain ＋plus block (no chip).

### 6.2 ＋plus infobox (empty) *(AC14)*
- Same indigo header band. Body is **single centered block**: a **"0"** in `bignum` at `text-[64px]`
  indigo, over **"videos curated"** (uppercase `text-[11px]` bold ink2). *(AC14)*
- **CTA block** below: a subline **"<n> auto-suggestions from <sources>"** (e.g. "14 auto-suggestions
  from YouTube + TikTok", `text-[12px]` ink2, centered) over a full-width primary button
  **"✦ Be the first to curate"** (indigo fill, white, 2px ink border, `hardbox-sm`, press-down hover
  offset). `aria-label="Be the first to curate this topic"`. Click → opens "Curate this clip" on the
  first/top suggestion (or scrolls to the Suggested band if none). *(AC14, S9)*
- **Synced footer:** "suggestions synced <time>" (teal-dk), same styling as curated.

### 6.3 General band (empty) — "Suggested videos · uncurated" *(AC16)*
- Same full-bleed indigo band. Title **"＋ Suggested videos"** + an **outline "uncurated" pill**
  (white text, 2px white border, uppercase `text-[11px]`) + subtitle "— auto-found candidates, not
  yet vetted" + a count chip **"<n> candidates"** (not "videos"). *(AC16)*
- **Manual-source action cluster** (`role="group" aria-label="Add videos from a source manually"`):
  an eyebrow "Find more" then three controls (button language `.srcbtn`: 2px ink border, white fill,
  Source Sans Pro bold `text-[12px]`, hover lifts a 2px ink offset). *(AC18)*
  - **"Search TikTok ↗"** — `<a target="_blank" rel="noopener">` to
    `https://www.tiktok.com/search?q=<topic>`. Hover fills TikTok-pink.
  - **"Search YouTube ↗"** — `<a target="_blank" rel="noopener">` to
    `https://www.youtube.com/results?search_query=<topic>`. Hover fills indigo.
  - **"＋ Add video"** — `<button aria-haspopup="dialog">`, indigo fill (primary). Opens the
    add-by-link modal (§6.7). *(AC18)*
- Candidate **tiles** in the track: a `.candcard` (dashed treatment §6.5) `w-44`, with a top-row
  **SUGGESTED** outline badge, the muted/hatched facade thumbnail, caption, `handle · platformLabel`
  subline, a **match-reason line** (magnifier icon + `matchReason`), then the **Promote / Not
  relevant** buttons (§6.6). No chips. *(AC15, AC16, AC19)*

### 6.4 Inline section candidate (empty only) *(AC16)*
Where a candidate matches a section, render **one** candidate block **after** that section's article
paragraphs (and after its figure), `clear-both`, `my-4` — so the article text above is undisturbed
(AC16: "rendered after the section's article text, not interrupting it"). It is an `<aside
class="candcard" aria-label="Suggested video for <section>">`:
- Header: **SUGGESTED** badge + "Suggested for this section" (violet `text-[11px]` bold).
- A horizontal layout: facade thumbnail (aspect by orientation; vertical `w-28`, horizontal `w-44`)
  beside caption + `name · handle · platformLabel`.
- The **match-reason line** (§6.5) and the **Promote / Not relevant** buttons.
- A bottom **per-section find** row (dashed top divider): "Search TikTok for '<section>' ↗"
  (`.sectionfind` understated violet link, opens in a new tab) — find alternates. *(AC18, S12)*

### 6.5 Unvetted candidate visual language (binding) *(AC15; CURATION §6)*
- **`.candcard`:** white fill, **2px DASHED ink border, NO offset shadow.** (Distinct from the solid
  border + solid offset of `.plus-card`.)
- **`.candthumb`:** `filter: saturate(.55) contrast(.95)` + a faint 45° repeating-linear-gradient
  **hatch** overlay (`rgba(44,44,44,.10)`), over the duotone. Desaturated + hatched = "candidate".
- **SUGGESTED badge:** **outline** — white fill, 2px ink border, ink text (NOT a filled badge),
  uppercase `text-[9px]` bold `tracking-[0.14em]`, literal word **"Suggested"**.
- **Match-reason line** *(replaces the curator note — CURATION §6)*: a block with a **dashed** 4px
  indigo left border, bg2 fill; eyebrow = magnifier icon + **"Auto-suggested"** (violet); body =
  **"<source> · <matchReason>"** (ink2, `text-[12px]`); then an italic hint **"No context yet — a
  human hasn't reviewed this."** (muted `text-[11px]`). *(AC15)*
- **No stance chip, no accuracy chip on any candidate.** *(AC15; CURATION §6.)*
- **Active state:** dashed indigo border + a **faint** 3px offset `rgba(103,110,180,.45)` (NOT the
  solid curated glow) — keeps "provisional" legible even when active.
- **Dismiss animation:** `.dismissing` → opacity 0 + `scale(.96)` over 0.3s, then removed (§10.4
  reduced-motion: skip the transition, remove immediately).

### 6.6 Promote / Not relevant controls *(AC19)*
A row under each candidate (rail card, inline block, and strip tile — same clip may appear in
multiple places):
- **"✓ Promote"** — `<button>`, indigo fill, white, 2px ink border, hover 2px ink offset.
  `aria-label="Promote and curate: <caption>"`. Opens "Curate this clip" (§6.8) seeded with the
  candidate's section + caption. *(AC19, S11)*
- **"✕ Not relevant"** — `<button>`, white fill, ink, 2px ink border. `aria-label="Dismiss as not
  relevant: <caption>"`. On click: fade+remove **every** rendering of that clip id, decrement the
  band count, the per-section TOC badge, and the CTA subline count. *(AC19, S13)*

### 6.7 TOC badges (empty) *(AC17)*
Same TOC structure (＋ Suggested first row, then sections). Count badges are **dashed/outline**:
white fill, **2px DASHED violet border**, violet text, prefixed **"~"** (e.g. "~2"), with
`title="<n> unvetted suggestion(s)"`. Visually distinct from the solid indigo curated badges
(§5.4). Badges hide when their count reaches 0 after dismissals. *(AC17)*

### 6.8 Curate modal — "Curate this clip" *(AC19; CURATION §1–§5)*
Overlay dialog (`role="dialog" aria-modal="true" aria-labelledby="curateTitle"`), `max-w-lg`,
`.plus-card`. Indigo header band: title **"Curate this clip"** + a **"✕"** cancel.
Body fields (Source Sans Pro labels, uppercase `text-[11px]` bold violet; Open Sans inputs, 2px ink
borders):
- **Clip summary** — a bg2 block, 4px indigo left border: the caption (bold) + "<name> · <platform>
  — auto-suggested, not yet curated".
- **Context note** — `<textarea rows=3>`. Placeholder: **"What's useful or off about this clip?
  Separate fact from the creator's opinion…"** Helper text below restating CURATION §1: **"1–3
  sentences. Say what's established fact vs. the creator's take, why it's worth watching here, and
  any limits."** A **live character counter** toward the **320-char soft cap** (C1): show "<n>/320";
  past 320, the counter turns red and the count reads "over recommended length" (soft — does not
  block submit this round; Dev sets field `maxlength` per C1 guidance, recommended 400 hard ceiling).
- **Stance** `<select>` — options are the closed enum **Labels** (CURATION §2), in this order:
  **Explainer, Short, Demonstration, Classroom, Opinion, Myth-busting, Personal experiment.**
  *(Supersedes the mockup's `Documentary` option — §13.)*
- **Accuracy** `<select>` — closed enum **Labels** (CURATION §3): **Accurate, Accurate with a
  caveat, Primary footage, Opinion, Mixed, Misleading, Inaccurate.** *(Supersedes the mockup's
  free-text "Anecdotal" — §13.)*
- **Section** — a `<select>` (not the mockup's free text) populated with **"General"** + the article
  section titles, defaulted to the candidate's section. *(Refines the mockup — §13.)*
- **CC BY-SA license notice** *(CURATION §5.3 / C5, S14)* — a one-line notice directly above the
  publish button: **"By publishing, you agree to release your context note under CC BY-SA 4.0."**
  (`text-[11px]` muted.)
- **Actions:** **"✓ Publish curation"** (indigo primary) + **"Cancel"** (white). Submit is a mock:
  closes the modal, no persistence (A7). On open, focus the note textarea; trap focus; Esc / backdrop
  / Cancel close and return focus to the originating Promote button (§11.4).

### 6.9 Add-by-link modal — "Add a video" *(AC18, AC19, S12)*
Overlay dialog (`aria-labelledby="addTitle"`), `max-w-lg`, `.plus-card`. Indigo header: title **"Add
a video"** + a "signed in as @<handle>" pill + "✕".
- **Step 1 — paste link:** label **"Paste a YouTube or TikTok share link"**; a `<input type="url">`
  (placeholder shows both URL shapes) + a **"Fetch details"** button. Helper (`addHint`): **"We
  detect the platform from the link and mock a preview — no network call."** (Honest about the
  prototype mock — A7.)
- **Error state:** if the link isn't a recognized YouTube/TikTok URL, show an inline alert
  (`role="alert"`, red text, 2px red border, `#FDEDED` bg): **"Unrecognized link — paste a YouTube or
  TikTok URL."** Hide preview + curate fields. *(Covers the modal's own error state.)*
- **Step 2 — resolved preview (mock):** on a recognized link, reveal a bg2 preview block: a mock
  thumbnail placeholder (duotone+hatch), a platform badge (detected, named in words), an eyebrow
  "resolved via oEmbed", a mock title, and the echoed URL.
- **Step 3 — curate fields:** the **same** note / stance / accuracy / section fields + CC BY-SA
  notice as §6.8 (Section here is a `<select>` of "General" + section titles). Actions: **"＋ Add &
  curate"** (indigo primary) + "Cancel". Mock submit (A7). Focus management: open → focus the link
  input; after a successful fetch → focus the note; trap focus; Esc/Cancel/backdrop close + return
  focus to the "＋ Add video" trigger.

---

## 7. Loading & error states (article body)

These are first-class — Dev must build them; do not ship a blank column while the fetch is pending.

### 7.1 Loading (article fetch in flight)
- Shell, header, infobox, TOC, and (curated) chips/cards or (empty) candidates all render
  immediately from store data — **only the article body waits.**
- Article column shows a **skeleton**: a title-height bar (≈60% width) under the (already-real)
  attribution line, then 5–7 shimmer paragraph bars of varied width in the Wiki body area. Use
  bg2/border tones; the shimmer pulse is **suppressed under reduced-motion** (static bars). Mark the
  region `aria-busy="true"` and include a visually-hidden "Loading article…" live announcement.
- The General strip and rail are usable during load (they don't depend on article HTML); sync simply
  has no section anchors to act on yet and activates once the body renders.

### 7.2 Error (article fetch fails)
- Replace the skeleton with an **inline error card** in the article column (not a full-page error —
  the plus side stays useful): an `.plus-card`-styled (ink border) panel, ink heading **"Couldn't
  load the article"**, body **"We couldn't reach Wikipedia just now. The curated videos are still
  here on the right."**, and two actions: **"Try again"** (re-runs the fetch) and **"Open on
  Wikipedia ↗"** (`target="_blank" rel="noopener"` to the source article). `role="alert"`.
- TOC still renders from the store's section list; clicking a TOC entry with no body present simply
  scrolls to the General strip / top (graceful). Sync stays inert until a body exists.

---

## 8. Wikilink rewriting & figures *(AC5, CURATION §5.1)*
- During sanitize (DOMPurify), rewrite article-namespace wikilinks (`/wiki/X`, `en.wikipedia.org`
  article links) to internal **`/topic/X`** so navigation stays in wiki+ (the mockups link out — a
  mockup simplification; build the spec, §13). Visual treatment stays wikilink-blue.
- **Fallback for non-article / red links** (namespaced `File:`/`Help:`/`Category:`, red/missing): do
  **not** produce a broken `/topic/` route — either keep the absolute Wikipedia URL
  (`target="_blank" rel="noopener"`) or de-link to plain text. *(AC5)*
- **Commons figures:** preserve each figure's caption **and** source/credit link from the article
  HTML; do not strip the credit (CURATION §5.1 — the article-text license does not cover its images).

---

## 9. Chips — the fact-vs-opinion signal *(AC9, AC21; CURATION §2–§4)*

Both chips are small pills: uppercase `text-[10px]` bold `tracking-wide`, `px-2 py-0.5`, **2px ink
border**. **The label text is the signal; color reinforces.** Dev derives chip text from the enum
value via a **single enum→Label map** (CURATION §4) — UX writes no alternate strings. Optional
modifier renders as **"Label · modifier"** (C6), modifier ≤24 chars, display-only.

### 9.1 Stance chip (always indigo)
- Fill **indigo `#676EB4`**, **white** text. One value per clip.
- Labels (CURATION §2): **Explainer · Short · Demonstration · Classroom · Opinion · Myth-busting ·
  Personal experiment.** Examples with modifier: "Explainer · conceptual", "Short · exam recap",
  "Demonstration · primary", "Classroom".

### 9.2 Accuracy chip (color = tier, label = meaning)
One value per clip. Fill by enum, **white** text, 2px ink border:

| Enum | Chip label | Fill | Tier |
|---|---|---|---|
| `accurate` | **Accurate** | teal `#2A8270` | sound |
| `primary_source` | **Primary footage** | teal `#2A8270` | sound |
| `accurate_with_caveat` | **Accurate, with a caveat** | action `#1F6F95` | sound-with-a-limit |
| `opinion` | **Opinion** | red `#C44949` | weigh carefully |
| `mixed` | **Mixed** | red `#C44949` | weigh carefully |
| `misleading` | **Misleading** | red `#C44949` | weigh carefully |
| `inaccurate` | **Inaccurate** | red `#C44949` | weigh carefully |

- The four red-group values share a color but are **distinguished by their distinct label text**
  (CURATION §4 / C3) — never by shade. *(AC21)*
- The mockup tinted the accuracy chip but kept the literal string (e.g. "Accurate · beginner-friendly");
  the built chip must use the **canonical Label** from the map + optional modifier (§13).

### 9.3 Contrast (AA) *(AC21)*
White text must meet **WCAG AA (≥4.5:1)** on each fill. Verified ratios (white `#FFFFFF` on fill):
indigo `#676EB4` ≈ 4.0:1 — **below 4.5:1 for normal text**, so chip text must be **bold and treated
as large text (≥14px bold / ≥18.66px)** OR the fill darkened toward **deep-violet `#5248AF`
(≈ 5.9:1)**; **Dev: use `#5248AF` for the stance-chip fill to clear AA at 10px.** action `#1F6F95`
≈ 5.5:1 (pass). teal `#2A8270` ≈ 4.6:1 (pass, marginal — if Dev's exact pixel rounding dips below,
use teal-dk `#1F6757` ≈ 7.0:1). red `#C44949` ≈ 4.0:1 — **darken to `#B83A3A`/use bold-large
treatment**; **Dev: confirm ≥4.5:1 and adjust the red fill darker if needed.** This is a binding AA
requirement, not a suggestion — QA verifies. *(Refines the mockup, which did not guarantee AA — §13.)*

---

## 10. Scroll-sync interaction model *(AC12, AC13; honor reduced-motion)*

Section-level granularity (phrase-level is deferred). Constants: **HEAD = 64px** (header),
**READ = 120px** (reading-line offset below the header). The rail is a sticky, independently
scrollable `aside` (`sticky top-16`, `h-[calc(100vh-4rem)]`, `overflow-y-auto`).

### 10.1 Active section detection
"Active clip section" = the **last** clip-bearing section whose heading top is `≤ HEAD + READ`
(i.e., the deepest clip section that has crossed the reading line). "Current section" (for the
TOC/mini-TOC label, across **all** sections incl. zero-clip ones) is computed the same way over the
full section list. Both recompute on scroll via `requestAnimationFrame` throttle.

### 10.2 Article → rail *(AC12)*
On window scroll, when the active clip section changes: highlight it (heading wash + active card +
TOC `.cur`), and **auto-scroll the rail** so the section's first card is near the rail top
(`card.offsetTop − miniTocHeight − 8`). Above the first clip section, the rail rests at its top.

### 10.3 Rail → article & jump-to *(AC13)*
On rail scroll, find the card whose center is nearest the rail's vertical center; if it's a new
section, highlight it and **scroll the article** to that heading (`headingTop − HEAD − 16`). A
**reciprocal lock** (≈180ms) prevents the two scroll handlers from fighting: the side being
programmatically scrolled suppresses its own handler briefly. **goTo(id)** (TOC click or card
section link) scrolls the article to the heading and the rail to the card and sets the highlight;
"＋ General"/"＋ Suggested" scrolls to the band.

### 10.4 Reduced motion *(binding)*
Honor `prefers-reduced-motion: reduce`:
- Programmatic scrolls use **instant** (`behavior:"auto"`), never smooth. (The mockup already uses
  `auto` for sync jumps; TOC/`goTo` smooth scrolls must downgrade to `auto` under reduced-motion —
  §13.)
- Suppress the heading-wash transition, the card hover/scale on the play button, and the
  candidate dismiss fade (remove immediately).
- The pairing **highlight still applies** (it's a state cue, not motion) — only the animation is
  removed.

### 10.5 Mini-TOC (rail)
Once the masthead TOC scrolls away, a condensed **mini-TOC** sits sticky at the rail top: a
disclosure button showing "Contents" + the current-section label + a chevron; expanding reveals the
full TOC (same rows/badges). `aria-expanded` + `aria-controls` wired; collapses after a jump.

---

## 11. Accessibility requirements (verifiable against AC21)

### 11.1 Text-labeled signals (never color alone) *(AC21; CURATION §4)*
- Every stance and accuracy chip carries its **visible Label text** (§9); meaning survives with no
  color (colorblind / screen reader / high-contrast). Red-group accuracy values are separated by
  **label text**, not shade. The "synced" dot, the active nub, and the duotone are decorative
  (`aria-hidden`) and never the sole carrier of meaning.
- Platform is named in **words** on every thumbnail tag and creator subline (not icon-only).

### 11.2 Focus visibility *(AC21)*
Global `:focus-visible` = **3px indigo outline, 2px offset**, applied to all interactive elements
(TOC `<a>`s, thumbnails, Promote/Not-relevant/Add/Search controls, modal open/close, selects/inputs,
CTA). Focus is never removed without an equally-visible replacement.

### 11.3 Keyboard operability *(AC21)*
- **TOC entries:** each row is a real link/button — Tab-reachable, Enter/Space activates `goTo`.
- **Thumbnails:** `<button>` — Tab-reachable, Enter/Space activates play/open.
- **Cards:** the section link, Promote, Not-relevant are all real buttons in a sensible tab order
  (section link → thumbnail → promote → not-relevant).
- **Strip:** horizontally scrollable; tiles' interactive children are tab-reachable in order; the
  track does not trap focus.
- **Mini-TOC disclosure:** button with `aria-expanded`; Enter/Space toggles.
- **Selects/inputs** in modals are native (keyboard-operable by default).

### 11.4 Modals (player, curate, add) *(AC21)*
- `role="dialog" aria-modal="true"` with an `aria-label`/`aria-labelledby` naming the dialog.
- On open: move focus into the dialog (first sensible field/close); **trap focus** within while open.
- Close on **Esc**, **backdrop click**, and the explicit Cancel/✕; on close, **return focus** to the
  triggering control (thumbnail / Promote / Add). Background is inert while open.
- The player iframe carries a `title` (the clip caption).

### 11.5 Landmarks & names
- `<header>`; article column `<main aria-label="Wikipedia article">`; rail `<aside aria-label="wiki+
  curated videos">` (empty: "wiki+ suggested videos"); TOC `<nav>`; General strip a labelled
  `<section>` with `role="list"` track. Inline candidate = `<aside aria-label="Suggested video for
  <section>">`.

### 11.6 Contrast *(AC21)* — see §9.3 for the chip fills (binding adjustments). Body/Wiki text on
white and ink2/muted on bg2 already clear AA; QA spot-checks the smallest text (`text-[10px]`
labels) against their backgrounds.

---

## 12. Responsive behavior

- **Breakpoint: `lg` (1024px).** At `≥1024px` the page is the two-column `[1fr_360px]` layout. Below
  1024px it collapses to **single column** (the grid's `grid-cols-1` base). *(AC1, AC8 narrow.)*
- **Single-column behavior (< lg):**
  - Header shows only the **Wiki** half (the ＋plus block + user chip are `hidden < lg`); the topic
    title may show from `md`.
  - Masthead infobox + TOC stack **below** the lead (still full width, not sticky-pinned beside it).
  - The General strip stays full-bleed and horizontally scrollable (works at any width).
  - The reader collapses: article body, then the rail content **below** it. The rail is **not
    sticky** single-column; **scroll-sync relaxes** (the side-by-side pairing has no spatial meaning
    in one column) — keep TOC/section **jump-to** working (it's just in-page anchors), but the
    automatic article↔rail follow may be disabled below `lg`. *(Spec A9 / AC1 — "sync may relax".)*
  - In the empty state, inline section candidates (§6.4) remain the most useful single-column pattern
    (they sit right under their section); the rail's duplicate cards still render below.
  - All controls, modals, chips, and notes remain fully readable and keyboard/touch operable narrow.
- Target tested widths for QA: ~1280px (full two-column), ~768px (single column tablet), ~390px
  (phone).

---

## 13. Deviations from / refinements to the mockups (Dev: follow the spec here)

The mockups are visually authoritative but predate the curation standard and cut corners a real
build can't. Where they differ, **build the spec**:

1. **Stance/accuracy chips use the closed enum + a label map**, not the mockup's free-text strings.
   Chip text = the canonical **Label** (§9; CURATION §2–§3) + optional `· modifier`. Drop the
   mockup's regex-based color guessing in favor of an `enum → {label, fill}` map.
2. **Curate/Add modal selects** use the **closed enums**: Stance adds **Myth-busting** and
   **Personal experiment** and **drops "Documentary"**; Accuracy becomes **Accurate / Accurate with
   a caveat / Primary footage / Opinion / Mixed / Misleading / Inaccurate** and **drops the
   free-text "Anecdotal"**. *(CURATION §2–§3, C4.)*
3. **Curate modal "Section"** is a **`<select>`** of "General" + article section titles (the curated
   mockup had no curate modal; the empty mockup used a free-text input). Add the **CC BY-SA notice**
   and the **note character counter** — neither is in the mockups (CURATION §1.3/§5.3, C1/C5).
4. **Wikilinks rewrite to internal `/topic/…`** and figures **keep their Commons credit** — the
   mockups link out and render static figures (TOPIC_PAGE_DESIGN implementation note; AC5; CURATION
   §5.1).
5. **Loading & error states for the article body are specified here (§7)** — the mockups render the
   article statically and have neither. These are required (AC22-adjacent robustness; Product spec
   states the article is now a real client fetch).
6. **Chip contrast is pinned to AA (§9.3):** use **deep-violet `#5248AF`** for the **stance** fill
   and a **darkened red** for the worst-case accuracy fill if `#C44949` + white at 10px doesn't clear
   4.5:1. The mockups did not guarantee AA. *(AC21 — binding.)*
7. **Reduced-motion downgrades smooth `goTo`/TOC scrolls to instant** and removes the dismiss/hover
   animations (§10.4). The mockups left `goTo` smooth unconditionally.
8. **Data-driven, not hardcoded:** the mockups embed `window.WIKIPLUS`; the build reads topic/clips/
   counts/candidates through `lib/data/` and renders curated-vs-empty by whether the store returns
   curated clips (AC20, A5/A6). Counts (Videos/Creators/Curators; suggestion totals) derive from the
   store, not literals.
9. **"see all" in the General strip** is decorative this round (scrolls to the band); the real
   browse-all flow is out of scope — don't build a destination.

---

## 14. Data the design needs (informs Dev's `lib/data/` extension — A5; not the schema authority)

Per-clip (curated): `id`, `topicQid`, `platform`, `platformLabel`, `orientation`
(`vertical|horizontal`), `watchUrl`, `embedUrl`, `thumbnailUrl` (+ a gradient fallback token),
`caption`, `creator{name, handle, platform, avatar(grad), url, followerCount?}`, `contextNote`,
`stance` (enum) + `stanceModifier?`, `accuracyFlag` (enum) + `accuracyModifier?`, `general`
(boolean) / `sectionAnchor` (slug + heading text), `upvotes?`, `curatedBy?`, `createdAt`.
Per-candidate (empty): the same media/creator/orientation fields **plus** `source`, `matchReason`,
`vetted:false`, `general`/`sectionAnchor` — and **no** `stance`/`accuracyFlag`/`contextNote`
(CURATION §6). Topic-level: `title`, `qid`, `url`, `license`, section list (slug/title/level/image),
and derived counts (`videos`/`creators`/`curators`; suggestion totals + sources + synced label).
Final field names are Dev's; the seam in `lib/data/store.ts` must describe them (A5).

---

## 15. Acceptance-coverage map (AC → where this spec makes it buildable)

| AC | Spec sections |
|---|---|
| AC1 two-col + split wordmark | §3, §5.1, §12 |
| AC2 faithful Wiki side, never interrupted | §5.2, §5.6 |
| AC3 full sections + slugs | §5.6, §3 |
| AC4 CC BY-SA + QID | §5.2 |
| AC5 internal wikilink rewrite + fallback | §8 |
| AC6 TOC + per-section counts | §5.4 |
| AC7 infobox counts (curated) | §5.3 |
| AC8 General strip | §5.5 |
| AC9 anchored card content + chips + note | §5.9, §9 |
| AC10 vertical/horizontal aspect | §5.7 |
| AC11 click-to-load, no autoload | §5.7, §5.8 |
| AC12 sync article→rail | §5.6, §5.9, §10.2 |
| AC13 sync rail→article + jump-to | §5.9, §10.3 |
| AC14 empty CTA + infobox | §6.2 |
| AC15 unvetted candidate distinct | §6.5 |
| AC16 empty General band + inline candidates | §6.3, §6.4 |
| AC17 empty TOC badges distinct | §6.7 |
| AC18 manual source actions | §6.3, §6.4, §6.9 |
| AC19 Promote / Not relevant | §6.6, §6.8 |
| AC20 DataStore-driven | §3, §13.8, §14 |
| AC21 accessibility baseline | §9.3, §11 |
| AC22 builds clean | (Dev) — no design blocker |

Loading + Error states: §7 (Dev must build; QA verifies both render).
