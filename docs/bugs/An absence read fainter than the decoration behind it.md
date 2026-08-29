---
type: Bug
parent: "[[Resource absences]]"
order: 40
status: Done
area: styling
priority: P2
created: 2026-08-14
closed: 2026-08-14
source: User report with a light-mode screenshot at 382 results — three hatched stretches fainter than the weekend shading behind them
files:
  - src/domain/absences.ts
  - src/view/host.ts
  - src/view/render/afterContent.ts
  - src/view/render/lanes.ts
  - src/view/render/legend.ts
  - src/view/render/roadmap.ts
  - src/view/render/timeline.ts
  - styles/lanes.css
  - styles/legend.css
  - test/domain/absences.test.ts
  - test/helpers/resources.ts
  - test/helpers/roadmap.ts
  - test/view/absenceCollision.test.ts
  - test/view/legend.test.ts
  - test/view/resourceAbsences.test.ts
  - test/view/timelineBoxing.test.ts
started: ""
finished: ""
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
iteration: ""
---

# An absence read fainter than the decoration behind it

## What happened

On the roadmap's resources axis, absences were hard to see. In a light-mode vault at 382
results, the hatched stretches for three absences read as *fainter than the weekend banding
behind them* — a mark saying "nobody can be scheduled here" losing to shading that says
nothing at all.

Two more things were wrong with the same feature, and only the first of the three is a
colour problem:

- **Nothing keyed the hatch.** The legend drew a swatch per configured state, then today,
  then the milestone. A reader who had not used the feature had no way to learn what the
  hatch means, and no way to learn it is not one more state.
- **The stretch was on a line the bar it crosses is never on.** `laneEntries` gives each
  absence its own line leading the band, so the collision — the whole of what this feature
  exists to show — was the hardest thing on the band to see. The user story is "a row I am
  about to drop work into already shows the days nobody should be scheduled across", and a
  reader had to compare two lines by eye to get it.

Two smaller findings came out of the same reading. Nothing marked a bar that was scheduled
straight across an absence, which is fixed below. The other — a band whose only content is an
absence rendering `0` — was fixed and then unfixed: see **What the vault said** at the end.

## Why

**The mark was built out of the palette entry that means decoration.** `.pbl-absence` drew
its hatch and its border from `--background-modifier-border` — the same token `.pbl-grid-line`
is made of, and the same family `.pbl-weekend-layer` draws from. So it could not out-read the
decoration it sits on, by construction rather than by a few percent: it was made of it. It
was also 12px where a bar is 14px, which said "lesser" as well as "different" when only the
second was intended.

**Then `.pbl-absence-row` dimmed it another fifth.** That rule mutes the row's CONTENT —
correctly, and for a recorded reason: muting the row itself makes the sticky lead column
translucent. But the mark was in its selector list beside the lead, so the one thing on the
line that has to be seen was being faded by the rule that makes the row's NAME read as
furniture.

**The legend keys `DrawnColors`, and a hatch was not among them.** That interface reported
three colour overrides a bar can draw. A mark that is not a bar's colour had nowhere to be
reported from, so the swatch could not be gated the way every other swatch here is — and
gating it any other way is the mistake the done and milestone swatches each made once: a
predicate over the model keys a colour nothing on screen draws.

**The stretch's own line is right for what it carries and wrong for the collision.**
`laneEntries` is not the defect: that line is the surface carrying the title, the dates and
the Edit/Delete menu, so a resource whose only content is an absence (extension 4b) would get
a row with nothing in it to act on if the line went away. What was missing was the same fact
where the collision happens.

## The fix

Five increments, each with its own rule rather than its own diff.

**The mark is drawn from a TEXT token, never a `--background-modifier-*` one**, at 14px, and
the row's muting stays on its lead where it was meant. (It is 13px since the mark moved into
the header's own track and took a sub-lane pitch — near enough to a bar's 14px to read as the
same kind of mark, which is all this increment ever wanted from the number.) That is the rule the check states:
`test/view/timelineBoxing.test.ts` reads every custom property `.pbl-absence` names, refuses
any from the decoration palette, and requires at least one `--text-*` — the second half being
the instrument's own check, since a pattern matching nothing would satisfy the refusal for an
empty stylesheet.

**`DrawnColors` gained a fourth field, and is now wider than its name**: it reports which
MARKS a pass drew that the key has to explain, and a hatch is one. `drawEntries` sets it at
the one place a stretch is drawn, so the swatch appears exactly where the mark does — the
view test drove a band folded shut and watched the entry go with it, which was reachable then
because `laneEntries` skipped a collapsed band whole; since 2026-08-14 the stretch draws in
the header instead, and `test/view/legend.test.ts` now asserts the swatch STAYS when the band
folds shut (4n in [[Resource absences]]). A bar's own report is the narrower `BarColors`, so
no row literal claims anything about a mark drawn nowhere near it.

**A `.pbl-absence-wash` is appended into each work row's day track**, positioned by the same
`barGeometry` the mark is, so the shading and the stretch cannot disagree about which day is
which. Document order and no `z-index` anywhere, which is the whole layer story: the track
establishes no stacking context, so a layer on either element would out-rank the sticky lead
column at 2. It is a per-ROW wash and not a band-height one because
a band has no container element — its height is knowable only by measuring after the render,
the layout read `src/view/CLAUDE.md` forbids. `pointer-events: none` is load-bearing, not
housekeeping: each element of a band is its own drop target, so a child that intercepted the
pointer would be [[An absence stretch is a dead spot in its own band]] reached from inside the
row. A stretch wholly outside the drawn window shades nothing, since `barGeometry` clamps one
and a shaded column of days has no way to say "past this edge" the way `.pbl-bar-outside`
does. Extension 4a is unchanged — nothing moves to avoid anything — and the wash is recorded
as 4k beside it rather than as a revision of it.

**`crossedAbsences` in `src/domain/absences.ts` is the one place "does this bar cross a
stretch" is answered**, and it answers from DATES rather than geometry, so a crossing off the
drawn window still marks its row — `dependencyArrows`' own rule, read again. It judges the
overlap on the days the bar DRAWS (`start ?? target` … `target ?? start`, `barGeometry`'s own
borrowing), so a one-ended bar is judged at the single day it renders rather than treated as
unbounded: a backlog stating targets and no starts is the ordinary case here, and the other
reading would report a crossing on nearly every stretch behind it. The report is the
dependency conflict's SHAPE reused — a glyph in the lead, where a column of them is
scannable, and the words it stands for as `.pbl-sr-only` content in the row, because the wash
tells this in colour alone and WCAG 1.4.1 refuses that.

**The band header's count still counts result bars** — the rule a bucket's count already
keeps, and the one its own test asserts. A glyph beside it qualified the number for a few
hours; see below.

**What each check reaches, and what it does not.** The stylesheet checks are text over the
partials: they read the tokens each rule names, and they cannot say what those resolve to in
a theme, cannot see a later rule overriding them, and measure no contrast at all. The view
tests assert markup and the custom properties TS writes; jsdom paints nothing, so no
rendered width, layer order or colour is asserted anywhere here. `crossedAbsences` is the one
part of this with a real unit check behind it, because it is the one part that is a function
rather than an appearance. The four questions this still owes a live vault are on
[[Resource absences]], and `npm run harness` answers three of them at Obsidian's default
colours only.

## What the vault said

The increment shipped without a look — no browser was available to the session that built it —
and the maintainer opened it in a vault at 385 results the same day. **The contrast question is
answered: the hatch and the wash both out-read the weekend banding**, in a real theme, which is
the first of the four this note said it owed. Three things were wrong, and all three are the kind
only looking finds:

**The wash was UNDER the bars, and that is backwards.** It was built that way deliberately, on
the reasoning that a bar is the thing being asked about and must not be obscured by the
question — the argument the milestone line and the arrow layer both keep. It does not transfer:
a full-height wash a bar paints over marks the days that are FREE and hides exactly the ones the
reader is looking for, so the wider the bar the less of the collision survives. It is appended
now, over the bar, and the tint lands on the bar itself. The layer rule is unchanged and is the
part worth keeping: document order decides it and neither element takes a `z-index`, because
the track establishes no stacking context and whichever got one would out-rank the sticky lead
column at 2.

**The header glyph was noise.** `user-x` meant three things in this band when this was
written — the Add absence button, an absence row's own icon, and a bar's crossing flag — and a
fourth beside the count competed with the Add absence button, which reveals on hover in the
same place. The `0` it was meant to qualify is never read alone: the stretch's own hatched
mark was directly beneath the header then, in a row of its own. Removed with its two tests,
and recorded as a refusal on [[Resource absences]] so it is not proposed again from the
finding alone.

**One of those three is left** (2026-08-15). The absence row's own icon went with the row
when the stretch moved into the header's track ([[Resource absences]] 4n), and the crossing
flag is a hatched swatch rather than a glyph (below), so the Add absence button is the only
`user-x` in this band now. The reasoning above is unchanged — a glyph beside the count would
still compete with the button that reveals in the same place — but the count of what it
competes with is one, not three.

**The `Unavailable` swatch read as a ⊘ symbol.** This one the spec asked outright — "whether
the swatch's finer hatch reads as hatch at 10px" — and the answer is no: a 10px square with a
border and a halved period is a slashed circle, sitting among five colour dots. The period had
been halved *because* the real 4px stripe fits a 10px square only once, which is the tell that
the square was the wrong shape rather than the period the wrong number. The swatch is 20px
wide now and draws the mark's own gradient, so the key and the mark are one declaration
compared as one fact — a strictly stronger check than the colour-only pairing it replaces,
which could not have caught this at all.

A second look, once the shading was over the bars, added two more. **The wash was too faint
over a saturated bar**: 18% of `--text-muted` over an orange Epic at Months zoom is close to
nothing, and the answer is not only a bigger number — a flat fill strong enough to read over a
bar is also strong enough to read as a second bar. So the fill went to 28% and the RANGE
gained edges, which is what an eye actually finds; `box-sizing: border-box` keeps those two
1px borders from claiming a day nobody is away for, `.pbl-timeline-cell`'s own rule. **The
fill is 16% of `--pbl-away` now** — re-keyed off `--text-muted` onto the away key later the
same day so the wash, the lead swatch and the legend read as one warm fact, at a percentage
picked for that colour rather than carried over from the neutral one. Nothing here can settle
either number: `docs/tests/suites/Smoke test the roadmap.md` carries the re-keyed wash as
never checked.

And **the crossing flag wore `user-x`**, the glyph that already marked the Add absence
button, an absence row and a resource being away — four uses of one mark, of which the two a
reader most needs to tell apart are "this row IS an absence" and "this row RUNS THROUGH one".
It became `calendar-x` for a day and is a **hatched swatch in `--pbl-away`** now, drawing from
the same KEY the wash and the legend swatch draw from — not the same gradient, which is what
this said until 2026-08-15: three rules hatch three ways, and each is tuned to the box it
fills. The swatch stripes `--pbl-away` itself over a 35% fill at a 4px period, the wash
stripes the row's own `--background-primary` over 16% at 8px so it darkens what it crosses,
and `.pbl-legend-days-lost` halves the wash's period to fit a full stripe in a 10px square —
`styles/legend.css` says so at the rule. What the key buys is a colour rather than a fifth
icon, so the flag in the lead and the shading on the row beside it read as one thing.
