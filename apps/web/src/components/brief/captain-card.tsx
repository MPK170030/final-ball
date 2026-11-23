'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { CaptainCardPayload, CaptainPickWithMeta, RiskTag, NewsFlag } from './types'

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function playerMeta(pick: CaptainPickWithMeta): string {
  if (pick.clubShortName && pick.nextFixture) {
    const ha = pick.nextFixture.isHome ? 'H' : 'A'
    return `${pick.clubShortName} · vs ${pick.nextFixture.opponent} (${ha})`
  }
  return `${POS[pick.player.element_type] ?? '?'} · £${(pick.player.now_cost / 10).toFixed(1)}m`
}

const RISK_TAG_TITLES: Record<RiskTag, string> = {
  safe: 'Safe: high floor',
  balanced: 'Balanced: highest expected points',
  bold: 'Bold: high ceiling',
}

function RiskTagBadge({ tag }: { tag: RiskTag }) {
  const label = tag === 'safe' ? 'Safe' : tag === 'bold' ? 'Bold' : 'Balanced'
  return (
    <span
      title={RISK_TAG_TITLES[tag]}
      className="inline-flex items-center h-5 px-1.5 border border-[#6B6B6B] rounded-[6px] text-[11px] text-foreground leading-none shrink-0"
    >
      {label}
    </span>
  )
}

function CaptainBadge({ type }: { type: 'C' | 'V' }) {
  return (
    <span
      className={cn(
        'shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-semibold',
        type === 'C'
          ? 'bg-primary text-primary-foreground'
          : 'border-[1.5px] border-foreground text-foreground',
      )}
      aria-label={type === 'C' ? 'Captain' : 'Vice-captain'}
    >
      {type}
    </span>
  )
}

function NewsBanner({
  flags,
  onCounterClick,
  counterDisabled,
}: {
  flags: NewsFlag[]
  onCounterClick?: (trigger: HTMLButtonElement) => void
  counterDisabled?: boolean
}) {
  return (
    <div className="rounded-[10px] border border-warning px-[12px] py-3 flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <p className="text-[14px] leading-[1.45]">
          <span className="font-semibold text-warning">News: </span>
          {flags.map((f, i) => (
            <span key={f.playerName}>
              {i > 0 && ' · '}
              <span className="font-medium">{f.playerName}</span> — {f.news}
            </span>
          ))}
        </p>
      </div>
      {onCounterClick && (
        <button
          type="button"
          onClick={(e) => onCounterClick(e.currentTarget)}
          disabled={counterDisabled}
          className="self-start inline-flex min-h-[40px] items-center rounded-[6px] border border-border bg-transparent px-3 text-[13px] font-medium text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Counter to re-check
        </button>
      )}
    </div>
  )
}

function CaptainTile({
  pick,
  type,
}: {
  pick: CaptainPickWithMeta
  type: 'C' | 'V'
}) {
  const gwXp = pick.gw_xp ?? null
  const isC = type === 'C'

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[10px] bg-background p-[14px]',
        isC ? 'border-[1.5px] border-primary' : 'border border-secondary',
      )}
    >
      {/* Header row: badge + name+meta col + xP */}
      <div className="flex items-center gap-3">
        <CaptainBadge type={type} />
        <div className="flex flex-1 min-w-0 flex-col gap-px">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[17px] font-semibold leading-[1.3] text-foreground">
              {pick.player.web_name}
            </span>
            {pick.riskTag && <RiskTagBadge tag={pick.riskTag} />}
          </div>
          <span className="text-[12px] text-muted-foreground">
            {playerMeta(pick)}
          </span>
        </div>
        {gwXp != null ? (
          <span className="font-mono text-[17px] font-semibold tabular-nums shrink-0">
            {gwXp.toFixed(1)}
          </span>
        ) : (
          <span className="font-mono text-[17px] font-semibold tabular-nums shrink-0 text-muted-foreground">
            –
          </span>
        )}
      </div>
      {/* Reason */}
      <p className="m-0 text-[14px] leading-[1.55] text-[#D6D6D6]">{pick.reason}</p>
    </div>
  )
}

interface CaptainCardProps {
  payload: CaptainCardPayload
  onCounterClick?: (trigger: HTMLButtonElement) => void
  counterDisabled?: boolean
  counterDisabledReason?: string
  onTraceClick?: (trigger: HTMLButtonElement) => void
  isSelected?: boolean
  newsFlags?: NewsFlag[]
}

export function CaptainCard({
  payload,
  onCounterClick,
  counterDisabled = false,
  counterDisabledReason,
  onTraceClick,
  isSelected = false,
  newsFlags,
}: CaptainCardProps) {
  const { captain, vc, alternatives } = payload
  const [expandedAlt, setExpandedAlt] = useState<number | null>(null)

  return (
    <article
      className={cn(
        'border-border bg-card rounded-[14px] border p-[14px] flex flex-col gap-[12px] md:p-6 md:gap-4',
        isSelected && 'border-[#A3A3A3]',
      )}
      aria-label={`Captain: ${captain.player.web_name}`}
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12px] font-semibold leading-4 tracking-[0.08em] uppercase text-muted-foreground">
          Captain
        </span>
        {/* Action buttons — desktop only */}
        <div className="hidden md:flex items-center gap-2">
          {onCounterClick && (
            <button
              type="button"
              onClick={(e) => onCounterClick(e.currentTarget)}
              disabled={counterDisabled}
              title={counterDisabledReason}
              aria-label="Counter this pick"
              className="inline-flex h-9 items-center rounded-[6px] border border-border bg-transparent px-3 text-[13px] font-medium text-foreground hover:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              Counter this pick
            </button>
          )}
          {onTraceClick && (
            <button
              type="button"
              onClick={(e) => onTraceClick(e.currentTarget)}
              aria-label="View agent trace"
              className="inline-flex h-9 items-center rounded-[6px] border border-border bg-transparent px-3 text-[13px] font-medium text-foreground hover:border-muted-foreground transition-colors"
            >
              Trace
            </button>
          )}
        </div>
      </div>

      {newsFlags && newsFlags.length > 0 && (
        <NewsBanner flags={newsFlags} onCounterClick={onCounterClick} counterDisabled={counterDisabled} />
      )}

      {/* Captain + VC — 2-col on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <CaptainTile pick={captain} type="C" />
        <CaptainTile pick={vc} type="V" />
      </div>

      {/* Alternatives — folded by default */}
      {alternatives.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground pt-1">
            {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
          </span>
          <div className="flex flex-col gap-1.5">
            {alternatives.map((alt, i) => {
              const isOpen = expandedAlt === i
              const altGwXp = alt.gw_xp ?? (alt.player.ep_next ? parseFloat(alt.player.ep_next) : null)
              return (
                <div
                  key={alt.player.id}
                  className={cn(
                    'rounded-[10px] transition-all',
                    isOpen ? 'bg-[#2F2F2F] outline outline-1 outline-[#6B6B6B]' : 'bg-[#232323]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedAlt(prev => prev === i ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full grid grid-cols-[22px_1fr_84px_48px_20px] gap-3 items-center px-[10px] min-h-[48px] bg-transparent border-0 text-foreground text-left cursor-pointer"
                  >
                    <span className="font-mono text-[12px] text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[15px] font-medium leading-[1.2] truncate">{alt.player.web_name}</span>
                      <span className="text-[12px] text-muted-foreground">{playerMeta(alt)}</span>
                    </div>
                    <div className="justify-self-end">
                      {alt.riskTag && <RiskTagBadge tag={alt.riskTag} />}
                    </div>
                    {altGwXp != null ? (
                      <span className="font-mono text-[14px] tabular-nums text-right">{altGwXp.toFixed(1)}</span>
                    ) : (
                      <span className="font-mono text-[14px] tabular-nums text-right text-muted-foreground">–</span>
                    )}
                    <span className="text-muted-foreground text-[18px] text-center" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && alt.reason && (
                    <p className="pl-[46px] pb-3.5 m-0 text-sm leading-[1.55] text-muted-foreground">
                      {alt.reason}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mobile: Counter + Trace buttons (full-width pair) */}
      <div className="flex gap-2 md:hidden">
        {onCounterClick && (
          <button
            type="button"
            onClick={(e) => onCounterClick(e.currentTarget)}
            disabled={counterDisabled}
            title={counterDisabledReason}
            className="flex-1 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-border bg-transparent text-[14px] font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            Counter this pick
          </button>
        )}
        {onTraceClick && (
          <button
            type="button"
            onClick={(e) => onTraceClick(e.currentTarget)}
            className="flex-1 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-border bg-transparent text-[14px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Trace
          </button>
        )}
      </div>
    </article>
  )
}
