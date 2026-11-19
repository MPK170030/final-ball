/**
 * Receipt detection and settlement for the daily refresh job.
 *
 * detectDecisions: runs after a GW deadline, reads actual FPL transfers and
 *   captain choices for each user, compares with their stored brief, and writes
 *   decisions/intents/receipts rows. Also creates pending counter_records.
 *
 * settleReceipts: runs every day; closes receipts whose window has passed.
 *
 * settleCounterRecords: runs every day; compares user vs agent pts for settled
 *   counter records and writes the verdict.
 *
 * All functions are idempotent (safe to re-run).
 */

import {
  FplClient,
  labelDecision,
  labelCaptainDecision,
  labelChipDecision,
  inferIntent,
  computeReceiptWindow,
  computeCaptainReceiptWindow,
  settleDelta,
  type BriefTransferOption,
  type BriefContext,
  type BriefCaptainContext,
  type BriefChipContext,
} from '@finalball/agent'
import type { SupabaseClient } from '@finalball/db'

// ── Types for stored card payloads ────────────────────────────────────────────

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

interface StoredCaptainCardPayload {
  captain: { player: { id: number; web_name: string }; riskTag?: string }
  vc: { player: { id: number; web_name: string } }
}

interface StoredChipCardPayload {
  timing?: Array<{ chip: string; targetGwId?: number; recommendation: string; provisional: boolean }>
}

// ── Detection ──────────────────────────────────────────────────────────────────

/**
 * After the deadline of `previousGw`, read each user's actual FPL transfers
 * and captain choice, compare with their stored brief to write decisions/intents/receipts
 * and pending counter_records. Skips users already processed for this GW (idempotent).
 */
export async function detectDecisions(
  db: SupabaseClient,
  fpl: FplClient,
  previousGw: number,
): Promise<void> {
  const { data: users, error: usersError } = await db
    .from('profiles')
    .select('id, team_id')
    .not('team_id', 'is', null)

  if (usersError) throw new Error(`detectDecisions: profiles query failed: ${usersError.message}`)
  if (!users?.length) return

  const bootstrap = await fpl.getBootstrap()
  const playerById = new Map(bootstrap.elements.map((p) => [p.id, p]))

  for (const user of users) {
    if (!user.team_id) continue
    try {
      await processUserDecisions(db, fpl, playerById, user.id, user.team_id, previousGw)
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

  if (!brief) return

  // Get all brief cards (transfers + captain)
  const { data: cards } = await db
    .from('cards')
    .select('id, type, payload')
    .eq('brief_id', brief.id)
    .in('type', ['transfer', 'captain', 'chip'])
    .order('position', { ascending: true })

  if (!cards?.length) return

  const transferCards = cards.filter((c) => c.type === 'transfer')
  const captainCard = cards.find((c) => c.type === 'captain') ?? null
  const chipCard = cards.find((c) => c.type === 'chip') ?? null

  // Fetch actual FPL data in parallel
  const { windowStartGw, windowEndGw } = computeReceiptWindow(gw)
  const [allTransfers, picks] = await Promise.all([
    fpl.getEntryTransfers(teamId),
    (captainCard || chipCard) ? fpl.getEntryPicks(teamId, gw).catch(() => null) : Promise.resolve(null),
  ])
  const gwTransfers = allTransfers.filter((t) => t.event === gw)

  // Track all decision IDs by card_id for counter_record wiring
  const decisionIdByCardId = new Map<string, string>()

  // ── Transfer decisions ────────────────────────────────────────────────────

  const matchedElementOuts = new Set<number>()
  const detections: Array<{
    cardId: string | null
    label: string
    riskTag: string | null
    actualTransfer: (typeof gwTransfers)[0] | null
    sellPlayerId: number | null
  }> = []

  for (const card of transferCards) {
    const payload = card.payload as StoredTransferCardPayload
    if (payload.save === true) continue

    const sellId = payload.sell?.player?.id
    if (!sellId) continue

    const actual = gwTransfers.find((t) => t.element_out === sellId) ?? null
    if (actual) matchedElementOuts.add(sellId)

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

  // Write transfer decisions
  for (const det of detections) {
    const soldPlayer = det.sellPlayerId ? playerById.get(det.sellPlayerId) : undefined
    const inferred: 'points' | 'funding' | 'injury_cover' = soldPlayer
      ? inferIntent(
          soldPlayer as Parameters<typeof inferIntent>[0],
          det.actualTransfer?.element_in_cost,
          det.actualTransfer?.element_out_cost,
        )
      : 'points'

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
        kind: 'transfer',
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

    if (det.cardId) decisionIdByCardId.set(det.cardId, decision.id)

    await db.from('intents').insert({ decision_id: decision.id, inferred })

    if (det.label !== 'ignored_rolled') {
      await db.from('receipts').insert({
        decision_id: decision.id,
        window_start_gw: windowStartGw,
        window_end_gw: windowEndGw,
      })
    }
  }

  // ── Captain decision ──────────────────────────────────────────────────────

  if (captainCard && picks) {
    const captainPayload = captainCard.payload as StoredCaptainCardPayload
    const agentCaptainId = captainPayload?.captain?.player?.id
    const agentCaptainName = captainPayload?.captain?.player?.web_name ?? null
    const riskTag = (captainPayload?.captain?.riskTag as 'safe' | 'balanced' | 'bold' | null) ?? null

    if (agentCaptainId) {
      const actualCaptainPick = picks.picks.find((p) => p.is_captain)
      const actualCaptainId = actualCaptainPick?.element ?? null
      const actualCaptainName = actualCaptainId ? (playerById.get(actualCaptainId)?.web_name ?? null) : null

      const briefCtx: BriefCaptainContext = { captainPlayerId: agentCaptainId, vcPlayerId: null }
      const label = labelCaptainDecision(briefCtx, actualCaptainId)

      const captainMove = {
        element_in: actualCaptainId ?? agentCaptainId,
        element_in_name: actualCaptainName ?? agentCaptainName,
        element_out: agentCaptainId,
        element_out_name: agentCaptainName,
      }

      const { data: captainDecision, error: cdErr } = await db
        .from('decisions')
        .insert({
          user_id: userId,
          gameweek: gw,
          kind: 'captain',
          card_id: captainCard.id,
          label,
          risk_tag: label === 'captain_followed' ? riskTag : null,
          actual_move: captainMove,
        })
        .select('id')
        .single()

      if (!cdErr && captainDecision) {
        decisionIdByCardId.set(captainCard.id, captainDecision.id)
        const { windowStartGw: cs, windowEndGw: ce } = computeCaptainReceiptWindow(gw)
        await db.from('receipts').insert({
          decision_id: captainDecision.id,
          window_start_gw: cs,
          window_end_gw: ce,
        })
      }
    }
  }

  // ── Chip decision ─────────────────────────────────────────────────────────

  if (chipCard && picks?.active_chip) {
    const chipPayload = chipCard.payload as StoredChipCardPayload
    const briefCtx: BriefChipContext = { timing: (chipPayload.timing ?? []) as BriefChipContext['timing'] }
    const label = labelChipDecision(briefCtx, picks.active_chip, gw)

    await db.from('decisions').insert({
      user_id: userId,
      gameweek: gw,
      kind: 'chip',
      card_id: chipCard.id,
      label,
      risk_tag: null,
      actual_move: { chip: picks.active_chip },
    })
    // No intent or receipt for chip decisions — no points delta to compute
  }

  // ── Counter records ───────────────────────────────────────────────────────

  const allCardIds = cards.map((c) => c.id)
  if (allCardIds.length > 0) {
    const { data: counters } = await db
      .from('counters')
      .select('id, card_id, outcome, new_payload')
      .in('card_id', allCardIds)
      .eq('status', 'ok')
      .not('outcome', 'in', '("declined")')

    for (const counter of counters ?? []) {
      const decisionId = decisionIdByCardId.get(counter.card_id)
      if (!decisionId) continue

      const userChoice = resolveUserChoice(
        counter.outcome as 'held' | 'changed_fact' | 'accepted_preference',
        counter.new_payload as { newPick?: { playerName: string } } | null,
        detections.find((d) => d.cardId === counter.card_id) ?? null,
        playerById,
      )
      if (!userChoice) continue

      await db.from('counter_records').upsert(
        { counter_id: counter.id, user_choice: userChoice, status: 'pending' },
        { onConflict: 'counter_id', ignoreDuplicates: true },
      )
    }
  }

  console.log(`[receipts] GW${gw}: ${detections.length} transfer decision(s), captain=${captainCard ? 'yes' : 'no'}, chip=${picks?.active_chip ?? 'none'} for user ${userId}`)
}

function resolveUserChoice(
  outcome: 'held' | 'changed_fact' | 'accepted_preference',
  newPayload: { newPick?: { playerName: string } } | null,
  detection: { label: string; actualTransfer: { element_in: number } | null } | null,
  playerById: Map<number, { id: number; web_name: string; news: string; status: string }>,
): 'agent_original' | 'agent_changed' | 'own' | null {
  if (outcome === 'accepted_preference') return 'own'

  if (outcome === 'held') {
    if (detection?.label === 'followed') return 'agent_original'
    return 'own'
  }

  if (outcome === 'changed_fact') {
    if (!detection?.actualTransfer) return 'own'
    // User bought the agent's original pick despite the new info
    if (detection.label === 'followed') return 'agent_original'
    // User bought the agent's new pick (after changed_fact updated the recommendation)
    const newPickName = newPayload?.newPick?.playerName?.toLowerCase()
    const actualBuyName = playerById.get(detection.actualTransfer.element_in)?.web_name?.toLowerCase()
    if (newPickName && actualBuyName && newPickName === actualBuyName) return 'agent_changed'
    return 'own'
  }

  return null
}

// ── Transfer receipt settlement ───────────────────────────────────────────────

/**
 * Closes all pending receipts whose window has ended.
 * Pass the highest fully-finished GW (all matches played and data_checked).
 */
export async function settleReceipts(
  db: SupabaseClient,
  fpl: FplClient,
  finishedGw: number,
): Promise<void> {
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
  // For both transfers and captain decisions, actual_move uses element_in / element_out
  const move = decision.actual_move as { element_in: number; element_out: number }

  const [inSummary, outSummary] = await Promise.all([
    fpl.getPlayerSummary(move.element_in),
    fpl.getPlayerSummary(move.element_out),
  ])

  const inPtsPerGw: Record<number, number> = {}
  for (const h of inSummary.history) inPtsPerGw[h.round] = h.total_points

  const outPtsPerGw: Record<number, number> = {}
  for (const h of outSummary.history) outPtsPerGw[h.round] = h.total_points

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
    `[receipts] settled decision ${decisionId}: +in=${playerInPts} -out=${playerOutPts} delta=${deltaPts >= 0 ? '+' : ''}${deltaPts}`,
  )
}

// ── Counter record settlement ──────────────────────────────────────────────────

const VERDICT_THRESHOLD_PTS = 2

/**
 * Settles pending counter_records whose associated receipt is now settled.
 * Compares what the user did against what the agent originally recommended.
 */
export async function settleCounterRecords(
  db: SupabaseClient,
  fpl: FplClient,
  finishedGw: number,
): Promise<void> {
  // Find pending counter_records linked to settled receipts
  const { data: pending, error } = await db
    .from('counter_records')
    .select('counter_id, user_choice')
    .eq('status', 'pending')

  if (error) throw new Error(`settleCounterRecords: query failed: ${error.message}`)
  if (!pending?.length) return

  for (const cr of pending) {
    try {
      await processCounterRecordSettlement(db, fpl, cr.counter_id, cr.user_choice as string, finishedGw)
    } catch (err) {
      console.error(`[receipts] counter_record settle failed for ${cr.counter_id}:`, err)
    }
  }
}

async function processCounterRecordSettlement(
  db: SupabaseClient,
  fpl: FplClient,
  counterId: string,
  userChoice: string,
  finishedGw: number,
): Promise<void> {
  // Get the counter → card → find the decision for that card + gameweek
  const { data: counter } = await db
    .from('counters')
    .select('card_id, gameweek, new_payload')
    .eq('id', counterId)
    .single()

  if (!counter) return

  // Find the decision + receipt
  const { data: decision } = await db
    .from('decisions')
    .select('id, actual_move')
    .eq('card_id', counter.card_id)
    .eq('gameweek', counter.gameweek)
    .maybeSingle()

  if (!decision) return

  const { data: receipt } = await db
    .from('receipts')
    .select('player_in_pts, player_out_pts, delta_pts, window_start_gw, window_end_gw, status')
    .eq('decision_id', decision.id)
    .maybeSingle()

  if (!receipt || receipt.status !== 'settled') return
  if (receipt.window_end_gw > finishedGw) return

  const userDelta = receipt.delta_pts ?? 0

  // For agent_original: user and agent agree — record the delta, verdict = even
  if (userChoice === 'agent_original') {
    await db.from('counter_records').update({
      delta_pts: userDelta,
      verdict: 'even',
      status: 'settled',
      settled_at: new Date().toISOString(),
    }).eq('counter_id', counterId)
    return
  }

  // For own / agent_changed: compare user's delta vs what the agent originally recommended
  const { data: cardRow } = await db
    .from('cards')
    .select('payload')
    .eq('id', counter.card_id)
    .single()

  if (!cardRow) return
  const cardPayload = cardRow.payload as Record<string, unknown>
  const topPick = cardPayload['topPick'] as Record<string, unknown> | undefined
  const agentPickId = (topPick?.['player'] as Record<string, unknown> | undefined)?.['id'] as number | undefined

  if (!agentPickId) {
    // Captain card — just settle with user delta
    await db.from('counter_records').update({
      delta_pts: userDelta,
      verdict: 'even',
      status: 'settled',
      settled_at: new Date().toISOString(),
    }).eq('counter_id', counterId)
    return
  }

  // Fetch agent's original pick pts over the same window
  const agentSummary = await fpl.getPlayerSummary(agentPickId)
  const agentPtsPerGw: Record<number, number> = {}
  for (const h of agentSummary.history) agentPtsPerGw[h.round] = h.total_points

  let agentPts = 0
  for (let gw = receipt.window_start_gw; gw <= receipt.window_end_gw; gw++) {
    agentPts += agentPtsPerGw[gw] ?? 0
  }

  const playerOutPts = receipt.player_out_pts ?? 0
  const agentDelta = agentPts - playerOutPts

  let verdict: 'agent_right' | 'user_right' | 'even'
  if (agentDelta - userDelta > VERDICT_THRESHOLD_PTS) {
    verdict = 'agent_right'
  } else if (userDelta - agentDelta > VERDICT_THRESHOLD_PTS) {
    verdict = 'user_right'
  } else {
    verdict = 'even'
  }

  await db.from('counter_records').update({
    delta_pts: userDelta,
    verdict,
    status: 'settled',
    settled_at: new Date().toISOString(),
  }).eq('counter_id', counterId)

  console.log(
    `[receipts] counter_record ${counterId} settled: user=${userDelta >= 0 ? '+' : ''}${userDelta} agent=${agentDelta >= 0 ? '+' : ''}${agentDelta} verdict=${verdict}`,
  )
}
