---
type: Issue
order: 230
parent: "[[Invariants as checks, not conventions]]"
status: Done
priority: P3
area: verification
created: 2026-08-30
source: surfaced while folding the release actions into the header — PR
files:
  - test/helpers/release.ts
  - test/view/release/releaseNotes.test.ts
  - test/view/release/releaseHeader.test.ts
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

**Nothing, and the reasoning that said otherwise was argued rather than measured.** This
section first refused the fix on the grounds that the default is consumed by eight test
files and that several assert the empty-scope screen on purpose, so repointing the members
would move them onto a different path silently. Kept here rather than deleted, because the
refusal was wrong in a way worth reading: none of it had been tried.

**The measurement.** Repointing `F1`/`F2` from `[[R]]` to `[[0.9]]` and running the release
suites failed **one** test of 205 — not several, and not in any of the files the paragraph
above named as asserting emptiness deliberately. The one failure was
`releaseNeverEdits.test.ts`, and it named the real coupling, which no amount of reading the
call sites had surfaced: `scopeVault()` is used **two ways**. `releaseScreen` adds `0.9.md`
to it and picks that; `makeReleaseView` is also handed it directly, and then `0.9` does not
exist in the vault at all. Members repointed to `0.9` leave that second caller with a vault
whose members name a release that is not there.

**The fix follows from that.** Each release keeps its own members: `F1`/`F2` stay on `[[R]]`,
and `M1`/`M2` are added naming `[[0.9]]`, one of them done so the default screen also has a
real rollup and a half-filled bar. Full suite green — 266 files, 4252 tests.

## The check under it

All-green after a fixture change is exactly the reading this repository distrusts, since it
is equally consistent with "nothing observed the change". So the difference is asserted
directly, in `releaseHeader.test.ts`: **the default screen draws `.pbl-rel-summary`**, which
`drawSummary` WITHHOLDS on a memberless release — the one element whose presence cannot be
true of the empty screen. Watched failing with the two members removed.

That is also the guard against this recurring. The defect was silent for the whole life of
the fixture because every symptom of it was a test passing for a slightly weaker reason;
repointing the members again now fails one named assertion instead.

## What this cost, in order

Worth keeping as a sequence rather than a conclusion, because the conclusion was reached
last:

1. The PR body carried the estimate — "~9 cases named for populated releases actually
   exercise the empty-scope screen" — read off the test NAMES.
2. Counting what each case ASSERTS corrected it: 9 of 12 take the default, 8 of the 9 cannot
   be affected by a member, 1 lost a real check.
3. That one was fixed on its own, and this note filed refusing the wider fix on reasoning.
4. The wider fix was then tried, took one minute, and failed one test — which explained the
   real constraint and produced a better fix than either the estimate or the refusal.

Step 3 is the one to notice. The repository's own rule is *measure with an instrument that
can see all of it*, and a refusal is a claim like any other: **"this would break eight test
files" was never run.**
