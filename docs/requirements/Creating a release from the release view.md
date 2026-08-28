---
type: PBI
parent: "[[Putting work in a release]]"
order: 20
status: Active
created: 2026-08-24
source: plan "releases own their creation", 2026-08-24
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Creating a release from the release view

**As** a backlog owner, **I want** to create a release note from the release view itself,
**so that** I do not have to leave the view and hand-write frontmatter to make the note a
release's own fields belong to.

**The door is on the view.** A `New release` control sits at the head of the release index
and again on the no-releases empty state, and one function is behind both presses: bind
this view's release properties, ask for the fields that bind resolved, create the note.
[[Putting work in a release]] is about naming a release on existing work; this is the
separate act of bringing the release note itself into being.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | The user presses **New release** — at the head of the release index, or on the no-releases empty state, which is the same control on the one screen the index never reaches |
| **Preconditions** | The release view's folder option names where the note lands |
| **Guarantee** | Confirming with a title creates exactly one release note in the configured folder, carrying only the fields this vault has bound properties for AND the user filled in |

**Main flow**

1. The user opens the new-release dialog.
2. The user enters a title, and optionally a version, a target date and a status — whichever
   of those three this vault tracks.
3. Confirming creates the release note, writing the title as the note's name and each
   entered field into its own bound property.

**Extensions**

- **1a — the press binds this view's release properties on its way to the dialog.** An
  option nobody has named takes its suggested key before the dialog decides what to ask for,
  and the view says so, because the press changed the saved view's own configuration. An
  option the user deliberately cleared is left alone, and no field is asked for a value that
  could only land nowhere.
- **2a — the title is left blank.** Confirming is refused — the title is the note's own
  name, and there is nothing to create without one.
- **2b — the vault tracks none of the three optional fields.** The dialog asks for a title
  alone; a release can still be created with nothing else known about it yet.
- **2c — a field the vault tracks is left blank.** The key is not written at all, rather than
  written empty. [[Releases as their own type]] 3b names the empty string as UNREADABLE
  rather than absent, so a blank written here is this view's own reader reporting the release
  it just made as somebody's mistake.

## Acceptance criteria

- **Both presses are one function.** The control at the head of the index and the control on
  the no-releases empty state call `newRelease` (`src/view/release/newRelease.ts`), which is
  the only place a release note is planned. `test/view/release/newRelease.test.ts` drives a
  create from each screen and asserts the same note comes out of both, so a second entry
  point cannot grow a second idea of what creating a release means.
- **The bind runs before the dialog decides what to ask for.** On a view whose options nobody
  has named, the press binds them and the dialog then offers a version, a target date and a
  status — never the other way round, which would ask for nothing on the one press that
  matters most.
- **A cleared option is left alone, and no field is asked for a value that could only land
  nowhere.** The distinction is read from the live `BasesViewConfig` (`adoptCandidates`), not
  from the resolved settings, because an option cleared and one never set resolve to the same
  empty key. A test of the unbound case that used an unset option would assert the opposite
  of this rule.
- **The press says when it changed the configuration, and stays quiet when it did not.**
  Checked in both directions: a fresh view that binds its four keys reports it, and a view
  with nothing left to bind reports nothing. The comparison is over the RESOLVED keys before
  and after, and the "before" is a fresh read of the live config rather than the settings
  snapshot from the last data update — otherwise a view whose options were bound moments ago
  reports a change it did not make.
- **Confirming with a title creates exactly one note, in the folder this view names, carrying
  the type key and nothing the view has no property bound for.** `test/storage/createRelease.test.ts`
  asserts the whole frontmatter with `toEqual`, so a key nobody asked for fails rather than
  passing unnoticed.
- **A release is seeded no parent, no order and no placement.** It is a marker: it hangs from
  nothing and is ranked among nothing, so the creator writes neither. That is a different
  claim from `createBacklogItem`'s standing rule that a `Release` is seeded nothing a SURFACE
  adds — a release's own version, date and status are what it is, not the context of the
  screen that made it.
- **Confirming is refused with a blank title**, and the confirm control is disabled until one
  is entered. The title is the note's own name; there is nothing to create without it.
- **A blank optional field is written nowhere**, kept at `createRelease` rather than at the
  dialog that produces the blanks, so it holds for a caller nobody has written yet. The check
  that catches it is the one spanning the JOIN — `test/view/release/newRelease.test.ts`
  creates through the real gesture with only a title and reads the vault back through
  `releaseIndex`. Two tests either side of that join were each green while the defect
  shipped: one asserted the created frontmatter held the blanks, the other that exactly that
  frontmatter reads as invalid.
- **The control is withheld where no type property is bound**, which is `ReleaseView.draw`'s
  own guard rather than a second check at the button: `createRelease` refuses without a type
  key, and the bind deliberately binds no type property, so a press there could only ever fail.
- **Every ending that changed something is reported, and cancelling is silent.** The options
  were bound, the note was created (under the name it actually took on disk, which may have
  been suffixed), or the creation failed. Cancelling changed nothing and says nothing.
- **Creation is not undoable**, and that is consistent rather than new: no `New` in this
  plugin goes through `applyWrites`, so none captures an inverse. A mis-made release is
  deleted by hand.
- **The standalone ✨ reports every press.** A press that bound nothing says so rather than
  looking dead — the bar draws the control whether or not anything is currently adoptable,
  unlike `New release`'s own bind, which stays quiet on a no-op because its dialog opens
  either way. A press that DID bind something reports it through the same `release.new.bound`
  notice `New release` uses, so the two presses cannot describe one bind two ways. Neither
  writes a note: `test/view/release/initControl.test.ts` drives the click and reads
  `vault.writeLog`/`vault.files` back empty.
- **The standalone ✨ also draws on the no-releases empty state**, with `fixes` naming all
  four candidates rather than the one the `noMembership` state narrows to — a fresh vault has
  nothing bound yet and nothing to narrow to, and it is the base `renderIndex`'s own bar can
  never reach: `ReleaseView.draw` returns before that module ever runs.
  `test/view/release/initControl.test.ts` pins both that the control appears there when
  anything is adoptable and that it binds all four, not only membership.
- **A no-op press redraws nothing.** Nothing changed, so there is nothing for a redraw to
  show — and skipping it is also what keeps the pressed button attached and focused, since
  `view.render()` empties `viewEl` whether or not a bind happened. A press that DID bind
  something redraws and then restores focus: to the replacement `.pbl-rel-init` where the
  redrawn screen still draws one (the bar, always), and otherwise to that screen's own first
  control — the scope's back button when binding membership on `noMembership` replaces the
  whole screen with the scope, `New release` beside a `noReleases` guidance the press left
  standing. `test/view/release/initControl.test.ts` drives all three shapes and is watched
  failing against the pre-fix handler, which called `view.render()` unconditionally and left
  focus on whatever the browser does with a detached node.
- **This press never edits a note that already exists.** It creates one and it may write this
  view's own `.base` config; `applyWrites`, `applyRestores` and `applyPropertyWrites` stay
  unreachable from `src/view/release/`, asserted on the calls themselves in
  `test/view/releaseNeverEdits.test.ts` rather than by driving the screens somebody thought of.
- **Focus returns to the control the CURRENT screen draws** — looked up fresh after the close
  and again after the create, because the dialog closes before it submits and the create's own
  refresh replaces the button the close just focused. **Met only for a refresh that lands
  inside the await.** A vault refreshes on its own schedule, and one arriving after it takes
  focus to the body again; nothing here or in the suite can say otherwise, and
  [[Smoke test the release view]] is where that is looked at.
- **A vault that changed the backlog's home folder has its next release land somewhere else.**
  `releaseFolder` defaults to `docs/releases` and this view cannot read the backlog view's
  home folder, so such a vault's releases stop going to `<home>/releases` until the option is
  set. Recorded rather than detected: detecting it means one view reading another's
  configuration — the wall behind
  [[Two release options aimed at one property go unreported]]. The changelog says so plainly.
- **Obsidian's own property picker cannot offer `version`, `target date` or `status` until a
  release note carries one.** The bind writes no note, and a blank box is written nowhere
  (extension 2c), so what supplies a key is the first release that CARRIES that field. This
  bullet said "the first **New release**" until 2026-08-25, which was true only of the
  version of the creator that wrote blanks — the reading it cost is in 2c. The same cost was
  already taken for the membership key last increment (`neverStubbed`,
  `src/domain/writePlan.ts`) — same shape, same reasoning, both views.

**The retired justification, which is the part worth keeping.** `byProjectionType`
(`src/view/projection.ts`) offered `Release` in the tree and on both boards deliberately:
[[Releases as their own type]] task 1 step 7 recorded that *a release had no dedicated door the
way an iteration has the scope picker, so withholding it everywhere would leave the type
creatable only by hand.* This PBI is that door, and building it retired the reason — so the
type is now offered by no creation surface at all, `Iteration`'s own rule reached by the same
argument. It also cost the backlog view its `typeFolder.release` row: the view that creates a
release is the view that names its folder, and two folder settings for one kind of note, in
two views that cannot read each other's configuration, is a collision better never created
than reported.

## Where it lives

`src/ui/newReleaseDialog.ts` is the dialog: a title field plus whichever of `version`,
`targetDate` and `status` the caller asks for, in the order asked, confirmed into a plain
result object. It is a `ui/` leaf — it knows no property keys and writes nothing itself,
matching `estimationPresetDialog.ts`'s own pattern of taking plain rows in and handing plain
data back.

`src/view/release/init.ts` is the ✨ ACTION (`runReleaseInit`): it binds the suggested key
for `release` (the membership property), `version`, `target date` and `status` — whichever
this vault has never touched — reading the live `BasesViewConfig` so a deliberately
cleared option is left alone. It writes no note: this view never edits a note that already
exists (`test/view/releaseNeverEdits.test.ts`). The accepted cost is that Obsidian's own
property picker cannot offer `version`, `target date` or `status` until a release note
carries them, which the first release CARRYING one supplies — a blank box is written
nowhere, so a press alone is not enough. The same cost was already taken for the
membership key last increment.

`src/view/release/initControl.ts` is the ✨'s own control (`renderReleaseInit`), in the
two POSITIONS the backlog and estimation views each hang theirs on a toolbar for — the BAR
(`renderIndex.ts`, beside `New release`) and an EMPTY STATE, since this view has no
toolbar to fall back on — drawn from three call sites now that it also reaches the
`noReleases` guidance (`releaseView.ts`) beside the `noMembership` scope empty state
(`renderScope.ts`); the shape stays two positions because both empty-state call sites pass
`position: 'empty'` and differ only in `fixes`. The BAR draws it unconditionally, the
fixture-not-a-state-of-the-config rule `render/toolbar.ts` and `estimation/toolbar.ts` both
keep, so a press with nothing left to bind reports that rather than looking dead. The EMPTY
STATE withholds it — the same rule `renderSetupCta` states in `render/emptyStates.ts` —
but narrowed past that rule's own shape: it asks not "is anything at all adoptable" but "is
one of THIS screen's own `fixes` still adoptable", because a `versionProperty` merely
untouched is a fact about a different screen, and drawing the button for it would report
success while redrawing this exact empty state. `noMembership` names one option because
that is the one thing that screen is about; `noReleases` names all four
(`RELEASE_SUGGESTED_KEYS`, derived rather than copied) because nothing there is bound yet
and there is nothing to narrow to. All three call sites run the SAME bind, `bindAndReport`
(below), so no two presses can come to disagree about what one press did — and the SAME
click handler, which skips its redraw on a no-op and otherwise restores focus to the
redrawn screen's own `.pbl-rel-init` or, failing that, its first control.

`src/view/release/newRelease.ts` also holds `bindAndReport`, the pair `runReleaseInit` and
the boolean it reports on: bind, then answer whether anything changed. Both entry points
onto ✨ — `newRelease`'s own press and the standalone control above — call it rather than
each reading `runReleaseInit` and comparing settings itself, so they cannot come to
disagree about what a bind IS. They differ only in what they SAY about a press that bound
nothing: `newRelease` stays quiet (a dialog opens either way), while the standalone
control reports it, since nothing else follows a standalone press to say the change
happened.

`src/view/release/newRelease.ts` holds the door itself (`renderNewRelease`) and the one
function behind it: bind, then ask, then create. Both presses — the control drawn at the
head of the index by `src/view/release/renderIndex.ts` and the same control on the
no-releases empty state drawn by `src/view/release/releaseView.ts` — call that one
function, so neither entry point can grow its own idea of what creating a release means.
It decides the dialog's fields from the settings the bind just resolved, passes what comes
back to `createRelease` (`src/storage/createNote.ts`), and reports through a `Notice` in
each of the three endings that CHANGED something: the options were bound, the note was
created, the creation failed. Cancelling is the fourth ending and is deliberately silent —
nothing to report. What every ending shares is where focus goes (`focusNewRelease`): the
control the CURRENT screen draws, looked up fresh, because the dialog closes before it
submits and the refresh behind the create replaces the button the close just focused. The
control is offered only past `ReleaseView.draw`'s own type-key guard — `createRelease`
refuses without one, and the ✨ deliberately binds no type property.
