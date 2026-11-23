import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LandingAuth, LandingNav } from './landing-auth'
import { PitchLines } from '@/components/landing/pitch-lines'
import { LiveBriefDemo } from '@/components/landing/live-brief-demo'

const APP_STATUS = 'v0.1 · MVP in progress'

const steps = [
  {
    n: '1',
    title: 'Link your team',
    body: 'Enter your country rank and team name. No IDs, no passwords.',
    bodyMobile: 'Enter your country rank and team name. No IDs, no passwords.',
  },
  {
    n: '2',
    title: 'Get your brief',
    body: 'A top transfer, 3 ranked alternatives, a captain and a vice.',
    bodyMobile: 'A top transfer, 3 ranked alternatives, a captain and a vice.',
  },
  {
    n: '3',
    title: 'See how it decided',
    body: 'Every pick has a reason and the full trace of tool calls.',
    bodyMobile: 'Every pick has a reason and the full trace of tool calls.',
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
        <section className="relative overflow-hidden px-4 pb-6 pt-10 lg:px-6 lg:pb-[64px] lg:pt-[80px]">
          <PitchLines />

          <div className="relative z-10 mx-auto max-w-[1200px]">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[2fr_3fr] lg:gap-12">

              {/* Left: text content */}
              <div className="flex flex-col gap-5">
                <div className="inline-flex w-fit rounded-sm border border-border px-2 py-1">
                  <span className="font-mono text-[12px] leading-[16px] text-muted-foreground">
                    {APP_STATUS}
                  </span>
                </div>

                <h1
                  className="font-bold leading-[0.96] tracking-[-0.04em] text-foreground"
                  style={{ fontSize: 'clamp(48px, 7vw, 88px)' }}
                >
                  We create<br />
                  the chance.<br />
                  <span className="text-primary">You finish it.</span>
                </h1>

                <p className="text-[16px] leading-[24px] text-muted-foreground lg:max-w-[480px] lg:text-[18px] lg:leading-[27px]">
                  An AI agent for your Fantasy Premier League team. Each gameweek it suggests a
                  transfer and a captain — and shows exactly how it got there.
                </p>

                <LandingAuth error={error} />

                <ul className="flex flex-col gap-1.5 text-[13px] text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                  <li className="flex items-center gap-1.5">
                    <span className="text-positive" aria-hidden="true">✓</span>Free
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-positive" aria-hidden="true">✓</span>Read-only: nothing changes in FPL
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-positive" aria-hidden="true">✓</span>Never asks for your FPL password
                  </li>
                </ul>
              </div>

              {/* Right: live demo — desktop only */}
              <div className="hidden lg:block">
                <LiveBriefDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Live demo — mobile only ───────────────────────────────────────── */}
        <section className="px-4 pb-10 lg:hidden">
          <div className="mx-auto max-w-[1200px]">
            <LiveBriefDemo />
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section
          id="how-works"
          aria-labelledby="how-heading"
          className="border-t border-border px-4 pb-2 pt-10 lg:bg-card lg:px-6 lg:py-[56px]"
        >
          <div className="mx-auto flex max-w-[1200px] flex-col gap-5 lg:gap-7">
            <h2
              id="how-heading"
              className="text-[22px] font-semibold leading-[28px] text-foreground lg:text-[28px] lg:leading-[34px]"
            >
              Three minutes a week. You make the final move.
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
          className="border-t border-border px-4 pb-2 pt-8 lg:px-6 lg:py-[56px]"
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
                  Find your team by country rank and team name · Transfer and captain picks with
                  reasons · The full agent trace on every pick · A public sample brief, updated weekly.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 lg:p-6">
                <p className="text-label uppercase tracking-widest text-muted-foreground">
                  Next · Full MVP
                </p>
                <p className="text-[14px] leading-[20px] text-foreground lg:text-[15px] lg:leading-[22px]">
                  Counter a pick, and see who is right when you push back · Safe, Balanced and Bold
                  tags on every option · Chip timing and expiry alerts · Receipts and a 5-gameweek
                  scorecard · A weekly email when your brief is ready.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-4 pb-8 pt-6 lg:px-6 lg:pb-10">
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
