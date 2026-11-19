'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ReceiptData, ReceiptRowData } from './types'

// ── Label display ─────────────────────────────────────────────────────────────

type TransferLabel = 'followed' | 'own_move' | 'ignored_rolled' | 'ignored_transferred'
type CaptainLabel = 'captain_followed' | 'captain_ignored'
type ChipLabel = 'chip_followed' | 'chip_ignored'

const TRANSFER_LABEL_META: Record<TransferLabel, { text: string; className: string }> = {
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

const CAPTAIN_LABEL_META: Record<CaptainLabel, { text: string; className: string }> = {
  captain_followed: {
    text: 'C: Followed',
    className: 'bg-primary/10 text-primary border border-primary/20',
  },
  captain_ignored: {
    text: 'C: Own pick',
    className: 'bg-secondary text-muted-foreground border border-border',
  },
}

const CHIP_LABEL_META: Record<ChipLabel, { text: string; className: string }> = {
  chip_followed: {
    text: 'Chip: followed',
    className: 'bg-primary/10 text-primary border border-primary/20',
  },
  chip_ignored: {
    text: 'Chip: own call',
    className: 'bg-secondary text-muted-foreground border border-border',
  },
}

const CHIP_DISPLAY: Record<string, string> = {
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
  '3xc': 'Triple Captain',
  bboost: 'Bench Boost',
}

function getLabelMeta(label: ReceiptRowData['label']) {
  if (label === 'captain_followed' || label === 'captain_ignored') {
    return CAPTAIN_LABEL_META[label]
  }
  if (label === 'chip_followed' || label === 'chip_ignored') {
    return CHIP_LABEL_META[label]
  }
  return TRANSFER_LABEL_META[label as TransferLabel]
}

// ── Scorecard ──────────────────────────────────────────────────────────────────

function Scorecard({ data }: { data: ReceiptData }) {
  const { rows, counterRecords } = data
  const transferRows = rows.filter((r) => r.kind === 'transfer')
  const settled = transferRows.filter((r) => r.receipt?.status === 'settled' && r.receipt.deltaPts !== null)
  const totalDelta = settled.reduce((sum, r) => sum + (r.receipt?.deltaPts ?? 0), 0)
  const followed = transferRows.filter((r) => r.label === 'followed').length
  const totalWithReceipt = transferRows.filter((r) => r.receipt !== null).length

  if (rows.length === 0) return null

  // Risk-tag breakdown (transfer rows with a receipt only)
  const riskTags: Array<'safe' | 'balanced' | 'bold'> = ['safe', 'balanced', 'bold']
  const tagRows = riskTags
    .map((tag) => {
      const tagDecisions = transferRows.filter((r) => r.riskTag === tag && r.receipt !== null)
      if (tagDecisions.length === 0) return null
      const tagFollowed = tagDecisions.filter((r) => r.label === 'followed').length
      const tagSettled = tagDecisions.filter((r) => r.receipt?.status === 'settled' && r.receipt.deltaPts !== null)
      const tagDelta = tagSettled.reduce((s, r) => s + (r.receipt?.deltaPts ?? 0), 0)
      return { tag, followed: tagFollowed, total: tagDecisions.length, delta: tagSettled.length > 0 ? tagDelta : null }
    })
    .filter(Boolean) as Array<{ tag: string; followed: number; total: number; delta: number | null }>

  return (
    <div className="rounded-[12px] border border-border bg-card px-4 py-4 md:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">
        Last 5 gameweeks
      </p>

      {/* Headline stats */}
      <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4">
        <button
          type="button"
          onClick={() => document.getElementById('receipt-rows')?.scrollIntoView({ behavior: 'smooth' })}
          className="text-left"
        >
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
            {settled.length === 0 ? '—' : `${totalDelta >= 0 ? '+' : ''}${totalDelta}`}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">transfer impact</p>
        </button>
        {totalWithReceipt > 0 && (
          <button
            type="button"
            onClick={() => document.getElementById('receipt-rows')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-left"
          >
            <p className="font-mono text-[22px] font-semibold tabular-nums leading-none text-foreground">
              {followed} / {totalWithReceipt}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">followed agent</p>
          </button>
        )}
        {counterRecords && counterRecords.total > 0 && (
          <div>
            <p className="font-mono text-[22px] font-semibold tabular-nums leading-none text-foreground">
              {counterRecords.userRight} / {counterRecords.total}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">pushbacks you won</p>
          </div>
        )}
      </div>

      {/* Risk tag breakdown */}
      {tagRows.length > 0 && (
        <div className="border-t border-border pt-3 space-y-1.5">
          {tagRows.map(({ tag, followed: f, total: t, delta }) => (
            <div key={tag} className="flex items-center justify-between gap-2 text-[12px]">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold leading-none uppercase tracking-[0.05em] border',
                    tag === 'safe' && 'bg-secondary text-muted-foreground border-border',
                    tag === 'balanced' && 'bg-secondary text-foreground border-border',
                    tag === 'bold' && 'bg-primary/10 text-primary border-primary/20',
                  )}
                >
                  {tag}
                </span>
                <span className="text-muted-foreground">{f}/{t} followed</span>
              </div>
              {delta !== null ? (
                <span
                  className={cn(
                    'font-mono tabular-nums font-medium',
                    delta >= 0 ? 'text-[#4CAF7A]' : 'text-[#E5534B]',
                  )}
                >
                  {delta >= 0 ? '+' : ''}{delta}
                </span>
              ) : (
                <span className="text-muted-foreground font-mono">—</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Single receipt row ────────────────────────────────────────────────────────

function ReceiptRow({ row }: { row: ReceiptRowData }) {
  const [note, setNote] = useState(row.note ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const labelMeta = getLabelMeta(row.label)
  const r = row.receipt
  const isChip = row.kind === 'chip'
  const isCaptain = row.kind === 'captain'

  const playerIn = row.actualMove?.element_in_name ?? null
  const playerOut = row.actualMove?.element_out_name ?? null
  const chipName = row.actualMove?.chip ? (CHIP_DISPLAY[row.actualMove.chip] ?? row.actualMove.chip) : null

  async function saveNote() {
    setSaving(true)
    await fetch(`/api/receipts/${row.decisionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note.trim() || null }),
    })
    setSaving(false)
    setEditing(false)
  }

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
          {isChip ? (
            <p className="text-[14px] font-semibold text-foreground leading-snug">
              {chipName ?? 'Chip played'}
            </p>
          ) : isCaptain ? (
            playerIn && playerOut ? (
              <p className="text-[14px] font-semibold text-foreground leading-snug">
                {playerIn}
                {playerIn !== playerOut && (
                  <span className="text-muted-foreground font-normal text-[13px]"> (agent: {playerOut})</span>
                )}
              </p>
            ) : (
              <p className="text-[13px] text-muted-foreground">Captain decision</p>
            )
          ) : playerIn && playerOut ? (
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
                  GW{r.windowStartGw}{r.windowStartGw !== r.windowEndGw ? `–GW${r.windowEndGw}` : ''}
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

      {/* Note / journal */}
      <div className="mt-2.5">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') setEditing(false) }}
              placeholder="Add a note…"
              className="flex-1 rounded-[6px] border border-border bg-secondary px-2.5 py-1 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              type="button"
              onClick={saveNote}
              disabled={saving}
              className="text-[12px] text-primary font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : note ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {note}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            + note
          </button>
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
        <Scorecard data={data} />

        {rows.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-card px-4 py-6 text-center">
            <p className="text-[14px] font-medium text-foreground">No receipts yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              After the GW deadline, your transfer decisions will appear here.
            </p>
          </div>
        ) : (
          <div id="receipt-rows" className="space-y-3">
            {rows.map((row) => <ReceiptRow key={row.decisionId} row={row} />)}
          </div>
        )}
      </div>
    </section>
  )
}
