---
type: Bug
parent: "[[Reading the estimation table at a glance]]"
order: 10
status: Done
area: styling
priority: P2
created: 2026-08-21
closed: 2026-08-21
source: Reported from a vault, 2026-08-21 — the estimation panel's clear control drawing over the point button beside it
files:
  - styles/estimationPanel.css
  - test/view/estimation/styleRules.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The clear control overlaps the last point

## What happened

In a vault, the `x` that clears a dimension's own stored value drew **over** the last
point button of that dimension's row. The control is revealed on hover or focus
([[Reading the estimation table at a glance]]'s own criterion), so what a reader met was a
point button that stopped being clickable the moment they pointed at the row.

**One fault, and it is arithmetic.** `.pbl-est-clear` is `position: absolute;
inset-inline-end: 0` inside `.pbl-est-dim-head`, which is `position: relative` and holds
the control's gutter open with `padding-inline-end`. An absolute inset resolves against its
containing block's **padding box**, and a padding box *includes* the padding area (CSS 2.1
§10.1) — the head declares no border, so its padding box's inline-end edge IS its outer
inline-end edge, and `inset-inline-end: 0` has always landed there rather than inside the
reservation. What was wrong was the reservation's WIDTH: `var(--size-4-5)` is 20px and the
control is 30px, so a control pinned to that outer edge reached 10px back over the last
point.

`.clickable-icon` in `app.css` is `padding: var(--size-2-2) var(--size-2-3)` — 4px 6px —
around an icon sized by the inherited `--icon-size`, which for this control resolves to
`--icon-m`: **18px on the desktop root and 20px at the touch breakpoint**. So the control is
30px, and 32px on touch. That number is a correction to what the pass predicted:
`docs/superpowers/specs/2026-08-21-estimation-polish-pass-design.md` read `.clickable-icon`
as wrapping an `--icon-s` 16px glyph and estimated "about 28px", and the inheritance chain
says otherwise.

jsdom lays nothing out, so the whole suite could see the markup was right and never that it
drew wrong — the same blindness [[An absence drew on the line below its own name]] records.

## The root cause this note first recorded, and why it was wrong

The first version of this note — and the spec's own task behind it — said the mechanism was
that `position: relative` sat on the very element carrying the padding, so the inset
measured from *inside* the reservation; and it moved `position: relative` from
`.pbl-est-dim-head` to `.pbl-est-dim`. **That reading of the padding box is backwards**, and
the move it produced bought nothing on the inline axis: `inset-inline-end: 0` resolved to
the head's outer edge before and after it.

It also introduced a defect of its own, on the *block* axis. `.pbl-est-dim` carries
`padding-block: var(--size-4-2)`, and because an inset resolves against a padding box that
padding is INSIDE the containing block — so `top: 0` against the row resolved 8px above
where the head begins, putting the control on the divider between rows rather than level
with the point buttons it belongs to. Nothing here can see that, which is why it shipped.

The move is therefore **reverted**: `position: relative` is back on `.pbl-est-dim-head` and
off `.pbl-est-dim`, and the row's comment arguing for it is deleted rather than corrected. A
change that buys nothing is removed rather than compensated for with a `top` offset.

## Fix

The gutter widened from `var(--size-4-5)` to `var(--size-4-8)` — 32px, the one token that
covers both the 30px desktop control and the 32px touch one, rather than a round number
chosen for looking about right. That is the whole fix. `.pbl-est-dim-head` keeps
`position: relative` and now states in a comment why it is the containing block on **both**
axes: `inset-inline-end: 0` lands on its outer edge past the gutter, and `top: 0` lands
where the head begins.

Two assertions, each watched failing — the first watched failing twice, once per direction,
against the un-reverted CSS:

**Checked by** `test/view/estimation/styleRules.test.ts` — "positions the control against the head, not against the row whose padding it would sit in"

**Checked by** `test/view/estimation/styleRules.test.ts` — "reserves the control’s real width rather than the 20px it used to"

**Scope of the root cause, and the test that establishes it.** The real test is **whether a
reserved gutter is narrower than the control it reserves for**, which needs two things
present at once: a reservation, and an out-of-flow control pinned to the edge outside it.
Every other `inset-inline-end: 0` / `right: 0` in `styles/` was read against that test, and
there are two rules and one comment:

- `.pbl-timeline-drop` (`styles/timeline.css`) is a full-bleed drop overlay — `top: 0`,
  `bottom: 0`, `left: var(--pbl-tl-lead)`, `right: 0` — covering everything past the lead
  column and reserving nothing. No gutter, so no gutter to be short.
- `.pbl-bar-clipped-end .pbl-bar-connector` (`styles/timelineFurniture.css`) is **the
  closest structural analogue to `.pbl-est-clear` in the whole sheet**: a 9px absolutely
  positioned button pinned to the inline-end edge of its bar, exactly as this control pins
  one to the edge of its row. It is outside this defect because `.pbl-bar`
  (`styles/timeline.css`) opens **no gutter for it at all** — there is no reservation whose
  width could be short. Whether a 9px connector sits over the end of a bar's own label is a
  different question from this one, and it is unverified here.
- The third grep hit is inside the comment above the grid banding in
  `styles/timelineFurniture.css`, explaining why `right: 0` was *not* used for that band.
  Prose, not a rule — worth saying, since a count of matches is not a count of rules.

So nothing else in the stylesheet holds this mistake, and the reason survives a fourth
edge-pinned control being added tomorrow provided the same question is asked of it: is the
space held open for it at least as wide as the control itself?

**What no check here reaches.** jsdom computes no layout, so the tests pin the selector that
carries `position: relative` and the width of the reserved gutter — never that the control
comes out inside it, and never where it lands on the block axis. And 32px is sized to
Obsidian's own `--icon-m`: a theme that sets its own `--icon-size` moves the control without
moving the gutter. **A live-vault look is owed and has not been made** — it is a bullet on
[[Smoke test the estimation view's UX polish in a live vault]].

## Lesson

**A gutter width is computed from the control's own tokens or it is a guess.** 20px was
never the control's width, and the number that replaced it did not come from the obvious
reading of `.clickable-icon` either — `--icon-size` inherits `--icon-m`, not the `--icon-s`
a glance at that rule suggests, and it changes at the touch breakpoint. A reserved width
that names no token chain cannot be checked against anything.

**And a box-model mechanism asserted from memory is a root cause invented to fit a
symptom.** The overlap was real and reported, so the first diagnosis of it was accepted
without anyone opening the specification: a padding box *includes* the padding, which is the
opposite of what that diagnosis reasoned from. What it cost was not one wrong sentence but a
code change — a `position` moved onto a box carrying block padding, buying nothing on the
axis the bug was on and moving the control 8px on the axis it was not. **Where a fix rests
on how the box model resolves something, quote the specification in the note.** The failure
shape is already recorded in [[Styling rules are checks]]: *"the justification was invented
to fit a conclusion already accepted"*.
