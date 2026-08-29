---
type: Feature
parent: "[[Storymaps]]"
order: 20
status: Open
created: 2026-08-19
source: backlog breakdown of [[Storymaps]], 2026-08-19
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
priority: ""
iteration: ""
---

# Steps between a use case and its tasks

**Outcome** — A use case's steps are notes ranked among each other, and each task hangs from
the step it serves.

This is the one piece of structure the map needs that the vault does not have. Everything
else on a storymap is a note the register already defines; a step is not, because a use
case's flow is prose and prose is a layer this plugin neither reads nor writes.

## Landmines, before implementation

**`Step` joins `EXTRA_TYPES`, not `LEVELS`, and getting that backwards is the expensive
mistake.** The mental model says fifth rung, and [[Storymaps]] records why it is not built as
one: inserting a rung changes what a typeless child of a PBI means in every existing vault
and shifts the rank every extra type is pinned to. The extra-type contract — *hangs from a
PBI, holds Tasks, never re-typed by position* — is a step's contract already.

**Depth and rung are separate questions, and only one of them is pinned.** An extra type
ranks at `EXTRA_TYPE_RANK` regardless of parent while still indenting one level under it, so
a `Step` draws under its PBI and over its Tasks without being a level. Code that reads the
rung to decide the indent will get this wrong and look right on a one-step fixture.

**Existing tasks keep working, or the feature is a migration.** A `Task` may still hang
directly from a PBI. Nothing re-parents anyone, and a use case with no steps draws no step
row rather than an error.
