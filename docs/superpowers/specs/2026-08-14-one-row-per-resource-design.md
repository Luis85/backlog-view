# One row per resource — design

**Date** 2026-08-14 · **Feature** [[Resource absences]] and [[Showing a resources axis on the roadmap]]

## The request

A resource band is currently as tall as the number of things said about it: a header, a
line per absence, then a line per bar. A roster of ten people with a stretch each is
twenty rows before any work is drawn.

**One row per person, whatever they have.** The stretches move into the header's own
track, overlapping stretches pack into sub-lanes instead of stacking into lines, a band
with nothing in it draws as one quiet row, and the cost of scheduling work across an
absence becomes a number rather than a glyph.

The request also asked for such a band to FOLD itself. It does not — §4 says why, and the
short version is that after the first change it would fold nothing.

Mocked before building (a browser screenshot at week zoom), which is where the readout
shape, the pill and the days-lost sentence come from.

## Two recorded decisions are reversed here

Both are in `docs/requirements/Resource absences.md`, and neither is reversed by silence —
the register argued for them, so this argues back or it does not ship.

### Extension 4a, and "no lane-packing"

4a reads: *"Both draw, stacked; the row's own height grows rather than either one moving
to avoid the other."* An acceptance criterion says *"Overlapping bars and absences in one
row stack, **with no lane-packing**."* `laneEntries` states the reason at the code:
*"a packing rule is a second geometry to keep in step with the one the bars use."*

**That reason is answered by making the packing narrower than the one it refused.**
`packAbsences` returns `Absence[][]` — which stretch belongs to which sub-lane — and
computes no pixel. It runs over **absences only and never over bars**: every bar is still
positioned by `barGeometry` against the same window, one row per `timelineRows` row,
nothing moved aside for anything. So there is no second geometry to keep in step; there is
one geometry and a grouping decided before it.

What 4a was protecting is kept in a sharper form: **nothing is ever hidden by packing.**
Two stretches that share a day get two sub-lanes and the band grows. The rule 4a stated as
"stacked" becomes "packed, and the header grows to hold every sub-lane" — the same promise
that no stretch is dropped or merged, at a third of the height.

### The named line

The spec behind extension 4k refused dropping the absence's own line: *"that line is the
surface carrying the title, the dates and the Edit/Delete menu, so a resource whose only
content is an absence would get a row with nothing in it to act on."*

Half of that refusal is answered and half is paid:

- **The action half is answered.** The `contextmenu` → `showAbsenceMenu` wiring moves onto
  each mark, so Edit and Delete are reachable exactly where they were — on the stretch
  itself. It is now the only route, which makes it load-bearing rather than convenient.
- **The reading half is paid, not answered.** See §6. A screen-reader user loses a row per
  stretch and gains one concatenated description. That is a real regression and the
  register will say so in those words rather than calling the replacement sufficient.

## What is refused

- **Packing the BARS.** Only absences pack. A bar's row is `timelineRows`' and stays so.
- **A second mark geometry for the n=1 case.** One height, one pitch, one formula (§3).
- **Moving anything to avoid anything.** Packing groups; it never nudges.
- **A model-driven fold default** ("no work → folded"), and the second stored set it needs.
  See §4: after the stretches move into the header it changes nothing on screen, and it
  would fold every empty lane once on first load after upgrade.
- **A midnight timer.** `docs/issues/The roadmap keeps yesterday's date across midnight.md`
  owns that, and this change adds a fifth consumer of the same stale value without making
  it worse.
- **Reaching for `--background-modifier-*`** for any of these marks. The light-vault report
  behind `An absence read fainter than the decoration behind it` stands: an absence is
  content, so it draws from a TEXT token.

## 1. A constraint the plan has to bend around: `max-params`

`renderLaneHead` is at **exactly 5 parameters**, the lint limit, since the header gained
`today`. It now also needs the window and the scale. That is 6 and fails `npm run lint`.

The signature collapses instead of growing:

```ts
export function renderLaneHead(
	ctx: RowContext,
	content: HTMLElement,
	entry: { lane: ResourceLane; collapsed: boolean },
	ruler: { window: TimelineWindow; scale: TimelineScale; today: CivilDate },
): HTMLElement
```

Four parameters, and both new groupings already exist as shapes — `entry` is the
`TimelineEntry` `'lane'` member minus its tag, and `ruler` is what `renderLaneAbsence` and
`renderAbsenceWash` already take, plus the `today` the readout needs. `drawEntries` holds
all of it.

## 2. The stretches move into the header's track

`src/view/render/lanes.ts`:

- `TimelineEntry` loses its `{ kind: 'absence' }` member.
- `laneEntries` stops pushing them. A band is header → `timelineRows(lane.bars)` → context
  rows.
- `renderLaneHead`'s trailing `head.createDiv({ cls: 'pbl-timeline-track' })` stops being
  empty: a new `renderLaneAbsences(track, lane, ruler)` draws the packed stretches into it.
- `renderLaneAbsence` is replaced by that drawer, which keeps every correct thing it did —
  `barGeometry` against the same window, `--pbl-bar-left` / `--pbl-bar-width` with
  `MIN_BAR_PX`, `edgeClasses(geometry)`, the `formatCivil` tooltip, and the `contextmenu`
  wiring **per mark**.

**The drop target still works, and this is the one place to be careful.** Each element of
a band is itself the drop target (`TimelineDrawing.laneElement`), and the marks now sit
*inside* the header. They keep pointer events — the menu needs them — and the drop keeps
working because the marks are **children** of a registered element, so `dragover` and
`drop` bubble to it. That is what makes this different from
`docs/bugs/An absence stretch is a dead spot in its own band.md`, where the stretch was a
SIBLING that drew into the band without joining it. Bubbling is the whole mechanism; a
`pointer-events: none` on the mark would break the menu, and a `stopPropagation` on it
would recreate the dead spot exactly.

### The window still has to be widened by absences

`drawnSpans` read the absence entries. With no such entries it must read the lanes:

```ts
export function drawnSpans(entries: TimelineEntry[], lanes: ResourceLane[]): DateSpan[]
```

Bars from the entries, absences from the lanes; the dated axis passes `[]`. **This must not
be allowed to fall out** — it is the regression
`docs/bugs/An absence drew at the edge of a window it never widened.md` records, and a lane
an absence minted still holds no bar, so nothing else in it has any say in the window.

## 3. Packing, and one geometry

New pure function in `src/domain/absences.ts`:

```ts
export function packAbsences(absences: Absence[]): Absence[][]
```

Greedy: sort by `start`, place each stretch in the first sub-lane whose last stretch ends
**before** it starts, else open a new one. The boundary is `crossedAbsences`' — inclusive
at both ends — so two stretches that merely touch do NOT share a sub-lane. Pure, no
geometry, order-stable within a sub-lane.

**One geometry, no n=1 special case.** The plan's table and its formula disagreed (29 vs 30
at n=1, 46 vs 44 at n=2), and the special case bought a second set of numbers for one row.
`--pbl-lane-sublanes` carries `n` and the stylesheet does the arithmetic:

| sub-lanes | header track | mark tops |
| --- | --- | --- |
| 0 (quiet) | 26px | — |
| 1 | 30px (the floor) | 7 |
| 2 | 44px | 7, 24 |
| 3 | 61px | 7, 24, 41 |

Mark height **13px**, pitch **17px**, top `7 + i * 17`, track
`max(30px, 10px + n * 17px)`. At n=1 the mark sits 7 above and 10 below in the floor
height — near enough to centred that nobody measures it, and it costs a `calc` rather than
a branch. Only the person who overlaps grows; everyone else stays at 30px, which is the
point of packing over stacking.

## 4. Folding

### The fold state does not change at all, and that is the finding

The request asked for "no work → folded by default", which needs a second stored set:
`collapsedLanes` is an explicit set of folded NAMES, so "folded unless opened" cannot be
expressed by adding names — a reader who opens an empty lane has nothing to store.

**It was refused, because after §2 it is inert.** A band is header → bars → context rows.
Once the stretches move into the header's own track, a lane with no bars has nothing
beneath the header at all, so `laneEntries` emits the identical entry list either way:
collapsed pushes the header and `continue`s; open pushes the header, then no absences, then
`timelineRows([])`, then no context. Same rows, same marks, same height. The default would
have bought **a chevron pointing right** — and cost a second set in the collapse store, a
`setLaneCollapsed` that has to prune the other set, and a first load after upgrade where
every empty lane folds itself once, which reads as data loss for exactly as long as it takes
to look broken.

So there is **no state-model change in this redesign**. `collapsedLanes` stays exactly as
it is, one explicit set, and the whole change is render and CSS.

The one case where folding an empty lane is not inert: a lane with no bars but with CONTEXT
rows, where folding does hide something. That is not an argument for the default either —
a context row is placement rather than population, and auto-folding on a count that excludes
the only thing the fold would hide is a rule that would have to be explained every time it
fired.

What the request actually wanted from this — quiet people taking one quiet row — is
delivered by §2 and by `.pbl-lane-quiet` below, with no persisted state involved.

### The load rail

While a band is folded, its bars are drawn as one 3px strip per contiguous run at the
bottom of the header track, `aria-hidden`, `pointer-events: none`, `opacity: .75`. An open
band draws none: its own bars already say it.

The union is a pure helper in `src/domain/bars.ts`, never in the renderer.

**The `opacity` here is exempt from the rule beside it, and the plan contradicted itself
on this.** `styles/lanes.css` says muting is done to a row's **content**, never to the
row — because a row-level `opacity` dims the sticky lead column with it. The rail is an
`aria-hidden` decorative child inside one track. The exemption is stated at the
declaration or the next reader deletes it.

### Quiet lanes

`.pbl-lane-quiet` on the header when `lane.bars.length === 0 && lane.absences.length === 0`:
background one step below `--background-secondary`, name at `--text-muted`, no readout at
all. **Contrast, not opacity** — that is the rule the rail is exempt from, applied where it
actually holds.

## 5. Work scheduled across an absence

`renderAbsenceWash` and `noteAbsenceClash` both stay; both are re-keyed.

### The wash

```css
--pbl-away: color-mix(in srgb, var(--color-yellow) 55%, var(--text-muted));
background-color: color-mix(in srgb, var(--pbl-away) 16%, transparent);
background-image: repeating-linear-gradient(45deg,
  color-mix(in srgb, var(--background-primary) 35%, transparent) 0 4px,
  transparent 4px 8px);
border-inline: 1px solid color-mix(in srgb, var(--pbl-away) 85%, transparent);
```

The hatch is drawn in the row's own dark, so the column **darkens** whatever it crosses
instead of brightening it. `box-sizing: border-box` stays (the two edges must not claim a
day) and `pointer-events: none` stays (the dead-spot bug).

### The clash mark and the cost

- The `.pbl-sr-only` sentence stays **verbatim**. It is the WCAG 1.4.1 answer, and colour
  still carries the whole visual half.
- The `calendar-x` glyph becomes an 11px hatched swatch in `--pbl-away`, keeping
  `.pbl-away-flag`'s right-edge pinning, so the lead mark and the column read as one thing.
  The legend gains a `Days lost` key on the same drawn-not-model rule the `Unavailable`
  swatch already keeps (`DrawnColors` gains `daysLost: boolean`, set where the mark is
  drawn).
- After the bar, in `--pbl-away`: `15 days lost to absence`, or `all 10 days lost` when the
  bar is wholly covered.
- A milestone is a point, so no wash arithmetic and no notch — `crossedAbsences` already
  answers it. It keeps its diamond and takes the suffix `· falls on an away day`.

**The visible label needs a suppression rule, which the plan did not have.** It is new
furniture inside the day track: at `year` zoom a bar is a few pixels and the sentence is
~180px, so it would dominate the grid and collide with the next bar. It draws only when the
bar's own drawn width clears a threshold — and **the `.pbl-sr-only` sentence is written
unconditionally**, so nothing is lost when the visible half is dropped. Shed the visible
thing, never the reachable one: the toolbar's own rule.

### One union primitive, two callers

Two of these numbers are a union of date ranges, and computing it twice is how they come to
disagree:

```ts
export function unionDays(spans: DateSpan[]): number
```

- `daysLost(span, absences)` = `unionDays` of the intersections of the bar's drawn days
  with each stretch — so two overlapping stretches count once, not twice.
- The away pill's days = `unionDays` of the **pending** stretches (`pendingAbsences`' own
  filter), then `ceil(days / 7)`.

Same inclusive boundary rule as `crossedAbsences`, in one place.

## 6. The readout

`laneReadout` becomes two things in the lead: the item count, and a pill.

```
Evi       1 item        [3 wk away]
Sarah                   [6 wk away]
Jolanda
Igmar     4 items       [2 wk away]
```

- **The item count is dropped at zero.** This reverses `0 items`, shipped hours earlier on
  this branch — see §8. A quiet roster row draws nothing rather than a column of zeroes.
- **The pill is dropped at zero away-weeks**, and weighted up (`--text-normal` on
  `--background-modifier-border`) when the lane also holds work, so a busy-and-away row is
  the loudest thing in the column.
- `pendingAbsences` survives from the previous increment as the pill's filter. Nothing else
  of the `N items / N absences` string does.

### The accessibility cost, stated rather than smoothed over

Each stretch had a row carrying `aria-label` = `<title> — unavailable <dates>` and
`aria-description` = `Assigned to <name>`. It now has neither. The header takes an
`aria-description` listing `title start → target` per stretch — the header claims no role
of its own, so the slot is free — but **three stretches become one long string with no
structure, and a screen-reader user can no longer move between them.**

That is a regression, not a substitution, and the register says it in those words. It is
accepted because one-row-per-person is the point of the change and no per-stretch element
can carry a name while the row it replaced is gone. The keyboard gap is **unchanged, not
widened**: an absence row was never a keyboard stop either, and closing it properly is
still [[Keyboard and menu on the roadmap]]'s work.

## 7. Values

| | |
| --- | --- |
| lead column | unchanged, `--pbl-tl-lead` |
| item row track | 34px, unchanged |
| lane header track | 30px floor · 26px quiet · `max(30, 10 + 17n)` |
| absence mark | 13px, pitch 17px, top `7 + i*17`, `--radius-s`, 1px border, 45° hatch 4px/8px |
| load rail | 3px, bottom-aligned, `opacity: .75`, aria-hidden |
| away key | `color-mix(in srgb, var(--color-yellow) 55%, var(--text-muted))` |
| wash | 16% fill, 85% edges, hatch in `--background-primary` at 35% |

Every colour is a token or a `color-mix` of two, so light mode and themed vaults hold. The
percentages are live-vault tuning knobs, the same caveat the existing comments carry.

## 8. What this supersedes on its own branch

Landed hours earlier on `feature/absence-counts-and-derived-names` and rewritten here:

- `laneReadout`'s `N items / N absences` string, and the four tests pinning it
  (`resourceLanes.test.ts`), including `'0 items / 1 absence'` — the case added in a fix
  round for a doc-comment claim that this change deletes.
- The register paragraph admitting the labelled readout, amended a second time.

The derived absence name, `pendingAbsences`, `absenceTitle`, `AbsenceFacts`' move and both
final-review bug fixes are untouched. The PR body has to say the readout was written twice
in one branch, or the diff reads as churn.

## The checks, and what each reaches

**Node** — `test/domain/absences.test.ts`:

- `packAbsences`: non-overlapping → one sub-lane; touching at a shared day → two; three
  mutually overlapping → three; order stable within a sub-lane.
- `daysLost`: no crossing → 0; partial overlap; wholly covered → the span's own length; two
  overlapping stretches → the union, **not** the sum.
- the away-weeks helper: rounds up; a past stretch is excluded.
- `unionDays`: adjacent-but-not-touching stays two; touching merges once.

**Node** — `test/domain/bars.test.ts`: the load rail's union, same shape.

**Storage** — nothing. The collapse store is untouched, which is the point of §4.

**View** — one check for the refusal in §4, so it is not re-proposed by someone reading the
mock: a lane with no bars renders the same rows folded and open. It states why the default
was declined, in the one place that can fail if that stops being true.

**View** — `test/view/resourceAbsences.test.ts`:

- **no absence ROW is emitted at all** — the shape of the change, stated as its own check;
- the mark is inside `.pbl-lane-head .pbl-timeline-track`;
- the `contextmenu` is still wired **per mark**, since it is the only route left to Edit and
  Delete;
- a drop on the MARK still reaches the band — the bubbling that keeps the dead-spot bug
  fixed;
- `drawnSpans` still widens the window for a lane holding only absences;
- the header carries the sub-lane count as `--pbl-lane-sublanes`;
- the days-lost sentence is in `.pbl-sr-only` even where the visible label is suppressed.

**What none of it reaches:** whether any of this LOOKS right. jsdom paints nothing.

## The register

- `docs/requirements/Resource absences.md`: 4a **reversed** with the argument above, the
  no-lane-packing criterion rewritten, 4k amended (the named line is gone, the menu moved),
  a new extension for the header track and the accessibility cost, and the readout
  paragraph amended a second time.
- `docs/requirements/Showing a resources axis on the roadmap.md`: the header's readout, the
  fold default, the load rail, quiet lanes.
- `docs/requirements/Folding a resource's band.md`: the load rail, and — recorded so it is
  not re-proposed from the mock — that a model-driven fold default was asked for and
  refused as inert, with the reason from §4.
- `CHANGELOG.md` `[Unreleased]`, folded into the entries already there rather than added
  beside them — one user-visible change, not two.
- `docs/tests/suites/Smoke test the roadmap.md`: the live-vault rows below.

## What a live vault owes

Everything about how it looks, plus two that are specifically unanswerable here:

- whether 16% warm reads as a column over a saturated bar in a themed vault, in both
  schemes;
- whether the days-lost sentence's width threshold is set anywhere near right — it is a
  pixel judgement against real labels at real zooms;
- whether a screen reader reads the header's concatenated stretch description usefully, or
  whether the regression in §6 is worse in practice than on paper.
