import { setIcon } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseFigure, ReleaseIndex, ReleaseRow } from '../../domain/releases';
import { formatCivil } from '../../domain/timeline';
import { drawIcon } from '../render/icons';
import { renderNewRelease } from './newRelease';

/**
 * The index screen (`docs/requirements/Every release in one list.md`): one BAND per
 * release — two lines, a plan-overview-and-triage surface rather than a column grid — and
 * the two notes beneath it.
 *
 * A free function over the view, `estimation/renderTable.ts`'s own shape, importing the
 * view for its TYPE alone so the pair stays acyclic at runtime.
 *
 * **Nothing here re-sorts.** `releaseIndex` decided the order, the figures and the member
 * count, and this module draws what it was handed — the design's "one denominator, one
 * predicate, one answer", which is what stops a band and a release header disagreeing
 * about the same release. Grouping the bands into "In flight" / "Shipped" headings is a
 * later increment ([[Every release in one list]]); this module draws the flat, already
 * sorted list.
 *
 * **Two gestures on this screen, and only one of them is view state.** Picking a release is;
 * `New release` (see {@link renderNewRelease}) creates a note and may bind this view's own
 * options. Neither EDITS a note that already exists, which is the whole of what this view
 * refuses (`test/view/releaseNeverEdits.test.ts`).
 */
export function renderIndex(view: ReleaseView, index: ReleaseIndex): void {
	// Above the scroller rather than in it: the control is chrome for the screen, and one
	// inside `.pbl-rel-list` would scroll away with the rows. There is no toolbar on this
	// view to hang it on — `viewEl` holds screens — so the head of the index IS the head of
	// the screen.
	renderNewRelease(view, view.viewEl.createDiv({ cls: 'pbl-rel-actions' }));
	const listEl = view.viewEl.createDiv({ cls: 'pbl-rel-list' });
	const bandsEl = listEl.createDiv({ cls: 'pbl-rel-bands' });

	for (const row of index.rows) drawBand(view, bandsEl, row);

	drawAbsences(listEl, index.rows);
	drawUnresolved(listEl, index);
}

/**
 * A labelled text figure — version and status share this exact shape: a plain span drawn
 * on the band, and paired with its label in the accessible name via
 * `release.index.rowFigure`. Unconfigured is silent in both — the whole figure is a
 * column named ONCE beneath the list ({@link drawAbsences}) rather than blank on every
 * row — and an absent value (bound key, nothing written) is silent too, the same "third
 * answer" `columnSpecs` used to state: unconfigured, unreadable, or simply unset.
 */
function labelledText(fig: ReleaseFigure<string>): string | null {
	if (fig.unconfigured) return null;
	if (fig.invalid) return t('release.index.unreadable');
	return fig.value;
}

function drawVersion(line1: HTMLElement, row: ReleaseRow): void {
	const text = labelledText(row.version);
	if (text === null) return;
	line1.createSpan({ cls: row.version.invalid ? 'pbl-rel-unreadable' : 'pbl-rel-version', text });
}

/** The tree's read-only chip: this whole view is read-only, so every chip on it is the
 *  static one — `--pbl-state-color` belongs to the legend and the card projections, not
 *  to a band. */
function drawStatus(line1: HTMLElement, row: ReleaseRow): void {
	const text = labelledText(row.status);
	if (text === null) return;
	if (row.status.invalid) {
		line1.createSpan({ cls: 'pbl-rel-unreadable', text });
		return;
	}
	const chip = line1.createSpan({ cls: 'pbl-state-chip pbl-state-static' });
	chip.createSpan({ cls: 'pbl-state-text', text });
}

/**
 * The date position at the end of line 1 — target-with-days-remaining while in flight,
 * the RELEASED date once shipped.
 *
 * A shipped band shows `released` rather than `target`, and this is deliberate rather
 * than a fallback: [[Every release in one list]] 3a is what puts a release WITHOUT a
 * target after every dated one, and `released` is what the shipped group is sorted by
 * (descending) — a blank end-of-line there would leave the reader no way to explain the
 * order the same way an undated target would not. "Days remaining" has no meaning once a
 * release has shipped, so it drops with the target rather than being computed against it.
 *
 * `row.released.value !== null` is exactly `row.shipped` — `domain/releases.ts`'s own
 * definition — read directly here (rather than the boolean) so the branch narrows
 * `released.value` without an assertion.
 *
 * **`row.released.invalid` is checked FIRST, before either.** A malformed released value
 * is the one figure on this band where staying silent about it would actively mislead:
 * `shipped` is `released.value !== null`, so an unreadable released date reads as
 * `shipped: false` from the domain alone, and this row would otherwise fall straight into
 * the in-flight path below — showing a target's days-remaining and taking the full
 * overdue treatment for a release that may well have already shipped. Fixed here (Task 6
 * fix round 1) after review found target's own invalid case handled three lines below and
 * released's not handled at all — the same tri-state rule (`unconfigured`/`invalid`/a
 * value) applied to one figure and skipped on its neighbour.
 */
function drawWhen(line1: HTMLElement, row: ReleaseRow): void {
	const whenEl = line1.createSpan({ cls: 'pbl-rel-when' });
	if (row.released.invalid) {
		whenEl.createSpan({
			cls: 'pbl-rel-unreadable',
			text: t('release.figureUnreadable', { label: t('release.index.column.released') }),
		});
		return;
	}
	if (row.released.value !== null) {
		whenEl.createSpan({ cls: 'pbl-rel-date', text: t('release.index.releasedOn', { date: formatCivil(row.released.value) }) });
		return;
	}
	// Unconfigured is silent here too, same rule as every other figure: named once beneath
	// the list rather than blank on every row.
	if (row.target.unconfigured) return;
	if (row.target.invalid) {
		whenEl.createSpan({ cls: 'pbl-rel-unreadable', text: t('release.index.unreadable') });
		return;
	}
	if (row.target.value === null) {
		whenEl.createSpan({ cls: 'pbl-rel-undated', text: t('release.index.noTarget') });
		return;
	}
	whenEl.createSpan({ cls: 'pbl-rel-date', text: formatCivil(row.target.value) });
	// Not drawn while overdue: "18 days left" reads as an error at a negative count, and
	// the overdue NOTE (see `drawNote`) is what states the fact instead — the "red date"
	// and the note are two of the four overdue signals, and this is what keeps the date
	// from carrying a second, contradictory one. `overdueVisible`, not `row.overdue`
	// alone — see that function for why.
	if (!overdueVisible(row) && row.daysToTarget !== null) {
		whenEl.createSpan({ cls: 'pbl-rel-days', text: t('release.index.daysLeft', { count: row.daysToTarget }) });
	}
}

/** {@link drawWhen}'s own text, spoken — kept as a second reading of the same rule rather
 *  than derived from the DOM, `columnSpecs`' own draw/speak split for the reason stated
 *  there: an empty target cell is silence, an unset one is a sentence, and only one of the
 *  two has a DOM to read at all. */
function speakWhen(row: ReleaseRow): string[] {
	if (row.released.invalid) {
		return [t('release.figureUnreadable', { label: t('release.index.column.released') })];
	}
	if (row.released.value !== null) return [t('release.index.releasedOn', { date: formatCivil(row.released.value) })];
	if (row.target.unconfigured) return [];
	const label = t('release.index.column.target');
	const value = row.target.invalid
		? t('release.index.unreadable')
		: row.target.value === null
			? t('release.index.noTarget')
			: formatCivil(row.target.value);
	const out = [t('release.index.rowFigure', { label, value })];
	if (!overdueVisible(row) && !row.target.invalid && row.target.value !== null && row.daysToTarget !== null) {
		out.push(t('release.index.daysLeft', { count: row.daysToTarget }));
	}
	return out;
}

/**
 * A release with no members, spoken and drawn: `null` unless `members` is CONFIGURED and
 * legitimately zero — an unconfigured membership property is a different absence
 * (`drawAbsences`), not "nothing joined this release".
 */
function noMembersText(row: ReleaseRow): string | null {
	return !row.members.unconfigured && row.members.value === 0 ? t('release.index.noMembers') : null;
}

/**
 * The counted phrase, reusing `column.rollupTooltip` rather than a release-specific key —
 * see this module's own catalog entry for why. `null` covers three cases the caller tells
 * apart by trying {@link noMembersText} first: no members at all, membership unconfigured,
 * or membership configured with a state property that is NOT — the case
 * [[Every release in one list]] extension 2a names explicitly, so a done count with no
 * denominator (or a denominator with no state to count against) never coerces to a
 * misleading "0 of N".
 */
function progressPhrase(row: ReleaseRow): string | null {
	if (row.members.unconfigured || row.members.value === 0 || row.done.unconfigured) return null;
	return t('column.rollupTooltip', { done: row.done.value ?? 0, count: row.members.value ?? 0 });
}

/** Either half of line 2's left side, spoken — never both, so a caller asking for one
 *  question gets one answer. */
function speakProgress(row: ReleaseRow): string | null {
	return noMembersText(row) ?? progressPhrase(row);
}

/**
 * Line 2's left side: a fixed-width bar and the counted phrase, drawing NEITHER when
 * progress cannot be computed at all (`progressPhrase` returning null for a reason other
 * than a legitimate zero) — a bar next to no phrase, or a phrase with a numerator nobody
 * bound, would each say more than the configuration supports. "No items yet" draws no bar
 * either: a zero-length one reads as failure where the answer is emptiness.
 */
function drawProgressLine(line2: HTMLElement, row: ReleaseRow): void {
	const noItems = noMembersText(row);
	if (noItems !== null) {
		line2.createSpan({ cls: 'pbl-rel-nomembers', text: noItems });
		return;
	}
	const phrase = progressPhrase(row);
	if (phrase === null) return;
	const total = row.members.value ?? 0;
	const done = row.done.value ?? 0;
	const barEl = line2.createDiv({ cls: 'pbl-rel-bar' });
	// Clamped rather than trusted: a done count ahead of its own denominator (a state
	// property re-mapped after the fact, most likely) must not push the fill past the
	// track it is drawn in.
	const fill = Math.min(100, Math.round((done / total) * 100));
	barEl.createDiv({ cls: 'pbl-rel-bar-fill' }).setCssProps({ '--pbl-rel-fill': `${fill}%` });
	line2.createSpan({ cls: 'pbl-rel-progress', text: phrase });
}

/**
 * Whether the overdue treatment (the leading rule, the red date, the red bar and the
 * note) may be drawn at all.
 *
 * `row.overdue` is a domain fact, computed purely from `target` and `shipped`
 * (`!shipped && target passed` — `domain/releases.ts`, Task 5), and it has no notion of
 * `released.invalid`: a released value this view cannot read reads as `shipped: false`
 * to the domain, which is a correct statement about what `released.value` holds and an
 * incomplete one about whether the release has shipped. Painting a release red as
 * definitely-not-shipped when the one figure that would say otherwise is unreadable is
 * worse than saying nothing — the reader would be told a wrong fact with the same
 * confidence as a right one.
 *
 * **A VIEW-layer refusal, not a domain question.** `overdue` still means exactly what
 * `domain/releases.ts` says it means; this function does not reinterpret it, and no
 * change to that module is needed or made. What changes here is only whether THIS
 * RENDER commits to the four-signal presentation — the same kind of decision `drawWhen`
 * already makes for `target.invalid` and `row.status.invalid` elsewhere in this file,
 * now extended to the one input `overdue` itself cannot see.
 */
function overdueVisible(row: ReleaseRow): boolean {
	return row.overdue && !row.released.invalid;
}

/**
 * Line 2's right side: the overdue warning while in flight, the slip once shipped — never
 * both, since `overdue` is false whenever `shipped` is true (`domain/releases.ts`).
 *
 * Overdue is a FACT, not a heuristic (see the design's "What turns a band red"): the
 * target has passed and nothing has shipped. `row.daysToTarget` is provably non-null on
 * that branch — `overdue` can only be true when `target.value` is set, which is exactly
 * what makes `daysToTarget` non-null — but the guard is written anyway, the same
 * belt-and-braces the domain module itself uses for an implication rather than trusting it
 * silently.
 *
 * `overdueVisible(row)`, not `row.overdue` alone — see that function. Refusing the
 * overdue branch here falls through to the slip check below it, which reads `row.slip`
 * — null whenever `released.value` is null, exactly the case an invalid released value
 * produces — so an unreadable released date correctly draws NO note here rather than a
 * wrong one.
 */
function noteText(row: ReleaseRow): string | null {
	if (overdueVisible(row)) return row.daysToTarget === null ? null : t('release.index.daysOverdue', { count: Math.abs(row.daysToTarget) });
	if (row.slip === null) return null;
	if (row.slip > 0) return t('release.index.daysLate', { count: row.slip });
	if (row.slip < 0) return t('release.index.daysEarly', { count: Math.abs(row.slip) });
	return t('release.index.shippedOnTime');
}

function drawNote(line2: HTMLElement, row: ReleaseRow): void {
	const text = noteText(row);
	if (text !== null) line2.createSpan({ cls: 'pbl-rel-band-note', text });
}

/**
 * What one band SAYS, as opposed to what it shows — `rowLabel`'s own reason, over the
 * band's own parts rather than a list of grid columns.
 *
 * A `<button>`'s accessible name is its own contents run together, which on this screen
 * would say "0.8 0.8.0 12 Sep 2026 18 days left In progress 8 of 14 done" — values with
 * nothing saying which is which. Every self-describing sentence (the days figure, the
 * progress phrase, the overdue/slip note) is spoken bare; version, target and status stay
 * paired with their heading, because a bare "0.8.0" or "In progress" says nothing on its
 * own. Every piece goes through the catalog and the list is joined by `Intl.ListFormat`
 * inside it: a joiner written here would be grammar decided by whoever typed it.
 */
function bandLabel(row: ReleaseRow): string {
	const figures: string[] = [];
	const version = speakLabelled(row.version, t('release.index.column.version'));
	if (version !== null) figures.push(version);
	figures.push(...speakWhen(row));
	const status = speakLabelled(row.status, t('release.index.column.status'));
	if (status !== null) figures.push(status);
	const progress = speakProgress(row);
	if (progress !== null) figures.push(progress);
	const note = noteText(row);
	if (note !== null) figures.push(note);
	return t('release.index.rowLabel', { name: row.name, figures });
}

function speakLabelled(fig: ReleaseFigure<string>, label: string): string | null {
	const text = labelledText(fig);
	return text === null ? null : t('release.index.rowFigure', { label, value: text });
}

function drawBand(view: ReleaseView, bandsEl: HTMLElement, row: ReleaseRow): void {
	// A real `<button>`, which is what makes the tab stop, Enter, Space and Space NOT
	// scrolling the list the browser's job rather than a handler somebody has to
	// remember — `renderScope.ts`'s back control, one screen over, for the same reason.
	// `button.pbl-rel-band` is the element-qualified reset `styles/release.css` carries:
	// a bare class loses to Obsidian's own `button:not(.clickable-icon)` at (0,1,1) — see
	// `docs/issues/The release index rows paint as Obsidian buttons.md`.
	const bandEl = bandsEl.createEl('button', {
		cls: 'pbl-rel-band',
		// `aria-label` REPLACES the contents as the accessible name — see `bandLabel`.
		attr: { type: 'button', 'data-path': row.path, 'aria-label': bandLabel(row) },
	});
	// One condition, four signals: this class is the ONLY thing that decides the leading
	// rule, the red date, the red bar and the note's colour — grouped under it in the
	// stylesheet so the four cannot drift apart. `overdueVisible`, not `row.overdue` alone
	// — see that function for why an unreadable released value refuses the class even
	// though the domain fact stays `true`.
	if (overdueVisible(row)) bandEl.addClass('pbl-rel-overdue');

	const line1 = bandEl.createDiv({ cls: 'pbl-rel-line1' });
	const nameEl = line1.createSpan({ cls: 'pbl-rel-name' });
	drawIcon(nameEl.createSpan({ cls: 'pbl-rel-icon' }), 'package');
	nameEl.createSpan({ text: row.name });
	drawVersion(line1, row);
	line1.createDiv({ cls: 'pbl-rel-spacer' });
	drawWhen(line1, row);
	drawStatus(line1, row);

	const line2 = bandEl.createDiv({ cls: 'pbl-rel-line2' });
	drawProgressLine(line2, row);
	line2.createDiv({ cls: 'pbl-rel-spacer' });
	drawNote(line2, row);

	bandEl.addEventListener('click', () => view.pick(row.path));
}

/** One figure this list can report absent: its heading, and whether a given row's own
 *  figure is unconfigured. The band no longer draws columns, but the rule is the same one
 *  `columnSpecs` stated for the grid — a bound key nobody set draws nothing on any row and
 *  is named ONCE beneath the list instead. */
interface AbsentFigure {
	label: string;
	unconfigured: (row: ReleaseRow) => boolean;
}

/**
 * The band's own figure list, in place of the grid's `columnSpecs` — read by
 * {@link drawAbsences} alone, since nothing else here loops over "the figures" as a set.
 *
 * `Progress` is gated on `!row.members.unconfigured && row.done.unconfigured` rather than
 * on `done.unconfigured` alone: `done` is unconfigured whenever `members` is too (neither
 * has a denominator to count over), and reporting BOTH in that case would say the same
 * thing twice — `Items` already explains why there is no progress. This is the one case
 * where the two are independent: membership bound, state property not.
 *
 * **`Released` carries no such gate.** Unlike `done`, `released` is not derived FROM
 * another figure on this row — it is its own binding on the release note
 * (`releasedDateProperty`), read exactly as `target` is, and `target` being configured or
 * not says nothing about whether `released` is. So there is no sibling figure whose own
 * absence entry would already explain this one away, and a cleared `releasedDateProperty`
 * is named plainly: without it every release reads as in flight (`shipped` is `released.
 * value !== null`, and an unconfigured figure's value is always `null`), no slip is ever
 * drawn and the Shipped grouping (Task 7) never has anything to hold — with nothing
 * beneath the list saying why, until this entry. Added in Task 6 fix round 1: the
 * original five-entry list covered every figure this increment touches except the one it
 * ADDED.
 */
function absentFigures(): AbsentFigure[] {
	return [
		{ label: t('release.index.column.version'), unconfigured: (row) => row.version.unconfigured },
		{ label: t('release.index.column.target'), unconfigured: (row) => row.target.unconfigured },
		{ label: t('release.index.column.released'), unconfigured: (row) => row.released.unconfigured },
		{ label: t('release.index.column.status'), unconfigured: (row) => row.status.unconfigured },
		{ label: t('release.index.column.members'), unconfigured: (row) => row.members.unconfigured },
		{ label: t('column.rollupProgress'), unconfigured: (row) => !row.members.unconfigured && row.done.unconfigured },
	];
}

/**
 * The unconfigured figures, named ONCE beneath the list — the register's rule for any
 * unconfigured figure, and the reason those figures are absent from every band above
 * rather than blank in each. Read from the FIRST row: `releaseIndex` sets `unconfigured`
 * from the settings rather than from a note, so every row agrees and asking one of them is
 * asking the configuration.
 */
function drawAbsences(listEl: HTMLElement, rows: ReleaseRow[]): void {
	const first = rows[0];
	if (first === undefined) return;
	const absent = absentFigures().filter((figure) => figure.unconfigured(first));
	if (absent.length === 0) return;
	// The names are joined by the CATALOG's grammar — an array parameter, never a joiner
	// written here.
	note(listEl, 'settings-2', t('release.index.absentColumns', { columns: absent.map((f) => f.label) }));
}

/**
 * The items whose membership value named no release — reported here because the index is
 * the only screen that can see them: they belong to no release, so they appear on no
 * release's screen.
 *
 * Exported for the ONE screen that draws no index and still has these to report: a base
 * holding no release at all, where `releaseView.render` returns before this module is ever
 * reached. That is the maximum-information case rather than a corner — with no release for
 * any value to resolve to, EVERY membership value is unresolved — and it read as "no
 * releases" and nothing else. [[The scope of a release as a tree]] 1b's ruling is that such
 * an item is reported among the unresolved "rather than silently dropped", so the empty state
 * carries this line beneath it.
 */
export function drawUnresolved(listEl: HTMLElement, index: ReleaseIndex): void {
	const count = index.unresolved.length;
	if (count === 0) return;
	note(listEl, 'circle-alert', t('release.index.unresolved', { count })).addClass('pbl-rel-unresolved');
}

/** A line ABOUT the list rather than a row in it, so it sits outside the bands. */
function note(listEl: HTMLElement, icon: string, text: string): HTMLElement {
	const el = listEl.createDiv({ cls: 'pbl-rel-note' });
	setIcon(el.createSpan(), icon);
	el.createSpan({ text });
	return el;
}
