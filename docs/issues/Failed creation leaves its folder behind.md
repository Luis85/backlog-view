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

## The limitation

Both creation paths call `ensureFolder` before `vault.create`:

- `createBacklogItem` — a new item filed in a type folder that does not exist yet.
- `createBacklogBase` — the **Create backlog** command, scaffolding into a new folder.

`ensureFolder` walks the path and creates every missing segment. If the `vault.create`
that follows then throws — a permission problem, a sync lock, a name the filesystem
rejects — the folders stay. The notice reports the failure; nothing removes them.

Found by review while writing [[New item flow]] and [[Scaffolding a backlog]] as use
cases: both notes had claimed the failure path leaves nothing behind, and neither the
code nor a test said so.

## Why it is deliberate

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

## It was attempted, and reverted

Written up because the reasoning above was **stronger than it looked**, and the only way
that became clear was by ignoring it. The recipe at the end of this note was implemented
in PR #40 and taken back out; review found three defects in it, in three rounds, each one
inside the fix for the last.

| Round | What the cleanup broke |
| --- | --- |
| 1 | It made a folder's *ownership* load-bearing, and nothing made ownership exclusive. A second creation that lost the `createFolder` race recorded nothing and was left depending on a folder the first still believed was its own to unwind. |
| 2 | Reading `TFolder.children` and then deleting is a check followed by an unrelated act. `trashFile` takes a folder **and everything in it**, and `children` is a cache — so a note written by sync, or merely one the cache had not caught up with, was carried off by a cleanup that had just satisfied itself the folder was empty. |
| 3 | The fix for round 2 (`adapter.rmdir(path, false)`, which the filesystem refuses on a non-empty folder) removes the directory **without updating Obsidian's index**. The next creation's `ensureFolder` sees the stale `TFolder`, skips `createFolder`, and its `vault.create` then fails for want of a parent. |

Rounds 1 and 2 were fixable — a creation queue, and an atomic removal. Round 3 is not,
and that is the finding worth keeping:

> **No Obsidian API is both atomic-on-empty and index-consistent.**
> `adapter.rmdir(path, false)` guarantees emptiness and desynchronizes the index.
> `vault.delete` and `fileManager.trashFile` maintain the index and are recursive, with
> no emptiness guarantee at the moment of deletion. There is no documented way to await
> reconciliation.

So the choice is between a cleanup that can delete a file it never made and a cleanup that
can make the next creation fail — to avoid **an empty folder**. That is the trade the
second bullet above predicted without being able to name the mechanism, and it is why the
decision stands rather than merely surviving.

The attempt also found a harness gap worth naming even though the code went back:
`FakeVault.create` happily wrote notes into folders that did not exist, so no test could
have observed a rollback removing a parent out from under a creation. Any future attempt
at this needs that fixed first, or its tests prove nothing.

## What would lift it

- A report of it happening in practice — the failure needs a `vault.create` that throws
  after a successful `createFolder`, which nobody has yet observed.
- Evidence that it happens repeatedly in one session, since the folders would then
  accumulate rather than being a single stray.
- **A change that makes folder creation routine rather than occasional.**
  [[Backlog as folder notes]] is exactly that, and it settles this: with that option on,
  every creation makes a folder, so a failure leaves one *per attempt*, named after the
  item the user was trying to make — no longer a stray, and no longer rare. That PBI
  therefore carries the cleanup as an acceptance criterion, for the **per-item folder
  only**. The decision recorded here still stands for the flat layout it was written
  about; it is the layout that changed, not the reasoning.

  What that leaves open is the **container chain** — the `docs/bugs` an attempt may have
  created on its way to the item. The recipe below removes it, and that is still the
  right answer for the question filed here, which covers flat creation and the scaffold
  command as well. It is deliberately not settled by the folder-note option, because
  `ensureFolder` is shared: a rule written for one creation path would change all three.

## If it is fixed

Have `ensureFolder` return the segments it created, and delete them in reverse order in
the caller's `catch` — **only** when each is still empty. Never a recursive delete. Both
call sites already have the `catch`.

**That recipe is necessary and not sufficient**, which the section above is the evidence
for: it says nothing about how "still empty" is established, and every defect found lived
in that gap. Anything picking this up again needs all four of

- the segments this attempt created, as written above;
- creation serialized, so two attempts cannot disagree about who owns a folder;
- an emptiness test the filesystem makes **at the moment of removal**, not one the code
  reads beforehand; and
- an index that is correct immediately afterwards, or a creation path that does not
  trust it.

The fourth has no answer in today's API, so the honest trigger is **an Obsidian release
that adds one** — a removal that is non-recursive, fails on non-empty, and updates the
vault index. Failing that, a creation path that treats `getAbstractFileByPath` as a hint
rather than an authority would close it from the other end, but only if `createFolder`
consults the filesystem rather than the index, and that cannot be verified here.
