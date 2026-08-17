---
type: PBI
parent: "[[An Iterations board]]"
order: 30
status: Done
priority: P3
created: 2026-08-15
source: user request
started: ""
finished: 2026-08-17
horizon: ""
start: ""
due: ""
risk: ""
assignee: ""
---

# An iteration draws as a bar or a line

**As** someone reading the roadmap, **I want** to choose whether a sprint shows as a bar
across its two weeks or as a line at its end date, **so that** the axis answers "what is
this sprint holding" or "when does it close" without me keeping two kinds of note.

An iteration is a marker **structurally** — no rung, no children, and no *outgoing*
dependency edge, though like any marker it may still be waited **for**
([[An iteration is a note of its own]]) — and that is settled. What is not settled by the
type is how it is **drawn**: a milestone is a point because a milestone *is* a point, but
a sprint has two ends and the reader decides which reading they want.

Today one predicate answers both questions, because `Milestone` is the only marker and it
happens to need them fused. Widening that predicate to a second name would make it mean
two things at eight call sites — the defect `src/domain/typeVocabulary.ts` already records
for `isExtraType`, quoted there as the reason a marker is not in `EXTRA_TYPES`. So the
questions split before the second name arrives, not after:

| Predicate | Means | Unchanged by this work |
| --- | --- | --- |
| `isMarkerType` | no rung, no children, no prerequisites of its own | yes — its callers keep their meaning |
| `drawsAsPoint` | drawn at one date, not across two, and holdable at neither end | no — this is the new one |

**Every caller is named, and one of them is easy to miss.** `barHolds` in
`src/domain/bars.ts` asks *both* predicates in the same function — `placementEnds` for
which ends are writable, and then `isMarkerType` on its own line to return a body hold
and nothing else. So it is not enough to widen `placementEnds` and let the rest follow:
that branch would keep the old meaning silently, `iterationBars` would be on, the bar
would draw, and neither grip would appear. It is the third question the one predicate
answers today — what a *gesture* may take hold of — and it is why this note lists the
call sites rather than trusting a rule to reach them.

## The type is declared before this lands, and three labels are wrong meanwhile

*(Added 2026-08-16, after `Iteration` joined `MARKER_TYPES` and a Codex review on PR #154
found what that reaches.)* Declaring the type makes an `Iteration` draw on the roadmap
**today**, through every caller that was written when `Milestone` was the only marker —
and three of them do not say "marker", they say **Milestone**:

| | |
| --- | --- |
| `deriveLanes` (`src/domain/roadmap.ts`) | every marker goes in a lane literally named `Milestones` |
| `renderLegend` (`src/view/render/legend.ts`) | the swatch reads `Milestone`, in `--color-cyan` |
| `spanText` (`src/view/render/lanes.ts`) | a zero-length span announces `Milestone <date>` |

So a sprint is presented as a milestone in the lane caption, the legend and the announced
sentence. The last is the worst of the three, because it is what a screen reader says.

**All three are cheap, and none of them is a colour question.** The lane caption looks
expensive and is not: the markers row is *never* folded — `const collapsed = !lane.markers
&& folded.lane(lane.name)` — so renaming it drops no stored fold, unlike every other band.
`spanText` should name the item's own type instead of one marker's. And the legend swatch
needs only a **word**, because an `Iteration` badge ships **cyan**, the same hue as
`Milestone` ([[An iteration is a note of its own]]) — so one cyan swatch is already
honest about both markers and only its caption lies.

*This paragraph said the opposite for twenty minutes on 2026-08-16*, claiming a purple
badge and a colour-budget decision to be taken. It was written from the plan that proposed
purple rather than from the stylesheet, which had already chosen cyan and said why: purple
is `.pbl-lvl-1`, Feature's, and all eight theme tokens were taken before this type
existed. A note asserting a fact about code it did not read, in a register whose own rule
is to read the code first.

**This is why the labels are named here rather than left to the `drawsAsPoint` split.**
That split decides whether an iteration is a point or a bar; these three are wrong in
**either** mode, so fixing them is not a consequence of the toggle and must not wait for
the reader to turn it on.

*Corrected 2026-08-17, now that the increment this section worried about has shipped.*
Its opening claim — that declaring the type made an `Iteration` draw on the roadmap
"today", mislabeled — outran what any vault ever showed. `b08097e`, later on the same
2026-08-16, found the exclusion already held through `inPlan` and gave it a test rather
than a behaviour change: from that commit on, no projection drew an `Iteration` at all,
right or wrong. The grid did not draw one until this increment admitted it (`d39858a`),
and the three labels above were wrong for as long as that admission stood alone — but the
relabelling (`548d49e`) landed in the same change, before the admission was ever released
without it. So the gap this section warned about was real in the source and closed before
it reached anything a vault could open: nothing this repository has shipped has ever
called a sprint a milestone.

## The admission itself is optional

*(Added 2026-08-17, on user request, after this note's own increment shipped.)* This note
decides how an iteration draws on a grid axis; `iterationsOnTimeline` decides **whether it
draws there at all**. It is a second `.base` toggle in the same group, **on** by default,
so the admission above is what an untouched view keeps — and a reader whose plan is read
by milestone alone can take it back without retyping or deleting a single sprint note.

Off, an `Iteration` draws on no projection whatsoever: no bar, no boundary line, no
diamond, and **nothing on the shelf either** — the option is read where every surface
already asks one question (`visibilityRule`), so it is an item this axis does not draw
rather than an item it could not place. The unplaced count is a count of work the reader
can act on, and a sprint they have hidden is not on that list.

**It also withholds `iterationBars` while it is off**, which is this note's own "absent
rather than inert" rule reaching the options menu: the bar option chooses between two
readings of an iteration on the grid, and with nothing drawn there is no reading to choose.
Withheld, never reset — the `.base` keeps the key and `resolveSettings` reads it back
untouched, so turning the timeline on restores the reading the reader last picked. That is
what makes `iterationsGroup` read the config, the same reason `progressGroup` does.

It writes nothing and is read at no write path, which is what separates it from
`iterationBars` (extension 5a): that option decides which date KEYS a placement may touch,
so `storage/` resolves it; this one decides only what is on screen. Turning it back on
redraws the same notes, unchanged.

## Use case

| | |
| --- | --- |
| **Actor** | Backlog owner |
| **Trigger** | Setting "Draw iterations as bars" in the view options, or scheduling an iteration on the dated axis |
| **Preconditions** | Roadmap mode, the dated axis, and an iteration carrying a date the mode can use — a **target** date in line mode, since a point IS its target (3b); **either** date in bar mode, since one date places an open-ended bar (4a) |
| **Guarantee** | The option decides which date keys a placement may touch, so a drag can never write a start onto an iteration the option says is a point. Changing the option rewrites nothing on any note. |

**Main flow**

1. The user sets `iterationBars` in the `Iterations` options group. It is a `.base`
   setting, saved on the view.
2. `drawsAsPoint` answers `false` for an `Iteration` while the option is on, and `true`
   while it is off — `isMarkerType` alone still answering for every other marker.
3. With the option **off**, an iteration draws a boundary line at its target date and a
   diamond, exactly as a milestone does, and its start is ignored rather than deleted.
4. With the option **on**, it draws a start→target bar and no boundary line, placed by
   the same span rules every other item is placed by ([[Bars from two dates]]).
5. Scheduling by drag, by grip or from the row menu writes only the ends the option
   admits, because the writer asks the same predicate the renderer does.

**Extensions**

- **1a — the option is left at its default.** Iterations draw as lines, which is the
  reading that cannot over-promise: a line claims one date and a bar claims two, and a
  vault that has not said which it means should not be shown the stronger claim.
- **2a — the vault has no `Iteration` notes.** The option changes nothing visible and is
  still offered, like every other view option whose subject a base may not hold.
- **3a — the iteration carries a start date while the option is off.** The start is
  **ignored, never rewritten**. Ignoring a value and deleting it are different acts, and
  only the first is specified — the rule `placeItem` already keeps for a milestone with a
  stale start.
- **3b — the option is off and the iteration carries no target date.** It goes to the
  shelf with every other unplaceable card, counted there, and the shelf is the target
  that un-places it ([[The unplaced shelf]]). A point IS its target date, so a point
  without one is nothing to draw. **Scoped to line mode deliberately**: the same
  iteration in bar mode places on its start alone (4a), and an earlier draft of this note
  said the option changed nothing here — two rules over one state, which no
  implementation and no test could have satisfied at once.
- **4a — the option is on and the iteration has only one of the two dates.** It places on
  the date it has, as an open-ended bar, exactly as every other item with one date does
  — [[Horizons or dates]] extension 2b states the rule and `inferSpan` already keeps it.
  A closed span simply needs both. This owns bar mode; 3b owns line mode, and the two do
  not overlap.
- **4b — the option is on and the target precedes the start.** It shelves with the reason
  every reversed span shelves with. An iteration is not exempt from the span rules; it is
  only exempt from being forced into a point.
- **5a — the write path is reached with the option off.** `placementEnds` answers
  `target` alone, so no start key is written and none is deleted. This is why the option
  is a `.base` setting and not UI state: the writer resolves it from settings, and
  `storage/` cannot reach the localStorage the working position lives in without breaking
  the layer rule.
- **5b — the option is on but only one date property is configured.** The end without a
  configured key is not writable and gets no grip, whatever the option says. The two
  questions are independent and both must pass: `drawsAsPoint` says which ends this
  **type** admits, `optionalKeyFor` says which the **configuration** can store, and
  `barHolds` already takes the intersection. This option widens the first and must never
  be read as widening the second.

## Acceptance criteria

- `drawsAsPoint` exists as its own predicate and is what the placement and drawing paths
  ask; `isMarkerType` keeps its structural meaning and its callers are unchanged.
- `iterationBars` is a view option in the `Iterations` group, saved on the view, and
  defaults to off — iterations draw as lines until the user says otherwise.
- With it off, an `Iteration` draws a boundary line and a diamond, and its start date is
  ignored rather than written or deleted.
- With it on, an `Iteration` draws a start→target bar, draws no boundary line, and obeys
  every ordinary span rule — the reversed-span shelving, and the open-ended bar a single
  date gives every other item.
- With it on, **each grip is on the bar wherever its own date property is configured**,
  which means `barHolds` asks the new predicate on its own line rather than keeping its
  `isMarkerType` branch. Both halves are load-bearing and they pull opposite ways. Without
  the first, `placementEnds` widens and that branch still returns a body hold, so the bar
  draws and nobody can resize it. Without the second, a base configured with a target
  property and no start property would offer a start grip whose drag writes an
  unconfigured key — which `barHolds` already refuses through `optionalKeyFor`, and which
  no new predicate may talk it out of. The type decides whether an end is *drawable*; the
  configuration decides whether it is *writable*; a grip needs both.
- Every path that places a date — the row's Schedule and Unschedule, the shelf drop, the
  body slide, both grips, and the writer — narrows by asking the predicate, never by
  restating it.
- Changing the option rewrites nothing on any note.
- **No surface calls an `Iteration` a milestone**, in either mode — checked at the three
  that do today: the marker lane's caption, the legend swatch, and `spanText`'s announced
  sentence. The last is asserted on the string a screen reader receives, not on the class
  drawn beside it.

## Where it lives

The predicate joins `src/domain/itemTypes.ts` beside `isMarkerType` and `placementEnds`,
which is where it has to be for `src/storage/frontmatter.ts` to reach it without the
layer rule being broken. `src/domain/bars.ts` asks it **twice** — once in `placeItem`,
which decides point or span, and once in `barHolds`, which decides what a gesture may
take hold of and now asks `drawsAsPoint` on its own line, the branch that used to read
`isMarkerType` instead. The drawing paths ask it in `src/view/render/timeline.ts` and
`src/view/render/milestoneLines.ts`. The option is declared in `src/domain/viewOptions.ts`,
typed and defaulted in `src/domain/settings.ts`, and resolved from the `.base` config in
`src/domain/settingsResolve.ts`. The callers that pass the settings through are
`src/view/interactions/timelineDrag.ts` and `src/view/interactions/plan.ts`.

A drawn hold becomes a grip in `src/view/render/lanes.ts` — `wireBarHolds`, one function a
bar row and a marker's own diamond both call, so a bar-mode iteration's stated ends get
exactly the grips `barHolds` named and nothing wires a second copy of that loop. None of
the above has an `Iteration` to ask about until the grid admits one, which happens first
in `src/domain/model.ts`: `BacklogModel.iterations`, a population parallel to `results`
rather than a wider version of it, read only where a grid axis (`drawsGrid`) asks for it.
`src/view/projection.ts`'s `projectionMember` takes that axis for the same reason, folded
into one `member` parameter by `src/view/rowVisibility.ts` to hold its five-parameter
budget; `src/view/filterState.ts` appends the same population to its own search index,
because that index walks from `model.roots` and a marker with no parent is never reached
by walking from one. The three surfaces this note opens by calling wrong are
`markerLaneCaption` in `src/domain/roadmap.ts`, read by `renderLaneHead` in
`src/view/render/lanes.ts` (which also hosts `spanText`), and the swatch in
`src/view/render/legend.ts`.

Driven in `test/domain/bars.test.ts` and `test/view/roadmap.test.ts` for the predicate and
the placement rules, `test/view/markerLabels.test.ts` for the three renamed surfaces, and
`test/view/iterationBars.test.ts` for bar mode's drawing and its write-narrowing.
