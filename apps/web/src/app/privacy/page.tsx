import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy — Final Ball',
  description: 'What Final Ball stores, how it is used, and how to delete your data.',
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
        <Link href="/" className="text-body-strong text-foreground hover:opacity-80">
          Final Ball
        </Link>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-prose flex-1 px-4 py-10 space-y-8">
        <div className="space-y-1">
          <h1 className="text-title text-foreground">Privacy</h1>
          <p className="text-small text-muted-foreground">Last updated 20 October 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-heading text-foreground">What we store</h2>
          <p className="text-body text-muted-foreground">
            When you sign in with Google, Final Ball stores:
          </p>
          <ul className="text-body text-muted-foreground list-disc pl-5 space-y-1">
            <li>Your name and email address (from Google)</li>
            <li>Your Fantasy Premier League team ID and team name</li>
            <li>
              Weekly transfer and captain suggestions that the agent generates for your team
            </li>
            <li>
              Receipts: which suggestions you followed and how they performed over the next three
              gameweeks
            </li>
            <li>Optional notes you write on your receipts</li>
          </ul>
          <p className="text-body text-muted-foreground">
            Nothing else is stored. Final Ball never reads your FPL password, your FPL account
            credentials, or any data beyond your public FPL team page.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading text-foreground">How it is used</h2>
          <p className="text-body text-muted-foreground">
            Your data is used solely to generate your weekly brief and track whether the
            suggestions helped. It is never sold, shared with third parties, or used for
            advertising.
          </p>
          <p className="text-body text-muted-foreground">
            Your email address is used to send one optional email per gameweek (&ldquo;your brief is
            ready&rdquo;). You can turn this off at any time in Settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading text-foreground">Data storage</h2>
          <p className="text-body text-muted-foreground">
            Data is stored in Supabase (hosted in the EU) and is retained until you delete your
            account. You can delete everything — account, team link, briefs, receipts, and notes
            — from Settings → Delete my data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading text-foreground">Cookies and sessions</h2>
          <p className="text-body text-muted-foreground">
            Final Ball uses a single session cookie to keep you signed in across visits. No
            tracking, analytics, or advertising cookies are set.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-heading text-foreground">Contact</h2>
          <p className="text-body text-muted-foreground">
            Questions or deletion requests:{' '}
            <a
              href="mailto:manavkothari17@gmail.com"
              className="text-foreground underline underline-offset-2 hover:opacity-80"
            >
              manavkothari17@gmail.com
            </a>
          </p>
        </section>

        <section className="border-border border-t pt-6 space-y-2">
          <p className="text-small text-muted-foreground">
            <strong className="text-foreground">Non-affiliation notice.</strong> Final Ball is an
            independent project and is not affiliated with, endorsed by, or connected to the
            Premier League, Fantasy Premier League, or any of their partners. &ldquo;FPL&rdquo; in these pages
            refers to the Fantasy Premier League game.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-border border-t px-4 py-4 text-center">
        <p className="text-small text-muted-foreground">
          Not affiliated with or endorsed by the Premier League or Fantasy Premier League.
        </p>
      </footer>
    </div>
  )
}
