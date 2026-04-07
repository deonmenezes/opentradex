"use client";

import { useRef, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Rss, ExternalLink, Heart, Repeat2, MessageCircle, Loader2, ArrowBigUp, ChevronUp, ChevronDown, Play } from "lucide-react";
import type { NewsArticle, SocialPost } from "@/lib/types";

type Tab = "news" | "twitter" | "truth" | "reddit" | "tiktok";

const COMMUNITY_DISCORD_URL = "https://discord.gg/rFdwJC8z";

interface NewsFeedProps {
  news: NewsArticle[];
  tweets: SocialPost[];
  truthPosts: SocialPost[];
  redditPosts: SocialPost[];
  tiktokPosts: SocialPost[];
  loadingTweets?: boolean;
  loadingTruth?: boolean;
  loadingReddit?: boolean;
  loadingTiktok?: boolean;
}

export function NewsFeed({ news, tweets, truthPosts, redditPosts, tiktokPosts, loadingTweets, loadingTruth, loadingReddit, loadingTiktok }: NewsFeedProps) {
  const [tab, setTab] = useState<Tab>("news");
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const prevNewsRef = useRef<NewsArticle[]>([]);

  useEffect(() => {
    if (prevNewsRef.current.length > 0 && news.length > 0) {
      const prevTitles = new Set(prevNewsRef.current.map((n) => n.title));
      const fresh = news.filter((n) => !prevTitles.has(n.title));
      if (fresh.length > 0) {
        setNewIds(new Set(fresh.map((n) => n.id)));
        setTimeout(() => setNewIds(new Set()), 3000);
      }
    }
    prevNewsRef.current = news;
  }, [news]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "news", label: "News", count: news.length },
    { key: "twitter", label: "𝕏", count: tweets.length },
    { key: "truth", label: "Truth", count: truthPosts.length },
    { key: "reddit", label: "Reddit", count: redditPosts.length },
    { key: "tiktok", label: "TikTok", count: tiktokPosts.length },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-border bg-card">
        <div className="h-9 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Rss className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Feed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-primary/70">
              <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />
              Live
            </span>
          </div>
        </div>
        <div className="px-2 pb-2">
          <a
            href={COMMUNITY_DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(14,116,144,0.08))] px-3 py-2.5 transition-colors hover:border-emerald-500/35 hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(14,116,144,0.14))]"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-emerald-700/80">
                Community
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                Join the OpenTradex Discord
              </p>
              <p className="mt-1 text-[11px] leading-5 text-slate-600">
                Ask questions, share setups, and follow product updates with the operator crew.
              </p>
            </div>
            <div className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-white/80 text-emerald-700 transition-transform group-hover:scale-105">
              <ExternalLink className="h-4 w-4" />
            </div>
          </a>
        </div>
        <div className="flex px-1 pb-1 gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                tab === t.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/30"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1 text-[9px] opacity-60">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          {tab === "news" && <NewsTab news={news} newIds={newIds} />}
          {tab === "twitter" && <SocialTab posts={tweets} loading={loadingTweets} platform="twitter" />}
          {tab === "truth" && <SocialTab posts={truthPosts} loading={loadingTruth} platform="truthsocial" />}
          {tab === "reddit" && <SocialTab posts={redditPosts} loading={loadingReddit} platform="reddit" />}
          {tab === "tiktok" && <SocialTab posts={tiktokPosts} loading={loadingTiktok} platform="tiktok" />}
        </ScrollArea>
      </div>
    </div>
  );
}

function NewsTab({ news, newIds }: { news: NewsArticle[]; newIds: Set<number> }) {
  if (news.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Rss className="h-8 w-8 text-muted-foreground/20 mb-3" />
        <p className="text-xs text-muted-foreground/40 text-center">
          Fetching latest news...
        </p>
      </div>
    );
  }

  const featured = news[0];
  const rest = news.slice(1);

  return (
    <>
      {featured && (
        <FeaturedArticle article={featured} isNew={newIds.has(featured.id)} />
      )}
      <div className="divide-y divide-border/20">
        {rest.map((n) => (
          <NewsRow key={n.id || n.title} article={n} isNew={newIds.has(n.id)} />
        ))}
      </div>
    </>
  );
}

function SocialTab({
  posts,
  loading,
  platform,
}: {
  posts: SocialPost[];
  loading?: boolean;
  platform: "twitter" | "truthsocial" | "reddit" | "tiktok";
}) {
  if (loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Loader2 className="h-6 w-6 text-muted-foreground/30 animate-spin mb-3" />
        <p className="text-xs text-muted-foreground/40 text-center">
          {platform === "twitter"
            ? "Loading tweets via Apify..."
            : platform === "reddit"
              ? "Loading Reddit posts..."
              : platform === "tiktok"
                ? "Loading TikTok videos..."
                : "Loading Truth Social posts..."}
        </p>
        {platform === "twitter" && (
          <p className="text-[10px] text-muted-foreground/25 mt-1">
            First load may take ~30s
          </p>
        )}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-xs text-muted-foreground/40 text-center">
          No posts yet
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/20">
      {posts.map((post) =>
        post.platform === "tiktok" ? (
          <TikTokCard key={post.id} post={post} />
        ) : post.platform === "reddit" ? (
          <RedditPostCard key={post.id} post={post} />
        ) : (
          <SocialPostCard key={post.id} post={post} />
        )
      )}
    </div>
  );
}

function SocialPostCard({ post }: { post: SocialPost }) {
  return (
    <a
      href={post.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2.5 hover:bg-secondary/20 transition-colors group"
    >
      <div className="flex items-start gap-2">
        {post.authorImage ? (
          <AuthorAvatar src={post.authorImage} name={post.authorName} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground/50 uppercase shrink-0">
            {post.authorName?.[0] || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-foreground/80 truncate">
              {post.authorName}
            </span>
            <span className="text-[10px] text-muted-foreground/40 truncate">
              @{post.author}
            </span>
            <span className="text-[10px] text-muted-foreground/25 ml-auto shrink-0">
              {formatRelativeTime(post.timestamp)}
            </span>
          </div>
          <p className="text-[11px] text-foreground/70 leading-relaxed mt-0.5 line-clamp-4 whitespace-pre-line">
            {post.text}
          </p>
          {post.images && post.images.length > 0 && (
            <PostImage src={post.images[0]} />
          )}
          <div className="flex items-center gap-4 mt-1.5">
            {post.replies !== undefined && (
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
                <MessageCircle className="h-3 w-3" />
                {formatCount(post.replies)}
              </span>
            )}
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
              <Repeat2 className="h-3 w-3" />
              {formatCount(post.reposts)}
            </span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
              <Heart className="h-3 w-3" />
              {formatCount(post.likes)}
            </span>
            <span className="text-[9px] text-muted-foreground/20 ml-auto">
              {post.platform === "twitter" ? "𝕏" : post.platform === "reddit" ? "Reddit" : post.platform === "tiktok" ? "TikTok" : "Truth Social"}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

function RedditPostCard({ post }: { post: SocialPost }) {
  return (
    <a
      href={post.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2.5 hover:bg-secondary/20 transition-colors group"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
          <ChevronUp className="h-4 w-4 text-muted-foreground/40" />
          <span className="text-[10px] font-medium text-orange-400">{formatCount(post.likes)}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-orange-400/80">
              {post.authorName || "reddit"}
            </span>
            <span className="text-[10px] text-muted-foreground/30">·</span>
            <span className="text-[10px] text-muted-foreground/40">
              {post.author}
            </span>
            <span className="text-[10px] text-muted-foreground/25 ml-auto shrink-0">
              {formatRelativeTime(post.timestamp)}
            </span>
          </div>
          <p className="text-[12px] font-medium text-foreground/85 leading-snug mt-1 line-clamp-3">
            {post.text}
          </p>
          {post.images && post.images.length > 0 && (
            <PostImage src={post.images[0]} />
          )}
          <div className="flex items-center gap-4 mt-1.5">
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
              <MessageCircle className="h-3 w-3" />
              {post.replies !== undefined ? formatCount(post.replies) : 0} comments
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

function TikTokCard({ post }: { post: SocialPost }) {
  const [coverErrored, setCoverErrored] = useState(false);

  return (
    <a
      href={post.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-3 py-2.5 hover:bg-secondary/20 transition-colors group"
    >
      <div className="flex items-start gap-2.5">
        {post.videoCover && !coverErrored ? (
          <div className="relative shrink-0 w-20 h-28 rounded overflow-hidden bg-black">
            <img
              src={post.videoCover}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setCoverErrored(true)}
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
              <Play className="h-6 w-6 text-white/90 fill-white/90" />
            </div>
            {post.videoDuration !== undefined && (
              <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1 rounded">
                {formatDuration(post.videoDuration)}
              </span>
            )}
          </div>
        ) : (
          <div className="relative shrink-0 w-20 h-28 rounded bg-secondary/50 flex items-center justify-center">
            <Play className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {post.authorImage ? (
              <AuthorAvatar src={post.authorImage} name={post.authorName} />
            ) : (
              <div className="w-5 h-5 rounded-full bg-secondary/50 flex items-center justify-center text-[8px] font-bold text-muted-foreground/50 uppercase shrink-0">
                {post.authorName?.[0] || "?"}
              </div>
            )}
            <span className="text-[11px] font-medium text-foreground/80 truncate">
              {post.authorName}
            </span>
            <span className="text-[10px] text-muted-foreground/25 ml-auto shrink-0">
              {formatRelativeTime(post.timestamp)}
            </span>
          </div>
          <p className="text-[11px] text-foreground/70 leading-relaxed mt-1 line-clamp-3 whitespace-pre-line">
            {post.text}
          </p>
          <div className="flex items-center gap-4 mt-1.5">
            {post.replies !== undefined && (
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
                <MessageCircle className="h-3 w-3" />
                {formatCount(post.replies)}
              </span>
            )}
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
              <Repeat2 className="h-3 w-3" />
              {formatCount(post.reposts)}
            </span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
              <Heart className="h-3 w-3" />
              {formatCount(post.likes)}
            </span>
            <span className="text-[9px] text-muted-foreground/20 ml-auto">TikTok</span>
          </div>
        </div>
      </div>
    </a>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AuthorAvatar({ src, name }: { src: string; name: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground/50 uppercase shrink-0">
        {name?.[0] || "?"}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 rounded-full object-cover shrink-0"
      onError={() => setErrored(true)}
    />
  );
}

function PostImage({ src }: { src: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <img
      src={src}
      alt=""
      className="w-full h-32 rounded mt-1.5 object-cover"
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}

function FeaturedArticle({
  article: n,
  isNew,
}: {
  article: NewsArticle;
  isNew: boolean;
}) {
  const domain = extractDomain(n.url);

  return (
    <a
      href={n.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`block border-b border-border hover:bg-secondary/20 transition-colors group ${isNew ? "news-new" : ""}`}
    >
      {n.image && (
        <ArticleImage src={n.image} alt={n.title} className="w-full h-36 object-cover" />
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          {domain && <SourceIcon domain={domain} size={18} />}
          <span className="text-[10px] text-muted-foreground/60 font-medium">
            {n.source || domain}
          </span>
          <span className="text-[10px] text-muted-foreground/30 ml-auto">
            {formatRelativeTime(n.timestamp)}
          </span>
        </div>
        <h3 className="text-[13px] font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-3">
          {n.title}
        </h3>
        {n.snippet && !n.snippet.startsWith("&lt;") && (
          <p className="text-[11px] text-muted-foreground/40 mt-1.5 leading-relaxed line-clamp-2">
            {n.snippet}
          </p>
        )}
      </div>
    </a>
  );
}

function NewsRow({
  article: n,
  isNew,
}: {
  article: NewsArticle;
  isNew: boolean;
}) {
  const domain = extractDomain(n.url);
  const hasImage = !!n.image;

  return (
    <a
      href={n.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary/20 transition-colors group ${isNew ? "news-new" : ""}`}
    >
      {hasImage ? (
        <ArticleImage
          src={n.image!}
          alt=""
          className="w-16 h-12 rounded object-cover shrink-0 mt-0.5"
        />
      ) : domain ? (
        <div className="mt-0.5 shrink-0">
          <SourceIcon domain={domain} size={14} />
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground/80 group-hover:text-primary transition-colors leading-snug line-clamp-2">
          {n.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {hasImage && domain && <SourceIcon domain={domain} size={10} />}
          <span className="text-[9px] text-muted-foreground/40">
            {n.source || domain}
          </span>
          <span className="text-[9px] text-muted-foreground/20">·</span>
          <span className="text-[9px] text-muted-foreground/30">
            {formatRelativeTime(n.timestamp)}
          </span>
        </div>
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/30 transition-colors mt-0.5 shrink-0" />
    </a>
  );
}

function ArticleImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}

function SourceIcon({ domain, size = 16 }: { domain: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div
        className="rounded bg-secondary/50 flex items-center justify-center text-[8px] font-bold text-muted-foreground/40 uppercase"
        style={{ width: size, height: size }}
      >
        {domain[0]}
      </div>
    );
  }
  return (
    <img
      src={`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=${Math.max(size * 2, 64)}`}
      alt=""
      width={size}
      height={size}
      className="rounded"
      onError={() => setErrored(true)}
    />
  );
}

function extractDomain(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function formatRelativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
