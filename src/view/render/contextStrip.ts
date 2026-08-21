import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { createCard, renderCardBody, wireCardActivation } from './board';
import { RowContext } from './columns';
import { BacklogItem } from '../../domain/model';

/**
 * The strip beside the shelf, and only that. It left `render/shelf.ts` when the shelf grew
 * its layout pick and its own resize grip: the two bands share a header CLASS and nothing
 * else — this one is never sorted, filtered, searched, folded, resized or dropped on, and
 * a file holding both was one file answering for two different sets of rules.
 */

/**
 * Context rows with no place on the axis — a focused item outside the filter
 * whose value names no existing bucket, or whose own dates never place it. They
 * stand beside the shelf, apart from its count: a context row is not a result,
 * and the shelf is a statement about the results. Never grouped, sorted or
 * filtered: the context-row rule (never a ranking peer, never a source of
 * anything derived from the results) applies here exactly as everywhere else.
 */
export function renderContextStrip(
	ctx: RowContext,
	frameEl: HTMLElement,
	context: BacklogItem[],
): { cards: BacklogItem[]; el: HTMLElement | null } {
	if (context.length === 0) return { cards: [], el: null };
	const stripEl = frameEl.createDiv({ cls: 'pbl-roadmap-context', attr: { role: 'group', 'aria-label': t('shelf.context') } });
	const header = stripEl.createDiv({ cls: 'pbl-shelf-header' });
	drawIcon(header.createSpan({ cls: 'pbl-shelf-icon' }), 'corner-left-down');
	header.createSpan({ cls: 'pbl-shelf-name', text: t('shelf.context') });
	setTooltip(header, t('shelf.contextTooltip'));
	const cardsEl = stripEl.createDiv({ cls: 'pbl-shelf-cards' });
	for (const item of context) {
		const card = createCard(ctx, cardsEl, item);
		renderCardBody(ctx, card, item);
		ctx.placed.add(item.file.path);
		wireCardActivation(ctx, card, item);
	}
	return { cards: context, el: stripEl };
}
