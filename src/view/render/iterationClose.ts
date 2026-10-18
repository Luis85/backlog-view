import { Notice } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { BacklogItem } from '../../domain/model';
import { BacklogSettings } from '../../domain/settings';
import { followingIteration, isIterationClosed, iterationCloseWrites, unfinishedMembers } from '../../domain/iterations';
import { todayStamp } from '../../domain/noteFields';
import { openConfirm } from '../../ui/confirmDialog';

/**
 * The iteration header's close control: a button while the sprint is open, a static
 * "Closed" mark once its own state is done, and nothing at all with no state property or
 * no done value — there is no state to close with.
 *
 * Chrome like the mode switch beside it, so the button is an ordinary tab stop.
 */
export function renderIterationClose(
	host: BacklogViewHost,
	titlebar: HTMLElement,
	boardEl: HTMLElement,
	iteration: BacklogItem,
	population: BacklogItem[],
): void {
	const settings = host.settings;
	if (!settings.stateKey || settings.doneValues.length === 0) return;
	if (isIterationClosed(iteration, settings)) {
		titlebar.createSpan({ cls: 'pbl-iteration-closed', text: t('iteration.closed') });
		return;
	}
	const btn = titlebar.createEl('button', {
		cls: 'pbl-iteration-close',
		text: t('iteration.close'),
		attr: { type: 'button' },
	});
	btn.addEventListener('click', () => askThenClose(host, boardEl, { iteration, population, settings }));
}

/** What the reader saw at the press. The batch is planned from it, never from the live view. */
interface Pressed {
	iteration: BacklogItem;
	population: BacklogItem[];
	settings: BacklogSettings;
}

/**
 * Everything the dialog shows is captured at the PRESS: the refresh a write ends with
 * rebuilds the model, and what the reader confirms is what the screen showed them.
 */
function askThenClose(host: BacklogViewHost, boardEl: HTMLElement, pressed: Pressed): void {
	const { iteration, settings } = pressed;
	const unfinished = unfinishedMembers(pressed.population, settings);
	const next = host.model ? followingIteration(host.model.byPath.values(), iteration, settings) : null;
	const carry = next !== null && unfinished.length > 0 ? next : null;
	const close = (moveTo: BacklogItem | null) => () =>
		void submit(host, boardEl, { ...pressed, population: unfinished }, moveTo);
	openConfirm(host.app, {
		title: t('iteration.closeTitle', { name: iteration.title }),
		message:
			unfinished.length === 0
				? t('iteration.closeAllDone')
				: t('iteration.closeUnfinished', { count: unfinished.length }),
		note: unfinished.length > 0 && next === null ? t('iteration.closeNoNext') : undefined,
		links: unfinished.map((item) => ({ label: item.title, open: () => host.openItemIn(item, 'tab') })),
		cta: carry ? t('iteration.closeAndMove', { next: carry.title }) : t('iteration.close'),
		onConfirm: close(carry),
		alternative: carry ? { cta: t('iteration.closeOnly'), onConfirm: close(null) } : undefined,
		onClosed: () => focusAfterDialog(boardEl),
	});
}

/**
 * Back on a control on every way out — before the write, so its redraw finds focus in the
 * header, and again after it, because a close replaces its own button with the Closed
 * mark. QUERIED rather than captured: a redraw while the dialog is up detaches the button.
 */
function focusAfterDialog(boardEl: HTMLElement): void {
	for (const selector of ['.pbl-iteration-close', '.pbl-iteration-mode button[aria-pressed="true"]']) {
		const el = boardEl.querySelector<HTMLElement>(selector);
		if (el !== null) {
			el.focus();
			return;
		}
	}
}

/** `pressed.population` is the UNFINISHED members here — the ones a carry would move. */
async function submit(
	host: BacklogViewHost,
	boardEl: HTMLElement,
	pressed: Pressed,
	next: BacklogItem | null,
): Promise<void> {
	const { iteration, population: unfinished, settings } = pressed;
	const outcome = await host.applySafely(iterationCloseWrites(iteration, unfinished, next, settings, todayStamp()));
	focusAfterDialog(boardEl);
	if (outcome === null) return;
	const name = iteration.title;
	new Notice(
		next === null
			? t('iteration.closedNotice', { name })
			: t('iteration.closedMovedNotice', { name, count: unfinished.length, next: next.title }),
	);
}
