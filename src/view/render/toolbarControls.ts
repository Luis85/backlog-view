import { Menu, setIcon, setTooltip } from 'obsidian';
import { hasColorableStates, openStateColors } from '../interactions/stateColors';
import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { projectionPopulation, toolbarPosition, treeShaped } from '../projection';
import { isIterationType } from '../../domain/itemTypes';
import { selectableIteration } from '../../domain/iterations';
import { activeAxis, configuredAxes, drawsGrid, RoadmapAxis } from '../../domain/roadmap';
import { ScaleId } from '../../domain/timeline';
import { showMenuForClick } from '../interactions/menu';
import { runInit } from '../interactions/structure';
import { promptEditIteration, promptNewIteration } from '../interactions/create';
import { focusInBar } from './toolbarFit';
import { openManual } from '../../ui/manualDialog';
import { manualSections } from '../manual/sections';

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
 * was pressed, goes through it.** An entry that opens a MODAL is the carve-out, not an
 * omission from the rule above: a modal takes focus deliberately, and `run()` returns
 * the instant it opens rather than when it closes, so restoring focus here would pull
 * it straight back off the dialog while it is still opening. The New-type chevron's
 * entries (the creation prompt) and the manual entry (`openManual`) both take this
 * shape, and both skip this function for the same reason rather than for two.
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
 * A text write that is not a DOM mutation when the text has not changed. Both callers
 * write into a live region — `.pbl-busy` is `role="status"` and `.pbl-count-label`
 * carries an `aria-live="polite"` of its own — and **a live region announces on
 * MUTATION, not on a changed value**: `setText` assigns `textContent`, which destroys
 * the text node and builds a new one even when the string is identical. So the fixed
 * label a redesign introduced to stop a 340-file backfill announcing 340 times still
 * announced 340 times, and the count label — which is rewritten on every content render
 * — announced once per filter keystroke. The guard is what makes "the drawn text does
 * not change" a fact about the DOM rather than about the string.
 *
 * Two call sites, in two different files since `toolbar.ts` split into one module per
 * subject (`toolbarBusy.ts`'s `syncBusyLabel`/`syncBusyCount`, `toolbarStatus.ts`'s
 * `syncCountLabel`) — a shared helper here rather than a two-line local repeated in
 * each, which is what "two call sites in one file" argued for before the split made
 * that premise false.
 */
export function setTextIfChanged(el: HTMLElement, text: string): void {
	if (el.textContent !== text) el.setText(text);
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
 * What separates it from the head of the row is SPACING, carried by the zone's own class
 * (`styles/toolbar.css`), and no longer a drawn divider. That is one element fewer and,
 * more to the point, one thing fewer that can be left behind: the divider and the zone
 * were created together and removed together precisely because a separator introducing
 * nothing is a rule the row states and does not keep, and a margin on the zone cannot
 * outlive it. Emptiness is still decided from what was DRAWN rather than from a second
 * reading of the settings, so nothing here can disagree with the pickers about whether
 * this projection contributed anything.
 */
export function renderProjectionZone(host: BacklogViewHost, barEl: HTMLElement): void {
	const zone = barEl.createDiv({ cls: 'pbl-zone pbl-zone-projection' });
	// The POSITION rather than the projection, so the zone a control was drawn FROM is
	// the zone it is drawn in again on the next pass — asked directly, the board's zone
	// would vanish the moment its own picker moved the view to an iteration.
	switch (toolbarPosition(host.projection)) {
		case 'roadmap':
			renderAxisPicker(host, zone, barEl);
			renderBucketGridToggle(host, zone);
			renderTimelineControls(host, zone, barEl);
			renderStateColorsButton(host, zone, barEl);
			break;
		default:
			// The tree, the board and the Deliverables board own no toolbar controls of
			// their own today. A projection that grows one adds a case, not a guard
			// somewhere else in the row.
			break;
	}
	if (zone.childElementCount === 0) zone.remove();
}

/**
 * The way into the state-colour dialog, and the only one — there is no palette command and
 * no `⋯` entry, because neither could say WHERE the colours apply.
 *
 * It renders under the legend's own gate: roadmap mode, the dated axis, and a workflow
 * whose states a colour can be stored against. That is the one screen a state colour is
 * drawn on, so a control anywhere else would claim it affects the tree and the board, which
 * it does not — and a control offered with nothing to colour would open onto an empty
 * dialog. `hasColorableStates` is asked rather than restated here, so the button and what
 * the dialog can actually show cannot drift apart.
 */
function renderStateColorsButton(host: BacklogViewHost, zone: HTMLElement, barEl: HTMLElement): void {
	const axis = activeAxis(host.settings, host.axisPick);
	if (axis === null || !drawsGrid(axis) || !hasColorableStates(host)) return;
	const btn = iconButton(zone, 'palette', 'State colours', 'state-colors');
	btn.addClass('pbl-state-colors-btn');
	// Focus is put back at CLOSE time and looked up then, never captured: every change the
	// dialog makes writes the `.base`, which rebuilds this toolbar — so the button pressed
	// is detached by the time the dialog closes, and a modal returning focus to its opener
	// would hand it to an element no longer in the document. `⋯ → Open the manual` records
	// the same hole; this path meets it on every use rather than never.
	btn.addEventListener('click', () =>
		openStateColors(host, () => focusInBar(barEl, barEl.querySelector<HTMLElement>('.pbl-state-colors-btn'))),
	);
}

/** Axis labels, one place, so the button and its menu cannot name it differently. */
const AXIS_LABEL: Record<RoadmapAxis, { icon: string; text: string }> = {
	// `gantt-chart`, not `calendar-range`: that glyph is the zoom's Quarters, and two
	// controls in one row wearing one icon is what the harness mock caught.
	dates: { icon: 'gantt-chart', text: 'Timeline' },
	horizons: { icon: 'columns-3', text: 'Horizons' },
	// `users`, not `user`: the axis is every resource at once, and no other control in
	// this row wears it.
	resources: { icon: 'users', text: 'Resources' },
};

/** Zoom labels, same rule. */
const ZOOM_LABEL: Record<ScaleId, { icon: string; text: string }> = {
	week: { icon: 'calendar-days', text: 'Weeks' },
	month: { icon: 'calendar', text: 'Months' },
	quarter: { icon: 'calendar-range', text: 'Quarters' },
};

/**
 * Which axis this saved view shows — offered only while more than one is configured: with
 * one there is no choice to make, and the axis that remains always beats guidance. The
 * pick persists the way the mode itself does, and it is retained when its axis loses its
 * configuration, so restoring the cleared property restores the saved choice with it.
 *
 * The entries are `configuredAxes` itself, in its own priority order, never a list of
 * names spelled here: with exactly two axes a literal list was the same thing, and with a
 * third it stopped being — two configured out of three would have offered the
 * unconfigured one, whose pick `activeAxis` then falls straight back out of, so the menu
 * would show a choice that visibly does nothing.
 */
function renderAxisPicker(host: BacklogViewHost, zone: HTMLElement, barEl: HTMLElement): void {
	// Two refusals in one line, and the order is the honest one: with no axis at all
	// there is nothing to NAME, and with one there is nothing to choose between.
	const active = activeAxis(host.settings, host.axisPick);
	const axes = configuredAxes(host.settings);
	if (active === null || axes.length < 2) return;
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
		for (const axis of axes) choice(axis);
		showMenuForClick(menu, evt);
	});
}

/**
 * Which board the `Boards` position opens: the product's, the Deliverables board's, or
 * one iteration's. The Deliverables entry sits directly under `Product` — it held a
 * toggle position of its own until 2026-08-16, when the user moved it here; the two are
 * the boards over a whole population, so they share the head of the menu and both wear
 * an icon, while the iterations below the separator are a list of notes.
 *
 * **Unconditional at the board's position** since the same day: the picker used to gate
 * on the iteration property, and now only its ITERATION section does — with the property
 * unconfigured the menu is `Product` and `Deliverables` alone, because the Deliverables
 * board needs nothing configured to exist. It still carries the only `New iteration…`
 * (never withheld on an empty vault, which is every vault that has not started), and it
 * draws at the BOARD's own toolbar position and nowhere else — the door is the `Boards`
 * button, and this picker says which board came through it.
 *
 * The iteration entries are read off `model.byPath` for `iterationTargets`' reason
 * (`interactions/labels.ts`): a focus set on another projection re-roots what is DRAWN,
 * and an iteration hangs from nothing, so a top-level one would go unofferable exactly
 * when the reader had narrowed the tree. Context rows are excluded — an excluded note is
 * not this base's vocabulary — and colliding basenames are qualified by path, ONLY where
 * they collide, since qualifying every entry to separate a rare pair makes the ordinary
 * case unreadable. What a pick carries is the NOTE either way.
 */
export function renderBoardScopePicker(host: BacklogViewHost, barEl: HTMLElement, model: BacklogModel): void {
	// The BOARD's control, so it draws at the board's own position and nowhere else.
	if (toolbarPosition(host.projection) !== 'board') return;
	// Empty with the property unconfigured, deliberately, rather than the list the model
	// could still supply: a scope no card can ever reach must be neither offered nor
	// allowed to NAME the button — a stale retained path would otherwise caption a button
	// whose board draws the product.
	const iterations = !host.settings.iterationKey
		? []
		: [...model.byPath.values()].filter((item) => isIterationType(item.typeName) && !item.outsideFilter);

	const seen = new Map<string, number>();
	for (const item of iterations) seen.set(item.title, (seen.get(item.title) ?? 0) + 1);
	const labelOf = (item: BacklogItem): string =>
		(seen.get(item.title) ?? 0) > 1 ? item.file.path.slice(0, -(item.file.extension.length + 1)) : item.title;

	// The RETAINED scope names the button, as long as it still names a selectable
	// iteration — which is not the same as `effectiveScope`, and the difference is this
	// control's whole job. Off the `Boards` position the effective scope is null, while
	// `Boards` still reopens the retained one: named from the effective scope, the button
	// said `Product` over a button that would open Sprint 12. A scope that no longer
	// RESOLVES falls back to `Product` on both, because then nothing reopens it either.
	// Found by review
	// (Codex, PR #154).
	const onDeliverables = host.projection === 'deliverables';
	const current = selectableIteration(iterations, host.boardScope);
	const scope = current?.file.path ?? null;
	const name = onDeliverables ? SCOPE_DELIVERABLES : current === null ? SCOPE_PRODUCT : labelOf(current);
	const btn = menuButton(zoneFor(barEl), 'target', name, 'scope', `Board scope: ${name}`);
	btn.addClass('pbl-scope-btn');
	setTooltip(btn, 'Which board the Board position opens');
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		const choice = (title: string, icon: string | null, checked: boolean, act: () => void) =>
			menu.addItem((mi) => {
				// `barEl`, not the wrapper: the pick rebuilds the row, and the bar is
				// what survives it.
				mi.setTitle(title)
					.setChecked(checked)
					.onClick(() => pickAndRefocus(barEl, 'scope', act));
				if (icon !== null) mi.setIcon(icon);
			});
		// The two whole-population boards lead, each under the icon its toolbar control
		// wears elsewhere — the Board button's own for the product, the Deliverable type's
		// for its board — so the entry and the surface it opens say the same thing.
		choice(SCOPE_PRODUCT, 'square-kanban', !onDeliverables && scope === null, () => host.setBoardScope(null));
		choice(SCOPE_DELIVERABLES, 'package', onDeliverables, () => host.setProjection('deliverables'));
		// The boards are not among the iterations, so a rule says so: the scopes below
		// this line are a list of notes, and each board is the absence of one.
		if (iterations.length > 0) {
			menu.addSeparator();
			for (const item of iterations) {
				choice(labelOf(item), null, item.file.path === scope, () => host.setBoardScope(item.file.path));
			}
		}
		if (host.settings.iterationKey) {
			menu.addSeparator();
			// Below the scopes, and the edit only while an iteration IS the chosen scope —
			// there is nothing else it could be editing.
			menu.addItem((mi) =>
				mi
					.setTitle('New iteration…')
					.setIcon('calendar-plus')
					.onClick(() => promptNewIteration(host, model)),
			);
			if (current !== null) {
				menu.addItem((mi) =>
					mi
						.setTitle('Edit iteration…')
						.setIcon('pencil')
						.onClick(() => promptEditIteration(host, current)),
				);
			}
		}
		showMenuForClick(menu, evt);
	});
}

/** What the picker calls the whole backlog — the scope every board had before this one. */
const SCOPE_PRODUCT = 'Product';
/** The Deliverables board's entry, directly under Product — its toggle position until 2026-08-16. */
const SCOPE_DELIVERABLES = 'Deliverables';

/**
 * The picker's own slot in the row, made on demand: it sits with the switcher rather than
 * in the projection zone, and a wrapper drawn before the refusals above would be an empty
 * box in every projection that is not the board and every vault that names no iteration
 * property.
 */
function zoneFor(barEl: HTMLElement): HTMLElement {
	return barEl.createDiv({ cls: 'pbl-zone pbl-zone-scope' });
}

/**
 * What the bucket-layout toggle says, looks like saying and does — one statement for the
 * toolbar button and its `⋯` entry, `clickActionToggle`'s rule below: two inputs on one
 * value, never two derivations of it.
 *
 * The setting is named for the GRID, which is the default, so `aria-pressed` is true until
 * the reader turns it off. The stored pick is the other way round (`viewState.ts` keeps
 * that inversion, since the store writes nothing for a default), and nothing above the
 * store has to know.
 */
const BUCKET_GRID_LABEL = 'Grid in buckets';

function bucketGridToggle(host: BacklogViewHost): { grid: boolean; icon: string; flip: () => void } {
	const grid = host.bucketGrid;
	return { grid, icon: grid ? 'layout-grid' : 'rows-3', flip: () => host.setBucketGrid(!grid) };
}

/**
 * How a bucket lays its cards out, on the one axis that draws buckets. A wide bucket
 * reflows its cards into several columns, which is what [[Buckets that use the room they
 * have]] built and what most panes want; one card per row is the other reading of the same
 * width, and which one a reader wants is a habit rather than a property of the base — so it
 * is working position (ADR 0011) beside the density toggle the grid axes get.
 *
 * Absent on every other screen for the density toggle's reason: a control that changes
 * nothing on the screen in front of you is worse than one that is not there.
 */
function renderBucketGridToggle(host: BacklogViewHost, zone: HTMLElement): void {
	if (activeAxis(host.settings, host.axisPick) !== 'horizons') return;
	const { grid, icon, flip } = bucketGridToggle(host);
	const btn = iconButton(zone, icon, BUCKET_GRID_LABEL);
	btn.addClass('pbl-bucket-grid-toggle');
	btn.toggleClass('is-active', grid);
	btn.setAttribute('aria-pressed', String(grid));
	btn.addEventListener('click', flip);
}

/**
 * The zoom picker, jump-to-today and the density toggle, on whichever axis draws the
 * GRID — the horizon axis has no density to choose and no today to return to, and the
 * resources axis has both, being the same grid grouped into rows.
 */
function renderTimelineControls(host: BacklogViewHost, zone: HTMLElement, barEl: HTMLElement): void {
	const axis = activeAxis(host.settings, host.axisPick);
	if (axis === null || !drawsGrid(axis)) return;
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
 * The click-action toggle's name, fixed: it names the SETTING rather than the next
 * action, so `aria-pressed` can carry the value without the two contradicting each
 * other. See `renderClickActionToggle`.
 */
export const CLICK_ACTION_LABEL = 'Clicking a row folds it';

/**
 * Where the click-action setting has an effect, and therefore where its toggle is drawn:
 * the two ROW-shaped projections. The tree, and the roadmap's dated axis, whose timeline
 * rows carry the same chevron over the same collapse call (`collapseKey` routes them to
 * `TIMELINE_SCOPE`, which changes which bit is written and not what the gesture means).
 *
 * Never a card — the horizon axis's buckets, the board, the Deliverables board — because a
 * card's disclosure lists children on its own face and a childless card draws none, so the
 * option would be inert on the commonest one. That is `Opening the work.md` extension 1e's
 * reasoning, kept as the reason this predicate has two arms rather than four — the first of which
 * is every ROW-shaped projection, not the plan's tree alone.
 *
 * **This has to agree with who passes a fold to `wireCardActivation`, and nothing checks
 * that mechanically.** The two fold call sites are `wireRowEvents` and `renderTimelineRow`;
 * a third would have to be added here in the same change, or the row would fold with no
 * toggle to say so. What IS checked is the pairing on the projections that exist:
 * `test/view/toolbarClickAction.test.ts` drives a click on each and asserts the button is
 * present exactly where the click folds.
 */
export function clickActionApplies(host: BacklogViewHost): boolean {
	// `treeShaped`, never `=== 'tree'`. The catalog renders through `renderTree` and so
	// through `wireRowEvents`, which folds — so a bare comparison here withheld the only
	// control over a behaviour that was still running, and a user who turned folding on in
	// the plan had to go back there to turn it off. That is `projection.ts`'s own rule
	// (a projection opting out of a feature opts out of the COMPUTATION, not just the
	// control) failing in the direction it warns about, and the drift that module exists
	// to stop: it arrived when the toggle merged in beside a projection it had never seen.
	if (treeShaped(host.projection)) return true;
	// `drawsGrid`, not `=== 'dates'`, since 2026-08-14: the resources axis draws bar rows
	// with the same chevron over the same collapse call, scoped to one band
	// (`laneEntries`). A bar row that folds and no toggle to govern it is the failure this
	// predicate's own comment warns about, reached by the axis rather than by a new call
	// site. A LANE header is not the row this option is about — it holds no note, so a
	// click on it can only ever mean fold — and it needs no arm here.
	return host.projection === 'roadmap' && drawsGrid(activeAxis(host.settings, host.axisPick) ?? 'horizons');
}

/**
 * What that toggle currently says, what it looks like saying it, and what pressing it
 * does — one statement, because the toolbar button and its `⋯` entry are two inputs on
 * one value and a menu that re-derived any of the three could offer the opposite of what
 * the button was offering. The same rule the entries below already keep by reading
 * `disabled` off the button they mirror, kept here at the source instead, since this
 * value lives in the view-state store rather than on an element.
 *
 * `host.clickFolds` and not a setting: this is working position, per saved view and per
 * device (ADR 0011), so `setClickFolds` both persists it and re-renders — no Bases
 * refresh follows a change the base was not told about.
 */
export function clickActionToggle(host: BacklogViewHost): { folds: boolean; icon: string; flip: () => void } {
	const folds = host.clickFolds;
	return {
		folds,
		icon: folds ? 'fold-vertical' : 'file-text',
		flip: () => host.setClickFolds(!folds),
	};
}

/**
 * What the bulk collapse controls can reach — a DIFFERENT question from
 * `countedPopulation` in `toolbarStatus.ts`, which is why it is a second function rather than a
 * reuse: counting asks for the Base's rows, and collapsing asks for everything on screen
 * that owns a disclosure, context rows included.
 *
 * A card's own children disclosure is never in this population's reach, and needs no
 * exclusion logic here to keep it that way: `expandAll`/`collapseAll` write only through
 * `host.setCollapsed`, which lands on the tree's own bit or the dated axis's
 * (`TIMELINE_SCOPE`) — never on a card's (`CARD_SCOPE`), which only
 * `host.setCardCollapsed` ever touches (`viewState.ts`). A card's own toggle is
 * therefore the only thing that can open or close it, by CONSTRUCTION — two disjoint
 * bits nothing here has to tell apart — rather than by a filter trying to guess, from
 * this population, which paths are currently cards.
 *
 * The Deliverables board is the one projection where `model.items` is the wrong answer.
 * It draws `model.deliverableResults`, read off the WHOLE unfocused tree so a focus set
 * elsewhere can never hide a Deliverable — while `model.items` is the focused render set.
 */
function collapsiblePopulation(host: BacklogViewHost, model: BacklogModel): BacklogItem[] {
	if (host.projection === 'deliverables') return model.deliverableResults;
	// The catalog's own items for the same reason, reached the other way: `model.items` is
	// the PLAN's population now, so left alone these two buttons would fold the plan from
	// the catalog — and the collapse bits being shared by path, the plan would still be
	// folded on the way back. Deliberately NOT behind `treeShaped`: this decides what a
	// bulk collapse TOUCHES rather than whether a button is enabled.
	return projectionPopulation(host.projection, model).items;
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
 * When the bulk collapse controls are refused:
 * state, and when nothing currently drawn is a genuine ROW disclosure — a card's own
 * disclosure is never reachable by these buttons at all (see `collapsiblePopulation`), so
 * a screen where every disclosure belongs to a card (an ordinary board, the Deliverables
 * board, a horizon roadmap) offers them nothing to do and must not sit there enabled as a
 * live no-op. The tree's own chevron always counts; the dated axis's counts exactly when a
 * BAR currently draws one — `host.cardChildrenShown` is every disclosure drawn THIS pass,
 * cards and a timeline bar's chevron alike, so checking it against `host.roadmap`'s own
 * `bars` (the one register that is never a card) asks exactly "is a genuine row, not a
 * card, currently disclosed". `syncCollapseCtls` is still the sole WRITER of the flag —
 * this is the question it asks, named once so the `⋯` menu is not a second opinion about
 * the same rule.
 */
export function collapseCtlsDisabled(host: BacklogViewHost): boolean {
	if (treeShaped(host.projection)) return false;
	const barPaths = new Set((host.roadmap?.roadmap.bars ?? []).map((bar) => bar.item.file.path));
	for (const path of host.cardChildrenShown) {
		if (barPaths.has(path)) return false;
	}
	return true;
}

/**
 * Expand/collapse toolbar buttons. On a card projection that drew no disclosure there is
 * nothing to collapse, so they are genuinely `disabled` rather than only dimmed: a control
 * a keyboard user can reach has to refuse the press, not just look like it would.
 * The view re-syncs the flag after every content render (`syncCollapseCtls`), which is
 * what makes the flag answer for the frame on screen rather than the one before it.
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
	/** See `pickAndRefocus`'s doc comment: an entry that opens a modal takes focus
	 * deliberately, so it must not be refocused back onto the `⋯` the instant `run()`
	 * returns. */
	opensModal?: boolean;
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
 * a mis-enabled Expand all would really write collapse state onto a projection with no
 * disclosure to show it.
 *
 * Read at click time, so what it sees is the frame on screen.
 */
function overflowEntries(host: BacklogViewHost, barEl: HTMLElement): OverflowEntry[] {
	const compact = host.density === 'compact';
	const clickAction = clickActionToggle(host);
	const bucketGrid = bucketGridToggle(host);
	const all: OverflowEntry[] = [
		{
			// First, where the horizon axis's own toggle sits in the row. It never shares a
			// screen with the two below it — they are the grid axes' — so the order between
			// them is nominal.
			title: BUCKET_GRID_LABEL,
			icon: bucketGrid.icon,
			cls: 'pbl-bucket-grid-toggle',
			run: bucketGrid.flip,
		},
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
			title: 'Open the manual',
			icon: 'help-circle',
			cls: 'pbl-help-btn',
			// `onClosed` is REQUIRED here, and its absence was a real hole: skipping
			// `pickAndRefocus` (below) stops focus being yanked off the dialog as it
			// opens, but on its own it leaves focus nowhere when the dialog CLOSES —
			// the menu item is gone by then and the `⋯` was never refocused. Looked up
			// at close time, not captured: the toolbar may have rebuilt, and the rung
			// may have changed which controls exist. `focusInBar` is what handles the
			// found element being hidden or unfocusable.
			run: () =>
				openManual(host.app, manualSections(), 'types', () =>
					focusInBar(barEl, barEl.querySelector<HTMLElement>('.pbl-overflow-btn')),
				),
			opensModal: true,
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
		{
			// Last, where it sits in the row. Its checkmark comes from the button's own
			// `aria-pressed` like the density toggle's, so the entry cannot say a click
			// folds while the button says it opens.
			title: CLICK_ACTION_LABEL,
			icon: clickAction.icon,
			cls: 'pbl-click-action-toggle',
			run: clickAction.flip,
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
					// which may not exist at the resulting step. Except a modal entry:
					// see `pickAndRefocus`'s doc comment for why refocusing the `⋯`
					// there would fight the dialog it just opened for focus.
					.onClick(() =>
						entry.opensModal ? entry.run() : pickAndRefocus(barEl, 'overflow', entry.run),
					),
			);
		}
		showMenuForClick(menu, evt);
	});
}
