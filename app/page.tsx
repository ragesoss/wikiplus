"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { store, seedIfEmpty } from "@/lib/data";
import type { Topic } from "@/lib/data/types";
import { SiteHeader } from "@/components/SiteHeader";

interface SearchResult {
  title: string;
  description: string;
  url: string;
}

export default function HomePage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      setTopics(await store.listTopics());
    })();
  }, []);

  // Debounced opensearch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearchOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&search=${encodeURIComponent(query.trim())}&limit=5`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data: [string, string[], string[], string[]] = await res.json();
        const [, titles, descriptions, urls] = data;
        const items: SearchResult[] = titles.map((t, i) => ({
          title: t,
          description: descriptions[i] ?? "",
          url: urls[i] ?? "",
        }));
        setResults(items);
        setSearchOpen(items.length > 0);
        setActiveIdx(-1);
      } catch {
        // Silently fail
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function selectResult(result: SearchResult) {
    setSearchOpen(false);
    setQuery(result.title);
    router.push(`/topic?title=${encodeURIComponent(result.title)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) {
        selectResult(results[activeIdx]);
      } else if (results[0]) {
        selectResult(results[0]);
      }
    } else if (e.key === "Escape") {
      setSearchOpen(false);
      setActiveIdx(-1);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-8">
          <section className="space-y-4">
            <h1 className="text-2xl font-semibold text-[#2C2C2C]" style={{ fontFamily: "Georgia, serif" }}>
              wiki<span className="font-black text-[#676EB4]" style={{ fontFamily: "Source Sans 3, Source Sans Pro, system-ui, sans-serif" }}>＋plus</span>
            </h1>
            <p className="max-w-2xl text-sm text-[#54595d]">
              A curation layer over Wikipedia — each topic pairs the encyclopedia article with curated,
              contextualized short videos.{" "}
              <span className="text-[#54595d]/70">
                (Prototype: data lives in your browser&apos;s local storage.)
              </span>
            </p>

            {/* Search */}
            <div className="relative max-w-xl">
              <label htmlFor="wiki-search" className="block text-sm font-medium text-[#2C2C2C] mb-1.5">
                Search Wikipedia topics
              </label>
              <div className="relative">
                <input
                  id="wiki-search"
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => results.length > 0 && setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  placeholder="e.g. Photosynthesis, Black hole, Renaissance…"
                  className="w-full border-2 border-[#2C2C2C] px-3 py-2.5 text-sm bg-white shadow-[3px_3px_0_#2C2C2C] focus:outline-none focus:border-[#676EB4] focus:shadow-[3px_3px_0_#676EB4]"
                  aria-label="Search Wikipedia topics"
                  aria-autocomplete="list"
                  aria-controls={searchOpen ? "search-results" : undefined}
                  aria-activedescendant={
                    activeIdx >= 0 ? `search-result-${activeIdx}` : undefined
                  }
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setResults([]); setSearchOpen(false); inputRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#54595d] hover:text-[#2C2C2C] px-1"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {searchOpen && results.length > 0 && (
                <ul
                  id="search-results"
                  ref={listRef}
                  role="listbox"
                  aria-label="Search results"
                  className="absolute z-30 w-full bg-white border-2 border-[#2C2C2C] border-t-0 shadow-[4px_4px_0_#2C2C2C] max-h-64 overflow-y-auto"
                >
                  {results.map((result, i) => (
                    <li
                      key={result.title}
                      id={`search-result-${i}`}
                      role="option"
                      aria-selected={i === activeIdx}
                    >
                      <button
                        type="button"
                        onMouseDown={() => selectResult(result)}
                        className={[
                          "w-full text-left px-4 py-2.5 border-b border-[#a2a9b1] last:border-b-0",
                          i === activeIdx ? "bg-[#f0f2ff]" : "hover:bg-[#f8f9fa]",
                        ].join(" ")}
                      >
                        <span className="block font-medium text-sm text-[#2C2C2C]" style={{ fontFamily: "Georgia, serif" }}>
                          {result.title}
                        </span>
                        {result.description && (
                          <span className="block text-xs text-[#54595d] mt-0.5 truncate">
                            {result.description}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Topics list */}
          {topics === null ? (
            <p className="text-sm text-[#54595d]">Loading…</p>
          ) : topics.length === 0 ? (
            <p className="text-sm text-[#54595d]">No topics yet.</p>
          ) : (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#2C2C2C]" style={{ fontFamily: "Georgia, serif" }}>
                Curated topics
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {topics.map((t) => (
                  <li key={t.qid}>
                    <Link
                      href={`/topic?qid=${encodeURIComponent(t.qid)}`}
                      className="block border-2 border-[#2C2C2C] bg-white p-4 shadow-[3px_3px_0_#2C2C2C] hover:shadow-[4px_4px_0_#676EB4] hover:border-[#676EB4] transition-all"
                    >
                      <span className="block font-medium text-[#2C2C2C]" style={{ fontFamily: "Georgia, serif" }}>
                        {t.title}
                      </span>
                      {t.description && (
                        <span className="mt-1 block text-sm text-[#54595d]">
                          {t.description}
                        </span>
                      )}
                      <span className="mt-2 block text-xs text-[#676EB4] font-mono">
                        {t.qid}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
