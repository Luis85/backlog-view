// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mountHarness } from './mount';
import { applyWantedState, openWantedDialog } from './knobs';
import { applyPlatform } from './theme';
import { installObsidianDom } from '../helpers/dom';
import { clickExpandAll, projectionButton } from '../helpers/view';
import { rules } from '../helpers/cssVars';

installObsidianDom();

/**
 * Does the vendored `obsidian.css` reach every OBSIDIAN element the harness draws?
 *
 * This is the cheaper half [[The harness's variable guard says nothing about element
 * defaults]] sketched for itself, built and no wider: *comparing the selectors the
 * vendored sheet defines against the elements and classes the harness actually puts on
 * the page would not catch staleness, but it would have named `.modal-title` and
 * `.modal-content` as drawn-but-unstyled without anyone reading the CSS.* It names both,
 * and four the note never did.
 *
 * The question is asked of the FORBIDDEN THING — a class on the page with no rule reaching
 * it — rather than of a list of elements somebody remembered to check. Which classes count
 * as Obsidian's is a rule too, not a table: anything the page wears that is not `pbl-*`
 * was written by the mock, by `dom.ts` or by app.css itself, because the view's own
 * stylesheet dresses only its own prefix.
 *
 * **What it does NOT reach**, each stated because a check that reads wider than it looks
 * is the defect this repository keeps finding in itself:
 *
 * - **Staleness.** A vendored rule whose value a newer app.css has changed is styled, and
 *   passes. That is the half of the note this does not lift, and there is no lifting it
 *   without an Obsidian to compare against.
 * - **Element defaults with no class at all.** A bare `<button>`, `<input>` or `<select>`
 *   is invisible here, and a missing `button` rule is the very episode the note was filed
 *   about. Classes are what a page can be asked for cheaply; tag coverage would have to
 *   decide which of jsdom's every-element it cares about.
 * - **Whether a matching rule APPLIES.** A class token is looked for anywhere in a
 *   selector, so `.foo` styled only under an ancestor this page never nests it in reads as
 *   styled. Specificity and ancestry are a browser's question and jsdom computes neither.
 * - **A state no committed knob reaches.** The reduction keeps what the harness was DRIVEN
 *   through, so this inherits that limit exactly: gestures, failure states and
 *   configuration variants draw classes nothing here asks for.
 */
describe('the vendored app.css reaches what the harness draws', () => {
	/** Every non-`pbl` class the page wears after the committed states have been driven. */
	function drawnObsidianClasses(): Set<string> {
		applyPlatform('?phone');
		const root = document.createElement('div');
		document.body.appendChild(root);
		// `edges` rather than `demo`: same markup, and the awkward fixture is the one whose
		// bars, shelf and unknown types reach the most of it.
		const { view, containerEl } = mountHarness(root, 'edges');
		clickExpandAll(containerEl);
		applyWantedState(view, '?shelf&focus=PBI');
		for (const label of ['Show as kanban boards', 'Show as roadmap', 'Show as test catalog']) {
			projectionButton(containerEl, label).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		}
		for (const axis of ['horizons', 'dates', 'resources'] as const) view.setAxisPick(axis);
		for (const dialog of ['manual', 'colors', 'new']) openWantedDialog(view, containerEl, `?dialog=${dialog}`);

		const drawn = new Set<string>();
		for (const el of document.querySelectorAll<HTMLElement>('*')) {
			for (const name of el.classList) if (!name.startsWith('pbl-')) drawn.add(`.${name}`);
		}
		return drawn;
	}

	/** Every class token any selector in a sheet names, whatever else it is nested under. */
	function styledClasses(sheet: string): Set<string> {
		const selectors = rules(readFileSync(sheet, 'utf8')).flatMap((rule) => rule.selectors);
		return new Set(selectors.flatMap((selector) => selector.match(/\.[\w-]+/g) ?? []));
	}

	/**
	 * Measured 2026-09-02 and REFUSED rather than filled. Every one is a real gap — the
	 * dialog's title reads unstyled and its content pane does not grow to the frame — and
	 * the note's own rule is that guessing a rule into `theme.css` is worse than the gap:
	 * a guessed baseline beside a real one is two answers to one question, which is the
	 * episode `theme.css`'s header records. Filling these is a re-derivation against a
	 * local Obsidian, which cannot run here.
	 *
	 * So the list is the FINDING, not the rule. What the rule buys is that a seventh
	 * arrives loudly: vendor more of app.css and the names it now covers fail here until
	 * they are struck off, and draw a new Obsidian element with nothing behind it and it
	 * fails on a suite nobody edited.
	 */
	const UNSTYLED = [
		'.extra-setting-button',
		'.mod-dim',
		'.modal-content',
		'.modal-title',
		'.setting-item-control',
		'.setting-item-info',
	];

	it('leaves only the gaps that were measured and refused', () => {
		const drawn = drawnObsidianClasses();
		const styled = styledClasses('test/harness/obsidian.css');
		expect([...drawn].filter((name) => !styled.has(name)).sort()).toEqual(UNSTYLED);
		// Not vacuous: a drive that rendered nothing reports no gaps and would pass. The
		// count is a floor rather than the number, so an added fixture does not fail this.
		expect(drawn.size).toBeGreaterThanOrEqual(20);
		// And pinned to the instance the note predicted, so a rewrite of the filter that
		// stopped seeing dialog markup could not leave this green.
		expect(drawn.has('.modal-title')).toBe(true);
	});
});
