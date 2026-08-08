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

A second instance, 2026-08-08, and it is **not** the same shape — which is what produced
the partial remedy below. The claim *"the Deliverable key, states and done values fall
back as one unit"* was false, and it reached five places: the root `README.md` twice, this
register's index, the parent feature note, and the use case's precondition, main flow and
extension. Review found them one at a time again, and the correction of the extension
shipped in the same commit that left the precondition and main flow standing.

What is new is the evidence: **the check already existed and said the opposite.**
`test/domain/settings.test.ts` — "keeps its own declared states over the shared list once
configured" — landed in `fe69c4d`, and the wrong sentence was written the same day, in
`d4a26bd`. Both sides green. So this instance was not a claim beyond a validator's reach.
It was a claim whose check was sitting in the repository, and nothing connected the two.

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

## The one part a checker can take

The three candidates above all try to judge a claim, and that is why they fail. The second
instance showed a fourth thing that is not a judgement at all: **a citation**. A claim may
name the check that holds it, and `docs-check.mjs` resolves that citation the same way it
already resolves a wikilink or a source path — the file is there, the test name is still
inside it. `docs/README.md` documents the form under **Conventions**.

Read exactly what that is worth, because it is easy to read as more:

- It does **not** verify the claim, and cannot. A citation to a real test says nothing
  about whether the sentence beside it describes that test.
- It is **opt-in**. An unmarked claim is exactly as unchecked as it was before, which is
  the by-name weakness this gate spent fifteen rounds removing — taken back knowingly,
  because the alternative is a gate with an opinion about every sentence here.
- Duplication is untouched. Five copies each citing the same test would all still be
  wrong together, and this note's argument that per-audience restatement is irreducible
  stands unchanged.

What it does buy is one step in the author's hands: **going to fetch the test name**. On
the instance that produced it, that step alone was decisive — the test asserted the
opposite of the sentence being written, on the same day, and opening it was the only thing
between the two. It also fails the build when a cited test is renamed or deleted, in a
closed note as loudly as a living one, since a citation claims the check is live.

So the honest summary is that the gate now catches a **rotted** citation and nothing else,
and the value is mostly in the habit the form makes cheap rather than in the rule.
**Checked by** `test/docs/checkerRejectsCitations.test.ts` — "a citation naming a test the
file no longer contains".

It caught its own author within the hour, which is the only field evidence this note has
for it: the citation above first named `checkerRejects.test.ts`, that file hit its line
budget, the citation cases moved to a file of their own, and the run went red on a
reference nobody would have thought to re-check. A rename is the ordinary way a citation
rots, and it rotted on the first one.

## Acceptance criteria

None *for the claims themselves* — that half stands. Recorded so that "the docs are
checked" is never read as "the docs are verified"; and, after this note overstated its own
remedy once and had to be corrected in review, so that a claim about the register is held
to the same standard as a claim about the code. The citation rule above is written to that
standard deliberately: its section says what it does not do before it says what it does.
