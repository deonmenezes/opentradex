import type { Metadata } from "next";
import Link from "next/link";
import {
  guideBenchmarks,
  guideInstallCommands,
  guidePrinciples,
  guideResearchNotes,
  guideSteps,
  type GuideCodeSample,
} from "@/lib/trading-guide-content";

export const metadata: Metadata = {
  title: "Financial Freedom in 6 Steps | OpenTradex",
  description:
    "A six-step OpenTradex guide for building a trading LLM workflow: prompting, backtesting, fine-tuning, RAG, multi-agent debate, and production controls.",
};

export default function GuidePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_34%),radial-gradient(circle_at_80%_8%,_rgba(249,115,22,0.16),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.35),_transparent_22%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] chart-grid-bg opacity-60" />

      <section className="relative mx-auto max-w-7xl px-5 pb-14 pt-6 sm:px-8 lg:px-12">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-full border border-border/70 bg-white/82 px-4 py-3 shadow-[0_18px_80px_rgba(16,24,40,0.06)] backdrop-blur">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f766e,#14b8a6_55%,#f97316)] font-mono text-xs font-semibold uppercase tracking-[0.25em] text-white">
              OTX
            </div>
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.32em] text-muted-foreground">
                OpenTradex Guide
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Financial Freedom in 6 Steps
              </h1>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Link href="/" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">
              Home
            </Link>
            <Link href="/dashboard" className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground">
              Dashboard
            </Link>
            <a
              href="#steps"
              className="rounded-full px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground"
            >
              Six Steps
            </a>
          </nav>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-start">
          <div className="max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-primary">
              How to build an LLM for trading
            </div>

            <h2 className="max-w-5xl text-5xl font-semibold leading-[0.94] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-7xl">
              Financial Freedom in 6 Steps.
            </h2>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Hedge funds spend real money assembling the same building blocks this guide walks
              through: prompting, validation, domain adaptation, retrieval, debate, monitoring,
              and risk controls. The goal here is not fantasy returns. The goal is to help you
              build a serious trading-LLM workflow from first signal to production guardrails.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#steps"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
              >
                Read the six levels
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Open dashboard
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-6 py-3 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Back to homepage
              </Link>
            </div>
          </div>

          <aside className="section-frame p-6">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-primary">
              Before you trust any chart
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              {guideResearchNotes.map((note) => (
                <li key={note} className="flex items-start gap-3">
                  <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-18 sm:px-8 lg:px-12">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {guideBenchmarks.map((item) => (
            <article key={item.label} className="section-frame p-5">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{item.value}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative border-y border-border/70 bg-white/65 py-4 backdrop-blur">
        <div className="ticker-shell">
          <div className="ticker-track">
            {[...guidePrinciples, ...guidePrinciples].map((item, index) => (
              <span key={`${item}-${index}`} className="ticker-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="steps" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[0.75rem] uppercase tracking-[0.32em] text-primary">
            Six build levels
          </p>
          <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
            Each step should deliver a working result.
          </h3>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            The red-line version is a raw LLM with no optimization. The stronger system adds data
            hygiene, task adaptation, retrieval, debate, and production controls one layer at a
            time.
          </p>
        </div>

        <div className="space-y-8">
          {guideSteps.map((step) => (
            <article key={step.level} className="section-frame overflow-hidden p-6 sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div>
                  <p className="font-mono text-[0.76rem] uppercase tracking-[0.28em] text-primary">
                    {step.level}
                  </p>
                  <h4 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                    {step.title}
                  </h4>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">{step.summary}</p>

                  <div className="mt-6 rounded-[1.6rem] border border-primary/15 bg-primary/6 p-5">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.26em] text-primary">
                      Working result
                    </p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{step.outcome}</p>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm leading-6 text-muted-foreground">
                    {step.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4">
                  {step.codeSamples.map((sample) => (
                    <CodePanel key={`${step.level}-${sample.label}`} sample={sample} />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="section-frame p-6">
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
              What stays honest
            </p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              This is a build guide, not a promise.
            </h3>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              The strongest systems still fail when data leaks, costs are ignored, or models drift
              into a new market regime. Good architecture helps. Good evaluation and hard risk
              boundaries matter more.
            </p>
          </div>

          <div className="section-frame p-6">
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.3em] text-primary">
              Start building
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {guideInstallCommands.map((item) => (
                <div key={item.label} className="rounded-[1.5rem] border border-border/80 bg-white/80 p-4">
                  <p className="font-mono text-[0.66rem] uppercase tracking-[0.26em] text-muted-foreground">
                    {item.label}
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-[1.2rem] bg-slate-950 px-4 py-3 font-mono text-[0.78rem] leading-6 text-slate-100">
                    <code>{item.command}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
              >
                Open onboarding
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white/80 px-5 py-3 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5"
              >
                Watch the dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function CodePanel({ sample }: { sample: GuideCodeSample }) {
  return (
    <div className="rounded-[1.8rem] border border-slate-200/80 bg-slate-950 text-slate-100 shadow-[0_22px_80px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.26em] text-slate-300">
          {sample.label}
        </p>
        <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.24em] text-slate-400">
          {sample.language}
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.78rem] leading-6 text-slate-100">
        <code>{sample.code}</code>
      </pre>
    </div>
  );
}
