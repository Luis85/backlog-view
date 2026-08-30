---
type: Test case
order: 100
parent: "[[Smoke test the tree]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-30
source: "[[Live-vault checks for the resource chip and axis]], the open task that names this check as owed"
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# The assignee chip and Set assignee

A verification to run.

## Why this exists

[[Live-vault checks for the resource chip and axis]] records this as owed. An assignee stopped
being a plain name in this release and became a **link to a `Resource` note**, and the chip
that draws it, the menu that sets it and the resolution behind both are all jsdom-only.

**Preconditions** — `npm run test-build` has installed the plugin into this repository, the
repository is open as a vault, and `docs/resources/` holds at least two `Resource` notes. Give
one item an assignee naming somebody with **no** note behind them.

## How to check

- **`Set assignee`** lists the `Resource` notes the base returns, with the current one
  checked, and offers `New resource...` — which creates the note **and** assigns it in one
  step. Confirm the note lands in `docs/resources/` and the item points at it.
- The chip on a row and on a card draws the resource's **name**, not its path, and clicking
  it does what a chip does rather than opening the note by accident.
- **A chip whose value names no resource says so to a screen reader**, not only in colour.
  Turn one on and listen to the unresolved chip.
- **Resolution decides, not spelling.** An item carrying `assignee: Sarah` as bare text keeps
  its association wherever `Sarah.md` is a `Resource` this base returns. Confirm that, then
  confirm the narrower loss: the item naming somebody with no note draws **no row** on the
  resources axis.
- Under a **community theme**, does the chip read as a chip rather than as a button? This is
  the surface four separate button-specificity defects have already been paid for.

## Acceptance criteria

- The chip reads and speaks correctly in all three states — resolved, unresolved, unset — and
  `New resource...` produces a note that is immediately assignable.

## Outcome

**2026-08-30 — exercised during development, not walked as a sweep.** The maintainer
reports testing this behaviour in a vault while 0.10.0 was built. That is evidence of use
and it is recorded as such; it is **not** a run of the steps below, which were not walked
one by one. Everything here that needs a community theme, a themed accent, a real pane
width or a screen reader is therefore still unanswered — those are the questions this note
exists for, and the ones development use is least likely to have asked. The note stays open
for the next sweep.

Not walked as a sweep.
