import type { Metadata } from "next";
import Link from "next/link";
import { AuthControl } from "@/components/auth/AuthControl";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";

// /about — "How it works". A PLACEHOLDER SHELL: the universal Daylight Projector header
// (host="page") + the slim footer, a heading, and a way home — no explanatory content yet.
// It exists so the homepage hero's primary "How it works" CTA has a real, non-404 destination;
// writing the actual explainer is a separate build.

export const metadata: Metadata = {
  title: "How it works",
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader host="page" auth={<AuthControl variant="home" />} />
      <main className="mx-auto max-w-[640px] px-4 py-12">
        <h1 className="text-2xl font-semibold text-ink sm:text-3xl">How it works</h1>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-ink2">Coming soon.</p>
        <p className="mt-8">
          <Link
            href="/"
            className="text-[0.95rem] font-bold text-link hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link focus-visible:ring-offset-2"
          >
            <span aria-hidden>←</span> Back to wiki+
          </Link>
        </p>
      </main>
      <SiteFooter containerClassName="mx-auto max-w-[640px] px-4" />
    </>
  );
}
