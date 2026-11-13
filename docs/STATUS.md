# Status — Thu 12 November 2026

## Done

### Core MVP (landed 25 Oct)
- **Landing page:** hero, How it works, Roadmap, LandingAuth, non-affiliation footer, "v0.1, MVP in progress" label.
- **Onboarding:** country-rank lookup (page formula, tie-size probe, fuzzy name match, neighbor-rank check, rotating progress text, 5-second link option, 30-second cap, standings cache), link fallback (paste link or ID, copied-link detection), "Is this you?", one account per team, cancel / sign out, change team in settings.
- **Agent pipeline (brief mode):** `generateBrief` → weak-spot detection, transfer plan, 3-club replan, tool-using model loop with `submit_brief`, captain call. Single entry-point; trace numbered end-to-end.
- **Brief UI:** `TransferCard`, `CaptainCard`, `DetailSheet` (Why tab + Trace tab). Generating state, brief skeleton, FPL-updating banner.
- **Public sample brief:** `/sample` page (server-side read from `sample_brief`), `POST /api/sample/refresh` (owner-auth).
- **Error states:** `error.tsx`, `global-error.tsx`, `not-found.tsx`; deadline-passed, cap-reached, generation-failed with retry.
- **Daily GitHub Actions job** (`daily-refresh.yml`): keeps Supabase active, caches FPL data.
- **Phase 5 (FPL client hardening):** `FplClient` with jitter, 503 hold, two-layer cache, TTLs, all helpers. Health endpoint at `/api/fpl-health`.
- **Phase 6 (country leagues):** 132-country league-ID table in Supabase, tie-group probe (see tables below).
- **Infrastructure:** Supabase auth (Google), Vercel deploy on `finalball.manavpkothari.dev` (custom domain live, DNS via Vercel), CI (Node 22 / pnpm 11), Google OAuth published to production + brand verified (app name shows on sign-in screen).

### Post-core (26 Oct – 9 Nov)
- **Fixture chips** on transfer and captain cards: opponent short name + H/A, double-GW indicator.
- **GW-transition fixes:** squad picks fetched from is_current GW; active GW flips to is_next after deadline; FT calculation corrected; stuck `generating` briefs recovered on retry.
- **Team lookup fix:** NFD/NFC Unicode normalization in fuzzy name match.
- **Scoring improvements:** fixture-first ranking, stable form base, capped `ep_next`/form outliers, plain-English why sections (D17.1).
- **Risk tags (D2.11, D4.3):** Safe / Balanced / Bold labels on all transfer and captain options; `RiskTagBadge` component.
- **Input hash + change detection (D10.6):** SHA-256 of squad + news + FDR inputs; per-GW version cap; `changeSummary` chip when brief inputs change.
- **Temperature=0 for rank and captain (D10.7):** deterministic picks across re-runs.
- **Full counter system (D17.4–D17.7, D17.13):**
  - `generateCounter.ts`: tool-using loop (get_player, get_fixtures, compare, search_candidates, check_constraints, submit_counter_outcome), 6-call budget, mandatory-investigation guard, changed_fact validation in code.
  - Outcomes: `held` / `changed_fact` / `accepted_preference` / `declined` (off-topic, no tool calls).
  - Weak-spot counter card type (`WeakspotCounterCard`, D17.13): challenges the sell candidate, not the buy; `changed_fact` names a new sell + best available buy (`newPick.buyPlayerName`); quick replies: "X is performing fine / Why not sell Y instead? / I need X for cover".
  - `POST /api/counter`: SSE-streamed progress, card-ownership check, counter cap (10 per GW), DB row lifecycle (`pending → ok / failed`), `counter_usage` upsert. `counterType: 'weakspot'` passed through from click → route → `generateCounter`.
  - Counter UI in `detail-sheet.tsx`: Counter tab with quick-reply chips + text box, outcome display, cap-reached and disabled states. Weakspot `changed_fact` shows "New sell candidate" + "Best buy" labels (vs "New pick" for transfer/captain outcomes).
  - `buildCounterCard` in `route.ts` constructs `WeakspotCounterCard` from the brief payload (sell player, whySell, top-3 `whySellContext` entries).
- **`generateBrief` tool-using loop upgrade:** brief agent now mirrors the counter agent's architecture.
  - Tools: `get_player`, `get_fixtures`, `compare`, `search_candidates`, `check_constraints`, `submit_brief` (new tool that supersedes `submit_transfer_plan`).
  - 15-call budget, mandatory-investigation guard (must call at least one data tool before `submit_brief`), deterministic fallback if submission validation fails or loop exits without submission.
  - `resolveSubmission` validates model picks against squad/constraints; `buildDeterministicBrief` is the ranked fallback.
  - `generateCaptain` becomes `assignCaptainTags` (internal helper); `rankWithModel` becomes `selectAndTagOptions`.
- **Mobile sheet and panel scrolling fixes.**
- **generateCounter unit tests** for all quick-reply paths across transfer, captain, save, and weakspot card types.
- **generateBrief unit tests** added (`generateBrief.test.ts`).
- **CI fix:** `daily-refresh.yml` and `weekly-brief.yml` corrected to use `NEXT_PUBLIC_SUPABASE_URL` secret name; all required GitHub secrets set.
- **Scheduled briefs + weekly email (D16.9):** `scripts/weekly` generates briefs for all opted-in users ~24h before deadline and sends a brief-ready email via Resend. Tested end-to-end: 3 briefs generated, emails delivered.
- **Daily brief-generation cap removed (D16.5):** `VERSION_CAP` and all `cap_reached` SSE/UI logic removed from `route.ts` and `brief-client.tsx`; on-demand generation is now uncapped.
- **Next-week preview card (D3.2, US-3.11):** `computeNextWeekPreview()` derives a one-line fixture-difficulty summary from GW+1 data; `PreviewCard` component renders it below the captain card. Absent during blank or international-break GWs.
- **Lineup and bench-order recommendation (D4.5, BL-6):** `computeLineup()` tries all 9 valid FPL formations, picks highest expected-points XI from post-transfer squad. `LineupCard` shows starting XI grouped by position, bench in auto-sub order, swap badges, doubtful indicators. DB migration `007` adds `'lineup'` to cards check constraint.

---

## Not yet (full MVP scope, target 20 November)

### Chips (D5.1–D5.7)
- Weekly chip alert card + chip status strip with expiry countdown.
- Timing advice for all four chips (TC, BB, WC, FH); expiry nudges.
- Chip advice scans the full fixture list for blanks and doubles ("provisional").

### "News since this brief" banner (D17.9)
- Daily job flags players named in stored briefs (sell candidate, picks, captain options) when injury/suspension/availability changes.
- Affected cards show the banner; user counters to re-check.
- Requires daily-refresh completion (D11.7) below.

### Receipts, scorecard, and journal (E5)
- Transfer receipt pipeline: label (Followed / Your own move / Ignored, rolled / Ignored, transferred), inferred intent (points / funding / injury cover), linked funding moves.
- Captain and chip receipts.
- Counter records: outcome storage and scoring after the receipt window ("When you push back, who's usually right?").
- 5-gameweek scorecard: rolling transfer impact headline; followed vs. ignored comparison.
- Decision journal: optional one-line note per move on the receipt.

### Demo mode (E8)
- Curated frozen snapshot + "See it on a live team" toggle, using the owner's real team (D1.3, D15.4).

### Settings (E7, partially done)
- Email opt-out (requires email setup).
- Unlink and delete all data (D9.12).

### Daily-refresh completion (D11.7)
- News flagging for stored briefs (feeds the banner above).
- Receipt and counter-record settlement after played gameweeks.

### Stick-or-diverge check-in (D3.3)
- Check-in card when last week's preview exists: pre-selected stick/diverge recommendation, one-tap confirm.

---

## Post-20 Nov (UI pass, deferred by owner)

### Design and accessibility
- Full UI and visual design pass across all screens.
- Light mode.
- Full motion design with reduced-motion fallbacks.
- Accessibility pass (44px targets verified, screen-reader labels, contrast audit).

---

## Phase 6 — country league IDs (sample, 2026-10-20)
Key countries for onboarding/rank-lookup:

| Country | League ID |
|---|---|
| England | 261 |
| India | 120 |
| USA | 249 |
| Pakistan | 183 |
| Nigeria | 177 |
| Bangladesh | 38 |
| Scotland | 263 |
| Wales | 264 |
| Northern Ireland | 262 |
| Ireland | 124 |
| Germany | 100 |
| France | 93 |
| Netherlands | 172 |
| Spain | 220 |
| Italy | 126 |
| Australia | 33 |
| Canada | 59 |
| Brazil | 50 |

Full 132-country table is in Supabase `country_leagues`. The FPL region name for US managers is `"USA"` (not `"United States"`).

## Phase 6 — tie-group probe (2026-10-20)
Probed pages 1, 100, 1000 of the six biggest country leagues.
`maxTie` = max entries sharing the same rank on a given page.

| Country | League | p1 ranks | p1 maxTie | p100 ranks | p100 maxTie | p1000 ranks | p1000 maxTie |
|---|---|---|---|---|---|---|---|
| England | 261 | r1–50 | 3 | r4909–4964 | 37 | r49925–49925 | 50 |
| India | 120 | r1–49 | 3 | r4903–4982 | 31 | r49701–49972 | 29 |
| USA | 249 | r1–49 | 3 | r4945–4994 | 36 | r49822–49984 | 33 |
| Pakistan | 183 | r1–50 | 4 | r4945–4997 | 15 | — | — |
| Nigeria | 177 | r1–48 | 4 | r4951–4974 | 27 | r49710–49710 | 50 |
| Bangladesh | 38 | r1–50 | 3 | r4937–4988 | 32 | — | — |

**Implication for rank-lookup (D16.9):** maxTie can reach 50 (a full page) near the tail of the England and Nigeria leagues. The lookup scans `targetPage ± 1` (3 pages, 150 entries) to bracket any tie group; production scans `±2` for safety.

## Agent core — scoring metric (D17.1)
`ep_next × availability` for GW1; `form × fdrMultiplier(fdr) × availability` for GW2/3 where `fdrMultiplier = max(0.25, (5−fdr)/4)`. Blank GW = 0, Double GW = ×2. Buy-side: same total ÷ price in £m (pts/£m).

## Agent testing — Sun 25 Oct 2026

| Team ID | FT | Scenario | Result |
|---|---|---|---|
| 3434860 | 1 | Manav's team | ✅ Sell B.Fernandes → Henderson; Captain Haaland, VC Evanilson |
| 1 | 2 | 2 free transfers | ✅ Sell Szoboszlai + Button; full model reasoning for both transfers |
| 100 | 2 | 2 FT but T2 not worth making | ✅ Model makes only T1 |
| 7491385 | 1 | Multiple injured players, club limit hit | ✅ Sell Yarmoliuk; Henderson + Neto skipped → Tavernier |
| 10000001 | 2 | Larger team ID, multi-injury squad | ✅ 2-transfer plan; club-limit replan for Doku |

## Known weaknesses (not fixing in v0.1)
- GW2/3 uses a 4-week rolling form average — slow to respond to sharp recent trends.
- Double GW pts doubled but rotation risk in the second game not modeled.
- No differential signal: ownership percentage not considered.
- 2-FT pairing loop is greedy (first valid T1 → best T2).
- `ep_next` reflects FPL's model at bootstrap fetch time; late news not captured until the daily refresh.

## Owner's test data

| Who | Team ID | Country | Country rank (2026-10-22) | Team name |
|---|---|---|---|---|
| Manav | 3434860 | USA | 130,322 | Kobbie and Paste |

## Lookup test results (2026-10-22)

| Who | Team name | Rank | Found | Team ID | Pages scanned | Time |
|---|---|---|---|---|---|---|
| Manav | Kobbie and Paste | 130,322 | yes | 3434860 | 4 | 1.5s |

rank 130,322 → startPage 2607 → found on page 2609. Algorithm scanned pages 2606–2609 (rank ±1 window).

## Model details (D17.2)
`claude-sonnet-4-6` via `ANTHROPIC_MODEL` env var. Tool use with `submit_brief` (brief loop) / `submit_counter_outcome` (counter loop). Brief: 2,048 max tokens, 15-call budget; counter: 1,024, 6-call budget. Captain: 1,024. Temperature=0 for rank and captain (D10.7). Approximate cost: ~$0.005–0.015 per brief at family scale.

## Open items
- FPL app tab names in the guide panels ("Leagues", "Points", "Pick Team") — confirm during accessibility work.
- Counter message length limit — not yet enforced in the UI.
- Counter cap value (10/GW) — tune after family testing.
- `D17.9` news-flagging logic: exact player-match criteria for the daily refresh to flag a brief card.
- `D17.12` other interactive controls (e.g. selecting an alternative updates the captain card).
- `D15.6` chip strip UI when the toggle is off — left open.
- Receipt settlement logic when user choice and agent pick tie or both are pending (D7.11 edge case).
- Full country-leagues sampling script (`pnpm --filter @finalball/script-country-leagues start`) — run before weekly brief goes live to cover remaining countries.
