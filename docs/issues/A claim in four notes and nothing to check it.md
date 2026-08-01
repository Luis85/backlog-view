---
type: Issue
order: 50
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P3
area: verification
created: 2026-08-01
source: 2026-08-01 review of PR #24
files:
  - docs-check.mjs
---

# A claim in four notes and nothing to check it

## The limitation

`docs-check.mjs` verifies that notes are **well formed** and that their references
**resolve**. It has no idea what any of them *assert*. Two notes can state opposite things
about the same behaviour and every check passes, because both are shaped correctly and
every link they carry points at a real file.

## Evidence

The claim *"an unknown custom type is never rewritten"* was false, and it appeared in four
places: [[Assigning type on a move]], [[Level ladder and implied types]], ADR 0009 and
ADR 0013. Review found each one **separately, in four rounds** — because correcting the
file in front of you does not go looking for the sentence elsewhere, and nothing reported
that three copies were still standing.

Every one of those rounds ran a green `npm run docs` immediately before and after.

## Why it is deliberate

Checking claims means understanding them, and there is nothing between "does this heading
exist" and "does this paragraph mean what that paragraph means". The candidates are all
worse than the problem:

- **A vocabulary of forbidden phrases.** Enumerating the sentences that must not be
  written is the by-name exemption this checker spent fifteen rounds removing, inverted.
- **Requiring behaviour to be stated once and linked.** Sound as a *habit*; unenforceable
  as a rule, because a checker cannot tell a restatement from an ordinary sentence.
- **Cross-referencing notes with the code.** That is a code reviewer, not a validator.

## What actually helps

The habit, written down where the shapes are documented: **state a behavioural claim once
and link to it.** That is now how the asymmetry above is recorded — once in
[[The dragged item is retyped, its descendants are not]], with the other sites pointing at
it rather than restating it.

The gate's real contribution here is indirect and worth naming honestly: it takes the
mechanical failures off a reader's plate so their attention lands on the ones only a reader
can catch. It does not replace that reader, and `docs/README.md` says so — of the seven
kinds of note, only two shapes are enforced at all.

## Acceptance criteria

None. Recorded so that "the docs are checked" is never read as "the docs are verified".
