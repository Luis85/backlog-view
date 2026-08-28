# The release detail page as a tree you can work in

**Date** 2026-08-28 · **Branch** `claude/release-management-ux-74jh80`
**Epic** [[Release Management]] · **PBIs** [[The scope of a release as a tree]],
[[Summing up a release]], [[Creating a release from the release view]]

## What this is

The release view ships an index of bands and, behind a pick, a detail screen: a header of
three facts and a tree that draws every member at once, with no disclosure, no keyboard, no
click and no numbers. It reads. This design makes that screen a place to work — while
keeping the one property that makes the whole view cheap: **it still never edits a note**.

The layout below was drawn in `test/harness/mock.ts` against the real assembled stylesheet
before any of it was built, which is the same order `styles/release.css`'s own header
records for the index's bands. What that answered is layout, spacing and hierarchy on
Obsidian's DEFAULT colours. A themed vault's colours and accent, and anything Bases hands
the view, are still owed a live-vault check.

## The decisions this rests on

| Decision | Why |
| --- | --- |
| The view stays read-only | `test/view/releaseNeverEdits.test.ts` asserts on the CALLS, not on driven screens. Every feature below is navigation, derivation or view state — none of it plans a batch, so this view still needs no `WriteGate` and no `WriteLock`. |
| A row click OPENS the note | The disclosure folds; the click reads. A read-only screen's missing gesture is reading the thing, and `src/view/openTarget.ts` already takes any `{ file }`. |
| Folds live in the view-state store | `folds` already exists there, keyed by path, pruned by path and rename-migrated. This view has its own view identity, so its folds cannot collide with the backlog tree's. No new storage, no new module. |
| The summary is progress and items only | Blocked, unestimated and critical-risk figures each need a property option AND a value vocabulary on this view. They are [[Summing up a release]] and [[Release readiness]]'s own next increment, not this one. |
| No search box on the scope | [[Quick filter]] is `status: Dropped`, closed 2026-08-17 at the user's request — "Bases carries its own search now, so this was a second search box over the same rows". Confirmed dropped again here rather than re-litigated. |
| The ✨ becomes a control | `runReleaseInit` exists and is reachable only from a `New release` press. A reader whose vault has none of the four keys bound cannot get to it without creating a note they may not want. |

## The screen

```
┌ header ─────────────────────────────────────────────────────────────────┐
│ ←  0.8  0.8.0  (In progress)                 15 September 2026  18 days left │
│ ▓▓▓▓▓▓░░░░░░░░  42%   5 of 12 items done                                │
├ toolbar (pinned) ───────────────────────────────────────────────────────┤
│ ⌄⌃  collapse / expand all                        [Hide done] [Context rows] │
├ tree (scrolls) ─────────────────────────────────────────────────────────┤
│ ⌄ [Epic]    Sign-up flow  ⌐                                              │
│   ⌄ [Feature] Passwordless sign-in         (In progress)  ▓▓▓░░  3/5     │
│       [PBI]   Send the magic link               (Done)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

Header line 1 is today's header, unchanged in content. Line 2 is new. The toolbar is new.
Every row gains a disclosure, a state chip in its own column, and the rollup lane.

## Slice A — the tree gets its features

**Disclosure.** Every row draws one; a leaf's is `visibility: hidden` so a level's titles
share one x. `aria-expanded` becomes legitimate on a row with children and is set — today's
`renderScope.ts` comment says the opposite and is corrected as part of this slice, since a
comment stating a rule the code has stopped keeping is the defect
`docs/issues/A comment that states a rule is not a check.md` names.

**Folds persist.** Read on render, written on toggle, through `loadViewState` /
`saveViewState` under this view's identity — the same pair `pick` already uses. An embedded
base has no identity, so folds there are session-only, exactly as the pick already is; that
asymmetry is stated once in `releaseView.ts` and not built around.

**A folded row hides its descendants and keeps its own numbers.** The rollup is over the
subtree, not over what is drawn, so folding never changes a figure.

**Collapse all / expand all** are two toolbar buttons over the same fold set.

**Click opens the note** through `openTarget.ts`, honouring the modifier keys it already
reads. The disclosure stops propagation so folding never opens.

**Keyboard.** The tree takes one tab stop and moves a roving `aria-activedescendant`:
Up/Down between visible rows, Right unfolds or steps in, Left folds or steps out,
Home/End, Enter or Space opens. The backlog's `src/view/selection.ts` is host-bound, so
this is its own small module rather than a host interface satisfied to withhold most of it
— the same call `renderScope.ts` already made about `render/rows.ts`, for the same reason.

**Not in this slice:** drag, multi-select, and any menu. All three are writes.

## Slice B — the summary strip

**No new derivation — the figures already exist and must not be computed twice.**
`ReleaseRow` carries `members` and `done` as figures, counted in one walk over the members
only, and `src/domain/releases.ts` states the rule in its own words: *"Progress is this over
`members` and is computed nowhere else — the single-release screen reads the same row, which
is what stops a band and a release header disagreeing about one release."* This spec
proposed a second derivation until the finding on PR #206; the strip draws the row the index
already drew.

**That also settles which workflow says "done", and it is not one.** `done` is read through
`ownWorkflowReading`, never `item.done`, because a member typed `Deliverable` or a
test-catalog member answers through its OWN state property and vocabulary. A derivation
described in terms of "the state key and its done values" — as this spec had it — would
either regress that count or misdescribe it.

**Every figure names what it read**, which is that note's main flow 5 and its extension 2c,
and the two halves are different sentences:

- **Progress with no state key or no done values bound** is absent **and named as
  unconfigured** — not silently missing, which is what this spec said until the finding on
  PR #206. A reader must be able to tell a progress figure nobody configured from one the
  screen forgot to draw. It names the option to bind, the way this view's other empty states
  already do; the item count still answers beside it.
- **Progress that DID compute** names its denominator in its own sentence — `5 of 12 items
  done`, where "items" is the denominator main flow 2 requires be named. The estimate
  denominator does not exist in this increment, so there is one to name rather than two.
- **Main flow 5's "names the property and the vocabulary it read" has no single answer
  here, and this is an open question rather than a decision.** A release mixing ordinary
  work with Deliverables has each member answering through its own workflow, so there is no
  one property to name; that requirement was written before `ownWorkflowReading` existed.
  Naming every workflow represented is possible and costs a line of header. This spec does
  NOT decide it: the strip ships naming its denominator and its unconfigured case, and the
  question goes back to [[Summing up a release]] to answer for every figure at once rather
  than being settled here for one.
- **No members**: the strip is withheld entirely — the empty state already says the release
  is empty, and `0 of 0 items done` beside it says it twice and worse. That is extension 1a's
  "nothing to count, and none of them reads as zero".
- The count agrees with the header's member count by construction: one walk, one population.

`docs/requirements/Summing up a release.md`'s `## Where it lives` predates this view and
names `src/domain/viewOptions.ts` and a module in `src/view/render/`. Both are corrected in
that note as part of this slice: this view's options are `src/domain/releaseOptions.ts` and
its render modules are `src/view/release/`.

## Slice C — the scope toolbar

Between the header and the scroller, so it never scrolls away. Three controls:

- **Collapse all / expand all** (Slice A).
- **Hide done** — hides every subtree that is **entirely** finished, which is
  `docs/requirements/Rollups and hiding finished work.md` main flow 4 read exactly as it is
  written. **Not "every member whose own state is done"**: a done parent over unfinished
  member work would take that work off screen with it, or re-root it and lose its place.
  Completion is the subtree's — but **over the scope's own member rows, never
  `item.subtreeDone`**. That model field is `item.done && done === count` over every
  non-marker descendant the BASE returned, consulting no membership at all, so a done member
  with an unfinished child in another release (or in none) would stay on screen though its
  release-local subtree is finished. The predicate is computed in the scope walk, which
  already visits exactly the right population — a context row is walked through and counted
  no more here than anywhere else on this screen. Each member's own doneness comes from
  `ownWorkflowReading`, for Slice B's reason.
  That note's three follow-on rules come with it, and each is a check below:
  **4a** a parent whose children all hid renders as a LEAF — no disclosure, no
  `aria-expanded` — rather than an expander over nothing; **4b** a context row whose
  children have all hidden hides too, since it exists only to place a visible member;
  **4c** everything hidden draws the **all-done state**, naming how many items it is talking
  about, never a blank scroller — `src/view/render/emptyStates.ts` already owns that state
  for the backlog tree, and the toggle that turns hiding back off stays on the toolbar
  beside it.
  It does NOT change a rollup: `3/5` stays `3/5` with the three hidden, which is that same
  note's own guarantee — hiding is a render decision.
  With no state key bound there are no done values, so the toggle is not drawn at all —
  the same answer the summary gives, and for the same reason.
- ~~**Context rows**~~ — **cut, by the register rather than by taste.**
  [[The scope of a release as a tree]] main flow 3 and its acceptance criterion require a
  non-member ancestor to be DRAWN and marked as context, and its extension 3b settles the
  hiding question outright: a context ancestor "is drawn regardless: it is scaffolding for a
  member, and hiding it would break the member's place." A toggle that removes them
  contradicts a shipped acceptance criterion, so it would need that requirement amended
  rather than merely implemented — the same shape as the search box, and the same answer.
  Dropping it costs the toolbar one control and the store one field.
  **Overrulable**: if the toggle is wanted, the requirement is amended in the same slice,
  with its acceptance criterion rewritten and its coverage extended — not left to disagree
  with the code.

Both toggles are view state in the same `prefs` bag as the pick, per saved view and per
device — never a `.base` setting, which is ADR 0011's rule.

## Slice D — the ✨ on the release view

An icon button (`sparkles`) in `.pbl-rel-actions`, beside `New release`, calling
`runReleaseInit` — the action that already exists and today has no control. It binds the
suggested key for whichever of membership / version / target date / status this vault has
never touched, seeded against every property key this view declares so it can never hand out
a key another option already names.

- **The press REPORTS what it bound, and this is not free.** `runReleaseInit` only calls
  `config.set`; the notice lives in `newRelease.ts`, which reads `boundKeys` off a FRESH
  resolve of the live config before the call and compares it after. A ✨ wired straight to
  `runReleaseInit` would change the saved `.base` in silence, against
  [[Creating a release from the release view]]'s "the press says when it changed the
  configuration, and stays quiet when it did not", checked in both directions. So the
  bind-and-report pair is extracted from `newRelease.ts` and both entry points call it —
  the root guide's "one move, three inputs" shape: the reporting lives where the binding
  does, never beside each caller.
- Nothing left to bind → the button is not drawn. A control that can only no-op is worse
  than absent; `src/view/estimation/toolbar.ts` states the same rule for its own ✨.
- It also appears on the `noMembership` scope empty state, which is the screen a reader
  reaches with nothing to bind it from — today that state names the option and offers no way
  to set it.
- It still writes no note. The picker cannot offer a key no note carries; that cost is
  already stated in `docs/requirements/Creating a release from the release view.md` and is
  unchanged. That note's "the ✨ ACTION without a ✨ button" paragraph is rewritten here.

## Where it lives

`src/domain/releases.ts` gains the scope-local completion predicate for hiding — and NOT a
summary derivation, which it already has and must not grow a second of. `src/view/release/renderScope.ts` is
210 lines today and would carry the header, the summary, a toolbar, folds and a keyboard
controller — over the 400-line lint cap and over one concern. It splits:

| File | Concern |
| --- | --- |
| `src/view/release/renderScope.ts` | the screen: header, summary strip, empty states |
| `src/view/release/scopeTree.ts` | the rows, the disclosure, folding, hiding |
| `src/view/release/scopeKeys.ts` | the roving selection and its key handling |
| `src/view/release/scopeToolbar.ts` | the four controls |

`src/view/release/renderIndex.ts` gains the ✨ control. `styles/release.css` gains the
classes the mock proved, published from its `SHEET` constant the way the index's bands were.

**`src/storage/viewStateStore.ts` DOES change, for the one persisted toggle.** `folds` needs nothing
— it is already a path-keyed map this view's identity gets its own copy of — but `prefs` is
not a free-form bag: `PREF_READERS` is declared `{ [K in keyof ViewPrefs]-?: … }` and
`readPrefs` writes only the keys that map holds, so a field with no reader is a compile
error and an unrecognised stored key is discarded on the way back in. That is the design,
not an obstacle to route around: the toggle gets a typed `ViewPrefs` field and a reader.
`releaseHideDone` is `onlyTrue`, storing the ON state of a toggle that starts off, so a
default writes nothing — `bucketList`'s own documented rule. One field, not two: the context
toggle was cut above. Round-tripping it belongs in `test/storage/`, beside the existing
prefs coverage.

## Checks

Every claim gets one that fails without it — watched failing, then restored.

- `test/view/releaseNeverEdits.test.ts` stays green unchanged. It is the whole read-only
  claim and nothing here may need it relaxed.
- Folds: a toggle persists across a data update; an embedded base keeps its folds in the
  session and loses them on remount; a renamed member keeps its fold.
- Rollups: a folded parent reports the same numbers as an unfolded one; **a context row
  reports none** — the rule [[The scope of a release as a tree]] states and the mock got
  wrong on its first draw.
- Summary: the strip and the index band report the SAME numbers for one release, because
  both read one `ReleaseRow` — driven from the index and the scope in one test; an unbound
  state key draws the count and a NAMED unconfigured progress, never a silent gap; no
  members draws no strip; adding a context ancestor to the fixture changes no number; a
  `Deliverable` member is counted done by its own workflow, not by the plan's state key.
- Hide done: a rollup is unchanged by the toggle; a done parent over unfinished member
  work STAYS; a done parent whose only unfinished descendant belongs to ANOTHER release
  hides, which is what separates the scope-local predicate from `item.subtreeDone`; a parent whose children all hid
  draws as a leaf; a context row whose children all hid hides; everything hidden draws the
  all-done state with its count rather than a blank scroller.
- Prefs: both toggles round-trip through the store, and a stored value of the wrong shape
  is discarded rather than trusted.
- Keyboard: one tab stop; Left on an open row folds it and on a closed one steps out; Enter
  opens through `openTarget`.
- ✨: not drawn with nothing to bind; drawn on the `noMembership` empty state; a bound
  option is never re-bound; no note is written (asserted on the call, not by driving
  screens); **a standalone press that bound something reports it, and one that bound
  nothing stays quiet** — both directions, driven through the button rather than through
  `newRelease`.
- `npm run check` — build, lint, coverage thresholds, fallow, docs register — plus a
  re-shot harness page. The live-vault check is owed and will be named in the PR.

## Out of scope, and where it goes

Blocked / unestimated / critical-risk figures ([[Summing up a release]], [[Release
readiness]]) · any write from this screen, including removing an item from a release
([[Setting an item's release]] already owns that gesture from the backlog view) · a scope
search ([[Quick filter]], dropped) · release notes generation ([[Generating the release
notes]]).
