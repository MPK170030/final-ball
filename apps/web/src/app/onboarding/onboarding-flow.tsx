'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InfoButton, GuideAside } from '@/components/onboarding/guide-panel'
import { SearchProgressCard } from '@/components/onboarding/search-progress-card'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'find' | 'searching' | 'link' | 'confirm' | 'already-linked'
type FallbackReason = 'timeout' | 'no_rank' | 'too_big' | 'chosen' | 'fpl_updating' | 'unknown_country' | 'rate_limited' | null

interface TeamSummary {
  teamId: number
  teamName: string
  managerName: string
  overallRank: number
  totalPoints: number
  country: string
}

interface SearchState {
  checked: number
  total: number
  page: number
  etaSeconds: number | null
  showLinkHint: boolean
}

// ─── SSE stream reader ────────────────────────────────────────────────────────

async function* readSSE(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''
      for (const block of parts) {
        const line = block.trim()
        if (line.startsWith('data: ')) {
          try { yield JSON.parse(line.slice(6)) } catch { /* skip malformed */ }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ─── Locale → country name ────────────────────────────────────────────────────

function detectCountry(countries: string[]): string {
  try {
    const region = navigator.language.split('-')[1]
    if (!region) return countries[0] ?? ''
    const displayName = new Intl.DisplayNames(['en'], { type: 'region' }).of(region) ?? ''
    return countries.find((c) => c.toLowerCase() === displayName.toLowerCase()) ?? countries[0] ?? ''
  } catch {
    return countries[0] ?? ''
  }
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function OnboardingHeader({ onCancel }: { onCancel: () => void }) {
  return (
    <header className="border-border flex items-center justify-between border-b px-4 py-3">
      <span className="text-body-strong text-foreground">Final Ball</span>
      <button
        type="button"
        onClick={onCancel}
        className="text-small text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:ring-ring min-h-[44px] rounded-md px-3 py-1.5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
      >
        Cancel / do this later
      </button>
    </header>
  )
}

function OnboardingFooter() {
  return (
    <footer className="border-border border-t px-4 py-4 text-center">
      <p className="text-small text-muted-foreground">
        Not affiliated with or endorsed by the Premier League or Fantasy Premier League.{' '}
        <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy
        </a>
      </p>
    </footer>
  )
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[14px] leading-5 font-semibold text-foreground">
      {children}
    </label>
  )
}

function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return <span id={id} className="text-small text-muted-foreground">{children}</span>
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <span id={id} role="alert" className="text-small text-negative font-medium">
      {children}
    </span>
  )
}

const inputCls =
  'w-full h-12 px-3.5 border border-input rounded-md bg-background text-foreground text-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 transition-colors'

const inputErrCls = 'border-negative'

// ─── Find form ────────────────────────────────────────────────────────────────

interface FindFormProps {
  countries: string[]
  initialCountry: string
  onSubmit: (data: { country: string; rank: number; teamName: string }) => void
  onNoRank: () => void
}

function FindForm({ countries, initialCountry, onSubmit, onNoRank }: FindFormProps) {
  const [country, setCountry] = useState(initialCountry)
  const [rank, setRank] = useState('')
  const [teamName, setTeamName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const errs: Record<string, string> = {}
    if (!country) errs.country = 'Select your country.'
    const parsed = parseInt(rank.replace(/,/g, ''), 10)
    if (!rank.trim() || isNaN(parsed) || parsed < 1) {
      errs.rank = 'Enter a valid rank (find it in the FPL app under Leagues).'
    }
    if (!teamName.trim()) errs.teamName = 'Enter your team name.'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    onSubmit({ country, rank: parseInt(rank.replace(/,/g, ''), 10), teamName: teamName.trim() })
  }

  return (
    <div className="w-full max-w-3xl lg:grid lg:grid-cols-[1fr_300px] lg:gap-8 lg:items-start">
      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-title text-foreground">Find your team</h1>
          <p className="text-body text-muted-foreground">
            Enter your country rank and team name from the FPL app.
          </p>
        </div>

        <div className="space-y-4">
          {/* Country */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="country">Country</FieldLabel>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-describedby={errors.country ? 'country-err' : undefined}
              aria-invalid={!!errors.country}
              className={`${inputCls} ${errors.country ? inputErrCls : ''}`}
            >
              <option value="" disabled>Select your country</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <FieldHint>Detected from your device. Change it if it's wrong.</FieldHint>
            {errors.country && <FieldError id="country-err">{errors.country}</FieldError>}
          </div>

          {/* Country rank */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-0.5">
              <FieldLabel htmlFor="rank">Country rank</FieldLabel>
              <InfoButton type="rank" label="Where to find your country rank" />
            </div>
            <input
              id="rank"
              type="text"
              inputMode="numeric"
              value={rank}
              onChange={(e) => setRank(e.target.value.replace(/[^0-9,]/g, ''))}
              placeholder="e.g. 4,231"
              aria-describedby={`rank-hint${errors.rank ? ' rank-err' : ''}`}
              aria-invalid={!!errors.rank}
              className={`${inputCls} font-mono ${errors.rank ? inputErrCls : ''}`}
            />
            <FieldHint id="rank-hint">Your rank in the FPL app under Leagues → your country.</FieldHint>
            {errors.rank && <FieldError id="rank-err">{errors.rank}</FieldError>}
          </div>

          {/* Team name */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-0.5">
              <FieldLabel htmlFor="team-name">Team name</FieldLabel>
              <InfoButton type="team-name" label="Where to find your team name" />
            </div>
            <input
              id="team-name"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Rampant Saka"
              aria-describedby={errors.teamName ? 'team-name-err' : undefined}
              aria-invalid={!!errors.teamName}
              className={`${inputCls} ${errors.teamName ? inputErrCls : ''}`}
            />
            {errors.teamName && <FieldError id="team-name-err">{errors.teamName}</FieldError>}
          </div>

          {/* CTAs */}
          <div className="space-y-3 pt-1">
            <button
              type="submit"
              className="w-full h-12 bg-primary text-primary-foreground rounded-md font-semibold text-body hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              Find my team
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={onNoRank}
                className="text-small font-semibold text-foreground underline underline-offset-2 hover:text-primary min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                No rank yet? Use your FPL link instead.
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Desktop guide */}
      <GuideAside type="rank" />
    </div>
  )
}

// ─── Searching view ───────────────────────────────────────────────────────────

interface SearchingViewProps {
  searchState: SearchState
  country: string
  onUseFplLink: () => void
  onEdit: () => void
}

function SearchingView({ searchState, country, onUseFplLink, onEdit }: SearchingViewProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <SearchProgressCard
        checked={searchState.checked}
        total={searchState.total}
        page={searchState.page}
        etaSeconds={searchState.etaSeconds}
        country={country}
        showLinkHint={searchState.showLinkHint}
        onUseFplLink={onUseFplLink}
      />
      <button
        type="button"
        onClick={onEdit}
        className="text-small text-muted-foreground hover:text-foreground underline underline-offset-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        Edit search
      </button>
    </div>
  )
}

// ─── Link fallback ────────────────────────────────────────────────────────────

const FALLBACK_BANNERS: Record<NonNullable<FallbackReason>, string> = {
  timeout: "Search timed out after 30 seconds. Paste your FPL link to finish.",
  no_rank: "Teams without a rank yet aren't listed in the standings. Paste your FPL link instead.",
  too_big: "Your rank group is too large to scan quickly. Paste your FPL link instead.",
  chosen: '',
  fpl_updating: "FPL is currently updating. Paste your FPL link or try the rank search again in a few minutes.",
  unknown_country: "We don't have a country league for that country yet. Paste your FPL link to find your team instead.",
  rate_limited: "Too many searches this hour. Paste your FPL link instead, or try the rank search again later.",
}

interface LinkFallbackProps {
  reason: FallbackReason
  onSubmit: (input: string) => void
  onTryAgain: () => void
  isLoading: boolean
  error: string | null
}

function LinkFallback({ reason, onSubmit, onTryAgain, isLoading, error }: LinkFallbackProps) {
  const [input, setInput] = useState('')
  const [clipSuggestion, setClipSuggestion] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text.includes('/entry/') || /^\d{6,8}$/.test(text.trim())) {
          setClipSuggestion(text.trim())
        }
      } catch { /* clipboard permission denied */ }
    }
    check()
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input.trim()) onSubmit(input.trim())
  }

  const banner = reason && reason !== 'chosen' ? FALLBACK_BANNERS[reason] : null

  return (
    <div className="w-full max-w-3xl lg:grid lg:grid-cols-[1fr_300px] lg:gap-8 lg:items-start">
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-title text-foreground">Use your FPL link</h1>
          <p className="text-body text-muted-foreground">
            Paste your FPL team link or just your team ID.
          </p>
        </div>

        {/* Contextual banner */}
        {banner && (
          <div role="status" className="flex gap-2.5 items-start p-3 rounded-md bg-secondary text-[14px] leading-5">
            <span className="flex-none w-5 h-5 mt-0.5 rounded-full border-[1.5px] border-muted-foreground text-[12px] font-semibold leading-[17px] text-center flex-shrink-0">
              i
            </span>
            <span>{banner}</span>
          </div>
        )}

        {/* Clipboard suggestion */}
        {clipSuggestion && !input && (
          <div className="flex gap-2 items-center p-3 rounded-md border border-border bg-secondary text-small">
            <span className="flex-1 min-w-0 truncate text-muted-foreground">
              Found a copied link: <span className="text-foreground font-medium">{clipSuggestion}</span>
            </span>
            <button
              type="button"
              onClick={() => { setInput(clipSuggestion); setClipSuggestion(null); inputRef.current?.focus() }}
              className="flex-none text-small font-semibold text-primary underline underline-offset-2 hover:text-primary-hover min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Use this link
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-0.5">
              <FieldLabel htmlFor="fpl-link">Team link or ID</FieldLabel>
              <InfoButton type="link" label="How to get your FPL link" />
            </div>
            <input
              ref={inputRef}
              id="fpl-link"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="fantasy.premierleague.com/entry/… or just the ID"
              aria-describedby={error ? 'fpl-link-err' : 'fpl-link-hint'}
              aria-invalid={!!error}
              className={`${inputCls} ${error ? inputErrCls : ''}`}
            />
            {error ? (
              <FieldError id="fpl-link-err">{error}</FieldError>
            ) : (
              <FieldHint id="fpl-link-hint">Paste the URL from your FPL team page, or just the number after /entry/.</FieldHint>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="w-full h-12 bg-primary text-primary-foreground rounded-md font-semibold text-body hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Looking up…' : 'Find my team'}
          </button>
        </form>

        <a
          href="https://fantasy.premierleague.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 justify-center text-small font-semibold text-foreground underline underline-offset-2 hover:text-primary min-h-[44px]"
        >
          Open FPL in a new tab
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M2 10 L10 2 M5 2 H10 V7" />
          </svg>
        </a>

        <div className="text-center">
          <button
            type="button"
            onClick={onTryAgain}
            className="text-small text-muted-foreground hover:text-foreground underline underline-offset-2 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Try the rank search again
          </button>
        </div>
      </div>

      {/* Desktop guide */}
      <GuideAside type="link" />
    </div>
  )
}

// ─── Is this you? ─────────────────────────────────────────────────────────────

interface ConfirmViewProps {
  summary: TeamSummary
  onConfirm: () => void
  onNotMe: () => void
  isConfirming: boolean
}

function ConfirmView({ summary, onConfirm, onNotMe, isConfirming }: ConfirmViewProps) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-title text-foreground">Is this you?</h1>
        <p className="text-body text-muted-foreground">Check your team details before confirming.</p>
      </div>

      {/* Team card */}
      <div className="border border-border rounded-lg bg-card p-5 space-y-4">
        <div className="space-y-0.5">
          <p className="text-heading text-foreground">{summary.teamName}</p>
          <p className="text-body text-muted-foreground">{summary.managerName}</p>
        </div>
        <hr className="border-border" />
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-small text-muted-foreground">Overall rank</dt>
            <dd className="font-mono text-body-strong text-foreground">{summary.overallRank.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Total points</dt>
            <dd className="font-mono text-body-strong text-foreground">{summary.totalPoints.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Team ID</dt>
            <dd className="font-mono text-body-strong text-foreground">{summary.teamId}</dd>
          </div>
          <div>
            <dt className="text-small text-muted-foreground">Country</dt>
            <dd className="text-body-strong text-foreground">{summary.country}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className="w-full h-12 bg-primary text-primary-foreground rounded-md font-semibold text-body hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isConfirming ? 'Confirming…' : 'Yes, that\'s me'}
        </button>
        <button
          type="button"
          onClick={onNotMe}
          disabled={isConfirming}
          className="w-full h-12 rounded-md border border-input font-medium text-body text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 transition-colors"
        >
          Not me
        </button>
      </div>
    </div>
  )
}

// ─── Team already linked ──────────────────────────────────────────────────────

function AlreadyLinked({ onEnterDifferent }: { onEnterDifferent: () => void }) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-title text-foreground">Team already linked</h1>
        <p className="text-body text-muted-foreground">
          This team is already connected to another Final Ball account. Each team can only be linked once.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onEnterDifferent}
          className="w-full h-12 bg-primary text-primary-foreground rounded-md font-semibold text-body hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          Enter a different team
        </button>
        <a
          href="mailto:manavkothari17@gmail.com?subject=Team%20already%20linked%20on%20Final%20Ball&body=My%20team%20ID%20is%3A%20"
          className="flex items-center justify-center w-full h-12 rounded-md border border-input font-medium text-body text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          Report this
        </a>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

const ONBOARDING_STORAGE_KEY = 'fb_onboarding'

type PersistedState = {
  step: Exclude<Step, 'searching'>
  country: string
  fallbackReason: FallbackReason
  teamSummary: TeamSummary | null
}

function clearOnboardingState() {
  try { sessionStorage.removeItem(ONBOARDING_STORAGE_KEY) } catch {}
}

export function OnboardingFlow({ countries }: { countries: string[] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('find')
  const [country, setCountry] = useState('')
  const [searchState, setSearchState] = useState<SearchState>({
    checked: 0, total: 0, page: 0, etaSeconds: null, showLinkHint: false,
  })
  const [fallbackReason, setFallbackReason] = useState<FallbackReason>(null)
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [isLinkLoading, setIsLinkLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  // D9.7: restore state from sessionStorage on mount (survives tab switches and reloads)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (!raw) return
      // Parse as loosely-typed so the 'searching' guard is meaningful at runtime
      const saved = JSON.parse(raw) as {
        step?: Step; country?: string; fallbackReason?: FallbackReason; teamSummary?: TeamSummary | null
      }
      if (!saved.step || saved.step === 'searching') return
      // Guard: don't restore confirm without team data
      if (saved.step === 'confirm' && !saved.teamSummary) return
      if (saved.country) setCountry(saved.country)
      if (saved.fallbackReason !== undefined) setFallbackReason(saved.fallbackReason)
      if (saved.teamSummary) setTeamSummary(saved.teamSummary)
      setStep(saved.step)
    } catch {}
  }, [])

  // Persist step changes so returning from the FPL tab picks up where we left off
  useEffect(() => {
    if (step === 'searching') return
    try {
      sessionStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
        step, country, fallbackReason, teamSummary,
      } satisfies PersistedState))
    } catch {}
  }, [step, country, fallbackReason, teamSummary])

  // Pre-select country from browser locale
  const initialCountry = typeof window !== 'undefined' ? detectCountry(countries) : countries[0] ?? ''

  async function handleCancel() {
    clearOnboardingState()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function handleFindSubmit({ country: c, rank, teamName }: { country: string; rank: number; teamName: string }) {
    setCountry(c)
    setStep('searching')
    setSearchState({ checked: 0, total: 0, page: 0, etaSeconds: null, showLinkHint: false })

    try {
      const res = await fetch('/api/team/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: c, rank, teamName }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.status === 'fpl_updating') {
          setFallbackReason('fpl_updating')
          setStep('link')
          return
        }
        if (err.error === 'unknown_country') {
          setFallbackReason('unknown_country')
          setStep('link')
          return
        }
        if (err.error === 'rate_limited') {
          setFallbackReason('rate_limited')
          setStep('link')
          return
        }
        setFallbackReason(null)
        setStep('link')
        return
      }

      for await (const event of readSSE(res)) {
        if (event.status === 'found') {
          setTeamSummary(event.entry)
          setStep('confirm')
          return
        } else if (event.status === 'not_found') {
          setFallbackReason(null)
          setStep('link')
          return
        } else if (event.status === 'timeout') {
          setFallbackReason('timeout')
          setStep('link')
          return
        } else if (event.status === 'too_big') {
          setFallbackReason('too_big')
          setStep('link')
          return
        } else if (event.status === 'fpl_updating') {
          setFallbackReason('fpl_updating')
          setStep('link')
          return
        } else {
          // Progress event
          setSearchState({
            checked: event.checked ?? 0,
            total: event.total ?? 0,
            page: event.page ?? 0,
            etaSeconds: event.etaSeconds ?? null,
            showLinkHint: event.showLinkHint ?? false,
          })
        }
      }
    } catch {
      setFallbackReason(null)
      setStep('link')
    }
  }

  async function handleLinkSubmit(input: string) {
    setIsLinkLoading(true)
    setLinkError(null)
    try {
      const res = await fetch('/api/team/resolve-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'not_found') {
          setLinkError(`No team found with that ID. Double-check the link or ID.`)
        } else if (data.error === 'invalid_input') {
          setLinkError(`That link doesn't contain a team ID. Look for /entry/ followed by a number.`)
        } else if (data.error === 'fpl_updating') {
          setLinkError(`FPL is updating right now. Try again in a moment.`)
        } else {
          setLinkError(data.message ?? 'Something went wrong. Please try again.')
        }
        return
      }
      setTeamSummary(data)
      setStep('confirm')
    } catch {
      setLinkError('Could not reach FPL. Check your connection and try again.')
    } finally {
      setIsLinkLoading(false)
    }
  }

  async function handleConfirm() {
    if (!teamSummary) return
    setIsConfirming(true)
    try {
      const res = await fetch('/api/team/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: teamSummary.teamId,
          teamName: teamSummary.teamName,
          managerName: teamSummary.managerName,
          country: teamSummary.country,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'already_linked') {
          setStep('already-linked')
          return
        }
        throw new Error(data.message ?? 'Failed to confirm team')
      }
      clearOnboardingState()
      router.push('/brief')
      router.refresh()
    } catch (err) {
      console.error('Confirm error:', err)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <OnboardingHeader onCancel={handleCancel} />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {step === 'find' && (
          <FindForm
            countries={countries}
            initialCountry={initialCountry}
            onSubmit={handleFindSubmit}
            onNoRank={() => { setFallbackReason('no_rank'); setStep('link') }}
          />
        )}

        {step === 'searching' && (
          <SearchingView
            searchState={searchState}
            country={country}
            onUseFplLink={() => { setFallbackReason('chosen'); setStep('link') }}
            onEdit={() => setStep('find')}
          />
        )}

        {step === 'link' && (
          <LinkFallback
            reason={fallbackReason}
            onSubmit={handleLinkSubmit}
            onTryAgain={() => { setFallbackReason(null); setStep('find') }}
            isLoading={isLinkLoading}
            error={linkError}
          />
        )}

        {step === 'confirm' && teamSummary && (
          <ConfirmView
            summary={teamSummary}
            onConfirm={handleConfirm}
            onNotMe={() => setStep('find')}
            isConfirming={isConfirming}
          />
        )}

        {step === 'already-linked' && (
          <AlreadyLinked onEnterDifferent={() => { setTeamSummary(null); setStep('find') }} />
        )}
      </main>

      <OnboardingFooter />
    </div>
  )
}
