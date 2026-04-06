import Link from "next/link";

const LIVE_BASE_URL = "https://opentradex.vercel.app";

const tickerItems = [
  "Welcome to OpenTradex",
  "Our implementation. Your strategy.",
  "Open source",
  "Contributors welcome",
  "No guaranteed trades",
  "You control keys and risk",
  "AI needs rails, not promises",
  "Operator review matters",
  "Fully your responsibility",
];

const implementationCards = [
  {
    label: "01",
    title: "Market + Data Rails",
    text:
      "Your AI needs implementation hooks for market discovery, live prices, news ingestion, and position state. OpenTradex focuses on wiring those rails together so the agent can inspect the environment you choose.",
  },
  {
    label: "02",
    title: "Decision Surface",
    text:
      "You still define the prompt, the allowed markets, the confidence thresholds, and whether orders are paper or live. The product is the implementation layer around those choices, not a replacement for your judgment.",
  },
  {
    label: "03",
    title: "Execution Wrapper",
    text:
      "The AI can only act through the credentials, constraints, and execution rules you provide. You remain fully responsible for every strategy, order, position, outcome, and loss.",
  },
];

const buildItems = [
  "Choose an agent runtime and keep your strategy ownership",
  "Select Kalshi, Polymarket, TradingView, Robinhood, or Groww rails",
  "Add Apify and social/news integrations only when you want them",
  "Risk rules, bankroll, and execution limits",
  "A human operator who owns every trade decision",
];

const onboardingSteps = [
  {
    label: "01",
    title: "Welcome to OpenTradex",
    text:
      "Start with a guided onboarding flow that sets up your workspace, writes grouped environment variables, and explains what each trading rail is for.",
  },
  {
    label: "02",
    title: "Choose Your Runtime",
    text:
      "Pick the agent runtime you want to anchor around, then keep the rest of the workflow modular so you can extend it later without rewriting the whole stack.",
  },
  {
    label: "03",
    title: "Choose Your Markets",
    text:
      "Select a primary market rail, then enable extra rails like Polymarket or TradingView for cross-market discovery and watchlist context.",
  },
  {
    label: "04",
    title: "Plug In Data APIs",
    text:
      "Turn on Apify, RSS, and social feeds only when you need them. The setup keeps integrations optional and the operator remains in control.",
  },
];

const installTracks = [
  {
    label: "npm",
    command: "npm install -g opentradex@latest && opentradex onboard",
  },
  {
    label: "npx",
    command: "npx opentradex@latest onboard",
  },
  {
    label: "bunx",
    command: "bunx opentradex@latest onboard",
  },
  {
    label: "curl",
    command: "curl -fsSL https://opentradex.vercel.app/install.sh | bash",
  },
];

const providerRails = [
  {
    title: "Kalshi",
    support: "Live execution rail",
    body:
      "The strongest production path today. Paper and live execution both map cleanly to the existing trader loop and dashboard.",
  },
  {
    title: "Polymarket",
    support: "Discovery rail",
    body:
      "Public Gamma API scanning lets the agent compare event pricing across venues without forcing wallet credentials on day one.",
  },
  {
    title: "TradingView",
    support: "Watchlist rail",
    body:
      "Use watchlists and chart context to bias research toward the symbols and macro themes you care about most.",
  },
  {
    title: "Robinhood + Groww",
    support: "Broker profiles",
    body:
      "Configured as optional broker rails so you can stage credentials later while still modeling the workflow now.",
  },
];

const liveLinks = [
  {
    label: "Live site",
    href: LIVE_BASE_URL,
    value: LIVE_BASE_URL,
  },
  {
    label: "Guide",
    href: `${LIVE_BASE_URL}/guide`,
    value: `${LIVE_BASE_URL}/guide`,
  },
  {
    label: "Dashboard",
    href: `${LIVE_BASE_URL}/dashboard`,
    value: `${LIVE_BASE_URL}/dashboard`,
  },
  {
    label: "npm package",
    href: "https://www.npmjs.com/package/opentradex",
    value: "https://www.npmjs.com/package/opentradex",
  },
  {
    label: "Install script",
    href: `${LIVE_BASE_URL}/install.sh`,
    value: `${LIVE_BASE_URL}/install.sh`,
  },
  {
    label: "GitHub",
    href: "https://github.com/deonmenezes/open-trademaxxxing",
    value: "https://github.com/deonmenezes/open-trademaxxxing",
  },
];

const setupCommands = [
  "npm install -g opentradex@latest",
  "opentradex onboard",
  "npx opentradex@latest onboard",
  "bunx opentradex@latest onboard",
  "curl -fsSL https://opentradex.vercel.app/install.sh | bash",
];

const curlChecks = [
  "curl.exe -I https://opentradex.vercel.app/",
  "curl.exe -I https://opentradex.vercel.app/guide",
  "curl.exe -I https://opentradex.vercel.app/dashboard",
  "curl.exe -I https://opentradex.vercel.app/install.sh",
  "curl.exe https://opentradex.vercel.app/api/news/live",
  "curl.exe https://opentradex.vercel.app/api/markets",
  "curl.exe https://opentradex.vercel.app/api/portfolio",
  "curl.exe https://opentradex.vercel.app/api/trades",
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_36%),radial-gradient(circle_at_80%_10%,_rgba(249,115,22,0.14),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.5),_transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[540px] chart-grid-bg opacity-70" />

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-18 pt-6 sm:px-8 lg:px-12">
        <header className="mb-10 flex items-center justify-between rounded-full border border-border/70 bg-white/80 px-4 py-3 shadow-[0_18px_80px_rgba(16,24,40,0.06)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#14b8a6_55%,#f97316)] font-mono text-xs font-semibold uppercase tracking-[0.25em] text-white">
              OTX
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.32em] text-muted-foreground">
                Welcome to OpenTradex
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                OpenTradex
              </h1>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#onboard" className="transition-colors hover:text-foreground">
              Onboard
            </a>
            <Link href="/guide" className="transition-colors hover:text-foreground">
              Guide
            </Link>
            <a href="#launch" className="transition-colors hover:text-foreground">
              Launch
            </a>
            <a href="#rails" className="transition-colors hover:text-foreground">
              Rails
            </a>
            <a href="#implementation" className="transition-colors hover:text-foreground">
              Implementation
            </a>
            <a href="#responsibility" className="transition-colors hover:text-foreground">
              Responsibility
            </a>
            <a href="#opensource" className="transition-colors hover:text-foreground">
              Open Source
            </a>
          </nav>
        </header>

        <div className="grid flex-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)] lg:items-center">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-primary">
              Welcome to OpenTradex
            </div>

            <h2 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-7xl">
              Our implementation. Your strategy.
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              OpenTradex is an open-source trading implementation layer for builders who want a
              guided onboarding flow, configurable market rails, optional data APIs, and a live
              dashboard without surrendering strategy ownership. We make the wiring easier. You
              still own the prompts, markets, risk, and every order.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#onboard"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
              >
                Start onboarding
              </a>
              <Link
                href="/guide"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Read the 6-step guide
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Open live dashboard
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <SignalTile value="Pick your runtime" label="Claude, provider profiles, and future adapters" tone="teal" />
              <SignalTile value="Choose your rails" label="Kalshi, Polymarket, TradingView, brokers" tone="amber" />
              <SignalTile value="Your strategy" label="Your keys, your rules, your responsibility" tone="slate" />
            </div>

            <div className="mt-10 rounded-[2rem] border border-amber-400/40 bg-[linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.88))] p-5 shadow-[0_18px_80px_rgba(249,115,22,0.08)]">
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-amber-700">
                Responsibility notice
              </p>
              <p className="mt-3 text-base leading-7 text-foreground">
                Implementation only. Not financial advice. Not a signal service. Not a guarantee
                that trades are correct. OpenTradex helps wire tools, data, prompts, and execution
                paths together; you are fully responsible for every position, strategy, and order.
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle,_rgba(20,184,166,0.18),_transparent_48%)] blur-3xl" />
            <div className="relative grid gap-4">
              <div className="hero-panel rounded-[2rem] p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.3em] text-primary">
                      Macro pulse
                    </p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight">
                      Event repricing monitor
                    </h3>
                  </div>
                  <span className="rounded-full bg-foreground px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-background">
                    live rails
                  </span>
                </div>
                <HeroChart />
              </div>

              <div className="grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                <div className="hero-panel rounded-[2rem] p-5">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted-foreground">
                    Orderbook shape
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">
                    Synthetic candlestick field
                  </h3>
                  <CandlesPanel />
                </div>

                <div className="hero-panel rounded-[2rem] p-5">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted-foreground">
                    What the AI needs
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">
                    Implementation checklist
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {buildItems.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                        <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
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

      <section id="onboard" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[0.75rem] uppercase tracking-[0.32em] text-primary">
            Onboarding flow
          </p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
            OpenClaw-style setup for trading workflows.
          </h3>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            The first-run experience is built around a guided OpenTradex profile: welcome screen,
            runtime choice, market rails, optional data integrations, and a ready-to-edit env file.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="grid gap-5 sm:grid-cols-2">
            {onboardingSteps.map((step) => (
              <article key={step.label} className="section-frame p-6">
                <p className="font-mono text-[0.76rem] uppercase tracking-[0.28em] text-primary">
                  {step.label}
                </p>
                <h4 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                  {step.title}
                </h4>
                <p className="mt-4 text-base leading-7 text-muted-foreground">{step.text}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-5">
            <div className="section-frame p-6">
              <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
                Install tracks
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Use the path that fits your machine. `npm`, `npx`, `bunx`, and a curl bootstrap
                flow are all first-class in the current setup.
              </p>
              <div className="mt-5 space-y-3">
                {installTracks.map((track) => (
                  <div key={track.label} className="rounded-[1.4rem] border border-border/80 bg-white/80 p-4">
                    <p className="font-mono text-[0.66rem] uppercase tracking-[0.26em] text-muted-foreground">
                      {track.label}
                    </p>
                    <div className="mt-2">
                      <CommandBlock command={track.command} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-frame p-6">
              <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
                Profile output
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                The generated profile groups env vars by runtime, market rails, risk config, and
                optional APIs so you can move fast without losing control of what is actually live.
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                  <span>Choose a primary market rail and add extra rails like Polymarket or TradingView.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                  <span>Keep Apify and social/news integrations optional until you actually want them.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                  <span>Route live execution through the supported rail while using other rails for context and discovery.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="launch" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[0.75rem] uppercase tracking-[0.32em] text-primary">
            Launch and verify
          </p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
            Everything public, copy-ready, and easy to test.
          </h3>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            If you want to inspect the live website, onboard the CLI, or probe the public routes
            from Windows, the commands are below. This is still implementation infrastructure only;
            it does not make trade decisions safe or guaranteed.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-5">
            <div className="section-frame p-6">
              <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
                Live links
              </p>
              <div className="mt-5 space-y-4">
                {liveLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-[1.4rem] border border-border/80 bg-white/80 p-4 transition-transform hover:-translate-y-0.5"
                  >
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 break-all text-sm leading-6 text-foreground">{item.value}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="section-frame p-6">
              <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
                Install
              </p>
              <div className="mt-5 space-y-3">
                {setupCommands.map((command) => (
                  <CommandBlock key={command} command={command} />
                ))}
              </div>
            </div>
          </div>

          <div className="section-frame p-6">
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
              Windows curl checks
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Use <code>curl.exe</code> in PowerShell so you hit the real curl binary instead of the
              alias behavior. These let you verify the live homepage, dashboard, and public APIs.
            </p>
            <div className="mt-5 space-y-3">
              {curlChecks.map((command) => (
                <CommandBlock key={command} command={command} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="rails" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[0.75rem] uppercase tracking-[0.32em] text-primary">
            Market rails
          </p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
            One workflow, multiple rails.
          </h3>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            OpenTradex is designed to let the operator choose what is live, what is paper, and
            what is just discovery context. The stack stays opinionated about implementation and
            humble about strategy ownership.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {providerRails.map((rail) => (
            <article key={rail.title} className="section-frame p-6">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-primary">
                {rail.support}
              </p>
              <h4 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {rail.title}
              </h4>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{rail.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="implementation" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[0.75rem] uppercase tracking-[0.32em] text-primary">
            Implementation surface
          </p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
            The product is the implementation stack, not the trade outcome.
          </h3>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            OpenTradex is built for builders who want their agents to observe data, synthesize
            context, and route decisions into a dashboard or execution wrapper. We publish the
            implementation and the tooling. You own the actual trading behavior.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {implementationCards.map((card) => (
            <article key={card.label} className="section-frame p-6">
              <p className="font-mono text-[0.78rem] uppercase tracking-[0.3em] text-primary">
                {card.label}
              </p>
              <h4 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                {card.title}
              </h4>
              <p className="mt-4 text-base leading-7 text-muted-foreground">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="responsibility" className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12">
        <div className="section-frame grid gap-10 overflow-hidden p-6 sm:p-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:p-10">
          <div>
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.32em] text-amber-700">
              Plain-language disclaimer
            </p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
              Implementation easier. Trading still yours.
            </h3>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              We do not promise winning trades. We do not promise a profitable strategy. We do not
              take responsibility for your signals, your prompts, your credentials, or your orders.
              OpenTradex is open-source software for implementation. You are fully responsible for
              using it.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NoticeCard
              tone="teal"
              title="What OpenTradex does"
              items={[
                "Exposes implementation hooks for agents",
                "Makes dashboards, prompts, and wrappers easier to assemble",
                "Lets contributors improve the infrastructure in public",
              ]}
            />
            <NoticeCard
              tone="amber"
              title="What OpenTradex does not do"
              items={[
                "Guarantee trades or returns",
                "Assume legal or financial responsibility for your actions",
                "Replace operator review, compliance, or risk ownership",
              ]}
            />
          </div>
        </div>
      </section>

      <section id="opensource" className="relative mx-auto max-w-7xl px-5 pb-28 sm:px-8 lg:px-12">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="section-frame p-6">
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
              Open source
            </p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              Anyone can help implement.
            </h3>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              This is a public implementation effort. If you want to improve the onboarding flow,
              data connectors, UI, prompts, guardrails, or dashboard experience, the code is open
              and the contribution surface is real.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <ActionTile
              title="Install"
              body="Pull the published CLI and start the guided setup path."
              href="https://www.npmjs.com/package/opentradex"
              label="View npm package"
            />
            <ActionTile
              title="Inspect"
              body="Read the implementation, review the dashboard, and see how the agent loop is wired."
              href="https://github.com/deonmenezes/open-trademaxxxing"
              label="Open GitHub repo"
            />
            <ActionTile
              title="Operate"
              body="Use the built-in dashboard route for the live terminal, scanner, and news stream."
              href="/dashboard"
              label="Open dashboard"
              internal
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function SignalTile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "teal" | "amber" | "slate";
}) {
  const toneClass =
    tone === "teal"
      ? "border-primary/20 bg-primary/8"
      : tone === "amber"
        ? "border-amber-400/30 bg-amber-50/70"
        : "border-border/80 bg-white/70";

  return (
    <div className={`rounded-[1.5rem] border px-4 py-4 shadow-[0_12px_50px_rgba(16,24,40,0.04)] ${toneClass}`}>
      <p className="text-lg font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function NoticeCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "teal" | "amber";
}) {
  const dotClass = tone === "teal" ? "bg-primary" : "bg-amber-500";
  const frameClass =
    tone === "teal"
      ? "border-primary/20 bg-primary/8"
      : "border-amber-400/30 bg-amber-50/70";

  return (
    <div className={`rounded-[1.7rem] border p-5 ${frameClass}`}>
      <h4 className="text-lg font-semibold tracking-tight text-foreground">{title}</h4>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
            <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dotClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionTile({
  title,
  body,
  href,
  label,
  internal = false,
}: {
  title: string;
  body: string;
  href: string;
  label: string;
  internal?: boolean;
}) {
  const content = (
    <div className="section-frame h-full p-6 transition-transform duration-300 hover:-translate-y-1">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.3em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-4 text-lg font-semibold tracking-tight text-foreground">{label}</p>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{body}</p>
    </div>
  );

  if (internal) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer">
      {content}
    </a>
  );
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="overflow-x-auto rounded-[1.4rem] border border-border/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
      <code className="font-mono text-sm leading-7 text-slate-100">{command}</code>
    </div>
  );
}

function HeroChart() {
  const pathA = "M8 132C52 110 70 118 102 92C136 66 154 72 188 58C230 40 260 48 312 20";
  const pathB = "M8 162C46 142 74 148 108 122C140 96 166 108 194 90C228 70 262 64 312 48";

  return (
    <div className="rounded-[1.6rem] border border-border/70 bg-white/80 p-4">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground">+18.4%</p>
          <p className="text-sm text-muted-foreground">Signal intensity after macro event ingestion</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.26em] text-muted-foreground">
            volatility
          </p>
          <p className="text-sm font-medium text-amber-700">elevated</p>
        </div>
      </div>

      <svg viewBox="0 0 320 180" className="h-52 w-full overflow-visible">
        <defs>
          <linearGradient id="hero-fill-a" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(20,184,166,0.34)" />
            <stop offset="100%" stopColor="rgba(20,184,166,0.01)" />
          </linearGradient>
          <linearGradient id="hero-fill-b" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(249,115,22,0.24)" />
            <stop offset="100%" stopColor="rgba(249,115,22,0.02)" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4].map((line) => (
          <line
            key={line}
            x1="0"
            x2="320"
            y1={26 + line * 34}
            y2={26 + line * 34}
            stroke="rgba(15,23,42,0.08)"
            strokeDasharray="3 8"
          />
        ))}

        {[0, 1, 2, 3, 4, 5].map((line) => (
          <line
            key={`v-${line}`}
            y1="0"
            y2="180"
            x1={18 + line * 52}
            x2={18 + line * 52}
            stroke="rgba(15,23,42,0.06)"
            strokeDasharray="3 10"
          />
        ))}

        <path d={`${pathB} L312 180 L8 180 Z`} fill="url(#hero-fill-b)" />
        <path d={`${pathA} L312 180 L8 180 Z`} fill="url(#hero-fill-a)" />
        <path d={pathB} fill="none" stroke="rgba(249,115,22,0.85)" strokeWidth="3" strokeLinecap="round" />
        <path d={pathA} fill="none" stroke="rgba(13,148,136,0.95)" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function CandlesPanel() {
  const bars = [
    { h: 56, wick: 72, positive: true },
    { h: 42, wick: 64, positive: true },
    { h: 36, wick: 78, positive: false },
    { h: 74, wick: 96, positive: true },
    { h: 52, wick: 68, positive: true },
    { h: 44, wick: 82, positive: false },
    { h: 64, wick: 88, positive: true },
    { h: 48, wick: 72, positive: false },
    { h: 86, wick: 108, positive: true },
    { h: 60, wick: 84, positive: true },
  ];

  return (
    <div className="mt-5 rounded-[1.5rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,252,255,0.86))] p-4">
      <div className="flex h-52 items-end justify-between gap-2">
        {bars.map((bar, index) => (
          <div key={index} className="relative flex h-full flex-1 items-end justify-center">
            <span
              className="absolute bottom-6 w-px rounded-full bg-foreground/25"
              style={{ height: `${bar.wick}%` }}
            />
            <span
              className={`relative z-10 w-full rounded-full ${
                bar.positive ? "bg-primary" : "bg-amber-500"
              }`}
              style={{ height: `${bar.h}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
