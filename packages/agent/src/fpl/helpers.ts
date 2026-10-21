import type { Bootstrap } from './types.js'

export function getCurrentGameweek(bootstrap: Bootstrap): number | null {
  return bootstrap.events.find((e) => e.is_current)?.id ?? null
}

export function getNextGameweek(bootstrap: Bootstrap): number | null {
  return bootstrap.events.find((e) => e.is_next)?.id ?? null
}

export function getPreviousGameweek(bootstrap: Bootstrap): number | null {
  return bootstrap.events.find((e) => e.is_previous)?.id ?? null
}

/** Returns the current GW if active, otherwise the next GW, otherwise 1. */
export function getActiveGameweek(bootstrap: Bootstrap): number {
  return getCurrentGameweek(bootstrap) ?? getNextGameweek(bootstrap) ?? 1
}

export function isGameweekFinished(bootstrap: Bootstrap, gw: number): boolean {
  return bootstrap.events.find((e) => e.id === gw)?.finished ?? false
}

export function isDeadlinePassed(bootstrap: Bootstrap, gw: number): boolean {
  const event = bootstrap.events.find((e) => e.id === gw)
  if (!event) return false
  return Date.now() > event.deadline_time_epoch * 1000
}
