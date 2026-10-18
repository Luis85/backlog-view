import { describe, expect, it } from 'vitest';
import { settingsWith } from '../helpers/settings';
import { buildModel } from '../../src/domain/model';
import {
	followingIteration,
	isIterationClosed,
	iterationCloseWrites,
	unfinishedMembers,
} from '../../src/domain/iterations';
import { FakeVault } from '../helpers/vault';

/** Closing an iteration: which sprint follows it, what is unfinished, and the one batch. */

const settings = settingsWith({
	iterationKey: 'iteration',
	stateKey: 'status',
	states: ['New', 'Doing', 'Done'],
	doneValues: ['Done'],
	startKey: 'start',
	targetKey: 'due',
});

function fixture(extra: (vault: FakeVault) => void = () => {}) {
	const vault = new FakeVault();
	vault.addFile('S1.md', { frontmatter: { type: 'Iteration', start: '2026-10-01', due: '2026-10-14' } });
	vault.addFile('S2.md', { frontmatter: { type: 'Iteration', start: '2026-10-15', due: '2026-10-28' } });
	vault.addFile('S3.md', { frontmatter: { type: 'Iteration', start: '2026-10-29', due: '2026-11-11' } });
	vault.addFile('Done.md', { frontmatter: { type: 'PBI', order: 10, status: 'Done', iteration: '[[S1]]' } });
	vault.addFile('Open.md', { frontmatter: { type: 'PBI', order: 20, status: 'Doing', iteration: '[[S1]]' } });
	extra(vault);
	const model = buildModel(vault.app, vault.entries(), settings);
	const at = (path: string) => model.byPath.get(path)!;
	return { model, at };
}

describe('followingIteration', () => {
	it('is the earliest iteration that runs after this one', () => {
		const { model, at } = fixture();
		expect(followingIteration(model.byPath.values(), at('S1.md'), settings)).toBe(at('S2.md'));
		expect(followingIteration(model.byPath.values(), at('S3.md'), settings)).toBeNull();
	});

	it('skips a closed iteration, and offers nothing after an undated one', () => {
		const { model, at } = fixture((vault) => {
			vault.addFile('S0.md', { frontmatter: { type: 'Iteration' } });
			vault.fm('S2.md').status = 'Done';
		});
		expect(isIterationClosed(at('S2.md'), settings)).toBe(true);
		expect(followingIteration(model.byPath.values(), at('S1.md'), settings)).toBe(at('S3.md'));
		expect(followingIteration(model.byPath.values(), at('S0.md'), settings)).toBeNull();
	});
});

describe('iterationCloseWrites', () => {
	it('closes the iteration and moves only the unfinished work, in one batch', () => {
		const { model, at } = fixture();
		const unfinished = unfinishedMembers(
			[...model.byPath.values()].filter((item) => item.iterationEntry?.file?.path === 'S1.md'),
			settings,
		);
		expect(unfinished.map((item) => item.file.path)).toEqual(['Open.md']);
		const writes = iterationCloseWrites(at('S1.md'), unfinished, at('S2.md'), settings, '2026-10-14');
		expect(writes.map((write) => write.file.path)).toEqual(['S1.md', 'Open.md']);
		expect(writes[0].state).toBe('Done');
		expect(writes[1].iteration).toBe(at('S2.md').file);
		expect(writes[1].axis).toEqual({ start: '2026-10-15', target: '2026-10-28' });
	});

	it('closes alone when nothing is carried, and plans nothing with no state property', () => {
		const { at } = fixture();
		expect(iterationCloseWrites(at('S1.md'), [at('Open.md')], null, settings, '2026-10-14')).toHaveLength(1);
		const stateless = { ...settings, stateKey: '' };
		expect(iterationCloseWrites(at('S1.md'), [at('Open.md')], at('S2.md'), stateless, '2026-10-14')).toEqual([]);
	});
});
