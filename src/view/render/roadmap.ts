import { setIcon, setTooltip } from 'obsidian';
import { createCard, renderCardBody, wireCardActivation } from './board';
import { RowContext } from './columns';
import { renderAllDoneState, renderEmptyState, renderFilterEmptyState } from './emptyStates';
import { renderTimeline } from './timeline';
import { RoadmapSnapshot } from '../host';
import { BacklogItem } from '../../domain/model';
import { buildRoadmap, HorizonBucket, RoadmapAxis, ShelfCard } from '../../domain/roadmap';
import { CivilDate } from '../../domain/noteFields';

/**
 * The roadmap projection: the same model the tree and the board render,
 * projected onto the configured axis — horizon buckets, or the dated grid — with
 * the shelf beside it carrying every result the axis could not place. The frame
 * always renders once an axis exists: an empty roadmap is an empty frame, never
 * no frame. Placement is read-only here; the scheduling gestures are their own
 * feature, writing through the one gate.
 */
export function renderRoadmap(
	ctx: RowContext,
	treeEl: HTMLElement,
	axis: RoadmapAxis,
	today: CivilDate,
): RoadmapSnapshot {
	const host = ctx.host;
	const model = host.model;
	if (!model) return { roadmap: { axis, buckets: [], bars: [], shelf: [], context: [], placedCount: 0 }, cards: [], todayLeft: null };
	const roadmap = buildRoadmap(model, host.settings, (item) => !host.isRowHidden(item), axis);

	const frameEl = treeEl.createDiv({ cls: 'pbl-roadmap' });
	const cards: BacklogItem[] = [];
	let todayLeft: number | null = null;
	if (axis === 'horizons') {
		const bucketsEl = frameEl.createDiv({ cls: 'pbl-roadmap-buckets' });
		for (const bucket of roadmap.buckets) cards.push(...renderBucket(ctx, bucketsEl, bucket));
	} else {
		const timeline = renderTimeline(ctx, frameEl, roadmap.bars, today);
		cards.push(...timeline.cards);
		todayLeft = timeline.todayLeft;
	}
	cards.push(...renderShelf(ctx, frameEl, roadmap.shelf));
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
function renderBucket(ctx: RowContext, bucketsEl: HTMLElement, bucket: HorizonBucket): BacklogItem[] {
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
	const cardsEl = colEl.createDiv({ cls: 'pbl-bucket-cards' });
	for (const item of bucket.cards) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		wireCardActivation(ctx, card, item);
	}
	return bucket.cards;
}

/**
 * Everything the axis could not place, in sibling order, counted — the roadmap
 * reports how much of the backlog is not yet planned instead of implying the
 * plan is the whole story. Empty, it takes no space at all; it becomes a drop
 * target when the scheduling gestures land.
 */
function renderShelf(ctx: RowContext, frameEl: HTMLElement, shelf: ShelfCard[]): BacklogItem[] {
	if (shelf.length === 0) return [];
	const shelfEl = frameEl.createDiv({
		cls: 'pbl-shelf',
		attr: { role: 'group', 'aria-label': `Unplaced, ${shelf.length} item${shelf.length === 1 ? '' : 's'}` },
	});
	const header = shelfEl.createDiv({ cls: 'pbl-shelf-header' });
	setIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'inbox');
	header.createSpan({ cls: 'pbl-shelf-name', text: 'Unplaced' });
	header.createSpan({ cls: 'pbl-shelf-count', text: String(shelf.length) });
	setTooltip(header, 'Results this axis cannot place — no placement on their own notes yet');
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
	}
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
