---
type: PBI
parent: "[[Creating items]]"
order: 60
status: Open
started: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
release: ""
finished: ""
---

# Every created note carries an id

**As** someone who talks about the backlog outside Obsidian, **I want** every note this
plugin makes to carry a short number of its own, **so that** I can name one item in a
commit message, a chat or a standup without pasting a title that is going to change.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone creating a note through the plugin |
| **Trigger** | Any creation the plugin performs: a work item, a resource, a release, an absence |
| **Preconditions** | None. This is not configurable and cannot be switched off |
| **Guarantee** | **No note that already exists is ever written to.** The id is assigned once, in the same single write that creates the note, and nothing changes it afterwards. It is unique among the notes Obsidian has indexed on the creating device — extensions 2f and 2g say what that excludes |

**Main flow**

1. Something asks the plugin to create a note.
2. The plugin reads the vault for the highest `pbl-id` any note already carries.
3. The new note's frontmatter is built with `pbl-id` one past that number, alongside
   everything else that creation writes.
4. The note is created in one write, carrying its id from the moment it exists.

**Extensions**

- **2a — no note in the vault carries an id.** The first one is `1`.
- **2b — a note carries a fractional `pbl-id`.** Counted as its floor, so `7.5` in an
  otherwise empty vault yields `8`. Ignoring it instead would let the next creation land
  on `7`, which reads as the same item to anyone who rounded it.
- **2c — a note carries a `pbl-id` that is not a number at all.** Ignored: a blank key is
  what a hand-edited or stubbed note looks like, and letting `NaN` through would make every
  later id `NaN` too.
- **2d — a note the Base filtered out carries a higher id.** Still counted. The number must
  be unique across the VAULT, so the scan reads the vault rather than the view's results —
  the one place the context-row rule's "never derived from the results" is satisfied by
  reading somewhere else entirely.
- **2e — a note carries a value that floors to `Number.MAX_SAFE_INTEGER` or above.**
  Ignored. Adding one to it would not move it, so counting it would pin every later id to
  that same number forever. The id the plugin ISSUES is held to the same range, and the
  creation is refused outright rather than repeating a number — unreachable in any real
  vault, and stated so the boundary has one rule rather than two.
- **2f — two devices are offline, and both create a note.** Both issue the same id, and
  nothing reconciles it or reports it afterwards. This is the limit of the guarantee, not a
  defect to be fixed later: a short incremental integer and offline multi-device uniqueness
  cannot both hold without coordination, and the alternatives (a per-device suffix, a UUID)
  stop the id being the short number that was the point of it.
- **2g — a markdown file is on disk but Obsidian has not indexed it yet** (just synced,
  just restored, written by another program). Its id is not read, so the number it holds
  can be issued again. The guarantee is what the creating device could SEE, and an
  unindexed file is one it cannot: `getFileCache` answers `null`, and reading the file
  instead would make every creation wait on a parse of every unindexed note in the vault.
- **3a — a view option is pointed at `pbl-id`.** The configured property wins and the note
  gets no usable id. What the user configured is the note's real data and this is
  bookkeeping, so the stamp is written first and is the one that gives way. Not reported: a
  `configProblems` row would block every write in the view, which extension 2c of
  [[Backfill missing properties]] already ruled a worse state than the feature it protects.
- **4a — the creation is refused** (a release whose properties collide, an absence whose
  resource stopped being one). No note, and no id: the number is taken after the refusal,
  not before it.

## Acceptance criteria

- Every note the plugin creates carries `pbl-id`, and no note it does not create gains one.
  Checked at the `vault.create` calls rather than at the four creators that exist today, so
  a fifth one fails on the day it is written.
- The value is an integer and one global sequence — a resource, a release and an Epic are
  numbered from the same run, with no type prefix.
- It is unique among the notes Obsidian has INDEXED on the creating device. Two devices
  creating while offline collide, and so does a file that reached the disk but not yet the
  metadata cache. Both are stated rather than solved.
- It is written in the same single `vault.create` as the type and the hierarchy, so a note
  without its id never exists on disk.
- Nothing reads the id back, renders it or matches on it, and no existing note is
  backfilled — not by the ✨ action either.
- The key is fixed and carries no view option, no collision report and no picker entry.

## Where it lives

`src/domain/itemIds.ts` (`ITEM_ID_KEY`, the fixed key, and `nextItemId`, which scans the
vault's markdown frontmatter for the highest existing value, holds both what it counts and
what it issues inside the safe-integer range, and keeps a per-vault floor so two creations
in one tick cannot repeat a number while `metadataCache` catches up) ·
`src/storage/createNote.ts` (`createBacklogItem`, `createResourceNote` and `createRelease`,
each stamping the id into the frontmatter object it already builds) ·
`src/storage/absenceNotes.ts` (`createAbsenceNote`, the same line below its own refusal).
`src/storage/readmeFile.ts` and `src/storage/baseFile.ts` create files and are deliberately
**not** here: a generated README and a `.base` are artifacts the plugin maintains, not items
anyone tracks — they are the two names the structural check exempts, and that list is the
only place the exemption exists.
Tests: `test/domain/itemIds.test.ts`, `test/storage/createNote.test.ts`,
`test/storage/createRelease.test.ts`, `test/storage/everyCreationStamped.test.ts`
(the category invariant, asked at the call rather than of the creators somebody listed),
`test/view/absenceEditing.test.ts`.
