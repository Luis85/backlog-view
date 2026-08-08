---
type: PBI
parent: "[[Dependencies]]"
order: 10
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# Dependencies as a property

**As** someone whose plan has an order to it, **I want** a note to name the work that
must come first, **so that** the ordering lives in the backlog rather than in the head of
whoever drew the last diagram.

The shape is the one `parent` already has: a user-named property holding wikilinks,
resolved against the same item set, read tolerantly, and never repaired on disk. What is
new is the arity — `parent` names one note and a prerequisite list names several — and
that is the whole of the new data. Direction is the one the ecosystem's own vocabulary
uses and the one that keeps writes honest: **the note that waits names what it waits
for**, so adding a dependency writes to the item the user is acting on, never to the one
they merely pointed at. The placeholder is `dependsOn`, the name the Tasks plugin already
uses for the same idea, so a vault that has one fits without renaming anything — offered
as a placeholder and never matched by name, exactly as [[Horizons or dates]] requires of
every key here.

A dependency is not a second hierarchy. The tree is `parent` and only `parent`: a cycle
in prerequisites re-roots nothing, hides nothing, and changes no item's level, depth or
rank. It is an edge drawn beside the tree, and everything structural stays where it was.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The model is built over a result set with the dependency property configured |
| **Preconditions** | The dependency key is bound in the view options; without it the feature is off everywhere |
| **Guarantee** | Reading dependencies writes nothing, repairs nothing and moves nothing. No item is hidden, re-parented, re-ranked or re-levelled by an edge — broken or otherwise. A note the Base excluded is never written to and never **declares** an edge: no edge comes from reading a context row's own list. Being *named* by a result is a different thing and is allowed, because that statement belongs to the result that made it. |

**Main flow**

1. The dependency key is resolved from the view options like every other optional key.
   Unbound, the property does not exist for this view: nothing is read, drawn or offered.
2. Each result's value is read tolerantly, the way every field here is read — a single
   entry or a list, a `[[wikilink]]` or a bare name, blanks and repeats collapsed.
3. Each entry resolves against the same item set `parent` resolves against, producing an
   edge from the prerequisite to the item that named it.
4. Entries that cannot become an edge — unresolvable, self-referential, or the one that
   closes a loop — are kept and **marked broken**, never dropped and never rewritten.

**Extensions**

- **1a — the key names a property another key already uses.** `configProblems` reports
  the collision and gates every write, exactly as it does for the state, horizon and date
  keys. A dependency key is not special enough to earn its own kind of warning.
- **2a — the value is a single entry rather than a list.** One prerequisite. Frontmatter
  spells a one-item list both ways and a reader that accepted only the bracketed form
  would make the user's YAML the user's problem.
- **2b — the value repeats a name, or holds a blank entry.** Collapsed to one edge, and
  blanks are ignored. A duplicate is a typo, not a stronger dependency.
- **3a — the entry resolves to a note the Base excluded.** The edge exists and the dependent
  row states it, but it is never counted, never drawn ([[Arrows between bars]] owns that)
  and never written to. This is the context-row rule with nothing new added, and it is worth
  being exact about which direction it governs: **an excluded note may be named, and may not
  do the naming.** The statement here was made by a result, on its own note, exactly as a
  result naming an excluded `parent` is the case that puts a context row on screen in the
  first place — it renders, it parents, and that is all. What the rule forbids is the other
  direction, 3b's.
- **3b — the item declaring the dependency is itself outside the filter.** Its list is
  not read at all. An excluded note's prerequisites are not this base's facts, the same
  reason its state is not this base's vocabulary.
- **4a — an item names itself.** Marked broken. Nothing precedes itself, and silently
  dropping the entry would leave a user staring at frontmatter the view is ignoring
  without saying so.
- **4b — the entries close a loop.** The edge that closes it is marked broken and the
  items render unchanged. [[Broken links still render]] settles the direction — mark, do
  not tidy — and the difference from a `parent` loop is worth stating: there the cut is
  what makes the tree renderable at all, so the link is cut in the model; here nothing
  needs cutting to draw anything, so only the mark exists.
- **4c — the loop is entirely between context rows.** It is not read, per 3b, so there
  is no loop to mark.

## Acceptance criteria

- An unbound key means the feature is absent: nothing read, nothing drawn, nothing
  offered in a menu, and no warning about a property nobody asked for.
- A value is read tolerantly — one entry or many, linked or bare — with blanks and
  repeats collapsed, and nothing is ever written, reordered or repaired by reading it.
- Entries resolve against the same item set `parent` resolves against, by the same rule.
- An unresolvable, self-referential or loop-closing entry is marked, never dropped: no
  item is hidden, re-parented, re-ranked or re-levelled by any edge, and the tree's own
  shape is identical with the property configured and without it.
- A context row's own list is never read, so no edge is ever declared by one, and it is
  never written to. A result naming an excluded note as a prerequisite is the allowed
  direction and produces an edge that is never counted and never drawn.
- Dependencies do not roll up: an item's prerequisites are its own, and no ancestor
  acquires them.
- Resolution adds no second superlinear step beside `sortSiblingsDeep`: it is one pass over
  the declared entries, so the model's bound becomes O(n log n + E) in the number of entries
  E. Stated in E rather than folded into O(n log n), because nothing caps how many
  prerequisites an item may name — a register where every note names every other has E in
  n², and a bound that hid that would be claiming a check nobody can run.

## Where it lives

**Nothing yet — this note is design.** The key joins the other optional property options
in `src/domain/viewOptions.ts` and their resolution in `src/domain/settings.ts`, with the
tolerant read beside the tolerant date and number in `src/domain/noteFields.ts` — the
module that already owns "what shape did the user's frontmatter take". Resolution is a
pass in `src/domain/model.ts` after `linkAll`, on the item set that phase produced, and
the marks it produces are fields of `BacklogItem` — so the question `src/domain/CLAUDE.md`
asks of every new field, *which phase owns it*, is answered by the phase that can first
see every item.
