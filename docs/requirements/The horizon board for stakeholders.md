---
type: Feature
parent: "[[Product Roadmap]]"
order: 80
status: Active
created: 2026-10-18
source: user request
started: 2026-10-18
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
---

# The horizon board for stakeholders

[[The horizon board]] built a place to put work: buckets, a shelf, moves. The user asked
for it to be the view a team shows the people it reports to — *"this view should be used
for stakeholder communication: it shall show, on the high level, where the team sets the
priority currently and what to expect."* So the board keeps its buckets, its shelf, its
moves and its keyboard walk, and gains four things: a **header** that says where the work
sits ([[The horizons header]]), **progress per bucket** ([[Progress per bucket]]), a
**Present / Plan** switch that takes the editing chrome away for a meeting
([[Present or plan]]), and **signals** on the cards a stakeholder asks about
(*Signals on a horizon card*, the fourth PBI, built in a parallel pass). The pattern is [[The iteration board for the daily]], built
the same day; the design is `docs/superpowers/specs/2026-10-18-horizons-stakeholder-design.md`.

**Kept on purpose.** Buckets are placements, never computations: no date is read as a
horizon and no bucket is derived. No lanes ([[Lanes on the roadmap]]). No computed health
signal ([[Product Roadmap]]). Overdue stays off this board — a Now-Next-Later roadmap
organises by confidence, not by calendar.

## Outcome

**The header, the progress and Present built 2026-10-18.** On the horizon axis the frame
opens with a small `Roadmap` kicker, the heading `Horizons`, and one line of counts —
`Now 5 · Next 4 · Later 3 · 20 not yet placed`. Each bucket says how much of it is done,
as a thin bar and `2 of 5 done`, counted with finished work included even while the
completed toggle hides it. The first bucket, the nearest horizon, carries an accent along
its top edge. `Present` hides the shelf, the New buttons and the dashed invitation chips;
`Plan` is the board as before; the pick is remembered per saved view and device.

**What the build decided that the spec did not say**, each recorded where it applies:

- An empty bucket draws no progress line: `0 of 0 done` says nothing ([[Progress per bucket]]).
- A folded bucket draws no progress line either; its count and its name carry the fold.
- Present hides every unset chip on a card — state, horizon, risk, priority, assignee and
  date — not only the assignee's: each is the same dashed invitation ([[Present or plan]]).
- In progress means what the iteration board means by it: a state that is neither done nor
  one of `iterationOpenStates`. A workflow that never declares its open states counts every
  unfinished state as in progress on the bar; the text, `done` against the total, is
  unaffected ([[Progress per bucket]]).
- The header, the switch and the bar reuse the iteration header's classes and its
  `renderModeSwitch` and `renderProgressBar`, so the two headers cannot drift apart.

**Still owed, and not answerable here** — the jsdom suite and the browser harness cannot see
a user's theme or a screen reader:

- the header and the accent edge in a real theme, light and dark;
- the summary with many buckets, and the switch in a narrow pane;
- what a screen reader says for the header, its `h2` and the mode `group`, inside a pane
  whose cards are a `listbox`.

`npm run test-build` and `docs/Product Backlog.base` are the way to look.
