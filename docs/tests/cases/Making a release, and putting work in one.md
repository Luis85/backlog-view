---
type: Test case
order: 40
parent: "[[Smoke test the release view]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-30
source: the 0.10.0 release review; the creation gesture added 2026-08-25, unrun
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# Making a release, and putting work in one

A verification to run.

## Why this exists

`New release` is the only way a vault gets its first release from inside the plugin, and
`Set release` on the backlog's own row menu is the only way a scope is ever non-empty.
Neither has been seen in Obsidian, and three of the questions below are about a **real
vault's** shape rather than about the code.

**Preconditions** — as [[Release view registration and options]], plus a second vault, or a
second base, whose backlog home folder is **not** `docs`.

## How to check

- **`New release` in its two positions.** It is the same control at the head of the index,
  above the scroller, and inside the no-releases empty state beneath the guidance text.
  Whether a `mod-cta` button reads as chrome in the first and as a call to action in the
  second is a layout question no test asks.
- **The bind notice.** Pressing the control can change the saved view's configuration before
  the dialog opens — it binds the membership, version, target-date and status properties this
  vault has never named. One sentence, fired once, over a dialog that is opening: does a
  reader take it as "your base was just edited", or as noise beside a form?
- **Where a release lands on disk.** `releaseFolder` ships as `docs/releases` and is created
  if absent. Make one on the shipped defaults and confirm the path. **Then do it in the vault
  whose home folder is not `docs`** — this view cannot read the other view's home folder, so
  the release lands in `docs/releases` until the option is set. Nothing detects that and
  nothing warns: the whole of the signal is where the note appears.
- **The dialog itself**: a title, then whichever of version, target date and status this
  vault has bound, in that order; confirm disabled until a title is typed. Does a dialog of
  one field — a vault that cleared all three — look deliberate or broken?
- **Where focus lands after a create**, made with the keyboard alone. The press puts focus
  back on `New release`, but only wins a refresh arriving inside the create's own await. The
  first release is the worst case: the empty state that held the control is replaced by the
  index.
- **That the first release makes the properties pickable.** Nothing is backfilled onto
  existing notes, so Obsidian's picker cannot offer `version`, `target-date` or `status`
  until a note carries them. After the first `New release`, confirm each is offerable from
  Obsidian's own list rather than only bindable by suggestion.
- **`Set release`'s length**, on the backlog view's row menu, against a vault with many
  releases: no cap and no search. Is it a submenu anybody can use?
- **Two releases sharing a basename** — `Releases/2.4` and `Archive/2.4` — are named apart by
  their whole path minus the extension. Pick each in turn and **open the link the item ends
  up carrying**: the check under that claim runs against a stand-in resolver written here,
  not Obsidian's.
- **The row menu's total length** in a fully configured vault, where `Set release` joins Set
  type, state, risk, priority, assignee, iteration, horizon, the schedule entry, Edit tags
  and the dependency entries. Does it still read as a menu, or want grouping?
- **Whether the index looks right with no release rows in the backlog tree.** A `Release`
  is drawn on no backlog projection and is offered by no New menu, so this view is the only
  place a release is visible. A vault that used to see its releases as tree rows will not.
  Open both views in a vault holding releases and check that nothing reads as data lost.
- **Bind the membership property apart in the two views on purpose, once.** No code may
  compare them, and a mismatch looks exactly like a vault nobody has assigned yet: every
  scope empty, nothing unresolved, no warning. See what the two screens say — that is the
  whole of the signal a user gets.

## Acceptance criteria

- A release can be made and populated from a fresh vault, and every question above has a
  recorded answer rather than an assumption.

## Outcome

Not yet run.
