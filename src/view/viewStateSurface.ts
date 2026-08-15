import { BasesView } from 'obsidian';
import { ColumnScope, Projection } from './host';
import { ViewStateController } from './viewStateController';
import { RoadmapAxis } from '../domain/roadmap';
import { ShelfSort } from '../domain/shelf';
import { ScaleId } from '../domain/timeline';

/**
 * The view-state half of `BacklogViewHost`, on the class the view extends rather than
 * in the view's own file: the projection, the roadmap-axis pick, the focus level, what
 * a click on a row does, the shelf's collapse/sort/type filter, the dated axis's zoom,
 * density and lead width, and the tree's column widths — twenty-five members, every one
 * of them a one-line forward to {@link ViewStateController}, which is where the reading,
 * the writing and the render-depth choice actually live.
 *
 * A base class rather than another delegate object because `BacklogViewHost` has to
 * resolve to ONE class (see `docs/tasks/Split the view dispatch hub again.md`) and
 * TypeScript has no delegation: a member the interface names has to BE on the class the
 * modules are handed. Inheritance keeps that true — `ProductBacklogView` is still the
 * single implementation, and still the only place `ui` is constructed — while taking the
 * one block that grows by two members per view-state value out of the file every
 * projection increment already has to edit. This is the seam that block was always on;
 * it was one file up until now only because nothing had moved it.
 *
 * The two collapse questions consult the quick filter first, exactly as `isCollapsed`
 * does for a row: while a search runs, everything on a path to a match renders open, and
 * asking BEFORE the controller is what keeps a narrowed board from settling a default.
 * They ask it through {@link isFiltering}, the host's own member, so the filter itself
 * stays private to the view.
 */
export abstract class ViewStateSurface extends BasesView {
	/** Built by the view, read here: the state store plus the render-depth choice. */
	protected abstract readonly ui: ViewStateController;

	/** `BacklogViewHost`'s own, implemented by the view — see the class comment. */
	abstract isFiltering(): boolean;

	/**
	 * Which projection this view shows. UI state, not a base setting: it lives
	 * beside the view state — per saved view, per device — never in the `.base`.
	 */
	get projection(): Projection {
		return this.ui.projection;
	}

	setProjection(mode: Projection): void {
		this.ui.setProjection(mode);
	}

	/** The retained roadmap-axis pick for this saved view; null before the user picks. */
	get axisPick(): string | null {
		return this.ui.axisPick;
	}

	setAxisPick(axis: RoadmapAxis): void {
		this.ui.setAxisPick(axis);
	}

	setFocusLevel(level: string): void {
		this.ui.setFocusLevel(level);
	}

	get clickFolds(): boolean {
		return this.ui.clickFolds;
	}

	setClickFolds(value: boolean): void {
		this.ui.setClickFolds(value);
	}

	/** Whether the horizon board draws its bucket grid — arrived on main while this class was being extracted. */
	get bucketGrid(): boolean {
		return this.ui.bucketGrid;
	}

	setBucketGrid(grid: boolean): void {
		this.ui.setBucketGrid(grid);
	}

	get shelfCollapsed(): boolean {
		return this.ui.shelfCollapsed;
	}

	setShelfCollapsed(collapsed: boolean): void {
		this.ui.setShelfCollapsed(collapsed);
	}

	get shelfSort(): ShelfSort {
		return this.ui.shelfSort;
	}

	setShelfSort(sort: ShelfSort): void {
		this.ui.setShelfSort(sort);
	}

	get shelfHiddenTypes(): ReadonlySet<string> {
		return this.ui.shelfHiddenTypes;
	}

	setShelfHiddenTypes(types: ReadonlySet<string>): void {
		this.ui.setShelfHiddenTypes(types);
	}

	isLaneCollapsed(name: string): boolean {
		// The quick filter overrides every fold, exactly as `isCollapsed` does for a row:
		// while a search runs, everything on a path to a match renders open.
		return !this.isFiltering() && this.ui.isLaneCollapsed(name);
	}

	setLaneCollapsed(name: string, collapsed: boolean): void {
		this.ui.setLaneCollapsed(name, collapsed);
	}

	columnCollapsed(scope: ColumnScope, value: string | null, autoCollapse: boolean): boolean {
		// The filter overrides this fold like every other, and short-circuiting BEFORE the
		// controller is what keeps a narrowed board from settling a default: while a search
		// runs, a column is open because the search says so and not because anyone ruled.
		return !this.isFiltering() && this.ui.columnCollapsed(scope, value, autoCollapse);
	}

	setColumnCollapsed(scope: ColumnScope, value: string | null, collapsed: boolean): void {
		this.ui.setColumnCollapsed(scope, value, collapsed);
	}

	get zoom(): ScaleId {
		return this.ui.zoom;
	}

	setZoom(id: ScaleId): void {
		this.ui.setZoom(id);
	}

	get density(): string | null {
		return this.ui.density;
	}

	setDensity(value: string | null): void {
		this.ui.setDensity(value);
	}

	get leadWidth(): number | null {
		return this.ui.leadWidth;
	}

	setLeadWidth(value: number | null): void {
		this.ui.setLeadWidth(value);
	}

	get colWidths(): Readonly<Record<string, number>> {
		return this.ui.colWidths;
	}

	setColWidth(prop: string, value: number | null): void {
		this.ui.setColWidth(prop, value);
	}
}
