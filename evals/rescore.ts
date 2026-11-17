/**
 * Rescore multi-20261113_122126.json with updated grader logic:
 *   - mq04/mq08: startingXI now applies ALL transfers (not just transfer[0])
 *   - mq05: replaced with "agent improvement within 0.5 pts of best legal single transfer"
 *   - oq02: merged into mq05 → always n/a
 *
 * Re-fetches picks from FPL (historical GW10, stable data).
 * Does NOT write any files — prints results to stdout only.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FplClient, MemoryCacheAdapter } from '../packages/agent/src/index.js'
import { getSquadGameweek } from '../packages/agent/src/fpl/helpers.js'
import type { Bootstrap, Fixture, EntryPicks } from '../packages/agent/src/fpl/types.js'
import { grade, type GradeResult } from './score.js'
import type { Question, Snapshot } from './run.js'

const __dir = dirname(fileURLToPath(import.meta.url))

const RESULTS_FILE = join(__dir, 'results', 'multi-20261113_122126.json')
const AFFECTED_IDS = ['mq04', 'mq05', 'mq08', 'oq02']

interface StoredSquadRun {
  teamId: number
  group: string
  overallRank: number | null
  reason: string
  elapsedMs: number
  brief: ReturnType<typeof JSON.parse> | null
  toolCalls: Array<{ name: string; resultTruncated: string }>
  toolCallCount: number
  tokenUsage: { inputTokens: number; outputTokens: number }
  estimatedCostUSD: number
  grades: GradeResult[]
  error: string | null
}

interface MultiRun {
  runs: StoredSquadRun[]
  gameweekId: number
}

const multiRun: MultiRun = JSON.parse(readFileSync(RESULTS_FILE, 'utf8'))
const questions: Question[] = JSON.parse(readFileSync(join(__dir, 'questions.json'), 'utf8'))

console.log('Fetching shared FPL data...')
const client = new FplClient({ cache: new MemoryCacheAdapter() })
const bootstrap: Bootstrap = await client.getBootstrap()
const fixtures: Fixture[] = await client.getFixtures()
const squadGwId = getSquadGameweek(bootstrap)
console.log(`  Squad GW: ${squadGwId}\n`)

// Track overall stats
let totalOldCorrect = 0
let totalOldApplicable = 0
let totalNewCorrect = 0
let totalNewApplicable = 0
const perSquadChanges: Array<{ teamId: number; group: string; changes: Array<{ qid: string; old: string; new_: string }> }> = []
const remainingFailures: Array<{ teamId: number; qid: string; answer: string; expected: string }> = []

for (const run of multiRun.runs) {
  if (run.error || !run.brief) {
    // Error squads: count their grades as-is (all error)
    for (const g of run.grades) {
      if (g.conditionMet && g.grade !== 'error' && g.grade !== 'n/a') totalOldApplicable++
      if (g.grade === 'correct') totalOldCorrect++
      // Not counted in new (they're still errors)
    }
    continue
  }

  const picks: EntryPicks = await client.getEntryPicks(run.teamId, squadGwId)
  const snapshot: Snapshot = {
    snapshotTimestamp: new Date().toISOString(),
    teamId: run.teamId,
    bootstrap,
    fixtures,
    picks,
  }

  const changes: Array<{ qid: string; old: string; new_: string }> = []

  for (const q of questions) {
    const oldGrade = run.grades.find(g => g.questionId === q.id)
    if (!oldGrade) continue

    // Count old stats for all grades in this successful run
    if (oldGrade.conditionMet && oldGrade.grade !== 'error' && oldGrade.grade !== 'n/a') {
      totalOldApplicable++
      if (oldGrade.grade === 'correct') totalOldCorrect++
    }

    if (!AFFECTED_IDS.includes(q.id)) {
      // Unchanged: carry forward for new stats
      if (oldGrade.conditionMet && oldGrade.grade !== 'error' && oldGrade.grade !== 'n/a') {
        totalNewApplicable++
        if (oldGrade.grade === 'correct') totalNewCorrect++
      }
      if (oldGrade.grade === 'wrong') {
        remainingFailures.push({ teamId: run.teamId, qid: q.id, answer: oldGrade.answer, expected: oldGrade.expected })
      }
      continue
    }

    // Re-grade this check
    const fakeResult = {
      questionId: q.id,
      questionText: q.text,
      category: q.category,
      runIndex: 0,
      startedAt: '',
      elapsedMs: run.elapsedMs,
      brief: run.brief,
      toolCalls: run.toolCalls,
      toolCallCount: run.toolCallCount,
      tokenUsage: run.tokenUsage,
      estimatedCostUSD: run.estimatedCostUSD,
      error: null,
    }
    const newGrade = grade(fakeResult, snapshot, questions)

    if (newGrade.conditionMet && newGrade.grade !== 'error' && newGrade.grade !== 'n/a') {
      totalNewApplicable++
      if (newGrade.grade === 'correct') totalNewCorrect++
    }
    if (newGrade.grade === 'wrong') {
      remainingFailures.push({ teamId: run.teamId, qid: q.id, answer: newGrade.answer, expected: newGrade.expected })
    }

    if (oldGrade.grade !== newGrade.grade) {
      changes.push({ qid: q.id, old: oldGrade.grade, new_: newGrade.grade })
    }
  }

  if (changes.length > 0) {
    perSquadChanges.push({ teamId: run.teamId, group: run.group, changes })
  }
}

// New squads fully passing (no wrong or error grades among new applicable)
const successfulRuns = multiRun.runs.filter(r => !r.error && r.brief)
const squadNewPassingCount = successfulRuns.filter(run => {
  // Check if all grades for this run pass under new logic
  for (const q of questions) {
    const oldGrade = run.grades.find(g => g.questionId === q.id)
    if (!oldGrade || AFFECTED_IDS.includes(q.id)) continue
    if (oldGrade.grade === 'wrong') return false
  }
  // For the affected checks, we need to check new grades
  // A squad fully passes if no wrong grades remain
  return !remainingFailures.some(f => f.teamId === run.teamId)
}).length
// Add error squads subtracted
const totalSquads = multiRun.runs.length
const errorSquads = multiRun.runs.filter(r => r.error || !r.brief).length

console.log('── Rescore: multi-20261113_122126.json ───────────────────────────')
console.log(`  Changes applied to: mq04 (startingXI fix), mq05 (new check), mq08 (startingXI fix), oq02 (→ n/a)`)
console.log()
console.log(`  BEFORE:  ${totalOldCorrect}/${totalOldApplicable} correct`)
console.log(`  AFTER:   ${totalNewCorrect}/${totalNewApplicable} correct`)
console.log(`  Squads all passing: ${squadNewPassingCount}/${totalSquads - errorSquads} (of ${totalSquads - errorSquads} without error)`)
console.log(`  Errors:  ${errorSquads}/${totalSquads} (unchanged — private/inaccessible squads)`)

if (perSquadChanges.length > 0) {
  console.log()
  console.log('  Grade changes:')
  for (const { teamId, group, changes } of perSquadChanges) {
    for (const { qid, old: o, new_: n } of changes) {
      console.log(`    [${group} ${teamId}] ${qid}: ${o} → ${n}`)
    }
  }
}

if (remainingFailures.length > 0) {
  console.log()
  console.log('  Remaining failures (wrong):')
  for (const f of remainingFailures) {
    console.log(`    [${f.teamId}] ${f.qid}: got "${String(f.answer).slice(0, 70)}"`)
  }
} else {
  console.log()
  console.log('  No remaining wrong-grade failures (excluding error squads).')
}
