import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { createCard, renderCardBody, renderCardMatches, renderColumnFold, wireCardActivation } from './board';
import { RowContext } from './columns';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { renderContextStrip, renderShelf, shelfRemoval } from './shelf';
import { syncShelfTabStops } from './shelfControls';
import { datedEntries, laneEntries } from './lanes';
import { renderTimeline, TimelineRender } from './timeline';
import { BacklogViewHost, DrawnColors, PlacedMount, RoadmapSnapshot, ScrollBox } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { newItemType, promptCreateItem } from '../interactions/create';
import { gestureAt, previewer, submitGesture, TimelineParts, wireTimelineDrag } from '../interactions/timelineDrag';
import { StatePalette, statePalettes } from '../../domain/board';
import { isMarkerType } from '../../domain/itemTypes';
import { BacklogItem } from '../../domain/model';
import { axisPopulation, buildRoadmap, HorizonBucket, ResourceLane, RoadmapAxis, RoadmapModel } from '../../domain/roadmap';
import { scaleFor, TimelineScale, TimelineWindow } from '../../domain/timeline';
import { CivilDate } from '../../domain/noteFields';

/**
 * The roadmap projection: the same model the tree and the board render,
 * projected onto the configured axis — horizon buckets, or the dated grid — with
 * the shelf beside it carrying every result the axis could not place. The frame
 * always renders once an axis exists: an empty roadmap is an empty frame, never
 * no frame.
 *
 * Both axes write: the horizon axis's bucket and shelf are drop TARGETS, the board's
 * rule; the dated axis's grid is one POSITIONAL target instead — there are no lanes
 * yet, so only the pointer's X says anything, and `interactions/timelineDrag.ts`
 * decides what it means. `dnd` is the same controller either way, wired differently
 * per axis by `renderBucket`/`wireTimelineDrag` below. A bar already placed is a drag
 * source too — a hold reads a delta rather than a position — and the dated axis's own
 * shelf is where either direction lands: a shelf card onto the grid places it, a held
 * bar back onto the shelf un-places it (`shelfRemoval`, in `./shelf`, is what tells
 * `renderShelf` which write that is, per axis).
 */
export function renderRoadmap(
	ctx: RowContext,
	treeEl: HTMLElement,
	axis: RoadmapAxis,
	today: CivilDate,
	dnd: CardDragController,
): RoadmapSnapshot {
	const host = ctx.host;
	const model = host.model;
	if (!model) {
		return {
			roadmap: { axis, buckets: [], bars: [], lanes: [], shelf: [], context: [], placedCount: 0 },
			cards: [],
			placed: ctx.placed,
			shelfEl: null,
			todayLeft: null,
			scroller: null,
			boxes: [],
			window: null,
			scale: null,
			leadWidth: null,
			drawn: { done: false, milestone: false, iteration: false, accent: false, absence: false, daysLost: false },
			palettes: [],
		};
	}
	const roadmap = buildRoadmap(model, host.settings, (item) => !host.isRowHidden(item), axis);

	const frameEl = treeEl.createDiv({ cls: 'pbl-roadmap' });
	const cards: BacklogItem[] = [];
	let todayLeft: number | null = null;
	let scroller: HTMLElement | null = null;
	let window: TimelineWindow | null = null;
	let scale: TimelineScale | null = null;
	let leadWidth: number | null = null;
	let drawn: DrawnColors = { done: false, milestone: false, iteration: false, accent: false, absence: false, daysLost: false };
	// The dated axis's own dependency conflicts (see `TimelineRender.dependencyConflicts`)
	// — empty on the horizon axis, where a shelved dependent's stated START has no
	// meaning at all.
	let dependencyConflicts: ReadonlyMap<string, ReadonlySet<string>> = new Map();
	// Built once, drawn from by the bars and then carried out on the snapshot for the
	// legend — see `RoadmapSnapshot.palettes`. Empty on the horizon axis, which draws no bar.
	let palettes: StatePalette[] = [];
	if (axis === 'horizons') {
		// The layout pick rides the ROW rather than each bucket: one class where the buckets
		// are created, read by `.pbl-bucket-cards` in `styles/roadmap.css`, so a bucket that
		// renders knows nothing about it.
		const bucketsEl = frameEl.createDiv({
			cls: 'pbl-roadmap-buckets' + (host.bucketGrid ? '' : ' pbl-buckets-list'),
		});
		for (const bucket of roadmap.buckets) cards.push(...renderBucket(ctx, bucketsEl, bucket, dnd));
		// The pane is the scroller, not the frame: the frame is `max-content` wide and
		// scrolls nothing, so auto-scroll toward an edge has to watch the box that does.
		dnd.wireScroller(treeEl);
	} else {
		// Both grid axes through ONE call: what differs between them is the entry list and
		// whether a bar may be taken hold of — never a second grid.
		const activeScale = scaleFor(host.zoom);
		palettes = statePalettes(model, host.settings);
		const timeline = renderGridAxis(ctx, frameEl, treeEl, roadmap, { axis, today, dnd, palettes });
		cards.push(...timeline.cards);
		todayLeft = timeline.todayLeft;
		scroller = timeline.scroller;
		window = timeline.window;
		scale = activeScale;
		leadWidth = timeline.leadWidth;
		drawn = timeline.drawn;
		dependencyConflicts = timeline.dependencyConflicts;
	}
	// What the axis HOLDS, which is no longer what it drew on any of the three:
	// `axisPopulation` (`domain/roadmap.ts`) counts the model rather than the cards pushed
	// above. A roadmap whose every bucket is shut, whose every band is folded, or whose only
	// visible note is a milestone in the shared header track is not a roadmap with nothing on
	// it, and telling the reader their work was all done or all filtered away would be the
	// same lie the collapsed shelf already had to be kept out of. This was the buckets alone
	// until 2026-08-15, with `cards.length` for the grid axes and a sentence beside it saying
	// they fold nothing — true when it was written and untrue since bands learnt to.
	const population = axisPopulation(roadmap);
	const removal = shelfRemoval(host, axis);
	const shelf = renderShelf(ctx, frameEl, { cards: roadmap.shelf, conflicts: dependencyConflicts, axis }, dnd, removal);
	cards.push(...shelf.cards);
	const context = renderContextStrip(ctx, frameEl, roadmap.context);
	cards.push(...context.cards);
	nameMatches(ctx);
	// `cards` is final here, and it is what the pane's `listbox`/`region` role is decided
	// from downstream — so it is also what decides whether the shelf's own controls may
	// leave the tab order. See `syncShelfTabStops`.
	syncShelfTabStops(shelf.el, cards.length > 0);
	const advisoryEl = renderRoadmapAdvisory(
		ctx,
		frameEl,
		population + roadmap.shelf.length + roadmap.context.length,
		treeEl,
	);

	// Keyed by WHICH BAND IT IS, in the order the bands render — a band that did not
	// render (an empty shelf with nothing to un-place, no context, cards on screen) is
	// simply absent, so `captureScroll`/`restoreScroll` neither read nor write it.
	const boxes: ScrollBox[] = [];
	if (scroller) boxes.push({ key: 'timeline', el: scroller });
	boxes.push({ key: 'shelf', el: shelf.el });
	if (context.el) boxes.push({ key: 'context', el: context.el });
	if (advisoryEl) boxes.push({ key: 'advisory', el: advisoryEl });

	return {
		roadmap,
		cards,
		placed: ctx.placed,
		shelfEl: shelf.el,
		todayLeft,
		scroller,
		boxes,
		window,
		scale,
		leadWidth,
		drawn,
		palettes,
	};
}

/**
 * Name the matches the filter found under each drawn item, now that every surface has
 * registered. A second pass rather than inline calls, because "which items are already
 * on screen" is only true once the last one is: the board can ask its model
 * (`cardPaths`) because a `BoardModel` is already narrowed to what draws, and the
 * roadmap's is not — `RoadmapModel.shelf` holds items a collapsed or type-filtered shelf
 * never puts on screen.
 */
function nameMatches(ctx: RowContext): void {
	if (!ctx.host.isFiltering()) return;
	const carded = new Set(ctx.placed.keys());
	// Annotated so fallow can see the members this file reads — see the root CLAUDE.md on
	// interface members resolved through a property access.
	const mounts: PlacedMount[] = [...ctx.placed.values()];
	for (const placed of mounts) renderCardMatches(ctx, carded, placed);
}

/** What a grid axis needs to draw — grouped so `renderGridAxis` stays inside max-params. */
interface GridDrawing {
	axis: RoadmapAxis;
	today: CivilDate;
	dnd: CardDragController;
	palettes: StatePalette[];
}

/**
 * Either axis that draws the dated grid. The window, the day header, the gridlines, the
 * today line, the milestone lines, the dependency layer and the bar holds are all
 * `renderTimeline`'s and identical on both; the two differences are stated here and
 * nowhere else.
 *
 * **The entry list.** Both ask `timelineRows` about what a collapsed bar above them is
 * holding shut — here rather than inside `buildRoadmap`, because collapse is the view's own
 * state and a row hidden by a disclosure has not become unplaced. The difference is the
 * ARGUMENT: the dated axis asks it once, of the work bars on the grid, and the resources axis
 * asks it once PER BAND, which is what confines a chevron to its own row. Both also draw the
 * milestones' shared row ahead of everything else and keep its markers out of that argument —
 * `datedEntries` and `laneEntries` respectively, one rule stated per entry list.
 *
 * **What a release MEANS.** Both axes read the pointer's X as a date, from one module
 * (`interactions/timelineDrag.ts`); what differs is what that answer is combined with.
 * The dated axis has one target over the whole day area, so X is the whole message. The
 * resources axis has a target per band ELEMENT, so a release says two things at once —
 * the row it landed in and the day it landed on — and the overlay stays undrawn there,
 * because a layer taking pointer events across the whole grid would swallow every drop
 * the rows are the target for.
 *
 * The band is wired AFTER the render rather than during it, which is why `laneElement`
 * reports rather than wires: a drop needs the window, the scale and the lead width this
 * pass drew, and none of them exists until `renderTimeline` returns.
 */
function renderGridAxis(
	ctx: RowContext,
	frameEl: HTMLElement,
	treeEl: HTMLElement,
	roadmap: RoadmapModel,
	drawing: GridDrawing,
): TimelineRender {
	const { axis, today, dnd, palettes } = drawing;
	const activeScale = scaleFor(ctx.host.zoom);
	const entries =
		axis === 'resources'
			? laneEntries(roadmap.lanes, {
					lane: (name) => ctx.host.isLaneCollapsed(name),
					row: (path) => ctx.host.isCollapsed(path),
				})
			: datedEntries(roadmap.bars, (path) => ctx.host.isCollapsed(path));
	const band: { el: HTMLElement; lane: ResourceLane }[] = [];
	const timeline = renderTimeline(ctx, frameEl, entries, {
		today,
		scale: activeScale,
		dnd,
		shelf: roadmap.shelf,
		palettes,
		lanes: axis === 'resources' ? roadmap.lanes : [],
		laneElement: axis === 'resources' ? (el, lane) => band.push({ el, lane }) : null,
		// The PANE's width, not the frame's or the not-yet-built scroller's: this is
		// the element `backlogView.ts`'s `ResizeObserver` watches, so a render here and
		// a resize-driven re-render there measure the same box. They can still read it
		// a scrollbar apart, since this measurement happens after `treeEl.empty()` —
		// see `TimelineDrawing.available`, which states what that costs.
		available: treeEl.clientWidth,
	});
	const parts = (dayOrigin: HTMLElement): TimelineParts => ({
		dayOrigin,
		scroller: timeline.scroller,
		window: timeline.window,
		scale: activeScale,
		headerTrack: timeline.headerTrack,
		tracks: timeline.tracks,
		leadWidth: timeline.leadWidth,
	});
	if (timeline.overlay) wireTimelineDrag(ctx, dnd, parts(timeline.overlay));
	else {
		// `wireTimelineDrag` does this for the dated axis; a roster taller than the pane
		// needs it just as much, and the horizon axis's buckets already have it.
		dnd.wireScroller(timeline.scroller);
		for (const element of band) wireLaneDrop(ctx, dnd, parts(timeline.headerTrack), element);
	}
	return timeline;
}

/**
 * What dropping on a resource's band means: that row's own name into the DRAGGED note's
 * assignee property, AND the day the pointer named into its dates — one release, both
 * answers, one batch through the one method every input on this axis lands on. A minted
 * row is a target like any other — its name is observed vocabulary, and observed
 * vocabulary is writable, the board's own rule. A context row inside the band is a target
 * too and is safe as one: the write names the note being carried, never the row it landed
 * on.
 *
 * **A GRIP ignores the row.** `gestureAt` reports what the pointer meant and this decides
 * what to do with it: resizing an end is not reassigning the work, so a grip dragged into
 * a neighbour's band writes the date and leaves the assignee alone — the same distinction
 * the dated axis's shelf makes when it refuses a grip as an unschedule. The BODY and a
 * shelf card both answer both questions, which is what makes a cross-row slide one
 * gesture rather than two.
 *
 * The day origin is the header's track, not each element's own: every track in this grid
 * begins after a `--pbl-tl-lead`-wide sticky lead cell in the same flex row
 * (`styles/timeline.css`), so they share a left edge and one origin answers for the whole
 * axis. Per-element origins would be four more render signatures for an identical number.
 *
 * Wired per ELEMENT rather than per band, because a header, its bars, its absences and the
 * excluded notes it places are siblings positioned against one shared day grid and there
 * is no container to wire. What that costs is the highlight — the element under the
 * pointer lights rather than the whole band — which is a live-vault question either way,
 * since jsdom paints nothing. A wrapper per row would answer it and would put a box
 * between every row and the sticky lead column the grid's geometry rests on.
 */
function wireLaneDrop(
	ctx: RowContext,
	dnd: CardDragController,
	parts: TimelineParts,
	band: { el: HTMLElement; lane: ResourceLane },
): void {
	const host: BacklogViewHost = ctx.host;
	const ghost = previewer(host, parts);
	dnd.wireDropTarget(
		band.el,
		(source, pointer) => {
			ghost.clear();
			// A gesture that resolved to nothing — off the grid, over the sticky lead column,
			// or a hold that came back to where it started — still names the row it was
			// released in, which is a real move and the one this axis has always made.
			const gesture = gestureAt(host, parts, source, pointer);
			// **An END GRIP is the dated axis's own gesture, reached from here.** It states a
			// date and nothing about who is doing the work, so it goes to the method that
			// writes dates and never names a row at all — resizing something into the space
			// beside a colleague's bar is not handing it to them. Routing it through the
			// resource move to then re-state the row the note already holds would be the same
			// write said twice, with a removal one null away.
			// **A MARKER is the dated axis's own gesture too, and the test is asked of BOTH
			// ends of the release.** The milestones' row stands for nobody, so a release IN it
			// says when and never who — writing its header's caption into an assignee property
			// would invent a resource out of a row's name. And a marker released in somebody
			// ELSE's band is the same answer from the other side: it draws in the milestones'
			// row whatever its assignee says ([[Milestones out of the resource rows]]), so a
			// row write there would be a change the reader is never shown, spent from the one
			// undo slot. `Set assignee` still writes one — a note may record who owns a date;
			// what may not happen is a POSITIONAL gesture writing a value this axis does not
			// read.
			if (band.lane.markers || isMarkerType(source.item.typeName) || source.hold === 'start' || source.hold === 'end') {
				submitGesture(host, source, gesture);
				return;
			}
			void host.performResourceMove(
				source.item,
				band.lane.name,
				gesture ? { plan: gesture.plan, ends: source.ends, from: gesture.from } : undefined,
			);
		},
		{ onDrag: (source, pointer) => ghost.draw(source, pointer), onLeave: () => ghost.clear() },
	);
}

/**
 * One horizon bucket — a declared placement, or one minted by a result's own
 * value and marked as outside the declared vocabulary, the board's stray-column
 * rule. Empty declared buckets render anyway: a horizon exists whether or not
 * anything currently sits in it.
 */
function renderBucket(
	ctx: RowContext,
	bucketsEl: HTMLElement,
	bucket: HorizonBucket,
	dnd: CardDragController,
): BacklogItem[] {
	// No auto-fold on this axis, so the answer is always `false`: an axis has no notion of
	// finished, which is the one thing a board column's own default is about.
	const folded = ctx.host.columnCollapsed('horizons', bucket.value, false);
	const colEl = bucketsEl.createDiv({
		cls:
			'pbl-bucket' +
			(bucket.declared ? '' : ' pbl-bucket-undeclared') +
			(folded ? ' pbl-bucket-collapsed' : ''),
		attr: {
			role: 'group',
			// Folded is said in the NAME, `columnLabel`'s reason on the board: the count
			// deliberately survives the fold, so a bucket that stayed silent about it would
			// announce items it is not drawing.
			'aria-label': t(folded ? 'roadmap.groupLabelCollapsed' : 'roadmap.groupLabel', {
				name: bucket.value,
				count: bucket.count,
			}),
		},
	});
	const header = colEl.createDiv({ cls: 'pbl-bucket-header' });
	renderColumnFold(ctx.host, header, 'horizons', bucket.value, { folded, label: bucket.value });
	header.createSpan({ cls: 'pbl-bucket-name', text: bucket.value });
	header.createSpan({ cls: 'pbl-bucket-count', text: String(bucket.count) });
	if (!bucket.declared) {
		const mark = header.createSpan({ cls: 'pbl-bucket-stray' });
		drawIcon(mark, 'circle-help');
		setTooltip(
			colEl,
			`"${bucket.value}" is not one of the declared horizons. Add it to "Horizons (in order)" in the view options, or re-place its items.`,
		);
	}
	renderBucketNew(ctx, header, bucket);
	const cardsEl = colEl.createDiv({ cls: 'pbl-bucket-cards' });
	// Folded, this bucket draws no card and RETURNS none, which is the whole of what the
	// fold costs the rest of the pane: `cards` is the keyboard's walk and what the pane's
	// `listbox`/`region` role is decided from, so a card that is not drawn is not selected
	// and not counted as making this a composite. `renderShelf` contributes the same way.
	const drawn = folded ? [] : bucket.cards;
	for (const item of drawn) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		wireCardActivation(ctx, card, item);
		ctx.placed.set(item.file.path, { item, mount: card, listsChildren: true, face: 'links' });
		dnd.wireCard(card, item);
	}
	// The whole bucket is the target, the board's rule: within a bucket the order is
	// the Base's own sort, so there is no between-cards edge to indicate. A minted
	// bucket is a target like any other — its value is observed vocabulary, and
	// observed vocabulary is writable.
	dnd.wireDropTarget(colEl, (source) => void ctx.host.performHorizonMove(source.item, bucket.value));
	dnd.wireScroller(cardsEl);
	return drawn;
}

/**
 * Create straight into this bucket. The New flow runs exactly as it does from the
 * toolbar — the same config gate, the same type folders, the same type the toolbar
 * would offer — with this bucket's own value written in the creation write, so a
 * note never exists in a bucket its frontmatter does not claim.
 *
 * `tabindex="-1"` like the tree's add button, because the pane is one tab stop — but
 * unlike the tree's, this one has no keyboard equivalent behind it: a bucket is not a
 * keyboard stop, so nothing selects one to act on. What is NOT lost is the capability,
 * only the shortcut: the toolbar's New button is an ordinary tab stop, and Alt+arrow
 * walks the new card into any bucket, so the same note in the same place is two
 * keystrokes further away rather than out of reach. Closing the gap properly means
 * bucket stops, which is `docs/requirements/Keyboard and menu on the roadmap.md`'s
 * work — its main flow already has arrows moving across the roadmap's regions.
 *
 * The stylesheet has to reveal it on hoverless devices explicitly (`hover: none`), or
 * a touch user gets neither the hover nor the tab stop and the control is unreachable
 * rather than merely hidden.
 */
function renderBucketNew(ctx: RowContext, header: HTMLElement, bucket: HorizonBucket): void {
	const host = ctx.host;
	const model = host.model;
	if (!model) return;
	const type = newItemType(host.settings, model);
	const btn = header.createEl('button', {
		cls: 'clickable-icon pbl-bucket-add',
		attr: { type: 'button', tabindex: '-1', 'aria-label': `New ${type} in ${bucket.value}` },
	});
	drawIcon(btn, 'plus');
	setTooltip(btn, `New ${type} in "${bucket.value}"`);
	btn.addEventListener('click', () => promptCreateItem(host, [type], null, { horizon: bucket.value }));
}

/**
 * Why the roadmap has no cards, said beside the frame rather than instead of it — the
 * board's advisory rule. Gated on the roadmap's actual population — the axis's own
 * cards (results and any context card already placed in a bucket), the shelf's real
 * count and the standalone context strip's count — never on how many are currently
 * keyboard-reachable: a collapsed shelf legitimately contributes zero cards to that
 * walk, and an all-shelved, collapsed backlog is not empty, it is a backlog not yet
 * planned.
 *
 * `root` is `treeEl` — the view's one stable element — passed down from `renderRoadmap`:
 * `frameEl` and `aside` are both created fresh every pass (`renderRoadmap`'s own first
 * line, and this function's own second), so neither survives to be resolved from later.
 * See `renderEmptyState`'s doc comment in `render/emptyStates.ts`.
 */
function renderRoadmapAdvisory(
	ctx: RowContext,
	frameEl: HTMLElement,
	renderedCards: number,
	root: HTMLElement,
): HTMLElement | null {
	const host = ctx.host;
	const model = host.model;
	if (!model || renderedCards > 0) return null;
	const aside = frameEl.createDiv({ cls: 'pbl-board-advisory' });
	if (model.results.length === 0) renderEmptyState(host, aside, root);
	else if (host.isFiltering()) renderFilterEmptyState(host, aside, root);
	else renderAllDoneState(host, aside, model.results.length, root);
	return aside;
}
