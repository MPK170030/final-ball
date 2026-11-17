'use client'

import { cn } from '@/lib/utils'
import type { ReceiptData, ReceiptRowData } from './types'

// ── Label display ─────────────────────────────────────────────────────────────

const LABEL_META: Record<ReceiptRowData['label'], { text: string; className: string }> = {
  followed: {
    text: 'Followed',
    className: 'bg-primary/10 text-primary border border-primary/20',
  },
  own_move: {
    text: 'Your move',
    className: 'bg-secondary text-foreground border border-border',
  },
  ignored_rolled: {
    text: 'Saved FT',
    className: 'bg-secondary text-muted-foreground border border-border',
  },
  ignored_transferred: {
    text: 'Ignored',
    className: 'bg-secondary text-muted-foreground border border-border',
  },
}

// ── Scorecard ──────────────────────────────────────────────────────────────────

function Scorecard({ receipts }: { receipts: ReceiptRowData[] }) {
  const settled = receipts.filter((r) => r.receipt?.status === 'settled' && r.receipt.deltaPts !== null)
  const totalDelta = settled.reduce((sum, r) => sum + (r.receipt?.deltaPts ?? 0), 0)
  const followed = receipts.filter((r) => r.label === 'followed').length
  const totalWithReceipt = receipts.filter((r) => r.receipt !== null).length

  if (receipts.length === 0) return null

  return (
    <div className="rounded-[12px] border border-border bg-card px-4 py-4 md:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">
        Last 5 gameweeks
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <p
            className={cn(
              'font-mono text-[22px] font-semibold tabular-nums leading-none',
              settled.length === 0
                ? 'text-muted-foreground'
                : totalDelta >= 0
                  ? 'text-[#4CAF7A]'
                  : 'text-[#E5534B]',
            )}
          >
            {settled.length === 0
              ? '—'
              : `${totalDelta >= 0 ? '+' : ''}${totalDelta}`}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">transfer impact</p>
        </div>
        {totalWithReceipt > 0 && (
          <div>
            <p className="font-mono text-[22px] font-semibold tabular-nums leading-none text-foreground">
              {followed} / {totalWithReceipt}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">followed agent</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Single receipt row ────────────────────────────────────────────────────────

function ReceiptRow({ row }: { row: ReceiptRowData }) {
  const labelMeta = LABEL_META[row.label]
  const r = row.receipt

  const playerIn = row.actualMove?.element_in_name ?? null
  const playerOut = row.actualMove?.element_out_name ?? null

  return (
    <div className="rounded-[12px] border border-border bg-card px-4 py-3.5 md:px-5 md:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              GW{row.gameweek}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold leading-none uppercase tracking-[0.05em]',
                labelMeta.className,
              )}
            >
              {labelMeta.text}
            </span>
          </div>
          {playerIn && playerOut ? (
            <p className="text-[14px] font-semibold text-foreground leading-snug">
              {playerOut} → {playerIn}
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">No transfer made</p>
          )}
        </div>

        {/* Delta or pending */}
        {r && (
          <div className="shrink-0 text-right">
            {r.status === 'pending' ? (
              <div>
                <p className="font-mono text-[13px] text-muted-foreground tabular-nums">Pending</p>
                <p className="text-[11px] text-muted-foreground">
                  GW{r.windowStartGw}–GW{r.windowEndGw}
                </p>
              </div>
            ) : (
              <div>
                <p
                  className={cn(
                    'font-mono text-[18px] font-semibold tabular-nums leading-none',
                    (r.deltaPts ?? 0) >= 0 ? 'text-[#4CAF7A]' : 'text-[#E5534B]',
                  )}
                >
                  {(r.deltaPts ?? 0) >= 0 ? '+' : ''}{r.deltaPts ?? 0}
                </p>
                {r.playerInPts !== null && r.playerOutPts !== null && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums font-mono">
                    {r.playerInPts} vs {r.playerOutPts}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export function ReceiptsSection({ data }: { data: ReceiptData }) {
  const { rows } = data

  return (
    <section aria-label="Transfer receipts">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Transfer receipts
        </h2>
      </div>

      <div className="space-y-3">
        <Scorecard receipts={rows} />

        {rows.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-card px-4 py-6 text-center">
            <p className="text-[14px] font-medium text-foreground">No receipts yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              After the GW deadline, your transfer decisions will appear here.
            </p>
          </div>
        ) : (
          rows.map((row) => <ReceiptRow key={row.decisionId} row={row} />)
        )}
      </div>
    </section>
  )
}
