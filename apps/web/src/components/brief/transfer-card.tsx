'use client'

import { AlertTriangleIcon } from 'lucide-react'
import { FixtureChip } from './fixture-chip'
import { cn } from '@/lib/utils'
import type { TransferCardPayload } from './types'

type GwScore = { gwId: number; fdr: number | null; isDouble: boolean; points: number }

const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

function formatMeta(
  elementType: number,
  cost: number,
  form: string,
  epNext: string | null,
): string {
  const pos = POS[elementType] ?? '?'
  const price = `£${(cost / 10).toFixed(1)}m`
  const f = `Form ${form}`
  const ep = epNext ? `ep ${epNext}` : null
  return [pos, price, f, ep].filter(Boolean).join(' · ')
}

interface FixtureChipsProps {
  perGw: GwScore[]
  size?: 'sm' | 'md'
}

function FixtureChips({ perGw, size = 'md' }: FixtureChipsProps) {
  return (
    <div className="flex gap-1">
      {perGw.map((gw) => (
        <FixtureChip key={gw.gwId} fdr={gw.fdr} isDouble={gw.isDouble} size={size} />
      ))}
    </div>
  )
}

interface TransferCardProps {
  payload: TransferCardPayload
  cardIndex: number
  totalCards: number
  bankTenths: number
  onWhyClick: (trigger: HTMLButtonElement) => void
  onTraceClick: (trigger: HTMLButtonElement) => void
  isSelected?: boolean
}

export function TransferCard({
  payload,
  cardIndex,
  totalCards,
  bankTenths,
  onWhyClick,
  onTraceClick,
  isSelected = false,
}: TransferCardProps) {
  const label =
    totalCards > 1 ? `Transfer ${cardIndex + 1} of ${totalCards}` : 'Transfer'

  // ── Save variant ─────────────────────────────────────────────────────────────
  if (payload.save) {
    return (
      <article
        className={cn(
          'border-border bg-card rounded-lg border',
          isSelected && 'ring-2 ring-primary',
        )}
        aria-label="Save your transfer"
      >
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <span className="text-label uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
        </div>

        {/* Save emphasis block */}
        <div className="border-border border-b px-4 py-4">
          <div className="border-primary rounded-md border bg-primary/5 px-4 py-3">
            <p className="text-label mb-1 uppercase tracking-widest text-primary">
              Save your transfer
            </p>
            <p className="text-body text-foreground">{payload.reason}</p>
          </div>
        </div>

        {/* Best option for comparison */}
        {payload.bestOption && (
          <div className="px-4 py-3">
            <p className="text-small mb-1 text-muted-foreground">Best available option:</p>
            <p className="text-body-strong text-foreground">{payload.bestOption.player.web_name}</p>
            <p className="text-small mt-0.5 text-muted-foreground">{payload.bestOption.reason}</p>
          </div>
        )}

        <div className="border-border border-t px-4 py-3">
          <button
            onClick={(e) => onTraceClick(e.currentTarget)}
            className="min-h-[44px] px-0 text-small text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            How the agent decided
          </button>
        </div>
      </article>
    )
  }

  // ── Transfer variant ──────────────────────────────────────────────────────────
  const { sell, sellingPrice, topPick, topPickReason, alternatives, whySell, replans } = payload
  const bankAfter = bankTenths + sellingPrice - topPick.player.now_cost
  const bankAfterStr = `${bankAfter >= 0 ? '+' : ''}£${(bankAfter / 10).toFixed(1)}m bank`
  const isInjured =
    sell.player.chance_of_playing_next_round !== null &&
    sell.player.chance_of_playing_next_round < 100

  return (
    <article
      className={cn(
        'border-border bg-card rounded-lg border',
        isSelected && 'ring-2 ring-primary',
      )}
      aria-label={`Transfer: sell ${sell.player.web_name}`}
    >
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <span className="text-label uppercase tracking-widest text-muted-foreground">{label}</span>
        {sell.player.news ? (
          <span className="text-small flex items-center gap-1 text-warning">
            <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
            {sell.player.news.slice(0, 40)}
          </span>
        ) : null}
      </div>

      {/* Why sell */}
      <div className="border-border border-b px-4 py-3">
        <p className="text-small font-semibold text-foreground">
          Why sell {sell.player.web_name}?
        </p>
        <p className="text-small mt-0.5 text-muted-foreground">{whySell}</p>
      </div>

      {/* Out row */}
      <div className="border-border border-b px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isInjured && (
                <AlertTriangleIcon
                  className="size-3.5 shrink-0 text-warning"
                  aria-label="Injury doubt"
                />
              )}
              <span className="text-body-strong text-foreground">{sell.player.web_name}</span>
              <span className="text-label rounded-sm bg-secondary px-1 py-0.5 text-muted-foreground">
                OUT
              </span>
            </div>
            <p className="text-small mt-0.5 text-muted-foreground">
              {formatMeta(
                sell.player.element_type,
                sellingPrice,
                sell.player.form,
                sell.player.ep_next,
              )}
            </p>
          </div>
          <FixtureChips perGw={sell.score.perGw} />
        </div>
      </div>

      {/* Top pick block */}
      <div className="border-primary/60 border-b mx-4 my-4 rounded-md border bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-label uppercase tracking-widest text-primary">Top pick · In</span>
          <span className="text-number font-mono text-muted-foreground">{bankAfterStr}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-heading text-foreground">{topPick.player.web_name}</p>
            <p className="text-small mt-0.5 text-muted-foreground">
              {formatMeta(
                topPick.player.element_type,
                topPick.player.now_cost,
                topPick.player.form,
                topPick.player.ep_next,
              )}
            </p>
          </div>
          <FixtureChips perGw={topPick.score.perGw} />
        </div>
        {topPickReason && (
          <p className="text-small mt-2 text-foreground">{topPickReason}</p>
        )}
        <div className="mt-2.5 flex items-center gap-3">
          <button
            onClick={(e) => onWhyClick(e.currentTarget)}
            aria-label={`Why ${topPick.player.web_name}?`}
            className="min-h-[44px] px-0 text-small font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Why?
          </button>
          <button
            onClick={(e) => onTraceClick(e.currentTarget)}
            className="min-h-[44px] px-0 text-small text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            How the agent decided
          </button>
        </div>
      </div>

      {/* Replans (if any) */}
      {replans.length > 0 && (
        <div className="border-border mx-4 mb-3 rounded-md border-dashed border px-3 py-2">
          {replans.map((r, i) => (
            <p key={i} className="text-small text-muted-foreground">
              {r}
            </p>
          ))}
        </div>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="border-border border-t">
          <div className="border-border border-b px-4 py-2">
            <span className="text-label uppercase tracking-widest text-muted-foreground">
              {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
            </span>
          </div>
          {alternatives.map((alt, i) => (
            <div
              key={alt.candidate.player.id}
              className={cn(
                'flex items-start gap-3 px-4 py-2.5',
                i < alternatives.length - 1 && 'border-border border-b',
              )}
            >
              <span className="text-number mt-0.5 w-4 shrink-0 font-mono text-muted-foreground">
                {i + 2}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-body-strong text-foreground">
                      {alt.candidate.player.web_name}
                    </span>
                    <span className="text-small ml-2 text-muted-foreground">
                      £{(alt.candidate.player.now_cost / 10).toFixed(1)}m
                    </span>
                  </div>
                  <FixtureChips perGw={alt.candidate.score.perGw} size="sm" />
                </div>
                {alt.reason && (
                  <p className="text-small mt-0.5 text-muted-foreground">{alt.reason}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
