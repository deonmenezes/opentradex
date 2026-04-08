import Link from "next/link";

const GITHUB_REPO_URL = "https://github.com/deonmenezes/opentradex";
const DISCORD_URL = "https://discord.gg/rFdwJC8z";

const installCommands = [
  "npm install -g opentradex@latest && opentradex onboard",
  "npx opentradex@latest onboard",
  "bunx opentradex@latest onboard",
  "curl -fsSL https://opentradex.vercel.app/install.sh | bash",
];

const tickerItems = [
  "Welcome to OpenTradex",
  "Our implementation. Your strategy.",
  "Homepage for information",
  "Dashboard for operators",
  "Open source",
  "You control keys and risk",
  "AI needs rails, not promises",
  "Operator review matters",
];

const rails = [
  {
    title: "Kalshi",
    body: "Primary execution rail with the strongest paper and live workflow support.",
  },
  {
    title: "Polymarket",
    body: "Discovery and comparison rail for cross-market event pricing.",
  },
  {
    title: "TradingView",
    body: "Watchlist and chart-context rail for macro and symbol triage.",
  },
  {
    title: "Data APIs",
    body: "Apify, RSS, and optional social feeds when you want fresh context.",
  },
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_36%),radial-gradient(circle_at_80%_10%,_rgba(249,115,22,0.16),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.45),_transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] chart-grid-bg opacity-60" />

      <section className="relative mx-auto max-w-7xl px-5 pb-18 pt-6 sm:px-8 lg:px-12">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-full border border-border/70 bg-white/82 px-4 py-3 shadow-[0_18px_80px_rgba(16,24,40,0.06)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#14b8a6_55%,#f97316)] font-mono text-xs font-semibold uppercase tracking-[0.25em] text-white">
              OTX
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.32em] text-muted-foreground">
                OpenTradex
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Public homepage
              </h1>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Link href="/guide" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">
              Guide
            </Link>
            <Link href="/dashboard" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">
              Dashboard
            </Link>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground"
            >
              Discord
            </a>
          </nav>
        </header>

        <div className="grid min-h-[78vh] gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-center">
          <div className="max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-primary">
              Information first
            </div>

            <h2 className="max-w-5xl text-5xl font-semibold leading-[0.94] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-7xl">
              Our implementation. Your strategy.
            </h2>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
              OpenTradex is the public information layer for onboarding, rails, commands, and live
              links. The operator interface stays at <code>/dashboard</code>. The guide stays at
              <code>/guide</code>.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
              >
                Open dashboard
              </Link>
              <Link
                href="/guide"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Read guide
              </Link>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Open GitHub repo
              </a>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Join Discord
              </a>
            </div>

            <div className="mt-10 rounded-[2rem] border border-amber-400/40 bg-[linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.88))] p-5 shadow-[0_18px_80px_rgba(249,115,22,0.08)]">
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-amber-700">
                Responsibility notice
              </p>
              <p className="mt-3 text-base leading-7 text-foreground">
                OpenTradex is implementation infrastructure. It does not guarantee profitable
                trades, safe prompts, or correct execution. You own the strategy, risk, keys, and
                every order.
              </p>
            </div>
          </div>

          <aside className="section-frame p-6">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-primary">
              Quick links
            </p>
            <div className="mt-4 grid gap-3">
              <Link href="/dashboard" className="rounded-[1.35rem] border border-border/70 bg-white/80 p-4 transition-transform hover:-translate-y-0.5">
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-muted-foreground">App</p>
                <p className="mt-2 text-base font-semibold text-foreground">/dashboard</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Operator cockpit, channels, feeds, and live agent runs.</p>
              </Link>
              <Link href="/guide" className="rounded-[1.35rem] border border-border/70 bg-white/80 p-4 transition-transform hover:-translate-y-0.5">
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-muted-foreground">Guide</p>
                <p className="mt-2 text-base font-semibold text-foreground">/guide</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Six-step long-form build guide for trading LLM workflows.</p>
              </Link>
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="rounded-[1.35rem] border border-border/70 bg-white/80 p-4 transition-transform hover:-translate-y-0.5">
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-muted-foreground">Repo</p>
                <p className="mt-2 text-base font-semibold text-foreground">GitHub</p>
                <p className="mt-2 break-all text-sm leading-6 text-muted-foreground">{GITHUB_REPO_URL}</p>
              </a>
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="rounded-[1.35rem] border border-border/70 bg-white/80 p-4 transition-transform hover:-translate-y-0.5">
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.24em] text-muted-foreground">Community</p>
                <p className="mt-2 text-base font-semibold text-foreground">Discord</p>
                <p className="mt-2 break-all text-sm leading-6 text-muted-foreground">{DISCORD_URL}</p>
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section className="relative border-y border-border/70 bg-white/65 py-4 backdrop-blur">
        <div className="ticker-shell">
          <div className="ticker-track">
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <span key={`${item}-${index}`} className="ticker-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="section-frame p-6">
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
              Install commands
            </p>
            <div className="mt-5 space-y-3">
              {installCommands.map((command) => (
                <div key={command} className="overflow-x-auto rounded-[1.4rem] border border-border/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
                  <code className="font-mono text-sm leading-7 text-slate-100">{command}</code>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {rails.map((rail) => (
              <article key={rail.title} className="section-frame p-6">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-primary">
                  Rail
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {rail.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">{rail.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
