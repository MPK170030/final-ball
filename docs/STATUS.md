# Status — Fri 24 Oct 2026

## Done
- **Thu 23 Oct — agent core (`feat/agent-core`):** transfer logic in `packages/agent` complete. `generateTransfers(teamId)` is the single entry point — loads context, scores all 15 players over 3 GWs, finds weak spots, filters candidates, calls the model, validates picks (step 7 replan, cap 2), and returns `{transfers, trace: TraceStep[], meta}`. Tested manually against Manav's team (3434860); broader team testing on Monday. 13 unit tests passing (scoring, weak-spot ranking, candidate filtering, 3-per-club replan).
- **Mon 19 Oct:** core MVP wireframes agreed; design system signed off (D14.11) with 10 components; docs updated (D8.6 why-sell line, D8.7 one reasoning view, D16.9 rank lookup in the core).
- **Accounts:** GitHub repo created, Supabase project created, Vercel account ready.
- **Domain (D11.12):** `finalball.manavpkothari.dev`. Root domain `manavpkothari.dev` verified in Google Search Console; DNS is on Vercel. The subdomain is not attached to a Vercel project yet.
- **Google OAuth (D11.12):** External, Testing, family added as test users, scopes openid/email/profile only, redirect to the Supabase callback.
- **Supabase auth:** Google provider on; Site URL `https://finalball.manavpkothari.dev`; redirect URLs `http://localhost:3000/**` and `https://finalball.manavpkothari.dev/**`.
- **Phase 4 (pages & routing):** `/brief`, `/onboarding`, `/privacy` pages; profile-aware post-sign-in routing (brief ↔ onboarding); open-redirect guard in auth callback.
- **Phase 5 (FPL client hardening):** `packages/agent` — `FplClient` with ±25% jitter, 503 game-updating hold, two-layer cache (MemoryCacheAdapter + SupabaseCacheAdapter), per-key TTLs, all new methods (`getEntryPicks`, `getEntryHistory`). Gameweek helpers. Health endpoint at `/api/fpl-health`.
- **Phase 6 (country leagues):** 132 country → FPL league-ID mappings written to `country_leagues` (season 2026) via `scripts/country-leagues`. Sampled GW7 Overall standings (24,900 entries).

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

**Implication for rank-lookup (D16.9):** maxTie can reach 50 (a full page) near the tail of the England and Nigeria leagues — meaning a tie group can span multiple pages. The lookup algorithm should scan `targetPage ± 1` (3 pages, 150 entries) to safely bracket any tie group seen in this sample. For production, scan `±2` pages to be conservative.

## Agent core — Thu 23 Oct 2026

**Scoring metric (D17.1)**
`ep_next × availability` for GW1 (FPL's own projection, fixture already baked in). `form × fdrMultiplier(fdr) × availability` for GW2/3, where `fdrMultiplier = max(0.25, (5−fdr)/4)`. Blank GW = 0. Double GW = ×2. Buy-side ranking is the same total divided by price in £m (pts/£m).

**Model (D17.2)**
`claude-sonnet-4-6` via `ANTHROPIC_MODEL` env var. Structured output via tool use (`submit_transfer_plan`). Max 1,024 output tokens per call. Approximate cost: ~$0.005–0.015 per brief at family scale (measure precisely once Monday runs are in).

**Save threshold (D17.5)**
+1.0 pts over 3 GWs. Below that the free transfer rolling to next week is usually worth more than the swap.

**Trace format (D8.4)**
Each step is `{n, title, text, replan?}`. Phase functions emit `TraceEntry[]` (no `n`); `generateTransfers` assigns sequential step numbers via `numberSteps()`. Replan steps (`replan: true`) match the `TraceStep` design component's dashed-orange variant.

**Known weaknesses**
- GW2/3 uses a 4-week rolling form average — slow to respond to a player trending sharply up or down over the last 1–2 weeks.
- Double GW pts are doubled but rotation risk in the second game isn't modeled (minutes uncertainty).
- No differential signal: ownership percentage isn't considered, so a 0.1%-owned pick is treated the same as a 50%-owned one.
- With 2 free transfers the pairing loop is greedy (first valid T1 → best T2); it won't find globally optimal combinations if the true best T1 is expensive and constrains T2 heavily.
- `ep_next` reflects FPL's model at bootstrap fetch time; late injury or team news between fetch and deadline isn't captured.

## Not yet
- Sign-in has never been tested (no app yet).
- Google app not published to production. Before publishing: landing page and `/privacy` live on the subdomain (brand verification needs them).
- Anthropic API key with a spend limit (needed Thursday for the agent).
- **Phase 7 (deploy):** Connect Vercel to repo + add env vars; verify `https://finalball.manavpkothari.dev/auth/callback` in Supabase redirect URLs; publish Google OAuth app from Testing → Production.

## Owner's test data for the lookup
| Who | Team ID | Country | Country rank (2026-10-22) | Team name |
|---|---|---|---|---|
| Manav | 3434860 | USA | 130,322 | Kobbie and Paste |

## Lookup test results (2026-10-22)
Ran `scripts/test-lookup.ts` directly against FPL (no auth, mirrors route logic).

| Who | Team name | Rank | Found | Team ID | Pages scanned | Time |
|---|---|---|---|---|---|---|
| Manav | Kobbie and Paste | 130,322 | yes | 3434860 | 4 | 1.5s |

Notes: rank 130,322 → startPage 2607 → found on page 2609. Algorithm scanned pages 2606–2609 (rank ±1 window). No issues.

## Open items (non-blocking)
- FPL app tab names in the guide panels ("Leagues", "Points", "Pick Team") to confirm during UI work.
- ~~What weak spots are ranked by (shown to users in "Why sell"): decide Thursday.~~ Decided: pts/£m over 3 GWs (D17.1).
- Run the full country-leagues sampling script (`pnpm --filter @finalball/script-country-leagues start`) before the agent goes live to cover the remaining ~130 countries not yet in the table.
