---
type: Issue
order: 80
parent: "[[Smoke test the tree]]"
status: Done
priority: P3
area: verification
cadence: release
created: 2026-08-08
source: measured while hardening the settings fixtures — see [[The fake vault can hold a cache Obsidian would not produce]]
---

# Parent links Obsidian parsed, and ones it did not

A verification to run, and the one question that decides a piece of code's fate.

## Why this exists

`resolveParent` reads a parent link two ways: through `cache.frontmatterLinks`, which is
Obsidian's own parse, and — failing that — by stripping brackets, aliases and heading refs
out of the raw frontmatter value by hand. The fake vault only ever fills
`frontmatterLinks` through its `parentLink` helper, so the suite has never told the two
apart. Measured: with the fake taught to index bracketed values the way Obsidian does,
**nothing in the suite reaches the hand-rolled stripper at all**.

So the fallback's bracket handling is either dead code in production or a real safety net,
and this repository cannot tell which. [[The fake vault can hold a cache Obsidian would not
produce]] holds the analysis; this note is the ninety seconds that settles it.

## How to check

In a vault with the plugin installed, in the folder your base points at.

- **A resolvable link.** Make `Child.md` with `parent: "[[Some Existing Note]]"`. It
  should appear under that note in the tree. Expected: yes, through path 1.
- **An alias.** Change it to `parent: "[[Some Existing Note|Something Else]]"`. Still
  parented, still under the same note. Expected: yes, through path 1 — Obsidian resolved
  the alias, so nothing had to strip it.
- **The deciding one: a link to a note that does not exist.** Set
  `parent: "[[No Such Note]]"`, and then open the developer console (Ctrl/Cmd+Shift+I)
  and ask the cache directly:

  ```js
  app.metadataCache.getFileCache(app.workspace.getActiveFile()).frontmatterLinks
  ```

  With `Child.md` OPEN, which is where you already are after editing it — and which is why
  this asks the workspace rather than naming a file. Two earlier versions named one: by
  path (`Child.md`), which is null the moment the base points at a folder, and by basename,
  which picks whichever match comes first if the vault holds two. Both found by review, and
  the third version is shorter than either.

  An entry `{ key: 'parent', link: 'No Such Note' }` means Obsidian indexes unresolved
  links and path 1 handled it. `undefined` or an empty array means it does not, and the
  hand-rolled stripper is what produced the answer on screen.
- **A plain name, no brackets.** `parent: Some Existing Note`. Should parent correctly.
  This one is path 2's stated purpose and is expected to keep working either way — it is
  the control, and it is why the fallback exists at all.

**Why the console and not the tree.** The first version of this check asked a runner to
watch the unresolved case *in the UI* and report "how it got there". That was
unanswerable, and provably so: both paths return
`{ file: null, hasValue: true, explicitRoot: false }` for a bracketed value that resolves
to nothing, so the note renders as an orphan either way and no rendered difference exists
to see. A run against that instruction can only ever report the outcome both branches
share — which is the same defect as a passing test that would pass with the code deleted,
one layer out: an instrument that cannot distinguish the two states it was written to
distinguish. [[The fake vault can hold a cache Obsidian would not produce]] had it right
first ("a look at whether the link resolves *through the cache*") and this note drifted
off it into something a person could actually be asked to do and still learn nothing.

## What a run has to record

**2026-08-08, in a live vault.** With `parent: "[[No Such Note]]"` on an open note, the
console printed nothing — `getFileCache(...)` returned a real cache object, since an error
would have been loud, and `frontmatterLinks` was simply absent.

**Obsidian does not index a link that resolves to nothing.** The unresolved case therefore
takes path 2, and path 2 is live code rather than a leftover.

## What that did not settle

Both follow-ups this note offered were wrong, and finding out cost one test written and
corrected in place.

"It does not index them → the bracket handling is load-bearing for exactly that case" does
not follow: *reaching* path 2 is not the same as the STRIPPING mattering once there. The
test written to cover it passes with `linkpathFromRawValue`'s wiki branch deleted, because
`[[No Such Note]]` and `No Such Note` are equally absent from the vault — the strip changes
the linkpath and never the answer. Watched failing, as the rule requires; it did not fail,
which is the whole finding.

For the strip to change an outcome, a bracketed value would need no link entry AND a target
that exists — and the measurement says that pair cannot occur, because a link that resolves
is indexed and one that does not is not.

So the position is narrower than either branch offered: **the bracket handling has no
measurable effect in a real vault, and it is kept anyway.** Two lines, and deleting them
would rest on a deduction about Obsidian's link parser rather than on a measurement — a
value that parser declines to index while still naming a real note would regress in
silence. That is a worse trade than two lines carrying a comment that says what they are.

[[The fake vault can hold a cache Obsidian would not produce]] holds what is left: the
fixtures pairing brackets with a resolvable target model a cache Obsidian does not hand
out, and now provably so.

## Runs

**2026-08-08.** The three tree-visible cases were run and passed: a resolvable link, an
alias, and a plain unbracketed name all parent correctly. The console was not opened, so
the deciding case is **not** answered and this note stays Open — which is the outcome the
first version of it would have hidden, since the tree half looks like a complete pass.
Neither follow-up is taken: `linkpathFromRawValue` keeps its bracket handling and the ten
hand-written fixtures stay where they are, on a question rather than on a guess.
