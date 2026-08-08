---
type: Issue
order: 80
parent: "[[Smoke test the tree]]"
status: Open
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
  app.metadataCache.getFileCache(app.vault.getAbstractFileByPath('Child.md')).frontmatterLinks
  ```

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

For the unresolved-link case, what the console printed — the `frontmatterLinks` value
itself, not a summary of it. That answer decides one of two follow-ups, and neither
should be taken before it:

- **Obsidian indexes unresolved links** → the bracket handling in `linkpathFromRawValue`
  is dead. Delete it, teach `FakeVault.addFile` to index bracketed values, and move the
  ten fixtures that write brackets by hand onto `parentLink`.
- **It does not** → the fallback is load-bearing for exactly that case. Keep it, and add a
  fixture that reaches it *honestly* — a bracketed value with no link entry, which is then
  a cache Obsidian really does produce.
