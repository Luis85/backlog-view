# Release Management — the first increment

*Design, 2026-08-22. The register already specifies this epic in full
([[Release Management]], ten features and nine PBIs written). This document decides which of
it ships first and what shape that takes; it invents no requirement.*

## Goal

One new registered Bases view, `product-release`, that **writes nothing** — the release
plan becomes readable before anything can change it.

Read-only is the load-bearing decision, not a phase of caution. With no write path, none of
the register's write rules apply to this view: no `WriteGate`, no `configProblems` gate, no
undo slot, no context-row write safety, no capture-before-await rule. The increment cannot
corrupt a note, and the surface a later increment has to make safe is exactly the writers it
adds.

## What it delivers

**`Release` as a fixed type.** A constant in the shipped vocabulary beside `Milestone` and
`Iteration`, matched case-insensitively, a root by nature with no legal children, never a rung
at any focus level. The model gains `releases: BacklogItem[]`, filtered exactly as `iterations`
already is — same shape, same `outsideFilter` exclusion. Nothing lets a vault rename the type
(ADR 0013); the only configurable thing about it is which property holds a note's type.

**The index**, which is the view's own entry point. One row per release: name, version, target
date, status, member count. Ordered by target date, then by the vault's **mapped** order
property, undated releases last, and **file path** as the final tie-break so rows do not move
between renders when a target date and a rank are both shared — or when the order property is
unmapped and no release has a rank at all.
Picking a row opens that release.

**One release's scope.** A header repeating that release's figures, then the members — the
notes whose **own** membership property names this release — drawn as the tree they already
are, with non-member ancestors drawn above them, marked as context and carrying no numbers. A
back control returns to the index.

**The picked release is view state**: per device and per saved view, through
`viewStateStore`, never a `.base` setting ([[Settings scoped to their view]]). A remembered
release that no longer exists returns the index without an error.

## What it does not deliver

Named here so the plan cannot drift into them: progress, capacity and slip columns (they need
[[The release summary]] and [[Capacity against commitment]]); [[Release readiness]];
[[Trying a scope change]]; [[Shipping a release]]; [[Release notes from its own scope]];
[[Putting work in a release]]; and [[A release on the dated axis]], which is a change to the
**backlog** view's roadmap and belongs in its own increment.

The deferred columns are **absent and named once**, never blank per row — the same answer the
register requires of any unconfigured figure.

This closes [[Releases as their own type]] and [[The scope of a release as a tree]] outright,
and advances [[Every release in one list]] — its ordering, picking, view state and empty
states — leaving that PBI's derived columns to the increment that defines them. Two PBIs
closed and one advanced is the honest count; claiming three would be claiming the columns.

## Decisions, and what they cost

**Its own read-only row renderer, not `src/view/render/rows.ts`.** That module takes a
`BacklogViewHost` and wires menus, create prompts, tag removal and drag into every row — none
of which a read-only screen has. Reusing it would make the release view satisfy a host
interface in order to offer actions this increment excludes; extracting a host-free core from
it would refactor a 517-line module the backlog view depends on, inside an increment whose
point is a new view. The release view draws its own rows and reuses the **stylesheet** and
`guidanceShell` from `emptyStates.ts` — the reuse the estimation view already settled on.
Cost: one new render module, and a correction to that PBI's `Where it lives`.

**Its own `releaseOptions.ts`, not the shared `viewOptions.ts`** — **seven** keys. Four are its
own subject: the membership property on an item, and the version, target date and status on a
release note. The other three are the core model mappings `readItems` needs — **type**, without
which no note can be recognised as a release at all, **parent**, without which the scope has no
tree and no context ancestors, and **order**, which is the mapped rank this document promises as
the index's second sort key.

Declaring those three is not reading the backlog view's configuration; it is this view naming
its own, defaulting to the same suggestions — [[Settings scoped to their view]]'s rule exactly,
that sharing a suggestion is not sharing a setting. Without them the "type property unmapped"
empty state would name an option this view does not offer, which is an empty state that cannot
be acted on.

**The estimation view is a precedent for one options file per view, and for nothing beyond
that.** It declares no core mapping because it needs none: `buildEstimationModel` reads Base
results flat — no hierarchy, no types, no ranking, not even an `outsideFilter` to carry. A view
that draws a tree is a different case, and copying the shorter option set because the file
layout matched would have shipped a view that cannot find a release.

Both release PBIs put these keys in `src/domain/viewOptions.ts`, which is the *backlog* view's
option set — written before the estimation view established one options file per registered
view. Putting them there would show release keys in the backlog view's settings where nothing
reads them. Cost: a second correction to both PBIs' `Where it lives`.

**Both corrections land in the same branch as the code.** A register that describes code
nobody wrote is the failure mode `docs-check.mjs` cannot catch.

**One screen at a time, with a back control**, rather than a list-and-detail split. The epic's
own wording is "picking a row opens that release", and a Bases view pane rarely has width to
spare for a tree that already indents.

## Architecture

```
domain/     releaseOptions.ts   type, parent, order, membership, version, target date, status
            releases.ts         releaseIndex(model, opts) / releaseScope(model, opts, path)
            typeVocabulary.ts   RELEASE_TYPE; itemTypes.ts: isReleaseType
            model.ts            releases: BacklogItem[], beside iterations
view/release/
            register.ts         registerReleaseView(plugin) — no WriteLock, nothing writes
            releaseView.ts      the BasesView; picks index or scope, holds no write gate
            renderIndex.ts      rows, the unresolved line, the absent-column line
            renderScope.ts      header + read-only tree rows
storage/    viewStateStore.ts   the picked release, one more entry
styles/     release.css         one partial, imported by index.css
```

`releases.ts` is pure and node-tested, shaped like `board.ts` and `roadmap.ts`: it derives from
the model and touches no DOM. **Both screens' figures come out of that one module**, so an
index row and a release header cannot disagree — the defect [[Every release at once]] warns
about, stated there as one denominator, one predicate, one answer.

`register.ts` takes no `WriteLock`. The lock exists to serialize writers (ADR 0030); a view
with no writer has nothing to serialize, and taking one would suggest otherwise.

Everything renders through `t()` from the first line. `view/release/` joins the swept set
immediately rather than going in as English literals to be swept later.

## Data flow

Bases results → the model (`readItems`) → `releases` falls out by type. Then one of two paths,
decided by view state:

**No release picked** → `releaseIndex(model, opts)`: for each release, read version, target
date and status from the keys this view names; count the members; sort by target date, then
mapped rank, undated last.

**A release picked** → `releaseScope(model, opts, path)`: members are the **plan-work** items
whose own membership value resolves to that release's path; their non-member ancestors come along marked
as context; a member whose ancestor is missing from the results draws at top level, the answer
the backlog already gives an orphan.

**Membership never cascades, in either direction.** An ancestor is scaffolding for a member's
place: not a member, not counted, and — in this increment — not writable by anything, since
nothing here writes. The member count is the notes whose own property names the release, and
nothing else.

**Membership is one value, on plan work.** A link or name resolving to a release note is
membership **only when the note carrying it is plan work**. A target that is not a release, or
two values in the property, is **unresolved**: reported, never silently dropped, and a member of
nothing. Those items appear on no release's screen, so the report belongs on the **index**,
which is the only screen that can see all of them.

The plan-work test is not an extra safeguard invented here — [[Setting an item's release]]
extension 1f requires it of the **reader**, not only of the writer this increment does not
build: a `Milestone`, an `Iteration`, another `Release` or a test-catalog note with the
membership property hand-written onto it is not in the scope and not in the count, "because a
release holds work and those notes are not work". Refusing at only one end would let a hand-edit
do what the menu will not — and in this increment there is no menu at all, so the reader is the
only end there is. It applies the same eligibility `Set iteration` already applies.

Such a row is reported with the unresolved ones rather than dropped in silence. That much is a
reading of the register rather than a line in it: 1f says refuse, and says nothing about saying
so. Refusing visibly is the answer every neighbouring extension gives, and a hand-edit that
vanishes without a word is the failure mode this epic keeps naming.

## The states, kept apart

| Situation | What the screen says |
| --- | --- |
| Type property unmapped | No list at all; names the option to bind |
| Mapped, nothing typed `Release` | The screen exists and is empty; says what a release note is; **no create button** |
| A figure's key unconfigured | That column absent for every row, named **once** — never blank per row |
| Key bound, value unreadable | Reported as unreadable, per row — somebody wrote something there |
| Membership key unconfigured | The index still draws; no tree; the empty state names the option |
| Membership hand-written on a non-plan row | Not a member, not counted, and reported with the unresolved — a marker is not work |
| Release has no members | An empty tree naming the release — a legitimate state, not a misconfiguration |
| Remembered release gone | The index, silently. A working position that no longer exists is not a failure |

No create button anywhere: no use case in this epic specifies creating a release, and an empty
state must not promise a write nothing defines.

## Testing

- **Node tests on `releases.ts`**: no cascade up or down; the member count equals the notes
  whose own property names the release; an excluded release absent everywhere, context row
  included; ordering, including the undated tail and the stable tie-break; remapping the
  vault's order property changing the tie-break with it (nothing reads a literal `order`);
  each unresolved shape reported rather than dropped; and a `Milestone`, an `Iteration`, a
  second `Release` and a test-catalog note, each with the membership property hand-written onto
  it, in no scope and in no count — the reader's half of [[Setting an item's release]] 1f, which
  in this increment is the only half that exists.
- **jsdom view tests**: index → pick → scope → back; every row of the state table; the pick
  surviving a reload; a missing pick returning the index.
- **One invariant test at the forbidden thing**: a spy on `storage/frontmatter.ts`'s write
  entry points, with every interaction on the release view driven against it, asserting zero
  calls. "This view writes nothing" is a category claim, so it is checked at the call rather
  than by listing the paths someone thought of — the register's own rule for category
  invariants.
- **i18n**: `test/i18n/projections.test.ts` drives the release view too, so what renders
  unmarked has to be data.
- `npm run check` — build, lint, coverage, fallow, docs register — with every new module named
  in a note's `Where it lives`, and the two `Where it lives` corrections in the same branch.

## Looked at, and what that did not answer

The two screens and both empty states were mocked in `npm run harness` before this document was
written — hand-drawn markup against the real assembled stylesheet, on Obsidian's own default
colours. The mock is uncommitted, correctly: nothing imports it, so `npm run analyze` calls it
dead.

What it settled: the index is a five-column grid whose figures sit right and whose name column
takes the slack; the scope tree reads as a tree with context ancestors dimmed and marked; the
two empty states do not read alike. It also confirmed that a state chip in a row is **grey** —
`--pbl-state-color` is consumed by the legend and the card projections, not by a row chip — so
the release screen inherits the tree's own appearance rather than the board's.

What it cannot answer, and what is still owed: a themed vault's colours and accent, anything
Bases hands the view, and the appearance of any of it in Obsidian itself. A live-vault check
via `npm run test-build` is still owed before this increment is called done.

## Open question, recorded rather than answered

Nothing in this epic specifies **creating** a release note. The empty state says what a release
note is and offers no button, which is the register's own answer for now. If that gap is worth
closing, it is a use case someone writes, not a control added to an empty state.
