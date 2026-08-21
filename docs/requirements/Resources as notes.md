---
type: Feature
parent: "[[Resource Management]]"
order: 10
status: Active
created: 2026-08-20
source: user request
started: 2026-08-21
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Resources as notes

`Resource` joins the type vocabulary as a **marker**, beside `Milestone` and `Iteration`: no
rung, no children, no parent, never in a rollup. A person gets a note, a badge, a folder and a
place in every menu that offers a type — and the three places that name a person today stop
naming a string and start naming that note.

**Outcome** — Who is on an item is a link to a note the reader can open, and opening it shows
a person rather than a search result for their name.

## Landmines, before implementation

**The order is the whole risk here, and getting it wrong fails silently.** These three use
cases touch one property from three directions, and two of them are already shipped code.

1. **The type comes first, alone.** `Resource` in the vocabulary changes nothing about
   `assignee`: notes get a badge and a folder, and every existing string still works exactly
   as it does today. That is deliberate — it is the one step that can land without breaking a
   vault, and it is what the other two have to exist against.
2. **The link is second, and it is the breaking change.** The value shape changes, so every
   reader of the assignee property changes with it: the chip, the menu, the roadmap row and
   the drop target. A reader missed here does not throw — it compares a link against a name,
   finds no match, and quietly draws an empty row or an unassigned card.
3. **The absence is third, and it is the one nobody will think of.** `Resource absences`
   shipped writing the assignee key as a plain string from a module of its own
   ([[Resource absences]]), on the reasoning that an absence is not a write target of this
   backlog. That reasoning still holds and is exactly why the absence writer will be missed:
   it does not go through `applyWrites`, so a sweep of the batch writer finds nothing. Leave
   it out and a resource has two spellings of one fact — a link on the work, a name on the
   absence — and the absence stops landing in the row it is about.

**The seam that fails quietest is case-insensitive name matching.** The current roster union
compares names case-insensitively on purpose, because a typed name is what mints a row. A link
resolves or it does not, and there is no middle answer to keep — so every place still folding
case over a resource name after step 2 is a place still thinking in strings.
