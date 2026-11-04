'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function useSignIn() {
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return { loading, signIn }
}

export function LandingNav() {
  const { loading, signIn } = useSignIn()

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 lg:px-8">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground sm:text-[19px]">
          Final Ball
        </span>
        <div className="flex items-center gap-5">
          <Link
            href="/sample"
            className="hidden text-[14px] font-medium text-foreground transition-colors hover:text-muted-foreground sm:block"
          >
            Sample brief
          </Link>
          <button
            onClick={signIn}
            disabled={loading}
            className="min-h-[44px] text-[14px] font-medium text-foreground underline underline-offset-[3px] transition-colors hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-60"
          >
            Sign in
          </button>
        </div>
      </div>
    </header>
  )
}

export function LandingAuth({ error }: { error?: string }) {
  const { loading, signIn } = useSignIn()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:flex-wrap sm:gap-3">
        <button
          onClick={signIn}
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-3 rounded bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <GoogleIcon />
          )}
          Get started
        </button>

        <Link
          href="/sample"
          className="inline-flex h-12 w-full items-center justify-center rounded border border-border px-6 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
        >
          See a real brief
        </Link>
      </div>

      <p className="text-[14px] leading-[20px] text-muted-foreground">
        Free. Sign in with Google. We never ask for your FPL password.
      </p>

      {error && (
        <p className="text-small text-negative" role="alert">
          Sign-in failed. Please try again.
        </p>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  )
}
