import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTopicSuggestions } from "@/lib/wiki/suggest";

// Unit tests for the Wikipedia typeahead client (#12, Decision 2). The fetch is
// MOCKED (no network egress in CI). Confirms: the REST search/title endpoint shape +
// Api-User-Agent etiquette, the namespace-0/limit query, the parsed result mapping,
// and the BINDING silent-degrade contract (any error → [], never a throw).

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: ok ? status : status,
      headers: { "content-type": "application/json" },
    })
  );
}

describe("fetchTopicSuggestions — endpoint + etiquette (Decision 2)", () => {
  it("hits the REST search/title endpoint with the query, limit, and Api-User-Agent", async () => {
    const spy = mockFetchOnce({ pages: [] });
    await fetchTopicSuggestions("cat", { limit: 7 });
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain(
      "https://en.wikipedia.org/w/rest.php/v1/search/title"
    );
    expect(String(url)).toContain("q=cat");
    expect(String(url)).toContain("limit=7");
    expect(
      (init as RequestInit).headers as Record<string, string>
    ).toMatchObject({ "Api-User-Agent": expect.stringContaining("wiki+") });
  });

  it("encodes a space-containing query in the request", async () => {
    const spy = mockFetchOnce({ pages: [] });
    await fetchTopicSuggestions("San Francisco");
    expect(String(spy.mock.calls[0][0])).toContain("q=San%20Francisco");
  });

  it("maps result pages to {title, description}", async () => {
    mockFetchOnce({
      pages: [
        { title: "Cat", description: "domestic species" },
        { title: "Catalonia", description: null },
      ],
    });
    const out = await fetchTopicSuggestions("cat");
    expect(out).toEqual([
      { title: "Cat", description: "domestic species" },
      { title: "Catalonia" },
    ]);
  });

  it("drops pages without a usable title", async () => {
    mockFetchOnce({ pages: [{ description: "no title" }, { title: "Cat" }] });
    expect(await fetchTopicSuggestions("cat")).toEqual([{ title: "Cat" }]);
  });
});

describe("fetchTopicSuggestions — silent degrade (Decision 2/4, binding)", () => {
  it("returns [] for an empty / whitespace query without fetching", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await fetchTopicSuggestions("")).toEqual([]);
    expect(await fetchTopicSuggestions("   ")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] (no throw) on a non-OK response", async () => {
    mockFetchOnce({}, false, 503);
    expect(await fetchTopicSuggestions("cat")).toEqual([]);
  });

  it("returns [] (no throw) on a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(fetchTopicSuggestions("cat")).resolves.toEqual([]);
  });

  it("returns [] (no throw) on an aborted request", async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => Promise.reject(new DOMException("aborted", "AbortError"))
    );
    controller.abort();
    await expect(
      fetchTopicSuggestions("cat", { signal: controller.signal })
    ).resolves.toEqual([]);
  });

  it("returns [] on malformed JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", { status: 200 })
    );
    expect(await fetchTopicSuggestions("cat")).toEqual([]);
  });
});
