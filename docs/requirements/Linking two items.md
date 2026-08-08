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

1. On a result, the menu offers **Depends on…** and, when the item's list holds anything at
   all, **Remove dependency…**.
2. **Depends on…** opens a suggester over the Base's results, offering only picks that
   would write something: not itself, not what it already waits for, not anything that
   would close a loop.
3. Picking one plans a single write — the prerequisite appended to the dependent's own
   list — and applies it through the same gate every other write here goes through
   ([[Safe writes]]).
4. **Remove dependency…** offers **everything the list holds** — each prerequisite by name,
   and each entry that became no edge by the raw text it holds — and picking one removes
   every entry that line stands for. Removing the last one removes the key rather than
   leaving an empty list behind.

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
- **4b — the entry to remove is a broken one.** Offered like any other, shown as the raw
  text the note holds, and removed the same way — which includes 4c's rule and not merely
  its shape: one line stands for **every** repeat of that text, so
  `["[[Missing]]", "[[Missing]]"]` is gone in one action rather than leaving the identical
  marker on screen. The collapsing that makes a picker line stand for several entries is
  the reading side's, and it does not care whether the entry resolved. This is the whole cleanup path for a
  mistyped name, a self-reference or a loop-closing link, and it has to exist here or the
  marker the reader is being shown has no answer but hand-editing frontmatter — a marker
  pointing at a repair the view refuses to make. The register already settled this
  direction for the other link field: [[Broken links still render]] marks damage rather
  than tidying it, *and* clears a stale `parent` on the drop that would otherwise appear to
  do nothing. Marking is a refusal to repair **silently**, never a refusal to let the user
  repair. An unresolvable entry is also the one case with no name to offer, which is why
  step 4 is written about what the **list holds** rather than about what the item waits
  for: the resolved reading has nothing to say about a name that resolves to nothing.
- **4c — the stored list names the same prerequisite more than once.** Removing it removes
  **every** raw entry that resolves to it, not the first one found. The reading side
  collapses duplicates and differing spellings into one dependency
  ([[Dependencies as a property]]), so what the picker offers is one entry for a list that
  may hold several — `[A, A]`, or `[[A]]` beside a bare `A`. A removal that dropped one of
  them would report success and change nothing a reader could see: the next refresh
  collapses what is left back into the same single dependency, which is the shape of bug
  that gets diagnosed as "the write did not land". Removal is defined against the
  **resolved** dependency, the same unit the offer was made in, and the key goes when no
  entry survives.

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
- **Remove dependency…** offers every entry the list holds, including the ones that became
  no edge, so a broken dependency is removable here and needs no hand-edited frontmatter —
  no marker the view shows is a repair only the file can make.
- Removing a dependency removes every raw entry the offered line stands for — duplicates and
  alternate spellings alike — so it is gone after one removal rather than reappearing on the
  next refresh; removing the last one removes the key.
- Every string this adds goes through the catalog like every other ([[The string catalog]]).

## Where it lives

**Nothing yet — this note is design.** The entries join the others in
`src/view/interactions/menu.ts`, over the suggester machinery in `src/ui/valueSuggest.ts`
and `src/ui/prompts.ts` that the state and tag pickers already use. What the write *is* —
append or drop one entry, and drop the key when the last one goes — is planned in
`src/domain/writePlan.ts` and applied by `src/storage/frontmatter.ts`.

**This is a new frontmatter operation, not an existing call.** "Absence is a value, and
never write to an empty key" holds in that module today, but it is spelled twice in two
shapes rather than once: the state key guards inline on `settings.stateKey` in `applyInto`,
and the axis keys go through `axisEntries`, whose `key !== ''` test drops an unconfigured
key and whose `null` value means delete. Neither shape takes a **list**, which is what this
property is, and neither appends to or removes from one. So an implementer adds an
operation — append one entry, drop **every** raw entry a single offered line stands for
(4b and 4c alike: a resolved dependency however many times and however it is spelled, or an
entry that became no edge however many times it is repeated), drop the key when the last
goes, and write nothing when the key is unset — rather than a call to something already
written; whether it
also becomes the single statement of the rule for the other two is a refactor this note
neither needs nor forbids. Which picks are legal is the loop question
`src/domain/dropTargets.ts` already answers for the tree, asked of a second edge kind.
