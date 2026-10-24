import { cn } from '@/lib/utils'

interface FixtureChipProps {
  fdr: number | null
  opponent?: string
  isHome?: boolean
  isDouble?: boolean
  size?: 'sm' | 'md'
}

function fdrClass(fdr: number | null): string {
  if (fdr === null) return 'bg-muted text-muted-foreground'
  if (fdr <= 2) return 'bg-fdr-2 text-foreground'
  if (fdr === 3) return 'bg-fdr-3 text-foreground'
  if (fdr === 4) return 'bg-fdr-4 text-foreground'
  return 'bg-fdr-5 text-fdr-5-foreground'
}

export function FixtureChip({ fdr, opponent, isHome, isDouble, size = 'md' }: FixtureChipProps) {
  if (fdr === null) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-sm font-mono font-medium',
          size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-number',
          'bg-muted text-muted-foreground',
        )}
        aria-label="Blank gameweek"
      >
        BLK
      </span>
    )
  }

  const parts: string[] = []
  if (opponent) parts.push(opponent)
  if (isHome !== undefined) parts.push(isHome ? 'H' : 'A')
  parts.push(String(fdr))
  if (isDouble) parts.push('×2')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm font-mono font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-number',
        fdrClass(fdr),
      )}
      aria-label={`FDR ${fdr}${opponent ? ` vs ${opponent}` : ''}${isDouble ? ' double gameweek' : ''}`}
    >
      {parts.join(' ')}
    </span>
  )
}
