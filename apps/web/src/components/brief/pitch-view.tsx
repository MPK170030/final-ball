'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Shirt } from './shirt'
import type { LineupCardPayload, PitchPlayer } from './types'

// ── Status helpers ────────────────────────────────────────────────────────────

type TileStatus =
  | 'sell'
  | 'to_bench'
  | 'in'
  | 'new_signing'
  | 'benched'
  | 'preview'
  | null

const STATUS_COLOR: Record<NonNullable<TileStatus>, string> = {
  sell: '#E5534B',
  to_bench: '#E5534B',
  in: '#4CAF7A',
  new_signing: '#4CAF7A',
  benched: '#E5534B',
  preview: '#A3A3A3',
}

const STATUS_LABEL: Record<NonNullable<TileStatus>, string> = {
  sell: '→ SELL',
  to_bench: '↓ TO BENCH',
  in: '↑ IN',
  new_signing: 'NEW SIGNING',
  benched: '↓ BENCHED',
  preview: 'PREVIEW',
}

// ── Fallback: convert legacy LineupSlotPayload to PitchPlayer ─────────────────

function slotToPitchPlayer(s: {
  player: { id: number; web_name: string; team: number; element_type: number }
  clubShortName?: string
  epNext: number
}): PitchPlayer {
  const pos = ({ 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' } as const)[
    s.player.element_type as 1 | 2 | 3 | 4
  ] ?? 'FWD'
  return {
    id: s.player.id,
    name: s.player.web_name,
    club: s.clubShortName ?? '???',
    position: pos,
    gw_xp: s.epNext,
    is_gk: s.player.element_type === 1,
  }
}

// ── Row grouping ──────────────────────────────────────────────────────────────

function groupRows(players: PitchPlayer[]): PitchPlayer[][] {
  const gk = players.filter(p => p.is_gk)
  const def = players.filter(p => p.position === 'DEF')
  const mid = players.filter(p => p.position === 'MID')
  const fwd = players.filter(p => p.position === 'FWD')
  return [gk, def, mid, fwd].filter(r => r.length > 0)
}

// ── Aria label ────────────────────────────────────────────────────────────────

function buildAriaLabel(
  player: PitchPlayer,
  status: TileStatus,
  isC: boolean,
  isV: boolean,
): string {
  const parts = [player.name, player.club, `${player.gw_xp.toFixed(1)} expected points`]
  if (isC) parts.push('captain')
  if (isV) parts.push('vice-captain')
  if (status === 'sell') parts.push('selling')
  else if (status === 'to_bench') parts.push('moving to bench')
  else if (status === 'in') parts.push('coming in')
  else if (status === 'new_signing') parts.push('new signing')
  else if (status === 'benched') parts.push('benched')
  return parts.join(', ')
}

// ── Player tile ───────────────────────────────────────────────────────────────

interface PlayerTileProps {
  player: PitchPlayer
  status: TileStatus
  isBench?: boolean
  benchOrder?: number
  isC?: boolean
  isV?: boolean
}

function PlayerTile({ player, status, isBench, benchOrder, isC, isV }: PlayerTileProps) {
  const borderColor = status ? STATUS_COLOR[status] : 'transparent'
  const borderStyle = status === 'preview' ? 'dashed' : 'solid'

  return (
    <span
      role="img"
      aria-label={buildAriaLabel(player, status, !!isC, !!isV)}
      className={cn(
        'relative flex flex-col items-center gap-[3px]',
        'rounded-[10px] bg-[rgba(24,24,24,0.85)] pt-2 px-1.5 pb-1.5',
        'border-[1.5px]',
        // Mobile: flex-1 so rows of 5 can shrink; desktop: fixed 116px
        'flex-1 min-w-0 max-w-[78px] lg:flex-none lg:w-[116px] lg:max-w-[116px]',
      )}
      style={{ borderColor, borderStyle }}
    >
      {/* Shirt */}
      <span className="lg:hidden">
        <Shirt club={player.club} isGk={player.is_gk} size={32} />
      </span>
      <span className="hidden lg:block">
        <Shirt club={player.club} isGk={player.is_gk} size={44} />
      </span>

      {/* C / V badge */}
      {isC && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-[#181818]"
        >
          C
        </span>
      )}
      {isV && !isC && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-foreground bg-background text-[11px] font-bold text-foreground"
        >
          V
        </span>
      )}

      {/* Name */}
      <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] font-semibold leading-none lg:text-[13px]">
        {isBench && benchOrder != null ? (
          <>
            <span className="font-mono text-muted-foreground">{benchOrder}</span>{' '}
            {player.name}
          </>
        ) : (
          player.name
        )}
      </span>

      {/* Club · xP */}
      <span className="text-[11px] text-muted-foreground leading-none">
        {player.club}{' '}
        <span className="font-mono text-foreground">{player.gw_xp.toFixed(1)}</span>
      </span>

      {/* Status label */}
      {status && (
        <span
          className="text-[10px] font-semibold leading-none tracking-[0.04em]"
          style={{ color: STATUS_COLOR[status] }}
        >
          {STATUS_LABEL[status]}
        </span>
      )}
    </span>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

interface LegendProps {
  newPlayer: PitchPlayer | null
  soldPlayer: PitchPlayer | null
  inIds: Set<number>
  benchedIds: Set<number>
  xiAfter: PitchPlayer[]
  xiNow: PitchPlayer[]
}

function LegendItems({ newPlayer, soldPlayer, inIds, benchedIds, xiAfter, xiNow }: LegendProps) {
  const items: { color: string; text: string }[] = []

  const inParts: string[] = []
  const inPlayers = xiAfter.filter(p => inIds.has(p.id))
  if (inPlayers.length > 0) inParts.push(`↑ In: ${inPlayers.map(p => p.name).join(', ')}`)
  if (newPlayer) inParts.push(`New signing: ${newPlayer.name}`)
  if (inParts.length > 0) items.push({ color: '#4CAF7A', text: inParts.join(' · ') })

  const benchedParts: string[] = []
  const benchedPlayers = xiNow.filter(p => benchedIds.has(p.id))
  if (benchedPlayers.length > 0) benchedParts.push(`↓ Benched: ${benchedPlayers.map(p => p.name).join(', ')}`)
  if (soldPlayer) benchedParts.push(`→ Sell: ${soldPlayer.name}`)
  if (benchedParts.length > 0) items.push({ color: '#E5534B', text: benchedParts.join(' · ') })

  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-3.5 text-[12px] text-muted-foreground" style={{ minHeight: '18px' }}>
      {items.map(item => (
        <span key={item.text} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-[3px] border-[1.5px]"
            style={{ borderColor: item.color }}
            aria-hidden="true"
          />
          {item.text}
        </span>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface PitchViewProps {
  payload: LineupCardPayload
  gameweek: number
  captainId?: number
  vcId?: number
  onTraceClick?: (t: HTMLButtonElement) => void
  onCounterClick?: (t: HTMLButtonElement) => void
  isSelected?: boolean
}

export function PitchView({
  payload,
  gameweek,
  captainId,
  vcId,
  onTraceClick,
  onCounterClick,
  isSelected,
}: PitchViewProps) {
  // No motion in pass 2 — open on "After the brief"
  const [tab, setTab] = useState<'now' | 'after'>('after')

  // ── Resolve "After" players from payload ────────────────────────────────────
  const xiAfter: PitchPlayer[] = payload.xi_after ?? payload.starting.map(slotToPitchPlayer)
  const benchAfter: PitchPlayer[] = payload.bench_after ?? payload.bench.map(slotToPitchPlayer)

  const changes = payload.changes
  const soldPlayer = changes?.sold_player ?? null
  const newPlayer = changes?.new_player ?? null

  // ── "Now" players — actual FPL picks stored at brief generation time ──────────
  const xiNow: PitchPlayer[] = payload.xi_now ?? xiAfter
  const benchNow: PitchPlayer[] = payload.bench_now ?? benchAfter
  const formationNow = payload.xi_now
    ? (() => {
        const n = (pos: string) => payload.xi_now!.filter(p => p.position === pos).length
        return `${n('DEF')}-${n('MID')}-${n('FWD')}`
      })()
    : payload.formation

  const xi = tab === 'now' ? xiNow : xiAfter
  const bench = tab === 'now' ? benchNow : benchAfter
  const formationDisplay = tab === 'now' ? formationNow : payload.formation

  const totalAfter = payload.total_xp_after ?? xiAfter.reduce((s, p) => s + p.gw_xp, 0)
  const totalNow = xiNow.reduce((s, p) => s + p.gw_xp, 0)
  const total = tab === 'now' ? totalNow : totalAfter
  const delta = totalAfter - totalNow

  // ── Derive statuses from computed XIs ──────────────────────────────────────
  const xiNowIds = new Set(xiNow.map(p => p.id))
  const xiAfterIds = new Set(xiAfter.map(p => p.id))
  // Players who moved bench→XI (excluding new_player): recommend lineup swap
  const inIds = new Set(
    xiAfter.filter(p => !xiNowIds.has(p.id) && p.id !== newPlayer?.id).map(p => p.id)
  )
  // Players who moved XI→bench (excluding sold_player): recommend lineup swap
  const benchedIds = new Set(
    xiNow.filter(p => !xiAfterIds.has(p.id) && p.id !== soldPlayer?.id).map(p => p.id)
  )

  function xiStatus(player: PitchPlayer): TileStatus {
    if (tab === 'now') {
      if (player.id === soldPlayer?.id) return 'sell'
      if (benchedIds.has(player.id)) return 'to_bench'
    } else {
      if (player.id === newPlayer?.id) return 'new_signing'
      if (inIds.has(player.id)) return 'in'
    }
    return null
  }

  function benchStatus(player: PitchPlayer): TileStatus {
    if (tab === 'now' && player.id === soldPlayer?.id) return 'sell'
    if (tab === 'after' && player.id === newPlayer?.id) return 'new_signing'
    if (tab === 'after' && benchedIds.has(player.id)) return 'benched'
    return null
  }

  const rows = groupRows(xi)

  return (
    <article
      id="lineup-section"
      aria-labelledby="pitch-heading"
      className={cn(
        'bg-card border rounded-[14px] p-3.5 md:p-6 flex flex-col gap-3.5',
        isSelected ? 'border-[#A3A3A3]' : 'border-border',
      )}
      style={{ scrollMarginTop: '140px' }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2
          id="pitch-heading"
          className="m-0 font-mono text-[12px] font-semibold tracking-[0.08em] uppercase text-muted-foreground"
        >
          YOUR XI · {formationDisplay}
        </h2>
        <div className="hidden lg:flex items-center gap-2">
          {onCounterClick && (
            <button
              type="button"
              onClick={e => onCounterClick(e.currentTarget)}
              className="inline-flex h-9 items-center rounded-[6px] border border-border bg-transparent px-3 text-[13px] font-medium text-foreground hover:border-muted-foreground transition-colors"
            >
              Counter
            </button>
          )}
          <button
            type="button"
            onClick={e => onTraceClick?.(e.currentTarget)}
            className="inline-flex h-9 items-center rounded-sm border border-border bg-transparent px-3 text-[13px] text-foreground hover:border-muted-foreground transition-colors"
          >
            Trace
          </button>
        </div>
      </div>

      {/* Tabs + projected total */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div
          role="tablist"
          aria-label="Compare lineups"
          className="flex gap-1 rounded-[10px] bg-background p-1"
        >
          {(['now', 'after'] as const).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'h-11 lg:h-[34px] rounded-[6px] px-3 text-[13px] font-medium transition-colors border-0',
                tab === t
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'now' ? 'Now' : 'After the brief'}
            </button>
          ))}
        </div>

        <div aria-live="polite" className="flex items-baseline gap-2">
          <span className="text-[12px] text-muted-foreground">Projected GW{gameweek}</span>
          <span className="font-mono text-[20px] font-semibold tabular-nums">
            {total.toFixed(1)}
          </span>
          {tab === 'after' && delta !== 0 && (
            <span
              className="font-mono text-[13px] font-semibold tabular-nums"
              style={{ color: delta >= 0 ? '#4CAF7A' : '#E5534B' }}
            >
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <LegendItems newPlayer={newPlayer} soldPlayer={soldPlayer} inIds={inIds} benchedIds={benchedIds} xiAfter={xiAfter} xiNow={xiNow} />

      {/* Pitch */}
      <div
        className="relative rounded-xl border border-secondary bg-background-alt px-0.5 py-3.5 lg:px-3 lg:py-5 overflow-hidden touch-pan-y select-none"
      >
        {/* Faint pitch lines */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <g stroke="#2C2C2C" strokeWidth="1.5" fill="none">
            <rect x="110" y="-2" width="180" height="62" vectorEffect="non-scaling-stroke" />
            <rect x="160" y="-2" width="80" height="26" vectorEffect="non-scaling-stroke" />
            <path d="M 140 300 A 60 60 0 0 1 260 300" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        {/* XI rows */}
        <div className="relative flex flex-col gap-[10px] lg:gap-3.5">
          {rows.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1 lg:gap-3">
              {row.map(player => (
                <PlayerTile
                  key={player.id}
                  player={player}
                  status={xiStatus(player)}
                  isC={player.id === captainId}
                  isV={player.id === vcId}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <span className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground -mt-1">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M2 7h10M4.5 4.5L2 7l2.5 2.5M9.5 4.5L12 7l-2.5 2.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="hidden lg:inline">Drag the pitch sideways or use the tabs to compare</span>
        <span className="lg:hidden">Swipe the pitch to compare</span>
      </span>

      {/* Bench */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
          BENCH · AUTO-SUB ORDER
        </span>
        <div className="flex gap-1 lg:gap-3 justify-start">
          {bench.map((player, i) => (
            <PlayerTile
              key={player.id}
              player={player}
              status={benchStatus(player)}
              isBench
              benchOrder={i + 1}
            />
          ))}
        </div>
      </div>

      {/* Mobile Counter + Trace */}
      <div className={cn('lg:hidden', onCounterClick ? 'flex gap-2' : '')}>
        {onCounterClick && (
          <button
            type="button"
            onClick={e => onCounterClick(e.currentTarget)}
            className="flex-1 inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-border bg-transparent text-[13px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Counter
          </button>
        )}
        <button
          type="button"
          onClick={e => onTraceClick?.(e.currentTarget)}
          className={cn(
            'min-h-[44px] rounded-sm border border-border bg-transparent text-[14px] text-foreground',
            onCounterClick ? 'flex-1 inline-flex items-center justify-center' : 'w-full',
          )}
        >
          Trace
        </button>
      </div>
    </article>
  )
}
