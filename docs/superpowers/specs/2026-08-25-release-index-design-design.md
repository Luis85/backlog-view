# Release index design — a list of releases, not a list of controls

The release view's index screen, redesigned. `src/view/release/renderIndex.ts` and
`styles/release.css` today draw a five-column grid of `<button>` rows, and the complaint that
started this work was that they read as buttons rather than as releases.

That complaint turned out to be two defects wearing one sentence, and only one of them is a
design question.

## 1 — The measured defect

Every index row draws Obsidian's own raised-button chrome, and it is a specificity loss:

| Selector | Specificity | Declares |
| --- | --- | --- |
| `button:not(.clickable-icon)` (Obsidian's `app.css`) | (0,1,1) | `background-color: var(--interactive-normal)`, `box-shadow: var(--input-shadow)` |
| `.pbl-rel-row` (`styles/release.css`) | (0,1,0) | `background-color: transparent`, `box-shadow: none` |

The reset loses. Measured in headless Chromium against the real assembled stylesheet on
2026-08-25: a `.pbl-rel-row` computes `rgb(51, 51, 51)` over a body of `rgb(28, 28, 28)`. So
the rows really are drawn as buttons, exactly as reported.

Nothing could have caught it. jsdom computes no styles, so all eight of the view's tests pass
over markup whose appearance they cannot see, and `npm run harness` draws the page but asserts
nothing (ADR 0020). This is the same class of miss as the `display: contents` focus defect of
2026-08-23 — a claim about appearance resting on a substrate that has no appearance — and it is
recorded as its own bug note rather than folded into this design, because the fix is one
selector and outlives this layout.

**The fix is specificity, never the element.** The row stays a real `<button>`: picking a
release is this view's whole navigation, and the 2026-08-23 measurement is what established
that a row without a box is a row without a tab stop.

## 2 — The design question

The screen is a **plan overview and a triage surface**, not a navigation index. Asked what they
open it to find out, the maintainer named three things and not the fourth: which release is in
trouble, how far along each is, and what is coming when. "Which one do I open" was explicitly
not the job.

The vault shape it must serve: **a few live releases and a growing tail of shipped ones.**

Today's screen serves none of that. It draws the four figures that are cheap to read from a
note — name, version, target date, status, member count — and none of the ones
[[Every release at once]] actually specifies: progress, commitment against capacity, slip. The
use case's own `## Where it lives` says so plainly. And its sort order is actively wrong for
this vault shape: rows order by target date **ascending**, so every shipped release floats to
the top and the next one to ship is buried mid-list.

### What a release's band shows

One band per release, two lines, replacing the five-column grid.

```
┌ 0.8   0.8.0                          12 Sep 2026 · 18 days left   [In progress]
│ ▓▓▓▓▓▓▓░░░░░  8 of 14 done                              3 days overdue
```

- **Line 1** — name, version, then pushed to the end: the target date with days remaining, and
  the status chip.
- **Line 2** — a fixed-width progress bar, the counted phrase `8 of 14 done`, and a note pushed
  to the end: the overdue warning while in flight, or the slip once shipped (`4 days late`,
  `2 days early`).
- **Overdue** draws a 3px rule down the band's leading edge, a red date and a red bar, plus the
  note. Four signals, one band, one condition.

The member count is **folded into the progress phrase** rather than kept as a column of its
own. `8 of 14 done` states the count and the denominator in one place, which is the whole of
what the Items column said.

A release with no members says `No items yet` and draws no bar. A zero-length bar reads as
failure, where the answer is emptiness.

### Two groups, and the order within each

The flat list becomes two labelled groups, each with its count:

- **In flight** — no released date. Ordered ascending by target date, undated last, then rank,
  then path. Unchanged from today except that it no longer has the tail sitting on top of it.
- **Shipped** — has a released date. Ordered **descending** by that date, so the most recent
  shipped release heads its own tail.

`releaseIndex` still decides the whole order and `renderIndex` still re-sorts nothing. The flat
`rows` array stays flat and stays the sorted one — `releaseScope` and every existing test read
it — and the sort simply gains shipped-ness as its first key. The renderer emits a heading
where a row's own `shipped` flag changes. Grouping is where the heading falls, not what the
order is.

### What turns a band red

**Overdue, and nothing else**: the target date has passed and there is no released date.

This is a fact, not a heuristic. The alternative considered and refused was an early warning —
"the target is near and progress is low" — which needs two constants nobody can derive, and a
window to measure elapsed time against. **A release note carries no start date anywhere in the
model**, so there is no window without inventing one, and a rubric this screen cannot show the
reader is a rubric they cannot argue with. Overdue warns late; it is never wrong.

`today` is passed into `releaseIndex` by the view, following `writePlan.ts`'s own convention for
the same value, so the figure is testable without a clock.

### Blocked and risky members

Named as wanted, and deliberately **not** in this increment. Each needs two more bindings on
this view (a dependency property with its clearing values; a risk property with its critical and
addressed values) and its own derivation. The band's second line is where they land — beside
the progress note — and the layout is designed with that room in it.

## What it costs

### Two new view options — ten, not eight

Both are declared in `getReleaseViewOptions` (`src/domain/releaseOptions.ts`):

1. **`stateProperty`**, with **`doneValues`** beside it. These are the keys `resolveSettings`
   already reads by name, so declaring them is the whole of the plumbing: `readItems.ts`
   computes `item.done` from them, and the release view's `buildModel` already spreads
   `resolveSettings(this.config)`.

   This matters beyond convenience. `stateKey` defaults to `''`, so a progress figure built on
   today's model would read **0%** on any base that never bound a state property — silently,
   and identically to a release where nothing is finished. Declaring the option is what turns
   that into an absent figure named once, per extension 2a.

2. **`releasedDateProperty`**, a new key on the release note, joining `ReleaseSettings` as
   `releasedDateKey`. It is what tells shipped from in flight, and it is what makes slip
   derivable — one binding, two figures. This is the maintainer's own pick over interpreting
   status strings or inferring shipped-ness from 100% progress, both of which are wrong in both
   directions.

**This narrows the open issue [[The release view inherits backlog settings it offers no control
for]] by exactly two settings, and does not close it.** `resolveSettings` returns around thirty
fields and this increment declares two of them. The issue's own answer — a stated rule about
which of `BacklogSettings` a view with its own options inherits, settled once for the release
and estimation views together — is untouched and stays open.

### Three new figures on `ReleaseRow`

Each is a `ReleaseFigure`, so each composes with the existing absence rule rather than adding a
new one:

- **`done: ReleaseFigure<number>`** — members whose own state is a done value. Unconfigured
  without a state property *or* without a membership property: a done count with no membership
  has nothing to count over. Counted in the same walk that already counts members, so there is
  one traversal and one denominator.
- **`released: ReleaseFigure<CivilDate>`** — read from the release note exactly as `target` is,
  with the same three answers (unset, unreadable, a date).
- **`slip: number | null`** — derived, never read: released minus target, in days. Null without
  either date. Negative means early, which is a real answer.

`members` is unchanged. Progress is `done` over `members` and is computed nowhere else — the
single-release screen reads the same row, which is what stops a band and a release header
disagreeing.

**`overdue`** is derived on the row too: a target in the past with no released date.

## Where it lives

- `src/domain/releases.ts` — the three figures, `overdue`, the `today` parameter, and the sort's
  new first key.
- `src/domain/releaseOptions.ts` — the three new option declarations and `releasedDateKey`.
- `src/view/release/renderIndex.ts` — the band replaces the column grid. The `ColumnSpec` list
  and `columnWidthVar` go with it; the accessible-name composition does not, and is rebuilt over
  the band's own parts (see below).
- `styles/release.css` — the band, the groups, the bar, the overdue treatment, and the
  specificity fix.
- `src/view/release/releaseView.ts` — passes `today` into `releaseIndex`.

`renderNewRelease` is untouched and stays at the head of the index above the scroller, and
inside the no-releases empty state. Neither position has ever been looked at in a vault; that
stays owed.

## The accessible name

A `<button>`'s accessible name is its contents run together, which on this screen would say
"0.8 0.8.0 12 Sep 2026 18 days left In progress 8 of 14 done" — values with nothing saying which
is which. The band keeps today's answer: an `aria-label` composed from the same parts the band
drew, every piece through the catalog, joined by `Intl.ListFormat` inside it.

**What is not in this increment**: nothing here has heard a screen reader, and that was already
true. The name is composed correctly by assertion only, and that line stays in the smoke suite.

## Checks

Node tests (`test/domain/`) reach every figure without a screen:

- `done` counts only members, never a context ancestor, and is unconfigured without either key.
- `slip` is null without either date, positive when late, negative when early.
- `overdue` is false for a shipped release whatever its target, and false without a target.
- The sort puts in flight before shipped, orders each group its own way, keeps undated last
  *within its group*, and does not reorder across repeated renders.

jsdom tests (`test/view/`) reach the markup:

- A band draws the bar, the counted phrase and the overdue note, and draws `No items yet` with
  no bar at zero members.
- The group headings fall where `shipped` changes, and carry their counts.
- An unconfigured state property leaves the bar and the phrase absent, and names the column once
  beneath the list, as extension 2a requires.
- The accessible name pairs each figure with its label.

**One check is narrower than the claim above it, and the narrow sentence is the honest one.** No
test in this repository can compute a selector's specificity against Obsidian's stylesheet. What
is checked is that the assembled stylesheet still spells the band's reset at the compound
selector the fix uses — a test that fails if somebody lowers it back, and that would not notice
a *different* Obsidian rule outranking a *different* declaration. The measurement that found the
defect is a headless-Chromium probe, and it is not in `npm run check` for the same reason the
harness is not (ADR 0020).

## What the harness cannot answer

The layout above was mocked in `test/harness/mock.ts` (uncommitted, per CLAUDE.md) and looked at
in headless Chromium in both schemes and at the 500px minimum, against the real assembled
stylesheet. That answers layout, spacing, hierarchy and **Obsidian's default colours only**.

Unanswerable here, and owed to a live vault:

- A themed vault's colours and its accent, and whether `--text-error` reads as a warning under
  one rather than as an error.
- Whether the band's `<button>` reset holds against a theme that styles `button` harder than the
  harness's stand-in baseline — which is precisely the surface the defect above lives on.
- Anything Bases hands the view: the two new options in the options menu, and whether Obsidian's
  property picker can offer a released-date property no note yet carries.

These fold into [[Smoke test the release view]] rather than starting a second list. That suite
has six unrun items from the two increments before this one, and this increment adds to them
rather than clearing them. **Nothing in this design has been seen in Obsidian.**

## Register edits this increment owes

- [[Every release in one list]] — extension 3a becomes "undated last within its group"; new
  extensions for the shipped grouping, the released date's three answers, and overdue; the
  `## Where it lives` section rewritten for the band.
- A new bug note for the specificity defect, with the measurement.
- [[Smoke test the release view]] — the new live-vault items, folded in.
- `CLAUDE.md` — the i18n key count, which says 597 and measures **643** on merged `main`, both
  ways that paragraph describes, with no duplicates.
