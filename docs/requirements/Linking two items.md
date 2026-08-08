---
type: PBI
parent: "[[Dependencies]]"
order: 30
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# Linking two items

**As** someone stating that one thing waits for another, **I want** to pick the
prerequisite from a menu, **so that** the ordering can be recorded without a timeline, a
pointer, or a date on either note.

This is the path that has to exist. WCAG 2.2 SC 2.5.7 requires a single-pointer
alternative to every dragging movement — the obligation the board and the roadmap already
carry ([[Keyboard, menu and touch]], [[Keyboard and menu on the roadmap]]) — so
[[Draw a dependency between bars]] is a second way to do this one, never the only way, and
this note ships first for that reason. It also reaches further than the drag can: a
dependency is a property of the note, not of the timeline, so it is offered wherever a
work item renders — a tree row, a board card, a roadmap row — and two undated items can be
ordered long before anyone decides when either happens.

The offer is asked of the **plan**, never of a comparison written beside it: an entry that
would write nothing is not offered. That rule is here because it has already been broken
here — the Set menus' checkmarks drifted from their plans the moment a second property
joined — and a suggester full of picks that quietly do nothing is the same defect wearing
a different control.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user opens the context menu on a work item |
| **Preconditions** | The dependency property is bound ([[Dependencies as a property]]) |
| **Guarantee** | The write lands on the item the menu was opened on and on no other note; it is one batch through the one gate, taken back by one undo. A note the Base excluded is never written to and never offered as a target of a write. Every offer is one that would change something. |

**Main flow**

1. On a result, the menu offers **Depends on…** and, when the item already waits for
   something, **Remove dependency…**.
2. **Depends on…** opens a suggester over the Base's results, offering only picks that
   would write something: not itself, not what it already waits for, not anything that
   would close a loop.
3. Picking one plans a single write — the prerequisite appended to the dependent's own
   list — and applies it through the same gate every other write here goes through
   ([[Safe writes]]).
4. **Remove dependency…** offers what the item currently waits for; picking one removes
   that entry, and removing the last one removes the key rather than leaving an empty
   list behind.

**Extensions**

- **1a — the dependency key is unbound.** Neither entry appears. An optional property
  nobody has named is a feature this view does not have, not a disabled control.
- **1b — the item is outside the Base's filter.** Neither entry appears, alongside the
  other write actions the context menu already withholds. It renders, it parents, and that
  is all.
- **1c — the configuration has problems.** The gate refuses the batch loudly, as it
  refuses every other write while `configProblems` is non-empty. Nothing here gets its own
  variety of refusal.
- **2a — every candidate is already a prerequisite, or would close a loop.** The suggester
  says so instead of opening with nothing in it. An empty picker reads as a bug in the
  picker rather than as a fact about the plan.
- **2b — the prerequisite is a result the reader cannot currently see.** Still offered: the
  Base's results are the vocabulary, and "Show completed items" and the focus level narrow
  what is *drawn*, not what exists. The link is to a note, not to a row.
- **2c — an item outside the filter would be a legal prerequisite.** Not offered. It is
  never written to here — the write lands on the dependent — but offering it would make an
  excluded note part of this base's vocabulary, which is the same rule that keeps its state
  out of the Set menu.
- **3a — the write takes the note out of the Base's filter.** Nothing reports it, and that
  is deliberate rather than forgotten: a filter can name the very property being written,
  so the row can leave in silence. [[The outcome report was built from one sentence]]
  records why the mechanism that would report it does not exist, and this note inherits
  that answer rather than reopening it.
- **3b — the user takes it back.** One undo, because it was one batch. A dependency write
  has no peers: it renumbers nothing, cascades to nothing, and touches exactly one note.
- **4a — the last prerequisite is removed.** The key is removed, not emptied. Absence is a
  value here as it is for every optional property, and an empty list left on disk is a
  value the reader would then have to be taught to ignore.

## Acceptance criteria

- Both entries appear only on results, only with the key bound, and **Remove dependency…**
  only when there is something to remove.
- Every pick offered would change something: a pick that would write nothing is absent, and
  absence is decided by the plan the pick would produce rather than by a comparison written
  beside it.
- A pick that would close a loop, name the item itself, or name a note outside the filter is
  never offered.
- The write lands on the item the menu was opened on and on no other note, through the one
  gate, taken back by one undo.
- Removing the last entry removes the key.
- Every string this adds goes through the catalog like every other ([[The string catalog]]).

## Where it lives

**Nothing yet — this note is design.** The entries join the others in
`src/view/interactions/menu.ts`, over the suggester machinery in `src/ui/valueSuggest.ts`
and `src/ui/prompts.ts` that the state and tag pickers already use. What the write *is* —
append or drop one entry, and drop the key when the last one goes — is planned in
`src/domain/writePlan.ts` and applied by `src/storage/frontmatter.ts`, whose `writeOptional`
already states "absence is a value, and never write to an empty key" for the state and
horizon removals; a third such property adds a call, not a rule. Which picks are legal is
the loop question `src/domain/dropTargets.ts` already answers for the tree, asked of a
second edge kind.
