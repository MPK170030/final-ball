# Final Ball Agent Eval — Multi-Squad Report

| Field | Value |
|-------|-------|
| Date | 2026-11-13 |
| Model | claude-sonnet-4-6 |
| Gameweek | GW10 |
| Squads | 20 (5 top, 5 mid, 5 low, 5 edge) |
| League | Overall (314) |

## Summary

| Metric | Value |
|--------|-------|
| Squads with all checks passed | **11/20** |
| Total checks passed | **385/395** applicable |
| Grounded (tool-result prices + differentials) | **100%** of extracted numbers |
| Median latency | **41.1 s** |
| p90 latency | **46.9 s** |
| Avg cost/squad | **$0.1126** |
| Total cost | **$2.2516** |
| Errors | **3/20** |

> Accuracy denominator excludes n/a (condition not met) and counts each squad's applicable checks.
> Cost is input + output tokens only; cache read/write counters are not exposed by generateBrief.

## Per-squad breakdown

| Squad | Group | Rank | Bank | Recommendation | Checks | Grounded | Latency | Cost |
|-------|-------|------|------|----------------|--------|----------|---------|------|
| 895045 | top | 1 | £1.9m | Forster→Verbruggen | 24✓ 1n/a | 100% | 34.7s | $0.1105 |
| 5333454 | top | 2 | £0.4m | Haaland→Isak | 22✓ 2✗ 1n/a | 100% | 37.1s | $0.1362 |
| 1829025 | top | 3 | £0.7m | Crooks→Rudoni | 24✓ 1n/a | 100% | 31.6s | $0.1115 |
| 5809 | top | 4 | £1.6m | Dubravka→Verbruggen | 24✓ 1n/a | 100% | 41.1s | $0.1261 |
| 250692 | top | 5 | £0.2m | save | 11✓ 14n/a | 100% | 31.6s | $0.1241 |
| 6353594 | mid | 5598775 | £0.4m | João Pedro→N.Jackson | 24✓ 1n/a | 100% | 44.5s | $0.1501 |
| 2561123 | mid | 5598775 | £0.4m | João Pedro→N.Jackson | 23✓ 1✗ 1n/a | 100% | 46.0s | $0.1504 |
| 9886432 | mid | 5598775 | £1.9m | error: fetch failed | error | 100% | 10.6s | $0.0000 |
| 6988678 | mid | 5598775 | £0.2m | error: fetch failed | error | 100% | 10.7s | $0.0000 |
| 9297143 | mid | 5598775 | £0.3m | error: fetch failed | error | 100% | 10.7s | $0.0000 |
| 10178325 | low | 9999598 | £0.0m | João Pedro→N.Jackson | 22✓ 2✗ 1n/a | 100% | 39.4s | $0.1210 |
| 9006072 | low | 9999598 | £0.0m | Pope→Verbruggen | 24✓ 1n/a | 100% | 47.1s | $0.1341 |
| 10695535 | low | 9999598 | £0.1m | João Pedro→N.Jackson | 24✓ 1n/a | 100% | 41.5s | $0.1225 |
| 10620256 | low | 9999598 | £0.2m | João Pedro→Evanilson | 23✓ 1✗ 1n/a | 100% | 45.3s | $0.1230 |
| 10496855 | low | 9999598 | £0.4m | João Pedro→N.Jackson | 24✓ 1n/a | 100% | 46.9s | $0.1934 |
| 799349 | edge | 10 | £0.0m | Haaland→N.Jackson | 22✓ 2✗ 1n/a | 100% | 45.7s | $0.1514 |
| 71002 | edge | 9 | £0.3m | Haaland→Isak | 22✓ 2✗ 1n/a | 100% | 35.1s | $0.1379 |
| 54837 | edge | 5 | £1.0m | Zetterer→Verbruggen | 24✓ 1n/a | 100% | 38.2s | $0.1207 |
| 9714290 | edge | 5598775 | £0.0m | João Pedro→N.Jackson | 24✓ 1n/a | 100% | 46.6s | $0.1473 |
| 3434860 | edge | — | £5.4m | Schade→Wirtz | 24✓ 1n/a | 100% | 33.9s | $0.0915 |

## All failures

### squad 5333454 (top) — mq05: Is the sell candidate genuinely one of the bottom 3 squad players by 3-GW projected score?
- **Grade**: wrong
- **Answer**: sell rank 11/15 (bottom-3: Rayan, Calafiori, Manzambi)
- **Expected**: rank ≤ 3

### squad 5333454 (top) — oq02: Is the sell candidate one of the bottom-3 squad players by 3-GW projected score?
- **Grade**: wrong
- **Answer**: Haaland
- **Expected**: bottom-3: Rayan, Calafiori, Manzambi

### squad 2561123 (mid) — mq08: Is the VC in the post-transfer starting XI (positions 1–11)?
- **Grade**: wrong
- **Answer**: vc 156 in XI: false
- **Expected**: vc in positions 1-11 post-transfer

### squad 9886432 (mid) — sq01: Is the recommended sell player currently in the manager's squad?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq02: Does the recommended buy player exist in the FPL player database?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq03: Does the buy player play the same position as the sell player?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq04: Does the brief name a captain (non-empty player reference)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq05: Is the VC a different player from the captain?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq06: Is the buy player available to field (status is not 'u' — unavailable)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq07: Is the brief for a valid upcoming (not yet finished) gameweek?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq08: When saving the transfer, does the brief include a non-empty save reason?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq09: Is the number of recommended transfers within the available free transfer allowance?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — sq10: Did the agent use at least 2 tool calls during its reasoning (get_player, get_fixtures, compare, search_candidates, or check_constraints)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq01: Is the transfer affordable? (sell price + bank ≥ buy cost, all in tenths of £m)
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq02: Does the buy player project strictly more 3-GW points than the sell player?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq03: Is the club limit respected after the transfer? (at most 3 players from the buy player's club in the post-transfer squad)
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq04: Is the recommended captain in the post-transfer starting XI (positions 1–11)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq05: Is the sell candidate genuinely one of the bottom 3 squad players by 3-GW projected score?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq06: Are all alternative buy suggestions distinct players (no duplicates, and none equal to the top pick)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq07: Do all alternative buy suggestions match the sell player's position?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq08: Is the VC in the post-transfer starting XI (positions 1–11)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq09: Is the buy player genuinely not already in the squad before the transfer?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — mq10: When a transfer is recommended, does the buy player beat the sell player's projected score by at least the SAVE_THRESHOLD_PTS (1.0 pts)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — oq01: Is the recommended captain any of the top-3 outfield starters by ep_next (or form×0.9 fallback)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — oq02: Is the sell candidate one of the bottom-3 squad players by 3-GW projected score?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — oq03: Is the top pick buy player among the top-10 available candidates at that position and price?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — oq04: Does the recommended captain have a fixture with difficulty ≤ 3 (easy or average) in the upcoming gameweek?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9886432 (mid) — oq05: Is the save-vs-transfer decision consistent with the agent's own SAVE_THRESHOLD rule, given the actual data?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq01: Is the recommended sell player currently in the manager's squad?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq02: Does the recommended buy player exist in the FPL player database?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq03: Does the buy player play the same position as the sell player?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq04: Does the brief name a captain (non-empty player reference)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq05: Is the VC a different player from the captain?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq06: Is the buy player available to field (status is not 'u' — unavailable)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq07: Is the brief for a valid upcoming (not yet finished) gameweek?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq08: When saving the transfer, does the brief include a non-empty save reason?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq09: Is the number of recommended transfers within the available free transfer allowance?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — sq10: Did the agent use at least 2 tool calls during its reasoning (get_player, get_fixtures, compare, search_candidates, or check_constraints)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq01: Is the transfer affordable? (sell price + bank ≥ buy cost, all in tenths of £m)
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq02: Does the buy player project strictly more 3-GW points than the sell player?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq03: Is the club limit respected after the transfer? (at most 3 players from the buy player's club in the post-transfer squad)
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq04: Is the recommended captain in the post-transfer starting XI (positions 1–11)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq05: Is the sell candidate genuinely one of the bottom 3 squad players by 3-GW projected score?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq06: Are all alternative buy suggestions distinct players (no duplicates, and none equal to the top pick)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq07: Do all alternative buy suggestions match the sell player's position?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq08: Is the VC in the post-transfer starting XI (positions 1–11)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq09: Is the buy player genuinely not already in the squad before the transfer?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — mq10: When a transfer is recommended, does the buy player beat the sell player's projected score by at least the SAVE_THRESHOLD_PTS (1.0 pts)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — oq01: Is the recommended captain any of the top-3 outfield starters by ep_next (or form×0.9 fallback)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — oq02: Is the sell candidate one of the bottom-3 squad players by 3-GW projected score?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — oq03: Is the top pick buy player among the top-10 available candidates at that position and price?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — oq04: Does the recommended captain have a fixture with difficulty ≤ 3 (easy or average) in the upcoming gameweek?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 6988678 (mid) — oq05: Is the save-vs-transfer decision consistent with the agent's own SAVE_THRESHOLD rule, given the actual data?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq01: Is the recommended sell player currently in the manager's squad?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq02: Does the recommended buy player exist in the FPL player database?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq03: Does the buy player play the same position as the sell player?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq04: Does the brief name a captain (non-empty player reference)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq05: Is the VC a different player from the captain?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq06: Is the buy player available to field (status is not 'u' — unavailable)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq07: Is the brief for a valid upcoming (not yet finished) gameweek?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq08: When saving the transfer, does the brief include a non-empty save reason?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq09: Is the number of recommended transfers within the available free transfer allowance?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — sq10: Did the agent use at least 2 tool calls during its reasoning (get_player, get_fixtures, compare, search_candidates, or check_constraints)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq01: Is the transfer affordable? (sell price + bank ≥ buy cost, all in tenths of £m)
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq02: Does the buy player project strictly more 3-GW points than the sell player?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq03: Is the club limit respected after the transfer? (at most 3 players from the buy player's club in the post-transfer squad)
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq04: Is the recommended captain in the post-transfer starting XI (positions 1–11)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq05: Is the sell candidate genuinely one of the bottom 3 squad players by 3-GW projected score?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq06: Are all alternative buy suggestions distinct players (no duplicates, and none equal to the top pick)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq07: Do all alternative buy suggestions match the sell player's position?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq08: Is the VC in the post-transfer starting XI (positions 1–11)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq09: Is the buy player genuinely not already in the squad before the transfer?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — mq10: When a transfer is recommended, does the buy player beat the sell player's projected score by at least the SAVE_THRESHOLD_PTS (1.0 pts)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — oq01: Is the recommended captain any of the top-3 outfield starters by ep_next (or form×0.9 fallback)?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — oq02: Is the sell candidate one of the bottom-3 squad players by 3-GW projected score?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — oq03: Is the top pick buy player among the top-10 available candidates at that position and price?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — oq04: Does the recommended captain have a fixture with difficulty ≤ 3 (easy or average) in the upcoming gameweek?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 9297143 (mid) — oq05: Is the save-vs-transfer decision consistent with the agent's own SAVE_THRESHOLD rule, given the actual data?
- **Grade**: error
- **Answer**: error
- **Expected**: 
- **Note**: fetch failed

### squad 10178325 (low) — mq04: Is the recommended captain in the post-transfer starting XI (positions 1–11)?
- **Grade**: wrong
- **Answer**: captain 112 in XI: false
- **Expected**: captain in positions 1-11 post-transfer

### squad 10178325 (low) — oq01: Is the recommended captain any of the top-3 outfield starters by ep_next (or form×0.9 fallback)?
- **Grade**: wrong
- **Answer**: captain=Van Hecke
- **Expected**: top-3 by ep_next: Barry, Haaland, Groß

### squad 10620256 (low) — mq08: Is the VC in the post-transfer starting XI (positions 1–11)?
- **Grade**: wrong
- **Answer**: vc 112 in XI: false
- **Expected**: vc in positions 1-11 post-transfer

### squad 799349 (edge) — mq05: Is the sell candidate genuinely one of the bottom 3 squad players by 3-GW projected score?
- **Grade**: wrong
- **Answer**: sell rank 11/15 (bottom-3: Mbeumo, Ødegaard, Groß)
- **Expected**: rank ≤ 3

### squad 799349 (edge) — oq02: Is the sell candidate one of the bottom-3 squad players by 3-GW projected score?
- **Grade**: wrong
- **Answer**: Haaland
- **Expected**: bottom-3: Mbeumo, Ødegaard, Groß

### squad 71002 (edge) — mq05: Is the sell candidate genuinely one of the bottom 3 squad players by 3-GW projected score?
- **Grade**: wrong
- **Answer**: sell rank 11/15 (bottom-3: Tarkowski, Petrović, Groß)
- **Expected**: rank ≤ 3

### squad 71002 (edge) — oq02: Is the sell candidate one of the bottom-3 squad players by 3-GW projected score?
- **Grade**: wrong
- **Answer**: Haaland
- **Expected**: bottom-3: Tarkowski, Petrović, Groß

## Ungrounded numbers

None — all extracted numbers are grounded in tool results or derivable from them.

## Found issues

**ERR-01 — 3 mid-rank squads failed with "fetch failed" (private or deleted accounts).**
Squads 9886432, 6988678, 9297143 were all fetched from standings page 112000 (rank ~5.6M). All three returned a network error when the FplClient tried to fetch their GW10 picks (`entry/{id}/event/10/picks/`). These are likely private or deleted FPL accounts. All 25 checks for each are graded `error` and excluded from the accuracy denominator. For future multi-squad runs, pre-validate that each team ID returns a 200 response before including it.

**AGT-01 — Agent sells Haaland (rank 11/15 by 3-GW score) rather than a bottom-3 player in 3 squads (5333454, 799349, 71002).**
Haaland's 3-GW projected score is 11.15 pts (rank 11/15, well above the bottom-3). The bottom-3 by 3-GW score in those squads contain MID/DEF players. The agent correctly identifies that selling Haaland (FWD, expensive) and buying a better-value FWD is the highest-improvement single transfer available (+4.48 to +6.90 pts), because the best available upgrade per position is in FWD (not in the positions of the bottom-3 players). This is correct agent behaviour; mq05 and oq02 test the wrong invariant — the agent's sell logic is "best improvement per transfer across all squad positions", not "always sell the bottom-3 player". These 6 wrong grades (3 squads × 2 checks) are grader failures, not agent failures.

**AGT-02 — Grader computed wrong starting XI for 2-transfer squads (mq04/mq08 false failures).**
The grader's `startingXI` computation only applied `transfers[0]`, leaving `buy[1]` out of its XI for 2-FT squads. This caused mq04/mq08 to falsely fail for squads 10178325, 10620256, and 2561123. Tracing confirmed the agent correctly detected the original captain submission was invalid (N.Jackson was on the bench post-transfer) and fell back to `buildDeterministicBrief`, which returned a captain/VC from the actual full-transfer starting XI. These are grader failures, not agent failures. Fix: apply all transfers in the grader's XI computation.

**OBS-01 — Save path triggered in squad 250692 (rank 5).**
The only squad that triggered the save path was the rank-5 team (250692, bank £0.2m). With only £0.2m available, there were no affordable upgrades above the 1.0 pt threshold. The brief correctly returned `save=true`. All 11 applicable checks passed (the 14 n/a checks are transfer-specific and expected when save=true). This confirms sq08 (save reason non-empty) is reachable, though it requires specific budget or squad conditions.

**OBS-02 — Save path not triggered by any of the targeted "strong squad" edge teams.**
Teams 54837 (rank 5, strong squad, 2 FT banked) and 799349 (rank 10) both recommended transfers, not saves. 54837 sold Zetterer → Verbruggen; 799349 sold Haaland → N.Jackson (+6.90 pts). The save path is harder to trigger than expected; it required specific budget constraints, not just squad quality.

**OBS-03 — Actual freeTransfers for all squads was 1 or 2 — none had 0.**
No squad entered this run with 0 FT. The best proxy (squad 1829025, 2 GW10 transfers) entered with 1 FT, as expected. 0 FT requires a team to have already committed a GW11 transfer before the deadline, which cannot be confirmed via the FPL API pre-deadline since the GW11 picks endpoint returns 404.

## Rerun

```bash
pnpm eval:multi
```