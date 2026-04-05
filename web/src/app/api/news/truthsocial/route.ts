import { NextResponse } from "next/server";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || "";

interface TruthPost {
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
  platform: "truthsocial";
  images?: string[];
}

let cache: { items: TruthPost[]; fetchedAt: number } = {
  items: [],
  fetchedAt: 0,
};
const CACHE_TTL = 6 * 60 * 60_000; // 6 hours
let pending: Promise<TruthPost[]> | null = null;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .trim();
}

async function fetchTruthPosts(): Promise<TruthPost[]> {
  if (!APIFY_TOKEN) return [];

  const res = await fetch(
    `https://api.apify.com/v2/acts/muhammetakkurtt~truth-social-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "realDonaldTrump",
        maxPosts: 25,
      }),
      signal: AbortSignal.timeout(70_000),
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .filter((s: Record<string, unknown>) => s.visibility === "public")
    .map((status: Record<string, unknown>) => {
      const account = status.account as Record<string, unknown> | undefined;
      const media = status.media_attachments as
        | Array<Record<string, unknown>>
        | undefined;

      return {
        id: (status.id as string) || "",
        text: stripHtml((status.content as string) || ""),
        author: (account?.username as string) || "realDonaldTrump",
        authorName:
          (account?.display_name as string) || "Donald J. Trump",
        authorImage: (account?.avatar as string) || undefined,
        likes: (status.favourites_count as number) || 0,
        reposts: (status.reblogs_count as number) || 0,
        replies: (status.replies_count as number) || 0,
        url:
          (status.url as string) ||
          `https://truthsocial.com/@realDonaldTrump/${status.id}`,
        timestamp:
          (status.created_at as string) || new Date().toISOString(),
        platform: "truthsocial" as const,
        images: media
          ?.filter((m) => m.type === "image")
          .map((m) => (m.preview_url as string) || (m.url as string))
          .filter(Boolean),
      };
    });
}

export async function GET() {
  const now = Date.now();

  if (cache.items.length > 0 && now - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.items);
  }

  if (!pending) {
    pending = fetchTruthPosts().finally(() => { pending = null; });
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
