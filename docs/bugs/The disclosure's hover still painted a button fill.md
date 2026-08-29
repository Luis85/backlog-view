---
type: Bug
parent: "[[Children on the card]]"
order: 30
status: Done
area: styling
priority: P2
created: 2026-08-08
closed: 2026-08-08
source: Card children expansion increment, verified in the harness against the real Obsidian stylesheet (test/harness/obsidian.css), task-10-report.md
files:
  - styles/cardChildren.css
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The disclosure's hover still painted a button fill

## What happened

`83050b7` set out to strip button styling from the card-children toggle and its entries,
and replaced their filled `:hover` rule with a colour-only shift — text colour changing,
nothing else. That removed the plugin's own hover fill, but it did not remove the
`background-color`/`box-shadow` *property* from the hovered button: with nothing left to
win it, the property fell through to Obsidian's own `button:hover` rule (also `(0,1,1)`,
see [[Obsidian's button rule outranks the plugin's chrome-stripping]]), which paints a
fill. The change read as a fix and made the symptom worse — the toggle and its entries
went from wrongly filled at rest to wrongly filled on hover as well, on the very commit
meant to remove the fill.

Verified empirically against the code as committed at `83050b7`, hovering the first child
row in the harness with the real `obsidian.css` loaded: computed `background-color` was
`rgb(63, 63, 63)`, exactly `--interactive-hover` in the dark scheme — Obsidian's own hover
fill, painting straight through.

Worth recording how it was nearly missed: a subagent reviewing the same code inspected the
hover rule and classified it as "likely a stub-specificity artifact, not a real bug" — a
plausible read, since the harness's variable stub at the time carried no real `button`
element defaults for it to fall through to. It was a real bug; only vendoring the actual
`app.css` into the harness (`a686c3d`) made the hover fill visible to reproduce and settle
the question. No committed test caught it either before or after that classification —
the same gap named in
[[The harness's variable guard says nothing about element defaults]].

## Fix

Fixed at `a686c3d`, in the same change that qualified the base selectors (see
[[Obsidian's button rule outranks the plugin's chrome-stripping]]). The hover rules now
restate `background-color: transparent` and `box-shadow: none` explicitly, rather than
only changing colour, so the property has a plugin declaration to win with at the same
`(0,1,1)` specificity Obsidian's `button:hover` sits at.

## Lesson

**Removing your own declaration does not remove the property — it hands the property to
whatever rule is next in the cascade.** A rule that changes "background: rgb(x)" to
"color: rgb(y)" reads as narrowing the change to what was actually wrong, but a browser
does not remember that a property was recently overridden; it resolves each property
independently, every time, among whatever rules still declare it. Once the plugin's own
declaration was gone, the host application's rule was the only one left standing for that
property, and it lost nothing by the plugin going quiet.
