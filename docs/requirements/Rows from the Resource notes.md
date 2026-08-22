---
type: PBI
parent: "[[The roster comes from the notes]]"
order: 20
status: Open
created: 2026-08-20
source: user request
files:
  - src/domain/roadmap.ts
  - src/domain/settings.ts
  - src/domain/settingsConsistency.ts
  - src/domain/viewOptions.ts
  - src/view/interactions/labels.ts
  - src/view/render/lanes.ts
  - src/view/render/roadmap.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
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
  It renders and it parents, and it is not a write target: the context-row rule, unchanged.
- **4a — an item's assignee link resolves to a note that is not a `Resource`.** No row. The
  item shelves, exactly as an unassigned one does. A link is not a declaration, and the type
  is.
- **4b — an item's assignee link does not resolve, or the value is not a link at all.** The
  same answer, for the same reason: it shelves. This is where every plain string left over
  from before [[Linking an item to a resource]] ends up, and the shelf is the right place for
  it — visible, counted, and one drop away from being placed.
- **5a — a milestone is on the axis.** Unchanged: it draws in its own row above the roster,
  never inside anybody's band ([[Milestones out of the resource rows]]).

## Acceptance criteria

- The rows are exactly the `Resource` notes in the base's results — no more, no fewer, in a
  stated order.
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

**Nothing yet — this note is design.** The axis exists and takes its roster from three places
this use case collapses into one.

`src/domain/roadmap.ts` builds the rows and is where the three sources become one ·
`src/domain/settings.ts`, `src/domain/viewOptions.ts` and `src/domain/settingsConsistency.ts`
are where `resourceNames` and its warning are removed · `src/view/interactions/labels.ts`
holds the append-to-roster write that goes with it · `src/view/render/lanes.ts` and
`src/view/render/roadmap.ts` draw the rows and the empty state.
