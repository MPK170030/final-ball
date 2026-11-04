'use client'

import { AlertTriangleIcon } from 'lucide-react'
import { FixtureChip } from './fixture-chip'
import { cn } from '@/lib/utils'
import type { TransferCardPayload, RiskTag } from './types'

type GwScore = {
  gwId: number
  fdr: number | null
  isDouble: boolean
  points: number
  opponents: { shortName: string; isHome: boolean }[]
}

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function formatMeta(elementType: number, cost: number, form: string, club?: string): string {
  const pos = POS[elementType] ?? '?'
  const price = `£${(cost / 10).toFixed(1)}m`
  const prefix = club ? `${club} · ` : ''
  return `${prefix}${pos} · ${price} · Form ${form}`
}

function altMeta(form: string, club?: string): string {
  return club ? `${club} · Form ${form}` : `Form ${form}`
}

function FixtureChips({ perGw, size = 'md' }: { perGw: GwScore[]; size?: 'sm' | 'md' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {perGw.map((gw) => (
        <FixtureChip
          key={gw.gwId}
          fdr={gw.fdr}
          isDouble={gw.isDouble}
          size={size}
          opponent={gw.opponents?.[0]?.shortName}
          isHome={gw.isDouble ? undefined : gw.opponents?.[0]?.isHome}
        />
      ))}
    </div>
  )
}

const RISK_TAG_STYLES: Record<RiskTag, string> = {
  safe: 'border border-foreground/40 text-foreground',
  balanced: 'bg-secondary text-foreground',
  bold: 'bg-foreground text-background',
}

function RiskTagBadge({ tag }: { tag: RiskTag }) {
  const label = tag === 'safe' ? 'Safe' : tag === 'bold' ? 'Bold' : 'Balanced'
  return (
    <span className={cn('inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold leading-none', RISK_TAG_STYLES[tag])}>
      {label}
    </span>
  )
}

function WhyLink({
  onClick,
  label = 'Why?',
  ariaLabel,
}: {
  onClick: (t: HTMLButtonElement) => void
  label?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => onClick(e.currentTarget)}
      aria-label={ariaLabel}
      className="inline-flex min-h-[44px] items-center border-0 bg-transparent p-0 text-[14px] font-semibold text-foreground underline underline-offset-[3px] hover:text-primary cursor-pointer focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {label}
    </button>
  )
}

interface TransferCardProps {
  payload: TransferCardPayload
  cardIndex: number
  totalCards: number
  bankTenths: number
  onWhyClick: (trigger: HTMLButtonElement) => void
  onCounterClick?: (trigger: HTMLButtonElement) => void
  counterDisabled?: boolean
  counterDisabledReason?: string
  isSelected?: boolean
}

export function TransferCard({
  payload,
  cardIndex,
  totalCards,
  bankTenths,
  onWhyClick,
  onCounterClick,
  counterDisabled = false,
  counterDisabledReason,
  isSelected = false,
}: TransferCardProps) {
  const label = totalCards > 1 ? `Transfer ${cardIndex + 1} of ${totalCards}` : 'Transfer'

  // ── Save variant ──────────────────────────────────────────────────────────────
  if (payload.save) {
    return (
      <article
        className={cn(
          'border-border bg-card rounded-[14px] border p-4 flex flex-col gap-[14px] md:p-6 md:gap-[18px]',
          isSelected && 'ring-2 ring-primary',
        )}
        aria-label="Save your transfer"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
            {label}
          </span>
          <span className="rounded-[6px] bg-secondary px-2 py-1 text-[12px] font-semibold text-foreground">
            No weak spot
          </span>
        </div>

        {/* Desktop 2-column / Mobile single column */}
        <div className="flex flex-col gap-3.5 md:grid md:grid-cols-2 md:gap-7">
          {/* Left: Save pick + reason + Why? */}
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5 rounded-[10px] border-[1.5px] border-primary bg-background p-3.5 md:p-4">
              <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
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
            <p className="text-[15px] leading-[22px] text-foreground">{payload.reason}</p>
            <div className="flex items-center gap-4 flex-wrap">
              <WhyLink onClick={onWhyClick} label="Why?" ariaLabel="Why save your transfer?" />
              {onCounterClick && (
                <button
                  type="button"
                  onClick={(e) => onCounterClick(e.currentTarget)}
                  disabled={counterDisabled}
                  title={counterDisabledReason}
                  aria-label="Counter this pick"
                  className="inline-flex min-h-[44px] items-center rounded-[8px] border border-border bg-transparent px-3 text-[14px] font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
                >
                  Counter this pick
                </button>
              )}
            </div>
          </div>

          {/* Right: Best available option */}
          {payload.bestOption && (
            <div className="flex flex-col gap-1 md:gap-2">
              {/* Mobile: divider + label */}
              <div className="h-px bg-border md:hidden" />
              <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
                Best transfer, if you&apos;d rather move
              </span>
              <span className="text-[16px] leading-[22px] font-semibold text-foreground">
                {payload.sellPlayer?.player.web_name
                  ? `${payload.sellPlayer.player.web_name} → ${payload.bestOption.player.web_name}`
                  : `→ ${payload.bestOption.player.web_name}`}
              </span>
              {(payload.sellPlayer?.clubShortName || payload.bestOption.clubShortName) && (
                <span className="text-[13px] leading-[18px] text-muted-foreground">
                  {payload.sellPlayer?.clubShortName
                    ? `${payload.sellPlayer.clubShortName} £${(payload.sellPlayer.sellingPrice / 10).toFixed(1)}m out`
                    : null}
                  {payload.sellPlayer?.clubShortName && payload.bestOption.clubShortName ? ' · ' : null}
                  {payload.bestOption.clubShortName
                    ? `${payload.bestOption.clubShortName} £${(payload.bestOption.player.now_cost / 10).toFixed(1)}m in`
                    : null}
                </span>
              )}
              <p className="text-[14px] leading-5 text-foreground">{payload.bestOption.reason}</p>
            </div>
          )}
        </div>

      </article>
    )
  }

  // ── Transfer variant ──────────────────────────────────────────────────────────
  const { sell, sellingPrice, topPick, topPickReason, topPickRiskTag, alternatives, whySell } = payload
  const bankAfter = bankTenths + sellingPrice - topPick.player.now_cost
  const bankAfterStr = `Bank after: ${bankAfter < 0 ? '−' : ''}£${(Math.abs(bankAfter) / 10).toFixed(1)}m`
  const flagText = sell.player.news ? sell.player.news.slice(0, 40) : null

  return (
    <article
      className={cn(
        'border-border bg-card rounded-[14px] border p-4 flex flex-col gap-[14px] md:p-6 md:gap-[18px]',
        isSelected && 'ring-2 ring-primary',
      )}
      aria-label={`Transfer: sell ${sell.player.web_name}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
          {label}
        </span>
        <span className="rounded-[6px] bg-secondary px-2 py-1 text-[12px] font-semibold text-foreground">
          Weak spot · {POS[sell.player.element_type] ?? '?'}
        </span>
      </div>

      {/* Why sell — bold title inline with reason */}
      <p className="text-[14px] leading-5 text-foreground md:text-[15px] md:leading-[22px]">
        <strong className="font-semibold">Why sell {sell.player.web_name}?</strong>
        {' '}{whySell}
      </p>

      {/* Desktop 2-column / Mobile single column */}
      <div className="flex flex-col gap-3.5 md:grid md:grid-cols-2 md:gap-7">

        {/* Left column: Out → Top pick → Reason → Why? */}
        <div className="flex flex-col gap-3.5">

          {/* Out section */}
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
              Out
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[16px] leading-[22px] font-semibold text-foreground">
                {sell.player.web_name}
              </span>
              {flagText && (
                <span className="shrink-0 flex items-center gap-1 text-[13px] font-semibold text-warning">
                  <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  {flagText}
                </span>
              )}
            </div>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {formatMeta(sell.player.element_type, sellingPrice, sell.player.form, sell.clubShortName)}
            </p>
            <FixtureChips perGw={sell.score.perGw} />
          </div>

          {/* Top pick emphasis block */}
          <div className="flex flex-col gap-1.5 rounded-[10px] border-[1.5px] border-primary bg-background p-3.5 md:p-4">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
                Top pick · In
              </span>
              {topPickRiskTag && <RiskTagBadge tag={topPickRiskTag} />}
            </div>
            <span className="text-[22px] leading-7 font-semibold text-foreground md:text-[26px] md:leading-8">
              {topPick.player.web_name}
            </span>
            <p className="text-[13px] leading-[18px] text-muted-foreground">
              {formatMeta(
                topPick.player.element_type,
                topPick.player.now_cost,
                topPick.player.form,
                topPick.clubShortName,
              )}
            </p>
            <FixtureChips perGw={topPick.score.perGw} />
            <span className="font-mono text-[13px] leading-[18px] text-muted-foreground tabular-nums">
              {bankAfterStr}
            </span>
          </div>

          {topPickReason && (
            <p className="text-[15px] leading-[22px] text-foreground">{topPickReason}</p>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <WhyLink
              onClick={onWhyClick}
              label="Why?"
              ariaLabel={`Why ${topPick.player.web_name}?`}
            />
            {onCounterClick && (
              <button
                type="button"
                onClick={(e) => onCounterClick(e.currentTarget)}
                disabled={counterDisabled}
                title={counterDisabledReason}
                aria-label={`Counter the ${topPick.player.web_name} pick`}
                className="inline-flex min-h-[44px] items-center rounded-[8px] border border-border bg-transparent px-3 text-[14px] font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer transition-colors"
              >
                Counter this pick
              </button>
            )}
          </div>
        </div>

        {/* Right column: Alternatives */}
        {alternatives.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* Divider — mobile only */}
            <div className="h-px bg-border md:hidden" />
            <span className="text-[12px] font-semibold leading-4 tracking-[0.06em] uppercase text-muted-foreground">
              {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
            </span>
            {alternatives.map((alt, i) => (
              <div
                key={alt.candidate.player.id}
                className={cn(
                  'flex gap-3',
                  // Mobile: bottom-border divider
                  i < alternatives.length - 1 && 'pb-3 border-b border-border/60',
                  // Desktop: bordered card box
                  'md:pb-0 md:border-b-0 md:border md:border-border md:rounded-[10px] md:p-3',
                )}
              >
                <span className="shrink-0 h-7 w-7 rounded-full border border-input font-mono text-[13px] text-center leading-[26px] text-muted-foreground tabular-nums">
                  {i + 2}
                </span>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[15px] leading-[22px] font-semibold text-foreground">
                        {alt.candidate.player.web_name}
                      </span>
                      {alt.riskTag && <RiskTagBadge tag={alt.riskTag} />}
                    </div>
                    <span className="shrink-0 font-mono text-[13px] text-muted-foreground tabular-nums">
                      £{(alt.candidate.player.now_cost / 10).toFixed(1)}m
                    </span>
                  </div>
                  <p className="text-[13px] leading-[18px] text-muted-foreground">
                    {altMeta(alt.candidate.player.form, alt.candidate.clubShortName)}
                  </p>
                  {alt.reason && (
                    <p className="text-[14px] leading-5 text-foreground">{alt.reason}</p>
                  )}
                  {alt.candidate.score.perGw.length > 0 && (
                    <FixtureChips perGw={alt.candidate.score.perGw} size="sm" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </article>
  )
}
