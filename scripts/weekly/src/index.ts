import {
  FplClient,
  MemoryCacheAdapter,
  generateBrief,
  getActiveGameweek,
  buildCardRows,
} from '@finalball/agent'
import type { BriefResult, EnrichMeta } from '@finalball/agent'
import { createClient } from '@finalball/db'
import type { SupabaseClient } from '@finalball/db'
import { sendBriefEmail } from './email.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const APP_URL = 'https://finalball.manavpkothari.dev'

// FORCE=true bypasses the deadline-window check (use for workflow_dispatch dry-runs)
const FORCE = process.env.FORCE === 'true'

// Generate briefs when the deadline is 20–28h away
const WINDOW_NEAR_H = 20
const WINDOW_FAR_H = 28

// Max brief versions before we stop generating for a GW (matches the route)
const VERSION_CAP = 5

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[weekly] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.')
    process.exit(1)
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // One FplClient shared across all users — bootstrap and fixtures cached after first call
  const fplClient = new FplClient({ cache: new MemoryCacheAdapter() })
  const bootstrap = await fplClient.getBootstrap()
  const gameweek = getActiveGameweek(bootstrap)
  const event = bootstrap.events.find(e => e.id === gameweek)

  if (!event) {
    console.log('[weekly] No active gameweek found, exiting.')
    return
  }

  const msUntilDeadline = event.deadline_time_epoch * 1000 - Date.now()
  const hoursUntilDeadline = msUntilDeadline / (1000 * 60 * 60)

  if (!FORCE && (hoursUntilDeadline < WINDOW_NEAR_H || hoursUntilDeadline > WINDOW_FAR_H)) {
    console.log(
      `[weekly] GW${gameweek} deadline in ${hoursUntilDeadline.toFixed(1)}h — outside ${WINDOW_NEAR_H}–${WINDOW_FAR_H}h window, exiting.`,
    )
    return
  }

  console.log(
    `[weekly] GW${gameweek} deadline in ${hoursUntilDeadline.toFixed(1)}h — generating briefs.`,
  )

  // Load all opted-in users with a linked FPL team
  const { data: users, error } = await db
    .from('profiles')
    .select('id, email, team_id')
    .not('team_id', 'is', null)
    .eq('email_opt_out', false)

  if (error || !users) {
    console.error('[weekly] Failed to load users:', error?.message)
    process.exit(1)
  }

  console.log(`[weekly] Processing ${users.length} users for GW${gameweek}.`)

  for (const user of users) {
    if (!user.team_id) continue
    await processUser({ db, fplClient, userId: user.id, email: user.email, teamId: user.team_id, gameweek })
  }

  console.log('[weekly] Done.')
}

async function processUser(opts: {
  db: SupabaseClient
  fplClient: FplClient
  userId: string
  email: string
  teamId: number
  gameweek: number
}) {
  const { db, fplClient, userId, email, teamId, gameweek } = opts
  const tag = `user=${userId.slice(0, 8)} GW${gameweek}`

  try {
    // Check if a ready brief already exists for this GW
    const { data: existing } = await db
      .from('briefs')
      .select('id, version')
      .eq('user_id', userId)
      .eq('gameweek', gameweek)
      .eq('status', 'ready')
      .order('version', { ascending: false })

    if (existing && existing.length > 0) {
      console.log(`[weekly] ${tag} — brief already exists (v${existing[0].version}), skipping generation.`)
      await maybeEmail({ db, userId, email, gameweek, briefId: existing[0].id })
      return
    }

    // Check version cap (includes generating + ready counts)
    const { data: allBriefs } = await db
      .from('briefs')
      .select('version, status')
      .eq('user_id', userId)
      .eq('gameweek', gameweek)

    const readyCount = allBriefs?.filter(b => b.status === 'ready').length ?? 0
    if (readyCount >= VERSION_CAP) {
      console.log(`[weekly] ${tag} — version cap reached, skipping.`)
      return
    }

    const nextVersion = Math.max(0, ...(allBriefs?.map(b => b.version) ?? [])) + 1

    // Insert brief row in 'generating' state
    const { data: briefRow, error: briefErr } = await db
      .from('briefs')
      .insert({ user_id: userId, gameweek, version: nextVersion, status: 'generating' })
      .select('id')
      .single()

    if (briefErr || !briefRow) throw new Error(briefErr?.message ?? 'Failed to create brief row')
    const briefId = briefRow.id

    // Run the agent pipeline
    console.log(`[weekly] ${tag} v${nextVersion} — generating...`)
    let result: BriefResult
    try {
      result = await generateBrief(teamId, { client: fplClient })
    } catch (err) {
      await db.from('briefs').update({ status: 'error', error: String(err) }).eq('id', briefId)
      throw err
    }

    // Build enrichment meta (bootstrap + fixtures already cached from earlier calls)
    const [enrichBootstrap, fixtures] = await Promise.all([
      fplClient.getBootstrap(),
      fplClient.getFixtures(),
    ])
    const clubs = new Map(enrichBootstrap.teams.map(t => [t.id, t.short_name]))
    const gwId = result.meta.gameweekId
    const nextFixtureForTeam = new Map<number, { opponent: string; isHome: boolean } | null>()
    for (const f of fixtures) {
      if (f.event !== gwId) continue
      nextFixtureForTeam.set(f.team_h, { opponent: clubs.get(f.team_a) ?? '???', isHome: true })
      nextFixtureForTeam.set(f.team_a, { opponent: clubs.get(f.team_h) ?? '???', isHome: false })
    }

    const enrich: EnrichMeta = {
      clubs,
      nextFixtureForTeam,
      freeTransfers: result.meta.freeTransfers,
      gameweekId: gwId,
    }

    const cardRows = buildCardRows(result, enrich).map(r => ({ ...r, brief_id: briefId }))

    const { error: cardsErr } = await db.from('cards').insert(cardRows)
    if (cardsErr) throw new Error(cardsErr.message)

    const { error: updateErr } = await db
      .from('briefs')
      .update({
        status: 'ready',
        trace: result.trace,
        generated_at: new Date().toISOString(),
        input_hash: result.meta.inputHash,
        change_summary: null,
      })
      .eq('id', briefId)
    if (updateErr) throw new Error(updateErr.message)

    console.log(`[weekly] ${tag} v${nextVersion} — brief ready.`)
    await maybeEmail({ db, userId, email, gameweek, briefId })
  } catch (err) {
    console.error(`[weekly] ${tag} — error:`, err)
  }
}

async function maybeEmail(opts: {
  db: SupabaseClient
  userId: string
  email: string
  gameweek: number
  briefId: string
}) {
  const { db, userId, email, gameweek, briefId } = opts
  const tag = `user=${userId.slice(0, 8)} GW${gameweek}`

  // Idempotency: skip if a 'sent' log row already exists for this GW
  const { data: existing } = await db
    .from('email_log')
    .select('id')
    .eq('user_id', userId)
    .eq('gameweek', gameweek)
    .eq('status', 'sent')
    .maybeSingle()

  if (existing) {
    console.log(`[weekly] ${tag} — email already sent.`)
    return
  }

  if (!process.env.RESEND_API_KEY) {
    console.log(`[weekly] ${tag} — RESEND_API_KEY not set, skipping email.`)
    return
  }

  try {
    await sendBriefEmail({ to: email, gameweek, appUrl: APP_URL })
    await db.from('email_log').insert({ user_id: userId, gameweek, brief_id: briefId, status: 'sent' })
    console.log(`[weekly] ${tag} — email sent.`)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await db.from('email_log').insert({ user_id: userId, gameweek, brief_id: briefId, status: 'failed', error: errMsg })
    console.error(`[weekly] ${tag} — email failed: ${errMsg}`)
  }
}

main().catch(err => {
  console.error('[weekly] Fatal error:', err)
  process.exit(1)
})
