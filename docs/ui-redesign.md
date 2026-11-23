# Final Ball — Landing page redesign: handoff spec

**Status:** Design approved 19 Nov 2026. Ready to build.
**Scope:** The landing page (`/`) only. The brief, onboarding, and settings screens come later.
**Build reference:** Design canvas "Final Ball — Landing page redesign": https://claude.ai/artifact/T47UXgk25NDAeYMcjrJRTd
- **Build these:** `A2 · Live brief, louder` (desktop, fluid) and `A2 · Mobile` (390 × 844).
- **Do not build:** A, B, and C. They are explorations. B ("Receipts first") comes back in about 2 weeks, when real receipts exist.

**Name:** The official spelling is **Final Ball**, two words. Use it in the page `<title>`, the OAuth app name, the header wordmark, and all copy.

**Rules that still apply:** decisions.md D14.1–D14.11 (brand), D9.12 (no FPL or Premier League branding), D16.7 ("v0.1, MVP in progress" label), README design-system rules (restyle every shadcn component, no "magic" effect libraries).

---

## 1. Fixes to the current live page

| # | Problem | Fix |
|---|---|---|
| F1 | The sticky header is see-through. The hero text shows behind "Final Ball" when you scroll. | Header background `rgba(24,24,24,0.86)` + `backdrop-filter: blur(12px)` + a 1px `#2C2C2C` bottom border. |
| F2 | The logo and nav sit about 30px inside the content column. | Header and every section use the same container: `max-width: 1200px; margin: 0 auto; padding-inline: 24px` (16px on mobile). |
| F3 | The "Brief preview" is grey skeleton boxes. | Replace it with the Live brief demo (section 4). |
| F4 | The roadmap lists "Refresh" and "Safe / Balanced / Bold" as a toggle. Both were replaced on 3 Nov. | Use the roadmap copy in section 9. |
| F5 | Wrong logo. | Use the X's-and-O's through-ball mark from the logo zip (section 3.1). |

---

## 2. Page structure

### Desktop (A2)
1. **Header** (sticky): logo + wordmark · nav (How it works, Receipts, Roadmap, Sign in) · **news ticker** strip under it.
2. **Hero** (2 columns, stacks under ~980px): faint pitch lines behind it.
   - Left: deadline countdown chip + "v0.1 live" chip → headline → sub copy → 2 CTAs → 3 trust points.
   - Right: **Live brief demo** card, with 2 stacked cards peeking out under it.
3. **How it works**: 3 selectable step cards + one detail panel for the selected step.
4. **Receipts** (badge: "Coming with the full MVP · demo below"): copy + score + demo buttons on the left, receipt list on the right.
5. **Roadmap**: Now / Next cards.
6. **Deadline band**: full-bleed orange (`primary`) section with a large countdown and a dark CTA.
7. **Footer**: non-affiliation line + Privacy link.

### Mobile (A2 · Mobile)
Same order. These parts change:
- Header: logo + "Sign in" only. The ticker stays, 30px tall.
- Hero: one column. Both CTAs are full width. The trust points become one line: "v0.1 live · Free · Read-only".
- Live brief demo: the trace becomes a **progress bar + the latest tool call**. Sell and Buy **stack vertically** with a down arrow. Option tabs **scroll sideways**. "Why?" and "Counter" open a **bottom sheet** (shadcn `Sheet`, `side="bottom"`) with two tabs, Why and Counter. This matches D8.7.
- How it works: an **accordion** (shadcn `Accordion`, single, collapsible).
- **Sticky bottom bar**: deadline countdown + "Get my brief" button. Mobile only (`md:hidden`). Add bottom padding to the page so the bar never covers the footer.
- **No custom cursor.**

---

## 3. Components

Suggested folder: `apps/web/components/landing/`.

| Component | Base | Notes |
|---|---|---|
| `Logo` | inline SVG | Mark + wordmark. Section 3.1. |
| `SiteHeader` | — | Sticky, F1 + F2. |
| `NewsTicker` | — | Section 5.2. Marquee, pauses on hover. |
| `DeadlineCountdown` | NumberFlow | `variant="chip" | "band" | "bar"`. Section 5.1. |
| `PitchLines` | inline SVG | Decorative, `aria-hidden`. Stroke `#262626`, 2px. Halfway line, centre circle, both penalty boxes. |
| `LiveBriefDemo` | — | Section 4. |
| `HowItWorks` | shadcn `Accordion` (mobile) | Desktop: 3 `button` cards, selected card has a `primary` border. |
| `ReceiptsDemo` | NumberFlow | "Fast-forward 3 gameweeks" + "Rewind". Sample data. |
| `Roadmap` | — | Now card: solid `card` bg. Next card: dashed border, no fill. |
| `DeadlineBand` | — | `primary` background, `primary-foreground` text. Dark button (`#181818` bg, `#F7F7F7` text, hover `#2C2C2C`). |
| `StickyCtaBar` | — | Mobile only. |
| `FootballCursor` | — | Desktop only. Section 6. |

### 3.1 Logo
- **Use the real files** from `final-ball-logo.zip` (concept 1, the through ball): the transparent mark for dark backgrounds.
- In the header: the mark at 30px (26px on mobile), then the wordmark in IBM Plex Sans 600, 18px: "Final" in `foreground`, "Ball" in `primary`, with a space.
- The canvas redraws the mark from the concept geometry (viewBox `72 72 380 380` of the 512 tile). If the zip version differs, the zip wins.

---

## 4. Live brief demo (the hero centrepiece)

**Purpose:** show the agent working, not a picture of it.
**Label:** always show "Sample · illustrative data" in the card header. Never present it as advice for the viewer.

### 4.1 Sequence (desktop)
1. On mount, 6 trace rows appear one by one, **750ms apart**:
   `get_squad`, `get_news`, `get_fixtures`, `search_candidates`, `compare`, `check_constraints`.
   - Waiting row: grey outline circle, tool name in `#6B6B6B` (decorative only; the tool name is repeated once done).
   - Active row: dashed `primary` circle + a shimmer bar where the result will be.
   - Done row: `positive` check + the result in `muted-foreground`, fading in.
   - Counter text: "N / 6 tool calls" (mono).
2. While running, the body shows 3 shimmer blocks + "The agent is checking your squad, the news and the fixtures…".
3. After step 6, the transfer card fades in (450ms, 8px rise).
4. **"Replay agent"** restarts the sequence.

### 4.2 Transfer card
- Header: "Transfer 1 of 1" · "£0.4m in the bank · 1 free transfer".
- 3 columns: **Sell** box → arrow → **Pick** box (`primary` 1.5px border: the one emphasis on the card).
  - Sell: name, club · position · price, warning line with icon + "Flagged 75%" (`warning` colour, always icon + text), 3 FixtureChips.
  - Pick: slot label (TOP PICK / ALTERNATIVE) + risk tag badge, name, meta, "Expected **17.8** pts / 3 GWs" (number in mono), 3 FixtureChips.
- One line: "**Why sell Saka?** Flagged 75% with three hard fixtures (4, 4, 5)…" (D8.6).
- **Option tabs** (`role="tablist"`): "Top pick · Palmer", "Safe · Mbeumo", "Bold · Semenyo". Selecting a tab swaps the Pick box and the reasoning.
- Buttons: **Why?** (toggles the reasoning panel; label becomes "Hide reasoning") and **Counter this pick**.
- Counter panel: helper line + 3 quick replies. Each shows one outcome badge + text:
  - "Why not Salah?" → **HOLDS**
  - "He trained today" → **CHANGES FOR A NEW FACT**
  - "Keep him" → **ACCEPTS YOUR PREFERENCE**
- Use the real `TransferCard`, `FixtureChip`, and `TraceStep` components from the design system if they exist in code. The demo should look exactly like the product.

### 4.3 Stacked cards
Two cards peek out under the brief card: 14px and 28px lower, 16px and 32px narrower each side, backgrounds `#262626` and `#202020`. They hint that more cards follow. Decorative, `aria-hidden`.

### 4.4 Data
Put the demo content in one fixture file, for example `apps/web/content/landing-demo.ts`. Keep it illustrative until you switch it to the owner's real sample brief (D16.3). The fixture holds: the 6 trace steps, the sell player, 3 options (slot, tag, name, meta, xP, 3 fixtures with FDR, reason), and 3 counter outcomes.

---

## 5. Live data on the landing page

### 5.1 Deadline countdown
- **Source:** FPL `bootstrap-static` → `events[]` where `is_next === true` → `deadline_time` (ISO, UTC) and `id` (gameweek).
- Read it from Supabase, where the daily GitHub Actions job (D11.7) already stores FPL data. Don't call FPL from the browser.
- **Format:** `1d 21h 14m 07s`; drop the day part when it is 0. Tabular mono numbers.
- **Places:** hero chip ("GW12 DEADLINE" + time, `primary` border), orange band (large, up to 96px), mobile sticky bar.
- **Accessibility:** `role="timer"` with `aria-live="off"`, so screen readers don't announce every second. Add a visually hidden full date, for example "Saturday 21 November, 11:00 UTC". Show it in the visitor's local time.
- **After the deadline, before the next one is set:** show "Next deadline soon" instead of zeros.
- **Hydration:** render the countdown on the client only (or render the static date on the server and start ticking on mount), so server and client HTML match.

### 5.2 News ticker
- **Source:** the "News since this brief" data the daily job already writes (D17.9): injuries, suspensions, availability, plus price changes if stored.
- Show the latest 6–10 items from the last 48 hours: coloured dot + **player** (`foreground`) + short status (`muted-foreground`). Dot colours: `warning` for injury or suspension, `positive` for back to fit, `muted-foreground` for price or transfers.
- Duplicate the list once and animate `translateX(0 → -50%)` over **40s** linear, infinite. Pause on hover.
- **Fallback:** if there are no items, hide the strip. Never show placeholder news.
- Player names only. No club crests, no photos (D9.12).

---

## 6. Football cursor (desktop only)

- **Turn on only when** `matchMedia('(hover: hover) and (pointer: fine)')` matches. Never on phones or tablets.
- **Two layers:**
  1. **CSS fallback** (always on desktop): `cursor: url(/cursor/ball.svg) 16 16, auto` on the page, and `url(/cursor/ball-hover.svg) 16 16, pointer` on links, buttons, and inputs. Always keep the fallback keyword after the URL.
  2. **Animated cursor** (JS): a 32px fixed element that follows the mouse. Add `cursor: none` to the page **only after** this component mounts, so a script failure never hides the cursor.
- **Hover state** (over `a, button, input, label`): the ring turns `primary` (2.5px) and the ball spins 360° every **0.9s**, linear, infinite. Leaving stops the spin.
- **Reduced motion:** no spin. The orange ring still shows.
- **Performance:** move the element with `style.transform` inside the `mousemove` handler (or `requestAnimationFrame`). Do not store the position in React state.
- Hide the element when the mouse leaves the window.

### 6.1 Ball SVG (32 × 32)
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="13" fill="#F7F7F7" stroke="#181818" stroke-width="1.5"/>
  <polygon points="16,10 21.71,14.15 19.53,20.85 12.47,20.85 10.29,14.15" fill="#181818"/>
  <g stroke="#181818" stroke-width="1.4" stroke-linecap="round">
    <line x1="16" y1="10" x2="16" y2="4"/>
    <line x1="21.71" y1="14.15" x2="27.4" y2="12.3"/>
    <line x1="19.53" y1="20.85" x2="23" y2="25.7"/>
    <line x1="12.47" y1="20.85" x2="9" y2="25.7"/>
    <line x1="10.29" y1="14.15" x2="4.6" y2="12.3"/>
  </g>
</svg>
```
`ball-hover.svg` is the same file with the circle stroke `#FF8A1F`, width 2.5. Save both in `apps/web/public/cursor/`.

### 6.2 Component sketch
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export function FootballCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    setOn(true);
    document.documentElement.classList.add('fb-cursor-on'); // CSS: .fb-cursor-on, .fb-cursor-on * { cursor: none !important }
    let hot = false;
    const move = (e: MouseEvent) => {
      const el = ref.current; if (!el) return;
      el.style.transform = `translate(${e.clientX - 16}px, ${e.clientY - 16}px)`;
      const next = !!(e.target as Element)?.closest?.('a, button, input, label');
      if (next !== hot) { hot = next; el.classList.toggle('is-hot', hot); }
    };
    const leave = () => { if (ref.current) ref.current.style.transform = 'translate(-100px, -100px)'; };
    window.addEventListener('mousemove', move, { passive: true });
    document.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      document.removeEventListener('mouseleave', leave);
      document.documentElement.classList.remove('fb-cursor-on');
    };
  }, []);

  if (!on) return null;
  return (
    <div ref={ref} aria-hidden className="fb-cursor pointer-events-none fixed left-0 top-0 z-[9999] size-8" style={{ transform: 'translate(-100px,-100px)' }}>
      {/* inline the ball SVG; give the outer circle className="fb-cursor-ring" and the svg className="fb-cursor-ball" */}
    </div>
  );
}
```
```css
.fb-cursor-ring { stroke: #181818; stroke-width: 1.5; transition: stroke .15s ease; }
.fb-cursor.is-hot .fb-cursor-ring { stroke: var(--primary); stroke-width: 2.5; }
.fb-cursor.is-hot .fb-cursor-ball { animation: fb-spin .9s linear infinite; }
@keyframes fb-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .fb-cursor.is-hot .fb-cursor-ball { animation: none; } }
```

---

## 7. Tokens and new values

Use the design-system tokens everywhere. The canvas uses some raw values that need a home:

| Value | Where | Action |
|---|---|---|
| `#1E1E1E` | Alternate section background (How it works, Roadmap) | **Add token** `background-alt`. Light mode: `#F5F5F5`. |
| `#232323` | Trace strip inside the brief card | Add token `card-inset`, or use `background`. |
| `#202020`, `#262626` | Stacked cards behind the brief | Landing-only. Keep as local constants. |
| `#262626` | Pitch lines | Landing-only constant. Must stay barely visible. |
| `#6B6B6B` | Waiting trace rows, dashed pass line | Decorative only (fails 4.5:1). Never use it for text a user must read. |
| FDR chip fills | FixtureChip | Use the real `fdr-2`…`fdr-5` tokens. The canvas uses approximations. |

Sizes: headline `clamp(52px, 7vw, 92px)`, line-height 0.96, letter-spacing −0.04em, weight 700. Section headings 36px (28px mobile). Body 17–19px. All numbers in IBM Plex Mono, tabular.

---

## 8. Motion

| What | Timing | Reduced motion |
|---|---|---|
| Trace rows | 750ms apart (700ms on mobile) | Show all 6 done at once, card visible |
| Card / panel entrance | 450ms, 8px rise, `cubic-bezier(.2,.7,.2,1)` | No movement |
| Shimmer | 1.2s linear loop | Static grey |
| "v0.1 live" dot | 1.8s opacity pulse | Static |
| Score count-up | NumberFlow, ~90ms per point | Jump to final value |
| News ticker | 40s per loop | Static list, first items visible |
| Mobile bottom sheet | 320ms slide up | No slide |
| Cursor spin | 0.9s per turn | No spin |

Use Motion and NumberFlow (already chosen). No parallax, glow, or floating blobs (D14.4).

---

## 9. Copy

- **Headline:** "We create / the chance. / **You finish it.**" (last line in `primary`)
- **Sub:** "An AI agent for your Fantasy Premier League team. Each gameweek it picks a transfer and a captain, shows every step of how it decided, and later checks whether it was right."
- **CTAs:** "Get started free" (primary, Google icon) · "See this week's sample brief" (ghost, → `/sample`).
- **Trust points:** "Free" · "Read-only: nothing changes in FPL" · "Never asks for your FPL password".
- **How it works heading:** "Three minutes a week. You make the final move."
  - 01 Link your team: "Enter your country rank and team name. No IDs, no passwords."
  - 02 Get your brief: "A top transfer, 3 ranked alternatives, a captain and a vice."
  - 03 See how it decided: "Every pick has a reason and the full trace of tool calls."
- **Receipts heading:** "Every pick gets checked against what happened."
- **Roadmap, Now · v0.1:** Find your team by country rank and team name · Transfer and captain picks with reasons · The full agent trace on every pick · A public sample brief, updated weekly.
- **Roadmap, Next · Full MVP:** Counter a pick, and see who is right when you push back · Safe, Balanced and Bold tags on every option · Chip timing and expiry alerts · Receipts and a 5-gameweek scorecard · A weekly email when your brief is ready.
- **Band:** "GW12 DEADLINE IN" · [countdown] · "Get your brief before it closes." · "Continue with Google" · "Free · Read-only · Never asks for your FPL password".
- **Mobile bar button:** "Get my brief".
- **Footer:** "Final Ball is not affiliated with the Premier League or Fantasy Premier League." · Privacy.

All CTAs lead to the one "Continue with Google" flow (D15.1).

---

## 10. Accessibility

- Every interactive thing is a real `<button>` or `<a href>`. Tabs use `role="tablist"` / `role="tab"` / `aria-selected`.
- Touch targets ≥ 44px on mobile.
- Focus ring: 2px `primary`, 2px offset. On the orange band, use a `#181818` ring.
- Text on `primary` is `primary-foreground` (`#181818`), never white (2.36:1 fails).
- Small `negative` text sits on `background`, not `card` (README contrast table). Receipt rows use `background` for this reason.
- Warnings always carry an icon and a text label.
- Decorative SVGs (pitch lines, stacked cards, cursor) have `aria-hidden="true"`.
- The ticker region has an `aria-label` and pauses on hover. Consider a pause button if you keep it after launch.

---

## 11. Done when

- [ ] F1–F5 fixed.
- [ ] Desktop matches A2 at 1440px and still works at 1024px and 768px.
- [ ] Mobile matches A2 · Mobile at 390px; no sideways scroll at 360px.
- [ ] The countdown shows the real next deadline from Supabase, in local time, and handles "no next deadline".
- [ ] The ticker shows real news or is hidden.
- [ ] The demo runs, replays, switches options, opens Why and Counter (bottom sheet on mobile).
- [ ] The cursor appears only on desktop, spins over links and buttons, and stops for reduced motion.
- [ ] With reduced motion on, nothing moves and everything is still visible.
- [ ] Lighthouse accessibility ≥ 95; no layout shift from the countdown or the cursor.
- [ ] Page title and OAuth app name both say "Final Ball".

## 12. Later
- Swap the demo fixture for the owner's real sample brief.
- Bring back direction B (the scorecard and push-back meter) when receipts settle, in about 2 weeks.
- New OG image using the A2 hero.
