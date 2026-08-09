import { setIcon, setTooltip } from 'obsidian';
import { BacklogViewHost } from '../host';
import { BacklogItem, BacklogModel } from '../../domain/model';

/** Where a toolbar control carries its focus identity — see `capturedFocusKey`. */
export const KEY_ATTR = 'data-pbl-key';

/**
 * The identity focus is restored by: a per-control key, written where the control is
 * created and the same string on the control the next render builds in its place.
 *
 * Not the class — `.pbl-zoom-btn` and `.pbl-axis-btn` each name several buttons — and
 * not `aria-label`, which is neither always present nor always stable. `.pbl-new-btn`
 * and `.pbl-focus-btn` are named by their text content and carry no label at all, so
 * nothing was captured for them; and the completed toggle's label flips between
 * 'Hide completed items' and 'Show completed items (3 hidden)' across the very rebuild
 * its own click causes, so the control whose press ALWAYS re-renders was the one that
 * could never be restored. A key is independent of both.
 *
 * What that guarantees is exactly what carries a key: a control created without one is
 * not restored, and nothing here can see that it was meant to be. The check under the
 * sentence is `test/view/toolbarFocus.test.ts`, which asserts every focusable element
 * the toolbar renders — across the three projections, under a focus level — carries a
 * key, and that no two share one.
 */
export function capturedFocusKey(barEl: HTMLElement): string | null {
	const active = document.activeElement;
	if (!(active instanceof HTMLElement) || !barEl.contains(active)) return null;
	return active.getAttribute(KEY_ATTR);
}

/**
 * The other half of {@link KEY_ATTR}: find the rebuilt control wearing that key and
 * focus it. Moved here from `toolbar.ts` with the attribute it reads, because it has a
 * SECOND caller now — a menu pick, which is a rebuild the render-pass mechanism cannot
 * see. `capturedFocusKey` moves with it: a mechanism split across two files is one edit
 * from the halves disagreeing about the attribute they share.
 */
export function refocusByKey(barEl: HTMLElement, key: string | null): void {
	if (!key) return;
	barEl.querySelector<HTMLElement>(`[${KEY_ATTR}="${key}"]`)?.focus();
}

/**
 * A toolbar icon control. A real `<button>`, not a div: the toolbar sits outside
 * the tree's single-tab-stop model, and these are the only way to reach the type
 * picker, the backfill and the collapse commands without a mouse.
 *
 * `key` is the focus identity (`capturedFocusKey`) and defaults to the label, which
 * is the same string on every rebuild for all of these but one: the completed toggle
 * names the next action and its count, so it passes its own.
 */
export function iconButton(
	parent: HTMLElement,
	icon: string,
	label: string,
	key: string = label,
): HTMLButtonElement {
	const btn = parent.createEl('button', {
		cls: 'clickable-icon pbl-icon-btn',
		attr: { type: 'button', 'aria-label': label, [KEY_ATTR]: key },
	});
	setIcon(btn, icon);
	setTooltip(btn, label);
	return btn;
}

/**
 * What the bulk collapse controls can reach — a DIFFERENT question from
 * `countedPopulation` in `toolbar.ts`, which is why it is a second function rather than a
 * reuse: counting asks for the Base's rows, and collapsing asks for everything on screen
 * that owns a disclosure, context rows included.
 *
 * The Deliverables board is the one projection where `model.items` is the wrong answer.
 * It draws `model.deliverableResults`, read off the WHOLE unfocused tree so a focus set
 * elsewhere can never hide a Deliverable — while `model.items` is the focused render set.
 * So with a focus active, Expand all and Collapse all reached none of the cards outside
 * that subtree, and were a complete no-op when no Deliverable was inside it.
 */
function collapsiblePopulation(host: BacklogViewHost, model: BacklogModel): BacklogItem[] {
	return host.projection === 'deliverables' ? model.deliverableResults : model.items;
}

/**
 * The two bulk collapse ACTIONS, extracted from the buttons that used to hold them
 * inline, because the `⋯` menu invokes the same action from a second input. The rule
 * this codebase already keeps for a move — one method, several inputs — applied to a
 * command: a second caller calls the first one's function rather than repeating its loop.
 */
export function expandAll(host: BacklogViewHost): void {
	const model = host.model;
	if (!model) return;
	for (const item of collapsiblePopulation(host, model)) host.setCollapsed(item.file.path, false);
}

export function collapseAll(host: BacklogViewHost): void {
	const model = host.model;
	if (!model) return;
	for (const item of collapsiblePopulation(host, model)) {
		if (item.children.length > 0) host.setCollapsed(item.file.path, true);
	}
}

/**
 * When the bulk collapse controls are refused: while a quick filter overrides collapse
 * state, and on a card projection that drew no disclosure to collapse. `syncCollapseCtls`
 * is still the sole WRITER of the flag — this is the question it asks, named once so the
 * `⋯` menu is not a second opinion about the same rule.
 */
export function collapseCtlsDisabled(host: BacklogViewHost): boolean {
	const nothingToCollapse = host.projection !== 'tree' && host.cardChildrenShown.size === 0;
	return host.isFiltering() || nothingToCollapse;
}

/**
 * Expand/collapse toolbar buttons. Collapse state is overridden while a filter is
 * active, so they are genuinely `disabled` then rather than only dimmed: a control
 * a keyboard user can reach has to refuse the press, not just look like it would.
 * The view re-syncs the flag after every content render (`syncCollapseCtls`).
 */
export function collapseButton(
	host: BacklogViewHost,
	parent: HTMLElement,
	spec: { icon: string; label: string; cls: string; mutate: () => void },
): void {
	const btn = iconButton(parent, spec.icon, spec.label);
	btn.addClass('pbl-collapse-ctl');
	btn.addClass(spec.cls);
	btn.addEventListener('click', () => {
		// A click on the icon `<svg>` inside a disabled button still reaches this
		// listener (only `btn.click()` on the button itself is blocked by `disabled`),
		// so the guard has to be read here rather than trusted from the DOM state —
		// same shape as the card disclosure toggle in `render/cardChildren.ts`.
		if (btn.disabled) return;
		spec.mutate();
		host.render();
	});
}
