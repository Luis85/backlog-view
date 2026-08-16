---
type: PBI
parent: "[[An Iterations board]]"
order: 15
status: Active
priority: P2
created: 2026-08-16
source: user request
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# An iteration's timeframe schedules its items

**As** someone planning in sprints, **I want** an item I put in an iteration to take that
iteration's dates, **so that** committing work to a fortnight schedules it in one action
rather than in three, and the roadmap shows the sprint I actually agreed to.

An iteration is a time box. Joining one is a commitment to those two weeks, so
`Set iteration` stops being one write and becomes one **batch** of three: the link, and
the start and target the iteration itself carries.

Three writes, one batch, one undo slot — and that is the load-bearing part rather than an
implementation detail. Three separate batches would let a reader take back the dates and
keep the link, leaving an item in a sprint it is not scheduled for: a state no gesture in
the UI can produce and nothing downstream expects.

What it does **not** write is where this note earns its keep, and each refusal is the
user's own decision rather than a simplification chosen here. Nothing writes a state.
Nothing is deleted on the way out. Nothing branches on what the item already held.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Picking an iteration from `Set iteration` on a row or a card, or creating an item on an iteration board |
| **Preconditions** | The iteration property is configured ([[An iteration is a note of its own]]). The two date properties are **not** preconditions: an unconfigured key is skipped, as everywhere else |
| **Guarantee** | One batch through one gate, taken back by one undo. The dates written are the iteration's own, read from the note and never computed. No state key is ever named in the plan, whatever the item held and whatever it joins. |

**Main flow**

1. The user picks an iteration from `Set iteration`.
2. The plan carries the **link** — a wikilink to that note, spelled from the editing
   note's own path — when the item's resolved iteration is not already that note.
3. It carries **start** and **target** when the iteration has them and the item's own
   differ, taken from the iteration note as it stands.
4. `applySafely` applies the batch, and the one undo slot takes the whole commitment back
   ([[Undo and redo]]).
5. The item now draws in the sprint's two weeks on the dated axis ([[Bars from two
   dates]]) and appears as a card on that iteration's board
   ([[A board scoped to one iteration]]).

**Extensions**

- **2a — the item already carries a start, a target, or both.** They are **overwritten**.
  No merge, no fill-only-what-is-empty, no branch on what the item held: joining a sprint
  means taking the sprint's dates. Decided by the user on 2026-08-16 against a
  fill-the-gaps alternative, which was refused for a reason a rule with a branch in it
  cannot escape — two items in one sprint would draw different bars on the roadmap, which
  is the one screen a sprint exists to make legible.
- **2b — the iteration carries only one of the two dates, or neither.** The end it does
  not carry writes **nothing** and deletes nothing. This is the single asymmetry in
  "overwrite always" and it follows the codebase's own rule rather than softening the
  user's: an iteration with no target has no timeframe to impose, and `undefined` leaves a
  key alone where `null` would delete it. The item keeps whatever it had at that end.
- **2c — the start or target property is unconfigured.** Nothing is written under it, and
  the link still lands. Absence is a value, and an unconfigured key is never written — the
  same rule this write keeps for the link itself. A vault with no date properties gets
  iteration membership and no scheduling, which is coherent rather than degraded.
- **2d — the item's own dates already equal the iteration's.** Those writes are absent
  from the plan rather than applied and found to be no-ops. Equality is asked at plan
  time, by the same civil-date comparison the axis writes already use, so an item that is
  already in step does not consume the undo slot.
- **3a — the item's iteration is not changing** (the picked entry is the one it already
  holds). The link write is absent, and the two date writes are planned exactly as above.
  So picking the **checked** iteration is a **re-sync**, not a no-op, and that is the
  point rather than an accident: it is the only way a member whose iteration had its dates
  edited comes back into step ([[Creating an iteration from the board]] extension 4b).

  This is what narrows the menu's checkmark. The register's rule — an entry is checked
  exactly when picking it would write nothing — cannot survive a three-write plan, since a
  drifted member would leave its own iteration unchecked and no entry showing as current.
  The checkmark asks the plan's **link** component alone, stated in
  [[An iteration is a note of its own]] extension 3b, where the menu is.
- **3b — the user picks `None`.** The link is removed and **the dates stay**. Removal is
  not a reschedule: an item taken out of a sprint still has whatever plan it had, and
  deleting two date keys on the way out is a decision nobody made. Decided by the user on
  2026-08-16 over a variant that cleared them.
- **4a — no state is written, on any of these paths.** Not on joining, not on moving from
  one iteration to another, not on `None`. The user's own words: *"Putting an item into
  the iterations backlog must not be driven by the status field."* An item shows in the
  board's **Open** column because it has not been started, never because a write put it
  there — which is why [[A board scoped to one iteration]] needs no entry-state option,
  and why an item carried from one sprint to the next keeps the progress it had made.

  A category invariant, so it is checked at the forbidden thing rather than by driving the
  paths someone thought of: the assertion is that **no plan this module produces ever
  names a state key**, asked of the planner, which every entry point routes through.
- **5a — an item is created on an iteration board** ([[A board scoped to one iteration]]
  extension 5c). The create carries the link **and** both dates, in the same write as the
  type and the parent — never a create followed by a second write. The precedent is the
  horizon's: a note created from a bucket claims that bucket in the same write, so it is
  never momentarily a note sitting somewhere its own frontmatter does not name. Here the
  same rule covers the dates: a new card scheduled outside the sprint it was created on
  contradicts the board that made it.
- **5b — the item is a context row** (outside the Base's filter). `Set iteration` is not
  offered and no date reaches it. The context-row rule is inherited whole and restated
  nowhere: a context row renders, it parents, and that is all.
- **5c — the write takes the item out of the base**, because the base's filter names one
  of the date properties. The item leaves in silence, as it already does on every other
  write path. Nothing correlates a Bases pass with a write, and the open question is
  recorded rather than reopened
  ([[The outcome report was built from one sentence]]).
- **3c — the iteration note's dates are changed afterwards.** Its members are **not**
  re-stamped, and the disagreement is not reported. That decision, and what makes it
  liveable, belong to the note that owns the edit
  ([[Creating an iteration from the board]] extension 4b) rather than being answered twice.
  What this note owns is the recovery: 3a is the re-sync, and it is one action per item.

## Acceptance criteria

- Picking an iteration plans the link and both dates in **one** batch through
  `applySafely`, and one undo takes the whole batch back — the link included, which needs
  its own row in `touchedKeys` and is checked by undoing a join and asserting all three
  keys are back, never by reading the list.
- The dates written are the iteration note's own start and target, overwriting whatever
  the item held, with no branch on the item's existing values.
- An end the iteration does not carry is left alone on the item — not written, not
  deleted — and an unconfigured date key is never written.
- A date already equal to the iteration's is absent from the plan rather than written as a
  no-op.
- Picking the iteration the item is already in plans the dates and no link, so it re-syncs
  a drifted member; picking `None` plans the link removal alone and leaves both dates.
- **No plan this module produces ever names a state key** — asserted of the planner, so it
  holds for entry points not yet written, and checked across joining, moving between
  iterations, and `None`.
- An item created on an iteration board carries the link and both dates in the same create
  as its type and parent, so it never exists as a note whose frontmatter contradicts the
  board it was made on.
- A context row is never a write target on any of these paths.

## Where it lives

The plan is `computeIterationWrites` in `src/domain/writePlan.ts`, which is where the
state-key invariant is asserted because every entry point routes through it. The dates it
reads come off the iteration item the model already holds, through
`src/domain/readItems.ts` over `src/domain/noteFields.ts`, and the civil-date comparison
that decides whether an end is already in step is the axis writes' own in
`src/domain/writePlan.ts`. Applying it is `src/storage/frontmatter.ts` — the link beside
the parent link's write, the two dates through `axisEntries` in
`src/storage/writeKeys.ts`, which already carries the "an unconfigured key is dropped, a
`null` deletes" rule this note leans on **and** is already captured for undo. The link is
not: it needs its own row in that module's `carried` list, on the writer's own condition,
or the one undo slot would restore the dates and leave the link — half a commitment taken
back, which is the state this note's one-batch rule exists to make impossible. The batch
reaches the gate through `src/view/writeGate.ts`. The menu that triggers it is
`src/view/interactions/labels.ts`, and the create path is
`src/view/interactions/create.ts` — `promptCreateItem`, which is where a `NewItemSpec` is
built; `src/view/interactions/structure.ts` carries the structural moves and never
constructs one. Driven in `test/domain/writePlanProperties.test.ts`
beside the other optional-property plans, with the entry points in
`test/view/contextRowWrites.test.ts` and `test/view/contextCardWrites.test.ts`.
