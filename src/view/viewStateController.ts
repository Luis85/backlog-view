import { ViewState } from './viewState';
import { Projection } from './host';
import { RoadmapAxis } from '../domain/roadmap';
import { ShelfSort } from '../domain/shelf';
import { ScaleId, scaleFor } from '../domain/timeline';

/**
 * How the controller reaches the view whose state it holds — one hook per render
 * depth a change can ask for, the same three `refreshFromData` already picks between
 * in `backlogView.ts`'s own comments (a re-render, a content-only re-render, or a
 * model rebuild).
 */
export interface UiStateHooks {
	/** No config was set, so no Bases refresh is coming: this render IS the change. */
	render(): void;
	/** Content only, like the quick filter — the toolbar keeps its own focus and DOM. */
	renderTreeContent(): void;
	/** Re-roots the model, since the change (focus alone) is what it is re-rooted on. */
	refreshFromData(): void;
	/**
	 * Rebuild the quick filter's match index. Only the projection needs it, and no gate
	 * anywhere would have caught the omission: the index is correct when built and wrong
	 * when the thing it was built FOR changes underneath it. A switch with a needle still
	 * in the box would otherwise answer for the projection the user just left — rows that
	 * do not match staying on screen, matches missing, and the text still in the input
	 * saying the filter is working.
	 */
	recomputeFilter(): void;
}

/**
 * The view-state-backed UI state `BacklogViewHost` exposes: the projection, the
 * retained roadmap-axis pick, the focus level, what a plain click on a row does, the
 * shelf's own collapse/sort/type filter, and the dated axis's zoom, density and lead
 * width. One shape repeated for
 * each — read the view state, write it back, ask for the render depth the change
 * needs — extracted for the reason `WriteGate` was: state (here, the view state
 * plus the render-depth choice) that only this cluster of methods touches, in the one
 * file every projection increment has to add a line to. See [[Switching projections]]
 * for the projection half; the rest follow the identical pattern.
 *
 * `ProductBacklogView` still implements every one of these on `BacklogViewHost`
 * itself and forwards to this controller in one line, the same delegation
 * `WriteGate`'s three write methods already use — so the interface still resolves to
 * one class.
 */
export class ViewStateController {
	constructor(
		private readonly state: ViewState,
		private readonly hooks: UiStateHooks,
	) {}

	get projection(): Projection {
		return this.state.projection();
	}

	setProjection(mode: Projection): void {
		if (mode === this.projection) return;
		this.state.setProjection(mode);
		// Before the render, not after: the render is what reads the index.
		this.hooks.recomputeFilter();
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

	get shelfHiddenTypes(): ReadonlySet<string> {
		return this.state.shelfHiddenTypes();
	}

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.state.setShelfHiddenTypes(types);
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
}
