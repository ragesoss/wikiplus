import type { Metadata } from "next";
import Link from "next/link";
import { AuthControl } from "@/components/auth/AuthControl";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";

// ── /about/data — the persistent data notice (issue #66, design §2.1 / §4). ───────────────
// The canonical, anonymous-reachable surface for "what wiki+ stores about you" (AC2): a stable,
// directly-linkable, shareable URL the gate disclosure, the footer, and the account menu all point
// to. It is DESCRIPTIVE — it changes nothing about what is stored; it makes the as-built behavior
// legible and honest (the inventory in docs/specs/privacy-notice.md, turned to plain language).
//
// STATIC by construction (design §4.5): a server-rendered content-only page with NO store call, NO
// session dependency, NO data fetch — so it has no loading / empty / error states and ALWAYS
// renders. (A data notice that could fail to load would undermine the trust it exists to build.)
//
// Copy is VERBATIM from design §4.2; it is not paraphrased here. Layout (design §5.1): a single
// centered max-w-[640px] reading column, one <h1>, four sequential <h2>s, the three bullets, the
// closing line, and a "Back to wiki+" link to /. The shared SiteHeader (home link + auth state) so
// a cold-arriving shared link can get home; the SiteFooter at the bottom for consistency.

export const metadata: Metadata = {
  title: "About your data",
};

export default function AboutDataPage() {
  return (
    <>
      <SiteHeader auth={<AuthControl variant="home" />} />
      <main className="mx-auto max-w-[640px] px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">About your data</h1>

        <p className="mt-4 text-[0.95rem] leading-relaxed text-ink2">
          wiki+ is a prototype — a curation layer that sits alongside Wikipedia. This page
          plainly describes what the prototype stores about you and what it doesn&apos;t. It is{" "}
          <strong className="font-semibold text-ink">not</strong> a legal privacy policy or terms
          of service, and it doesn&apos;t offer data-export or account-deletion requests; if wiki+
          grows into a full service, a proper privacy policy will come with it.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-ink sm:text-xl">Reading is anonymous</h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink2">
          You can browse topics, read the Wikipedia articles, search, and watch the curated videos{" "}
          <strong className="font-semibold text-ink">without logging in</strong>. Reading stores no
          identity about you and sets no login cookie. The article text is fetched straight from
          Wikipedia as you read it.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-ink sm:text-xl">
          What logging in and contributing stores
        </h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink2">
          You only log in when you want to{" "}
          <strong className="font-semibold text-ink">contribute</strong> — add a clip, write a
          context note, upvote, or rule a suggestion out. Logging in uses your{" "}
          <strong className="font-semibold text-ink">Wikimedia account</strong> (the same one you
          use to edit Wikipedia); wiki+ never sees or stores a password. When you log in and
          contribute, wiki+ stores:
        </p>
        <ul className="mt-3 list-disc space-y-3 pl-6 text-[0.95rem] leading-relaxed text-ink2">
          <li>
            <strong className="font-semibold text-ink">A link to your Wikimedia account</strong> — a
            stable account identifier and the profile details Wikimedia shares (your username, and
            your name, email, and avatar if you&apos;ve made them available), so we can recognize you
            on your next visit and credit your work.
          </li>
          <li>
            <strong className="font-semibold text-ink">A session cookie</strong> — a signed cookie
            in your browser that keeps you logged in. There is no server-side session record;
            signing out clears it.
          </li>
          <li>
            <strong className="font-semibold text-ink">Your curation contributions</strong> — the
            clips and context notes you publish, the curation actions you take (such as upvotes and
            ruled-out suggestions), and any reviewer role you may be granted. Your published clips
            and notes are credited to your username.
          </li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold text-ink sm:text-xl">
          What&apos;s public, and what&apos;s never shown
        </h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink2">
          <strong className="font-semibold text-ink">Public:</strong> your Wikimedia{" "}
          <strong className="font-semibold text-ink">username</strong>, your{" "}
          <strong className="font-semibold text-ink">avatar</strong> (if Wikimedia shares one), and
          the <strong className="font-semibold text-ink">clips and context notes</strong> you
          publish — these appear on your contributor page and on the topics you curate, credited to
          you.
        </p>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink2">
          <strong className="font-semibold text-ink">Never shown publicly:</strong> your{" "}
          <strong className="font-semibold text-ink">
            email is never displayed anywhere on wiki+
          </strong>
          , and neither are the other private details from your account. Which videos you upvoted or
          ruled out, and any reviewer role you hold, are not shown on your public page either.
        </p>

        <p className="mt-8 text-[0.95rem] leading-relaxed text-ink2">
          That&apos;s the whole picture for the prototype. Questions about your Wikimedia account
          itself are covered by Wikimedia&apos;s own privacy policy.
        </p>

        <p className="mt-8">
          <Link
            href="/"
            className="text-[0.95rem] font-bold text-action hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
          >
            <span aria-hidden>←</span> Back to wiki+
          </Link>
        </p>
      </main>
      <SiteFooter containerClassName="mx-auto max-w-[640px] px-4" />
    </>
  );
}
