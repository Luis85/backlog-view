import { setIcon, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseFigure, ReleaseRow, ReleaseScope, ScopeRow } from '../../domain/releases';
import { displayType } from '../../domain/itemTypes';
import { formatCivil } from '../../domain/timeline';
import { badgeStyleFor } from '../render/badges';
import { guidanceShell } from '../render/emptyStates';
import { drawIcon } from '../render/icons';

/**
 * One release's screen (`docs/requirements/The scope of a release as a tree.md`): the
 * header's facts, and the members drawn as the tree they already are.
 *
 * A free function over the view, `renderIndex.ts`'s own shape, importing the view for its
 * TYPE alone so the pair stays acyclic at runtime.
 *
 * **Its own read-only rows, not `src/view/render/rows.ts`.** That module takes a
 * `BacklogViewHost` and wires menus, create prompts, tag removal and drag into every row —
 * every one of them a write this screen does not offer. What it declines is the SEMANTICS
 * as well as the wiring, which is the part that decision quietly takes on: `role="tree"`,
 * `role="treeitem"` and the three `aria-*` below are carried here rather than inherited,
 * because `--pbl-depth` moves a row sideways and tells assistive technology nothing. A
 * scope drawn with indent alone is announced as a flat list of divs, on the one screen
 * whose whole promise is the shape of the work.
 *
 * **Nothing here writes.** There is no gate to route through and nothing to withhold: the
 * only gesture is the back control, which sets view state.
 *
 * `release` is a parameter rather than `scope.release` read here, because the caller has
 * already ruled on it — a screen is chosen by whether the pick still names a release, and
 * a second null check in here would be an unreachable branch restating that decision.
 */
export function renderScope(view: ReleaseView, scope: ReleaseScope, release: ReleaseRow): void {
	drawHeader(view, scope, release);
	// Both empty states sit BELOW the header, so the back control survives either. A
	// release nobody can read the scope of must not also be a dead end.
	if (view.settings.membershipKey === '') {
		guidanceShell(view.viewEl, 'settings-2', t('release.scope.noMembership.title'), t('release.scope.noMembership.hint'));
		return;
	}
	if (scope.rows.length === 0) {
		guidanceShell(
			view.viewEl,
			'package-open',
			t('release.scope.empty.title', { name: release.name }),
			t('release.scope.empty.hint'),
		);
		return;
	}
	drawTree(view, release, scope.rows);
}

/**
 * The back control, the release's own three figures, and the member count.
 *
 * The count is `scope.members` — the rows this screen kept — rather than the index's own
 * `release.members.value`, which is the same number by the same predicate: reading the one
 * the walk produced is what stops the header claiming a member the tree did not draw. It is
 * withheld entirely when the membership key is unbound, because `0 items` there is an
 * answer this screen cannot read rather than one it read as zero.
 */
function drawHeader(view: ReleaseView, scope: ReleaseScope, release: ReleaseRow): void {
	const headerEl = view.viewEl.createDiv({ cls: 'pbl-rel-header' });

	// A real `<button>`, unlike the index's rows: this header is `display: flex`, so the
	// case that made those a `role="button"` div — `display: contents` on a form control —
	// does not arise. It is the only way off this screen, and a real button is what makes
	// Enter and Space the browser's job rather than a handler somebody has to remember.
	const backEl = headerEl.createEl('button', {
		cls: 'clickable-icon pbl-rel-back',
		attr: { type: 'button', 'aria-label': t('release.scope.back') },
	});
	setIcon(backEl, 'arrow-left');
	setTooltip(backEl, t('release.scope.back'));
	backEl.addEventListener('click', () => view.pick(null));

	headerEl.createEl('h2', { text: release.name });
	drawFigure(headerEl, release.version, (value) => headerEl.createSpan({ cls: 'pbl-rel-version', text: value }));
	drawFigure(headerEl, release.status, (value) => {
		// The tree's read-only chip, like every chip the index draws: this view offers no
		// write, so a chip that lost `pbl-state-static` would gain a hover affordance and the
		// screen would look editable.
		const chipEl = headerEl.createDiv({ cls: 'pbl-state-chip pbl-state-static' });
		chipEl.createSpan({ cls: 'pbl-state-text', text: value });
	});

	const factsEl = headerEl.createDiv({ cls: 'pbl-rel-facts' });
	// An absent target date draws NOTHING here, where the index labels it — deliberately,
	// and the index's own reason is what decides it: that label exists because an undated
	// release is sorted to the bottom of the list and the blank cell would leave the reader
	// no way to explain the row's position. Nothing on this screen is sorted by it.
	drawFigure(factsEl, release.target, (value) => factsEl.createSpan({ cls: 'pbl-rel-target', text: formatCivil(value) }));
	if (!release.members.unconfigured) {
		factsEl.createSpan({ cls: 'pbl-rel-members', text: t('release.scope.members', { count: scope.members }) });
	}
}

/**
 * One of the release's three figures, drawn under the index's own rules so the two screens
 * cannot describe the same release differently: an unbound key is absent, and a bound key
 * holding something no reader will guess at says so rather than reading as unset.
 */
function drawFigure<T>(parentEl: HTMLElement, figure: ReleaseFigure<T>, draw: (value: T) => void): void {
	if (figure.unconfigured) return;
	if (figure.invalid) {
		parentEl.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.index.unreadable') });
		return;
	}
	if (figure.value !== null) draw(figure.value);
}

function drawTree(view: ReleaseView, release: ReleaseRow, rows: ScopeRow[]): void {
	// Named by the release, so a reader arriving at the tree hears which one it is. The
	// name is vault content rather than text — it goes nowhere near the catalog.
	const treeEl = view.viewEl.createDiv({ cls: 'pbl-tree', attr: { role: 'tree', 'aria-label': release.name } });
	const places = siblingPlaces(rows);
	rows.forEach((row, index) => drawRow(treeEl, row, places[index] ?? { pos: 1, count: 1 }));
}

function drawRow(treeEl: HTMLElement, row: ScopeRow, place: { pos: number; count: number }): void {
	const rowEl = treeEl.createDiv({
		cls: 'pbl-row' + (row.context ? ' pbl-rel-context' : ''),
		attr: {
			role: 'treeitem',
			// From 1, over the SCOPE's own depth, which re-roots at the release: a member drawn
			// at top level is level 1 here even where the backlog would call it level 3. That is
			// correct — the tree being announced is this screen's.
			'aria-level': String(row.depth + 1),
			'aria-posinset': String(place.pos),
			'aria-setsize': String(place.count),
			'data-path': row.item.file.path,
		},
	});
	// `aria-selected` and `aria-expanded` are deliberately absent, and for the reason that
	// made this view read-only: this screen has no selection and offers no collapse — every
	// member is drawn, always — so either would announce an interaction that does not exist.
	rowEl.setCssProps({ '--pbl-depth': String(row.depth) });

	const badgeText = displayType(row.item);
	if (badgeText) {
		const style = badgeStyleFor(badgeText);
		const badgeEl = rowEl.createSpan({ cls: 'pbl-badge' });
		if (style.icon) drawIcon(badgeEl.createSpan({ cls: 'pbl-badge-icon' }), style.icon);
		badgeEl.addClass(style.badge);
		badgeEl.createSpan({ cls: 'pbl-badge-text', text: badgeText });
	}

	const titleEl = rowEl.createSpan({ cls: 'pbl-title', text: row.item.title });
	// Unconditionally, and nothing measures whether it was needed — the tree's own rule:
	// deciding costs a layout read per row.
	setTooltip(titleEl, row.item.title);

	if (!row.context) return;
	// The tree's marker STYLING with a different sentence, because a different fact is being
	// stated. `row.contextMarker` says a row is outside the base's filter, which is false of
	// every row here: `releaseScope` skips an `outsideFilter` ancestor outright, so a context
	// row on this screen is in the base and is merely not a member of this release.
	const markerEl = rowEl.createSpan({
		cls: 'pbl-outside-marker',
		attr: { 'aria-label': t('release.scope.contextMarker') },
	});
	drawIcon(markerEl, 'corner-left-down');
	setTooltip(markerEl, t('release.scope.contextMarker'));
}

/**
 * Each row's position among its SIBLINGS at its own level, never its index in the flat row
 * list — which would announce a three-row scope as one list of three and defeat the point
 * of drawing a tree.
 *
 * `scope.rows` is a pre-order walk carrying its own depth, so a group of siblings is the
 * run of rows at one depth that no shallower row has interrupted: a row shallower than an
 * open group closes it, and the next row at that depth starts a new one under a new parent.
 * Each entry holds the group it joined, so `count` is read after the whole walk rather than
 * guessed while it is still growing.
 */
function siblingPlaces(rows: ScopeRow[]): { pos: number; count: number }[] {
	const open = new Map<number, number[]>();
	const joined = rows.map((row) => {
		for (const depth of [...open.keys()]) if (depth > row.depth) open.delete(depth);
		const group = open.get(row.depth) ?? [];
		open.set(row.depth, group);
		group.push(group.length + 1);
		return { pos: group.length, group };
	});
	return joined.map(({ pos, group }) => ({ pos, count: group.length }));
}
