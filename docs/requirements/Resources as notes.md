---
type: Feature
parent: "[[Resource Management]]"
order: 10
status: Done
created: 2026-08-20
source: user request
started: 2026-08-21
finished: 2026-08-29
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: "[[Eratic Skunk]]"
---

# Resources as notes

`Resource` joins the vocabulary as a name **recognised in order to be refused**, beside
`Absence`: a resource note is dropped before it becomes an item, so it appears in no
projection the backlog view draws and no write of this view's ever lands on one. A person is
pointed at by the plan and contains none of it. The three places that name a person today
stop naming a string and start naming that note.

It was specified as a **marker** first — a badge, a folder, a place in every type menu — and
that shipped for a day before being reversed; [[A resource is not a backlog item]] records
what it cost and why. Nothing under this feature should reach for the marker category again.

**Outcome** — Who is on an item is a link to a note the reader can open, and opening it shows
a person rather than a search result for their name.

## Landmines, before implementation

**Spent, 2026-08-29.** All three use cases below have shipped in the order this section
names — [[A resource is not a backlog item]], [[Linking an item to a resource]] and
[[An absence names its resource by link]] are all `Done` — so what follows is now a record
of the risk that was planned for rather than a warning still ahead of anybody. Left in
place rather than deleted, because the order was the whole risk and a future resource
property invented the same way should read why this one was sequenced.

**The order is the whole risk here, and getting it wrong fails silently.** These three use
cases touch one property from three directions, and two of them are already shipped code.

1. **The type comes first, alone.** `Resource` in the vocabulary changes nothing about
   `assignee`: the name is recognised and its notes are kept out of the backlog, and every
   existing string still works exactly as it does today. That is deliberate — it is the one step that can land without breaking a
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
