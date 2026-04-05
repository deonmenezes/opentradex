import { NextResponse } from "next/server";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || "";

interface RedditPost {
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
  platform: "reddit";
  images?: string[];
}

const SUBREDDITS = [
  "https://www.reddit.com/r/wallstreetbets/hot/",
  "https://www.reddit.com/r/politics/hot/",
  "https://www.reddit.com/r/news/hot/",
  "https://www.reddit.com/r/worldnews/hot/",
  "https://www.reddit.com/r/economics/hot/",
  "https://www.reddit.com/r/stocks/hot/",
  "https://www.reddit.com/r/polymarket/hot/",
];

let cache: { items: RedditPost[]; fetchedAt: number } = { items: [], fetchedAt: 0 };
const CACHE_TTL = 5 * 60 * 60_000; // 5 hours
let pending: Promise<RedditPost[]> | null = null;

async function fetchRedditPosts(): Promise<RedditPost[]> {
  if (!APIFY_TOKEN) {
    console.error("[reddit] APIFY_API_TOKEN not set");
    return [];
  }

  console.log("[reddit] fetching posts from Apify...");
  const res = await fetch(
    `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: SUBREDDITS.map((url) => ({ url })),
        maxItems: 150,
      }),
      signal: AbortSignal.timeout(70_000),
    }
  );

  if (!res.ok) {
    console.error("[reddit] Apify response not ok:", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error("[reddit] unexpected response:", JSON.stringify(data).slice(0, 300));
    return [];
  }
  console.log(`[reddit] got ${data.length} raw items`);

  const posts: RedditPost[] = data
    .filter((item: Record<string, unknown>) => item.dataType === "post" && item.title)
    .map((item: Record<string, unknown>) => {
      const images = item.imageUrls as string[] | undefined;
      const thumbnail = item.thumbnailUrl as string | undefined;

      return {
        id: (item.id as string) || "",
        text: (item.title as string) || "",
        author: (item.username as string) || "",
        authorName: (item.communityName as string) || (item.parsedCommunityName as string) || "",
        authorImage: undefined,
        likes: (item.upVotes as number) || 0,
        reposts: 0,
        replies: (item.numberOfComments as number) || 0,
        url: (item.url as string) || "",
        timestamp: (item.createdAt as string) || new Date().toISOString(),
        platform: "reddit" as const,
        images: images && images.length > 0
          ? images
          : thumbnail && thumbnail.startsWith("http")
            ? [thumbnail]
            : undefined,
      };
    });

  posts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return posts.slice(0, 40);
}

export async function GET() {
  const now = Date.now();

  if (cache.items.length > 0 && now - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.items);
  }

  if (!pending) {
    pending = fetchRedditPosts().finally(() => { pending = null; });
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
