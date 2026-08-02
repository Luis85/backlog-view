import { setIcon, setTooltip } from 'obsidian';
import { createCard, renderCardBody, wireCardActivation } from './board';
import { RowContext } from './columns';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { renderTimeline } from './timeline';
import { RoadmapSnapshot } from '../host';
import { CardDragController } from '../interactions/cardDrag';
import { newItemType, promptCreateItem } from '../interactions/create';
import { BacklogItem } from '../../domain/model';
import { buildRoadmap, HorizonBucket, RoadmapAxis, SHELF_LABEL, ShelfCard } from '../../domain/roadmap';
import { CivilDate } from '../../domain/noteFields';

/**
 * The roadmap projection: the same model the tree and the board render,
 * projected onto the configured axis — horizon buckets, or the dated grid — with
 * the shelf beside it carrying every result the axis could not place. The frame
 * always renders once an axis exists: an empty roadmap is an empty frame, never
 * no frame.
 *
 * The horizon axis writes: a bucket is a drop target, the shelf is the one that
 * un-places, and both plan through the host's one move. The dated axis is still
 * read-only — its gestures are the scheduling feature's, and a drag with no write
 * behind it would be a promise this projection cannot keep — so `dnd` is passed on
 * only where a drop means something, and that null is what withholds every
 * draggable on the timeline.
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
	if (!model) return { roadmap: { axis, buckets: [], bars: [], shelf: [], context: [], placedCount: 0 }, cards: [], todayLeft: null };
	const roadmap = buildRoadmap(model, host.settings, (item) => !host.isRowHidden(item), axis);

	const frameEl = treeEl.createDiv({ cls: 'pbl-roadmap' });
	const cards: BacklogItem[] = [];
	let todayLeft: number | null = null;
	// Null on the dated axis, and that null is the whole withholding: no draggables,
	// no targets, no shelf strip — one condition rather than a flag per affordance.
	const placing = axis === 'horizons' ? dnd : null;
	if (placing) {
		const bucketsEl = frameEl.createDiv({ cls: 'pbl-roadmap-buckets' });
		for (const bucket of roadmap.buckets) cards.push(...renderBucket(ctx, bucketsEl, bucket, placing));
		// The pane is the scroller, not the frame: the frame is `max-content` wide and
		// scrolls nothing, so auto-scroll toward an edge has to watch the box that does.
		placing.wireScroller(treeEl);
	} else {
		const timeline = renderTimeline(ctx, frameEl, roadmap.bars, today);
		cards.push(...timeline.cards);
		todayLeft = timeline.todayLeft;
	}
	cards.push(...renderShelf(ctx, frameEl, roadmap.shelf, placing));
	cards.push(...renderContextStrip(ctx, frameEl, roadmap.context));
	renderRoadmapAdvisory(ctx, frameEl, cards.length);
	return { roadmap, cards, todayLeft };
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
	const colEl = bucketsEl.createDiv({
		cls: 'pbl-bucket' + (bucket.declared ? '' : ' pbl-bucket-undeclared'),
		attr: { role: 'group', 'aria-label': `${bucket.value}, ${bucket.count} item${bucket.count === 1 ? '' : 's'}` },
	});
	const header = colEl.createDiv({ cls: 'pbl-bucket-header' });
	header.createSpan({ cls: 'pbl-bucket-name', text: bucket.value });
	header.createSpan({ cls: 'pbl-bucket-count', text: String(bucket.count) });
	if (!bucket.declared) {
		const mark = header.createSpan({ cls: 'pbl-bucket-stray' });
		setIcon(mark, 'circle-help');
		setTooltip(
			colEl,
			`"${bucket.value}" is not one of the declared horizons. Add it to "Horizons (in order)" in the view options, or re-place its items.`,
		);
	}
	renderBucketNew(ctx, header, bucket);
	const cardsEl = colEl.createDiv({ cls: 'pbl-bucket-cards' });
	for (const item of bucket.cards) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		wireCardActivation(ctx, card, item);
		dnd.wireCard(card, item);
	}
	// The whole bucket is the target, the board's rule: within a bucket the order is
	// the Base's own sort, so there is no between-cards edge to indicate. A minted
	// bucket is a target like any other — its value is observed vocabulary, and
	// observed vocabulary is writable.
	dnd.wireDropTarget(colEl, (item) => void ctx.host.performHorizonMove(item, bucket.value));
	dnd.wireScroller(cardsEl);
	return bucket.cards;
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
	setIcon(btn, 'plus');
	setTooltip(btn, `New ${type} in "${bucket.value}"`);
	btn.addEventListener('click', () => promptCreateItem(host, [type], null, { horizon: bucket.value }));
}

/**
 * Everything the axis could not place, in sibling order, counted — the roadmap
 * reports how much of the backlog is not yet planned instead of implying the
 * plan is the whole story.
 *
 * `dnd` is non-null exactly where a drop on the shelf means something, and it is
 * also what keeps an EMPTY shelf on the page: the shelf is the target that
 * un-places, and a target that exists only while it is occupied is one nothing can
 * ever reach. It carries `pbl-shelf-empty` then, which the stylesheet keeps out of
 * the layout until a drag is live — so "takes no space" and "is reachable" are both
 * true, one in CSS and one in the DOM.
 */
function renderShelf(
	ctx: RowContext,
	frameEl: HTMLElement,
	shelf: ShelfCard[],
	dnd: CardDragController | null,
): BacklogItem[] {
	const empty = shelf.length === 0;
	if (empty && !dnd) return [];
	const shelfEl = frameEl.createDiv({
		cls: 'pbl-shelf' + (empty ? ' pbl-shelf-empty' : ''),
		attr: { role: 'group', 'aria-label': `${SHELF_LABEL}, ${shelf.length} item${shelf.length === 1 ? '' : 's'}` },
	});
	const header = shelfEl.createDiv({ cls: 'pbl-shelf-header' });
	setIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'inbox');
	header.createSpan({ cls: 'pbl-shelf-name', text: SHELF_LABEL });
	header.createSpan({ cls: 'pbl-shelf-count', text: String(shelf.length) });
	// The one target whose drop REMOVES rather than writes has to say so, exactly as
	// the board's no-state column does.
	setTooltip(
		header,
		dnd
			? 'Results this axis cannot place — dropping a card here removes its horizon'
			: 'Results this axis cannot place — no placement on their own notes yet',
	);
	const cardsEl = shelfEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const entry of shelf) {
		const card = createCard(ctx, cardsEl, entry.item);
		renderCardBody(ctx, card, entry.item);
		// Unreadable is unplaced, and the card says why rather than rendering
		// somewhere a guess put it.
		if (entry.reason !== null) {
			const reason = card.createDiv({ cls: 'pbl-shelf-reason' });
			setIcon(reason.createSpan({ cls: 'pbl-shelf-reason-icon' }), 'alert-triangle');
			reason.createSpan({ text: entry.reason });
		}
		wireCardActivation(ctx, card, entry.item);
		dnd?.wireCard(card, entry.item);
	}
	// Entering the vocabulary is the triage gesture, so the shelf is a drag SOURCE as
	// much as a target — and dropping back on it un-places, the mirror write.
	dnd?.wireDropTarget(shelfEl, (item) => void ctx.host.performHorizonMove(item, null));
	return shelf.map((entry) => entry.item);
}

/**
 * Context rows with no place on the axis — a focused item outside the filter
 * whose value names no existing bucket, or whose own dates never place it. They
 * stand beside the shelf, apart from its count: a context row is not a result,
 * and the shelf is a statement about the results.
 */
function renderContextStrip(ctx: RowContext, frameEl: HTMLElement, context: BacklogItem[]): BacklogItem[] {
	if (context.length === 0) return [];
	const stripEl = frameEl.createDiv({ cls: 'pbl-roadmap-context', attr: { role: 'group', 'aria-label': 'Context' } });
	const header = stripEl.createDiv({ cls: 'pbl-shelf-header' });
	setIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'corner-left-down');
	header.createSpan({ cls: 'pbl-shelf-name', text: 'Context' });
	setTooltip(header, "Not in this base's filter — shown for the hierarchy, never counted");
	const cardsEl = stripEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const item of context) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		wireCardActivation(ctx, card, item);
	}
	return context;
}

/**
 * Why the roadmap has no cards, said beside the frame rather than instead of it —
 * the board's advisory rule. Gated on rendered cards, shelf and context included:
 * an all-shelved roadmap is not empty, it is a backlog not yet planned, and the
 * shelf's count is the fact — nothing suggests placements the user has not made.
 */
function renderRoadmapAdvisory(ctx: RowContext, frameEl: HTMLElement, renderedCards: number): void {
	const host = ctx.host;
	const model = host.model;
	if (!model || renderedCards > 0) return;
	const aside = frameEl.createDiv({ cls: 'pbl-board-advisory' });
	if (model.results.length === 0) renderEmptyState(host, aside);
	else if (host.isFiltering()) renderFilterEmptyState(host, aside);
	else renderAllDoneState(host, aside, model.results.length);
}
