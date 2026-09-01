// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { makeMyWorkView, mwPickPerson, myWorkVault, refreshMyWork } from '../../helpers/mywork';
import { FakeVault } from '../../helpers/vault';
import type { MyWorkView } from '../../../src/view/mywork/myWorkView';

/**
 * The my-work toolbar (`view/mywork/toolbar.ts`, Task 8): the person picker, collapse
 * all, expand all and hide done — `view/release/scopeToolbar.ts`'s own shape for the
 * identical three controls, drawn over `myWorkVault()`'s own Ada tree
 * (`test/helpers/mywork.ts`'s own docblock): `Epic.md` (context) -> `Feature.md`
 * (context) -> `PBI Ada.md`, plus `PBI Hidden.md` re-rooted under `Epic.md`.
 */
function personOptions(view: MyWorkView): string[] {
	return [...view.viewEl.querySelectorAll('.pbl-mw-person option')].map((o) => o.textContent);
}

function hideDoneBtn(view: MyWorkView): HTMLButtonElement | null {
	return view.viewEl.querySelector<HTMLButtonElement>('.pbl-mw-hidedone');
}

describe('the person picker', () => {
	it('lists every Resource note the base returned, including one carrying nothing', () => {
		const { view } = makeMyWorkView(myWorkVault());
		expect(personOptions(view)).toEqual(expect.arrayContaining(['Ada', 'Bo']));
	});

	it('names two people who share a basename apart', () => {
		const vault = new FakeVault();
		vault.addFile('People/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Archive/Ada.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('PBI.md', { frontmatter: { type: 'PBI', order: 1 } });
		const { view } = makeMyWorkView(vault);

		// `namedTargets` gives the path-minus-extension for the pair that collides, and the
		// basename for everybody else.
		expect(personOptions(view)).toEqual(expect.arrayContaining(['People/Ada', 'Archive/Ada']));
		expect(personOptions(view)).not.toContain('Ada');
	});

	it('picking a person persists and redraws', () => {
		const { view } = makeMyWorkView(myWorkVault());

		mwPickPerson(view, 'People/Ada.md');

		expect(view.pickedPerson).toBe('People/Ada.md');
		expect(view.viewEl.querySelector('.pbl-mw-tree')).not.toBeNull();
	});
});

describe('collapse all and expand all', () => {
	it('collapses and expands every row of THIS person’s tree and no other', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');

		view.viewEl.querySelector<HTMLButtonElement>('.pbl-mw-collapse')!.click();
		// Only `Epic.md` is a top-level row — `Feature.md` and `PBI Hidden.md` both hang
		// off it, `Feature.md`'s own child `PBI Ada.md` a level deeper still.
		expect(view.viewEl.querySelectorAll('.pbl-row')).toHaveLength(1);

		view.viewEl.querySelector<HTMLButtonElement>('.pbl-mw-expand')!.click();
		expect(view.viewEl.querySelectorAll('.pbl-row').length).toBeGreaterThan(1);
	});

	it('is drawn even with nobody picked, so the picker stays reachable', () => {
		const { view } = makeMyWorkView(myWorkVault());
		expect(view.viewEl.querySelector('.pbl-mw-person')).not.toBeNull();
		// Collapse/expand/hide-done ask about a tree that does not exist yet.
		expect(view.viewEl.querySelector('.pbl-mw-collapse')).toBeNull();
	});
});

describe('hide done', () => {
	it('withholds hide-done when no state property is bound', () => {
		// A control that could hide rows nothing can bring back is not drawn — the release
		// toolbar's own gate, asked of this view's own question.
		const { view } = makeMyWorkView(myWorkVault(), {
			stateProperty: '',
			deliverableStateProperty: '',
			testStateProperty: '',
		});
		view.pick('People/Ada.md');

		expect(hideDoneBtn(view)).toBeNull();
		// Collapse and expand are unaffected — they ask nothing about done-ness.
		expect(view.viewEl.querySelector('.pbl-mw-collapse')).not.toBeNull();
	});

	it('toggles aria-pressed and the ON class together, agreeing with the tree’s own gate', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		const before = hideDoneBtn(view)!;
		expect(before.getAttribute('aria-pressed')).toBe('false');
		expect(before.classList.contains('pbl-mw-toggle-on')).toBe(false);

		before.click();

		const after = hideDoneBtn(view)!;
		expect(after.getAttribute('aria-pressed')).toBe('true');
		expect(after.classList.contains('pbl-mw-toggle-on')).toBe(true);
	});
});

/**
 * Every control here calls `view.render()`, which `empty()`s `viewEl` and detaches
 * whichever of them was focused — `MyWorkView.render`'s own stated reason, restored via
 * `FOCUS_HANDLE_CLASSES`. A keyboard user who presses one must land on its redrawn
 * equivalent, not on `document.body`.
 */
describe('focus after a redraw', () => {
	it('restores focus to the redrawn person picker after a pick', () => {
		const { view } = makeMyWorkView(myWorkVault());

		mwPickPerson(view, 'People/Ada.md');

		const redrawn = view.viewEl.querySelector('.pbl-mw-person');
		expect(redrawn).not.toBeNull();
		expect(document.activeElement).toBe(redrawn);
	});

	it('restores focus to the redrawn collapse control', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		const btn = view.viewEl.querySelector<HTMLButtonElement>('.pbl-mw-collapse')!;
		btn.focus();

		btn.click();

		const redrawn = view.viewEl.querySelector('.pbl-mw-collapse');
		expect(redrawn).not.toBeNull();
		expect(redrawn).not.toBe(btn);
		expect(document.activeElement).toBe(redrawn);
	});

	it('restores focus to the redrawn expand control', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		const btn = view.viewEl.querySelector<HTMLButtonElement>('.pbl-mw-expand')!;
		btn.focus();

		btn.click();

		const redrawn = view.viewEl.querySelector('.pbl-mw-expand');
		expect(redrawn).not.toBeNull();
		expect(redrawn).not.toBe(btn);
		expect(document.activeElement).toBe(redrawn);
	});

	it('restores focus to the redrawn hide-done toggle', () => {
		const { view } = makeMyWorkView(myWorkVault());
		view.pick('People/Ada.md');
		const btn = hideDoneBtn(view)!;
		btn.focus();

		btn.click();

		const redrawn = hideDoneBtn(view);
		expect(redrawn).not.toBeNull();
		expect(redrawn).not.toBe(btn);
		expect(document.activeElement).toBe(redrawn);
	});
});

/**
 * A stored pick outlives the note it names. The body already asks whether the path still
 * RESOLVES on the roster (`myWorkView.ts`'s `draw()` — `pickedResource`, never a bare
 * non-null test), because a `Resource` note is kept off `byPath` entirely. The toolbar was
 * asking the weaker question, so a deleted person left three live controls beside the
 * no-pick guidance, each one calling `assignedRows` for somebody not on the roster.
 *
 * Found by review (PR #234). Watched failing against `person === null` alone.
 */
describe('a pick whose person is gone', () => {
	it('withholds the tree controls, exactly as the body withholds the tree', () => {
		const vault = myWorkVault();
		const { view } = makeMyWorkView(vault);
		view.pick('People/Ada.md');
		expect(view.viewEl.querySelector('.pbl-mw-collapse')).not.toBeNull();

		// The note stops being a `Resource`, so the roster stops carrying it — the same end
		// state as deleting it or filtering it out, reached without touching the shared
		// fixture. The stored pick does not follow it, which is the whole point of the case.
		vault.setFrontmatter('People/Ada.md', { type: 'PBI', order: 9 });
		refreshMyWork(view, vault);

		expect(view.pickedPerson).toBe('People/Ada.md');
		// The picker itself stays: it is the way back out.
		expect(view.viewEl.querySelector('.pbl-mw-person')).not.toBeNull();
		expect(view.viewEl.querySelector('.pbl-mw-collapse')).toBeNull();
		expect(view.viewEl.querySelector('.pbl-mw-expand')).toBeNull();
		expect(view.viewEl.querySelector('.pbl-mw-hidedone')).toBeNull();
	});
});
