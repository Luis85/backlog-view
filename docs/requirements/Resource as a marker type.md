---
type: PBI
parent: "[[Resources as notes]]"
order: 10
status: Done
created: 2026-08-20
source: user request
files:
  - README.md
  - src/domain/typeVocabulary.ts
  - src/view/interactions/keyboard.ts
  - src/domain/writePlan.ts
  - src/view/render/shelf.ts
  - src/domain/backlogReadme.ts
  - src/domain/itemTypes.ts
  - src/domain/bars.ts
  - src/view/render/badges.ts
  - src/view/manual/typesSection.ts
started: 2026-08-21
finished: 2026-08-21
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Resource as a marker type

**As** a delivery lead, **I want** each person on my team to be a note the plugin recognises
as a resource, **so that** a colleague is something the vault can hold facts about and the
view can list, rather than a spelling that happens to recur.

This is the step that lands **alone**. It adds a name to the vocabulary and changes nothing
about how an item says who is on it: every existing string assignee keeps working exactly as
it does today, and the roadmap's roster is untouched. What it buys on its own is small and
real — a person is a note with a badge and a folder, creatable from the view, and everything
after it has something to point at.

`Resource` is a **marker**, the third category `src/domain/itemTypes.ts` already describes:
no rung, no children, no parent, no `levelIndex`, and therefore nothing to re-type it by
position. `Milestone` and `Iteration` are the precedent and the whole of the argument — the
epic states why an eighteenth name is being added against an open P1 direction
([[Ten capabilities want seventeen new types]]), and that reasoning is not restated here.

## Use case

| | |
| --- | --- |
| **Actor** | Delivery lead |
| **Trigger** | Creating an item from the toolbar with no row selected, or setting an existing note's type |
| **Preconditions** | None. The type exists whether or not any resource property is configured |
| **Guarantee** | A `Resource` is never a rung and never a parent's child: it holds nothing, hangs from nothing, counts for nothing in any rollup, and no drag, drop, indent or reparent changes its type or gives it one |

**Main flow**

1. The user opens the toolbar's top-level creator, which offers every name in `ALL_TYPES`.
2. The user picks `Resource`, names it, and the note is written with `type` and an `order`,
   and no `parent`. **This step said "no `order`, since a marker has neither" and that was
   wrong on every count.** A marker occupies no RUNG, which is a statement about levels; it
   still sits in the root sibling group, and `order` is what ranks it there. Both shipped
   markers are the precedent and both disagree with the old sentence: every creation path
   writes `endOfSiblingsOrder`, an `Iteration`'s order is load-bearing (`iterationNoteName`
   derives its number from the highest one), and a test pins it. So does this register — its
   own `Milestone` notes carry an `order`, and `docs-check.mjs` FAILS a backlog note without
   one, so a `Resource` written the way this step described could not be filed in `docs/` at
   all. An automated reviewer read the old sentence as a promise the code owed.
3. The note is filed in the `Resource` folder, from the per-type folder key the other
   declared types already have ([[Where new items are filed]]).
4. The row renders with its own badge and hue, ranked nowhere, with no disclosure and no
   count.
5. The in-app manual and the generated README list `Resource` among the declared types, from
   the same vocabulary rather than a second list.

**Extensions**

- **2a — the user drops a `Resource` onto an `Epic`, a `Feature` or a `PBI`.** It lands,
  exactly as a `Milestone` dropped there lands, and the note is left nested. **This
  extension said "refused" and that was wrong** — no marker is refused a drop, because
  nothing here is: *the rules decide what is OFFERED, never what is refused*
  (`src/domain/CLAUDE.md`), and the in-app manual says so to the user in as many words about
  a `Milestone` — *nothing stops a drag from nesting one under an existing row, or Set type
  from turning any row into one*. What "hangs from nothing" buys is the OFFER: no `+` offers
  to create one as a child (`childTypeChoices`), and the same is true of `Set type` on a
  nested row, which writes the type and keeps the parent because **a move never writes a
  type and a type write never moves the note** — the two are separate rules and joining them
  is what the deleted re-typing cascade did. A person nested under a Feature is a legal note
  in an odd place, put there deliberately, and re-rooting it behind the user's back would be
  a write nobody asked for. An automated reviewer read the refusal claim as a promise the
  code owes; it was this note that was wrong, and no code changed.
- **2b — the user opens a `Resource` row's own creator.** It offers nothing. A marker holds no
  children, and `childTypeChoices` already answers that for the two markers that exist.
- **4a — a `Resource` sits in a subtree something is rolling up.** It contributes nothing —
  not to a progress bar, not to a count of the work below it, not to a done-subtree state.
  This is the same rule [[Milestones as their own type]] states for a point in time, for the
  same reason: the thing contains no work. It says nothing about the TOOLBAR's item total or
  its level-breakdown tooltip, which report what the base returned rather than what has been
  done — see the acceptance criterion below, which used to be wide enough to read as both.
- **4b — the focus level is set.** A `Resource` is not a rung, so no level selects it and no
  level hides it. It is accepted as a focus root exactly as the other markers are.
- **4d — the note carries a horizon.** It places, exactly as a `Milestone` with a horizon
  does. Not an oversight and not the same case as 4c — see the criterion below for why the
  two placement properties are answered differently, and which note owns the question.
- **4c — the note carries something under a date property.** Nothing is drawn. A
  `Resource` is the first marker that is not a date, and until this note said so the
  category answered the DATE questions as well as the structural ones: a person carrying
  the configured target key drew a diamond on the timeline, a milestone LINE across the
  grid, and a row in the resources axis's own `Milestones` lane — which also minted that
  lane on a base holding no milestone. It is refused at `placeItem`, the one call every
  axis makes, and `placementEnds` answers NEITHER end for the type, so no schedule, no
  drop, no grip and no writer can put a date on a person either. The narrowing is this
  type's and not the category's: a `Milestone` still reduces to its target point.
- **2c — the created note carries an `order`.** Intended, and the same value every other
  creation writes — see step 2. What a marker has no business carrying is a `parent`, and
  the creator writes none for a top-level pick.
- **4g — Alt+Up/Down on a `Resource` card, on the resources axis.** It writes nothing. The
  pointer path already refused a marker's ROW write — `deriveLanes` draws every marker in
  the milestones' row whatever its assignee says, so a positional gesture writing one
  changes the note and moves nothing the reader can see — and the keyboard did not, which
  is the register's own *one move, three inputs* rule broken between two of them. `Set
  assignee` still writes one: a note may record who owns a date. What may not happen is a
  POSITIONAL gesture writing a value this axis does not read. `Milestone` had the same
  hole first and had no test.
- **4f — ✨ Assign missing properties runs over a `Resource`.** It creates neither date
  property. `missingKeyStubs` already carves out two fields on the rule *do not create a
  property that means nothing on the note it lands on* (a prerequisite list, an iteration's
  goal); a date slot on a person is the third, and it is reached through `placementEnds`
  rather than by naming the type, so the backfill cannot drift from the writer and the
  controls. That also answers a case shipped before this epic and never tested: a
  `Milestone` was handed the START property ✨ created for it — the key the generated README
  tells the reader this view will never place a milestone by. Its target is still stubbed.
  **It asks `schemaEnds` and not `placementEnds`, and that distinction was bought twice.**
  The first version asked the placement question with the live `iterationBars` flag, which
  made a DISPLAY option decide whether a property exists on a note: under the default
  (`false`) an `Iteration` reduces to its target, so ✨ stopped offering it the start key
  its own editor writes and joining one copies onto every member. An automated reviewer
  caught it on the merge commit. The two questions coincide for every type but that one —
  a time box carries both dates whichever way the roadmap draws it — so `schemaEnds` names
  the schema and delegates, and the ends themselves are still stated once.
- **4e — a `Resource` sits on the resources axis's shelf.** It is not a drag source there.
  A drop on a band writes the ROW for ordinary work and the DATE for a marker
  ([[Milestones out of the resource rows]] — the milestones' row stands for nobody), so a
  marker with no writable end can produce neither, and the card would pick up, the band
  would highlight, and the release would write and announce nothing. The gate is the
  writable END and not the type, which also closes the case that was already open and
  untested: a `Milestone` in a view with no target key.
- **5a — the badge palette is full.** It already is. The hue comes from the second axis
  [[A badge when the palette is full]] introduced, not from a colour taken off another type.

## Acceptance criteria

- `Resource` is in `MARKER_TYPES` and in `ALL_TYPES`, and in neither `LEVELS`, `TEST_LEVELS`
  nor `EXTRA_TYPES`. Putting it in `EXTRA_TYPES` would pin it at `EXTRA_TYPE_RANK` and let it
  hold Tasks, which is the opposite of every rule above.
- It has no `levelIndex`, so `computeLevel` leaves it alone and no move re-types it.
- It is a root: a `Resource` with a parent is as wrong as a `Milestone` with one, and the
  register's own gate says so — `LEGAL_CHILDREN` gains `Resource` with an empty child set and
  `ROOT_TYPES` gains it too, or the register cannot hold the type the plugin ships.
- The hierarchy table in `docs/README.md` gains the same pair, since `docs-check.mjs` reads
  that table against `LEGAL_CHILDREN` in both directions.
- It gets a creation folder key (`typeFolder.resource`, shipped default `resources` under
  the home folder), a badge hue and a row in the generated README and the in-app manual, all
  from the vocabulary — no second list anywhere.
- **Nothing about `assignee` changes in this use case.** A vault upgrading to this step alone
  sees new type, same rows, same roster, same chips. That is what makes it landable first.
- A `Resource` contributes to no ROLLUP: no progress figure, no count of the work below it,
  no done-subtree state, no inferred span. It is selected by no focus level. **Never counted
  is a rule about aggregation, not about visibility** — the sentence [[Milestones as their
  own type]] states for the first marker, and it holds here word for word. The toolbar's own
  item total and its level-breakdown tooltip are the reader's view of what this base
  returned, not an aggregation of progress, so a `Resource` appears in both exactly as a
  `Milestone` already does. An automated reviewer read the wider sentence this criterion used
  to carry and asked for the opposite; excluding one declared type from the toolbar's total
  would make it the one number on screen that lies about what the base holds.
- **The generated README says so too, in both halves.** Naming only the dated markers where
  it says what a marker READS is one half; the other is the generic sentence above it — *an
  item stating only one of the two is drawn as a point on that date* — which is false about
  a `Resource` and which the marker exception no longer covers now that the type is out of
  it. Both are named from the functions that state the rule (`drawsAsPoint`,
  `placementEnds`), so neither sentence can outlive it.
- **A `Resource` never takes a DATE, and is drawn at none.** Not a criterion this note
  started with — it is 4c, found by automated review on the increment itself, and it is the
  one place the marker precedent did NOT carry: every marker before this one was a date. It
  is stated of dates and NOT of "either roadmap axis", which is how it read first: the
  HORIZON is deliberately left where the precedent puts it, below.
- **The horizon is not narrowed, and that is a decision.** A `Resource` places into a bucket
  and takes a `Set horizon` pick exactly as a `Milestone` does today. The same reviewer asked
  for the horizon to go with the dates, reading the wider sentence above; the two are not
  alike. A date on a person is a CLAIM the projection then draws — a diamond, and a line
  across the plan asserting a deadline nobody set — while a horizon is a bucket the reader
  puts a card in, meaningless on a person but asserting nothing. Refusing it costs a
  placement guard, a planner guard and a menu guard for a type nothing links to yet, and it
  would make `Resource` diverge from the marker precedent a second time with no note asking
  for it. What a `Resource` IS on the roadmap is [[Rows from the Resource notes]]' question —
  a ROW rather than a card — and that is the note that should answer this, against a roster
  that exists. Written down here so the next reviewer finds a decision rather than a gap.

- **Every surface that documents the vocabulary names it.** Three do, and the note found
  only two: the generated backlog README and the in-app manual are derived from
  `ALL_TYPES`, so they gained the row for free — and the plugin's own `README.md` is
  hand-written prose that did not. It said `type` is the ladder, the extra types "or
  `Milestone` — a marker on neither, which states a date rather than work", which by the
  time an automated reviewer read it was wrong three ways: it omitted `Resource`, omitted
  `Iteration` (stale since that type shipped), and stated *date* of the whole category.
  Nothing derives it and nothing gates it, so it is the surface that goes stale silently.
- **Nothing this step ships may promise the roster.** The type is declared and the roster
  is not: `deriveLanes` still builds its rows from the declared names, the assignees the
  results carry and the absences, and it enumerates no `Resource` note. So the in-app
  manual, the generated README and this register say what a `Resource` IS and name
  [[Rows from the Resource notes]] for what will read it — an automated reviewer caught the
  manual entry claiming, in user-facing text, that declaring the note draws the row.

## Where it lives

`src/domain/typeVocabulary.ts` is the whole of the declaration: `RESOURCE_TYPE` joins
`MARKER_TYPES` — which puts it in `ALL_TYPES` by construction — and `resources` joins
`DEFAULT_TYPE_SUBFOLDERS`. Beside it is the list 4c actually needs, `DATED_MARKER_TYPES`:
the markers that state a date, which was every marker until a person became one.

**Every STRUCTURAL marker rule is already asked of `isMarkerType`** — no rung, no children,
no parent, no rollup, no dependency, no re-type by position — so those needed the concept
`src/domain/itemTypes.ts` already had and not a line of code. **The DATE questions did
not**, and that is 4c. They are answered in ONE place: `placementEnds` gives a marker on the
dated list its target and a marker off that list NEITHER end, and `drawsAsPoint` is derived
from it — a point is a placement with exactly one end. Both functions carving out the
dateless marker for themselves is what this increment shipped first, and the second of them
needed a comment about the order it asked the first in; a rule stated twice is a rule that
can come apart, and this one had two callers before it had two statements.

**A list rather than a predicate naming `Resource`, and the direction is the decision.** A
fourth marker declared in `MARKER_TYPES` alone states no date until somebody puts it in
`DATED_MARKER_TYPES`, so forgetting ships a type that never places — inert, and visible the
first time anyone opens the roadmap — instead of one handed two date slots that ✨ then
writes onto every note of it. Nothing checks the fourth marker's case, because no fourth
marker exists to drive: what the suite reaches is that all three declared markers agree with
the list, from six tests that go red together when the list is wrong.

`src/domain/bars.ts` asks `placementEnds` at `placeItem`, which is the one call both axes
make: a guard beside the dated axis alone would still have drawn a person in the resources
axis's own marker lane.


`src/domain/backlogReadme.ts` needed one edit for the same reason, and it is the one that
would have shipped WRONG in silence: `planningSection` spelled `MARKER_TYPES` into two
date-specific sentences, so the README generated INTO a user's vault said a person is a
point in time that reads the target key. It names `drawsAsPoint` now — which answers the
`iterationBars` case as a bonus, since an `Iteration` in bar mode is no more a point than a
person is. The types section beside it dropped "and states a date rather than work" for what
is true of all three markers: something the plan points at rather than work it contains.

The rest of the surfaces needed nothing:
`src/domain/settings.ts` and `src/domain/viewOptions.ts` generate the folder option per type
from `ALL_TYPES`, and `src/domain/backlogReadme.ts` and `src/view/manual/typesSection.ts`
document the vocabulary rather than a list beside it. `setupSection.ts`, which this note
predicted, turned out not to be the manual's types surface at all.

`src/view/render/badges.ts` gains the icon-and-class row (`user`, `pbl-lvl-resource`) and
`styles/badges.css` the rule it names — cyan, the marker hue, plus a PILL radius, which is
this type's answer to the second-axis rule [[A badge when the palette is full]] states for a
lone type: a separator recorded beside the hue it shares. It is the fourth cyan wearer and
the only one of them that is not a date, so the shape is what carries that and neither the
icon nor the name is asked to carry it alone.

`src/view/manual/typesSection.ts` gains the English explanation. That directory is
deliberately outside the message-catalog sweep, so an English literal there is the
convention rather than a miss.

Outside `src/`: `scripts/docs-check.mjs` gains `Resource` in `LEGAL_CHILDREN` with an empty
child set and in `ROOT_TYPES`, and `docs/README.md` gains the matching hierarchy row, the
folder row and the marker paragraph — the register cannot hold a type the plugin ships until
both sides say so, in both directions.
