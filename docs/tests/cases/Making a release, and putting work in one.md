---
type: Test case
order: 40
parent: "[[Smoke test the release view]]"
status: Open
priority: P2
area: verification
cadence: release
created: 2026-08-30
source: the 0.10.0 release review; the creation gesture added 2026-08-25, unrun; the
  date-writing steps from [[Joining a release dates the work]], 2026-09-02
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

[[Joining a release dates the work]] then made `Set release` write two dates beside the
membership, and the last four steps below are its live-vault half: the plugin's own tests
run against `FakeVault`, so what a real `processFrontMatter` does to a date — and what the
roadmap does with it afterwards — is unanswered here by construction.

**Preconditions** — as [[Release view registration and options]], plus a second vault, or a
second base, whose backlog home folder is **not** `docs`. For the date steps: the start and
target properties bound on the backlog view, the roadmap on its dated axis, and a release
carrying a target date of **today or later**.

That last clause is load-bearing rather than tidiness. A release whose date has passed is a
legitimate vault and a case this feature handles on purpose — [[Joining a release dates the
work]] 4b suppresses the start, because today would fall after the due — so the next two
steps would see ONE key and an endpoint where they say two keys and a bar, and a walker
following them literally would record a failure against an implementation doing exactly what
it should. The past-release case is checked twice already: by the third date step below, and
by `test/storage/releaseWrite.test.ts`. Added 2026-09-02 after review found the setup could
fail correct code (Codex, PR #242).

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
- **What a date looks like on disk after a join.** Put an item with neither date into a
  release and open the note. Obsidian's own serializer wrote both keys: confirm the spelling
  is a plain civil date and not a quoted string, a timestamp or a list, and that no other
  key moved. `mergeDate` and `setOwn` are checked against a stand-in vault only.
- **That the bar appears without a manual refresh.** Same gesture with the roadmap open on
  its dated axis: the item should leave the shelf and draw between the two dates on the
  write's own refresh. Then undo, and confirm both keys AND the membership go back together
  — one batch, one undo, which is the guarantee the whole use case rests on.
- **A note whose dates the plugin must not touch.** Give an item a due of its own, then join
  it to a release with a different date: the typed value stands. Then give an item a start
  LATER than the release's date and no due, and join it: no due is written, and the item does
  not land on the roadmap's shelf as a reversed span.
- **The race, by hand.** Open an item's note in a second pane. Open `Set release` on its row
  in the first, type a due into the note while the submenu sits open, then pick the release.
  The typed value must survive. This is the one step that cannot be faked in jsdom at all,
  and the defect it guards against is silent — see
  [ADR 0033](../../adrs/0033-a-stale-rule-is-decided-at-the-writer.md).
- **Bind the membership property apart in the two views on purpose, once.** No code may
  compare them, and a mismatch looks exactly like a vault nobody has assigned yet: every
  scope empty, nothing unresolved, no warning. See what the two screens say — that is the
  whole of the signal a user gets.

## Acceptance criteria

- A release can be made and populated from a fresh vault, and every question above has a
  recorded answer rather than an assumption.
- The four date steps are answered against a real vault, and a date the reader typed is
  still there afterwards.

## Outcome

**2026-08-30 — exercised during development, not walked as a sweep.** The maintainer
reports testing this behaviour in a vault while 0.10.0 was built. That is evidence of use
and it is recorded as such; it is **not** a run of the steps below, which were not walked
one by one. Everything here that needs a community theme, a themed accent, a real pane
width or a screen reader is therefore still unanswered — those are the questions this note
exists for, and the ones development use is least likely to have asked. The note stays open
for the next sweep.

Not walked as a sweep.
