import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignInButton } from '@/components/sign-in-button'

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
      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-full max-w-sm space-y-8">
          {/* Wordmark */}
          <div className="space-y-2">
            <h1 className="text-display text-foreground tracking-tight">Final Ball</h1>
            <p className="text-body text-muted-foreground">We create the chance, you finish it.</p>
          </div>

          {/* Value prop */}
          <p className="text-body text-muted-foreground">
            Every gameweek: a transfer pick, a captain, and the reasoning behind both — so you
            always know why.
          </p>

          {/* Auth */}
          <div className="flex flex-col items-center gap-3">
            <SignInButton />
            {error && (
              <p className="text-small text-negative" role="alert">
                Sign-in failed. Please try again.
              </p>
            )}
            <p className="text-small text-muted-foreground">
              New here? Your account is created automatically.
            </p>
          </div>

          {/* Version label (D16.7) */}
          <p className="text-small text-muted-foreground">v0.1 · MVP in progress</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-border border-t px-4 py-6 text-center">
        <p className="text-small text-muted-foreground">
          Final Ball is not affiliated with or endorsed by the Premier League or Fantasy Premier
          League.
        </p>
      </footer>
    </main>
  )
}
