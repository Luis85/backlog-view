/**
 * Draw the chrome the module mock only records.
 *
 * `Menu.showAtMouseEvent` sets `Menu.lastShown` and `Modal.open` sets `Modal.lastOpened`,
 * which is everything a test needs and nothing a person can see: in a browser a
 * right-click would produce no menu and `New Epic` would open no dialog, while the page
 * advertised both as usable. So the harness draws them — a stand-in for Obsidian's
 * widgets, not Obsidian's widgets, and appearance here is worth even less than the rest
 * of the harness's (ADR 0020).
 *
 * The MENU is still a stand-in end to end. The DIALOG is not, as of 2026-08-15: it is
 * Obsidian's own `.modal` element, painted by the `.modal` rules in the vendored sheet,
 * inside an overlay the harness places. What is the harness's own there is the placement
 * and nothing else — see `patchModal` below for which rules that leaves absent.
 *
 * Patched from HERE rather than built into the mock on purpose: the suite asserts through
 * `lastShown`/`lastOpened` and empties `document.body` between tests, so a mock that also
 * appended nodes would be changing what 68 test files measure to serve a page none of
 * them opens. The originals still run first, so every one of those assertions holds.
 */
import { Menu, MenuItem, Modal } from '../helpers/obsidian-mock';

interface Point {
	x: number;
	y: number;
}

const MENU_CLASS = 'pbl-harness-menu';
const MODAL_CLASS = 'pbl-harness-modal';

let installed = false;

/** Patch the mock's Menu and Modal so they appear. Idempotent; call it from the mount. */
export function drawChrome(): void {
	if (installed) return;
	installed = true;
	patchMenu();
	patchModal();
}

function patchMenu(): void {
	const proto = Menu.prototype;
	const atMouse = proto.showAtMouseEvent;
	const atPosition = proto.showAtPosition;

	proto.showAtMouseEvent = function (evt: unknown) {
		const result = atMouse.call(this, evt);
		const at = evt as Partial<Point> & { clientX?: number; clientY?: number };
		// A keyboard-activated click reports (0, 0); the view anchors those to the
		// element's own rect before it gets here, so what arrives is already the right
		// point and the fallback only covers an event with no coordinates at all.
		openMenu(this, { x: at.clientX ?? 0, y: at.clientY ?? 0 });
		return result;
	};
	proto.showAtPosition = function (pos: Point) {
		const result = atPosition.call(this, pos);
		openMenu(this, pos);
		return result;
	};
}

function openMenu(menu: Menu, at: Point): void {
	closeMenu();
	const el = document.body.createDiv(MENU_CLASS);
	el.setCssProps({ left: `${at.x}px`, top: `${at.y}px` });
	renderItems(el, menu.items);

	// `pointerdown` rather than `click`, which is also what makes registering it right
	// here safe: every gesture that opens a menu — `contextmenu`, or the `click` on a
	// toolbar button — comes after its own pointerdown, so the listener cannot see the
	// event that opened what it is watching and close it again.
	document.addEventListener('pointerdown', onOutside, true);
	document.addEventListener('keydown', onEscape, true);
}

function renderItems(containerEl: HTMLElement, items: MenuItem[]): void {
	for (const item of items) {
		// Separators are COUNTED by the mock, not positioned, so there is nothing here to
		// place them from. Dropping them loses grouping and no action.
		const row = containerEl.createEl('button', {
			cls: 'pbl-harness-menu-item' + (item.disabled ? ' is-disabled' : ''),
			text: `${item.checked ? '✓ ' : ''}${item.titleText}`,
		});
		if (item.disabled) row.setAttribute('disabled', 'true');
		if (item.submenu) {
			// Nested inline rather than on hover: a submenu that only opens on a real
			// pointer path is one a screenshot never shows and a keyboard cannot reach.
			const nested = containerEl.createDiv('pbl-harness-submenu');
			renderItems(nested, item.submenu.items);
			continue;
		}
		row.addEventListener('click', () => {
			closeMenu();
			item.click();
		});
	}
}

function closeMenu(): void {
	document.removeEventListener('pointerdown', onOutside, true);
	document.removeEventListener('keydown', onEscape, true);
	for (const el of Array.from(document.querySelectorAll(`.${MENU_CLASS}`))) el.detach();
}

function onOutside(evt: Event): void {
	const target = evt.target as HTMLElement | null;
	if (!target?.closest(`.${MENU_CLASS}`)) closeMenu();
}

function onEscape(evt: KeyboardEvent): void {
	if (evt.key === 'Escape') closeMenu();
}

/**
 * Show the dialog in Obsidian's own frame.
 *
 * What this can hand over is bounded by the vendored sheet, and the bound is worth
 * stating because it is visible: `.modal` itself is in there (background, border,
 * radius, padding, `--dialog-width`, `max-height`, flex column), as is
 * `.modal.mod-settings` and every `.is-phone .modal…` rule the manual leans on. The base
 * `.modal-container`, `.modal-bg`, `.modal-title` and `.modal-content` rules are NOT —
 * the reduction kept what the harness was driven through, and until now the harness drew
 * a box of its own, so Obsidian's were never used and never kept. So a title reads
 * unstyled here and the content pane does not grow to the frame. That absence is loud and
 * one re-derivation against a local install away; a hand-written stand-in for it would be
 * silent and permanent, which is the trade `test/harness/theme.css`'s header settles.
 *
 * One of them costs something, so read it before filing a bug: whatever WIDENS a settings
 * dialog beyond `--dialog-width` was never kept either, so the manual draws at 560px on a
 * desktop and its prose column clips. It is the one place this change reads worse than
 * the guessed box did (that box had no width at all, so it sized to its content and
 * happened to look right). `?phone` is unaffected — those rules ARE in the sheet, and the
 * stacked layout they draw was unreachable here until the same day.
 */
function patchModal(): void {
	const proto = Modal.prototype;
	const open = proto.open;
	const close = proto.close;

	proto.open = function () {
		// The original runs onOpen, which is what BUILDS contentEl — so the nodes only
		// exist to be appended after this call, never before it.
		open.call(this);
		// The overlay is the harness's (Obsidian's own `.modal-container` placement rules
		// are not in the reduced sheet — nothing ever drew one to keep them), and it
		// carries Obsidian's class too so the `.is-phone .modal-container` rules that ARE
		// there apply under `?phone`. The BOX is no longer the harness's: `modalEl` is
		// `.modal`, which app.css paints — its background, border, radius, padding, width
		// and max-height, plus `.modal.mod-settings` for the manual. A stand-in box drawn
		// beside a real rule that resolves is the disclosure episode again (ADR 0020).
		const frame = document.body.createDiv(MODAL_CLASS);
		frame.addClass('modal-container', 'mod-dim');
		frame.appendChild(this.modalEl);
		this.modalEl.appendChild(this.titleEl);
		this.modalEl.appendChild(this.contentEl);
	};
	proto.close = function () {
		close.call(this);
		for (const el of Array.from(document.querySelectorAll(`.${MODAL_CLASS}`))) el.detach();
	};
}
