import { Menu, setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { cardPaths as boardCardPaths } from '../../domain/board';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { activeAxis, configuredAxes, RoadmapAxis, RoadmapModel } from '../../domain/roadmap';
import { ScaleId } from '../../domain/timeline';
import { showMenuForClick } from '../interactions/menu';
import { runInit } from '../interactions/structure';
import { focusInBar } from './toolbarFit';

/** Where a toolbar control carries its focus identity — see `capturedFocusKey`. */
export const KEY_ATTR = 'data-pbl-key';

/**
 * The identity focus is restored by: a per-control key, written where the control is
 * created and the same string on the control the next render builds in its place.
 *
 * Not the class — `.pbl-mode-btn` names all four positions of the projection switcher —
 * and not `aria-label`, which is neither always present nor always stable. `.pbl-new-btn`
 * and `.pbl-focus-btn` were named by their text content and carried no label at all, so
 * nothing could be captured for them — they have one now, because the fit ladder hides
 * that text, and it is `New Epic`/`New Feature`, which moves with the focus level; and
 * the completed toggle's label flips between
 * 'Hide completed items' and 'Show completed items (3 hidden)' across the very rebuild
 * its own click causes, so the control whose press ALWAYS re-renders was the one that
 * could never be restored. A key is independent of both.
 *
 * What that guarantees is exactly what carries a key: a control created without one is
 * not restored, and nothing here can see that it was meant to be. The check under the
 * sentence is `test/view/toolbarFocus.test.ts`, which asserts every focusable element
 * the toolbar renders — across the three projections, under a focus level — carries a
 * key, and that no two share one.
 */
export function capturedFocusKey(barEl: HTMLElement): string | null {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !barEl.contains(active)) return null;
	return active.getAttribute(KEY_ATTR);
}

/**
 * The other half of {@link KEY_ATTR}: find the rebuilt control wearing that key and
 * focus it. Moved here from `toolbar.ts` with the attribute it reads, because it has a
 * SECOND caller now — a menu pick, which is a rebuild the render-pass mechanism cannot
 * see. `capturedFocusKey` moves with it: a mechanism split across two files is one edit
 * from the halves disagreeing about the attribute they share.
 *
 * **The named control may not be focusable when the restore happens**, which is why this
 * goes through `focusInBar` rather than calling `focus()` on what it finds. The fit
 * ladder hides controls, `disabled` takes others, and `focus()` on either is a silent
 * no-op that drops focus to the document — the failure `refocusShedControl` exists to
 * prevent, reachable through this function instead. It is stated here as the shared
 * hazard rather than fixed in the caller that surfaced it (the `⋯`, whose own trigger a
 * relaxing rung can hide while its menu is open) because every restore path runs
 * through this one line.
 */
export function refocusByKey(barEl: HTMLElement, key: string | null): void {
	if (!key) return;
	focusInBar(barEl, barEl.querySelector<HTMLElement>(`[${KEY_ATTR}="${key}"]`));
}

/**
 * Act, then put focus on the control wearing `key` in the toolbar the act rebuilt —
 * NAMING where focus should land rather than hoping the render pass can work it out.
 *
 * `capturedFocusKey` cannot, in either of the two cases here. A **menu pick**: while a
 * `Menu` is open focus is on the body — Obsidian attaches the menu there — so the capture
 * finds nothing inside the bar, `barEl.empty()` destroys the button that opened it, and
 * focus lands on the document. A **control that removes itself**: the focus-clear button
 * is the one that exists, and it is not a menu at all — clearing the focus is exactly
 * what unrenders `.pbl-focus-clear`, so its own key has no replacement to be found and
 * the named destination is the focus button beside it.
 *
 * `render/shelfControls.ts` already answers this shape with its own `refocus` callback;
 * this is that answer, keyed rather than selector-based because the toolbar already has
 * keys. `barEl` outlives the rebuild, so the lookup finds the replacement.
 *
 * The rule, not a list of who is in it — the earlier version named "the axis, the
 * zoom, and the focus picker's menu and its clear button" and went stale twice, once
 * per control added after it was written: **anything on this row whose activation
 * re-renders the toolbar while focus is elsewhere, or which destroys the control that
 * was pressed, goes through it.** The New-type chevron is the one menu that does not:
 * its entries open the creation prompt, which takes focus deliberately, so restoring
 * focus here would fight the modal for it — a genuine carve-out, not an omission from
 * the rule above.
 */
export function pickAndRefocus(barEl: HTMLElement, key: string, act: () => void): void {
	act();
	refocusByKey(barEl, key);
}

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
 * A labelled menu button: an icon, the current value in words, a chevron. The text is
 * its own span so the fit ladder can hide it without touching the accessible name, which
 * stays on the button.
 *
 * `label` is the VISIBLE value ("Timeline"), which is not, on its own, an accessible
 * NAME — a reader hears "Timeline, button" with no purpose attached. `ariaLabel` is
 * "Purpose: Value" (`renderFocusPicker`'s own `Focus: ${…}` shape), defaulting to the
 * bare label for a caller that has not been given one. Every caller opens a `Menu` on
 * click, so `aria-haspopup="menu"` is set here once rather than at each of them —
 * baked into the shared constructor, not swept for afterwards.
 */
function menuButton(
	parent: HTMLElement,
	icon: string,
	label: string,
	key: string,
	ariaLabel: string = label,
): HTMLButtonElement {
	// `clickable-icon` for the same reason every other control in this row carries it:
	// the padding, the radius and the hover fill are Obsidian's, and a control that
	// styles those itself is a control that stops matching the app when the app moves.
	// Without it this was a bare `<button>` wearing the app's default chrome — a filled,
	// bordered box among flat icons, which is the one control in the row that looked
	// like a form submit.
	const btn = parent.createEl('button', {
		cls: 'clickable-icon pbl-menu-btn',
		attr: { type: 'button', 'aria-label': ariaLabel, 'aria-haspopup': 'menu', [KEY_ATTR]: key },
	});
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), icon);
	btn.createSpan({ cls: 'pbl-btn-label', text: label });
	setIcon(btn.createSpan({ cls: 'pbl-btn-chevron' }), 'chevron-down');
	return btn;
}

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
			renderAxisPicker(host, zone, barEl);
			renderTimelineControls(host, zone, barEl);
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
function renderAxisPicker(host: BacklogViewHost, zone: HTMLElement, barEl: HTMLElement): void {
	// Two refusals in one line, and the order is the honest one: with no axis at all
	// there is nothing to NAME, and with one there is nothing to choose between.
	const active = activeAxis(host.settings, host.axisPick);
	if (active === null || configuredAxes(host.settings).length < 2) return;
	const btn = menuButton(zone, AXIS_LABEL[active].icon, AXIS_LABEL[active].text, 'axis', `Roadmap axis: ${AXIS_LABEL[active].text}`);
	setTooltip(btn, 'Roadmap axis');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		const choice = (axis: RoadmapAxis) =>
			menu.addItem((mi) =>
				mi
					.setTitle(AXIS_LABEL[axis].text)
					.setIcon(AXIS_LABEL[axis].icon)
					.setChecked(active === axis)
					// `barEl`, not `zone`: the zone is destroyed by the rebuild this pick
					// causes, and the bar is what survives it.
					.onClick(() => pickAndRefocus(barEl, 'axis', () => host.setAxisPick(axis))),
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
function renderTimelineControls(host: BacklogViewHost, zone: HTMLElement, barEl: HTMLElement): void {
	if (activeAxis(host.settings, host.axisPick) !== 'dates') return;
	const btn = menuButton(
		zone,
		ZOOM_LABEL[host.zoom].icon,
		ZOOM_LABEL[host.zoom].text,
		'zoom',
		`Timeline zoom: ${ZOOM_LABEL[host.zoom].text}`,
	);
	setTooltip(btn, 'Timeline zoom');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const id of ['week', 'month', 'quarter'] as ScaleId[]) {
			menu.addItem((mi) =>
				mi
					.setTitle(ZOOM_LABEL[id].text)
					.setIcon(ZOOM_LABEL[id].icon)
					.setChecked(host.zoom === id)
					.onClick(() => pickAndRefocus(barEl, 'zoom', () => host.setZoom(id))),
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

/**
 * What the bulk collapse controls can reach — a DIFFERENT question from
 * `countedPopulation` in `toolbar.ts`, which is why it is a second function rather than a
 * reuse: counting asks for the Base's rows, and collapsing asks for everything on screen
 * that owns a disclosure, context rows included, minus every path a CARD of its own is
 * drawn for — that toggle is the card's alone to press, never the toolbar's.
 *
 * The exclusion is asked of the board/roadmap's own STRUCTURE ({@link cardOnlyPaths}),
 * never of `host.cardChildrenShown` — that register answers only for a card that drew a
 * disclosure THIS pass, so a card whose children are all currently hidden (completed work
 * folded away, or none loaded yet) would stay reachable and reopen later, the moment a
 * hidden child resurfaces, from a write nobody watching that card ever asked for.
 *
 * Every Deliverable is a card of its own — there is nothing else in that projection's
 * population — so it is excluded outright rather than asked to name its cards one at a
 * time; this replaces the earlier `model.deliverableResults` special case, which existed
 * only so a focus set elsewhere could not hide a Deliverable from `model.items` — moot
 * now that every Deliverable is excluded either way.
 */
function collapsiblePopulation(host: BacklogViewHost, model: BacklogModel): BacklogItem[] {
	if (host.projection === 'deliverables') return [];
	const excluded = cardOnlyPaths(host);
	return model.items.filter((item) => !excluded.has(item.file.path));
}

/**
 * Paths a card of its own is currently drawn for — board cards, and on the roadmap its
 * bucket, shelf and context cards alike. `domain/board.ts`'s `cardPaths` already answers
 * this for the board (also reused, unmodified, for the Deliverables board's own workflow
 * columns while it renders — see `renderDeliverablesBoardContent`); the roadmap has no
 * such helper, so its bucket, shelf and context lists are read directly.
 *
 * A dated-axis timeline row is never in this set: `RoadmapModel.bars` is never read here,
 * so [[Collapsing a bar's subtree]]'s row folding stays reachable by the bulk controls
 * while any shelf or context card sharing that same screen does not.
 */
function cardOnlyPaths(host: BacklogViewHost): ReadonlySet<string> {
	if (host.projection === 'board' && host.board) return boardCardPaths(host.board.board);
	if (host.projection === 'roadmap' && host.roadmap) return roadmapCardPaths(host.roadmap.roadmap);
	return new Set();
}

function roadmapCardPaths(roadmap: RoadmapModel): Set<string> {
	const paths = new Set<string>();
	for (const bucket of roadmap.buckets) for (const card of bucket.cards) paths.add(card.file.path);
	for (const card of roadmap.shelf) paths.add(card.item.file.path);
	for (const card of roadmap.context) paths.add(card.file.path);
	return paths;
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
	spec: { icon: string; label: string; cls: string; mutate: () => void },
): void {
	const btn = iconButton(parent, spec.icon, spec.label);
	btn.addClass('pbl-collapse-ctl');
	btn.addClass(spec.cls);
	btn.addEventListener('click', () => {
		// A click on the icon `<svg>` inside a disabled button still reaches this
		// listener (only `btn.click()` on the button itself is blocked by `disabled`),
		// so the guard has to be read here rather than trusted from the DOM state —
		// same shape as the card disclosure toggle in `render/cardChildren.ts`.
		if (btn.disabled) return;
		spec.mutate();
		host.render();
	});
}

/** One `⋯` entry: what it says, and the button whose state it mirrors. */
interface OverflowEntry {
	title: string;
	icon: string;
	cls: string;
	run: () => void;
}

/**
 * Every action the fit ladder can take off the row, in row order. Fixed rather than
 * derived from the current step — a menu whose contents tracked the verdict would be a
 * second opinion about it, and a duplicated entry for a control still on screen is
 * harmless and already the pattern here (the card menu carries the state chip's values
 * while the chip is visible).
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
			// The guard `collapseButton` carries, for the same reason it carries it: the
			// entry going `setDisabled` is a request to the `Menu`, and the only thing
			// between a disabled entry and a real collapse write is that `Menu` honouring
			// it. The button does not trust the DOM state either — a click on the icon
			// inside a disabled button reaches its listener — so the two bulk actions ask
			// the one question (`collapseCtlsDisabled`) at both of their entry points.
			run: () => {
				if (collapseCtlsDisabled(host)) return;
				expandAll(host);
				host.render();
			},
		},
		{
			title: 'Collapse all',
			icon: 'chevrons-down-up',
			cls: 'pbl-collapse-all-ctl',
			run: () => {
				if (collapseCtlsDisabled(host)) return;
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
	btn.setAttribute('aria-haspopup', 'menu');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		for (const entry of overflowEntries(host, barEl)) {
			const mirrored = barEl.querySelector<HTMLButtonElement>(`.${entry.cls}`);
			menu.addItem((mi) =>
				mi
					.setTitle(entry.title)
					.setIcon(entry.icon)
					// Both of the button's states, not just one. `disabled` says whether
					// the entry can be picked; `aria-pressed` says whether it is ON — and
					// at the steps where this menu is the only copy of the density
					// toggle, an unchecked "Compact rows" that turns compact rows OFF is
					// the entry stating the opposite of what it does. A toggle is the one
					// kind of entry where omitting the state inverts the meaning.
					.setDisabled(mirrored?.disabled === true)
					.setChecked(mirrored?.getAttribute('aria-pressed') === 'true')
					// Every entry here re-renders, and focus is in the menu while it
					// does — so the `⋯` gets its own key back, not the shed button's,
					// which may not exist at the resulting step.
					.onClick(() => pickAndRefocus(barEl, 'overflow', entry.run)),
			);
		}
		showMenuForClick(menu, evt);
	});
}
