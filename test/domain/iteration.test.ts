import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { defaultSettings } from '../../src/domain/settings';
import { buildModel } from '../../src/domain/model';
import { FakeVault } from '../helpers/vault';

/**
 * `BacklogItem.iterationEntry` — a plain `readLinkList` read, in its own file rather
 * than beside `model.test.ts`'s general suite for the reason `dependencies.test.ts`
 * is its own file too: split by subject before a shared suite becomes where tests hide.
 */

describe('reading the iteration link', () => {
	it('reads the iteration link, keeping what the note spells and what it resolved to', () => {
		const vault = new FakeVault();
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', iteration: '[[Sprint 12]]' } });
		vault.addFile('Sprint 12.md', { frontmatter: { type: 'Iteration' } });

		const model = buildModel(vault.app, vault.entries(), settingsWith({ iterationKey: 'iteration' }));

		const pbi = model.byPath.get('PBI-1.md')!;
		expect(pbi.iterationEntry?.file?.path).toBe('Sprint 12.md');
		// Brackets and all — the same reading `dependsOnEntries` gives, and for the same
		// reason: a removal path has to match the exact text a note spells.
		expect(pbi.iterationEntry?.raw).toBe('[[Sprint 12]]');
	});

	it('keeps a broken iteration link rather than dropping it', () => {
		const vault = new FakeVault();
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', iteration: '[[Gone]]' } });

		const model = buildModel(vault.app, vault.entries(), settingsWith({ iterationKey: 'iteration' }));

		const pbi = model.byPath.get('PBI-1.md')!;
		expect(pbi.iterationEntry?.raw).toBe('[[Gone]]');
		expect(pbi.iterationEntry?.file).toBeNull();
	});

	it('reads nothing when no iteration property is configured', () => {
		const vault = new FakeVault();
		vault.addFile('PBI-1.md', { frontmatter: { type: 'PBI', iteration: '[[Sprint 12]]' } });

		const model = buildModel(vault.app, vault.entries(), defaultSettings());

		expect(model.byPath.get('PBI-1.md')!.iterationEntry).toBeNull();
	});
});
