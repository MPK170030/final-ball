# Sprint 2 — 26 Oct – 1 Nov 2026

Four new decisions (D2.11, D2.12, D10.6, D10.7) define this sprint. Everything below derives from those decisions and the story updates they triggered (US-3.7, US-4.1, US-10.6).

---

## What Already Exists (do not rebuild)

- **Agent pipeline** (`packages/agent/src`): `loadContext → findWeakSpots → buildTransferPlan → rankWithModel → generateCaptain`. Temperature=0 on both model calls. Input hashing in `generateBrief`.
- **DB schema** (`packages/db/src/types.ts`): all 9 tables typed. `briefs` has `input_hash` and `change_summary` columns. No `brief_style_results` table.
- **API routes**: `/api/brief/generate` (SSE, per-GW version cap of 3, change-detection guard), `/api/team/lookup`, `/api/team/confirm`, `/api/sample/refresh`.
- **UI pages**: landing, `/brief`, `/onboarding`, `/sample`, `/privacy`, error states.
- **Daily cron** (`scripts/daily`): bootstraps FPL cache each day.

---

## Feature 3 — Risk Tags (D2.11) · ✅ DONE

> D2.4 (regenerating style toggle) was replaced by D2.11 on 3 Nov. No separate style generation, no `brief_style_results` table, no `/api/brief/style` route. Risk tags are static labels assigned at brief-generation time.

Each transfer pick and captain pick carries a `RiskTag` (`'safe' | 'balanced' | 'bold'`). The agent spans all three tags across the top pick + 3 alternatives where the pool allows; tags describe the pick's character, not a user preference.

### Agent (implemented)
- `RiskTag` type exported from `packages/agent/src/analysis/candidates.ts`
- Transfer tags: `selectAndTagOptions` in `rank.ts` — scores the pool on three sort keys (safe floor, balanced expected, bold ceiling) and assigns each option its strongest dimension
- Captain tags: `assignCaptainTags` in `generateCaptain.ts` — same approach on ep_next, ep_this, and minutes variance
- Tags flow through `RankedTransferCard.topPickRiskTag`, `RankedAlternative.riskTag`, and `CaptainPick.riskTag`

### UI (implemented)
- `RiskTagBadge` on every pick in `transfer-card.tsx` and `captain-card.tsx`
- `RiskTagKey` legend above the cards in `brief-client.tsx` (Safe = high floor, Balanced = most expected pts, Bold = high ceiling)

---

## Out of Scope This Sprint

- Scheduled briefs + email (US-10.2, US-6.x) — week of 2 Nov
- Chips (US-3.10, D15.6)
- Receipts + scorecard (US-5.x)
- Next-week preview (US-3.11)
- Stick-or-diverge check-in (US-3.3)
- Light mode + full motion (D16.8)
- Lookup fixes from family testing feedback

---

## Verification Checklist

- [x] **D10.7**: Generate two briefs with identical inputs — top pick is identical both times.
- [x] **D10.6 no-change**: Refresh immediately after generation → SSE returns `no_change`, `generation_usage.count` unchanged, no new `briefs` row.
- [x] **D10.6 change**: Simulate a news change → Refresh creates new version with `change_summary` set.
- [x] **D2.11 risk tags**: Each transfer and captain pick displays a Safe / Balanced / Bold badge; the `RiskTagKey` legend is shown above the cards. Tags are assigned by the agent at generation time (no user toggle, no regeneration).
