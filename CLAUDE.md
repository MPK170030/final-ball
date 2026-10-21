# Final Ball

An AI agent for Fantasy Premier League managers. Tagline: "We create the chance, you finish it."
Each gameweek it suggests a transfer (top pick + 3 alternatives, or "Save your transfer") and a captain, explains why, and shows its full reasoning trace. Positioning: accountable advice.

Owner: Manav (solo). Portfolio project; family members who play FPL are the first testers.

## Source of truth

Read these before making product or design decisions. They win over anything you assume.

- `docs/decisions.md`: every decision, with IDs (D1.1 onward). Cite IDs in commits and PRs when relevant.
- `docs/plan.md`: scope, architecture, agent flow, data model, day-by-day plan (section 7), risks.
- `docs/user-stories.md`: stories with acceptance criteria; the "Core MVP" table lists what ships in v0.1.
- `docs/user-flows.md`: flows, edge cases and the screen list (diagrams not included).
- `docs/design-system/`: `tokens.json` (colours for dark and light, type, spacing, radius), `README.md` (brand rules and contrast notes), `components.css` + `components/<Name>/` (reference CSS, previews and usage notes for 10 components).
- Wireframes (Claude artifact, view in a browser): https://claude.ai/artifact/ETk2SWi1qTQRP2Y4DW21HK

If a task conflicts with these docs, stop and ask. If the owner makes a new decision, add it to `docs/decisions.md` with the next ID.

## Milestones

- **Core MVP (v0.1): Sunday 25 October 2026.** Scope: D16.2, D16.9 and the Core MVP table in `docs/user-stories.md`.
- Full MVP: ~20 November 2026.
- Not in v0.1 (D16.8): scheduled briefs, email, Refresh, chips, next-week preview, check-in, receipts and scorecard, curated demo, Safe/Balanced/Bold toggle, light mode, full motion.

## Stack (decided, D11)

- Monorepo with pnpm workspaces: `/apps/web` (Next.js App Router + Tailwind + shadcn/ui), `/packages/agent` (FPL client, analysis, model calls, trace; framework-agnostic), `/packages/db` (Supabase schema, types, queries), `/scripts/daily`.
- Supabase: Postgres + Auth (Google only). Hosting: Vercel Hobby. Scheduler: GitHub Actions. No Render (D11.5).
- Domain: `finalball.manavpkothari.dev` (D11.12). Google OAuth client and Supabase auth config are already set up.
- UI libraries: Motion (`motion`), NumberFlow (`@number-flow/react`), shadcn `Sheet` (not `Drawer`, which depends on the unmaintained Vaul), IBM Plex Sans + IBM Plex Mono via `next/font`.

## Hard rules

- **Never commit secrets.** `.env*` stays git-ignored; commit `.env.example` with names only. The Supabase service-role key is server-only and never reaches the browser.
- **Read-only toward FPL** (D9.12): never write to FPL, never ask for or handle FPL credentials.
- **Be polite to FPL:** every FPL request goes through one client module with caching, throttling (a few requests at a time), retries with backoff, and a descriptive User-Agent.
- **No Premier League or FPL branding:** no logos, club crests, or "FPL" in the product name. Include the non-affiliation disclaimer in the footer and privacy page.
- **Design:** use the design-system tokens, never shadcn's default zinc theme or radius. Dark first. One accent (`primary`, orange) and one emphasis per card. Numbers in IBM Plex Mono with tabular figures. Every animation has a reduced-motion fallback. Avoid "magic" effect libraries (spotlight cards, beams, sparkles, gradient blobs).
- **Accessibility:** real buttons, links and labels; 44px touch targets; respect the contrast notes in `docs/design-system/README.md`.

## Working style

- The owner wants speed with security and understanding. Provide reasoning for every step being taken.
- Work in small commits on a feature branch; open a PR into `main` when a chunk is done. Ensure feature branches are named appropriately, short and concise.
- When something needs the owner (a key, a dashboard click, a DNS change), say exactly what and where, then continue with anything that doesn't depend on it.
