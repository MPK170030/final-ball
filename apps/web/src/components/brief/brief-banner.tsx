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
        'mx-4 mt-3 flex items-start gap-3 rounded-[10px] px-[14px] py-3 text-[14px] leading-5 md:mx-8 md:mt-5 md:text-[15px] md:leading-[22px]',
        variant === 'warning'
          ? 'bg-warning/10 text-warning'
          : 'bg-secondary text-foreground',
        className,
      )}
    >
      {variant === 'warning' ? (
        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      ) : (
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  )
}
