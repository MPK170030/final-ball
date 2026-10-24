import { cn } from '@/lib/utils'
import { AlertTriangleIcon, InfoIcon } from 'lucide-react'

type BannerVariant = 'info' | 'warning'

interface BriefBannerProps {
  variant?: BannerVariant
  children: React.ReactNode
  className?: string
}

export function BriefBanner({ variant = 'info', children, className }: BriefBannerProps) {
  return (
    <div
      role={variant === 'warning' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-small',
        variant === 'warning'
          ? 'border-warning/30 bg-warning/10 text-warning border-b'
          : 'border-border bg-secondary/50 text-muted-foreground border-b',
        className,
      )}
    >
      {variant === 'warning' ? (
        <AlertTriangleIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
      ) : (
        <InfoIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  )
}
