'use client'

import { useState, useEffect } from 'react'
import NumberFlow from '@number-flow/react'

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

export function Countdown({ deadlineMs }: { deadlineMs: number | null }) {
  const time = useCountdown(deadlineMs)
  if (!time) return null

  return (
    // aria-live="off": updating every second would be too noisy for screen readers
    <div aria-live="off" className="flex items-baseline gap-0.5 font-mono text-number text-muted-foreground tabular-nums">
      {time.days > 0 && (
        <>
          <NumberFlow value={time.days} />
          <span>d </span>
        </>
      )}
      <NumberFlow value={time.hours} format={{ minimumIntegerDigits: time.days > 0 ? 2 : 1 }} />
      <span>h </span>
      <NumberFlow value={time.minutes} format={{ minimumIntegerDigits: 2 }} />
      <span>m </span>
      {time.days === 0 && (
        <>
          <NumberFlow value={time.seconds} format={{ minimumIntegerDigits: 2 }} />
          <span>s</span>
        </>
      )}
    </div>
  )
}
