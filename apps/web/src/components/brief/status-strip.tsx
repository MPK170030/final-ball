'use client'

import dynamic from 'next/dynamic'
import { RefreshCwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const Countdown = dynamic(
  () => import('@/app/brief/countdown').then(m => ({ default: m.Countdown })),
  { ssr: false },
)

const REFRESH_CAP = 3

interface StatusStripProps {
  gameweek: number
  teamName: string
  generatedAt?: string
  refreshesThisGw: number
  onRefresh: () => void
  refreshing: boolean
  deadlineMs: number | null
  isDeadlinePassed: boolean
  freeTransfers: number
  bankTenths: number
  countersLeft: number
  counterCap: number
}

function formatGeneratedAt(ts: string): string {
  try {
    const d = new Date(ts)
    const day = d.toLocaleString('en-GB', { day: 'numeric' })
    const month = d.toLocaleString('en-GB', { month: 'short' })
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    return `${day} ${month}, ${time}`
  } catch {
    return ''
  }
}

export function StatusStrip({
  gameweek,
  teamName,
  generatedAt,
  refreshesThisGw,
  onRefresh,
  refreshing,
  deadlineMs,
  isDeadlinePassed,
  freeTransfers,
  bankTenths,
  countersLeft,
  counterCap,
}: StatusStripProps) {
  const refreshesLeft = REFRESH_CAP - refreshesThisGw
  const canRefresh = refreshesLeft > 0 && !refreshing

  const refreshAriaLabel = canRefresh
    ? `Refresh brief (${refreshesLeft} left this gameweek)`
    : refreshing
      ? 'Refreshing…'
      : 'No refreshes left this gameweek'

  const DeadlineValue = isDeadlinePassed ? (
    <span className="font-mono font-semibold text-primary">Passed</span>
  ) : deadlineMs ? (
    <Countdown deadlineMs={deadlineMs} className="text-primary font-semibold" />
  ) : null

  const refreshBtn = (extraClass: string) => (
    <button
      type="button"
      onClick={onRefresh}
      disabled={!canRefresh}
      aria-label={refreshAriaLabel}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-border bg-transparent px-3 text-[13px] text-foreground transition-colors',
        canRefresh ? 'hover:bg-secondary' : 'cursor-not-allowed opacity-50',
        extraClass,
      )}
    >
      <RefreshCwIcon
        className={cn('size-3.5', refreshing && 'animate-spin')}
        aria-hidden="true"
      />
      Refresh brief
    </button>
  )

  return (
    <>
      {/* ── Mobile (<768px) ── stacked: title+icon / scrollable tiles */}
      <div className="flex flex-col gap-[10px] py-4 md:hidden">
        <div className="flex items-start justify-between gap-[10px]">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
              GW{gameweek} brief
            </h1>
            <span className="text-[14px] text-muted-foreground">{teamName}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={!canRefresh}
            aria-label={refreshAriaLabel}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-border bg-transparent text-foreground transition-colors',
              canRefresh ? 'hover:bg-secondary' : 'cursor-not-allowed opacity-50',
            )}
          >
            <RefreshCwIcon
              className={cn('size-4', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
        </div>

        <dl className="-mx-4 flex gap-2 overflow-x-auto px-4 text-[12px]" style={{ scrollbarWidth: 'none' }}>
          {isDeadlinePassed ? (
            <div className="flex flex-none flex-col gap-0.5 rounded-[10px] border border-primary px-[10px] py-2">
              <dt className="text-muted-foreground">Deadline</dt>
              <dd className="m-0 font-mono font-semibold tabular-nums text-primary">Passed</dd>
            </div>
          ) : deadlineMs ? (
            <div className="flex flex-none flex-col gap-0.5 rounded-[10px] border border-primary px-[10px] py-2">
              <dt className="text-muted-foreground">Deadline</dt>
              <dd className="m-0"><Countdown deadlineMs={deadlineMs} className="text-primary font-semibold" /></dd>
            </div>
          ) : null}
          <div className="flex flex-none flex-col gap-0.5 rounded-[10px] bg-card px-[10px] py-2">
            <dt className="text-muted-foreground">Free transfers</dt>
            <dd className="m-0 font-mono tabular-nums">{freeTransfers}</dd>
          </div>
          <div className="flex flex-none flex-col gap-0.5 rounded-[10px] bg-card px-[10px] py-2">
            <dt className="text-muted-foreground">Bank</dt>
            <dd className="m-0 font-mono tabular-nums">&pound;{(bankTenths / 10).toFixed(1)}m</dd>
          </div>
          <div className="flex flex-none flex-col gap-0.5 rounded-[10px] bg-card px-[10px] py-2">
            <dt className="text-muted-foreground">Counters</dt>
            <dd className="m-0 font-mono tabular-nums">{countersLeft}&nbsp;/&nbsp;{counterCap}</dd>
          </div>
        </dl>
      </div>

      {/* ── Desktop (≥768px) ── ONE row: left · middle dl · right */}
      <div className="hidden md:flex items-center justify-between gap-4 flex-wrap py-[18px]">
        {/* Left: title + team on baseline */}
        <div className="flex items-baseline gap-[18px] flex-wrap">
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.02em] text-foreground">
            GW{gameweek} brief
          </h1>
          <span className="text-[15px] font-medium text-muted-foreground">{teamName}</span>
        </div>

        {/* Middle: inline dt/dd pairs — no boxes */}
        <dl className="flex items-center gap-[22px] flex-wrap text-[13px]" style={{ margin: 0 }}>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Deadline</dt>
            <dd className="m-0" role={deadlineMs ? 'timer' : undefined} aria-live={deadlineMs ? 'off' : undefined}>
              {DeadlineValue}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Free transfers</dt>
            <dd className="m-0 font-mono">{freeTransfers}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Bank</dt>
            <dd className="m-0 font-mono">&pound;{(bankTenths / 10).toFixed(1)}m</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Counters</dt>
            <dd className="m-0 font-mono">{countersLeft}&nbsp;/&nbsp;{counterCap}&nbsp;left</dd>
          </div>
        </dl>

        {/* Right: generated timestamp + refresh button */}
        <div className="flex items-center gap-3 shrink-0">
          {generatedAt && (
            <span className="text-[12px] text-muted-foreground">
              Generated {formatGeneratedAt(generatedAt)}
            </span>
          )}
          {refreshBtn('')}
        </div>
      </div>
    </>
  )
}
