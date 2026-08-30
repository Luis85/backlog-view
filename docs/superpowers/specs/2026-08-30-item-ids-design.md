# Every note the plugin makes carries an id

Date: 2026-08-30 · Branch: `claude/plugin-item-id-generation-mgncyj`

A note this plugin creates gets a `pbl-id` property: one integer, unique among the notes
the creating device can see, assigned in the same write that makes the note. It is a handle a person can say out loud
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
`getFileCache` frontmatter, and returns the highest number it finds plus one — `1` in a
vault that holds none.

A value is counted only while `Math.floor` of it lands **below `Number.MAX_SAFE_INTEGER`**.
Both halves of that are load-bearing. The floor is what keeps a hand-typed `pbl-id: 7.5`
from issuing `8.5`, and the ceiling is what stops a single absurd value from breaking the
sequence permanently: `1e21 + 1` is still `1e21` in a double, so a note carrying one would
make every later id that same number, forever. Ignored rather than clamped — a note holding
`1e21` is a typo or an import artefact, not a position in this sequence. `NaN` needs no
guard of its own, because `NaN > highest` is false whichever way it is asked.

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

**What the floor cannot reach: two devices, both offline.** Each has synced a maximum of
`N`, neither can see the note the other is about to make, and both issue `N+1`. The vault
is the only state both devices share, and while they are apart there is no vault they
share. So the guarantee this note makes is narrower than "unique in the vault", and is
written narrow deliberately: **an id is unique among the notes the creating device could
see.** Nothing here reconciles a collision afterwards, and nothing reports one.

That is the price of the shape asked for. A short incremental integer and offline
multi-device uniqueness cannot both hold without coordination — the fixes are a per-device
suffix, a UUID, or a reconciliation pass over the merged vault, and each of the first two
stops the id being the short number that was the point of it. Recorded here rather than
solved, so the sentence and the code say the same thing. Raised by automated review on
PR #226.

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
a `.base` are artifacts the plugin maintains, not items somebody tracks. They are the two
names the structural check in section 4 exempts, and that list is the only place the
exemption exists.

**A configured property may name `pbl-id`, and when it does the configured property wins.**
Obsidian's picker offers the properties a vault HAS, so once notes carry this key a view
option can be pointed at it — `typeKey`, say — and the type then lands on top of the stamp.
The id is written FIRST in each creator for exactly that reason: what the user configured
is the note's real data, and this is bookkeeping. The note gets no usable id, and nothing
reports it. Deliberately not a `configProblems` row: that gate blocks EVERY write in the
view, which [[Backfill missing properties]] extension 2c already ruled a worse state than
the feature it was protecting — and this feature is a number nothing reads back. The scan
is unharmed either way, since `Number('Epic')` is `NaN` and ignored. Raised by automated
review on PR #226.

No sentence reaches a screen, so the catalog gains no keys.

## 4 — What is checked

`test/domain/itemIds.test.ts`, node:

- an empty vault answers `1`
- the highest existing id plus one, including when it is not the last file scanned
- a non-numeric, absent or malformed `pbl-id` is ignored rather than poisoning the max
- two calls with no cache update between them do not repeat a number

and one assertion per creator that a created note's frontmatter carries the key, driven
through the existing creation tests rather than a new suite.

**Those four assertions do not hold the rule, and this note claimed they did.** "Every
creator stamps an id" is a category invariant, and `CLAUDE.md` says such a thing is checked
at the forbidden thing rather than by listing the places somebody thought of: a fifth
creator added later calls `vault.create` on a path no existing test drives, and the suite
stays green. So the rule is checked where the calls are — one test walks every file in
`src/storage/`, finds those calling `vault.create`, and requires each to reach
`nextItemId` unless it is one of the two named artifact writers (`readmeFile.ts`,
`baseFile.ts`). A new creator fails it on the day it is written, and adding a third
exemption is a deliberate edit rather than an omission. Raised by automated review on
PR #226, which is the same rule catching this note that this note was written to keep.

`docs/requirements/` gains the note that specifies `domain/itemIds.ts`, which `docs-check.mjs`
rule 7 requires of every module in `src/`.
