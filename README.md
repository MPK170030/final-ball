# Final Ball

> "We create the chance, you finish it."

An AI agent for Fantasy Premier League managers. Every gameweek it recommends a transfer (top pick + 3 alternatives, or "Save it"), a captain, and when to play chips — and then tracks whether its advice worked.

**Positioning:** accountable advice. Every suggestion shows its full reasoning and scores itself against what actually happened.

Live at [`finalball.manavpkothari.dev`](https://finalball.manavpkothari.dev) · v0.1 MVP in progress · [Roadmap](#roadmap)

---

## What's built

### Infrastructure
- Monorepo: pnpm workspaces (`/apps/web`, `/packages/agent`, `/scripts`)
- **Auth:** Google OAuth (Supabase) — sign-up and sign-in are one button
- **Database:** Supabase Postgres
- **Hosting:** Vercel Hobby
- **Scheduler:** GitHub Actions (daily data refresh + weekly brief generation)
- **Domain:** `finalball.manavpkothari.dev` with DNS on Vercel

### Onboarding
- Find your team by **country + country rank + team name** — no URLs or IDs needed for most users
- Tie-size probe (binary search) estimates scan time before starting
- Rotating progress text tied to real scan progress
- "Use my FPL link instead" after 5 seconds; 30-second cap with URL fallback
- "Is this you?" confirmation card; one account per team

### Agent (`packages/agent`)
The core analysis pipeline, framework-agnostic:

```
generateTransfers(teamId) → { transfers, trace: TraceStep[], meta }
```

1. **Load context** — squad, bank, free transfers (derived from history), fixtures
2. **Score players** — `ep_next × availability` for GW1; `form × fdrMultiplier × availability` for GW2/3; blank GW = 0; DGW = ×2
3. **Rank weak spots** — pts/£m; backup GK gets a minimum floor to avoid dominating the sell list
4. **Find candidates** — same position, affordable, not owned, status not unavailable
5. **Apply constraints** — max 3 per club; 2-transfer pairs checked jointly
6. **Rank with model** — `claude-sonnet-4-6` via tool use, returns structured JSON (top pick + 3 alternatives + "why sell" + full reasoning sections)
7. **Validate picks** — re-checks model choices against constraints; records replans; falls back to deterministic ranking after 2 replans
8. **Trace** — every step emits `{n, title, text, replan?}` in plain language with real numbers

Save threshold: +1.0 pts over 3 GWs — below that, rolling the transfer is recommended.

### UI (`apps/web`)
- Next.js App Router + Tailwind + shadcn/ui
- Sign-in, team linking, and post-auth routing (brief ↔ onboarding)
- `/brief`, `/onboarding`, `/privacy` pages
- FPL client hardening: jitter, 503 hold, two-layer cache, per-key TTLs
- FPL health endpoint at `/api/fpl-health`
- Design system: dark-first, IBM Plex Sans + Mono, orange accent (`#FF8A1F`), 10 components

---

## Roadmap

### v0.1 — Core MVP (target: 25 October 2026)
- [ ] Transfer cards with top pick + 3 alternatives and full reasoning
- [ ] Captain pick
- [ ] "How the agent decided" trace panel (D8.4)
- [ ] Sample brief page (no sign-in required)
- [ ] Daily GitHub Actions job (keeps Supabase active, refreshes prices/injuries)
- [ ] Deploy to `finalball.manavpkothari.dev`
- [ ] Google OAuth published to production

### Full MVP (target: ~20 November 2026)
- Scheduled weekly brief generation + one email per gameweek
- Refresh button (max 3 per gameweek)
- Chips: timing advice, expiry nudges, weekly alert card
- Stick-or-diverge check-in
- Next-week preview
- Transfer receipts + 5-gameweek scorecard
- Decision journal
- Demo mode (frozen snapshot + live toggle)
- Light mode, full motion

### Post-MVP
- "Ask the agent" — text and voice ("why not X?")
- Hits tied to aggression setting
- Wildcard and Free Hit squad builders
- Rival mode — league ownership badge, differentials, gap context

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js App Router, Tailwind, shadcn/ui |
| Agent | Node, TypeScript, `@anthropic-ai/sdk` |
| Auth + DB | Supabase (Google OAuth + Postgres) |
| Hosting | Vercel Hobby |
| Scheduler | GitHub Actions |
| Model | `claude-sonnet-4-6` via `ANTHROPIC_MODEL` env var |
| Email | Nodemailer → Resend SMTP |

---

## Running locally

```bash
pnpm install

# Run the web app
pnpm dev

# Run the agent CLI against a team
pnpm agent:run -- --team <teamId>

# Run agent tests
pnpm --filter @finalball/agent test
```

Requires `.env.local` in `apps/web/` — see `.env.example`.

---

## Docs

- [`docs/decisions.md`](docs/decisions.md) — every product decision with IDs (D1.1 onward)
- [`docs/plan.md`](docs/plan.md) — scope, architecture, agent flow, day-by-day plan
- [`docs/user-stories.md`](docs/user-stories.md) — stories with acceptance criteria
- [`docs/STATUS.md`](docs/STATUS.md) — what's done, open items, test data

---

*Not affiliated with the Premier League or Fantasy Premier League.*
