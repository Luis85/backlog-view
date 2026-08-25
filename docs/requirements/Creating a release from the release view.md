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
| **Guarantee** | Confirming with a title creates exactly one release note in the configured folder, carrying only the fields this vault has bound properties for |

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

## Acceptance criteria

Not written yet. This note is created early — alongside the dialog it describes — so that
the module has somewhere to be specified and a sibling task has somewhere to add its own
piece. The full use case, including what confirming actually verifies, belongs to the task
that finishes this feature; the control onto it now exists, and that step is still owed.

## Where it lives

`src/ui/newReleaseDialog.ts` is the dialog: a title field plus whichever of `version`,
`targetDate` and `status` the caller asks for, in the order asked, confirmed into a plain
result object. It is a `ui/` leaf — it knows no property keys and writes nothing itself,
matching `estimationPresetDialog.ts`'s own pattern of taking plain rows in and handing plain
data back.

`src/view/release/init.ts` is the ✨ ACTION without a ✨ button (`runReleaseInit`): the
backlog and estimation views hang theirs on a toolbar control, and this view has no
toolbar, so the action is a step of the `New release` press rather than a control of its
own. It binds the suggested key for `release` (the membership property), `version`,
`target date` and `status` — whichever this vault has never touched — reading the live
`BasesViewConfig` so a deliberately cleared option is left alone. It writes no note: this view never edits a
note that already exists (`test/view/releaseNeverEdits.test.ts`). The accepted cost is
that Obsidian's own property picker cannot offer `version`, `target date` or `status`
until a release note carries them, which the first **New release** supplies — the same
cost already taken for the membership key last increment.

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
