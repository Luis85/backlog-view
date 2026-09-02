---
type: Issue
order: 20
parent: "[[The write gate]]"
status: Open
priority: P3
area: design
created: 2026-08-23
source: automated review of PR
files:
  - src/view/writeGate.ts
  - src/domain/writePlan.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# A stale release or iteration target can still be committed

## The limitation

`applySafely`'s outside-filter refusal reads only the write's own file:

```ts
if (writes.some((w) => this.host.outsideFilter(w.file.path))) {
```

`w.file` is the note being edited. It is never the note a write's *target* names — and two
planners produce writes that carry one: `computeReleaseWrites` plans `{ file: item.file,
release: target.file }` and `computeIterationWrites` plans `{ file: item.file, iteration:
target.file, ... }` (both `src/domain/writePlan.ts`). Neither `target.file` is inspected
anywhere the gate runs.

`Set release`'s and `Set iteration`'s menus build their entries from `host.model.releases` /
`host.model.iterations` at the moment the submenu opens (`namedTargets`, `addReleaseItems`,
`addIterationItems` — `src/view/interactions/labels.ts`), each entry closing over the
target `BacklogItem` it was built from. If that target note leaves the Base's results —
a filter edit, a property change on the target itself — **while the submenu is still open**,
the model rebuilds and the row would no longer offer that entry on a fresh open, but the
already-open submenu still holds it. Picking it plans a write naming the now-excluded
target's file, and `applySafely` has nothing that would refuse it: the write's own `file` is
still the item being edited, which was never excluded.

## Why it is deliberate

Not fixed here. This was found during work on [[Setting an item's release]], which added
`Set release`, but `computeIterationWrites` has produced the identical write shape since
`Set iteration` shipped — the gap predates this branch and is not introduced by it.

A fix has to inspect every target file a write names, not only the file it edits, which
changes the contract `WriteGate<W extends { file: TFile }>` enforces for **every** view's
writes, backlog and estimation alike — `ItemWrite` also carries a `parent` `TFile` for a
reparent, so the same question likely reaches beyond these two properties once someone
looks. That is a change to the gate itself, not a refusal bolted onto
`performReleaseMove` or `performIterationMove` beside their own plan, and a PR scoped to
adding one menu action is the wrong place to widen a shared boundary two other call sites
already rely on.

## What would lift it

Generalize the refusal: walk each write for every `TFile` field it may carry — `file`,
`parent`, `release`, `iteration` — and refuse the batch if any resolves to an
`outsideFilter` note, in one place all writers share. That is a `WriteGate` change, done
once, not a per-property patch repeated at each planner.

## Impact

The window is real but narrow: it needs a submenu already open over a target that then
falls out of the Base's results before the pick lands, which needs either a live filter
edit or a property change on the target itself, timed against an open menu. Nothing
silently corrupts the note — the written link is valid and resolves to a real file, it
just names a release or iteration the current Base filter excludes, which is a state a
hand-edit could always produce anyway and which the shelf/context-row rendering already
knows how to show. The cost is a plan-time promise ("what's offered is what's in the
filter") not holding for the width of one open menu, not data loss.

## A second consequence, since 2026-09-02: the target supplies a VALUE now

The paragraph above says nothing silently corrupts the note. That was true while the
captured target contributed only a LINK — a valid one, resolving to a real file. It stopped
being true with [[Joining a release dates the work]], and the claim is corrected here rather
than left standing (Codex, PR #242).

`computeReleaseWrites` now reads `release.releaseDate` off the same captured `BacklogItem`
and carries it as the item's due. So a target whose date is edited while the submenu sits
open contributes a deadline **no note states any more**, written onto the item and offered
as its schedule. That is a value nobody chose, not merely a link the current filter would
not have offered.

It is the same mechanism and the same window — an entry closing over a `BacklogItem` the
model built — reached through a different field, which is why it is recorded here rather
than as a note of its own.

**The obvious cheap fix does not fully close it.** `releaseDate` is read from
`app.metadataCache.getFileCache(file)?.frontmatter` (`readItems.ts`), so re-reading the cache
at the writer consults the SAME source the model already read: it narrows the window from
"since the model was built" to "since the cache caught up", and closes nothing against an
edit the cache has not indexed yet. A truly live read means opening the release note's own
frontmatter while writing the item's, which is a second note in one write and a pattern this
directory does not have.

**Not fixed in the PR that created it, deliberately.** [ADR 0033](../adrs/0033-a-stale-rule-is-decided-at-the-writer.md)
assigns "a date off another note" to the planner as a value it contributes, and its
`## Revisit when` defers this whole class to the day Bases can correlate a pass with a
write. Deciding otherwise is a change to that ADR and to
[[Joining a release dates the work]] 6c, whose window is scoped to the ITEM's note — a
specification change, not an implementation detail to settle inside the PR that exposed it.

## Acceptance criteria

None; recorded so the trade-off is re-decided knowingly rather than rediscovered. If it is
taken up, fix it once in `WriteGate`/`applySafely` for both `release` and `iteration`
target fields together, not as two separate patches. The value half above is a separate
question from the filter half and may want a separate answer: one asks whether the target is
still offerable, the other whether what it SAYS is still current.
