# Field

A labelled input with an optional (i) button that opens a picture guide, a hint, and an error line.

## Parts
- **Label row:** label plus, where the user may not know where to find the value, an **(i)** button (`fb-info`) right after the label. On mobile it opens the GuidePanel; it needs an `aria-label` like "Where to find your country rank". The visible circle is 22px; the tap target is 44px.
- **Input:** 48px tall. Numbers (ranks, IDs) use `fb-input--num` (mono, tabular). Fields sit on `background` with an `input` border (stronger than `border` so they pass 3:1).
- **Hint:** one line in `muted-foreground`, always visible; it is not the error.
- **Error:** replaces nothing; it adds a line in `negative` under the hint area and turns the border `negative`. Says what to do, not just what's wrong.

## Used in
Find your team (country, rank, team name), Use your FPL link (team link or ID).

## shadcn
`Label` + `Input` + `Select`, wrapped in your own `Field`. The (i) is a ghost `Button` opening a `Sheet side="right"`.
