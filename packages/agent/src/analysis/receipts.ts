import type { EntryTransfer, Player } from '../fpl/types.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DecisionLabel =
  | 'followed'            // user bought the top pick or one of the 3 alternatives (D7.11)
  | 'own_move'            // user transferred when brief said save (no matching card)
  | 'ignored_rolled'      // brief suggested a move; user rolled the free transfer
  | 'ignored_transferred' // brief suggested a move; user transferred a different player

export type InferredIntent = 'points' | 'funding' | 'injury_cover'

/** Minimal transfer card data the pipeline needs from a brief. */
export interface BriefTransferOption {
  buyPlayerId: number
  sellPlayerId: number
  riskTag: 'safe' | 'balanced' | 'bold' | null
}

export interface BriefContext {
  /** Top pick at index 0, then up to 3 alternatives (D2.1). Null means no card in brief. */
  options: BriefTransferOption[] | null
  /** True when the brief's recommendation was to save the free transfer (D2.2). */
  savedTransfer: boolean
}

export interface LabelResult {
  label: DecisionLabel
  /** The brief option the user matched, if label === 'followed'. */
  matchedOption: BriefTransferOption | null
}

// ── Label assignment ──────────────────────────────────────────────────────────

/**
 * Assigns a decision label given what the brief recommended and what the user
 * actually did (from the FPL transfers endpoint).
 *
 * Rules (D7.11):
 *   followed             = actual buy matches the top pick or any alternative
 *   own_move             = user transferred but brief had no card (or said save)
 *   ignored_rolled       = brief had a card, user had FTs, no transfer made
 *   ignored_transferred  = brief had a card, user transferred a different player
 */
export function labelDecision(
  brief: BriefContext,
  actualTransfer: EntryTransfer | null,
): LabelResult {
  const hasCard = brief.options !== null && brief.options.length > 0

  // User made a transfer
  if (actualTransfer !== null) {
    if (!hasCard) {
      // Brief said save (or no card); this is the user's own initiative
      return { label: 'own_move', matchedOption: null }
    }
    // Check if the bought player appears in the brief options (D7.11)
    const matched = brief.options!.find(
      (opt) => opt.buyPlayerId === actualTransfer.element_in,
    ) ?? null
    if (matched) {
      return { label: 'followed', matchedOption: matched }
    }
    return { label: 'ignored_transferred', matchedOption: null }
  }

  // User did not transfer
  if (hasCard) {
    // Brief suggested a move but user rolled
    return { label: 'ignored_rolled', matchedOption: null }
  }

  // Brief said save and user saved — no decision to record
  return { label: 'ignored_rolled', matchedOption: null }
}

// ── Intent inference ──────────────────────────────────────────────────────────

/**
 * Infers the intent behind a transfer from the sold player's status.
 * Funding detection (D7.9) is deferred — we default non-injury moves to 'points'.
 */
export function inferIntent(playerOut: Player): InferredIntent {
  if (playerOut.status !== 'a' || playerOut.news !== '') {
    return 'injury_cover'
  }
  return 'points'
}

// ── Receipt window ────────────────────────────────────────────────────────────

/** Returns the 3-GW window over which a transfer is judged (D7.2). */
export function computeReceiptWindow(transferGw: number): {
  windowStartGw: number
  windowEndGw: number
} {
  return {
    windowStartGw: transferGw + 1,
    windowEndGw: transferGw + 3,
  }
}

// ── Delta settlement ──────────────────────────────────────────────────────────

/**
 * Computes the final receipt delta once the window has been played (D7.2).
 * ptsPerGw maps are { [gw]: totalPoints }, summed over [windowStartGw, windowEndGw].
 */
export function settleDelta(
  playerInPtsPerGw: Record<number, number>,
  playerOutPtsPerGw: Record<number, number>,
  windowStartGw: number,
  windowEndGw: number,
): {
  playerInPts: number
  playerOutPts: number
  deltaPts: number
} {
  let playerInPts = 0
  let playerOutPts = 0
  for (let gw = windowStartGw; gw <= windowEndGw; gw++) {
    playerInPts += playerInPtsPerGw[gw] ?? 0
    playerOutPts += playerOutPtsPerGw[gw] ?? 0
  }
  return { playerInPts, playerOutPts, deltaPts: playerInPts - playerOutPts }
}
