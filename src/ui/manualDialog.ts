import { App, Modal } from 'obsidian';

/**
 * One line of the manual: a term and what it means. `badge` carries a RESOLVED class
 * rather than a type name — resolving `Epic` to `pbl-lvl-0` is `domain/` knowledge, and
 * this file may not have it. `keys` names the view-option keys an entry explains, which
 * is how the setup section's completeness is checked against the schema rather than
 * against a list (`test/docs/surfaces.test.ts`).
 */
export interface ManualEntry {
	term: string;
	text: string;
	badge?: { text: string; cls: string };
	keys?: string[];
}

export interface ManualSection {
	id: string;
	title: string;
	intro?: string;
	entries: ManualEntry[];
}

/**
 * The manual: a sidebar of sections beside a pane, in the shape of Obsidian's own
 * settings dialog, so the chrome is the app's rather than this plugin's.
 *
 * It reads. It never writes: no note, no frontmatter, no `.base` setting, nothing in
 * local storage.
 */
class ManualDialog extends Modal {
	private readonly sections: ManualSection[];
	private readonly initialId: string;
	private readonly onClosed: (() => void) | undefined;

	constructor(app: App, sections: ManualSection[], initialId: string, onClosed?: () => void) {
		super(app);
		this.sections = sections;
		this.initialId = initialId;
		this.onClosed = onClosed;
	}

	onOpen(): void {
		const { contentEl } = this;
		// The dialog's own accessible name — every other `Modal` in `src/ui/prompts.ts`
		// sets `titleEl` the same way. The pane's own `<h3>` (in `show`, below) names the
		// SECTION currently open and changes as the sidebar is used, so it cannot stand
		// in for this: a screen reader announcing the dialog needs one name that does not
		// move under it while its content does.
		this.titleEl.setText('Product Backlog manual');
		contentEl.empty();
		contentEl.addClass('pbl-manual');
		// Both classes go on the MODAL, not on `contentEl`, and both are needed: Obsidian
		// scopes the settings background to `.modal.mod-settings`, but the phone layout
		// that keeps a fixed 190px sidebar from crushing the pane is keyed on
		// `.mod-sidebar-layout` — `.is-phone .modal.mod-sidebar-layout` and
		// `.is-phone .modal.mod-settings.mod-sidebar-layout` (`test/harness/obsidian.css`)
		// both require it, and neither matches on `mod-settings` alone. Putting either
		// class on the wrong element, or leaving either one off, silently loses the phone
		// rules that depend on it.
		//
		// The jsdom mock has no `modalEl`, so NOTHING in the suite can catch either class
		// being wrong or missing. Optional-chained for that reason, and it is on the
		// live-vault list.
		(this as { modalEl?: HTMLElement }).modalEl?.addClass('mod-settings', 'mod-sidebar-layout');

		const split = contentEl.createDiv('pbl-manual-split');
		const nav = split.createDiv('modal-sidebar-inner pbl-manual-nav');
		nav.createDiv({ cls: 'pbl-manual-navhead', text: 'Product Backlog' });
		const items = nav.createDiv('vertical-tab-header-group-items');
		const pane = split.createDiv('pbl-manual-pane');

		// An unknown id opens the first section rather than an empty pane: a deep link
		// that has gone stale is a worse manual, never no manual. `sections[0]` types as
		// `ManualSection`, not `| undefined` — `noUncheckedIndexedAccess` is off in
		// `tsconfig.json` — so `opening` is never `undefined` for any caller that honours
		// the (unenforced) non-empty-array contract every real one does; there is
		// nothing left to guard against calling `show` with.
		const opening = this.sections.find((s) => s.id === this.initialId) ?? this.sections[0];

		for (const section of this.sections) {
			const tab = items.createEl('button', {
				cls: 'vertical-tab-nav-item',
				text: section.title,
				attr: { type: 'button' },
			});
			const isOpening = section === opening;
			tab.toggleClass('is-active', isOpening);
			// `aria-pressed` alongside the class, matching the projection switcher's
			// `.pbl-mode-btn` convention (`view/render/toolbar.ts`): the class is the
			// visual state, the attribute is what a screen reader can tell them apart by.
			tab.setAttribute('aria-pressed', String(isOpening));
			tab.addEventListener('click', () => {
				for (const other of Array.from(items.children)) {
					other.removeClass('is-active');
					other.setAttribute('aria-pressed', 'false');
				}
				tab.addClass('is-active');
				tab.setAttribute('aria-pressed', 'true');
				this.show(pane, section);
			});
		}

		this.show(pane, opening);
	}

	/** `pane` is a parameter, not a field: `onOpen` always has it in hand before this
	 * is ever called, so there is no null case to guard here — see the field this
	 * replaced in git history for the guard it used to need. */
	private show(pane: HTMLElement, section: ManualSection): void {
		pane.empty();
		// `empty()` clears the CONTENT, not the scroll position — `scrollTop` is the
		// pane's own property and survives a refill untouched, so without this a reader
		// scrolled to the bottom of one section who picks another lands partway down the
		// new one, its heading already off the top of the viewport. Reset here, not only
		// in the sidebar's click handler, so it holds for every path that calls `show`.
		pane.scrollTop = 0;
		pane.createEl('h3', { text: section.title });
		if (section.intro) pane.createDiv({ cls: 'pbl-manual-intro', text: section.intro });

		const list = pane.createDiv('pbl-manual-prose');
		for (const entry of section.entries) {
			if (entry.badge) {
				const badge = list.createDiv(`pbl-badge ${entry.badge.cls}`);
				badge.createSpan({ cls: 'pbl-badge-text', text: entry.badge.text });
			} else {
				list.createDiv({ cls: 'pbl-manual-term', text: entry.term });
			}
			list.createDiv({ cls: 'pbl-manual-def', text: entry.text });
		}
	}

	onClose(): void {
		this.contentEl.empty();
		// Focus policy is the CALLER's. This file is a `ui/` leaf: it knows about no
		// layer, so it cannot reach for `.pbl-toolbar .pbl-help-btn` — and that button is
		// hidden at fit step 2 anyway, which is exactly the narrow pane where a fallback
		// is needed. Each door supplies a closure that knows where its own focus goes.
		this.onClosed?.();
	}
}

/** The one door. Every surface that offers the manual comes through here. */
export function openManual(
	app: App,
	sections: ManualSection[],
	sectionId: string,
	onClosed?: () => void,
): void {
	new ManualDialog(app, sections, sectionId, onClosed).open();
}
