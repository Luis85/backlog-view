# Toolbar Zones and Fit Ladder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the toolbar as five zones in one row, where only the current
projection's zone changes when you switch, and a measured ladder sheds controls into a
`⋯` menu instead of wrapping.

**Architecture:** `render/toolbar.ts` keeps the render orchestration, the focus-key
mechanism and the three `sync*` functions. Two new modules join it: `toolbarControls.ts`
(the button vocabulary, the projection-zone dispatch and the overflow menu) and
`toolbarFit.ts` (the ladder — verdict and application in one file, like
`columnFit`/`syncColumnFit`). The stylesheet grows a `toolbarFit.css` partial beside
`toolbar.css`.

**Tech Stack:** TypeScript, Obsidian Bases custom-view API, vitest + jsdom, esbuild, plain
CSS partials assembled by `scripts/styles-assemble.mjs`.

## Global Constraints

- **`npm run check` is the whole gate** — build, lint, coverage-thresholded tests, fallow,
  docs register. All five must pass before committing. CI runs the same five on Ubuntu
  **and** Windows.
- **400-line cap per `src/` file**, `max-lines` with `skipBlankLines: true, skipComments:
  true`. `render/toolbar.ts` counts **341** lines today, so it has ~59 to spare — this is
  why work moves out of it rather than into it.
- **400-line cap per `styles/` partial**, all lines counted, enforced by
  `styles-assemble.mjs`. `styles/toolbar.css` is **299** lines today.
- **100-line cap per function**, `complexity: 16`, `max-params: 5`.
- **Layers:** `view/` may reach `storage/` and `domain/`, never upward. View state is
  reached only through `BacklogViewHost`.
- **Every module in `src/` must be *specified*** by a use case's `## Where it lives` or an
  ADR's `## Decision` — `scripts/docs-check.mjs` rule 7. A mention anywhere else counts
  for nothing. Two new modules land here, so a register note is part of the work.
- **Sentence-case UI text**, `setCssProps` over inline styles, no global `app`.
- **Any menu opened from a `<button>` goes through `showMenuForClick`** —
  `showAtMouseEvent` is banned by lint outside `interactions/menu.ts`.
- **Once a control is focusable, disabling it in CSS is a lie.** Use the real `disabled`
  property.
- **An invariant asserted in a comment gets a test that fails without it, and the test is
  watched failing.** Revert the fix, run it, see red, restore.
- Coverage thresholds in `vitest.config.mts` only ever go up.
- Commit after each task. Branch: `claude/toolbar-ux-ui-overhaul-uahylz`.

**Spec:** `docs/superpowers/specs/2026-08-08-toolbar-zones-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/view/render/toolbar.ts` (modify) | Render orchestration, focus keys, `syncBusy` / `syncFilterUi` / `syncCountLabel` / `syncCollapseCtls`, the counted population |
| `src/view/render/toolbarControls.ts` (create) | The toolbar's control vocabulary (`iconButton`, `menuButton`, `KEY_ATTR`), the projection-zone dispatch, the bulk-collapse actions, the `⋯` overflow |
| `src/view/render/toolbarFit.ts` (create) | The fit ladder: measure the row, write `data-pbl-fit` |
| `src/view/backlogView.ts` (modify) | Call `syncToolbarFit` where the row's width can have changed |
| `styles/toolbar.css` (modify) | The zones, the segmented switcher and its active position, the reveal button |
| `styles/toolbarFit.css` (create) | What each ladder step drops |
| `styles/index.css` (modify) | Import the new partial |
| `test/view/toolbar.test.ts` (modify) | The projection zone per projection |
| `test/view/toolbarOverflow.test.ts` (create) | The `⋯` contents and its disabled mirror |
| `test/view/toolbarFit.test.ts` (create) | The ladder's step, and the reveal's refit |
| `docs/requirements/A toolbar that fits one row.md` (create) | Specifies both new modules |
| `src/view/CLAUDE.md` (modify) | The zone rule and the ladder, in the Controls section |

---

## Task 1: Move the control vocabulary out of `toolbar.ts`

A pure move plus two extractions, so the tasks that add code have room under the 400-line
cap. No behaviour changes; the existing suite is the check.

**Files:**
- Create: `src/view/render/toolbarControls.ts`
- Modify: `src/view/render/toolbar.ts`

**Interfaces:**
- Consumes: `BacklogViewHost` (`src/view/host.ts`), `BacklogItem` / `BacklogModel`
  (`src/domain/model.ts`).
- Produces, for Tasks 2–4:
  - `const KEY_ATTR = 'data-pbl-key'`
  - `iconButton(parent: HTMLElement, icon: string, label: string, key?: string): HTMLButtonElement`
  - `expandAll(host: BacklogViewHost): void`
  - `collapseAll(host: BacklogViewHost): void`
  - `collapseCtlsDisabled(host: BacklogViewHost): boolean`
  - `collapseButton(host: BacklogViewHost, parent: HTMLElement, icon: string, label: string, mutate: () => void): void`

- [ ] **Step 1: Create the new module with the moved code**

Create `src/view/render/toolbarControls.ts`. `iconButton`, `collapseButton` and
`collapsiblePopulation` are moved verbatim from `toolbar.ts` — keep their doc comments,
which state rules the code depends on.

```ts
import { setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel } from '../../domain/model';

/** Where a toolbar control carries its focus identity — see `capturedFocusKey`. */
export const KEY_ATTR = 'data-pbl-key';

/**
 * A toolbar icon control. A real `<button>`, not a div: the toolbar sits outside
 * the tree's single-tab-stop model, and these are the only way to reach the type
 * picker, the backfill and the collapse commands without a mouse.
 *
 * `key` is the focus identity (`capturedFocusKey`) and defaults to the label, which
 * is the same string on every rebuild for all of these but one: the completed toggle
 * names the next action and its count, so it passes its own.
 */
export function iconButton(
	parent: HTMLElement,
	icon: string,
	label: string,
	key: string = label,
): HTMLButtonElement {
	const btn = parent.createEl('button', {
		cls: 'clickable-icon pbl-icon-btn',
		attr: { type: 'button', 'aria-label': label, [KEY_ATTR]: key },
	});
	setIcon(btn, icon);
	setTooltip(btn, label);
	return btn;
}

/**
 * What the bulk collapse controls can reach — a DIFFERENT question from
 * `countedPopulation` in `toolbar.ts`, which is why it is a second function rather than a
 * reuse: counting asks for the Base's rows, and collapsing asks for everything on screen
 * that owns a disclosure, context rows included.
 *
 * The Deliverables board is the one projection where `model.items` is the wrong answer.
 * It draws `model.deliverableResults`, read off the WHOLE unfocused tree so a focus set
 * elsewhere can never hide a Deliverable — while `model.items` is the focused render set.
 * So with a focus active, Expand all and Collapse all reached none of the cards outside
 * that subtree, and were a complete no-op when no Deliverable was inside it.
 */
function collapsiblePopulation(host: BacklogViewHost, model: BacklogModel): BacklogItem[] {
	return host.projection === 'deliverables' ? model.deliverableResults : model.items;
}

/**
 * The two bulk collapse ACTIONS, extracted from the buttons that used to hold them
 * inline, because the `⋯` menu invokes the same action from a second input. The rule
 * this codebase already keeps for a move — one method, several inputs — applied to a
 * command: a second caller calls the first one's function rather than repeating its loop.
 */
export function expandAll(host: BacklogViewHost): void {
	const model = host.model;
	if (!model) return;
	for (const item of collapsiblePopulation(host, model)) host.setCollapsed(item.file.path, false);
}

export function collapseAll(host: BacklogViewHost): void {
	const model = host.model;
	if (!model) return;
	for (const item of collapsiblePopulation(host, model)) {
		if (item.children.length > 0) host.setCollapsed(item.file.path, true);
	}
}

/**
 * When the bulk collapse controls are refused: while a quick filter overrides collapse
 * state, and on a card projection that drew no disclosure to collapse. `syncCollapseCtls`
 * is still the sole WRITER of the flag — this is the question it asks, named once so the
 * `⋯` menu is not a second opinion about the same rule.
 */
export function collapseCtlsDisabled(host: BacklogViewHost): boolean {
	const nothingToCollapse = host.projection !== 'tree' && host.cardChildrenShown.size === 0;
	return host.isFiltering() || nothingToCollapse;
}

/**
 * Expand/collapse toolbar buttons. Collapse state is overridden while a filter is
 * active, so they are genuinely `disabled` then rather than only dimmed: a control
 * a keyboard user can reach has to refuse the press, not just look like it would.
 * The view re-syncs the flag after every content render (`syncCollapseCtls`).
 */
export function collapseButton(
	host: BacklogViewHost,
	parent: HTMLElement,
	icon: string,
	label: string,
	mutate: () => void,
): void {
	const btn = iconButton(parent, icon, label);
	btn.addClass('pbl-collapse-ctl');
	btn.addEventListener('click', () => {
		// A click on the icon `<svg>` inside a disabled button still reaches this
		// listener (only `btn.click()` on the button itself is blocked by `disabled`),
		// so the guard has to be read here rather than trusted from the DOM state —
		// same shape as the card disclosure toggle in `render/cardChildren.ts`.
		if (btn.disabled) return;
		mutate();
		host.render();
	});
}
```

- [ ] **Step 2: Delete the moved code from `toolbar.ts` and import it**

Remove `KEY_ATTR`, `iconButton`, `collapseButton` and `collapsiblePopulation` from
`src/view/render/toolbar.ts`. Add at the top of its imports:

```ts
import {
	collapseAll,
	collapseButton,
	collapseCtlsDisabled,
	expandAll,
	iconButton,
	KEY_ATTR,
} from './toolbarControls';
```

Rewrite the two collapse-button call sites in `renderToolbar` to use the extracted
actions:

```ts
	collapseButton(host, barEl, 'chevrons-up-down', 'Expand all', () => expandAll(host));
	collapseButton(host, barEl, 'chevrons-down-up', 'Collapse all', () => collapseAll(host));
```

Give each its own class so the `⋯` can find them individually in Task 3 — insert
immediately after those two calls:

```ts
	barEl.querySelector('.pbl-collapse-ctl')?.addClass('pbl-expand-ctl');
	barEl.querySelectorAll('.pbl-collapse-ctl')[1]?.addClass('pbl-collapse-all-ctl');
```

**Do not do this.** Positional lookup is exactly what the root guide forbids — address
code by name, not by position. Instead change `collapseButton` to take the extra class:

```ts
export function collapseButton(
	host: BacklogViewHost,
	parent: HTMLElement,
	icon: string,
	label: string,
	mutate: () => void,
	cls: string,
): void {
	const btn = iconButton(parent, icon, label);
	btn.addClass('pbl-collapse-ctl');
	btn.addClass(cls);
	// … unchanged
}
```

and call it as:

```ts
	collapseButton(host, barEl, 'chevrons-up-down', 'Expand all', () => expandAll(host), 'pbl-expand-ctl');
	collapseButton(host, barEl, 'chevrons-down-up', 'Collapse all', () => collapseAll(host), 'pbl-collapse-all-ctl');
```

That is 6 parameters, one over `max-params: 5`. So instead **fold the class into the
existing `mutate` position by passing an options object**:

```ts
export function collapseButton(
	host: BacklogViewHost,
	parent: HTMLElement,
	spec: { icon: string; label: string; cls: string; mutate: () => void },
): void {
	const btn = iconButton(parent, spec.icon, spec.label);
	btn.addClass('pbl-collapse-ctl');
	btn.addClass(spec.cls);
	btn.addEventListener('click', () => {
		if (btn.disabled) return;
		spec.mutate();
		host.render();
	});
}
```

with the call sites:

```ts
	collapseButton(host, barEl, {
		icon: 'chevrons-up-down',
		label: 'Expand all',
		cls: 'pbl-expand-ctl',
		mutate: () => expandAll(host),
	});
	collapseButton(host, barEl, {
		icon: 'chevrons-down-up',
		label: 'Collapse all',
		cls: 'pbl-collapse-all-ctl',
		mutate: () => collapseAll(host),
	});
```

- [ ] **Step 3: Point `syncCollapseCtls` at the named condition**

In `toolbar.ts`, replace the inline condition:

```ts
export function syncCollapseCtls(host: BacklogViewHost, barEl: HTMLElement): void {
	const disabled = collapseCtlsDisabled(host);
	barEl.querySelectorAll<HTMLButtonElement>('.pbl-collapse-ctl').forEach((btn) => {
		btn.disabled = disabled;
	});
}
```

Keep the function's existing doc comment; add one sentence to it: *"The condition is named
in `toolbarControls.ts` because the `⋯` menu reads the same rule — this function is still
its only writer."*

- [ ] **Step 4: Run the full suite to prove the move changed nothing**

Run: `npx vitest run test/view/`
Expected: PASS, same count as before the move. This is the check on a pure move — a
behaviour test would be asserting what already had tests.

- [ ] **Step 5: Run lint and confirm the cap headroom**

Run: `npm run lint`
Expected: PASS. Then confirm `toolbar.ts` shrank:

```bash
npx eslint src/view/render/toolbar.ts --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}' 2>&1 | grep -o "too many lines ([0-9]*)"
```
Expected: a number below 341.

- [ ] **Step 6: Commit**

```bash
git add src/view/render/toolbarControls.ts src/view/render/toolbar.ts
git commit -m "refactor: the toolbar's control vocabulary gets its own module"
```

---

## Task 2: The projection zone, speaking in words

**Files:**
- Modify: `src/view/render/toolbarControls.ts` (add `menuButton`, `renderProjectionZone`)
- Modify: `src/view/render/toolbar.ts` (delete `renderAxisPicker` and
  `renderTimelineControls`; call the zone)
- Modify: `styles/toolbar.css`
- Modify: `test/view/toolbar.test.ts`

**Interfaces:**
- Consumes: `iconButton`, `KEY_ATTR` (Task 1); `activeAxis`, `configuredAxes`,
  `RoadmapAxis` (`src/domain/roadmap.ts`); `ScaleId` (`src/domain/timeline.ts`);
  `showMenuForClick` (`src/view/interactions/menu.ts`).
- Produces, for Tasks 3–4:
  - `menuButton(parent: HTMLElement, icon: string, label: string, key: string): HTMLButtonElement`
    — a labelled button with a trailing chevron, whose text sits in a
    `<span class="pbl-btn-label">` so the ladder can hide it.
  - `renderProjectionZone(host: BacklogViewHost, barEl: HTMLElement): void`

- [ ] **Step 1: Write the failing tests**

Add to `test/view/toolbar.test.ts`:

```ts
describe('the projection zone', () => {
	const zone = (containerEl: HTMLElement) => containerEl.querySelector('.pbl-zone-projection');
	const seps = (containerEl: HTMLElement) =>
		containerEl.querySelectorAll('.pbl-toolbar .pbl-toolbar-sep').length;

	const bothAxes = {
		horizonProperty: 'note.horizon',
		startProperty: 'note.start',
		targetProperty: 'note.due',
	};

	it('holds the roadmap axis and zoom, and nothing at all on the other projections', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, bothAxes);

		view.setProjection('roadmap');
		view.setAxisPick('dates');
		const drawn = zone(containerEl);
		expect(drawn).not.toBeNull();
		expect(drawn?.querySelector('[data-pbl-key="axis"]')).not.toBeNull();
		expect(drawn?.querySelector('[data-pbl-key="zoom"]')).not.toBeNull();
		expect(drawn?.querySelector('.pbl-density-toggle')).not.toBeNull();
		expect(drawn?.querySelector('.pbl-today-btn')).not.toBeNull();

		for (const projection of ['tree', 'board', 'deliverables'] as const) {
			view.setProjection(projection);
			expect(zone(containerEl), `${projection} drew a projection zone`).toBeNull();
		}
	});

	it('takes its separator with it, so an empty zone leaves no gap', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, bothAxes);

		view.setProjection('roadmap');
		view.setAxisPick('dates');
		const withZone = seps(containerEl);
		view.setProjection('tree');
		expect(seps(containerEl)).toBe(withZone - 1);
	});

	it('names the axis and the zoom in words, and each menu checks the current value', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, bothAxes);
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		const axisBtn = containerEl.querySelector<HTMLElement>('[data-pbl-key="axis"]');
		expect(axisBtn?.textContent).toContain('Timeline');
		axisBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const axisItems = Menu.lastShown?.items ?? [];
		expect(axisItems.map((i) => i.titleText)).toEqual(['Horizons', 'Timeline']);
		expect(axisItems.find((i) => i.titleText === 'Timeline')?.checked).toBe(true);

		const zoomBtn = containerEl.querySelector<HTMLElement>('[data-pbl-key="zoom"]');
		expect(zoomBtn?.textContent).toContain('Months');
		zoomBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const zoomItems = Menu.lastShown?.items ?? [];
		expect(zoomItems.map((i) => i.titleText)).toEqual(['Weeks', 'Months', 'Quarters']);
		expect(zoomItems.find((i) => i.titleText === 'Months')?.checked).toBe(true);
	});

	// The defect the harness mock found: `calendar-range` named BOTH the axis's
	// Timeline and the zoom's Quarters, six positions apart in one row. Asked of the
	// icons the two menus actually set, so it holds for whatever the next pick is.
	it('never gives two entries in the zone the same glyph', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, bothAxes);
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		const icons: string[] = [];
		for (const key of ['axis', 'zoom']) {
			containerEl
				.querySelector<HTMLElement>(`[data-pbl-key="${key}"]`)
				?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			icons.push(...(Menu.lastShown?.items ?? []).map((i) => i.iconName));
		}
		expect(new Set(icons).size, `duplicate glyph among ${icons.join(', ')}`).toBe(icons.length);
	});

	it('offers no axis picker when only one axis is configured', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, { horizonProperty: 'note.horizon' });
		view.setProjection('roadmap');
		expect(containerEl.querySelector('[data-pbl-key="axis"]')).toBeNull();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/view/toolbar.test.ts -t "projection zone"`
Expected: FAIL — `.pbl-zone-projection` is never rendered.

- [ ] **Step 3: Add `menuButton` to `toolbarControls.ts`**

```ts
/**
 * A labelled menu button: an icon, the current value in words, a chevron. The text is
 * its own span so the fit ladder can hide it without touching the accessible name, which
 * stays on the button.
 */
export function menuButton(
	parent: HTMLElement,
	icon: string,
	label: string,
	key: string,
): HTMLButtonElement {
	const btn = parent.createEl('button', {
		cls: 'pbl-menu-btn',
		attr: { type: 'button', 'aria-label': label, [KEY_ATTR]: key },
	});
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), icon);
	btn.createSpan({ cls: 'pbl-btn-label', text: label });
	setIcon(btn.createSpan({ cls: 'pbl-btn-chevron' }), 'chevron-down');
	return btn;
}
```

- [ ] **Step 4: Add the zone dispatch to `toolbarControls.ts`**

```ts
/**
 * The controls this projection owns, and only those — the one place the question "which
 * projection is this?" is asked about the toolbar's contents. Adding a projection is
 * adding a case here; it is deliberately a switch rather than a registry, because a
 * registration interface with one implementation is an abstraction nobody can read
 * faster than the branch it replaces.
 *
 * The zone and its leading separator are created together and removed together: a
 * separator introducing nothing is a rule the row states and does not keep. Emptiness is
 * decided from what was DRAWN rather than from a second reading of the settings, so the
 * two cannot disagree about whether this projection contributed anything.
 */
export function renderProjectionZone(host: BacklogViewHost, barEl: HTMLElement): void {
	const sep = barEl.createDiv({ cls: 'pbl-toolbar-sep' });
	const zone = barEl.createDiv({ cls: 'pbl-zone pbl-zone-projection' });
	switch (host.projection) {
		case 'roadmap':
			renderAxisPicker(host, zone);
			renderTimelineControls(host, zone);
			break;
		default:
			// The tree, the board and the Deliverables board own no toolbar controls of
			// their own today. A projection that grows one adds a case, not a guard
			// somewhere else in the row.
			break;
	}
	if (zone.childElementCount > 0) return;
	sep.remove();
	zone.remove();
}
```

- [ ] **Step 5: Move the two pickers into `toolbarControls.ts`, as words**

Delete `renderAxisPicker` and `renderTimelineControls` from `toolbar.ts` and write these
in `toolbarControls.ts`. Both lose their `if (host.projection !== 'roadmap') return`
guards — the dispatch owns that question now.

```ts
/** Axis labels, one place, so the button and its menu cannot name it differently. */
const AXIS_LABEL: Record<RoadmapAxis, { icon: string; text: string }> = {
	// `gantt-chart`, not `calendar-range`: that glyph is the zoom's Quarters, and two
	// controls in one row wearing one icon is what the harness mock caught.
	dates: { icon: 'gantt-chart', text: 'Timeline' },
	horizons: { icon: 'columns-3', text: 'Horizons' },
};

/** Zoom labels, same rule. */
const ZOOM_LABEL: Record<ScaleId, { icon: string; text: string }> = {
	week: { icon: 'calendar-days', text: 'Weeks' },
	month: { icon: 'calendar', text: 'Months' },
	quarter: { icon: 'calendar-range', text: 'Quarters' },
};

/**
 * Which axis this saved view shows — offered only while both axes are configured: with
 * one there is no choice to make, and the axis that remains always beats guidance. The
 * pick persists the way the mode itself does, and it is retained when its axis loses its
 * configuration, so restoring the cleared property restores the saved choice with it.
 */
function renderAxisPicker(host: BacklogViewHost, zone: HTMLElement): void {
	if (configuredAxes(host.settings).length < 2) return;
	const active = activeAxis(host.settings, host.axisPick);
	const btn = menuButton(zone, AXIS_LABEL[active].icon, AXIS_LABEL[active].text, 'axis');
	setTooltip(btn, 'Roadmap axis');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		const choice = (axis: RoadmapAxis) =>
			menu.addItem((mi) =>
				mi
					.setTitle(AXIS_LABEL[axis].text)
					.setIcon(AXIS_LABEL[axis].icon)
					.setChecked(active === axis)
					.onClick(() => host.setAxisPick(axis)),
			);
		choice('horizons');
		choice('dates');
		showMenuForClick(menu, evt);
	});
}

/**
 * The zoom picker, jump-to-today and the density toggle, on the dated axis alone — the
 * horizon axis has no density to choose and no today to return to.
 */
function renderTimelineControls(host: BacklogViewHost, zone: HTMLElement): void {
	if (activeAxis(host.settings, host.axisPick) !== 'dates') return;
	const btn = menuButton(zone, ZOOM_LABEL[host.zoom].icon, ZOOM_LABEL[host.zoom].text, 'zoom');
	setTooltip(btn, 'Timeline zoom');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const id of ['week', 'month', 'quarter'] as ScaleId[]) {
			menu.addItem((mi) =>
				mi
					.setTitle(ZOOM_LABEL[id].text)
					.setIcon(ZOOM_LABEL[id].icon)
					.setChecked(host.zoom === id)
					.onClick(() => host.setZoom(id)),
			);
		}
		showMenuForClick(menu, evt);
	});
	const compact = host.density === 'compact';
	// The name is the SETTING, fixed, and aria-pressed carries its value — a toggle
	// whose name changes to the next action announces "Comfortable rows, pressed" while
	// compact rows are on, which states the opposite of what is true. The icon still
	// swaps: it is the sighted affordance, and it says nothing to a reader.
	const densityBtn = iconButton(zone, compact ? 'rows-2' : 'rows-4', 'Compact rows');
	densityBtn.addClass('pbl-density-toggle');
	densityBtn.toggleClass('is-active', compact);
	densityBtn.setAttribute('aria-pressed', String(compact));
	densityBtn.addEventListener('click', () => host.setDensity(compact ? null : 'compact'));
	const today = iconButton(zone, 'locate-fixed', 'Jump to today');
	today.addClass('pbl-today-btn');
	today.addEventListener('click', () => host.jumpToToday());
}
```

Add the imports these need to `toolbarControls.ts`:

```ts
import { Menu, setIcon, setTooltip } from 'obsidian';
import { activeAxis, configuredAxes, RoadmapAxis } from '../../domain/roadmap';
import { ScaleId } from '../../domain/timeline';
import { showMenuForClick } from '../interactions/menu';
```

- [ ] **Step 6: Put the whole row in zone order**

This is a reordering of `renderToolbar`'s body, not a two-line swap — the row's meaning is
its order, and leaving New at the head would keep today's sequence with a new zone dropped
into it. Move the blocks; do not rewrite what they do.

`renderToolbar` currently reads, after the `refocusKey` capture and `barEl.empty()`: New
button → type chevron → focus picker → mode toggle → axis picker → timeline controls →
separator → ✨ → undo → expand → collapse → completed toggle → filter → spacer → notes →
warning → busy → count. Rearrange it to:

```ts
	// 1 — where am I. The switcher leads: it is the control that says what the rest of
	// the row is about.
	renderModeToggle(host, barEl);

	// 2 — what THIS projection owns, and nothing when it owns none. Draws its own
	// leading separator, or neither.
	renderProjectionZone(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-spacer' });

	// 3 — what is shown. The same controls in every projection.
	renderFocusPicker(host, barEl, model);
	collapseButton(host, barEl, { … expand … });
	collapseButton(host, barEl, { … collapse … });
	renderCompletedToggle(host, barEl, model);
	renderFilterBox(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-sep' });

	// 4 — what writes.
	const initBtn = iconButton(barEl, 'sparkles', 'Assign missing properties');
	initBtn.addClass('pbl-write-ctl');
	initBtn.addEventListener('click', () => {
		void runInit(host);
	});
	const undoBtn = iconButton(barEl, 'undo-2', 'Undo last backlog change');
	undoBtn.addClass('pbl-undo-btn');
	undoBtn.disabled = !host.canUndo();
	undoBtn.addEventListener('click', () => {
		void host.undoLast();
	});
	renderOverflow(host, barEl);

	barEl.createDiv({ cls: 'pbl-toolbar-sep' });

	// 5 — status: the notes, the warning, the busy indicator, the count. Unchanged
	// blocks, moved as they are.
	// … groupingIgnored note, renderIgnoredNote, configProblems warning,
	//     renderBusyIndicator, the count label …

	// 6 — the primary action, anchored at the end.
	renderNewButton(host, barEl, model);

	refocusByKey(barEl, refocusKey);
```

`renderOverflow` arrives in Task 3; leave its call out until then. `renderNewButton` is
the New button and its type chevron, lifted out of `renderToolbar`'s head into a function
of their own so the block can move as one — the body is exactly today's, including the
`onDeliverables` reasoning and the `primaryNewType` call:

```ts
/**
 * The primary create button and the chevron beside it. Last in the row: the zones before
 * it answer "what am I looking at" and "what is shown", and the action that adds to it is
 * anchored at the end where it does not push everything else sideways when the type name
 * it carries changes length.
 */
function renderNewButton(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	// The Deliverables board only ever shows Deliverables, so the primary button is
	// bound to that type unconditionally — never the focus-dependent `newItemType`,
	// which would offer a type this board would not even display. With one sensible
	// type there is nothing for a "New item of another type" picker to add, so it is
	// absent rather than a chevron opening a one-entry menu.
	const onDeliverables = host.projection === 'deliverables';
	const newLevel = onDeliverables ? DELIVERABLE_TYPE : primaryNewType(host, model);
	const newBtn = barEl.createEl('button', {
		cls: 'pbl-new-btn',
		attr: { [KEY_ATTR]: 'new', 'aria-label': `New ${newLevel}` },
	});
	setIcon(newBtn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	newBtn.createSpan({ cls: 'pbl-btn-label', text: `New ${newLevel}` });
	newBtn.addEventListener('click', () => promptCreateItem(host, [newLevel], null));
	if (onDeliverables) return;
	const pickBtn = iconButton(barEl, 'chevron-down', 'New item of another type');
	pickBtn.addClass('pbl-new-pick');
	pickBtn.addEventListener('click', (evt) => {
		const menu = new Menu();
		// Every declared type, extras included: this menu is the one place a top-level
		// item of any type can be made, and an Issue raised against nothing in
		// particular is a real thing to want. Except `Deliverable` on the requirements
		// board, which excludes Deliverables by construction.
		for (const type of offerableTypes(host)) {
			menu.addItem((mi) =>
				mi.setTitle(`New ${type}`).setIcon('plus').onClick(() => promptCreateItem(host, [type], null)),
			);
		}
		showMenuForClick(menu, evt);
	});
}
```

Note the `aria-label` on `newBtn` — it is not cosmetic, and Step 6b below is why.

Then delete the now-unused imports from `toolbar.ts`: `activeAxis`, `configuredAxes`,
`RoadmapAxis`, `ScaleId`.

- [ ] **Step 6b: Name the two buttons the ladder is about to strip**

`renderToolbar`'s New button and the focus picker have **no `aria-label`** — their
accessible name is the text the ladder will hide at step 1, so without this they become
unnamed primary controls on a narrow pane. `test/view/toolbarFocus.test.ts` asserts that
absence today ("the two buttons their own text names, which carry no aria-label at all"),
which is exactly how it was found.

The New button's label is in the block above. In `renderFocusPicker`, add one to each of
its two buttons, and wrap their text:

```ts
	const btn = wrap.createEl('button', {
		cls: 'pbl-focus-btn',
		attr: { [KEY_ATTR]: 'focus', 'aria-label': `Focus: ${active || 'all types'}` },
	});
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'filter');
	btn.createSpan({ cls: 'pbl-btn-label', text: active || 'All types' });
```

and for the Deliverables board's fixed, disabled one:

```ts
	btn.setAttribute('aria-label', 'Deliverables');
	btn.createSpan({ cls: 'pbl-btn-label', text: 'Deliverables' });
```

Then update `test/view/toolbarFocus.test.ts`'s second test: its two `expect(...aria-label
).toBeNull()` lines are now wrong, and its comment explains a mechanism that still holds —
the focus KEY is what restores these controls, and it always was. Rewrite those two lines
as the reason the key exists rather than deleting them:

```ts
		// These two are named by their own text, which the fit ladder hides on a narrow
		// pane — so they carry an explicit `aria-label` as well, and NEITHER name is what
		// focus is restored by. The key is, which is the whole point of the mechanism:
		// `New Epic` becomes `New Feature` when the focus changes, and the label with it.
		expect(newBtn.getAttribute('aria-label')).toBe('New Epic');
		expect(newBtn.getAttribute('data-pbl-key')).toBe('new');
```

- [ ] **Step 6c: Check the guarantee, at the ladder rather than at a list**

Add to `test/view/toolbarFocus.test.ts`, inside the existing describe — it is the file
that already sweeps the whole rendered toolbar, and this is the same sweep asking about
names:

```ts
	// The rule: the ladder may hide a `.pbl-btn-label` only on a control that is named
	// without it. Asked of every label the toolbar renders, so a control added later
	// with a bare text name fails here rather than going quiet on a narrow pane.
	it('never lets a hidden label be the only name a control has', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			stateProperty: 'note.status',
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		const check = () => {
			const toolbar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
			if (!toolbar) throw new Error('toolbar not rendered');
			const labels = Array.from(toolbar.querySelectorAll<HTMLElement>('.pbl-btn-label'));
			expect(labels.length).toBeGreaterThan(0);
			const unnamed = labels
				.map((el) => el.closest('button'))
				.filter((btn) => (btn?.getAttribute('aria-label') ?? '') === '')
				.map((btn) => btn?.className);
			expect(unnamed, `hiding these labels leaves the control unnamed`).toEqual([]);
		};
		view.setProjection('tree');
		check();
		view.setProjection('roadmap');
		view.setAxisPick('dates');
		check();
		view.setProjection('deliverables');
		check();
	});
```

Run it, then delete one of the `aria-label`s added in Step 6b and watch it fail naming
that button. Restore.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/view/toolbar.test.ts`
Expected: PASS.

Then the whole view suite, because the zone moved elements other tests find:

Run: `npx vitest run test/view/`
Expected: PASS. If `test/view/roadmap.test.ts` or `test/view/timeline.test.ts` locate the
zoom or axis controls by `aria-label` (`'Zoom to months'`, `'Show timeline'`), update
those selectors to `[data-pbl-key="zoom"]` / `[data-pbl-key="axis"]` and drive the menu —
the control is a menu button now, not a segmented position.

- [ ] **Step 8: Style the zone and the segmented switcher**

Add to `styles/toolbar.css`. The `.pbl-mode-btn.is-active` rule is the one the mock found
missing entirely.

```css
/* A zone is a run of controls that belong together; the projection's own is the only
   one whose contents change, and it is drawn between the switcher and the spacer. */
.pbl-zone {
	display: flex;
	align-items: center;
	gap: var(--size-4-1);
	flex: 0 0 auto;
}

/* The switcher is a segmented group: one border around the set, dividers between the
   positions, and the active one FILLED. Obsidian's `.clickable-icon.is-active` tint is
   the only thing that used to mark it, which is too quiet for the control that says
   what you are looking at. */
.pbl-mode-toggle {
	display: inline-flex;
	align-items: center;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	overflow: hidden;
	flex: 0 0 auto;
	gap: 0;
}

.pbl-mode-btn {
	border-radius: 0;
	margin: 0;
}

.pbl-mode-btn + .pbl-mode-btn {
	border-inline-start: 1px solid var(--background-modifier-border);
}

.pbl-mode-btn.is-active {
	background-color: var(--background-modifier-active-hover);
	color: var(--text-accent);
	box-shadow: inset 0 -2px 0 var(--interactive-accent);
}

/* A labelled menu button — the projection zone's pickers, naming their current value. */
.pbl-menu-btn {
	display: inline-flex;
	align-items: center;
	gap: var(--size-4-1);
	font-size: var(--font-ui-small);
	white-space: nowrap;
}

.pbl-menu-btn .svg-icon {
	width: var(--icon-s);
	height: var(--icon-s);
}

.pbl-btn-chevron {
	display: inline-flex;
	align-items: center;
	color: var(--text-faint);
}

.pbl-btn-chevron .svg-icon {
	width: 12px;
	height: 12px;
}
```

Delete the now-dead `.pbl-axis-picker` and `.pbl-zoom-picker` selectors from
`styles/roadmap.css` — the segmented groups they styled no longer exist. Keep
`.pbl-mode-toggle` out of that rule too; it is styled above now.

- [ ] **Step 9: Look at it**

Run: `npm run harness && node -e "console.log('open .harness/index.html?view=roadmap')"`
Open `.harness/index.html?view=roadmap` and `?view=roadmap&theme=light`. Confirm the
switcher reads as one segmented control with a filled active position, and that the zone
sits between it and the spacer. Colour is an approximation — ADR 0020 — so this answers
layout and hierarchy only.

- [ ] **Step 10: Run the gate and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/view/render/toolbarControls.ts src/view/render/toolbar.ts styles/toolbar.css styles/roadmap.css test/view/
git commit -m "feat: the projection owns a zone of the toolbar, and it speaks in words"
```

---

## Task 3: The `⋯` overflow, mirroring the buttons it duplicates

**Files:**
- Modify: `src/view/render/toolbarControls.ts`
- Modify: `src/view/render/toolbar.ts`
- Create: `test/view/toolbarOverflow.test.ts`

**Interfaces:**
- Consumes: `iconButton`, `expandAll`, `collapseAll` (Task 1); `runInit`
  (`src/view/interactions/structure.ts`); `showMenuForClick`.
- Produces, for Task 4: `renderOverflow(host: BacklogViewHost, barEl: HTMLElement): void`,
  rendering `button.pbl-overflow-btn` with `data-pbl-key="overflow"`.

- [ ] **Step 1: Write the failing test**

Create `test/view/toolbarOverflow.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Menu } from '../helpers/obsidian-mock';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * The `⋯` is what makes "the ladder sheds controls" survive the rule that a responsive
 * hide is a space decision and no COMMAND is withheld for it. Two questions, and the
 * second is the one that can go quietly wrong: an entry that stays enabled while the
 * button it duplicates is disabled would write collapse state a quick filter is
 * overriding, from a pane too narrow to show the button refusing it.
 */
describe('the toolbar overflow menu', () => {
	const openOverflow = (containerEl: HTMLElement) => {
		const btn = containerEl.querySelector<HTMLElement>('.pbl-overflow-btn');
		if (!btn) throw new Error('overflow button not rendered');
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		return Menu.lastShown?.items ?? [];
	};

	it('carries every action the ladder can shed, on the projection that has them', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {
			horizonProperty: 'note.horizon',
			startProperty: 'note.start',
			targetProperty: 'note.due',
		});
		view.setProjection('roadmap');
		view.setAxisPick('dates');

		expect(openOverflow(containerEl).map((i) => i.titleText)).toEqual([
			'Compact rows',
			'Jump to today',
			'Assign missing properties',
			'Expand all',
			'Collapse all',
		]);
	});

	it('offers only what this projection renders — no density or today off the dated axis', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);
		view.setProjection('tree');

		expect(openOverflow(containerEl).map((i) => i.titleText)).toEqual([
			'Assign missing properties',
			'Expand all',
			'Collapse all',
		]);
	});

	it('disables an entry exactly when the button it duplicates is disabled', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault);

		const enabled = openOverflow(containerEl);
		expect(enabled.find((i) => i.titleText === 'Expand all')?.disabled).toBe(false);

		// A running quick filter overrides collapse state, so both bulk controls refuse
		// the press — and the menu has to refuse it too.
		view.setFilter('Epic');

		const filtering = openOverflow(containerEl);
		expect(filtering.find((i) => i.titleText === 'Expand all')?.disabled).toBe(true);
		expect(filtering.find((i) => i.titleText === 'Collapse all')?.disabled).toBe(true);
	});

	it('runs the same action the button runs', () => {
		const vault = fixture();
		const { view, containerEl } = makeView(vault, {}, { collapsed: true });

		const collapsedBefore = view.isCollapsed(
			vault.files.find((f) => f.path === 'Epic.md')?.path ?? 'Epic.md',
		);
		expect(collapsedBefore).toBe(true);

		openOverflow(containerEl).find((i) => i.titleText === 'Expand all')?.onClickCallback?.();

		expect(view.isCollapsed('Epic.md')).toBe(false);
	});
});
```

If the `MenuItem` mock does not expose the click callback under
`onClickCallback`, read `test/helpers/obsidian-mock.ts` and use the field it does record;
do not add a field to the mock for this test alone.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/view/toolbarOverflow.test.ts`
Expected: FAIL — "overflow button not rendered".

- [ ] **Step 3: Implement `renderOverflow`**

Add to `src/view/render/toolbarControls.ts`:

```ts
/** One `⋯` entry: what it says, and the button whose state it mirrors. */
interface OverflowEntry {
	title: string;
	icon: string;
	cls: string;
	run: () => void;
}

/**
 * Every action the fit ladder can take off the row. Fixed, in row order — NOT derived
 * from the current step: a menu whose contents tracked the verdict would be a second
 * opinion about it, and a duplicated entry for a control still on screen is harmless and
 * already the pattern here (the card menu carries the state chip's values while the chip
 * is visible).
 */
const OVERFLOW: OverflowEntry[] = [
	{
		title: 'Compact rows',
		icon: 'rows-2',
		cls: 'pbl-density-toggle',
		run: () => undefined,
	},
	{ title: 'Jump to today', icon: 'locate-fixed', cls: 'pbl-today-btn', run: () => undefined },
	{
		title: 'Assign missing properties',
		icon: 'sparkles',
		cls: 'pbl-write-ctl',
		run: () => undefined,
	},
	{ title: 'Expand all', icon: 'chevrons-up-down', cls: 'pbl-expand-ctl', run: () => undefined },
	{
		title: 'Collapse all',
		icon: 'chevrons-down-up',
		cls: 'pbl-collapse-all-ctl',
		run: () => undefined,
	},
];
```

That table cannot hold the actions, because each needs `host`. Write it as a function
instead, which is also what lets the entry name the button it mirrors:

```ts
/**
 * Every action the fit ladder can take off the row, in row order. Fixed rather than
 * derived from the current step — see above.
 *
 * An entry appears only when its BUTTON was rendered, so a projection that has no
 * density toggle does not offer one; and it is disabled exactly when that button is,
 * read off the button's own `disabled` property rather than re-derived. Re-deriving
 * would put a second opinion beside `syncCollapseCtls` and `syncBusy`, which own that
 * flag — and the one that matters is expand/collapse, which has no structural backstop:
 * the write gate refuses a second batch on its own, so a mis-enabled ✨ is refused, while
 * a mis-enabled Expand all would really write collapse state a filter is overriding.
 *
 * Read at click time, so what it sees is the frame on screen.
 */
function overflowEntries(host: BacklogViewHost, barEl: HTMLElement): OverflowEntry[] {
	const compact = host.density === 'compact';
	const all: OverflowEntry[] = [
		{
			title: 'Compact rows',
			icon: compact ? 'rows-2' : 'rows-4',
			cls: 'pbl-density-toggle',
			run: () => host.setDensity(compact ? null : 'compact'),
		},
		{
			title: 'Jump to today',
			icon: 'locate-fixed',
			cls: 'pbl-today-btn',
			run: () => host.jumpToToday(),
		},
		{
			title: 'Assign missing properties',
			icon: 'sparkles',
			cls: 'pbl-write-ctl',
			run: () => void runInit(host),
		},
		{
			title: 'Expand all',
			icon: 'chevrons-up-down',
			cls: 'pbl-expand-ctl',
			run: () => {
				expandAll(host);
				host.render();
			},
		},
		{
			title: 'Collapse all',
			icon: 'chevrons-down-up',
			cls: 'pbl-collapse-all-ctl',
			run: () => {
				collapseAll(host);
				host.render();
			},
		},
	];
	return all.filter((entry) => barEl.querySelector(`.${entry.cls}`) !== null);
}

/**
 * The `⋯`. Always rendered and hidden by CSS below the step that needs it, the way the
 * busy indicator already is: a control created on a measurement would have to be created
 * inside the measuring pass.
 */
export function renderOverflow(host: BacklogViewHost, barEl: HTMLElement): void {
	const btn = iconButton(barEl, 'ellipsis', 'More toolbar actions', 'overflow');
	btn.addClass('pbl-overflow-btn');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const entry of overflowEntries(host, barEl)) {
			const mirrored = barEl.querySelector<HTMLButtonElement>(`.${entry.cls}`);
			menu.addItem((mi) =>
				mi
					.setTitle(entry.title)
					.setIcon(entry.icon)
					.setDisabled(mirrored?.disabled === true)
					.onClick(entry.run),
			);
		}
		showMenuForClick(menu, evt);
	});
}
```

Delete the `OVERFLOW` constant from the first code block — it was the shape that could not
carry `host`, kept above only to show why the function replaced it. Add the import:

```ts
import { runInit } from '../interactions/structure';
```

- [ ] **Step 4: Render it from `renderToolbar`**

In `toolbar.ts`, after the undo button and before the collapse buttons:

```ts
	renderOverflow(host, barEl);
```

Placement in the row is a layout decision only — the menu reads the DOM at click time, so
it can sit anywhere and still see every button.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/view/toolbarOverflow.test.ts`
Expected: PASS.

- [ ] **Step 6: Watch the disabled test fail without its guard**

Change `.setDisabled(mirrored?.disabled === true)` to `.setDisabled(false)`.

Run: `npx vitest run test/view/toolbarOverflow.test.ts -t "disables an entry"`
Expected: FAIL. Restore the line and re-run: PASS. Do not skip this — the root guide
requires the test be watched failing.

- [ ] **Step 7: Hide it until the ladder needs it**

Add to `styles/toolbar.css`:

```css
/* The `⋯` exists in every frame and appears only where the ladder has taken something
   off the row — `styles/toolbarFit.css` is where that is decided. */
.pbl-overflow-btn {
	display: none;
}
```

- [ ] **Step 8: Run the gate and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/view/render/toolbarControls.ts src/view/render/toolbar.ts styles/toolbar.css test/view/toolbarOverflow.test.ts
git commit -m "feat: a toolbar overflow menu that mirrors the buttons it duplicates"
```

---

## Task 4: The fit ladder

**Files:**
- Create: `src/view/render/toolbarFit.ts`
- Create: `styles/toolbarFit.css`
- Modify: `styles/index.css`, `styles/toolbar.css`
- Modify: `src/view/render/toolbar.ts` (the label spans, the filter reveal)
- Modify: `src/view/backlogView.ts` (call sites)
- Create: `test/view/toolbarFit.test.ts`

**Interfaces:**
- Consumes: `KEY_ATTR` (Task 1), `renderOverflow` (Task 3).
- Produces: `syncToolbarFit(barEl: HTMLElement): boolean` — true when the step CHANGED.

- [ ] **Step 1: Write the failing test**

Create `test/view/toolbarFit.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { syncToolbarFit } from '../../src/view/render/toolbarFit';
import { fixture, makeView, useViewHarness } from '../helpers/view';

useViewHarness();

/**
 * jsdom lays nothing out, so both widths are 0 and the ladder would decide nothing. The
 * stub is the instrument: `clientWidth` is the pane, and `scrollWidth` answers for the
 * step currently written — which is what makes this a test of the LOOP rather than of a
 * single comparison.
 */
const stubWidths = (bar: HTMLElement, pane: number, needs: Record<string, number>) => {
	Object.defineProperty(bar, 'clientWidth', { value: pane, configurable: true });
	Object.defineProperty(bar, 'scrollWidth', {
		get: () => needs[bar.getAttribute('data-pbl-fit') ?? '0'],
		configurable: true,
	});
};

const toolbarOf = (containerEl: HTMLElement) => {
	const bar = containerEl.querySelector<HTMLElement>('.pbl-toolbar');
	if (!bar) throw new Error('toolbar not rendered');
	return bar;
};

describe('the toolbar fit ladder', () => {
	it('stops at the first step that fits', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 980, '1': 860, '2': 690, '3': 600 });

		syncToolbarFit(bar);

		expect(bar.getAttribute('data-pbl-fit')).toBe('2');
	});

	it('writes no attribute at all when everything fits', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 1200, { '0': 900, '1': 800, '2': 700, '3': 600 });

		syncToolbarFit(bar);

		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);
	});

	it('relaxes when the pane widens again', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 600, { '0': 980, '1': 860, '2': 690, '3': 600 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('3');

		stubWidths(bar, 900, { '0': 980, '1': 860, '2': 690, '3': 600 });
		expect(syncToolbarFit(bar)).toBe(true);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');
	});

	it('holds the last verdict rather than deciding against a pane of zero width', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 980, '1': 860, '2': 690, '3': 600 });
		syncToolbarFit(bar);

		// Detached, or before the first layout: jsdom's own answer, and a real pane's
		// while it is hidden. Deciding here would pick step 3 for every toolbar.
		Object.defineProperty(bar, 'clientWidth', { value: 0, configurable: true });
		expect(syncToolbarFit(bar)).toBe(false);
		expect(bar.getAttribute('data-pbl-fit')).toBe('2');
	});

	it('never reports a change when the step is the same', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 980, '1': 860, '2': 690, '3': 600 });
		expect(syncToolbarFit(bar)).toBe(true);
		expect(syncToolbarFit(bar)).toBe(false);
	});

	/**
	 * The review finding this exists for: revealing the collapsed input adds ~130px to a
	 * row already measured as full, and no resize, render or data update follows the
	 * click — so without this the trailing controls clip under `overflow: hidden` until
	 * something unrelated happens to re-render.
	 */
	it('re-runs when the collapsed filter is revealed', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 720, '1': 690, '2': 600, '3': 560 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');

		// The reveal makes the row wider at every step; the ladder has to notice.
		stubWidths(bar, 700, { '0': 850, '1': 820, '2': 730, '3': 690 });
		containerEl
			.querySelector<HTMLElement>('.pbl-filter-reveal')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(bar.getAttribute('data-pbl-fit')).toBe('3');
	});

	/**
	 * `/` is the documented keyboard path to the filter, and a step that hides the input
	 * is where it would quietly stop working: `focus()` on a `display: none` element does
	 * nothing and reports nothing. Driven through the KEY rather than through
	 * `focusFilter`, so what is asserted is the path a user actually takes.
	 */
	it('still reaches the input from the tree when the step has collapsed it', () => {
		const { view, containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 500, { '0': 980, '1': 860, '2': 690, '3': 600 });
		syncToolbarFit(bar);
		expect(bar.getAttribute('data-pbl-fit')).toBe('3');

		key(treeOf(containerEl), '/');

		expect(containerEl.querySelector('.pbl-filter')?.hasClass('pbl-filter-open')).toBe(true);
		expect(document.activeElement).toBe(containerEl.querySelector('.pbl-filter-input'));
		void view;
	});

	/**
	 * The write-in-flight indicator appears and disappears without a render, so the row
	 * gets wider twice per batch — but a refit per progress TICK would be a forced layout
	 * read per file, which is the cost the deferred update exists to avoid. The rule is
	 * therefore "on the visibility transition, and on nothing between", and both halves
	 * are asserted here: the second half is the one that would rot silently.
	 */
	it('re-runs when the busy indicator appears, and not on the ticks between', () => {
		const { containerEl } = makeView(fixture());
		const bar = toolbarOf(containerEl);
		stubWidths(bar, 700, { '0': 690, '1': 600, '2': 560, '3': 520 });
		syncToolbarFit(bar);
		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);

		// Idle → busy: the indicator takes room the row was not measured with.
		stubWidths(bar, 700, { '0': 780, '1': 690, '2': 600, '3': 560 });
		syncBusy(bar, { done: 1, total: 340 }, false);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');

		// The reservation is this batch's own longest label, not a constant: 340 files
		// means "Updating 340 of 340…", and `writes.length` has no ceiling for a figure
		// in the stylesheet to have been written against.
		const label = bar.querySelector<HTMLElement>('.pbl-busy-label');
		expect(label?.style.minWidth).toBe(`${'Updating 340 of 340…'.length}ch`);

		// A tick. Even if the row claimed it had grown, nothing re-measures — which is
		// only safe BECAUSE of the reservation above.
		stubWidths(bar, 700, { '0': 900, '1': 880, '2': 860, '3': 840 });
		syncBusy(bar, { done: 2, total: 340 }, false);
		expect(bar.getAttribute('data-pbl-fit')).toBe('1');

		// Busy → idle: a transition again, so it re-measures.
		stubWidths(bar, 700, { '0': 690, '1': 600, '2': 560, '3': 520 });
		syncBusy(bar, null, false);
		expect(bar.hasAttribute('data-pbl-fit')).toBe(false);
	});
});
```

Import `syncBusy` from `../../src/view/render/toolbar` at the top of the file.

**What this test cannot reach:** the `min-width` that makes the reservation true is a
stylesheet fact, and jsdom loads no CSS — `getComputedStyle` would report nothing. So the
sentence this file checks is narrower than the rule: *the ladder re-runs on the busy
visibility transition and not on the ticks between it*. That the reserved box is actually
wide enough for "Updating 340 of 340…" is a harness and vault check, and belongs on the
smoke-test note in Task 6.
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/view/toolbarFit.test.ts`
Expected: FAIL — cannot resolve `../../src/view/render/toolbarFit`.

- [ ] **Step 3: Write the module**

Create `src/view/render/toolbarFit.ts`:

```ts
/**
 * The toolbar's fit ladder: how much of the row this pane can hold, and what to drop
 * when it cannot hold all of it. The verdict and its application are in one file for the
 * reason `columnFit` and `syncColumnFit` are (`render/columns.ts`) — a threshold computed
 * in one place and applied in another is one edit from the two disagreeing.
 *
 * Where it parts company with `columnFit` is the instrument. `columnFit` SUMS its terms,
 * which it can do because a column's width is configured. A toolbar control's width is
 * its rendered label: the primary button names a type read from the vault, and every
 * string here is due to be translated. Nothing owns those widths, so this MEASURES —
 * and a measured ladder is also the one that stays right when a theme changes a font.
 *
 * jsdom lays nothing out, so both widths read 0 there; `test/view/toolbarFit.test.ts`
 * stubs them, exactly as the column-fit tests stub the pane.
 */

/** Where the verdict is written. Absent at step 0, which is "all of it fits". */
const FIT_ATTR = 'data-pbl-fit';

/**
 * The last rung. Below it the row clips rather than shedding further: what is left at
 * step 3 is the switcher, the projection's own pickers, the focus, the eye, the filter
 * icon, the `⋯`, the count and New, and none of those has a cheaper form.
 */
const LAST_STEP = 3;

/**
 * Measure the row and write the step it needs. Returns true when the step CHANGED, so a
 * caller that has something to redo can tell — nothing does today, because every rung is
 * CSS over markup that is already rendered.
 *
 * Always re-measured from step 0, never from the step in place: a widened pane has to be
 * able to relax the ladder, and starting from the current rung could only ever tighten it.
 */
export function syncToolbarFit(barEl: HTMLElement): boolean {
	const before = barEl.getAttribute(FIT_ATTR);
	const width = barEl.clientWidth;
	// Zero while detached or before the first layout — `syncColumnFit`'s rule, for the
	// same reason: every row overflows a pane of no width, so deciding here would put
	// every toolbar on the last rung and leave it there until something re-measured.
	if (width === 0) return false;
	barEl.removeAttribute(FIT_ATTR);
	let step = 0;
	while (step < LAST_STEP && barEl.scrollWidth > width) {
		step += 1;
		barEl.setAttribute(FIT_ATTR, String(step));
	}
	return barEl.getAttribute(FIT_ATTR) !== before;
}
```

- [ ] **Step 4: Run the first five tests to verify they pass**

Run: `npx vitest run test/view/toolbarFit.test.ts -t "step"`
Expected: PASS for everything except the reveal test, which still fails — there is no
`.pbl-filter-reveal` yet.

- [ ] **Step 5: Give the shed-able labels their span, and add the reveal**

In `toolbar.ts`, wrap the two remaining bare labels so the ladder can hide them. The New
button:

```ts
	newBtn.createSpan({ cls: 'pbl-btn-label', text: `New ${newLevel}` });
```

and in `renderFocusPicker`, both the enabled and the disabled Deliverables button:

```ts
	btn.createSpan({ cls: 'pbl-btn-label', text: active || 'All types' });
```

```ts
	btn.createSpan({ cls: 'pbl-btn-label', text: 'Deliverables' });
```

Then, in `renderFilterBox`, add the reveal button and the two refit calls. Insert after
the clear button:

```ts
	// Below the step that collapses it, the input is not rendered-and-hidden but
	// display:none, so this button is the control — and it carries the name.
	const reveal = filterEl.createEl('button', {
		cls: 'pbl-filter-reveal clickable-icon',
		attr: { type: 'button', 'aria-label': 'Filter items', [KEY_ATTR]: 'filter-reveal' },
	});
	setIcon(reveal, 'search');
	setTooltip(reveal, 'Filter items');
	reveal.addEventListener('click', () => revealFilter(barEl));
	input.addEventListener('blur', () => {
		// A filter someone is still using is never taken away: only an EMPTY input
		// collapses back.
		if (input.value !== '' || !filterEl.hasClass('pbl-filter-open')) return;
		filterEl.removeClass('pbl-filter-open');
		syncToolbarFit(barEl);
	});
```

Then add `revealFilter` beside `renderFilterBox` in `toolbar.ts` and export it — it is the
one way the input is opened, because `/` has to reach it too:

```ts
/**
 * Open the collapsed filter and focus it. ONE function because there are two inputs: the
 * reveal button's own click, and `focusFilter()` — which is what `/` in the tree and the
 * no-match empty state both call. Below the step that collapses it, that method's
 * `.pbl-filter-input` is `display: none`, and `focus()` on a display:none element does
 * nothing at all, silently — so the documented keyboard path to the filter would die at
 * exactly the pane widths where the filter is hardest to reach.
 *
 * The refit is before the focus, and it is here rather than in the click handler for the
 * same reason the function is shared: the input takes ~130px back on a row already
 * measured as full, and no render follows either caller.
 */
export function revealFilter(barEl: HTMLElement): void {
	barEl.querySelector('.pbl-filter')?.addClass('pbl-filter-open');
	syncToolbarFit(barEl);
	barEl.querySelector<HTMLInputElement>('.pbl-filter-input')?.focus();
}
```

Add the import to `toolbar.ts`:

```ts
import { syncToolbarFit } from './toolbarFit';
```

Then point `focusFilter` at it, in `src/view/backlogView.ts`:

```ts
	focusFilter(): void {
		revealFilter(this.toolbarEl);
	}
```

with `revealFilter` added to the existing `./render/toolbar` import.

- [ ] **Step 6: Run the reveal test to verify it passes**

Run: `npx vitest run test/view/toolbarFit.test.ts -t "revealed"`
Expected: PASS.

- [ ] **Step 7: Watch it fail without the refit**

Comment out the `syncToolbarFit(barEl);` inside the reveal's click handler.

Run: `npx vitest run test/view/toolbarFit.test.ts -t "revealed"`
Expected: FAIL — the attribute is still `1`. Restore the line and re-run: PASS.

- [ ] **Step 8: Write what each step drops**

Create `styles/toolbarFit.css`:

```css
/* What each rung of the fit ladder drops — `src/view/render/toolbarFit.ts` decides which
   rung, and writes it as `data-pbl-fit` on the toolbar. Step 0 is the absence of the
   attribute, so everything here is additive as the pane narrows.

   The row no longer wraps: one row is the guarantee, and a step that still does not fit
   clips rather than growing a second line. */

.pbl-toolbar {
	flex-wrap: nowrap;
	overflow: hidden;
}

/* Step 1 — the words go, the icons and chevrons stay. The accessible name is on the
   button, never in this span, so nothing loses its name here. */
.pbl-toolbar[data-pbl-fit] .pbl-btn-label {
	display: none;
}

/* Step 2 — the filter collapses to its own button, and the dated axis's two singles go
   to the `⋯`. */
.pbl-toolbar:is([data-pbl-fit='2'], [data-pbl-fit='3']) .pbl-filter-input,
.pbl-toolbar:is([data-pbl-fit='2'], [data-pbl-fit='3']) .pbl-filter-icon,
.pbl-toolbar:is([data-pbl-fit='2'], [data-pbl-fit='3']) .pbl-density-toggle,
.pbl-toolbar:is([data-pbl-fit='2'], [data-pbl-fit='3']) .pbl-today-btn {
	display: none;
}

.pbl-toolbar:is([data-pbl-fit='2'], [data-pbl-fit='3']) .pbl-filter-reveal,
.pbl-toolbar:is([data-pbl-fit='2'], [data-pbl-fit='3']) .pbl-overflow-btn {
	display: inline-flex;
}

/* …and back again in two cases, not one. `pbl-filter-open` is the reveal button having
   been pressed. `pbl-filter-active` is the box's existing class for "this input has text
   in it" — and without it, someone who typed a filter at step 0 and then narrowed the
   pane would arrive here with a non-empty, possibly focused input and watch the rung
   hide it: a row that is filtering, says so nowhere, and has taken the text out from
   under a cursor still in it. What a step collapses is only ever an EMPTY filter. */
.pbl-toolbar:is([data-pbl-fit='2'], [data-pbl-fit='3'])
	:is(.pbl-filter-open, .pbl-filter-active)
	.pbl-filter-input {
	display: inline-block;
}

.pbl-toolbar:is([data-pbl-fit='2'], [data-pbl-fit='3'])
	:is(.pbl-filter-open, .pbl-filter-active)
	.pbl-filter-reveal {
	display: none;
}

/* Step 3 — the backfill and both bulk collapse controls go to the `⋯`. Undo stays: it is
   the only control on the row that takes something back. */
.pbl-toolbar[data-pbl-fit='3'] .pbl-write-ctl,
.pbl-toolbar[data-pbl-fit='3'] .pbl-collapse-ctl {
	display: none;
}
```

In `styles/toolbar.css`, **delete** the focus-width rule — it is the same hazard in
miniature, firing on every focus at every step:

```css
/* A little room to breathe while actually typing */
.pbl-filter-input:focus {
	width: 170px;
}
```

and add `display: none;` to `.pbl-filter-reveal` beside `.pbl-overflow-btn`'s.

Import the partial in `styles/index.css`, after `toolbar.css` — the ladder's rules have to
be able to beat the base ones they override:

```css
@import "./toolbar.css";
@import "./toolbarFit.css";
```

- [ ] **Step 9: Call the ladder from the view**

In `src/view/backlogView.ts`, import it:

```ts
import { syncToolbarFit } from './render/toolbarFit';
```

In `renderTreeContent`, immediately after the `renderLegend(...)` call and **before** the
`if (projection !== 'tree') return;` line:

```ts
		// Every render that reaches here can have changed the row's width: the toolbar
		// was rebuilt with a different projection zone, or the count label went from
		// "18 items" to "3 of 18", or the primary button is naming a different type.
		// After the content, because the count is one of the things being measured.
		syncToolbarFit(this.toolbarEl);
```

In the `ResizeObserver` callback in the constructor:

```ts
			this.resizeObserver = new ResizeObserver(() => {
				// The observer watches the TREE, whose box tracks the pane's — and also
				// narrows when the vertical scrollbar appears, which the toolbar's does
				// not. A needless re-measure is one comparison and no render.
				syncToolbarFit(this.toolbarEl);
				if (this.resize.shouldRebuildOnResize()) this.renderTreeContent();
			});
```

- [ ] **Step 9b: Make the busy indicator reserve its width, and refit on its transitions**

Two changes, and they are two halves of one rule: the indicator must not move the row per
tick, and the twice-per-batch appearance it *does* cause must be measured.

In `styles/toolbar.css`, make the label a box that CAN be reserved. The size is not written
here, because no constant can be right — `BusyState.total` is `writes.length`, unbounded,
so any figure in the stylesheet is one large backlog away from being too small, and the
failure it produces is exactly the one the reservation exists to prevent:

```css
/* Reserved rather than fitted: the text changes once per file while a batch runs, and
   `syncBusy` deliberately re-renders nothing, so a box that grew with the count would
   move the row on ticks nothing re-measures. The WIDTH is set per batch by `syncBusy` —
   see there for why it cannot be a constant. The row's end-anchored strip already keeps
   this rule for the add button (`renderAddSpacer`). */
.pbl-busy-label {
	display: inline-block;
}
```

In `src/view/render/toolbar.ts`, `syncBusy` re-runs the ladder on the visibility
transition only:

```ts
/**
 * The longest label this batch can ever show. `total` is fixed for the life of a batch
 * and `done` only climbs toward it, so the widest form is known at the first tick — which
 * is what makes an exact reservation possible where a constant could not be right.
 * Measured in `ch`, the width of a "0": an over-estimate for a proportional font, which
 * is the safe direction for a box whose whole job is not to grow.
 */
function busyReservation(total: number): string {
	return `${total > 1 ? `Updating ${total} of ${total}…` : 'Updating…'}`.length + 'ch';
}

export function syncBusy(barEl: HTMLElement, busy: BusyState | null, canUndo: boolean): void {
	const el = barEl.querySelector<HTMLElement>('.pbl-busy');
	if (el) {
		// Captured before the toggle: the ladder re-runs on idle→busy and busy→idle,
		// which happen twice per batch, and NOT on the ticks between them. `scrollWidth`
		// is a forced layout read, so measuring per file would put back a cost of the
		// same shape as the per-file re-render the deferred update removed. What makes
		// that safe is the reservation set on the SAME transition, two lines down.
		const wasOn = el.hasClass('pbl-busy-on');
		el.toggleClass('pbl-busy-on', busy !== null);
		const label = busy && busy.total > 1 ? `Updating ${busy.done} of ${busy.total}…` : 'Updating…';
		const labelEl = el.querySelector<HTMLElement>('.pbl-busy-label');
		labelEl?.setText(busy ? label : '');
		if (wasOn !== (busy !== null)) {
			// Sized from THIS batch's total, once, at the transition — never from a
			// figure in the stylesheet, which `writes.length` can always exceed.
			labelEl?.setCssProps({ 'min-width': busy ? busyReservation(busy.total) : '0' });
			syncToolbarFit(barEl);
		}
	}
	barEl.querySelectorAll<HTMLButtonElement>('.pbl-write-ctl').forEach((btn) => {
		btn.disabled = busy !== null;
	});
	const undoBtn = barEl.querySelector<HTMLButtonElement>('.pbl-undo-btn');
	if (undoBtn) undoBtn.disabled = busy !== null || !canUndo;
}
```

Keep the rest of the existing doc comment on `syncBusy` — the sentence about touching text
and flags only is still true, and the refit touches neither structure nor text.

- [ ] **Step 9c: Run the busy test, and watch it fail both ways**

Run: `npx vitest run test/view/toolbarFit.test.ts -t "busy indicator"`
Expected: PASS.

Now break each half in turn and watch the right assertion go red — this test claims two
things and a single-direction check would let either rot:

1. Replace `if (wasOn !== (busy !== null))` with `if (true)`. Re-run: FAIL on the tick
   assertion (`'1'` becomes `'3'`).
2. Delete the `syncToolbarFit(barEl)` line entirely. Re-run: FAIL on the transition
   assertion (no attribute is written).

Restore and re-run: PASS.

- [ ] **Step 10: Run the whole view suite**

Run: `npx vitest run test/view/`
Expected: PASS. `test/view/toolbarFocus.test.ts`'s key-uniqueness test now covers
`filter-reveal` and `overflow` — if it fails, two controls share a key and the fix is to
give one its own, never to loosen the assertion.

- [ ] **Step 11: Look at it**

Run: `npm run harness`
Open `.harness/index.html?view=roadmap` and narrow the browser window through the steps.
Confirm the row never wraps, the labels go first, the filter collapses, and the `⋯`
appears with the controls that left.

- [ ] **Step 12: Run the gate and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add src/view/render/toolbarFit.ts src/view/render/toolbar.ts src/view/backlogView.ts styles/ test/view/toolbarFit.test.ts
git commit -m "feat: a measured fit ladder keeps the toolbar to one row"
```

---

## Task 5: The register

Both new modules must be *specified*, or `npm run check` fails on rule 7. This is not
paperwork bolted on at the end — the check is part of the gate every other task already
ran.

**Files:**
- Create: `docs/requirements/A toolbar that fits one row.md`
- Modify: `src/view/CLAUDE.md`

- [ ] **Step 1: Write the PBI note**

Create `docs/requirements/A toolbar that fits one row.md`. Copy the *shape* of
`docs/requirements/Switching projections.md` exactly — frontmatter keys, the use-case
table, **Main flow**, **Extensions**, **Acceptance criteria**, **Where it lives** — since
`docs-check.mjs` gates that shape. Frontmatter:

```yaml
---
type: PBI
parent: "[[Backlog and board]]"
order: 50
status: Done
priority: P2
created: 2026-08-08
files:
  - src/view/render/toolbar.ts
  - src/view/render/toolbarControls.ts
  - src/view/render/toolbarFit.ts
---
```

`order: 50` is the next free sibling order under that feature — 10, 20, 30 and 40 are
`Switching projections`, `What a card shows`, `Board empty states` and `Children on the
card`. `docs-check.mjs` gates sibling orders, so confirm nothing else has taken 50 before
writing it.

`## Where it lives` must name **both** new modules by path and say what each is for —
naming a path is not describing it, and rule 7 reads this section:

> The toolbar's control vocabulary, the projection-zone dispatch and the `⋯` overflow are
> `src/view/render/toolbarControls.ts`; `renderProjectionZone` is the one place the
> toolbar asks which projection it is drawing, so a new projection contributes a case
> rather than a guard of its own. The ladder is `src/view/render/toolbarFit.ts` —
> `syncToolbarFit` measures the rendered row and writes the step as `data-pbl-fit`, which
> `styles/toolbarFit.css` reads; it measures rather than summing its terms, unlike the
> column ladder beside it, because a control's width is its translated label and nothing
> owns that. `src/view/render/toolbar.ts` keeps the render order, the focus-key mechanism
> and the four `sync*` functions. Driven in `test/view/toolbar.test.ts`,
> `test/view/toolbarOverflow.test.ts` and `test/view/toolbarFit.test.ts`.

Extensions to cover, at minimum: the zone is empty on three of four projections; the last
rung still does not fit and the row clips; a control shed at a rung is still reachable in
the `⋯`; and a `⋯` entry is disabled with the button it duplicates.

- [ ] **Step 2: Run the register gate**

Run: `node scripts/docs-check.mjs`
Expected: `✓ register and ADRs consistent`.

- [ ] **Step 3: Add the rules to the layer guide**

In `src/view/CLAUDE.md`, in the **Controls** section, add two bullets. Write them as
rules, not as an inventory of the modules — the root guide's own instruction.

```markdown
- **The toolbar is zones, and only one of them belongs to the projection.** The switcher
  leads, `renderProjectionZone` draws whatever this projection owns and *nothing* when it
  owns none — the zone and its leading separator are created together and removed
  together, decided from what was drawn rather than from a second reading of the settings
  — then the spacer, then the controls that are the same in every projection. Adding a
  projection is adding a case to that switch; a control added anywhere else in the row is
  a claim that it belongs to every projection.
- **The row never wraps, and what it sheds it does not withhold.** `syncToolbarFit`
  (`render/toolbarFit.ts`) measures the rendered row and writes a step as `data-pbl-fit`;
  `styles/toolbarFit.css` says what each step drops. It MEASURES where `columnFit` sums,
  because a control's width is its translated label and nothing owns that. Anything that
  changes a control's own width re-runs it, not only a resize — revealing the collapsed
  filter is a ~130px change with no render behind it, which is why the `:focus` width
  growth the input used to have was deleted rather than accommodated. Every control a
  step drops is in the `⋯`, and each entry is disabled exactly when the button it
  duplicates is, read off that button's `disabled` property: `syncCollapseCtls` and
  `syncBusy` own that flag, and a condition re-derived in the menu would be a second
  opinion about it.
```

- [ ] **Step 4: Run the gate and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add docs/requirements/ src/view/CLAUDE.md
git commit -m "docs: the toolbar's zones and its fit ladder, specified"
```

---

## Task 6: Verify, and say what is still owed

**Files:**
- Modify: `docs/issues/Smoke test the visual changes.md`

- [ ] **Step 1: Run the whole gate on a clean tree**

```bash
git status --porcelain   # expect empty — the harness mock must not be committed
npm run check
```
Expected: PASS, all five steps. If `test/harness/mock.ts` exists, move it out of the
repository first: nothing imports it, so `npm run analyze` correctly reports it dead.

- [ ] **Step 2: Check the harness's own guards still hold**

Run: `npx vitest run test/harness/harness.test.ts`
Expected: PASS — in particular the icon check, which is what says `gantt-chart` resolves.
It resolving in `lucide-static` is **not** proof Obsidian ships that name; that is the
vault check below.

- [ ] **Step 3: Build the vault handover**

Run: `npm run test-build`
Then open this repository as a vault and open `docs/Product Backlog.base`.

- [ ] **Step 4: Record what only a vault can answer**

Append to `docs/issues/Smoke test the visual changes.md` a checklist for this change:

- The segmented switcher's active position reads as active under a theme that replaces
  `--interactive-accent` and `--background-modifier-active-hover`.
- `gantt-chart` renders a glyph in Obsidian, which bundles its own older lucide — a name
  absent from that release draws nothing at all.
- The `⋯` and the collapsed filter at a narrow pane width, on a real split.
- The row does not clip anything at the last rung in a genuinely narrow split pane.
- `/` opens the collapsed filter and focuses it at a narrow width — jsdom asserts the
  class and the active element, not that a real browser can focus what CSS just revealed.
- The busy label's per-batch reservation actually holds its longest form. jsdom loads no
  CSS, so the suite can see that a `min-width` is SET and not that it is wide enough —
  `ch` is the width of a "0" and the label is mixed text, so the estimate is generous but
  unverified here. Run a backfill (✨) over a few hundred notes and watch whether the row
  moves as the count climbs.
- A filter typed at a wide width survives the pane narrowing into a collapsing rung: the
  input stays, with its text and its cursor.

- [ ] **Step 5: Commit and push**

```bash
git add docs/issues/
git commit -m "docs: what the toolbar overhaul still owes a vault"
git push -u origin claude/toolbar-ux-ui-overhaul-uahylz
```

---

## Self-review notes

Checked against the spec:

- Five zones → Task 2 (dispatch), Task 4 (`nowrap`), styling in both.
- The seam for a fifth projection → Task 2, Step 4.
- Measured ladder, `data-pbl-fit`, three steps → Task 4.
- Reveal refit and the deleted `:focus` growth → Task 4, Steps 5 and 8, tested in Step 6
  and watched failing in Step 7.
- `revealFilter` shared by the button and `/` → Task 4, Step 5, tested in Step 1.
- The busy indicator's reserved width and its two transitions → Task 4, Steps 9b and 9c,
  watched failing in both directions.
- `⋯` contents fixed against the STEP and conditioned on the PROJECTION, disabled mirror →
  Task 3, watched failing in Step 6.
- `.pbl-mode-btn.is-active` → Task 2, Step 8.
- The `calendar-range` collision → Task 2, Steps 1 and 5 (the test asks the menus, so it
  holds for the next pick too).
- Labels shed visually only → Task 2, Steps 6b and 6c. This was NOT true as first written:
  the New button and the focus picker take their accessible name from the very text the
  ladder hides, and `test/view/toolbarFocus.test.ts` asserts that absence today. Both get
  an explicit `aria-label`, and the sweep in 6c checks the rule at every `.pbl-btn-label`
  rather than at a list of two.
- A non-empty filter is never collapsed → Task 4, Step 8; the rung's exception is
  `pbl-filter-open` OR `pbl-filter-active`.
- Focus keys → new controls carry `overflow` and `filter-reveal`;
  `test/view/toolbarFocus.test.ts` is the check, run in Task 4, Step 10.
- Register → Task 5.
- Live-vault debt → Task 6.

One thing this plan does NOT carry from the spec: the spec says the ladder is "driven from
`ResizePolicy`". It is not — `ResizePolicy`'s constructor already takes five parameters
(`max-params: 5`), so adding the toolbar element would break lint. The view calls
`syncToolbarFit` directly from the two places the row's width can change. `ResizePolicy`
still owns when to re-measure the *tree*; the toolbar's trigger sits beside it rather than
inside it. Update the spec's wording when this lands.
