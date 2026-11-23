# Final Ball — Brief and Record redesign: handoff spec

**Status:** Design approved 20 Nov 2026. Ready to build.
**Scope:** `/brief` (the "This week" view and the new "Record" view). `/sample` and `/demo` reuse the same components, without Counter (US-8.5).
**Build reference:** Design canvas, **Brief** page: https://claude.ai/artifact/T47UXgk25NDAeYMcjrJRTd
- `Brief · Desktop` and `Brief · Mobile`: the full prototype. Tweaks: `record` = populated / early, `shirts` = club / neutral.
- `Record · Today (desktop / mobile)`: the Record view with today's real data (one pending receipt).
**Decisions:** `decisions.md` section 18 (D18.1–D18.9). Read it first; it replaces D4.5, D8.2, D17.8 and settles D17.12.
**Rules that still apply:** D14.x brand rules, D9.12 (no crests or Premier League marks), the design-system README (restyle every shadcn component, tokens only).

Sample data on the canvas (players, xP, receipts) is illustrative. Every number in the build comes from the agent output or the database.

---

## 1. Page structure: "This week"

### Desktop (≥ 1024px)
Two columns inside the 1200px container: **main** (flex 1, min 620px) and **detail panel** (340–420px, `position: sticky; top: 150px`).

1. **App header** (sticky): logo + wordmark · segmented nav **This week | Record** · "Last 5 GWs [value]" chip (opens Record) · account avatar menu.
2. **Status strip** (full width, `background-alt`): "GW11 brief" · team name · Deadline countdown (`primary`, mono) · Free transfers · Bank · Counters "1 / 10 left" · "Generated [time]" · **Refresh brief** button.
3. **News banner** (D17.9), only when there is news: warning icon + "News since this brief:" + text + a "Re-check [card]" button + dismiss.
4. **Your moves** snapshot: the page's one `primary` border. 4 tiles in FPL order: Transfer, Captain, Lineup, Chip. Each tile: number, label, main line (18px, 600), sub line. A tile scrolls to its section and rings it (section 6).
5. **Pitch view** (section 3).
6. **Transfer** section (section 4).
7. **Captain** section (section 5).
8. **Chips** line: dashed border, one sentence ("Save them this week. 3 available · first set expires GW19."). Full chip card only in weeks the agent recommends a chip (D5.1).
9. **Next week** line: one sentence, muted (D3.2).

### Mobile (< 768px)
Single column, 16px gutters. Changes from desktop:
- Header: logo + avatar; the This week | Record nav sits under it, full width.
- Status strip: title + team + an icon-only Refresh button (44px, `aria-label="Refresh brief"`); the figures become a sideways-scrolling row of small tiles (deadline tile has the `primary` border).
- Snapshot: a 4-row list (label · main · sub · chevron).
- Sell and Pick sit side by side as compact tiles with shirts; alternatives are rows (name · tag · xP · +); fixtures and reasons show when a row opens.
- Counter and Trace buttons are full-width pairs under each section.
- The detail panel is a **bottom sheet** (shadcn `Sheet side="bottom"`, max 80% height, drag handle, scrim closes it).
- No sticky mini-bar.

---

## 2. Data the UI needs (agent and API contract)

Add these to the brief payload if they are missing:

| Field | Used by | Notes |
|---|---|---|
| `xi_before[]`, `xi_after[]` | Pitch view | 11 players each: id, name, club short code, position, **GW projection**, is_gk. "After" = after the top-pick transfer and the lineup advice. |
| `bench_before[]`, `bench_after[]` | Pitch view | Ordered for auto-sub; the GK last. |
| `changes` | Pitch legend, snapshot | Players in, players benched, the player sold, the new signing. |
| `options[].gw_xp` | Preview | **Current-GW projection for the top pick and every alternative** (D18.6). Today only the 3-GW total exists. |
| `options[].xp3`, `tag`, `price`, `fixtures[3]`, `reason`, `bank_after` | Transfer section | `reason` is one or two sentences. |
| `weak_spots[3]` | "Weakest 3" bars | name + 3-GW xP, weakest first (D8.6). |
| `captain`, `vice`, `captain_alts[]` | Captain section | Each with gw_xp, fixture, tag, one-line reason. |
| `trace[]` | Trace tab | tool, short result, order. |
| `news[]` | Banner | player, status text, affected card. |
| `generated_at`, `refresh_count` | Status strip | For "Generated [time]" and the refresh cap. |

**Captain rule on the client (preview only):** C = the highest `gw_xp` in the XI excluding goalkeepers; V = the second highest. With no preview, show the agent's own captain and vice.

**Kits:** a static `apps/web/content/kits.ts`: club short code → `{ body, sleeve, stripe, gk: { body } }`. Colours only. Update it each season. No crests, badges or sponsor marks.

---

## 3. Pitch view

- Section title "YOUR XI · [formation]" + Counter / Trace buttons (desktop, in the header row; mobile, under the bench).
- **Tabs** "Now" | "After the brief" (`role="tablist"`) + **"Projected GW11 [total]"** (mono, tabular) + the green delta ("+9.3") when After is showing.
- **Legend** in words, above the pitch: e.g. "↑ In: Branthwaite, Iwobi · New signing: Wirtz" and "↓ Benched: Kostoulas, Manzambi". Colour is never the only signal.
- **Pitch:** `background-alt`, 1px border, faint pitch lines (`#2C2C2C`): the top penalty box and the half-way arc. GK at the top, then DEF, MID, FWD.
- **Player tile** (116px desktop / 78px mobile): shirt SVG (44px / 32px), name (600, ellipsis), club · GW xP (mono), optional status label. C badge (`primary` fill) and V badge (outlined) on the top-right corner.
  - Now: red ring + "→ SELL" (the player sold) or "↓ TO BENCH".
  - After: green ring + "↑ IN" or "NEW SIGNING"; a previewed option gets a **dashed grey ring + "PREVIEW"**.
- **Bench** row under the pitch: "BENCH · AUTO-SUB ORDER", numbered tiles; in After, benched players get "↓ BENCHED".
- **Hint** under the pitch: "Swipe the pitch to compare" (mobile) / "Drag the pitch sideways or use the tabs to compare" (desktop).
- **Shirt SVG** (viewBox 40×40): body path `M13 5 L17 3.5 Q20 7 23 3.5 L27 5 L36 11 L32 17 L29 15 L29 36 L11 36 L11 15 L8 17 L4 11 Z`, two 3px stripe rects at x 15 and 22 (fill = stripe colour; equal to body for plain shirts), two sleeve paths, all with a 1px `#6B6B6B` outline so dark shirts show on the dark pitch.
- **Neutral option:** a user setting or env flag swaps all shirts to `#4A4A4A` (GK `#8A8A8A`).

---

## 4. Transfer section

- Header: "TRANSFER · WEAK SPOT: [POS]" + "Counter this pick" + "Trace".
- **Sell tile** → arrow → **Pick tile**. Pick tile: `primary` 1.5px border, slot label "TOP PICK", risk tag, name (20px), meta + **3-GW xP** (mono), 3 FixtureChips (with `title` tooltips: "MUN, home · difficulty 3 of 5").
- **Inline reasoning**, two columns on desktop (stacked on mobile):
  - "Why sell [X]?" + one or two sentences + the **Weakest 3** bar list (the sold player's bar in `warning`; bars grow in).
  - "Why [pick]?" + the pick's reason.
- **Alternatives:** "3 ALTERNATIVES" + folded rows: number, name + meta, tag, xP, fixtures, +/−. Opening a row **previews** it (section 6). Opening it again, or "Back to top pick", ends the preview.
- **While previewing:** the pick tile border turns dashed grey, its label reads "PREVIEWING", and it shows the xP difference in `negative` ("−2.0 xP vs Wirtz"). A dashed note under the tiles: "Previewing [name]. Bank after: [£]. The agent's pick is still [top pick]." + "Back to top pick".

## 5. Captain section

- Header "CAPTAIN" + Counter + Trace.
- **C tile** (`primary` border, filled C circle) and **V tile** (outlined V circle): name, fixture, tag, GW xP (mono), and the one-line reason **inline**.
- **Alternative** (Tavernier etc.): one folded row (name · tag · xP · +); the reason shows when open.
- **Preview note** (dashed, above the tiles) when a transfer preview is active: "Updated for the [name] preview: [player] is now vice." or "No change with [name]: [C] and [V] stay."

## 6. Interactions and motion

| Interaction | Behaviour | Timing | Reduced motion |
|---|---|---|---|
| Page load | Snapshot tiles enter one by one; sections fade up | 70ms stagger, 450ms, `cubic-bezier(.2,.7,.2,1)` | No movement |
| Pitch on load | Opens on **Now**, then switches to **After the brief** | switch at 1.1s | Opens on After |
| Pitch change (tabs, swipe, preview) | Changed tiles flip in (`perspective(400px) rotateY(90deg)` → none); unchanged tiles fade; total counts to the new value; C badge pops | 600ms flip, 40ms stagger; count ~45ms steps | Instant |
| Swipe | Pointer events on the pitch; horizontal drag > 40px and wider than tall. Left → After, right → Now. `touch-action: pan-y` keeps vertical scroll | — | Same, no flip |
| Snapshot tile click | Smooth-scroll to the section (`scroll-margin-top` clears the sticky header), then an orange ring pulse | 1.2s pulse | Scroll without smooth; no pulse |
| Preview an alternative | Pick tile, reason, pitch (MID slot flips), total, C/V and the snapshot tiles update together | as pitch | Instant |
| Counter sent | The panel shows "The agent is re-checking…" with 3 steps (get_news → get_fixtures → compare), each dot filling in, then the outcome badge + text | the real counter stream; on the prototype 650ms per step | Steps shown as a list, no animation |
| Refresh | Sections are replaced by 3 skeleton blocks + "Rebuilding your brief with the latest news…" (`role="status"`); then the sections enter again, "Generated" updates, and the pitch replays Now → After | real duration | Static skeleton |
| News banner | Slides down after load | 450ms | No movement |
| Weakest-3 bars | Grow from the left | 700ms, 120ms stagger | Static |

Use Motion for entry and flips, NumberFlow for every changing number. Move nothing that doesn't explain a change (D14.4).

## 7. Detail panel (Counter and Trace)

- Opens from any section's Counter or Trace button; the panel title shows the card ("TRANSFER", "CAPTAIN", "LINEUP"); the selected section gets a lighter border on desktop.
- **Counter tab:** helper line + "1 of 10 left this GW" · quick replies for the card (examples: transfer "Why not [player]?", "[sold] trained today", "Keep [sold]"; captain "Why not [player]?", "[C] is a doubt", "I want [V]"; lineup "Why bench [player]?", "[bench 1] is injured", "Keep my XI") · a textarea (200 characters, counter shown) + "Send counter" · the re-check steps · the outcome: badge **HOLDS** / **CHANGES FOR A NEW FACT** / **ACCEPTS YOUR PREFERENCE** + text (D17.5).
- **Trace tab:** numbered tool calls with short results (D8.4).
- Counter is hidden on `/sample` and `/demo`.

## 8. Refresh (D18.1)

- Button in the status strip ("Refresh brief"; icon-only on mobile).
- **Confirm before building:** receipts score the latest brief before the deadline; cap 3 per gameweek; failed or timed-out refreshes don't count. When the cap is reached, the button is disabled with the text "3 of 3 refreshes used this GW".
- Refresh doesn't spend counters.

---

## 9. Record view (D18.8)

Opened from the header nav or the "Last 5 GWs" chip.

### 9.1 Layout
1. Title "Your record" + "Every move gets a receipt 3 gameweeks later. Good weeks and bad stay on it."
2. **Early-state block** (only when no transfer receipt has settled): dashed banner "Your first receipt settles after GW[n]. Until then, this page fills in as gameweeks are played." + a 3-step timeline: **Done · GW[x]** (first move recorded) → **After GW[n]** (first receipt settles) → **After 5 settled moves** (full scorecard and risk-tag breakdown).
3. **Scorecard tiles** (3 columns desktop, stacked mobile):
   - Transfer impact, last 5 settled moves (`positive`, 44px mono, counts up) + "If you'd followed every pick: [value]". Early: "pending" in the `pending` colour.
   - Followed the agent "[n] / [m]" (transfers, saves and captains).
   - "When you push back, who's right?": split bar Agent [n] (`foreground` fill) · You [n] (`#5E5E5E` fill) + "[n] settled counters". Early: "No counters yet · Scored once a countered pick settles".
4. **Transfer result by gameweek** chart: one bar per gameweek; green up, red down, grey zero, **dashed outline = pending**; value above or below; "NEW" under the latest settled week. Bars are buttons: a click filters the receipts to that week (`aria-pressed`); a second click or "Show all" clears it. Below: **By risk tag of the pick you made** bars (D2.5); hidden until there is data.
5. **Receipts:** filter pills All / Transfers / Captain / Chips. Each receipt card (on `background`, so small `negative` text passes contrast):
   - Meta row: GW · type · label (FOLLOWED / YOUR OWN MOVE / IGNORED, ROLLED / IGNORED, TRANSFERRED / FOLLOWED · SAVED) · risk tag · "JUST SETTLED" on the newest one.
   - One plain sentence with both players' points (D7.7) + an optional agent line ("Agent's pick, Mbeumo, scored +7").
   - Right side: the signed result (20px mono, coloured) **or** "Pending" + 3 progress dots (gameweeks played) + window "GW10–GW12" **or** "Not scored · counts as followed" (saves).
   - Transfer receipts: "+ Why did you make this move?" opens an inline one-line input (140 characters) with Save / Cancel; a saved note shows in quotes with "Edit" (D7.10).
6. Linked funding receipts (D7.9) use the same card with "Waiting to see what it funds (until GW[x])"; not drawn on the canvas.

### 9.2 Motion
Tiles enter staggered (80ms); impact and "if you'd followed" count up on open; bars grow (70ms stagger); the newest settled receipt enters with a 900ms "settle" (slight drop, green border fading to the normal border). All off with reduced motion.

### 9.3 Data
Receipts and counter records already exist (D7.11, D17.6). Add: the "if you'd followed every pick" total (the agent's top pick result for every settled week), the per-gameweek totals for the chart, and the settled-counter split.

---

## 10. Accessibility

- Real buttons and links everywhere; tabs use `role="tablist"` / `aria-selected`; filter and bar buttons use `aria-pressed`.
- Each pitch tile has `role="img"` + an `aria-label` ("Wirtz, LIV, 7.0 expected points, new signing").
- Countdown: `role="timer"` + `aria-live="off"`. Count-ups and re-check steps: `aria-live="polite"`.
- Touch targets ≥ 44px on mobile; focus ring 2px `primary`, 2px offset.
- Status uses text + icon + colour: "↑ IN", "↓ BENCHED", "PREVIEW", "Pending".
- Small `negative` text only on `background`. The `#6B6B6B` grey is decorative only.

## 11. Build passes

| Pass | Scope |
|---|---|
| 1 | Header with This week / Record nav, status strip with Refresh, snapshot, new section order, inline reasoning, folded alternatives, chips and next-week lines, detail panel with Counter + Trace only, remove the old legend line and "How the agent decided" card |
| 2 | Pitch view: kits file, shirts, tiles, Now / After tabs, legend, bench, projected total |
| 3 | Preview (needs `gw_xp` per option) updating the pick, pitch, captain/vice and snapshot; captain preview note |
| 4 | Motion: entry stagger, pitch flip, count-ups, swipe, section pulse, counter re-check steps, refresh skeleton, reduced-motion paths |
| 5 | Record view: early state first (it is the real state today), then the populated layout, filters, bar filter, journal notes |

## 12. Done when

- [ ] The brief order matches D18.3 on desktop and mobile.
- [ ] Nothing is shown as a full paragraph by default except the inline transfer and captain reasons.
- [ ] Now / After works by tab and by swipe; totals are correct; reduced motion shows the After state with no movement.
- [ ] Previewing any alternative updates the pick tile, reason, pitch, captain/vice note and snapshot, and "Back to top pick" restores everything. The receipt still uses the original pick.
- [ ] Counter shows the re-check steps and one of the 3 outcomes; the cap counter updates.
- [ ] Refresh shows the skeleton, updates "Generated", and respects the cap.
- [ ] Record early state matches today's data (one pending GW9 receipt, followed 0 / 1) with no dashes.
- [ ] No crests, badges or sponsor marks anywhere.
- [ ] Lighthouse accessibility ≥ 95 on `/brief` desktop and mobile.

## 13. Prompt for the local agent

```
Read docs/brief-redesign.md (all of it, especially section 14 "Visual spec") and docs/decisions.md section 18.
The design reference is docs/design/brief/BriefDesktop.dc.html, BriefMobile.dc.html, RecordTodayDesktop.dc.html and RecordTodayMobile.dc.html. They are prototype files from the design canvas; don't run them. Read their markup and inline styles: every size, colour, radius, spacing and font weight in them is the target. Where the spec and the reference files disagree, the reference files win.
Task: Pass 1 of the brief redesign, on /brief only. Reuse existing components for data and logic, but restyle them to match section 14 and the reference markup. Don't keep the old card styles.
Before editing: list the components you will change or create, the payload fields that are missing (section 2), and any conflict between the spec and the code. Wait for my OK.
After building: tick the section 12 items that apply to pass 1, then compare each section against section 14 element by element and list any value you didn't match.
```

---

## 14. Visual spec (match this exactly)

The reference markup is in `docs/design/brief/*.dc.html` (exported from the canvas). The inline styles there are the source of truth for every size, colour and spacing below. Tokens: `background` #181818, `card` #2C2C2C, `secondary` #383838, `border` #424242, `foreground` #F7F7F7, `muted-foreground` #A3A3A3, `primary` #FF8A1F, `positive` #4CAF7A, `negative` #E5534B, `pending` #8A93A6, `warning` #F26A3D. Add `background-alt` #1E1E1E and `card-inset` #232323 (also in `ui-redesign.md` section 7). Body text #D6D6D6 for inline reasoning paragraphs.

**Type:** IBM Plex Sans; every number in IBM Plex Mono, tabular. **Kicker** (section titles such as "TRANSFER · WEAK SPOT: MID"): mono, 12px, 600, `tracking-[0.08em]`, uppercase, muted.

### Layout
| Element | Spec |
|---|---|
| Container | `max-w-[1200px] mx-auto px-6` (mobile `px-4`) |
| Main column gap | 20px desktop, 14px mobile |
| Main / panel | flex-wrap; main `flex: 999 1 620px`; panel `flex: 1 1 340px; max-width: 420px` |
| Section card | `bg-card border border-border rounded-[14px] p-6 flex flex-col gap-4` (mobile `p-3.5 gap-2.5`) |
| Inner tile | `bg-background border border-[#383838] rounded-[10px] p-3.5` |
| Folded row | `bg-card-inset rounded-[10px] min-h-12 px-3`; open/previewed row `bg-[#2F2F2F] outline outline-1 outline-[#6B6B6B]` |

### Header and status strip
| Element | Spec |
|---|---|
| App header | sticky, `h-16`, `bg-[rgba(24,24,24,0.9)] backdrop-blur-[12px] border-b border-[#2C2C2C]`; logo mark 30px + wordmark 18px 600 ("Ball" in `primary`) |
| Nav (This week / Record) | wrapper `bg-card-inset p-1 rounded-[10px] gap-1`; tab `h-10 px-3.5 rounded-[6px] text-sm font-medium`; active `bg-secondary text-foreground`, inactive `text-muted-foreground` |
| "Last 5 GWs" chip | `h-9 px-3 rounded-full border border-border text-[13px]`, value in mono muted |
| Status strip | full-width `bg-background-alt border-b border-[#2C2C2C] py-[18px]`; title "GW11 brief" 28px 700 `tracking-[-0.02em]`; team 15px 500; `dl` items 13px, `dt` muted, `dd` mono; deadline `text-primary font-semibold` |
| Refresh | ghost button `h-9 px-3 rounded-[6px] border border-border text-[13px]` + 14px refresh icon; "Generated …" 12px muted beside it |

### This week
| Element | Spec |
|---|---|
| News banner | `border border-warning rounded-[10px] px-4 py-3 bg-background`; warning icon 18px; text 14px; "News since this brief:" 600 in `warning`; ghost button + 36px dismiss "×" |
| Your moves | the only `primary`-bordered card: `border-[1.5px] border-primary rounded-[14px] px-6 py-[22px]`; title 20px 600; caption 13px muted; tiles `grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5` |
| Move tile | `bg-background rounded-[10px] p-3.5 flex flex-col gap-1.5`; label row mono 11px `tracking-[0.06em]` muted with an 18px outlined number circle; main 18px 600 `tracking-[-0.01em]`; sub 12px muted; hover `bg-[#333]` |
| Ghost buttons | `h-9`/`h-10 px-3`/`px-3.5 rounded-[6px] border border-border text-[13px]`/`text-sm`; hover `border-muted-foreground` |
| Sell / Pick tiles | grid `1fr auto 1fr gap-3.5`; tile = inner tile with `flex items-center gap-3.5`; shirt 36px; label mono 11px; name 20px 600; meta 13px muted with xP in mono (pick: foreground 600). Pick tile `border-[1.5px] border-primary`; previewing `border-dashed border-[#A3A3A3]` |
| Risk tag pill | `h-5 px-1.5 border border-[#6B6B6B] rounded-[6px] text-[11px]` + `title` tooltip |
| Fixture chip | `min-h-[22px] px-1.5 rounded-[6px] font-mono text-[11px] text-white` on the `fdr-*` fill |
| Reasoning | 2 columns `grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4`; h3 16px 600; p 14px `leading-[1.6] text-[#D6D6D6]` |
| Weakest 3 | `bg-background rounded-[10px] p-3`; caption 12px muted; rows `grid-cols-[76px_1fr_34px] gap-2.5 text-[13px]`; bar `h-2 rounded` on `bg-card`, sold player `warning`, others `#5E5E5E` |
| Alternative row | `grid-cols-[22px_1fr_auto_auto_auto_20px] gap-3`; number mono 12px muted; name 15px 500 + meta 12px muted; xP mono 14px; +/− 18px muted; reason `pl-[46px] pb-3.5 text-sm leading-[1.55] text-muted-foreground` |
| Captain tiles | grid `minmax(240px,1fr)` gap-3; C tile `border-[1.5px] border-primary`; C circle 32px `bg-primary text-[#181818] font-bold`; V circle 32px `border-[1.5px] border-foreground`; name 17px 600; fixture 12px muted; xP mono 17px 600; reason 14px `leading-[1.55] text-[#D6D6D6]` |
| Preview note | `text-[13px] px-3 py-2 rounded-lg border border-dashed border-[#6B6B6B]` |
| Chips line | `border border-dashed border-border rounded-[14px] px-5 py-4`; kicker + 15px sentence (second half muted) |
| Next week line | 14px muted; "NEXT WEEK ·" mono 12px |

### Pitch view (pass 2)
| Element | Spec |
|---|---|
| Now / After tabs | wrapper `bg-background p-1 rounded-[10px]`; tab `h-[34px] px-3 rounded-[6px] text-[13px] font-medium`; active `bg-foreground text-background`, inactive muted |
| Projected total | label 12px muted; value mono 20px 600 tabular; delta mono 13px 600 `positive` |
| Legend | 12px muted; 12px swatch `rounded-[3px] border-[1.5px]` in the status colour |
| Pitch | `bg-background-alt border border-[#383838] rounded-xl px-3 py-5` (mobile `px-0.5 py-3.5`); lines `#2C2C2C` 1.5px; rows `gap-3.5` (mobile 10px), tiles centred `gap-3` (mobile 4px) |
| Player tile | `w-[116px]` (mobile 78px) `rounded-[10px] bg-[rgba(24,24,24,0.85)] pt-2 px-1.5 pb-1.5 border-[1.5px]` (transparent / status colour; preview dashed `#A3A3A3`); shirt 44px (mobile 32px); name 13px (mobile 11px) 600 ellipsis; club · xP 11px; status 10px 600 `tracking-[0.04em]` |
| C / V badge | 20px circle `absolute top-1 right-1.5`, 11px 700; C `bg-primary text-[#181818]`; V `bg-background border-[1.5px] border-foreground` |
| Bench | kicker "BENCH · AUTO-SUB ORDER" mono 11px; same tiles with the order number in mono muted before the name |

### Detail panel
| Element | Spec |
|---|---|
| Panel | `sticky top-[150px] bg-card border border-border rounded-[14px] p-[18px] flex flex-col gap-4 max-h-[calc(100vh-180px)] overflow-y-auto` |
| Tabs | wrapper `bg-background p-1 rounded-[10px]`; tab `flex-1 h-10 rounded-[6px] text-sm font-medium`; active `bg-foreground text-background` |
| Quick replies | `h-9 px-3 rounded-full bg-background border border-border text-[13px]` (mobile `h-11 text-sm`) |
| Textarea | `bg-background border border-border rounded-[10px] p-2.5 text-sm`, 3 rows; counter mono 11px muted; "Send counter" `h-9 px-3.5 rounded-[6px] bg-foreground text-background font-semibold text-[13px]` |
| Re-check / outcome | `bg-background rounded-[10px] p-3`; step dots 10px; badge mono 11px `tracking-[0.06em] px-2 py-0.5 rounded-[6px] bg-secondary`; text 14px `leading-[1.5]` |
| Mobile sheet | `bg-card border-t border-border rounded-t-[14px] px-4 pt-2 pb-7 max-h-[80%]`; handle 36×4 `bg-[#6B6B6B] rounded`; scrim `rgba(0,0,0,0.6)` |

### Record
| Element | Spec |
|---|---|
| Title | 36px (mobile 28px) `tracking-[-0.02em]`; intro 16px muted |
| Early banner | `border border-dashed border-[#6B6B6B] rounded-[14px] p-4` + 3 progress dots 10px `pending`; timeline cards `bg-card border rounded-xl p-3.5`, label mono 11px (done `positive`), text 14px; the last card dashed |
| Score tiles | section card with `p-5`; label 13px muted; value mono 44px 600 `tracking-[-0.03em] leading-none` (impact `positive`, pending `pending`); footnote 12px muted |
| Push-back bar | `h-10 rounded-[10px] overflow-hidden gap-0.5`; Agent `bg-foreground text-background`, You `bg-[#5E5E5E] text-white`; mono 13px 600 |
| Chart | section card; columns `minmax(80px,1fr)` (mobile 52px), 230px high; bars `w-[70%] max-w-[44px] rounded-[6px]`, up to 90px; pending = 26px dashed `#6B6B6B` outline; zero line `#6B6B6B`; values mono 12px; GW label mono 11px muted; selected bar `outline-2 outline-foreground outline-offset-2` |
| Filter pills | `h-9 px-3 rounded-full text-[13px]`; active `bg-foreground text-background`, inactive `border border-border` |
| Receipt card | `bg-background border border-border rounded-xl px-[18px] py-4 flex flex-col gap-2.5`; meta row mono 11px (label pill `bg-card px-1.5 rounded-[6px]`); line 16px 500; agent line 12px muted; result mono 20px 600 coloured; pending mono 13px `pending` + 8px dots + window 11px muted; note area `border-t border-card pt-2`, link 13px muted underlined |
