import { setIcon, setTooltip } from 'obsidian';
import type { ReleaseView } from './releaseView';
import { t } from '../../i18n/t';
import { ReleaseFigure, ReleaseRow, ReleaseScope } from '../../domain/releases';
import { formatCivil } from '../../domain/timeline';
import { BacklogSettings } from '../../domain/settings';
import { WorkflowKind, workflowStateInfo } from '../../domain/board';
import { guidanceShell } from '../render/emptyStates';
import { uniqueElementId } from '../selection';
import { renderReleaseInit } from './initControl';
import { drawScopeTree, effectiveHideDone, rowsAfterHideDone } from './scopeTree';
import { drawScopeToolbar } from './scopeToolbar';
import { wireScopeKeys } from './scopeKeys';

/**
 * One release's screen (`docs/requirements/The scope of a release as a tree.md`): the
 * header's facts, and the two empty states above the tree. The tree itself —
 * `role="tree"`, the rows, the disclosure and the fold set — is `scopeTree.ts`'s own
 * (`drawScopeTree`), split out here in Task 3 once this module's own header grew a fourth
 * reason to change on top of the header and the two states it keeps.
 *
 * A free function over the view, `renderIndex.ts`'s own shape, importing the view for its
 * TYPE alone so the pair stays acyclic at runtime.
 *
 * **This module is also what keeps `scopeTree.ts` and `scopeKeys.ts` themselves acyclic.**
 * The tree's keyboard needs the fold set `scopeTree.ts` owns (`ScopeDraw.folded`,
 * `toggleFold`), and `scopeTree.ts` has no reason to import the keyboard back — so
 * `drawScopeTree` returns what it drew (`ScopeDraw`, `folded` included, so the keyboard
 * never has to ask `foldedPaths` again itself) instead of wiring the keyboard itself, and
 * this module, which already imports both leaves, calls `wireScopeKeys` as the second
 * step. Two one-directional edges from here rather than one cycle between them.
 *
 * **Nothing here writes a note.** There is no gate to route through and nothing to
 * withhold: the back control sets view state, a row's click opens a note (`scopeTree.ts`),
 * and the `noMembership` empty state's own ✨ ({@link renderReleaseInit}) only binds this
 * view's own config — see that function for why it writes no note either.
 *
 * `release` is a parameter rather than `scope.release` read here, because the caller has
 * already ruled on it — a screen is chosen by whether the pick still names a release, and
 * a second null check in here would be an unreachable branch restating that decision.
 *
 * `planSettings` is a parameter for the identical reason: `ReleaseView.draw()` already
 * built the full `BacklogSettings` the model itself was built from (three of this view's
 * own mappings layered onto the plan's), and a second resolve here would be the same
 * two-resolvers-disagreeing hazard `draw()`'s own comment states for the model boundary —
 * this screen's summary strip needs it only to name a workflow's property and done values
 * in its tooltip, never to derive anything the model has not already counted.
 */
export function renderScope(view: ReleaseView, scope: ReleaseScope, release: ReleaseRow, planSettings: BacklogSettings): void {
	drawHeader(view, scope, release, planSettings);
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
	// Above the tree AND the all-done state below, so collapse/expand and the way back off
	// an all-done screen are never a dead end — `scopeToolbar.ts`'s own header on why the
	// hide-done control asks `release.done.unconfigured` rather than a second copy of it.
	drawScopeToolbar(view, view.viewEl, release, scope.rows);
	// `effectiveHideDone`, the same one value `drawScopeTree` hides by: an unconfigured
	// release must not reach the all-done state either, since the toggle that would bring
	// its rows back is not on screen there (`scopeToolbar.ts`'s own early return).
	const hideDone = effectiveHideDone(view, release);
	if (hideDone && rowsAfterHideDone(scope.rows, hideDone).length === 0) {
		drawAllDoneState(view.viewEl, scope.members);
		return;
	}
	const draw = drawScopeTree(view, release, scope.rows);
	wireScopeKeys(view, draw.treeEl, release.path, draw);
}

/**
 * Everything in the release is finished and hidden — extension 4c, drawn rather than left
 * as a blank scroller.
 *
 * `renderAllDoneState` in `render/emptyStates.ts` is NOT reused: it takes a
 * `BacklogViewHost` this view has none of, and its way back is
 * `config.set('showCompleted', true)` — a `.base` setting, where this toggle is
 * deliberately per-device view state (ADR 0011). The way back here is the toolbar's own
 * toggle, drawn just above this by the caller and never touched by this function.
 *
 * `count` is `scope.members` — the same denominator the summary strip's own sentence
 * names ("N of N items done"), so the number this state reports is the one the header
 * above it was already using, not a second opinion computed for the occasion.
 */
function drawAllDoneState(viewEl: HTMLElement, count: number): void {
	// `.pbl-empty-filter` (`styles/toolbar.css`) is the tree's own lighter notice shell —
	// reused rather than restated, the same reuse `scopeTree.ts` already makes of
	// `.pbl-state-chip`/`.pbl-progress`: nothing is wrong here, so this is not the heavier
	// `.pbl-empty` guidance shell the two configuration empty states above draw. `.pbl-rel-alldone`
	// is this screen's own hook, for the test and for the one colour that IS its own.
	const doneEl = viewEl.createDiv({ cls: 'pbl-empty-filter pbl-rel-alldone' });
	setIcon(doneEl.createSpan({ cls: 'pbl-empty-filter-icon pbl-rel-alldone-icon' }), 'circle-check');
	doneEl.createSpan({ text: t('release.scope.allDone', { count }) });
}

/**
 * Two lines: the back control and the release's own three figures, then the summary
 * strip beneath them — `.pbl-rel-hline` for the first, `.pbl-rel-summary` for the second,
 * which is what lets `styles/releaseScope.css` stack them without either line's own flex
 * rules fighting the other's.
 */
function drawHeader(view: ReleaseView, scope: ReleaseScope, release: ReleaseRow, planSettings: BacklogSettings): void {
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

	drawSummary(headerEl, release, scope.members, planSettings);
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
 * and NAMES the workflow it could not read (`release.unconfiguredWorkflows`, through
 * {@link t}('release.scope.progressUnconfigured') when that list holds anything, else the
 * generic {@link t}('release.figureUnconfigured') for the one case with nothing to name —
 * see `ReleaseRow.unconfiguredWorkflows`'s own comment), and is never a zero (extension 2c:
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
 *
 * **A tooltip on the strip names what the progress figure read** — the requirement
 * (`docs/requirements/Summing up a release.md`'s 2026-08-28 amendment) the bar, the
 * percentage and the sentence cannot meet on their own: none of the three says WHICH
 * property decided a member was done. It is a tooltip and not a third header line
 * deliberately: the header is already two lines, laid out against a real stylesheet, and a
 * third would cost more than provenance buys — see this module's own header comment.
 * {@link progressProvenance} is where the WORDING is decided; this function only calls it.
 *
 * **The tooltip alone reaches a pointer only**, which the requirement's "every figure names
 * what it read" does not narrow to sighted mouse users. `sumEl` carries no `aria-label` for
 * it — that attribute REPLACES an element's content for assistive tech, so labelling the
 * strip with the provenance sentence would silence the bar, the percentage and the `n of m`
 * text it already draws, trading one gap for a worse one. What is added instead is a
 * `.pbl-sr-only` span carrying the IDENTICAL sentence (`board.ts`'s own pattern for the
 * board's shortcut hint), associated through `aria-describedby` rather than duplicated in
 * new words: one question — what decided this figure — gets one answer, read alongside the
 * visible content rather than instead of it. The tooltip stays, for the pointer users who
 * already had it.
 */
function drawSummary(headerEl: HTMLElement, release: ReleaseRow, members: number, planSettings: BacklogSettings): void {
	if (release.members.unconfigured || members === 0) return;
	const sumEl = headerEl.createDiv({ cls: 'pbl-rel-summary' });
	if (release.done.unconfigured || release.done.value === null) {
		sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('release.scope.members', { count: members }) });
		sumEl.createSpan({ cls: 'pbl-rel-unreadable', text: unconfiguredProgressText(release.unconfiguredWorkflows) });
		return;
	}
	const done = release.done.value;
	const pct = Math.round((100 * done) / members);
	const barEl = sumEl.createDiv({ cls: 'pbl-rel-bar pbl-rel-bar-wide' });
	barEl.createDiv({ cls: 'pbl-rel-bar-fill' }).setCssProps({ '--pbl-rel-fill': `${pct}%` });
	sumEl.createSpan({ cls: 'pbl-rel-pct', text: t('release.scope.percent', { pct }) });
	sumEl.createSpan({ cls: 'pbl-rel-figure', text: t('column.rollupTooltip', { done, count: members }) });
	const provenance = progressProvenance(release.workflows, planSettings);
	setTooltip(sumEl, provenance);
	// `aria-hidden`, like `board.ts`'s own `renderBoardInstructions`: without it a linear
	// (virtual-cursor) read would meet this span as ordinary content — one more figure in
	// the strip — and then meet the identical sentence again as `sumEl`'s description. Hiding
	// it from normal traversal is what keeps the strip's own reading exactly the visible bar,
	// percentage and count, while `aria-describedby` still pulls a hidden element's text as a
	// description — that split is the whole of why this pattern works.
	const provenanceEl = sumEl.createSpan({ cls: 'pbl-sr-only', attr: { 'aria-hidden': 'true' }, text: provenance });
	provenanceEl.id = uniqueElementId('pbl-rel-provenance');
	sumEl.setAttribute('aria-describedby', provenanceEl.id);
}

/**
 * The unconfigured branch's own sentence — named, not merely absent
 * (`docs/requirements/Summing up a release.md`'s "unconfigured predicate" rule, read for
 * the progress figure specifically). `unconfiguredWorkflows` is
 * `ReleaseRow.unconfiguredWorkflows`, already the failing subset in `WORKFLOW_ORDER`
 * (`domain/releases.ts`), so this asks nothing about the release a second time — it only
 * turns a list already computed into words, exactly as {@link progressProvenance} does for
 * the configured branch beside it.
 *
 * Empty is the one case with no workflow to name (no member counted yet — see the field's
 * own comment for why that is not the same claim as "configured"), so it reads the plain
 * `release.figureUnconfigured` rather than a sentence naming nothing. `workflowName` is
 * the identical translator `progressProvenance` calls, reused rather than a second mapping
 * that could drift from it on which two names `WorkflowKind` gets.
 *
 * **Exported for `renderIndex.ts`'s own bands.** A band whose progress cannot be
 * computed used to draw nothing at all, the reader learning why only by opening this
 * screen — so the index calls this same function rather than writing its own wording:
 * `ReleaseRow.done`'s single-answer rule, one layer up, is what a second sentence here
 * would break.
 */
export function unconfiguredProgressText(unconfiguredWorkflows: WorkflowKind[]): string {
	const label = t('release.scope.progress');
	if (unconfiguredWorkflows.length === 0) return t('release.figureUnconfigured', { label });
	return t('release.scope.progressUnconfigured', { label, workflows: unconfiguredWorkflows.map(workflowName) });
}

/**
 * What decided the progress figure, in words — the ONLY place that decision is turned
 * into a sentence. `ReleaseRow.workflows` already answers WHICH workflows are represented
 * (a model question, decided in `domain/releases.ts` beside the counts it is measured
 * over); this asks what to SAY about that, which is a settings lookup and a translation
 * choice rather than a further fact about the members.
 *
 * One workflow names its property and its done values — both DATA (a property key, the
 * state values the vault holds), so they are parameters to `release.scope.progressProperty`
 * and never catalog text themselves. More than one names the workflows instead, because
 * past that point `done`'s numerator crossed `ownWorkflowReading`'s own branches and no
 * single property is what decided it.
 *
 * `workflows[0]` is read with no `?? fallback`, deliberately: `drawSummary` calls this
 * only once `members > 0` and `done` is configured, and every counted member contributes
 * its own kind to `workflows` in the same walk — so an empty list here would mean the two
 * disagreed about who is a member, which is exactly the defect `ReleaseRow.workflows`'s
 * own comment states it cannot do. A fallback would silently paper over that defect
 * rather than surface it, and it would be an untestable branch beside it — this project
 * does not carry `noUncheckedIndexedAccess`, so nothing forces one.
 */
function progressProvenance(workflows: WorkflowKind[], planSettings: BacklogSettings): string {
	if (workflows.length > 1) {
		return t('release.scope.progressWorkflows', { workflows: workflows.map(workflowName) });
	}
	const { key, doneValues } = workflowStateInfo(workflows[0], planSettings);
	return t('release.scope.progressProperty', { property: key, values: doneValues });
}

/**
 * A workflow kind's own translated name — the provenance tooltip's one caller.
 *
 * Two branches, not `WorkflowKind`'s three: `'test'` never reaches this function. A
 * test-catalog note cannot become a release member at all — `membershipTarget`
 * (`domain/releases.ts`) refuses every carrier `inPlan` excludes, and `inPlan` excludes
 * catalog membership outright (`!inCatalog(item)`), the register's own "a release holds
 * work and those notes are not work". So `ReleaseRow.workflows` can only ever hold
 * `'requirements'` and/or `'deliverable'`, and a third branch here would be untestable
 * dead code rather than defensive coverage — see
 * `test/domain/releases.test.ts`'s "refuses a membership property hand-written on a
 * non-plan row" for where that refusal is pinned.
 */
function workflowName(kind: WorkflowKind): string {
	return kind === 'deliverable' ? t('release.scope.workflowDeliverables') : t('release.scope.workflowRequirements');
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
