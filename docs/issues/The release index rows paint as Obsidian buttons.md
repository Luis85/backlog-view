---
type: Issue
order: 290
parent: "[[Codebase health]]"
status: Done
priority: P2
area: styling
created: 2026-08-25
closed: 2026-08-25
source: "The index's visual design", Out of scope in `docs/superpowers/specs/2026-08-24-releases-own-their-creation-design.md` — "Recorded separately", filed here
files:
  - styles/release.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The release index rows paint as Obsidian buttons

## The limitation

`.pbl-rel-row` is a bare class at specificity `(0,1,0)`. Obsidian's own `app.css` carries
`button:not(.clickable-icon)` at `(0,1,1)`, declaring `background-color:
var(--interactive-normal)` and `box-shadow: var(--input-shadow)`. `(0,1,1)` wins regardless
of source order, so the row's own reset — `background-color: transparent; box-shadow:
none;` — never applied. `justify-content` was a second, quieter loss: the row never
declared it at all, so Obsidian's bare `button { justify-content: center; }` supplied it,
harmless while the name column took the slack and wrong the moment a figure column drops.

Measured in headless Chromium on 2026-08-25, against the real vendored `app.css`: the row
computed `background-color: rgb(51, 51, 51)` over a body background of `rgb(28, 28, 28)` —
Obsidian's filled, raised button chrome, not the plugin's own flat row. After the fix, the
same probe reads `backgroundColor: "rgba(0, 0, 0, 0)"`, `boxShadow: "none"`,
`justifyContent: "flex-start"`.

## Why it is deliberate

It is not — this is a plain defect, not a scoped trade-off — but it is worth saying why no
check in this repository could have seen it before it was measured by hand.
`jsdom` computes no styles at all, so no `test/` suite here can evaluate a CSS cascade.
The browser harness (`npm run harness`) draws the real view against the real vendored
`app.css`, but by design asserts nothing (ADR 0020) — it is a way to look, not a check. And
the row only became a real `<button>` on 2026-08-23, replacing a `role="button"` div once a
`display: contents` element was measured to have no box and no tab stop at all (see the
comment above `drawRow` in `renderIndex.ts`). The specificity collision with Obsidian's
`button:not(.clickable-icon)` rule did not exist before that change, so the general sweep
that found and fixed the same defect on four other controls
([[Four other controls still lose to Obsidian's button rule]], closed 2026-08-08) had
already finished before this row was a button for it to reach.

## What would lift it

Element-qualify the selector so the plugin's own reset ties Obsidian's rule at `(0,1,1)`
and wins on source order, exactly the `button.pbl-card-kids-toggle` pattern
`styles/cardChildren.css` established and the four-controls fix above already generalised.

## Impact

Every row in the release index painted with Obsidian's default filled, raised button
chrome underneath whatever the plugin's own flat-row design asked for, in any vault using
this view. The row still worked — it was still a real, focusable, clickable button — but it
did not look like the rest of the plugin's design intends.

## Outcome

Fixed: `styles/release.css` now element-qualifies the reset as `button.pbl-rel-row`, tying
Obsidian's `(0,1,1)` and winning on source order, and the row states its own
`justify-content: flex-start` so it no longer depends on Obsidian's bare `button` rule for
its main-axis alignment. The existing `.pbl-rel-row:focus-visible` outline was already
present and needed no change — it is now the thing keeping focus visible now that the
background reset ties Obsidian's own `button:focus-visible` ring at the same specificity.

Verified two ways, the same two the four-controls fix used: `test/view/release/rowChrome.test.ts`
checks the assembled stylesheet still spells the reset at the compound selector, and headless
Chromium against the real vendored `app.css` — before: `rgb(51, 51, 51)` over
`rgb(28, 28, 28)`; after: `rgba(0, 0, 0, 0)`, `box-shadow: none`, `justify-content:
flex-start`, matching the harness prediction exactly.

**Not verified in a live vault.** A themed vault can style `button` harder than this
repository's harness baseline (`test/harness/theme.css`, Obsidian's own defaults only), so
whether the fix reads correctly against a real theme's accent and colours is still an open
question the same way it is for every fix under
[[Four other controls still lose to Obsidian's button rule]].
