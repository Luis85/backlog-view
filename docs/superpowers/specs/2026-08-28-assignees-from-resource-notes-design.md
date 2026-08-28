# Assignees come from the resource notes

Date: 2026-08-28 · Branch: `claude/resource-management-assignees-lmho3m`

Three open PBIs of [[Resource Management]] land together, because the value shape decided
here makes them one change:

- [[Rows from the Resource notes]] — the roster and the roadmap's rows are the `Resource`
  notes the base returned, and `resourceNames` is removed.
- [[Linking an item to a resource]] — an item names a resource by wikilink, every reader
  resolves it, and the assignee menu offers `New resource...`.
- [[An absence names its resource by link]] — the absence writer stops spelling a name.

Out of scope: [[What a resource carries]] (capacity, role, retired). The creation prompt
stays Name-only.

## Decisions taken

| Question | Answer |
| --- | --- |
| The value written to the assignee key | A wikilink to the resource's note. No fallback, no coexistence, no migration — [[No migration off the string assignees]] holds the cost. |
| Order of the rows and the menu entries | Alphabetical by note title, for both. Stable when the base's sort or filter changes, and it is what the assignee menu already does. |
| Width of the increment | The three PBIs above and nothing else. |

## 1 — The model keeps the resources it already refuses

`readItems`' resource gate stops returning a bare `null` and diverts, the shape
`divertAbsence` has one line above it: it pushes `{ file, title }` onto `store.resources`
and returns null, so no `BacklogItem` exists and nothing that walks the tree, ranks
siblings, counts a rollup or draws a projection can meet one.

**Only a note the base RETURNED is kept** — the `entry === null` guard `divertAbsence`
already carries. That is the context-row rule stated once at the keeping rather than at
each consumer: a `Resource` the filter excluded is not a row, not a menu entry and not a
drop target. This is the whole of [[Rows from the Resource notes]] extension 2b, and it
replaces that note's earlier reading that a context resource "renders and parents": nothing
downstream of this can draw one, because nothing downstream is handed one.

`BacklogModel.resources` carries the list, sorted by title through `localeCompare` — the collation `collectObservedAssignees` already uses, which follows the USER's locale because a name is data ([[Locale-aware sorting and formatting]]). No second read path into the
vault opens, and `test/domain/modelCost.test.ts`'s one-`getFileCache`-per-note pin holds
because the cache is already open on that line.

## 2 — The assignee value becomes a link

`RawItem.assigneeValue: string | null` becomes `assigneeEntry: LinkEntry | null`, read by
`readFirstLinkEntry` — the reader the iteration and the release already share, so this adds
no parsing and no new shape.

Every consumer resolves it:

- **Membership, the checkmark and the write compare by PATH**, the iteration's own rule.
  Two spellings of one note are one resource.
- **The name shown is the resolved note's title**, never the raw `[[...]]` text.
- **The rule is about RESOLUTION, not about syntax.** `readLinkList`'s raw-value fallback
  (`linkpathFromRawValue`, `src/domain/noteFields.ts`) strips brackets where there are any
  and passes a bare name through, so `assignee: Sarah` resolves to `Sarah.md` when that
  note exists — the same shape `parent` already has in this plugin. **A bare name that
  resolves to a `Resource` note in the results IS that resource**, and the item sits in
  their row. Decided 2026-08-28 after automated review found the reader does this; the
  register had assumed the opposite without checking, which is [[A comment that states a
  rule is not a check]] wearing a use case.
- **An entry that resolves to nothing is nobody.** It carries no row, no menu entry and
  no membership. That covers the deleted note, the misspelled one, and every leftover
  string naming somebody who has no `Resource` note here. It is not an error and is not
  repaired.
- **It is MARKED, not unstyled.** This spec said "unstyled" until 2026-08-28, and that was
  wrong against this repository's own precedent: [[Broken links still render]] draws a note
  whose parent link resolves to nothing at top level **with a marker**, on the stated rule
  *the view marks; it does not tidy*. An unresolved assignee drawn with the ordinary chip
  class presents a broken assignment as a valid one; drawn as bare text it reads as an
  empty cell. Both hide the one fact the reader needs. So the chip takes a **third state**
  beside set and unset: the raw text the note carries, under its own class and its own
  tooltip saying the value names no resource in this base. Found by automated review on
  PR #207, which was right that a mechanical `valueOf` swap cannot express this.
- **That third state is asked of the ROSTER, not of the link.** A link that RESOLVES is a
  different question from a link that resolves to somebody: `[[Epic B]]` finds a real work
  note, and a link to a `Resource` the filter excluded finds a real resource note. The
  roadmap shelves both and the menu offers neither, so a chip answering from resolution
  alone would draw them as valid assignments while every other surface treated them as
  nobody. One value, three surfaces, one answer. Found by automated review on PR #207.
- **Two resources can share a basename**, in different folders, and the path-keyed model
  tells them apart while their names cannot. Stated once as a rule rather than patched per
  surface, because it was found three times in two review rounds — the menu, the absence
  picker, the roadmap's row headers — and a fourth surface would have been found later:

  > **Every surface that names a resource TO THE READER names it through `namedTargets`.**
  > That is the helper `Set iteration` and `Set release` already share for this exact
  > collision — basename normally, the full path minus extension only for the ones that
  > collide, so separating a rare pair does not make the ordinary case unreadable. Widen
  > its parameter from `BacklogItem[]` to anything carrying a title and a file; a
  > `ResourceNote` already answers both. The assignee menu, the absence form's options and
  > `ResourceLane.name` all go through it.

  The roadmap's **fold key** becomes the note path for the same collision, since a key that
  cannot tell two rows apart folds both — and that is a different question from the label,
  which is why both are needed and neither substitutes for the other. Legacy name-keyed
  folds are not migrated: bands collapsed before this ships open once, which is cheaper
  than two key shapes in stored state forever. Found by automated review on PR #207.
- **Creating a resource can still land it outside the base**, and the link is written
  anyway. `createResourceNote` files into `resourceFolder`, which a narrow base may not
  return — [[Making a resource from the timeline]] extension 4b already states that as a
  limitation rather than a defect the plugin detects. `New resource...` in the assignee
  menu inherits it: the note is made, the link is written, and the item then shows a
  marked chip and sits on the shelf.

  **Deferring the link until the note is confirmed in the roster is refused**, and not on
  cost: nothing correlates a Bases pass with a write, and
  [[The outcome report was built from one sentence]] holds what happened when that was
  built anyway — eleven review findings across seven rounds without reaching a correct
  rule, then removed. What this change does do is make the outcome VISIBLE where it was
  silent: the marked chip says the value names no resource in this base, which is the true
  state and one drop from being fixed. The default keeps it rare rather than the mechanism
  keeping it impossible, exactly as 4b says. Raised by automated review on PR #207; the
  suggested fix is the one the register already refused.
- **This is a READ, so it changes nothing about the migration decision.**
  [[No migration off the string assignees]] refuses a migration because a migration is a
  WRITE over notes nobody asked to have written; resolving a name the note already carries
  writes nothing. What it does is narrow what that note LOSES: a vault whose people are
  already notes keeps its assignments, and only a name with no resource note behind it
  goes to the shelf. The note is narrowed in Task 8 rather than left claiming a wider
  loss than the code now causes.
- **Case folding over a resource name is gone.** A link resolves or it does not.
  `sameValue` has no meaning here and every site still calling it on an assignee is a site
  still thinking in strings.

## 3 — One more link writer, not a fourth shape

`ItemWrite.assignee` becomes `TFile | null` and leaves `applyLabels`.

`applyIteration` and `applyRelease` are already two statements of one rule — `wikilinkTo`
against the target note's path, an unconfigured key dropped, `null` deletes. The assignee
is the third, so they collapse into **`applyLinks`**: one loop over a list pairing a planned
file with its configured key, `applyLabels`' own shape and its own reason. `applyLabels`
keeps risk, priority and the iteration goal.

This is the case the root guide said to re-examine at, answered the way the third label
property answered it: the third instance is extracted, not copied.

`storage/writeKeys.ts` keeps the assignee key in `touchedKeys` on the same condition the
writer writes on, so a link and its removal stay undoable.

## 4 — The lanes are the resource notes

`deriveLanes` builds its rows from `model.resources`, in that list's order, keyed by
**path**.

- `laneNamed` and its minting are removed. No row is ever minted by a name again, from any
  of the three sources that could mint one.
- `ResourceLane` gains the resource's `file`; `declared` is dropped, because every row is
  now declared by a note existing and "not one of the declared resources" is a hint about
  an option that no longer exists.
- `placeAssigned` resolves `item.assigneeEntry?.file?.path` to a row. No row — unassigned,
  unresolved, or resolved to a note that is not a `Resource` in the results — shelves, and
  the shelf's count says how many.
- `placeContextLane` resolves the same way.
- **An absence names its resource by link.** `Absence.resource` becomes an entry read
  through the same reader, and an absence that resolves to no row draws nowhere: there is
  no row for it to mint, which is [[An absence names its resource by link]] extension 1a
  read from this end.
- **The absence form stops ACCEPTING a typed name.** `AbsencePromptModal`'s resource field
  is free text behind a suggester today — pre-filled from the row and, in its own comment,
  deliberately editable — so merely feeding it resource titles would still let a submission
  come back naming nobody, with no note for the link writer to point at. It becomes a
  **choice among the resource notes**: the dialog is handed `{ id, label }` pairs and
  returns the id, which keeps `ui/` importing nothing while making an unresolvable
  submission unreachable rather than only discouraged. Found by automated review on
  PR #207.
- **The empty state.** With no `Resource` in the results at all, the axis says the base
  returned no resources and names the filter as the thing to change — the only thing that
  can be wrong, now that the population is the results. **It is asked BEFORE the "did
  anything draw at all" question, never after it**: a dated milestone draws in the markers'
  row and makes `renderedCards` non-zero, so an advisory gated on that count goes quiet on
  exactly the screen that needs it — a roster of nobody under a milestone line that looks
  like the axis working. Found by automated review on PR #207.
- The milestones' row is unchanged: `markers: true`, drawn above the roster, never a
  resource ([[Milestones out of the resource rows]]).

## 5 — `resourceNames` is removed, and `declareResource` with it

Removed, not deprecated — a setting read by nothing tells the user something untrue:

- the `resourceNames` view option and its hint,
- `BacklogSettings.resourceNames`, its default and its `resolveSettings` line,
- its entry in `settingsConsistency`'s vocabulary list, and the axis warning restated in
  terms of notes,
- `mergedValues`' three-source union at both callers (`assigneeChoices`,
  `promptNewResource`'s `known`),
- **`declareResource` entirely** — the whole function and the `.base` write that appended a
  newly assigned name to the roster, with its comma-separator refusal and its
  read-at-commit-time rule. A roster that is the notes needs no declaring, so this side
  effect and the ordering rule `test/view/resourceRoster.test.ts` states from it both go.

## 6 — The menu, and `New resource...`

`Set assignee` offers, in order:

1. every `Resource` note in the results, alphabetically by title, **checked exactly when
   picking it would write nothing** — asked of the plan, never of a comparison beside it,
   which is the rule two properties have already drifted on and a link is a third value
   shape to drift on;
2. `New resource...`;
3. a separator, then `Clear assignee`, offered on the key's PRESENCE (`ownKeys.assignee`),
   never its value.

That is `addLabelItems`' existing order — the choices, then its `extra` entry, then a
separator and the clear — and this spec listed the middle two the other way round until
2026-08-28. Corrected to the code's convention rather than the other way round: the clear
is separated from the choices because it is the way OUT of them, and lifting it above a
`New...` entry would break that grouping in this one menu alone. Found by automated review
on PR #207.

**`New assignee...` is removed.** A typed name writes a value that resolves to nobody,
which is the one value this flow must not produce.

With no `Resource` in the results the menu says so — a disabled line naming the base
filter — above `New resource...`, rather than opening empty. **`Clear assignee` is not
withheld with the choices**: it is offered on the key's PRESENCE, and an empty roster is
exactly when an item is most likely to be carrying a value the reader wants gone — a
leftover string, a broken link, a resource the filter excluded. Withholding it there would
leave the note itself as the only way to clear the key, and would contradict the
presence rule one line above. A context row still gets no menu at all and a static chip.

`promptNewResource` gains an optional "then do this with the created file" callback. The
assignee menu passes one that writes the link, so **the note exists before the link names
it** and a failed creation writes no link — two writes, deliberately, because a link to a
note that does not exist is exactly what this use case must not produce. Its `known` list,
and so its duplicate warning, becomes the resource notes: the warning can now claim what it
could not on 2026-08-22.

The toolbar's `New resource` button keeps its own callback-free call.

## Error handling and refusals

Unchanged, and each already has a gate:

- The `configProblems` gate runs before the form and again at submit, both for the toolbar
  path and the menu path.
- A write aimed at an `outsideFilter` item refuses the whole batch.
- A write aimed at a `Resource` note is refused by `applyWrites`' live-type gate.
- A cancel writes nothing; a blank name refuses and writes nothing.
- An unconfigured assignee key reads nothing, writes nothing and shows no menu.

## Testing

Node tests for the domain half — the divert and its `entry === null` guard, the link read,
the path-keyed lane build, the shelf reasons, the alphabetical order, the plan and its
checkmark. jsdom for the menus, the chip, the drop, the Alt+arrow ladder and the two
creation paths. `test/view/contextRowWrites.test.ts` and
`test/view/contextCardWrites.test.ts` gain the new write path so the category invariant
holds for code not yet written.

`test/view/resourceRoster.test.ts` is deleted with the roster it tests.

## What no test here can reach

Both need `npm run test-build` and a live vault:

- how a stray leftover string reads in the chip beside a resolved resource's name, and
  whether "unstyled" is legible or looks broken;
- the resources axis's empty state, and the assignee menu holding `New resource...` alone.

## Register work

Three PBI notes move to Done with their `files` lists, `Rows from the Resource notes`'
"stated order" is stated, the `Resources as notes` feature's landmine ordering is marked
spent, and `CHANGELOG.md` gains an `[Unreleased]` entry naming the breaking change.
