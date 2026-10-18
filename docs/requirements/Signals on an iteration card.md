---
type: PBI
parent: "[[The iteration board for the daily]]"
order: 30
status: Done
priority: ""
created: 2026-10-18
source: user request
started: ""
finished: 2026-10-18
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
release: ""
---

# Signals on an iteration card

**As** a team at its daily stand-up, **I want** a card to say when it is blocked, overdue,
risky or important, **so that** the cards that need a word are found by looking rather than
by opening each one.

The four signals are facts the backlog already holds — a prerequisite, a target date, a
risk level and a priority. The card says them as TEXT under its title. The tree's chips and
the card's own menu stay the ways to change any of them.

## Use case

| | |
| --- | --- |
| **Actor** | The team at a stand-up, or the backlog owner planning |
| **Trigger** | The iteration board draws a card |
| **Preconditions** | The board is scoped to one iteration ([[A board scoped to one iteration]]) |
| **Guarantee** | A signal is text: it adds no control, no tab stop and no write. Only the iteration board draws them — one gate in `renderCardBody` asks the projection — and the product board is checked to draw none for the same item. |

**Main flow**

1. For each card the board draws, the view asks which signals apply, against today's date
   from the view.
2. **Blocked** — the item has a prerequisite that is not clear (2b). The
   label is `Blocked` with a lock icon; the tooltip names the first such prerequisite
   (`Waiting for Prereq`).
3. **Overdue** — the item's own target is before today. The label is `Overdue 5 days`,
   a plural key, with a clock icon.
4. **Risk** and **priority** — the item's own values, as the note carries them under the
   configured keys, each with its own icon and a tooltip naming the kind (`Risk: High`).
5. When at least one applies, a signal row draws under the card's title, in that order;
   when none applies, no row draws.

**Extensions**

- **1a — the card is a context card.** No signals: a context row is placement, not this
  sprint's work.
- **1b — the card reads as Resolved.** No signals — none of the four, not only Blocked and
  Overdue as the spec said. Decided in the build: at the daily a finished item is not a
  topic, and its risk and priority are no longer news. Less to read on the column that
  holds the most cards by the end of a sprint.
- **1c — the card is on the backlog shelf, in Planning.** It draws its signals too: the
  shelf's cards go through the same card body, and a risk is worth seeing while choosing
  what to pull into the sprint. Decided in the build.
- **2a — the prerequisite is a context row** — an excluded note the model holds to place
  a carrier. It still blocks. The context-row rule bars an excluded note as a DECLARER (its
  own list is never read) and as a counted result; it does not bar one as a NAMED blocker,
  because the work really waits for it. A prerequisite the model does not hold at all
  resolves to nothing and blocks nothing ([[Dependencies as a property]]).
- **2b — the prerequisite reads as Resolved.** Not blocked. Resolved is the iteration
  board's bucket reading, so a state in `iterationResolvedStates` counts as well as a done
  value. A prerequisite that is done in its OWN workflow is clear too — a finished
  Deliverable or test carries no product state — which is the release view's readiness
  reading (`ownWorkflowReading`), so the two views agree about one edge. Decided at the
  final review.
- **2c — no state property is configured.** Nothing is Blocked: no state can say a wait is
  over, so the flag would sit on every dependent card. Decided at the final review.
- **3a — today IS the target day.** Not overdue.
- **3b — the sprint has ended.** Joining an iteration stamps its end onto the item, so
  Overdue mostly fires after the sprint ends. That is correct, not a bug: the work is late.
- **4a — the risk or priority property is not configured, or the value is blank.** No
  signal for it.
- **4b — the value is not in the declared list.** It still draws: a value the note carries
  is worth saying whether or not the list names it.
- **5a — the colours.** By the Spent Colour Rule in `DESIGN.md`: every label is in text
  colour; Blocked and Overdue put Attention Orange on the ICON only, over a faint orange
  tint; risk and priority are data, so they carry no hue. Decided in the build after the
  first version coloured the labels.
- **5b — the date changes, or a prerequisite's state changes.** The board's cards are
  rebuilt on every render, so a signal needs no cache key and is never stale.

## Acceptance criteria

- Blocked names the first prerequisite that is not Resolved, and goes away once it is; a
  prerequisite done in its own workflow does not block, and nothing blocks with no state
  property.
- A prerequisite that is a context row still blocks; an excluded prerequisite the model does
  not hold blocks nothing.
- Overdue counts the days past the target against the view's clock, and is absent on the
  target day.
- Risk and priority draw as the item's own values after the two flags, and not without a
  configured property or with a blank value.
- A resolved card and a context card draw no signal row; a shelf card in Planning draws
  its signals.
- The signals are text, never a control, and the product board draws none for the same
  item.
- Every signal label and tooltip comes from the catalog; only the risk and priority values
  are data.

**Checked by** `test/domain/iterationDaily.test.ts` — "is not blocked by a Deliverable that is done in its own workflow"

**Checked by** `test/domain/iterationDaily.test.ts` — "is never blocked when no state property is configured"

**Checked by** `test/view/iterationSignals.test.ts` — "says Blocked when the prerequisite is a context row, since the blocker is real"

**Checked by** `test/view/iterationSignals.test.ts` — "is not blocked by an excluded prerequisite the model does not hold"

**Checked by** `test/view/iterationSignals.test.ts` — "draws on a backlog-shelf card too, while planning"

**Checked by** `test/view/iterationSignals.test.ts` — "says nothing on a resolved card, whatever it carries"

**Checked by** `test/i18n/iterationDaily.test.ts` — "leaves nothing but titles, names, values and counts unmarked"

## Where it lives

`cardSignals` in `src/domain/iterationDaily.ts` answers Blocked and Overdue from
`item.prerequisites` (resolved by `src/domain/dependencies.ts`, which reads no excluded
note's own list) and the item's planned target, with `today` passed in.
`src/view/render/cardSignals.ts` draws the row, and `renderCardBody` in
`src/view/render/board.ts` calls it only when the projection is the iteration board — for
the column cards and the shelf cards alike. Risk and priority are read off the item as the
tree reads them. ADR 0027 carries the dated amendment that lets these two kinds onto this
board's cards as text rather than as cells. The look is `styles/cardSignals.css`. Rules in
`test/domain/iterationDaily.test.ts`; the drawn signals in
`test/view/iterationSignals.test.ts`.
