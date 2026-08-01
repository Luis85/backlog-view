---
type: Issue
order: 50
parent: "[[Creating items]]"
status: Done
priority: P3
area: limitation
closed: 2026-08-01
created: 2026-08-01
source: 2026-08-01 Codex review of PR #24
files:
  - src/storage/frontmatter.ts
  - src/storage/baseFile.ts
  - test/storage/frontmatter.test.ts
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

## Outcome

Fixed, on that recipe with one correction the recipe did not contain. `ensureFolder`
returns the segments it created — pushed only after a `createFolder` that succeeded, so a
folder that already existed is never in the list — and `removeCreatedFolders` walks them
deepest first, **stopping at the first refusal** rather than skipping past it. Both
creation paths call it from their own `catch` and rethrow, so the notice the caller shows
is unchanged.

The correction is where "still empty" is decided. The obvious reading — check
`TFolder.children`, then delete — cannot deliver it, and review caught the claim before
the code did. `trashFile` takes a folder **and everything in it**, and `children` is
Obsidian's cache, so a note written by a sync client either in the gap or merely *before
the cache caught up* is carried off by a cleanup that has just satisfied itself the folder
was empty. That is precisely the hazard this note's own "Why it is deliberate" section
named, reappearing inside the fix for it.

So emptiness is asked of the filesystem at the moment of removal:
`adapter.rmdir(path, false)` is documented to require an empty folder and to fail
otherwise, which makes the test and the delete one operation instead of two. The rule
survives intact — deleting more than we made is far worse than a stray empty folder — but
it now rests on a guarantee the API makes rather than on an assertion about a value read
earlier.

Five tests: the chain unwinds deepest first, a pre-existing folder is kept, a folder that
gained a file is kept along with everything above it, a folder holding a note **the cache
has not seen** is kept, and a creation running beside a failing one keeps its parent.

### What the fix cost that the recipe did not mention

Rolling back makes a creation's *ownership* of a folder load-bearing, and review of the
change found the recipe silent on who else might be holding one. `ensureFolder` decides
what to create by looking at what is there, and the rollback decides what to remove the
same way; two attempts interleaving between those two looks disagree. The second sees the
folder present, tolerates its `createFolder` collision, records nothing — and is left
depending on a folder the first still believes is its own to unwind. Whichever way that
lands is wrong: the second loses its parent mid-write, or the first silently keeps a
folder it should have taken back because the second's note made it look occupied.

Nothing upstream prevented it. `createFromPrompt` calls into storage directly rather than
through the view's write gate, so two modals, two views, or a creation beside the scaffold
command all arrive unserialized — the one write path that was not.

Fixed by removing the interleaving rather than coordinating across it: creation now runs
through a queue, so each attempt observes the vault, acts and unwinds before the next one
looks. That is what `applyWrites` already does, for the same reason. Worth recording as a
cost of this Issue rather than a separate one: **the residue was safe to leave precisely
because leaving it needed no notion of ownership**, and taking it back is what created the
question.

**It was not the trigger this note named that fired.** No user report exists, and
[[Backlog as folder notes]] is still unbuilt. What changed is the reading of this note's
own reasoning: the case against was never a safety case. Point (a) called the bookkeeping
"a small change"; point (b) is a real hazard — the window in which something else puts a
file in the folder — and the recipe above already answers it, since only what this attempt
made is a candidate and only while it is still empty. What remained was cost against a
rare residue, and the cost turned out to be about forty lines with the hazard handled.
Doing it now also means the option that would *require* it does not have to arrive
carrying a storage change as well.

## What this corrects in the note that reads it

[[Backlog as folder notes]] states the opposite for the container chain: *"Nor does the
container chain `ensureFolder` walks (`docs/requirements`) belong to the attempt — only the
per-item folder does."* That sentence is now wrong, and it was wrong on its own terms.

Its test for ownership is right — a folder **reused** because it was already there and
empty belongs to the user, and removing it would be the one destructive thing the flow can
do. But it applied that test to the *whole* container chain, when a chain segment this
attempt created passes the same test as the per-item folder does: nobody had it a moment
ago. Restoring the pre-attempt state means `docs/bugs` goes too, if this attempt is what
made it; it means `docs/bugs` stays if anything else did. The PBI has been corrected to say
so, which is the whole of what that note loses — its per-item criterion is unaffected and
still belongs to it, since the folder it names is not one `ensureFolder` walks to.
