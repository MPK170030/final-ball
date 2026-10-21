# Final Ball — User Stories

> "We create the chance, you finish it."

**Source of truth:** `decisions.md` (D-numbers) and the User Flows doc (Flows 1–7, screens 1–14, E1–E2).
**Updated:** 19 October 2026 (country-rank lookup moved into the core, D16.9)

## How to read this

- **Format:** *As a [user], I want [goal], so that [benefit]*, followed by acceptance criteria. A story is done when every box can be ticked.
- **IDs:** `US-<epic>.<n>`. Each story lists its flow, screens, and decisions.
- **Release:** every story below is **MVP** unless marked otherwise. Post-MVP and Phase 2 items are in the backlog at the end.

## Users

| User | Who | Notes |
|---|---|---|
| **Manager** | An FPL player using the app weekly | Primary user; assumed to know FPL terms |
| **New manager** | A manager signing up for the first time | The same person, during onboarding |
| **Visitor** | A non-player or recruiter, logged out | Uses demo mode only |
| **Owner** | You, running the app | Enabler stories for jobs, data, and limits |

## Epics

| Epic | Stories | Flow |
|---|---|---|
| E1 First visit and sign-in | 4 | 1 |
| E2 Onboarding: find your team | 9 | 2 |
| E3 Weekly brief | 11 | 3 |
| E4 Refresh | 3 | 4 |
| E5 Receipts, scorecard, and journal | 7 | 5 |
| E6 Weekly email | 2 | 3 |
| E7 Settings and privacy | 5 | 6 |
| E8 Demo mode | 5 | 7 |
| E9 Errors and edge states | 4 | All |
| E10 Owner and system | 8 | Behind the scenes |
| **Total MVP** | **58** | |

## Core MVP (by Sunday 25 October)

These stories ship first (D16.2, D16.9); the rest follow by ~20 November (`plan.md` section 7).

| Epic | Core stories | Notes |
|---|---|---|
| E1 | US-1.1, 1.2, 1.3, 1.4 | Landing labeled "v0.1, MVP in progress" |
| E2 | US-2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9 | Find your team by **country, country rank, and team name**, with the link fallback. US-2.5 (email to finish on a computer) follows with the email setup |
| E3 | US-3.1, 3.2 (on demand, not scheduled), 3.4, 3.5, 3.6, 3.8, 3.9 | No chips, preview, check-in, or style toggle yet |
| E7 | US-7.1, 7.3, 7.4, 7.5 | Change team, sign out, no FPL password, privacy page |
| E8 | **US-8.5** | Public sample brief; never cut |
| E9 | US-9.1, 9.2, 9.3 | FPL updating, deadline passed, large-country searches |
| E10 | US-10.1, 10.3, 10.4, 10.5, 10.7, **10.8** | Daily job, country league list, standings cache, polite FPL client, read-only, daily generation cap |

---

## E1 — First visit and sign-in (Flow 1)

### US-1.1 Landing page
*As a visitor, I want to understand what Final Ball does in a few seconds, so that I can decide whether to try it.*
- [ ] Shows the name, tagline ("We create the chance, you finish it"), and a one-line value statement
- [ ] Offers **Get started**, a small **Sign in** link, and **Try the demo**
- [ ] States that the app is not affiliated with the Premier League or FPL
- [ ] Shows no Premier League logos or club crests

*Screen 1 · D1.4, D9.12, D15.1*

### US-1.2 One sign-in button
*As a manager, I want a single "Continue with Google" button, so that I never have to wonder whether I already have an account.*
- [ ] **Get started** and **Sign in** both lead to the same Google step
- [ ] No separate sign-up and sign-in screens
- [ ] No passwords are created or stored by Final Ball

*Screens 1–2 · D9.1, D15.1*

### US-1.3 Sent to the right place after sign-in
*As a manager, I want the app to know where I left off, so that I land on the right screen after Google.*
- [ ] New account → onboarding (US-2.1)
- [ ] Existing account with a linked team → weekly brief
- [ ] Existing account with no linked team → onboarding

*Flow 1 · D15.1*

### US-1.4 Stay signed in
*As a manager, I want to stay signed in, so that the link in my weekly email opens my brief directly.*
- [ ] A signed-in user who visits skips the landing page and sees their brief
- [ ] The session works across phone and computer once signed in on each

*Flow 1*

---

## E2 — Onboarding: find your team (Flow 2)

### US-2.1 Find my team without technical details
*As a new manager, I want to find my team using my country, my country rank, and my team name, so that I don't have to dig for an ID number.*
- [ ] Country is pre-selected from the device's region and can be changed
- [ ] Country rank accepts a number with or without commas
- [ ] Team name is matched loosely (capitals, emoji, and special characters ignored)
- [ ] A short guide shows where to find the country rank in the FPL app (Leagues, next to the country name)
- [ ] The copy tells the user to enter the rank the FPL app shows right now

*Screen 3 · D9.3, D9.3a*

### US-2.2 See the search working
*As a new manager, I want to see progress while the app looks for my team, so that waiting feels purposeful.*
- [ ] A progress bar reflects real progress, never faked
- [ ] Rotating text shows what's happening (for example, "Checking 1,200 of ~4,000 USA managers on 440 points…")
- [ ] An estimated time appears once the size of the tied group is known
- [ ] A **Use my FPL link instead** option appears after 5 seconds

*Screen 4 · D9.3b, D9.3c, D9.3d*

### US-2.3 Search cap and automatic fallback
*As a new manager, I want the app to switch to a backup method if searching takes too long, so that I'm never stuck.*
- [ ] Searching stops after **30 seconds** without a match and opens the link step (US-2.4)
- [ ] If the tied group is far larger than 30 seconds can scan, the app goes straight to the link step without making the user wait
- [ ] The app also checks the neighboring rank group, in case the rank shifted during live matches

*Screens 4–5 · D9.3b, D9.3d*

### US-2.4 Backup: use my FPL link
*As a new manager, I want a backup way to connect my team, so that I can still sign up when the search fails.*
- [ ] **Open FPL** opens the official FPL site in a new tab
- [ ] When the user returns, a copied FPL link is detected automatically
- [ ] A paste box accepts a full FPL link or a bare team ID; the app extracts the number after `/entry/`
- [ ] A short guide covers desktop and phone (the FPL app hides web addresses, so phones need a browser)
- [ ] Switching to the FPL tab or idling keeps the user on this step

*Screen 5 · D9.4, D9.7*

### US-2.5 Finish on my computer
*As a new manager on a phone, I want to email myself a link to finish setup on my computer, so that I can get past a fiddly step.*
- [ ] **Email me a link to finish on my computer** sends an email to the Google account address (E2)
- [ ] The link opens the Find your team step after sign-in on the computer

*Screen 5, E2 · D9.6*

### US-2.6 No rank yet
*As a brand-new manager whose team has no rank yet, I want a clear route forward, so that I can still sign up before my first gameweek.*
- [ ] A **No rank yet?** link on the Find your team screen opens the link step directly

*Screen 3 · D9.4*

### US-2.7 Confirm it's me
*As a new manager, I want to confirm the team the app found, so that I never link the wrong one.*
- [ ] **Is this you?** shows the team name, manager name, rank, and points
- [ ] **Confirm** links the team; **Not me** returns to Find your team

*Screen 6 · D9.5*

### US-2.8 One account per team
*As a manager, I want nobody else to link my team, so that my history and advice stay mine.*
- [ ] A team already linked to another account shows **This team is already linked**, with a way to report it
- [ ] The user can return and enter a different team

*Screen 7 · D9.5a*

### US-2.9 Cancel and come back later
*As a new manager, I want to stop setup and return later, so that I'm not forced to finish now.*
- [ ] **Cancel / do this later** signs the user out and returns them to the landing page
- [ ] The next sign-in asks for the team again
- [ ] Nothing other than the account itself is kept

*Flow 2 · D9.7*

---

## E3 — Weekly brief (Flow 3)

### US-3.1 A first brief right away
*As a new manager, I want suggestions as soon as I've linked my team, so that I'm not told to wait for the next scheduled run.*
- [ ] A brief is generated right after **Confirm** in US-2.7
- [ ] It doesn't count toward the 3 refreshes (assumed; see D15.3)

*Screen 8 · D15.3*

### US-3.2 Brief loads instantly
*As a manager, I want my weekly brief ready when I open the app, so that I can decide quickly before the deadline.*
- [ ] Scheduled briefs are generated about 24 hours before the deadline and load without waiting
- [ ] The cards appear in this order: check-in → transfer cards → captain → chip area → next-week preview → receipts and scorecard
- [ ] The brief shows the gameweek and the time left before the deadline

*Screen 8 · D8.1, D8.2, D10.3*

### US-3.3 Stick-or-diverge check-in
*As a manager, I want the app to check last week's hint against this week's news, so that I know whether my plan still holds.*
- [ ] Appears only when last week's brief included a next-week preview
- [ ] States whether the plan still holds or what changed (for example, an injury)
- [ ] The agent's recommendation (stick or diverge) is pre-selected; one tap to accept or switch

*Screen 8 · D3.3*

### US-3.4 Transfer suggestion with alternatives
*As a manager, I want one top pick plus ranked alternatives, each with a reason, so that I can follow the agent or compare options myself.*
- [ ] Each card names the weak spot, the player to sell, and the **top pick** to buy
- [ ] A one-line **"Why sell [player]?"** reason says why this player is the biggest weakness in the squad
- [ ] **3 ranked alternatives** below it, each with a one-line reason
- [ ] Shows price, form, the next 3 fixtures, and the budget impact
- [ ] Respects budget, squad rules, and free transfers; no point hits in the MVP

*Screen 8 · D2.1, D2.8, D3.1, D8.6*

### US-3.5 Save the transfer
*As a manager with a strong squad, I want the agent to tell me when rolling my transfer is the better move, so that I don't waste it.*
- [ ] **Save your transfer this week** appears as a full recommendation with a reason
- [ ] The best transfer option still appears alongside it for comparison

*Screen 8 · D2.2*

### US-3.6 Two banked transfers
*As a manager with 2 or more free transfers, I want a suggestion for each, so that I can use them well.*
- [ ] Shows one card per free transfer, **up to 2**
- [ ] Each card has its own top pick and 3 alternatives

*Screen 8 · D2.3*

### US-3.7 Choose a risk style
*As a manager, I want to switch between Safe, Balanced, and Bold, so that the suggestions match how much risk I want.*
- [ ] Changing the style regenerates the transfer and captain suggestions
- [ ] Resets to **Balanced** each gameweek
- [ ] Changing the style doesn't use a refresh *(assumption to confirm)*

*Screen 8 · D2.4, D4.3*

### US-3.8 See the reasoning
*As a manager, I want to see why the agent suggests something, so that I can trust it or disagree.*
- [ ] Every card shows a one-line reason
- [ ] **Why?** expands the full reasoning in two parts: **why sell** (the player ranked against the next 2 weakest in the squad) and **why the top pick** (form, fixtures, price, risks)
- [ ] **How the agent decided** opens the full trace, including any replans, collapsed by default
- [ ] Both open one detail surface with **Why** and **How the agent decided** tabs: a bottom sheet on mobile, a side panel on desktop (D8.7)

*Screen 9 · D8.3, D8.4, D8.6, D8.7*

### US-3.9 Captain pick
*As a manager, I want a captain suggestion that accounts for my transfer, so that I double the right player.*
- [ ] Shows a captain, a vice-captain, and 1–2 alternatives, each with a reason
- [ ] Considers the squad after the suggested transfers

*Screen 8 · D4.1, D4.4*

### US-3.10 Chip advice
*As a manager, I want advice on when to play my chips, so that I don't waste them or lose them at the deadline.*
- [ ] A **Want to use a chip?** toggle; when on, the chip strip shows which chips are available or used, with expiry countdowns
- [ ] Advice covers all four chips. Triple Captain and Bench Boost come with reasoning; Wildcard and Free Hit weeks are flagged only.
- [ ] Chip advice scans the full fixture list for blank and double gameweeks, labeled "provisional"
- [ ] What shows when the toggle is off is **open** (a UI decision, D15.6)

*Screen 8 · D5.1, D5.3, D5.7, D15.6*

### US-3.11 Next-week preview
*As a manager, I want a hint about next week, so that I can plan ahead without a full multi-week plan.*
- [ ] One line, for example "Next week, your midfield looks like the weak spot"
- [ ] Clearly non-binding; it feeds next week's check-in (US-3.3)

*Screen 8 · D3.2*

---

## E4 — Refresh (Flow 4)

### US-4.1 Refresh after news breaks
*As a manager, I want to regenerate my brief when news breaks, so that my advice stays current.*
- [ ] **Refresh** regenerates the brief, with progress shown on screen
- [ ] Each refresh saves a new version; receipts follow the version the user saw last

*Screen 10 · D10.4*

### US-4.2 Refresh limit
*As a manager, I want to know how many refreshes I have left, so that I'm not surprised when they run out.*
- [ ] **3 per gameweek**, with the count remaining shown
- [ ] At the limit, the button is disabled with "Resets when the next gameweek starts"

*Screen 10 · D10.5*

### US-4.3 Failed refresh
*As a manager, I want a failed refresh to cost me nothing, so that I can try again.*
- [ ] If a refresh doesn't finish in time, the old brief stays and the refresh isn't counted
- [ ] A message suggests trying again later

*Screen 10 · D15.5*

---

## E5 — Receipts, scorecard, and journal (Flow 5)

### US-5.1 Automatic receipts for every move
*As a manager, I want a receipt for every move I make, without reporting anything, so that I can see how each decision worked out.*
- [ ] After the deadline, the app reads actual transfers, captain, and chip from FPL history
- [ ] Compares them with the brief version the user saw last
- [ ] Labels each move: **Followed**, **Your own move**, **Ignored, rolled**, or **Ignored, transferred**

*Screen 11 · D7.6, D7.11*

### US-5.2 Clear receipt
*As a manager, I want each receipt in plain language, so that I understand the result at a glance.*
- [ ] One sentence, for example "GW8: Sold Saka → Bought Mbeumo. Since then: Mbeumo 21 pts, Saka 9 pts → **+12**"
- [ ] Shows both players' points, color-coded positive or negative
- [ ] Marked **pending** until 3 gameweeks have been played; it settles after that

*Screen 11 · D7.2, D7.7*

### US-5.3 Funding moves judged fairly
*As a manager making a move to free up money, I want it judged together with the move it funds, so that it isn't scored unfairly on its own.*
- [ ] A cheaper player coming in is flagged "Looks like a funding move — waiting to see what it funds (until GWx)"
- [ ] An upgrade within 2 gameweeks links both moves into one combined receipt
- [ ] With no upgrade within 2 gameweeks, the move is judged on its own

*Screen 11 · D7.8, D7.9*

### US-5.4 Correct a wrong guess
*As a manager, I want to fix an intent the app guessed wrong, so that my receipts are accurate.*
- [ ] Every intent label has an optional **edit** link; the app never prompts for it

*Screen 11 · D7.8*

### US-5.5 Captain and chip receipts
*As a manager, I want receipts for captain and chip choices too, so that I can see whether those calls paid off.*
- [ ] Captain receipt, for example "You captained Haaland (12). The agent's pick, Palmer, scored 18"
- [ ] Chip receipt, for example "Triple Captain on Haaland: +14 extra"

*Screen 11 · D4.2, D5.4*

### US-5.6 Scorecard
*As a manager, I want a headline number for the last 5 gameweeks, so that I can see whether the app is helping.*
- [ ] Headline: the rolling 5-gameweek total of receipts (for example, "+28 pts over the last 5 GWs")
- [ ] Secondary: followed vs. ignored (for example, "Your picks: +6. Skipped agent picks: +14")
- [ ] Results broken down by style (Safe, Balanced, Bold)
- [ ] Each number links to the receipts behind it; no rank-based metrics

*Screen 11 · D2.5, D7.3, D7.4, D7.5*

### US-5.7 Journal note on the receipt
*As a manager, I want to note why I made a move, so that I can see later how my instincts did.*
- [ ] When a receipt appears, it asks **"Why did you make this move?"** (optional, one line)
- [ ] The note stays on the receipt

*Screen 11 · D7.10*

---

## E6 — Weekly email

### US-6.1 Brief-ready email
*As a manager, I want an email when my brief is ready, so that I don't miss the deadline.*
- [ ] One email per gameweek, sent after the brief is generated, about 24 hours before the deadline
- [ ] Contains "Your GW brief is ready, deadline in 24h" and a link to the brief
- [ ] Sent from the app's own domain

*E1 · D10.1, D11.8*

### US-6.2 Turn the email off
*As a manager, I want to stop the weekly email, so that I control my inbox.*
- [ ] An opt-out in Settings and in every email
- [ ] Briefs are still generated on schedule when the email is off

*Screen 12 · D10.1*

---

## E7 — Settings and privacy (Flow 6)

### US-7.1 Change my team
*As a manager, I want to switch the team I follow, so that I can use the app if I start a new team or entered the wrong one.*
- [ ] **Change team** reruns the Flow 2 lookup
- [ ] Old receipts stay in history, labeled with the old team

*Screen 12 · D9.8, D15.7*

### US-7.2 Delete my data
*As a manager, I want to delete everything the app holds about me, so that I can leave cleanly.*
- [ ] **Delete my data** shows exactly what will be deleted: account, team link, briefs, decisions, receipts, notes
- [ ] Requires confirmation; **Cancel** returns to Settings
- [ ] After deletion, the user is signed out

*Screens 12–13 · D9.12*

### US-7.3 Sign out
*As a manager, I want to sign out, so that I can protect my account on a shared device.*
- [ ] **Sign out** returns to the landing page

*Screen 12*

### US-7.4 No FPL password, ever
*As a manager, I want certainty that the app never asks for my FPL password, so that my FPL account stays safe.*
- [ ] No screen, email, or flow ever asks for FPL or Premier League credentials
- [ ] The app only reads public FPL data and never changes the user's team

*All · D9.12*

### US-7.5 Clear privacy terms
*As a manager, I want to know what's stored and why, so that I can trust the app.*
- [ ] A privacy page lists what's stored (email, Team ID, suggestions, decisions, notes) and confirms nothing is sold or shared
- [ ] Includes the non-affiliation disclaimer

*D9.12*

---

## E8 — Demo mode (Flow 7)

### US-8.1 Try without signing up
*As a visitor, I want to explore a full example brief without an account, so that I can judge the app quickly.*
- [ ] **Try the demo** on the landing page opens a frozen, curated brief
- [ ] The demo brief always shows a weak spot, a replan in the agent trace, and a chip decision
- [ ] Offered only to logged-out visitors

*Screen 14 · D1.3, D1.4*

### US-8.2 Know it's a demo
*As a visitor, I want it to be obvious that I'm viewing example data, so that I don't mistake it for live advice.*
- [ ] A visible **Demo** badge on every demo screen
- [ ] Light tooltips explain FPL terms in the demo only

*Screen 14 · D1.3, D1.5*

### US-8.3 See it on a real team
*As a visitor, I want to see the app working on a real team this week, so that I know it isn't a mock-up.*
- [ ] **See it on a live team** shows the owner's own team and this week's real brief, good weeks and bad

*Screen 14 · D15.4*

### US-8.5 Public sample brief
*As a recruiter or non-player, I want to see a real brief without signing in, so that I can judge the app in under a minute.*
- [ ] A public page shows the owner's real brief for this week: transfer and captain cards, reasons, and the agent trace
- [ ] No sign-in needed; linked from the landing page and the portfolio
- [ ] Labeled as the owner's own team, not advice for the viewer

*Core MVP · D16.3*

### US-8.4 Sign up from the demo
*As a visitor who plays FPL, I want to sign up straight from the demo, so that I can get advice for my own team.*
- [ ] A sign-up prompt leads to **Continue with Google** and then onboarding
- [ ] **Not now** lets the visitor leave or keep exploring

*Screen 14 · Flow 7*

---

## E9 — Errors and edge states

### US-9.1 FPL is updating
*As a manager, I want a clear message when FPL is unavailable, so that I know it isn't the app's fault.*
- [ ] Banner: "FPL is updating. Showing your last saved brief."
- [ ] During onboarding, offers the link step or "try again in a few minutes"

*Edge cases · Plan risks*

### US-9.2 Deadline passed
*As a manager, I want the brief to lock after the deadline, so that I'm not shown advice I can no longer act on.*
- [ ] The brief becomes read-only, with "Next brief arrives [date]"
- [ ] Receipts and the scorecard stay available

*Edge cases*

### US-9.3 Large-country searches
*As a new manager in a large country (for example, England), I want a predictable wait, so that I know what to expect.*
- [ ] The estimated time is shown before scanning
- [ ] The 30-second cap and link fallback apply (US-2.3)

*D9.3d*

### US-9.4 Accessibility
*As a manager with a motion sensitivity or a screen reader, I want the app to work for me, so that I'm not excluded.*
- [ ] All motion respects the reduced-motion setting
- [ ] Text and key colors meet contrast guidelines in dark and light themes
- [ ] Screen readers can follow the brief's cards in order

*D14.4*

---

## E10 — Owner and system (enablers)

### US-10.1 Daily data refresh
*As the owner, I want a daily job that refreshes FPL data, so that briefs and check-ins use current prices and injuries, and the database never pauses.*
- [ ] A GitHub Actions job runs daily and writes prices, injuries, and fixtures to Supabase
- [ ] Settles pending receipts and reads users' actual moves after each deadline
- [ ] Safe to re-run, with a manual-run button

*D11.6, D11.7*

### US-10.2 Scheduled brief generation
*As the owner, I want briefs generated for every user before the deadline, so that they're ready when users open the app.*
- [ ] Runs about 24 hours before each deadline, at an odd minute to avoid GitHub's busy times
- [ ] Generates briefs, then sends emails; safe to re-run

*D10.3, D11.5*

### US-10.3 Country league list
*As the owner, I want a list mapping each country to its league ID each season, so that the team lookup works.*
- [ ] Built once per season by sampling teams from the overall table
- [ ] Stored in `country_leagues`

*D9.3f*

### US-10.4 Standings cache
*As the owner, I want scanned standings pages cached for the gameweek, so that later lookups are instant and FPL sees fewer requests.*
- [ ] Pages are stored in `standings_cache` with league, page, and gameweek
- [ ] Cache entries expire when the gameweek updates

*D9.3e*

### US-10.5 Polite to FPL
*As the owner, I want all FPL calls throttled and cached, so that the app isn't blocked.*
- [ ] Shared data is fetched once per run; per-user calls are throttled; retries back off
- [ ] All FPL calls go through one client module

*Plan risks*

### US-10.6 Cost limits
*As the owner, I want model usage capped, so that costs stay predictable.*
- [ ] Refresh cap enforced on the server (3 per user per gameweek)
- [ ] Shared analysis (fixtures, player form) is cached across users

*D10.5*

### US-10.8 Daily cap on generating briefs (core only)
*As the owner, I want a per-user daily limit on generating briefs, so that a public link can't run up model costs before the Refresh cap exists.*
- [ ] On-demand brief generation is capped per user per day
- [ ] Replaced by the 3-per-gameweek Refresh cap (US-4.2) once it ships

*Core MVP · D16.5*

### US-10.7 Read-only toward FPL
*As the owner, I want the app to stay read-only toward FPL, so that it stays on the safe side of policy.*
- [ ] No code path writes to FPL or handles FPL credentials
- [ ] Non-affiliation disclaimer in the footer and privacy page

*D9.12*

---

## Backlog: Post-MVP and Phase 2

| ID | Story | Release | Decision |
|---|---|---|---|
| BL-1 | As a manager, I want to ask the agent questions by text or voice (including "why not X?"), so that I can challenge its picks | Post-MVP | D2.7 |
| BL-2 | As a Bold manager, I want hit suggestions when they're clearly worth it (max 1 per week), so that I don't miss big gains | Post-MVP | D2.9 |
| BL-3 | As a manager, I want the agent to plan funding moves across weeks, so that I can afford premium players | Post-MVP | D2.10 |
| BL-4 | As a manager, I want a full squad built for my Wildcard or Free Hit, so that I don't build 15 players by hand | Post-MVP | D5.2 |
| BL-5 | As a manager, I want a season timeline of the best chip weeks, so that I can plan chips ahead | Post-MVP | D5.6 |
| BL-6 | As a manager, I want lineup and bench-order advice, so that I don't leave points on the bench | Post-MVP | D4.5 |
| BL-7 | As a desktop manager, I want a one-click "Find my ID" bookmarklet, so that onboarding takes one click | Post-MVP | D9.10 |
| BL-8 | As a manager, I want to compare myself with rivals in my mini-league, so that I can win it | Phase 2 | D6.2 |
| BL-9 | As a manager, I want differentials favored when the agent's options are close, so that I gain ground on rivals | Phase 2 | D6.2 |
| BL-10 | As a manager, I want to see my rivals' remaining chips and have strategy adjust to the points gap | Phase 2 | D6.3 |

## Open items affecting stories

- **D15.6:** what the chip area shows when the toggle is off (US-3.10)
- **US-3.1:** confirm the first brief doesn't count toward the 3 refreshes
- **US-3.7:** confirm that changing the style doesn't use a refresh
