---
type: PBI
parent: "[[Test coverage]]"
order: 20
status: Open
priority: P2
created: 2026-08-08
source: user request
---

# Linking a test to what it covers

**As** someone writing a test, **I want** to pick the item it covers from a menu, **so
that** the link is made where I am already working instead of by hand-editing frontmatter
and hoping the name matches.

[[Linking two items]] built this control for the dependency property and settled every
question that is not about coverage specifically: the offer is asked of the **plan** so
that no pick writes nothing; the remove entry appears whenever the note carries the key at
all, since a value the reader discarded is still a value on disk; removing the last entry
removes the key rather than leaving an empty list; and the whole thing is one batch through
the one gate, taken back by one undo ([[Safe writes]]).

Two things are this property's own. The menu appears on **tests**, not on work items,
because the test does the naming — a **Covers…** entry on a PBI would write to the test
from the wrong note and would be the reverse direction [[Test coverage]] refused. And the
suggester lists **work items**, never tests, which is the one place this control knows
something the dependency picker did not need to know.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user opens the context menu on a `Test suite` or `Test case` |
| **Preconditions** | The coverage property is bound ([[Coverage as a property]]) |
| **Guarantee** | The write lands on the test the menu was opened on and on no other note; it is one batch through the one gate, taken back by one undo. A note the Base excluded is never written to and never offered as a target of a write. Every offer is one that would change something. |

**Main flow**

1. On a test that is a result, the menu offers **Covers…** and, whenever the note carries
   the key at all, **Remove coverage…**.
2. **Covers…** opens a suggester over the Base's results, offering **the rows that can
   display a coverage count** — [[Untested work names itself]]'s own population — less what
   this test already covers, itself, and anything already named.
   That population and not a near-miss for it, because two different rows fall through a
   near-miss. "Work items" admits a `Task` beneath a `Test case`, a work item by type and a
   catalog member by parentage ([[Tests stay out of the plan]] 2b). "The plan's population"
   admits a `Milestone`, which is in the plan and carries neither a count nor an untested
   signal, being a marker rather than work. Either pick writes a real edge whose effect is
   displayed nowhere, so step 5 promises a change the user cannot see — the same failure,
   twice, from two different approximations of one list.
   Which is the argument for naming the list rather than describing it: the suggester and
   the row renderer answer the same question, and every attempt here to restate that answer
   in the suggester's own words has been wrong about some row.
3. Picking one plans a single write, the item appended to the test's own list, and applies
   it through the same gate every other write here goes through.
4. **Remove coverage…** offers everything the list holds — each covered item by name, each
   entry that became no edge by the raw text it holds — and picking one removes every entry
   that line stands for. Removing the last removes the key.
5. The count on the covered item's row changes on the batch's own refresh
   ([[Untested work names itself]]), because the edge it counts has changed. Nothing is
   written to that note.

**Extensions**

- **1a — the menu is opened on an `Epic`, `Feature`, `PBI` or `Task`.** Neither entry is
  offered. There is no **Covered by…** on a work item, and its absence is the direction
  rule enforced at the only control that could break it.
- **1b — the test is a context row.** Neither entry is offered, and neither is any other
  write. An excluded note is never a write target, and its coverage claims are not this
  base's facts anyway ([[Coverage as a property]] 3c).
- **2a — every result is already covered by this test, or the base returned no work items
  at all.** **Covers…** is not offered. A suggester whose every pick writes nothing is the
  defect this rule exists to prevent, and an empty one is its limiting case.
- **2b — the item the user wants is not in the base.** It cannot be offered, and nothing is
  loaded to find it. The user can still write the entry by hand, where it will resolve or
  be marked broken by [[Coverage as a property]]'s ordinary rules — which is the same
  answer [[Linking two items]] gives, for the same reason.
- **2c — the suggester would offer a test.** It does not. Coverage of a test *by* a test is
  legal in the data ([[Coverage as a property]] 3e) and is not offered by this control,
  which is a deliberate narrowing rather than a rule: what the picker offers is the common
  case, and the property stays more permissive than its menu.
- **3a — `configProblems` is non-empty.** The write is refused loudly by the gate, like
  every other write, and the menu does not need to know why.
- **4a — the list holds nothing the view can name.** The one thing offered is to remove the
  key itself, [[Linking two items]]' answer to the same situation.

## Acceptance criteria

- **Covers…** and **Remove coverage…** appear on test types only, and on no work item type
  — both halves asserted, since the missing half is the direction rule.
- The suggester offers exactly the rows that can display a coverage count, excludes what is
  already named, and is not offered at all when it would be empty. Asserted with **both**
  near-misses present in one result set — a `Task` beneath a `Test case`, and a
  `Milestone` — since each is admitted by a different wrong version of this rule and a
  fixture holding one of them passes the other's.
- The suggester's population and the count's are **the same list**, not two lists that
  agree. Checkable by asserting that every row the suggester offers would display a count
  if covered, over a result set holding a marker, a catalog `Task` and a plan `Task` — the
  three rows where "eligible" and "in the plan" come apart.
- A pick writes to the test and to nothing else, as one batch through the gate, undone by
  one undo.
- Removing the last entry removes the key, leaving no empty list behind — the state
  [[Coverage as a property]]'s stub exemption exists so that ✨ never creates.
- A test that is a context row offers neither entry.
- The control appears wherever a test renders and a menu opens, and the projection it is
  in does not change what it does.

## Where it lives

**Nothing yet — this note is design.** The menu is `src/view/interactions/menu.ts`, the
suggester `src/ui/valueSuggest.ts` with the item picker beside the dependency one, the
batch `src/domain/writePlan.ts` and the gate `src/view/writeGate.ts`. The type test that
decides whether the entries appear belongs in `src/domain/itemTypes.ts`, where every other
"what may this type do" question is already answered, rather than as a comparison written
inside the menu.
