import { ViewState } from './viewState';
import { ColumnScope, Projection } from './host';
import { RoadmapAxis } from '../domain/roadmap';
import { ShelfLayout, ShelfSort } from '../domain/shelf';
import { ScaleId, scaleFor } from '../domain/timeline';

/**
 * How the controller reaches the view whose state it holds — one hook per render
 * depth a change can ask for, the same three `refreshFromData` already picks between
 * in `backlogView.ts`'s own comments (a re-render, a content-only re-render, or a
 * model rebuild).
 */
export interface ViewStateHooks {
	/** No config was set, so no Bases refresh is coming: this render IS the change. */
	render(): void;
	/** Content only — the toolbar keeps its own focus and DOM. */
	renderTreeContent(): void;
	/** Re-roots the model, since the change (focus alone) is what it is re-rooted on. */
	refreshFromData(): void;
}

/**
 * The view-state-backed UI state `BacklogViewHost` exposes: the projection, the
 * retained roadmap-axis pick, the focus level, what a plain click on a row does, the
 * shelf's own collapse/sort/type filter, the dated axis's zoom, density and lead width,
 * and the tree's per-column widths. One shape repeated for
 * each — read the view state, write it back, ask for the render depth the change
 * needs — extracted for the reason `WriteGate` was: state (here, the view state
 * plus the render-depth choice) that only this cluster of methods touches, in the one
 * file every projection increment has to add a line to. See [[Switching projections]]
 * for the projection half; the rest follow the identical pattern.
 *
 * `ProductBacklogView` still implements every one of these on `BacklogViewHost`
 * itself and forwards to this controller in one line, the same delegation
 * `WriteGate`'s three write methods already use — so the interface still resolves to
 * one class. Those forwards live on `viewStateSurface.ts`, the abstract class the view
 * extends: a member the interface names has to be on the object modules are handed, so
 * this file could take the state and the render-depth choice but never the surface.
 */
export class ViewStateController {
	constructor(
		private readonly state: ViewState,
		private readonly hooks: ViewStateHooks,
	) {}

	get projection(): Projection {
		return this.state.projection();
	}

	setProjection(mode: Projection): void {
		// `Boards` means the board this view was last on — THREE of them now: a retained
		// iteration scope, the Deliverables pick, or the product. Retained rather than
		// spent on the first trip through the tree, the same rule `activeAxis` keeps for
		// the roadmap's axis. The picker's own `Product` entry clears both picks first, so
		// it is never redirected back here.
		if (mode === 'board') {
			if (this.state.boardScope() !== null) mode = 'iteration';
			else if (this.state.boardPick() !== null) mode = 'deliverables';
		}
		// Choosing Deliverables IS a board pick, however this was reached — the picker's
		// entry, a test, a future command — so the memory is written here rather than at
		// the one caller someone remembered. It clears the scope, because the redirect
		// above asks the scope FIRST: left standing, a retained iteration would outrank
		// the newer choice on the next trip through the tree.
		if (mode === 'deliverables' && this.state.boardPick() === null) {
			this.state.setBoardPick('deliverables');
			this.state.setBoardScope(null);
		}
		if (mode === this.projection) return;
		this.state.setProjection(mode);
		this.hooks.render();
	}

	get boardScope(): string | null {
		return this.state.boardScope();
	}

	/**
	 * Scope the board to one iteration, or back to the product with null. It sets the
	 * PROJECTION too, because the two are one choice: `Product` is the board projection
	 * and an iteration is the iteration projection, and two stored values that cannot
	 * contradict each other need no guard on any route in.
	 *
	 * A full render for `setProjection`'s reason: no config was set, so no Bases refresh is
	 * coming and this render IS the change. Nothing derived is rebuilt beside it — the one
	 * thing that was, the quick filter's match index, went with the filter on 2026-08-17.
	 * Anything cached against the POPULATION added later has to join this method by hand,
	 * because the scope is exactly what replaces that population, and no gate anywhere
	 * would catch the omission: an index is correct when built and wrong when the thing it
	 * was built FOR changes underneath it.
	 */
	setBoardScope(path: string | null): void {
		// The no-op guard asks all three stored values, not two: from the Deliverables
		// board the scope is already null, so without the `boardPick` term picking
		// `Product` there would return before clearing the pick that IS the difference.
		const already =
			path === this.boardScope &&
			this.state.boardPick() === null &&
			(path === null ? this.projection === 'board' : this.projection === 'iteration');
		if (already) return;
		// A scope pick spends the Deliverables pick, for the redirect's precedence reason
		// read the other way: the scope is asked first, so the pick only has to go when
		// the newest choice is Product — but clearing it on both keeps "the two are never
		// both set" a rule rather than a case analysis.
		this.state.setBoardPick(null);
		this.state.setBoardScope(path);
		this.state.setProjection(path === null ? 'board' : 'iteration');
		this.hooks.render();
	}

	get axisPick(): string | null {
		return this.state.axisPick();
	}

	setAxisPick(axis: RoadmapAxis): void {
		if (axis === this.axisPick) return;
		this.state.setAxisPick(axis);
		this.hooks.render();
	}

	setFocusLevel(level: string): void {
		if (level === this.state.focusLevel()) return;
		this.state.setFocusLevel(level);
		this.hooks.refreshFromData();
	}

	get clickFolds(): boolean {
		return this.state.clickFolds();
	}

	setClickFolds(value: boolean): void {
		if (value === this.clickFolds) return;
		this.state.setClickFolds(value);
		// A full render, like the projection and the zoom beside it: no Bases refresh
		// follows a change it was not told about, and the toolbar's own toggle is what
		// has to come back saying the new value.
		this.hooks.render();
	}

	get bucketGrid(): boolean {
		return this.state.bucketGrid();
	}

	setBucketGrid(grid: boolean): void {
		if (grid === this.bucketGrid) return;
		this.state.setBucketGrid(grid);
		// A full render like the density toggle beside it: the buckets redraw, and so does
		// the toolbar button that has to come back saying the new value.
		this.hooks.render();
	}

	get shelfCollapsed(): boolean {
		return this.state.shelfCollapsed();
	}

	setShelfCollapsed(collapsed: boolean): void {
		if (collapsed === this.shelfCollapsed) return;
		this.state.setShelfCollapsed(collapsed);
		// Does NOT spare the control that asked for it — the shelf's disclosure lives
		// in the content pane and is rebuilt by this very call, which is why it hands
		// focus to its replacement itself (`renderShelfControls`).
		this.hooks.renderTreeContent();
	}

	get shelfSort(): ShelfSort {
		return this.state.shelfSort();
	}

	setShelfSort(sort: ShelfSort): void {
		if (sort === this.shelfSort) return;
		this.state.setShelfSort(sort);
		this.hooks.renderTreeContent();
	}

	get shelfLayout(): ShelfLayout {
		return this.state.shelfLayout();
	}

	setShelfLayout(layout: ShelfLayout): void {
		if (layout === this.shelfLayout) return;
		this.state.setShelfLayout(layout);
		this.hooks.renderTreeContent();
	}

	get shelfHeight(): number | null {
		return this.state.shelfHeightPick();
	}

	/**
	 * Content only, like every other shelf pick: the band's cap is a custom property the
	 * shelf element reads, so nothing in the toolbar depends on it. The grip that asked for
	 * it is rebuilt by this very call and hands focus to its own replacement, exactly as the
	 * header's controls do (`interactions/shelfResize.ts`).
	 */
	setShelfHeight(height: number | null): void {
		if (height === this.shelfHeight) return;
		this.state.setShelfHeight(height);
		this.hooks.renderTreeContent();
	}

	get shelfHiddenTypes(): ReadonlySet<string> {
		return this.state.shelfHiddenTypes();
	}

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.state.setShelfHiddenTypes(types);
		this.hooks.renderTreeContent();
	}

	/**
	 * The one pick here that `ViewState` never sees: the shelf's search is session state,
	 * so it lives on this controller as a plain
	 * field and dies with the view. Persisting it would open a saved view onto a shelf
	 * silently narrowed by a search nobody remembers typing.
	 */
	private shelfSearchText = '';

	get shelfSearch(): string {
		return this.shelfSearchText;
	}

	setShelfSearch(text: string): void {
		if (text === this.shelfSearchText) return;
		this.shelfSearchText = text;
		this.hooks.renderTreeContent();
	}

	isLaneCollapsed(name: string): boolean {
		return this.state.isLaneCollapsed(name);
	}

	/**
	 * Folding a band takes the WHOLE content render, not a targeted refresh: the window,
	 * the gridlines and every full-height mark are derived from the row set it changes —
	 * the same reason a bar row's own chevron redraws the projection.
	 */
	setLaneCollapsed(name: string, collapsed: boolean): void {
		if (this.state.setLaneCollapsed(name, collapsed)) this.hooks.renderTreeContent();
	}

	columnCollapsed(scope: ColumnScope, value: string | null, autoCollapse: boolean): boolean {
		return this.state.columnCollapsed(scope, value, autoCollapse);
	}

	/**
	 * Content only, like the shelf's own disclosure beside it: a fold changes which cards
	 * the projection draws and nothing about the toolbar. And like the shelf's, it does NOT
	 * spare the control that asked — the header is rebuilt by this very call, so the caller
	 * puts focus back itself.
	 */
	setColumnCollapsed(scope: ColumnScope, value: string | null, collapsed: boolean): void {
		this.state.setColumnCollapsed(scope, value, collapsed);
		this.hooks.renderTreeContent();
	}

	get zoom(): ScaleId {
		return scaleFor(this.state.zoomPick()).id;
	}

	setZoom(id: ScaleId): void {
		if (id === this.zoom) return;
		this.state.setZoom(id);
		this.hooks.render();
	}

	get density(): string | null {
		return this.state.densityPick();
	}

	setDensity(value: string | null): void {
		if (value === this.density) return;
		this.state.setDensity(value);
		this.hooks.render();
	}

	get leadWidth(): number | null {
		return this.state.leadWidthPick();
	}

	setLeadWidth(value: number | null): void {
		if (value === this.leadWidth) return;
		this.state.setLeadWidth(value);
		this.hooks.render();
	}

	get colWidths(): Readonly<Record<string, number>> {
		return this.state.columnWidths();
	}

	/**
	 * A full render, not a content-only one: the column ladder re-measures against the
	 * new widths, so a column that no longer fits has to drop — and the grip that asked
	 * for this is in the header the render rebuilds (see `interactions/columnResize.ts`
	 * for what that costs a keyboard user, and how it is paid).
	 */
	setColWidth(prop: string, value: number | null): void {
		if ((this.colWidths[prop] ?? null) === value) return;
		this.state.setColumnWidth(prop, value);
		this.hooks.render();
	}
}
