# Brief page — implementation spec

Source: Core MVP wireframes (brief frames 8, states 4, reasoning 9a/9b, sample brief). The wireframes are greyscale; §7 maps every grey to the design-system token to use. Decision IDs refer to `docs/decisions.md`.

## 1. Page-level layout

**Route:** `/brief` (signed in). `/sample` reuses the same page with a public header (§2, §3.1).

**Order, top to bottom** (D8.2, trimmed for v0.1):
1. App header
2. Status banner (only in some states)
3. Gameweek header (title block + "New brief")
4. Transfer card(s), or the "Save your transfer" card
5. Captain card
6. "How the agent decided" link card
7. Sample-only sign-up panel
8. Footer

**Mobile (390 frame)**
- Single column, 16px side padding.
- Card stack: 16px padding all round, 16px gap between cards.
- Footer: top border, padding 20px top, 16px sides, 32px bottom.

**Desktop (1440 frame)**
- Content max width 1200px, centred, 32px side padding.
- Header bar full width with a bottom border; its inner content uses the 1200 container.
- Cards column: `flex 999 1 560px`, 20px gaps, 32px below.
- Detail panel, when open, sits to the right of the cards column (§4.3).
- Footer: full-width top border; inner container padding 20px top, 32px sides and bottom.

**Sticky elements:** none in the wireframes; everything scrolls. See §8.8.

**Above the fold**
- Mobile (844 tall): header, gameweek header, New brief row (about the first 270px), then the transfer card's label row, Why-sell line, Out block and most of the top-pick block. Reason, Why?, alternatives, captain, trace link and footer need scrolling.
- Desktop (about 900 tall): header, gameweek header, nearly all of transfer card 1. Captain card and below need scrolling. With two transfers, card 2 is fully below the fold.

## 2. Top-level states

| State | Banner | Title | Deadline text | New brief control | Body | Footer |
|---|---|---|---|---|---|---|
| Brief ready (default) | none | "Your brief" | "Deadline in 2d 4h" | Enabled + "[N] left today" | Cards | Shown |
| Generating (first brief) | none | "Your first brief" | "Deadline in 2d 4h" | Hidden | Progress card + skeletons; no cards | Hidden |
| FPL updating | "**FPL is updating.** Showing your last saved brief. Try a new brief in a few minutes." | "Your brief" | normal | Enabled (see §8.6) | Last saved cards | Shown |
| Deadline passed | "**The GW 9 deadline has passed.** This brief is read-only. Your GW 10 brief arrives [DATE]." | "Your brief" | "Deadline passed" | Disabled + "Locked after the deadline" | Cards (read-only) | Shown |
| Daily cap reached | "**Daily limit reached.** You can make [N] briefs a day. It resets tomorrow." | "Your brief" | normal | Disabled + "Limit reached · resets tomorrow" | Cards | Shown |
| Sample (public) | "**Sample brief.** This is the owner's real team this week. It isn't advice for your team." | "Sample brief" | normal | Hidden | Cards + sign-up panel | Shown |

Each state comes in three transfer variants: one transfer, save your transfer, two free transfers (§3.3–3.5).

### 2.1 Generating state
- Gameweek header: title "Your first brief"; generated line "Started just now"; New brief row hidden.
- Progress card (`role="status"`):
  - Mobile: 1px border, 12px radius, 16px padding, 14px gaps. Desktop: 14px radius, 24px padding, 16px gaps; left column `flex 1 1 360px`.
  - Contents:
    1. "Building your brief": 17px mobile, 19px desktop, semibold.
    2. Progress bar: 8px tall, 4px radius, light track, dark fill (45% shown).
    3. Five step rows: 16px-wide Mono marker, then label (14px mobile, 15px desktop).
       - "✓ Loaded your squad from FPL" (done: foreground, regular)
       - "✓ Checked the next 3 fixtures" (done)
       - "● Finding weak spots…" (current: foreground, semibold)
       - "○ Ranking replacements" (to do: muted, regular)
       - "○ Picking a captain" (to do)
    4. "Usually under a minute." (13px muted).
- Skeletons:
  - Mobile, below the progress card:
    - Transfer skeleton (1px light border, 12px radius, 16px padding, 10px gaps): bar 12px at 30% width, block 96px, bar 10px at 85%, bar 10px at 70%.
    - Captain skeleton: bar 12px at 25%, block 64px.
  - Desktop, right column (`flex 2 1 520px`), 16px apart:
    - Card 1: two columns, 160px block left, three 44px blocks right.
    - Card 2: four 80px blocks in a row.

### 2.2 Not drawn (needs a decision or design)
- Generation failed (doesn't count toward the cap, D15.5).
- Running "New brief" when a brief exists: replace cards with the progress card, or overlay?
- Captain Why? and Save Why? sheet content.
- Account menu contents.
- No team linked: expected to redirect to onboarding.

## 3. Components

### 3.1 App header
- Mobile: 56px tall, 16px side padding, 1px bottom border.
  - Left: wordmark "Final Ball", 17px semibold, −0.01em.
  - Right: account button, 44×44 tap target with a 32px circle (Google avatar). `aria-label`: "Account menu: change team, privacy, sign out".
- Desktop: 64px tall. Wordmark 19px. Right side, 12px apart: team name "[TEAM NAME]" (14px, secondary text), then the account button.
- Sample variant: right side is "Sign in" (underlined link, 14px medium, 44px tall) and "Get started" (filled button, 44px tall, 14px mobile / 18px desktop side padding, 10px radius, 14px semibold). Gap 12px mobile, 16px desktop.

### 3.2 Gameweek header
**Mobile** (padding 20px top, 16px sides, 4px bottom; 6px gaps):
1. "GAMEWEEK 9" (label style).
2. H1 "Your brief": 26/32, semibold, −0.01em.
3. Team line "[TEAM NAME]": 14px secondary.
4. Wrapping row (gaps 4px vertical, 14px horizontal, 4px above), 13px:
   - "Deadline in 2d 4h" in Mono medium.
   - "1 free transfer · £0.9m in the bank" in secondary text.
5. "Generated 18 Oct, 14:17": 13px muted.
6. New brief row (padding 10px top, 16px sides; 12px gap): "New brief" outline button (44px tall, 16px side padding, 10px radius, 14px medium), then "[N] left today" (13px muted) to its right.

**Desktop:** wrapping row, padding 32px top and 20px bottom, gaps 16px/32px, bottom-aligned, spread to the edges.
- Left: label; H1 34/40, −0.015em; one wrapping meta row (14px, gaps 4px/18px): team name, deadline (Mono), free transfers, generated time (muted).
- Right: "[N] left today" to the left of the New brief button (18px side padding).

**Formats**
- Deadline: "Deadline in {d}d {h}h"; after the deadline "Deadline passed". Animate with NumberFlow.
- Free line: "{n} free transfer(s) · £{bank}m in the bank" (one decimal).
- Generated: "Generated {D Mon}, {HH:MM}" (24-hour).
- Disabled New brief: muted fill, muted text, border; a reason line replaces "[N] left today".

### 3.3 Transfer card — one transfer
**Shell:** mobile 1px border, 12px radius, 16px padding, 14px gaps. Desktop 14px radius, 24px padding, 18px gaps.

**Mobile, top to bottom**
1. Label row, spread: "TRANSFER" (label) left; tag "Weak spot · MID" right (12px semibold, 4px × 8px padding, 6px radius, secondary fill).
2. Why-sell line (D8.6), 14/20: **"Why sell Saka?"** + "Your weakest starter for his price: flagged 75%, 2.4 pts a game, and the hardest next 3 in your squad."
3. Out block (6px gaps):
   - "OUT" label.
   - Row, spread, baseline-aligned: name "Saka" (16px semibold) left; flag "Flagged 75%" (13px semibold) right.
   - Meta "ARS · MID · £9.9m · Form 2.4" (13px muted).
   - Three fixture chips: MCI A **5**, LIV H **4**, NEW A **4**.
4. Top-pick block (the card's single emphasis): 2px `primary` border, 10px radius, 14px padding, 6px gaps.
   - "TOP PICK · IN" label.
   - Name "Mbeumo": 22/28 semibold (largest text in the card).
   - Meta "MUN · MID · £8.0m · Form 6.8".
   - Chips: BOU H **2**, WHU A **3**, BUR H **2**.
   - "Bank after: £2.8m" in Mono 13px.
5. Reason (15/22): "Mbeumo is in form, has three easier fixtures, and frees up £1.9m." About the replacement only.
6. "Why?": underlined link, 14px semibold, 44px tap height, left-aligned. Opens the detail sheet on the Why tab.
7. 1px divider.
8. "3 ALTERNATIVES" label.
9. Three alternative rows, ranks 2, 3, 4 (12px gap between rank and body):
   - Rank circle: 28px, 1px `input` border, Mono 13px.
   - Body (4px gaps, 12px bottom padding, 1px bottom border):
     - Row, spread, baseline-aligned: name (15px semibold) left; price (Mono 13px) right.
     - Meta "BOU · Form 6.1" (13px muted). Club and form only.
     - Reason (14/20).
     - Three small chips (22px tall, 11px text, 6px side padding), 2px above.
   - Data:
     - 2 Semenyo, £7.6m, BOU · Form 6.1, "On penalties; two kind fixtures." Chips MUN A 4, EVE H 2, FUL A 3.
     - 3 Kudus, £6.9m, TOT · Form 5.4, "Cheapest option; leaves £3.9m in the bank." Chips AVL H 3, BRE A 3, SUN H 2.
     - 4 Rogers, £7.0m, AVL · Form 5.0, "Steady minutes; one tough away trip." Chips TOT A 4, BHA H 3, WOL A 2.

**Desktop differences**
- Why-sell line (15/22) spans full width above a two-column grid (auto-fit, min 280px, 28px gap).
  - Left (14px gaps): Out block (name 17/24), top-pick block (12px radius, 16px padding, name 26/32), reason, Why?.
  - Right (12px gaps): "3 ALTERNATIVES" label, then each alternative as a bordered box (1px border, 10px radius, 12px padding).
- Selected state (its details open in the side panel): card border 2px `primary`; Why? reads "Why? (open in panel)".

**Data rules**
- Exactly 3 alternatives (D2.1). Exactly 3 chips per player (D3.1).
- Price "£{x.x}m"; form "Form {x.x}".
- Flag is free text ("Flagged 75%", "Benched twice"); omit if none.
- Meta: Out and top pick "CLUB · POS · £price · Form x.x"; alternatives "CLUB · Form x.x".
- Club as three-letter code; no crests (D9.12).

### 3.4 Transfer card — two free transfers (D2.3)
- Two cards, same structure, labels "TRANSFER 1 OF 2" and "TRANSFER 2 OF 2".
- Header free line: "2 free transfers · £0.9m in the bank".
- Card 2 sample data:
  - Tag "Weak spot · DEF". Why sell: "**Why sell Mykolenko?** Your next weakest starter: benched in 2 of the last 3 GWs, 1.6 pts a game."
  - Out: Mykolenko, flag "Benched twice", "EVE · DEF · £4.4m · Form 1.6". Chips CHE A 4, BOU A 3, MCI H 5.
  - Top pick: Muñoz, "CRY · DEF · £5.9m · Form 5.2". Chips LEE H 2, SUN A 2, NFO H 3. "Bank after both: £1.3m".
  - Reason: "Muñoz starts every week, gets forward, and has two easy fixtures."
  - Alternatives:
    - 2 Van Hecke, £4.8m, BHA · Form 4.4, "Cheap and nailed; keeps £2.4m in the bank." Chips WOL H 2, AVL A 4, CHE H 4.
    - 3 Kerkez, £5.8m, LIV · Form 4.1, "Clean-sheet upside at home." Chips FUL H 2, ARS A 5, BRE H 3.
    - 4 Wan-Bissaka, £4.7m, WHU · Form 3.9, "Budget pick; tougher run." Chips NEW H 3, MUN H 4, LEE A 2.

### 3.5 "Save your transfer" card (D2.2)
**Mobile**, same shell:
1. Label row: "TRANSFER" left; tag "No weak spot" right.
2. Emphasis block (same as top-pick block): "AGENT'S PICK" label; "Save your transfer" 22px semibold; "You'll have 2 free transfers in GW 10" Mono 13px.
3. Reason: "Every starter is fit and has a playable run. No move gains enough to be worth the transfer this week."
4. "Why?" link (not wired).
5. Divider.
6. "BEST TRANSFER, IF YOU'D RATHER MOVE" label.
7. Stack (4px gaps): "Saka → Mbeumo" (16px semibold); "ARS £9.9m out · MUN £8.0m in" (13px muted); "About +1 expected point over 3 GWs. Rolling is worth more." (14px).

No why-sell line, Out block, chips or alternatives in this variant.

**Desktop:** two-column grid (min 300px, 24px gap). Left: emphasis block (12px radius, 18px padding, title 26px), reason, Why?. Right: secondary-fill box (12px radius, 18px padding, 8px gaps, top-aligned) with the best transfer; "Saka → Mbeumo" at 18px.

Captain card in this variant: vice from the existing squad (Palmer); alternatives Salah and Watkins.

### 3.6 Captain card (D4.1, D4.4)
**Mobile**, same shell, 14px gaps:
1. "CAPTAIN" label.
2. Captain block (emphasis): 2px `primary` border, 10px radius, 14px padding, horizontal, 12px gap.
   - Left: 32px filled circle "C" (`primary` fill, `primary-foreground` 14px semibold).
   - Right (4px gaps): name "Haaland" 20/26 semibold; meta "MCI · vs ARS (H)"; reason "Highest expected points in your squad; on penalties at home."
3. Vice row (no border), 12px gap: 32px outlined circle "V" (1.5px border); name "Mbeumo" (16px semibold); meta "MUN · vs BOU (H)"; reason "Your new signing has the easiest fixture of your starters."
4. "Why?" link (not wired; §8.11).
5. Divider.
6. "ALTERNATIVES" label.
7. Two rows (2px gaps, 10px bottom padding, bottom border):
   - Row, spread, baseline-aligned: name (15px semibold) left; meta (13px muted) right.
   - Reason (14px).
   - Data: Palmer, "CHE · vs EVE (H)", "Takes penalties; strong home record." / Salah, "LIV · vs FUL (H)", "The most-captained pick this week."

**Desktop** (24px padding, 16px gaps):
- Header row, spread: "CAPTAIN" label left, "Why?" link right.
- Grid of tiles (auto-fit, min 200px, 14px gap) — four in a row at full width:
  1. Captain tile: 2px `primary` border, 12px radius, 16px padding, 6px gaps; header row with 24px filled "C" badge + "CAPTAIN" label; name 20px, meta, reason.
  2. Vice tile: 1px border; 24px outlined "V" + "VICE"; name 17/24.
  3–4. Alternative tiles: secondary fill, no border; "ALTERNATIVE" label; name 17px, meta, reason.

**Rules:** captain, vice, 1–2 alternatives. Picks use the squad after the suggested transfer, so the incoming player can be vice. Meta "CLUB · vs OPP (H|A)". No chips on this card.

### 3.7 "How the agent decided" link card
- Whole card is a link: min height 64px, 1px border, radius 12px mobile / 14px desktop; padding 12×16 mobile, 14×20 desktop.
- Left (2px gaps): "How the agent decided" (15px semibold); subtitle (13px muted): "7 steps · 1 replan" (mobile) or "7 steps · 1 replan · the full trace for this brief" (desktop).
- Right: "→" (18px, `aria-hidden`).
- Opens the detail sheet/panel on the trace tab.
- Counts are computed; omit "· N replan" when there are none.

### 3.8 Fixture chip
- Pill: 24px tall, 8px side padding, 6px radius, 6px internal gap.
- Text: Mono 12px "OPP H|A", then the difficulty number in bold.
- Small (alternatives): 22px tall, 6px padding, 11px text.
- Fill by difficulty: `fdr-2` (1–2), `fdr-3`, `fdr-4`, `fdr-5` (§7). Always show the number.
- Wrap with 6px gaps.

### 3.9 Status banner
- Mobile: margin 12px top, 16px sides; padding 12×14; text 14/20.
- Desktop: margin 20px top inside the container; padding 14×16; text 15/22.
- 10px radius, secondary fill, `role="status"`. 20px circled "i" icon (1.5px border, 12px semibold), then text: bold first sentence, then body.
- One banner at a time; not dismissible.

### 3.10 Sample sign-up panel (sample only)
- Mobile: secondary box, 12px radius, padding 20×16, 10px gaps. Title "Get a brief for your own team" (18px semibold); body (14px secondary text); full-width filled "Get started" (48px tall).
- Desktop: 14px radius, 28px padding; wrapping row, text left (title 20px, body 15px), button right (48px tall, 28px side padding).
- Body copy (updated, see §8.10): "Sign in with Google and find your team by country rank. Takes about a minute."

### 3.11 Footer
- Mobile (8px gaps): "v0.1 · MVP in progress" (Mono 12px muted); "Final Ball is not affiliated with the Premier League or Fantasy Premier League." (12px muted); "Privacy" link (13px underlined).
- Desktop: same three in one wrapping row, spread; disclaimer 13px.
- Hidden while generating.

## 4. Detail sheet (mobile) / side panel (desktop)

One surface, two tabs: **Why** and **How the agent decided** (D8.7).

### 4.1 Triggers
- Transfer card "Why?" → Why tab for that card.
- "How the agent decided" link card → trace tab.
- Captain Why? and Save Why? → Why tab with their own content (not drawn, §2.2).

### 4.2 Mobile bottom sheet
- Scrim: full screen, `scrim` token.
- Sheet: bottom-anchored, full width, about 78% of the viewport (660px of 844). `card`/`popover` fill, top corners 16px, `role="dialog"`, `aria-label` "Transfer details".
- Top to bottom:
  1. Drag handle: 40×4, 2px radius, `input` colour, centred, 8px from top.
  2. Header (padding 8 top, 8 right, 16 left), spread:
     - Left (2px gaps): "TRANSFER · TOP PICK" label; title "Saka → Mbeumo" 18/24 semibold.
     - Right: close button 44×44, 18px X icon (2px stroke, round caps). `aria-label` "Close".
  3. Tabs (`role="tablist"`): 8px top margin, 16px side padding, 1px bottom border, 20px gap. "Why" and "How the agent decided", each 44px tall, 2px horizontal padding, 14px.
     - Selected: 2px `primary` bottom border, weight 600, `aria-selected="true"`.
     - Unselected: transparent border, weight 400.
  4. Body: 16px padding, 14px gaps, fills remaining height, **scrolls** (§8.8).

**Why tab, in order**
1. "1 · WHY SELL SAKA" label.
2. Ranking sentence (14/20): "All 15 players ranked on expected points for their price over the next 3 GWs. Saka comes out lowest."
3. Three rank rows (10px gap, 8×10 padding, 8px radius, `background` fill):
   - Left: rank number, Mono 12px muted, 16px wide.
   - Right: wrapping line with name (14px semibold) and meta (12px muted); note below (13px secondary).
   - Row 1 border 1.5px `foreground`; rows 2–3 1px `border`.
   - Data:
     - 1 Saka, "MID · £9.9m", "Flagged 75% · form 2.4 · 5.8 expected pts next 3"
     - 2 Mykolenko, "DEF · £4.4m", "Benched twice · form 1.6 · 4.1 expected pts next 3"
     - 3 Watkins, "FWD · £9.0m", "Hard run, but form 6.2 · 11.4 expected pts next 3"
4. 1px divider.
5. "2 · WHY MBEUMO" label.
6. Four items: label (12px uppercase muted), body 2px below (15/22):
   - FORM: "Mbeumo: 6.8 points a game over his last 5, and he has started every league game."
   - NEXT 3 FIXTURES: "Mbeumo: BOU (H), WHU (A), BUR (H). Saka: MCI (A), LIV (H), NEW (A)."
   - PRICE: "£8.0m in, £9.9m out. You keep £2.8m in the bank."
   - RISKS: "If Saka is fit, you could miss a big haul. Mbeumo has started every league game."

**Trace tab**
1. Meta line "Whole brief · GW 9 · version 1" (13px muted).
2. Ordered list of steps. Each row: 10px gap, 8×10 padding, 10px radius, 1px `border`.
   - Left: number, Mono 12px muted, 16px wide.
   - Right: title (14px semibold), body (13px secondary).
   - Replan step: 1.5px dashed `primary` border, title prefixed "Replan ·" (design system TraceStep).
   - Data:
     1. Loaded your squad — "15 players, £0.9m in the bank, 1 free transfer."
     2. Found weak spots — "Saka (MID): flagged 75%, form 2.4, hard next 3. Mykolenko (DEF) next; skipped with 1 free transfer."
     3. Searched candidates — "14 midfielders you can afford (up to £10.8m)."
     4. Replan: a rule was broken (dashed) — "Guimarães (NEW) ranked first, but you already own 3 Newcastle players. Removed him and re-ranked."
     5. Ranked — "Mbeumo on top; Semenyo, Kudus, Rogers as alternatives, by expected points over 3 GWs."
     6. Picked a captain — "Using your squad after the transfer: Haaland (C), Mbeumo (V)."
     7. Saved the brief — "Version 1 · 18 Oct, 14:17."

### 4.3 Desktop side panel
- Not a modal: no scrim; the brief stays usable. `role="region"`, `aria-label` "Transfer details".
- In the same row as the cards column, to its right: `flex 1 1 360px`, max width 420px.
- Shell: 1px `border`, 14px radius, 20px padding, 14px gaps.
- Header: "TRANSFER · TOP PICK" + title "Saka → Mbeumo" 19/26. Close 44×44 with 16px X, pulled 8px up/right with negative margins; `aria-label` "Close details". No drag handle.
- Tabs: as mobile, no side padding.
- Why tab: as mobile, but Why items have 4px between label and body.
- Trace tab: as mobile, step padding 10×12.
- The described card shows its selected state (§3.3).

### 4.4 Dismiss
- Drawn: close X.
- Required (design system DetailSheet): Esc closes; scrim tap closes the mobile sheet; swipe down on the handle closes it; focus moves into the surface on open and back to the trigger on close; arrow keys move between tabs.
- Desktop: closing removes the panel and the card's selected highlight.

## 5. States within components

| Component | Loading | Populated | Edge cases |
|---|---|---|---|
| Gameweek header | "Your first brief", "Started just now", New brief hidden | §3.2 | Deadline passed (text + disabled button); cap (disabled button); sample (title "Sample brief", team line "Owner's team · [TEAM NAME]", button hidden) |
| Transfer card | Skeleton (§2.1) | §3.3 | Two transfers (§3.4); Save (§3.5); no flag → omit; selected (desktop) |
| Top-pick block | — | name, meta, chips, bank | Long name wraps |
| Alternatives | — | exactly 3, ranks 2–4 | Long name wraps; price stays right |
| Captain card | Skeleton (§2.1) | §3.6 | Save variant changes vice and alternatives; vice may be the incoming player |
| Trace link card | Hidden while generating | §3.7 | No replans → omit "· N replan" |
| Banner | — | one of 4 messages | One at a time |
| Detail sheet | Not drawn | Why / trace tabs | Captain and Save Why content not drawn |
| New brief button | Hidden while generating | Enabled + "[N] left today" | Disabled + reason (deadline, cap) |

- Truncation: none. Names, reasons and meta wrap (`min-width: 0` on flex children). No ellipsis on names or reasons.
- Missing data (suggested): no flag → omit; unknown form → "Form —"; fewer than 3 valid alternatives → show what exists and label "{n} alternatives" (deviates from D2.1; confirm first).

## 6. Transitions and motion
Wireframes are static. Motion from D14.4 and the design system:
- Cards enter in sequence: opacity 0→1 and an 8px rise; 0.32s `cubic-bezier(.2,.7,.2,1)`; 60ms stagger per card (Motion).
- Numbers (deadline countdown, bank, free transfers): NumberFlow.
- Progress bar: width transition 0.4s ease; shimmer (1.6s linear loop) over the fill while working.
- Mobile sheet: slides up, 240ms ease-out; scrim fades in.
- Desktop panel: slides in from the right.
- Buttons: colour transitions 0.15s; pressed moves down 1px.
- `prefers-reduced-motion: reduce`: no entry animation, shimmer, slide or press movement; numbers update without animating.

## 7. Typography and colour tokens

### Type roles (IBM Plex Sans unless Mono)

| Role | Mobile | Desktop | Weight |
|---|---|---|---|
| Page title (H1) | 26/32, −0.01em | 34/40, −0.015em | 600 |
| Top-pick / Save title | 22/28 | 26/32 | 600 |
| Captain name | 20/26 | 20/26 | 600 |
| Sheet / panel title | 18/24 | 19/26 | 600 |
| Out player name | 16/22 | 17/24 | 600 |
| Vice name | 16/22 | 17/24 | 600 |
| Alternative name | 15/22 | 15/22 | 600 |
| Body / reason | 15/22 | 15/22 | 400 |
| Small body (why-sell, alt reason, captain reason) | 14/20 | 14/20 (why-sell 15/22) | 400 |
| Meta | 13/18, `muted-foreground` | same | 400 |
| Label | 12/16, uppercase, 0.06em, `muted-foreground` | same | 600 |
| Tag | 12/16 | same | 600 |
| Deadline, bank, "You'll have 2 free…" | Mono 13/18 | same | 500 / 400 |
| Alternative prices | Mono 13 | same | 400 |
| Rank numbers, trace numbers, chips | Mono 12–14 | same | 400 (chip number 600) |
| Footer version tag | Mono 12 | same | 400 |

Mono numbers use `font-variant-numeric: tabular-nums`.

### Wireframe grey → token (D14.6, D14.11)

| Wireframe | Used for | Token |
|---|---|---|
| #FFFFFF page | page | `background` |
| #FFFFFF card | cards | `card` |
| #F4F4F4 / #EAEAEA | nested boxes, tags, banner, desktop alt tiles | `secondary` |
| #1A1A1A text | primary text | `foreground` |
| #3D3D3D | team line, free line, rank-row notes, trace body | `foreground` (or `muted-foreground` for long notes) |
| #5C5C5C | labels, meta, footnotes | `muted-foreground` |
| #D4D4D4 | card borders | `border` |
| #E2E2E2 / #EDEDED | dividers, row borders | `border` |
| #8C8C8C | outline buttons, rank circles, drag handle | `input` |
| 2px #1A1A1A: top pick, Save pick, captain tile, selected card | single emphasis per card | `primary` |
| Filled "C" badge | captain | `primary` fill, `primary-foreground` text |
| Selected tab underline | tabs | `primary` |
| Dashed replan border | trace replan | `primary`, dashed |
| Rank row 1 border | weakest player | `foreground` |
| Flag text | Out row | `warning` (text, not colour alone) |
| Chips 2/3/4/5 | difficulty | `fdr-2`, `fdr-3`, `fdr-4`, `fdr-5`; text `destructive-foreground` on 2 and 4, `foreground` on 3, `fdr-5-foreground` on 5 |
| Disabled button | New brief | `muted` fill, `muted-foreground` text, `border` |
| Filled dark buttons | primary actions | `primary` + `primary-foreground` |
| Sheet scrim | mobile sheet | `scrim` |
| Radii 6 / 10 / 12–14 | tags, chips / buttons, nested blocks / cards | `radius-sm` / `radius-md` / `radius-lg` |

## 8. Non-obvious rules

1. **One emphasis per card** (D14.7): only the top-pick / Save / captain block gets the `primary` border. Don't also colour names orange or green; chips inside the block may still be green (D14.8).
2. **Why-sell comes before the Out block** and explains the weak spot (D8.6); the reason line after the top pick explains only the replacement. Don't merge them.
3. **Fixed ordering:** alternatives are ranks 2, 3, 4 (top pick is rank 1); Why-tab rank rows are the squad's three weakest, weakest first; captain → vice → alternatives; transfer card(s) before captain (D4.4).
4. **The trace covers the whole brief**, not just the card that opened the sheet ("Whole brief · GW 9 · version 1" under a "Saka → Mbeumo" title).
5. **Bank lines are cumulative:** with two transfers, card 2 says "Bank after both".
6. **New brief by state:** hidden while generating and on the sample page; disabled with a reason after the deadline or at the cap; enabled during "FPL updating" in the wireframe — consider disabling it there with "FPL is updating" as the reason. "[N] left today" comes from the daily cap (D16.5).
7. **Desktop panel is not a modal:** the page stays interactive; clicking Why? on another card swaps the panel content and moves the highlight.
8. **Sheet and panel bodies must scroll** (the wireframe clips them). Suggested: make the desktop panel `position: sticky` under the header so it stays beside long cards.
9. **Rejected design left in the wireframe source:** the brief files still contain option A — an inline "why" box with a Hide button, and a full-height trace drawer on desktop. D8.7 replaced them. Don't build either.
10. **Sample panel copy:** the wireframe says "paste your FPL team link"; onboarding now leads with country rank (D16.9). Use the copy in §3.10.
11. **Unwired triggers:** captain Why? and Save Why? have no drawn content. Decide their sheet content, or hide them for v0.1.
12. **Account menu** (change team, privacy, sign out) isn't drawn; a simple dropdown is fine. Change team reruns onboarding (US-7.1).
13. **Accessibility:** icon-only buttons need `aria-label`s; badges ("C", "V", the banner "i") are decorative, so add visually hidden text ("Captain", "Vice-captain"); progress card and banners use `role="status"`; all tap targets ≥44px.
14. **All numbers in the wireframes are sample data**, including the ranking metric named in the Why tab. Use the metric the agent actually ranks by.
