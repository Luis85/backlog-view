---
type: Bug
parent: "[[Codebase health]]"
order: 270
status: Done
area: tooling
priority: P1
created: 2026-08-03
closed: 2026-08-03
source: Windows CI on PR #61, checkout step
files:
  - docs-check.mjs
  - test/docs/checkerRejects.test.ts
---

# A note title Windows cannot check out

## What happened

A note was committed as `Finding 4 — "a few hundred rows" is a comment, not a check.md`.
The title quotes a comment in `src/view/CLAUDE.md`, and on Linux the double quote is an
ordinary character in a filename, so nothing anywhere objected: `npm run check` passed all
five steps, `git add` took it, and the push succeeded.

The Windows CI job then failed with

```
error: invalid path 'docs/issues/Finding 4 — "a few hundred rows" is a comment, not a check.md'
```

at `git checkout` — **before any build step ran**. NTFS forbids `< > : " | ? * \`, a trailing
space or dot, and the reserved device names. The consequence is worse than a failing test:
the repository could not be cloned at all on half the platforms it supports, so no test and
no gate in `docs-check.mjs` had any chance to report it, and the failure surfaced as an
unclonable tree rather than as a file somebody added.

This is the third defect the root guide's *"paths and line endings are the only things that
differ between them"* sentence has produced, and the first that made the checkout itself
impossible.

## Fix

The file is renamed with typographic quotes — `“a few hundred rows”` — which carry the same
meaning and are legal on every platform.

The rename alone would leave the hole open, so `docs-check.mjs` now checks the name of every
**directory entry** `walk` meets — forbidden characters, reserved device names, trailing
space or dot — before anything filters by extension, and for folders as well as files. A
directory called `NUL` is exactly as unclonable as a note.

**The first version of that check was wrong in both directions at once**, and is worth
recording because it looked right and had a passing test under it. It stripped `.md` to
find a "stem" and tested that:

- `A trailing thought..md` ends in `d`. Windows holds it happily and git checks it out
  everywhere — but the stripped stem ends in a dot, so the gate **rejected a legal name**.
- `A trailing thought.md.` is the name that actually breaks a checkout, and it is not a
  `.md` file, so `walk` never returned it and the check **never saw the case it was for**.

The planted rejection case used the first of those, so the suite asserted the false
positive was correct behaviour and went green. Reading the *directory entry as it sits on
disk* is what makes both cases come out right; the fix is now covered from both sides —
an accept case for `A trailing thought..md` that fails if the stem-stripping returns, and
a reject case for `A trailing thought.md.` that fails if the rule is removed.

The backslash in that set is the one worth naming: on Linux and macOS it is an ordinary
character in a *name*, so `A\B.md` commits cleanly and only Windows reads it as a
separator. It was missing from the first two versions of the rule. `/` is deliberately
absent — no POSIX filesystem can hold it in a name, so a rule for it could never fire. The
check reads `entry.name` rather than the joined path, which is what stops the separator on
a Windows run from matching every entry in the tree.

The three rules are a table of pattern-and-reason rather than three `if`s, which is what
keeps the function under fallow's complexity threshold — the first shape crossed it, and
the check that caught that was `npm run check`'s fourth step rather than review. So this is
one report site with three planted cases in `test/docs/checkerRejects.test.ts`, and each
was watched failing by removing its row from the table.

Those three cases are **skipped on Windows**, and the reason is the rule restating itself:
a case has to create the filename it plants, and Windows cannot create these. The rule
reads a string and is platform-neutral, so the Linux and macOS runs cover it, and the
report-site count test pins the sites on every platform.

Scoped to `docs/`. That is the only tree here whose filenames are written as sentences —
a module under `src/` is named for an identifier, and the same mistake there would fail an
import long before CI.

## Lesson

**A gate that runs after checkout cannot see a defect in checkout.** Every check this
repository owns — five steps, two platforms — runs on a tree that already exists on disk,
so the one thing none of them can examine is whether the tree can be *created*. That class
has to be checked on the name, by something that reads it as data rather than by opening it.

The generalisation worth keeping is about where a rule lives, not about Windows: when a
constraint belongs to the environment rather than to the content, the check has to be
written where the environment is not yet involved. `npm run check` was green on a commit
that could not be checked out, and green meant only "green here".

The second lesson is about the fix rather than the defect. **A rule that normalises its
input before testing it is testing something else.** Stripping `.md` turned the question
"can Windows hold this name" into "can Windows hold this name minus an extension", which is
a different question with a different answer in both directions — and the planted case,
written from the same misunderstanding, agreed with it. This register already knows that a
comment stating a rule is not a check; the narrower point here is that a *test* written
from the same wrong model is not one either. What caught it was someone reading the rule
against the constraint rather than against the test.
