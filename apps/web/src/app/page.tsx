import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingAuth } from './landing-auth'

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
    <main className="flex min-h-dvh flex-col">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-full max-w-sm space-y-8">

          {/* Wordmark + tagline + value prop */}
          <div className="space-y-3">
            <h1 className="text-display text-foreground">Final Ball</h1>
            <p className="text-body-strong text-foreground">
              We create the chance, you finish it.
            </p>
            <p className="text-body text-muted-foreground">
              Every gameweek: a transfer pick, a captain, and the reasoning behind both — so you
              always know why.
            </p>
          </div>

          {/* Auth CTAs */}
          <LandingAuth error={error} />

          {/* Version label */}
          <p className="text-small text-muted-foreground">v0.1 · MVP in progress</p>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section
        aria-labelledby="how-heading"
        className="border-border border-t px-4 py-12"
      >
        <div className="mx-auto w-full max-w-sm">
          <h2
            id="how-heading"
            className="text-label mb-8 uppercase tracking-widest text-muted-foreground"
          >
            How it works
          </h2>

          <ol className="space-y-8">
            {([
              {
                n: '01',
                title: 'Connect your team',
                body: 'Enter your country and country rank from the FPL app. No team ID needed — we match your squad in seconds.',
              },
              {
                n: '02',
                title: 'Generate your brief',
                body: 'The agent scores every player in your squad against upcoming fixtures, then ranks realistic transfers by expected points.',
              },
              {
                n: '03',
                title: 'Make your move',
                body: 'Transfer pick, captain, and alternatives — each with the full AI reasoning trace so you can see exactly why.',
              },
            ] as const).map(({ n, title, body }) => (
              <li key={n} className="flex gap-4">
                <span
                  className="font-mono text-xl font-medium tabular-nums text-primary shrink-0 leading-none pt-0.5"
                  aria-hidden="true"
                >
                  {n}
                </span>
                <div>
                  <p className="text-body-strong text-foreground">{title}</p>
                  <p className="text-body mt-1 text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Roadmap ───────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="roadmap-heading"
        className="border-border border-t px-4 py-12"
      >
        <div className="mx-auto w-full max-w-sm">
          <h2
            id="roadmap-heading"
            className="text-label mb-8 uppercase tracking-widest text-muted-foreground"
          >
            Roadmap
          </h2>

          <div className="space-y-8">
            {/* Now */}
            <div>
              <p className="text-label mb-3 uppercase tracking-widest text-primary">
                Now · v0.1
              </p>
              <ul className="space-y-2">
                {[
                  'Transfer and captain picks, every gameweek',
                  'Full AI reasoning trace for every suggestion',
                  'Find your team by country rank — no FPL ID needed',
                  'Public sample brief — see the agent before signing up',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    <span className="text-body text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next */}
            <div>
              <p className="text-label mb-3 uppercase tracking-widest text-muted-foreground">
                Next
              </p>
              <ul className="space-y-2">
                {[
                  'Receipts: did the advice actually work?',
                  'Chip timing — when to play your Wildcard, Free Hit, and Triple Captain',
                  'Weekly brief delivered by email',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                      aria-hidden="true"
                    />
                    <span className="text-body text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-border border-t px-4 py-6 text-center">
        <p className="text-small text-muted-foreground">
          Final Ball is not affiliated with or endorsed by the Premier League or Fantasy Premier
          League.{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy
          </a>
        </p>
      </footer>

    </main>
  )
}
