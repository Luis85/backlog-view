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
and link to it.**

That habit was **not** followed for the asymmetry above, and this note claimed it had been.
What actually happened is that each site kept its own statement and gained the missing
qualification plus a link onward:

| Site | What it holds | Points at |
| --- | --- | --- |
| [[Assigning type on a move]] | extensions 3b/4b, *The asymmetry* with the table, an acceptance criterion | the issue note |
| [[Level ladder and implied types]] | extension 2a, one sentence | the use case |
| [ADR 0009](../adrs/0009-the-type-rules-are-advisory.md) | a consequence, four lines | the use case |
| [ADR 0013](../adrs/0013-fix-the-type-vocabulary-at-six-names.md) | a parenthesis | the use case |
| `src/domain/CLAUDE.md` | the principle, then the exception | the issue note |

So the pointers form a **chain toward the use case**, not spokes around one authority, and
the count went from four sites holding the false claim to **five holding the corrected
one**. Correcting a claim in place adds a restatement; it does not remove one.

Both readings were available and only one is honest. This is not the habit working — it is
a fuller instance of the very thing the note is about, in the notes written to record it.

**And the restatements are defensible**, which is the uncomfortable part. An ADR exists to
be read years later by someone reconstructing a decision; one that said only *"see the use
case"* would fail that reader. `src/domain/CLAUDE.md` is loaded by an agent editing
`domain/`, who will never open `docs/`. Each site has a different reader and a different
job, so "state it once" collapses to "state it once **per audience**" — which is where the
duplication comes from and why no discipline dissolves it.

What remains is therefore smaller than a habit and worth having anyway: the issue note that
owns the behaviour carries **the list of places that restate it**, so resolving the
asymmetry is a checklist rather than a memory. That is a list, not a check — it goes stale
exactly like the claims it tracks, and nothing reports it when it does.

The gate's real contribution here is indirect and worth naming honestly: it takes the
mechanical failures off a reader's plate so their attention lands on the ones only a reader
can catch. It does not replace that reader, and `docs/README.md` says so — of the seven
kinds of note, only two shapes are enforced at all.

## Acceptance criteria

None that a checker can take. Recorded so that "the docs are checked" is never read as
"the docs are verified" — and, after this note overstated its own remedy and had to be
corrected in review, so that a claim about the register is held to the same standard as a
claim about the code.
