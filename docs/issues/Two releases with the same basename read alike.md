---
type: Issue
parent: "[[Every release in one list]]"
order: 500
priority: P3
area: design
status: Open
created: 2026-08-23
source: automated review on PR #191, 2026-08-23
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Two releases with the same basename read alike

Obsidian allows `Releases/1.0.md` and `Archive/1.0.md` in one vault. Both draw a row on the
index reading `1.0`, and both draw a header reading `1.0`. Where their other figures are
equal or unconfigured, nothing on screen tells them apart: the path that distinguishes them
is carried in `data-path` and never shown.

## What is already decided, and is not this

**Membership is decided by Obsidian's own link resolution, and by nothing this plugin adds.**
`membershipTarget` (`src/domain/releases.ts`) hands the value to `getFirstLinkpathDest` and
takes its answer: a value naming no note at all is reported as unresolved, and a resolved
note that is not a release is reported the same way rather than reassigned. There is no
basename search of ours to be ambiguous — `[[1.0]]` under two `1.0` notes names whichever
one that link would OPEN from the same note, which is the vault's own rule and the one a
writer can settle by qualifying the link. What is unresolved here is only what the reader
SEES.

(This paragraph named a `resolveReleasePath` with a basename fallback of its own until
2026-08-23. That function is from the plan under `docs/superpowers/plans/`; it was never
built, and the note rested a ruling on behaviour no module has.)

## Why it was recorded rather than fixed

Qualifying a name is a display decision with no stated standard behind it, and it lands on
both screens plus anything later that names a release. It arrived on a branch that had already
grown to 108 files, on an increment whose remaining risk is a live-vault check nobody has run.
Landing a new naming rule there would add surface to the thing that most needed to stop moving.

(This section argued the shape as well, saying the iteration picker "qualifies ALWAYS" with
"the containing folder". Both halves were wrong on the day they were written: `iterationTargets`
in `src/view/interactions/labels.ts` has always qualified **only on collision**, and with the
whole **path minus the extension** rather than a folder. So there was no precedent to weigh
against — there was one, and it already said what this note treated as unwritten.)

## What the picker settled, and what it did not

[[Setting an item's release]] forced an answer, because a picker that lists two entries reading
`2.4` is unusable rather than merely ambiguous. The rule applied is the iteration picker's,
shared rather than copied: `namedTargets` in `src/view/interactions/labels.ts` now names the
candidates for both `Set iteration` and `Set release` — the basename, and the path minus the
extension for the notes that share one.

Two grounds, and neither is about how a label is spelled:

- **One answer on one surface.** Both pickers ask the same question — which of these two is the
  reader picking — so two copies of the answer would be one edit away from two spellings of it.
  Sharing the helper makes them one answer by construction.
- **The path form is strictly more correct at the nested-folder edge.** A parenthesised folder
  suffix reads `X/Rel/2.4` and `Y/Rel/2.4` both as `2.4 (Rel)`, which is still ambiguous; the
  path form separates them.

**The index and the scope header did not follow, and that is a finding rather than a fix.**
A release drawn as an index row or as a scope header still reads its basename alone, so the
same pair of notes is distinguishable in the picker and indistinguishable one screen away.
The note now records a plugin that spells one collision two ways, which is a smaller problem
than the one it opened with and a different one.

## What would close it

The index row and the scope header naming a release the way the picker does, from the one place
`namedTargets` already is rather than from three. What that costs, and what nobody has asked
yet, is whether a qualified name is right on a screen with no list of siblings to be ambiguous
against: the picker has the collision in front of the reader, while an index row is qualified
against notes elsewhere on the same screen and a scope header against nothing at all.
