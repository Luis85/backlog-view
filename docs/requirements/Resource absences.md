---
type: PBI
parent: "[[The resource timeline]]"
order: 30
status: Open
created: 2026-08-13
source: user request
---

# Resource absences

**As** someone planning who is free, **I want** to mark a resource's own unavailable
stretch, **so that** a row I am about to drop work into already shows the days nobody
should be scheduled across.

An absence is deliberately never a work item — no parent, no rank, no ladder rung — but
it is not typeless either: it carries its own declared type, `Absence`, one
`pruneOutsideHierarchy` never gets asked about because the exclusion happens earlier and
UNCONDITIONALLY, where `src/domain/readItems.ts` reads each note, before a `RawItem` is
ever built and whether or not `hierarchyOnly` is on. That is the opposite polarity from a
marker ([[Milestones as their own type]]): a marker is recognized and KEPT, ranked out of the
ladder but still a `BacklogItem`; an absence is recognized and DROPPED, so a vault with
`hierarchyOnly` off — where every note a folder-scoped Base returns becomes an item —
excludes it the same way a stricter vault already would. It is a note with four facts now,
not three: which resource, a date range, read through the same assignee and date
properties [[Assignment]] and [[The timeline]] already configure, and its own type name —
the one property here that IS a second vocabulary, of exactly one value. It renders once,
in the row its own resource names, and it is never offered anywhere else this backlog
already looks.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Adding an absence from a resource's row header |
| **Preconditions** | Roadmap mode is on with the resources axis, and BOTH date properties are configured — sharper than the axis's own gate (`hasDateAxis` accepts either alone), because an absence has no descendant to infer a missing end from the way a work item does |
| **Guarantee** | An absence names exactly one resource and one date range, is never added to the tree, the board, the horizon axis or the plain dated axis regardless of the `hierarchyOnly` setting — for as long as the configured type key still names the value the note was written under, the same condition every declared type's own recognition already depends on — and is never a write target for anything else this backlog already does to a work item. |

**Main flow**

1. The user opens Add absence from a resource's row header.
2. The prompt asks for the resource, pre-filled from the row, a title, a start date and
   an end date.
3. Submitting writes a new note carrying the resource's name in the assignee property,
   the two dates in the start and target properties, its own declared type (`Absence`),
   and the title as its own — nothing else.
4. The row draws it as a blocked stretch, positioned exactly as a bar would be, in that
   resource's row only.

**Extensions**

- **1a — only one of the two date properties is configured.** Add absence does not
  offer itself: the resources axis's own gate (`hasDateAxis`) accepts either property
  alone, but an absence's range needs both ends WRITTEN, and there is nothing beneath
  an absence to infer a missing one from — so this trigger needs the sharper
  precondition above, not the axis's.
- **2a — the prompt is submitted with no resource, no start or no end.** Nothing is
  written. An absence's range needs both ends stated; unlike a work item's, there is
  nothing beneath it to infer a missing one from.
- **2b — the end is before the start.** Nothing is written either, and for the same
  reason as 2a: a written absence has no shelf of its own to fall back to the way a
  work item's reversed pair does ([[Bars from two dates]]), so there is no visible
  surface for a reversed range to land on once the note exists. The prompt is where
  this is caught, not the render.
- **3a — the folder configured for absences is not yet set.** Falls back to the
  backlog's own home folder, the same default a type with no folder of its own already
  resolves to — safe to share with every other type's notes, because what keeps an
  absence out of the tree and the other axes is its type, never its folder.
- **4a — an absence overlaps another absence, or an item's own bar, in the same row.**
  Both draw, stacked; the row's own height grows rather than either one moving to avoid
  the other.
- **4b — the resource an absence names is not on the declared roster and has nothing
  assigned to it.** It still gets a row — an absence can be the first reason a
  resource's row exists, extending
  [[Showing a resources axis on the roadmap]]'s declared-or-observed row list with a
  third source.
- **4c — deleting an absence.** From its bar's own context menu, through Obsidian's
  ordinary file delete rather than this backlog's undo — the note was never one of this
  backlog's write targets to begin with, so there is no batch for the gate to have
  captured an inverse of.
- **4d — the configuration narrows to one date property, or none, after absences already
  exist.** They stop rendering, all of them, silently — the same gate 1a already puts in
  front of creating one applies to reading them too: the reader checks both properties
  are configured before placing anything, so a note with both dates still in its
  frontmatter is not read as a one-ended ordinary bar just because the setting naming its
  other end is gone. Nothing distinguishes "this note's other key was removed from
  settings" from "this note was never a two-ended absence" — the only reading that cannot
  mislead is none at all, until both keys are configured again.
- **4e — the Base backing this view excludes the absence type from its own query.**
  Nothing here can override that: `readItems.ts` only ever sees the `BasesEntry[]` the
  Base itself hands over, plus ancestors of an actual result (`loadOutsideParents`) — and
  an absence, having no parent, can never arrive by that second path either. A Base
  scoped by folder alone, the way this repository's own `docs/Product Backlog.base` is,
  hands every note in scope to the plugin and lets this view's own settings do the
  type-based sorting, which is what lets an absence be read at all; a Base whose own
  query already narrows by type has to name `Absence` in that query too, or its
  absences never reach this view. No guarantee here claims otherwise —
  [[The resource timeline]]'s landmines name this as a property of the whole feature, not
  something this PBI builds its way out of.
- **4f — the configured type-key property is renamed after absences already exist.**
  Nothing about this feature is special here: renaming `typeKey` desyncs every note's
  frontmatter — still written under the old name — from the property the reader now
  looks for, and nothing in this vocabulary migrates a rename, absences included. A
  Milestone in the same vault stops being recognized as a marker exactly the same way,
  for exactly the same reason. What differs is the CONSEQUENCE, not the mechanism: a
  Milestone that stops being recognized becomes a wrongly-ranked ordinary item — still
  visible, wrong the way an ordinary configuration mistake is — while an absence that
  stops being recognized becomes a real-looking task, the one inversion this whole
  feature exists to prevent. That asymmetry is a reason to be careful renaming `typeKey`
  in a vault that has absences, not a reason this PBI owes a stable discriminator none
  of the other six names has: recognition already depends on a stable, currently
  configured `typeKey`, the same precondition every declared type's does.
- **4g — an absence's own frontmatter is edited directly, outside the prompt**, so one
  date is cleared, unreadable, or the range is reversed while both properties stay
  configured. 2a and 2b catch exactly this at the prompt, but the prompt is not the only
  way a note's frontmatter changes — Obsidian's own editing is always available, and
  this plugin has no way to intercept it. The read gate answers it the same way 4d
  answers a configuration that narrows: it does not render, silently, rather than
  reusing the ordinary bar math to draw a one-ended or reversed range as something it is
  not. Reading one broken absence differently from reading a whole vault with too few
  configured properties would be two rules for one fact — a range this axis cannot
  trust to be what it claims — so 4d's own gate (both ends present and in order) is
  asked of each absence's OWN values, not only of the settings, and answers the same
  way either time: no shelf exists for a written absence to fall back to
  ([[Bars from two dates]] is a work item's answer, and 2b already says why it does not
  reach here), so the only reading that cannot mislead is none at all.
- **4h — a note already carries `type: Absence` before this feature ever ships**, an
  ordinary custom value nobody had reserved. Every other name this vocabulary has ever
  added only RECLASSIFIES such a note — "a note typed something else is still handled:
  it keeps its name and carries the ladder through" — because every other addition is
  KEPT polarity, the same way Milestone reclassifies a same-named note rather than
  removing it. `Absence` is the first addition that is DROPPED polarity, so a vault with
  a coincidentally-named note has it vanish from every projection the moment this
  feature ships, not merely render differently. Accepted as the honest cost of a plain,
  guessable name a user has to be able to type into their own Base query too (extension
  4e) — an obscure, collision-proof string would trade a rare migration surprise for an
  everyday usability cost on every vault, not only the unlucky one — but worth a
  release-note callout naming the newly reserved value, the same way expanding this
  fixed vocabulary at all has always been a considered act rather than a silent one
  ([ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md)).

## Acceptance criteria

- Add absence offers itself only when both date properties are configured — the
  resources axis's own precondition (either property alone) is not enough, since an
  absence cannot infer a missing end.
- Reading and placing absences is gated on that same both-properties condition, not only
  creating one: if the configuration narrows to one property or none after absences
  already exist, none of them render until both are configured again — never read as a
  one-ended ordinary bar from whichever single key is still configured.
- The same validation the prompt applies (both ends present, end not before start) is
  applied again when reading each absence back, not only when the properties are
  configured: a note whose own frontmatter was edited directly into a missing or
  reversed range does not render either, since a hand edit can produce the exact
  invalid shapes the prompt was built to refuse, and this plugin cannot intercept that
  edit to catch it any earlier.
- Submitting the prompt with a resource, a title and both dates writes one new note
  carrying exactly those facts — no parent, no order, and its own declared type
  (`Absence`) rather than one from the ladder.
- That type is recognized and the note excluded from the model unconditionally — before
  `RawItem` is built, whether or not `hierarchyOnly` is on — never relying on lacking a
  parent or a supported type the way an ordinary untyped note is excluded.
- `Absence` is a standalone constant, never a member of `ALL_TYPES`: it is never offered
  as a creatable type in the ordinary New flow, never a focus target, never grouped on
  the work-item shelf, never listed as a declared type in the generated manual — every
  consumer of `ALL_TYPES` is unaffected by construction, since none of them reaches past
  that list. Its configured folder is resolved by its own small path that reuses the
  same per-type resolution shape without joining the list that drives it.
- A pre-existing note using `Absence` as an informal custom type value stops appearing
  in every projection once this feature ships, the same way declaring a new name into
  this vocabulary has always changed what that name means — accepted rather than
  engineered around, and worth a release-note callout naming the newly reserved value.
- A blank resource, start or end writes nothing; an end before the start writes nothing
  either, caught at the prompt rather than left to a render with nowhere to show it.
- The note lives in its own configured folder, falling back to the backlog's home
  folder when unset.
- The absence renders as a blocked stretch in its own resource's row, positioned by the
  same date math a bar uses, and nowhere else — and only ever for a note the Base's own
  query actually returns; a Base whose query narrows by type has to include the absence
  type, the same dependency every other declared type here already has on the Base
  returning it.
- A resource named only by an absence still gets a row.
- Overlapping bars and absences in one row stack, with no lane-packing.
- Deleting an absence removes the note through Obsidian's own delete.
- Renaming the configured type-key property after absences already exist is not
  migrated — the same non-guarantee every declared type's recognition already carries —
  though the consequence is sharper here: a note that stops being recognized as an
  absence can become a real-looking task rather than merely a mis-styled one.

## Where it lives

Unbuilt, and the one PBI in this feature that is not an extension of an existing write
path. Reading and placing an absence would be new, small code beside
`src/domain/roadmap.ts` rather than inside it — an absence is deliberately never a
`BacklogItem`: `src/domain/readItems.ts` (`createItems`/`addItem`) would recognize its
declared type and skip the note before a `RawItem` is built from it, unconditionally,
never reaching `pruneOutsideHierarchy` — which runs only when `settings.hierarchyOnly`
is true (`buildModel` in `src/domain/model.ts`) and would therefore be the wrong gate
for an exclusion that has to hold either way. Because `readItems.ts` throws a skipped
note's data away rather than keeping it anywhere, the new reader would need its own look
at the same `entries: BasesEntry[]` `buildModel` already takes (sourced from
`this.data.data` in `src/view/backlogView.ts`) — the same list, read a second time for
the opposite type — rather than an independent vault scan: extension 4e is the
consequence of that choice, not an oversight it leaves open. The type name itself —
`Absence`, matching `Milestone`'s own capitalization and Title Case — would live in
`src/domain/typeVocabulary.ts` beside the other three categories but join NONE of
them, opposite `MARKER_TYPES` in polarity for the read (a marker is recognized and
kept, ranked out of the ladder but still read; this is recognized and dropped, never
read at all) and, unlike a marker, never folded into `ALL_TYPES` either. `ALL_TYPES` is
what admits a name everywhere a work item's name matters — `childTypeChoices` offers
every entry at the top level (`itemTypes.ts`, `if (!parent) return ALL_TYPES`),
`focusTarget` accepts one as a focus root, `shelf.ts` groups by it, `backlogReadme.ts`
and the in-app manual document it as a declared type — and every one of those is
exactly what an absence must refuse: never a creatable type
(Add absence is its own prompt, not the type-picker New flow), never a focus target (it
never reaches the tree to focus on), never grouped on a shelf built for work items it
never joins. A standalone `ABSENCE_TYPE = 'Absence'` constant keeps the one thing it
DOES need — a configured folder — without buying everything else `ALL_TYPES` membership
grants along with it: `typeFolderKey('Absence')` still names its option
(`typeFolder.absence`, the same naming convention every other type's folder option
already uses), resolved by its own small call beside wherever
`resolveFolders(..., ALL_TYPES, ...)` runs today (`src/domain/settingsResolve.ts`)
rather than by joining the list that call already iterates. Every consumer of
`ALL_TYPES` sees nothing new by construction, since none of them reaches past that one
list — the only edit any of them needs is none. Creating and deleting one would still
go through `src/storage/frontmatter.ts`, the only module allowed to touch the vault, behind
the same `configProblems` gate every other write here answers to — a narrow function
beside `createBacklogItem` rather than a call to it, since an absence has no parent and
no rank for that function's `NewItemSpec` to carry, and its type is a fixed constant
rather than one `NewItemSpec` chooses from the ladder. The prompt itself would sit
beside `ValuePromptModal` in `src/ui/prompts.ts` — one more small form asking for values
this plugin does not own.
