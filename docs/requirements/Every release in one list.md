---
type: PBI
parent: "[[Every release at once]]"
order: 10
status: Open
created: 2026-08-21
source: user request — release management concept refinement, 2026-08-21
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# Every release in one list

**As** someone planning several releases, **I want** every release as a row with its own
numbers, **so that** I can see the whole plan on one screen and open any of it from there.

Nothing yet. It is the view's entry point, so it is also where a release gets picked at all.

## Use case

| | |
| --- | --- |
| **Actor** | Anyone planning releases |
| **Trigger** | Opening the release view with no release picked |
| **Preconditions** | The release type is configured |
| **Guarantee** | One row per release in the results, each figure computed exactly as the single-release screen computes it. Picking a row opens that release and writes nothing to any note. |

**Main flow**

1. The view collects the releases in the results.
2. It draws one row each: name, version, target date, status, progress, commitment against
   capacity, and slip.
3. It orders the rows by target date, and then by the release note's own `order`.
4. The user picks a row, and that release's screen opens.
5. The picked release is remembered as view state, per device and per saved view.

**Extensions**

- **1a — the release type is not configured.** No list is drawn, and the empty state says which
  option to bind.
- **1b — there are no releases.** The list says so and offers to create one, rather than
  drawing an empty grid.
- **2a — a figure's key is unconfigured.** That column is absent for every row, named once,
  rather than blank in each — the same answer the single-release screen gives.
- **2b — a release has no actual date.** Its slip is absent. Today is never measured against a
  plan to invent one.
- **2c — a release has an actual date earlier than its target.** The slip is negative and says
  so: early is a real answer.
- **3a — a release has no target date.** Its row is drawn after every dated one rather than
  read as the epoch, and the order among them is its `order`.
- **3b — two releases share a target date and an `order`.** The tie is broken by a stable
  second key, so the rows do not reorder between renders.
- **4a — the picked release is outside the Base's filter.** Its row draws as context and cannot
  be opened; it is never a write target.
- **5a — the remembered release is gone at the next open** — renamed, deleted, or filtered out.
  The list is shown instead, and no error is raised. A working position that no longer exists
  is not a failure.

## Acceptance criteria

- Every release in the results has exactly one row, including a release nothing points at.
- A row's progress and commitment equal the figures the single-release screen shows for that
  release, from the same fixture.
- Rows order by target date, then `order`, put an undated release last, and do not reorder
  across repeated renders.
- Slip is absent without an actual date, and negative when a release shipped early.
- The picked release survives a reload of the same saved view on the same device, and is not
  written into the `.base` file.
- A remembered release that no longer exists returns the list without an error.
- Nothing on this screen plans a write.

## Where it lives

The rows derive from the same new `src/domain/` module as the single-release figures, from the
model in `src/domain/model.ts`, so no figure is computed twice. The list is a render module in
`src/view/render/` beside `src/view/render/board.ts`, its empty states in
`src/view/render/emptyStates.ts`, and the picked release is held in `src/view/viewState.ts`
through `src/view/viewStateController.ts` and persisted by `src/storage/viewStateStore.ts`.
