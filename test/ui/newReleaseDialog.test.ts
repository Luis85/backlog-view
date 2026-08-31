// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { NewReleaseResult, openNewReleaseDialog, ReleaseFieldId } from '../../src/ui/newReleaseDialog';

installObsidianDom();

beforeEach(() => {
	document.body.empty();
	Modal.forget();
});

/**
 * Opens the dialog and returns the DOM handles a test needs. The mock's `Modal` does not
 * attach anything to `document` — `manualDialog.test.ts`'s own note — so the content is
 * read off `contentEl` via `Modal.lastOpened`, the same shape that file uses.
 */
function openDialog(fields: ReleaseFieldId[] = []) {
	const vault = new FakeVault();
	const results: NewReleaseResult[] = [];
	openNewReleaseDialog(vault.app as never, fields, (result) => results.push(result));
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('no dialog opened');
	const el = modal.contentEl;
	const inputs = Array.from(el.querySelectorAll('input')) as HTMLInputElement[];
	const createBtn = el.querySelector('.mod-cta') as HTMLButtonElement | null;
	if (!createBtn) throw new Error('create button missing');
	return { results, inputs, createBtn, el };
}

const fieldNames = (dlg: ReturnType<typeof openDialog>): string[] =>
	Array.from(dlg.el.querySelectorAll('.setting-item-name')).map((n) => n.textContent ?? '');

const canConfirm = (dlg: ReturnType<typeof openDialog>): boolean => !dlg.createBtn.disabled;

function type(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('the new-release dialog', () => {
	it('offers exactly the fields it was asked for, in order', () => {
		const dlg = openDialog(['version', 'status']);
		expect(fieldNames(dlg)).toEqual(['Title', 'Version', 'Status']);
	});

	it('offers the title alone when asked for no optional fields', () => {
		const dlg = openDialog([]);
		expect(fieldNames(dlg)).toEqual(['Title']);
	});

	it('refuses to confirm without a title', () => {
		const dlg = openDialog([]);
		expect(canConfirm(dlg)).toBe(false);
	});

	it('enables confirm once a title is entered, and disables it again once cleared', () => {
		const dlg = openDialog([]);
		type(dlg.inputs[0], 'Sprint 12');
		expect(canConfirm(dlg)).toBe(true);
		type(dlg.inputs[0], '   ');
		expect(canConfirm(dlg)).toBe(false);
	});

	it('submits the trimmed title alone when no optional fields were requested', () => {
		const dlg = openDialog([]);
		type(dlg.inputs[0], '  2.4  ');
		dlg.createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(dlg.results).toEqual([{ title: '2.4' }]);
	});

	it('submits every requested field, and only the requested fields', () => {
		const dlg = openDialog(['version', 'targetDate', 'status']);
		type(dlg.inputs[0], '2.4');
		type(dlg.inputs[1], '2.4.0');
		type(dlg.inputs[2], '2026-09-12');
		type(dlg.inputs[3], 'Planned');
		dlg.createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(dlg.results).toEqual([
			{ title: '2.4', version: '2.4.0', targetDate: '2026-09-12', status: 'Planned' },
		]);
	});

	it('does not submit an empty title', () => {
		const dlg = openDialog([]);
		dlg.createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(dlg.results).toHaveLength(0);
	});

	it('closes without submitting when cancel is clicked, and tells the caller it closed', () => {
		const vault = new FakeVault();
		const results: NewReleaseResult[] = [];
		let closed = 0;
		openNewReleaseDialog(
			vault.app as never,
			[],
			(result) => results.push(result),
			() => (closed += 1),
		);
		const modal = Modal.lastOpened;
		if (!modal) throw new Error('no dialog opened');
		type(modal.contentEl.querySelectorAll('input')[0] as HTMLInputElement, 'Ignored');
		const buttons = Array.from(modal.contentEl.querySelectorAll('button'));
		const cancelBtn = buttons.find((b) => !b.hasClass('mod-cta'));
		if (!cancelBtn) throw new Error('cancel button missing');
		cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(results).toHaveLength(0);
		expect(closed).toBe(1);
	});
});
