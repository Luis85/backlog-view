import { describe, expect, it } from 'vitest';
import { buildModel } from '../../src/domain/model';
import { settingsWith } from '../helpers/settings';
import { FakeVault } from '../helpers/vault';

/**
 * `hierarchyOnly` OFF on purpose — that is the vault where every note a folder-scoped
 * base returns becomes an item, so the divert is what refuses a resource rather than the
 * scope prune. With it on, a check written without this case passes with the gate deleted.
 */
const settings = settingsWith({ assigneeKey: 'assignee', hierarchyOnly: false });

/** What the Base returned, when it did not return everything. */
function only(vault: FakeVault, ...paths: string[]) {
	return vault.entries().filter((e) => paths.includes(e.file.path));
}

describe('the roster the model keeps', () => {
	it('keeps every Resource note the base returned, alphabetically, and makes no item of one', () => {
		const vault = new FakeVault();
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 } });
		vault.addFile('Sam.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		const model = buildModel(vault.app, vault.entries(), settings);

		expect(model.resources.map((r) => r.title)).toEqual(['Alex', 'Sam']);
		expect(model.items.map((i) => i.title)).toEqual(['Epic A']);
	});

	it('keeps no resource the base did not return', () => {
		// A result naming a resource as its parent pulls that note in through
		// `loadOutsideParents` with no entry. It is not this base's vocabulary, so it is
		// not a row, not a menu entry and not a drop target.
		const vault = new FakeVault();
		vault.addFile('Alex.md', { frontmatter: { type: 'Resource' } });
		vault.addFile('Epic A.md', { frontmatter: { type: 'Epic', order: 10 }, parentLink: 'Alex' });
		const model = buildModel(vault.app, only(vault, 'Epic A.md'), settings);

		expect(model.resources).toEqual([]);
	});
});
