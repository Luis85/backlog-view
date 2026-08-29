---
type: PBI
parent: "[[Test coverage]]"
order: 30
status: Open
priority: P2
created: 2026-08-08
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Untested work names itself

**As** a Product Owner deciding whether to release, **I want** a row to say how many tests
cover it, **so that** the work nothing checks is visible on the plan instead of being
discovered by a customer.

This is the backward read of [[Coverage as a property]] and the reason the epic put both
families in one base. Every edge already exists; what this note adds is a count on the
covered item's **tree row**, and a signal when that count is zero. One surface, deliberately
— the board card and the bucket card are named as refused in 4a rather than left to an
implementer's discretion, which is what naming three surfaces and specifying one amounts to.

It is a **read**, all of it. Nothing is written to the covered item — no `tested: true`, no
stamp, no cached number — which is what keeps a test's existence from being a fact two
notes can disagree about, and what makes the count correct the moment the base's results
change: a test deleted, a test whose coverage entry was removed, a test the filter stopped
returning.

**Retiring a test is not on that list**, and the sentence said it was until this note was
reviewed. There is no retired state to read: this epic declares no test-status vocabulary
([[A catalog of tests]] refuses one, since `status` already says drafted, active and done),
so a test whose `status` someone set to `Done` still declares its coverage, and still counts
wherever the base still returns it.
The count means *a test names this item*, not *a live test names this item*, and the only
thing that narrows it is the base's own filter — which is a real answer, since a base that
excludes finished notes gets the narrower count for free. Writing the wider guarantee and
leaving it standing is the defect this register has a name for; what a status ought to do
here is a question for whichever increment gives tests a lifecycle, and it is not this one.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The backlog **tree** renders a work item, with the coverage property bound |
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
- **1c — which rows carry the count and the signal at all.** **This extension defines the
  population**, and [[Linking a test to what it covers]]' suggester offers exactly it — one
  list read by two surfaces, because a suggester offering a row that cannot display the
  result is a control that writes into the dark.
  It starts from **what the plan draws** ([[Tests stay out of the plan]] 2b) and takes two
  exclusions from there, each stated as a reason rather than as a list of type names so
  that a type added later inherits the right answer.
  Starting there is the part an earlier draft left out, and it is not a formality: a
  **`Task` beneath a `Test case`** is a catalog member, so it carries no count and no
  signal, while a `Task` in the plan carries a count when a test names it. A rule that said
  "a `Task` is counted" without naming where it starts gave the catalog Task an inbound
  count — on the very row the suggester cites as the one that cannot display one, so the
  two surfaces were reading different lists while this note claimed they read one.
  A **plan `Task`** is counted when a test names it and is never marked untested when none
  does: tests are written against behaviour, and marking every task in the register would
  make the signal noise on the population that carries it most.
  A **marker** — `Milestone` — carries neither the count nor the signal, because it is not
  work. That is the rule `assignAll` already keeps when it refuses to roll a marker into a
  parent's progress, applied to one more number: a release date reported as an untested gap
  turns schedule metadata into a coverage problem and would make the signal least
  trustworthy on the row a reader scans hardest.
  Everything else keeps it, `Issue`, `Bug`, `Idea`, `Deliverable` and `Improvement`
  included. A `Bug` in particular *should* read as untested until something checks it —
  a regression is exactly what a test prevents — and nobody has yet argued the others are
  noise. Revisit if a report says so, which is the standing form of that decision here.
- **1d — a test row, or anything else the catalog owns.** No count, no signal, ever, and
  this follows from where 1c starts rather than being a rule of its own. The number answers
  *which work has nothing checking it*, and neither a test nor a task belonging to one is
  the subject of that question — so a test named by another test
  ([[Coverage as a property]] 3e) is recorded in the model and displayed nowhere. Worth
  stating because the row renderer is shared: "draw the count where there is one" would put
  a number on a `Test case` the first time somebody linked two tests, and on a catalog
  `Task` the first time somebody covered one by hand.
- **1e — the item is a context row.** No count and no signal. An `outsideFilter` row is
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
  `status` set accordingly. It counts, so long as the base still returns it — which is the
  whole of the qualification and the reason it is worth one. Nothing here reads a test's
  status, and the count
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
  The number is the same and the rule is the same; **neither card draws it, and that is a
  refusal rather than an omission.** The Trigger above says the tree and only the tree for
  this reason: an earlier draft named all three surfaces and then let each decide, which is
  a promise with nothing behind it — an implementation drawing the signal on the tree alone
  satisfied every criterion while two named projections showed nothing.
  [[Dependencies as a property]] 4d settled the same question the same way for the broken
  mark, in the same words worth repeating: *what is refused here is the promise, not the
  feature.* A badge on a board card and a bucket card is two display decisions inside the
  notes that own those surfaces, nobody has asked for them, and this note owns the number
  rather than every place it could appear.
  What that costs is worth stating plainly: a reader who works from the board sees no
  coverage gap. The epic's answer is that the gap is a property of the plan's *hierarchy* —
  which is the tree — and a board is a workflow view of the same items. If that turns out
  to be wrong, it is a new use case in the note that owns the card, not a wider sentence
  here.

## Acceptance criteria

- The count is derived per render from resolved edges. No property is written to a covered
  item by this feature, ever — checkable at the write path rather than by driving the
  surfaces that display the number.
- With the key unbound, no count and no untested signal appears anywhere.
- A context row neither carries a count nor contributes to one, in either direction.
- Coverage does not roll up: a parent's count is its own edges, and a test naming a child
  changes no ancestor's number.
- A broken entry counts for nothing.
- **Nothing here reads a test's `status`.** A test that stays in the results counts the
  same whatever its status says — that is the checkable half, and it is checked on a base
  whose filter does not mention `status`, since only there can the two effects be told
  apart. A base that *does* filter on `status` narrows the count when a test's status
  changes (2c), and that is the results changing rather than the counter reading a status,
  so the criterion is about the counter and says so. The unconditional version — "a test's
  status changes no count" — was written first and is false of exactly the vault most
  likely to have one.
- **Plan** `Task`s are counted when covered and never marked untested when not, and the
  distinction is asserted rather than left to the reader of the render code. A `Task`
  beneath a `Test case` carries neither, asserted beside it — the two Tasks differ by
  parentage alone, so a criterion naming only "Tasks" is satisfied by a rule that is wrong
  about one of them.
- A `Milestone` carries neither the count nor the untested signal, on a base where the
  coverage key is bound and nothing names it — the configuration where a blanket
  zero-count rule reports a release date as a coverage gap.
- A test row carries neither, including one another test names.
- The count and the signal are drawn on the **tree row** and on no card. Both halves
  asserted: a criterion proving only that the tree draws them is satisfied by an
  implementation that also badges every board card, which is a different feature nobody
  specified.
- Not verifiable here: whether the untested signal reads as *information* rather than as an
  error at a glance, in a register where most rows will carry it on the day the feature
  ships. That belongs in [[Smoke test the visual changes]], and it is the reason the signal
  is specified as a marker on the row rather than as a colour.

## Where it lives

**Nothing yet — this note is design.** The number is the edges resolved in
`src/domain/model.ts` read the other way round, which is a question about which index the
model keeps rather than a second traversal — one map from covered item to the tests naming
it, built by the same pass that resolves the entries.

`src/view/render/rows.ts` draws it on a tree row, and that is the whole of the drawing.
The card surfaces (`src/view/render/board.ts`, `src/view/render/roadmap.ts`) are
**untouched** — named here so the absence reads as this PBI's decision (4a) rather than as
a module somebody forgot, which is the difference between a scoped feature and a
half-built one. The signal's own styling is a partial under `styles/`, and it is a
marker rather than a colour for the reason the last criterion gives.
