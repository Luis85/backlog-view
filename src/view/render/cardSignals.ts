import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { RowContext } from './columns';
import { cardSignals } from '../../domain/iterationDaily';
import { BacklogItem } from '../../domain/model';
import { todayCivil } from '../../domain/noteFields';

/**
 * What an ITERATION card says needs talking about at the stand-up: Blocked, Overdue, its
 * risk and its priority, in that order — and a HORIZON card the same without Overdue
 * (`cardSignalSet` in `view/projection.ts` says which). Text, never controls — nothing here is focusable,
 * and the card's own menu stays the way to change any of it.
 *
 * Risk and priority are the item's own values drawn as data (ADR 0027's 2026-10-18
 * amendment), drawn whenever the note carries one under a configured key rather than only
 * when a declared list names it: a value the note carries is worth saying whether or not the list names it. A
 * context card and a resolved card draw nothing at all — the context-row rule, and a
 * finished item is not a stand-up topic.
 *
 * Cards are rebuilt on every pass (`renderPass` keeps elements only on a tree-shaped
 * projection), so today's date and a prerequisite's state need no `rowSignature` term.
 */
export function renderCardSignals(
	ctx: RowContext,
	card: HTMLElement,
	item: BacklogItem,
	{ overdue }: { overdue: boolean },
): void {
	const signals = cardSignals(item, ctx.host.settings, todayCivil());
	if (!signals) return;
	const blockedBy = signals.blockedBy;
	// The horizon board asks without overdue: a bucket is confidence, not a date.
	const overdueDays = overdue ? signals.overdueDays : 0;
	// Null without a configured key or with a blank value — `readLabel` already asks both.
	const risk = item.riskValue;
	const priority = item.priorityValue;
	if (!blockedBy && overdueDays === 0 && !risk && !priority) return;

	const row = card.createDiv({ cls: 'pbl-card-signals' });
	const add = (kind: string, icon: string, text: string, tooltip?: string) => {
		const el = row.createSpan({ cls: `pbl-signal pbl-signal-${kind}` });
		drawIcon(el.createSpan({ cls: 'pbl-signal-icon' }), icon);
		el.createSpan({ cls: 'pbl-signal-text', text });
		if (tooltip) setTooltip(el, tooltip);
	};
	if (blockedBy) add('blocked', 'lock', t('signal.blocked'), t('signal.blockedBy', { title: blockedBy.title }));
	if (overdueDays > 0) add('overdue', 'clock', t('signal.overdue', { count: overdueDays }));
	if (risk) add('risk', 'triangle-alert', risk, t('signal.risk', { value: risk }));
	if (priority) add('priority', 'arrow-up', priority, t('signal.priority', { value: priority }));
}
