import type { Bootstrap, Entry, Fixture, LeagueStandingsResponse } from './types.js'

const FPL_BASE = 'https://fantasy.premierleague.com/api'
const USER_AGENT =
  'FinalBall/0.1 (fantasy-football analysis tool; contact: manavkothari17@gmail.com)'

interface FplClientOptions {
  maxConcurrent?: number
  retries?: number
  baseRetryDelay?: number
}

export class FplClient {
  private maxConcurrent: number
  private retries: number
  private baseRetryDelay: number
  private active = 0
  private queue: Array<() => void> = []

  constructor(options: FplClientOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 3
    this.retries = options.retries ?? 3
    this.baseRetryDelay = options.baseRetryDelay ?? 1000
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
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    })

    if (res.status === 429 || res.status === 503) {
      if (attempt >= this.retries) throw new FplError(res.status, url)
      const delay = this.baseRetryDelay * 2 ** attempt
      await sleep(delay)
      return this.fetchWithRetry<T>(url, attempt + 1)
    }

    if (!res.ok) {
      throw new FplError(res.status, url)
    }

    return res.json() as Promise<T>
  }

  async fetch<T>(url: string): Promise<T> {
    return this.throttle(() => this.fetchWithRetry<T>(url))
  }

  async getBootstrap(): Promise<Bootstrap> {
    return this.fetch(`${FPL_BASE}/bootstrap-static/`)
  }

  async getFixtures(gameweek?: number): Promise<Fixture[]> {
    const url = gameweek ? `${FPL_BASE}/fixtures/?event=${gameweek}` : `${FPL_BASE}/fixtures/`
    return this.fetch(url)
  }

  async getEntry(teamId: number): Promise<Entry> {
    return this.fetch(`${FPL_BASE}/entry/${teamId}/`)
  }

  async getLeagueStandings(leagueId: number, page: number): Promise<LeagueStandingsResponse> {
    return this.fetch(`${FPL_BASE}/leagues-classic/${leagueId}/standings/?page_standings=${page}`)
  }
}

class FplError extends Error {
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
