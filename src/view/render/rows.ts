import { Keymap, setTooltip } from 'obsidian';
import { drawIcon } from './icons';
import { BacklogViewHost, PRODUCT_BACKLOG_VIEW_TYPE } from '../host';
import { promptCreateItem } from '../interactions/create';
import { showItemMenu, showHorizonMenu, showStateMenu, showTagMenu } from '../interactions/menu';
import { promptSchedule } from '../interactions/plan';
import { removeTag } from '../interactions/tags';
import { offerableTypes } from '../projection';
import { badgeStyleFor } from './badges';
import { LABEL_CHIPS } from './chips';
import { BacklogItem } from '../../domain/model';
import { childTypeChoices, displayType } from '../../domain/itemTypes';
import { ownWorkflowReading } from '../../domain/board';
import { renderAddSpacer, renderRowColumns, RowContext } from './columns';

/** Why an implied badge is marked, said once: the render sets the class, the pass reads it. */
const IMPLIED_TYPE_TOOLTIP =
	'Type property not set — level implied from position. Use "Assign missing properties" to write it.';
/** Everything a row element IS, for the walk in `render/reconcile.ts` to place. */
export function buildRow(
	ctx: RowContext,
	containerEl: HTMLElement,
	item: BacklogItem,
	state: { hasChildren: boolean; collapsed: boolean; place: { pos: number; count: number } },
): HTMLElement {
	const host = ctx.host;
	// Through `offerableTypes` like every other type list. `childTypeChoices` answers the
	// ladder's question and its answer carries `EXTRA_TYPES` — `Deliverable` among them —
	// so the raw list is the whole vocabulary minus the rungs, not what a projection may
	// show. The tree may show every type, so this narrows nothing today; what it stops is
	// the next surface reading the raw list because this one did.
	const childTypes = offerableTypes(host, childTypeChoices(item));

	const selected = host.selectedPath === item.file.path;
	const row = containerEl.createDiv({
		cls: 'pbl-row' + (selected ? ' pbl-selected' : ''),
		attr: {
			role: 'treeitem',
			'aria-level': String(item.depth + 1),
			'aria-posinset': String(state.place.pos),
			'aria-setsize': String(state.place.count),
			'aria-selected': String(selected),
		},
	});
	if (state.hasChildren) row.setAttribute('aria-expanded', String(!state.collapsed));
	// The row's OWN workflow, the same rule the card's child list, the card itself and the
	// timeline bar all keep: a Deliverable is finished when ITS states say so.
	if (ownWorkflowReading(item).done) row.addClass('pbl-done');
	if (item.outsideFilter) row.addClass('pbl-outside');
	row.setCssProps({ '--pbl-depth': String(item.depth) });
	row.dataset.path = item.file.path;
	// An ancestor from outside the Base's own results has unknown siblings, so ranking it
	// by drag would mislead.
	row.draggable = !item.outsideFilter;

	renderRowLead(ctx, row, item, state);
	renderRowTrailing(ctx, row, item, childTypes);
	return row;
}

/** Grip, chevron, badge and title. */
function renderRowLead(
	ctx: RowContext,
	row: HTMLElement,
	item: BacklogItem,
	state: { hasChildren: boolean; collapsed: boolean },
): void {
	const host = ctx.host;
	// Purely a drag affordance — the row itself is the draggable element.
	const grip = row.createDiv({ cls: 'pbl-grip', attr: { 'aria-hidden': 'true' } });
	drawIcon(grip, 'grip-vertical');

	// The tree refreshes the one subtree it changed; the dated axis's rows share this
	// control and re-render whole, which is why what to redraw is the caller's — and which
	// BIT it flips is the caller's for the same reason.
	const path = item.file.path;
	const fold = (): void => void host.setCollapsed(path, !host.isCollapsed(path));
	// Resolved per click, not captured: `refreshSubtree` renders the item's `children`,
	// and on a KEPT row a captured item is the previous model's child list. `fold` above
	// is safe for the opposite reason — a path is the row's identity and does not go
	// stale. Two callbacks, one hazard; see ADR 0029.
	renderChevron(host, row, { ...state, toggle: fold }, () => {
		const current = host.model?.byPath.get(path);
		if (current) host.refreshSubtree(current);
	});

	renderBadge(host, row, item);

	const title = row.createSpan({ cls: 'pbl-title' });
	title.setText(item.title);
	// Set unconditionally, and NOTHING measures whether it was needed. Deciding that costs
	// a `scrollWidth`/`clientWidth` read per row, which forces layout — as a hover handler
	// it cost 65.7ms per hover at 832 rows, and as a batched pass it forced the whole tree
	// to lay out at the end of every render and made `content-visibility` unusable (5320ms
	// against 12ms, because a skipped row must be laid out to be measured). A tooltip
	// repeating a title that already fits is the price, and it is small.
	setTooltip(title, item.title);
	// eslint-disable-next-line no-restricted-syntax -- closes over a path string, never an item.
	title.addEventListener('mouseover', (evt) => {
		// NOTHING here may read layout — see `src/view/CLAUDE.md`.
		host.app.workspace.trigger('hover-link', {
			event: evt,
			source: PRODUCT_BACKLOG_VIEW_TYPE,
			hoverParent: host.app.renderContext,
			targetEl: title,
			linktext: path,
			sourcePath: path,
		});
	});

	if (item.orphan) {
		const orphan = row.createSpan({ cls: 'pbl-orphan' });
		drawIcon(orphan, 'unlink');
		setTooltip(orphan, 'Parent is set but not part of this view');
	}

	if (item.outsideFilter) {
		const marker = row.createSpan({ cls: 'pbl-outside-marker' });
		drawIcon(marker, 'corner-left-down');
		setTooltip(marker, "Not in this base's filter — shown to keep the hierarchy");
	}
}

/**
 * The disclosure a row draws — shared with the dated axis's rows, so there is one
 * statement of what a chevron IS: an icon that rotates, a click that flips the collapse
 * bit of whichever projection is asking (`collapseKey` in `backlogView.ts` decides which,
 * so nothing here does), and, where there is nothing below, the leaf placeholder that keeps
 * every badge on the same x rather than an absence that shifts the row.
 *
 * Two things are the caller's, and they are the only two the surfaces do not share:
 *
 * - what the flip REDRAWS — the tree refreshes the subtree it changed, while the grid's
 *   window, gridlines and full-height marks are all derived from its row set and have to
 *   be rebuilt with it;
 * - **who says the row is expanded**, which is decided by the ROW's role and not by
 *   preference. A `treeitem` carries `aria-expanded` itself, so the tree passes no
 *   `label` and this draws a plain div — decoration of a state the row already announces.
 *   A card projection's row is `role="option"`, which does NOT support `aria-expanded`
 *   (ARIA 1.2), so a state put there is discarded: passing a `label` makes the chevron a
 *   real `<button>` carrying the state and that name, the same answer
 *   `render/cardChildren.ts`'s toggle already gives on the same role.
 *
 *   **That is better, not settled**, and the claim is narrowed to what can be checked
 *   here: `option` also has PRESENTATIONAL CHILDREN, so a user agent may flatten this
 *   button and drop its role and state with it — a focusable node is generally read as
 *   surviving that rule, and nothing in this repository can run a screen reader to find
 *   out. What survives either way is the row's content-derived NAME, which this label
 *   joins and, being worded "Show children"/"Hide children", flips with the state; the
 *   ACTION's guaranteed path is the row menu's identical entry. Do not write "the state
 *   is announced" here until a device has said so —
 *   `docs/issues/A disclosure nested in an option role.md` holds the two redesigns that
 *   would settle it.
 *
 * Everything else is one rule in one place — including the three guards, each of which
 * had to be discovered twice before: the filter override, because `isCollapsed` reports
 * false while a filter runs and a write here would look inert and then take effect once it
 * cleared; the real `disabled` flag that says so on a control assistive tech can actually
 * activate, since `pointer-events: none` stops a mouse and nothing else; and the middle
 * click, which never fires `click` and so never meets the first guard, leaving the row's
 * own `auxclick` to open a note from a control that means something else entirely.
 */
export interface DisclosureState {
	hasChildren: boolean;
	collapsed: boolean;
	/**
	 * Present makes this a real `<button>` carrying `aria-expanded` and this name; absent
	 * draws the tree's plain div, whose `treeitem` row announces the state itself.
	 */
	label?: string;
	/**
	 * Flip the bit — the CALLER's, never a `setCollapsed` written in here. There are three
	 * of them now and they do not share a key space: a tree row and a dated-grid row put the
	 * same note in two different scopes (`collapseKey`), and a resource BAND is not a note
	 * at all, so its bit is keyed by name and lives beside the shelf's own picks. What every
	 * disclosure DOES share is this function — the filter override, the real `disabled`
	 * flag, the middle-click guard and the focus report — and each of those had to be
	 * discovered twice before it was written once.
	 */
	toggle: () => void;
}

export function renderChevron(
	host: BacklogViewHost,
	rowEl: HTMLElement,
	state: DisclosureState,
	redraw: (heldFocus: boolean) => void,
): void {
	const cls = 'pbl-chevron' + (state.hasChildren ? '' : ' pbl-leaf');
	// The leaf is a spacer and never a control, whichever form the disclosure takes.
	if (!state.hasChildren) {
		rowEl.createDiv({ cls });
		return;
	}
	const { label } = state;
	const chevron: HTMLElement =
		label === undefined
			? rowEl.createDiv({ cls })
			: disclosureButton(rowEl, cls, { expanded: !state.collapsed, label });
	drawIcon(chevron, 'chevron-right');
	chevron.toggleClass('pbl-expanded', !state.collapsed);
	// eslint-disable-next-line no-restricted-syntax -- closes over state.toggle, redraw and the element, never a BacklogItem.
	chevron.addEventListener('click', () => {
		// Whether this control HELD focus, captured before the redraw that may destroy it —
		// a caller rebuilding the whole projection has to put focus somewhere, and only
		// this side knows whether there was any to put. Asked of the element rather than
		// assumed from the input: a mouse click does not focus a button in every browser,
		// and focus already elsewhere must not be dragged away from it.
		const heldFocus = chevron.ownerDocument.activeElement === chevron;
		state.toggle();
		redraw(heldFocus);
	});
}

/**
 * The button form of the disclosure: a real control, off the tab order like every other
 * per-row control, carrying the state its row's role cannot. `tabindex="-1"` keeps the
 * pane's single tab stop while leaving it activatable by assistive tech, with the row
 * menu as the documented keyboard path. `styles/tree.css` strips Obsidian's button
 * chrome from `button.pbl-chevron`.
 */
function disclosureButton(
	rowEl: HTMLElement,
	cls: string,
	said: { expanded: boolean; label: string },
): HTMLElement {
	return rowEl.createEl('button', {
		cls,
		attr: { type: 'button', tabindex: '-1', 'aria-expanded': String(said.expanded), 'aria-label': said.label },
	});
}


/** Shared with the board's cards: one badge chain, so a type cannot look different per projection. */
export function renderBadge(host: BacklogViewHost, row: HTMLElement, item: BacklogItem): void {
	const badgeText = displayType(item);
	if (!badgeText) return;
	const badge = row.createSpan({ cls: 'pbl-badge' });
	// A declared extra type or marker is a first-class type, so it gets a badge like a
	// level's: its own icon and colour, decided here in one place rather than by two
	// chains that have to agree. Anything outside the declared vocabulary keeps its name
	// and takes the bare-text treatment, which is the honest look for a type this view
	// knows nothing about — it is carried through the ladder, not styled as though it were
	// understood.
	// Asked of the name the badge SHOWS, never of `item.levelIndex`, which indexes
	// whichever ladder the item is on: a `Task` beneath a `Test case` is rung 2 there and
	// rung 3 of the plan's, so the index alone would draw it as a PBI in blue. The shown
	// name answers for both ladders without either being named here — which is also what
	// lets the two test types be ordinary entries in the table above rather than a third
	// branch, even though they ARE rungs.
	const style = badgeStyleFor(badgeText);
	if (style.icon) drawIcon(badge.createSpan({ cls: 'pbl-badge-icon' }), style.icon);
	badge.addClass(style.badge);
	badge.createSpan({ cls: 'pbl-badge-text', text: badgeText });
	// The level name is capped in CSS so the row's lead stays bounded, so the tooltip
	// carries it in full — unconditionally, for the reason the title's is: asking whether
	// the cap is biting costs a layout read per row. An implied badge says why it is
	// dashed as well, since the cap hides the very level it is explaining.
	if (item.impliedType) badge.addClass('pbl-implied');
	setTooltip(badge, item.impliedType ? `${badgeText} · ${IMPLIED_TYPE_TOOLTIP}` : badgeText);
}

/** The fixed trailing columns, then the row's own add button. */
function renderRowTrailing(ctx: RowContext, row: HTMLElement, item: BacklogItem, childTypes: string[]): void {
	renderRowColumns(ctx, row, item);

	// A row that can hold nothing gets no button, rather than one labelled from the first
	// of no choices — `New undefined`, opening a modal with no type to pick. The context
	// menu's `New <child>` disappears with it, by having nothing to loop over. The button's
	// WIDTH still has to be reserved: the columns are anchored to the row's end, so leaving
	// it out shifts every one of them right on this row alone.
	if (childTypes.length === 0) {
		renderAddSpacer(row);
		return;
	}

	// A native button so assistive tech can activate it, with no Tab stop — the same
	// bargain the state chip makes: the tree keeps its single-tab-stop model, and the
	// context menu carries the documented keyboard path (New <child>).
	const addBtn = row.createEl('button', {
		cls: 'pbl-add clickable-icon',
		attr: { type: 'button', tabindex: '-1', 'aria-label': addLabel(childTypes) },
	});
	drawIcon(addBtn, 'plus');
	setTooltip(addBtn, addLabel(childTypes));
}

/** A row that can hold only one type says so; one with a choice cannot promise which. */
function addLabel(childTypes: string[]): string {
	return childTypes.length > 1 ? 'New child item' : `New ${childTypes[0]}`;
}

/**
 * What counts as a CONTROL inside a row, for the one question every row-activation
 * handler asks before doing anything: did this event begin on the row, or on something
 * the row merely contains?
 *
 * `button` is the whole rule and the rest are its documented exceptions, which is what
 * keeps this from being a list of the places somebody thought of. The view guide already
 * requires every activatable per-row control to be a real `<button>` ("a `div` with an
 * `aria-label` and a click handler is the thing to avoid"), so a control written
 * tomorrow is covered without editing this line. What is named beside it is the three
 * kinds that are deliberately not buttons:
 *
 * - `.pbl-chevron` in its DIV form. A `treeitem` carries `aria-expanded` itself, so the
 *   tree's disclosure needs no button; the card's is one and matches above.
 * - `.pbl-bar-grip`, a drag handle with no activation semantics at all. Only the EDGE
 *   grips carry the class — the body hold is the bar element, which must stay part of
 *   the row's click target.
 * - `.pbl-prop-value` and `.pbl-tag`, a property cell's rendered note links and tag
 *   pills. The empty space AROUND them stays the row's, which is why this is asked of
 *   the event's target rather than of the cell.
 */
const ROW_CONTROL = 'button, .pbl-chevron, .pbl-bar-grip, .pbl-prop-value, .pbl-tag';

/**
 * Whether an activation event began on a control inside the row rather than on the row.
 *
 * One filter, asked by BOTH row-activation handlers (`wireRowEvents` here for the tree,
 * `wireCardActivation` in `board.ts` for cards and timeline rows), replacing a
 * `stopPropagation` per control. Ten of those had accumulated and each new control had
 * to remember to add an eleventh — which the connector and the bar grips both failed to
 * do, shipping a handle that opened the note. A control that forgets this filter is
 * covered by it anyway; that is the whole point of moving the question to the receiver.
 *
 * A middle click never fires `click`, so `auxclick` has to ask separately — the reason
 * every one of those per-control guards came in pairs.
 */
export function fromRowControl(evt: Event): boolean {
	return evt.target instanceof Element && evt.target.closest(ROW_CONTROL) !== null;
}

/**
 * The toolbar's fold toggle set on (`host.clickFolds`): the row's body means what its
 * chevron means, and the note is reached from the menu, from `Enter`, or with the
 * platform's modifier — which is why a modified click is not this toggle's to take and
 * falls through to opening.
 *
 * Returns true whenever the click was SPENT here, which includes the two cases that
 * fold nothing: a row with nothing under it has no fold to do, and a filtered tree
 * refuses the flip exactly as the chevron does (`isCollapsed` reports false while a
 * filter runs, so the write would look inert and then take effect once it cleared).
 * Falling through to `openItem` in either case would make the same gesture open a note
 * in one row and fold in the next.
 *
 * **Two ROW-shaped projections call this**, which is what `row` is for: the two things
 * that differ between them are exactly the two a shared function cannot know. What
 * counts as having children is the tree's visible child list here and the row set
 * `timelineRows` drew on the dated axis — asking `item.children` there would offer a
 * fold on a bar whose children are not rows on that grid. And the redraw is one
 * subtree here and the whole projection there, since the window, the gridlines and
 * every full-height mark are derived from the row set the fold changes. Everything
 * else — the setting, the modifier, both refusals and the spend — is one statement,
 * because a second copy of it is how the same gesture comes to mean different things
 * on two screens that both draw rows. A CARD is not in this: its disclosure lists
 * children on its own face, so `wireCardActivation`'s callers pass no fold at all.
 */
export function foldOnClick(
	host: BacklogViewHost,
	item: BacklogItem,
	evt: MouseEvent,
	row: { hasChildren: boolean; redraw: () => void },
): boolean {
	if (!host.clickFolds || Keymap.isModEvent(evt)) return false;
	if (!row.hasChildren) return true;
	host.setCollapsed(item.file.path, !host.isCollapsed(item.file.path));
	row.redraw();
	return true;
}

/**
 * The item an event is about, or null where its target is outside `scope`. Resolved at
 * EVENT time from `data-path` against the current model, never captured at render: the
 * listeners live on the pane (one set for the view, not one per row — the measurement
 * that retired the per-row set is in
 * `docs/bugs/The render is the whole cost of a data update.md`), so there is no
 * wire-time item to capture and nothing to go stale when a data update replaces the
 * model. That is also what lets a render KEEP a row element instead of rebuilding it: a
 * chip that closed over its item would point into the previous model the moment an
 * update landed.
 *
 * The SCOPE is the caller's, because it is the only thing the two callers below disagree
 * about — each states its own selector's reason where it passes it.
 */
function itemAt(host: BacklogViewHost, evt: Event, scope: string): BacklogItem | null {
	const el = evt.target instanceof Element ? evt.target.closest(scope) : null;
	const path = el instanceof HTMLElement ? el.dataset.path : undefined;
	return path ? (host.model?.byPath.get(path) ?? null) : null;
}

/** One chip's action, given the item it was clicked for and the chip element itself. */
type ChipAction = (host: BacklogViewHost, evt: MouseEvent, item: BacklogItem, chip: HTMLElement) => void;

/**
 * Every chip's class name, mapped to its own action — ONE table the selector and the
 * dispatch both read, so a class lives in exactly one place. `LABEL_CHIPS`'s two entries
 * are folded in by `spec.cls` rather than restated: a rename there moves here for free,
 * where a literal copy would silently leave that chip's delegated click matching
 * nothing, and no test would fail, since nothing else drives a risk or assignee click
 * through this selector.
 *
 * The date chip is the one action that does not open a menu: `promptSchedule` is a modal
 * and takes no event, so it needs none of the anchoring the other five carry through
 * their `MouseEvent`. Which end it writes travels on the chip's own `dataset.end`
 * (`renderDateChip` in `render/chips.ts`), never inferred from the label — the label is
 * the column's own display name and says nothing about which end this is.
 */
const CHIP_ACTIONS: Record<string, ChipAction> = {
	'pbl-state-chip': (host, evt, item) => showStateMenu(host, evt, item),
	'pbl-horizon-chip': (host, evt, item) => showHorizonMenu(host, evt, item),
	...Object.fromEntries(
		Object.values(LABEL_CHIPS).map((spec): [string, ChipAction] => [
			spec.cls,
			(host, evt, item) => spec.showMenu(host, evt, item),
		]),
	),
	'pbl-date-chip': (host, _evt, item, chip) => {
		const end = chip.dataset.end;
		if (end === 'start' || end === 'target') promptSchedule(host, item, [end]);
	},
	'pbl-add': (host, _evt, item) => {
		// Recomputed at click time, like the rest of this table — and checked here for the
		// same reason `renderRowTrailing` withholds the button on an empty list: on a KEPT
		// row this list can empty between renders without the row's own signature changing
		// (nothing does yet — Task 4's signature already covers it — but this action must
		// not depend on that staying true in a module it does not import).
		const choices = offerableTypes(host, childTypeChoices(item));
		if (choices.length > 0) promptCreateItem(host, choices, item);
	},
	'pbl-tag-add': (host, evt, item) => showTagMenu(host, evt, item),
	'pbl-tag-remove': (host, evt, item, chip) => {
		// `preventDefault` only: the row's own handler already ignores a click on a
		// `button` (`fromRowControl`).
		evt.preventDefault();
		const tag = chip.dataset.tag;
		if (tag) removeTag(host, item, tag);
	},
};

/**
 * Every class in `CHIP_ACTIONS`, each prefixed `button` — load-bearing rather than tidy.
 * A context row's five property chips are the SAME classes on a `div` — every chip in
 * `render/chips.ts` builds `pbl-state-static` alongside the chip's own class on that
 * `div` — and a selector matching the class alone would open an edit menu on a
 * read-only value that the write gate would then refuse: a control offering what it
 * cannot do, the context-row rule this codebase says every past bug in it forgot. The
 * two tag buttons take the other route to the same end: `renderTagCell` renders no
 * button at all for a context row, so the `button` prefix costs them nothing and the
 * selector still needs it — a bare `.pbl-tag-remove` would match nothing there either
 * way, but naming the rule once for all eight chips is cheaper than remembering which
 * ones happen to need it. `button` is also the rule `fromRowControl` already states for
 * the same question, so this is the existing answer rather than a second one.
 */
const CHIPS = Object.keys(CHIP_ACTIONS)
	.map((cls) => `button.${cls}`)
	.join(', ');

/* eslint-disable no-restricted-syntax -- these two ARE the delegation: they take the
   listeners off the rows so a render may keep one. The rule below them is what stops a
   per-row control growing its own. ESLint cannot scope a disable to one selector, so
   this also switches off every OTHER no-restricted-syntax check over this region —
   TREE_SCAN included, so a treeEl.querySelectorAll added inside this block is not
   caught by that ban either. */
/**
 * The tree's row activation, wired ONCE on the pane — called from the view's
 * constructor, beside the keydown it mirrors. The per-row wiring this replaces cost a
 * listener set per row and rebuilt them all on every data update.
 *
 * Its scope is `.pbl-row`, the tree's alone — cards and timeline rows are `.pbl-card` —
 * so on a card projection every one of these three handlers resolves nothing and stands
 * aside. That is narrower than `wireChipEvents`' scope below on purpose: this is the
 * tree's own row activation, not a chip.
 */
export function wireRowEvents(host: BacklogViewHost, treeEl: HTMLElement): void {
	treeEl.addEventListener('click', (evt) => {
		// Before selection AND before the fold: a control inside the row is not the row,
		// whichever of the two things "clicking an item" is configured to mean. Folding on
		// a chevron click would fold twice; folding on an add-button click would fold on
		// the way to a modal.
		if (fromRowControl(evt)) return;
		const item = itemAt(host, evt, '.pbl-row');
		if (!item) return;
		host.selectItem(item, false);
		const spent = foldOnClick(host, item, evt, {
			// The tree's own two answers: the children it is currently drawing, and the
			// one subtree its fold changes.
			hasChildren: item.children.some((child) => !host.isRowHidden(child)),
			redraw: () => host.refreshSubtree(item),
		});
		if (spent) return;
		host.openItem(item, evt);
	});
	treeEl.addEventListener('auxclick', (evt) => {
		if (evt.button !== 1 || fromRowControl(evt)) return;
		const item = itemAt(host, evt, '.pbl-row');
		if (item) host.openItemIn(item, 'tab');
	});
	treeEl.addEventListener('contextmenu', (evt) => {
		const item = itemAt(host, evt, '.pbl-row');
		if (item) showItemMenu(host, evt, item, offerableTypes(host, childTypeChoices(item)));
	});
}

/**
 * Every per-item chip, on one delegated handler for the whole pane. Both card
 * projections and the tree render into `treeEl` (`renderProjectionContent`), so this one
 * listener serves the tree's rows and every card alike — the same reach `wireRowEvents`
 * has, for the same reason. The class a matched chip carries is looked up in
 * `CHIP_ACTIONS` rather than tested by an if-chain, so a chip added to that table without
 * a class `wireChipEvents` recognises does nothing — never a fallthrough to some other
 * chip's write.
 *
 * Its scope is `[data-path]` rather than `.pbl-row`: `renderPropCells` is shared with both
 * card projections, whose mount is `.pbl-card`, so narrowing to the tree's own row class
 * would leave every card chip inert.
 */
export function wireChipEvents(host: BacklogViewHost, treeEl: HTMLElement): void {
	treeEl.addEventListener('click', (evt) => {
		const target = evt.target instanceof Element ? evt.target : null;
		const chip = target?.closest(CHIPS);
		if (!(chip instanceof HTMLElement)) return;
		const item = itemAt(host, evt, '[data-path]');
		if (!item) return;
		const cls = Object.keys(CHIP_ACTIONS).find((c) => chip.classList.contains(c));
		if (cls) CHIP_ACTIONS[cls](host, evt, item, chip);
	});
}
/* eslint-enable no-restricted-syntax -- delegation ends here; a listener below this line is a per-row control's own. */
