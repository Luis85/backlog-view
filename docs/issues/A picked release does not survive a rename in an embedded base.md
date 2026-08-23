---
type: Issue
order: 510
parent: "[[Every release in one list]]"
status: Open
priority: P3
area: design
created: 2026-08-23
source: Codex review of the release-management increment PR, verified at source 2026-08-23
files:
  - src/view/release/releaseView.ts
  - src/storage/viewIdentity.ts
  - src/storage/viewStateStore.ts
  - src/view/viewState.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A picked release does not survive a rename in an embedded base

Picking a release is remembered per device and per saved view. Renaming that release — or
any folder above it — is carried where the base is a `.base` FILE, and is not carried where
the base is EMBEDDED in a note. In the embedded case the next data update finds a path the
vault no longer has and draws the index instead, silently.

## Why the two cases differ

`resolveViewIdentity` (`src/storage/viewIdentity.ts`) returns null for an embedded base **on
purpose**: an embedded base is drawn inside its host note's leaf, so the file it would key
on is the host note, and every base embedded in that note — plus every view of each — would
answer to one key and overwrite each other. Refusing an identity is what stops that sharing.

The consequence is that an embedded base has no persisted entry. The pick lives only in the
view's in-memory `pickedPath`, which is session-only by design and gone on reload.

Both rename walks migrate a PERSISTED entry, so neither can reach it:

- `renamePathPrefs` (`src/storage/viewStateStore.ts`, wired at the plugin in `src/main.ts`)
  migrates the stored `prefs.release` for every view identity.
- `renameScoped` (`src/view/viewState.ts`) migrates the loaded BACKLOG view's in-memory copy,
  whose flush writes `prefs` back wholesale and would otherwise restore the stale path.

## Why it is accepted rather than fixed

Ruled on 2026-08-23. A view-level `vault.on('rename')` subscription on `ReleaseView` would
close it, and was declined: it duplicates a subscription two views would then both hold, and
it moves where the pick is read and written. Against that, the value is already ephemeral —
an embedded base's pick does not survive a reload either — and the index is one press from
every release.

Recorded because nothing checks it. The behaviour is stated at `restorePick`'s docstring,
and a docstring is not a check; this note is where the cost is written down.

## What would close it

Either a rename listener the release view owns, or an identity for an embedded base that is
unique per base rather than per host note — the second would close this and the reload case
together, and is the larger question of the two.
