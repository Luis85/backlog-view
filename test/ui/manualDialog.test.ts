// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { assembleStyles } from '../../scripts/styles-assemble.mjs';
import { installObsidianDom } from '../helpers/dom';
import { ManualSection, manualLink, openManual } from '../../src/ui/manualDialog';
import { Modal } from '../helpers/obsidian-mock';

installObsidianDom();

const SECTIONS: ManualSection[] = [
	{ id: 'one', title: 'First', entries: [{ term: 'A', text: 'alpha' }] },
	{ id: 'two', title: 'Second', entries: [{ term: 'B', text: 'beta' }] },
];

/** The mock's Modal does not attach anything, so the content is read off contentEl. */
const content = () => {
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('no modal opened');
	return modal.contentEl;
};

describe('the manual dialog', () => {
	beforeEach(() => {
		Modal.forget();
		document.body.empty();
	});

	it('opens on the section it was asked for, not the first one', () => {
		openManual({} as never, SECTIONS, 'two');
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('Second');
	});

	it('lists every section in the sidebar, marking the open one', () => {
		openManual({} as never, SECTIONS, 'two');
		const tabs = Array.from(content().querySelectorAll('.vertical-tab-nav-item'));
		expect(tabs.map((t) => t.textContent)).toEqual(['First', 'Second']);
		expect(tabs.filter((t) => t.hasClass('is-active')).map((t) => t.textContent)).toEqual(['Second']);
		// The class is a visual cue only; `aria-pressed` is what makes the current
		// section legible to assistive tech, the same convention `.pbl-mode-btn` uses.
		expect(tabs.map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
	});

	it('switches the pane when a sidebar item is clicked', () => {
		openManual({} as never, SECTIONS, 'one');
		const tabs = Array.from(content().querySelectorAll<HTMLElement>('.vertical-tab-nav-item'));
		const [first, second] = tabs;
		expect(first.getAttribute('aria-pressed')).toBe('true');
		second.click();
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('Second');
		expect(content().querySelector('.pbl-manual-def')?.textContent).toBe('beta');
		// The newly-selected item is marked AND the one it replaced is cleared — a test
		// that only checked the new one would pass with both stuck at "true".
		expect(first.getAttribute('aria-pressed')).toBe('false');
		expect(second.getAttribute('aria-pressed')).toBe('true');
	});

	it('falls back to the first section when the id is unknown', () => {
		openManual({} as never, SECTIONS, 'nope');
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('First');
	});

	// Both classes go on the MODAL and not on `contentEl`, and the sentence saying so was
	// a comment with nothing behind it until the mock grew a `modalEl` (2026-08-15): the
	// settings background is scoped to `.modal.mod-settings`, and the phone rules that
	// stop a fixed 190px sidebar crushing the pane are `.is-phone .modal.mod-sidebar-layout`
	// and `.is-phone .modal.mod-settings.mod-sidebar-layout` — neither matches on
	// `mod-settings` alone, so dropping either class loses a layout silently.
	it('marks the modal element itself with both classes the vendored rules require', () => {
		openManual({} as never, SECTIONS, 'one');
		const modalEl = Modal.lastOpened?.modalEl;
		expect(modalEl?.hasClass('mod-settings')).toBe(true);
		expect(modalEl?.hasClass('mod-sidebar-layout')).toBe(true);
		// On the modal, NOT on the content: a test that only counted the classes would
		// pass with both on the element whose rules never match.
		expect(content().hasClass('mod-sidebar-layout')).toBe(false);
	});

	// Focus policy belongs to the caller, so what this asserts is that the dialog CALLS
	// back — where focus lands is each door's own test, in `manualEntryPoints.test.ts`.
	it('tells the caller when it closes, so focus policy stays out of ui/', () => {
		let closed = 0;
		openManual({} as never, SECTIONS, 'one', () => {
			closed += 1;
		});
		expect(closed).toBe(0);
		Modal.lastOpened?.close();
		expect(closed).toBe(1);
	});

	it('closes cleanly with no callback at all', () => {
		openManual({} as never, SECTIONS, 'one');
		expect(() => Modal.lastOpened?.close()).not.toThrow();
	});

	it('renders the intro when a section carries one, and no element when it does not', () => {
		const withAndWithoutIntro: ManualSection[] = [
			{ id: 'a', title: 'A', intro: 'Read this first.', entries: [{ term: 'T', text: 'd' }] },
			{ id: 'b', title: 'B', entries: [{ term: 'T', text: 'd' }] },
		];
		openManual({} as never, withAndWithoutIntro, 'a');
		expect(content().querySelector('.pbl-manual-intro')?.textContent).toBe('Read this first.');

		const second = Array.from(content().querySelectorAll<HTMLElement>('.vertical-tab-nav-item'))[1];
		second.click();
		expect(content().querySelector('.pbl-manual-intro')).toBeNull();
	});

	it('renders a badge when an entry carries one', () => {
		openManual({} as never, [{ id: 'x', title: 'X', entries: [{ term: 'Epic', text: 'e', badge: { text: 'Epic', cls: 'pbl-lvl-0' } }] }], 'x');
		const badge = content().querySelector('.pbl-badge');
		expect(badge?.hasClass('pbl-lvl-0')).toBe(true);
		expect(badge?.textContent).toBe('Epic');
	});

	// The pane's own `<h3>` names the SECTION and changes as the sidebar is used, so a
	// title that only matched on a single-section test would look right for the wrong
	// reason — the point of this test is the second assertion, after a switch.
	it('gives the dialog a stable accessible name that does not change when the section does', () => {
		openManual({} as never, SECTIONS, 'one');
		const titleEl = Modal.lastOpened?.titleEl;
		expect(titleEl?.textContent).toBe('Product backlog manual');

		const second = Array.from(content().querySelectorAll<HTMLElement>('.vertical-tab-nav-item'))[1];
		second.click();
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('Second');
		expect(titleEl?.textContent).toBe('Product backlog manual');
	});

	it('resets the pane to the top when the section changes, so a scrolled reader is not stranded mid-section', () => {
		openManual({} as never, SECTIONS, 'one');
		const pane = content().querySelector<HTMLElement>('.pbl-manual-pane');
		if (!pane) throw new Error('no pane');
		// jsdom does no layout, so nothing here produces a real scroll — setting the
		// property directly is enough to prove `show` resets it, which a render that
		// never touched `scrollTop` would fail.
		pane.scrollTop = 500;

		const second = Array.from(content().querySelectorAll<HTMLElement>('.vertical-tab-nav-item'))[1];
		second.click();
		expect(pane.scrollTop).toBe(0);
	});
});

describe('the point-of-need link', () => {
	beforeEach(() => {
		Modal.forget();
		document.body.empty();
	});

	it('opens on its own section and carries its own label and section id', () => {
		const parent = document.body.createDiv();
		manualLink(parent, {} as never, SECTIONS, { sectionId: 'two', label: 'Read more', root: parent });
		const link = parent.querySelector<HTMLButtonElement>('.pbl-help-link');
		expect(link?.textContent).toBe('Read more');
		expect(link?.getAttribute('data-pbl-section')).toBe('two');
		link?.click();
		expect(content().querySelector('.pbl-manual-pane h3')?.textContent).toBe('Second');
	});

	/**
	 * `onClosed` is a TAIL, not a substitute: it runs only once resolving the live
	 * opener AND falling back to `root` both fail. This is the exact composition round 3
	 * fixed — the version before it ran `onClosed` unconditionally whenever a caller
	 * supplied one, which is the boring case broken by a fix aimed entirely at the
	 * failure modes: neither round 2's tests nor this one (before the rewrite) ever
	 * drove a caller that supplies `onClosed` AND has an opener that survives.
	 */
	it('does not run onClosed when the live opener still resolves — tier 1 wins over a caller-supplied fallback', () => {
		const root = document.body.createDiv();
		let closed = 0;
		manualLink(root, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root }, () => {
			closed += 1;
		});
		const link = root.querySelector<HTMLButtonElement>('.pbl-help-link');
		link?.click();
		Modal.lastOpened?.close();
		expect(closed).toBe(0);
		expect(document.activeElement).toBe(link);
	});

	it('runs onClosed as the tail once both the live opener and the root fallback fail', () => {
		const root = document.body.createDiv(); // no tabindex: tier 2 fails too
		const wrap = root.createDiv();
		let closed = 0;
		manualLink(wrap, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root }, () => {
			closed += 1;
		});
		wrap.querySelector<HTMLButtonElement>('.pbl-help-link')?.click();
		root.empty(); // the opener is gone by closing time; `root` cannot take focus either
		Modal.lastOpened?.close();
		expect(closed).toBe(1);
	});

	// The default is RESOLVED, not captured (see the comment on `manualLink`). The tests
	// below drive its two-tier fallback chain — resolve the live opener; else fall back
	// to `root` when `root` is itself a real focus target — by the way the opener can
	// fail, not by which of the four doors it is: absent (gone by close time), hidden
	// behind an ancestor, and neither of those with nowhere left to fall back to.
	it('default: refocuses the live link when it is connected and visible', () => {
		const root = document.body.createDiv();
		manualLink(root, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root });
		const link = root.querySelector<HTMLButtonElement>('.pbl-help-link');
		link?.click();
		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(link);
	});

	/**
	 * "Hidden behind an ancestor" — what `.pbl-busy` looks like once its own `pbl-busy-on`
	 * class is gone: the link's own rule says nothing, an ancestor's does. `wrap` stands
	 * in for that ancestor, one level between the link and `root`. `root` here has no
	 * `tabindex`, matching the toolbar bar's own shape, so this is also the case where
	 * the fallback tier has nowhere to land — a caller whose root cannot itself take
	 * focus has to supply its own `onClosed` instead (the toolbar's two doors both do).
	 */
	it('default: does nothing when an ancestor is hidden and root cannot itself take focus', () => {
		const root = document.body.createDiv();
		const wrap = root.createDiv();
		manualLink(wrap, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root });
		wrap.querySelector<HTMLButtonElement>('.pbl-help-link')?.click();
		wrap.style.display = 'none'; // the ancestor hides; the link's own rule is untouched
		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(document.body);
	});

	/**
	 * The other half of the same case: `root` genuinely IS a focus target (`tabindex`,
	 * matching the tree's own `role="tree" tabindex="0"`), so the fallback tier lands
	 * there instead of giving up. Same hidden-ancestor shape as above — the only thing
	 * that differs is whether `root` itself is reachable.
	 */
	it('default: falls back to root when the link is hidden and root is a genuine focus target', () => {
		const root = document.body.createDiv();
		root.tabIndex = 0;
		const wrap = root.createDiv();
		manualLink(wrap, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root });
		wrap.querySelector<HTMLButtonElement>('.pbl-help-link')?.click();
		wrap.style.display = 'none';
		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(root);
	});

	it('default: does nothing when the section it opened is gone by closing time, and root cannot itself take focus', () => {
		const parent = document.body.createDiv();
		manualLink(parent, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root: parent });
		parent.querySelector<HTMLButtonElement>('.pbl-help-link')?.click();
		parent.empty(); // the caller's own re-render replaced the whole row
		expect(() => Modal.lastOpened?.close()).not.toThrow();
		expect(document.activeElement).toBe(document.body);
	});

	it('default: falls back to root when the section is gone by closing time and root is a genuine focus target', () => {
		const root = document.body.createDiv();
		root.tabIndex = 0;
		const wrap = root.createDiv();
		manualLink(wrap, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root });
		wrap.querySelector<HTMLButtonElement>('.pbl-help-link')?.click();
		root.empty(); // the caller's own re-render replaced the whole row, root included its content
		expect(() => Modal.lastOpened?.close()).not.toThrow();
		expect(document.activeElement).toBe(root);
	});

	/**
	 * The regression this plan hit a fourth time: resolving from `parent` — the shell the
	 * button was drawn into — rather than from a stable `root`. `parent` is exactly what a
	 * real render pass throws away (`treeEl.empty()`, `barEl.empty()`); `root` is what
	 * survives it. This constructs that shape directly: a stable `root`, and two
	 * successive ephemeral shells inside it, the second replacing the first the way a
	 * real re-render does. Resolving from the (now detached) first shell would find
	 * nothing; resolving from `root` finds the new instance.
	 */
	it('default: resolves through the stable root, never through the ephemeral shell the link was drawn into', () => {
		const root = document.body.createDiv();
		const shellA = root.createDiv();
		manualLink(shellA, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root });
		shellA.querySelector<HTMLButtonElement>('.pbl-help-link')?.click();

		// The re-render: the shell that drew the clicked link is gone, replaced by a new
		// one holding the new instance of the same door — same section id, new element.
		root.empty();
		const shellB = root.createDiv();
		manualLink(shellB, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root });
		const rebuilt = shellB.querySelector<HTMLButtonElement>('.pbl-help-link');

		Modal.lastOpened?.close();
		expect(document.activeElement).toBe(rebuilt);
	});

	/** The other half of the case above: proves resolving from `parent` really would have
	 * found nothing, so the fix is not accidental. Same shape, but the default is built
	 * with `root: shellA` — the stale shell — rather than the survivor. */
	it('resolving from the stale shell instead finds nothing, which is the bug the fix closes', () => {
		const root = document.body.createDiv();
		const shellA = root.createDiv();
		manualLink(shellA, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root: shellA });
		shellA.querySelector<HTMLButtonElement>('.pbl-help-link')?.click();

		root.empty(); // shellA (the resolve root this caller chose) is now detached
		const shellB = root.createDiv();
		const rebuilt = manualLink(shellB, {} as never, SECTIONS, { sectionId: 'one', label: 'Help', root: shellA });

		Modal.lastOpened?.close();
		expect(document.activeElement).not.toBe(rebuilt);
		expect(document.activeElement).toBe(document.body);
	});
});

/**
 * jsdom applies no cascade and no `:focus-visible` matching, so a lost focus ring is
 * invisible to every test above — the dialog tests can drive a click but not a Tab.
 * This reads the assembled stylesheet as text instead, the same way
 * `test/view/rendering.test.ts` does for the view's own controls. What it proves is
 * existence at a selector whose specificity already beats Obsidian's own
 * `button:focus-visible` outright (two classes and a pseudo-class against one
 * pseudo-class and the element) — no cascade-order race to check, unlike a same-
 * specificity tie. What it cannot prove is what the ring looks like on screen; that is
 * still a live-vault question, per `docs/issues/Four other controls still lose to
 * Obsidian's button rule.md`.
 */
describe("the manual's stylesheet", () => {
	const styles: string = assembleStyles();

	it('gives the sidebar item its own focus-visible ring, since it strips the one Obsidian would draw', () => {
		const rule = /\.pbl-manual-nav \.vertical-tab-nav-item:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--interactive-accent\)/;
		expect(styles).toMatch(rule);
	});

	/**
	 * The second instance of `docs/bugs/Obsidian's button rule outranks the plugin's
	 * chrome-stripping.md` in this plan: a class-only `.pbl-help-link` selector is
	 * `(0,1,0)`, Obsidian's `button:not(.clickable-icon)` is `(0,1,1)`, and a lower
	 * specificity loses regardless of source order — the reset silently did nothing.
	 * `test/harness/obsidian.css` carries the real vendored rule these three tests read
	 * `styles.css` against; the specificity math is confirmed by hand in the CSS
	 * comment beside the fixed rule. Existence only, the same limit named above: jsdom
	 * applies no cascade, so this cannot prove which rule actually WINS in a browser —
	 * only that the plugin's rule, qualified to tie and positioned to win, is in the
	 * sheet. Same limit for the hover restatement and the focus ring below.
	 */
	it('element-qualifies the help link so its chrome-stripping actually ties and beats Obsidian’s button default', () => {
		const rule = /button\.pbl-help-link\s*\{[^}]*background:\s*none[^}]*box-shadow:\s*none/;
		expect(styles).toMatch(rule);
	});

	// Obsidian's OWN button:hover rule is a separate (0,1,1) declaration for the same
	// two properties — a browser resolves the winner per PROPERTY, not per rule, so the
	// base rule's win at rest says nothing about hover (`docs/bugs/The disclosure's
	// hover still painted a button fill.md`).
	it('restates the neutralised chrome on hover rather than leaving it to inherit the win', () => {
		const rule = /button\.pbl-help-link:hover\s*\{[^}]*background-color:\s*transparent[^}]*box-shadow:\s*none/;
		expect(styles).toMatch(rule);
	});

	it('gives the help link its own focus-visible ring, for the same reason as the sidebar item', () => {
		const rule = /button\.pbl-help-link:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--interactive-accent\)/;
		expect(styles).toMatch(rule);
	});

	// Existence only, same limit as above: jsdom evaluates neither media queries nor
	// the `.is-phone` class Obsidian's real app shell would add, so this cannot prove
	// the phone case actually stacks on screen — only that the rule is in the sheet.
	it('stacks the sidebar above the pane on a real phone, gated the way Obsidian itself gates phone layout', () => {
		expect(styles).toMatch(/\.is-phone \.pbl-manual-split\s*\{[^}]*flex-direction:\s*column/);
	});

	// Same limit again, and a genuinely separate rule from the one above — the split
	// stacking nav-over-pane says nothing about the two-column grid INSIDE the pane,
	// which is the one a long term (e.g. "An untyped item still has a level") crowds at
	// phone width regardless of whether the split itself is stacked.
	it('collapses the term/definition grid to one column on a real phone, so a long term cannot crowd the definition out', () => {
		expect(styles).toMatch(/\.is-phone \.pbl-manual-prose\s*\{[^}]*grid-template-columns:\s*1fr/);
	});
});
