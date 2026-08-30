# Every note the plugin makes carries an id

Date: 2026-08-30 · Branch: `claude/plugin-item-id-generation-mgncyj`

A note this plugin creates gets a `pbl-id` property: one integer, unique in the vault,
assigned in the same write that makes the note. It is a handle a person can say out loud
and paste into a commit message — a title changes, a path moves, an id does not.

Out of scope: rendering the id anywhere in the view, searching by it, and existing notes.
Nothing is written to a note that is already in the vault.

## Decisions taken

| Question | Answer |
| --- | --- |
| What the number counts | Every note, one global sequence. No type prefix: `pbl-id: 7`, not `Epic-7`. |
| The key | Fixed `pbl-id`, not a view option. |
| The value | A number, so a base can sort on it. |
| Which notes | Every note the plugin creates: work items, resources, releases, absences. |
| Existing notes | Untouched. No backfill, not even from the ✨ action. |

## 1 — The key is fixed, and that is the exception it looks like

Every write target beyond `parent`/`order`/`type` is a row in `optionalProperties.ts`,
bound to whatever the vault already calls it. `pbl-id` is not one of them, and the reason
is what those rows are FOR: each names a property a vault already has and gates a feature
that cannot run until somebody points at it. An id names nothing that pre-exists — the
plugin invents the value, writes it once, and never reads it back to decide anything. A
configurable key would add a fifth reader to that table and one more way for the feature
to be off, in exchange for letting a user rename a property nothing else in the vault
refers to.

So no option key, no `configProblems` row, no backfill stub, no picker entry. The `pbl-`
prefix is the plugin's own namespace and the collision surface is that one word.

## 2 — The number comes from the vault, every time

`nextItemId(app)` walks `app.vault.getMarkdownFiles()`, reads `pbl-id` out of each
`getFileCache` frontmatter, and returns the highest finite number it finds plus one — `1`
in a vault that holds none.

Deriving it from the Base's results was refused twice over: the context-row rule forbids
it (*never a source of anything derived from the Base's results*), and it would be wrong
anyway — a note the filter excluded still holds an id, and skipping it hands the next
creation a number already on disk.

A persisted counter was refused for a different reason: two devices on a synced vault
would each hold their own, and both would issue the same number. The vault is the only
copy of this state that both devices see.

**The scan alone is not enough, because `metadataCache` catches up asynchronously.** Two
creations in quick succession both read a cache that does not yet know about the first
note, and both take the same maximum. `nextItemId` therefore keeps a module-level floor of
the highest number it has already issued, and returns `max(scanned, floor) + 1`. The floor
is a floor on a read and never a source of truth: it only ever moves up, a reload
re-derives it from the vault, and a vault whose ids were edited by hand or restored from a
backup is answered by the scan rather than by the floor.

The cost is one `getFileCache` per markdown file per creation. That is a user gesture, once,
against a cache Obsidian already holds in memory — marked with a `ponytail:` comment naming
the ceiling, since a vault large enough to feel it would want the scan narrowed to the
folders the plugin writes into.

## 3 — Where it lives

`src/domain/itemIds.ts` is new and holds both halves: `ITEM_ID_KEY` and `nextItemId`.
`domain/` is right for it — it reads the vault, writes nothing, touches no DOM, and can be
asked its question by a node test rather than a screen.

The four note creators each gain one line into the frontmatter object they already build,
so the id lands in the same atomic `vault.create` as the type and the hierarchy — a
create-then-stamp pair could fail in between and leave an id-less note behind, which is
`createBacklogItem`'s own stated reason for building its frontmatter up front:

- `createBacklogItem`, `createResourceNote`, `createRelease` — `storage/createNote.ts`
- `createAbsenceNote` — `storage/absenceNotes.ts`

`readmeFile.ts` and `baseFile.ts` create files too and get nothing: a generated README and
a `.base` are artifacts the plugin maintains, not items somebody tracks.

No sentence reaches a screen, so the catalog gains no keys.

## 4 — What is checked

`test/domain/itemIds.test.ts`, node:

- an empty vault answers `1`
- the highest existing id plus one, including when it is not the last file scanned
- a non-numeric, absent or malformed `pbl-id` is ignored rather than poisoning the max
- two calls with no cache update between them do not repeat a number

and one assertion per creator that a created note's frontmatter carries the key — driven
through the existing creation tests rather than a new suite, so a fifth creator added later
fails the one that already covers its neighbours.

`docs/requirements/` gains the note that specifies `domain/itemIds.ts`, which `docs-check.mjs`
rule 7 requires of every module in `src/`.
