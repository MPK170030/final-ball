'use client'

import { cn } from '@/lib/utils'
import { CHIP_LABELS } from './chips-line'
import type { TransferCardPayload, CaptainCardPayload, ChipCardPayload, LineupCardPayload } from './types'

const FLAG_ONLY = new Set(['wildcard', 'freehit'])

interface Move {
  n: number
  label: string
  main: string
  sub?: string
  href?: string
  onClick?: () => void
}

// Desktop tile layout
function MoveTile({ n, label, main, sub, href, onClick }: Move) {
  const content = (
    <>
      <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
        <span
          className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[#6B6B6B] text-[10px] leading-none"
          aria-hidden="true"
        >
          {n}
        </span>
        {label}
      </span>
      <span className="text-[18px] font-semibold leading-tight tracking-[-0.01em] text-foreground line-clamp-2">{main}</span>
      {sub && <span className="text-[12px] text-muted-foreground truncate">{sub}</span>}
    </>
  )

  const cls = 'flex flex-col gap-1.5 rounded-[10px] bg-background p-3.5 text-left no-underline text-foreground hover:bg-[#333] transition-colors min-h-[90px]'

  if (href) {
    return (
      <a href={href} onClick={onClick} className={cls} style={{ textDecoration: 'none' }}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cn(cls, 'w-full border-0 cursor-pointer')}>
      {content}
    </button>
  )
}

// Mobile row layout
function MoveRow({ n, label, main, sub, href, onClick }: Move) {
  const content = (
    <>
      <span className="flex w-[88px] shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px] tracking-[0.06em] text-muted-foreground">
        <span
          className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[#6B6B6B] text-[10px] leading-none"
          aria-hidden="true"
        >
          {n}
        </span>
        {label}
      </span>
      <span className="flex flex-col gap-px min-w-0">
        <span className="text-[15px] font-semibold leading-[1.3] text-foreground truncate">{main}</span>
        {sub && (
          <span className="text-[12px] text-muted-foreground truncate">{sub}</span>
        )}
      </span>
      <span className="text-muted-foreground" aria-hidden="true">›</span>
    </>
  )

  const cls = 'grid grid-cols-[88px_1fr_16px] items-center gap-2 min-h-[52px] text-left w-full text-foreground no-underline transition-opacity hover:opacity-80 active:opacity-60'

  if (href) {
    return (
      <a href={href} onClick={onClick} className={cls} style={{ textDecoration: 'none' }}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cn(cls, 'bg-transparent border-0 cursor-pointer')}>
      {content}
    </button>
  )
}

interface SnapshotWidgetProps {
  transferPayload?: TransferCardPayload | null
  captainPayload?: CaptainCardPayload | null
  lineupPayload?: LineupCardPayload | null
  chipPayload?: ChipCardPayload | null
  onTransferClick?: () => void
  onCaptainClick?: () => void
  onLineupClick?: () => void
  onChipClick?: () => void
  className?: string
}

export function SnapshotWidget({
  transferPayload,
  captainPayload,
  lineupPayload,
  chipPayload,
  onTransferClick,
  onCaptainClick,
  onLineupClick,
  onChipClick,
  className,
}: SnapshotWidgetProps) {
  const moves: Move[] = []

  // Transfer move
  if (transferPayload) {
    if (transferPayload.save) {
      moves.push({ n: moves.length + 1, label: 'Transfer', main: 'Save', sub: 'No weak spot', href: '#transfer-section', onClick: onTransferClick })
    } else {
      const inName = transferPayload.topPick.player.web_name
      const outName = transferPayload.sell.player.web_name
      moves.push({ n: moves.length + 1, label: 'Transfer', main: `${outName} → ${inName}`, sub: transferPayload.topPickRiskTag ? `${transferPayload.topPickRiskTag.charAt(0).toUpperCase()}${transferPayload.topPickRiskTag.slice(1)}` : undefined, href: '#transfer-section', onClick: onTransferClick })
    }
  }

  // Captain move
  if (captainPayload) {
    moves.push({
      n: moves.length + 1,
      label: 'Captain',
      main: captainPayload.captain.player.web_name,
      sub: `Vice: ${captainPayload.vc.player.web_name}`,
      href: '#captain-section',
      onClick: onCaptainClick,
    })
  }

  // Lineup move
  if (lineupPayload) {
    const changeCount = lineupPayload.swapsIn.length
    moves.push({
      n: moves.length + 1,
      label: 'Lineup',
      main: lineupPayload.formation,
      sub: changeCount > 0 ? `${changeCount} swap${changeCount > 1 ? 's' : ''}` : 'No changes',
      href: '#lineup-section',
      onClick: onLineupClick,
    })
  }

  // Chip move
  if (chipPayload) {
    const recommended = chipPayload.timing.length > 0
    if (recommended) {
      const chipEntry = chipPayload.timing[0]
      const rawName = chipEntry?.chip ?? 'Chip'
      const name = CHIP_LABELS[rawName] ?? String(rawName)
      const isFlagOnly = FLAG_ONLY.has(rawName)
      moves.push({
        n: moves.length + 1,
        label: 'Chip',
        main: name,
        sub: isFlagOnly ? 'Worth a look · plan it in FPL' : 'Recommended',
        href: '#chip-section',
        onClick: onChipClick,
      })
    } else {
      const available = chipPayload.status.filter((s) => s.playable).length
      if (available > 0) {
        moves.push({ n: moves.length + 1, label: 'Chip', main: 'Save them', sub: `${available} available`, href: '#chip-section', onClick: onChipClick })
      }
    }
  }

  if (moves.length === 0) return null

  return (
    <section
      aria-labelledby="snapshot-heading"
      className={cn('bg-card rounded-[14px] border-[1.5px] border-primary flex flex-col gap-1.5 md:gap-3 p-[14px] md:px-6 md:py-[22px]', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="snapshot-heading" className="m-0 text-[20px] font-semibold text-foreground">
          Your moves this week
        </h2>
        <span className="hidden md:inline shrink-0 text-[13px] text-muted-foreground">In the order you make them in FPL</span>
      </div>

      {/* Desktop grid */}
      <ol className="m-0 list-none p-0 hidden md:grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        {moves.map((move) => (
          <li key={move.label}>
            <MoveTile {...move} />
          </li>
        ))}
      </ol>

      {/* Mobile list */}
      <ol className="m-0 list-none p-0 flex flex-col md:hidden">
        {moves.map((move) => (
          <li key={move.label} className="border-t border-secondary first:border-t-0">
            <MoveRow {...move} />
          </li>
        ))}
      </ol>
    </section>
  )
}
