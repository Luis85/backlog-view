---
type: Issue
order: 20
parent: "[[Collapse persistence]]"
status: Open
priority: P3
area: limitation
created: 2026-07-31
source: PR #14, third Codex review
files:
  - src/storage/viewStateStore.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# A base embedded in a note keeps collapse state for the session only

## The limitation

When a `.base` is embedded in a Markdown note, the view is drawn inside the *host note's*
leaf. The only file `resolveViewIdentity` can see there is the note, not the base — so
it declines to key anything, and the view falls back to session-only collapse state.

## Why it is deliberate

The alternative was worse. Keying on the host note means **every base embedded in that
note, and every view of each, answers to one storage key** — they would inherit each
other's open rows and overwrite each other's state on save. Since most views keep the
default name `Backlog`, two embedded backlogs in one note would collide immediately.

That is exactly the sharing the identity check exists to refuse. The principle is stated
in `CLAUDE.md`: a shared fallback key is worse than not persisting.

An earlier revision of PR #14 did key on the host note; the third Codex review caught it
and it was fixed in `c3d315b`.

## What would lift it

A public way to ask an embedded Bases view which base it belongs to. The Bases API
deliberately gives a view no reference to its own file, and reaching into internals
cannot be verified in this repository (Obsidian does not run here), so guessing would
mean shipping an assumption as a guarantee.

If such an API appears, `resolveViewIdentity` is the only function that changes.

## Impact

Embedded bases behave exactly as the plugin did before persistence existed: the tree
opens collapsed and remembers within the session. Bases opened as files — the common
case — are unaffected.

## Acceptance criteria

None while the API gap stands. Revisit if Bases exposes view identity.
