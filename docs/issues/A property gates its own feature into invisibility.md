---
type: Issue
order: 90
parent: "[[Creating items]]"
status: Open
priority: P2
area: design
created: 2026-08-11
source: user request, alongside [[Bind a property by using it]]
files:
  - src/domain/optionalProperties.ts
  - src/view/interactions/labels.ts
  - src/view/interactions/plan.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A property gates its own feature into invisibility

## The limitation

Every optional property in `optionalProperties.ts` gates a feature on a bound key, and
`OptionalProperty`'s own comment states it as the design: *"Each one gates a feature — no
state property, no board; no horizon property, no bucket axis."* The loop that makes it a
limitation is stated in [[Backfill missing properties]] and was left standing by it:
Obsidian's own picker offers the properties a vault **has**, so a property no note carries
cannot be picked, and a property nothing names cannot be written to a note. The feature
that would create the property is withheld until the property exists.

✨ is the way out and it is a bulk one — one button that binds every unnamed property at
once, which is a lot to ask of someone who has not yet met any of the features. It is also
easy to never find: nothing on screen says a feature exists but is unnamed, because the
gate's whole effect is that nothing is on screen.

## What has been done

[[Bind a property by using it]] closes it for the **dependency** property only, and
establishes the shape: the gate keeps its place and changes its question, from *is a key
bound* to *could one be*, and the write binds the key at the moment it first needs one. A
cleared option still turns the feature off, which is what keeps
[[Backfill missing properties]] 2b's rule intact.

## What is left

Four properties can take that shape as it stands, because the action itself supplies the
value:

- **the assignee** — Set assignee, gated on `settings.assigneeKey`
- **the two date keys** — Schedule and Unschedule, gated through `hasDateAxis`
- **the state** — the board, the state chip and Set state, gated through `stateKeyFor`

Each is a different set of surfaces rather than a repeat of the last, which is why they
are listed rather than batched: the state key alone reaches the board's unconfigured empty
state, the chip, the row menu, the Deliverables workflow's fallback
(`resolvedDeliverableStateKey`) and the two date stamps. The state also raises a question
the dependency property did not — with no key there are no observed states, so a Set state
menu on first use has nothing to offer but `New state…`, and whether that is an invitation
or an empty control is a product decision this note does not take.

Two cannot take it at all, and that is not a gap to close later:

- **the horizon** and **the risk level** need a key *and* a declared values list
  (`hasHorizonAxis`, `hasRiskLevels`). An action can bind a key; it cannot invent a
  vocabulary, and a guessed one would be the view deciding what the buckets are.

## The cost of taking it

Stated once here because it will be the same argument each time: a gate that was false in
most bases becomes true in most bases, so whatever the gated code costs is now paid
everywhere. For the dependency property that is **~16% of the roadmap render at 811
expanded bars** — 274 ms to 318 ms, measured in the browser harness and tabulated in
[[Bind a property by using it]].

Two things that measurement is worth carrying forward. It was **wrong before it was
taken**: the cost was assumed to be the per-bar drop-target registration, and ~35 ms of
the 44 turned out to be the connector element — 811 more DOM nodes — with both wirings
inside the run-to-run spread. And it says what to ask of the next property: the bill is
whatever the feature DRAWS on every row, not what it wires, so a gate hiding a chip or a
column will cost more than one hiding a handler. Measure before removing a gate rather
than after.

## Acceptance criteria

None; recorded so the remaining four are taken up deliberately and one at a time, with the
shape [[Bind a property by using it]] already argues for, rather than swept together on the
strength of the first one having worked.
