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
  - src/domain/estimationWritePlan.ts
  - src/storage/propertyWrite.ts
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

**As** someone running a release, **I want** to set its status, say what it is for and
record the day it shipped without leaving the release view, **so that** the screen that
reports a release is the screen that keeps it current.

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
| **Trigger** | Pressing the status chip, the released date, or the description line, on a release's own screen |
| **Preconditions** | A release is open; the property the action writes is bound |
| **Guarantee** | One batch writes one key on the RELEASE NOTE and on nothing else. A pick that changes nothing writes nothing. Undo takes the batch back through the plugin's shared slot. |

**Main flow**

1. The reader presses the status chip in the header.
2. The view offers the statuses this vault declares, then the ones its other releases carry,
   then this release's own — with the current one checked.
3. Picking one writes it to the release note's status property.
4. The reader presses the description line and edits the text in a dialog.
5. Confirming writes it to the release note's description property.
6. The reader presses the released date and picks the day it shipped.
7. Confirming writes it to the release note's released-date property.

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
  for the first time. Asked of the ITEM's own `outsideFilter` flag and never of
  `byPath.has(path)`: the model holds context rows too, and a work item with a hand-written
  `parent: [[R]]` pulls the release it names into the tree through `loadOutsideParents`,
  which is not type-gated — so a `has` test authorized an edit to a release the Base
  excluded, the one thing the context-row rule says this plugin never does (found by review,
  PR #211).
- **5c — the note stopped being a release while the control was open.** The write is refused
  at the WRITER, against the live frontmatter (`PropertyWrite.requiresType`), and says the
  note is no longer a `Release`. The plan comes from a model that can be a refresh behind and
  the window between a menu opening and its pick is one nothing upstream sees; on the shipped
  configuration where a release's status and an item's workflow state share `status`, this
  write would otherwise land on a work item's own state. `applyPropertyWrites` refused only a
  live `Resource` before this. The same rule `mayHoldField` states at the other writer: ask
  the LIVE type.
- **5b — a member's own fields.** Never editable here. Nothing on this screen writes to a
  member, and the two actions name `release.item.file` and nothing else.
- **6a — the release has no released date yet.** The control draws **Set released date** —
  **but only where [[Marking a release as released]] is withheld**, which is the correction of
  2026-08-30 and not an appendix beneath the old rule. This bullet stated the invitation unconditionally
  and that stopped being true the day the closing action landed on the same screen: two
  controls offering one field is what the 2026-08-29 rename below made bearable rather than
  fixed. Where `Mark as released` is offered it IS the way to a first date — it writes the
  status and the date in one gated batch — and this control draws nothing there, which is the
  rule every absent figure in the row already follows.

  **It is not gone, and the three states that keep it are why.** `closeOffer` withholds that
  action on four conjuncts and only one of them is "this date is absent". A closing option
  still unbound — the status property, the released values or the transition value; NOT this
  field's own key, which leaves the figure unconfigured and draws nothing at all — a status
  no reader can parse, and a release whose status already reads as released while its date
  does not (an imported or hand-edited note) each leave this field bound and empty with no
  other way on this screen to fill it. The invitation draws on
  exactly those, asked as `!closeOffer(...).offered` rather than restated beside it — so no
  release loses its way to set a date, and none has two ways to set one.

  It opens the same dialog as a release that has one — nothing is written by pressing it —
  so the wording claims nothing the action does not do. In particular it writes **no
  status**: that is [[Marking a release as released]]'s own half of the transition, along
  with its confirmation and its outstanding-work list. What the narrowing costs is the
  reverse case: where the closing action IS offered, writing a date WITHOUT the status is no
  longer reachable from this screen at all. That is the price of one control per field, and
  the field-versus-transition split the rename made already implied it.

  It drew **Mark as released** until 2026-08-29, on the ground that saying it shipped was
  the plainest name for the gesture. **That reason expired when
  [[Marking a release as released]] was built**: its action writes the status and the date
  together and is on the same screen, so one label would have named two different controls.
  This one is named for the field it edits — it is also the only one that CLEARS a date —
  and the transition keeps the shorter name.
- **6b — the released date is unreadable.** It says so and offers no control, which is 1c
  for the other two fields and one reason sharper here: an unreadable date and an absent one
  both reach the planner as `null`, so a dialog opened on the first could not tell the
  reader's "leave it empty" from "it already is" — the clear would look available and write
  nothing. The note is repaired through **Open release note**.
- **7a — the date is confirmed unchanged.** Nothing is written, compared against the note's
  own canonical spelling: a note holding `2026-9-1` is not rewritten as `2026-09-01` by a
  reader who opened the dialog and pressed Save. The rule `computeScheduleWrites` keeps for
  the roadmap's own two ends.
- **7b — the field is emptied.** The key is removed, by 3b's rule. **Clearing it can also
  remove the control that was pressed**, and that is the one write on this screen where the
  focus restore has to name a second element: clearing the date can make `Mark as released`
  offered again, and 6a withholds this button on exactly that condition — so the element
  `focusControl` looks up is gone by the time it looks, and focus fell to the document body.
  It falls back to the closing action itself, which is the control the write just brought
  back (found by review, and confirmed independently, PR #221).
- **2c — the vault has no status vocabulary at all.** Nothing declared, no other release
  carrying one, nothing on this note: the menu would hold no entry and no Clear, so the chip
  invited a press and opened an empty box — the one configuration where the control could not
  do what it offered (found by review, PR #211). It offers **New status...** there, a prompt
  with nothing to suggest, and that is the vault's route to its first status. Offered ONLY in
  that state: once a status exists it is in the vocabulary by 2a, and a free-text entry
  standing beside a list invites two spellings of one status.
- **5d — the configuration moved while the control was open.** Each control captures its KEY
  when it is drawn (3a's rule, and the root guide's capture-before-the-await), while the gate
  re-reads `releaseNoteProblems` at the submit — so a collision present at the open and
  repaired while the menu is up let a batch through carrying the key that collision was
  about, which can be the TYPE key: PR #203's corruption through the one door that fix did
  not cover (found by review, PR #211). `applyRelease` refuses a batch whose key is not
  NOW the key of the field it was planned for — asked per ROLE, which is why the plan carries
  one, rather than against the three keys together: SWAP the status and description options
  while a status menu is open and every captured key is still editable while each names the
  OTHER field, so a union test passes the pick and lands the status on the description (found
  by review, PR #211). A role has one key, so the rule holds for a fourth field nobody has
  written, and the notice names the key so the reader knows which editor to reopen. It refuses
  the merely re-pointed case with it, which is the better answer there too: the old write would land on a property this
  view no longer reads.
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
- **The released date is settable, which is what makes the key exist at all.** Nothing in
  this plugin wrote it before (`createRelease` explicitly does not), so a bound released
  property could never come to hold anything and the index's Shipped group and its slip
  figure were unreachable without hand-editing a note. ✨ binds the key; this is what fills
  it.
- The date dialog is `SchedulePromptModal` with ONE field — the same modal, the same native
  date input and the same per-field clear button the roadmap's Schedule uses — prefilled
  with what the note states and never with today: a dialog holding a date the note does not
  have would write one on a confirm nobody meant as an entry.
- **The write goes through the shared gate and the shared lock.** It is serialized with
  every other view's batch and it installs an inverse in the plugin-wide undo slot. This view
  draws no undo control of its own, so a status set here is taken back from the BACKLOG
  view's undo button — which is what ADR 0030's "the undo slot is the vault's last batch,
  whichever view wrote it" means rather than a gap.
- `applyWrites` and `applyRestores` — the item-batch path — are still never called from
  `src/view/release/`: this view plans no hierarchy, no state and no placement.
- **The dialogs capture the KEY they were opened for**, never re-reading it at submit: a
  `.base` re-pointed while a dialog is open would otherwise leave the box holding the old
  property's value and write it to the new one, overwriting data the reader never saw. The
  root guide's "capture before the await", which the status menu already kept and the
  description dialog did not.
- **A configuration that would corrupt the release note refuses every edit.** Two of this
  view's release-note properties on one key — a status aimed at the TYPE key is the worst,
  since picking one takes `Release` off the note and the release vanishes from its own view —
  block the gate with a notice naming both properties. The rule is `releaseNoteProblems`
  (`src/domain/settingsConsistency.ts`), which `createRelease` throws on and this gate
  refuses on: one statement, two enforcement points, because an edit never passes the
  creator and ✨ cannot produce the state a property picker can. Found by review on this PR.
  It is over the RELEASE-NOTE keys alone — READ counts, not only written: the released date,
  the parent and the order are never written by this view and are all read of a release, so a
  status landing on one of them is still this view breaking its own screen (a status on the
  order key replaces the rank `releaseIndex` sorts by, and sends the release to the tail).
  The item-side keys stay out, which is what keeps the item-state / release-status sharing
  this view is built around legal. **✨ must not be able to CREATE that state either**, and
  the exemption it uses is stated as "no NON-shared option holds this key" rather than "a
  shared option holds it": with the version and the item state both on `status`, the second
  reading freed the key, ✨ bound the release status onto the version's, and this very report
  then blocked every write in the view (found by review, PR #211).
- **Focus survives the redraw an edit causes.** Both controls are in
  `FOCUS_HANDLE_CLASSES` (`releaseView.ts`), so the reader who pressed one lands on its
  replacement rather than on `document.body` — which bites hardest here of anywhere in this
  view, since pressing one is what causes the redraw that detaches it. The description's own
  dialog needs a second mechanism and gets `focusNewRelease`'s: `TextPromptModal` closes
  BEFORE it submits, so focus is off this view by the time the write's redraw runs and the
  handle mechanism correctly finds nothing to restore. Found by review on this PR, against
  the open-note control [[The scope of a release as a tree]] added in the same branch.
- **A CANCELLED dialog puts focus back too**, and that is a rule about the prompt rather
  than about any one control here: every dialog these three fields open has a second exit —
  Escape, the close control — that never reaches `onSubmit`, so the refocus after the write
  covers only the half that writes. It is answered at `PromptModal.onClose` (`ui/prompts.ts`),
  which every prompt in that file closes through, under the same `onClosed` name and the same
  fires-before-`onSubmit` order the hand-written dialogs beside it already use. The status
  prompt is the case review named and the worst of the three: it is opened from an entry in a
  body-mounted `Menu` that no longer exists by the time it closes, so cancelling left a
  keyboard reader on `document.body` with nothing to return to. Found by review (Codex,
  PR #211).
- **The chip's accessible name carries the VALUE**, not only what pressing it does: an
  `aria-label` replaces an element's content, so a name reading "Set the release status"
  would take the status away from the one reader who cannot see the chip. It reuses the
  tree's own `chip.set`/`chip.change` sentences. The description button carries no label at
  all, for the same rule read the other way: its content IS the description.
- **A release's own status and an item's workflow state stay different questions.** The chip
  edited here reads the release note through `statusKey`; the chips on the scope rows read
  each member through its own workflow and remain read-only.

## Where it lives

`src/view/release/releaseEdits.ts` is the three actions — the status menu, the description
dialog and the released date's own — and it exists as its own module because they belong
together: they are the whole of what this view may write to a note that already exists. The
third joined them there on the day it was asked for, which is what that sentence predicted
when there were two. `src/view/release/renderScope.ts`
draws the two controls in the header (`drawStatus`, `drawDescription`), and
`styles/releaseScope.css` carries their chrome — both are real `<button>`s, so Obsidian's
`button:not(.clickable-icon)` matches them and the partial refuses its background, its shadow
and its height rather than drawing a pill inside a pill.

What any of the three WOULD write is `src/domain/releaseWritePlan.ts`: one key on one file, or
nothing at all — the "same value writes nothing" rule stated once rather than at each
control — the status compared case-insensitively, the description exactly, and the date
against its own canonical spelling. It plans
the same `PropertyWrite` the estimation view does and is applied by
`src/storage/propertyWrite.ts`, which captures the inverse the shared undo slot replays —
and which refuses a file whose LIVE type is not the one the plan named
(`PropertyWrite.requiresType`, `src/domain/estimationWritePlan.ts`), the guard 5c is about.
`releaseStatusChoices` in `src/domain/releases.ts` is the menu's vocabulary, beside the
`ReleaseRow` figures it unions.

Whether the released date is drawn as a control at all is `closeOffer` in the same module,
asked from `drawReleased` rather than compared against beside it (6a). That coupling is also
why `releaseEdits.ts`'s `focusControl` and `save` carry a `fallback` selector since
2026-08-30: this is the only one of the three controls that the write it caused can remove,
so the destination is looked up fresh AND has a second name to try.

`src/view/release/releaseView.ts` owns the `WriteGate` and takes the plugin-wide `WriteLock`
through `src/view/release/register.ts` — which it did not until this note: a create captures
no inverse and races nothing, and an edit does both.

The two options are declared in `src/domain/releaseOptions.ts`: `descriptionProperty` (the
key the description is written to, suggested `description`, bound by ✨) and
`releaseStatusValues` (the declared vocabulary, no default — these are the reader's own words
for their own process). `src/ui/textPrompt.ts` is the description dialog itself, a `ui/` leaf
that knows no property key: a prefilled `textarea` that accepts an empty entry, which is what
distinguishes it from `ValuePromptModal` beside it. The released date needs no new dialog at
all — `SchedulePromptModal` (`src/ui/prompts.ts`) with one field is exactly it. `src/ui/newReleaseDialog.ts` asks for the
same field at creation and `src/storage/createNote.ts` writes it, in the collision guard with
every other key that creator writes.
