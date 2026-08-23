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

The rows have shipped. It is the view's entry point, so it is also where a release gets picked
at all.

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
- **5a — the remembered release is gone at the next open** — deleted, or filtered out.
  The list is shown instead, and no error is raised. A working position that no longer exists
  is not a failure. A RENAME is deliberately not in that list: the stored pick follows the
  note, so a rename is not a release that has gone. Without that it would be
  indistinguishable from one, since either way the path names no release and the list is
  what is drawn.

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
model in `src/domain/model.ts`, so no figure is computed twice.

The screen itself is a Bases view of its own — `src/view/release/releaseView.ts`, registered by
`src/view/release/register.ts` — and not a projection of the backlog view. That is what decided
where the list lives: a render module under `src/view/release/`, drawing its own read-only
rows rather than reusing `src/view/render/rows.ts`, which takes a `BacklogViewHost` and wires
menus, create prompts and drag into every row. What it does reuse is the stylesheet
(`styles/release.css`) and `guidanceShell` from `src/view/render/emptyStates.ts`, which is the
reuse the estimation view already settled on.

The module that holds them is `src/view/release/renderIndex.ts`. It draws the five-column
grid, one row per release in the order `src/domain/releases.ts` decided, the two notes beneath
the grid — the unconfigured columns named once, and the count of items whose membership
resolved to nothing — and it wires the pick. It re-sorts nothing and it derives nothing: every
figure on a row arrives from `releaseIndex`, which is what keeps a row and a release header from
disagreeing.

A row is a real tab stop carrying `role="button"`, activated by a click, by Enter and by Space.
Picking a release is this view's whole navigation, so a pointer-only row would put the scope
screen out of reach of a keyboard; it is not a native `<button>` because `.pbl-rel-row` is
`display: contents`, which one grid holding every row's cells depends on and which a form
control does not reliably survive.

**What has SHIPPED is the row, not every figure on it.** Name, version, target date, status and
the member count are drawn; progress, commitment against capacity and slip are not derived
anywhere yet, so extensions 2b and 2c and the criteria naming slip describe work still to do
rather than behaviour to check. The single-release screen beside it is still a stub
(`renderScope.ts`, its own task), so the criterion that a row's figures equal that screen's is
unreachable until it lands.

This note said the module sat in `src/view/render/` beside `src/view/render/board.ts` and that
the picked release was held in `src/view/viewState.ts` through `src/view/viewStateController.ts`.
Both were written before the release view was a registered view of its own, and both are wrong
for one reason: `viewStateController.ts` is the backlog view's controller, and this screen has
no host to reach it through. `releaseView.ts` holds the pick and reads and writes it through
`src/storage/viewStateStore.ts` directly, keyed by `src/storage/viewIdentity.ts` — per device and
per saved view, never the `.base`. The pick is a note PATH, so it is carried on a rename or a
renamed release note would read exactly like a deleted one (5a). `renamePathPrefs` in
`src/storage/viewStateStore.ts` is that carry, wired to `vault.on('rename')` at the plugin in
`src/main.ts` so it reaches every stored entry whatever view is loaded; `src/view/viewState.ts`
carries the same value over the loaded backlog view's in-memory copy, which its flush writes
back wholesale and would otherwise put a stale path straight back.
