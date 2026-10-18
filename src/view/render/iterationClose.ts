import { Notice } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { BacklogItem, iterationResults } from '../../domain/model';
import { statedEnds } from '../../domain/bars';
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
): void {
	const settings = host.settings;
	if (!settings.stateKey || settings.doneValues.length === 0) return;
	if (isIterationClosed(iteration, settings)) {
		// Focusable by script alone, so the close can land focus on the mark that says what
		// happened rather than on a mode button that says nothing about it.
		titlebar.createSpan({ cls: 'pbl-iteration-closed', text: t('iteration.closed'), attr: { tabindex: '-1' } });
		return;
	}
	const btn = titlebar.createEl('button', {
		cls: 'pbl-iteration-close',
		text: t('iteration.close'),
		attr: { type: 'button' },
	});
	btn.addEventListener('click', () => askThenClose(host, boardEl, iteration.file.path));
}

/** The members still unfinished, read off the model as it is NOW. */
function unfinishedNow(host: BacklogViewHost, path: string): BacklogItem[] {
	return host.model ? unfinishedMembers(iterationResults(host.model, path), host.settings) : [];
}

/** Why the carry has no target: no later sprint, or no end date to be later than. */
function noNextNote(iteration: BacklogItem): string {
	return statedEnds(iteration).target.value === null ? t('iteration.closeNoEnd') : t('iteration.closeNoNext');
}

/**
 * Everything the dialog shows is read at the PRESS, and the confirm re-reads it: what the
 * reader agreed to is what the screen showed them, so a change underneath — a member
 * finished or added by a sync while the dialog is up — refuses rather than writing a
 * carry nobody saw.
 */
function askThenClose(host: BacklogViewHost, boardEl: HTMLElement, path: string): void {
	const iteration = host.model?.byPath.get(path);
	if (!iteration) return;
	const settings = host.settings;
	const population = host.model ? iterationResults(host.model, path).filter((item) => !item.outsideFilter) : [];
	const unfinished = unfinishedMembers(population, settings);
	const next = host.model ? followingIteration(host.model.byPath.values(), iteration, settings) : null;
	const carry = next !== null && unfinished.length > 0 ? next : null;
	const seen = unfinished.map((item) => item.file.path).join('\n');
	const close = (moveTo: BacklogItem | null) => () => {
		if (unfinishedNow(host, path).map((item) => item.file.path).join('\n') !== seen) {
			new Notice(t('iteration.closeChanged'));
			return;
		}
		void submit(host, boardEl, { iteration, unfinished, next: moveTo });
	};
	openConfirm(host.app, {
		title: t('iteration.closeTitle', { name: iteration.title }),
		message: closeMessage(population.length, unfinished.length),
		note: unfinished.length > 0 && next === null ? noNextNote(iteration) : undefined,
		links: unfinished.map((item) => ({ label: item.title, open: () => host.openItemIn(item, 'tab') })),
		cta: carry ? t('iteration.closeAndMove', { count: unfinished.length, next: carry.title }) : t('iteration.close'),
		onConfirm: close(carry),
		alternative: carry ? { cta: t('iteration.closeOnly'), onConfirm: close(null) } : undefined,
		onClosed: () => focusAfterDialog(boardEl),
	});
}

/** Three answers: nothing committed, everything resolved, or how much is left of how much. */
function closeMessage(total: number, unfinished: number): string {
	if (total === 0) return t('iteration.closeEmpty');
	if (unfinished === 0) return t('iteration.closeAllDone');
	return t('iteration.closeUnfinished', { count: unfinished, total });
}

/**
 * Back on a control on every way out — before the write, so its redraw finds focus in the
 * header, and again after it, when a close has replaced its own button with the Closed
 * mark. QUERIED rather than captured: a redraw while the dialog is up detaches the button.
 * The mode button is the last resort, for a close whose base filter took the iteration
 * out of its results and so drew no mark.
 */
function focusAfterDialog(boardEl: HTMLElement): void {
	const selectors = ['.pbl-iteration-close', '.pbl-iteration-closed', '.pbl-iteration-mode button[aria-pressed="true"]'];
	for (const selector of selectors) {
		const el = boardEl.querySelector<HTMLElement>(selector);
		if (el !== null) {
			el.focus();
			return;
		}
	}
}

async function submit(
	host: BacklogViewHost,
	boardEl: HTMLElement,
	plan: { iteration: BacklogItem; unfinished: BacklogItem[]; next: BacklogItem | null },
): Promise<void> {
	const { iteration, unfinished, next } = plan;
	const outcome = await host.applySafely(iterationCloseWrites(iteration, unfinished, next, host.settings, todayStamp()));
	focusAfterDialog(boardEl);
	if (outcome === null || !outcome.changed) return;
	const name = iteration.title;
	new Notice(
		next === null
			? t('iteration.closedNotice', { name })
			: t('iteration.closedMovedNotice', { name, count: unfinished.length, next: next.title }),
	);
}
