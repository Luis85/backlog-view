import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/**
 * `BacklogModel.releases`, split out of `model.test.ts` rather than added to it — that
 * file is already at its `test/**` line budget, and `test/CLAUDE.md` says to split by
 * subject before a file becomes the place tests hide, not to compress to fit.
 */
describe('releases on the model', () => {
	it('collects every Release result, and nothing else', () => {
		const vault = new FakeVault();
		vault.addFile('R1.md', { frontmatter: { type: 'Release' } });
		vault.addFile('R2.md', { frontmatter: { type: 'release' } });
		vault.addFile('M.md', { frontmatter: { type: 'Milestone' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		const model = buildModel(vault.app, vault.entries(), settingsWith());
		expect(model.releases.map((r) => r.file.path).sort()).toEqual(['R1.md', 'R2.md']);
	});

	it('excludes a release the Base filtered out', () => {
		const vault = new FakeVault();
		vault.addFile('Inside.md', { frontmatter: { type: 'Release' } });
		vault.addFile('Outside.md', { frontmatter: { type: 'Release' } });
		// TWO HALVES, and the second is what makes this a test of the guard rather than of
		// nothing. Filtering the entries is how a note is excluded — but `outsideFilter` is
		// `entry === null` (`readItems.ts:238`), and the only thing that sets it is
		// `loadOutsideParents` pulling in the ANCESTORS of result rows. A note simply absent
		// from `entries()` with no child among the results never enters the store at all, so
		// a filter-only fixture passes whether or not `!item.outsideFilter` is in the filter.
		// A child naming it as parent is what makes it a context row. This is the shape
		// `test/domain/dependencies.test.ts` uses.
		vault.addFile('Child.md', { frontmatter: { type: 'PBI' }, parentLink: 'Outside' });
		const entries = vault.entries().filter((e) => e.file.path !== 'Outside.md');
		const model = buildModel(vault.app, entries, settingsWith());
		// Assert it really IS a context row first — otherwise the line below proves nothing.
		expect(model.byPath.get('Outside.md')?.outsideFilter).toBe(true);
		expect(model.releases.map((r) => r.file.path)).toEqual(['Inside.md']);
	});

	it('is not narrowed by an active focus level', () => {
		const vault = new FakeVault();
		vault.addFile('R.md', { frontmatter: { type: 'Release' } });
		vault.addFile('E.md', { frontmatter: { type: 'Epic' } });
		const model = buildModel(vault.app, vault.entries(), settingsWith({ focusLevel: 'Epic' }));
		expect(model.releases.map((r) => r.file.path)).toEqual(['R.md']);
	});
});
