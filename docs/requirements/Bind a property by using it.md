---
type: PBI
parent: "[[Dependencies]]"
order: 60
status: Done
closed: 2026-08-11
priority: P2
created: 2026-08-11
source: user request, after the dependency connector was reported missing in a base that had never named the property
---

# Bind a property by using it

**As** someone meeting a feature for the first time, **I want** the action itself to name
the property it needs, **so that** a feature is not invisible in exactly the vault that
has never used it.

The loop this closes is stated in [[Backfill missing properties]] and was left standing
by it: Obsidian's own property picker offers the properties a vault **has**, so a property
no note carries cannot be picked, and a property nothing names cannot be written to a
note. Every optional property here gated its feature on a bound key, so the feature that
would create the property was withheld until the property existed. ✨ is one way out of
that and it is a bulk one — it binds every unnamed property at once, on a button nobody
presses before they know what it does.

The other way out is smaller and belongs to the feature: **the action binds the key it
needs, at the moment it first needs one.** The gate does not disappear, it changes its
question — from *is a key bound* to *could one be* — and the difference is the whole
increment. A base that has never heard of prerequisites draws the connector and offers
the menu entry; making the first link is what names the property.

This note builds that for the dependency property only. The same shape is owed to the
state, the assignee and the two date keys, and is recorded as
[[A property gates its own feature into invisibility]] rather than built here: each is a
different set of surfaces, and the horizon and the risk level need a declared vocabulary
that no action can invent.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner meeting dependencies for the first time |
| **Trigger** | **Depends on…** is picked, or a link is dragged between two bars, in a view whose dependency property is unnamed |
| **Preconditions** | The view options are valid; nothing has named the dependency property and nothing has cleared it |
| **Guarantee** | One action binds one option and writes one note. Nothing already set is changed, nothing cleared is revived, and a refusal costs no configuration change: the `.base` is never left altered by an action whose write did not land. |

**Main flow**

1. The dependency feature renders wherever it would with the key bound — the two menu
   entries ([[Linking two items]]) and the bar connector
   ([[Draw a dependency between bars]]) — because what gates it is now whether a key
   *could* be bound rather than whether one is.
2. The user picks a prerequisite, or drops one bar on another. The write is planned
   exactly as it is with the key bound: same function, same batch, same undo
   ([[Linking two items]]).
3. Before the batch is applied, the view binds this view's suggested key for the
   dependency property — the same key ✨ would bind, from the same table, by the same
   rules — and rebuilds against it.
4. A notice names what was set up, after the fact.
5. The batch lands, and the note carries a prerequisite in a property the vault now has.

**Extensions**

- **1a — the option was CLEARED.** The feature is off: neither entry, no connector, no
  drop target. Clearing is how a user says *not this one*, and an action that quietly
  turned it back on would be overruling them — [[Backfill missing properties]] 2b's rule,
  which this feature reuses rather than restates. This is the only configuration in which
  the feature is now absent.
- **1b — the suggested key is already spoken for.** Also off, and by the same predicate:
  a key another property owns is not adoptable, so binding it would be reported as a
  collision and would block every write in the view. What the user sees is a feature that
  is not there, rather than a control whose write could not land.
- **1c — the key is already bound.** Nothing about this note applies: the feature was
  always available in that configuration, and step 3 binds nothing.
- **3a — the view options collide.** Nothing is bound and nothing is written, and the
  notice names the collision. The write would be refused by the gate in any case
  ([[Safe writes]]); what this adds is that the refusal costs no configuration change —
  [[Backfill missing properties]] 2d's rule, asked of the one-property path.
- **3b — the option changed while the picker was open.** Cleared, or pointed at by
  another property, since the entry was drawn. Nothing is bound, nothing is written, and
  the notice says so — the same staleness every other pick in [[Linking two items]]
  re-asks for rather than assumes away.
- **4a — a second link is made later.** Nothing is bound: the key is named now, so step 3
  finds nothing to adopt and says nothing.
- **5a — the write fails or is refused.** The binding stays. It is a valid configuration
  either way, it is what the picker in the view settings now shows, and taking it back
  would leave the user unable to retry the very action they just attempted.

## Acceptance criteria

- With the dependency property unnamed, the menu offers **Depends on…** and a drawn bar
  carries its connector.
- Making the first link binds the suggested key in the view options **and** writes the
  prerequisite to the note — both, in one action, since neither half is usable alone.
- A second link binds nothing.
- An option the user set is never changed, and one the user cleared is never revived —
  with the option cleared, the feature is absent exactly as it was before this change.
- Nothing is bound while the view options collide, or when the suggested key is already
  spoken for.
- What was set up is named in a notice, after it happened.

## Where it lives

`src/domain/optionalProperties.ts` (`adoptableProperties`, whose `only` argument is the
whole of the domain half: it filters the FINISHED list rather than skipping the loop
early, because whether a field may adopt depends on what the fields declared before it
have claimed) · `src/view/backlogView.ts` (`adoptDefaultProperties`, still the one place
this plugin writes an option the user did not turn — one method with an optional field
rather than a second one beside it) · `src/view/interactions/dependencies.ts`
(`dependenciesAvailable`, the widened gate, and `bindDependencyKey`, which runs the
`configProblems` check before touching the `.base`) ·
`src/view/interactions/linkDrag.ts` and `src/view/render/timeline.ts` (the same gate, at
the drag and at the connector).

Driven in `test/view/dependencyBinding.test.ts` from this note's criteria — the subject
there is the OPTION, so it asserts on the view config's own `set` calls rather than on
frontmatter. The availability half is asserted where each surface lives:
`test/view/dependencyMenu.test.ts` for the entries and
`test/view/linkDrag.test.ts` for the connector and for what wiring a bar costs.

## What it costs, measured

`wireBarLink`'s early return kept a connector and a `dropTargetForElements` registration
off every bar, every render pass, in every base that had not named the property. Only a
cleared option pays nothing now, so the bill moves to almost everyone — and it is a real
one. Browser harness, folders fixture, `?notes=800`, 811 expanded bars on the dated axis,
Chromium, median of nine `render()` calls:

| | median | run-to-run |
| --- | --- | --- |
| feature off (option cleared) | **274 ms** | 269–279 |
| dot drawn, neither half wired | 309 ms | 305–314 |
| dot drawn and wired as a drag source | 318 ms | 313–321 |
| as shipped — plus the drop target per bar | **318 ms** | 318–319 |

About **16%**, and the split is the useful part: ~35 ms of the 44 is the connector
`<button>` itself — 811 more DOM nodes at the same per-node cost the rest of the render is
made of — while both wirings together are ~9 ms, inside the spread.

That contradicts the mitigation this note proposed before it was measured. Registering the
drop targets when a link drag starts would buy almost nothing: the cost is the handle, and
the handle is the feature. What would actually move it is drawing fewer bars, which is
[[The render is the whole cost of a data update]]'s axis and not this one's. The number is
recorded here so the same argument does not have to be had from scratch for the four
properties in [[A property gates its own feature into invisibility]] — and so that it is
had with a measurement rather than with a guess, which is what happened here first.
