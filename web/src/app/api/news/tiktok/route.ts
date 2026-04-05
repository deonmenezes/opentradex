import { NextResponse } from "next/server";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || "";

interface TikTokPost {
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
  platform: "tiktok";
  images?: string[];
  videoCover?: string;
  videoDuration?: number;
}

const SEARCH_QUERIES = [
  "kalshi polymarket prediction markets",
  "tariffs trade war",
  "trump executive order",
];

let cache: { items: TikTokPost[]; fetchedAt: number } = { items: [], fetchedAt: 0 };
const CACHE_TTL = 5 * 60 * 60_000; // 5 hours
let pending: Promise<TikTokPost[]> | null = null;

async function fetchTikToks(): Promise<TikTokPost[]> {
  if (!APIFY_TOKEN) {
    console.error("[tiktok] APIFY_API_TOKEN not set");
    return [];
  }

  console.log("[tiktok] fetching videos from Apify...");
  const res = await fetch(
    `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchQueries: SEARCH_QUERIES,
        resultsPerPage: 10,
      }),
      signal: AbortSignal.timeout(130_000),
    }
  );

  if (!res.ok) {
    console.error("[tiktok] Apify response not ok:", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error("[tiktok] unexpected response:", JSON.stringify(data).slice(0, 300));
    return [];
  }
  console.log(`[tiktok] got ${data.length} raw videos`);

  const posts: TikTokPost[] = data
    .filter((item: Record<string, unknown>) => item.text)
    .map((item: Record<string, unknown>) => {
      const author = item.authorMeta as Record<string, unknown> | undefined;
      const videoMeta = item.videoMeta as Record<string, unknown> | undefined;
      const coverUrl = (videoMeta?.coverUrl as string) || undefined;

      return {
        id: (item.id as string) || "",
        text: (item.text as string) || "",
        author: (author?.name as string) || "",
        authorName: (author?.nickName as string) || (author?.name as string) || "",
        authorImage: (author?.avatar as string) || undefined,
        likes: (item.diggCount as number) || 0,
        reposts: (item.shareCount as number) || 0,
        replies: (item.commentCount as number) || 0,
        url: (item.webVideoUrl as string) || "",
        timestamp: (item.createTimeISO as string) || new Date().toISOString(),
        platform: "tiktok" as const,
        images: undefined,
        videoCover: coverUrl,
        videoDuration: (videoMeta?.duration as number) || undefined,
      };
    });

  posts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return posts.slice(0, 30);
}

export async function GET() {
  const now = Date.now();

  if (cache.items.length > 0 && now - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.items);
  }

  if (!pending) {
    pending = fetchTikToks().finally(() => { pending = null; });
  }

  try {
    const posts = await pending;
    if (posts.length > 0) {
      cache = { items: posts, fetchedAt: Date.now() };
    }
    return NextResponse.json(cache.items);
  } catch {
    return NextResponse.json(cache.items);
  }
}
