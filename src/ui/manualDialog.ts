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

/**
 * Whether `el` — and every ancestor between it and `boundary`, inclusive — is actually
 * on screen: not `display: none` at any level. Never asked of a single element's own
 * `display` alone, because that misses exactly the case a container hides while a
 * descendant's own rule says nothing about it (`.pbl-busy` without `.pbl-busy-on`, the
 * link inside it unaffected by that rule directly). Not `offsetParent`/`checkVisibility`
 * either, on purpose: both are correct in a real browser but read `null`/hidden for
 * EVERY element in EVERY jsdom test, stylesheet loaded or not — which is what would
 * have kept a hidden-ancestor case untestable here rather than merely untested.
 * `getComputedStyle` reflects a loaded stylesheet's rules, so walking with it stays
 * testable. The identical walk lives in `view/render/toolbarFit.ts`'s `isVisibleInBar`,
 * duplicated rather than imported: `ui/` reaches nothing else in `src/`.
 */
function isVisible(el: HTMLElement, boundary: HTMLElement): boolean {
	for (let node: HTMLElement | null = el; node; node = node.parentElement) {
		if (getComputedStyle(node).display === 'none') return false;
		if (node === boundary) break;
	}
	return true;
}

/**
 * The point-of-need door: a text button that opens the manual on one section and gives
 * focus back to itself. Four surfaces use it — the new-item prompt, an empty state, the
 * busy indicator and the config warning — and each is an acceptance criterion of one of
 * the `Help for …` use cases rather than a convenience.
 *
 * **The guarantee, stated once rather than found five times as five separate
 * predicates:** after the manual closes, focus lands on a visible, focusable control —
 * whatever became of the control that opened it. Gone, hidden behind an ancestor,
 * detached by a rebuild, or never rendered at all, the answer is the same shape:
 * resolve the opener fresh (never a captured reference — see below); if that fails,
 * fall back to a destination that is actually guaranteed to exist.
 *
 * That fallback is a two-tier default, tried in this order:
 *
 * 1. **Resolve, don't capture, and check ancestors, not just the element.** `parent` —
 *    the shell the button was drawn into (`empty`, `warn`, `busy`) — is exactly what a
 *    full render throws away (`treeEl.empty()` / `barEl.empty()` destroy every child and
 *    rebuild them), so resolving FROM it, or focusing a captured reference to the
 *    button itself, both find a detached node by close time. `root` is the caller's own
 *    STABLE container instead — created once, only ever emptied-and-refilled — so a
 *    query against it after a rebuild reaches the new instance of this same door if the
 *    render still drew one. `isVisible`, above, is what makes "reaches one" and "it is
 *    actually on screen" two different questions asked correctly, catching a hidden
 *    ANCESTOR, not only a hidden element.
 * 2. **`root` itself, but only when the caller made it a genuine focus target.** A
 *    caller whose door is not there and cannot be found still owes focus somewhere
 *    real: `root.tabIndex >= 0` is true of the tree (`treeEl`, the view's own single
 *    tab stop — `role="tree" tabindex="0"`, permanent) and false of the toolbar bar
 *    (`barEl` hosts several individually-focusable controls rather than being one
 *    itself). Focusing an element with no `tabindex` is a silent no-op in both a real
 *    browser and jsdom (confirmed empirically — neither moves focus off whatever a
 *    plain, non-tabbable `<div>` already held), so this tier is not a leap of faith.
 *
 * A caller whose `root` fails tier 2 — the toolbar's two doors — MUST supply its own
 * `onClosed` naming a real destination (`focusInBar`, which has its OWN further
 * fallback chain down to the first visible control in the row). That is not a gap in
 * the guarantee; it is the guarantee's other half, stated as a constraint on the
 * caller rather than as more cleverness in the default: a `root` that cannot receive
 * focus itself is a `root` whose caller has to say where focus goes instead, and the
 * two toolbar doors both do.
 *
 * **What this default deliberately does NOT attempt: clipping.** A control can be
 * connected, visible by every `display` in its ancestor chain, and still be scrolled or
 * flex-shrunk out of the reader's view (`overflow: hidden` on a container narrower than
 * its content) — CSS clipping is a LAYOUT fact, not a `display` fact, and jsdom computes
 * no layout at all, so a predicate for it could not be watched failing here; it would be
 * trusted on faith, which this file does not do (see `docs/issues/A comment that
 * states a rule is not a check.md`). The one place that risk existed — the config
 * warning's own button, inside a container `styles/toolbarFit.css` deliberately shrinks
 * and clips at the last fit rung — is fixed at the SOURCE instead: that button is no
 * longer drawn inside the shrinkable container at all (`render/toolbar.ts`), so there is
 * no clipping case left for a predicate to catch or fail to catch. A future caller that
 * puts a focusable control inside an `overflow: hidden` flex-shrink container would
 * reopen exactly this question, and this paragraph is where the answer would have to
 * change.
 *
 * This plan found the same missing guarantee five times before this paragraph: the `?`
 * button's own capture, the overflow entry's yanked-back focus, this function's own
 * captured `parent`, `focusInBar`'s single-level `display` check, and — arriving
 * together, the sixth finding — this function's missing fallback and the config
 * warning's clippable home. Every one was fixed correctly and in isolation and produced
 * the next one; this paragraph and the two-tier default above are the attempt to state
 * the guarantee once rather than find a seventh instance of it.
 *
 * `target` bundles `sectionId`, `label` and `root` rather than taking them as three more
 * positional arguments — `max-params` caps a function at five, and `parent`, `app`,
 * `sections` and `onClosed` are the four that cannot fuse with anything else without
 * losing a name at the call site.
 */
export function manualLink(
	parent: HTMLElement,
	app: App,
	sections: ManualSection[],
	target: { sectionId: string; label: string; root: HTMLElement },
	onClosed?: () => void,
): HTMLButtonElement {
	const link = parent.createEl('button', { cls: 'pbl-help-link', text: target.label, attr: { type: 'button' } });
	const refocus = () => {
		const live = target.root.querySelector<HTMLElement>(`.pbl-help-link[data-pbl-section="${target.sectionId}"]`);
		if (live?.isConnected && isVisible(live, target.root)) {
			live.focus();
			return;
		}
		if (target.root.tabIndex >= 0) target.root.focus();
	};
	link.setAttribute('data-pbl-section', target.sectionId);
	link.addEventListener('click', () => openManual(app, sections, target.sectionId, onClosed ?? refocus));
	return link;
}
