---
type: PBI
parent: "[[Test coverage]]"
order: 30
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# Untested work names itself

**As** a Product Owner deciding whether to release, **I want** a row to say how many tests
cover it, **so that** the work nothing checks is visible on the plan instead of being
discovered by a customer.

This is the backward read of [[Coverage as a property]] and the reason the epic put both
families in one base. Every edge already exists; what this note adds is a count on the
covered item's row, and a signal when that count is zero.

It is a **read**, all of it. Nothing is written to the covered item — no `tested: true`, no
stamp, no cached number — which is what keeps a test's existence from being a fact two
notes can disagree about, and what makes the count correct the moment the base's results
change: a test deleted, a test whose coverage entry was removed, a test the filter stopped
returning.

**Retiring a test is not on that list**, and the sentence said it was until this note was
reviewed. There is no retired state to read: this epic declares no test-status vocabulary
([[A catalog of tests]] refuses one, since `status` already says drafted, active and done),
so a test whose `status` someone set to `Done` still declares its coverage and still counts.
The count means *a test names this item*, not *a live test names this item*, and the only
thing that narrows it is the base's own filter — which is a real answer, since a base that
excludes finished notes gets the narrower count for free. Writing the wider guarantee and
leaving it standing is the defect this register has a name for; what a status ought to do
here is a question for whichever increment gives tests a lifecycle, and it is not this one.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The tree, the board or the roadmap renders a work item, with the coverage property bound |
| **Preconditions** | The coverage key is bound, and the base returns tests as well as work items |
| **Guarantee** | Nothing is written. The count reports only edges declared by results, so a note the Base excluded can neither raise a count nor lower one, and no ancestor inherits a descendant's coverage. |

**Main flow**

1. A work item's row carries the number of tests naming it, drawn only when the coverage
   key is bound.
2. A row whose count is zero carries the **untested** signal instead of a zero — the state
   the reader is looking for, said as a state rather than as arithmetic they have to do.
3. Both are derived per render from the edges the model resolved; nothing is stored on the
   item and nothing is stamped on disk.
4. The count changes when the catalog changes, on the ordinary refresh, with no write to
   the item it describes.

**Extensions**

- **1a — the coverage key is unbound.** No count and no signal anywhere. An untested marker
  on every row in a vault that has no tests would be a view shouting about a feature nobody
  turned on.
- **1b — the base returns no tests at all**, the coverage key being bound. Every work item
  **that the signal applies to at all** reads as untested — which excludes `Task`s, per 1c,
  and that exclusion holds here exactly as it holds everywhere else. Nothing about this case
  is special enough to widen the population: 1c is a rule about which rows carry the signal,
  not a rule about the ordinary case, and a "but here, all of them" would be the signal
  meaning something different when the result set is empty.
  For the rows it does apply to, marking them all is the honest report of that result set —
  the answer the count label gives when it reports what the Base returned rather than what
  the vault holds. What must not happen is a signal keyed to *whether tests exist*: that
  would make the marker mean two different things depending on a filter.
- **1c — the item is a `Task`.** Counted like any other work item if a test names it, and
  **not** marked untested when none does. Tests are written against behaviour, and marking
  every task in the register as untested would make the signal noise on the population that
  carries it most.
- **1d — the item is a context row.** No count and no signal. An `outsideFilter` row is
  never a source of anything derived from the results, and a count is exactly that — the
  rule `assignAll` already keeps for rollups, asked of one more number.
- **2a — the only test naming it is one the Base excluded.** The item reads as untested,
  and the reason is simpler than an earlier draft of this extension claimed: **there is no
  edge at all.** An excluded note's coverage list is not read
  ([[Coverage as a property]] 3c) — its claims are not this base's facts — so nothing was
  declared for the count to decline to count. The draft cited 3a instead, which is the
  opposite case (an *included* test naming an *excluded* item, where the edge does exist and
  is simply never counted), and reached the right answer through the wrong rule. The
  outcome is unchanged and the reasoning is not, which is worth the correction: a rule
  quoted at the wrong case is how the next extension gets decided wrongly.
  It stays written down because it still looks wrong from outside — a test the user can see
  in another base names this item, and this base says nothing checks it. That is the
  context-row rule doing its job, and the honest reading of "nothing in *these results*
  checks it".
- **2b — the item is covered only by a test whose entry is marked broken.** Not counted. A
  broken entry names nothing this base can see, and counting it would make the reassuring
  number the one thing a typo can inflate.
- **2c — the only test naming it is one the user considers finished or abandoned**, its
  `status` set accordingly. It counts. Nothing here reads a test's status, and the count
  says what it says: a test names this item. A base that filters finished notes out of its
  results narrows the count by narrowing the results, which is the ordinary mechanism and
  needs nothing added; a base that does not, reports the wider number. What is refused is
  a rule inside the counter — a second status vocabulary the epic declined to invent,
  applied to a number whose whole value is that it is simple to believe.
- **3a — a `Test suite` covers a parent and its cases cover the children.** Both count, on
  their own items, and neither is added to the other. No edge rolls up in either direction:
  a Feature is not covered because its PBI is, and a PBI is not covered because its Feature
  is. The first would hide exactly what this note exists to show; the second would make
  every child of a covered parent read as tested.
- **4a — the count is asked of a board card or a bucket card rather than a tree row.**
  Same number, same rule, and whether each of the three surfaces draws it is that surface's
  own decision. What this note fixes is the number and its meaning; a projection that shows
  nothing is showing nothing wrong.

## Acceptance criteria

- The count is derived per render from resolved edges. No property is written to a covered
  item by this feature, ever — checkable at the write path rather than by driving the
  surfaces that display the number.
- With the key unbound, no count and no untested signal appears anywhere.
- A context row neither carries a count nor contributes to one, in either direction.
- Coverage does not roll up: a parent's count is its own edges, and a test naming a child
  changes no ancestor's number.
- A broken entry counts for nothing.
- A test's own `status` changes no count. The number is *a test names this item*, and the
  only thing that narrows it is the base's results — stated as a criterion because the
  wider promise is the easy sentence to write and nothing here would fail because of it.
- `Task`s are counted when covered and never marked untested when not, and the distinction
  is asserted rather than left to the reader of the render code.
- Not verifiable here: whether the untested signal reads as *information* rather than as an
  error at a glance, in a register where most rows will carry it on the day the feature
  ships. That belongs in [[Smoke test the visual changes]], and it is the reason the signal
  is specified as a marker on the row rather than as a colour.

## Where it lives

**Nothing yet — this note is design.** The number is the edges resolved in
`src/domain/model.ts` read the other way round, which is a question about which index the
model keeps rather than a second traversal — one map from covered item to the tests naming
it, built by the same pass that resolves the entries.

`src/view/render/rows.ts` draws it on a tree row; the card surfaces
(`src/view/render/board.ts`, `src/view/render/roadmap.ts`) are where 4a is answered if
anyone wants it there. The signal's own styling is a partial under `styles/`, and it is a
marker rather than a colour for the reason the last criterion gives.
