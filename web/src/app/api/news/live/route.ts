import { NextResponse } from "next/server";

const NEWS_API_KEY = process.env.NEWS_API_KEY || "813a01019fad42ed9dadc7793c60c386";

interface NewsItem {
  title: string;
  url: string;
  source: string;
  snippet: string;
  timestamp: string;
  image: string | null;
}

const QUERIES = [
  "prediction markets OR kalshi OR polymarket",
  "tariffs OR trade war OR sanctions",
  "federal reserve OR interest rates OR inflation",
  "trump cabinet OR attorney general OR secretary",
];

let cache: { items: NewsItem[]; fetchedAt: number } = { items: [], fetchedAt: 0 };
const CACHE_TTL = 120_000;

export async function GET() {
  const now = Date.now();
  if (cache.items.length > 0 && now - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.items);
  }

  const allItems: NewsItem[] = [];

  const fetches = QUERIES.map(async (q) => {
    try {
      const params = new URLSearchParams({
        q,
        language: "en",
        sortBy: "publishedAt",
        pageSize: "10",
        apiKey: NEWS_API_KEY,
      });
      const res = await fetch(
        `https://newsapi.org/v2/everything?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.articles || []).map(
        (a: Record<string, unknown>): NewsItem => ({
          title: (a.title as string) || "",
          url: (a.url as string) || "",
          source: ((a.source as Record<string, string>)?.name as string) || "",
          snippet: (a.description as string) || "",
          timestamp: (a.publishedAt as string) || new Date().toISOString(),
          image: (a.urlToImage as string) || null,
        })
      );
    } catch {
      return [];
    }
  });

  const results = await Promise.all(fetches);
  for (const items of results) {
    allItems.push(...items);
  }

  allItems.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const deduped = allItems.filter(
    (item, i, arr) => item.title && arr.findIndex((x) => x.title === item.title) === i
  );

  cache = { items: deduped.slice(0, 50), fetchedAt: now };
  return NextResponse.json(cache.items);
}
