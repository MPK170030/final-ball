# Final Ball — Project Plan

> "We create the chance, you finish it."
> An AI agent for Fantasy Premier League managers. It analyzes your squad and the next 3 fixtures, recommends transfers, captaincy, and when to play chips, lets you push back on any pick, then shows whether its advice worked.

All decisions referenced here (D-numbers) are in `decisions.md`.

**Updated 3 November 2026:** the agent becomes a bounded tool-using loop; card-scoped counters replace Refresh; risk tags replace the Safe/Balanced/Bold toggle (`decisions.md` section 17, D2.11).

---

## 1. Goals

| Goal | How it's measured |
|---|---|
| Managers come back every gameweek | Weekly returning users; email open rate → brief viewed |
| The advice measurably helps | Rolling 5-gameweek scorecard of transfer receipts; followed vs. ignored (D7.2–D7.4); who is right when the user pushes back (D17.6) |
| Strong portfolio piece | A real agent loop with a visible trace, counters, demo mode, a clean architecture story (D1.3, D8.4, D11.5, D17.1) |

**Non-goals for the MVP:** rival or league analysis, hits, multi-week plans, Wildcard and Free Hit squad builds, lineup advice, open chat, voice input, push notifications, monetization.

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
- **Risk tags** (Safe / Balanced / Bold) on transfer and captain options, all on a 3-gameweek window (D2.11, D4.3)
- **Reasoning:** a summary line, "Why?" to expand, and the real agent trace (tool calls, findings, replans) behind "How the agent decided"
- **Counters:** "Counter this pick" on transfer and captain cards; quick replies plus a text box; the agent re-checks with tools and holds, changes for a new fact, or accepts the user's preference; max 10 per gameweek (D17.4–D17.7)
- **"News since this brief" banner** on affected cards (D17.9)
- **Receipts:** transfers (with inferred intent and linked funding moves), captaincy, and chips; counter records; decision journal notes
- **Scheduled generation**; **one email per gameweek**; no user Refresh (D17.8)
- **Demo mode** (frozen snapshot + live toggle) for logged-out users
- **Settings:** change Team ID, email opt-out, unlink and delete data
- **Dark-first theme plus light mode**; mobile and desktop designed equally

### Post-MVP
Voice input for counters (D17.10); hits, Bold-tagged, max 1 (D2.9); agent-planned funding moves; Wildcard and Free Hit squad builders; chip planner timeline; lineup and bench advice; desktop "Find my ID" bookmarklet.

### Phase 2
Opt-in rival mode (league ownership badge, differentials as the tie-breaker, gap context, captain ownership logic), league selection, strategy that shifts with the points gap, rival chip tracking.

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────┐
│ Vercel (Hobby) — /apps/web (Next.js + Tailwind + shadcn/ui) │
│   • UI reads stored briefs from Supabase (instant loads)    │
│   • /api/first-brief → agent, brief mode, for a new user    │
│   • /api/counter → agent, counter mode, for one card        │
│     (max 300s, streamed progress, 10 counters per GW)       │
└──────────────┬─────────────────────────────────────────────┘
               │
┌──────────────▼──────────────┐     ┌───────────────────────┐
│ Supabase (free)             │     │ Model API             │
│  Postgres + Google auth     │     │ (called by agent,     │
│                             │     │  tool-use loop)       │
└──────────────▲──────────────┘     └───────────▲───────────┘
               │                                │
┌──────────────┴────────────────────────────────┴───────────┐
│ GitHub Actions (public repo)                              │
│  • daily-refresh.yml: FPL prices, injuries, fixtures →    │
│    Supabase; flags news for stored briefs; resolves       │
│    receipts and counter records; keeps the DB active      │
│  • weekly-brief.yml: ~24h before deadline, odd minute;    │
│    runs brief mode for every user, then sends emails      │
│  • both: manual-run button, safe to re-run                │
└──────────────┬────────────────────────────────────────────┘
               │
        Official FPL API (read-only, cached, throttled)
        Email: Nodemailer → Resend SMTP (own domain, SPF/DKIM)
```

**Monorepo layout**
```
/apps/web            Next.js app
/packages/agent      Agent: tool loop, tools, FPL client, rule validator, trace (framework-agnostic)
/packages/db         Supabase schema, types, queries
/scripts/weekly      Batch brief generation + email
/scripts/daily       Data refresh, news flags, receipt and counter resolution
/.github/workflows   daily-refresh.yml, weekly-brief.yml
```

---

## 4. Agent design

The agent is a **bounded tool-using loop** (D17.1). The model chooses its next action. Code owns the rules and validates every final output.

### Tools (all read-only, D17.2)

| Tool | Returns |
|---|---|
| `get_squad` | The user's 15 players, bank, free transfers, chips |
| `get_player(id)` | Form, minutes, price, status, ownership-free stats |
| `get_fixtures(team, n)` | Next n fixtures with difficulty |
| `get_news(player)` | Injury, suspension, and availability flags |
| `search_candidates(position, max_price)` | Players who fit a slot |
| `check_constraints(move)` | Pass, or the rules the move breaks (budget, 3 per club, position, free transfers) |
| `compare(a, b)` | Side-by-side 3-GW comparison |
| `get_my_track_record(filter)` | The agent's settled receipts and counter records (D17.3) |

### Brief mode (scheduled run, first brief)

1. **Start** with the squad and a short context: gameweek, deadline, last week's preview, and news flags.
2. **Loop** (about 15 tool calls max): the model investigates weak spots, pulls only the data it needs, searches candidates, checks constraints, and replans when a move fails.
3. **Output** a structured brief: check-in, up to 2 transfer cards (top pick + 3 alternatives with risk tags, or "Save the transfer"), captain options with risk tags, chip advice (3-GW window plus the full-fixture blank/double scan, "provisional"), and a next-week preview.
4. **Validate** in code: every move passes `check_constraints`; required fields exist. On failure, return the errors to the loop once; then fail the run.
5. **Save** the brief with the full trace (every tool call, its result summary, and every replan).

### Counter mode (one card, D17.5)

1. **Start** with the card, its reasoning and trace, the user's counter (quick reply or text), and fresh news.
2. **Reject** off-topic counters in one line, with no tool calls.
3. **Loop** (about 6 tool calls max): the model must re-check the claim with tools before it answers.
4. **Output** exactly one outcome: **Holds**, **Changes for a new fact**, or **Accepts your preference** (with the best move under that preference).
5. **Validate** any new move with `check_constraints`. **Save** a counter record; the brief's original pick stays the agent's record (D17.6).

---

## 5. Data model (initial)

| Table | Key fields |
|---|---|
| `users` | id, google_sub, email, team_id, email_opt_out, created_at |
| `fpl_cache` | key (bootstrap, fixtures, element_summary:{id}), payload, fetched_at |
| `briefs` | id, user_id, gameweek, generated_by (schedule/first), trace, created_at |
| `cards` | id, brief_id, type (transfer/save/captain/chip/preview/check_in), rank, risk_tag (safe/balanced/bold, nullable), payload, reasoning_summary, reasoning_full |
| `brief_news` | id, brief_id, card_id, player_id, kind (injury/suspension/availability), detail, detected_at |
| `counters` | id, user_id, card_id, gameweek, quick_reply (nullable), message, outcome (held/changed_fact/accepted_preference/declined), new_payload, trace, status (ok/failed), created_at |
| `counter_records` | counter_id, user_choice (agent_original/agent_changed/own), verdict (agent_right/user_right/even), delta_pts, status (pending/settled), settled_at |
| `counter_usage` | user_id, gameweek, count |
| `decisions` | id, user_id, gameweek, card_id (nullable), label (followed / own_move / ignored_rolled / ignored_transferred), risk_tag (of the pick made, nullable), actual_move (from FPL history), journal_note, detected_at |
| `intents` | decision_id, inferred (points/funding/injury_cover), corrected_by_user, linked_decision_id |
| `receipts` | decision_id, window_start_gw, window_end_gw, delta_pts, status (pending/settled), settled_at |
| `email_log` | user_id, gameweek, sent_at, status |
| `demo_snapshot` | the frozen squad, brief, and receipts used by demo mode |
| `country_leagues` | season, country, league_id (built once per season) |
| `standings_cache` | league_id, page, gameweek, payload, fetched_at (cached for the gameweek; used by the team lookup) |

Removed on 3 Nov: `refresh_usage`, `briefs.version`, `briefs.aggression`. The user's actual transfers come from the FPL API's history and transfer endpoints. Squads are never copied.

---

## 6. Weekly operations timeline

| When | Job | Purpose |
|---|---|---|
| Daily | `daily-refresh` | Cache prices, injuries, fixtures; flag news for stored briefs; settle receipts and counter records; keep Supabase active |
| Deadline − ~24h (at an odd minute, e.g. :17) | `weekly-brief` | Run brief mode for all users, then send emails |
| Any time before the deadline | User counters (max 10) | Push back on a card; re-check after news |
| After the gameweek ends | `daily-refresh` | Update pending receipts and counter records |

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
| First brief generated on demand | Counters (replaced Refresh on 3 Nov) |
| Transfer cards: top pick + 3 alternatives, "Save your transfer," up to 2 cards | Chips, next-week preview, stick-or-diverge check-in |
| Captain card | Receipts, scorecard, journal |
| Summary reason, "Why?", and the agent trace | Curated demo mode |
| **Public sample brief page:** the owner's team, real this week, no sign-in | Settings beyond sign out and change team |
| **Daily GitHub Actions job** (keeps Supabase active, caches FPL data) | Risk tags (replaced the style toggle on 3 Nov) |
| **Per-user daily cap on generating briefs** (until scheduled briefs and the counter cap land) | Full motion design, light mode |
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
| **26 Oct – 1 Nov** | Scheduled briefs + weekly email; "Email me a link to finish on my computer"; next-week preview + check-in; lookup fixes from family feedback. *(Refresh and the style toggle were planned here; replaced on 3 Nov.)* |
| **2 – 8 Nov** | Chips behind the toggle (timing, blank/double scan, expiry); receipts pipeline (labels, funding moves, captain and chip receipts) |
| **9 – 15 Nov** | Scorecard, journal prompt, curated demo mode, Settings (email opt-out, delete data), accessibility, motion, light mode |
| **16 – 20 Nov** | Polish, buffer, case study write-up, 60–90 second screen recording; **full MVP** |

**Added 3 Nov, no scope cuts (D16.10):** convert the agent to the tool loop (brief mode); risk tags on options; counter mode with quick replies, outcomes, cap, and counter records; "News since this brief" banner; `get_my_track_record`; remove the per-user daily generation cap once scheduled briefs and the counter cap are live. Updated wireframes come first.

### Portfolio presentation
- Live app link, opening on the public sample brief
- A case study page covering: the agent loop, its tools, and the visible trace; counters and why the agent doesn't cave; the team-ID problem and the country-rank solution; the accountability positioning; architecture under free-tier limits
- A 60–90 second screen recording of a brief being generated and a counter being answered
- An honest "v0.1, MVP in progress" label with the roadmap above

---

## 8. Risks and mitigations

| Risk | Severity | Mitigation | Fallback |
|---|---|---|---|
| FPL API throttling, IP blocks, "game updating" window | High | Fetch shared data once per run; throttle per-user calls; retry with increasing waits; cache everything; **test in week 1** | Run the batch from another host |
| Supabase free project pauses after 7 days of inactivity (international breaks) | High | Daily data-refresh job | Supabase Pro ($25/mo) or Neon |
| The agent caves to counters | High | Counter loop must re-check with tools; three fixed outcomes; "Accepts your preference" kept separate from "Changes for a new fact"; counter records scored (D17.5, D17.6) | Tighten the counter prompt; test with scripted pushback |
| Agent loop is unpredictable (wrong tools, loops too long, weak picks) | Medium | Tool-call and time budgets; code validates every output; test on a fixed set of 5–10 squads after each change | Fall back to a fixed tool order for the batch |
| GitHub scheduled runs delayed 30–60 minutes | Medium | Run ~24h before the deadline at an odd minute; manual-run button; safe to re-run | External cron calling a Vercel endpoint |
| Public repository: scheduled workflows disabled after 60 days of no activity | Low (during the season) | Re-enable before each season | — |
| Vercel's 300-second limit on the first brief or a counter | Low | Stream progress; tool-call budgets | Render Starter ($7/mo) |
| Vercel Hobby is non-commercial only | Medium if monetized | No ads or donations | Vercel Pro |
| Model costs growing with users | Medium | Counter cap (10 per gameweek); off-topic counters use no tools; cache shared analysis; tool loops cost more per brief than a pipeline | Cheaper model for the batch; lower the cap |
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
- Counter cap value (starts at 10; tune from usage)
- Counter message length limit
- How a counter-record verdict is scored when the user's choice and the agent's pick tie or both are pending
- Other interactive controls (D17.12)

## 10. Next step

Update the wireframes for counters, risk tags, the news banner, and the real trace; remove Refresh.
