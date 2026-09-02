import { Menu, setIcon, setTooltip } from 'obsidian';
import { formatNumber, t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { showMenuAtElement, showMenuForClick } from '../interactions/menu';
import { addShelfLayoutItems, addShelfSortItems, addShelfTypeItems, shelfLayoutIcon } from '../interactions/shelfMenu';
import { organizeShelf } from '../../domain/shelf';
import { ShelfCard } from '../../domain/bars';
import { activeShelf } from '../shelfSurface';

/**
 * The shelf's own header chrome: the disclosure that names it, counts it and opens it,
 * and — while it is open — a sort pick and a type filter. It lives in the shelf rather
 * than in the view's toolbar because that is where a reader working through unplaced
 * work is already looking; a control for the shelf, three regions away from it, was a
 * control nobody found.
 *
 * Both pickers open an Obsidian `Menu` from a `tabindex="-1"` button rather than
 * rendering a `<select>` or checkboxes inline. That is not decoration: the roadmap pane
 * wears `role="listbox"` while any card renders, and a focusable form control inside a
 * one-tab-stop composite is a second tab stop the widget does not have. It is the same
 * answer the tree's own per-row controls give (`.pbl-add`, the state chip) — reachable
 * by pointer and by assistive tech, invisible to Tab. Their keyboard path is the card
 * menu's own shelf section (`interactions/menu.ts`), built from the same two item
 * builders these buttons use, so neither surface can offer what the other does not.
 *
 * **The search box is a form control and cannot be anything else** — a menu cannot be
 * typed into — so it keeps the half of that rule that is about TAB rather than the half
 * that is about elements: `tabindex="-1"` like the pickers, lifted with them by
 * `syncShelfTabStops`, with the card menu's own Search the shelf entry (a prompt) as the
 * keyboard path, and Escape clearing it. What is left unpaid is the ARIA deviation the
 * shelf's disclosure and the two resize grips already state: a focusable non-`option`
 * inside a `listbox`, here a text field rather than a button. Narrower than it reads —
 * nothing here says how a screen reader announces one, and the live-vault sweep is what
 * stands for that.
 *
 * The count is the shelf's TRUE total, never what the type filter or the search
 * currently leave showing: narrowing is a display choice, and a count that moved with it
 * would stop answering the question the shelf exists to answer. Each narrowing says on
 * its own face that it is one — the filter button goes active, the search keeps the text
 * that caused it — since a shelf whose count and contents disagree with nothing
 * explaining why reads as a bug.
 */
export function renderShelfControls(
	host: BacklogViewHost,
	headerEl: HTMLElement,
	shelf: ShelfCard[],
	opts: { name: string; fold: { collapsed: boolean; set: (collapsed: boolean) => void } },
): void {
	// An empty shelf is a bare label: it renders only so a drag has somewhere to land,
	// and a disclosure over nothing would offer to open what has no content.
	if (shelf.length === 0) {
		setIcon(headerEl.createSpan({ cls: 'pbl-shelf-icon' }), 'inbox');
		headerEl.createSpan({ cls: 'pbl-shelf-name', text: opts.name });
		return;
	}
	const collapsed = opts.fold.collapsed;
	// The one header control that is a real tab stop wherever it renders. The card menu
	// carried this toggle until 2026-08-15 and was its keyboard path; with that entry
	// dropped to unclutter the menu, `tabindex="-1"` here would have left the shelf
	// openable by pointer only — and a collapsed shelf offers no card of its own to
	// menu from. It earns the stop the timeline's lead grip earns: chrome fixed to the
	// pane's own frame, never among the cards, and the pane's key handler ignores any
	// event whose target is not the pane itself, so the arrows stay the pane's.
	const disclosure = headerEl.createEl('button', {
		cls: 'pbl-shelf-disclosure clickable-icon',
		attr: { type: 'button', tabindex: '0', 'aria-expanded': String(!collapsed) },
	});
	setIcon(disclosure.createSpan({ cls: 'pbl-shelf-collapse-icon' }), collapsed ? 'chevron-right' : 'chevron-down');
	setIcon(disclosure.createSpan({ cls: 'pbl-shelf-icon' }), 'inbox');
	disclosure.createSpan({ cls: 'pbl-shelf-name', text: opts.name });
	disclosure.createSpan({ cls: 'pbl-shelf-count', text: formatNumber(shelf.length) });
	// `aria-expanded` carries the state an icon and a chevron only show: without it a
	// screen-reader user at this button cannot tell a shut shelf from an open one.
	const action = t(collapsed ? 'fold.expandShelf' : 'fold.collapseShelf', {
		name: opts.name,
		count: shelf.length,
	});
	disclosure.setAttribute('aria-label', action);
	setTooltip(disclosure, action);
	disclosure.addEventListener('click', () => {
		opts.fold.set(!collapsed);
		refocus(host, '.pbl-shelf-disclosure');
	});
	// Nothing to order or narrow while the cards are shut away, and a control that
	// visibly does nothing is worse than none — the toolbar's own expand/collapse rule.
	if (collapsed) return;
	renderLayoutPicker(host, headerEl);
	renderSortPicker(host, headerEl);
	renderTypeFilter(host, headerEl, shelf);
	renderSearch(host, headerEl);
}

/**
 * Whether the shelf's two PICKERS may sit outside the tab order, resolved from the
 * same card count the pane's own role is: with cards on screen the pane is a
 * one-tab-stop composite and everything it carries is `tabindex="-1"`, the tree's
 * per-row rule, with the card menu's shelf section as the keyboard path; with none it
 * is a plain `region`, that rule has nothing to apply to, and no card menu can open
 * either — so the header's own controls are all that is left and every one of them
 * has to be reachable.
 *
 * ALL of them, not the disclosure alone. Hiding the last visible type on a roadmap
 * with nothing placed empties the pane by itself, and rescuing only the disclosure
 * leaves a keyboard user shutting and reopening an empty shelf forever with the filter
 * that caused it out of reach. The rule is about the composite, so it lifts for
 * everything at once or it is not that rule.
 *
 * The disclosure is excluded because it is already a permanent tab stop — see
 * `renderShelfControls`. Writing `-1` over it here would undo that in exactly the state
 * it exists for, and writing `0` over it is what this loop would be doing anyway.
 *
 * Decided after the render rather than while building the buttons, because that is when
 * the count is final: two deciders reading the same question at different times is how
 * the role and the class it pairs with came apart before.
 */
export function syncShelfTabStops(shelfEl: HTMLElement, paneIsComposite: boolean): void {
	const tabindex = paneIsComposite ? '-1' : '0';
	// The SEARCH box is in this set for the rule's own reason rather than as a courtesy: a
	// search narrow enough to hide the last card empties the pane by itself, exactly as
	// hiding the last visible type does, and the control that caused it has to be reachable.
	const controls = '.pbl-shelf-header button:not(.pbl-shelf-disclosure), .pbl-shelf-search-input';
	for (const btn of Array.from(shelfEl.querySelectorAll<HTMLElement>(controls))) {
		btn.setAttribute('tabindex', tabindex);
	}
}

/**
 * Every control in this header rebuilds the pane when used, destroying the very button
 * that was pressed, so focus has to be put somewhere or it lands on the document body
 * and the reader is out of the view entirely. WHERE depends on what the rebuild left,
 * and the two answers are not interchangeable:
 *
 * - Cards on screen: the pane is a composite and owns the keyboard. Its handler ignores
 *   any event whose target is not the pane ITSELF (`evt.target !== evt.currentTarget`
 *   in `interactions/keyboard.ts`), so focus on a `tabindex="-1"` control inside it
 *   would look fine and silently kill Arrow, Home and End. Focus goes to the pane.
 * - No cards: there is no composite to own anything, `syncShelfTabStops` has just put
 *   these controls back in the tab order, and the one that did this is the only way
 *   back. Focus goes to its replacement.
 *
 * Asked AFTER the rebuild, of the state the rebuild produced — opening a shelf turns a
 * region into a composite and closing the last content turns it back, so the question is
 * about what is on screen now, not about what was pressed.
 *
 * The disclosure takes the second answer in BOTH states, because it is a tab stop in
 * both: sending its focus to the pane would put a keyboard user one Shift+Tab away from
 * the control they just used, and on a collapsed shelf there is no card menu to offer
 * them another route to it.
 */
function refocus(host: BacklogViewHost, selector: string): void {
	// Either band, resolved through `activeShelf` rather than read off `host.roadmap`
	// directly: the iteration board's pane can also hold no card — an iteration with
	// nothing committed draws empty columns, and a narrow enough search or type filter
	// empties its shelf too — so "the pane is a composite" is a real question on both
	// surfaces, never only the roadmap's.
	const surface = activeShelf(host);
	if (!surface.el) return;
	const ownsFocus = selector === '.pbl-shelf-disclosure' || !surface.paneHasCards;
	const target = ownsFocus ? surface.el.querySelector<HTMLElement>(selector) : surface.el.closest<HTMLElement>('.pbl-tree');
	target?.focus();
}

function headerButton(parent: HTMLElement, cls: string, icon: string, label: string): HTMLButtonElement {
	const btn = parent.createEl('button', {
		cls: `clickable-icon ${cls}`,
		attr: { type: 'button', tabindex: '-1', 'aria-label': label },
	});
	setIcon(btn, icon);
	setTooltip(btn, label);
	return btn;
}

/**
 * Cards or compact rows — how the shelf DRAWS, never what it draws. It leads the pickers
 * because it is the only one of the three that changes nothing about which cards are on
 * screen: the sort orders them, the filter and the search hide them, and this one just
 * says how much room each takes.
 *
 * The button wears the layout in FORCE rather than a fixed glyph, from the same table its
 * menu is built from (`shelfLayoutIcon`) — so the header answers "which layout is this"
 * without anything being opened, and the two cannot come to illustrate different picks.
 * Its `aria-label` is the fixed act rather than the current value: the value is what the
 * menu's own checkmark says, and a name that changed under a reader would announce the
 * control as though it were a toggle with two identities.
 */
function renderLayoutPicker(host: BacklogViewHost, headerEl: HTMLElement): void {
	const btn = headerButton(headerEl, 'pbl-shelf-layout', shelfLayoutIcon(host.shelfLayout), t('shelf.layout'));
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		addShelfLayoutItems(host, menu, () => refocus(host, '.pbl-shelf-layout'));
		showMenuForClick(menu, evt);
	});
}

/** Display order within each type group — never written to a note. */
function renderSortPicker(host: BacklogViewHost, headerEl: HTMLElement): void {
	const btn = headerButton(headerEl, 'pbl-shelf-sort', 'arrow-up-down', t('shelf.sort'));
	btn.addEventListener('click', (evt) => {
		const menu = new Menu();
		addShelfSortItems(host, menu, () => refocus(host, '.pbl-shelf-sort'));
		showMenuForClick(menu, evt);
	});
}

/** Which type groups show. */
function renderTypeFilter(host: BacklogViewHost, headerEl: HTMLElement, shelf: ShelfCard[]): void {
	const btn = headerButton(headerEl, 'pbl-shelf-filter', 'list-filter', t('shelf.filterByType'));
	// The filter is the pick that can HIDE work, so it says on its face that it is doing
	// so — a shelf whose count and contents disagree, with nothing explaining why, reads
	// as a bug. The UNFILTERED grouping decides that, the same list the menu itself is
	// built from.
	const hiding = organizeShelf(shelf, 'tree', new Set()).some((group) => host.shelfHiddenTypes.has(group.type));
	btn.toggleClass('is-active', hiding);
	btn.addEventListener('click', () => showTypeMenu(host));
}

/**
 * Picking a type is a narrowing someone does several times in a row — show only Epics,
 * then also PBIs, then everything again — so this picker comes straight back instead of
 * making the reader reopen it per pick. An Obsidian `Menu` closes itself on a pick and
 * offers no way not to, so "stays open" is a fresh menu at the same place: the pick
 * rebuilt the pane anyway, and rebuilding is what puts the new checkmarks and counts in
 * it. The card menu's own submenu passes no `after` and so keeps a menu's ordinary
 * behaviour — the one line the two surfaces are allowed to differ on.
 *
 * "At the same place" is why the FIRST open is anchored to the button too, through this
 * one function rather than through `showMenuForClick`. That helper anchors a real pointer
 * click at the CURSOR, which is correct for a menu opened once and wrong for one that
 * comes back: the menu appeared under the mouse, then jumped to the button's own edge on
 * every pick after it. A picker that stays open has to stay in one place, so the button
 * is the anchor in both — the sort picker beside it opens once and keeps the pointer's.
 *
 * Everything is re-read from the host rather than captured: the button pressed and the
 * element it sat in are both gone with the frame, and a shelf array from before the
 * rebuild would count cards the pane no longer holds. The band itself is re-resolved
 * too, through `activeShelf`, rather than read off `host.roadmap` directly — the same
 * band this menu has to act on can be the iteration board's.
 */
function showTypeMenu(host: BacklogViewHost): void {
	const surface = activeShelf(host);
	const shelf = surface.cards;
	const btn = surface.el?.querySelector<HTMLElement>('.pbl-shelf-filter');
	if (shelf.length === 0 || !btn) return;
	const menu = new Menu();
	addShelfTypeItems(host, menu, shelf, () => {
		// Before the menu, not instead of it: Obsidian's menu takes focus while it is open
		// and gives it back on Escape, so this is what decides where Escape lands.
		refocus(host, '.pbl-shelf-filter');
		showTypeMenu(host);
	});
	showMenuAtElement(menu, btn);
}

/**
 * The shelf's own title search: a narrowing scoped to the untriaged work rather than to
 * the whole view, which is what the Base's own search already does and why this is
 * not that. Nothing is written; `searchShelf` (`domain/shelf.ts`) is the whole rule.
 */
function renderSearch(host: BacklogViewHost, headerEl: HTMLElement): void {
	const label = t('shelf.search');
	// The input IS the box — no wrapper drawing a second one around it. Obsidian styles
	// `input[type='search']` itself, and that selector outranks a single class, so a
	// wrapper with its own border and background put a bordered field inside a bordered
	// field. Whatever the theme gives a search input is what this one wears.
	//
	// `type="search"` stays for the semantics and for that theming. What it is NOT is the
	// clear affordance: this comment used to say the platform draws one "only while there
	// is something to clear", and that was a claim nothing here checked — reported from a
	// vault as a search with no way back except selecting the text (2026-08-17). The
	// stylesheet suppresses the native button outright and `renderSearchClear` below draws
	// the plugin's own, so the field wears exactly one whatever the platform does.
	const input = headerEl.createEl('input', {
		cls: 'pbl-shelf-search-input',
		attr: { type: 'search', tabindex: '-1', placeholder: label, 'aria-label': label },
	});
	input.value = host.shelfSearch;
	setTooltip(input, label);
	// **While a composition is live, the keystrokes are the IME's and not this box's** —
	// one rule, asked of both listeners below, because both of them would otherwise answer
	// a keystroke that was never addressed to them.
	//
	// An IME reports its intermediate keystrokes as `input` events with `isComposing` set,
	// and the rebuild below destroys the very field being composed into — which interrupts
	// a CJK word or commits it half-typed. The narrowing waits for the composition to end
	// instead. BOTH events are wired because the two engines this plugin runs on order
	// them oppositely (Chromium ends the composition before the last `input`, WebKit after
	// it); whichever fires second finds the value unchanged, and `setShelfSearch` plans
	// nothing for that.
	input.addEventListener('input', (evt) => {
		// The flag is READ off the event rather than reached through `instanceof
		// InputEvent`: a pop-out window has constructors of its own, so the class test is
		// false for the very event this guard exists for (`obsidianmd/prefer-instanceof`
		// says the same thing about every other class).
		if ('isComposing' in evt && evt.isComposing) return;
		runSearch(host, input.value, input.selectionStart);
	});
	input.addEventListener('compositionend', () => runSearch(host, input.value, input.selectionStart));
	input.addEventListener('keydown', (evt) => {
		// Escape mid-composition dismisses the IME's candidates, which is a keystroke this
		// box must neither answer nor `preventDefault` — doing both would take the whole
		// query away in place of the candidate the reader was rejecting.
		if (evt.isComposing || evt.key !== 'Escape' || input.value === '') return;
		// The pane's key handler answers only to events targeting the pane itself, so this
		// Escape is already this input's alone; stopping it keeps a clear from also
		// reaching whatever sits above the view.
		evt.preventDefault();
		evt.stopPropagation();
		runSearch(host, '', 0);
	});
	renderSearchClear(host, headerEl);
}

/**
 * Empty the search, from a pointer. Escape already does this from the keyboard and both
 * land on `runSearch`, so the two inputs cannot disagree about what a clear is or about
 * where focus goes afterwards — the "one move, three inputs" rule at its smallest.
 *
 * Rendered only while there IS something to clear, which is what the native `type="search"`
 * button was believed to be doing. A condition here rather than a class, because every
 * keystroke rebuilds this header anyway: nothing is saved by drawing a button that is then
 * hidden, and a control that is absent cannot be focused by assistive tech while it does
 * nothing.
 *
 * `headerButton` makes it the pickers' equal — a real `<button>`, `tabindex="-1"`, named
 * and tooltipped — so `syncShelfTabStops` lifts it with them when the pane holds no cards.
 * That state is exactly this button's own: a search matching nothing empties the pane, and
 * the control that undoes it must be the one thing a keyboard can still reach.
 */
function renderSearchClear(host: BacklogViewHost, headerEl: HTMLElement): void {
	if (host.shelfSearch === '') return;
	const btn = headerButton(headerEl, 'pbl-shelf-search-clear', 'x', t('shelf.clearSearch'));
	btn.addEventListener('click', () => runSearch(host, '', 0));
}

/**
 * Narrow, then put the reader back where they were typing. `refocus`'s two answers are
 * both wrong for a text field and this is the third: the rebuild destroys the input
 * mid-word, so focus goes to its REPLACEMENT even where cards remain and the pane owns
 * the arrows — a caret in a search box is not a selection in a composite, and handing
 * the pane focus here would end the search at its first keystroke. The caret travels
 * with it, or every edit would jump to the end of the word.
 */
function runSearch(host: BacklogViewHost, text: string, caret: number | null): void {
	host.setShelfSearch(text);
	const input = activeShelf(host).el?.querySelector<HTMLInputElement>('.pbl-shelf-search-input');
	if (!input) return;
	input.focus();
	if (caret !== null) input.setSelectionRange(caret, caret);
}
