/**
 * Receipt detection and settlement for the daily refresh job.
 *
 * detectDecisions: runs after a GW deadline, reads actual FPL transfers for
 *   each user, compares with their stored brief, and writes decisions/intents/receipts.
 *
 * settleReceipts: runs every day; closes receipts whose 3-GW window has passed.
 *
 * Both are idempotent (safe to re-run).
 */

import {
  FplClient,
  labelDecision,
  inferIntent,
  computeReceiptWindow,
  settleDelta,
  type BriefTransferOption,
  type BriefContext,
} from '@finalball/agent'
import type { SupabaseClient } from '@finalball/db'

// ── Types for stored card payloads ────────────────────────────────────────────

// These mirror the shapes written by buildCardRows. We cast from jsonb.
interface StoredTransferCardTransfer {
  save: false
  sell: { player: { id: number; news?: string; status?: string } }
  topPick: { player: { id: number } }
  topPickRiskTag?: string
  alternatives?: Array<{
    candidate: { player: { id: number } }
    riskTag?: string
  }>
}

interface StoredTransferCardSave {
  save: true
}

type StoredTransferCardPayload = StoredTransferCardTransfer | StoredTransferCardSave

// ── Detection ──────────────────────────────────────────────────────────────────

/**
 * After the deadline of `previousGw`, read each user's actual FPL transfers
 * and compare with their stored brief to write decisions/intents/receipts.
 * Skips users who already have decisions for this GW (idempotent).
 */
export async function detectDecisions(
  db: SupabaseClient,
  fpl: FplClient,
  previousGw: number,
): Promise<void> {
  // 1. All users with a linked team
  const { data: users, error: usersError } = await db
    .from('profiles')
    .select('id, team_id')
    .not('team_id', 'is', null)

  if (usersError) throw new Error(`detectDecisions: profiles query failed: ${usersError.message}`)
  if (!users?.length) return

  const { windowStartGw, windowEndGw } = computeReceiptWindow(previousGw)

  // Fetch bootstrap once — shared across all users for name lookup + intent inference
  const bootstrap = await fpl.getBootstrap()
  const playerById = new Map(bootstrap.elements.map((p) => [p.id, p]))

  for (const user of users) {
    if (!user.team_id) continue
    try {
      await processUserDecisions(db, fpl, playerById, user.id, user.team_id, previousGw, windowStartGw, windowEndGw)
    } catch (err) {
      console.error(`[receipts] detectDecisions: user ${user.id} failed:`, err)
    }
  }
}

async function processUserDecisions(
  db: SupabaseClient,
  fpl: FplClient,
  playerById: Map<number, { id: number; web_name: string; news: string; status: string }>,
  userId: string,
  teamId: number,
  gw: number,
  windowStartGw: number,
  windowEndGw: number,
): Promise<void> {
  // Skip if already processed
  const { count } = await db
    .from('decisions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('gameweek', gw)
  if (count && count > 0) return

  // Find their brief for this GW
  const { data: brief } = await db
    .from('briefs')
    .select('id')
    .eq('user_id', userId)
    .eq('gameweek', gw)
    .eq('status', 'ready')
    .order('version', { ascending: false })
    .limit(1)
    .single()

  if (!brief) return // no brief for this GW — nothing to record

  // Get the brief's transfer cards
  const { data: cards } = await db
    .from('cards')
    .select('id, payload')
    .eq('brief_id', brief.id)
    .eq('type', 'transfer')
    .order('position', { ascending: true })

  if (!cards?.length) return

  // Get actual FPL transfers for this GW
  const allTransfers = await fpl.getEntryTransfers(teamId)
  const gwTransfers = allTransfers.filter((t) => t.event === gw)

  // Build results by matching each card to an actual transfer (by sell player)
  const matchedElementOuts = new Set<number>()
  const detections: Array<{
    cardId: string | null
    label: string
    riskTag: string | null
    actualTransfer: (typeof gwTransfers)[0] | null
    sellPlayerId: number | null
  }> = []

  for (const card of cards) {
    const payload = card.payload as StoredTransferCardPayload
    if (payload.save === true) continue // save card — handled below

    const sellId = payload.sell?.player?.id
    if (!sellId) continue

    const actual = gwTransfers.find((t) => t.element_out === sellId) ?? null
    if (actual) matchedElementOuts.add(sellId)

    // Build brief options for this card
    const options: BriefTransferOption[] = []
    if (payload.topPick?.player?.id) {
      options.push({
        buyPlayerId: payload.topPick.player.id,
        sellPlayerId: sellId,
        riskTag: (payload.topPickRiskTag as 'safe' | 'balanced' | 'bold' | null) ?? null,
      })
    }
    for (const alt of payload.alternatives ?? []) {
      if (alt.candidate?.player?.id) {
        options.push({
          buyPlayerId: alt.candidate.player.id,
          sellPlayerId: sellId,
          riskTag: (alt.riskTag as 'safe' | 'balanced' | 'bold' | null) ?? null,
        })
      }
    }

    const ctx: BriefContext = { options, savedTransfer: false }
    const { label, matchedOption } = labelDecision(ctx, actual)

    detections.push({
      cardId: card.id,
      label,
      riskTag: matchedOption?.riskTag ?? null,
      actualTransfer: actual,
      sellPlayerId: sellId,
    })
  }

  // Any actual transfer not matched to a card → own_move
  for (const t of gwTransfers) {
    if (!matchedElementOuts.has(t.element_out)) {
      detections.push({
        cardId: null,
        label: 'own_move',
        riskTag: null,
        actualTransfer: t,
        sellPlayerId: t.element_out,
      })
    }
  }

  if (!detections.length) return

  // Write each detection to decisions + intents + receipts
  for (const det of detections) {
    // Infer intent from the sold player's availability at detection time
    const soldPlayer = det.sellPlayerId ? playerById.get(det.sellPlayerId) : undefined
    const inferred: 'points' | 'funding' | 'injury_cover' = soldPlayer
      ? inferIntent(soldPlayer as Parameters<typeof inferIntent>[0])
      : 'points'

    // Include player names so the UI doesn't need a separate bootstrap fetch
    const actualMove = det.actualTransfer
      ? {
          element_in: det.actualTransfer.element_in,
          element_in_cost: det.actualTransfer.element_in_cost,
          element_in_name: playerById.get(det.actualTransfer.element_in)?.web_name ?? null,
          element_out: det.actualTransfer.element_out,
          element_out_cost: det.actualTransfer.element_out_cost,
          element_out_name: playerById.get(det.actualTransfer.element_out)?.web_name ?? null,
          event: det.actualTransfer.event,
          time: det.actualTransfer.time,
        }
      : null

    const { data: decision, error: dErr } = await db
      .from('decisions')
      .insert({
        user_id: userId,
        gameweek: gw,
        card_id: det.cardId,
        label: det.label as 'followed' | 'own_move' | 'ignored_rolled' | 'ignored_transferred',
        risk_tag: det.riskTag as 'safe' | 'balanced' | 'bold' | null,
        actual_move: actualMove,
      })
      .select('id')
      .single()

    if (dErr || !decision) {
      console.error(`[receipts] insert decision failed for user ${userId}:`, dErr?.message)
      continue
    }

    // Intent
    await db.from('intents').insert({ decision_id: decision.id, inferred })

    // Receipt (only for decisions with an actual transfer — ignored_rolled has nothing to track)
    if (det.label !== 'ignored_rolled') {
      await db.from('receipts').insert({
        decision_id: decision.id,
        window_start_gw: windowStartGw,
        window_end_gw: windowEndGw,
      })
    }
  }

  console.log(`[receipts] GW${gw}: ${detections.length} decision(s) for user ${userId}`)
}

// ── Settlement ─────────────────────────────────────────────────────────────────

/**
 * Closes all pending receipts whose 3-GW window has ended.
 * Pass the highest fully-finished GW (all matches played and data_checked).
 */
export async function settleReceipts(
  db: SupabaseClient,
  fpl: FplClient,
  finishedGw: number,
): Promise<void> {
  // Receipts whose window is fully within played GWs
  const { data: pending, error } = await db
    .from('receipts')
    .select('decision_id, window_start_gw, window_end_gw')
    .eq('status', 'pending')
    .lte('window_end_gw', finishedGw)

  if (error) throw new Error(`settleReceipts: receipts query failed: ${error.message}`)
  if (!pending?.length) return

  for (const receipt of pending) {
    try {
      await processReceiptSettlement(db, fpl, receipt.decision_id, receipt.window_start_gw, receipt.window_end_gw)
    } catch (err) {
      console.error(`[receipts] settle failed for decision ${receipt.decision_id}:`, err)
    }
  }
}

async function processReceiptSettlement(
  db: SupabaseClient,
  fpl: FplClient,
  decisionId: string,
  windowStartGw: number,
  windowEndGw: number,
): Promise<void> {
  const { data: decision } = await db
    .from('decisions')
    .select('actual_move')
    .eq('id', decisionId)
    .single()

  if (!decision?.actual_move) return
  const move = decision.actual_move as { element_in: number; element_out: number }

  const [inSummary, outSummary] = await Promise.all([
    fpl.getPlayerSummary(move.element_in),
    fpl.getPlayerSummary(move.element_out),
  ])

  const inPtsPerGw: Record<number, number> = {}
  for (const h of inSummary.history) {
    inPtsPerGw[h.round] = h.total_points
  }
  const outPtsPerGw: Record<number, number> = {}
  for (const h of outSummary.history) {
    outPtsPerGw[h.round] = h.total_points
  }

  const { playerInPts, playerOutPts, deltaPts } = settleDelta(
    inPtsPerGw,
    outPtsPerGw,
    windowStartGw,
    windowEndGw,
  )

  await db
    .from('receipts')
    .update({
      player_in_pts: playerInPts,
      player_out_pts: playerOutPts,
      delta_pts: deltaPts,
      status: 'settled',
      settled_at: new Date().toISOString(),
    })
    .eq('decision_id', decisionId)

  console.log(
    `[receipts] settled decision ${decisionId}: +in=${playerInPts} -out=${playerOutPts} delta=${deltaPts > 0 ? '+' : ''}${deltaPts}`,
  )
}
