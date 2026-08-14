# Absences readable on the roadmap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a resource's unavailable stretch out-read the decoration behind it, key it in the legend, and put it on the same line as the work it crosses.

**Architecture:** Five independent increments over the existing resources axis. The mark's colour moves from the decoration palette to the text palette (CSS only). A `DrawnColors` field carries "a stretch drew" out of the render so the legend can key it. A per-work-row `.pbl-absence-wash` is prepended into each bar row's day track, positioned by the same `barGeometry` the mark uses, so the collision lands on the row the bar is in — no layout measurement, no `z-index`. A pure `crossedAbsences` in `domain/absences.ts` answers which bars cross which stretch, and the dependency-conflict shape (a lead glyph plus a `.pbl-sr-only` sentence) reports it. A header glyph qualifies the band count without changing what it counts.

**Tech Stack:** TypeScript, Obsidian Bases custom view API (1.12.0 floor), vitest + jsdom, plain CSS partials assembled by `scripts/styles-assemble.mjs`.

**Spec:** `docs/superpowers/specs/2026-08-14-absences-readable-on-the-roadmap-design.md`

## Global Constraints

- `npm run check` must pass — build + lint + coverage-thresholded tests + fallow + docs register. All five, on the final commit.
- Coverage thresholds in `vitest.config.mts` only ever rise, and the figure recorded is what the FINISHED increment measures — never one taken mid-flight. Current: statements 98.52, branches 94.83, functions 99.81, lines 99.6.
- `src/**` files cap at 400 lines (`max-lines`, skipping blanks and comments); `test/**` caps at 450. `max-lines-per-function` 100, `complexity` 16, `max-params` 5.
- Style partials cap at 400 lines and are what you edit — the root `styles.css` is generated and gitignored. `styles/lanes.css` is currently 195 lines.
- jsdom paints nothing: a colour, a layer order or a rendered width cannot be asserted by rendering. The established substitute is a text check over the stylesheet that refuses the shape that broke, each stating its own reach — see the four `describe` blocks in `test/view/timelineBoxing.test.ts`.
- UI text is sentence case (marketplace rule). Use `setCssProps`, never inline `style=`.
- Never write frontmatter outside `src/storage/frontmatter.ts`. Nothing in this plan writes anything.
- An invariant asserted in a comment gets a test that fails without it, and **the test is watched failing** — revert, run, see red, restore.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Another session shares this checkout. **Stage explicit paths** — never `git add docs/` or `git add -A`.

## File Structure

| File | Responsibility in this change |
| --- | --- |
| `styles/lanes.css` | The mark's palette and height; the new `.pbl-absence-wash`; the two new glyph rules. |
| `styles/legend.css` | `.pbl-legend-absence`, the hatch at a finer period. |
| `src/view/host.ts` | `DrawnColors.absence` — the render's report that a stretch drew. |
| `src/view/render/timeline.ts` | Sets that flag; hands each bar row's track and lead to the two new drawers. |
| `src/view/render/afterContent.ts` | The `DrawnColors` fallback literal gains the field (the compiler will demand it). |
| `src/view/render/legend.ts` | The `Unavailable` swatch. |
| `src/view/render/lanes.ts` | `renderAbsenceWash`, `noteAbsenceClash`, and the header's absence glyph. |
| `src/domain/absences.ts` | `crossedAbsences` — pure, the one place "does this bar cross a stretch" is answered. |
| `test/view/timelineBoxing.test.ts` | The stylesheet text checks. |
| `test/view/resourceAbsences.test.ts` | The wash, the clash mark, the header glyph. |
| `test/view/legend.test.ts` | The swatch, and that a collapsed band loses it. |
| `test/domain/absences.test.ts` | `crossedAbsences`. |

---

### Task 1: The mark reads as content, not decoration

**Files:**
- Modify: `styles/lanes.css` (the `.pbl-absence` rule, and the `.pbl-absence-row` dim rule below it)
- Test: `test/view/timelineBoxing.test.ts` (new `describe`, appended at the end of the file)

**Interfaces:**
- Consumes: nothing.
- Produces: `.pbl-absence` drawn from `--text-muted` at 14px. Task 2's swatch must name the same token; Task 1's `bodyOf`-based helpers are reused there.

**Context you need:** `styles/lanes.css` currently draws the stretch from `--background-modifier-border` — the same palette entry `.pbl-grid-line` (`styles/timelineFurniture.css`) uses and the same family `.pbl-weekend-layer` draws from (`--background-modifier-hover`). That is why it cannot out-read the shading behind it. `bodyOf(css, selector, file)` already exists at the top of `test/view/timelineBoxing.test.ts` and returns one rule's declarations by selector; it matches on `\n<selector> {`, so `.pbl-absence` will not collide with `.pbl-absence-row` or the `.pbl-absence-wash` Task 3 adds.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/timelineBoxing.test.ts`:

```ts
/**
 * The stretch a resource is away for is CONTENT, and it was drawn from the palette that
 * means decoration — `--background-modifier-border`, which is what `.pbl-grid-line` is made
 * of and the family `.pbl-weekend-layer` draws from. So it could not out-read the shading
 * behind it, which is exactly how it was reported: a light-mode vault at 382 results, three
 * stretches fainter than the weekend banding they sat on.
 *
 * Text checks, and their reach is exactly that: they read the tokens each rule names. They
 * cannot tell you what those tokens resolve to in a theme, nor measure the contrast between
 * them — that is the live-vault question `docs/tests/suites/Smoke test the roadmap.md`
 * carries.
 */
describe('the absence marks are drawn from the content palette', () => {
	const lanes = readFileSync(new URL('../../styles/lanes.css', import.meta.url), 'utf8');
	const timeline = readFileSync(new URL('../../styles/timeline.css', import.meta.url), 'utf8');

	/** Every custom property one rule names. */
	function tokens(css: string, selector: string, file: string): string[] {
		return [...bodyOf(css, selector, file).matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);
	}

	it('draws the stretch from a text token and never from the decoration palette', () => {
		const named = tokens(lanes, '.pbl-absence', 'styles/lanes.css');
		// The instrument's own check, and not a nicety: a pattern that matched nothing would
		// satisfy the refusal below for any stylesheet at all, including an empty one.
		expect(named.filter((token) => token.startsWith('--text-')), '.pbl-absence names no text token').not.toHaveLength(0);
		for (const token of named) {
			expect(token, `.pbl-absence draws from the decoration palette: ${token}`).not.toMatch(/^--background-modifier/);
		}
	});

	it('draws the stretch at the height a bar is drawn at', () => {
		// 12px against a bar's 14px was saying "lesser" as well as "different", and only the
		// second was intended: what tells work from the absence of work is the hatch.
		const height = (css: string, selector: string, file: string) => /height:\s*(\d+)px/.exec(bodyOf(css, selector, file))?.[1];
		const bar = height(timeline, '.pbl-bar', 'styles/timeline.css');
		expect(bar, '.pbl-bar states no height').toBeDefined();
		expect(height(lanes, '.pbl-absence', 'styles/lanes.css')).toBe(bar);
	});
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/view/timelineBoxing.test.ts -t "content palette"`

Expected: both FAIL — the first because `.pbl-absence` names `--background-modifier-border` and no `--text-*` token, the second because it states `height: 12px` against the bar's `14px`.

- [ ] **Step 3: Recolour and resize the mark**

In `styles/lanes.css`, replace the `.pbl-absence` rule and its comment with:

```css
/* An unavailable stretch. Hatched rather than filled, and never state-coloured: a bar is
   work somebody planned and this is the absence of any, so the two must not read alike at a
   glance — the same argument `.pbl-bar-inferred` makes for outlining a span the view derived
   rather than one a note stated. It carries no state colour, no grip and no connector,
   because none of those means anything here.

   **Drawn from a TEXT token, never from a `--background-modifier-*` one.** That second
   palette is what `.pbl-grid-line` is made of and the family `.pbl-weekend-layer` draws
   from, so a mark built out of it can never out-read the decoration it sits on. That is not
   a preference: it shipped, and was reported from a light-mode vault at 382 results as three
   stretches fainter than the weekend shading behind them. An absence is CONTENT. The muting
   this row still wants belongs to its LEAD, below.

   14px, matching `.pbl-bar`: 12px was saying "lesser" as well as "different" and only the
   second was intended. How the hatch reads against a themed background, and against a bar
   it overlaps, is a live-vault check. */
.pbl-absence {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	left: var(--pbl-bar-left);
	width: var(--pbl-bar-width);
	height: 14px;
	border-radius: var(--radius-s);
	border: 1px solid var(--text-muted);
	background-image: repeating-linear-gradient(
		45deg,
		var(--text-muted) 0,
		var(--text-muted) 4px,
		transparent 4px,
		transparent 8px
	);
}
```

- [ ] **Step 4: Stop dimming the mark this change strengthens**

Still in `styles/lanes.css`, the rule below it currently lists two selectors. Replace the whole rule (keeping its long comment, and adding the sentence about the mark) so that only the lead's content is dimmed:

```css
/* Muted like a context row, and for a related reason: the row is here to say what cannot be
   taken on, not to be read as part of the plan.

   The MARK is deliberately not in this list any more. It used to be, and it was dimming by a
   fifth the one thing on the row that has to be seen — muting the row's NAME says "this is
   furniture", muting the stretch says "this is faint", and only the first was meant.

   **On the row's CONTENT, never on the row.** `opacity` below 1 does two things to a row
   here and both are wrong: it makes the row's own sticky lead column TRANSLUCENT, so a
   scrolled-past today line and the gridlines beneath it show through the names; and it
   creates a stacking context, which takes the lead's `z-index: 2` out of the grid's layer
   order and drops the whole row beneath the full-height marks. Reported from a vault as
   "the things underneath the resources columns are shining through", with the today line
   running straight through three rows of names. The lead column is the one part of this
   grid that must stay opaque at every scroll position, and a rule that mutes a row is one
   `opacity` away from making it a window. */
.pbl-absence-row .pbl-timeline-lead > * {
	opacity: 0.8;
}
```

- [ ] **Step 5: Run the new tests and the ones that watch this rule**

Run: `npx vitest run test/view/timelineBoxing.test.ts test/view/resourceAbsences.test.ts`

Expected: PASS, including the existing "never dims a row that carries the sticky lead column" — its non-vacuous assertion names `.pbl-absence-row .pbl-timeline-lead > *`, which is still declared.

- [ ] **Step 6: Commit**

```bash
git add styles/lanes.css test/view/timelineBoxing.test.ts
git commit -m "$(cat <<'EOF'
Draw an absence from the content palette, not the decoration one

The stretch took its hatch and its border from `--background-modifier-border` —
the entry `.pbl-grid-line` is made of and the family `.pbl-weekend-layer` draws
from — so it could not out-read the shading behind it. Reported from a light
vault at 382 results as fainter than the weekend banding. It is content, so it
is drawn from a text token, at the height a bar is drawn at, and the row's own
muting stays on the lead where it was meant.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The legend keys the hatch

**Files:**
- Modify: `src/view/host.ts` (the `DrawnColors` interface), `src/view/render/timeline.ts` (`drawEntries`, and the `drawn` literal in `renderTimeline`), `src/view/render/afterContent.ts` (the fallback literal), `src/view/render/legend.ts` (`renderLegend`), `styles/legend.css`
- Test: `test/view/legend.test.ts`, `test/view/timelineBoxing.test.ts`

**Interfaces:**
- Consumes: `.pbl-absence`'s `--text-muted` from Task 1.
- Produces: `DrawnColors.absence: boolean`. Nothing later depends on it.

**Context you need:** `renderLegend` (`src/view/render/legend.ts`) keys only what the grid actually DREW, reported through `DrawnColors` rather than derived from the model — its preamble records three defects that came from asking `results` instead. That rule is why this cannot be `roadmap.lanes.some(...)`: `laneEntries` skips a collapsed band whole, so an absence in a folded band is not on screen. `syncAfterContent` re-renders the legend on every content render, and `setLaneCollapsed` triggers exactly that, which is what makes the collapsed-band assertion below reachable.

- [ ] **Step 1: Write the failing view test**

In `test/view/legend.test.ts`, inside the existing `describe('the roadmap legend', ...)`:

```ts
	it('keys the hatch where a stretch drew, and loses it when the band folds shut', () => {
		// The rule every swatch here keeps, asked of the one mark that is not a colour: the
		// report comes off the RENDER, so a band folded shut draws no stretch and the key has
		// to lose the entry with it. A predicate over `roadmap.lanes` would go on claiming a
		// mark nothing on screen makes — the mistake the done and milestone swatches each
		// made once.
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
		});
		vault.addFile('Alice away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2026-08-04', due: '2026-08-06' },
		});
		const { view, containerEl } = makeView(
			vault,
			{ ...DATE_AXIS, assigneeProperty: 'note.assignee', resourceNames: 'Alice' },
			{ collapsed: true },
		);
		view.setProjection('roadmap');

		// The plain dated axis draws bars and no stretch at all, so it keys none.
		view.setAxisPick('dates');
		expect(swatchLabels(containerEl)).not.toContain('Unavailable');

		view.setAxisPick('resources');
		expect(swatchLabels(containerEl)).toContain('Unavailable');

		view.setLaneCollapsed('Alice', true);
		expect(swatchLabels(containerEl)).not.toContain('Unavailable');
	});
```

- [ ] **Step 2: Write the failing stylesheet test**

In `test/view/timelineBoxing.test.ts`, inside the `describe('the absence marks are drawn from the content palette', ...)` added in Task 1:

```ts
	it('keys the hatch in the colour the stretch draws it in', () => {
		// The strip's whole subject is that a swatch cannot say a colour the mark does not
		// draw. The three pairs above check that for the marks whose colour is a `--color-*`
		// palette entry; the hatch names a text token instead, so it needs this pairing rather
		// than that helper. The PERIOD is deliberately not compared — see `.pbl-legend-absence`.
		const legend = readFileSync(new URL('../../styles/legend.css', import.meta.url), 'utf8');
		const inked = (css: string, selector: string, file: string) => tokens(css, selector, file).filter((t) => t.startsWith('--text-'))[0];
		const mark = inked(lanes, '.pbl-absence', 'styles/lanes.css');
		expect(mark, '.pbl-absence names no text token').toBeDefined();
		expect(inked(legend, '.pbl-legend-absence', 'styles/legend.css')).toBe(mark);
	});
```

- [ ] **Step 3: Run both and watch them fail**

Run: `npx vitest run test/view/legend.test.ts -t "keys the hatch" && npx vitest run test/view/timelineBoxing.test.ts -t "keys the hatch"`

Expected: the view test FAILS on the first `toContain('Unavailable')`; the stylesheet test FAILS with `no rule for .pbl-legend-absence in styles/legend.css`.

- [ ] **Step 4: Report the mark out of the render**

In `src/view/host.ts`, add to `DrawnColors` after `accent`:

```ts
	/**
	 * An unavailable stretch drew somewhere on this grid (`.pbl-absence`) — the resources
	 * axis only, since it is the only axis whose entry list holds one.
	 *
	 * Not a colour override like the three above, and the interface is wider than its name
	 * because of it: what this reports is which MARKS a pass drew that the key has to
	 * explain, and a hatch is one. Reported from the render for the same reason the others
	 * are — `laneEntries` skips a collapsed band whole, so a predicate over `roadmap.lanes`
	 * would key a stretch nothing on screen draws.
	 */
	absence: boolean;
```

In `src/view/render/timeline.ts`, `renderTimeline`'s `drawn` literal gains the field:

```ts
	const drawn: DrawnColors = { done: false, milestone: milestoneLines, accent: false, absence: false };
```

and `drawEntries`' absence branch sets it:

```ts
		if (entry.kind === 'absence') {
			// The legend keys what the grid DREW, and this is the one place a stretch is drawn.
			drawn.absence = true;
			inBand(renderLaneAbsence(ctx, mounts.content, entry.absence, { window, scale }));
			continue;
		}
```

In `src/view/render/afterContent.ts`, the fallback literal (the compiler will already be demanding this):

```ts
	const drawn = host.roadmap?.drawn ?? { done: false, milestone: false, accent: false, absence: false };
```

- [ ] **Step 5: Add the swatch**

In `src/view/render/legend.ts`, immediately after the milestone swatch in `renderLegend`:

```ts
	if (drawn.milestone) addSwatch(legendEl, 'pbl-legend-milestone', 'Milestone');
	// The hatch, on the same rule and reported the same way: `drawn.absence` is the render's
	// own word for "a stretch drew here", so this appears exactly where the mark does — on
	// the resources axis, and not for a band the reader has folded shut.
	if (drawn.absence) addSwatch(legendEl, 'pbl-legend-absence', 'Unavailable');
```

In `styles/legend.css`, append after `.pbl-legend-other`:

```css
/* The hatch `.pbl-absence` draws (`styles/lanes.css`), in the same colour token — checked as
   one fact in `test/view/timelineBoxing.test.ts` — and at a FINER period, which is this
   element's own business rather than a drift: one 4px stripe inside a 10px square reads as
   half-filled, not as hatch, so the period is halved.

   ORDER IS BEHAVIOUR here as it is for the four rules above: this sets a background-IMAGE
   over `.pbl-legend-swatch`'s background-color, which resolves to nothing on a swatch
   carrying no slot class. `transparent` is stated rather than left to that, so the square is
   the hatch and its border and nothing else. */
.pbl-legend-absence {
	background-color: transparent;
	border: 1px solid var(--text-muted);
	background-image: repeating-linear-gradient(
		45deg,
		var(--text-muted) 0,
		var(--text-muted) 2px,
		transparent 2px,
		transparent 4px
	);
}
```

- [ ] **Step 6: Run both suites**

Run: `npx vitest run test/view/legend.test.ts test/view/timelineBoxing.test.ts test/view/resourceAbsences.test.ts`

Expected: PASS, all three files.

- [ ] **Step 7: Commit**

```bash
git add src/view/host.ts src/view/render/timeline.ts src/view/render/afterContent.ts src/view/render/legend.ts styles/legend.css test/view/legend.test.ts test/view/timelineBoxing.test.ts
git commit -m "$(cat <<'EOF'
Key the absence hatch in the legend

Nothing keyed the hatch, so a reader who had not used the feature had no way to
learn what it is. The swatch is gated on the render's own report rather than on
the model, which is what makes it appear exactly where the mark does: a folded
band draws no stretch and loses the entry with it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The wash — the stretch on the row the bar is in

**Files:**
- Modify: `src/view/render/lanes.ts` (new `renderAbsenceWash`), `src/view/render/timeline.ts` (`renderBarRow`'s return, `drawEntries`' row branch), `styles/lanes.css`
- Test: `test/view/resourceAbsences.test.ts`, `test/view/timelineBoxing.test.ts`

**Interfaces:**
- Consumes: `Absence` (`src/domain/absences.ts`), `barGeometry` / `MIN_BAR_PX` / `TimelineWindow` / `TimelineScale` (`src/domain/timeline.ts`) — all already imported by `lanes.ts`.
- Produces:
  - `renderAbsenceWash(track: HTMLElement, absences: Absence[], ruler: { window: TimelineWindow; scale: TimelineScale }): void` in `src/view/render/lanes.ts`.
  - `renderBarRow` in `src/view/render/timeline.ts` returns `{ row: HTMLElement; colors: DrawnColors; lead: HTMLElement; track: HTMLElement }`. Task 4 consumes `lead`.

**Context you need:** Read `drawEntries` in `src/view/render/timeline.ts` before editing — it holds the band's current `lane` in a mutable local, which is what makes "this row is in that band" answerable without a container element. `mounts.tracks` maps a path to its track, but the plan threads the track out of `renderBarRow` instead, which avoids a lookup and a null guard for an element that pass just created. `barGeometry` CLAMPS a span reaching past the window and reports `outside` when nothing of it is in view — that flag is why the wash has an early `continue`.

- [ ] **Step 1: Write the failing view tests**

In `test/view/resourceAbsences.test.ts`, add to the `describe('an absence on the resources axis', ...)` block. `rowFor` comes from `../helpers/roadmap` — add it to that import:

```ts
	it('shades the same days across the band’s work rows, behind the bars', () => {
		// The feature's own user story is "a row I am about to drop work into already shows
		// the days nobody should be scheduled across", and with the stretch on a line of its
		// own the collision was the hardest thing on the band to see. The named line above is
		// still where the title, the dates and the menu live; this is the same fact where the
		// collision happens.
		const { containerEl } = laneRoadmap(absenceVault());
		const mark = containerEl.querySelector<HTMLElement>('.pbl-absence');
		const work = rowFor(containerEl, 'Work');
		const washes = Array.from(work?.querySelectorAll<HTMLElement>('.pbl-absence-wash') ?? []);
		expect(washes).toHaveLength(1);

		// The same arithmetic as the mark, so the shading and the stretch cannot disagree
		// about which day is which.
		expect(washes[0].style.getPropertyValue('--pbl-bar-left')).toBe(mark?.style.getPropertyValue('--pbl-bar-left'));
		expect(washes[0].style.getPropertyValue('--pbl-bar-width')).toBe(mark?.style.getPropertyValue('--pbl-bar-width'));

		// UNDER the bar, and by document order alone — no `z-index` anywhere, which is the
		// whole layer story (see `renderAbsenceWash`). First child of the track it is in.
		const track = washes[0].parentElement;
		expect(Array.from(track?.children ?? []).indexOf(washes[0])).toBe(0);
		expect(track?.querySelector('.pbl-bar')).not.toBeNull();
	});

	it('shades no line that makes no positional claim, and no band on the dated axis', () => {
		// Three exclusions, each with its own reason: the stretch's own row already carries
		// the mark; a context row draws no bar at all by recorded decision, so shading days
		// inside it would be its one positional statement; and the dated axis has no band to
		// be a member of.
		const vault = absenceVault();
		vault.addFile('Outside.md', { frontmatter: { type: 'Epic', order: 20, assignee: 'Alice' } });
		vault.addFile('Inside.md', {
			frontmatter: { type: 'Feature', order: 10, assignee: 'Alice', start: '2026-08-02', due: '2026-08-03' },
			parentLink: 'Outside',
		});
		const harness = laneRoadmap(vault, { base: 'file.name != "Outside"' });

		expect(harness.containerEl.querySelector('.pbl-absence-row .pbl-absence-wash')).toBeNull();
		expect(harness.containerEl.querySelector('.pbl-lane-context .pbl-absence-wash')).toBeNull();

		harness.view.setAxisPick('dates');
		expect(harness.containerEl.querySelectorAll('.pbl-absence-wash')).toHaveLength(0);
	});

	it('shades nothing for a stretch the window cannot reach', () => {
		// `barGeometry` CLAMPS, so a stretch lying wholly past an edge would shade days it
		// does not cover — `docs/bugs/An absence drew at the edge of a window it never
		// widened.md` reached from the other side. The MARK can say "past this edge" because
		// `.pbl-bar-outside` is a direction rather than a span; a shaded column of days has no
		// such vocabulary, so it draws nothing at all.
		const vault = absenceVault();
		vault.addFile('Far away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2031-01-04', due: '2031-01-20' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(containerEl.querySelectorAll('.pbl-absence.pbl-bar-outside')).toHaveLength(1);
		// One wash for the in-window stretch, and none for the clamped one.
		expect(containerEl.querySelectorAll('.pbl-absence-wash')).toHaveLength(1);
	});
```

Before writing the second test, check how the existing file opens a base with a filter — if `laneRoadmap`'s options object has no `base` passthrough, add one the way `roadmapView` in `test/helpers/roadmap.ts` does, or reuse whichever fixture in `test/view/resourceLanes.test.ts` already produces a `.pbl-lane-context` row and copy its construction verbatim. **Do not invent a filter spelling** — read the working one.

- [ ] **Step 2: Write the failing stylesheet test**

In `test/view/timelineBoxing.test.ts`, in the absence `describe`:

```ts
	it('lets the pointer through the shading, rather than taking the drop the row is the target for', () => {
		// On this axis each ELEMENT of a band is the drop target (`laneElement` in
		// `src/view/render/timeline.ts`) — there is no container to wire — so a child of a row
		// that intercepts the pointer is `docs/bugs/An absence stretch is a dead spot in its
		// own band.md` reached from inside the row. Every other absolutely positioned
		// decoration on this grid opts out the same way.
		expect(bodyOf(lanes, '.pbl-absence-wash', 'styles/lanes.css')).toContain('pointer-events: none;');
	});

	it('gives the shading no layer of its own', () => {
		// It sits under the bar by document order — prepended into the track — which is the
		// sandwich `styles/dependencyArrows.css` records. A `z-index` here, or on `.pbl-bar`
		// to lift it instead, competes with the sticky lead column at 2.
		expect(bodyOf(lanes, '.pbl-absence-wash', 'styles/lanes.css')).not.toContain('z-index');
	});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run test/view/resourceAbsences.test.ts test/view/timelineBoxing.test.ts`

Expected: the three view tests FAIL (no `.pbl-absence-wash` renders), and the two stylesheet ones FAIL with `no rule for .pbl-absence-wash in styles/lanes.css`.

- [ ] **Step 4: Write the drawer**

In `src/view/render/lanes.ts`, add after `renderLaneAbsence`:

```ts
/**
 * The days one resource is unavailable, shaded across a WORK row of their own band — behind
 * the bars, so a bar and the stretch it crosses are read on one line rather than two. The
 * band's own named line (`renderLaneAbsence`) still leads it and is where the title, the
 * dates and the menu live; this is the same fact where the collision actually happens, which
 * is what this feature's user story asks for and what a line of its own could not give.
 *
 * `barGeometry` against the same window the mark is placed against, so the shading and the
 * stretch cannot disagree about which day is which.
 *
 * **PREPENDED into the track, and that is the whole layer story.** Appended after the bar it
 * paints over it, and giving `.pbl-bar` a `z-index` to lift it instead is the trap
 * `styles/dependencyArrows.css` records: the track is `position: relative` with
 * `z-index: auto` and so establishes no stacking context, so a layer on the bar would
 * compete with the sticky lead column at 2. Document order decides it, exactly as it decides
 * the arrow layer's sandwich.
 *
 * `track.prepend` rather than `createDiv({ prepend: true })`: Obsidian's `DomElementInfo`
 * does carry that option and `test/helpers/dom.ts` does not implement it, so the option would
 * append in the suite and prepend in a vault — the test asserting this sits under the bar
 * would fail here while the vault was right. The faithful-fake hazard `test/CLAUDE.md`
 * records for `createSvg`, reached from the kinder direction; the native call has no fake
 * surface at all.
 *
 * A stretch wholly outside the window draws nothing. `barGeometry` CLAMPS one, so shading it
 * would colour days it does not cover — the mark can say "past this edge" because
 * `.pbl-bar-outside` is a direction rather than a span, and a column of shaded days has no
 * way to say that.
 */
export function renderAbsenceWash(
	track: HTMLElement,
	absences: Absence[],
	ruler: { window: TimelineWindow; scale: TimelineScale },
): void {
	for (const absence of absences) {
		const geometry = barGeometry(ruler.window, { start: absence.start, target: absence.target });
		if (geometry.outside) continue;
		const wash = track.createDiv({ cls: 'pbl-absence-wash', attr: { 'aria-hidden': 'true' } });
		wash.setCssProps({
			'--pbl-bar-left': `${geometry.startDay * ruler.scale.dayPx}px`,
			'--pbl-bar-width': `${Math.max(geometry.spanDays * ruler.scale.dayPx, MIN_BAR_PX)}px`,
		});
		track.prepend(wash);
	}
}
```

- [ ] **Step 5: Hand the track out of the bar row, and draw the wash from the entry walk**

In `src/view/render/timeline.ts`, widen `renderBarRow`'s return type in its signature and its final statement:

```ts
function renderBarRow(
	ctx: RowContext,
	mounts: BarRowMounts,
	window: TimelineWindow,
	entry: TimelineRow,
	scale: TimelineScale,
): { row: HTMLElement; colors: DrawnColors; lead: HTMLElement; track: HTMLElement } {
```

```ts
	return { row, colors, lead, track };
```

(`lead` and `track` are already locals in that function. `reportColors` keeps its narrower parameter type and accepts the wider object unchanged — it is not a fresh object literal at the call site.)

Then replace the row branch of `drawEntries` with:

```ts
		let row: HTMLElement;
		if (entry.kind === 'context') {
			row = renderLaneContextRow(ctx, mounts.content, entry.item);
		} else {
			const bar = renderBarRow(ctx, mounts, window, entry.row, scale);
			row = reportColors(bar, drawn);
			// The band's unavailable days, shaded behind this row's own bar. A WORK row only:
			// the stretch's own line already carries the mark, a context row makes no
			// positional claim at all, and on the dated axis `lane` is null because there is
			// no band to be a member of.
			if (lane) renderAbsenceWash(bar.track, lane.absences, { window, scale });
		}
		inBand(row);
		// Assigned at render because CSS has no nth-of-class, and nth-child would
		// count the header, the lines and the layers interleaved in this container.
		if (drawnRows % 2 === 1) row.addClass('pbl-row-even');
		drawnRows++;
```

Add `renderAbsenceWash` to the existing `./lanes` import list at the top of the file.

- [ ] **Step 6: Style it**

In `styles/lanes.css`, append after the `.pbl-absence-row` rules:

```css
/* The same unavailable days, shaded across the WORK rows of the band — behind the bars, so a
   bar and the stretch it crosses are read on one line. A different token from the weekend
   layer's `--background-modifier-hover`, and stronger, because being told apart from the
   weekend banding at a glance is the whole of what was reported.

   `pointer-events: none` is load-bearing rather than housekeeping: on this axis each ELEMENT
   of a band is the drop target (`laneElement` in `src/view/render/timeline.ts`), since a band
   has no container to wire — so a child of a row intercepting the pointer is
   `docs/bugs/An absence stretch is a dead spot in its own band.md` reached from inside the
   row.

   NO `z-index`. It sits under the bar by being prepended into the track — see
   `renderAbsenceWash` — and `styles/dependencyArrows.css` says why a layer on `.pbl-bar` is
   not the alternative it looks like: the bar would then out-rank the sticky lead column at 2.

   The 18% is the tuning knob and nothing in this repository can settle it — jsdom paints
   nothing and the browser harness draws Obsidian's DEFAULT colours, so whether this
   out-reads a themed vault's weekend banding is a live-vault check. */
.pbl-absence-wash {
	position: absolute;
	top: 0;
	bottom: 0;
	left: var(--pbl-bar-left);
	width: var(--pbl-bar-width);
	background-color: color-mix(in srgb, var(--text-muted) 18%, transparent);
	pointer-events: none;
}
```

- [ ] **Step 7: Run the suites, then the whole view directory**

Run: `npx vitest run test/view/resourceAbsences.test.ts test/view/timelineBoxing.test.ts`
Then: `npx vitest run test/view`

Expected: PASS. If `test/view/contextCardWrites.test.ts` or `test/view/resourceLanes.test.ts` fail, read the failure before changing anything — the drop-target wiring per band element is what those cover, and a wash that took pointer events is exactly what they should catch.

- [ ] **Step 8: Watch the pointer rule fail**

Delete `pointer-events: none;` from `.pbl-absence-wash`, run `npx vitest run test/view/timelineBoxing.test.ts -t "lets the pointer through"`, confirm RED, then restore it and confirm green. Do the same for the `outside` guard: comment out `if (geometry.outside) continue;`, run `npx vitest run test/view/resourceAbsences.test.ts -t "window cannot reach"`, confirm RED, restore.

- [ ] **Step 9: Commit**

```bash
git add src/view/render/lanes.ts src/view/render/timeline.ts styles/lanes.css test/view/resourceAbsences.test.ts test/view/timelineBoxing.test.ts
git commit -m "$(cat <<'EOF'
Shade a resource's unavailable days across the work they cross

An absence had a line of its own at the top of the band, so the stretch and the
bar crossing it were never on the same line — which made the collision this
feature exists to show the hardest thing on the band to see. The named line
stays as the surface carrying the title, the dates and the menu; the same days
are now shaded behind the bars of that band's work rows.

Prepended into each track rather than layered: the track establishes no
stacking context, so a `z-index` on the bar would compete with the sticky lead
column. A stretch outside the drawn window shades nothing, since a clamped
column of days cannot say "past this edge" the way the mark can.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: The bar says it crosses an absence

**Files:**
- Modify: `src/domain/absences.ts` (new `crossedAbsences`), `src/view/render/lanes.ts` (new `noteAbsenceClash`), `src/view/render/timeline.ts` (`drawEntries`' row branch), `styles/lanes.css`
- Test: `test/domain/absences.test.ts`, `test/view/resourceAbsences.test.ts`

**Interfaces:**
- Consumes: `renderBarRow`'s `lead` from Task 3; `Absence` and `DateSpan`.
- Produces:
  - `crossedAbsences(span: DateSpan, absences: Absence[]): Absence[]` in `src/domain/absences.ts`.
  - `noteAbsenceClash(row: HTMLElement, lead: HTMLElement, crossed: Absence[]): void` in `src/view/render/lanes.ts`.

**Context you need:** The shape being reused is the dependency conflict's — read `renderRowFacts` in `src/view/render/timeline.ts` and `.pbl-timeline-dependency-flag` in `styles/dependencyArrows.css`, including its comment about why the glyph is pinned to the lead's right edge rather than left to flow after the title. `spanText` in `timeline.ts` shows the house idiom for "`deriveBars` admits no fully dateless span" — a cast with that sentence beside it, not a branch. `formatCivil` renders `2026-08-04`.

- [ ] **Step 1: Write the failing domain test**

In `test/domain/absences.test.ts`, append:

```ts
describe('a bar scheduled across an absence', () => {
	function civil(text: string): CivilDate {
		const read = readDate(text).value;
		if (read === null) throw new Error(`not a date: ${text}`);
		return read;
	}

	function away(title: string, start: string, target: string): Absence {
		return { file: {} as TFile, title, resource: 'Alice', start: civil(start), target: civil(target) };
	}

	const AUGUST = away('Alice away', '2026-08-04', '2026-08-06');

	it('crosses a stretch its span runs through', () => {
		const span = { start: civil('2026-08-01'), target: civil('2026-08-10') };
		expect(crossedAbsences(span, [AUGUST]).map((one) => one.title)).toEqual(['Alice away']);
	});

	it('counts a shared boundary day as a crossing', () => {
		// Inclusive at both ends: a bar ending on the first day of an absence IS scheduled
		// across a day nobody should be scheduled across.
		expect(crossedAbsences({ start: civil('2026-07-20'), target: civil('2026-08-04') }, [AUGUST])).toHaveLength(1);
		expect(crossedAbsences({ start: civil('2026-08-06'), target: civil('2026-08-20') }, [AUGUST])).toHaveLength(1);
	});

	it('clears a span that ends before or begins after the stretch', () => {
		expect(crossedAbsences({ start: civil('2026-07-01'), target: civil('2026-08-03') }, [AUGUST])).toEqual([]);
		expect(crossedAbsences({ start: civil('2026-08-07'), target: civil('2026-08-20') }, [AUGUST])).toEqual([]);
	});

	it('judges a one-ended bar at the single day it draws', () => {
		// The days the bar DRAWS, which is `barGeometry`'s own borrowing — a backlog stating
		// targets and no starts is the ordinary case here, and treating the missing end as
		// unbounded would report a crossing on every stretch behind it.
		expect(crossedAbsences({ start: null, target: civil('2026-08-05') }, [AUGUST])).toHaveLength(1);
		expect(crossedAbsences({ start: null, target: civil('2026-08-20') }, [AUGUST])).toEqual([]);
		expect(crossedAbsences({ start: civil('2026-08-05'), target: null }, [AUGUST])).toHaveLength(1);
		expect(crossedAbsences({ start: civil('2026-07-01'), target: null }, [AUGUST])).toEqual([]);
	});

	it('returns only the stretches crossed, in the order given', () => {
		const july = away('Earlier', '2026-07-01', '2026-07-03');
		const later = away('Later', '2026-08-05', '2026-08-09');
		const crossed = crossedAbsences({ start: civil('2026-08-01'), target: civil('2026-08-10') }, [july, AUGUST, later]);
		expect(crossed.map((one) => one.title)).toEqual(['Alice away', 'Later']);
	});

	it('crosses nothing when the resource has no stretches', () => {
		expect(crossedAbsences({ start: civil('2026-08-01'), target: civil('2026-08-10') }, [])).toEqual([]);
	});
});
```

Add to that file's imports: `TFile` from `obsidian`, `CivilDate` and `readDate` from `../../src/domain/noteFields`, and `Absence` / `crossedAbsences` alongside the existing `absencesConfigured` import.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/domain/absences.test.ts`

Expected: FAIL — `crossedAbsences` is not exported.

- [ ] **Step 3: Write the predicate**

In `src/domain/absences.ts`, append (and add `DateSpan` and `daysBetween` to the existing `./timeline` import):

```ts
/**
 * Which of these stretches a span actually crosses — the fact behind the mark a bar carries
 * when it is scheduled over days nobody should be scheduled across.
 *
 * Judged on the days the bar DRAWS: `start ?? target` … `target ?? start`, which is
 * `barGeometry`'s own borrowing. So a one-ended bar is judged at the single day it renders
 * rather than treated as unbounded in the direction it has no date for — and a backlog
 * stating targets and no starts is the ordinary case here rather than an edge one, so that
 * reading would report a crossing on nearly every stretch behind it.
 *
 * From DATES, never from geometry, so a crossing outside the drawn window still marks its
 * row: `dependencyArrows`' own rule read again — the row is where the fact lives, and a
 * window-derived mark would narrow it to wherever the reader happens to be scrolled.
 *
 * Inclusive at both boundary days: a bar ending on an absence's first day is scheduled across
 * it.
 */
export function crossedAbsences(span: DateSpan, absences: Absence[]): Absence[] {
	// `deriveBars` admits no fully dateless span, the same fact `spanText` leans on.
	const start = (span.start ?? span.target) as CivilDate;
	const end = (span.target ?? span.start) as CivilDate;
	return absences.filter((absence) => daysBetween(start, absence.target) >= 0 && daysBetween(absence.start, end) >= 0);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run test/domain/absences.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing view test**

In `test/view/resourceAbsences.test.ts`:

```ts
	it('marks the bar it crosses, in words as well as in shading', () => {
		// The wash tells this in colour alone, which WCAG 1.4.1 refuses and which a screen
		// reader gets nothing of — so the row carries the sentence, and the lead carries the
		// glyph a sighted reader can scan a column of. The dependency conflict's own shape.
		const { containerEl } = laneRoadmap(absenceVault());
		const work = rowFor(containerEl, 'Work');
		const said = Array.from(work?.querySelectorAll<HTMLElement>('.pbl-sr-only') ?? [])
			.map((span) => span.textContent ?? '')
			.filter((text) => text.startsWith('Crosses'));

		expect(said).toEqual(['Crosses an absence: Alice away 2026-08-04 → 2026-08-06']);
		const flag = work?.querySelector<HTMLElement>('.pbl-timeline-lead .pbl-away-flag');
		expect(flag).not.toBeNull();
		expect(flag?.dataset.tooltip).toBe('Crosses an absence: Alice away 2026-08-04 → 2026-08-06');
	});

	it('leaves a bar that clears the stretch unmarked', () => {
		const vault = absenceVault();
		vault.addFile('Clear.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Alice', start: '2026-08-07', due: '2026-08-09' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(rowFor(containerEl, 'Clear')?.querySelector('.pbl-away-flag')).toBeNull();
		expect(rowFor(containerEl, 'Work')?.querySelector('.pbl-away-flag')).not.toBeNull();
	});

	it('marks a crossing the drawn window cannot show', () => {
		// Computed from DATES, not geometry — the dependency conflict's rule read again: the
		// row is where the fact lives, so a mark derived from the window would come and go
		// with the reader's scroll position and the zoom.
		const vault = new FakeVault();
		vault.addFile('Far work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2031-01-01', due: '2031-01-31' },
		});
		vault.addFile('Near work.md', {
			frontmatter: { type: 'Epic', order: 20, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
		});
		vault.addFile('Far away.md', {
			frontmatter: { type: 'Absence', assignee: 'Alice', start: '2031-01-04', due: '2031-01-20' },
		});
		const { containerEl } = laneRoadmap(vault);

		// The stretch itself is clamped out of the window and shades nothing …
		expect(containerEl.querySelectorAll('.pbl-absence-wash')).toHaveLength(0);
		// … and its row still says the crossing.
		expect(rowFor(containerEl, 'Far work')?.querySelector('.pbl-away-flag')).not.toBeNull();
		expect(rowFor(containerEl, 'Near work')?.querySelector('.pbl-away-flag')).toBeNull();
	});
```

Check the third test's assumption before trusting the numbers: the existing "draws at the window's edge" tests in this file establish which date pairs land outside `MAX_TIMELINE_DAYS`. If `Far work`'s own bar is clamped `outside` too, the `.pbl-absence-wash` count still holds; if the window comes out wider than expected, take the dates from the existing outside-window test rather than inventing new ones.

- [ ] **Step 6: Run it and watch it fail**

Run: `npx vitest run test/view/resourceAbsences.test.ts -t "crosses"`

Expected: FAIL — no `.pbl-away-flag` and no `Crosses …` span.

- [ ] **Step 7: Write the reporter**

In `src/view/render/lanes.ts`, after `renderAbsenceWash`:

```ts
/**
 * The mark a bar carries when it is scheduled across days its own resource is away — the
 * dependency conflict's SHAPE reused rather than reinvented: a glyph in the lead, where a
 * column of them is scannable, and the words it stands for in the row's own content.
 *
 * The sentence is not a nicety. The wash behind the bar tells this in colour alone, which
 * WCAG 1.4.1 refuses and which a screen reader gets nothing of at all. `.pbl-sr-only`
 * CONTENT rather than an `aria-label`, for `stateNote`'s reason: a label REPLACES the name
 * the row derives from its badge, its title and its bar's dates.
 *
 * No row-level class beside `.pbl-row-conflict`. That one exists because a broken dependency
 * draws nothing else anywhere; here the wash is already on this very row, so a second accent
 * would restate what the reader is looking at. Add one when someone can say what it buys.
 *
 * The tooltip goes on the GLYPH, not on the lead, which already tooltips the row's title.
 */
export function noteAbsenceClash(row: HTMLElement, lead: HTMLElement, crossed: Absence[]): void {
	if (crossed.length === 0) return;
	const spans = crossed.map((one) => `${one.title} ${formatCivil(one.start)} → ${formatCivil(one.target)}`).join('; ');
	const said = `Crosses ${crossed.length === 1 ? 'an absence' : `${crossed.length} absences`}: ${spans}`;
	row.createSpan({ cls: 'pbl-sr-only', text: said });
	const flag = lead.createSpan({ cls: 'pbl-away-flag', attr: { 'aria-hidden': 'true' } });
	drawIcon(flag, 'user-x');
	setTooltip(flag, said);
}
```

In `src/view/render/timeline.ts`, extend the row branch of `drawEntries` (add `noteAbsenceClash` to the `./lanes` import and `crossedAbsences` to a `../../domain/absences` import):

```ts
			if (lane) {
				renderAbsenceWash(bar.track, lane.absences, { window, scale });
				noteAbsenceClash(bar.row, bar.lead, crossedAbsences(entry.row.bar.span, lane.absences));
			}
```

- [ ] **Step 8: Style the glyph**

In `styles/lanes.css`, append:

```css
/* The glyph a bar's own row carries when it is scheduled across days its resource is away —
   `noteAbsenceClash`. Pinned to the lead's RIGHT edge like `.pbl-timeline-dependency-flag`
   and for that rule's own reason: left to flow after the title it quietly narrows the column
   it sits in, and against the right edge a column of flagged rows lands in one x. Both flags
   can appear on one row and sit side by side there. Muted rather than a warning colour: a
   plan crossing an absence is a fact to see, not an error to fix. */
.pbl-away-flag {
	display: inline-flex;
	align-items: center;
	flex: 0 0 auto;
	margin-left: auto;
	margin-right: var(--size-4-1);
	color: var(--text-muted);
}

.pbl-away-flag .svg-icon {
	width: var(--icon-s);
	height: var(--icon-s);
}
```

- [ ] **Step 9: Run everything touched, then watch the sentence fail**

Run: `npx vitest run test/domain/absences.test.ts test/view/resourceAbsences.test.ts test/view`

Then comment out the `row.createSpan(...)` line in `noteAbsenceClash`, run
`npx vitest run test/view/resourceAbsences.test.ts -t "in words as well as"`, confirm RED, restore it and confirm green.

- [ ] **Step 10: Commit**

```bash
git add src/domain/absences.ts src/view/render/lanes.ts src/view/render/timeline.ts styles/lanes.css test/domain/absences.test.ts test/view/resourceAbsences.test.ts
git commit -m "$(cat <<'EOF'
Say when a bar is scheduled across its resource's absence

Nothing marked it, so with the shading in place the collision was told in
colour alone — which WCAG 1.4.1 refuses and a screen reader gets nothing of.
The dependency conflict's shape reused: a glyph in the lead and the words it
stands for in the row's content.

`crossedAbsences` judges the overlap on the days the bar DRAWS, so a one-ended
bar is judged at its single rendered day rather than treated as unbounded, and
it reads dates rather than geometry, so a crossing off the drawn window still
marks its row.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: A band whose only content is an absence stops reading empty

**Files:**
- Modify: `src/view/render/lanes.ts` (`renderLaneHead`), `styles/lanes.css`
- Test: `test/view/resourceAbsences.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks except the `.pbl-away-flag` icon-sizing idiom.
- Produces: `.pbl-lane-away` on a header whose band holds any absence.

**Context you need:** `renderLaneHead` in `src/view/render/lanes.ts` draws the lead as name, count, stray marker, then the Add absence button. The count is `lane.bars.length` — RESULT bars, the rule a bucket's count already keeps — and `test/view/resourceAbsences.test.ts`'s "counts for nothing on the header" asserts exactly that. **Do not change what the count counts**; that test's stated rule stays as it is.

- [ ] **Step 1: Write the failing test**

In `test/view/resourceAbsences.test.ts`:

```ts
	it('says the band holds a stretch, without changing what the count counts', () => {
		// The count stays RESULT bars — the rule a bucket's count already keeps — which left a
		// band whose only content is an absence reading "0" beside a row that plainly has
		// something in it. The glyph qualifies the number rather than changing it.
		const vault = absenceVault();
		vault.addFile('Bob away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: '2026-08-04', due: '2026-08-06' },
		});
		vault.addFile('Carol away.md', {
			frontmatter: { type: 'Absence', assignee: 'Bob', start: '2026-08-11', due: '2026-08-12' },
		});
		const { containerEl } = laneRoadmap(vault);
		const [alice, bob] = lanesOf(containerEl);

		expect(laneCountOf(alice)).toBe('1');
		expect(alice.querySelector<HTMLElement>('.pbl-lane-away')?.dataset.tooltip).toBe('1 absence');

		// Bob's row exists for the roster and holds no work at all.
		expect(laneCountOf(bob)).toBe('0');
		expect(bob.querySelector<HTMLElement>('.pbl-lane-away')?.dataset.tooltip).toBe('2 absences');
	});

	it('draws no such glyph on a band with nothing to be away for', () => {
		const vault = new FakeVault();
		vault.addFile('Work.md', {
			frontmatter: { type: 'Epic', order: 10, assignee: 'Alice', start: '2026-08-01', due: '2026-08-10' },
		});
		const { containerEl } = laneRoadmap(vault);

		expect(containerEl.querySelectorAll('.pbl-lane-away')).toHaveLength(0);
	});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run test/view/resourceAbsences.test.ts -t "band holds a stretch"`

Expected: FAIL — no `.pbl-lane-away` element.

- [ ] **Step 3: Draw the glyph**

In `src/view/render/lanes.ts`, in `renderLaneHead`, immediately after the count span:

```ts
		lead.createSpan({ cls: 'pbl-lane-count', text: String(lane.bars.length) });
		// The count is RESULT bars and stays so — the rule a bucket's count already keeps —
		// which leaves a band whose only content is an absence reading "0" beside a row that
		// plainly has something in it. This qualifies the number rather than changing what it
		// counts. `aria-hidden`, and that is honest rather than a gap: each stretch's own row
		// below carries `<title> — unavailable <dates>` as its accessible name, so this is a
		// second route for a sighted reader and not the only route to the fact.
		if (lane.absences.length > 0) {
			const away = lead.createSpan({ cls: 'pbl-lane-away', attr: { 'aria-hidden': 'true' } });
			drawIcon(away, 'user-x');
			setTooltip(away, lane.absences.length === 1 ? '1 absence' : `${lane.absences.length} absences`);
		}
```

- [ ] **Step 4: Style it**

In `styles/lanes.css`, extend the `.pbl-away-flag` icon rule into a shared one and add the header glyph's own colour rule:

```css
/* The band header's own word for "this resource is away at some point" — `renderLaneHead`.
   Beside the count it qualifies, not pinned right like the row flag: it belongs to the
   number, and a header has no title for it to narrow. */
.pbl-lane-away {
	display: inline-flex;
	align-items: center;
	color: var(--text-muted);
}

.pbl-lane-away .svg-icon,
.pbl-away-flag .svg-icon {
	width: var(--icon-s);
	height: var(--icon-s);
}
```

Delete the now-duplicated `.pbl-away-flag .svg-icon` rule Task 4 added, so the sizing is stated once.

- [ ] **Step 5: Run the suite**

Run: `npx vitest run test/view/resourceAbsences.test.ts test/view/resourceLanes.test.ts`

Expected: PASS, including the existing "counts for nothing on the header".

- [ ] **Step 6: Commit**

```bash
git add src/view/render/lanes.ts styles/lanes.css test/view/resourceAbsences.test.ts
git commit -m "$(cat <<'EOF'
Say a band holds an absence beside the count that ignores it

A resource whose only content is an absence rendered "0" beside a row that
plainly had something in it. The count stays result bars — the rule a bucket's
count already keeps, and the one that test asserts — and a glyph beside it
qualifies the number instead.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The register, the thresholds, and the full gate

**Files:**
- Create: `docs/bugs/An absence read fainter than the decoration behind it.md`
- Modify: `docs/requirements/Resource absences.md`, `docs/requirements/Showing a resources axis on the roadmap.md`, `docs/tests/suites/Smoke test the roadmap.md`, `CHANGELOG.md`, `vitest.config.mts`

**Interfaces:** none — this task ships no code.

**Context you need:** `docs-check.mjs` gates the register: the hierarchy and sibling orders, every wikilink, every source path a note names, and the rule that every module in `src/` is specified by at least one use case's `## Where it lives` or ADR's `## Decision`. The three existing siblings under `[[Resource absences]]` hold orders 10, 20 and 30, so this one is **40**. Copy the frontmatter shape from `docs/bugs/An absence drew on the line below its own name.md` exactly — every key it has, including the empty strings.

- [ ] **Step 1: Write the bug note**

Create `docs/bugs/An absence read fainter than the decoration behind it.md` with `type: Bug`, `parent: "[[Resource absences]]"`, `order: 40`, `status: Done`, `area: styling`, `priority: P2`, `created: 2026-08-14`, `closed: 2026-08-14`, a `source:` line naming the light-mode screenshot at 382 results, and a `files:` list of everything the five tasks touched. Then three sections in the siblings' own shape:

- **What happened** — the three hatched stretches fainter than the weekend shading behind them; nothing keying the hatch; and the stretch on a line the bar it crosses is never on, which made the collision the feature exists to show the hardest thing on the band to see.
- **Why** — the mark was built from `--background-modifier-border`, the palette `.pbl-grid-line` is made of and `.pbl-weekend-layer` draws from, so it could not out-read the decoration it sits on; `.pbl-absence-row` then dimmed it another fifth; the legend keys `DrawnColors` and a hatch was not among them; and `laneEntries` gives each stretch its own line, which is correct for the title, the dates and the menu and wrong for the collision.
- **The fix** — the five increments, each with its rule rather than its diff: the content-palette rule, the render-reported swatch, the prepended per-row wash (with the no-`z-index` and `track.prepend` reasons), `crossedAbsences` judged on the days a bar draws and read from dates rather than geometry, and the header glyph that qualifies a count it does not change. Name what each check reaches and what it does not.

- [ ] **Step 2: Extend `docs/requirements/Resource absences.md`**

Add extension **4k** after 4j, in that list's own voice: *the stretch also shades the band's own work rows.* State that 4a is unchanged — both still draw, stacked, nothing moves to avoid anything — and that the shading is an addition beside the named line rather than a replacement for it, because that line is what carries the title, the dates and the menu, so a resource whose only content is an absence (4b) would otherwise have a row with nothing in it to act on.

Add to `## Where it lives`: the mark's palette rule, `renderAbsenceWash` and where it is called from, why it is prepended rather than layered, `crossedAbsences` and what it judges, and the header glyph. Add the new paths to the note's `files:` list.

Extend that note's **What a live vault still owes** paragraph with the four questions from the spec's own closing section.

- [ ] **Step 3: Extend `docs/requirements/Showing a resources axis on the roadmap.md`**

One paragraph in `## Where it lives`: the legend is that PBI's own file, and `DrawnColors` now carries a fourth thing the render reports — a MARK rather than a colour override — for the reason the other three are reported rather than derived.

- [ ] **Step 4: Add the live-vault rows**

In `docs/tests/suites/Smoke test the roadmap.md`, add checks in that file's existing row shape for: the 18% wash against a themed vault's weekend banding and whether it still reads as shading rather than a second bar; the hatch at `--text-muted` against a community theme and against a bar it overlaps; two glyphs in one lead at a narrow lead width; and whether the `Unavailable` swatch's finer hatch reads as hatch at 10px.

- [ ] **Step 5: CHANGELOG**

Add entries under `## [Unreleased]` — the mark's contrast, the legend key, the per-row shading, the crossing mark, and the header glyph. Sentence case, one line each, in the file's existing voice.

- [ ] **Step 6: Run the whole gate**

Run: `npm run check`

Expected: build, lint, tests, fallow and the docs register all pass. If coverage fails, do NOT edit thresholds yet — read which file dropped and add the missing case first. `fallow` may report `crossedAbsences`, `renderAbsenceWash` or `noteAbsenceClash` as unused if an import was missed; that is a real finding, not noise.

- [ ] **Step 7: Record the coverage the finished increment measures**

With `npm run check` green, take the four figures from the coverage summary of THAT run and write them into `vitest.config.mts`. Only upward — if any figure came out below the current threshold the run already failed, and the answer is a missing test, not a lowered floor. Then run `npm run check` once more so the recorded numbers are the ones the gate enforces.

- [ ] **Step 8: Commit**

```bash
git add "docs/bugs/An absence read fainter than the decoration behind it.md" "docs/requirements/Resource absences.md" "docs/requirements/Showing a resources axis on the roadmap.md" "docs/tests/suites/Smoke test the roadmap.md" CHANGELOG.md vitest.config.mts
git commit -m "$(cat <<'EOF'
Record what made absences unreadable, and raise the floor

The bug note under [[Resource absences]], extension 4k for the shading beside
4a's unchanged stacking rule, the four questions this still owes a live vault,
and the coverage the finished increment measures.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Look at it**

Run: `npm run harness` and open the printed URL at `?view=roadmap`, then pick the resources axis. `demoVault()` already carries the case: Dana's `Single sign-on` (2026-07-20 → 2026-08-15) runs straight through her absence (2026-08-10 → 2026-08-14), and Sam's row exists only because he is away. Check the mark against the weekend banding, the wash under Dana's bar, both glyphs in one lead, and the `Unavailable` swatch. Switch the corner toggle to light, which is the scheme the report came from.

This answers Obsidian's DEFAULT colours and nothing about a themed vault, so **say so when reporting**: the four live-vault questions in the bug note stay open, and `npm run test-build` is the handover if the human wants to look in a real vault.

## Self-review

**Spec coverage.** Cause 1 → Task 1. Cause 2 → Task 2. Cause 3 → Task 3. Finding 2 (the clash mark) → Task 4. Finding 1 (the header "0") → Task 5. The register, the thresholds and the live-vault statement → Task 6. Every check named in the spec's "The checks, and what each reaches" appears in the task that ships the behaviour it guards, including the two the spec names as instrument checks (a `--text-*` token must be found; `.pbl-bar` must state a height).

**Placeholders.** None: every code step carries the actual declaration or block. Three steps deliberately tell the implementer to READ before writing rather than handing them a value — the base-filter spelling for the context-row fixture (Step 1 of Task 3), the outside-window date pair (Step 5 of Task 4), and the coverage figures (Step 7 of Task 6). Each says what to read and why guessing is wrong; inventing a filter spelling or a threshold number in this plan is precisely how a plan lies.

**Type consistency.** `renderAbsenceWash(track, absences, ruler)` is declared in Task 3 and called only there. `crossedAbsences(span, absences)` is declared in Task 4 and used in the same task. `noteAbsenceClash(row, lead, crossed)` takes the `lead` that Task 3 adds to `renderBarRow`'s return — so Task 4 depends on Task 3 having landed, which the ordering respects. `DrawnColors.absence` is added in Task 2 and read only by `renderLegend`. Class names are stated once each: `.pbl-absence-wash`, `.pbl-away-flag` (the row's glyph), `.pbl-lane-away` (the header's), `.pbl-legend-absence`. Task 5 removes the `.pbl-away-flag .svg-icon` rule Task 4 wrote, replacing it with the shared selector — flagged in the step so the duplicate is not left behind.
