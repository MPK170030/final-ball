# Final Ball — Project Plan

> "We create the chance, you finish it."
> An AI agent for Fantasy Premier League managers. It analyzes your squad and the next 3 fixtures, recommends transfers, captaincy, and when to play chips, then shows whether its advice worked.

All decisions referenced here (D-numbers) are in `decisions.md`.

---

## 1. Goals

| Goal | How it's measured |
|---|---|
| Managers come back every gameweek | Weekly returning users; email open rate → brief viewed |
| The advice measurably helps | Rolling 5-gameweek scorecard of transfer receipts; followed vs. ignored (D7.2–D7.4) |
| Strong portfolio piece | Demo mode, visible agent trace, a clean architecture story (D1.3, D8.4, D11.5) |

**Non-goals for the MVP:** rival or league analysis, hits, multi-week plans, Wildcard and Free Hit squad builds, lineup advice, chat or voice input, push notifications, monetization.

---

## 2. Scope

### MVP
- **Accounts:** Google sign-in → **find your team by country + country rank + team name** (scan from page ⌊(rank − 1) / 50⌋ + 1; tie-size probe; rotating progress text; "Use my FPL link instead" from 5 seconds; 30-second cap) → URL fallback (Open FPL, copied-link detection, paste a link or ID, visual guide, email-to-desktop) → "Is this you?" → one account per team
- **Weekly brief** (dashboard of cards, in this order):
  1. Stick-or-diverge check-in (when last week's preview exists)
  2. Transfer cards: up to 2, each with a top pick plus 3 alternatives, or "Save the transfer"
  3. Captain + vice + 1–2 alternatives
  4. Chip alert card + chip status strip with expiry countdown
  5. Next-week preview
  6. Receipts + 5-gameweek scorecard
- **Aggression toggle** (Safe / Balanced / Bold) that regenerates the suggestions and resets to Balanced each week
- **Reasoning:** a summary line, "Why?" to expand, and the full trace behind "How the agent decided"
- **Receipts:** transfers (with inferred intent and linked funding moves), captaincy, and chips; decision journal notes
- **Refresh** (max 3 per gameweek); **scheduled generation**; **one email per gameweek**
- **Demo mode** (frozen snapshot + live toggle) for logged-out users
- **Settings:** change Team ID, email opt-out, unlink and delete data
- **Dark-first theme plus light mode**; mobile and desktop designed equally

### Post-MVP
"Ask the agent" (text and voice, including "why not X"); hits tied to aggression (max 1); agent-planned funding moves; Wildcard and Free Hit squad builders; chip planner timeline; lineup and bench advice; desktop "Find my ID" bookmarklet.

### Phase 2
Opt-in rival mode (league ownership badge, differentials as the tie-breaker, gap context), league selection, strategy that shifts with the points gap, rival chip tracking.

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────┐
│ Vercel (Hobby) — /apps/web (Next.js + Tailwind + shadcn/ui) │
│   • UI reads stored briefs from Supabase (instant loads)    │
│   • /api/refresh → imports @finalball/agent for one user    │
│     (max 300s, streamed progress, capped at 3 per GW)       │
└──────────────┬─────────────────────────────────────────────┘
               │
┌──────────────▼──────────────┐     ┌───────────────────────┐
│ Supabase (free)             │     │ Model API             │
│  Postgres + Google auth     │     │ (called by agent)     │
└──────────────▲──────────────┘     └───────────▲───────────┘
               │                                │
┌──────────────┴────────────────────────────────┴───────────┐
│ GitHub Actions (public repo)                              │
│  • daily-refresh.yml: FPL prices, injuries, fixtures →    │
│    Supabase; resolves receipts; keeps the DB active       │
│  • weekly-brief.yml: ~24h before deadline, odd minute;    │
│    generates every user's brief, then sends emails        │
│  • both: manual-run button, safe to re-run                │
└──────────────┬────────────────────────────────────────────┘
               │
        Official FPL API (read-only, cached, throttled)
        Email: Nodemailer → Resend SMTP (own domain, SPF/DKIM)
```

**Monorepo layout**
```
/apps/web            Next.js app
/packages/agent      Agent: FPL client, analysis, model calls, trace (framework-agnostic)
/packages/db         Supabase schema, types, queries
/scripts/weekly      Batch brief generation + email
/scripts/daily       Data refresh + receipt resolution
/.github/workflows   daily-refresh.yml, weekly-brief.yml
```

---

## 4. Agent flow (per user, per run)

1. **Load context:** shared player and fixture data (cached in Supabase), the user's squad, bank, free transfers, chips, last week's preview, and the aggression level.
2. **Check last week's preview:** compare it with the latest news; produce a stick-or-diverge recommendation.
3. **Find weak spots:** form, the next 3 fixtures (FDR as one input among several), injury or rotation risk, value.
4. **Search for candidates** for each weak spot (up to the number of free transfers, max 2).
5. **Check constraints:** budget, 3-players-per-club limit, positions, free transfers. **If a candidate breaks a rule, replan** and record it in the trace.
6. **Rank:** the top pick plus 3 alternatives, with reasoning, or recommend "Save the transfer."
7. **Captain:** consider the squad after the suggested transfers; pick captain, vice, and alternatives.
8. **Chips:** check timing using the 3-gameweek window plus the full-fixture blank/double scan ("provisional"), and expiry nudges.
9. **Next-week preview:** one non-binding line.
10. **Save** the brief as a new version, with the full trace.

---

## 5. Data model (initial)

| Table | Key fields |
|---|---|
| `users` | id, google_sub, email, team_id, email_opt_out, created_at |
| `fpl_cache` | key (bootstrap, fixtures, element_summary:{id}), payload, fetched_at |
| `briefs` | id, user_id, gameweek, version, aggression, generated_by (schedule/refresh), trace, created_at |
| `cards` | id, brief_id, type (transfer/save/captain/chip/preview/check_in), rank, payload, reasoning_summary, reasoning_full |
| `decisions` | id, user_id, gameweek, brief_version, card_id (nullable), label (followed / own_move / ignored_rolled / ignored_transferred), actual_move (from FPL history), journal_note, detected_at |
| `intents` | decision_id, inferred (points/funding/injury_cover), corrected_by_user, linked_decision_id |
| `receipts` | decision_id, window_start_gw, window_end_gw, delta_pts, status (pending/settled), settled_at |
| `refresh_usage` | user_id, gameweek, count |
| `email_log` | user_id, gameweek, sent_at, status |
| `demo_snapshot` | the frozen squad, brief, and receipts used by demo mode |
| `country_leagues` | season, country, league_id (built once per season) |
| `standings_cache` | league_id, page, gameweek, payload, fetched_at (cached for the gameweek; used by the team lookup) |

The user's actual transfers come from the FPL API's history and transfer endpoints. Squads are never copied.

---

## 6. Weekly operations timeline

| When | Job | Purpose |
|---|---|---|
| Daily | `daily-refresh` | Cache prices, injuries, fixtures; settle receipts; keep Supabase active |
| Deadline − ~24h (at an odd minute, e.g. :17) | `weekly-brief` | Generate all briefs, then send emails |
| Any time before the deadline | User Refresh (max 3) | Regenerate after breaking news |
| After the gameweek ends | `daily-refresh` | Update pending receipts |

---

## 7. Delivery plan

**Locked 19 October 2026; revised the same day to move the country-rank lookup into the core (D16.9).** Two milestones:

| Milestone | Target date | What it means |
|---|---|---|
| **Core MVP (v0.1)** | **Sunday 25 October 2026** | Sign in, find your team by country rank (link fallback), get a real brief (transfers + captain). Public sample brief for the portfolio. Family testing starts. |
| **Full MVP** | **~Friday 20 November 2026** | Everything in `decisions.md` marked MVP |

**Capacity:** confirmed 19 Oct: the owner will work as many hours as the deadlines need. Recheck progress against the plan every Sunday.

**Timing realities:**
- Receipts settle 3 played gameweeks after a move, so the scorecard shows real results a few weeks after the receipt pipeline ships.
- The first chip set expires at the GW19 deadline (2 January 2027), so chip advice must ship by early November to be useful.

### Core MVP scope (by Sunday 25 October)

| In | Moved to later weeks |
|---|---|
| Google sign-in (published to production), Supabase, deploy on Vercel | Scheduled briefs and weekly email |
| Team linking: **find your team by country + country rank + team name** (country list, tie-size probe, page scan, real progress text, 5-second link option, 30-second cap, standings cache), **link fallback** (paste a link or ID, copied-link detection, guide), "Is this you?", one account per team, cancel | "Email me a link to finish on my computer" (needs the email setup) |
| First brief generated on demand | Refresh with 3-per-gameweek cap and versions |
| Transfer cards: top pick + 3 alternatives, "Save your transfer," up to 2 cards | Chips, next-week preview, stick-or-diverge check-in |
| Captain card | Receipts, scorecard, journal |
| Summary reason, "Why?", and the agent trace | Curated demo mode |
| **Public sample brief page:** the owner's team, real this week, no sign-in | Settings beyond sign out and change team |
| **Daily GitHub Actions job** (keeps Supabase active, caches FPL data) | Safe/Balanced/Bold toggle (cut from the stretch goal) |
| **Per-user daily cap on generating briefs** (until Refresh logic lands) | Full motion design, light mode |
| Landing page labeled **"v0.1, MVP in progress,"** privacy page, sign out, error states | |

### Day by day (core MVP)

| Day | Focus | Done when |
|---|---|---|
| **Mon 19 Oct** | Low-fi wireframes for the core screens (landing, find your team, searching, link fallback, is this you, brief, reasoning, sample brief); minimal tokens from the decided palette | Screens agreed |
| **Tue 20 Oct** | Monorepo; Next.js + Tailwind + shadcn; Supabase + Google sign-in; schema; FPL client with caching; **test FPL API calls from Vercel and GitHub Actions**; **build the country-to-league-ID list and measure tied-group sizes (USA, England, India)**; daily job; deploy skeleton | Signed-in empty app live; country list stored |
| **Wed 21 Oct** | Team linking: country-rank lookup (page formula, fuzzy name match, neighbor rank group, tie-size probe, progress text, 5-second link option, 30-second cap, standings cache); link fallback (paste link or ID, copied-link detection); "Is this you?", team already linked, cancel | A real team found by rank end to end, and by link |
| **Thu 22 Oct** | Agent core: weak spots, candidates, constraint check with replan, ranking, "Save your transfer" | Correct suggestions for the owner's team |
| **Fri 23 Oct** | Captain; reasoning and trace; saving briefs; brief UI; daily generation cap | Brief visible in the app |
| **Sat 24 Oct** | Public sample brief page; landing page; error states; testing on 3–4 different squads; **test the lookup with each family member's real rank and team name** | Works for squads other than the owner's |
| **Sun 25 Oct** | Buffer, fixes, publish Google sign-in to production, deploy; send to family; add to portfolio | Family and recruiters can use it |

**Biggest risks:** the rank lookup on Wednesday and agent quality on Thursday and Friday. If the lookup isn't finding teams by Wednesday night, it spills into Thursday morning and squeezes the agent work; the link fallback ships regardless, so nobody is blocked from signing up. Saturday's testing absorbs any slip; the sample brief page is never cut, since the portfolio depends on it.

### After the core (to the full MVP)

| Week | Adds |
|---|---|
| **26 Oct – 1 Nov** | Scheduled briefs + weekly email; "Email me a link to finish on my computer"; Refresh with cap and versions; next-week preview + check-in; style toggle; lookup fixes from family feedback |
| **2 – 8 Nov** | Chips behind the toggle (timing, blank/double scan, expiry); receipts pipeline (labels, funding moves, captain and chip receipts) |
| **9 – 15 Nov** | Scorecard, journal prompt, curated demo mode, Settings (email opt-out, delete data), accessibility, motion, light mode |
| **16 – 20 Nov** | Polish, buffer, case study write-up, 60–90 second screen recording; **full MVP** |

### Portfolio presentation
- Live app link, opening on the public sample brief
- A case study page covering: the agent loop and visible trace; the team-ID problem and the country-rank solution; the accountability positioning; architecture under free-tier limits
- A 60–90 second screen recording of a brief being generated
- An honest "v0.1, MVP in progress" label with the roadmap above

---

## 8. Risks and mitigations

| Risk | Severity | Mitigation | Fallback |
|---|---|---|---|
| FPL API throttling, IP blocks, "game updating" window | High | Fetch shared data once per run; throttle per-user calls; retry with increasing waits; cache everything; **test in week 1** | Run the batch from another host |
| Supabase free project pauses after 7 days of inactivity (international breaks) | High | Daily data-refresh job | Supabase Pro ($25/mo) or Neon |
| GitHub scheduled runs delayed 30–60 minutes | Medium | Run ~24h before the deadline at an odd minute; manual-run button; safe to re-run | External cron calling a Vercel endpoint |
| Public repository: scheduled workflows disabled after 60 days of no activity | Low (during the season) | Re-enable before each season | — |
| Vercel's 300-second limit on Refresh | Low | Stream progress; refresh one card at a time | Render Starter ($7/mo) |
| Vercel Hobby is non-commercial only | Medium if monetized | No ads or donations | Vercel Pro |
| Model costs growing with users | Medium | Refresh cap; cache shared analysis | Cheaper model for the batch |
| Unofficial FPL API changes | Medium | Isolate all FPL calls in one client module | — |
| Rank lookup not ready by the core deadline (moved into the core, D16.9) | Medium | Country list built Tuesday; lookup alone on Wednesday; tested with family ranks on Saturday | The link fallback ships either way |
| Slow team lookup in large country leagues (England, India) | Medium | Tie-size probe, per-gameweek caching, 30-second cap with progress text, "Use my FPL link" from 5 seconds | URL fallback; post-MVP bookmarklet |
| Bursts of requests during signup trigger FPL throttling | Medium | A few requests at a time; cache; skip ahead for huge tied groups | URL fallback |
| Brand or policy risk | Low | Disclaimer, no Premier League branding, no "FPL" in the name, read-only | — |

---

## 9. Open items to verify

- FPL API behavior from GitHub Actions runners (week 1)
- FPL history and transfer endpoints for rebuilding receipts (week 1)
- Country league IDs, and tied-group sizes in large countries (**Tue 20 Oct**; Wednesday's lookup depends on it)
- Resend free-tier sending limits
- Domain availability for "Final Ball," plus a trademark check before any public launch
- Exact warning color (set in the design system)

## 10. Next step

Start Phase 0: **the user flow.**
