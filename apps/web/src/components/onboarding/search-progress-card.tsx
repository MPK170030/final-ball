'use client'

import NumberFlow from '@number-flow/react'

interface SearchProgressCardProps {
  checked: number
  total: number
  page: number
  etaSeconds: number | null
  country: string
  showLinkHint: boolean
  onUseFplLink: () => void
}

export function SearchProgressCard({
  checked,
  total,
  page,
  etaSeconds,
  country,
  showLinkHint,
  onUseFplLink,
}: SearchProgressCardProps) {
  const pct = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0
  const eta = etaSeconds !== null ? `About ${etaSeconds} s left` : 'Estimating…'
  const statusText =
    page > 0
      ? `Scanning the ${country} league, page ${page.toLocaleString()}…`
      : `Starting search…`

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Team search progress"
      className="w-full max-w-sm flex flex-col gap-3.5 p-4 border border-border rounded-lg bg-card"
    >
      {/* Head */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-label text-muted-foreground uppercase tracking-widest">Searching</span>
        <span className="font-mono text-small text-muted-foreground">{eta}</span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% searched`}
        className="relative h-2 rounded-full bg-secondary overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* Shimmer overlay while searching */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite] motion-reduce:hidden"
          aria-hidden="true"
        />
      </div>

      {/* Numbers line */}
      <p className="font-mono text-[14px] leading-5 text-foreground m-0">
        Checked{' '}
        <NumberFlow
          value={checked}
          format={{ useGrouping: true }}
          aria-hidden="true"
        />{' '}
        of ~
        <NumberFlow
          value={total}
          format={{ useGrouping: true }}
          aria-hidden="true"
        />
        {' '}{country} managers
      </p>

      {/* Status line */}
      <p className="text-small text-muted-foreground m-0">{statusText}</p>

      {/* "Use my FPL link" — appears after 5 s (D9.3b) */}
      {showLinkHint && (
        <button
          type="button"
          onClick={onUseFplLink}
          className="self-start text-small font-semibold text-foreground underline underline-offset-2 hover:text-primary min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Use my FPL link instead
        </button>
      )}
    </div>
  )
}
