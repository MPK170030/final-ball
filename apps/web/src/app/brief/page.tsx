import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/sign-out-button'

export default async function BriefPage() {
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

  if (!profile?.team_id) redirect('/onboarding')

  const teamName = profile.team_name ?? 'Your team'
  const displayName =
    (profile.manager_name as string | null) ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    ''
  const initial = displayName[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <span className="text-body-strong text-foreground">Final Ball</span>
        <div className="flex items-center gap-3">
          <div
            className="bg-secondary text-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
            aria-hidden="true"
          >
            {initial}
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Brief */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-8">
        <div className="space-y-0.5">
          <h1 className="text-title text-foreground">{teamName}</h1>
          <p className="text-small text-muted-foreground">Your weekly brief</p>
        </div>

        {/* Placeholder — brief cards ship Thursday */}
        <div className="border-border bg-card space-y-2 rounded-lg border px-6 py-10 text-center">
          <p className="text-body-strong text-foreground">Generating your first brief…</p>
          <p className="text-small text-muted-foreground">
            Transfer and captain suggestions arrive 23 October.
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
