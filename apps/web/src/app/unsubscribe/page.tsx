import { createServiceClient } from '@/lib/supabase/service'
import { verifyUnsubToken } from '@/lib/unsubToken'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  let success = false
  if (token) {
    const secret = process.env.UNSUBSCRIBE_SECRET
    const userId = secret ? verifyUnsubToken(token, secret) : null
    if (userId) {
      const service = createServiceClient()
      const { error } = await service
        .from('profiles')
        .update({ email_opt_out: true })
        .eq('id', userId)
      success = !error
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <p className="mb-2 text-[26px] font-semibold tracking-[-0.01em] text-foreground">
          {success ? "You've been unsubscribed" : 'Invalid link'}
        </p>
        <p className="mb-6 text-[14px] text-muted-foreground">
          {success
            ? "You won't receive weekly brief emails. You can re-enable them in Settings."
            : "This unsubscribe link isn't valid. Sign in to manage email preferences."}
        </p>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-primary px-5 py-2 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring transition-colors"
        >
          Back to Final Ball
        </Link>
      </div>
    </div>
  )
}
