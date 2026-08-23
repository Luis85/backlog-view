import { Notice } from 'obsidian';
import { BacklogItem } from '../domain/model';
import { placementEnds, PlacementEnd } from '../domain/itemTypes';
import { Placement, placeItem, plannedEnds } from '../domain/bars';
import { DropTarget } from '../domain/dropTargets';
import { horizonSource, resourceSource } from '../domain/roadmap';
import { t } from '../i18n/t';
import {
	computeDeliverableStateWrites,
	computeDropWrites,
	computeHorizonWrites,
	computeIterationJoinWrites,
	computeIterationWrites,
	computeReleaseWrites,
	computeResourceMoveWrites,
	computeScheduleWrites,
	computeStateWrites,
	ItemWrite,
	ScheduleGesture,
	SchedulePlan,
} from '../domain/writePlan';
import { todayStamp } from '../domain/noteFields';
import { WriteOutcome } from '../storage/frontmatter';
import { BacklogViewHost } from './host';
import { declareResource } from './interactions/labels';
import { bucketLabel, bucketOf, bucketRepresentative, IterationBucket } from '../domain/board';
import {
	announceBoardMove,
	announceHorizonMove,
	announceMove,
	announceReleaseMove,
	announceResourceMove,
	announceScheduleMove,
} from './interactions/cardDrag';

/**
 * Card-move write orchestration: the `BacklogViewHost` methods a drag, an Alt+arrow
 * and a card menu all land on (`performBoardMove`, `performDeliverablesBoardMove`,
 * `performHorizonMove`, `performScheduleMove`), plus the tree's own drop
 * (`performDrop`). Extracted from
 * `ProductBacklogView` the same way `WriteGate` was — see
 * `docs/tasks/Split the view dispatch hub.md`, which named this exact cluster
 * ("the card-move plumbing") as a candidate seam and picked the write gate instead;
 * this is that seam, taken once the view hit its cap a second time. Reaches view
 * state only through `BacklogViewHost`, like every other module in this layer, and
 * touches the DOM only through the row-element map it is handed — the same pending
 * class `applyMove` always toggled, now on a map reference rather than a private
 * lookup.
 */
export class CardMoveController {
	constructor(
		private readonly host: BacklogViewHost,
		private readonly rowEls: ReadonlyMap<string, HTMLElement>,
	) {}

	async performBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
		const from = item.stateValue;
		const columns = this.host.board?.board;
		return this.applyCardMove(item, computeStateWrites(item, state, this.host.settings, todayStamp()), () =>
			announceBoardMove(columns, item.title, from, state),
		);
	}

	/**
	 * A move between the iteration board's three buckets, and the guard that a bucket is
	 * not a state.
	 *
	 * The bucket question is asked FIRST and asked once: a card already in the target
	 * bucket has nothing to change, whatever state it holds. Without that, two sites break
	 * differently — `computeStateWrites` compares the EXACT state, so `Ready` dropped on
	 * an Open bucket representing `New` is a change by that test and gets rewritten,
	 * restating the reader's own state and spending the undo slot; and `columnLabelFor`
	 * matches a column by exact state too, so a correct move would be announced from a
	 * column this board does not name.
	 *
	 * A bucket with nothing to write returns having done nothing. That is the last of
	 * three refusals rather than the only one: the drop is never wired and the menu never
	 * offers the entry, because a board that advertises a move it will not make is worse
	 * than one that offers less.
	 */
	async performIterationBoardMove(item: BacklogItem, bucket: IterationBucket): Promise<boolean> {
		const settings = this.host.settings;
		const from = bucketOf(item.stateValue, settings);
		const state = bucketRepresentative(bucket, settings);
		// A card dragged in from the shelf is JOINING as well as landing, and both halves
		// ride ONE `ItemWrite`: one gesture, one edit of one note. The plan is what says
		// whether this is a pull — `computeIterationJoinWrites` returns nothing for a card
		// already in the scope — so nothing here compares a link beside the planner.
		const join = computeIterationJoinWrites(item, this.host.model, this.host.effectiveScope, settings);
		if (state === undefined) return false;
		if (from === bucket && join.length === 0) return false;
		// Named from `bucketLabel` rather than from the drawn board, which is the one
		// place this move differs from every other in this file: the three labels are
		// CONSTANTS, not user data, so there is nothing to capture before the await and
		// nothing a rebuilt board could take away — the sentence says what the header says
		// by construction.
		// The bucket it came from is what a card ALREADY on this board left; a card pulled
		// from the shelf came from no bucket at all, and says so in the shelf's own name.
		const source = join.length > 0 ? t('shelf.backlog') : bucketLabel(from);
		const landing = from === bucket ? [] : computeStateWrites(item, state, settings, todayStamp());
		// One record for one gesture — merged rather than listed, because two records
		// naming one file are two `processFrontMatter` calls and two captured inverses.
		// The fields are disjoint, so this is an assign and not a reconciliation, and the
		// seed is what keeps a write naming its file however the two halves come out: both
		// empty is the case the two returns above have already taken.
		const merged = [...join, ...landing].reduce<ItemWrite>((all, part) => ({ ...all, ...part }), { file: item.file });
		return this.applyCardMove(item, [merged], () => announceMove(item.title, source, bucketLabel(bucket)));
	}

	/**
	 * The iteration board's shelf drop: the card leaves the sprint and nothing else
	 * changes. `computeIterationWrites(item, null, …)` plans the removal alone — leaving a
	 * sprint is not a reschedule — and plans nothing at all where there is no key to
	 * remove, which is a card already on the shelf being dropped back on it.
	 *
	 * The iteration's own title is read BEFORE the batch, `applyCardMove`'s capture rule:
	 * the refresh that ends this write rebuilds the board, and the card being taken out
	 * may have been the last one on it.
	 */
	async performIterationRemove(item: BacklogItem): Promise<boolean> {
		// Named from the BUCKET it sat in rather than from the iteration it is leaving:
		// the three bucket labels are constants, so there is nothing to capture before the
		// await and nothing a rebuilt board can take away — `performIterationBoardMove`'s
		// own reason, and it costs the sentence nothing, since the shelf it lands on is
		// what says the sprint was left.
		const from = bucketLabel(bucketOf(item.stateValue, this.host.settings));
		return this.applyCardMove(item, computeIterationWrites(item, null, this.host.settings), () =>
			announceMove(item.title, from, t('shelf.backlog')),
		);
	}

	async performDeliverablesBoardMove(item: BacklogItem, state: string | null): Promise<boolean> {
		const from = item.deliverableStateValue;
		// `host.board` is the one snapshot field — it already holds whichever
		// board-shaped projection's snapshot the last render produced, so reading it
		// here needs no `host.projection` check: it is non-null on exactly this move's
		// own board while the Deliverables projection is active.
		const columns = this.host.board?.board;
		return this.applyCardMove(item, computeDeliverableStateWrites(item, state), () =>
			announceBoardMove(columns, item.title, from, state),
		);
	}

	async performHorizonMove(item: BacklogItem, horizon: string | null): Promise<boolean> {
		// Both facts about where it came from, taken together: the reading alone cannot
		// say whether the key was there, and an empty key is a real thing to clear.
		const from = horizonSource(item);
		const buckets = this.host.roadmap?.roadmap;
		return this.applyCardMove(item, computeHorizonWrites(item, horizon), () =>
			announceHorizonMove(buckets, item.title, from, horizon),
		);
	}

	/**
	 * A release membership move — the target's own file, or `null` to remove the key.
	 * Unlike the board and horizon axes, a release is not a column or bucket this view
	 * draws, so there is no rendered vocabulary to translate a value through: the
	 * release's own title IS the word to announce.
	 *
	 * `name` is captured here, before `applyCardMove`'s await, for the same reason
	 * `performHorizonMove` captures `buckets` first: the write's own refresh can rebuild
	 * `host.model` before this await resolves, and a release note gone from the vault —
	 * or simply out of the base's results — in that same tick would leave nothing to
	 * look up afterwards. Reading `target.title` straight off the argument, once, before
	 * the write, means the announcement never depends on the release still being there.
	 */
	async performReleaseMove(item: BacklogItem, target: BacklogItem | null): Promise<boolean> {
		const name = target ? target.title : null;
		return this.applyCardMove(item, computeReleaseWrites(item, target, this.host.settings), () =>
			announceReleaseMove(item.title, name),
		);
	}

	/**
	 * The one method every input on the resources axis lands on — a drop, an Alt+arrow,
	 * Set assignee, and the shelf's own removal. `when` is the axis's second dimension and
	 * is absent from three of those four: a row is WHO, and only a gesture on the grid also
	 * says when. Both halves ride one `ItemWrite` (`computeResourceMoveWrites`), so a
	 * two-dimensional drag is one batch, one undo and one sentence.
	 */
	async performResourceMove(item: BacklogItem, name: string | null, when?: ScheduleGesture): Promise<boolean> {
		// Both captures before the batch, for `applyCardMove`'s stated reason: the refresh
		// that ends this write rebuilds `host.roadmap` before the await resolves, and the
		// row just vacated may be gone with its last bar.
		const from = resourceSource(item);
		const lanes = this.host.roadmap?.roadmap;
		// Asked of the function that decides what DRAWS — `removalOutcome`'s rule on the
		// dated shelf, for its reason. A row is who and a date is when, so a card with no
		// date to sit at draws nothing whatever row it names, and extensions 1e and 3c both
		// ask for that to be said rather than left looking like a bug. Asked of the ends
		// this GESTURE would leave, never the note's current ones: a drop that supplies a
		// date is exactly the case that stops being 3c, and reading the note alone would
		// tell the user to add a date the same release just added. The WORDS are built here
		// rather than a closure over the item, so what is captured is a string that cannot
		// go stale behind the write.
		const stays =
			name === null
				? null
				: shelvedWords(item, name, placeItem(item, plannedEnds(item, when?.plan ?? {}), this.host.settings.iterationBars));
		const writes = computeResourceMoveWrites(item, name, when ?? null);
		if (writes.length === 0) {
			// 1a says nothing: a bar that stayed exactly where the cursor found it already
			// answers the question. 1e does, because a shelved card that stays shelved does
			// not — nothing about the card told the user its assignee already matched the row.
			if (stays) new Notice(stays);
			return false;
		}
		// Which halves this batch carries is asked of the PLAN, never of a comparison
		// written beside it — the rule the Set menus' checkmarks already keep. The DATE
		// half is then confirmed against the writer's own report, because a planned date
		// the note already held lands nothing: `outcome.dates` is null exactly there, and
		// announcing a span from the plan would name a move that did not happen.
		const movedRow = writes[0].assignee !== undefined;
		const outcome = await this.applyMove(item, writes);
		if (outcome === null || !outcome.changed) return false;
		// Naming somebody through this view is naming them: the row they land in becomes a
		// declared one rather than a stray carrying "not one of the declared resources". The
		// one place every input to this move already lands, so a drag, an Alt+arrow and the
		// menu cannot disagree about it — see `declareResource`, which no-ops for a removal
		// and for a name the roster already carries. AFTER the gate, never before: the
		// roster is written on the same authority as the move, and a refused batch — a
		// context card, a config problem — must not leave a `.base` amendment behind the
		// refusal (`test/view/resourceRoster.test.ts` is the test that fails the other way).
		declareResource(this.host, name);
		const spoken = placementEnds(item.typeName, this.host.settings.iterationBars);
		const landed = outcome.dates
			? { change: outcome.dates, placement: placeItem(item, outcome.dates.after, this.host.settings.iterationBars), ends: spoken }
			: undefined;
		// Both halves in one sentence where both moved; the dated axis's own sentence where
		// only the dates did, since there is no row change to frame it with.
		if (movedRow) announceResourceMove(lanes, item.title, from, name, landed);
		else if (landed) announceScheduleMove(item.title, landed.change, landed.placement, spoken);
		if (stays) new Notice(stays);
		return true;
	}

	async performScheduleMove(
		item: BacklogItem,
		plan: SchedulePlan,
		from?: Partial<Record<PlacementEnd, string | null>>,
		ends?: PlacementEnd[],
	): Promise<boolean> {
		// Both expectations ride through untouched: what a relative gesture measured
		// against, and the placement shape it was planned under. Neither can be recomputed
		// here — deriving `ends` from the item this method was handed asks the CURRENT
		// type, which is the very thing the writer is meant to catch having changed. A
		// PBI that became a Milestone mid-hold would narrow a two-ended slide to a
		// target-only write and apply it; the reverse would make a marker's slide arrive
		// looking like an ordinary end-grip write. The caller that has no captured shape —
		// the modal, the menu — passes none and gets the item's own, which is right for a
		// gesture that was planned against it a moment ago.
		const writes = computeScheduleWrites(item, plan, ends ?? placementEnds(item.typeName, this.host.settings.iterationBars), from);
		if (writes.length === 0) return false;
		const outcome = await this.applyMove(item, writes);
		// Not "did the call return" but "did the note change": the planner now hands the
		// gate a non-empty batch for a re-confirmed date, and `runExclusively` reports
		// success for anything that completed. Announcing on that would tell a
		// screen-reader user about a move that did not happen.
		if (outcome === null || !outcome.changed || outcome.dates === null) return false;
		// The placement is asked of `placeItem` — the function that decides what draws —
		// with the ends the WRITER saw rather than the ones the model holds. Reading a
		// rebuilt model here would be a race: the refresh is Obsidian re-running the
		// query, not something this await orders, so the row could be either side of the
		// write depending on timing.
		//
		// What that buys is exact for the note's OWN ends, and only those. A span
		// `inferSpan` fills from descendants still rests on `item.descendantStart` /
		// `descendantTarget`, which are model-time: a child whose dates another editor
		// changed since this model was built would be announced at its old span while the
		// next render draws the new one. That is not fixable here — re-resolving from the
		// model is the race above, and the writer opens only the files in its own batch,
		// so no fresher descendant evidence exists at this point. The narrow claim is
		// therefore what is stated: the dates this write landed are the writer's, and an
		// inherited end is as current as the last refresh.
		const spoken = placementEnds(item.typeName, this.host.settings.iterationBars);
		// `outcome.dates.after` is already the tri-state the writer read back — passing
		// it straight through is what lets an untouched end's own invalid value survive
		// into the placement, rather than a wrapper laundering it into absence.
		announceScheduleMove(item.title, outcome.dates, placeItem(item, outcome.dates.after, this.host.settings.iterationBars), spoken);
		return true;
	}

	async performDrop(dragged: BacklogItem, target: DropTarget): Promise<void> {
		// Dropping into a collapsed parent reveals where the item landed.
		if (target.parent) this.host.setCollapsed(target.parent.file.path, false);
		await this.applyMove(dragged, computeDropWrites(dragged, target));
	}

	/**
	 * The shape both card moves share: a planned batch, applied, then announced once
	 * — whichever of the three inputs made it, a drag, an Alt+arrow or the card menu.
	 * An empty batch resolves false and says nothing: a move onto the card's own
	 * column or bucket must cost neither the undo slot it had nor a sentence about a
	 * change that did not happen.
	 *
	 * `say` is a closure over vocabulary captured BEFORE the write, because a Bases
	 * update arriving mid-batch is rebuilt into `host.board` / `host.roadmap` the
	 * instant the batch ends — which is before the await below resolves. By then the
	 * column or bucket just vacated may be gone with its last card, and naming the
	 * move from the new render would report a place the user never touched.
	 */
	private async applyCardMove(item: BacklogItem, writes: ItemWrite[], say: () => void): Promise<boolean> {
		if (writes.length === 0) return false;
		const outcome = await this.applyMove(item, writes);
		if (outcome === null || !outcome.changed) return false;
		say();
		return true;
	}

	/**
	 * Apply a move and mark its row pending for the duration of the batch. Both
	 * projections move items, so both need the same holding signal.
	 *
	 * Taken off UNCONDITIONALLY, which is this module owning both halves of the class it
	 * sets. It used to be removed only on a refusal or a batch that changed nothing, and
	 * a successful move relied on the row being REBUILT to carry the class away with the
	 * element — a property of the render, across a layer seam, stated nowhere. Since
	 * ADR 0029 a render may KEEP a row element instead, so what once could not fail is
	 * now a fact about `rowSignature`'s term list: an accepted tree drop moves the row's
	 * `place.pos`, which is a term, so nothing is broken today and nothing says it has to
	 * stay that way. Removing it here needs neither guarantee. By the time this await
	 * resolves the batch's own refresh has already run (`runExclusively` flushes the
	 * deferred update in its `finally`), so a rebuilt row's captured element is detached
	 * and the removal is a harmless no-op, while a kept one is exactly the row that still
	 * wears the class.
	 */
	private async applyMove(item: BacklogItem, writes: ItemWrite[]): Promise<WriteOutcome | null> {
		const row = this.rowEls.get(item.file.path) ?? null;
		row?.classList.add('pbl-pending');
		const applied = await this.host.applySafely(writes);
		row?.classList.remove('pbl-pending');
		return applied;
	}
}

/**
 * What to say about a card the move leaves on the shelf, or null where it lands in a row.
 *
 * Two shapes, and the difference is whether the axis REFUSED something or was given
 * nothing: with no dates at all the sentence asks for one, which is extension 3c's own
 * wording; with an unreadable or reversed pair it repeats the shelf's reason instead,
 * because telling a reader to add a date they already typed sends them looking for a
 * missing value rather than at the wrong one they can see.
 *
 * The reason is REPEATED, never matched on — the same act `render/shelf.ts` performs
 * when it draws the card's own reason line, and deliberately not the one
 * `destinationWords` refuses in `interactions/cardDrag.ts`: deciding anything from that
 * string would make two modules agree about wording neither owns a type for, while
 * passing it through leaves `bars.ts` its only author.
 */
function shelvedWords(item: BacklogItem, name: string, placement: Placement | null): string | null {
	// `null` is a type the axis does not place at all, which is not a shelved card and so
	// says nothing here — the same silence a bar gets.
	if (placement?.kind !== 'shelf') return null;
	if (placement.reason === null) return t('move.shelvedNoDates', { title: item.title, name });
	return t('move.shelvedReason', { title: item.title, name, reason: placement.reason });
}

