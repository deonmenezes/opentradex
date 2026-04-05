import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

function getToken() {
  return process.env.APIFY_API_TOKEN || "";
}

interface Tweet {
  id: string;
  text: string;
  author: string;
  authorName: string;
  authorImage?: string;
  likes: number;
  reposts: number;
  replies?: number;
  url: string;
  timestamp: string;
  platform: "twitter";
  images?: string[];
}

const SEARCH_QUERY =
  "(kalshi OR polymarket) OR (tariffs OR trade war) OR (trump executive order) OR (federal reserve rates)";

function getCachePaths() {
  // Try multiple possible locations
  const candidates = [
    join(process.cwd(), "..", "data"),      // if cwd is web/
    join(process.cwd(), "data"),             // if cwd is project root
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "twitter_cache.json"))) {
      return {
        raw: join(dir, "twitter_cache.json"),
        parsed: join(dir, "twitter_parsed.json"),
      };
    }
  }
  // Default
  return {
    raw: join(process.cwd(), "..", "data", "twitter_cache.json"),
    parsed: join(process.cwd(), "..", "data", "twitter_parsed.json"),
  };
}
const CACHE_TTL = 3 * 60 * 60_000; // 3 hours

let memCache: { items: Tweet[]; fetchedAt: number } = { items: [], fetchedAt: 0 };
let refreshing = false;

function parseRawTweets(raw: Record<string, unknown>[]): Tweet[] {
  return raw
    .filter((item) => item.text)
    .map((item) => {
      const userInfo = (item.user_info as Record<string, unknown>) || {};
      const rawMedia = item.media;
      let photos: string[] = [];
      if (Array.isArray(rawMedia)) {
        photos = rawMedia
          .filter((m: Record<string, unknown>) => m.type === "photo")
          .map((m: Record<string, unknown>) => (m.media_url_https as string) || "")
          .filter(Boolean);
      } else if (rawMedia && typeof rawMedia === "object") {
        const photoArr = (rawMedia as Record<string, unknown>).photo;
        if (Array.isArray(photoArr)) {
          photos = photoArr
            .map((m: Record<string, unknown>) => (m.media_url_https as string) || "")
            .filter(Boolean);
        }
      }

      return {
        id: (item.tweet_id as string) || "",
        text: (item.text as string) || "",
        author: (item.screen_name as string) || "",
        authorName:
          (userInfo.name as string) || (item.screen_name as string) || "",
        authorImage:
          (userInfo.profile_image_url as string)?.replace("_normal", "_bigger") ||
          undefined,
        likes: (item.favorites as number) || 0,
        reposts: (item.retweets as number) || 0,
        replies: (item.replies as number) || 0,
        url: `https://x.com/${item.screen_name}/status/${item.tweet_id}`,
        timestamp: (item.created_at as string) || new Date().toISOString(),
        platform: "twitter" as const,
        images: photos.length > 0 ? photos : undefined,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 40);
}

function loadFromDisk(): Tweet[] {
  const paths = getCachePaths();
  console.log("[twitter] looking for cache at:", paths.raw);
  // Try parsed cache first
  if (existsSync(paths.parsed)) {
    try {
      const data = JSON.parse(readFileSync(paths.parsed, "utf-8"));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch { /* ignore */ }
  }
  // Fall back to raw cache file (written by CLI prefetch)
  if (existsSync(paths.raw)) {
    console.log("[twitter] found raw cache file");
    try {
      const raw = JSON.parse(readFileSync(paths.raw, "utf-8"));
      if (Array.isArray(raw) && raw.length > 0) {
        console.log("[twitter] parsing", raw.length, "raw tweets");
        const parsed = parseRawTweets(raw);
        console.log("[twitter] parsed", parsed.length, "tweets");
        try { writeFileSync(paths.parsed, JSON.stringify(parsed)); } catch (e) { console.error("[twitter] write parsed failed:", e); }
        return parsed;
      }
    } catch (e) { console.error("[twitter] parse raw failed:", e); }
  }
  console.log("[twitter] no cache file found");
  return [];
}

async function refreshFromApify(): Promise<void> {
  if (refreshing || !getToken()) return;
  refreshing = true;

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/data-slayer~twitter-search/run-sync-get-dataset-items?token=${getToken()}&timeout=120`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: SEARCH_QUERY, maxResults: 40 }),
        cache: "no-store",
        signal: AbortSignal.timeout(130_000),
      }
    );

    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;

    const tweets = parseRawTweets(data);
    memCache = { items: tweets, fetchedAt: Date.now() };

    // Persist to disk
    try {
      const paths = getCachePaths();
      writeFileSync(paths.raw, JSON.stringify(data));
      writeFileSync(paths.parsed, JSON.stringify(tweets));
    } catch { /* ignore */ }
  } catch {
    // Apify call failed (likely concurrent run limit)
  } finally {
    refreshing = false;
  }
}

export async function GET() {
  const now = Date.now();

  // Return mem cache if fresh
  if (memCache.items.length > 0 && now - memCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(memCache.items);
  }

  // Load from disk cache (prefetched or previously saved)
  if (memCache.items.length === 0) {
    const diskData = loadFromDisk();
    if (diskData.length > 0) {
      memCache = { items: diskData, fetchedAt: now };
    }
  }

  // Trigger background refresh (don't await — return cached data immediately)
  if (!refreshing) {
    refreshFromApify();
  }

  return NextResponse.json(memCache.items);
}
