import type { EntryTransfer, Player } from '../fpl/types.js'
import type { ChipName, ChipTimingAdvice } from './chips.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DecisionLabel =
  | 'followed'            // user bought the top pick or one of the 3 alternatives (D7.11)
  | 'own_move'            // user transferred when brief said save (no matching card)
  | 'ignored_rolled'      // brief suggested a move; user rolled the free transfer
  | 'ignored_transferred' // brief suggested a move; user transferred a different player

export type CaptainDecisionLabel =
  | 'captain_followed'  // user captained the agent's #1 captain pick
  | 'captain_ignored'   // user captained someone else

export type ChipDecisionLabel =
  | 'chip_followed'  // chip matched what the agent recommended for this GW
  | 'chip_ignored'   // chip was played but not what the agent recommended

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
 * Infers the intent behind a transfer.
 * Injury check takes priority; then funding (buy is ≥0.5m cheaper than sell);
 * otherwise defaults to 'points'.
 * Costs are in tenths (FPL API convention), so 0.5m = 5 tenths.
 */
export function inferIntent(
  playerOut: Player,
  elementInCost?: number,
  elementOutCost?: number,
): InferredIntent {
  if (playerOut.status !== 'a' || playerOut.news !== '') {
    return 'injury_cover'
  }
  if (elementInCost !== undefined && elementOutCost !== undefined && elementInCost < elementOutCost - 4) {
    return 'funding'
  }
  return 'points'
}

// ── Captain label assignment ──────────────────────────────────────────────────

export interface BriefCaptainContext {
  captainPlayerId: number
  vcPlayerId: number | null
}

/**
 * Assigns a captain decision label.
 * captain_followed = captained the agent's #1 pick.
 * captain_ignored  = captained anyone else (including VC, alternatives, own choice).
 */
export function labelCaptainDecision(
  brief: BriefCaptainContext,
  actualCaptainId: number | null,
): CaptainDecisionLabel {
  if (actualCaptainId === null) return 'captain_ignored'
  if (actualCaptainId === brief.captainPlayerId) return 'captain_followed'
  return 'captain_ignored'
}

// ── Chip label assignment ─────────────────────────────────────────────────────

export interface BriefChipContext {
  timing: ChipTimingAdvice[]
}

/**
 * Returns 'chip_followed' if the brief's timing had a recommendation for
 * this exact chip in this exact gameweek; 'chip_ignored' otherwise.
 */
export function labelChipDecision(
  brief: BriefChipContext,
  activeChip: string,
  gameweek: number,
): ChipDecisionLabel {
  const recommended = brief.timing.find(
    (t) => t.chip === (activeChip as ChipName) && t.targetGwId === gameweek,
  )
  return recommended ? 'chip_followed' : 'chip_ignored'
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

/** Returns the 1-GW window for a captain decision (US-5.5). */
export function computeCaptainReceiptWindow(gameweek: number): {
  windowStartGw: number
  windowEndGw: number
} {
  return { windowStartGw: gameweek, windowEndGw: gameweek }
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
