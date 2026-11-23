'use client'

import { useState, useEffect } from 'react'
import NumberFlow from '@number-flow/react'
import { cn } from '@/lib/utils'

function useCountdown(deadlineMs: number | null) {
  const [remaining, setRemaining] = useState(() =>
    deadlineMs ? Math.max(0, deadlineMs - Date.now()) : null,
  )

  useEffect(() => {
    if (!deadlineMs) return
    const tick = () => setRemaining(Math.max(0, deadlineMs - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadlineMs])

  if (remaining === null) return null

  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds, totalMs: remaining }
}

export function Countdown({
  deadlineMs,
  className = 'text-muted-foreground',
}: {
  deadlineMs: number | null
  className?: string
}) {
  const time = useCountdown(deadlineMs)
  if (!time) return null

  return (
    // aria-live="off": updating every second would be too noisy for screen readers
    <div aria-live="off" className={cn('flex items-baseline gap-0.5 font-mono text-number tabular-nums', className)}>
      {time.days > 0 && (
        <>
          <NumberFlow value={time.days} className="overflow-hidden" />
          <span>d </span>
        </>
      )}
      <NumberFlow value={time.hours} format={{ minimumIntegerDigits: 2 }} className="overflow-hidden" />
      <span>h </span>
      <NumberFlow value={time.minutes} format={{ minimumIntegerDigits: 2 }} className="overflow-hidden" />
      <span>m </span>
      <NumberFlow value={time.seconds} format={{ minimumIntegerDigits: 2 }} className="overflow-hidden" />
      <span>s</span>
    </div>
  )
}
