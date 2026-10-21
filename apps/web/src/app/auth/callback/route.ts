import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Validate next is a same-origin relative path; reject anything starting with //
  // (e.g. //evil.com) which browsers can treat as a protocol-relative redirect.
  const rawNext = searchParams.get('next') ?? '/brief'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/brief'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
