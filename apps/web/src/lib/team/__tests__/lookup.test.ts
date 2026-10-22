import { describe, it, expect } from 'vitest'
import { extractTeamId } from '../parse-link'
import { pageForRank } from '../page-for-rank'
import { fuzzyMatchTeamName } from '../fuzzy'

// ─── extractTeamId ────────────────────────────────────────────────────────────

describe('extractTeamId', () => {
  it('parses a bare integer', () => {
    expect(extractTeamId('1234567')).toBe(1234567)
  })

  it('parses the canonical FPL URL', () => {
    expect(extractTeamId('https://fantasy.premierleague.com/entry/1234567/event/8')).toBe(1234567)
  })

  it('parses a URL with a trailing slash', () => {
    expect(extractTeamId('https://fantasy.premierleague.com/entry/1234567/')).toBe(1234567)
  })

  it('parses just the path segment', () => {
    expect(extractTeamId('/entry/42/')).toBe(42)
  })

  it('returns null for a plain URL with no /entry/', () => {
    expect(extractTeamId('https://fantasy.premierleague.com/')).toBeNull()
  })

  it('returns null for a word string', () => {
    expect(extractTeamId('not-a-number')).toBeNull()
  })

  it('returns null for 0', () => {
    expect(extractTeamId('0')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractTeamId('')).toBeNull()
  })

  it('returns null for whitespace', () => {
    expect(extractTeamId('   ')).toBeNull()
  })

  it('trims whitespace before parsing', () => {
    expect(extractTeamId('  9876543  ')).toBe(9876543)
  })
})

// ─── pageForRank ──────────────────────────────────────────────────────────────

describe('pageForRank', () => {
  it('rank 1 → page 1', () => expect(pageForRank(1)).toBe(1))
  it('rank 50 → page 1', () => expect(pageForRank(50)).toBe(1))
  it('rank 51 → page 2', () => expect(pageForRank(51)).toBe(2))
  it('rank 100 → page 2', () => expect(pageForRank(100)).toBe(2))
  it('rank 101 → page 3', () => expect(pageForRank(101)).toBe(3))
  it('rank 4231 → page 85', () => expect(pageForRank(4231)).toBe(85))
  it('rank 49925 → page 999', () => expect(pageForRank(49925)).toBe(999))
  it('rank 50000 → page 1000', () => expect(pageForRank(50000)).toBe(1000))
})

// ─── fuzzyMatchTeamName ───────────────────────────────────────────────────────

describe('fuzzyMatchTeamName', () => {
  // Exact matches
  it('matches identical names', () => {
    expect(fuzzyMatchTeamName('Rampant Saka', 'Rampant Saka')).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(fuzzyMatchTeamName('rampant saka', 'Rampant Saka')).toBe(true)
  })

  // Emoji/punctuation tolerance
  it('ignores emoji in candidate', () => {
    expect(fuzzyMatchTeamName('Rampant Saka', 'Rampant Saka 🔥')).toBe(true)
  })

  it('ignores emoji in query', () => {
    expect(fuzzyMatchTeamName('Rampant Saka ⚡', 'Rampant Saka')).toBe(true)
  })

  it('ignores punctuation differences', () => {
    expect(fuzzyMatchTeamName("Saka's XI", 'Sakas XI')).toBe(true)
  })

  // Typo tolerance (≤10% of shorter string or 2 chars, whichever is larger)
  it('tolerates a single typo', () => {
    expect(fuzzyMatchTeamName('Rampant Saka', 'Rampant Sak')).toBe(true)
  })

  it('tolerates a two-char difference on a short name', () => {
    expect(fuzzyMatchTeamName('Top XI', 'Top X1')).toBe(true)
  })

  // Should not match unrelated names
  it('rejects completely different names', () => {
    expect(fuzzyMatchTeamName('Rampant Saka', 'Haaland United')).toBe(false)
  })

  // min tolerance is 2 edits regardless of length; need >2 edits to reject
  it('rejects names that differ by more than the tolerance', () => {
    expect(fuzzyMatchTeamName('Salah', 'Klopp')).toBe(false)
  })

  // Edge cases
  it('returns false when either side is empty after normalisation', () => {
    expect(fuzzyMatchTeamName('', 'Rampant Saka')).toBe(false)
    expect(fuzzyMatchTeamName('🔥', 'Rampant Saka')).toBe(false)
  })
})
