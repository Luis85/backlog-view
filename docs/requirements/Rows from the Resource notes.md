---
type: PBI
parent: "[[The roster comes from the notes]]"
order: 20
status: Done
created: 2026-08-20
source: user request
files:
  - src/domain/readItems.ts
  - src/domain/model.ts
  - src/domain/roadmap.ts
  - src/domain/settings.ts
  - src/domain/settingsConsistency.ts
  - src/domain/viewOptions.ts
  - src/domain/vocabulary.ts
  - src/view/interactions/labels.ts
  - src/view/render/lanes.ts
  - src/view/render/roadmap.ts
  - src/view/manual/setupSection.ts
started: 2026-08-29
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

# Rows from the Resource notes

**As** a delivery lead, **I want** the resources axis to draw one row per resource note in my
base, **so that** adding somebody to the plan is making a note rather than editing a
comma-separated list in a view setting, and the roster is something I can open, link and
search.

Three sources mint a row today — a declared `resourceNames` option, every name the results
carry, and every absence's subject — and they are three because a name is all any of them had.
A note replaces all three: it is declared by existing, so the empty row
[[Showing a resources axis on the roadmap]] built the option for comes for free.

**The population is the base's own results**, like every other row this plugin draws. That is
what keeps the context-row rule intact without a new sentence: a `Resource` the base excluded
is not a row, and therefore never a drop target.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Opening the roadmap on the resources axis |
| **Preconditions** | The dated axis is available, since a resource's row positions its bars by the same two date properties |
| **Guarantee** | Every row is a `Resource` note the base returned, and every such note is a row. No row is minted by text, and no resource outside the base's results is ever drawn or written to |

**Main flow**

1. The user opens the roadmap and picks the resources axis.
2. The view collects the `Resource` notes in the results — every one, whether or not
   anything names them.
3. Each gets a row, positioned by the same dated grid [[The timeline]] draws.
4. Each item sits in the row its assignee link resolves to.
5. Everything with no row to sit in goes to the counted shelf, which is also what un-places
   it.

**Extensions**

- **2a — the results carry no `Resource` note.** The axis draws its empty state and says the
  reason plainly: the base returned no resources. It names the filter as the thing to change,
  because that is the only thing that can be wrong here — this is the cost of taking the
  population from the results, and an empty axis that does not explain itself reads as a
  broken feature.
- **2b — a `Resource` note is in the results but excluded by the filter as a context row.**
  It renders and it parents *nothing*: `divertResource` (`src/domain/readItems.ts`) keeps a
  resource on `RawStore.resources` only when the base actually returned it (`entry !== null`),
  so a context-row `Resource` never reaches `model.resources` at all, mints no lane, and is
  never a drop target. Restated 2026-08-29, correcting this note's own earlier claim that it
  "renders and it parents" — the context-row rule is kept once, at the keeping, rather than
  at every consumer that would otherwise have to remember it.
- **4a — an item's assignee link resolves to a note that is not a `Resource` in the results.**
  No row. The item shelves, exactly as an unassigned one does. What decides this is
  RESOLUTION, not spelling: the value may be a wikilink or a bare name, and either is asked
  the identical question — does it resolve to a `Resource` this base returned. Restated
  2026-08-29 after automated review on PR #207 found this note assuming the reader refuses a
  bare name, which it never did.
- **4b — an item's assignee link does not resolve, or resolves to something that is not a
  `Resource`.** The same answer, for the same reason: it shelves. This is where an assignee
  naming somebody with no `Resource` note behind them ends up — whether written before
  [[Linking an item to a resource]] shipped or typed since — and the shelf is the right place
  for it: visible, counted, and one drop away from being placed. Restated 2026-08-29 for the
  same reason as 4a: a bare name that DOES resolve to a `Resource` in the results is not this
  extension, it is the main flow.
- **5a — a milestone is on the axis.** Unchanged: it draws in its own row above the roster,
  never inside anybody's band ([[Milestones out of the resource rows]]).

## Acceptance criteria

- The rows are exactly the `Resource` notes in the base's results — no more, no fewer,
  alphabetical by note title through `localeCompare` (a path tie-break when two share a
  title), the same collation `collectObservedAssignees` used for the option this note
  replaces — following the USER's locale, because a name is data.
- A resource with nothing assigned still gets a row. That is what the removed option existed
  for, and it must not be lost with it.
- `resourceNames` is **removed**, not deprecated: the option, its parsing, the comma
  separator's escaping rule, and the write that appended a newly assigned name to it. A
  setting that is read by nothing is a setting that tells the user something untrue.
- The consistency check that warns about the axis is restated in terms of notes rather than
  the removed option, or it warns about a setting nobody can set.
- Nothing reads the vault outside the base's results to find a resource.
- An item whose assignee does not resolve to a `Resource` in the results shelves, and the
  shelf's count says how many.
- The empty state names the base filter, and appears when the results hold no `Resource` at
  all.

## Where it lives

`src/domain/readItems.ts` is where a `Resource` note first stops being a candidate item:
`divertResource` keeps it on `RawStore.resources` only when the base's own filter returned it
(`entry !== null`), which is what makes 2b hold without a second check anywhere downstream.

`src/domain/model.ts` sorts that roster once, alphabetically through `localeCompare` with a
path tie-break, into `BacklogModel.resources` — the one list every other module reads rather
than re-deriving — and builds `resourceLabels`, the collision-aware name each row and every
menu entry shows.

`src/domain/roadmap.ts`'s `deriveLanes` is where the three former sources become one: it
builds exactly one `ResourceLane` per `model.resources` entry, keyed by path in a `Map`, and
`placeAssigned`/`placeContextLane` resolve an item's row through that map rather than through
a name comparison — which is what makes 4a and 4b answer identically, since resolution is the
only question either asks.

`src/domain/settings.ts`, `src/domain/viewOptions.ts` and `src/domain/settingsConsistency.ts`
are where the declared `resourceNames` option, its parsing and its own consistency warning
were removed — the axis is CONFIGURED the moment the two date properties are, whatever the
base's results turn out to hold. `src/domain/vocabulary.ts` lost
`collectObservedAssignees`, the second of the three former sources, once nothing outside its
own producer read what it collected.

`src/view/interactions/labels.ts` builds the assignee menu's roster union over
`model.resources` directly rather than over a declared list or the base's observed names.
`src/view/render/lanes.ts` draws one row per lane and `src/view/render/roadmap.ts` draws the
empty state named in 2a. `src/view/manual/setupSection.ts` describes both surfaces to the
user in the shape they now have.
