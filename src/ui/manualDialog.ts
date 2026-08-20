import { App, Modal } from 'obsidian';
import { t } from '../i18n/t';

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
		// Sentence case, which the marketplace rule asks of UI text and `npm run lint` was
		// warning about: "Product backlog", not the registered view name's "Product Backlog".
		// The two differ on purpose — `main.ts` registers the plugin's NAME, which is a proper
		// noun in Obsidian's own view picker, and this is a sentence about it.
		this.titleEl.setText(t('manual.dialogTitle'));
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
		// That sentence was unchecked until 2026-08-15 — the jsdom mock had no `modalEl`,
		// so the call was optional-chained through a cast and nothing in the suite could
		// see it. The mock has one now, `test/ui/manualDialog.test.ts` asserts both
		// classes land on it, and the browser harness draws the dialog in that element.
		this.modalEl.addClass('mod-settings', 'mod-sidebar-layout');

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
 * **The guarantee, stated once rather than found seven times as seven separate
 * predicates:** after the manual closes, focus lands on a visible, focusable control —
 * whatever became of the control that opened it. Gone, hidden behind an ancestor,
 * detached by a rebuild, clipped, or never rendered at all, the answer is the same
 * shape: resolve the opener fresh (never a captured reference — see below); if that
 * fails, fall back to a destination that is actually guaranteed to exist.
 *
 * The chain, tried in this order, and EVERY caller gets all three regardless of what it
 * supplies — a caller's own fallback TERMINATES the chain, it does not pre-empt it:
 *
 * 1. **The live opener, resolved from `root` and confirmed actually visible.** `parent`
 *    — the shell the button was drawn into (`empty`, `warn`, `busy`) — is exactly what a
 *    full render throws away (`treeEl.empty()` / `barEl.empty()` destroy every child and
 *    rebuild them), so resolving FROM it, or focusing a captured reference to the
 *    button itself, both find a detached node by close time. `root` is the caller's own
 *    STABLE container instead — created once, only ever emptied-and-refilled — so a
 *    query against it after a rebuild reaches the new instance of this same door if the
 *    render still drew one. `isVisible`, above, is what makes "reaches one" and "it is
 *    actually on screen" two different questions asked correctly, catching a hidden
 *    ANCESTOR, not only a hidden element.
 * 2. **`root` itself, if it can take focus.** A caller whose door is not there and
 *    cannot be found still owes focus somewhere real: `root.tabIndex >= 0` is true of
 *    the tree (`treeEl`, the view's own single tab stop — `role="tree" tabindex="0"`,
 *    permanent) and false of the toolbar bar (`barEl` hosts several
 *    individually-focusable controls rather than being one itself). Focusing an element
 *    with no `tabindex` is a silent no-op in both a real browser and jsdom (confirmed
 *    empirically), so this tier is not a leap of faith.
 * 3. **The caller's `onClosed`, if it supplied one — reached only when 1 and 2 both
 *    fail.** `refocus`, below, tries 1 and 2 and reports whether either landed; the
 *    click handler calls `onClosed` ONLY on a false. This is the fix for the SEVENTH
 *    instance of this plan's missing-guarantee pattern, and the most instructive one:
 *    the version before it composed the two halves as `onClosed ?? refocus`, which
 *    reads as "prefer the caller's answer, otherwise resolve" but actually means "the
 *    caller's answer REPLACES resolving, never runs beside it." Both toolbar doors
 *    supply an `onClosed`, so neither ever reached tier 1 or 2 at all — closing the
 *    manual with the config warning's own link still alive and visible exactly where
 *    the user left it jumped focus to the general `?` button instead of returning it.
 *    A fix aimed entirely at the failure modes (round 2's own tests were all of an
 *    opener that had gone wrong) broke the ordinary case where nothing went wrong,
 *    because nothing tested that case with a caller that also supplies a fallback.
 *    `onClosed` is a TAIL, not a substitute — it runs after resolving fails, never
 *    instead of trying.
 *
 * A caller whose `root` fails tier 2 — the toolbar's two doors — MUST supply its own
 * `onClosed` naming a real destination (`focusInBar`, which has its OWN further
 * fallback chain down to the first visible control in the row), or focus has nowhere
 * left to go. That is not a gap in the guarantee; it is the guarantee's other half,
 * stated as a constraint on the caller rather than as more cleverness in the default.
 *
 * **What this default deliberately does NOT attempt: clipping.** A control can be
 * connected, visible by every `display` in its ancestor chain, and still be scrolled or
 * flex-shrunk out of the reader's view (`overflow: hidden` on a container narrower than
 * its content) — CSS clipping is a LAYOUT fact, not a `display` fact, and jsdom computes
 * no layout at all, so a predicate for it could not be watched failing here; it would be
 * trusted on faith, which this file does not do (see `docs/issues/A comment that
 * states a rule is not a check.md`). Clipping is handled by SHEDDING, not by a predicate:
 * the config warning's own button sits as an ordinary sibling outside the container
 * `styles/toolbarFit.css` shrinks and clips at the last fit rung, but that alone would
 * still leave it the last element on the row and the first thing that rung's clip
 * reaches — so the stylesheet gives it a rung of its own, well before the last one, and
 * it is gone (`display: none`) rather than clipped by the time any clipping could
 * happen. This visibility walk still checks nothing about layout — it cannot, in jsdom
 * or in principle from here — so a future caller that puts a focusable control inside an
 * `overflow: hidden` flex-shrink container without giving it an earlier rung reopens
 * exactly this question, and this paragraph is where the answer would have to change.
 *
 * **The new-item prompt's own door is the one caller that skips both explicit
 * guarantees.** `root: el` (`view/interactions/create.ts`) is the modal's own
 * `contentEl`, which carries no `tabindex`, so it fails tier 2 exactly as `barEl` does
 * — and it supplies no `onClosed`, so tier 3 is empty too. It works anyway, but on an
 * IMPLICIT assumption the other three doors do not need: that its opener cannot vanish
 * or hide while its own modal is open, which is true today (nothing else rebuilds a
 * modal's content) and would silently stop being true the moment something did.
 *
 * This plan found the same missing guarantee seven times before this paragraph: the `?`
 * button's own capture, the overflow entry's yanked-back focus, this function's own
 * captured `parent`, `focusInBar`'s single-level `display` check, this function's
 * missing fallback and the config warning's clippable home (arriving together, the
 * sixth), and now the composition that let a caller's fallback pre-empt resolving
 * instead of terminating it. Every one was fixed correctly and in isolation and
 * produced the next one; this paragraph and the three-tier chain above are the attempt
 * to state the guarantee once rather than find an eighth instance of it.
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
	// Tiers 1 and 2. Reports whether either landed, so the click handler below can tell
	// tier 3 (`onClosed`) apart from a substitute: a caller's fallback runs ONLY when
	// this returns false, never unconditionally — see the doc comment's account of the
	// composition that got this backwards.
	const refocus = (): boolean => {
		const live = target.root.querySelector<HTMLElement>(`.pbl-help-link[data-pbl-section="${target.sectionId}"]`);
		if (live?.isConnected && isVisible(live, target.root)) {
			live.focus();
			return true;
		}
		if (target.root.tabIndex >= 0) {
			target.root.focus();
			return true;
		}
		return false;
	};
	link.setAttribute('data-pbl-section', target.sectionId);
	link.addEventListener('click', () =>
		openManual(app, sections, target.sectionId, () => {
			if (!refocus()) onClosed?.();
		}),
	);
	return link;
}
