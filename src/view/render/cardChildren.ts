import { setTooltip } from 'obsidian';
import { t } from '../../i18n/t';
import { drawIcon } from './icons';
import { RowContext } from './columns';
import { renderBadge, renderTitleText } from './rows';
import { BacklogViewHost } from '../host';
import { uniqueElementId } from '../selection';
import { BacklogItem } from '../../domain/model';
import { childrenLabel, listedChildren } from '../childrenList';
import { projectionMember } from '../projection';
import { ownWorkflowReading } from '../../domain/board';

/**
 * One level of the tree, on the card. A rollup says three of eight are done and never
 * which three; this says which — and stops there, because a card that nested would be
 * a board inside a board.
 */

/**
 * The disclosure, and the list when it is open. Nothing here writes frontmatter — that
 * is what makes the context-row rule hold by construction rather than by a check, so a
 * context card gets this like any other card.
 */
export function renderCardChildren(ctx: RowContext, card: HTMLElement, item: BacklogItem): void {
	// Annotated rather than inferred from `ctx.host` so fallow can see which host
	// members this file uses — it resolves interface members through an explicit type
	// and not through a property access. See the root CLAUDE.md.
	const host: BacklogViewHost = ctx.host;
	const children = listedChildren(host, item);
	// A card whose children have all hidden draws no chevron, exactly as such a row
	// renders as a leaf: a disclosure opening onto nothing is a lie.
	if (children.length === 0) return;
	ctx.cardKids.add(item.file.path);

	const wrap = card.createDiv({ cls: 'pbl-card-kids' });
	// Toggle first, list second — DOM order IS reading order, so the count is met
	// before the items it counts. Both ids are minted rather than derived: these
	// attributes resolve across the whole document, and two saved views can sit in
	// split panes.
	const toggle = wrap.createEl('button', {
		cls: 'pbl-card-kids-toggle',
		attr: { type: 'button', tabindex: '-1' },
	});
	toggle.id = uniqueElementId('pbl-card-kids-toggle');
	const list = wrap.createEl('ul', { cls: 'pbl-card-kids-list' });
	list.id = uniqueElementId('pbl-card-kids');
	toggle.setAttribute('aria-controls', list.id);
	// The list is NAMED by the toggle, not merely controlled by it. `aria-controls`
	// says the two are related and nothing about what the list holds, so a reader
	// arriving straight at the list would get no count and no context; `aria-labelledby`
	// is what makes it announce "3 features" before its items.
	list.setAttribute('aria-labelledby', toggle.id);
	const chevron = toggle.createSpan({ cls: 'pbl-card-kids-chevron' });
	drawIcon(chevron, 'chevron-right');
	toggle.createSpan({ cls: 'pbl-card-kids-count', text: childrenLabel(children) });
	// The quick filter OVERRIDES collapse state without replacing it: `isCardCollapsed`
	// returns false while it runs, but `setCardCollapsed` still writes. A live toggle would
	// therefore write state that reads back as expanded, look inert, and then take
	// effect once the filter cleared. Same real `disabled` flag the toolbar's collapse
	// controls take, for the same reason — `pointer-events: none` stops a mouse and
	// nothing else.
	toggle.disabled = host.isFiltering();

	// The disclosure counts what it LISTS and the rollup beside it counts everything
	// beneath, so with completed work hidden the two disagree on purpose. Said out loud
	// only when it is true, and only in the one place a user can ask: two numbers
	// differing with nothing to explain them reads as broken data, and a permanent
	// caveat on every card reads as noise.
	//
	// The denominator is the children this projection DRAWS, never `item.children` raw:
	// `projectionMember` answers membership alone, while `isRowHidden` — what
	// `listedChildren` filters by — conflates it with the completed toggle and the quick
	// filter. Subtracting the second from the first counted a catalog child as a plan row
	// the view was choosing to hide, and this note says exactly that. Absent from this
	// ladder is not hidden by this view.
	const drawn = item.children.filter(projectionMember(host.projection, host.effectiveScope));
	const omitted = drawn.length - children.length;
	const note = omitted > 0 ? ` — ${t('card.hiddenChildren', { count: omitted })}` : '';

	const draw = (): void => {
		// Read live, never captured at wire time: a surrounding refresh can change this
		// under a listener that is still attached.
		const collapsed = host.isCardCollapsed(item.file.path);
		toggle.setAttribute('aria-expanded', String(!collapsed));
		chevron.toggleClass('pbl-expanded', !collapsed);
		setTooltip(toggle, (collapsed ? `Show what is under "${item.title}"` : 'Hide these') + note);
		list.empty();
		if (collapsed) return;
		for (const child of children) renderChildEntry(host, list, child);
	};

	toggle.addEventListener('click', (evt) => {
		// The card listens on itself. Without this the note opens AND the card expands
		// underneath it, so a broken toggle looks like a working one — even while the
		// toggle itself is `disabled`, since a click on the chevron or count span inside
		// it still reaches this listener in a real browser (and in jsdom).
		// `disabled` alone does not stop a click that lands on a CHILD element (the
		// chevron/count spans) from bubbling to this listener. Mutating here while the
		// quick filter runs would write collapse state that `isCollapsed` reports as
		// false until the filter clears — a silent write with no visible effect.
		if (toggle.disabled) return;
		host.setCardCollapsed(item.file.path, !host.isCardCollapsed(item.file.path));
		draw();
	});
	draw();
}

function renderChildEntry(host: BacklogViewHost, list: HTMLElement, child: BacklogItem): void {
	const li = list.createEl('li');
	const entry = li.createEl('button', {
		// The child's OWN workflow, never `child.done` — a Deliverable is offered as a child
		// under an Epic, a Feature and a PBI, and it is tracked by its own states
		// everywhere else it appears. `ownWorkflowReading` is that rule stated once.
		cls: 'pbl-card-kid' + (ownWorkflowReading(child).done ? ' pbl-done' : ''),
		attr: { type: 'button', tabindex: '-1' },
	});
	renderBadge(host, entry, child);
	// Through `renderTitleText`, so a quick-filter match highlights here exactly as it
	// does in a row or a card title.
	renderTitleText(host, entry.createSpan({ cls: 'pbl-card-kid-title' }), child.title);
	setTooltip(entry, `Open "${child.title}"`);
	entry.addEventListener('click', (evt) => host.openItem(child, evt));
	entry.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) host.openItemIn(child, 'tab');
	});
}
