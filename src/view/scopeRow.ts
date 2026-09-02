import { setTooltip } from 'obsidian';
import { ScopeRow } from '../domain/scopeRows';
import { ownWorkflowReading } from '../domain/board';
import { displayType } from '../domain/itemTypes';
import { badgeStyleFor } from './render/badges';
import { drawIcon } from './render/icons';
import { OpenContext, OpenController } from './openTarget';

/**
 * The parts a scope-tree row is drawn from, shared by the two trees that draw one:
 * `view/release/scopeTree.ts` and `view/mywork/renderTree.ts`.
 *
 * Extracted for the reason `scopeFolds.ts` and `scopeKeys.ts` were, and measured the same
 * way: `npm run analyze` reported four clone groups and 139 lines between those two files,
 * the widest pair in `src/`. The second tree was built by copying the first — which the
 * plan for it said would be temporary — so this is the rest of that intention rather than
 * a new idea about either view.
 *
 * **What is NOT here is the disclosure**, and that is a decision rather than an omission.
 * Its two copies differ in the labels AND in what a toggle DOES — one folds per person and
 * one per release — so sharing it means a callback plus a label pair, and the comment on
 * each explains a different focus-restore mechanism. Parameterising it would leave a
 * function whose whole body is its arguments. The three below differ in at most one value.
 */

/** What either tree needs of its view to open a note: the opener and the context. Structural,
 *  so a third tree earns this by carrying the two members it already needs anyway. */
export interface RowOpener {
	readonly opener: OpenController;
	openContext(): OpenContext;
}

/**
 * A row opens its note, by primary click and by middle click.
 *
 * Unconditional but for one thing, on a context row too: opening is not a write, and a
 * context ancestor is a real note the reader may still want to read even though these
 * screens offer no way to edit it.
 *
 * `window.getSelection()?.isCollapsed === false` is the drag-select guard. Both trees
 * restore `user-select` on their rows so a reader can copy a title from a read-only
 * screen, and that is what makes a plain `click` wrong: dragging across the title and
 * releasing still dispatches `click` on the row. Asking it HERE — in the handler, not at
 * `mousedown`/`mouseup` coordinates and not a flag set between them — is what makes it
 * correct rather than merely plausible: an ORDINARY click collapses the selection on its
 * own `mousedown`, so by the time `click` fires a non-collapsed selection can only mean
 * this pointer-up just finished a drag-select. The backlog tree needs none of it, because
 * `.pbl-row` there is `user-select: none` and a drag selects nothing.
 *
 * The KEYBOARD path is untouched on purpose: Enter and Space open the active row through
 * `scopeKeys.ts`, and a reader driving the tree from the keyboard may well have text
 * selected somewhere else on the page — that selection says nothing about THIS activation,
 * so only the pointer path asks the question.
 *
 * `auxclick` is wired as its pair rather than left to each surface, the rule
 * `wireOpenGestures` keeps for cards: a middle click never fires `click`, so a surface
 * wiring the primary click alone loses "open in a new tab" silently. The disclosure is
 * excluded by hand rather than through `stopPropagation`, because unlike its `click`
 * handler it wires no `auxclick` of its own to stop one at.
 */
export function wireRowOpen(view: RowOpener, rowEl: HTMLElement, row: ScopeRow): void {
	rowEl.addEventListener('click', (evt) => {
		if (window.getSelection()?.isCollapsed === false) return;
		view.opener.open(view.openContext(), row.item, evt);
	});
	rowEl.addEventListener('auxclick', (evt) => {
		if (evt.button !== 1) return;
		if (evt.target instanceof Element && evt.target.closest('.pbl-twisty') !== null) return;
		view.opener.openIn(view.openContext(), row.item, 'tab');
	});
}

/**
 * The type badge.
 *
 * **The empty-text guard is GONE, and that is now a checked claim rather than the standoff
 * it inherited.** `scopeTree.ts` carried `if (!badgeText) return;` and `renderTree.ts`
 * argued at length that such a guard is unreachable — both drawing rows from the same walk,
 * so they could not both be right, and nothing checked either.
 *
 * `renderTree.ts` was right, and the reason is a property of `displayType` rather than of
 * this walk: `typeName` reaches an item through `readString`, which nulls a blank; every
 * ladder is `LEVELS` or `TEST_LEVELS` and so never empty; and an untyped item's
 * `levelIndex` is `childLevelIndex`, clamped into that ladder's own range. So there is no
 * item, in any projection, that `displayType` answers nothing for.
 *
 * The check is on `displayType` and not here, because that is where the property lives —
 * `test/domain/itemTypes.test.ts`, driving the real model over each of the three ways it
 * could break, both of the mechanisms watched failing.
 */
export function drawScopeBadge(rowEl: HTMLElement, row: ScopeRow): void {
	const badgeText = displayType(row.item);
	const style = badgeStyleFor(badgeText);
	const badgeEl = rowEl.createSpan({ cls: 'pbl-badge' });
	if (style.icon) drawIcon(badgeEl.createSpan({ cls: 'pbl-badge-icon' }), style.icon);
	badgeEl.addClass(style.badge);
	badgeEl.createSpan({ cls: 'pbl-badge-text', text: badgeText });
}

/**
 * The state chip, in a column of its own so a row with no state leaves a gap rather than
 * sliding its neighbours left. Static, like every chip on either screen: nothing here
 * writes, so a chip with a hover affordance would make the screen look editable. A CONTEXT
 * row carries no state — it renders, it parents, and that is all.
 *
 * **A finished member's chip is green and carries the check**, `.pbl-state-done` and
 * `circle-check` — the identical pair `renderStateChip` draws in the backlog tree
 * (`render/chips.ts`), read from the identical `ownWorkflowReading`, so one word means one
 * thing on every screen. The ICON is drawn beside the colour rather than instead of it:
 * colour alone is one channel, and this chip is static — no hover, no menu, and no
 * accessible name of its own to carry the fact a second way.
 *
 * `ownWorkflowReading` asks the EFFECTIVE key for this row's own item — the requirements
 * key for a plain item, the Deliverable key for a Deliverable, the test key for a catalog
 * member — so a row whose own workflow is unbound draws no chip at all rather than a stale
 * reading through the wrong property.
 *
 * The tooltip carries the value in full, because the chip often cannot show it:
 * `.pbl-state-chip` caps at 140px in every projection, and each tree's own narrow rule
 * clips it further. Set unconditionally and measured by nothing — `.pbl-row` carries
 * `content-visibility: auto`, and a `scrollWidth` read to decide would lay out a skipped
 * row by itself (`src/view/CLAUDE.md`).
 *
 * `columnClass` is the whole of what varies: each tree owns its own cell width.
 */
export function drawScopeStateChip(rowEl: HTMLElement, row: ScopeRow, columnClass: string): void {
	const stateEl = rowEl.createDiv({ cls: columnClass });
	const reading = ownWorkflowReading(row.item);
	if (row.context || reading.value === null) return;
	const chipEl = stateEl.createDiv({
		cls: 'pbl-state-chip pbl-state-static' + (reading.done ? ' pbl-state-done' : ''),
	});
	drawIcon(chipEl.createSpan({ cls: 'pbl-state-icon' }), reading.done ? 'circle-check' : 'circle');
	chipEl.createSpan({ cls: 'pbl-state-text', text: reading.value });
	setTooltip(chipEl, reading.value);
}
