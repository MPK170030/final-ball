import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/sign-out-button'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Already linked — skip onboarding
  if (profile?.team_id) redirect('/brief')

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <span className="text-body-strong text-foreground">Final Ball</span>
        <SignOutButton />
      </header>

      {/* Onboarding form */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h1 className="text-title text-foreground">Find your team</h1>
            <p className="text-body text-muted-foreground">
              Enter your country rank and team name from the FPL app.
            </p>
          </div>

          {/* Form skeleton — lookup logic ships 22 October */}
          <div className="space-y-4">
            {/* Country */}
            <div className="space-y-1.5">
              <label htmlFor="country" className="text-small text-foreground font-medium">
                Country
              </label>
              <select
                id="country"
                name="country"
                disabled
                className="border-border bg-secondary text-foreground w-full rounded-md border px-3 py-2 text-sm opacity-50"
                aria-label="Country selector — available 22 October"
              >
                <option>Auto-detected from your region</option>
              </select>
            </div>

            {/* Country rank */}
            <div className="space-y-1.5">
              <label htmlFor="rank" className="text-small text-foreground font-medium">
                Country rank
              </label>
              <input
                id="rank"
                name="rank"
                type="number"
                min="1"
                placeholder="e.g. 4 231"
                disabled
                className="border-border bg-secondary text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm opacity-50"
                aria-label="Country rank input — available 22 October"
              />
              <p className="text-small text-muted-foreground">
                Find this in the FPL app under Leagues → your country.
              </p>
            </div>

            {/* Team name */}
            <div className="space-y-1.5">
              <label htmlFor="team-name" className="text-small text-foreground font-medium">
                Team name
              </label>
              <input
                id="team-name"
                name="teamName"
                type="text"
                placeholder="e.g. Rampant Saka"
                disabled
                className="border-border bg-secondary text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm opacity-50"
                aria-label="Team name input — available 22 October"
              />
            </div>

            {/* CTA */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2.5 text-sm font-semibold opacity-50 cursor-not-allowed"
              >
                Find my team
              </button>
              <p className="text-small text-muted-foreground text-center">
                Team linking opens 22 October.
              </p>
            </div>
          </div>

          {/* Fallback link */}
          <p className="text-small text-muted-foreground text-center">
            No rank yet?{' '}
            <span className="text-foreground/50">Paste your FPL link — available 22 October.</span>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-border border-t px-4 py-4 text-center">
        <p className="text-small text-muted-foreground">
          Not affiliated with or endorsed by the Premier League or Fantasy Premier League.{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy
          </a>
        </p>
      </footer>
    </div>
  )
}
