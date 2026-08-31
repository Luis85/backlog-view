// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { installObsidianDom } from '../helpers/dom';
import { FakeVault } from '../helpers/vault';
import { Modal } from '../helpers/obsidian-mock';
import { ConfirmOptions, openConfirm } from '../../src/ui/confirmDialog';

installObsidianDom();

beforeEach(() => {
	document.body.empty();
	Modal.forget();
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

	it('says it closed BEFORE the decision runs, so a caller can refocus first', () => {
		// The order is the whole of why `onClosed` exists: a caller that refocuses its own
		// control has to do it before the write, or the redraw that write triggers reads
		// `document.activeElement` and finds the body.
		const opener = document.body.createEl('button');
		let focusedWhenDecided: Element | null = null;
		const modal = open({
			onClosed: () => opener.focus(),
			onConfirm: () => (focusedWhenDecided = document.activeElement),
		});
		btn(modal, '.mod-cta').click();

		expect(focusedWhenDecided).toBe(opener);
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

/**
 * **Narrower than the claim it guards, and the narrow sentence is the honest one** —
 * `rowChrome.test.ts`'s own shape and its own reason: no test here can compute a
 * selector's specificity against Obsidian's stylesheet, since `app.css` is not a
 * dependency, jsdom computes no styles, and the harness draws without asserting (ADR
 * 0020). What is checked is that `styles/modals.css` — the PARTIAL as written, read off
 * disk — still spells this reset at a COMPOUND selector, so a change that lowers it back
 * to a bare class fails here. It would not notice a different Obsidian rule outranking a
 * different declaration.
 *
 * The measurement that found the defect is a headless-Chromium probe on the release
 * harness: `rgb(51, 51, 51)` / `rgb(218, 218, 218)` / an inset ring at the bare class,
 * transparent / `--text-accent` / none once qualified.
 */
describe('a member row does not paint as an Obsidian button', () => {
	const css = readFileSync('styles/modals.css', 'utf8');

	it('resets the chrome at a compound selector', () => {
		// `button.pbl-confirm-link` is (0,1,1) and ties Obsidian's own
		// `button:not(.clickable-icon)`, then wins on source order. A bare
		// `.pbl-confirm-link` is (0,1,0) and loses outright — which is how all three of the
		// declarations below shipped inert.
		const block = css.match(/button\.pbl-confirm-link\s*\{[^}]*\}/);
		expect(block, 'no element-qualified reset for the member row').not.toBeNull();
		expect(block?.[0]).toContain('background-color: transparent');
		expect(block?.[0]).toContain('box-shadow: none');
		expect(block?.[0]).toContain('color: var(--text-accent)');
	});

	it('keeps a focus indicator that does not depend on Obsidian’s ring', () => {
		// The reset declares `box-shadow: none` at (0,1,1), which ties Obsidian's own
		// `button:focus-visible` and wins on order — so without an explicit outline, focus
		// would go invisible on the one control in this dialog that exists to be tabbed to.
		expect(css).toMatch(/\.pbl-confirm-link:focus-visible\s*\{[^}]*outline:/);
	});
});
