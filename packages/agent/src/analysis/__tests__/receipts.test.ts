import { describe, it, expect } from 'vitest'
import {
  labelDecision,
  inferIntent,
  computeReceiptWindow,
  settleDelta,
  type BriefContext,
} from '../receipts.js'
import type { EntryTransfer } from '../../fpl/types.js'
import { makePlayer } from './helpers.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTransfer(
  elementIn: number,
  elementOut: number,
  event = 12,
): EntryTransfer {
  return {
    element_in: elementIn,
    element_in_cost: 72,
    element_out: elementOut,
    element_out_cost: 65,
    entry: 3434860,
    event,
    time: '2026-11-14T07:30:00.000Z',
  }
}

const TOP_PICK: BriefContext['options'] = [
  { buyPlayerId: 100, sellPlayerId: 50, riskTag: 'balanced' },
  { buyPlayerId: 101, sellPlayerId: 50, riskTag: 'safe' },
  { buyPlayerId: 102, sellPlayerId: 50, riskTag: 'bold' },
]

// ── labelDecision ─────────────────────────────────────────────────────────────

describe('labelDecision', () => {
  describe('followed', () => {
    it('labels "followed" when user buys the top pick (index 0)', () => {
      const brief: BriefContext = { options: TOP_PICK, savedTransfer: false }
      const result = labelDecision(brief, makeTransfer(100, 50))
      expect(result.label).toBe('followed')
      expect(result.matchedOption?.buyPlayerId).toBe(100)
      expect(result.matchedOption?.riskTag).toBe('balanced')
    })

    it('labels "followed" when user buys an alternative (index 1)', () => {
      const brief: BriefContext = { options: TOP_PICK, savedTransfer: false }
      const result = labelDecision(brief, makeTransfer(101, 50))
      expect(result.label).toBe('followed')
      expect(result.matchedOption?.buyPlayerId).toBe(101)
    })

    it('labels "followed" when user buys the last alternative (index 2)', () => {
      const brief: BriefContext = { options: TOP_PICK, savedTransfer: false }
      const result = labelDecision(brief, makeTransfer(102, 50))
      expect(result.label).toBe('followed')
    })
  })

  describe('own_move', () => {
    it('labels "own_move" when user transfers but brief said save (no card)', () => {
      const brief: BriefContext = { options: null, savedTransfer: true }
      const result = labelDecision(brief, makeTransfer(999, 50))
      expect(result.label).toBe('own_move')
      expect(result.matchedOption).toBeNull()
    })
  })

  describe('ignored_rolled', () => {
    it('labels "ignored_rolled" when brief had a card but no transfer was made', () => {
      const brief: BriefContext = { options: TOP_PICK, savedTransfer: false }
      const result = labelDecision(brief, null)
      expect(result.label).toBe('ignored_rolled')
    })

    it('labels "ignored_rolled" when brief said save and user also saved', () => {
      const brief: BriefContext = { options: null, savedTransfer: true }
      const result = labelDecision(brief, null)
      expect(result.label).toBe('ignored_rolled')
    })
  })

  describe('ignored_transferred', () => {
    it('labels "ignored_transferred" when user buys a player not on the brief', () => {
      const brief: BriefContext = { options: TOP_PICK, savedTransfer: false }
      const result = labelDecision(brief, makeTransfer(999, 50))
      expect(result.label).toBe('ignored_transferred')
      expect(result.matchedOption).toBeNull()
    })
  })
})

// ── inferIntent ───────────────────────────────────────────────────────────────

describe('inferIntent', () => {
  it('returns "injury_cover" when player has non-available status', () => {
    const p = makePlayer({ id: 1, element_type: 3, team: 1, now_cost: 70, status: 'i' })
    expect(inferIntent(p)).toBe('injury_cover')
  })

  it('returns "injury_cover" when player has doubtful status', () => {
    const p = makePlayer({ id: 1, element_type: 3, team: 1, now_cost: 70, status: 'd' })
    expect(inferIntent(p)).toBe('injury_cover')
  })

  it('returns "injury_cover" when player has non-empty news', () => {
    const p = makePlayer({ id: 1, element_type: 3, team: 1, now_cost: 70 })
    Object.assign(p, { news: 'Hamstring injury — 50% chance of playing' })
    expect(inferIntent(p)).toBe('injury_cover')
  })

  it('returns "points" for a fully available player with no news', () => {
    const p = makePlayer({ id: 1, element_type: 3, team: 1, now_cost: 70, status: 'a' })
    expect(inferIntent(p)).toBe('points')
  })
})

// ── computeReceiptWindow ──────────────────────────────────────────────────────

describe('computeReceiptWindow', () => {
  it('returns a 3-GW window starting at transferGw + 1', () => {
    const { windowStartGw, windowEndGw } = computeReceiptWindow(12)
    expect(windowStartGw).toBe(13)
    expect(windowEndGw).toBe(15)
  })
})

// ── settleDelta ───────────────────────────────────────────────────────────────

describe('settleDelta', () => {
  it('sums points over the 3-GW window and computes delta', () => {
    const inPts = { 13: 6, 14: 12, 15: 2 }  // 20 total
    const outPts = { 13: 8, 14: 2, 15: 6 }  // 16 total
    const result = settleDelta(inPts, outPts, 13, 15)
    expect(result.playerInPts).toBe(20)
    expect(result.playerOutPts).toBe(16)
    expect(result.deltaPts).toBe(4)
  })

  it('handles missing GW entries as 0', () => {
    const inPts = { 13: 6 }   // player blanked GW14 and GW15
    const outPts = { 14: 8 }
    const result = settleDelta(inPts, outPts, 13, 15)
    expect(result.playerInPts).toBe(6)
    expect(result.playerOutPts).toBe(8)
    expect(result.deltaPts).toBe(-2)
  })

  it('returns a negative delta when the move backfired', () => {
    const inPts = { 13: 2, 14: 2, 15: 2 }   // 6 total
    const outPts = { 13: 12, 14: 15, 15: 8 } // 35 total
    const result = settleDelta(inPts, outPts, 13, 15)
    expect(result.deltaPts).toBe(-29)
  })
})
