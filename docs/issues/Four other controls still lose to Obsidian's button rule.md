---
type: Issue
order: 40
parent: "[[Children on the card]]"
status: Open
priority: P2
area: styling
created: 2026-08-08
source: Pre-merge review of the card children expansion increment, task-13
files:
  - styles/columns.css
  - styles/tags.css
  - styles/cards.css
---

# Four other controls still lose to Obsidian's button rule

## The limitation

[[Obsidian's button rule outranks the plugin's chrome-stripping]] fixed the card-children
disclosure but named four more controls carrying the identical defect, left unfixed on
purpose: `.pbl-state-chip` and `.pbl-horizon-chip` (`styles/columns.css`),
`.pbl-tag-remove` (`styles/tags.css`) and `.pbl-card-match` (`styles/cards.css`) are all
real `<button>`s carrying none of `.clickable-icon`, styled with the same bare-class
selectors the disclosure used — `(0,1,0)` — against Obsidian's own
`button:not(.clickable-icon)` at `(0,1,1)`, which wins regardless of source order. In a
live vault each one still paints Obsidian's filled, boxed button chrome underneath
whatever the plugin's own rule asked for.

Verified so far only in the harness, against the real vendored `app.css`
(`test/harness/obsidian.css`) loaded before the plugin's own sheet — **not** in a live
vault.

## Why it is deliberate

The card-children disclosure wanted no button look at all, so qualifying its selectors
with the element (`button.pbl-card-kids-toggle`) was the whole fix. The four controls
here do not share one answer: `.pbl-state-chip` and `.pbl-horizon-chip` deliberately
paint a chip background, so "make it transparent" is the wrong fix; `.pbl-card-match`
has its own `justify-content` question the disclosure's fix never had to answer; and
`.pbl-tag-remove` has not been looked at closely enough yet to know whether it is the
same shape or a different one again. Folding four separate visual decisions into the
disclosure's own fix would have been a repo-wide restyle nobody reviewed.

## What would lift it

Each control needs its own decision about what it should look like once fixed, then
whatever selector change makes the plugin's rule win on specificity rather than on
source order — the disclosure's `button.pbl-…` qualification, or something else if a
control's own answer needs it. One control at a time, each verified the same two ways
the disclosure was: specificity computed by hand against the selectors involved, and the
harness with the real `app.css` loaded before the plugin's own sheet.

## Impact

Four real `<button>`s can show Obsidian's default chrome instead of the plugin's own in
a live vault: a state or horizon chip that should read as a coloured pill, a tag's
remove control, and a card's match link. Nothing is unusable — the controls still work —
but none of the four is guaranteed to look like the plugin's own design intends until
each is checked and, if it reproduces there too, fixed.
