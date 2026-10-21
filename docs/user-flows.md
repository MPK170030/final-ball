# Final Ball — User Flows

Oct 18, 2026 · @Manav

Seven flows cover every job in the MVP, from a first visit to settings, and together they need 15 screens and 2 emails (listed at the end). Sign-up and sign-in are one button, **Continue with Google**; the app decides where to send you after Google confirms who you are.

**How to read the diagrams:** rounded pills are where a flow starts or ends, rectangles are screens or steps, diamonds are decisions, and the highlighted box is where the flow succeeds. Comment on any box, line, or label to suggest a change.

## Flow 1: First visit

&#91;embedded content: flow 1 · first visit · 2 decisions, 3 ends\]

Anyone already signed in skips the landing page. After Google confirms who someone is, one check decides where they go: a linked team means the weekly brief; a new account, or one that never finished linking, means onboarding.

## Flow 2: Onboarding

&#91;embedded content: flow 2 · onboarding · 4 decisions, 3 ends\]

The app first checks how many managers share the rank; a group too large to scan in 30 seconds goes straight to the link step. Searching offers the link from 5 seconds. Brand-new teams with no rank skip to the link, and Cancel is also available on the link screen. The first brief is generated as soon as the team is confirmed, so nobody waits for the weekly run.

**Updated 19 Oct (core MVP):** the rank lookup ships in v0.1 (D16.9). On mobile, (i) buttons next to the rank, team name and link fields open picture guides in a side panel; desktop keeps the guide beside the form. The link screen's banner says why you're there: the 30-second cap, no rank yet, or a tied group too big to search. There's no banner if you chose the link yourself. "Email me a link to finish on my computer" comes after v0.1, with the email setup.

## Flow 3: Weekly loop

&#91;embedded content: flow 3 · weekly loop · 2 decisions, 9 steps\]

The cards run top to bottom in this order on one screen, with receipts and the 5-gameweek scorecard below them. Transfer cards may say "Save your transfer" instead, and show 2 cards when 2 free transfers are banked. There's no "done" step to come back for: after the deadline, the app reads your actual transfers from FPL.

**Updated 19 Oct:** each transfer card says why that player is the one to sell. "Why?" and "How the agent decided" open one detail view with two tabs: a bottom sheet on mobile, a side panel on desktop. The Why tab first ranks the player against the next 2 weakest in the squad, then makes the case for the top pick (D8.6, D8.7). In v0.1 the brief is made on demand, with a daily limit; scheduled briefs, Refresh, chips, the preview, check-in and receipts come later (D16.8).

## Behind the scenes: one gameweek

&#91;embedded content: weekly loop behind the scenes · 4 lanes, time runs down\]

Time runs top to bottom. Scheduled jobs do the heavy work before you arrive, so opening the brief is instant; only Refresh runs the agent while you wait. After the deadline, the daily job reads what you actually did, which is how receipts work without you logging anything.

## Flow 4: Refresh

&#91;embedded content: flow 4 · refresh · 2 decisions, 3 ends\]

Each refresh saves a new version of the brief, and receipts track whichever version you acted on. A refresh that times out (the 5-minute server limit) keeps the old brief and gives the refresh back, so it doesn't count against the 3.

## Flow 5: Receipts and scorecard

&#91;embedded content: flow 5 · receipts · 2 decisions, 1 end\]

This runs automatically; the user never reports anything. Every move gets a receipt, labeled followed, your own move, or ignored, by comparing actual moves with the brief version the user last saw. That's what powers the followed-vs-ignored comparison. When a receipt appears, it asks "Why did you make this move?" for an optional journal note. A funding move is spotted when a cheaper player comes in; if no upgrade follows within 2 gameweeks, it's judged on its own. Captain and chip receipts follow the same pending-then-settle path, and any receipt has an optional "edit" link to correct the guessed intent.

## Flow 6: Settings

&#91;embedded content: flow 6 · settings · 4 controls, 1 decision\]

Changing team reruns the Flow 2 lookup; the old team's receipts stay in your history, labeled with that team. Deleting removes your account, Team ID, suggestions, decisions, and notes, then signs you out.

## Flow 7: Demo mode

&#91;embedded content: flow 7 · demo mode · 1 decision, 2 ends\]

The demo is a frozen, curated brief that always shows a weak spot, a replan, and a chip decision. It needs no sign-in and is offered only to logged-out visitors. The live-team view shows the owner's own team this week, good weeks and bad.

## Edge cases

These situations cut across the flows; each one needs its own message or state on screen.

| Situation | What the user sees | Flows |
| --- | --- | --- |
| FPL is down or "game updating" | Banner: "FPL is updating. Showing your last saved brief." The team lookup offers the link fallback or "try again in a few minutes." | 2, 3, 4 |
| Deadline has passed | The brief turns read-only, with "Next brief arrives \[date\]." Receipts and the scorecard stay visible. | 3 |
| New user joins after this week's brief run | A first brief is generated right after onboarding, so there's no waiting | 2, 3 |
| Brand-new team with no rank yet | "No rank yet?" link goes straight to the link fallback | 2 |
| Returning user who never linked a team | Sent back to onboarding after Continue with Google | 1, 2 |
| Team already linked to another account | "This team is already linked," with a way to report it | 2 |
| Refresh limit reached (3 this gameweek) | Refresh button disabled, with "Resets when the next gameweek starts" | 4 |
| Weekly email turned off or bounced | Brief is still ready in the app on schedule | 3, 6 |

## Screen list

The flows need 15 screens and 2 emails; this list is the input for the wireframes.

| # | Screen | Flows | What it holds |
| --- | --- | --- | --- |
| 1 | Landing page | 1, 7 | Get started, Sign in, Try the demo |
| 2 | Google sign-in | 1 | Google's own screen, not ours |
| 3 | Find your team | 2 | Country (pre-selected), country rank, team name; where-to-find guides ((i) buttons on mobile, beside the form on desktop); "No rank yet?"; Cancel |
| 4 | Searching | 2 | Progress bar, rotating text, "Use my FPL link instead" from 5 seconds, 30-second cap |
| 5 | Use your FPL link | 2 | Open FPL, copied-link detection, paste box, guide, a banner saying why you're here (30-second cap, no rank yet, tied group too big); email-to-computer after v0.1 |
| 6 | Is this you? | 2 | Team name, manager name, rank, points; Confirm, Not me |
| 7 | Team already linked | 2 | Explanation and a report option |
| 8 | Weekly brief | 3, 4, 7 | Check-in, transfer cards, captain, chip area, next-week preview, receipts and scorecard, style toggle, Refresh; the first one is generated right after onboarding |
| 9 | Reasoning detail | 3 | One view with two tabs, Why (why sell, then why the pick) and How the agent decided; bottom sheet on mobile, side panel on desktop |
| 10 | Refreshing | 4 | Progress while regenerating; limit-reached message |
| 11 | Scorecard and receipts | 5 | 5-gameweek headline, receipt list (followed, your own move, ignored), pending and linked receipts, edit intent, journal note prompt |
| 12 | Settings | 6 | Change team, weekly email on/off, delete my data, sign out |
| 13 | Delete confirmation | 6 | What gets deleted, Confirm, Cancel |
| 14 | Demo brief | 7 | Weekly brief with a Demo badge, tooltips, live-team toggle (the owner's own team), sign-up prompt |
| 15 | Info panels (mobile) | 2 | Picture guides for the country rank, team name and FPL link, opened by the (i) buttons |
| E1 | Weekly brief email | 3 | "Your GW brief is ready, deadline in 24h," link to the brief |
| E2 | Finish on desktop email | 2 | Link back to the Find your team step |

## Open questions

Mapping the flows surfaced six decisions; five are decided, and the chip display is left open as a UI decision.

1. **Decided: every new user gets a brief right after onboarding.** Nobody is told to wait for the weekly run.
2. **Decided: no "Mark as done" step.** The app reads actual moves from FPL after the deadline. The journal note moves to the receipt: "Why did you make this move?"
3. **Decided: the demo's live-team view uses the owner's own team.** Real results, good weeks and bad.
4. **Open (UI decision): what shows when the "Want to use a chip?" toggle is off.** The agent works out chip advice every week regardless; only the display is undecided.
5. **Decided: a failed refresh doesn't count toward the 3.**
6. **Decided: changing team keeps old receipts** in your history, labeled with the old team.
