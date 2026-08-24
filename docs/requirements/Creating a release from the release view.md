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

**Not yet reachable.** This note records the piece that exists so far — the dialog that
collects a release's fields — while it is still being built. No control on screen opens it
yet; that lands in a later task of the same increment. [[Putting work in a release]] is
about naming a release on existing work; this is the separate act of bringing the release
note itself into being.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Not yet wired to anything on screen — reserved for the control a later task adds to the release view's toolbar |
| **Preconditions** | The release view's folder option names where the note lands |
| **Guarantee** | Confirming with a title creates exactly one release note in the configured folder, carrying only the fields this vault has bound properties for |

**Main flow**

1. The user opens the new-release dialog.
2. The user enters a title, and optionally a version, a target date and a status — whichever
   of those three this vault tracks.
3. Confirming creates the release note, writing the title as the note's name and each
   entered field into its own bound property.

**Extensions**

- **1a — nothing opens the dialog yet.** That is the gap this note exists to record, not an
  oversight this note is fixing; a later task supplies the door.
- **2a — the title is left blank.** Confirming is refused — the title is the note's own
  name, and there is nothing to create without one.
- **2b — the vault tracks none of the three optional fields.** The dialog asks for a title
  alone; a release can still be created with nothing else known about it yet.

## Acceptance criteria

Not written yet. This note is created early — alongside the dialog it describes — so that
the module has somewhere to be specified and a sibling task has somewhere to add its own
piece. The full use case, including what confirming actually verifies, belongs to the task
that finishes this feature once the control onto it exists.

## Where it lives

`src/ui/newReleaseDialog.ts` is the dialog: a title field plus whichever of `version`,
`targetDate` and `status` the caller asks for, in the order asked, confirmed into a plain
result object. It is a `ui/` leaf — it knows no property keys and writes nothing itself,
matching `estimationPresetDialog.ts`'s own pattern of taking plain rows in and handing plain
data back.
