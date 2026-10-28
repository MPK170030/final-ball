# Final Ball — Decisions Log

**Product:** Final Ball, an AI agent for Fantasy Premier League managers
**Tagline:** "We create the chance, you finish it."
**Positioning:** Accountable advice. Every suggestion is explained, tracked, and scored against what actually happened.
**Decided:** 15–16 October 2026
**Supersedes:** The September 2026 "FPL Squad Builder" plan wherever the two conflict (see section 12).

**Status labels**
- **MVP:** in the first release
- **Post-MVP:** planned after the first release
- **Phase 2:** depends on rival/league features
- **Rejected:** considered and ruled out

---

## 1. Purpose and users

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D1.1 | Primary users are the owner plus FPL managers. MVP decisions favor them. | MVP | A real weekly habit loop beats a demo-only product |
| D1.2 | Secondary users are non-FPL players and recruiters, served through demo mode | MVP | Portfolio reach without diluting the core experience |
| D1.3 | Demo mode: a frozen, curated snapshot by default, plus a "See it on a live team" toggle and a visible "Demo" badge | MVP | A snapshot always shows a weak spot, a replan, and a chip decision; the live toggle proves it's real |
| D1.4 | The demo entry point appears only on the landing page, for logged-out users | MVP | Keeps the main app focused on managers |
| D1.5 | The core screens assume FPL knowledge. Demo mode alone gets light tooltips and an intro. | MVP | Avoids cluttering the experience for managers |
| D1.6 | Differentiator: accountable advice (receipts, the agent's track record, a decision journal). Don't compete with long-horizon solvers. | MVP | The market is crowded with AI chat and 5–10 gameweek optimizers (FPL Copilot, FPL Pulse, FPL Guru, Onside Arena, fpl.team, LiveFPL); none of those found advertise checking whether their own advice worked |

## 2. Recommendations: transfers

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D2.1 | Normal weeks: one transfer per free transfer, with the agent's **top pick** plus **3 ranked alternatives**, each with reasoning | MVP | Serves both "tell me what to do" and "let me compare" managers |
| D2.2 | **"Save the transfer"** is a first-class recommendation when the squad has no meaningful weak spot. It's shown next to the best transfer option. | MVP | Rolling is often correct; it's a recommendation, not an error state |
| D2.3 | **Banked free transfers:** up to **2** suggestion cards, one per free transfer | MVP | Covers the common case of 2 free transfers without overloading mobile |
| D2.4 | **Aggression toggle: Safe / Balanced / Bold.** Changing it regenerates the suggestions. It resets to Balanced each week. *Each style is generated once per brief version and cached: see D2.11.* | MVP | User control over risk; fresh default each week |
| D2.5 | Each receipt records the aggression level used | MVP | Enables "Bold picks: +18, Safe picks: +6" |
| D2.6 | Regeneration uses **buttons only** | MVP | Keeps scope tight |
| D2.7 | Text and voice input ("Ask the agent" panel), including "why not X?" comparisons | Post-MVP | Showcases replanning, after the core is solid |
| D2.8 | **No point hits (-4)** | MVP | Matches the one-transfer scope |
| D2.9 | Hits tied to aggression: Safe never; Balanced only for an injury or suspension that can't be covered; Bold when the expected gain over 3 gameweeks beats the cost by a margin. Capped at 1 per week, shown on a separate optional card; receipts subtract 4. | Post-MVP | Disciplined, explainable hit advice |
| D2.10 | Funding moves *proposed by the agent* (selling now to buy next week) | Post-MVP | That's multi-week planning |
| D2.11 | **Style results are cached per brief version.** Each style (Safe / Balanced / Bold) is generated at most once per version; switching back shows the cached result. Changing style never uses a refresh. New style generations happen only after a Refresh creates a new version. | MVP (25 Oct) | Accountable advice must sound confident and consistent; re-rolling the same inputs into different picks makes the agent look unsure. Accepted tradeoff: no "another opinion" by re-rolling; the alternatives on each card and "Ask the agent" (D2.7) cover disagreement. Resolves US-3.7. |
| D2.12 | **The weak spot doesn't depend on style.** Weak spots (agent flow step 3) are found once per version, without the style. Style changes only the candidate ranking and the captain choice. The "Why sell X?" reason is identical across styles. | MVP (25 Oct) | A diagnosis that changes with risk appetite undermines trust in the diagnosis itself |

## 3. Planning horizon

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D3.1 | Players are judged on their **next 3 fixtures** | MVP | Matches what the official app shows |
| D3.2 | Recommendations cover **the current gameweek plus a non-binding next-week preview** (for example, "Next week, RB looks like your weak spot") | MVP | A forward-looking feel at low cost; drives return visits |
| D3.3 | **Stick-or-diverge check-in:** when last week's preview exists, the next brief opens by checking it against the latest news (injuries, suspensions, prices). The agent's recommendation (stick or diverge) is pre-selected, so it takes one tap. | MVP | Plans change; the user stays in control |
| D3.4 | Full multi-gameweek transfer plans | Rejected (MVP) | Conflicts with one transfer per week, no hits, and parked funding moves; puts the app in a head-to-head with 10-gameweek solvers |

## 4. Captaincy

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D4.1 | Captain pick, vice-captain, and 1–2 alternatives, each with reasoning | MVP | Often worth more than transfers; low build cost |
| D4.2 | Captain receipts ("You captained X: 12. The agent's pick, Y: 18.") | MVP | Same accountability angle |
| D4.3 | The aggression toggle applies (Safe: the most-captained player; Bold: a differential) | MVP | Consistent risk control |
| D4.4 | Order: transfers first, then captain, so the incoming player can be captained | MVP | Correct dependency |
| D4.5 | Starting XI and bench order advice | Post-MVP | The official app already does lineups well |

## 5. Chips (2026/27 rules)

**Rules confirmed:** 8 chips (two sets of Wildcard, Free Hit, Triple Captain, and Bench Boost). The first set expires at the Gameweek 19 deadline, 13:30 UK time on Saturday 2 January 2027. A Free Hit in Gameweek 19 means no Free Hit in Gameweek 20. One chip per gameweek.

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D5.1 | **Timing advice for all four chips.** Triple Captain and Bench Boost get full reasoning; Wildcard and Free Hit weeks are flagged only. | MVP | Delivers "when to play chips" without building a squad builder |
| D5.2 | Squad builds for Wildcard and Free Hit | Post-MVP | A product in its own right |
| D5.3 | **Expiry nudges** (for example, "2 chips expire in 4 GWs") | MVP | The first-set deadline creates natural urgency |
| D5.4 | Chip receipts ("Triple Captain on Haaland: +14 extra") | MVP | Accountability |
| D5.5 | **Weekly chip alert card** plus a **chip status strip** (available or used, expiry countdown). *The strip is no longer always visible: see D15.6.* | MVP | Low noise, always aware |
| D5.6 | Chip planner timeline | Post-MVP | Needs a long horizon |
| D5.7 | **Chip-only lookahead:** transfers stay at 3 gameweeks, but chip advice scans the full fixture list for blank and double gameweeks, labeled "provisional" | MVP | Prevents clearly bad chip advice; uses fixture data already available |

## 6. Leagues and rivals

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D6.1 | MVP advice is based on **the user's own points only** | MVP | Simplicity |
| D6.2 | Opt-in rival mode: a league ownership badge on candidates, differentials as the tie-breaker when scores are close, gap context ("3rd, 14 pts behind") | Phase 2 | Meets the "win your league" goal after the core works |
| D6.3 | Later: rival chip tracking, strategy that shifts with the points gap | Phase 2 | — |
| D6.4 | Q5 (how a user picks a league) and Q6 (changing strategy based on league position) are deferred | Phase 2 | Only relevant with rival mode |

## 7. Measuring success and accountability

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D7.1 | Success = **retention** plus **measured transfer impact** | MVP | — |
| D7.2 | **Transfer receipt:** points of the player brought in minus the player sold, over the **3 gameweeks after the transfer** | MVP | A concrete unit that matches the horizon |
| D7.3 | **Headline: a rolling 5-gameweek scorecard** (for example, "+28 pts over the last 5 GWs") linking to its receipts | MVP | Smooths out luck |
| D7.4 | **Secondary: followed vs. ignored** (agent picks taken vs. skipped) | MVP | Proves the agent's value specifically |
| D7.5 | No rank-based success metric | Rejected | Weak causal link |
| D7.6 | **Store only suggestions and user decisions.** Rebuild squads and outcomes from the FPL API's history and transfer endpoints. | MVP | No copies of squads (verify the endpoints in week 1) |
| D7.7 | **Receipt display:** one plain sentence, both players' points, color-coded, "pending" until 3 gameweeks have been played | MVP | Clear, never a black box |
| D7.8 | **Intent is inferred, never asked:** injury cover (the player sold was flagged), funding (a cheaper player bought, followed by an upgrade within 2 GWs), or points (the default). An optional "edit" link on the chip; never prompted. | MVP | No extra work for users |
| D7.9 | **Linked receipts:** a suspected funding move shows "waiting to see what it funds (until GWx)"; when linked, both transfers become one combined receipt; with no follow-up within 2 GWs, it's judged alone | MVP | Fair to two-step plans, without a loophole |
| D7.10 | **Decision journal:** an optional one-line note per move, entered **on the receipt when it appears** ("Why did you make this move?") and shown there afterward | MVP | Retention plus personal accountability; no extra step before the user leaves for FPL |
| D7.11 | **Every move gets a receipt, built automatically after the deadline** by comparing the user's actual moves (from FPL history) with the brief version they last saw. Labels: **Followed** (made the agent's top pick or one of its alternatives), **Your own move** (a different transfer), **Ignored, rolled** (rolled when a transfer was suggested), **Ignored, transferred** (transferred when "Save it" was suggested). Captain and chip choices are compared the same way. | MVP | The user never reports anything; covering every move powers the followed-vs-ignored comparison |

## 8. Interaction and content

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D8.1 | **A dashboard with AI-generated cards** (not chat) | MVP | Follows from buttons-only input |
| D8.2 | **Weekly brief order:** stick-or-diverge check-in → transfer cards (1–2) → captain → chip alert + status strip → next-week preview → receipts + 5-GW scorecard | MVP | The decision order of a real gameweek |
| D8.3 | **Reasoning:** a summary line on each card, plus "Why?" to expand the full reasoning | MVP | Clean by default, with depth on demand |
| D8.4 | **Full agent trace** (including replans) behind a collapsed "How the agent decided" link | MVP | A portfolio and recruiter signal at low cost |
| D8.5 | "Ask the agent" panel (text and voice) on top of the dashboard | Post-MVP | See D2.7 |
| D8.7 | **Reasoning detail is one surface with two tabs, "Why" and "How the agent decided."** Mobile: a bottom sheet over the brief. Desktop: a side panel next to the cards, with the selected card highlighted. "Why?" opens it on the Why tab; "How the agent decided" opens it on the trace tab. | MVP (core, 19 Oct) | Owner's call: chosen over expanding in the card plus a separate trace page/drawer, which felt random; one surface gives the reasoning a clear flow |
| D8.6 | **Explain the weak spot, not just the replacement.** Each transfer card opens with a one-line "Why sell X?" reason. "Why?" expands in two parts: (1) why sell X, with X ranked against the next 2 weakest players in the squad; (2) why the top pick (form, fixtures, price, risks). Uses the weak-spot ranking the agent already produces (agent flow step 3). | MVP (core, 19 Oct) | "Why sell him?" is the first thing a manager questions; if the weak spot isn't convincing, the rest of the card isn't trusted |

## 9. Accounts, onboarding, and policy

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D9.1 | **Google OAuth only** | MVP | Privacy, history across devices, no passwords; good for the portfolio |
| D9.2 | **Team ID requested right after the first sign-in**, as a required onboarding step | MVP | The ID needs an account to be stored on |
| D9.3 | **Primary method: find your team by country, country rank, and team name.** The user picks their country (pre-selected from the device's region), enters their country-league rank (shown in the Leagues section of the FPL app) and their team name. The app finds the team ID from the country league's public table. No URLs or IDs for most users. | MVP | Open to everyone; nothing technical asked; a few requests per signup. Country leagues have far smaller tied groups than the overall table. |
| D9.3a | **Lookup algorithm:** start at `page_standings = ⌊(rank − 1) / 50⌋ + 1` (the page where the tied group starts, since a shared rank is the position of the first tied team). Compare each team name with the user's entry (fuzzy match: case, emoji, special characters). Move to the next page until the name matches, the `rank` value changes (the tied group has ended), or the cap is reached. Also check the neighboring rank group, in case the rank shifted during live matches. | MVP | The formula was verified against live data: page 25,690 starts at sorted position 1,284,451 |
| D9.3b | **Cap: 30 seconds.** A "Use my FPL link instead" option appears from 5 seconds. At the cap, the app falls back to the URL step. | MVP | Owner's call: engaging progress text makes a 30-second wait acceptable |
| D9.3c | **Engaging progress:** rotating text tied to real progress (for example, "Checked 1,200 of ~4,000 USA managers on 440 pts", "Scanning the USA league…") with a progress bar. Never fake progress. | MVP | Keeps the user engaged through longer searches |
| D9.3d | **Tie-size probe:** before scanning, about 8 jump-ahead requests (a binary search) find where the tied group ends. The app shows an accurate time estimate, and skips straight to the URL step when the group is far beyond what 30 seconds can scan. | MVP | Avoids making users wait for a search that can't finish |
| D9.3e | **Cache standings pages for each gameweek** in Supabase | MVP | Later users from the same area find their team instantly; fewer requests to FPL |
| D9.3f | **Country-to-league-ID list,** built once per season by sampling teams from the overall table (each team's profile lists its country league) | MVP | Country league IDs aren't published |
| D9.4 | **Fallback: the URL step.** An "Open FPL" button; when the user returns, the app detects the copied link (or accepts a pasted link or ID, extracting the number after `/entry/`); a short visual guide (desktop, and mobile browser, since the FPL app hides addresses) | MVP | For new teams with no rank yet, very large tied groups, or name mismatches |
| D9.5 | **Confirmation:** "Is this you?" card (team name, manager name, rank, points) with Confirm and Re-enter | MVP | Instant recognition; prevents wrong matches |
| D9.5a | **One account per team:** a team that's already claimed shows "This team is already linked," with a way to report it | MVP | Reduces impersonation |
| D9.6 | **"Email me a link to finish on desktop"** escape hatch, offered in the URL fallback on phones | MVP | For mobile users stuck at the fallback |
| D9.7 | **Logout only on an explicit "Cancel / do this later"**, then redirect home. Switching tabs or idling keeps the onboarding state. The next login asks for the ID again. | MVP | The flow itself sends users to another tab |
| D9.8 | One team per account, changeable in Settings. There's no way to verify ownership. | MVP | Accepted risk; the data is public |
| D9.9 | Reading the ID from an FPL tab, iframe, or session; signing in to FPL inside an embedded in-app browser | Rejected | Blocked by the same-origin policy and CORS; Google blocks its sign-in in embedded browsers; requires a native app; resembles phishing |
| D9.10 | **Desktop "Find my ID" bookmarklet** (the Starter11 pattern) | Post-MVP | One click on desktop |
| D9.11 | Global search by manager or team name, including a separate crawler or spreadsheet of all 12M+ teams | Rejected | About 240k requests per crawl (blocking and terms risk); exceeds Excel's 1,048,576-row limit and Supabase's free tier; goes stale; privacy concerns about storing millions of non-users |
| D9.11a | Lookup by overall rank | Rejected | Overall ties are huge (5,457+ teams shared rank 1,278,994 in a live sample), so scans run to hundreds of pages |
| D9.11b | Invite links as the main onboarding method | Rejected | Makes the app feel private; it must be open to everyone |
| D9.11c | A browser extension | Rejected | A separate product |
| D9.12 | **Policy guardrails:** read-only toward FPL; never ask for FPL credentials; a non-affiliation disclaimer; no Premier League logos or club crests; no "FPL" in the product name; cached and rate-limited API calls; unlinking and data deletion in Settings | MVP | No published FPL rule against storing Team IDs was found; other tools do it openly. Low risk, but **not legal clearance**. |

## 10. Notifications and generation

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D10.1 | **Email reminder only:** one per gameweek ("Your GW brief is ready — deadline in 24h"), with opt-out in Settings | MVP | Simple, reliable |
| D10.2 | Push notifications | Rejected (including post-MVP) | Owner's decision |
| D10.3 | **Briefs are generated on a schedule** (about 24h before the deadline) and stored | MVP | Opens instantly; fixes what counts as "the suggestion" for receipts; makes the email meaningful |
| D10.4 | **A Refresh button** regenerates the brief as a new version; receipts track the version the user acted on. *Only when the inputs have changed: see D10.6.* | MVP | Handles breaking news |
| D10.5 | **Refresh cap: 3 per gameweek** | MVP | Controls model costs |
| D10.6 | **Refresh is driven by changed data.** The brief's inputs (squad, bank, free transfers, prices, injury news, fixtures) are hashed. If nothing changed, there's no regeneration: "Nothing has changed since [time]. Your brief still stands." That refresh doesn't count toward the 3. If something changed, the new version states what changed (for example, "Updated: Saka flagged 50%"). | MVP (25 Oct) | Refresh reacts to news instead of rolling again; same principle as D2.11 |
| D10.7 | **Same inputs, same output.** Ranking and decision steps run at temperature 0 or near it. Wording may vary; picks may not. | MVP (25 Oct) | Consistency across versions and styles |

## 11. Platform, stack, and infrastructure

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D11.1 | **Mobile and desktop designed equally**: both wireframes for every screen, with the screen count kept tight | MVP | Owner's choice; the weekly use is on phones, recruiters use desktop |
| D11.2 | **Frontend:** Next.js + Tailwind + shadcn/ui on Vercel | MVP | The design system maps directly to Tailwind tokens and shadcn components |
| D11.3 | **Auth and database:** Supabase (Postgres plus Google sign-in) | MVP | One service for both |
| D11.4 | **Backend language:** Node | MVP | One language across the stack |
| D11.5 | **No Render.** The agent is a **Node package in a monorepo** (`/apps/web`, `/packages/agent`, `/scripts/weekly`). **The weekly batch runs in GitHub Actions; Refresh runs as a Vercel function.** | MVP | Fathom already uses about 720–744 of Render's 750 free hours per workspace; sharing risks suspending both; a second account was rejected (likely terms violation) |
| D11.6 | **Scheduler: GitHub Actions** (not Render cron, which is paid; not Supabase pg_cron) | MVP | Owner's choice; free |
| D11.7 | **Daily data-refresh job** (GitHub Actions) that writes prices, injuries, and fixtures into Supabase | MVP (required) | Prevents Supabase's 7-day inactivity pause during international breaks; feeds the stick-or-diverge check-in |
| D11.8 | **Email:** Nodemailer through Resend over SMTP | MVP | Provider can be swapped; requires your own domain with SPF/DKIM. Gmail SMTP only for testing. |
| D11.9 | **Repository: public** | MVP | Portfolio visibility; secrets live in GitHub Secrets |
| D11.10 | Fallback if a Refresh exceeds Vercel's 300-second Hobby limit: stream progress → refresh one card at a time → Render Starter ($7/mo) | Contingency | — |
| D11.11 | Keep the app non-commercial: no ads, no donation link | MVP | Vercel Hobby is non-commercial only |
| D11.12 | **Domain: `finalball.manavpkothari.dev`**, a subdomain of the owner's domain (DNS on Vercel, verified in Google Search Console 20 Oct). Google OAuth client set up 20 Oct: External, Testing with family as test users, scopes openid/email/profile only, redirect to the Supabase callback; Supabase Google provider and URL configuration done. Publish to production before public sharing (D16.6); the landing page and `/privacy` must be live on the subdomain first. | MVP | Same pattern as the owner's other projects; Google brand verification needs a homepage and privacy policy on an owned domain |

## 12. Changes from the September 2026 plan

| Area | September | Now |
|---|---|---|
| Auth | None | Google OAuth (D9.1) |
| Team ID storage | localStorage | On the account (D9.2, D9.8) |
| Database | None | Supabase (D11.3) |
| Agent hosting | A separate service on Render | A Node package run by GitHub Actions and Vercel functions (D11.5) |
| Suggestions | 3–4 ranked candidates per weak spot | Top pick + 3 alternatives; "Save the transfer"; up to 2 cards (D2.1–D2.3) |
| Chips, captaincy | Stretch | MVP (sections 4–5) |
| "Why not X" | Fast-follow | Post-MVP via text/voice (D2.7) |
| History and accuracy | Stretch | MVP core: receipts and scorecard (section 7) |

## 13. Deliverables and design tooling

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D13.1 | Figma's free plan was found to allow **6 MCP tool calls per month**, variables with no modes, and 3 files | — | Not enough for building designs through the Figma connection |
| D13.2 | **Design here as artifacts** (unlimited revisions); **the owner rebuilds the final versions in Figma by hand** | Process | Free; manual rebuilding is good portfolio practice |
| D13.3 | User flow → a diagram here → the owner recreates it in FigJam | Process | — |
| D13.4 | User stories → `user-stories.md` | Process | Lives in the repository next to plan.md and decisions.md |
| D13.5 | Wireframes → one Design canvas here, with mobile and desktop in labeled sections | Process | — |
| D13.6 | Design system → a Design System artifact here, with tokens named to match Tailwind and shadcn | Process | — |
| D13.7 | **Figma rebuild constraint: one page only**, separated by labeled sections, no extra pages | Process | Free plan page limits |
| D13.8 | Dark mode in Figma free: **separate Light and Dark variable collections** (no modes available) | Process | — |

## 14. Brand and visual direction

| ID | Decision | Rationale |
|---|---|---|
| D14.1 | **Name: Final Ball** | Clear in a web search of FPL tools, football apps, podcasts, and newsletters (not a trademark or domain search). Key Pass overlapped with an FPL draft podcast and "KeyPass" password apps; Through Ball clashed with a DAZN show; Assist was crowded by "assistant" products. |
| D14.2 | **Tagline:** "We create the chance, you finish it." | — |
| D14.3 | **Dark first**, with light mode supported | Evening deadline checks |
| D14.4 | **Feel:** clean and calm, with subtle continuous motion: numbers counting up, cards appearing in sequence, receipts "settling," a shimmer while the agent works, and a reduced-motion fallback | Holds attention without overpowering |
| D14.5 | **Reference:** FPL Review — clean and informative without being in your face. Data is always visible but quiet; density is medium; one emphasis per card. | — |
| D14.6 | **Palette (dark):** background `#181818`; surface-1 `#2C2C2C`; surface-2 `#383838`; border `#424242`; text `#F7F7F7`; muted text `#A3A3A3`; **accent `#FF8A1F`** (hover `#FFA04D`; light-mode accent `#C25E00`); positive `#4CAF7A`; negative `#E5534B`; pending/neutral `#8A93A6` | Options compared on screen; surface option B chosen |
| D14.7 | **No second accent.** Orange is the single "look here" color. | Restraint |
| D14.8 | **Fixture difficulty:** green = easy, red = hard, using the muted semantic colors. The accent is never paired with semantic green in the same component. | Prevents mixed meanings |
| D14.9 | Warnings use an orange-red distinct from the accent (exact value set in the design system) | Amber and orange carry the brand |
| D14.11 | **Design system values signed off (19 Oct):** light theme (background `#FAFAFA`, card `#FFFFFF`, surface-2 `#F0F0F0`, border `#DCDCDC`, text `#181818`, muted `#5E5E5E`, positive `#2E7D55`, negative `#C4362F`, pending `#5F687A`); warning `#F26A3D` dark / `#B8481C` light, always with an icon and a text label; fixture difficulty fills green (1–2), grey (3), red (4), dark red (5), number always shown; IBM Plex Sans + IBM Plex Mono (numbers); spacing 4–32px on a 4px base; radius 6 / 10 / 14px. The light accent stays `#C25E00` for fills, borders and 24px+ text; small accent-coloured text uses `#A85100`. Token names follow shadcn; the brand orange is `primary`. | Owner sign-off; details and contrast notes in the Design System artifact |
| D14.10 | **Avoided:** green, blue, and red accents (red too common; blue used in the owner's other projects); Premier League purple and pink; FPL's mint green; the Material Design stock palette | Keeps the app looking unofficial and distinctive |

## 15. User flow decisions (18 October 2026)

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D15.1 | **Sign-up and sign-in are one button, "Continue with Google."** The landing page shows "Get started" plus a small "Sign in" link, both leading to it. After Google, the app branches: new account → onboarding; team linked → weekly brief; no team linked → onboarding. | MVP | Separate screens make people wonder whether they have an account |
| D15.2 | **No "Mark as done" step.** Users leave to make moves in the official app with no reason to return right away; the app reads actual transfers from FPL history after the deadline. | MVP | Owner's call: the step was redundant |
| D15.3 | **Every new user gets a first brief right after onboarding,** without waiting for the weekly run. Assumed not to count toward the 3 refreshes. | MVP | Nobody should be told to wait to use the app |
| D15.4 | **The demo's live-team view uses the owner's own team,** good weeks and bad | MVP | Real results; fits the accountability positioning |
| D15.5 | **A failed or timed-out refresh doesn't count toward the 3** | MVP | The user got nothing from it |
| D15.6 | **Chips sit behind a "Want to use a chip?" toggle;** turning it on shows the chip strip. What shows when it's off is left open as a UI decision; the agent still works out chip advice every week regardless. | Open (UI) | Owner's call: reduces noise; doesn't affect logic |
| D15.7 | **Changing team keeps old receipts** in the user's history, labeled with the old team | MVP | Deleting history on a team switch would be surprising; "Delete my data" covers a full wipe |

## 16. Timeline and portfolio (19 October 2026)

| ID | Decision | Status | Rationale |
|---|---|---|---|
| D16.1 | **Two milestones:** Core MVP (v0.1) by **Sunday 25 October 2026**; full MVP by **~20 November 2026**, with the owner working as many hours as the deadlines need (confirmed 19 Oct) | Locked | The full MVP doesn't fit in one week; receipts need weeks of play to show results anyway |
| D16.2 | **Core MVP scope:** sign-in, team linking by **country + country rank + team name, with the paste-link-or-ID fallback** (D9.3–D9.5a, D9.7; see D16.9), on-demand brief with transfer and captain cards, reasoning and trace, landing and privacy pages, error states | Locked (revised 19 Oct) | The smallest version that delivers real advice, with onboarding tested from day one |
| D16.3 | **Public sample brief page in the core:** the owner's team, real this week, no sign-in | Core | Recruiters and non-players can see the app working; never cut |
| D16.4 | **The daily GitHub Actions job moves into the core** | Core | Keeps Supabase from pausing between visits |
| D16.5 | **A per-user daily cap on generating briefs** until the full Refresh logic lands | Core | A public link invites traffic; controls model costs |
| D16.6 | **Google sign-in published to production** before sharing (basic scopes; confirm whether Google review is needed) | Core | In "Testing" status, only listed test users can sign in |
| D16.7 | **Labeled "v0.1, MVP in progress"** on the site and portfolio, with the roadmap | Core | Honest framing shows scope judgment |
| D16.8 | **Moved out of the core:** scheduling and email (including "Email me a link to finish on desktop," D9.6), Refresh, chips, preview and check-in, receipts and scorecard, curated demo, the style toggle, full motion and light mode | Deferred to weeks 26 Oct – 20 Nov | Sequenced in `plan.md` section 7 |
| D16.9 | **Country-rank lookup moved back into the core** (reverses part of D16.2 and D16.8): country list, tie-size probe, page scan with fuzzy name match and neighbor-group check, real progress text, 5-second link option, 30-second cap, per-gameweek standings cache, and the link fallback | Core (19 Oct) | Owner's call: onboarding is the most important first impression, and family testing must catch problems with it early. Adds the most risk to Wednesday 21 Oct (`plan.md` section 7). |
