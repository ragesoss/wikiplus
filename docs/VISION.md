# wiki+ — Vision

## What it is

wiki+ is a **curation and contextualization layer over Wikipedia** that attaches relevant
**creator-driven social-media video** to the topics people are already reading about. The
primary focus is **short, vertical clips** — the TikTok / Instagram Reels / YouTube Shorts
format — though video is **not exclusively vertical**: longer explainers, lectures, and
primary-source footage are welcome too. Short vertical, creator-made video is the focus
because that is where the most-watched (and least-vetted) topical content now lives.

These clips are typically made by **social-media personalities who blend personal opinion
and perspective with factual content**. For each one, a curator writes a **context note**
that separates the creator's take from the established facts, flags how accurate it is, and
links it to the part of the article it speaks to.

It is not a video host and not a fork of Wikipedia. It sits alongside the encyclopedia and
adds a vetted, contextualized video dimension on top of the existing text.

## Why it exists

Wikipedia is text-first and deliberately conservative about embedded media. Meanwhile the
most-watched topical video now comes from individual creators whose style **fuses genuine
explanation with personal opinion, hot takes, and self-promotion**. That mix is engaging and
reaches enormous audiences — but it leaves viewers unsure which parts are established fact
and which are the creator's perspective. Search and recommendation feeds optimize for
engagement, not accuracy, and offer no shared editorial judgment about what's worth watching
or how to weigh it.

wiki+ closes that gap by letting a community do for creator video what Wikipedia editors do
for text: **select it, vouch for it, and — crucially — contextualize it**, drawing a clear
line between the factual content and the creator's opinion so each clip is more trustworthy
and more useful than it is in isolation.

## Core concepts (plain language)

- **Topic** — a subject that maps to a real Wikipedia article (e.g. "Photosynthesis").
  Identified canonically by its **Wikidata QID** so it stays stable across renames and
  languages. A wiki+ Topic page shows the Wikipedia lead/sections plus its curated clips.
- **Clip** — a single curated entry: a referenced social video plus the curator's
  contextualization. Each clip records the **creator** who made it, a **context note**
  (the human-written core value — what's fact vs. the creator's opinion, and why it's
  relevant), a **stance/type** (e.g. explainer, opinion, myth-busting, personal experiment),
  an **accuracy flag** (how well it matches the source material), an optional **timestamp**
  ("the relevant part starts at 4:12"), and an **article-section anchor** ("relates to the
  *Light-dependent reactions* section"). The context note is wiki+'s original contribution.
- **Creator** — the social-media personality who made a clip (handle, display name, platform,
  follower count). External — we reference and credit creators, never host their video.
- **Contributor / curator** — a wiki+ user who adds clips and writes their context notes.
  (Lightweight identity in MVP; full accounts come later.)

## MVP scope — the core loop

1. **Find a topic** — search or arrive at a Topic page for an existing Wikipedia article.
2. **Read** — see the Wikipedia lead and section structure inline.
3. **Watch & weigh** — see the curated clips for that topic, each with its creator, the
   curator's context note (what's fact vs. opinion), an accuracy flag, an optional timestamp,
   and the article section it relates to.
4. **Contribute** — add a clip (paste a video URL → we pull the creator and embed metadata),
   write the context note, and set its stance, accuracy flag, optional timestamp, and section
   — or improve an existing one.

**Topics are created on demand.** A wiki+ Topic comes into existence the first time someone
curates a video for it — we do **not** mirror all of Wikipedia. This keeps the data set
proportional to actual curation activity rather than to the size of the encyclopedia.

## Non-goals (for the MVP)

- **Hosting video.** We embed by reference (oEmbed); we never store or stream media files.
- **Editing Wikipedia article text.** We display and link to it; editing happens on
  Wikipedia.
- **Passwords & a bespoke account system.** Login is **OAuth-only**: the MVP supports
  **Wikipedia/Wikimedia** sign-in, with Google planned next. Reading is anonymous;
  contributing requires login. Reputation, roles, and moderation tooling come later.
- **In-product AI for end users.** AI agents build and operate the project; the product
  itself is human-curated in the MVP. (In-product assistance is a possible future direction.)
- **Native mobile apps.** Web-first, responsive.

## What "good" looks like

A reader who lands on a wiki+ topic should leave with **2–5 clips they're glad they watched**
and wouldn't have found on their own — and, just as important, should **understand how to
weigh each one**: what's established fact, what's the creator's opinion, and how reliable it
is. Quality and trust of curation matter more than volume.

## Possible future directions (not committed)

Community moderation and reputation, multilingual topics, non-video media types, in-product
AI assistance for finding candidate clips and drafting first-pass context/accuracy
assessments (human-reviewed), and creator/editor tooling.
