// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { makeEstimationView, selectItem } from '../../helpers/estimation';
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

describe('the Open note control', () => {
	it('sits in the panel header and opens the item the panel is showing', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const openFile = vi.fn();
		(view.app.workspace as unknown as Record<string, unknown>).getLeaf = () => ({ openFile });
		selectItem(containerEl, 'Full.md');
		const btn = containerEl.querySelector('.pbl-est-header button.pbl-est-open') as HTMLElement;
		expect(btn.getAttribute('aria-label')).toBe('Open note');
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(openFile).toHaveBeenCalledWith(view.model?.byPath.get('Full.md')?.file);
	});

	it('opens nothing when the item has left the base since the panel drew', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		const openFile = vi.fn();
		(view.app.workspace as unknown as Record<string, unknown>).getLeaf = () => ({ openFile });
		selectItem(containerEl, 'Full.md');
		const btn = containerEl.querySelector('.pbl-est-header button.pbl-est-open') as HTMLElement;
		// The row is gone from the model the click will resolve against.
		view.model?.byPath.delete('Full.md');
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(openFile).not.toHaveBeenCalled();
	});

	it('writes nothing: the undo slot is exactly as it was', () => {
		const { view, containerEl } = makeEstimationView(fixture(), configuredValues());
		(view.app.workspace as unknown as Record<string, unknown>).getLeaf = () => ({ openFile: vi.fn() });
		selectItem(containerEl, 'Full.md');
		const before = view.gate.canUndo();
		(containerEl.querySelector('.pbl-est-header button.pbl-est-open') as HTMLElement).dispatchEvent(
			new MouseEvent('click', { bubbles: true }),
		);
		expect(view.gate.canUndo()).toBe(before);
	});
});
