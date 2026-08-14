---
type: PBI
parent: "[[The resource timeline]]"
order: 30
status: Done
created: 2026-08-13
source: user request
files:
  - src/domain/absences.ts
  - src/domain/itemTypes.ts
  - src/domain/model.ts
  - src/domain/readItems.ts
  - src/domain/roadmap.ts
  - src/domain/settingsResolve.ts
  - src/domain/typeVocabulary.ts
  - src/domain/viewOptions.ts
  - src/storage/absenceNotes.ts
  - src/storage/frontmatter.ts
  - src/ui/prompts.ts
  - src/view/host.ts
  - src/view/interactions/absences.ts
  - src/view/manual/setupSection.ts
  - src/view/render/lanes.ts
  - src/view/render/legend.ts
  - src/view/render/timeline.ts
  - styles/lanes.css
  - styles/legend.css
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
2. The prompt asks for the resource, pre-filled from the row, a start date and an end
   date.
3. Submitting writes a new note carrying the resource's name in the assignee property,
   the two dates in the start and target properties, and its own declared type
   (`Absence`) — nothing else stored, and no title typed: the note's name is derived
   from those three facts by `absenceTitle`.
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
- **4i — editing one already placed** (added 2026-08-14). Beside the delete on that same
  menu, opening the SAME form Add absence opens, pre-filled: one field list, one validator,
  one set of refusals, so the two acts cannot come to disagree about what an absence is.
  Changing the resource or either date rewrites the frontmatter in place and renames the
  note to match — because the note's name is derived from exactly those three facts (4l),
  so an edit to any of them IS a rename. Through Obsidian's own rename, so any link naming
  it follows. Outside the gate for 4c's reason, and so outside the undo: what takes an edit
  back is the file history every other note has.
- **4j — an edit whose write fails.** Reported, never silent, the shape 4c's own failure
  already has. The frontmatter is written BEFORE the rename, deliberately: a rename that
  landed first and then failed would leave a note named for a stretch it does not hold,
  while this way the worst outcome is the right dates under the old name — visible, and
  fixable from the same menu.
- **4k — the stretch also shades the band's own work rows** (added 2026-08-14). The same
  unavailable days are drawn over the bars of every work row in that band, so a bar and
  the stretch it crosses are read on one line rather than two — which is what the user story
  above asks for and what a line of its own could not give: the collision was the hardest
  thing on the band to see. **4a is unchanged**: both still draw, stacked, and nothing moves
  to avoid anything. This is an ADDITION beside the named line and never a replacement for
  it, because that line is the surface carrying the title, the dates and the Edit/Delete
  menu — a resource whose only content is an absence (4b) would otherwise get a row with
  nothing in it to act on. A stretch the drawn window cannot reach shades nothing at all,
  since the shading would then colour days it does not cover. See
  [[An absence read fainter than the decoration behind it]].
- **4l — the title is derived, not asked for** (added 2026-08-14). The form asks for the
  resource, a start and an end, and the note is named `<resource> away <start> → <end>`
  (`absenceTitle` in `src/domain/absences.ts`, the one producer, so the create path and the
  edit path cannot disagree). Both dates are in it so two absences never collide and
  `uniqueNotePath` never appends a number — a basename is read in the explorer, in search
  and in a link, none of which has a row beside it to supply the dates. **A hand rename does
  not survive the next edit**: rename the note in Obsidian, change a date, and it takes the
  derived name back. Accepted rather than engineered around — the alternative is comparing
  against the name the OLD facts would have produced, a second rule whose failure mode is a
  note that silently stops following its own dates. Nothing is retroactive: an absence that
  already exists keeps its name until it is edited, and `readAbsence` never required a
  derived one.
- **4m — the band header counts the stretches still to come** (added 2026-08-14). Its
  readout is `2 items / 1 absence`, the absence half counting only those whose end is today
  or later, and dropped entirely at zero. See the refusal paragraph under
  `## Where it lives` for why this is not the removed glyph returning.
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

- A placed stretch offers Edit and Delete on its own context menu and nothing else: it is
  not a work item, so none of the type, state, parent-link or rank entries belong to it.
- Editing opens the same form adding one does, pre-filled and refusing the same ranges;
  it rewrites the note in place, renames it when the facts change — the name is derived
  from them, never typed — and reports a write it could not make.
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
- Submitting the prompt with a resource and both dates writes one new note carrying exactly
  those facts — no parent, no order, and its own declared type (`Absence`) rather than one
  from the ladder — named `<resource> away <start> → <end>`, derived rather than typed.
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
  either, caught at the prompt rather than left to a render with nowhere to show it. There is
  no title to leave blank — the form has three fields.
- The note lives in its own configured folder, falling back to the backlog's home
  folder when unset.
- The absence renders as a blocked stretch in its own resource's row, positioned by the
  same date math a bar uses, and nowhere else — and only ever for a note the Base's own
  query actually returns; a Base whose query narrows by type has to include the absence
  type, the same dependency every other declared type here already has on the Base
  returning it.
- A band header reports its result bars and, when there is one, the absences whose end is
  today or later — a collapsed band included, since it is then the only surface saying so.
  A finished stretch is counted by nothing.
- A resource named only by an absence still gets a row.
- An absence renders whatever the quick filter says. The filter chooses among WORK — its
  two sets are matches and their subtrees — and a stretch is furniture of the row rather
  than a result it could match or hide, so a band minted only by an absence stays on
  screen while a filter narrows the work around it.
- Overlapping bars and absences in one row stack, with no lane-packing.
- Deleting an absence removes the note through Obsidian's own delete.
- Renaming the configured type-key property after absences already exist is not
  migrated — the same non-guarantee every declared type's recognition already carries —
  though the consequence is sharper here: a note that stops being recognized as an
  absence can become a real-looking task rather than merely a mis-styled one.

## Where it lives

**Editing** (2026-08-14) is `promptEditAbsence` in `src/view/interactions/absences.ts` over
`updateAbsenceNote` and `renameAbsenceNote` in `src/storage/absenceNotes.ts`. The prompt
gained one optional field — `editing`, the three values to pre-fill — rather than a second
modal, which is what keeps the validator and the refusals one statement. `AbsenceSpec` split
in two for the same reason the acts did: `AbsenceFacts` is what an absence SAYS and is all
an update takes, while the folder and the title decide where the note IS and belong to
creating one. The config gate runs before either form opens, from one `refusedByConfig`.

Built 2026-08-13, and the one PBI in this feature that is not an extension of an existing
write path.

The name is `ABSENCE_TYPE` in `src/domain/typeVocabulary.ts`, beside the other three
categories and a member of NONE of them — `ALL_TYPES` least of all, which is what makes
every consumer of that list need no edit: `childTypeChoices` never offers it, `focusTarget`
never accepts it, `shelf.ts` never groups by it, and neither the generated README nor the
in-app manual documents it as a declared type. `isAbsenceType` sits beside `isMarkerType`
in `src/domain/itemTypes.ts` and is its own predicate for that predicate's own reason: the
two answer opposite questions, and this one decides whether a note becomes an item at all.
[ADR 0028](../adrs/0028-absence-is-a-reserved-name-outside-the-vocabulary.md) records that
this is the first DROPPED-polarity name this fixed vocabulary has added, which is what
extension 4h costs.

What an absence IS — the record, whether the configuration can carry one
(`absencesConfigured`), and reading one back with the same validity gate the prompt
applies (`readAbsence`) — is `src/domain/absences.ts`, pure and the one place 2a, 2b, 4d
and 4g are answered. `absencesConfigured` is deliberately sharper than the axis's own
`hasDateAxis`, and it is asked of CREATING one and of READING one back from that single
definition.

**The reader sits in `addItem`, not in a second pass over the entries, and this note said
otherwise until it was built.** The projection below was that the reader "would need its
own look at the same `entries: BasesEntry[]` `buildModel` already takes — the same list,
read a second time for the opposite type". It cannot: `test/domain/modelCost.test.ts`
pins `reads === items`, one `getFileCache` per note loaded, and `addItem` holds this
layer's only call site — so a second pass over the same entries either doubles that count
or has to read through `BasesEntry.getValue()`, which the jsdom harness answers `null` to,
leaving every absence test asserting against a vault the code cannot read. The divert
therefore happens where the cache is already open: `addItem` reads `typeName` four lines
before it builds the `RawItem`, and `isAbsenceType` returns early there — unconditionally,
never through `pruneOutsideHierarchy`, which runs only when `settings.hierarchyOnly` is
true (`buildModel` in `src/domain/model.ts`) and would therefore be the wrong gate for an
exclusion that has to hold either way. What was kept lands on `RawStore.absences` and is
carried straight onto `BacklogModel.absences`; extension 4e is a consequence of reading
only what the Base hands over, unchanged by where the reading happens.

**A row's second source is `ResourceLane.absences`, a second LIST.**
[[Showing a resources axis on the roadmap]] promised the seam as "a second source appends
to `ResourceLane.bars`", and that shape is impossible: `TimelineBar.item` is a
`BacklogItem` and an absence is deliberately never one. The seam itself held — a row draws
from a list per source and the renderer walks each — so that note's sentence was corrected
rather than satisfied. `deriveLanes` in `src/domain/roadmap.ts` places them in a third pass
between the results and the context rows, through `laneNamed`, which now states the
row-minting rule once because two sources reach it: unlike a context row, an absence MAY
mint a row (4b), since it is a statement this base's own notes make about a resource
rather than a value borrowed from a note the filter excluded. It is never counted and
never shelved, the rule a context row already keeps.

Drawing is `src/view/render/lanes.ts` — a fourth `TimelineEntry` kind leading each band,
and `renderLaneAbsence`, positioned by `barGeometry` against the same window a bar is —
drawn from `src/view/render/timeline.ts`'s own entry loop, which does NOT count one as a
drawn row: the stripe alternates over work, and an absence is furniture of the row. The
blocked stretch is `styles/lanes.css`, hatched rather than filled and never state-coloured,
on `.pbl-bar-inferred`'s own argument that a mark the view did not read off a plan must not
look like one.

**The mark is drawn from a TEXT token and never from a `--background-modifier-*` one**
(2026-08-14). That second palette is what `.pbl-grid-line` is made of and the family
`.pbl-weekend-layer` draws from, so a mark built out of it cannot out-read the decoration it
sits on — which is how it shipped and how it was reported. `.pbl-absence-row`'s muting
belongs to the row's LEAD alone for the same reason: it says "this row is furniture", and
applied to the stretch it said "this mark is faint". Both are checked as the RULE rather than
as the colour, in `test/view/timelineBoxing.test.ts`, whose reach is the tokens each rule
names and nothing about what they resolve to. See
[[An absence read fainter than the decoration behind it]].

**The wash (4k) is `renderAbsenceWash`, beside `renderLaneAbsence`**, called from
`drawEntries`' own row branch — a WORK row only, since the stretch's own line already carries
the mark, a context row makes no positional claim at all, and on the dated axis there is no
band to be a member of. It is APPENDED into the row's day track, so it sits over the bar, and
that is the whole layer story: it shipped *under* the bars and was corrected the same day from
a live vault, because a wash a bar paints over marks the days that are free and hides exactly
the ones the reader is looking for. What must not be reached for either way is a `z-index`:
the track establishes no stacking context, so a layer on either element would out-rank the
sticky lead column at 2. A per-ROW wash rather than a band-height one because a band has no
container element — its top and height are knowable only by measuring after the render, the
layout read `src/view/CLAUDE.md` forbids and the reason `TimelineDrawing.laneElement` reports
per element rather than wiring a band. It is **two marks, a tint and its two EDGES**, which is
the shape rather than the numbers: a flat fill strong enough to read over a saturated bar is
also strong enough to read as a second bar, and an eye finds an edge long before it finds a
difference in fill. The percentages behind it are a tuning knob nothing here can settle.

**`crossedAbsences` in `src/domain/absences.ts` is the one place "does this bar cross a
stretch" is answered.** It judges the overlap on the days the bar DRAWS — `start ?? target` …
`target ?? start`, `barGeometry`'s own borrowing — so a one-ended bar is judged at the single
day it renders rather than treated as unbounded in the direction it has no date for; a
backlog stating targets and no starts is the ordinary case here, and the other reading would
report a crossing on nearly every stretch behind it. From DATES, never from geometry, so a
crossing outside the drawn window still marks its row: the row is where the fact lives, and a
window-derived mark would narrow it to wherever the reader happens to be scrolled. What
reports it is `noteAbsenceClash`, the dependency conflict's shape reused — a glyph in the
lead plus the words it stands for as `.pbl-sr-only` content, because the wash tells this in
colour alone and WCAG 1.4.1 refuses that. The glyph is `calendar-x` and deliberately NOT the
`user-x` every other absence control wears: that mark already means the Add absence button, an
absence row, and a resource being away, and the two facts a reader most needs to tell apart on
this axis are "this row is an absence" and "this row runs through one". A crossing is about
DAYS.

**The band header carries NO glyph saying the band holds an absence, and that is a refusal
rather than an omission.** One was built on 2026-08-14 — `lane.bars.length` is RESULT bars and
stays so, the rule a bucket's count already keeps, which leaves a band whose only content is an
absence reading `0` — and it was removed the same day, from the vault it was built for: the
stretch's own hatched row is directly beneath the header, so the `0` is never read alone, and a
fourth `user-x` in one lead competed with the Add absence button that reveals on hover in the
same place. The reading of `0` is the accepted cost, and the row below is what pays it.

**What the header DOES carry, since 2026-08-14, is a labelled readout** — `2 items / 1
absence`, `laneReadout` in `src/view/render/lanes.ts` over `pendingAbsences` in
`src/domain/absences.ts`. That is not the refusal reversed: words are not the fourth
`user-x`, so the reason above about the Add absence button is untouched, and the item half
is still RESULT bars, so a band whose only content is an absence still reads `0 items`.
What words buy that the mark could not is the two things the row below cannot say. The
count is FILTERED on today — the band draws every stretch a resource ever had, so a
finished one is exactly what must not be counted, and the reader would otherwise compare
each hatch to the today line one at a time. And it survives FOLDING, where `laneEntries`
skips the whole band and the header is the only surface left. The absence half is dropped
at zero rather than reading `0 absences`. Deliberately the opposite of the legend's rule,
which keys what the pass PAINTED and so must not key a collapsed band's swatch: the
readout is a fact about the band, and the header is drawn either way.

Creating one is `AbsencePromptModal` in `src/ui/prompts.ts` (`SchedulePromptModal`'s shape,
with no per-field clear button — an empty end is not a real answer here) opened by
`promptAddAbsence` in `src/view/interactions/absences.ts`, which runs the `configProblems`
gate BEFORE the form so no typing is taken for a write that would be refused. The write
itself is `createAbsenceNote` in `src/storage/absenceNotes.ts` — a module of its own rather
than a function beside `createBacklogItem`, because `src/storage/frontmatter.ts` is at its
line budget and because neither act goes through `applyWrites`: an absence is not a write
target of this backlog, so there is no batch, no captured inverse and no undo slot. What
they share is the rule that makes `storage/` a boundary — everything that puts bytes in the
vault is in that directory — which is why `deleteAbsenceNote` is there too, even though no
lint rule names `trashFile` the way one names `vault.create`. `uniqueNotePath` was extracted
out of `createBacklogItem` so both creators name notes the same way. The folder is
`typeFolder.absence`, resolved by passing `[...ALL_TYPES, ABSENCE_TYPE]` to `resolveFolders`
(`src/domain/settingsResolve.ts`) and offered as one more picker in
`src/domain/viewOptions.ts` — the whole per-type shape reused without any consumer of
`ALL_TYPES` seeing an entry it would have to exclude. The manual's setup entry
(`src/view/manual/setupSection.ts`) claimed "a picker per type in the fixed vocabulary",
which stopped being the whole of it and was narrowed to what is drawn.

**Neither Add absence nor Delete absence has a keyboard path**, and this is the bucket New
button's own gap in its own words rather than a new one: the pane is one tab stop with a
roving selection over `roadmap.cards`, an absence is not a card, and a row is not a
keyboard stop, so nothing selects one to act on. Both controls are `tabindex="-1"`.
Closing the gap properly means row stops, which is
[[Keyboard and menu on the roadmap]]'s work.

**That the delete cannot go through the write gate is a COMPILE-time fact, not a test.**
`ItemWrite` names a file and a set of frontmatter changes, and there is no "remove the
note" among them, so `applySafely` cannot express this at all. Recorded here rather than
driven by a check that would only be re-stating the type.

**What a live vault still owes**, because jsdom paints nothing and trashes nothing: how the
hatched stretch reads against a themed background and against a bar it overlaps; whether a
screen reader announces an absence row usefully among `option` rows, given that the row is
a plain div carrying its own `aria-label` and the same `aria-description` every row of the
band gets; and the delete's confirmation behaviour under the user's own "deleted files"
setting.

The 2026-08-14 readability increment added four to that list and **the first two are now
answered**: checked in a vault at 385 results, in light, the hatch and the wash both out-read
the weekend banding, and the wash reads as shading rather than as a second bar — once it was
drawn OVER the bars rather than under them, which is what that look found. **The swatch
question is answered too, and answered "no"**: at 10px square it read as a slashed circle among
the five colour dots, so it is 20px wide now and draws the mark's own gradient rather than a
halved copy of it. What stays owed: whether two glyphs in one lead (a dependency flag and an
absence flag, which can both land on one row) crowd the title at a narrow lead width, and all
of it in dark. The demo fixture
is pointed at the first: `demoVault()` carries Dana's `Single sign-on` (2026-07-20 →
2026-08-15) running straight through her absence (2026-08-10 → 2026-08-14), plus Sam, whose row
exists only because he is away.
