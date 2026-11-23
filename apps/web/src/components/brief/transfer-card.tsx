'use client'

import { useState } from 'react'
import { FixtureChip } from './fixture-chip'
import { Shirt } from './shirt'
import { cn } from '@/lib/utils'
import type { TransferCardPayload, PlayerScoreWithClub, RiskTag, NewsFlag } from './types'

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => onCounterClick(e.currentTarget)}
            disabled={counterDisabled}
            className="inline-flex min-h-[40px] items-center rounded-[6px] border border-border bg-transparent px-3 text-[13px] text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Counter to re-check
          </button>
        </div>
      )}
    </div>
  )
}

function WeakestBars({ context }: { context: PlayerScoreWithClub[] }) {
  const items = context.slice(0, 3)
  const maxRankScore = Math.max(...items.map(ws => ws.rankScore), 0.001)
  return (
    <div className="flex flex-col gap-2 rounded-[10px] bg-background p-[12px]">
      <span className="text-[12px] text-muted-foreground">Weakest 3 in your squad · xP per £m over 3 GWs</span>
      {items.map((ws, idx) => {
        const pct = Math.round((ws.rankScore / maxRankScore) * 100)
        return (
          <div key={ws.player.id} className="grid grid-cols-[76px_1fr_34px] items-center gap-[10px] text-[13px]">
            <span className={cn('truncate', idx === 0 ? 'text-warning' : 'text-foreground')}>
              {ws.player.web_name}
            </span>
            <span className="rounded-[4px] bg-card overflow-hidden">
              <span
                className={cn('block h-2 rounded-[4px]', idx === 0 ? 'bg-warning' : 'bg-[#5E5E5E]')}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="font-mono text-right tabular-nums">{ws.rankScore.toFixed(2)}</span>
          </div>
        )
      })}
    </div>
  )
}

interface TransferCardProps {
  payload: TransferCardPayload
  cardIndex: number
  totalCards: number
  onCounterClick?: (trigger: HTMLButtonElement) => void
  counterDisabled?: boolean
  counterDisabledReason?: string
  onTraceClick?: (trigger: HTMLButtonElement) => void
  isSelected?: boolean
  newsFlags?: NewsFlag[]
}

export function TransferCard({
  payload,
  cardIndex,
  totalCards,
  onCounterClick,
  counterDisabled = false,
  counterDisabledReason,
  onTraceClick,
  isSelected = false,
  newsFlags,
}: TransferCardProps) {
  const label = totalCards > 1 ? `Transfer ${cardIndex + 1} of ${totalCards}` : 'Transfer'

  // ── Save variant ──────────────────────────────────────────────────────────────
  if (payload.save) {
    return (
      <article
        className={cn(
          'border-border bg-card rounded-[14px] border p-[14px] flex flex-col gap-[12px] md:p-6 md:gap-4',
          isSelected && 'border-[#A3A3A3]',
        )}
        aria-label="Save your transfer"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[12px] font-semibold leading-4 tracking-[0.08em] uppercase text-muted-foreground">
            {label} · No weak spot
          </span>
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

        {/* Save pick block */}
        <div className="flex flex-col gap-1.5 rounded-[10px] border-[1.5px] border-primary bg-background p-[14px]">
          <span className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">
            Agent&apos;s pick
          </span>
          <span className="text-[22px] leading-7 font-semibold text-foreground">
            Save your transfer
          </span>
          {payload.freeTransfersNextGw != null && payload.nextGw != null && (
            <span className="font-mono text-[13px] leading-[18px] text-muted-foreground tabular-nums">
              You&apos;ll have {payload.freeTransfersNextGw} free transfer{payload.freeTransfersNextGw !== 1 ? 's' : ''} in GW {payload.nextGw}
            </span>
          )}
        </div>

        <p className="text-[14px] leading-[1.55] text-[#D6D6D6]">{payload.reason}</p>

        {payload.bestOption && (
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <span className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
              Best transfer, if you&apos;d rather move
            </span>
            <span className="text-[16px] leading-[22px] font-semibold text-foreground">
              {payload.sellPlayer?.player.web_name
                ? `${payload.sellPlayer.player.web_name} → ${payload.bestOption.player.web_name}`
                : `→ ${payload.bestOption.player.web_name}`}
            </span>
            <p className="text-[14px] leading-5 text-[#D6D6D6]">{payload.bestOption.reason}</p>
          </div>
        )}

        {/* Mobile counter + trace */}
        <div className="flex gap-2 md:hidden">
          {onCounterClick && (
            <button
              type="button"
              onClick={(e) => onCounterClick(e.currentTarget)}
              disabled={counterDisabled}
              title={counterDisabledReason}
              className="flex-1 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-border bg-transparent text-[13px] font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              Counter this pick
            </button>
          )}
          {onTraceClick && (
            <button
              type="button"
              onClick={(e) => onTraceClick(e.currentTarget)}
              className="flex-1 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-border bg-transparent text-[13px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              Trace
            </button>
          )}
        </div>
      </article>
    )
  }

  // ── Transfer variant ──────────────────────────────────────────────────────────
  return <TransferVariant
    payload={payload}
    label={label}
    onCounterClick={onCounterClick}
    counterDisabled={counterDisabled}
    counterDisabledReason={counterDisabledReason}
    onTraceClick={onTraceClick}
    isSelected={isSelected}
    newsFlags={newsFlags}
  />
}

function TransferVariant({
  payload,
  label,
  onCounterClick,
  counterDisabled,
  counterDisabledReason,
  onTraceClick,
  isSelected,
  newsFlags,
}: {
  payload: Extract<TransferCardPayload, { save: false }>
  label: string
  onCounterClick?: (trigger: HTMLButtonElement) => void
  counterDisabled: boolean
  counterDisabledReason?: string
  onTraceClick?: (trigger: HTMLButtonElement) => void
  isSelected: boolean
  newsFlags?: NewsFlag[]
}) {
  const [expandedAlt, setExpandedAlt] = useState<number | null>(null)

  const { sell, sellingPrice, topPick, topPickReason, topPickRiskTag, alternatives, whySell, whySellContext } = payload

  return (
    <article
      id={`transfer-card-${payload.sell.player.id}`}
      className={cn(
        'border-border bg-card rounded-[14px] border p-[14px] flex flex-col gap-[12px] md:p-6 md:gap-4',
        isSelected && 'border-[#A3A3A3]',
      )}
      aria-label={`Transfer: sell ${sell.player.web_name}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12px] font-semibold leading-4 tracking-[0.08em] uppercase text-muted-foreground">
          {label} · Weak spot: {POS[sell.player.element_type] ?? '?'}
        </span>
        <div className="hidden md:flex items-center gap-2">
          {onCounterClick && (
            <button
              type="button"
              onClick={(e) => onCounterClick(e.currentTarget)}
              disabled={counterDisabled}
              title={counterDisabledReason}
              aria-label={`Counter the ${topPick.player.web_name} pick`}
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

      {/* Sell → Pick tile grid */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-[6px] md:gap-[14px] items-stretch">
        {/* Sell tile */}
        <div className="flex items-center gap-3.5 rounded-[10px] border border-secondary bg-background p-[10px]">
          <Shirt club={sell.clubShortName ?? '???'} isGk={sell.player.element_type === 1} size={36} />
          <div className="flex flex-1 min-w-0 flex-col gap-0.5">
            <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.06em]">Sell</span>
            <span className="text-[20px] font-semibold leading-[1.2] text-foreground truncate">
              {sell.player.web_name}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {sell.clubShortName && `${sell.clubShortName} · `}
              {POS[sell.player.element_type] ?? '?'} · £{(sellingPrice / 10).toFixed(1)}m ·{' '}
              <span className="font-mono">{sell.score.total.toFixed(1)} xP</span>
            </span>
            {sell.score.perGw.length > 0 && (
              <div className="flex gap-1 mt-1">
                {sell.score.perGw.slice(0, 3).map((gw) => (
                  <FixtureChip
                    key={gw.gwId}
                    fdr={gw.fdr}
                    opponent={gw.opponents?.[0]?.shortName}
                    isHome={gw.opponents?.[0]?.isHome}
                    size="sm"
                    title={gw.opponents?.[0] ? `${gw.opponents[0].shortName}, ${gw.opponents[0].isHome ? 'home' : 'away'} · difficulty ${gw.fdr} of 5` : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center text-muted-foreground" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Pick tile */}
        <div className="flex items-center gap-3.5 rounded-[10px] border-[1.5px] border-primary bg-background p-[10px]">
          <Shirt club={topPick.clubShortName ?? '???'} isGk={topPick.player.element_type === 1} size={36} />
          <div className="flex flex-1 min-w-0 flex-col gap-0.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.06em]">Top Pick</span>
              {topPickRiskTag && <RiskTagBadge tag={topPickRiskTag} />}
            </div>
            <span className="text-[20px] font-semibold leading-[1.2] text-foreground truncate">
              {topPick.player.web_name}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {topPick.clubShortName && `${topPick.clubShortName} · `}
              {POS[topPick.player.element_type] ?? '?'} · £{(topPick.player.now_cost / 10).toFixed(1)}m ·{' '}
              <span className="font-mono font-semibold text-foreground">{topPick.score.total.toFixed(1)} xP</span>
            </span>
            {topPick.score.perGw.length > 0 && (
              <div className="flex gap-1 mt-1">
                {topPick.score.perGw.slice(0, 3).map((gw) => (
                  <FixtureChip
                    key={gw.gwId}
                    fdr={gw.fdr}
                    opponent={gw.opponents?.[0]?.shortName}
                    isHome={gw.opponents?.[0]?.isHome}
                    size="sm"
                    title={gw.opponents?.[0] ? `${gw.opponents[0].shortName}, ${gw.opponents[0].isHome ? 'home' : 'away'} · difficulty ${gw.fdr} of 5` : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline reasoning */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {/* Left: Why sell + Weakest-3 bars */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0 text-[15px] font-semibold text-foreground">Why sell {sell.player.web_name}?</h3>
            <p className="m-0 text-[14px] leading-[1.55] text-[#D6D6D6]">{whySell}</p>
          </div>
          {whySellContext.length > 0 && (
            <WeakestBars context={whySellContext} />
          )}
        </div>

        {/* Right: Why pick */}
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-[15px] font-semibold text-foreground">Why {topPick.player.web_name}?</h3>
          {topPickReason && (
            <p className="m-0 text-[14px] leading-[1.55] text-[#D6D6D6]">{topPickReason}</p>
          )}
        </div>
      </div>

      {/* Folded alternatives */}
      {alternatives.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground pt-1">
            {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
          </span>
          <div className="flex flex-col gap-1.5">
            {alternatives.map((alt, i) => {
              const isOpen = expandedAlt === i
              return (
                <div
                  key={alt.candidate.player.id}
                  className={cn(
                    'rounded-[10px] transition-all',
                    isOpen ? 'bg-[#2F2F2F] outline outline-1 outline-[#6B6B6B]' : 'bg-[#232323]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedAlt(prev => prev === i ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full grid grid-cols-[22px_1fr_84px_48px_auto_20px] gap-3 items-center px-[10px] min-h-[48px] bg-transparent border-0 text-foreground text-left cursor-pointer"
                  >
                    <span className="font-mono text-[12px] text-muted-foreground tabular-nums">{i + 1}</span>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[15px] font-medium leading-[1.2] truncate">{alt.candidate.player.web_name}</span>
                      <span className="text-[12px] text-muted-foreground">
                        {alt.candidate.clubShortName && `${alt.candidate.clubShortName} · `}
                        {POS[alt.candidate.player.element_type] ?? '?'} · £{(alt.candidate.player.now_cost / 10).toFixed(1)}m
                      </span>
                    </div>
                    <div className="justify-self-end">
                      {alt.riskTag && <RiskTagBadge tag={alt.riskTag} />}
                    </div>
                    <span className="font-mono text-[14px] tabular-nums text-right">{alt.candidate.score.total.toFixed(1)}</span>
                    <div className="flex gap-1">
                      {alt.candidate.score.perGw.slice(0, 3).map((gw) => (
                        <FixtureChip
                          key={gw.gwId}
                          fdr={gw.fdr}
                          opponent={gw.opponents?.[0]?.shortName}
                          isHome={gw.opponents?.[0]?.isHome}
                          size="sm"
                          title={gw.opponents?.[0] ? `${gw.opponents[0].shortName}, ${gw.opponents[0].isHome ? 'home' : 'away'} · difficulty ${gw.fdr} of 5` : undefined}
                        />
                      ))}
                    </div>
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

      {/* Mobile: Counter + Trace buttons */}
      <div className="flex gap-2 md:hidden">
        {onCounterClick && (
          <button
            type="button"
            onClick={(e) => onCounterClick(e.currentTarget)}
            disabled={counterDisabled}
            title={counterDisabledReason}
            className="flex-1 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-border bg-transparent text-[13px] font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            Counter this pick
          </button>
        )}
        {onTraceClick && (
          <button
            type="button"
            onClick={(e) => onTraceClick(e.currentTarget)}
            className="flex-1 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-border bg-transparent text-[13px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Trace
          </button>
        )}
      </div>
    </article>
  )
}
