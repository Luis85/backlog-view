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
| **Preconditions** | The property that holds a note's type is mapped |
| **Guarantee** | One row per release in the results, each figure computed exactly as the single-release screen computes it. Picking a row opens that release and writes nothing to any note. |

**Main flow**

1. The view collects the releases in the results.
2. It draws one row each: name, version, target date, status, progress, commitment against
   capacity, and slip.
3. It orders the rows by target date, and then by each release note's own **rank** — the value
   under the vault's mapped order property, which the model already reads. No literal `order`
   is looked for here: a vault that moved that mapping would otherwise get an index ordered
   against every other screen.
4. The user picks a row, and that release's screen opens.
5. The picked release is remembered as view state, per device and per saved view.

**Extensions**

- **1a — the type property is not mapped.** No list is drawn, and the empty state says which
  option to bind.
- **1b — there are no releases.** The list says so, and names what a release note is — a note
  typed `Release` carrying a version and a target date — rather than drawing an empty grid. It
  offers **no create button**: no use case in this epic specifies creating a release, and an
  empty state must not promise a write nothing defines. Making one is still a gap, recorded
  here rather than half-answered by a control with no flow behind it.
- **2a — a figure's key is unconfigured.** That column is absent for every row, named once,
  rather than blank in each — the same answer the single-release screen gives.
- **2b — a release has no actual date.** Its slip is absent. Today is never measured against a
  plan to invent one.
- **2c — a release has an actual date earlier than its target.** The slip is negative and says
  so: early is a real answer.
- **3a — a release has no target date.** Its row is drawn after every dated one rather than
  read as the epoch, and the order among them is their rank.
- **3b — two releases share a target date and a rank, or the order property is unmapped so
  none of them has one.** The tie is broken by a stable
  second key, so the rows do not reorder between renders.
- **4a — a release is outside the Base's filter.** It has no row. Every column here is read
  from the release note itself, and an excluded release is not in the model and never arrives
  as a context row ([[Releases as their own type]]) — so there is nothing to draw a row from
  and no way to open it. The list's population is the results, stated once at the top of the
  list rather than implied.
- **5a — the remembered release is gone at the next open** — renamed, deleted, or filtered out.
  The list is shown instead, and no error is raised. A working position that no longer exists
  is not a failure.

## Acceptance criteria

- Every release in the results has exactly one row, including a release nothing points at, and
  a release the Base excludes has none.
- A row's progress and commitment equal the figures the single-release screen shows for that
  release, from the same fixture.
- Rows order by target date, then rank, put an undated release last, and do not reorder
  across repeated renders.
- Remapping the vault's order property changes the index's tie-break with it; nothing here
  reads a property literally named `order`.
- Slip is absent without an actual date, and negative when a release shipped early.
- The picked release survives a reload of the same saved view on the same device, and is not
  written into the `.base` file.
- A remembered release that no longer exists returns the list without an error.
- Nothing on this screen plans a write.

## Where it lives

The rows derive from the same `src/domain/releases.ts` as the single-release figures, from the
model in `src/domain/model.ts`, so no figure is computed twice. The list is a render module in
`src/view/render/` beside `src/view/render/board.ts`, its empty states in
`src/view/render/emptyStates.ts`, and the picked release is held in `src/view/viewState.ts`
through `src/view/viewStateController.ts` and persisted by `src/storage/viewStateStore.ts`.
