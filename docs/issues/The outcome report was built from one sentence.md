---
type: Issue
order: 30
parent: "[[The horizon board]]"
status: Open
priority: P2
area: design
created: 2026-08-02
source: PR #47 — four of five review rounds landed inside one unspecified mechanism
files:
  - src/view/interactions/outcome.ts
  - src/view/backlogView.ts
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

Ten review findings across five rounds on PR #47. Two were in the horizon board
proper — the drag, the keyboard, the menu, creation, the shelf — both in the first
round, and nothing there was reopened afterwards. **The other eight were in this
mechanism, and rounds two through five consisted entirely of defects in the fix for the
previous round's defect:**

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

## What a real fix would look like

Two options, and the choice is the maintainer's. **Round five moves the recommendation
firmly to the second**: six rounds of narrowing have not reached a correct rule, and the
seventh will not either while the rule itself is undecided.

1. **Write the use case, then keep the code.** [[New cards in place]] gains the
   extensions the five rounds discovered — the answering-pass rule, overlapping writes,
   a second write to the same note, the two causes and their two messages — and
   `outcome.ts` becomes its implementation rather than an inference. The code satisfies
   all of them but the last; what is missing is the note that says why, in a place a
   reader looks, and a decision on the one it cannot satisfy.
2. **Lift the mechanism out of the horizon board.** `outcome.ts`, its wiring in
   `applyCardMove`, its four tests and the `pbl-notice-open` styling move to their own
   change against [[New cards in place]], and [[Moving between horizons]] stays honest
   by recording 3b as unbuilt until then — including its own known limit, which no
   amount of narrowing has closed. The board needs the same mechanism for
   creation, so it is not roadmap work sitting in the wrong place — it is shared work
   that arrived through the roadmap's door.

Option 1 is cheaper and keeps a criterion that is currently *almost* satisfied — the
round-five limit is the part no wording of the note would make true. Option 2 is the one
that would have avoided all eight findings, and after five rounds it is the one to take.

## Acceptance criteria

- Whichever option is taken, no note claims a mechanism is built while its rules live
  only in source comments — which is what the state after round one amounted to.
- The round-five limit is closed by a design decision recorded before any more code,
  not by another narrowing of which pass may answer.
- If option 1: the extensions are written from the four rounds' findings, not
  paraphrased from the code, so the note can disagree with the implementation.
- If option 2: [[Moving between horizons]] records 3b as unbuilt on the same commit the
  code leaves, so the register never over-claims in the gap.
