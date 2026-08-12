import { setIcon } from 'obsidian';

/**
 * One built element per icon name, cloned ever after. `setIcon` parses the icon's SVG on
 * every call, and the per-row render paths pay it three to five times per row — the
 * measurement is in `docs/bugs/The render is the whole cost of a data update.md`. An
 * icon is the same nodes every time it is asked for, so the parse is bought once here.
 */
const templates = new Map<string, HTMLElement>();

/**
 * `setIcon` for the per-row render paths: rows, cells, cards, bars — anything drawn once
 * per item. One-shot chrome (the toolbar, menus, empty states) keeps plain `setIcon`,
 * where a cache buys nothing.
 *
 * Parity is by construction, not by cases: the name is built into a detached template
 * through the real `setIcon`, and whatever that call left there — Obsidian's parsed
 * glyph, the test mock's `data-icon`, the harness renderer's SVG or its missing-name
 * marker — is copied onto every element served, attributes and children both. Deciding
 * per environment what `setIcon` "does" is the version of this that goes stale.
 *
 * For freshly created elements only: `setIcon` replaces an element's icon, this appends —
 * every per-row call site creates its element the line before.
 */
export function drawIcon(el: HTMLElement, icon: string): void {
	let template = templates.get(icon);
	if (!template) {
		// The GLOBAL createDiv: a detached element, never attached — it exists only to be
		// copied from.
		template = createDiv();
		setIcon(template, icon);
		templates.set(icon, template);
	}
	for (const { name, value } of Array.from(template.attributes)) el.setAttribute(name, value);
	for (const child of Array.from(template.children)) el.appendChild(child.cloneNode(true));
}
