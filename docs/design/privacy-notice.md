# Design Spec: Minimal privacy / data notice for the public-link prototype (issue #66)

- **Status:** v1, committed (Phase 2 / UX, build-loop for issue [#66](https://github.com/ragesoss/wikiplus/issues/66) — epic #35 §E, **release gate** for the public-link prototype).
- **Owner:** UX / Design.
- **Inputs (read first — this spec grounds in them, does not restate them):**
  - `docs/specs/privacy-notice.md` — the Product spec. This design serves **AC1–AC6** and **AC11**
    (the UX-owned acceptance criteria) and the stories below, and honors the spec's confirmed depth
    (a **lightweight in-app notice**, NOT a legal policy / ToS / DSAR tooling) and the **verified
    as-built data inventory** (the *accuracy source* — this spec turns it into plain language, never
    column lists). AC7–AC10 are Dev/QA verification + the `ARCHITECTURE.md` record; this spec defines
    the wording AC10 records.
  - `docs/ARCHITECTURE.md` — *Authentication & identity* (stateless JWT, no session store; reading is
    anonymous; the one find-or-create write at sign-in), *Licensing & attribution*, and the
    public-vs-private boundary (`rowToPublicContributor` / the `PublicContributor` contract).
  - `lib/auth/microcopy.ts` (`AUTH_COPY.gates.*`) — the existing gate language this spec **reconciles
    with, does not fork**. The notice extends the gate story; it must not drift from it.
  - `docs/CURATION_STANDARD.md` §5.1 / §5.3 / §5.4 — the attribution norms (article CC BY-SA,
    context-note CC BY-SA 4.0, the public "context by &lt;curator&gt;" credit) whose presence Dev/QA
    verify (AC7–AC9). This spec does not restate them; it links to where they live.
  - `docs/TOPIC_PAGE_DESIGN.md` + the **Indigo Press** identity; reference mockups
    `mockups/inline-indigo-sync.html`.
- **Implementable against (current code this spec extends, not redesigns):**
  - `lib/auth/microcopy.ts` — `AUTH_COPY.gates.contribute` (and siblings). This spec **adds one new
    key**, `AUTH_COPY.dataNotice.*`, and **does not change** any existing gate `title`/`body`.
  - `components/auth/LoginPrompt.tsx` — `LoginPromptPanel` / `LoginPromptDialog`. The gate disclosure
    line is added **inside** these two components, below the existing `{body}` paragraph, so **every**
    gate (contribute / curate / add / dismiss / upvote) inherits it with one change (§3.3).
  - `components/auth/AuthControl.tsx` — the signed-in `SignedIn` dropdown menu (the account menu). One
    `DropdownMenu.Item` is added above "Sign out" (§4.4).
  - `app/layout.tsx` (thin shell, **no footer today**), `app/page.tsx` (home, own header/column),
    `app/contribute/page.tsx` (`ContributeHeader`), `app/contributor/[username]/page.tsx`,
    `app/not-found.tsx` — the route-owned chrome a slim shared footer attaches to (§4.3).
  - `app/about/data/page.tsx` — **NEW** static route this spec defines (§4.2, §5).
- **Feeds:** Development (build to **this spec**; extend `AUTH_COPY`, add the route + footer + menu
  item, then record the canonical wording + placement in `docs/ARCHITECTURE.md` per AC10) → QA &
  Review (verify ACs 1–11) + UX evaluation (this spec + the stories, Phase 4).

> **This spec is the contract, written before implementation.** It is **descriptive, not
> prescriptive** — it changes **nothing** about what wiki+ stores or the auth model (Product spec
> §"This spec is descriptive"). It makes the already-built behavior **legible and honest** in two
> surfaces: a **sign-in disclosure** a signed-out visitor reads *before completing* a Wikimedia login
> (AC1), and a **persistent, linkable** notice at a stable URL reachable from a place that is **not
> only the gate** (AC2). Every microcopy string here is **verbatim** — Dev pastes it unchanged. The
> wording must be accurate to the inventory (AC3), state **email is never exposed** as a positive
> promise (AC4), make **reading stays anonymous** explicit (AC5), and **never overclaim** (no
> deletion / export / DSAR; framed as a prototype notice, not a legal agreement — AC6). Every
> requirement is tagged with the Product AC(s) and the story it makes buildable.

---

## 1. Personas & stories served

**Persona A — the prospective contributor (signed-out, at the door).** A Wikimedia-community member
who has found the public link and is about to connect their **real Wikimedia identity**. They are
trust-literate (they know what an OAuth grant is) and will, reasonably, want to know *what handing
over that identity to this site creates* before they click.

> **Story A1 (AC1, AC5).** *As a signed-out visitor about to log in, I want to read — before I
> complete the Wikimedia sign-in — that reading is anonymous and exactly what a contribution stores
> (a Wikimedia identity + a session cookie), so connecting my real identity is an informed choice.*

> **Story A2 (AC3, AC4).** *As that visitor, I want to know that my username and curations become
> public but my email is never shown, so I'm not surprised by what's exposed.*

**Persona B — the returning / curious reader.** Already signed in, or just browsing; wants to
re-find the notice or send it to someone ("here's what this site keeps about you").

> **Story B1 (AC2).** *As any visitor, signed-in or not, I want a stable place I can open directly
> and link to that explains what wiki+ stores, so I can re-find it and share it — not only meet it
> once at the sign-in moment.*

**Persona C — the keyboard / screen-reader user (cross-cutting).**

> **Story C1 (AC11).** *As a keyboard or screen-reader user, I want the notice and its links to be
> reachable, focus-visible, and labeled by text (never color alone), with a sensible heading
> structure, so I can read it the same way as anyone.*

**Non-goal (Product spec §"Out of scope"), to keep the design honest:** this is **not** a legal
privacy policy, ToS, cookie-consent banner, or a deletion/export request flow. The design must read
as a **plain, prototype data notice** — calm, factual, finite — and must not grow affordances
(buttons, request forms) that imply capabilities the prototype lacks.

---

## 2. Placement decision (the durable shape) — and why

The Product spec offers three candidate placements and asks UX to pick. **Decision: build all three
roles around one canonical artifact** — a single **dedicated static route** is the source of truth,
and the gate + footer + account menu are **three links into it**, not three copies of the text. One
canonical surface keeps the wording from drifting and gives the stable, shareable URL AC2 demands.

### 2.1 The canonical surface — a dedicated static route at `/about/data`

- **Route:** **`/about/data`** (rendered by a new `app/about/data/page.tsx`). Title: **"About your
  data"**.
- **Why a dedicated route (not "extend the gate copy only"):** AC2 requires a **persistent, linkable
  URL** reachable from a place that is **not only the gate**. A route is the only candidate that is
  *directly openable and shareable* — a person can type/paste/bookmark `…/about/data`. Inlining the
  full substance into the gate alone fails AC2 (the gate is transient, not addressable).
- **Why `/about/data` (not `/privacy`):** `/privacy` reads as a *legal privacy policy* — exactly the
  overclaim the Product decision rules out (AC6: "framed as a prototype data notice, not a legal
  agreement"). `/about/data` names what the page actually is (*about your data*), sets honest
  expectations, and leaves `/privacy` free for the real policy if/when the production MVP ships one.
  The page's own H1 is "About your data" so the URL and heading agree.
- **Why under `/about/…`:** it reserves an obvious home for future prototype-info pages (an `/about`
  index, `/about/contact`) without re-homing this one. Not required for this gate — just a
  forward-looking, low-cost choice — but the route segment Dev creates is `/about/data` regardless.
- **It is anonymous-reachable.** Like the topic/profile reads, the route has **no auth gate** — a
  signed-out visitor (and the gate's link to it) can open it before authenticating, which is what
  makes the gate link satisfy AC1's "readable before sign-in."

### 2.2 Where the persistent link lives (so it's reachable, not only at the gate — AC2)

A route is only useful if it's *reachable*. The link to `/about/data` lives in **three** persistent
places, in priority order:

1. **A slim shared footer (the primary persistent link).** Today there is **no footer** and
   `app/layout.tsx` is a thin shell where each route owns its chrome — so we introduce a small,
   reusable `SiteFooter` (§4.3) and place it at the **bottom of the constrained-container routes**:
   **home** (`app/page.tsx`), **contribute** (`app/contribute/page.tsx`), and the **contributor
   profile** (`app/contributor/[username]/page.tsx`). It is the durable, always-visible, signed-out-
   reachable home for the link — the canonical answer to AC2.
2. **The account menu (a convenience for signed-in users).** One item — **"About your data"** — added
   to the `SignedIn` dropdown in `AuthControl` (§4.4), above "Sign out". This reaches the notice from
   the **Topic page** too (whose full-bleed chrome does not carry the footer; see below) and from any
   surface where the menu appears — but **only when signed in**, so it is a *supplement*, never the
   sole surface (AC2 explicitly wants a non-gate, signed-out-reachable place: the footer is that).
3. **The sign-in disclosure (the at-the-door link).** The gate's new disclosure line (§3) **links to
   `/about/data`** for the fuller read — closing the loop so the in-context disclosure and the
   persistent surface are the same source.

**Topic page — deliberate footer omission, covered by the menu + the on-page article attribution.**
The Topic page is a full-bleed, scroll-synchronized two-world surface (`TopicView`) with no natural
footer slot; bolting a footer onto it would fight the sticky split layout and the rail sync. It is
covered instead by **(a)** the account-menu item (signed-in) and **(b)** every Topic view already
carrying the **Wikipedia CC BY-SA attribution + source link** in `ArticleBody` (AC7) — the
licensing-attribution surface lives on the Topic page where the licensed content is. The *data*
notice's persistent home is the footer on the entry routes (home/contribute/profile), which is where
a signed-out person arrives and decides to sign in. This is a recorded, intentional scoping choice,
not a gap.

### 2.3 Placement summary (the buildable map)

| Surface | What it shows | When visible | Satisfies |
|---|---|---|---|
| **`/about/data`** route (NEW) | The full notice — the canonical text (§5) | Always; anonymous-reachable; directly linkable | AC2 (stable URL), AC3–AC6 (the substance) |
| **`SiteFooter`** (NEW) on home / contribute / profile | A text link **"About your data"** | Always (signed-in or out) on those routes | AC2 (persistent, non-gate, signed-out-reachable) |
| **Account menu** item in `AuthControl` | A text link **"About your data"** | Signed-in only, everywhere the menu is | AC2 (supplements; reaches Topic page) |
| **Gate disclosure** in `LoginPrompt*` | A one-line stored-data summary **+ a link** to `/about/data` | Signed-out, at every contribute gate | AC1 (readable before sign-in), AC3–AC5 |

---

## 3. Surface 1 — the sign-in disclosure (the gate)

### 3.1 Goal & reconciliation with `AUTH_COPY.gates.*`

The existing gate body already says the trust-relevant half: *"…requires a Wikipedia login, so your
curation is tied to your Wikimedia identity. **Reading stays anonymous.**"* (`gates.contribute.body`).
That sentence is good and **stays unchanged** — it already carries AC5's "reading stays anonymous"
at the gate. What it does **not** say is *what is stored* when you do contribute (an identity **and a
session cookie**) — AC1's second half. So the design **adds one disclosure line beneath the existing
body**, shared across all gates, rather than rewriting each gate's `body`. This keeps the five gate
bodies (contribute / curate / add / dismiss / upvote) and the new disclosure from drifting: the
disclosure is authored **once** in `AUTH_COPY.dataNotice` and rendered by the shared `LoginPrompt*`
components, so it appears identically on every gate.

> **Reconciliation rule (binding):** do **not** edit any existing `AUTH_COPY.gates.*` `title`/`body`/
> `secondaryLabel`. Add the disclosure as a **new sibling key** and render it as a distinct element
> below `{body}` in `LoginPromptPanel` and `LoginPromptDialog`. The gate's own copy still leads; the
> disclosure is the always-present footer of the gate.

### 3.2 The disclosure line — exact microcopy (VERBATIM)

Add to `lib/auth/microcopy.ts` as a new top-level key (sibling of `gates`, `errors`, `rateLimit`):

```ts
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
```

Notes on the wording, mapped to the ACs:

- **AC1 (what's stored, before sign-in):** "links your Wikimedia account" + "sets a session cookie"
  — the two durable things the inventory names (`account` identity + the stateless JWT cookie).
- **AC4 (email-never-exposed, as a positive promise):** "your username and your curations are
  public; **your email is never shown**" — stated affirmatively, and it does not imply email is
  shown.
- **AC5 (reading stays anonymous):** "Reading needs no login and stores no identity" — reinforces the
  gate's own "Reading stays anonymous" without contradicting it.
- **AC6 (no overclaim):** no deletion/export/DSAR language; phrased as a description, not a promise of
  rights. The deeper detail is deferred to the linked page, which is itself honest about its scope.
- **AC3 (accurate to schema):** "credited to you" = the public `context by <curator>` attribution;
  "your curations are public" = clips + notes (+ votes/dismissals folded as "your curation"). No
  table names; category-level accuracy.

### 3.3 Rendering in the gate components (the DOM contract)

In **both** `LoginPromptPanel` and `LoginPromptDialog`, immediately **below** the existing
`<p>{body}</p>` and **above** the error slot, render the disclosure as its own block:

```
<div class="…disclosure block…">
  <p>
    <span class="font-bold">{AUTH_COPY.dataNotice.gateLead}</span>{" "}
    {AUTH_COPY.dataNotice.gateBody}
  </p>
  <Link href="/about/data">{AUTH_COPY.dataNotice.gateLinkLabel} →</Link>
</div>
```

- The link is a real Next `<Link href="/about/data">` (in-SPA navigation; the route is
  anonymous-reachable so the visitor can read the full notice **without** authenticating — AC1).
- The disclosure is **always rendered** when the gate renders (it is not behind a "more info"
  toggle) — AC1 requires the substance be *readable*, not merely *reachable behind a click*. The
  one-line summary is the readable substance; the link is the path to the fuller read.

### 3.4 Visual treatment (Indigo Press)

- The gate panel/dialog header is the indigo `bg-brand` block already in `LoginPrompt*` (unchanged).
- The disclosure block sits on the panel's light body. Treat it as a **quiet secondary note**, set
  apart from the primary `{body}` so it reads as "the fine print you can actually read":
  - A **hairline top rule** (`border-t border-ink/15`) and a little top padding/margin to separate it
    from `{body}`; **no** color-block fill (it must not compete with the indigo header or the login
    button).
  - Body text **`text-ink2`** (the existing secondary ink, `#595959`), `text-[12px]` to `text-[13px]`,
    `leading-relaxed`. The `gateLead` span is `font-bold` `text-ink` so the label is legible **by
    weight**, not color (text-labeled, never color alone — AC11).
  - The link uses the project's established link affordance: **`text-action` (`#1F6F95`) +
    `font-bold` + `hover:underline`**, matching the `secondaryLabel` link already in
    `LoginPromptPanel`. The trailing **`→`** is decorative reinforcement; the **word** "About your
    data" is the accessible label (the arrow is inside the link text, so it's announced — acceptable,
    or wrap it `aria-hidden` if Dev prefers; the word alone must be a complete label).
- Order within the panel body, top→bottom: `{body}` → **disclosure block** → error slot (if any) →
  the login button row. The login button stays the visual primary; the disclosure never outweighs it.

### 3.5 Gate disclosure — states

The gate is a **client component reading session state**; the disclosure itself is **static text**
with one static link — it has no load/empty/error states of its own. The states are the gate's
existing ones (unchanged), with the disclosure present in each:

| Gate state | Disclosure behavior |
|---|---|
| **Signed-out (the gate is shown)** | Disclosure present, below `{body}`. This is the only state the gate renders in. |
| **OAuth-return error present** (`error` prop set) | Disclosure still present, **above** the existing `ErrorNotice`. The error is about *this attempt failing*; the disclosure is about *what signing in stores* — both are true at once, no conflict. |
| **`loading` / session resolving** | The page-level neutral placeholder already shown by callers (e.g. `/contribute`'s pulse block) stands; the gate (and its disclosure) renders once resolved. No change. |
| **Authenticated** | The gate does not render (callers show the form / signed-in UI). The disclosure is then reachable via the footer / account menu, not the gate. |

---

## 4. Surface 2 — the persistent notice (`/about/data`) + its links

### 4.1 Information architecture of the page

A single, short, scannable page — **one H1, four short H2 sections**, finite and calm. The reading
order answers the questions in the order a person asks them:

1. **What this page is** (a prototype data notice, not a legal policy) — sets honest scope up front
   (AC6).
2. **Reading is anonymous** (AC5) — the reassuring default first.
3. **What logging in and contributing stores** (AC3) — the four categories in plain language.
4. **What's public and what's never shown** (AC4) — the boundary, with email as a positive promise.
5. A short closing line + back-link home.

No interactive controls (no "delete my data" / "export" buttons — AC6). It is read-only prose.

### 4.2 The page — exact microcopy (VERBATIM)

Dev pastes this content into `app/about/data/page.tsx`. Headings are real `<h1>`/`<h2>` elements in
this exact order and text. (Inline links named below; the rest is plain prose.)

> **H1 — "About your data"**
>
> *(intro paragraph)*
> wiki+ is a prototype — a curation layer that sits alongside Wikipedia. This page plainly describes
> what the prototype stores about you and what it doesn't. It is **not** a legal privacy policy or
> terms of service, and it doesn't offer data-export or account-deletion requests; if wiki+ grows
> into a full service, a proper privacy policy will come with it.
>
> **H2 — "Reading is anonymous"**
>
> You can browse topics, read the Wikipedia articles, search, and watch the curated videos **without
> logging in**. Reading stores no identity about you and sets no login cookie. The article text is
> fetched straight from Wikipedia as you read it.
>
> **H2 — "What logging in and contributing stores"**
>
> You only log in when you want to **contribute** — add a clip, write a context note, upvote, or rule
> a suggestion out. Logging in uses your **Wikimedia account** (the same one you use to edit
> Wikipedia); wiki+ never sees or stores a password. When you log in and contribute, wiki+ stores:
>
> - **A link to your Wikimedia account** — a stable account identifier and the profile details
>   Wikimedia shares (your username, and your name, email, and avatar if you've made them available),
>   so we can recognize you on your next visit and credit your work.
> - **A session cookie** — a signed cookie in your browser that keeps you logged in. There is no
>   server-side session record; signing out clears it.
> - **Your curation contributions** — the clips and context notes you publish, the curation actions
>   you take (such as upvotes and ruled-out suggestions), and any reviewer role you may be granted.
>   Your published clips and notes are credited to your username.
>
> **H2 — "What's public, and what's never shown"**
>
> **Public:** your Wikimedia **username**, your **avatar** (if Wikimedia shares one), and the
> **clips and context notes** you publish — these appear on your contributor page and on the topics
> you curate, credited to you.
>
> **Never shown publicly:** your **email is never displayed anywhere on wiki+**, and neither are the
> other private details from your account. Which videos you upvoted or ruled out, and any reviewer
> role you hold, are not shown on your public page either.
>
> *(closing line)*
> That's the whole picture for the prototype. Questions about your Wikimedia account itself are
> covered by Wikimedia's own privacy policy.
>
> *(back-link)* **← Back to wiki+** *(links to `/`)*

Mapping to the ACs:

- **AC3 (accurate, four categories, no table names):** the three bullets are exactly **account /
  session cookie / curation contributions** in plain language; the moderator flag, votes, dismissals,
  and the write-event ledger are **folded** into "the curation actions you take… and any reviewer role
  you may be granted" — per the Product spec's instruction not to enumerate internal tables.
- **AC4 (email-never-exposed, positive promise + the public/private split):** the "What's public /
  Never shown" section states it both ways and makes "email is never displayed anywhere" a flat
  promise — consistent with `rowToPublicContributor` / the `PublicContributor` contract. It does not
  imply email is shown.
- **AC5 (reading anonymous, explicit & true):** the "Reading is anonymous" section is unambiguous —
  no login, no identity stored, no login cookie on the read path; and "You only log in when you want
  to contribute" makes the one write the inventory describes the *only* identity-creating act.
- **AC6 (no overclaim, prototype framing):** the intro says it's a prototype, **not** a legal policy,
  and **explicitly disclaims** export/deletion requests rather than promising them. The closing line
  points to Wikimedia's own policy for the upstream account — honest about the boundary of what wiki+
  controls.
- **Wikimedia-etiquette / honesty:** "the same one you use to edit Wikipedia" and "wiki+ never sees
  or stores a password" preempt the most common misconception (that an OAuth login hands over a
  password) — trust-building, accurate to the OAuth model in ARCHITECTURE.

### 4.3 The shared footer (`SiteFooter`) — the persistent link home

Introduce a small reusable footer component (Dev's call on filename, e.g.
`components/chrome/SiteFooter.tsx`) placed at the bottom of **home**, **contribute**, and
**contributor-profile** routes (§2.2). It is **minimal** — this is a prototype, not a marketing
footer:

- **Content:** a single horizontal row of quiet links/labels, centered or left-aligned to match each
  page's container. For this gate the required item is **one link: "About your data" → `/about/data`**.
  Dev may include the existing prototype-shared-data caveat already on the home page near it, but the
  **only required, spec-owned element is the "About your data" link** — keep the footer otherwise
  empty so it doesn't imply more than exists.
- **Visual (Indigo Press, quiet):** separated from page content by a **`border-t border-ink/10`**
  hairline (matching the home page's "Explore example topics" rule); generous top padding; text
  **`text-sm` `text-ink2`**; the link uses the standard link affordance (**`text-action` +
  `hover:underline`**, focus-visible ring per §6). No color-block, no indigo fill — it recedes.
- **Layout:** it sits in the **normal document flow at the end of `<main>`** (not `position: fixed` —
  a sticky footer fights the vertical-first scroll). On the home page it sits below the "Explore
  example topics" section; on `/contribute` and the profile, below their content.
- **Landmark:** render as a `<footer>` element (a `contentinfo` landmark) so AT users can jump to it.

### 4.4 The account-menu item (`AuthControl` → `SignedIn`)

Add **one** `DropdownMenu.Item` to the signed-in dropdown, **above** "My curations" or between "My
curations" and the "Sign out" divider — order: **My curations → About your data → (divider) → Sign
out**. It navigates to `/about/data`:

```
<DropdownMenu.Item onSelect={() => router.push("/about/data")}
  className="…same item classes as the existing items…">
  About your data
</DropdownMenu.Item>
```

- Reuse the **exact** item styling already in `SignedIn` (`px-3 py-2 text-sm font-bold … data-
  [highlighted]:bg-bg2`) so it's visually one menu — no bespoke styling.
- The word **"About your data"** is the label (text-labeled; no icon-only). Radix already gives the
  menu its keyboard model (arrow keys, Enter, Esc, focus return) — inherited, nothing new to build.
- This is the **supplement** that reaches the notice from the Topic page (whose chrome carries no
  footer). It is signed-in-only by construction (the `SignedIn` subtree only mounts when
  authenticated), which is why the **footer** — not the menu — is the AC2 signed-out-reachable home.

### 4.5 `/about/data` — states

It is a **static, content-only route** — server-rendered prose with no data fetch, no `store` call,
no session dependency.

| State | Behavior |
|---|---|
| **Default (populated)** | The full notice (§4.2). This is the **only** state. |
| **Loading** | **None.** The page is static content with no async fetch — it renders complete on first paint. (Explicitly: do **not** add a skeleton/spinner; there is nothing to wait for.) |
| **Empty** | **None.** The content is hard-coded prose, never data-derived — it cannot be empty. |
| **Error** | **None of its own.** No fetch can fail. (A generic app/render error is the platform's concern, not this page's.) |

> **Stated for the record (Product spec asked UX to say so):** because the persistent surface is a
> **static route**, it has **no load / empty / error states**. This is a deliberate property — a data
> notice that could fail to load would undermine the very trust it exists to build. Keeping it static
> (no `store`, no session) guarantees it always renders.

---

## 5. Layout & responsive behavior (mobile-first / vertical-first)

The prototype is **web-first, responsive, and vertical-first** (VISION) — design the page for a
phone first, let it breathe on desktop.

### 5.1 `/about/data` layout

- **Container:** a single centered reading column, **`max-w-[640px]`** (matching the home hero's
  `max-w-[640px]` reading measure), `mx-auto`, comfortable horizontal padding (`px-4` mobile,
  widening on `sm`+). Prose line-length stays ~60–70ch for readability.
- **A minimal page header** so the route isn't chrome-less: reuse the **same lightweight wordmark row**
  the `/contribute` page uses (`ContributeHeader`-style — a "wiki+" home link + the `AuthControl`),
  so a person who lands here cold (a shared link) can get home and see their auth state. Dev may
  extract/share that small header rather than duplicate it; it is **not** the full Topic split-header.
- **Vertical rhythm:** H1 large (`text-2xl`/`text-3xl`, `font-semibold`, `text-ink`), section H2s
  `text-lg`/`text-xl` `font-semibold` with clear top margin; body `text-ink2`, `text-[0.95rem]`,
  `leading-relaxed`; bulleted list with normal list affordances. Generous spacing between sections so
  it scans on a small screen.
- The **footer** (§4.3) sits at the bottom of this route too (consistency).
- Single-column at **every** width (a notice doesn't need a multi-column layout); it simply gets more
  horizontal margin on wide screens via the `max-w` container. No horizontal scroll at any width.

### 5.2 Gate disclosure responsive

The disclosure lives inside `LoginPrompt*`, which is already responsive (`LoginPromptPanel`
inline; `LoginPromptDialog` is `max-w-md` inside `ModalShell`). The disclosure block is plain text +
a link that **wraps naturally**; the link is a full-width-safe inline element. On the narrowest dialog
it simply stacks under the body — no special breakpoint work. Keep tap targets honest: the link is a
normal inline link within readable line-height; the **login button** remains the large 44px-min
primary target (unchanged).

### 5.3 Footer responsive

Single link/row; wraps if other items are ever added. No fixed positioning, so it never covers
content on a short mobile viewport.

---

## 6. Accessibility (AA baseline — AC11)

Written into the spec so Dev builds it, not bolts it on:

- **Contrast (AA):** all notice/disclosure body text is `text-ink` (`#2C2C2C`) or `text-ink2`
  (`#595959`) on white/`#F7F7F7` — both clear AA for normal text (ink ≈ 12.6:1; ink2 ≈ 7:1). The link
  color **`text-action` (`#1F6F95`)** on white is **≈ 5.0:1** — AA for normal text and for its
  bold/`font-bold` weight. **Do not** render the link or any signal in **gold `#E5AB28`** (it is the
  reserved accent and is not AA on white — and never a functional signal per CLAUDE.md).
- **Never color alone (AC11):** every link is **underlined on hover/focus and carries a real text
  label** ("About your data"); the gate disclosure's emphasis is by **font-weight** (`gateLead`
  bold), not color. No meaning is conveyed by color or border-style alone.
- **Visible focus:** every link and the menu item must show the project's **focus-visible ring** (the
  established 3px indigo outline w/ 2px offset, or the route's existing `focus:ring-2 focus:ring-action
  focus:ring-offset-2` pattern). The Radix menu item inherits its highlight + keyboard focus model.
- **Keyboard-reachable:** the `/about/data` route is reachable by typing the URL and by **Tab**-ing to
  the footer link / opening the account menu with the keyboard (Radix handles the menu). The gate
  link is in the gate's natural tab order, before the login button. Nothing is mouse-only.
- **Heading structure:** `/about/data` has exactly **one `<h1>`** ("About your data") and sequential
  `<h2>`s — no skipped levels — so AT users can navigate by heading. The gate keeps its existing
  single `<h2>` title; the disclosure adds **no** heading (it's body text under the gate's heading),
  so the gate's heading hierarchy is unchanged.
- **Link affordance & landmarks:** links look like links (color + hover/focus underline); the footer
  is a `<footer>` (contentinfo) landmark; the notice page content is within `<main>`.
- **Screen-reader wording:** the link text "About your data" is a complete, meaningful accessible
  name on its own (the decorative `→` may be inside it or `aria-hidden`; the word must stand alone).
  No `title`-attribute-only affordances.

---

## 7. What Dev implements (checklist mapped to the spec's ACs)

A buildable contract. Each item names the AC(s) it satisfies; QA verifies against the live UI.

1. **Add `AUTH_COPY.dataNotice`** (`gateLead` / `gateBody` / `gateLinkLabel`) to
   `lib/auth/microcopy.ts`, **verbatim** from §3.2. **Do not edit** any existing `gates.*`. *(AC1,
   AC3, AC4, AC5, AC6 — gate side)*
2. **Render the disclosure** in `LoginPromptPanel` **and** `LoginPromptDialog` (below `{body}`, above
   the error slot), with the `<Link href="/about/data">` per §3.3–§3.4. It appears on **every** gate
   (contribute / curate / add / dismiss / upvote) by construction. *(AC1, AC3–AC5)*
3. **Create the route `app/about/data/page.tsx`** as a **static** page with the §4.2 content
   verbatim — one `<h1>`, four `<h2>`s, the three bullets, closing line, back-link to `/`. No
   `store`/session/fetch; no loading/empty/error states (§4.5). *(AC2, AC3–AC6)*
4. **Add a minimal page header** to the route (reuse the `/contribute` `ContributeHeader`-style
   wordmark + `AuthControl`; extract/share rather than duplicate if practical). *(AC2 reachability)*
5. **Introduce `SiteFooter`** (one required link, "About your data" → `/about/data`) and place it on
   **home**, **contribute**, and **contributor-profile** routes, as a `<footer>` landmark, in normal
   flow. *(AC2 — persistent, non-gate, signed-out-reachable)*
6. **Add the account-menu item** "About your data" → `/about/data` in `AuthControl`'s `SignedIn`
   dropdown, reusing the existing item styling, ordered before the Sign-out divider. *(AC2 — Topic-page
   + signed-in reach)*
7. **Accessibility:** AA contrast (no gold link), text-labeled links, visible focus, keyboard
   reachability, the single-h1/sequential-h2 structure on `/about/data` (§6). *(AC11)*
8. **Responsive:** `/about/data` is a single centered `max-w-[640px]` column, no horizontal scroll at
   any width; the disclosure + footer wrap naturally (§5). *(AC11 / responsive baseline)*
9. **Record in `docs/ARCHITECTURE.md`** (the privacy-boundary section) the **canonical wording**
   (§3.2 + §4.2) and the **placements** (route `/about/data`; footer on home/contribute/profile;
   account menu; gate disclosure) — the durable record. *(AC10)*
10. **Verify the attribution facts (Dev + QA, AC7–AC9), unchanged by this UX spec:** the Wikipedia
    CC BY-SA attribution renders on a live Topic (`ArticleBody`, AC7); the context-note CC BY-SA 4.0
    license is captured at submit (AC8); and AC9 is resolved (confirm a license indication on the
    public note display **or** record "at submit only" in `ARCHITECTURE.md`). These are **not** UX
    deliverables but are listed so the build covers them. *(AC7, AC8, AC9)*

> **Out of scope for Dev (do not build):** any deletion/export/DSAR control, a cookie-consent banner,
> a `/privacy` legal page, a footer on the Topic split-header, or any change to what is stored or to
> the auth model. The notice **describes** the as-built system only (Product spec §"Out of scope").

---

## 8. What UX will evaluate in Phase 4 (against this spec + the stories)

After Dev builds, UX evaluates the running UI — *does it match intent and feel right?* (distinct from
QA's correctness/security pass):

1. **Story A1 / AC1 — readable before sign-in.** From a signed-out browser, open a contribute gate
   (e.g. `/contribute`, or the Curate/Add/upvote/dismiss gates): the disclosure line is **visible
   without any extra click**, states what's stored + that reading is anonymous, and its "About your
   data" link opens `/about/data` **without** forcing a login. (Fail if it's hidden behind a toggle,
   or the link demands auth.)
2. **Story B1 / AC2 — persistent, linkable, re-findable.** `/about/data` opens directly by URL and is
   shareable; the **footer** link reaches it from home/contribute/profile **while signed out**; the
   **account menu** reaches it while signed in (incl. from a Topic page). (Fail if the only path is the
   gate, or the footer link is missing/signed-in-only.)
3. **AC3/AC4/AC5/AC6 — wording fidelity & honesty.** The shipped strings match §3.2 / §4.2 verbatim;
   the four categories read as plain language (no column names); **email-never-shown** is a positive
   promise; reading-anonymous is explicit; **no** deletion/export/DSAR/legal-policy overclaim, and the
   prototype framing is present. (Fail on any drift, overclaim, or implied email exposure.)
4. **Reconciliation — no drift with the gate.** The disclosure sits with, and does not contradict, the
   existing gate body ("Reading stays anonymous"); the gate's own copy still leads; no existing
   `gates.*` text was altered.
5. **Indigo Press fidelity & altitude.** The disclosure reads as a quiet secondary note (not a second
   color-block competing with the indigo header/login button); `/about/data` reads as a calm,
   editorial prototype notice; **no gold** used as a signal/link; the footer recedes.
6. **AC11 — accessibility-in-practice.** Keyboard-only: Tab to the footer link, open the menu item,
   and traverse `/about/data` by headings; every focused link shows the visible ring and is
   underlined on focus; contrast passes AA on the real surfaces; nothing relies on color alone.
7. **Responsive feel.** On a narrow (phone) viewport `/about/data` is a comfortable single-column
   read with no horizontal scroll; the gate disclosure and footer wrap cleanly.

Defects route back to **Development** with the AC/story they violate.

---

## 9. Open questions / assumptions (logged for Product)

- **A1 (assumption).** The cached provider profile bits in the inventory (`account.name` / `email` /
  `avatarUrl`) are stored *only when Wikimedia grants them* under the identify scope. The §4.2 wording
  hedges with **"if you've made them available"** / **"if Wikimedia shares one"** to stay accurate
  whether or not email/avatar are actually granted by the default scope. If Product/Dev confirm the
  **default identify scope never returns an email**, the wording can be tightened to drop the email
  hedge — but keeping the hedge is **never inaccurate** (it only ever over-discloses what *might* be
  stored, and the public promise that email is *never shown* is independent and still holds).
- **A2 (assumption — footer scope).** I scoped the shared footer to the three **constrained-container**
  routes (home / contribute / profile) and deliberately **omitted the Topic split-header page**,
  covering Topic via the account menu + its on-page Wikipedia attribution (§2.2). If Product wants the
  data-notice link on the Topic page for **signed-out** Topic visitors too, that's a small follow-up
  (a quiet link in the Topic chrome) — flagged, not built here, to avoid disturbing the committed
  two-world sticky layout under a release-gate change.
- **OQ1 (for Product/roadmap, not this gate).** When wiki+ moves to a production MVP with broad public
  traffic, a real **privacy policy / ToS** is a separate deliverable; `/privacy` is intentionally left
  free for it. This notice's intro already promises "a proper privacy policy will come with it" — that
  is a forward-looking statement Product should be comfortable standing behind.
- **OQ2 (verification handoff, not UX).** AC9 (context-note license **on public display**) is Dev/QA's
  to resolve; this spec does not design a display-side license marker. If QA finds the §5.3 license is
  carried **at submit only**, that's acceptable for this gate **if recorded in `ARCHITECTURE.md`** —
  no UX change needed. If a display marker *is* later wanted, it's a separate design task.
