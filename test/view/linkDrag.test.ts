// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FakeVault } from '../helpers/vault';
import { makeView, useViewHarness } from '../helpers/view';
import { legalTargetPaths } from '../../src/view/interactions/dependencies';
import { BacklogItem, BacklogModel } from '../../src/domain/model';

useViewHarness();

const DEPS = { dependsOnProperty: 'note.dependsOn' };

/** B waits for A, C waits for B, D waits for nothing — a two-deep chain plus a loner. */
function chainVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: '[[A]]' } });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: '[[B]]' } });
	vault.addFile('D.md', { frontmatter: { type: 'PBI', order: 40 } });
	return vault;
}

/**
 * A, B (waits for A) and C (waits for B) under an Epic parent — so filtering the Epic
 * out of the results still loads it as a genuine context row (`outsideFilter: true`),
 * an ancestor of every result, rather than dropping it from the model entirely. An
 * unrelated note excluded from `only` never loads at all (nothing pulls it in as
 * someone's ancestor), so it cannot stand in for this case — this fixture exists
 * because that distinction is exactly what the target-side guard is about.
 */
function ancestorVault(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Epic.md', { frontmatter: { type: 'Epic', order: 5 } });
	vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 }, parentLink: 'Epic' });
	vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: '[[A]]' }, parentLink: 'Epic' });
	vault.addFile('C.md', { frontmatter: { type: 'PBI', order: 30, dependsOn: '[[B]]' }, parentLink: 'Epic' });
	return vault;
}

function itemFor(model: BacklogModel, path: string): BacklogItem {
	const item = model.byPath.get(path);
	if (!item) throw new Error(`no item: ${path}`);
	return item;
}

describe('which bars a link may be dropped onto', () => {
	function sweep(vault: FakeVault, from: string, only?: string[]) {
		const { view } = makeView(vault, DEPS, only ? { only } : {});
		const model = view.model;
		if (!model) throw new Error('no model');
		return { paths: [...legalTargetPaths(view.app, model, itemFor(model, from))].sort(), model, view };
	}

	it('refuses the source itself and anything already waiting for it', () => {
		// A is already B's prerequisite, so dropping A on B would write the line that is
		// on disk. A on A is the loop of length one.
		expect(sweep(chainVault(), 'A.md').paths).toEqual(['C.md', 'D.md']);
	});

	it('refuses a target the source waits on THROUGH a chain, not only directly', () => {
		// C waits for B waits for A. Dropping C onto A would make A wait for C and close
		// a three-node loop — a one-hop check would miss it and offer A.
		expect(sweep(chainVault(), 'C.md').paths).toEqual(['D.md']);
	});

	it('refuses a row the Base excluded, which is never a write target', () => {
		// Epic is a genuine context row here: it is A/B/C's parent, so `only` excluding it
		// from the results still loads it into the model as an ancestor — `outsideFilter:
		// true`, not simply absent. Nothing about its own dependency graph would disqualify
		// it as a target (it declares nothing, waits on nothing, closes no loop), so this
		// is the case that tells the target-side `outsideFilter` guard apart from a target
		// that was never a candidate to begin with.
		const { paths } = sweep(ancestorVault(), 'A.md', ['A.md', 'B.md', 'C.md']);
		expect(paths).toEqual(['C.md']);
	});

	it('refuses a target whose existing entry never resolved into a real edge', () => {
		// B names A twice, once bare and once bracketed. Both spellings are B's own
		// declaration, so A must not be offered for B however the line reads.
		const vault = new FakeVault();
		vault.addFile('A.md', { frontmatter: { type: 'PBI', order: 10 } });
		vault.addFile('B.md', { frontmatter: { type: 'PBI', order: 20, dependsOn: ['A', '[[A]]'] } });
		expect(sweep(vault, 'A.md').paths).toEqual([]);
	});
});
