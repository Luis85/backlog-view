---
type: Issue
order: 50
parent: "[[Creating items]]"
status: Open
priority: P3
area: limitation
created: 2026-08-01
source: 2026-08-01 Codex review of PR #24
files:
  - src/storage/frontmatter.ts
  - src/storage/baseFile.ts
---

# A failed creation leaves the folder it made

## Evidence

Both creation paths call `ensureFolder` before `vault.create`:

- `createBacklogItem` — a new item filed in a type folder that does not exist yet.
- `createBacklogBase` — the **Create backlog** command, scaffolding into a new folder.

`ensureFolder` walks the path and creates every missing segment. If the `vault.create`
that follows then throws — a permission problem, a sync lock, a name the filesystem
rejects — the folders stay. The notice reports the failure; nothing removes them.

Found by review while writing [[New item flow]] and [[Scaffolding a backlog]] as use
cases: both notes had claimed the failure path leaves nothing behind, and neither the
code nor a test said so.

## Why it is filed rather than fixed

The residue is an **empty folder**, and rolling it back is not obviously better than
leaving it:

- `ensureFolder` would have to remember which segments it created, since some of the chain
  may have existed. That is a small change.
- Deleting folders on an error path is not. The window between creating and deleting is
  one in which a sync client, another plugin, or the user may have put something there,
  and a creation failure is exactly the situation in which the vault's state is already
  uncertain. Deleting more than we made is a far worse outcome than an empty folder.
- The user is present and has just been told the creation failed. An empty folder next to
  a notice explaining why is recoverable in one keystroke.

The honest position is that this is a **documented limitation**, not an unnoticed bug. The
two use cases now say so.

## What would change the decision

- A report of it happening in practice — the failure needs a `vault.create` that throws
  after a successful `createFolder`, which nobody has yet observed.
- Evidence that it happens repeatedly in one session, since the folders would then
  accumulate rather than being a single stray.
- **A change that makes folder creation routine rather than occasional.**
  [[Backlog as folder notes]] is exactly that, and it settles this: with that option on,
  every creation makes a folder, so a failure leaves one *per attempt*, named after the
  item the user was trying to make — no longer a stray, and no longer rare. That PBI
  therefore carries the cleanup as an acceptance criterion, using the recipe below
  unchanged. The decision recorded here still stands for the flat layout it was written
  about; it is the layout that changed, not the reasoning.

## If it is fixed

Have `ensureFolder` return the segments it created, and delete them in reverse order in
the caller's `catch` — **only** when each is still empty. Never a recursive delete. Both
call sites already have the `catch`.
