---
type: Feature
parent: "[[Product Kanban]]"
order: 67
status: Done
created: 2026-10-18
source: user request
started: ""
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

# The iteration board for the daily

The board [[An Iterations board]] built answers "what is in this sprint". The user asked
for it to answer the stand-up's questions too — *"the iteration meta data such as name and
goal must be more prominent; the iteration board must be usable as the daily ceremony
view."* So the board keeps its population, its three buckets, its moves and its shelf, and
gains four things: a **header** that says which sprint this is and how it is going, a
**person spotlight** to walk the board one person at a time, **signals** on the cards that
need a word, and a **Daily / Planning** switch that takes the backlog shelf away during the
daily.

**Two decisions of the 2026-08-15 iterations design
(`docs/superpowers/specs/2026-08-15-iterations-design.md`) are kept on purpose.** No swimlanes:
the spotlight walks the people and the columns do not change. And the goal is text, not a
control: it becomes larger, never editable in place — the dialog in
[[Creating an iteration from the board]] and the note itself stay the ways to change it.

**One is narrowed.** That design said "no burndown, velocity or capacity". The header's
progress bar is none of those: it counts the CURRENT states of this sprint's cards and
stores no history, so it cannot draw a line over time, compare sprints, or say how much a
person can take. A burndown would need a history this plugin does not keep, and that
refusal stands.

## Outcome

**Built 2026-10-18.** On an iteration board the sprint's name and goal are the largest text
on the screen; under them, the timebox (`Day 6 of 14 · 8 days left`) and the progress
(`4 of 18 resolved`, then a count per bucket). A row of person chips dims every card that is
not the pressed person's, so the team walks the board without a filter that hides work.
Cards that are blocked, overdue, or carry a risk or a priority say so in a row under the
title. `Daily` hides the backlog shelf; `Planning` shows it; the pick is remembered per
saved view and device.

**What the build decided that the spec did not say**, each recorded where it applies:

- The goal has no coloured side border. A small accent `Goal` label above large text
  carries the emphasis — the design checks flag a thick coloured side rule as a cliché
  ([[The iteration header]]).
- A resolved card draws none of the four signals, not only Blocked and Overdue: at the
  daily, a finished item is not a topic, and its risk is no longer news
  ([[Signals on an iteration card]]).
- A context row can still make a card Blocked. The context-row rule bars an excluded note
  as a DECLARER of prerequisites and as a counted result; it does not bar one as a named
  blocker, because the work really waits for it ([[Signals on an iteration card]]).
- The signals follow the Spent Colour Rule: labels in text colour, Blocked and Overdue an
  orange icon on a faint orange tint, risk and priority no hue at all.
- The signals also draw on the backlog shelf's cards in Planning, through the same card
  body: a risk is worth seeing while choosing what to pull in.
- With no assignee property configured there is no people row and no spotlight — everyone
  would be `Unassigned`, one chip that dims nothing
  ([[Walking the board one person at a time]]).
- The spotlight is session-only, carries across a switch of sprint, and clears itself when
  its person has no card on the board.
- The release bundle's budget rose from 512 kB to 544 kB: the build measured 517.5 kB with
  this feature in it, and no dependency was added — the growth is this feature's own code.

**Still owed, and not answerable here** — the jsdom suite and the browser harness cannot
see a user's theme or a screen reader:

- the header and the person chips against a real theme, including a long name and many
  people;
- the focus ring on the Daily / Planning buttons and on the chips;
- a screen reader on the `h2`, the mode `group` and its buttons, and the chips, inside a
  pane whose cards are a listbox;
- the contrast of the orange icon on its tint, light and dark;
- a long risk or priority value on a narrow card, and the switch in a narrow pane.

`npm run test-build` and `docs/Product Backlog.base` are the way to look.

