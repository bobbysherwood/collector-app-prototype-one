export interface WebResearchSnippet {
  title: string;
  snippet: string;
  url?: string;
}

export interface WebResearchResult {
  query: string;
  snippets: WebResearchSnippet[];
}

const MAX_QUERIES = 3;
const FETCH_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "CollectorApp-DM2-Import/1.0",
        Accept: "application/json, text/html",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchDuckDuckGoInstant(
  query: string
): Promise<WebResearchSnippet[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) return [];

  const data = (await response.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<
      | { Text?: string; FirstURL?: string }
      | { Name?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }
    >;
  };

  const snippets: WebResearchSnippet[] = [];

  if (data.AbstractText?.trim()) {
    snippets.push({
      title: data.Heading?.trim() || query,
      snippet: data.AbstractText.trim(),
      url: data.AbstractURL,
    });
  }

  for (const topic of data.RelatedTopics ?? []) {
    if ("Text" in topic && topic.Text?.trim()) {
      snippets.push({
        title: topic.Text.split(" - ")[0]?.trim() || query,
        snippet: topic.Text.trim(),
        url: topic.FirstURL,
      });
    }
    if ("Topics" in topic && Array.isArray(topic.Topics)) {
      for (const nested of topic.Topics) {
        if (!nested.Text?.trim()) continue;
        snippets.push({
          title: nested.Text.split(" - ")[0]?.trim() || query,
          snippet: nested.Text.trim(),
          url: nested.FirstURL,
        });
      }
    }
    if (snippets.length >= 5) break;
  }

  return snippets.slice(0, 5);
}

async function searchDuckDuckGoHtml(query: string): Promise<WebResearchSnippet[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}`,
  });

  if (!response.ok) return [];

  const html = await response.text();
  const snippets: WebResearchSnippet[] = [];
  const resultPattern =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;

  let match = resultPattern.exec(html);
  while (match && snippets.length < 5) {
    snippets.push({
      title: decodeHtml(match[2].replace(/<[^>]+>/g, "")),
      snippet: decodeHtml(match[3].replace(/<[^>]+>/g, "")),
      url: match[1],
    });
    match = resultPattern.exec(html);
  }

  return snippets;
}

async function searchWikipedia(query: string): Promise<WebResearchSnippet[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=3`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) return [];

  const data = (await response.json()) as {
    query?: { search?: Array<{ title?: string; snippet?: string }> };
  };

  return (data.query?.search ?? []).map((item) => ({
    title: decodeHtml(item.title?.replace(/<[^>]+>/g, "") ?? query),
    snippet: decodeHtml(item.snippet?.replace(/<[^>]+>/g, "") ?? ""),
    url: item.title
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`
      : undefined,
  }));
}

async function researchQuery(query: string): Promise<WebResearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: trimmed, snippets: [] };
  }

  const results = await Promise.allSettled([
    searchDuckDuckGoInstant(trimmed),
    searchDuckDuckGoHtml(trimmed),
    searchWikipedia(trimmed),
  ]);

  const merged: WebResearchSnippet[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const snippet of result.value) {
      const key = `${snippet.title}|${snippet.snippet}`.toLowerCase();
      if (seen.has(key) || !snippet.snippet) continue;
      seen.add(key);
      merged.push(snippet);
    }
  }

  return {
    query: trimmed,
    snippets: merged.slice(0, 6),
  };
}

export async function researchCardSetsOnWeb(
  queries: string[]
): Promise<WebResearchResult[]> {
  const uniqueQueries = [...new Set(queries.map((query) => query.trim()))]
    .filter(Boolean)
    .slice(0, MAX_QUERIES);

  if (uniqueQueries.length === 0) return [];

  const results = await Promise.all(
    uniqueQueries.map((query) => researchQuery(query))
  );

  return results.filter((result) => result.snippets.length > 0);
}

export function formatWebResearchForPrompt(
  research: WebResearchResult[]
): string {
  if (research.length === 0) {
    return "Public internet research: no results returned.";
  }

  return research
    .map((result) => {
      const snippets = result.snippets
        .map(
          (snippet, index) =>
            `  ${index + 1}. ${snippet.title}\n     ${snippet.snippet}${snippet.url ? `\n     Source: ${snippet.url}` : ""}`
        )
        .join("\n");
      return `Query: ${result.query}\n${snippets}`;
    })
    .join("\n\n");
}
