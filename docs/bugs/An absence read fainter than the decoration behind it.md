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

Two smaller findings came out of the same reading, both folded in: a band whose only content
is an absence rendered `0` beside a row that plainly had something in it, and nothing marked
a bar that was scheduled straight across one.

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
the row's muting stays on its lead where it was meant. That is the rule the check states:
`test/view/timelineBoxing.test.ts` reads every custom property `.pbl-absence` names, refuses
any from the decoration palette, and requires at least one `--text-*` — the second half being
the instrument's own check, since a pattern matching nothing would satisfy the refusal for an
empty stylesheet.

**`DrawnColors` gained a fourth field, and is now wider than its name**: it reports which
MARKS a pass drew that the key has to explain, and a hatch is one. `drawEntries` sets it at
the one place a stretch is drawn, so the swatch appears exactly where the mark does — the
view test drives a band folded shut and watches the entry go with it, which is reachable only
because `laneEntries` skips a collapsed band whole. A bar's own report is the narrower
`BarColors`, so no row literal claims anything about a mark drawn nowhere near it.

**A `.pbl-absence-wash` is prepended into each work row's day track**, positioned by the same
`barGeometry` the mark is, so the shading and the stretch cannot disagree about which day is
which. Prepended rather than layered, and that is the whole layer story: the track
establishes no stacking context, so a `z-index` on `.pbl-bar` to lift it instead would
out-rank the sticky lead column at 2. It is a per-ROW wash and not a band-height one because
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
keeps, and the one its own test asserts — and a glyph beside it qualifies the number instead
of changing what it counts.

**What each check reaches, and what it does not.** The stylesheet checks are text over the
partials: they read the tokens each rule names, and they cannot say what those resolve to in
a theme, cannot see a later rule overriding them, and measure no contrast at all. The view
tests assert markup and the custom properties TS writes; jsdom paints nothing, so no
rendered width, layer order or colour is asserted anywhere here. `crossedAbsences` is the one
part of this with a real unit check behind it, because it is the one part that is a function
rather than an appearance. The four questions this still owes a live vault are on
[[Resource absences]], and `npm run harness` answers three of them at Obsidian's default
colours only.
