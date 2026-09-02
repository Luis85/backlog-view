import { setTooltip } from 'obsidian';
import { formatNumber, t } from '../../i18n/t';
import { drawIcon } from './icons';
import { RowContext } from './columns';
import { renderBadge } from './rows';
import { BacklogViewHost } from '../host';
import { uniqueElementId } from '../selection';
import { BacklogItem } from '../../domain/model';
import { childrenLabel, drawnChildren, listedChildren } from '../childrenList';
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
export function renderCardChildren(
	ctx: RowContext,
	card: HTMLElement,
	item: BacklogItem,
	// Where the DISCLOSURE goes when that is not the wrapper — `renderCardBody`'s own
	// `kidsEl` in the mirror. The shelf's compact row is the one caller: its summary is the
	// line, so the toggle belongs ON it while the list stays beneath, and a row with no
	// children still reserves the slot so the badges keep one x. A card passes nothing and
	// is unchanged: it stacks, so its disclosure belongs with its list.
	{ toggleEl }: { toggleEl?: HTMLElement } = {},
): void {
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
	// before the items it counts. That still holds when the toggle is lifted onto the line: the
	// summary precedes the wrapper inside the card. Both ids are minted rather than derived:
	// these attributes resolve across the whole document, and two saved views can sit in
	// split panes.
	const toggle = (toggleEl ?? wrap).createEl('button', {
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
	// The slot on a compact row has room for a number and not for a sentence. The sentence is
	// what the LIST is named by — `aria-labelledby` points at this toggle — so it moves to
	// the toggle's own `aria-label` rather than being dropped, and a reader who cannot see the
	// slot hears exactly what they heard before. In the wrapper it stays the visible text and
	// no `aria-label` is written, because an accessible name derived from content is the one
	// that cannot drift from what is on screen.
	const label = childrenLabel(children);
	const onLine = toggleEl !== undefined;
	toggle.createSpan({ cls: 'pbl-card-kids-count', text: onLine ? formatNumber(children.length) : label });
	if (onLine) toggle.setAttribute('aria-label', label);
	// The disclosure counts what it LISTS and the rollup beside it counts everything
	// beneath, so with completed work hidden the two disagree on purpose. Said out loud
	// only when it is true, and only in the one place a user can ask: two numbers
	// differing with nothing to explain them reads as broken data, and a permanent
	// caveat on every card reads as noise.
	//
	// The denominator is the children this projection DRAWS, never `item.children` raw:
	// `drawnChildren` answers membership alone, while `isRowHidden` — what
	// `listedChildren` subtracts — conflates it with the completed toggle. Subtracting the
	// second from the first counted a catalog child as a plan row the view was choosing to
	// hide, and this note says exactly that. Absent from this ladder is not hidden by this
	// view, and a third question added to `isRowHidden` would put the two back out of step.
	//
	// It is the SAME walk `listedChildren` starts from, so the two agree about the level of
	// the tree they are counting: a row this projection does not draw is traversed through
	// on both sides. A one-level `filter` beside a descending list is a subtraction between
	// two different populations, which is the shape this comment already warns about.
	const drawn = drawnChildren(host, item);
	const omitted = drawn.length - children.length;
	// Four whole sentences rather than a phrase plus a note joined with an em dash: the
	// dash and the clause after it are English punctuation and English grammar, and a
	// locale that leads with the count, or that punctuates an aside differently, cannot
	// reach either half through a `+` at this call site.
	const tooltip = (collapsed: boolean): string => {
		if (omitted <= 0) return collapsed ? t('card.showChildren', { title: item.title }) : t('card.hideChildren');
		return collapsed
			? t('card.showChildrenHiding', { title: item.title, count: omitted })
			: t('card.hideChildrenHiding', { count: omitted });
	};

	const draw = (): void => {
		// Read live, never captured at wire time: a surrounding refresh can change this
		// under a listener that is still attached.
		const collapsed = host.isCardCollapsed(item.file.path);
		toggle.setAttribute('aria-expanded', String(!collapsed));
		chevron.toggleClass('pbl-expanded', !collapsed);
		// The wrapper says whether it is shut, because a stylesheet cannot ask. On a compact
		// row the wrapper is the indent block: shut, it would still draw its padding and one
		// of the card's flex gaps, making a shut parent taller than a leaf and drawing an
		// indent guide with nothing beneath it. `.pbl-card-kids-list:empty` hides the list and
		// says nothing about the box around it.
		wrap.toggleClass('pbl-card-kids-shut', collapsed);
		setTooltip(toggle, tooltip(collapsed));
		list.empty();
		if (collapsed) return;
		for (const child of children) renderChildEntry(host, list, child);
	};

	toggle.addEventListener('click', (evt) => {
		// The card listens on itself. Without this the note opens AND the card expands
		// underneath it, so a broken toggle looks like a working one.
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
	entry.createSpan({ cls: 'pbl-card-kid-title', text: child.title });
	setTooltip(entry, t('card.openChild', { title: child.title }));
	entry.addEventListener('click', (evt) => host.openItem(child, evt));
	entry.addEventListener('auxclick', (evt) => {
		if (evt.button === 1) host.openItemIn(child, 'tab');
	});
}
