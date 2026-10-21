import type { Bootstrap, Entry, EntryHistory, EntryPicks, Fixture, LeagueStandingsResponse } from './types'
import type { CacheAdapter } from './cache'

const FPL_BASE = 'https://fantasy.premierleague.com/api'

// ms — how long each resource type stays fresh
const TTL_BOOTSTRAP = 5 * 60_000
const TTL_FIXTURES = 60 * 60_000
const TTL_ENTRY = 5 * 60_000
const TTL_PICKS = 5 * 60_000
const TTL_HISTORY = 10 * 60_000
const TTL_LEAGUES = 60 * 60_000

// FPL returns this string in the 503 body while live scores are updating.
// Needs a longer, fixed wait rather than normal exponential backoff.
const GAME_UPDATING_SUBSTR = 'The game is being updated'
const GAME_UPDATING_DELAY_MS = 30_000

interface FplClientOptions {
  maxConcurrent?: number
  retries?: number
  baseRetryDelay?: number
  cache?: CacheAdapter
}

export class FplClient {
  private maxConcurrent: number
  private retries: number
  private baseRetryDelay: number
  private active = 0
  private queue: Array<() => void> = []
  private cache: CacheAdapter | null

  constructor(options: FplClientOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3
    this.retries = options.retries ?? 3
    this.baseRetryDelay = options.baseRetryDelay ?? 1_000
    this.cache = options.cache ?? null
  }

  private userAgent(): string {
    return (
      process.env['FPL_USER_AGENT'] ??
      'FinalBall/0.1 (+https://finalball.manavpkothari.dev)'
    )
  }

  // ±25% jitter to spread retries when multiple requests back off simultaneously
  private jitter(ms: number): number {
    return ms * (0.75 + Math.random() * 0.5)
  }

  private async throttle<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.active++
    try {
      return await fn()
    } finally {
      this.active--
      this.queue.shift()?.()
    }
  }

  private async fetchWithRetry<T>(url: string, attempt = 0): Promise<T> {
    const res = await fetch(url, {
      headers: { 'User-Agent': this.userAgent() },
      signal: AbortSignal.timeout(30_000),
    })

    if (res.status === 503) {
      if (attempt >= this.retries) throw new FplError(res.status, url)
      // Detect mid-update window and use a fixed 30s hold instead of backoff
      let isUpdating = false
      try {
        isUpdating = (await res.clone().text()).includes(GAME_UPDATING_SUBSTR)
      } catch { /* ignore clone/parse errors */ }
      await sleep(isUpdating ? GAME_UPDATING_DELAY_MS : this.jitter(this.baseRetryDelay * 2 ** attempt))
      return this.fetchWithRetry<T>(url, attempt + 1)
    }

    if (res.status === 429) {
      if (attempt >= this.retries) throw new FplError(res.status, url)
      await sleep(this.jitter(this.baseRetryDelay * 2 ** attempt))
      return this.fetchWithRetry<T>(url, attempt + 1)
    }

    if (!res.ok) throw new FplError(res.status, url)

    return res.json() as Promise<T>
  }

  private async fetchCached<T>(key: string, url: string, ttlMs: number): Promise<T> {
    if (this.cache) {
      const hit = await this.cache.get(key)
      if (hit && Date.now() - hit.fetchedAt < ttlMs) {
        return hit.payload as T
      }
    }
    const data = await this.throttle(() => this.fetchWithRetry<T>(url))
    if (this.cache) await this.cache.set(key, data)
    return data
  }

  async getBootstrap(): Promise<Bootstrap> {
    return this.fetchCached('bootstrap', `${FPL_BASE}/bootstrap-static/`, TTL_BOOTSTRAP)
  }

  async getFixtures(gameweek?: number): Promise<Fixture[]> {
    const key = gameweek ? `fixtures:${gameweek}` : 'fixtures'
    const url = gameweek ? `${FPL_BASE}/fixtures/?event=${gameweek}` : `${FPL_BASE}/fixtures/`
    return this.fetchCached(key, url, TTL_FIXTURES)
  }

  async getEntry(teamId: number): Promise<Entry> {
    return this.fetchCached(`entry:${teamId}`, `${FPL_BASE}/entry/${teamId}/`, TTL_ENTRY)
  }

  async getEntryPicks(teamId: number, gameweek: number): Promise<EntryPicks> {
    return this.fetchCached(
      `picks:${teamId}:${gameweek}`,
      `${FPL_BASE}/entry/${teamId}/event/${gameweek}/picks/`,
      TTL_PICKS,
    )
  }

  async getEntryHistory(teamId: number): Promise<EntryHistory> {
    return this.fetchCached(
      `history:${teamId}`,
      `${FPL_BASE}/entry/${teamId}/history/`,
      TTL_HISTORY,
    )
  }

  async getLeagueStandings(leagueId: number, page: number): Promise<LeagueStandingsResponse> {
    return this.fetchCached(
      `leagues:${leagueId}:${page}`,
      `${FPL_BASE}/leagues-classic/${leagueId}/standings/?page_standings=${page}`,
      TTL_LEAGUES,
    )
  }
}

export class FplError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`FPL API error ${status}: ${url}`)
    this.name = 'FplError'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
