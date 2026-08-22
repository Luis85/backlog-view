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
		// How every context-row test in this repository excludes a note: filter the entries the
		// view is handed. There is no `entriesExcept` helper.
		const entries = vault.entries().filter((e) => e.file.path !== 'Outside.md');
		const model = buildModel(vault.app, entries, settingsWith());
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
