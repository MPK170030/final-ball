# GuidePanel

A side panel of picture steps showing where to find a value in the FPL app, opened from a Field's (i) button on mobile.

## Behaviour
- Slides in from the right, 340px wide, over a `scrim`; a strip of the form stays visible behind it.
- Header: small label ("In the FPL app" or "On the FPL website") and the question as the title. Close button top right; "Got it" at the bottom. Both return focus to the (i) button.
- 2–3 steps, each a phone sketch beside one sentence with the key word in bold. The highlighted area in the sketch uses `primary`.
- The link guide adds "On a phone" / "On a computer" tabs and an "Open FPL in a new tab" button.

## Rules
- The phone sketches are placeholders: replace them with annotated screenshots of the current FPL app before launch, and confirm the tab names ("Leagues", "Points", "Pick Team").
- Desktop doesn't use this panel; the guide sits beside the form.

## shadcn
`Sheet side="right"`.
