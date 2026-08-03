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

at `git checkout` — **before any build step ran**. NTFS forbids `< > : " | ? *`, a trailing
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

The rename alone would leave the hole open, so `docs-check.mjs` now checks the **name** of
every file it walks: the forbidden characters, the reserved device names, and a trailing
space or dot. Three report sites, each planted in `test/docs/checkerRejects.test.ts` and
each watched failing alone.

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
