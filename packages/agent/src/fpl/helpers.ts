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

/**
 * Returns the gameweek to plan for. While GW N is live but its deadline has
 * already passed, return GW N+1 (if FPL has set is_next) so users can plan
 * ahead instead of staring at a locked brief.
 */
export function getActiveGameweek(bootstrap: Bootstrap): number {
  const current = bootstrap.events.find((e) => e.is_current)
  if (current) {
    const deadlinePassed = Date.now() > current.deadline_time_epoch * 1000
    if (deadlinePassed) {
      const next = bootstrap.events.find((e) => e.is_next)
      if (next) return next.id
    }
    return current.id
  }
  return getNextGameweek(bootstrap) ?? 1
}

export function isGameweekFinished(bootstrap: Bootstrap, gw: number): boolean {
  return bootstrap.events.find((e) => e.id === gw)?.finished ?? false
}

export function isDeadlinePassed(bootstrap: Bootstrap, gw: number): boolean {
  const event = bootstrap.events.find((e) => e.id === gw)
  if (!event) return false
  return Date.now() > event.deadline_time_epoch * 1000
}
