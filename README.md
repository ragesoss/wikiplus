# wiki+

An enhanced Wikipedia that lets people **curate and contextualize creator-driven
social-media video** relevant to a topic — with a focus on short, vertical clips
(TikTok / Reels / Shorts), though not exclusively. The first version is a
**curation/contextualization layer over real Wikipedia articles**: open a topic, read the
Wikipedia content, and see a community-curated set of relevant clips — each with the creator's
identity and a human-written **context note** that separates fact from the creator's opinion,
flags accuracy, and links it to the part of the article it relates to.

The project aims to be widely used with lots of user-curated additions, so it is built to
**scale efficiently on modest server resources**, iterate quickly, and be **built and
operated by AI agents** in distinct roles.

## Documentation

- [`docs/VISION.md`](docs/VISION.md) — what wiki+ is, why it exists, MVP scope, non-goals.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, scaling strategy, data model,
  Wikipedia integration, licensing.
- [`docs/AGENT_OPERATING_MODEL.md`](docs/AGENT_OPERATING_MODEL.md) — the agent roles and how
  the project is built and run.
- [`docs/TOPIC_PAGE_DESIGN.md`](docs/TOPIC_PAGE_DESIGN.md) — the chosen design direction for the
  core Topic page (Wiki article + ＋plus rail, synced; "Indigo Press" identity on the WikiEdu
  palette). Reference mockup: `mockups/inline-indigo-sync.html`.

> Status: **pre-build.** This repository currently contains the vision and specification
> only. No application code yet.
