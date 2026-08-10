import { BacklogViewHost } from './host';
import { treeShaped } from './projection';
import { RowContext, syncColumnFit } from './render/columns';
import { TIMELINE_LEAD_PX } from './render/timeline';
import { syncToolbarFit } from './render/toolbarFit';
import { effectiveLeadWidth } from './interactions/timelineLeadResize';
import { activeAxis } from '../domain/roadmap';

/**
 * When to re-measure the pane and re-run the column-fit ladder — the policy half of
 * [`src/view/CLAUDE.md`](./CLAUDE.md)'s "Controls" section, which pairs it with
 * `syncColumnFit` (`render/columns.ts`) that owns the verdict itself: a threshold
 * computed in one place and applied in another is one edit from disagreeing, so this
 * class holds only WHEN to re-measure, never what the measurement means. Constructed
 * once by the view and driven by its `ResizeObserver` callback (absent in jsdom, so
 * tests call `refit`/`shouldRebuildOnResize` directly).
 */
export class ResizePolicy {
	constructor(
		private readonly host: BacklogViewHost,
		private readonly viewEl: HTMLElement,
		private readonly treeEl: HTMLElement,
		private readonly toolbarEl: HTMLElement,
		private readonly rowCtx: () => RowContext,
	) {}

	/** Re-measure the pane and apply the column ladder to what is currently rendered. */
	refit(): boolean {
		return syncColumnFit(this.rowCtx(), this.viewEl, this.treeEl);
	}

	/**
	 * Whether a resize warrants a rebuild — on the tree, only if a column came or
	 * went; on the dated roadmap axis, only if the lead column's EFFECTIVE width
	 * would actually change. Never on the board or the horizon axis, whose columns
	 * and buckets scroll rather than dropping.
	 *
	 * The toolbar's own ladder re-runs FIRST and unconditionally, in every projection: it
	 * is the second thing a resize invalidates, it answers to no rebuild verdict, and a
	 * needless re-measure is one comparison and no render. It belongs here for the reason
	 * the rest of this class does — the observer callback is the view's wiring, and WHEN
	 * to re-measure is this class's whole subject — while `syncToolbarFit`
	 * (`render/toolbarFit.ts`) keeps what the measurement means, exactly as
	 * `syncColumnFit` does above.
	 */
	shouldRebuildOnResize(): boolean {
		syncToolbarFit(this.toolbarEl);
		if (treeShaped(this.host.projection)) return this.refit();
		// The COLUMN ladder is the tree's alone — board columns and the horizon axis's
		// buckets scroll rather than dropping columns, and the shelf answers to a stored
		// pick rather than to a width. The dated axis is the one other case a resize can
		// starve: its lead column is sized against the pane, not its own content, so a
		// narrowed split can leave a stale render covering the whole grid until something
		// else happens to re-render it.
		const roadmap = this.host.roadmap;
		if (this.host.projection !== 'roadmap' || !roadmap) return false;
		if (activeAxis(this.host.settings, this.host.axisPick) !== 'dates') return false;
		const stored = this.host.leadWidth ?? TIMELINE_LEAD_PX;
		const effective = effectiveLeadWidth(stored, this.treeEl.clientWidth);
		// No `refitting` guard here, and `refit`'s reasoning does not carry: that one
		// brackets a SYNCHRONOUS recursive call in the view's own render pass, while this
		// branch is only ever entered from the observer, which is delivered
		// asynchronously — a flag set and cleared around the render below would always
		// read false on arrival. The line that actually stops a loop is this one, and it
		// guarantees idempotence rather than non-recursion: the render sets
		// `roadmap.leadWidth` to `effective`, so the next notification about the same
		// pane returns here.
		return effective !== roadmap.leadWidth;
	}
}
