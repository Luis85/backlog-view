---
type: Epic
order: 4.2969
status: Open
area: product
created: 2026-08-22
source: product requirements document, 2026-08-22
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# UX Work Management

**A designer's work is already in the vault, and the backlog counts it as nothing.** The
research note, the workflow observation, the prototype write-up are ordinary notes with no
type and no parent — so by the register's own scope rule ([[What counts as a work item]])
they are outside the tree, and every rollup, board, roadmap and filter reports that work as
zero.

**Two different things put that right, and confusing them is this epic's first trap.** What
admits a note to the tree is being *work* — a supported type or a parent, which is the only
test `pruneOutsideHierarchy` makes — and for research that precedes any PBI the missing half
is a legal parent, which is why reopening `Feature` → `Task` is a feature of this epic rather
than a footnote. What the discipline property adds is not membership but **legibility**:
once the work is in the tree, which craft owns it is a question every projection can be
asked.

**Outcome** — A UX Designer plans and does their work in the same backlog as everyone else,
and the team can see it while planning rather than when it blocks something.

## Why it is a property and not a rung

`parent` already decides level, rank, rollup and focus. Which craft does a piece of work
answers none of those: a research task is not ranked *above* the design task that follows
it, and a Feature does not become a UX Feature because a designer touched it. So discipline
is a link-free property on the item — the same answer the register already reached for a
dependency, for what a test covers, and for strategic alignment, and the same default
[[Ten capabilities want seventeen new types]] states as the register's own: **a type is for
something the tree ranks; everything else is a note a property points at.**

The source document agrees with that default before this epic asks it to, which is why the
epic costs no new type at all. Its own core principle is that UX work must not introduce a
second hierarchy beside Epic → Feature → PBI → Task, and it says in three separate places
that disciplines, activities, evidence and deliverables are classifications rather than
work-item types.

## Definition of done, for anything under this epic

- **No new type.** `discipline` and `activity` are properties a view configures, with
  vocabularies the vault names. Nothing here adds a row to
  [[Ten capabilities want seventeen new types]], and nothing here may.
- **The vocabulary is data, never text.** The values are written into notes, matched
  against and persisted, so they never enter the message catalog — the test
  [[Multilang]] states is what breaks if two people with different Obsidian languages open
  the same vault, and a discipline one of them cannot read is a note the other's view
  cannot filter. The *labels around* the values are ordinary UI text and go through the
  catalog like everything else.
- **A discipline is shown as text, never as a hue.** A chip, a group heading, a column of a
  table — its own name, drawn in the type-neutral treatments the stylesheet already has.
  [[The type palette has no unclaimed hue left]] and
  [[Every type badge is below the contrast floor]] are open against **eleven fixed** names;
  a vault-configured vocabulary has no ceiling at all, so allocating colour per discipline
  would inherit both blockers and make them unbounded.
  [[A badge when the palette is full]] bought a second axis for exactly two types and
  explicitly refused to close the question generally — this epic does not spend it.
- **A discipline never makes a note a work item.** The scope rule stands untouched: a note
  belongs to the backlog when it has a supported type or a parent
  ([[What counts as a work item]]), and adding a discipline to a loose note admits nothing.
  Anything under this epic that would extend that test to discipline-bearing notes is
  refused — the note becomes a `Task` under the item it serves, which is the whole reason
  the `Feature` → `Task` pair is reopened below.
- **Absence is a value.** An unconfigured discipline key is never written to a note, and an
  item carrying no discipline is unclassified rather than a discipline of its own: it is
  never counted into one, never grouped under a fabricated bucket, and never backfilled.
- **One gate, one plan.** Setting a discipline is a planned, gated, undoable write like
  every other, applied through the one write boundary, and never targeting a note the base
  excluded. A discipline read off a context row is not this base's vocabulary.
- **Every count says what it counted.** A discipline breakdown counts the results the base
  returned and nothing else, which is the same sentence the context-row rule already makes
  the rest of the plugin keep.
- **`Feature` becomes a legal parent for `Task`, for everyone.** The source document's own
  examples hang a UX task off a Feature, which this register refuses today; the epic
  reopens that pair rather than working around it, because the work a designer does before
  any PBI exists has no PBI to hang from. Unconditionally is the whole point — legality that
  read a property would make the same note legal and illegal as one optional key is set and
  cleared. What it costs is one pair in the register's own gate and its hierarchy table,
  one entry in what a menu offers, and a ladder that states the rung skip out loud rather
  than letting a Task inherit a rung nobody chose. No other pair is reopened by it.

## What this epic will not do

- **Decide which discipline an item needs.** The plugin reports what somebody recorded. A
  Feature that needs design and says nothing is a Feature nobody classified, and inferring
  it from the words in the title is the kind of guess this register has refused everywhere
  else.
- **Own readiness, or usability findings.** Both belong elsewhere, and **neither is written
  anywhere yet** — which is stated instead of naming an owner, because a redirect to an epic
  that does not hold the work is a dropped requirement wearing a citation. Readiness per
  discipline belongs beside [[A definition of ready]] under [[Backlog Health]], which today
  answers readiness per *item* and has no discipline in it. The usability-finding lifecycle
  — a finding accepted, converted into backlog work, deferred, rejected or resolved, and
  traceable back to the study that produced it — belongs under [[Product Evidence]], which
  today names kinds of evidence and counts them and models no finding at all; the findings
  [[Every finding, listed]] holds are health-rule findings, a different thing sharing the
  word. **A usability study's own reporting is a third note, not a half of that one** — what
  a study recorded (how many participants, whether it completed, what it concluded) and the
  per-Feature summary of it are a different question from what happens to a finding
  afterwards, and reducing either to an activity value would lose it. Each is one note
  somebody still has to write, and this bullet is where that debt is recorded until they do.
  **The cross-discipline overview is a fourth**: a table of every Feature against every
  discipline, answering what *blocks* a Feature rather than what status it is in, which is a
  projection and not a by-product of the readiness model — a readiness rule delivered without
  it leaves the reader with per-item criteria and no way to read across them.
- **Build a second board.** A board scoped to one discipline is [[Product Kanban]]'s board
  with a scope, as [[A Deliverables board]] already is, and it is that epic's precedent
  rather than a new implementation. [[An Iterations board]] is the scoped board that is
  *not* a precedent here, for a reason its own note records.
- **Become a design tool.** The artifact is made in Figma, in Miro, or in a note; the vault
  stores it and this epic tracks the work that produces it and what it belongs to. That is
  the whole of the source document's closing principle and it is adopted unchanged.
  **What makes "what it belongs to" true is also not written yet**: the link from an item to
  the journey, flow or prototype note that serves it. It is unspecified here and everywhere
  else, and it cannot be added in passing, because the name the source document gives it
  collides with the existing `Deliverable` type — a ranked work item with a board of its own,
  which is a different thing wearing the same word. Settling that name is the first half of
  the note nobody has written.
