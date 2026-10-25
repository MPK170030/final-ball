import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <p className="font-mono text-number-lg text-muted-foreground tabular-nums">404</p>
          <h1 className="text-title text-foreground">Page not found</h1>
          <p className="text-body text-muted-foreground">
            This page doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Link
            href="/"
            className="text-body-strong text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Back to Final Ball
          </Link>
          <Link
            href="/sample"
            className="text-small text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            See a sample brief
          </Link>
        </div>
      </div>
    </main>
  )
}
