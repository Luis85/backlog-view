import { setIcon, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseFigure, ReleaseRow, ReleaseScope, ScopeRow } from '../../domain/releases';
import { displayType } from '../../domain/itemTypes';
import { formatCivil } from '../../domain/timeline';
import { badgeStyleFor } from '../render/badges';
import { guidanceShell } from '../render/emptyStates';
import { drawIcon } from '../render/icons';
import { renderReleaseInit } from './initControl';

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
 * **Nothing here writes a note.** There is no gate to route through and nothing to
 * withhold: the back control sets view state, and the `noMembership` empty state's own ✨
 * ({@link renderReleaseInit}) only binds this view's own config — see that function for
 * why it writes no note either.
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
		const empty = guidanceShell(
			view.viewEl,
			'settings-2',
			t('release.scope.noMembership.title'),
			t('release.scope.noMembership.hint'),
		);
		// The one screen that names an option and, until now, offered no way to set it.
		// `fixes` names that ONE option: `renderReleaseInit` would otherwise draw this
		// button for an untouched `versionProperty` too, which fixes nothing this state is
		// about — see its own comment.
		renderReleaseInit(view, empty, 'empty', ['membershipProperty']);
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
 * Two lines: the back control and the release's own three figures, then the summary
 * strip beneath them — `.pbl-rel-hline` for the first, `.pbl-rel-summary` for the second,
 * which is what lets `styles/releaseScope.css` stack them without either line's own flex
 * rules fighting the other's.
 */
function drawHeader(view: ReleaseView, scope: ReleaseScope, release: ReleaseRow): void {
	const headerEl = view.viewEl.createDiv({ cls: 'pbl-rel-header' });
	const hlineEl = headerEl.createDiv({ cls: 'pbl-rel-hline' });

	// A real `<button>`, like the index's rows: it is the only way off this screen, and a
	// real button is what makes the tab stop, Enter and Space the browser's job rather than
	// a handler somebody has to remember.
	const backEl = hlineEl.createEl('button', {
		cls: 'clickable-icon pbl-rel-back',
		attr: { type: 'button', 'aria-label': t('release.scope.back') },
	});
	setIcon(backEl, 'arrow-left');
	setTooltip(backEl, t('release.scope.back'));
	backEl.addEventListener('click', () => view.pick(null));

	hlineEl.createEl('h2', { text: release.name });
	drawFigure(hlineEl, release.version, t('release.index.column.version'), (value) =>
		hlineEl.createSpan({ cls: 'pbl-rel-version', text: value }),
	);
	drawFigure(hlineEl, release.status, t('release.index.column.status'), (value) => {
		// The tree's read-only chip, like every chip the index draws: this view offers no
		// write, so a chip that lost `pbl-state-static` would gain a hover affordance and the
		// screen would look editable.
		const chipEl = hlineEl.createDiv({ cls: 'pbl-state-chip pbl-state-static' });
		chipEl.createSpan({ cls: 'pbl-state-text', text: value });
	});

	const factsEl = hlineEl.createDiv({ cls: 'pbl-rel-facts' });
	// An absent target date draws NOTHING here, where the index labels it — deliberately,
	// and the index's own reason is what decides it: that label exists because an undated
	// release is sorted to the bottom of the list and the blank cell would leave the reader
	// no way to explain the row's position. Nothing on this screen is sorted by it.
	drawFigure(factsEl, release.target, t('release.index.column.target'), (value) =>
		factsEl.createSpan({ cls: 'pbl-rel-target', text: formatCivil(value) }),
	);

	drawSummary(headerEl, release, scope.members);
}

/**
 * The summary strip: one bar, one percentage, one sentence — drawn from the SAME
 * `ReleaseRow` the index band was drawn from.
 *
 * **Nothing is derived here.** `domain/releases.ts` states the rule in its own words —
 * progress "is computed nowhere else — the single-release screen reads the same row,
 * which is what stops a band and a release header disagreeing about one release". A
 * second count over the same members would be a second opinion about a number that has
 * one right answer.
 *
 * The sentence itself reuses `column.rollupTooltip` rather than a release-specific key —
 * that key's own catalog comment already explains why the index's OWN band reused it
 * instead of minting one with `{total}`: `selectForm` picks the plural form off a
 * parameter literally named `count`, so a key spelling `{total}` could never select
 * "item" over "items" and would read "1 of 1 items done" forever. This is a fourth
 * caller of the identical sentence, not a second key with the identical defect.
 *
 * `done` is a FIGURE, so its three answers are the three drawn here: unconfigured says so
 * — through {@link t}('release.figureUnconfigured') — and is never a zero (extension 2c:
 * a progress nobody configured must not read as a progress the screen forgot), invalid is
 * impossible for a count and falls through with it, and a value draws the bar. The item
 * count answers beside it either way.
 *
 * Withheld whole when there are no members: `0 of 0 items done` beside an empty state
 * that already says the release is empty would say it twice and worse (extension 1a).
 *
 * `members` is `scope.members`, never `release.members.value` — `drawHeader`'s own reason
 * for reading the SCOPE's walk applies here too: the strip must not claim a member the
 * tree did not draw.
 */
function drawSummary(headerEl: HTMLElement, release: ReleaseRow, members: number): void {
	if (release.members.unconfigured || members === 0) return;
	const sumEl = headerEl.createDiv({ cls: 'pbl-rel-summary' });
	if (release.done.unconfigured || release.done.value === null) {
		sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('release.scope.members', { count: members }) });
		sumEl.createSpan({
			cls: 'pbl-rel-unreadable',
			text: t('release.figureUnconfigured', { label: t('release.scope.progress') }),
		});
		return;
	}
	const done = release.done.value;
	const pct = Math.round((100 * done) / members);
	const barEl = sumEl.createDiv({ cls: 'pbl-rel-bar pbl-rel-bar-wide' });
	barEl.createDiv({ cls: 'pbl-rel-bar-fill' }).setCssProps({ '--pbl-rel-fill': `${pct}%` });
	sumEl.createSpan({ cls: 'pbl-rel-pct', text: t('release.scope.percent', { pct }) });
	sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('column.rollupTooltip', { done, count: members }) });
}

/**
 * One of the release's three figures, drawn under the index's own rules so the two screens
 * cannot describe the same release differently: an unbound key is absent, and a bound key
 * holding something no reader will guess at says so rather than reading as unset.
 *
 * **A refusal names the property it is about.** The index can afford a bare "Unreadable"
 * because its column heading sits above the cell and its row's accessible name pairs every
 * figure with that heading; this header draws its three values BARE, side by side, so two
 * malformed properties would put two identical words on screen with nothing saying which
 * key to go and fix. That is a defect for a sighted reader and worse for a screen reader,
 * which has no column above it to fall back on.
 *
 * The label is the property's own name, taken from the same catalog entries the index
 * heads its columns with — one name per property, so the two screens cannot come to call
 * the same key different things.
 */
function drawFigure<T>(parentEl: HTMLElement, figure: ReleaseFigure<T>, label: string, draw: (value: T) => void): void {
	if (figure.unconfigured) return;
	if (figure.invalid) {
		parentEl.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.figureUnreadable', { label }) });
		return;
	}
	if (figure.value !== null) draw(figure.value);
}

function drawTree(view: ReleaseView, release: ReleaseRow, rows: ScopeRow[]): void {
	// Named by the release, so a reader arriving at the tree hears which one it is. The
	// name is vault content rather than text — it goes nowhere near the catalog.
	const treeEl = view.viewEl.createDiv({ cls: 'pbl-tree', attr: { role: 'tree', 'aria-label': release.name } });
	// The walk hands back each row joined to its own place, rather than a parallel array this
	// loop would index into — an index lookup would need a fallback for a case that cannot
	// happen, which is the unreachable branch this module's own header argues against.
	for (const { row, pos, count } of siblingPlaces(rows)) drawRow(treeEl, row, { pos, count });
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
	// Set unconditionally, and NOTHING measures whether it was needed. `.pbl-row` carries
	// `content-visibility: auto`, so a `scrollWidth` read to decide would lay out a skipped
	// row by itself — the tree's own measured reason (5320ms against 12ms), inherited here
	// with the class. A tooltip repeating a title that already fits is the whole price.
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
function siblingPlaces(rows: ScopeRow[]): { row: ScopeRow; pos: number; count: number }[] {
	const open = new Map<number, number[]>();
	const joined = rows.map((row) => {
		// The group-closing line, and the whole rule lives in it: a row shallower than an open
		// group ends that group, so the next row at that depth starts a fresh one under a new
		// parent. Without it every row at one depth joins one group for the length of the
		// scope, and a second Epic's members are announced as `3 of 4` instead of `1 of 2`.
		for (const depth of [...open.keys()]) if (depth > row.depth) open.delete(depth);
		const group = open.get(row.depth) ?? [];
		open.set(row.depth, group);
		group.push(group.length + 1);
		return { row, pos: group.length, group };
	});
	return joined.map(({ row, pos, group }) => ({ row, pos, count: group.length }));
}
