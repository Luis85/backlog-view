---
type: PBI
parent: "[[A release is a note of its own]]"
order: 30
status: Done
priority: P2
created: 2026-08-29
source: user request — release management improvements, 2026-08-29
files:
  - src/domain/releaseOptions.ts
  - src/domain/settingsConsistency.ts
  - src/domain/releases.ts
  - src/domain/releaseWritePlan.ts
  - src/storage/createNote.ts
  - src/ui/newReleaseDialog.ts
  - src/ui/textPrompt.ts
  - src/view/release/releaseEdits.ts
  - src/view/release/releaseView.ts
  - src/view/release/register.ts
  - src/view/release/renderScope.ts
  - styles/releaseScope.css
started: 2026-08-29
finished: 2026-08-29
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Editing a release from its own screen

**As** someone running a release, **I want** to set its status and say what it is for
without leaving the release view, **so that** the screen that reports a release is the
screen that keeps it current.

**This is where the release view starts editing notes.** Until now it created release notes
and bound its own `.base` config and nothing else — a claim
`test/view/releaseNeverEdits.test.ts` held at the forbidden calls. What replaces it is
narrower than "it writes": **it edits the RELEASE NOTE it is showing, and nothing else.** A
member is work, and work is edited on the backlog view; the release note's own fields are
this view's, because this is the view that draws them and the view that made the note.

**The description is a PROPERTY, and that reverses a standing decision.**
[[Milestones as their own type]] says "the description is the note body, as it is for every
other kind here. No new field", and that rule still holds for every other kind. A release is
the one this plugin both CREATES and REPORTS ON without opening: the index draws its
version, its target date and its status in a row, and the scope header draws them again —
so a description in the body is a description neither screen can show, on the one screen
whose whole job is to say what a release is. Asked for as a property by the author on
2026-08-29 and taken as a reversal for this type alone rather than as a general widening.

## Use case

| | |
| --- | --- |
| **Actor** | Someone running a release |
| **Trigger** | Pressing the status chip, or the description line, on a release's own screen |
| **Preconditions** | A release is open; the property the action writes is bound |
| **Guarantee** | One batch writes one key on the RELEASE NOTE and on nothing else. A pick that changes nothing writes nothing. Undo takes the batch back through the plugin's shared slot. |

**Main flow**

1. The reader presses the status chip in the header.
2. The view offers the statuses this vault declares, then the ones its other releases carry,
   then this release's own — with the current one checked.
3. Picking one writes it to the release note's status property.
4. The reader presses the description line and edits the text in a dialog.
5. Confirming writes it to the release note's description property.

**Extensions**

- **1a — the status property is unbound.** No chip is drawn: there is no key to write and
  nothing to read. The description line is withheld the same way when its own key is unbound.
- **1b — the release carries no status yet.** The chip is drawn as an INVITATION (dashed,
  named for the column) rather than withheld — absence is one press from being fixed here,
  which is the same call the tree's dashed risk and priority chips make. That is deliberately
  not `drawFigure`'s rule for the version and the target date, which this screen cannot edit.
- **1c — the status property holds something unreadable.** It says so and offers no menu:
  "somebody wrote something there" is not an invitation to write over it blind, and the
  header's own **Open release note** control is one press from the note. The description
  behaves identically.
- **2a — the vault declares no statuses.** The menu is what the releases in the base
  actually carry, plus this one's own. A vault that has never opened the options panel still
  picks from its own vocabulary.
- **2b — a release carries a status no option names.** It is offered beside the declared
  ones, because it is a value this vault uses.
- **3a — the pick is the status the note already holds.** Nothing is written and no undo
  slot is spent, compared case-insensitively — the rule every pick in this plugin keeps. A
  note holding `planned` is already at `Planned` and is not rewritten to the declared casing.
- **3b — the reader clears the status.** The KEY is removed rather than blanked: an empty
  string is UNREADABLE to this view's own reader ([[Releases as their own type]] 3b), so a
  blanked field would come back drawn as somebody's mistake. The clear is offered only where
  the note carries a readable value.
- **4a — the description box is emptied.** The key is removed, by 3b's rule exactly.
- **4b — the description is unchanged.** Nothing is written. Compared EXACTLY rather than
  case-insensitively, unlike the status: `Fix the typo` and `fix the typo` are one status and
  two descriptions.
- **5a — the release note is outside the Base's filter.** The batch is refused whole and
  says so — the gate's own outside-filter refusal, which this view has a batch to be refused
  for the first time.
- **5b — a member's own fields.** Never editable here. Nothing on this screen writes to a
  member, and the two actions name `release.item.file` and nothing else.
- **4c — a description at CREATION.** `New release` asks for one too, as its fourth and last
  field, where the property is bound — see [[Creating a release from the release view]]. A
  blank box is written nowhere, that note's own 2c.

## Acceptance criteria

- **Both actions land on one method** (`ReleaseView.applyRelease`), which is the only place
  a release edit reaches the gate — the "one move, N inputs" rule for this view: a pick, its
  Clear entry and the description dialog are three inputs and one write path.
- **The batch names the release note alone**, driven at the vault rather than asserted of a
  planner: `test/view/release/releaseEdits.test.ts` reads `writeLog` back after each gesture
  and finds one path in it.
- **The menu's checkmark is asked of the PLAN** — an entry is checked exactly when picking it
  would write nothing — never by a comparison written beside it. The rule the root guide
  states after the two drifted apart on the horizon menu.
- The menu offers declared values first in declared order, then observed values in row
  order, then the release's own — deduplicated case-insensitively, so no entry can be drawn
  twice or checked twice.
- A re-pick writes nothing; a clear removes the key; a clear is not offered where there is
  nothing to remove.
- An emptied description removes the key; an unchanged one writes nothing.
- **The write goes through the shared gate and the shared lock.** It is serialized with
  every other view's batch and it installs an inverse in the plugin-wide undo slot. This view
  draws no undo control of its own, so a status set here is taken back from the BACKLOG
  view's undo button — which is what ADR 0030's "the undo slot is the vault's last batch,
  whichever view wrote it" means rather than a gap.
- `applyWrites` and `applyRestores` — the item-batch path — are still never called from
  `src/view/release/`: this view plans no hierarchy, no state and no placement.
- **A configuration that would corrupt the release note refuses every edit.** Two of this
  view's release-note properties on one key — a status aimed at the TYPE key is the worst,
  since picking one takes `Release` off the note and the release vanishes from its own view —
  block the gate with a notice naming both properties. The rule is `releaseNoteProblems`
  (`src/domain/settingsConsistency.ts`), which `createRelease` throws on and this gate
  refuses on: one statement, two enforcement points, because an edit never passes the
  creator and ✨ cannot produce the state a property picker can. Found by review on this PR.
  It is over the RELEASE-NOTE keys alone, so the item-state / release-status sharing this
  view is built around stays legal.
- **Focus survives the redraw an edit causes.** Both controls are in
  `FOCUS_HANDLE_CLASSES` (`releaseView.ts`), so the reader who pressed one lands on its
  replacement rather than on `document.body` — which bites hardest here of anywhere in this
  view, since pressing one is what causes the redraw that detaches it. The description's own
  dialog needs a second mechanism and gets `focusNewRelease`'s: `TextPromptModal` closes
  BEFORE it submits, so focus is off this view by the time the write's redraw runs and the
  handle mechanism correctly finds nothing to restore. Found by review on this PR, against
  the open-note control [[The scope of a release as a tree]] added in the same branch.
- **The chip's accessible name carries the VALUE**, not only what pressing it does: an
  `aria-label` replaces an element's content, so a name reading "Set the release status"
  would take the status away from the one reader who cannot see the chip. It reuses the
  tree's own `chip.set`/`chip.change` sentences. The description button carries no label at
  all, for the same rule read the other way: its content IS the description.
- **A release's own status and an item's workflow state stay different questions.** The chip
  edited here reads the release note through `statusKey`; the chips on the scope rows read
  each member through its own workflow and remain read-only.

## Where it lives

`src/view/release/releaseEdits.ts` is the pair of actions — the status menu and the
description dialog — and it exists as its own module because they belong together: they are
the whole of what this view may write to a note that already exists, and a third field would
join them there rather than beside whichever control drew it. `src/view/release/renderScope.ts`
draws the two controls in the header (`drawStatus`, `drawDescription`), and
`styles/releaseScope.css` carries their chrome — both are real `<button>`s, so Obsidian's
`button:not(.clickable-icon)` matches them and the partial refuses its background, its shadow
and its height rather than drawing a pill inside a pill.

What either action WOULD write is `src/domain/releaseWritePlan.ts`: one key on one file, or
nothing at all — the "same value writes nothing" rule stated once rather than at each
control, with the status compared case-insensitively and the description exactly. It plans
the same `PropertyWrite` the estimation view does and is applied by
`src/storage/propertyWrite.ts`, which captures the inverse the shared undo slot replays.
`releaseStatusChoices` in `src/domain/releases.ts` is the menu's vocabulary, beside the
`ReleaseRow` figures it unions.

`src/view/release/releaseView.ts` owns the `WriteGate` and takes the plugin-wide `WriteLock`
through `src/view/release/register.ts` — which it did not until this note: a create captures
no inverse and races nothing, and an edit does both.

The two options are declared in `src/domain/releaseOptions.ts`: `descriptionProperty` (the
key the description is written to, suggested `description`, bound by ✨) and
`releaseStatusValues` (the declared vocabulary, no default — these are the reader's own words
for their own process). `src/ui/textPrompt.ts` is the description dialog itself, a `ui/` leaf
that knows no property key: a prefilled `textarea` that accepts an empty entry, which is what
distinguishes it from `ValuePromptModal` beside it. `src/ui/newReleaseDialog.ts` asks for the
same field at creation and `src/storage/createNote.ts` writes it, in the collision guard with
every other key that creator writes.
