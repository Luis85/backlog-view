---
type: Issue
order: 40
parent: "[[Children on the card]]"
status: Done
priority: P2
area: styling
created: 2026-08-08
closed: 2026-08-08
source: Pre-merge review of the card children expansion increment, task-13; fixed in task-15
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

## Outcome

All four confirmed affected, exactly as the audit predicted — none turned out to be
already safe once measured. Each got its own decision, not a shared restyle:

- **`.pbl-state-chip` / `.pbl-horizon-chip`** (`styles/columns.css`) — the base rule
  already declared the chip look (a bordered pill on `--background-secondary`), so the
  fix is `button.pbl-state-chip, button.pbl-horizon-chip { background-color: …;
  box-shadow: none; }`, element-qualified to tie Obsidian's `(0,1,1)` and win on source
  order — the `cardChildren.css` precedent. The `:not(.pbl-state-static):hover` rule was
  already at `(0,3,0)` and needed nothing; `.pbl-state-static` is a `<div>` (a context
  row) that none of Obsidian's `button…` rules can ever touch, so the shared base rule
  stayed untouched for it.
- **`.pbl-tag-remove`** (`styles/tags.css`) — meant to be invisible until hovered, so the
  same button-qualified override restates `background-color: transparent` and
  `box-shadow: none`; the opacity reveal and its transition were untouched.
- **`.pbl-card-match`** (`styles/cards.css`) — its own `background-color` /
  `box-shadow: none` needed the same override, and its open `justify-content` question
  had a simpler answer than expected: the control has no icon, just one text node, so
  `display: inline-block` (a bare class beats Obsidian's bare `button { display:
  inline-flex }` with no qualification needed) removes the flex axis Obsidian was
  centering the text against entirely, rather than fighting it with an explicit
  `justify-content: flex-start`.

Each also needed a `:focus-visible` rule it did not have before: the base override's
`box-shadow: none` ties Obsidian's own `button:focus-visible` ring at the same `(0,1,1)`
and wins on source order, so without an explicit indicator focus would have gone
invisible rather than merely losing its fill. All four now carry the outline
`cardChildren.css` already used (`1px solid var(--interactive-accent)`).

Verified in the harness against the real vendored `app.css`, the same two ways as the
disclosure: specificity computed by hand, and Chromium via Playwright reading computed
`background-color` / `box-shadow` / focus outline before and after, at rest and on
hover, for all four — see `.superpowers/sdd/2026-08-07-card-children-expansion/task-15-report.md`.
**Not verified in a live vault** — see
[[Smoke test the four button-specificity fixes in a live vault]], opened for that.
