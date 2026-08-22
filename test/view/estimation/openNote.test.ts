// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { makeEstimationView } from '../../helpers/estimation';
import { configuredValues } from '../../helpers/estimationModel';
import { FakeVault } from '../../helpers/vault';

function fixture(): FakeVault {
	const vault = new FakeVault();
	vault.addFile('Full.md', { frontmatter: { 'strategic-alignment': 5, confidence: 4, effort: 2 } });
	return vault;
}

describe('opening the note being scored', () => {
	it('defaults to opening beside the view, not over it', () => {
		const { view } = makeEstimationView(fixture(), configuredValues());
		expect(view.settings.openIn).toBe('split');
	});

	it('honours a target the reader named', () => {
		const { view } = makeEstimationView(fixture(), configuredValues({ openIn: 'tab' }));
		expect(view.settings.openIn).toBe('tab');
	});

	it('opens the item it was given', () => {
		const { view } = makeEstimationView(fixture(), configuredValues({ openIn: 'tab' }));
		const openFile = vi.fn();
		(view.app.workspace as unknown as Record<string, unknown>).getLeaf = () => ({ openFile });
		const item = view.model?.byPath.get('Full.md');
		view.openNote(item!, new MouseEvent('click'));
		expect(openFile).toHaveBeenCalledWith(item!.file);
	});
});
