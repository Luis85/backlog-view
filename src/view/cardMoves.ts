import { Notice } from 'obsidian';
import { BacklogItem } from '../domain/model';
import { placementEnds, PlacementEnd } from '../domain/itemTypes';
import { placeItem, plannedEnds } from '../domain/bars';
import { DropTarget } from '../domain/dropTargets';
import { horizonSource, resourceSource } from '../domain/roadmap';
import {
	computeDeliverableStateWrites,
	computeDropWrites,
	computeHorizonWrites,
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
import {
	announceBoardMove,
	announceHorizonMove,
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
			name !== null && placeItem(item, plannedEnds(item, when?.plan ?? {})).kind === 'shelf'
				? `"${item.title}" is assigned to ${name}. Add a start or target date to place it in the row.`
				: null;
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
		const spoken = placementEnds(item.typeName);
		const landed = outcome.dates
			? { change: outcome.dates, placement: placeItem(item, outcome.dates.after), ends: spoken }
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
		const writes = computeScheduleWrites(item, plan, ends ?? placementEnds(item.typeName), from);
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
		const spoken = placementEnds(item.typeName);
		// `outcome.dates.after` is already the tri-state the writer read back — passing
		// it straight through is what lets an untouched end's own invalid value survive
		// into the placement, rather than a wrapper laundering it into absence.
		announceScheduleMove(item.title, outcome.dates, placeItem(item, outcome.dates.after), spoken);
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
	 * Apply a move and mark its row pending until the Bases refresh re-renders it in
	 * place. Both projections move items, so both need the same holding signal —
	 * cleared on refusal AND on a batch that changed nothing, because only a real
	 * change brings the refresh that would replace the row: a stale Unschedule of
	 * dates another editor already removed, or a batch the shape or baseline check
	 * refuses, would otherwise leave the card looking permanently in flight.
	 */
	private async applyMove(item: BacklogItem, writes: ItemWrite[]): Promise<WriteOutcome | null> {
		const row = this.rowEls.get(item.file.path) ?? null;
		row?.classList.add('pbl-pending');
		const applied = await this.host.applySafely(writes);
		if (applied === null || !applied.changed) row?.classList.remove('pbl-pending');
		return applied;
	}
}
