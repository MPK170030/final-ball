'use client'

import Link from 'next/link'
import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log for Vercel function logs without leaking the stack to the UI
    console.error('[app/error]', error.digest ?? error.message)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-title text-foreground">Something went wrong</h1>
          <p className="text-body text-muted-foreground">
            An unexpected error occurred. Try again, or come back in a moment.
          </p>
          {error.digest && (
            <p className="font-mono text-small text-muted-foreground">
              Ref: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={reset}
            className="text-body-strong text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded min-h-[44px] px-2"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-small text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Back to Final Ball
          </Link>
        </div>
      </div>
    </main>
  )
}
