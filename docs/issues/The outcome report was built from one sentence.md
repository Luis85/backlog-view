---
type: Issue
order: 30
parent: "[[The horizon board]]"
status: Done
priority: P2
area: design
created: 2026-08-02
closed: 2026-08-02
source: PR #47 — six of seven review rounds landed inside one unspecified mechanism
files:
  - docs/requirements/New cards in place.md
  - docs/requirements/Moving between horizons.md
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# The outcome report was built from one sentence

## The decision

[[Moving between horizons]] extension 3b requires that a move whose new value takes the
note **outside the Base's filter** applies anyway, and is *"announced with a notice
naming what happened and offering to open the note"*. That sentence was implemented, as
`src/view/interactions/outcome.ts`.

The sentence is the whole specification available. Its mechanism belongs to
[[New cards in place]] — the board's rule for a card created into a state the base
excludes — and that note is design, unbuilt, `P2`, under a different feature. So 3b was
built by inferring the mechanics from one clause of a cross-reference to a note nobody
has written the code for.

**The alternative was available and was not taken**: leave 3b unbuilt, say so in
`## Where it lives`, and let the mechanism arrive with the note that specifies it.

## Why

Because the criterion is this note's, not the other one's: *"A move whose value takes
the note outside the Base's filter applies, is announced with an open path, and stays
undoable."* Shipping the feature while quietly dropping one of its five acceptance
criteria would have made `## Where it lives` say "Built" about something that was not.
The register's whole value is that a reader can trust that line.

## What it cost, measured

Thirteen review findings across seven rounds on PR #47. Two were in the horizon board
proper — the drag, the keyboard, the menu, creation, the shelf — both in the first
round, and nothing there was reopened in the six rounds after. **The other eleven were
in this mechanism, and rounds two through seven consisted entirely of defects in the fix
for the previous round's defect:**

| Round | Finding, each inside the previous round's fix |
| --- | --- |
| 1 | 3b not implemented at all |
| 2 | the watch armed *after* the data pass that answers it |
| 3 | one slot, so a second move erased the first note's answer |
| 3 | the notice named the filter for both ways a note can leave |
| 4 | an older move's response retired a newer move's watch |
| 4 | un-placing an unreadable value announced as a move to where the card already was |
| 5 | resolving a watch by NOTE dropped an outstanding earlier move on the same card |
| 5 | **an unrelated pass retires the oldest watch** — see below |
| 6 | two watches on one card both answered a pass, so one departure produced two notices |
| 7 | the newest-only fix left the held watch unremovable, so it fired later as a stale notice |
| 7 | superseding removed the queue slot that would have consumed the earlier response |

Each is a rule that a written use case would have stated in a sentence, the way this
register's extensions routinely do — *which pass answers*, *what happens when two moves
overlap*, *what the message says when the cause is hiding rather than filtering*. They
were instead discovered one at a time, by a reviewer, after the code existed. That is
precisely the argument [[Two spec branches predate the use-case gate]] makes for writing
the use case first, arriving from the other direction: not "the shape asks questions
prose does not", but "the shape asks them **before** the third rewrite instead of
after".

## Round five is the one that settles it

The last finding is not a bookkeeping slip like the six before it. Every previous fix
narrowed *which* pass may answer a watch; round five points out that the narrowing rests
on an assumption that is simply false — that every data pass belongs to a queued write.
Passes also arrive from an edit in another pane, a rename, any vault change. One of
those between a move and its own response retires the watch on a result set that
predates the write.

**The correlation that would close it is not available.** Checking that the note now
carries what the write wrote proves the *metadata cache* has seen it — which is upstream
of the Bases query and equally true of a stale result set. Nothing in a result set says
which write it was computed after. Closing this needs a different design (quiescence, a
debounce, a snapshot compared across passes), which is to say it needs a decision, which
is to say it needs the use case that was never written.

It is therefore recorded as a known limit in `outcome.ts` rather than patched a sixth
time. Its cost is a missed notice in a narrow race — the behaviour everywhere else in
the plugin before this PR — and never a wrong write or a wrong report.

## The decision taken

**Option 2: the mechanism came out.** `src/view/interactions/outcome.ts`, its wiring in
`applyCardMove`, its tests and the `pbl-notice-open` styling were removed from PR #47 on
2026-08-02, and [[Moving between horizons]] now records extension 3b as unbuilt. All
eleven findings left with it. What remained is the horizon board itself — drag, keyboard,
menu, creation, the shelf — which drew two findings in round one and was not reopened in
the six rounds after, and which passed CI on Ubuntu and Windows.

The alternative was to keep the code and write the extensions around it. It was rejected
for one reason: the last finding cannot be settled by wording. A pass cannot be
correlated with a write from anything the view can see, so the note would have had to
describe a rule nobody has yet chosen — which is writing the specification after the
code all over again, with the code voting.

## What the next attempt needs

Written as extensions on [[New cards in place]] **before** any code, because every one
of these was discovered by a reviewer after the fact:

1. **Which pass answers a write.** The trap: a data pass arrives from any vault change,
   not only from the write in hand, and nothing in a Bases result set says which write
   it was computed after. Checking that the note now carries the written value does not
   help — that proves the metadata cache saw it, which is upstream of the query and
   equally true of a stale result set. A design that does not need the correlation
   (quiescence, a debounce, comparing successive result sets) is the likely answer.
2. **Two writes outstanding at once**, on different notes and on the same note, with the
   second one failing.
3. **Which of the two ways out is named** — the Base rejected the note, or the same
   write finished it while completed items are hidden. Different messages: each sends
   the reader to a different setting.
4. **What the report offers.** A notice with a way back to the note, reachable without a
   pointer.

Rules 2 to 4 were reached and are in PR #47's history if the next attempt wants them.
Rule 1 is the open one.

## Acceptance criteria

- ~~The register never over-claims in the gap: [[Moving between horizons]] records 3b as
  unbuilt on the same commit the code leaves.~~ Done — both landed together.
- ~~No note claims a mechanism is built while its rules live only in source comments.~~
  Done.
- **Open, and inherited by [[New cards in place]]**: rule 1 above is decided and written
  down before the mechanism is built again. This note closes because its decision is
  taken; that criterion travels to the note that owns the mechanism.
