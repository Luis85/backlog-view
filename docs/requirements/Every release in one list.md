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

The list has shipped. It is the view's entry point, so it is also where a release gets picked
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
2. It draws one **band** each, two lines: the name, the version, a date and the status chip
   on the first; a progress bar, the counted phrase `8 of 14 done` and a note — the overdue
   warning while in flight, the slip once shipped — on the second. **Progress and slip have
   SHIPPED; commitment against capacity has not.** That third figure is
   [[Capacity against commitment]]'s to derive and this screen's only to draw, so a band
   carries every figure named here except that one, and will carry it without a change to
   this flow when that feature lands.
3. It puts the bands in two groups, each headed by its own name and count: **In flight** (no
   released date) and **Shipped** (one). Within a group it orders by date — target ascending
   in flight, released **descending** once shipped, so the release that shipped most recently
   heads its own tail — and then by each release note's own **rank**, the value under the
   vault's mapped order property, which the model already reads. No literal `order` is looked
   for here: a vault that moved that mapping would otherwise get an index ordered against
   every other screen.
4. The user picks a band, and that release's screen opens.
5. The picked release is remembered as view state, per device and per saved view.

**Extensions**

- **1a — the type property is not mapped.** No list is drawn, and the empty state says which
  option to bind.
- **1b — there are no releases.** The list says so, and names what a release note is — a note
  typed `Release` carrying a version and a target date — rather than drawing an empty list. It
  offers **`New release`** beneath that guidance, the same control the head of the index
  carries. This note said it offered no create button, on the stated grounds that no use case
  specified creating a release and an empty state must not promise a write nothing defines;
  [[Creating a release from the release view]] is the use case that answered it, and the
  control arrived with it on 2026-08-25. **It still reports the
  unresolvable memberships**, and that is not a detail of this extension but its sharpest
  case: with no release for any value to resolve to, every membership in the base is
  unresolved at once, so the state with the most to say had been saying only "no releases".
  [[The scope of a release as a tree]] 1b is what rules on it: such an item "is reported
  among the items whose membership could not be resolved, rather than silently dropped", and
  this is the only screen it can be reported on.
- **2a — a figure's key is unconfigured.** That figure is absent from every band and named
  once beneath the list, rather than blank in each — the same answer the single-release
  screen gives.
- **2b — a release has no released date.** Its slip is absent. Today is never measured against
  a plan to invent one.
- **2c — a release has a released date earlier than its target.** The slip is negative and
  says so: early is a real answer.
- **2d — a release's released date is unreadable.** The band says so where its dates are, and
  withholds the two answers that depend on reading it: no slip, and no overdue treatment. A
  bound property holding something that is not a date is a different answer from both
  "nothing was written" and "no property was bound" — the same three answers the target date
  already gives, now owed by both dates. A band that stayed silent here would present a
  release that may well have shipped as one that is definitely late. What it does NOT withhold
  is the target: see 2g.
- **2e — a release's target has passed and it has no released date.** The band is drawn
  overdue: a rule down its leading edge, a red date, a red bar, and a note counting the days.
  This is a fact and not a heuristic. The early warning considered instead — a target that is
  near with progress that is low — needs a window to measure elapsed time against, and a
  release note carries no start date anywhere in the model. The days REMAINING figure drops in
  the same breath, because a negative count of days left reads as an error rather than as
  lateness.
- **2f — the released-date property is unconfigured.** No release is drawn overdue at all,
  whatever its target, and the missing binding is named beneath the list with the other absent
  figures. Without that property this screen cannot tell a release that is late from one that
  has already shipped, and painting the second as the first states a wrong fact with the
  confidence of a right one. **This is the state every saved release view is in** until
  somebody binds the property, so the note beneath the list is the whole of the explanation a
  reader gets.
- **2g — a release has shipped, and it also has a target date.** Line 1 shows **one** date,
  the released one, and the target's DATE is superseded: the date itself, the "no target
  date" that stands in for one, and the days-remaining count that is arithmetic on it. Two
  dates in one position would be a position that says two things, and nothing is lost — the
  slip and the released date reconstruct the target exactly.
  **The target's ERROR is not superseded.** A target nobody can read is reported whether the
  release shipped or not, because whether a property can be READ does not depend on when the
  release went out, and the single-release screen reports that same figure as unreadable
  either way — suppressing it here made two screens disagree about one release. So the two
  dates answer for themselves and this one coupling is the whole of what joins them. It is
  written as a rule rather than as a list of cases because the same defect arrived three
  times on this one position, once per direction: the unreadable released value hid a
  readable target, and then the readable released value hid the target's error. Anything
  added here that reads one date and stops is the fourth.

- **3a — a release has no target date.** Its band is drawn after every dated one **within its
  own group** rather than read as the epoch, and the order among them is their rank. Only the
  in-flight group can hold one: the shipped group sorts by the released date, which every
  member of it has by definition.
- **3b — two releases share a target date and a rank, or the order property is unmapped so
  none of them has one.** The tie is broken by a stable
  second key, so the bands do not reorder between renders.
- **3c — a release has a released date.** It leaves the in-flight group for the shipped one,
  whatever its status says. Shipped-ness is one binding read one way: a status string is
  vocabulary each vault picks for itself, and full progress is neither necessary nor
  sufficient — both were considered and both are wrong in both directions.
- **3d — a group holds no release.** Its heading is not drawn. A heading is emitted at the
  band where the group changes rather than over a partition of the list, so a group with no
  band has nowhere to put one, and a list that opens shipped is not headed "In flight".
- **4a — a release is outside the Base's filter.** It has no band. Every figure here is read
  from the release note itself, and an excluded release is not in the model and never arrives
  as a context row ([[Releases as their own type]]) — so there is nothing to draw a row from
  and no way to open it. The list's population is the results, stated once at the top of the
  list rather than implied.
- **5a — the remembered release is gone at the next open** — deleted, or filtered out.
  The list is shown instead, and no error is raised. A working position that no longer exists
  is not a failure. A RENAME is deliberately not in that list: the stored pick follows the
  note, so a rename is not a release that has gone. Without that it would be
  indistinguishable from one, since either way the path names no release and the list is
  what is drawn. **A base EMBEDDED in a note is the exception**, and it is stated rather than
  fixed: there is no stored pick there to carry, so a rename does drop the reader to the
  list. That value is session-only by design — `src/storage/viewIdentity.ts` refuses an
  embedded base a key of its own so several bases in one note cannot overwrite each other's
  — and it is gone on reload whatever happens to the note.

## Acceptance criteria

- Every release in the results has exactly one band, including a release nothing points at,
  and a release the Base excludes has none.
- A band computes no figure of its own: progress, slip and overdue arrive on the same
  `ReleaseRow` the single-release screen is handed, so the two screens cannot disagree about
  one release. **What that screen DRAWS is narrower than what it is handed**, and deliberately
  — see `## Where it lives`.
- Bands group by shipped-ness, order by target date ascending in flight and by released date
  descending once shipped, then by rank, put an undated release last within its own group, and
  do not reorder across repeated renders.
- Remapping the vault's order property changes the index's tie-break with it; nothing here
  reads a property literally named `order`.
- Slip is absent without a released date, and negative when a release shipped early.
- A band is drawn overdue only when its target has passed, nothing has shipped, and the
  released-date property is both bound and readable.
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

The module that holds them is `src/view/release/renderIndex.ts`. It draws one two-line band
per release in the order `src/domain/releases.ts` decided, a heading wherever that order's
first key changes, and the two notes beneath the list — the unconfigured figures named once,
and the count of items whose membership resolved to nothing — and it wires the pick. **It
re-sorts nothing and it derives nothing**, and the group headings are that rule rather than an
exception to it: shipped-ness is the first key of the domain's own sort, so this module emits a
heading where the flag changes and partitions, re-orders and re-reads nothing. Every figure on
a band arrives from `releaseIndex`, which is what keeps a band and a release header from
disagreeing. One of those two notes is exported rather than private, because 1b needs it on a
screen this module never draws: `releaseView.ts` derives the index BEFORE it decides whether
there is a list to render, and calls the same function beneath the empty state.

**The five-column grid is gone, and with it `ColumnSpec` and `columnWidthVar`.** A band lays
itself out — two flex lines, each with a spacer pushing the trailing figures to the end — so
nothing publishes a column width and nothing holds a heading row in step with the rows beneath
it. The trade that replaced is stated where it was made: fixed column widths were what made a
long version or a long status ellipsise, and a band gives that width back to whichever figure
needs it, with the release's own NAME the last thing to yield rather than the first. Every
element inside a band is a `<span>` and that is a constraint rather than a preference: a
`<button>`'s content model is phrasing content, so a `<div>` in one is illegal markup in the
element the whole band is.

A band is a real `<button>`, activated by a click, by Enter and by Space. Picking a release is
this view's whole navigation, so a pointer-only row would put the scope screen out of reach of
a keyboard. It shipped as a `role="button"` div over a `display: contents` row — one grid
holding every row's cells, so the figures lined up — and that closed the screen to the keyboard
outright: measured in headless Chromium on 2026-08-23, a `display: contents` element has no box
at all, so Tab skips it, `.focus()` on it does nothing and `:focus-visible` can never match, and
a real `<button>` under the same rule measured identically. Being a real `<button>` is also what
made it draw as one — `styles/release.css` reset the chrome at a bare class, which loses to
Obsidian's own `button:not(.clickable-icon)` on specificity, so the reset is
element-qualified now: see [[The release index rows paint as Obsidian buttons]]. Whether
Obsidian's Electron agrees with any of this is a live-vault check — Obsidian cannot run in this
environment.

**What has SHIPPED is the band and all but one figure on it.** Name, version, the dates,
status, the member count folded into the progress phrase, progress and slip are all drawn;
**commitment against capacity is not derived anywhere yet**, and it belongs to
[[Capacity against commitment]] rather than to this screen. Extensions 2b, 2c, 2d, 2e and 2f
and the criteria naming slip and overdue describe behaviour to check; only the commitment half
of main-flow step 2 is still work to do.

**The single-release screen is handed the same row and deliberately draws less of it.**
`drawHeader` (`src/view/release/renderScope.ts`) shows the version, the status, the target date
and the member count — not progress, not the released date, not slip, not overdue. That is not
a disagreement and cannot become one: there is exactly one derivation, in
`src/domain/releases.ts`, and the header reads the very `ReleaseRow` `releaseIndex` computed.
What it declines to draw it declines for a stated reason, and the same file already carries the
worked precedent — it omits the absent-target-date label the index draws, because nothing on
that screen is sorted by a target. **The released date and overdue exist on the index to
explain a position in a sorted list**, and a screen showing one release has no list to explain.
Progress is the one figure with an independent case for appearing there, and whether it should
is a product decision nobody has specified — it is not owed by this note.

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
back wholesale and would otherwise put a stale path straight back. Both walk what is
STORED, so neither reaches an embedded base, which has no entry: see 5a, and the
`restorePick` docstring, which is where that limit is stated. Nothing checks it.
