import { describe, expect, it, vi } from "vitest";
import { FetchPageTool, WebSearchTool } from "../../src/tools/web/WebTools.ts";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("websearch tools", () => {
  it("searches Tavily, cleans results, maps freshness/domains, and caches repeat queries", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        results: [
          {
            title: "Tavily docs",
            url: "https://docs.tavily.com/docs",
            content: "Search API docs",
            published_date: "2026-06-24",
          },
        ],
      })
    );
    const tool = WebSearchTool.create({
      apiKey: "test-key",
      fetch: fetchImpl,
      now: () => 1_000,
      ttlMs: 60_000,
    });

    const input = {
      query: "Tavily Search API",
      maxResults: 3,
      freshness: "week" as const,
      includeDomains: ["docs.tavily.com"],
      excludeDomains: ["spam.example"],
    };
    const first = await tool.call(input);
    const second = await tool.call(input);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.tavily.com/search");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      query: "Tavily Search API",
      max_results: 3,
      search_depth: "basic",
      time_range: "week",
      include_domains: ["docs.tavily.com"],
      exclude_domains: ["spam.example"],
    });
    expect(first).toEqual({
      query: "Tavily Search API",
      results: [{
        title: "Tavily docs",
        url: "https://docs.tavily.com/docs",
        snippet: "Search API docs",
        publishedAt: "2026-06-24",
        source: "docs.tavily.com",
      }],
    });
    expect(second).toEqual(first);
  });

  it("fetches a page, strips non-content HTML, truncates text, and caches repeat reads", async () => {
    const request = vi.fn(async () => ({
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/html" }),
      body: "<html><head><title>Example Page</title><style>.x{}</style></head>" +
          "<body><nav>menu</nav><article><h1>Title</h1><p>Hello <b>world</b>.</p>" +
          "<script>alert(1)</script><p>Second paragraph.</p></article></body></html>",
    }));
    const tool = FetchPageTool.create({
      request,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      now: () => 1_000,
      isoNow: () => "2026-06-24T00:00:00.000Z",
      ttlMs: 60_000,
    });

    const first = await tool.call({
      url: "https://example.com/a",
      maxChars: 44,
    });
    const second = await tool.call({
      url: "https://example.com/a",
      maxChars: 44,
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(first).toEqual({
      url: "https://example.com/a",
      title: "Example Page",
      content: "Example Page Title Hello world. Second pa...",
      source: "example.com",
      fetchedAt: "2026-06-24T00:00:00.000Z",
    });
    expect(first.content).not.toContain("alert");
    expect(first.content).not.toContain("menu");
    expect(second).toEqual(first);
  });

  it("rejects local and private fetch_page targets before fetching", async () => {
    const request = vi.fn(async () => ({
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      body: "secret",
    }));
    const tool = FetchPageTool.create({
      request,
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    });

    await expect(tool.call({ url: "http://localhost/admin" })).rejects.toThrow(
      "fetch_page only supports public web URLs",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects IPv6 loopback and IPv4-mapped private fetch_page targets", async () => {
    const request = vi.fn(async () => ({
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      body: "secret",
    }));
    const tool = FetchPageTool.create({
      request,
      lookup: async (hostname) => [
        hostname === "::1"
          ? { address: "::1", family: 6 }
          : { address: "::ffff:7f00:1", family: 6 },
      ],
    });

    await expect(tool.call({ url: "http://[::1]/admin" })).rejects.toThrow(
      "fetch_page only supports public web URLs",
    );
    await expect(tool.call({ url: "http://[::ffff:127.0.0.1]/admin" })).rejects.toThrow(
      "fetch_page only supports public web URLs",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects the full IPv6 link-local range", async () => {
    const request = vi.fn(async () => ({
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      body: "secret",
    }));
    const tool = FetchPageTool.create({
      request,
      lookup: async () => [{ address: "fe90::1", family: 6 }],
    });

    await expect(tool.call({ url: "http://example.com/admin" })).rejects.toThrow(
      "fetch_page only supports public web URLs",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("validates redirect targets before following them", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        status: 302,
        statusText: "Found",
        headers: new Headers({ location: "http://127.0.0.1/admin" }),
        body: "",
      });
    const tool = FetchPageTool.create({
      request,
      lookup: async (hostname) =>
        hostname === "example.com"
          ? [{ address: "93.184.216.34", family: 4 }]
          : [{ address: "127.0.0.1", family: 4 }],
    });

    await expect(tool.call({ url: "https://example.com/start" })).rejects.toThrow(
      "fetch_page only supports public web URLs",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects non-text and oversized fetch_page responses", async () => {
    const toolFor = (response: {
      status: number;
      statusText: string;
      headers: Headers;
      body: string;
    }) =>
      FetchPageTool.create({
        request: vi.fn(async () => response),
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      });

    await expect(
      toolFor({
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "image/png" }),
        body: "png",
      }).call({ url: "https://example.com/image.png" }),
    ).rejects.toThrow("fetch_page only supports text or HTML responses");

    await expect(
      toolFor({
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "text/plain",
          "content-length": String(2_000_000),
        }),
        body: "too large",
      }).call({ url: "https://example.com/large.txt" }),
    ).rejects.toThrow("fetch_page response is too large");
  });

  it("passes prevalidated public DNS results to the page request", async () => {
    const request = vi.fn(async () => ({
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/plain" }),
      body: "ok",
    }));
    const tool = FetchPageTool.create({
      request,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    });

    await tool.call({ url: "https://example.com/page" });

    expect(request).toHaveBeenCalledWith(
      "https://example.com/page",
      [{ address: "93.184.216.34", family: 4 }],
      expect.objectContaining({
        timeoutMs: expect.any(Number),
        maxResponseBytes: expect.any(Number),
      }),
    );
  });

  it("bounds web_search and fetch_page caches", async () => {
    const searchFetch = vi.fn(async () => jsonResponse({ results: [] }));
    const searchCache = new Map();
    const searchTool = WebSearchTool.create({
      apiKey: "test-key",
      fetch: searchFetch,
      now: () => 1_000,
      ttlMs: 60_000,
      cache: searchCache,
      maxCacheEntries: 2,
    });

    await searchTool.call({ query: "one" });
    await searchTool.call({ query: "two" });
    await searchTool.call({ query: "three" });
    expect(searchCache.size).toBe(2);

    const pageCache = new Map();
    const pageTool = FetchPageTool.create({
      request: vi.fn(async () => ({
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/plain" }),
        body: "ok",
      })),
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      now: () => 1_000,
      ttlMs: 60_000,
      cache: pageCache,
      maxCacheEntries: 2,
    });

    await pageTool.call({ url: "https://example.com/one" });
    await pageTool.call({ url: "https://example.com/two" });
    await pageTool.call({ url: "https://example.com/three" });
    expect(pageCache.size).toBe(2);
  });
});
