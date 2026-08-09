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
	private paneEl: HTMLElement | null = null;

	constructor(app: App, sections: ManualSection[], initialId: string, onClosed?: () => void) {
		super(app);
		this.sections = sections;
		this.initialId = initialId;
		this.onClosed = onClosed;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('pbl-manual');
		// `mod-settings` goes on the MODAL, not on `contentEl`: Obsidian scopes the
		// settings background and its whole phone layout to `.modal.mod-settings`, so
		// putting the class on the wrong element silently loses both — including the
		// mobile rules that stop a fixed 190px sidebar from crushing the pane.
		//
		// The jsdom mock has no `modalEl`, so NOTHING in the suite can catch this being
		// wrong. Optional-chained for that reason, and it is on the live-vault list.
		(this as { modalEl?: HTMLElement }).modalEl?.addClass('mod-settings');

		const split = contentEl.createDiv('pbl-manual-split');
		const nav = split.createDiv('modal-sidebar-inner pbl-manual-nav');
		nav.createDiv({ cls: 'pbl-manual-navhead', text: 'Product Backlog' });
		const items = nav.createDiv('vertical-tab-header-group-items');
		this.paneEl = split.createDiv('pbl-manual-pane');

		// An unknown id opens the first section rather than an empty pane: a deep link
		// that has gone stale is a worse manual, never no manual.
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
				this.show(section);
			});
		}

		if (opening) this.show(opening);
	}

	private show(section: ManualSection): void {
		const pane = this.paneEl;
		if (!pane) return;
		pane.empty();
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
