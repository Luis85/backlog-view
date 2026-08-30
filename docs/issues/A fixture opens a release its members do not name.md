---
type: Issue
order: 230
parent: "[[Invariants as checks, not conventions]]"
status: Open
priority: P3
area: verification
created: 2026-08-30
source: surfaced while folding the release actions into the header — PR
files:
  - test/helpers/release.ts
  - test/view/release/releaseNotes.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A fixture opens a release its members do not name

## The limitation

`releaseScreen` (`test/helpers/release.ts`) adds `0.9.md` and picks it. Its default vault is
`scopeVault()`, whose two members carry `release: '[[R]]'` — naming `R.md`, a different
release in the same vault. So the default screen is a release with **no members**, and every
caller that does not pass its own vault is driving the empty-scope path.

This is [[A hand-built fixture can model a state the producer cannot produce]] with the
producer being the fixture pair rather than a resolver: nothing is unrealistic here, the two
halves simply do not refer to each other, and no assertion asks whether they do.

## Evidence

Counted rather than estimated — `releaseNotes.test.ts` was named as the worst case while the
release header work was in review, at "~9 cases named for populated releases":

- **12** `releaseScreen(...)` call sites in that file. **9** take `scopeVault()`.
- Of those 9, **8 assert something the members cannot affect**: generation withheld inside an
  embedded base, withheld for four bad configurations, NOT withheld on the shipped default,
  the folder-to-bind note, the button disabled under a sibling's lock, the lock held across
  the write, the path named on failure, and a valid file left alone with membership unbound.
  A release with no members is a legitimate fixture for every one of them.
- **1 lost a real check**: `says so, and writes nothing, when the notes are already up to
  date`. It generates twice and compares, and byte-identical regeneration is a claim whose
  whole risk lives in the body — grouping, ordering, the per-member lines. With no members
  both passes produced the empty-release sentence, so the comparison held for a file that
  cannot vary.

So the estimate was the right worry and the wrong count. Fixed for that one case (2026-08-30):
it builds its own populated vault the way `writes the notes, and opens them` already does, and
asserts the members are IN the first file before comparing — the guard on the guard, since
without it the strengthened test passes on the empty file exactly as before. Watched failing
on the old fixture.

## What is left, and why it is not a rewrite

The default itself. `scopeVault()` could name `0.9`, and then every `releaseScreen` caller
would open a populated release — which is **not** obviously an improvement:

- The default is consumed by eight test files, not one. `releaseClose.test.ts`,
  `releaseEdits.test.ts`, `releaseHeader.test.ts`, `scopeTree.test.ts`, `scopeKeys.test.ts`,
  `scopeCreate.test.ts`, `rowChrome.test.ts` and `scopeToolbar.test.ts` all reach for it.
- Several assert the empty-scope screen **on purpose** — it is the screen `renderScope`
  returns early from, and the reason the actions area has to be drawn above that return.
  Repointing the members would silently move those onto a different path.
- The cases that need members already say so at the call site: `twoWorkflowVault()`,
  `emptyReleaseVault()`, or a vault built in the test. That is the honest shape — a fixture
  named for what it holds, chosen by a test that knows why it needs it.

What would change this verdict: a second case found where the default's emptiness weakens a
claim the test's own name makes. One is a fixed instance; two is a default that lies. The
instrument for finding them is the one used above — read what each case ASSERTS and ask
whether a member could change it, never the test's name, which is what produced the estimate
this note corrects.
