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

function patchModal(): void {
	const proto = Modal.prototype;
	const open = proto.open;
	const close = proto.close;

	proto.open = function () {
		// The original runs onOpen, which is what BUILDS contentEl — so the nodes only
		// exist to be appended after this call, never before it.
		open.call(this);
		const frame = document.body.createDiv(MODAL_CLASS);
		const box = frame.createDiv('pbl-harness-modal-box');
		box.appendChild(this.titleEl);
		box.appendChild(this.contentEl);
	};
	proto.close = function () {
		close.call(this);
		for (const el of Array.from(document.querySelectorAll(`.${MODAL_CLASS}`))) el.detach();
	};
}
