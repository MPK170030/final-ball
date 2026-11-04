import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LandingAuth, LandingNav } from './landing-auth'

function BriefPreviewDesktop() {
  return (
    <div className="w-full rounded-lg border border-border bg-card p-6" style={{ height: '400px' }}>
      <div className="flex h-full flex-col gap-3">
        <p className="text-label uppercase tracking-widest text-muted-foreground">Brief preview</p>
        <div className="h-4 w-[45%] rounded-sm bg-secondary" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[150px] rounded border-2 border-border bg-background" />
          <div className="flex flex-col gap-2">
            <div className="h-11 rounded-sm bg-secondary" />
            <div className="h-11 rounded-sm bg-secondary" />
            <div className="h-11 rounded-sm bg-secondary" />
          </div>
        </div>
        <div className="h-2.5 w-4/5 rounded-sm bg-muted" />
        <div className="min-h-[90px] flex-1 rounded bg-secondary" />
      </div>
    </div>
  )
}

function BriefPreviewMobile() {
  return (
    <div className="rounded-lg border border-border bg-card p-4" style={{ height: '300px' }}>
      <div className="flex h-full flex-col gap-2.5">
        <p className="text-label uppercase tracking-widest text-muted-foreground">Brief preview</p>
        <div className="h-3.5 w-[60%] rounded-sm bg-secondary" />
        <div className="h-[90px] w-full rounded border-2 border-border bg-background" />
        <div className="h-2.5 w-[90%] rounded-sm bg-muted" />
        <div className="h-2.5 w-[75%] rounded-sm bg-muted" />
        <div className="h-10 rounded-sm bg-secondary" />
        <div className="h-10 rounded-sm bg-secondary" />
      </div>
    </div>
  )
}

const steps = [
  {
    n: '1',
    title: 'Link your team',
    body: 'Enter your country rank and team name. Read-only; nothing changes in FPL.',
    bodyMobile: 'Enter your country rank and team name. Read-only; nothing changes in FPL.',
  },
  {
    n: '2',
    title: 'Get your brief',
    body: 'A top transfer pick plus 3 alternatives, or a call to save your transfer. A captain and vice, too.',
    bodyMobile:
      'A top transfer pick plus 3 alternatives, or a call to save your transfer. A captain and vice, too.',
  },
  {
    n: '3',
    title: 'See how it decided',
    body: 'Every pick has a reason, and the full agent trace is one click away.',
    bodyMobile: 'Every pick has a reason, and the full agent trace is one tap away.',
  },
]

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    redirect(profile?.team_id ? '/brief' : '/onboarding')
  }

  const { error } = await searchParams

  return (
    <div className="flex min-h-dvh flex-col">
      <LandingNav />

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="px-4 pb-6 pt-8 lg:px-8 lg:pb-[56px] lg:pt-[72px]">
          <div className="mx-auto max-w-[1200px]">
            <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">

              {/* Left: text content */}
              <div className="flex flex-col gap-5">
                <div className="inline-flex w-fit rounded-sm border border-border px-2 py-1">
                  <span className="font-mono text-[12px] leading-[16px] text-muted-foreground">
                    v0.1 · MVP in progress
                  </span>
                </div>

                <h1 className="text-display text-foreground lg:text-[52px] lg:leading-[58px] lg:tracking-[-0.025em]">
                  We create the chance, you finish it.
                </h1>

                <p className="text-[16px] leading-[24px] text-muted-foreground lg:max-w-[520px] lg:text-[19px] lg:leading-[28px]">
                  An AI agent for your Fantasy Premier League team. Each gameweek it suggests a
                  transfer and a captain, and shows exactly how it got there.
                </p>

                <LandingAuth error={error} />
              </div>

              {/* Right: brief preview — desktop only */}
              <div className="hidden lg:block" aria-hidden="true">
                <BriefPreviewDesktop />
              </div>
            </div>
          </div>
        </section>

        {/* ── Brief preview — mobile only ─────────────────────────────────── */}
        <section className="px-4 pb-10 lg:hidden" aria-hidden="true">
          <div className="mx-auto max-w-[1200px]">
            <BriefPreviewMobile />
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section
          aria-labelledby="how-heading"
          className="border-t border-border px-4 pb-2 pt-10 lg:bg-card lg:px-8 lg:py-[56px]"
        >
          <div className="mx-auto flex max-w-[1200px] flex-col gap-5 lg:gap-7">
            <h2
              id="how-heading"
              className="text-[22px] font-semibold leading-[28px] text-foreground lg:text-[28px] lg:leading-[34px]"
            >
              How it works
            </h2>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
              {steps.map(({ n, title, body, bodyMobile }) => (
                <div
                  key={n}
                  className="flex items-start gap-3.5 lg:flex-col lg:gap-2.5 lg:rounded lg:border lg:border-border lg:bg-secondary lg:p-6"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground font-mono text-[14px] leading-none text-foreground">
                    {n}
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold leading-[22px] text-foreground lg:text-[17px]">
                      {title}
                    </p>
                    <p className="mt-0.5 text-[14px] leading-[20px] text-muted-foreground lg:text-[15px] lg:leading-[22px]">
                      <span className="lg:hidden">{bodyMobile}</span>
                      <span className="hidden lg:inline">{body}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[14px] leading-[20px] text-foreground lg:text-[15px] lg:leading-[22px]">
              You make the final move in the official FPL app.
            </p>
          </div>
        </section>

        {/* ── Roadmap ───────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="roadmap-heading"
          className="border-t border-border px-4 pb-2 pt-8 lg:px-8 lg:py-[56px]"
        >
          <div className="mx-auto flex max-w-[1200px] flex-col gap-4 lg:gap-6">
            <h2
              id="roadmap-heading"
              className="text-[22px] font-semibold leading-[28px] text-foreground lg:text-[28px] lg:leading-[34px]"
            >
              Roadmap
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-lg border border-border p-4 lg:p-6">
                <p className="text-label uppercase tracking-widest text-muted-foreground">
                  Now · v0.1
                </p>
                <p className="text-[14px] leading-[20px] text-foreground lg:text-[15px] lg:leading-[22px]">
                  Find your team by country rank · transfer and captain advice · reasons and agent
                  trace · public sample brief
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 lg:p-6">
                <p className="text-label uppercase tracking-widest text-muted-foreground">
                  Next · by ~20 Nov
                </p>
                <p className="text-[14px] leading-[20px] text-foreground lg:text-[15px] lg:leading-[22px]">
                  Weekly email · Refresh · Safe / Balanced / Bold · chip timing · receipts and a
                  5-gameweek scorecard that check whether the advice worked
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-4 pb-8 pt-6 lg:px-8 lg:pb-10">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-[18px] text-muted-foreground sm:text-small sm:leading-[20px]">
            Final Ball is not affiliated with the Premier League or Fantasy Premier League.
          </p>
          <Link
            href="/privacy"
            className="text-small text-foreground underline underline-offset-2 hover:text-muted-foreground"
          >
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  )
}
