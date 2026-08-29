// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { ConfirmOptions, openConfirm } from '../../src/ui/confirmDialog';

installObsidianDom();

beforeEach(() => {
	document.body.empty();
	Modal.lastOpened = null;
});

function open(options: Partial<ConfirmOptions> & { onConfirm: () => void }) {
	const vault = new FakeVault();
	openConfirm(vault.app as never, {
		title: 'Release 0.9?',
		message: '2 members are not finished',
		cta: 'Release',
		...options,
	});
	const modal = Modal.lastOpened;
	if (!modal) throw new Error('no dialog opened');
	return modal;
}

const btn = (modal: Modal, selector: string): HTMLElement => {
	const found = modal.contentEl.querySelector<HTMLElement>(selector);
	if (!found) throw new Error(`no ${selector}`);
	return found;
};

describe('the confirm dialog', () => {
	it('confirms, and opens a listed row without deciding anything', () => {
		const opened: string[] = [];
		let decided: string | null = null;
		const modal = open({
			links: [{ label: 'A', open: () => opened.push('A') }],
			onConfirm: () => (decided = 'confirm'),
			onCancel: () => (decided = 'cancel'),
		});

		// Opening a row is navigation, not a decision: the dialog stays, nothing is decided.
		btn(modal, '.pbl-confirm-link').click();
		expect(opened).toEqual(['A']);
		expect(decided).toBeNull();

		btn(modal, '.mod-cta').click();
		expect(decided).toBe('confirm');
	});

	it('cancels on the cancel button', () => {
		let decided: string | null = null;
		const modal = open({ onConfirm: () => (decided = 'confirm'), onCancel: () => (decided = 'cancel') });
		btn(modal, '.pbl-confirm-cancel').click();
		expect(decided).toBe('cancel');
	});

	it('cancels when the dialog is closed any other way', () => {
		// The escape key and the close box reach `close()` without any button — one meaning
		// for three ways out, which is why the decision is made in `onClose` and not in a
		// handler beside each button.
		let decided: string | null = null;
		const modal = open({ onConfirm: () => (decided = 'confirm'), onCancel: () => (decided = 'cancel') });
		modal.close();
		expect(decided).toBe('cancel');
	});

	it('closes without a cancel handler, and never confirms by accident', () => {
		let confirmed = false;
		const modal = open({ onConfirm: () => (confirmed = true) });
		modal.close();
		expect(confirmed).toBe(false);
	});

	it('draws no list at all when there is nothing to open', () => {
		const modal = open({ onConfirm: () => undefined });
		expect(modal.contentEl.querySelectorAll('.pbl-confirm-link')).toHaveLength(0);
	});

	it('titles the dialog and says what it is asking about', () => {
		const modal = open({ onConfirm: () => undefined });
		expect(modal.titleEl.textContent).toBe('Release 0.9?');
		expect(btn(modal, '.pbl-confirm-message').textContent).toBe('2 members are not finished');
	});
});
