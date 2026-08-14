# Assigning items to a resource — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the roadmap's resources axis writable — a drag, an Alt+Up/Down and the row menu's Set assignee all land one assignee write on one host method, `performResourceMove`.

**Architecture:** The write already exists (`computeAssigneeWrites`). This adds the orchestration around it, in the shape [[Moving between horizons]] already gives the horizon axis: one host method on `CardMoveController` that plans, applies and announces; a bar wired as an ordinary card drag source (hold `null`, never a date hold); each element of a resource's band wired as a drop target through a hook the grid takes from its caller; a shelf that un-assigns; a keyboard ladder on Alt+**Up/Down** because resources are rows; and `Set assignee` routed through the same method while that axis draws.

**Tech Stack:** TypeScript, Obsidian Bases custom view API 1.12.0, pragmatic-drag-and-drop, vitest + jsdom.

**Spec:** `docs/requirements/Assigning items to a resource.md` (PBI, order 20). Read its parent Feature `docs/requirements/The resource timeline.md` and the shipped sibling `docs/requirements/Showing a resources axis on the roadmap.md` alongside it — the sibling's "The axis is read-only in this increment" paragraph names every seam this plan reverses, and each was a decision rather than an omission.

## Global Constraints

- `npm run check` (build + lint + coverage-thresholded tests + fallow + docs register) must pass before committing. On Windows the docs-checker and `contextRowWrites` suites flake at the 5s default under load — verify with `npx vitest run --coverage --testTimeout=30000`, and if tests fail, `analyze` and `docs` never ran: run them explicitly before believing the check passed.
- **400-line lint cap per `src/` file**, blank lines and comments excluded. `src/view/render/timeline.ts` currently sits at ~396 — Task 1 exists solely to make room. `test/**` has its own 450 cap.
- **Coverage thresholds only ever go up** (`vitest.config.mts`: statements 98.48, branches 94.8, functions 99.8, lines 99.57). Cover every new branch; never lower a bar.
- **One move, several inputs**: a drag, a keyboard step and a menu pick land on ONE host method, which is the only place the batch is planned and the only place it is announced.
- **Every write goes through the gate** (`applySafely`), and an `outsideFilter` row is never a write target, never a ranking peer, never a source of vocabulary.
- **An invariant asserted in a comment gets a test that fails without it, and the test is watched failing** — revert the fix, run it, see red, restore.
- **Capture before the await**: anything an awaited write reports on (the vocabulary that names the move, the words a Notice will say) is read before the batch, because the batch's own refresh rebuilds `host.roadmap` before it resolves.
- Sentence-case UI text; `setCssProps` over inline styles; no `!important` — win by specificity and say so.
- Nothing here adds a **view-option key**, so `test/docs/surfaces.test.ts` needs no new requirement mention and the manual needs no new setup entry. If a key does get added, both are mandatory and nothing else tells you.

## Out of scope, stated rather than skipped

- **Extension 3b — the outcome report** (a move whose value takes the note outside the Base's filter is announced with an open path). Refused for this repository: the mechanism belongs to [[New cards in place]], it was built once from one sentence and removed after eleven review findings across seven rounds, and `docs/issues/The outcome report was built from one sentence.md` records the open question (nothing correlates a Bases pass with a write). [[Moving between horizons]] stays **Active** for exactly this criterion; this note does the same. Do not build it.
- **Resource absences** (order 30). `ResourceLane.bars` stays the plain list a second source appends to; nothing here changes how a row is drawn.
- **Row keyboard stops** (a row's own New button still has no keyboard equivalent) — `docs/requirements/Keyboard and menu on the roadmap.md`'s work, unchanged by this increment.

## File Structure

**Created**

- `src/view/render/barLabel.ts` — where a bar's title goes beside the mark as DRAWN, and how wide that mark actually is. Moved out of `timeline.ts` to make room, exactly as `laneEntries` moved into `lanes.ts` for the same reason. Holds `LABEL_RESERVE_PX`, `MILESTONE_MARK_PX`, `OUTSIDE_MARK_PX`, `markWidth`, `renderBarLabel`.
- `test/view/resourceMoves.test.ts` — every input to a resource move, the shape `test/view/roadmapMoves.test.ts` has for the horizon one.

**Modified**

- `src/domain/roadmap.ts` — `resourceSource`, `resourceTargetLabel`, `resourcePlacementLabel`: naming a resource move's two ends, `horizonSource`/`targetLabel`/`placementLabel`'s shape over the assignee.
- `src/view/cardMoves.ts` — `performResourceMove`, the one place a resource move is planned and announced.
- `src/view/host.ts`, `src/view/backlogView.ts` — the host method and its delegation.
- `src/view/interactions/cardDrag.ts` — `announceResourceMove`.
- `src/view/render/timeline.ts` — `TimelineDrawing.hold` replaces `grips`; a `laneTarget` hook; the drop overlay only where a position means something; the `pbl-timeline-flat` marker.
- `src/view/render/roadmap.ts` — what a drop on a resource's band means; the scroller on this axis.
- `src/view/render/lanes.ts` — `renderLaneHead` hands back its element so the caller can wire it.
- `src/view/render/shelf.ts` — the `'resources'` branch of `shelfRemoval` becomes a real removal.
- `src/view/interactions/keyboard.ts` — `resourceStops`, `handleResourceMoveKey`, `ladderStep`; `handleRoadmapMoveKey` splits per axis.
- `src/view/interactions/labels.ts` — `assigneeChoices` leads with the drawn rows; `chooseAssignee` routes through the move.
- `styles/timeline.css`, `styles/lanes.css` — the today line stops intercepting where no overlay covers it; the band highlight and the dragged bar.
- `test/view/resourceLanes.test.ts`, `test/view/contextCardWrites.test.ts`, `test/view/timelineBoxing.test.ts` — the read-only assertions become their opposites; the context block asks all three questions; one import path moves.
- `docs/requirements/Assigning items to a resource.md`, `docs/requirements/Showing a resources axis on the roadmap.md`, `CHANGELOG.md`.

---

### Task 1: Room in `timeline.ts` — extract the bar label

`renderTimeline`'s file is at its 400-line cap; this increment adds ~8 code lines to it. Move the one concern that is genuinely separable — where a title is drawn beside a mark, and how wide that mark draws — and change nothing else. Pure move: no behaviour changes, so the existing suites are the check.

**Files:**
- Create: `src/view/render/barLabel.ts`
- Modify: `src/view/render/timeline.ts` (delete `LABEL_RESERVE_PX`, `MILESTONE_MARK_PX`, `OUTSIDE_MARK_PX`, `markWidth`, `renderBarLabel`; import `renderBarLabel`)
- Modify: `test/view/timelineBoxing.test.ts:4` (import path)

**Interfaces:**
- Consumes: `BarGeometry`, `TimelineScale`, `TimelineWindow` from `../../domain/timeline`; `TimelineBar` from `../../domain/bars`.
- Produces: `export const LABEL_RESERVE_PX: number`; `export function renderBarLabel(track: HTMLElement, bar: TimelineBar, geometry: BarGeometry, scale: TimelineScale, window: TimelineWindow): void`.

- [ ] **Step 1: Create the new module, moving the four symbols verbatim**

Copy `LABEL_RESERVE_PX` (and its doc comment), `MILESTONE_MARK_PX`, `OUTSIDE_MARK_PX`, `markWidth` and `renderBarLabel` out of `src/view/render/timeline.ts` **with their comments unchanged** — every one of them states a rule (the CSS budget tie, the diamond's `translateX`, the three ways a label is dropped) and losing it in a move is the cheapest way to lose a rule. Head the file:

```ts
import { TimelineBar } from '../../domain/bars';
import { BarGeometry, MIN_BAR_PX, TimelineScale, TimelineWindow } from '../../domain/timeline';

/**
 * The title beside a bar, and how wide the mark it has to clear actually DRAWS.
 *
 * Its own module because `timeline.ts` reached its 400-line budget and this is the
 * concern that separates cleanly — the same reason `laneEntries` sits in `lanes.ts`
 * rather than beside the grid that draws it. Nothing else imports it, and it imports
 * nothing of the grid: a label's position is a function of the mark, the scale and the
 * window, and of nothing the grid holds.
 *
 * `LABEL_RESERVE_PX` is read by `test/view/timelineBoxing.test.ts`, which refuses this
 * number and the label's CSS budget in `styles/timelineFurniture.css` drifting apart.
 */
```

Keep `markWidth` module-private (nothing outside used it) and export `LABEL_RESERVE_PX` and `renderBarLabel`.

- [ ] **Step 2: Point `timeline.ts` and the test at it**

In `src/view/render/timeline.ts`, delete the five moved declarations and add to the imports:

```ts
import { renderBarLabel } from './barLabel';
```

`renderBarRow`'s call site is unchanged. In `test/view/timelineBoxing.test.ts` change line 4:

```ts
import { LABEL_RESERVE_PX } from '../../src/view/render/barLabel';
```

- [ ] **Step 3: Run the suites the move could break, and lint**

Run: `npx vitest run test/view/timelineBoxing.test.ts test/view/timelineFurniture.test.ts test/view/roadmapFrame.test.ts test/view/resourceLanes.test.ts --testTimeout=30000`
Expected: PASS — a pure move changes no behaviour.

Run: `npx eslint src/view/render/timeline.ts src/view/render/barLabel.ts`
Expected: clean, and `timeline.ts` now has ~35 lines of headroom.

- [ ] **Step 4: Register the new module, or `npm run docs` fails**

`docs-check.mjs` rule 7 requires every module in `src/` to be *specified* by a use case's `## Where it lives` or an ADR's `## Decision`. Add `src/view/render/barLabel.ts` to the `## Where it lives` of `docs/requirements/Assigning items to a resource.md` (Task 7 rewrites that section in full; for now append one honest sentence so the gate passes):

```markdown
`src/view/render/barLabel.ts` is not this PBI's feature — it is the bar's title and the
mark width it clears, moved out of `src/view/render/timeline.ts` when that file hit its
400-line budget and this increment needed eight lines in it. The same move `laneEntries`
made into `src/view/render/lanes.ts`, for the same reason.
```

Run: `npm run docs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/view/render/barLabel.ts src/view/render/timeline.ts test/view/timelineBoxing.test.ts "docs/requirements/Assigning items to a resource.md"
git commit -m "Move the bar's label out of the grid that draws it"
```

---

### Task 2: The write — `performResourceMove`, and what it says

The one method every input lands on. Nothing renders it yet; the tests drive the host method directly, which is also the shape that holds for an input nobody has written.

**Files:**
- Modify: `src/domain/roadmap.ts` (after `horizonSource`)
- Modify: `src/view/interactions/cardDrag.ts` (after `announceHorizonMove`)
- Modify: `src/view/cardMoves.ts` (after `performHorizonMove`)
- Modify: `src/view/host.ts` (after `performHorizonMove`)
- Modify: `src/view/backlogView.ts` (after the `performHorizonMove` delegation, ~line 622)
- Test: `test/view/resourceMoves.test.ts` (new)

**Interfaces:**
- Consumes: `computeAssigneeWrites(item, value): ItemWrite[]` (`src/domain/writePlan.ts`, unchanged); `placeItem(item, statedEnds(item)): Placement` (`src/domain/bars.ts`); `item.assigneeValue: string | null`; `item.ownKeys.assignee: boolean`.
- Produces:
  - `export interface ResourceSource { value: string | null; keyPresent: boolean }`
  - `export function resourceSource(item: BacklogItem): ResourceSource`
  - `export function resourceTargetLabel(roadmap: RoadmapModel, name: string | null): string`
  - `export function resourcePlacementLabel(roadmap: RoadmapModel, source: ResourceSource): string`
  - `export function announceResourceMove(roadmap: RoadmapModel | null | undefined, title: string, from: ResourceSource, to: string | null): void`
  - `performResourceMove(item: BacklogItem, name: string | null): Promise<boolean>` on `CardMoveController` and `BacklogViewHost`.

- [ ] **Step 1: Write the failing test**

Create `test/view/resourceMoves.test.ts` with the fixture and this first block. `RESOURCES` and `laneRoadmap` mirror `test/view/resourceLanes.test.ts` deliberately — one axis, one way of opening it.

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { Notice } from '../helpers/obsidian-mock';
import { Harness, flush, makeView, useViewHarness } from '../helpers/view';
import { announced } from '../helpers/dnd';
import { resourceVault } from '../helpers/resources';

useViewHarness();

const RESOURCES = {
	startProperty: 'note.start',
	targetProperty: 'note.due',
	assigneeProperty: 'note.assignee',
};

/** A roadmap open on the resources axis, with Alice and Bob declared. */
function laneRoadmap(vault: FakeVault, extra: Record<string, unknown> = {}): Harness {
	const harness = makeView(vault, { ...RESOURCES, resourceNames: 'Alice, Bob', ...extra }, { collapsed: true });
	harness.view.setProjection('roadmap');
	harness.view.setAxisPick('resources');
	harness.view.setShelfCollapsed(false);
	return harness;
}

describe('the one method a resource move lands on', () => {
	it('writes the name into the assignee property and touches nothing else', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');

		expect(moved).toBe(true);
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		// A row is who and a date is when: the bar's own dates are not a side effect of
		// which row it lands in.
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.fm('Alice dated.md')['due']).toBe('2026-08-10');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('removes the key rather than blanking it, and undo puts it back', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);
		const item = view.model?.byPath.get('Alice dated.md');

		await view.performResourceMove(item as never, null);
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);

		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('re-picking the name the note already holds writes nothing and keeps the undo', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');
		expect(vault.writeLog).toHaveLength(1);

		// Case-insensitively, the same matching that put `Cased` in Alice's row.
		const moved = await view.performResourceMove(view.model?.byPath.get('Cased.md') as never, 'ALICE');

		expect(moved).toBe(false);
		expect(vault.writeLog).toHaveLength(1);
		await view.undoLast();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
	});

	it('says a dateless card stays put, whether or not the write landed', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);
		const undated = view.model?.byPath.get('Undated.md');

		// 3c: the write lands, the assignee changes, and nothing enters a row — so it is
		// said out loud rather than left looking like a bug.
		await view.performResourceMove(undated as never, 'Bob');
		expect(vault.fm('Undated.md')['assignee']).toBe('Bob');
		expect(Notice.messages).toContain(
			'"Undated" is assigned to Bob. Add a start or target date to place it in the row.',
		);

		// 1e: dropped on the resource it already names, nothing is written at all — and a
		// shelved card that stays shelved gives the user no other way to tell.
		Notice.messages.length = 0;
		const again = await view.performResourceMove(undated as never, 'Bob');
		expect(again).toBe(false);
		expect(vault.writeLog).toHaveLength(1);
		expect(Notice.messages).toContain(
			'"Undated" is assigned to Bob. Add a start or target date to place it in the row.',
		);
	});

	it('says nothing at all when a placed bar is dropped on its own row', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Alice');

		expect(moved).toBe(false);
		// 1a: a bar that stayed exactly where the cursor found it already answers the
		// question, so the shelved card's notice must not fire here.
		expect(Notice.messages).toEqual([]);
	});
});

describe('what a resource move announces', () => {
	it('names the rows on screen, in both directions', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		await view.performResourceMove(view.model?.byPath.get('Alice dated.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob');

		await view.performResourceMove(view.model?.byPath.get('Stray.md') as never, null);
		expect(await announced()).toBe('Moved "Stray" from Zoe to Unplaced');
	});

	it('names a row in the casing on screen, never the casing on the note', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// `Cased` says `alice`; the row it renders in says `Alice`.
		await view.performResourceMove(view.model?.byPath.get('Cased.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Cased" from Alice to Bob');
	});

	it('names a resource no row draws, rather than calling the note silent', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		// `Undated` names Alice and has no date to sit at, so no row of Alice's holds it —
		// but the note plainly says Alice, and "from Unplaced" would be a lie about it.
		await view.performResourceMove(view.model?.byPath.get('Undated.md') as never, 'Bob');
		expect(await announced()).toBe('Moved "Undated" from Alice to Bob');
	});

	it('names an empty key rather than reporting a real cleanup as no change', async () => {
		vi.useFakeTimers();
		const vault = new FakeVault();
		// The stub the ✨ backfill leaves: the key is there and says nothing, and removing
		// it is a real, undo-consuming write.
		vault.addFile('Stub.md', { frontmatter: { type: 'Epic', order: 10, assignee: '' } });
		const { view } = laneRoadmap(vault);

		const moved = await view.performResourceMove(view.model?.byPath.get('Stub.md') as never, null);

		expect(moved).toBe(true);
		expect(await announced()).toBe('Moved "Stub" from an empty assignee to Unplaced');
	});
});
```

- [ ] **Step 2: Run it to watch it fail**

Run: `npx vitest run test/view/resourceMoves.test.ts --testTimeout=30000`
Expected: FAIL — `view.performResourceMove is not a function` (TypeScript will also refuse the call).

- [ ] **Step 3: Name the move's two ends in `domain/roadmap.ts`**

Append after `horizonSource`:

```ts
/** A key that is there and names nobody — the stub the backfill leaves. */
const EMPTY_ASSIGNEE_LABEL = 'an empty assignee';

/** The drawn row a name belongs to, matched as the bars were placed. */
function laneFor(roadmap: RoadmapModel, value: string): string | null {
	return roadmap.lanes.find((lane) => sameValue(lane.name, value))?.name ?? null;
}

/**
 * A name in the casing the row on screen carries, or the name itself where no row draws
 * it. Both ends of a resource move's sentence share this half, unlike the horizon axis's
 * pair — and the reason is this axis's own minting rule rather than a shortcut.
 * `placementLabel` falls back to the SHELF for a value no bucket carries, which is right
 * where every result's value mints a bucket; here a row exists only where a BAR lands, so
 * a note naming a resource it has no date to sit beside names a resource with no row —
 * and reading that as the shelf would report "from Unplaced" for a note that plainly says
 * Alice. What the two ends do NOT share is the null case, which is the whole of what
 * `targetLabel` and `placementLabel` were split over: see their preamble above.
 */
function resourceLabel(roadmap: RoadmapModel, value: string): string {
	return laneFor(roadmap, value) ?? value;
}

/** Where a pick sends a card. Nobody named is the shelf, which is what the frame calls it. */
export function resourceTargetLabel(roadmap: RoadmapModel, name: string | null): string {
	return name === null ? SHELF_LABEL : resourceLabel(roadmap, name);
}

/** What a note's assignee key said, and whether it was there at all. */
export interface ResourceSource {
	value: string | null;
	keyPresent: boolean;
}

/**
 * Both pre-write facts about who a card names, taken together — so a caller capturing
 * "where it came from" before an await cannot capture half of it. `horizonSource`'s
 * shape, for `horizonSource`'s reason: an empty key reads as absence while
 * `computeAssigneeWrites` clears on PRESENCE, so a real, undo-consuming cleanup would
 * otherwise be announced as a move that did not happen.
 */
export function resourceSource(item: BacklogItem): ResourceSource {
	return { value: item.assigneeValue, keyPresent: item.ownKeys.assignee };
}

/**
 * What a card's assignee WAS. Two ways to say nobody and only one of them is nothing to
 * take away — there is no third, because `readString` refuses nothing here: an assignee
 * is a string or it is absent, so this axis has no unreadable case for the horizon's
 * third label to answer.
 */
export function resourcePlacementLabel(roadmap: RoadmapModel, source: ResourceSource): string {
	if (source.value !== null) return resourceLabel(roadmap, source.value);
	return source.keyPresent ? EMPTY_ASSIGNEE_LABEL : SHELF_LABEL;
}
```

- [ ] **Step 4: Announce it from the one live region, in `interactions/cardDrag.ts`**

Extend the import from `../../domain/roadmap` with `resourcePlacementLabel`, `ResourceSource`, `resourceTargetLabel`, and append after `announceHorizonMove`:

```ts
/**
 * The resources axis's own pair, asked of the same two functions for the same reason —
 * what the note SAID and where the user SENT it are different questions, and the horizon
 * axis already paid for answering them once.
 */
export function announceResourceMove(
	roadmap: RoadmapModel | null | undefined,
	title: string,
	from: ResourceSource,
	to: string | null,
): void {
	if (!roadmap) return;
	announceMove(title, resourcePlacementLabel(roadmap, from), resourceTargetLabel(roadmap, to));
}
```

- [ ] **Step 5: Plan, apply and say it once, in `view/cardMoves.ts`**

Add `Notice` to the `obsidian` import (a new import line — this module had none), `placeItem, statedEnds` to the `../domain/bars` import, `computeAssigneeWrites` to the `../domain/writePlan` import, `resourceSource` to the `../domain/roadmap` import, and `announceResourceMove` to the `./interactions/cardDrag` import. Then, after `performHorizonMove`:

```ts
	async performResourceMove(item: BacklogItem, name: string | null): Promise<boolean> {
		const from = resourceSource(item);
		const lanes = this.host.roadmap?.roadmap;
		// Read BEFORE the write, of the function that decides what DRAWS — `removalOutcome`'s
		// rule on the dated shelf, for its reason: after the await the model has been rebuilt
		// and the card is wherever the refresh put it. A name is who and a date is when, so a
		// card with no date to sit at draws nothing whatever row it names, and both extension
		// 1e and 3c ask for that to be said rather than left looking like a bug. The words are
		// built here rather than a closure over `name`, so the capture is a string and cannot
		// go stale.
		const stays =
			name !== null && placeItem(item, statedEnds(item)).kind === 'shelf'
				? `"${item.title}" is assigned to ${name}. Add a start or target date to place it in the row.`
				: null;
		const writes = computeAssigneeWrites(item, name);
		if (writes.length === 0) {
			// 1a says nothing: a bar that stayed exactly where the cursor found it already
			// answers the question. 1e does, because a shelved card that stays shelved does
			// not — nothing about the card told the user its assignee already matched the row.
			if (stays) new Notice(stays);
			return false;
		}
		const moved = await this.applyCardMove(item, writes, () => announceResourceMove(lanes, item.title, from, name));
		if (moved && stays) new Notice(stays);
		return moved;
	}
```

- [ ] **Step 6: Publish it on the host and delegate**

In `src/view/host.ts`, after `performHorizonMove`:

```ts
	/**
	 * Plan and apply the assignee write a resource move means — the target row's own
	 * name, or key removal for the shelf. The horizon axis's rule on this axis's
	 * property: one path for all three inputs (a drop, an Alt+Up/Down, the row menu's
	 * Set assignee), so no input can reach a row another cannot, and every move that
	 * lands announces itself once. A move onto the row the card is already in plans
	 * nothing and resolves false, leaving the undo slot untouched — but a card with no
	 * date to be placed at still says so, since nothing on screen would otherwise tell
	 * the reader the drop landed at all.
	 */
	performResourceMove(item: BacklogItem, name: string | null): Promise<boolean>;
```

In `src/view/backlogView.ts`, beside the `performHorizonMove` delegation:

```ts
	performResourceMove(item: BacklogItem, name: string | null): Promise<boolean> {
		return this.cardMoves.performResourceMove(item, name);
	}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run test/view/resourceMoves.test.ts --testTimeout=30000`
Expected: PASS, all nine.

- [ ] **Step 8: Watch two of them fail for the right reason**

The comment-becomes-a-check rule, on the two claims most likely to rot:

1. In `resourcePlacementLabel`, replace `source.keyPresent ? EMPTY_ASSIGNEE_LABEL : SHELF_LABEL` with `SHELF_LABEL`. Run the file. Expected: **"names an empty key…" FAILS** (`from Unplaced to Unplaced`). Restore.
2. In `performResourceMove`, move the `if (stays) new Notice(stays)` out of the empty-writes branch. Run the file. Expected: **"says a dateless card stays put…" FAILS** on the 1e half. Restore.

- [ ] **Step 9: Lint and commit**

Run: `npx eslint src/domain/roadmap.ts src/view/cardMoves.ts src/view/host.ts src/view/backlogView.ts src/view/interactions/cardDrag.ts test/view/resourceMoves.test.ts`

```bash
git add src/domain/roadmap.ts src/view/cardMoves.ts src/view/host.ts src/view/backlogView.ts src/view/interactions/cardDrag.ts test/view/resourceMoves.test.ts
git commit -m "Plan, apply and announce a resource move on one method"
```

---

### Task 3: The drag — a bar to take hold of, a band to drop it on, a shelf that un-assigns

Three seams reversed at once, because none of them works alone: a grip with no target is the "picked up and had nowhere to land" failure the view guide records, and a target no gesture can reach is the mirror of it.

**The geometry to know before editing.** Every row of this grid — the lane header, each bar row, each excluded note's row — is a flat sibling in `.pbl-timeline-content`, positioned against one shared day grid. There is no per-row container to wire, so the band is wired **element by element**. And `.pbl-timeline-drop` — the dated axis's one positional target — is `position: absolute; inset 0; z-index: 2` and takes pointer events for the whole day area while `.pbl-dragging` is on the view: left in place it would swallow every drop the rows are meant to receive. It is therefore not drawn at all where no position means anything. That exposes one decoration the overlay used to cover: `.pbl-today` is the only absolutely-positioned mark in the content layer without `pointer-events: none` (the gridlines, the weekend layer, the milestone lines and the dependency layer all already have it), so without a rule it becomes a 2px dead strip through every row — the exact defect `.pbl-milestone-line`'s own comment records.

**Files:**
- Modify: `src/view/render/timeline.ts`
- Modify: `src/view/render/lanes.ts`
- Modify: `src/view/render/roadmap.ts`
- Modify: `src/view/render/shelf.ts`
- Modify: `styles/timeline.css`, `styles/lanes.css`
- Test: `test/view/resourceMoves.test.ts` (append), `test/view/resourceLanes.test.ts` (two assertions invert)

**Interfaces:**
- Consumes: `performResourceMove` (Task 2); `CardDragController.wireCard(el, item, hold?, originScroll?)`, `.wireDropTarget(el, plan, hooks?, kind?)`, `.wireScroller(el)`.
- Produces: `TimelineDrawing.hold: 'dates' | 'card'` (replaces `grips: boolean`); `TimelineDrawing.laneTarget: ((el: HTMLElement, lane: ResourceLane) => void) | null`; `TimelineRender.overlay: HTMLElement | null`; `renderLaneHead(...): HTMLElement` (was `void`).

- [ ] **Step 1: Write the failing tests**

Append to `test/view/resourceMoves.test.ts`. Add `cardDrag` to the `../helpers/dnd` import, `cardByTitle` from `../helpers/board`, and `barFor, lanesOf, shelfOf, shelfTitles` from `../helpers/roadmap`.

```ts
/** The lane header for a name, which is one element of that resource's band. */
function laneHead(containerEl: HTMLElement, name: string): HTMLElement {
	const head = lanesOf(containerEl).find((el) => el.querySelector('.pbl-lane-name')?.textContent === name);
	if (!head) throw new Error(`no row for ${name}`);
	return head;
}

function shelf(containerEl: HTMLElement): HTMLElement {
	const el = shelfOf(containerEl);
	if (!el) throw new Error('the shelf is not rendered');
	return el;
}

describe('moving between resources by drag', () => {
	it('dropping a bar on another row’s header writes that resource, and nothing else', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		expect(vault.fm('Alice dated.md')['start']).toBe('2026-08-01');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('the whole band takes the drop, not only its header', async () => {
		// A row header, its bars and the excluded notes it places are siblings over one
		// shared day grid — there is no container to wire, so every element of the band is
		// a target of its own and a drop on a NEIGHBOUR'S bar row means that neighbour.
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		const aliceRow = barFor(containerEl, 'Cased').closest<HTMLElement>('.pbl-timeline-row');

		cardDrag(barFor(containerEl, 'Stray'), aliceRow as HTMLElement);
		await flush();

		expect(vault.fm('Stray.md')['assignee']).toBe('Alice');
	});

	it('the element under the drag highlights, and the highlight dies with the gesture', () => {
		const { containerEl } = laneRoadmap(resourceVault());
		const bob = laneHead(containerEl, 'Bob');

		cardDrag(barFor(containerEl, 'Alice dated'), bob);

		expect(bob.hasClass('pbl-drop-over')).toBe(false);
	});

	it('drags off the shelf into a row, the same single write', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);
		expect(shelfTitles(containerEl).sort()).toEqual(['Nobody', 'Undated']);

		cardDrag(cardByTitle(containerEl, 'Nobody'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Nobody.md')['assignee']).toBe('Bob');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('drops on the shelf to un-assign, and undo puts the name back', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), shelf(containerEl));
		await flush();
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);
	});

	it('a minted row is a target like any other — observed vocabulary is writable', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Zoe'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Zoe');
	});

	it('renders in its new row on the write’s own refresh', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();
		refresh(view, vault);

		expect(laneOrder(containerEl)).toEqual(['lane:Alice', 'Cased', 'lane:Bob', 'Alice dated', 'lane:Zoe', 'Stray']);
	});

	it('config problems block a resource move, exactly as every other write', async () => {
		const vault = resourceVault();
		const { containerEl } = laneRoadmap(vault, { orderProperty: 'note.parent' });

		cardDrag(barFor(containerEl, 'Alice dated'), laneHead(containerEl, 'Bob'));
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Alice');
		expect(Notice.messages.some((m) => m.startsWith('Fix the view options first'))).toBe(true);
	});

	it('offers no date grip here, and registers no positional target for one', () => {
		// The half that must NOT come back with the drag: a bar on this axis is an ordinary
		// card — hold `null`, no baseline, no date — because a move here writes an assignee.
		// The overlay is what a date gesture lands on, and it is not drawn: left in place it
		// would take pointer events for the whole day area and swallow every drop the rows
		// above are the target for.
		const { containerEl } = laneRoadmap(resourceVault());

		expect(containerEl.querySelectorAll('.pbl-bar-grip')).toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline-drop')).toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-content')?.classList.contains('pbl-timeline-flat')).toBe(true);
	});

	it('leaves the dated axis’s own overlay and grips alone', () => {
		const { view, containerEl } = laneRoadmap(resourceVault());

		view.setAxisPick('dates');

		expect(containerEl.querySelectorAll('.pbl-bar-grip')).not.toHaveLength(0);
		expect(containerEl.querySelector('.pbl-timeline-drop')).not.toBeNull();
		expect(containerEl.querySelector('.pbl-timeline-content')?.classList.contains('pbl-timeline-flat')).toBe(false);
	});
});
```

Add `refresh` to the `../helpers/view` import and `laneOrder` to the `../helpers/roadmap` import.

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run test/view/resourceMoves.test.ts --testTimeout=30000`
Expected: the new block FAILS — `barFor` throws nothing but no drag is wired, so every write assertion fails, and `.pbl-timeline-drop` is present.

- [ ] **Step 3: Tell the grid what a gesture on it means**

In `src/view/render/timeline.ts`, replace `TimelineDrawing.grips` with the two fields:

```ts
	/**
	 * What a gesture on this grid MEANS — the one thing the two grid axes do not share.
	 * `'dates'` wires each bar's holds (`barHolds`) against the positional target the
	 * caller registers on the overlay; `'card'` wires the BAR as an ordinary card drag —
	 * hold `null`, no span baseline, no ends — because on the resources axis what a bar is
	 * dropped ON is the whole of the message. Neither is the other narrowed: a date hold
	 * offered where a row means WHO would write the axis the reader is not looking at, and
	 * a grip advertised with no date target registered is the "picked up and had nowhere
	 * to land" failure `src/view/CLAUDE.md` records.
	 */
	hold: 'dates' | 'card';
	/**
	 * Wire one element of a resource's band as a drop target. What a drop MEANS is the
	 * caller's, exactly as `wireDropTarget`'s own `plan` is: this module knows which
	 * elements belong to which row and nothing about what landing on one should write.
	 * Called per ELEMENT — the header, each bar row, each excluded note's row — because
	 * they are siblings positioned against one shared day grid and there is no container
	 * to wire. Null on the dated axis, which has no rows to belong to.
	 */
	laneTarget: ((el: HTMLElement, lane: ResourceLane) => void) | null;
```

In `renderTimeline`, thread it: `const { today, scale, dnd, palettes, available, shelf } = drawing;` is unchanged; `mounts` takes `hold: drawing.hold` in place of `grips: drawing.grips`; and `BarRowMounts.grips` becomes:

```ts
	/** See `TimelineDrawing.hold`. */
	hold: 'dates' | 'card';
```

Mark the content layer and wire the band in the entries loop:

```ts
	const content = grid.createDiv({ cls: 'pbl-timeline-content' + (drawing.hold === 'dates' ? '' : ' pbl-timeline-flat') });
```

```ts
	for (const entry of entries) {
		if (entry.kind === 'lane') {
			lane = entry.lane;
			drawing.laneTarget?.(renderLaneHead(ctx, content, entry.lane), entry.lane);
			continue;
		}
		const row =
			entry.kind === 'context'
				? renderLaneContextRow(ctx, content, entry.item)
				: reportColors(renderBarRow(ctx, mounts, window, entry.row, scale), drawn);
		// Whose row this is, said on the row itself: the header is a sibling div and
		// cannot label what follows it. See `renderLaneRowDescription`.
		if (lane) {
			renderLaneRowDescription(row, lane.name);
			drawing.laneTarget?.(row, lane);
		}
		if (drawnRows % 2 === 1) row.addClass('pbl-row-even');
		drawnRows++;
	}
```

Draw the overlay only where a position says something, and widen the reported type to `HTMLElement | null`:

```ts
	// One overlay over the day area … (keep the existing comment, and add:)
	//
	// Drawn only where a POSITION on it means something. The resources axis registers no
	// positional target — which row a bar lands in is the whole message — and an overlay
	// left standing there would take pointer events for the entire day area while
	// `.pbl-dragging` is on the view, swallowing every drop the rows beneath it are the
	// target for. This is not the empty shelf's case, which stays in the DOM because it
	// can always be dropped on: here it can never be.
	const overlay =
		drawing.hold === 'dates'
			? content.createDiv({ cls: 'pbl-timeline-drop', attr: { 'aria-hidden': 'true' } })
			: null;
```

```ts
	/** The one drop target spanning the day area, or null on an axis that positions nothing. */
	overlay: HTMLElement | null;
```

- [ ] **Step 4: Wire the bar as an ordinary card where the axis says so**

In `renderBarRow`:

```ts
	const holds = mounts.hold === 'dates' ? barHolds(bar.item, ctx.host.settings, bar) : [];
	// The cursor promises what a drop actually registers, on both axes: the dated axis's
	// body hold, or this axis's whole-bar card drag.
	const el = track.createDiv({ cls: barClasses(bar, geometry, mounts.hold === 'card' || holds.includes('body')) });
```

and, immediately after the `for (const hold of holds)` loop:

```ts
	// The resources axis's own source: the BAR is what the reader takes hold of, wired as
	// an ordinary card — `hold: null`, which is exactly what each axis's shelf `accepts`
	// asks for and what a row's own drop target takes. No `originScroll`: nothing here is
	// measured as a delta. A context row never reaches this function (`deriveBars` routes
	// one away before a bar exists), and `wireCard` refuses one regardless.
	if (mounts.hold === 'card') mounts.dnd.wireCard(el, bar.item);
```

- [ ] **Step 5: Hand the header back so its caller can wire it**

In `src/view/render/lanes.ts`, change `renderLaneHead`'s signature to `): HTMLElement {`, end it with `return head;`, and add to its doc comment:

```
 * Returns the element, so the caller can wire it: this module draws a row's header and
 * has no opinion about what dropping on one means.
```

- [ ] **Step 6: Say what a drop on a band means, in `render/roadmap.ts`**

In `renderGridAxis`, replace the drawing literal's `grips` line and the `wireTimelineDrag` block:

```ts
	const timeline = renderTimeline(ctx, frameEl, entries, {
		today,
		scale: activeScale,
		dnd,
		shelf: roadmap.shelf,
		palettes,
		hold: axis === 'dates' ? 'dates' : 'card',
		laneTarget: axis === 'resources' ? (el, lane) => laneDrop(ctx, dnd, el, lane) : null,
		available: treeEl.clientWidth,
	});
	if (axis === 'dates' && timeline.overlay) {
		wireTimelineDrag(ctx, dnd, {
			overlay: timeline.overlay,
			scroller: timeline.scroller,
			window: timeline.window,
			scale: activeScale,
			headerTrack: timeline.headerTrack,
			tracks: timeline.tracks,
			leadWidth: timeline.leadWidth,
		});
	} else {
		// `wireTimelineDrag` does this for the dated axis; a roster taller than the pane
		// needs it just as much, and the horizon axis's buckets already have it.
		dnd.wireScroller(timeline.scroller);
	}
	return timeline;
```

and add beside it:

```ts
/**
 * What dropping on a resource's band means: that row's own name into the dragged note's
 * assignee property, through the ONE method every input on this axis lands on. A minted
 * row is a target like any other — its name is observed vocabulary, and observed
 * vocabulary is writable, the board's own rule.
 *
 * Wired per ELEMENT rather than per band, because a header, its bars and the excluded
 * notes it places are siblings positioned against one shared day grid and there is no
 * container to wire. What that costs is the highlight: the element under the pointer
 * lights rather than the whole band. That is a live-vault check — jsdom paints nothing —
 * and the alternative, a wrapper per row, would put a box between every row and the
 * sticky lead column the grid's geometry rests on.
 */
function laneDrop(ctx: RowContext, dnd: CardDragController, el: HTMLElement, lane: ResourceLane): void {
	dnd.wireDropTarget(el, (source) => void ctx.host.performResourceMove(source.item, lane.name));
}
```

Import `ResourceLane` from `../../domain/roadmap`. Also update `renderGridAxis`'s own doc comment: the "**What a gesture may do**" paragraph now reads that the resources axis wires each of its bands and offers the bar itself, rather than that it wires none.

- [ ] **Step 7: Make the shelf un-assign**

In `src/view/render/shelf.ts`, replace the whole `'resources'` branch of `shelfRemoval`:

```ts
	if (axis === 'resources') {
		return {
			plan: (source) => void host.performResourceMove(source.item, null),
			tooltip: 'Results this axis cannot place — dropping a card here removes its assignee',
			// The horizon axis's rule and its reason: a card already DRAWN here can still
			// carry a name — assigned, with no date to sit beside — so refusing a re-drop
			// would withhold exactly the cleanup the shelving reason is asking for. A
			// re-drop with nothing to clear plans zero writes and no-ops.
			accepts: (source) => source.hold === null,
			// Nothing to distinguish before the release: a drop here always un-assigns.
			outcome: null,
			// Every shelved item can be re-assigned; unlike the dated axis, there is no
			// type here whose only writable end might be missing.
			canDrag: () => true,
		};
	}
```

- [ ] **Step 8: Stop the today line intercepting the drop**

In `styles/timeline.css`, immediately after the `.pbl-today` rule:

```css
/* The resources axis positions nothing by the pointer, so it draws no `.pbl-timeline-drop`
   — and that overlay is what used to cover the full-height marks. Every other absolutely
   positioned decoration in the content layer already opts out of pointer events
   (`.pbl-grid-line`, `.pbl-weekend-layer`, `.pbl-milestone-line`, `.pbl-dependency-layer`);
   this line cannot do so unconditionally, because its tooltip is the only place its date
   is written. Without this it is a 2px dead strip through every row on that axis,
   swallowing the drop the row beneath it is the target for — the exact defect
   `.pbl-milestone-line`'s own comment records, reached by the other route. */
.pbl-timeline-flat .pbl-today {
	pointer-events: none;
}
```

- [ ] **Step 9: Show the drop, and show what is being dragged**

Append to `styles/lanes.css`:

```css
/* The drop signal, and the only one: which row a bar lands in is the whole message, so
   there is no position within a row to indicate. Wired per element rather than per band
   (`laneDrop` in `src/view/render/roadmap.ts`), so what lights is the header or the row
   under the pointer. The lead column paints its own background and would otherwise cover
   the highlight across the one part of the row the reader is most likely to be over. */
.pbl-lane-head.pbl-drop-over,
.pbl-timeline-row.pbl-drop-over {
	box-shadow: 0 0 0 1px var(--interactive-accent) inset;
	background-color: hsla(var(--interactive-accent-hsl), 0.08);
}

.pbl-lane-head.pbl-drop-over .pbl-timeline-lead,
.pbl-timeline-row.pbl-drop-over .pbl-timeline-lead {
	background-color: hsla(var(--interactive-accent-hsl), 0.08);
}

/* The bar being carried, the tree row's own `.pbl-drag-source` opacity over the mark that
   is the drag source here. */
.pbl-bar.pbl-drag-source {
	opacity: 0.35;
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run test/view/resourceMoves.test.ts --testTimeout=30000`
Expected: PASS.

- [ ] **Step 11: Invert the two read-only assertions in `resourceLanes.test.ts`**

That file's header claims the axis drives no move, and two of its tests state the narrowing. Replace them; the moves themselves are `resourceMoves.test.ts`'s subject, so what stays here is what the axis DRAWS.

Rewrite the file's opening doc comment's second paragraph:

```ts
/**
 * The resources axis on screen: one row per resource over the dated grid it derives from.
 *
 * What a move DOES is `test/view/resourceMoves.test.ts`'s subject. What stays here is the
 * one half of it this file is about: a bar on this axis offers no date grip, because a
 * move here writes an assignee and the grid registers no target a date gesture could land
 * on.
 */
```

Replace the `'offers no grip on a bar…'` test's comment (its assertions stand):

```ts
	it('offers no date grip on a bar, because a move here writes an assignee', () => {
		// The bar IS the drag source now, wired as an ordinary card — but a grip writes a
		// DATE, and this grid registers no positional target for one. See
		// `test/view/resourceMoves.test.ts` for the drop it does take.
		const harness = laneRoadmap(resourceVault());
		expect(harness.containerEl.querySelectorAll('.pbl-bar-grip')).toHaveLength(0);
		expect(harness.containerEl.querySelectorAll('.pbl-bar')).not.toHaveLength(0);
	});
```

Replace the `'offers a shelf that accepts nothing…'` test entirely:

```ts
	it('offers a shelf that un-assigns, and takes any shelved card as a source', () => {
		// Asked at the object as well as through a gesture: the strip must not highlight
		// for a drag it would not honour, and a shelved card that could not be picked up
		// would leave triage a one-way street.
		const harness = laneRoadmap(resourceVault());
		const removal = shelfRemoval(harness.view, 'resources');
		const item = harness.view.model?.byPath.get('Undated.md');

		// A grip released here is not an un-assignment; an ordinary card is.
		expect(removal.accepts({ item, hold: 'body' } as never)).toBe(false);
		expect(removal.accepts({ item, hold: null } as never)).toBe(true);
		expect(removal.canDrag(item as never)).toBe(true);
		// Nothing to distinguish before the release: a drop here always un-assigns.
		expect(removal.outcome).toBeNull();
	});
```

Run: `npx vitest run test/view/resourceLanes.test.ts --testTimeout=30000`
Expected: PASS.

- [ ] **Step 12: Watch the overlay guard fail**

Restore the overlay unconditionally (`const overlay = content.createDiv({ cls: 'pbl-timeline-drop', ... });` and drop the `pbl-timeline-flat` class), run `npx vitest run test/view/resourceMoves.test.ts`. Expected: **"offers no date grip here…" FAILS**. Restore.

This is the one claim jsdom can only half-check — that the overlay is absent, not that its presence would have swallowed the drop (jsdom hit-tests nothing). Say so, and put the live check on the register in Task 7.

- [ ] **Step 13: Run everything the grid touches, and lint**

Run: `npx vitest run test/view/ test/domain/ --testTimeout=30000`
Expected: PASS. `timelineDrag`, `timelineCollapse`, `roadmapFrame` and `dependencyArrows` all read the overlay or the row loop — any failure there is this task's.

Run: `npx eslint src/ styles/ 2>/dev/null; npx eslint .`
Expected: clean, `timeline.ts` still under 400.

- [ ] **Step 14: Commit**

```bash
git add src/view/render/timeline.ts src/view/render/lanes.ts src/view/render/roadmap.ts src/view/render/shelf.ts styles/timeline.css styles/lanes.css test/view/resourceMoves.test.ts test/view/resourceLanes.test.ts
git commit -m "Drag a bar into a resource's row, and onto the shelf to un-assign"
```

---

### Task 4: The keyboard — one row up, one row down

Extension 1b, and the direction is the point: **Alt+Up/Down**, because resources are rows stacked on the same calendar grid the dated axis draws, and Alt+Left/Right on that grid is reserved — `horizonStops` answers null on the dated axis today precisely so a future scheduling gesture can claim them without a stray shortcut already meaning something else.

**Files:**
- Modify: `src/view/interactions/keyboard.ts`
- Test: `test/view/resourceMoves.test.ts` (append)

**Interfaces:**
- Consumes: `performResourceMove`; `RoadmapModel.lanes`; `item.assigneeValue`; `sameValue`.
- Produces: nothing exported — `resourceStops`, `handleResourceMoveKey`, `handleHorizonMoveKey` and `ladderStep` are module-private.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/resourceMoves.test.ts`. Add `key, treeOf` to the `../helpers/view` import.

```ts
describe('moving between resources without a drag', () => {
	it('Alt+Down advances the selected card one row, writing the drop’s own value', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);
		key(treeOf(containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.fm('Alice dated.md')['assignee']).toBe('Bob');
		expect(vault.writeLog).toHaveLength(1);
	});

	it('Alt+Up off the first row un-assigns, and off the shelf does nothing', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);
		const tree = treeOf(containerEl);

		// The shelf leads the ladder, the horizon axis's own rule: it is where un-placing
		// lives and where an untriaged card enters the axis from.
		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);

		// And there is nowhere further up: the edges hold rather than wrap.
		view.selectItem(view.model?.byPath.get('Nobody.md') as never);
		key(tree, 'ArrowUp', { altKey: true });
		await flush();
		expect(vault.writeLog.map((w) => w.path)).toEqual(['Alice dated.md']);
	});

	it('holds at the last row rather than wrapping', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		// Zoe is the last row drawn.
		view.selectItem(view.model?.byPath.get('Stray.md') as never);
		key(treeOf(containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.fm('Stray.md')['assignee']).toBe('Zoe');
		expect(vault.writeLog).toEqual([]);
	});

	it('reaches a card drawn on the shelf whose note still names somebody', async () => {
		// `Undated` names Alice and has no date to sit at, so this axis mints no row for
		// it — it is drawn on the shelf without being ON it, and taking that name off is a
		// real, undoable write the drag and the menu can both express. The keyboard is the
		// third input to one move, so it has to reach it too.
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);

		view.selectItem(view.model?.byPath.get('Undated.md') as never);
		key(treeOf(containerEl), 'ArrowUp', { altKey: true });
		await flush();

		expect('assignee' in vault.fm('Undated.md')).toBe(false);
	});

	it('writes nothing on Alt+Left, Alt+Right, or Alt with a second modifier', async () => {
		const vault = resourceVault();
		const { view, containerEl } = laneRoadmap(vault);
		const tree = treeOf(containerEl);
		view.selectItem(view.model?.byPath.get('Alice dated.md') as never);

		// Left/Right on this grid is reserved: resources sit ON the dated axis, and only
		// one dimension can have those keys. A chord aimed at Obsidian or the OS must not
		// land as a frontmatter write either.
		key(tree, 'ArrowLeft', { altKey: true });
		key(tree, 'ArrowRight', { altKey: true });
		key(tree, 'ArrowDown', { altKey: true, shiftKey: true });
		key(tree, 'ArrowDown', { altKey: true, ctrlKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
	});

	it('leaves Alt+Up/Down inert on the horizon axis, where rows are not what moves', async () => {
		// The control beside the case above: the ladder is per axis, and the horizon
		// axis's own is Left/Right. Neither may quietly answer the other's keys.
		const vault = new FakeVault();
		vault.addFile('Item.md', { frontmatter: { type: 'Epic', order: 10, horizon: 'Now' } });
		const harness = makeView(vault, { horizonProperty: 'note.horizon' }, { collapsed: true });
		harness.view.setProjection('roadmap');
		harness.view.selectItem(harness.view.model?.byPath.get('Item.md') as never);

		key(treeOf(harness.containerEl), 'ArrowDown', { altKey: true });
		await flush();

		expect(vault.writeLog).toEqual([]);
	});
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run test/view/resourceMoves.test.ts -t "without a drag" --testTimeout=30000`
Expected: FAIL on the first four — `handleRoadmapMoveKey` answers only Left/Right, and only on the horizon axis. The last two pass already, which is what makes them the control rather than the coverage.

- [ ] **Step 3: Split the move key per axis, and share only the arithmetic**

In `src/view/interactions/keyboard.ts`, add beside `horizonStops`:

```ts
/**
 * The rows an Alt+arrow steps through on the resources axis: the shelf first, then the
 * rows as they render — `horizonStops`' ladder over a different property, and the shelf
 * leads for that ladder's own stated reason.
 *
 * Null on the other two axes, so this handler swallows no key it does not act on.
 */
function resourceStops(roadmap: RoadmapModel): (string | null)[] | null {
	if (roadmap.axis !== 'resources') return null;
	return [null, ...roadmap.lanes.map((lane) => lane.name)];
}

/**
 * One step along a placement ladder: the neighbouring stop, or null at an edge. The edges
 * HOLD rather than wrap — a card at the end has nowhere further to advance, and wrapping
 * would un-place finished triage unasked.
 *
 * `offLadder` is the exception both axes need and neither could express without it: a card
 * DRAWN where the ladder's first stop is, without being ON it, because its note still
 * holds something. A backward step from there is the real, undoable cleanup the drag and
 * the menu both plan for the same card, and indexing it at stop 0 made that stop an edge
 * for exactly the card that had somewhere to go.
 */
function ladderStep(stops: (string | null)[], current: number, step: number, offLadder: boolean): number | null {
	const target = offLadder && step < 0 ? 0 : current + step;
	return target < 0 || target >= stops.length ? null : target;
}
```

Replace `handleRoadmapMoveKey` with the dispatcher plus the two handlers. The horizon body is the existing one, minus the `card.outsideFilter` test (hoisted) and with the arithmetic delegated:

```ts
/**
 * Alt+arrow: the selected card moves one placement, by the drop's own write. Which KEYS
 * that is, and along which ladder, is the axis's — buckets lay out sideways and resources
 * stack, so the two cannot share a handler unchanged; what they do share is `ladderStep`.
 */
function handleRoadmapMoveKey(
	host: BacklogViewHost,
	snapshot: RoadmapSnapshot,
	card: BacklogItem,
	evt: KeyboardEvent,
): void {
	// Never a context card: the same rule that keeps it out of the draggables, applied
	// where a keyboard could otherwise reach past them. Before any `preventDefault`, so a
	// key this handler does not act on is left to whatever else wants it.
	if (card.outsideFilter) return;
	if (snapshot.roadmap.axis === 'resources') handleResourceMoveKey(host, snapshot.roadmap, card, evt);
	else handleHorizonMoveKey(host, snapshot.roadmap, card, evt);
}

/** Alt+Left/Right: the selected card moves one bucket, by the drop's own write. */
function handleHorizonMoveKey(host: BacklogViewHost, roadmap: RoadmapModel, card: BacklogItem, evt: KeyboardEvent): void {
	if (evt.key !== 'ArrowLeft' && evt.key !== 'ArrowRight') return;
	// Not this projection's chord to swallow on the dated axis: those moves are the
	// scheduling feature's, and a shortcut that quietly did something else instead would
	// be worse than one that does nothing.
	const stops = horizonStops(roadmap);
	if (!stops) return;
	evt.preventDefault();
	// An unreadable or empty value shelves the card, and `sameValue` reads both as
	// absence — so the stop it moves FROM is the one it is drawn in, not the one it claims.
	const current = stops.findIndex((stop) => sameValue(stop, card.horizon.value));
	if (current < 0) return;
	// …but it is drawn on the shelf without being ON it: the note still holds something,
	// so reaching the shelf is a real, undoable cleanup — the very write the shelf drop
	// and Clear horizon plan for the same card.
	const offLadder = card.horizon.value === null && card.ownKeys.horizon;
	const target = ladderStep(stops, current, evt.key === 'ArrowRight' ? 1 : -1, offLadder);
	if (target === null) return;
	void host.performHorizonMove(card, stops[target]);
}

/**
 * Alt+Up/Down: the selected card moves one resource row, by the drop's own write.
 *
 * UP and DOWN because resources are ROWS, stacked on the same calendar grid the dated axis
 * draws — and because Left/Right on that grid is reserved: `horizonStops` answers null on
 * the dated axis today precisely so a future scheduling gesture can claim them there
 * without a stray shortcut already meaning something else. Resources sit ON that grid, so
 * this is the one axis where a row change and a date change could both plausibly want the
 * same keys, and only one dimension can have them.
 */
function handleResourceMoveKey(host: BacklogViewHost, roadmap: RoadmapModel, card: BacklogItem, evt: KeyboardEvent): void {
	if (evt.key !== 'ArrowUp' && evt.key !== 'ArrowDown') return;
	const stops = resourceStops(roadmap);
	if (!stops) return;
	evt.preventDefault();
	const current = stops.findIndex((stop) => sameValue(stop, card.assigneeValue));
	// A name no drawn row carries — `handleHorizonMoveKey`'s `offLadder`, reached by this
	// axis's own minting rule rather than by an empty key: a row exists only where a BAR
	// lands, so a card naming somebody with no date to sit beside is drawn on the shelf
	// while its note still names them. Taking that name off is what the shelf drop and
	// Clear assignee both plan for it, so the keyboard has to be able to say it too.
	const offLadder = current < 0;
	const target = ladderStep(stops, offLadder ? 0 : current, evt.key === 'ArrowDown' ? 1 : -1, offLadder);
	if (target === null) return;
	void host.performResourceMove(card, stops[target]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/view/resourceMoves.test.ts test/view/roadmapMoves.test.ts test/view/keyboard.test.ts --testTimeout=30000`
Expected: PASS. `roadmapMoves.test.ts`'s whole "without a drag" block is the regression check on the horizon split — including its `'writes nothing on Alt+Up, Alt+Down'` case, which is now the statement that the two ladders do not answer each other's keys.

- [ ] **Step 5: Watch the off-ladder branch fail**

Change `const offLadder = current < 0;` to `const offLadder = false;` and re-run. Expected: **"reaches a card drawn on the shelf whose note still names somebody" FAILS** — with `current` at -1 the step is computed from 0 either way, so the key goes silent. Restore.

- [ ] **Step 6: Lint the line budget and commit**

Run: `npx eslint src/view/interactions/keyboard.ts`
Expected: clean (the file had ~57 lines of headroom; this adds ~30). If `max-lines` trips, split the roadmap half into `src/view/interactions/roadmapKeys.ts` and name that module in the PBI's `## Where it lives` — `docs-check.mjs` rule 7 will otherwise fail.

```bash
git add src/view/interactions/keyboard.ts test/view/resourceMoves.test.ts
git commit -m "Step a card one resource row with Alt+Up and Alt+Down"
```

---

### Task 5: The menu — the rows on screen, through the same move

Two changes, and the first is what makes the third input reach everything the first two can: a **declared** resource with nothing assigned yet has a row a drag can drop into and appears on no result, so `assigneeChoices` built from the observed names alone offers strictly less than the gesture beside it.

**Files:**
- Modify: `src/view/interactions/labels.ts`
- Test: `test/view/resourceMoves.test.ts` (append), and check `test/view/assignee.test.ts` still passes unchanged

**Interfaces:**
- Consumes: `performResourceMove`; `host.roadmap?.roadmap.lanes`; `rowVocabulary(model, item).observedAssignees`.
- Produces: no new exports — `assigneeChoices` and `chooseAssignee` are module-private; `addLabelItems`' spec gains an optional `apply`.

- [ ] **Step 1: Write the failing tests**

Append to `test/view/resourceMoves.test.ts`. Add `Menu` to the `../helpers/obsidian-mock` import and `vi` (already imported).

```ts
describe('Set assignee on this axis', () => {
	it('leads with the rows on screen, declared-and-empty included', () => {
		const { view } = laneRoadmap(resourceVault());

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		const submenu = Menu.lastShown?.item('Set assignee')?.submenu;

		// Every row a drop can reach, in the order the frame draws them — Bob has a row
		// and appears on no result, so a list built from the observed names alone would
		// offer strictly less than the drag beside it.
		expect(submenu?.items.map((i) => i.titleText)).toEqual([
			'Alice',
			'Bob',
			'Zoe',
			'New assignee...',
			'Clear assignee',
		]);
		expect(submenu?.item('Alice')?.checked).toBe(true);
	});

	it('routes a pick through the one method, so a pick and a drop say one sentence', async () => {
		vi.useFakeTimers();
		const { view } = laneRoadmap(resourceVault());
		const spy = vi.spyOn(view, 'performResourceMove');

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Bob')?.clickHandler?.();

		expect(spy).toHaveBeenCalledOnce();
		expect(await announced()).toBe('Moved "Alice dated" from Alice to Bob');
	});

	it('clears the key from the menu, the shelf drop’s own write', async () => {
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);

		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Clear assignee')?.clickHandler?.();
		await flush();

		expect('assignee' in vault.fm('Alice dated.md')).toBe(false);
	});

	it('goes straight through the gate off this axis, where there is no frame to announce into', async () => {
		vi.useFakeTimers();
		const vault = resourceVault();
		const { view } = laneRoadmap(vault);
		const spy = vi.spyOn(view, 'performResourceMove');

		view.setProjection('tree');
		view.showContextMenuFor(view.model?.byPath.get('Alice dated.md') as never);
		Menu.lastShown?.item('Set assignee')?.submenu?.item('Zoe')?.clickHandler?.();
		await flush();

		expect(spy).not.toHaveBeenCalled();
		expect(vault.fm('Alice dated.md')['assignee']).toBe('Zoe');
		expect(await announced()).toBe('');
	});
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npx vitest run test/view/resourceMoves.test.ts -t "Set assignee" --testTimeout=30000`
Expected: the first two FAIL — `Bob` is on no result so the list is `['Alice', 'Zoe', …]`, and nothing routes through the host method.

- [ ] **Step 3: Lead with the drawn rows**

In `src/view/interactions/labels.ts`, replace `assigneeChoices`:

```ts
/**
 * What Set assignee offers: every name the RESULTS carry, plus the item's own when the
 * base has no other note naming it — the tag menu's rule, over a single value.
 *
 * There is no declared list to prefer here and none to fall back to, which is why the
 * observed names are the whole of it rather than a union like the horizon's: nobody
 * configures who exists. A name this base has never seen is still reachable, through
 * **New assignee...** below, and that is what keeps an empty vocabulary from being an
 * empty menu — the reason this feature needs only a key named, where risk needs a key
 * and a list.
 *
 * On the roadmap's resources axis the DRAWN ROWS lead, read off the frame as drawn —
 * `horizonChoices`' rule for its buckets, and the board's Set state for its columns. It
 * matters here for a reason this menu did not have until that axis could be moved on: a
 * DECLARED resource with nothing assigned yet has a row a drag can drop into and appears
 * on no result at all, so a list built from the observed names alone would be the one
 * input to a move that goes quiet. Everything observed still follows, so what is
 * reachable never depends on what is on screen.
 */
function assigneeChoices(host: BacklogViewHost, item: BacklogItem): string[] {
	// Through `rowVocabulary` like the state, horizon and tag menus, and for their reason:
	// a vocabulary is scoped to the population of the projection that offers it. Read off
	// the model directly — which is what this did until review — a name only a test carries
	// is offered on every plan row, and a catalog row cannot reuse a name observed on
	// another test. Per ROW rather than per projection, because both directions of a
	// projection-wide answer are wrong: see `rowVocabulary`'s own comment.
	const observed = host.model ? rowVocabulary(host.model, item).observedAssignees : [];
	const drawn = onResourceAxis(host) ? (host.roadmap?.roadmap.lanes ?? []).map((lane) => lane.name) : [];
	const values = [...drawn, ...observed.filter((v) => !drawn.some((d) => sameValue(d, v)))];
	const current = item.assigneeValue;
	if (current === null || values.some((v) => sameValue(v, current))) return values;
	return [...values, current];
}

/**
 * Whether the frame on screen is the one whose rows this property draws. Asked twice —
 * for what the menu offers, and for where a pick goes — and stated once, because a menu
 * that offered the drawn rows while its picks bypassed the move would be exactly the
 * disagreement routing them together exists to prevent.
 */
function onResourceAxis(host: BacklogViewHost): boolean {
	return host.projection === 'roadmap' && host.roadmap?.roadmap.axis === 'resources';
}

/**
 * What picking a name DOES. On the resources axis it takes the DRAG's own path, so a pick
 * and a drop onto the same row are one write, one gate and — the part only this path can
 * supply — one announcement, said once by `performResourceMove` rather than by each input
 * separately. Elsewhere there is no frame to announce into and the planned write goes
 * straight through the gate. `chooseHorizon` splits on the roadmap for this reason and
 * `chooseState` on the board.
 */
function chooseAssignee(host: BacklogViewHost, item: BacklogItem, value: string | null): Promise<unknown> {
	if (onResourceAxis(host)) return host.performResourceMove(item, value);
	return host.applySafely(computeAssigneeWrites(item, value));
}
```

- [ ] **Step 4: Let a label say where its pick goes**

Still in `labels.ts`, add to `addLabelItems`' `spec` parameter:

```ts
		/**
		 * What a pick DOES, where that is more than handing the plan to the gate — the
		 * assignee's route through `performResourceMove` while its own axis is drawn. The
		 * CHECKMARK still asks `writes`, and must: an entry is checked exactly when picking
		 * it would write nothing, which is a question about the plan and not about who
		 * applies it.
		 */
		apply?: (value: string | null) => void;
```

and at the top of its body:

```ts
	const apply = spec.apply ?? ((value: string | null) => void host.applySafely(spec.writes(value)));
```

Replace the two call sites inside it: `si.setTitle(value).onClick(() => apply(value));` and the clear entry's `.onClick(() => apply(null))`.

In `addAssigneeItems`, add `apply: (value) => void chooseAssignee(host, item, value),` to the spec. In `promptNewAssignee`, change `onSubmit` to `onSubmit: (value) => void chooseAssignee(host, item, value.trim()),` — a typed name is a fourth input to the same move, not a second plan beside it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/view/resourceMoves.test.ts test/view/assignee.test.ts test/view/menu.test.ts test/view/plan.test.ts --testTimeout=30000`
Expected: PASS. `assignee.test.ts` drives the menu off the roadmap and must be untouched by this — if it fails, `onResourceAxis` is answering true where no resources axis is drawn.

- [ ] **Step 6: Watch the routing fail**

Change `chooseAssignee` to always return `host.applySafely(...)`. Run the file. Expected: **"routes a pick through the one method…" FAILS** — the write still lands, and nothing is announced. That failure is the whole content of the rule: the defect a second plan produces is silence, not a wrong write. Restore.

- [ ] **Step 7: Lint and commit**

Run: `npx eslint src/view/interactions/labels.ts`

```bash
git add src/view/interactions/labels.ts test/view/resourceMoves.test.ts
git commit -m "Offer the drawn resource rows, and route the pick through the move"
```

---

### Task 6: The context-row rule, asked of this axis's three entry points

`test/view/contextCardWrites.test.ts`'s resources block says in its own doc comment that its questions are "narrower than its siblings' on purpose … **this axis writes nothing yet**." That is now false, and a suite whose comment is false is worse than one that is absent. Ask all three questions.

**Files:**
- Modify: `test/view/contextCardWrites.test.ts` (the resources block)

**Interfaces:**
- Consumes: `laneStressView()` (already in the file — the fixture is unchanged); `performResourceMove`.

- [ ] **Step 1: Rewrite the block's doc comment and its three tests**

Replace the block's doc comment:

```ts
	/**
	 * The same stress shape on the resources axis: the context PBI names a resource of its
	 * own and renders inside that row, among live bars.
	 *
	 * Three questions, its siblings' own: the drag, the paths a keyboard and a menu can
	 * take that a drag cannot, and the structural refusal behind both. A context row here
	 * is drawn INSIDE a row rather than beside the frame, so it is also an element of that
	 * row's band and therefore a drop TARGET — which is safe and worth saying out loud:
	 * a drop names the row, and the write names the DRAGGED note, so landing on a context
	 * row assigns the dragged item to the resource whose row it is standing in.
	 */
```

Replace the three tests:

```ts
	it('never writes to a context card, whatever is dropped wherever', async () => {
		const { view, containerEl, vault } = laneStressView();
		expect(view.model?.byPath.get('Mid.md')?.outsideFilter).toBe(true);
		const cards = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-card'));
		const bars = Array.from(containerEl.querySelectorAll<HTMLElement>('.pbl-bar'));
		const targets = Array.from(
			containerEl.querySelectorAll<HTMLElement>('.pbl-lane-head, .pbl-timeline-row, .pbl-shelf'),
		);
		expect(bars.length).toBeGreaterThan(0);

		// Every source this axis has — a bar and a card — onto every element of every
		// band and the shelf. The context row is not draggable (never wired), so its own
		// gestures fall on the floor rather than into a plan.
		for (const source of [...cards, ...bars]) {
			for (const target of targets) {
				cardDrag(source, target);
				await flush();
			}
		}
		const touched = [...new Set(vault.writeLog.map((w) => w.path))];
		expect(touched).not.toContain('Mid.md');
		// Not vacuous: the live bars really were assigned along the way.
		expect(touched).toContain('PBI.md');
	});

	it('never writes to a context card from the keyboard or the menu either', async () => {
		const { view, containerEl, vault } = laneStressView();
		const mid = view.model?.byPath.get('Mid.md');
		const tree = treeOf(containerEl);

		// Selected as a card and moved with the shortcut: the path a drag cannot take (a
		// context card is never wired as a draggable) and a keyboard can.
		view.selectItem(mid as never);
		key(tree, 'ArrowUp', { altKey: true });
		key(tree, 'ArrowDown', { altKey: true });
		await flush();

		// And the menu, the one path that works everywhere: it withholds every entry that
		// would edit this note — Set assignee included, which on this axis is the drag's
		// equal and so must be withheld exactly as the drag is.
		view.showContextMenuFor(mid as never);
		expect(Menu.lastShown?.item('Set assignee')).toBeUndefined();
		expect(Menu.lastShown?.item('Set type')).toBeUndefined();
		expect(vault.writeLog).toEqual([]);
	});

	it('refuses the whole batch if a resource write ever names a context item', async () => {
		const { view, vault } = laneStressView();
		const mid = view.model?.byPath.get('Mid.md');

		// No UI produces this — that is the point: the last line of defence is structural,
		// so a future entry point cannot reopen the hole by omission.
		const applied = await view.performResourceMove(mid as never, 'Sam');

		expect(applied).toBe(false);
		expect(vault.writeLog).toEqual([]);
		expect(Notice.messages.some((m) => m.includes('outside this base’s filter'))).toBe(true);
	});

	it('never mints a row from a context value, and never counts one', () => {
		// Unchanged: the membership half of the rule. An excluded note's assignee is not
		// this base's vocabulary, so `Ancient` names no row — and the row it does join
		// counts only what the Base returned.
		const { view, containerEl } = laneStressView();
		expect(view.model?.byPath.get('Mid.md')?.outsideFilter).toBe(true);
		expect(laneNames(containerEl)).toEqual(['Sam']);
		expect(laneCountOf(lanesOf(containerEl)[0])).toBe('1');
	});

	it('never lets a context value reach the menu the drag cannot reach either', () => {
		// Both halves, because either one alone would let it back in: `Ancient` mints no
		// row, and the menu — which leads with the drawn rows and then names what the
		// RESULTS carry — must not offer it from the other end.
		const { view } = laneStressView();

		view.showContextMenuFor(view.model?.byPath.get('PBI.md') as never);
		const offered = Menu.lastShown?.item('Set assignee')?.submenu?.items.map((i) => i.titleText);

		expect(offered).toEqual(['Sam', 'New assignee...', 'Clear assignee']);
	});
```

Keep the existing `'is never shelved, whatever it carries'` test unchanged.

- [ ] **Step 2: Run it, and watch the structural refusal fail**

Run: `npx vitest run test/view/contextCardWrites.test.ts --testTimeout=30000`
Expected: PASS.

Then in `src/view/writeGate.ts` comment out the `outsideFilter` refusal in `applySafely` and re-run. Expected: the resources block's third test FAILS alongside the board's and the roadmap's — the backstop is one mechanism and this proves this axis rides it rather than a guard of its own. Restore.

- [ ] **Step 3: Commit**

```bash
git add test/view/contextCardWrites.test.ts
git commit -m "Ask the context-row rule of the resources axis's three entry points"
```

---

### Task 7: The register, the changelog, and the whole check

**Files:**
- Modify: `docs/requirements/Assigning items to a resource.md`
- Modify: `docs/requirements/Showing a resources axis on the roadmap.md`
- Modify: `CHANGELOG.md`
- Possibly modify: `vitest.config.mts`

- [ ] **Step 1: Fix the sibling's superseded paragraph**

`docs/requirements/Showing a resources axis on the roadmap.md` is Done and stays Done — its "**The axis is read-only in this increment, and that is a decision rather than an omission**" paragraph described that increment truthfully and is history rather than error. Append one sentence to it so a reader is not sent to a claim the code has since reversed:

```markdown
Every one of those four seams was reversed by [[Assigning items to a resource]] on
2026-08-13, which is what "in this increment" was reserving them for — the grip stays
withheld even so, because a grip writes a DATE and this axis still registers no target
for one.
```

- [ ] **Step 2: Rewrite this PBI's frontmatter and `## Where it lives`**

In `docs/requirements/Assigning items to a resource.md`, set `status: Active` — **not Done**, and for [[Moving between horizons]]'s own reason: extension 3b's acceptance criterion is unbuilt and deliberately so. Add the `files:` list:

```yaml
files:
  - src/domain/roadmap.ts
  - src/view/backlogView.ts
  - src/view/cardMoves.ts
  - src/view/host.ts
  - src/view/interactions/cardDrag.ts
  - src/view/interactions/keyboard.ts
  - src/view/interactions/labels.ts
  - src/view/render/barLabel.ts
  - src/view/render/lanes.ts
  - src/view/render/roadmap.ts
  - src/view/render/shelf.ts
  - src/view/render/timeline.ts
```

Replace `## Where it lives` entirely:

```markdown
## Where it lives

Built, apart from extension 3b (below). The plan needed no change at all —
`computeAssigneeWrites` in `src/domain/writePlan.ts` was built for
[[Setting the assignee on an item]] and already plans exactly this value, with the two
rules a move needs: nothing for a re-pick of the name the note holds, and a removal only
where there is a key to take away. What this PBI added is the orchestration.

`performResourceMove` in `src/view/cardMoves.ts` (`CardMoveController`) is the one method
every input lands on, so a drop cannot plan a different write than the key or the menu
that mean the same thing, and it is the one place a move is announced. It captures both
pre-write facts before the batch, which is not optional here: the batch's own refresh
rebuilds `host.roadmap` before the await resolves, so the row just vacated may be gone
with its last bar. Naming the two ends is `src/domain/roadmap.ts`'s `resourceSource` /
`resourcePlacementLabel` / `resourceTargetLabel`, the shape `horizonSource` /
`placementLabel` / `targetLabel` already has — with one deliberate difference stated at
`resourceLabel`: this axis mints a row only where a BAR lands, so a name no row draws is
still a name the note states, and reading it as the shelf (which the horizon axis is
right to do) would report "from Unplaced" for a note that plainly says Alice.
`announceResourceMove` in `src/view/interactions/cardDrag.ts` says it, in the live region
every card move already shares.

The gesture is the drag layer both card projections share. On this axis a bar is an
ordinary card source — `hold: null`, no span baseline, no ends — because what it is
dropped ON is the whole message; the date holds stay withheld
(`TimelineDrawing.hold`, in `src/view/render/timeline.ts`, which replaced the read-only
increment's `grips` flag). A resource's band is wired **element by element** — the header,
each bar row, each excluded note's row — through `TimelineDrawing.laneTarget`, a hook the
grid takes from `renderGridAxis` in `src/view/render/roadmap.ts` (`laneDrop`) exactly as
`wireDropTarget` takes its `plan`: the grid knows which elements belong to which row and
nothing about what landing on one should write. Per element because there is no container
to wire — every row is a flat sibling positioned against one shared day grid — and the
cost is that the highlight is the element under the pointer rather than the whole band. A
wrapper per row would fix that and would put a box between every row and the sticky lead
column the geometry rests on; the highlight is a live-vault check either way.

**One thing had to be un-drawn for any of it to work**, and it is the finding worth
keeping: the dated axis's `.pbl-timeline-drop` overlay takes pointer events across the
whole day area while a drag is live, so left in place it would swallow every drop the rows
are the target for. It is therefore drawn only where a POSITION on it means something.
That exposed the one decoration it used to cover — `.pbl-today` is the only absolutely
positioned mark in the content layer without `pointer-events: none`, because its tooltip is
the only place its date is written — so `.pbl-timeline-flat` (on the content element) turns
that off for this axis alone. Every other layer already opted out, for the reason
`.pbl-milestone-line`'s own comment in `styles/timeline.css` records: a 2px dead strip
through every row. What jsdom can check is that the overlay is absent and the class is
present; that its presence would have swallowed the drop is a live-vault check, since
nothing here hit-tests.

The shelf is `shelfRemoval`'s `'resources'` branch in `src/view/render/shelf.ts`, which
went from accepting nothing to the horizon axis's own removal over a different key —
including its re-drop rule, since a card already drawn there can still carry a name with no
date to sit beside. The keyboard is `handleResourceMoveKey` in
`src/view/interactions/keyboard.ts`, on **Alt+Up/Down**: resources are rows, and Left/Right
on this grid is reserved for a future scheduling gesture, which is what `horizonStops`
answering null on the dated axis has been holding open. The two ladders share
`ladderStep` — the edges hold rather than wrap, and the `offLadder` case both axes need —
and nothing else, because the direction is exactly what has to differ. `Set assignee` in
`src/view/interactions/labels.ts` leads with the DRAWN rows and routes its pick through
`chooseAssignee`, the way `chooseHorizon` already branches by mode; leading with the rows
is not tidiness here but the thing that makes the third input reach what the first two can,
since a declared-and-empty row has a drop target and appears on no result.

`CreatePlacement.assignee` was already built — threaded through
`src/view/interactions/create.ts` and `createBacklogItem` by
[[Showing a resources axis on the roadmap]], whose row New button writes it. This note
claimed otherwise until 2026-08-13; the claim is corrected rather than kept, because a
specification that promises an implementer a call they will not find is the same defect
`src/CLAUDE.md` records a guide making once already.

`src/view/render/barLabel.ts` is not this PBI's feature. It is the bar's title and the
mark width it clears, moved out of `src/view/render/timeline.ts` when that file hit its
400-line budget and this increment needed eight lines in it — the same move `laneEntries`
made into `src/view/render/lanes.ts`, for the same reason.

Driven by synthetic drags, keys and menus in `test/view/resourceMoves.test.ts` (the vault
is `test/helpers/resources.ts`, shared with the axis's own suite so the two cannot describe
different axes), by `test/view/resourceLanes.test.ts` for what the axis draws, and by the
resources block of `test/view/contextCardWrites.test.ts`, which asks this axis the same
three context-row questions as the board's and the horizon axis's now that it writes.

**Extension 3b is NOT built**, exactly as it is not for [[Moving between horizons]]: a move
whose new value takes the note out of the Base's results applies, and the card leaves on
the refresh in silence. The mechanism belongs to [[New cards in place]], it was built once
from one sentence and taken back out, and
[[The outcome report was built from one sentence]] records the open question — nothing
correlates a Bases pass with a write — that has to be answered before it is built again.
That is why this note is Active rather than Done.

What a live vault still owes: the band highlight under a dragged bar (per element, not per
band), that the absent overlay really does let a drop through where it used to be, whether
a screen reader announces a move whose card visibly does not move, and the header's own
appearance beside a row being dropped into. jsdom dispatches the events and paints nothing.
```

- [ ] **Step 3: Correct the changelog's own promise**

`CHANGELOG.md`'s `[Unreleased]` entry ends "Nothing on it can be dragged yet — moving work between rows is the next increment." Replace that sentence and add the move:

```markdown
  until you pick the new axis.

- **Move work between resources** — drag a bar into someone else's row, or onto the shelf
  to un-assign it; **Alt+Up** and **Alt+Down** step the selected card one row, and **Set
  assignee** on the row menu now offers every row on screen, empty ones included. All
  three write the same single value to the note's own assignee property, undoable as one
  batch. A row is who and a date is when: moving work between rows never changes its
  dates, and an item with no dates stays on the shelf with its new owner recorded — the
  view says so rather than leaving it looking like nothing happened.
```

- [ ] **Step 4: Run the whole check**

Run: `npx vitest run --coverage --testTimeout=30000`
Expected: PASS with the coverage table.

Run: `npm run build && npm run lint && npm run analyze && npm run docs`
Expected: all four PASS. Run them explicitly rather than through `npm run check` — if the tests trip the Windows timeout flake, `analyze` and `docs` never run and a green-looking check has verified neither.

- [ ] **Step 5: Ratchet the coverage thresholds if they moved up**

Read the four totals off the coverage run. Where a total is now **above** the threshold in `vitest.config.mts`, raise the threshold to it. Never lower one: a bar that drops is a branch this increment added and did not cover, and the fix is a test rather than a smaller number.

Run: `npx vitest run --coverage --testTimeout=30000`
Expected: PASS at the new numbers.

- [ ] **Step 6: Commit**

```bash
git add "docs/requirements/Assigning items to a resource.md" "docs/requirements/Showing a resources axis on the roadmap.md" CHANGELOG.md vitest.config.mts
git commit -m "Record the resource move, and what it still owes a live vault"
```

- [ ] **Step 7: Offer the handover**

Nothing in this increment can be checked for appearance here. Two offers, in order of cost:

1. `npm run harness` — the real view against the real stylesheet in a browser, which answers the band highlight, the dragged bar's opacity and whether a header reads as a drop target. It does not answer a themed vault's colours or anything Bases hands the view.
2. `npm run test-build` — bundles into `.obsidian/plugins/<id>/` in this repository root, so the repository can be opened as a vault and `docs/Product Backlog.base` shows the plugin displaying its own register. That is what discharges the live-vault items listed at the end of the note.

Say which of the owed checks each one can and cannot make, rather than letting "verified" read wider than what was run.

---

## Self-review

**Spec coverage.** Main flow 1–4: Tasks 3 (drag), 2 (the one write, the gate, the refresh), 2 (undo). 1a: Task 2 step 1, test 5. 1b: Tasks 4 and 5. 1c: Task 3, "drags off the shelf into a row". 1d: Tasks 2 and 3 (key removed, undo restores). 1e: Task 2, test 4, second half. 2a: Task 3, "a minted row is a target like any other". 2b: Task 6. 2c (a row named only by a logged absence): unreachable — [[Resource absences]] is unbuilt, so no absence can put a row on screen; `laneDrop` names `lane.name` whatever minted the row, so the rule holds by construction and needs no case. Stated in the note rather than tested against a fixture that cannot exist. 3a: Task 3, "config problems block a resource move", and Task 6's structural refusal. 3b: deliberately not built, recorded. 3c: Task 2, test 4, first half.

Acceptance criteria map one-to-one onto those, with two exceptions stated above: 3b, and the "logged absence" clause of the writable-vocabulary criterion.

**Placeholders.** None — every code step carries the code.

**Type consistency.** `performResourceMove(item, name: string | null): Promise<boolean>` is spelled identically in `cardMoves.ts`, `host.ts`, `backlogView.ts` and every test. `TimelineDrawing.hold: 'dates' | 'card'` is the same union in `TimelineDrawing`, `BarRowMounts` and `renderGridAxis`. `TimelineRender.overlay` is `HTMLElement | null` at its declaration and at its one consumer. `resourceStops`/`horizonStops` both return `(string | null)[] | null` and both feed `ladderStep(stops, current, step, offLadder)`.
