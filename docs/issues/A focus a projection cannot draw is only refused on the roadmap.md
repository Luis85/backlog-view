---
type: Issue
order: 200
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P3
area: design
created: 2026-08-22
source: Task 3b of the release-management plan — the narrow rule was taken deliberately and the wide one was not recorded anywhere in docs/
files:
  - src/view/projection.ts
  - src/view/backlogView.ts
  - src/view/viewStateController.ts
  - src/view/render/toolbar.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A focus a projection cannot draw is only refused on the roadmap

## What is built

`honouredFocusLevel` (`src/view/projection.ts`) answers one question: is this projection's
model re-rooted by the stored focus level, or built unfocused. It refuses **one** case —
a `Release` focus on the roadmap — and it asks `onThisRoadmap` (`src/domain/roadmap.ts`)
to decide, which is the roadmap's own one statement of which rows any of its axes can
place.

It exists because the focus is working position on the device (ADR 0011): it outlives the
projection it was set on and arrives at the next one unrevalidated. On the roadmap that
produced four wrong readouts at once from one stored value — a frame with no cards, a
toolbar count over rows the frame could not draw, a `Focus: Release` button over a menu
holding no such entry, and an empty state offering `New Release`. Refusing the focus
answers all four, because everything downstream already reads `settings.focusLevel`.

## What is not built

The wider rule: **a focus a projection does not OFFER is no focus.** The focus picker
already narrows its menu through `offerableTypes`, so "offered" is a question this
codebase can already answer for every projection; `honouredFocusLevel` could ask that
instead of naming the roadmap and one type.

One live case is known and is not the roadmap's: `byProjectionType` withholds
`Deliverable` from the requirements board, because that board excludes Deliverables by
construction — so a `Deliverable` focus set on the tree and carried onto the requirements
board narrows `model.results` to roots that board draws none of. The comment at the
picker's own `offerableTypes` call in `src/view/render/toolbar.ts` states the current
behaviour for that case honestly: the inherited focus still reads in the button with the
clear beside it, and narrowing the MENU only stops the state being reached from the
projection it breaks, never being carried into it.

Whether the other projections have such a case is unmeasured. The catalog ignores the
focus by computing its own unfocused population; the Deliverables board and the iteration
board read populations off the whole unfocused tree, and all three draw a static picker
label (`inertFocus`) rather than a menu, which is why none of them was examined here.

## Why the narrow rule was taken

Scope, and one rule this repository keeps: a shipped type's behaviour is not a passing
change's to alter. Widening `honouredFocusLevel` to `offerableTypes` changes what the
requirements board draws under an inherited `Deliverable` focus — today the board is
empty, afterwards it is the whole board — which is a product decision about a shipped
projection, taken on evidence, not a consequence to collect while fixing releases. The
narrow version was written the day [[Releases as their own type]] needed it, with one
type refused, and it is the only one under a check.

## What the wide version would cost

- One line in `honouredFocusLevel`, plus `offerableTypes` needing a host rather than a
  projection name — it reads `host.projection` today, and the two call sites
  (`refreshFromData` and `setProjection`) hold different things.
- A test per projection whose answer changes, each watched failing. The requirements
  board's is the one known case; the rest have to be measured before they are claimed.
- A decision about the PICKER's label in the widened cases: with the focus refused, the
  button reads `All types` and the clear is withheld, so the reader loses the only sign
  that a focus is set elsewhere. On the roadmap that is right — the stored pick is a type
  it cannot draw at all — and on a board that merely excludes the type it may not be.

## Acceptance criteria

None as a gate — this is a recorded decision and its open half, not work in flight. It
closes when someone either measures which projections carry an unofferable focus today,
widens the rule with a test per changed answer, or records that the narrow rule is the
intended one and the requirements board's empty state under an inherited `Deliverable`
focus is acceptable.
