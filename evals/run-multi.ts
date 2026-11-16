/**
 * Multi-squad eval runner.
 *
 * Usage:
 *   tsx --env-file=apps/web/.env.local evals/run-multi.ts [--squads evals/squads.json]
 *
 * Runs generateBrief once per squad in squads.json, grades all 25 checks
 * per run, and writes evals/REPORT.md with the aggregated results.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateBrief, FplClient, MemoryCacheAdapter } from '../packages/agent/src/index.js'
import { getSquadGameweek } from '../packages/agent/src/fpl/helpers.js'
import type { BriefResult } from '../packages/agent/src/generateBrief.js'
import type { Bootstrap, Fixture, EntryPicks } from '../packages/agent/src/fpl/types.js'
import type { TraceStep } from '../packages/agent/src/trace.js'
import { computeCost, MODEL } from './pricing.js'
import {
  grade,
  checkGrounding,
  median,
  p90,
  type GradeResult,
  type GroundingResult,
} from './score.js'
import type { Question, ToolCallRecord, Snapshot } from './run.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SquadEntry {
  teamId: number
  group: 'top' | 'mid' | 'low' | 'edge'
  overallRank: number | null
  bank: number
  gw10Transfers: number
  reason: string
}

interface SquadRun {
  teamId: number
  group: string
  overallRank: number | null
  reason: string
  elapsedMs: number
  brief: BriefResult | null
  toolCalls: ToolCallRecord[]
  toolCallCount: number
  tokenUsage: { inputTokens: number; outputTokens: number }
  estimatedCostUSD: number
  grades: GradeResult[]
  groundingResults: GroundingResult[]
  error: string | null
}

interface MultiRun {
  runId: string
  startedAt: string
  model: string
  gameweekId: number
  squadsFile: string
  runs: SquadRun[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toolCallsFromTrace(trace: TraceStep[]): ToolCallRecord[] {
  return trace
    .filter(step => step.title.startsWith('Tool: '))
    .map(step => ({ name: step.title.slice('Tool: '.length), resultTruncated: step.text }))
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function runId(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

function isoNow(): string {
  return new Date().toISOString()
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const squadsFlag = args.indexOf('--squads')
const squadsPath = squadsFlag !== -1 ? args[squadsFlag + 1]! : join(__dir, 'squads.json')

const squads: SquadEntry[] = JSON.parse(readFileSync(squadsPath, 'utf8'))
const questions: Question[] = JSON.parse(readFileSync(join(__dir, 'questions.json'), 'utf8'))

const id = runId()
const resultsDir = join(__dir, 'results')
mkdirSync(resultsDir, { recursive: true })
const resultsFile = join(resultsDir, `multi-${id}.json`)

const client = new FplClient({ cache: new MemoryCacheAdapter() })

// ── Shared data ───────────────────────────────────────────────────────────────

console.log('Fetching shared FPL data (bootstrap + fixtures)...')
const bootstrap: Bootstrap = await client.getBootstrap()
const fixtures: Fixture[] = await client.getFixtures()
const squadGwId = getSquadGameweek(bootstrap)
console.log(`  Bootstrap loaded. Squad GW: ${squadGwId}`)

// ── Run helper ────────────────────────────────────────────────────────────────

async function runSquad(squad: SquadEntry): Promise<SquadRun> {
  const t0 = Date.now()
  let brief: BriefResult | null = null
  let error: string | null = null
  let picks: EntryPicks | null = null

  try {
    picks = await client.getEntryPicks(squad.teamId, squadGwId)
    brief = await generateBrief(squad.teamId, { client })
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  const elapsedMs = Date.now() - t0
  const toolCalls = brief ? toolCallsFromTrace(brief.trace) : []
  const tokenUsage = brief
    ? { inputTokens: brief.meta.usage.inputTokens, outputTokens: brief.meta.usage.outputTokens }
    : { inputTokens: 0, outputTokens: 0 }

  const snapshot: Snapshot = {
    snapshotTimestamp: isoNow(),
    teamId: squad.teamId,
    bootstrap,
    fixtures,
    picks: picks!,
  }

  // Grade all 25 questions against this run's brief
  const grades: GradeResult[] = []
  const groundingResults: GroundingResult[] = []

  if (brief && picks) {
    for (const q of questions) {
      const fakeResult = {
        questionId: q.id,
        questionText: q.text,
        category: q.category,
        runIndex: 0,
        startedAt: isoNow(),
        elapsedMs,
        brief,
        toolCalls,
        toolCallCount: toolCalls.length,
        loopStepsEstimate: 0,
        tokenUsage,
        estimatedCostUSD: 0,
        error: null,
      }
      grades.push(grade(fakeResult, snapshot, questions))
      // Only compute grounding once (it's the same brief for all 25 questions)
      if (q.id === questions[0]!.id) {
        groundingResults.push(checkGrounding(fakeResult, snapshot))
      }
    }
  } else {
    for (const q of questions) {
      grades.push({
        questionId: q.id,
        category: q.category,
        text: q.text,
        conditionMet: true,
        grade: 'error',
        answer: 'error',
        expected: '',
        note: error ?? 'brief is null',
      })
    }
  }

  const statusStr = brief
    ? (brief.save ? 'save' : `transfer(${brief.transfers.length})`) + ` | C:${brief.captain.captain.player.web_name}`
    : `ERROR: ${error}`

  const correctCount = grades.filter(g => g.grade === 'correct').length
  const naCount = grades.filter(g => g.grade === 'n/a').length
  const errCount = grades.filter(g => g.grade === 'error').length

  console.log(
    `  [${squad.group} ${squad.teamId}] ${elapsedMs}ms | ${statusStr} | checks: ${correctCount}✓ ${naCount}n/a ${errCount}err`,
  )

  return {
    teamId: squad.teamId,
    group: squad.group,
    overallRank: squad.overallRank,
    reason: squad.reason,
    elapsedMs,
    brief,
    toolCalls,
    toolCallCount: toolCalls.length,
    tokenUsage,
    estimatedCostUSD: computeCost(tokenUsage.inputTokens, tokenUsage.outputTokens),
    grades,
    groundingResults,
    error,
  }
}

// ── Warm-up ───────────────────────────────────────────────────────────────────

console.log('\nWarm-up run...')
await runSquad(squads[0]!)

// ── 20 squad runs ─────────────────────────────────────────────────────────────

const runs: SquadRun[] = []
console.log(`\nRunning ${squads.length} squads...`)
for (const squad of squads) {
  runs.push(await runSquad(squad))
}

// ── Save results ──────────────────────────────────────────────────────────────

const multiRun: MultiRun = {
  runId: id,
  startedAt: isoNow(),
  model: MODEL,
  gameweekId: squadGwId,
  squadsFile: squadsPath,
  runs,
}

writeFileSync(resultsFile, JSON.stringify(multiRun))
console.log(`\nResults → ${resultsFile}`)

// ── Stats ─────────────────────────────────────────────────────────────────────

const successful = runs.filter(r => r.error === null)
const erroredRuns = runs.filter(r => r.error !== null)

// Per-squad check summary
interface CheckSummary {
  correct: number
  wrong: number
  needsReview: number
  na: number
  error: number
  total: number
  allPassed: boolean
}

function summariseChecks(grades: GradeResult[]): CheckSummary {
  const correct = grades.filter(g => g.grade === 'correct').length
  const wrong = grades.filter(g => g.grade === 'wrong').length
  const needsReview = grades.filter(g => g.grade === 'needs_review').length
  const na = grades.filter(g => g.grade === 'n/a').length
  const error = grades.filter(g => g.grade === 'error').length
  const applicable = correct + wrong + needsReview
  return { correct, wrong, needsReview, na, error, total: applicable, allPassed: wrong === 0 && needsReview === 0 && error === 0 && applicable > 0 }
}

const checkSummaries = runs.map(r => summariseChecks(r.grades))
const squadsAllPassed = checkSummaries.filter(s => s.allPassed).length
const totalCorrect = checkSummaries.reduce((sum, s) => sum + s.correct, 0)
const totalApplicable = checkSummaries.reduce((sum, s) => sum + s.total, 0)

// Grounding
const groundingChecks = runs.flatMap(r => r.groundingResults.flatMap(g => g.checks))
const groundedCount = groundingChecks.filter(c => c.grounded).length
const groundingPct = groundingChecks.length > 0
  ? Math.round((groundedCount / groundingChecks.length) * 100)
  : 100

// Latency + cost
const latencies = successful.map(r => r.elapsedMs)
const medianMs = median(latencies)
const p90Ms = p90(latencies)
const totalCost = runs.reduce((sum, r) => sum + r.estimatedCostUSD, 0)
const avgCost = runs.length > 0 ? totalCost / runs.length : 0

// All failures
interface Failure {
  teamId: number
  group: string
  questionId: string
  text: string
  grade: string
  answer: string
  expected: string
  note: string
}

const allFailures: Failure[] = []
for (const run of runs) {
  for (const g of run.grades) {
    if (g.grade === 'wrong' || g.grade === 'needs_review' || g.grade === 'error') {
      allFailures.push({
        teamId: run.teamId,
        group: run.group,
        questionId: g.questionId,
        text: g.text,
        grade: g.grade,
        answer: g.answer,
        expected: g.expected,
        note: g.note,
      })
    }
  }
}

// Ungrounded numbers
interface UngroundedEntry {
  teamId: number
  raw: string
  value: number
  context: string
}

const ungroundedEntries: UngroundedEntry[] = runs.flatMap(r =>
  r.groundingResults.flatMap(g =>
    g.checks.filter(c => !c.grounded).map(c => ({
      teamId: r.teamId,
      raw: c.raw,
      value: c.value,
      context: c.context,
    })),
  ),
)

// ── REPORT.md ─────────────────────────────────────────────────────────────────

const lines: string[] = []

lines.push(`# Final Ball Agent Eval — Multi-Squad Report`)
lines.push(``)
lines.push(`| Field | Value |`)
lines.push(`|-------|-------|`)
lines.push(`| Date | ${new Date().toISOString().split('T')[0]} |`)
lines.push(`| Model | ${MODEL} |`)
lines.push(`| Gameweek | GW${squadGwId} |`)
lines.push(`| Squads | ${runs.length} (${runs.filter(r => r.group === 'top').length} top, ${runs.filter(r => r.group === 'mid').length} mid, ${runs.filter(r => r.group === 'low').length} low, ${runs.filter(r => r.group === 'edge').length} edge) |`)
lines.push(`| League | Overall (314) |`)
lines.push(``)

lines.push(`## Summary`)
lines.push(``)
lines.push(`| Metric | Value |`)
lines.push(`|--------|-------|`)
lines.push(`| Squads with all checks passed | **${squadsAllPassed}/20** |`)
lines.push(`| Total checks passed | **${totalCorrect}/${totalApplicable}** applicable |`)
lines.push(`| Grounded (tool-result prices + differentials) | **${groundingPct}%** of extracted numbers |`)
lines.push(`| Median latency | **${(medianMs / 1000).toFixed(1)} s** |`)
lines.push(`| p90 latency | **${(p90Ms / 1000).toFixed(1)} s** |`)
lines.push(`| Avg cost/squad | **$${avgCost.toFixed(4)}** |`)
lines.push(`| Total cost | **$${totalCost.toFixed(4)}** |`)
lines.push(`| Errors | **${erroredRuns.length}/20** |`)
lines.push(``)
lines.push(`> Accuracy denominator excludes n/a (condition not met) and counts each squad's applicable checks.`)
lines.push(`> Cost is input + output tokens only; cache read/write counters are not exposed by generateBrief.`)
lines.push(``)

// Per-squad table
lines.push(`## Per-squad breakdown`)
lines.push(``)
lines.push(`| Squad | Group | Rank | Bank | Recommendation | Checks | Grounded | Latency | Cost |`)
lines.push(`|-------|-------|------|------|----------------|--------|----------|---------|------|`)

for (let i = 0; i < runs.length; i++) {
  const run = runs[i]!
  const s = checkSummaries[i]!
  const gr = run.groundingResults.flatMap(g => g.checks)
  const grPct = gr.length > 0 ? Math.round(gr.filter(c => c.grounded).length / gr.length * 100) : 100
  const rec = run.brief
    ? (run.brief.save ? 'save' : `${run.brief.transfers[0]?.sell.player.web_name ?? '?'}→${run.brief.transfers[0]?.topPick.player.web_name ?? '?'}`)
    : `error: ${run.error?.slice(0, 30) ?? '?'}`
  const rankStr = run.overallRank !== null ? String(run.overallRank) : '—'
  const bankStr = i < squads.length ? `£${squads[i]!.bank.toFixed(1)}m` : '?'
  const checksStr = run.error
    ? `error`
    : `${s.correct}✓ ${s.wrong > 0 ? s.wrong + '✗' : ''} ${s.needsReview > 0 ? s.needsReview + '?' : ''} ${s.na}n/a`.replace(/ +/g, ' ').trim()
  lines.push(`| ${run.teamId} | ${run.group} | ${rankStr} | ${bankStr} | ${rec.replace(/\|/g, '\\|').slice(0, 25)} | ${checksStr} | ${grPct}% | ${(run.elapsedMs / 1000).toFixed(1)}s | $${run.estimatedCostUSD.toFixed(4)} |`)
}
lines.push(``)

// All failures section
if (allFailures.length > 0) {
  lines.push(`## All failures`)
  lines.push(``)
  for (const f of allFailures) {
    lines.push(`### squad ${f.teamId} (${f.group}) — ${f.questionId}: ${f.text}`)
    lines.push(`- **Grade**: ${f.grade}`)
    lines.push(`- **Answer**: ${f.answer}`)
    lines.push(`- **Expected**: ${f.expected}`)
    if (f.note) lines.push(`- **Note**: ${f.note}`)
    lines.push(``)
  }
} else {
  lines.push(`## All failures`)
  lines.push(``)
  lines.push(`None — all applicable checks passed across all 20 squads.`)
  lines.push(``)
}

// Ungrounded numbers
if (ungroundedEntries.length > 0) {
  lines.push(`## Ungrounded numbers`)
  lines.push(``)
  lines.push(`Numbers in brief reasoning that do not match any tool-returned price, snapshot price, or computed differential:`)
  lines.push(``)
  lines.push(`| Squad | Raw | Value | Context |`)
  lines.push(`|-------|-----|-------|---------|`)
  for (const u of ungroundedEntries) {
    lines.push(`| ${u.teamId} | \`${u.raw}\` | ${u.value} | ${u.context.replace(/\|/g, '\\|').slice(0, 80)} |`)
  }
  lines.push(``)
} else {
  lines.push(`## Ungrounded numbers`)
  lines.push(``)
  lines.push(`None — all extracted numbers are grounded in tool results or derivable from them.`)
  lines.push(``)
}

lines.push(`## Rerun`)
lines.push(``)
lines.push(`\`\`\`bash`)
lines.push(`pnpm eval:multi`)
lines.push(`\`\`\``)

const reportPath = join(__dir, 'REPORT.md')
writeFileSync(reportPath, lines.join('\n'))

// Console summary
console.log(`\n── Multi-Squad Eval ──────────────────────────────────────`)
console.log(`  Squads all passed : ${squadsAllPassed}/20`)
console.log(`  Total checks      : ${totalCorrect}/${totalApplicable} correct`)
console.log(`  Grounded          : ${groundingPct}%`)
console.log(`  Median latency    : ${(medianMs / 1000).toFixed(1)}s`)
console.log(`  p90 latency       : ${(p90Ms / 1000).toFixed(1)}s`)
console.log(`  Avg cost/squad    : $${avgCost.toFixed(4)}`)
console.log(`  Total cost        : $${totalCost.toFixed(4)}`)
console.log(`  Errors            : ${erroredRuns.length}/20`)
if (allFailures.length > 0) {
  console.log(`\n  Failures (${allFailures.length}):`)
  for (const f of allFailures) {
    console.log(`    [${f.teamId}] ${f.questionId}: got "${String(f.answer).slice(0, 50)}"`)
  }
}
console.log(`\n  Report → ${reportPath}`)
console.log(`  Results → ${resultsFile}`)
