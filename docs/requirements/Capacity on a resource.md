---
type: PBI
parent: "[[What a resource carries]]"
order: 10
status: Open
created: 2026-08-20
source: user request
files:
  - src/domain/settings.ts
  - src/domain/settingsResolve.ts
  - src/domain/optionalProperties.ts
  - src/domain/viewOptions.ts
  - src/domain/readItems.ts
  - src/view/render/lanes.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Capacity on a resource

**As** a delivery lead, **I want** each resource to state how much they can take on, **so
that** the row I am about to drop work into says what it can hold instead of leaving me to
remember that one of these people is part time.

**Capacity is one plain number on the resource's note, and the unit is not a second one.**
This view names the key like every other key it reads, and the unit is **one string in the
view's own options**, stated once for the whole view. That is [[Capacity against commitment]]'s
rule, arrived at for a release and true here for the identical reasons: two unit properties
let two resources disagree about the unit while a reader adds them up, and a compound value
like `30 days` is a string nothing can compare.

**Nothing is computed against it.** No commitment sum, no utilization, no leveling — the epic
says why. This use case reads a number and draws it.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Opening the roadmap on the resources axis |
| **Preconditions** | The capacity key is configured, and a unit is named |
| **Guarantee** | The figure on screen is the number on the note, in the unit the view declares. Nothing is converted, summed, or inferred from anybody's work |

**Main flow**

1. The user names a capacity property, and a unit, in the view options.
2. Each `Resource` note carries a plain number on that key.
3. The resource's row states the figure with its unit beside the name.

**Extensions**

- **1a — the key is not configured.** Nothing is read and no figure is drawn. Absence is a
  value, and an unconfigured key is never written to.
- **1b — the key is configured and no unit is named.** No figure is drawn, and the view says
  the unit is missing rather than showing a bare number that means nothing. This is the same
  answer [[Capacity against commitment]] gives, and for its reason: a number without its
  denominator is a figure a reader completes with a guess.
- **2a — the note carries nothing on that key.** No figure for that resource. The row is
  unaffected in every other way.
- **2b — the note carries something that is not a number.** No figure, and the note is named
  as carrying a value this view cannot read. It is not rewritten: what a vault wrote is what
  the vault meant.
- **3a — the row belongs to a context resource.** The figure is drawn — reading is not
  writing — but nothing about it enters a count, and the row remains no write target.

## Acceptance criteria

- One key, one number, read as written. `30` is thirty of whatever the view's unit says.
- The unit is a single view option for the whole view, never a property on a resource.
- With the key unconfigured, nothing is read, drawn or written. With the key configured and
  no unit, the missing half is named rather than silently dropped.
- A non-numeric value draws no figure and is reported, not corrected.
- The capacity is drawn on the resource's row, and enters no arithmetic anywhere in this
  view.
- The key joins the optional properties the toolbar's setup action binds and backfills
  ([[Backfill missing properties]]), like every other optional key.

## Where it lives

**Nothing yet — this note is design.** Every module it names exists and none of them knows
about a capacity.

`src/domain/settings.ts`, `src/domain/settingsResolve.ts` and `src/domain/viewOptions.ts`
carry the key and the unit string · `src/domain/optionalProperties.ts` is where the suggested
name and the backfill live, so the key joins the set rather than being a special case ·
`src/domain/readItems.ts` reads the number off the note · `src/view/render/lanes.ts` draws
the row this figure appears on.
