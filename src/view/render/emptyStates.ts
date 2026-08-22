import { setIcon } from 'obsidian';
import { t } from '../../i18n/t';
import { BacklogViewHost } from '../host';
import { newItemType, promptCreateItem } from '../interactions/create';
import { runInit } from '../interactions/structure';
import { adoptableProperties, OptionalField } from '../../domain/optionalProperties';
import { DELIVERABLE_TYPE, LEVELS, TEST_LEVELS } from '../../domain/typeVocabulary';
import { manualLink } from '../../ui/manualDialog';
import { manualSections } from '../manual/sections';

/**
 * What the tree shows when it has no rows to show. Each of these runs at most once
 * per render and shares nothing with the per-row path — `renderTree` decides *which*
 * one applies, because that decision reads the model, and calls in here to draw it.
 */

/**
 * The shell every piece of *guidance* shares — icon, title, hint — returned so the
 * caller can add the one action that differs. Written once because the class names are
 * the contract `docs/requirements/One stylesheet per concern.md` maps to this module,
 * and hand-written copies of them are places a rename has to land — which is what the
 * estimation view's own unconfigured state was until 2026-08-17: exported so
 * `estimationView.ts` can call it too, rather than hand-rolling the same four classes a
 * sixth time and drifting from them (it had, missing `.pbl-empty-title`).
 */
export function guidanceShell(treeEl: HTMLElement, icon: string, title: string, hint: string): HTMLElement {
	const empty = treeEl.createDiv({ cls: 'pbl-empty' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-icon' }), icon);
	empty.createDiv({ cls: 'pbl-empty-title', text: title });
	empty.createDiv({ cls: 'pbl-empty-hint', text: hint });
	return empty;
}

/**
 * The lighter shell the two *transient* states share — nothing is wrong, something is
 * merely hidden — one line of text and a way back, on its own class so the stylesheet
 * can treat it differently from guidance.
 */
function noticeShell(treeEl: HTMLElement, icon: string, text: string): HTMLElement {
	const empty = treeEl.createDiv({ cls: 'pbl-empty-filter' });
	setIcon(empty.createDiv({ cls: 'pbl-empty-filter-icon' }), icon);
	empty.createDiv({ text });
	return empty;
}

/**
 * The one action the two CREATION frames share — the plain tree's and the catalog's. Both
 * offer the same press over a different top type, and they were two hand-written copies
 * until the sweep made their labels one key and left them identical; extracted for
 * `guidanceShell`'s own reason, one place for a rename to land rather than two.
 *
 * Never beside `renderSetupCta`: that one offers CONFIGURATION and is withheld when nothing
 * is adoptable, which is a different question from what type a new note would be.
 */
function renderCreateCta(host: BacklogViewHost, empty: HTMLElement, type: string): void {
	const btn = empty.createEl('button', { cls: 'mod-cta' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'plus');
	btn.createSpan({ text: t('emptyState.newItem', { type }) });
	btn.addEventListener('click', () => promptCreateItem(host, [type], null));
}

/**
 * Shown from construction until Bases delivers the first result set. There is no
 * model to render before that, and a blank pane reads as a broken view rather than
 * a working one — the first render replaces this wholesale.
 */
export function renderLoadingState(treeEl: HTMLElement): void {
	const loading = treeEl.createDiv({ cls: 'pbl-loading', attr: { role: 'status', 'aria-live': 'polite' } });
	setIcon(loading.createDiv({ cls: 'pbl-loading-spinner' }), 'loader-2');
	loading.createDiv({ text: t('emptyState.loading') });
}

/**
 * `root` is the STABLE container `manualLink`'s default refocus resolves from — never
 * `treeEl` itself when a caller draws this state into an ephemeral child of the real
 * tree element (the board and roadmap advisories both do: their own "treeEl" is a
 * fresh `pbl-board-advisory`/roadmap frame div, torn down and rebuilt with everything
 * else). Defaults to `treeEl`, which is correct for the plain tree — there it IS the
 * view's one stable element, created once and only ever emptied-and-refilled.
 */
export function renderEmptyState(host: BacklogViewHost, treeEl: HTMLElement, root: HTMLElement = treeEl): void {
	if (host.projection === 'catalog') return renderCatalogEmptyState(host, treeEl, root);
	const model = host.model;
	const focused = model?.focused ?? false;
	const topLevel = focused && model ? newItemType(host.settings, model) : LEVELS[0];
	// Two whole keys rather than a frame with a slot: a locale that says "no items of type
	// X" and one that has a dedicated word for an empty backlog cannot share a middle.
	const empty = guidanceShell(
		treeEl,
		'list-tree',
		focused ? t('emptyState.noTypeItems', { type: topLevel }) : t('emptyState.noItems'),
		emptyHint(host, focused, topLevel),
	);
	renderCreateCta(host, empty, topLevel);
	manualLink(empty, host.app, manualSections(), { sectionId: 'finding', label: t('emptyState.whatShowsHere'), root });
}

/**
 * The test catalog with nothing in it: say what a catalog IS, and offer to make the first
 * suite.
 *
 * It offers CREATION and never configuration, which is the one way it differs from the
 * board's and the roadmap's empty states — unlike those two, this projection needs no key
 * bound to exist, so there is nothing for a ✨ to do here and a setup button would point
 * at a problem the user does not have.
 *
 * It is also keyed to what this projection DRAWS rather than to whether a test type
 * appeared among the raw results, because `renderTree` reaches it on an empty population:
 * a base returning a `Task` whose `Test case` parent was excluded still has a catalog —
 * the case comes in as a context row, the Task is a catalog member under it, and an empty
 * state there would be the view claiming there are no tests on a screen with one on it.
 */
function renderCatalogEmptyState(host: BacklogViewHost, treeEl: HTMLElement, root: HTMLElement): void {
	const suite = TEST_LEVELS[0];
	const empty = guidanceShell(
		treeEl,
		'flask-conical',
		t('emptyState.noTests'),
		t('emptyState.noTestsBody', { suite, caseType: TEST_LEVELS[1] }),
	);
	renderCreateCta(host, empty, suite);
	manualLink(empty, host.app, manualSections(), { sectionId: 'types', label: t('emptyState.whatIsSuite'), root });
}

/**
 * The empty state has to tell the truth about *why* it is empty: a base full of
 * plain notes is a different problem than a base with nothing in it.
 */
function emptyHint(host: BacklogViewHost, focused: boolean, topLevel: string): string {
	if (focused) {
		return t('emptyState.focusedHint', { type: topLevel });
	}
	const ignored = host.model?.ignoredCount ?? 0;
	if (ignored > 0) {
		return t('emptyState.ignored', { count: ignored, topLevel });
	}
	return t('emptyState.filterHint', { type: topLevel });
}

/**
 * Board mode without a state property: there is no workflow to draw, so this is
 * guidance rather than a board — a board here would be a lie about a workflow that
 * does not exist. The one board case with no columns, and it names the option to
 * set and where, never a blank pane.
 */
export function renderBoardNoWorkflowState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = guidanceShell(treeEl, 'square-kanban', t('emptyState.noWorkflow'), t('emptyState.noWorkflowBody'));
	renderSetupCta(host, empty, ['state']);
}

/**
 * The Deliverables board without its own workflow configured — the same "no lie about
 * a workflow that does not exist" rule `renderBoardNoWorkflowState` states, for the
 * second workflow.
 */
export function renderDeliverablesBoardNoWorkflowState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = guidanceShell(
		treeEl,
		'square-kanban',
		t('emptyState.noDeliverableWorkflow'),
		t('emptyState.noDeliverableWorkflowBody'),
	);
	// BOTH fields fix this frame, which is `resolvedDeliverableStateKey`'s own rule as a
	// list: this board resolves through its own key when one is set and through the
	// requirements `stateKey` when it is not. Naming only the Deliverable field hid the
	// button on the case that matters most — a fresh view, where `adoptableProperties`
	// gives `status` to `state` first and drops `deliverableState` as a duplicate
	// suggestion, so nothing here was adoptable and the guidance named an option while
	// withholding the press that would have set it. A CLEARED `state` is still a
	// decision and still hides the button: `adoptableProperties` asks the config, not
	// the settings.
	//
	// The HINT above names both properties for the same reason, and that is not
	// tidiness: on a fresh view this button binds `status` to the requirements `State
	// property`, so a hint naming only the Deliverable one would send the user looking
	// for a setting the press they just made did not touch. What the guidance says the
	// way out is and what the button beside it actually does have to be one answer.
	renderSetupCta(host, empty, ['deliverableState', 'state']);
}

/**
 * The requirements board under a focus it cannot honour. `Deliverable` is the one type
 * that board excludes by construction, so focusing it leaves every focus root filtered
 * out and the board empty — a state the ordinary empty guidance describes wrongly twice
 * over: it reports the count as "all done and hidden", and it offers to create another
 * item of the focused type, which is the one type this board would not show either.
 *
 * The way out is the focus, so that is the button — not a creation CTA. Switching to the
 * Deliverables board is the other way, named in the prose because the mode toggle is
 * already on screen beside this pane.
 */
export function renderBoardExcludedFocusState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const empty = guidanceShell(
		treeEl,
		'square-kanban',
		t('emptyState.excludedFocus'),
		t('emptyState.excludedFocusBody', { type: DELIVERABLE_TYPE }),
	);
	const btn = empty.createEl('button', { cls: 'mod-cta', text: t('emptyState.showAllTypes') });
	btn.addEventListener('click', () => host.setFocusLevel(''));
}

/**
 * A configured Deliverable workflow with no Deliverable-typed results in the base —
 * distinct from "everything is done and hidden", which this board has no concept of
 * (Scope): a base full of other work is never reported as complete.
 *
 * No focus-dependent wording: the Deliverables board's population
 * (`BacklogModel.deliverableResults`) is never narrowed by the focus level, so unlike
 * `renderEmptyState`/`emptyHint`'s tree guidance there is no "elsewhere in the base, if
 * you clear focus" case to describe here — either the base has a Deliverable somewhere,
 * in which case it is already a card, or it does not.
 */
export function renderNoDeliverablesState(treeEl: HTMLElement): void {
	guidanceShell(
		treeEl,
		'package',
		t('emptyState.noDeliverables'),
		t('emptyState.noDeliverablesBody', { type: DELIVERABLE_TYPE }),
	);
}

/**
 * An iteration board whose iteration holds nothing yet.
 *
 * Never the product board's "All N items are done and hidden", which cannot tell an
 * empty base from an empty scope: on this board the base is usually full and the
 * SPRINT is what is empty, so that sentence would report finished work where none has
 * been committed.
 */
export function renderEmptyIterationState(treeEl: HTMLElement, name: string | null): void {
	// The fallback is HERE rather than at the call site, and that is what makes it checkable:
	// a caller spelling `?? 'this iteration'` splices English into a translated sentence, and
	// a test that passes the fallback in asserts its own argument — it stays green with the
	// caller reverted. One `null` reaches this line instead, so the key is the only way to
	// name an iteration no note carries.
	const named = name ?? t('emptyState.thisIteration');
	guidanceShell(treeEl, 'calendar-clock', t('emptyState.emptyIteration'), t('emptyState.emptyIterationBody', { name: named }));
}

/**
 * Roadmap mode with no axis configured: guidance naming both ways to get one and
 * where each is set. The one roadmap case with no frame — a frame here would be
 * a lie about an axis that does not exist — and when a horizon property is set
 * but its values were cleared, the guidance names the half that is missing
 * rather than inventing a vocabulary.
 */
export function renderRoadmapNoAxisState(host: BacklogViewHost, treeEl: HTMLElement): void {
	const halfConfigured = host.settings.horizonKey !== '' && host.settings.horizonValues.length === 0;
	// One key per whole body, never a clause spliced into a shared frame: which half is
	// missing decides the sentence, and a locale that names the dates first has no way
	// into a middle the caller assembled.
	const body = halfConfigured ? t('emptyState.noAxisBodyHalfSet') : t('emptyState.noAxisBody');
	const empty = guidanceShell(treeEl, 'map', t('emptyState.noAxis'), body);
	renderSetupCta(host, empty, ['horizon', 'start', 'target']);
}

/**
 * The way out of an unconfigured frame: the same action the toolbar's ✨ runs, which
 * binds the properties this view writes and creates them on the items — not a second
 * idea of what setting the view up means, so what the board and the roadmap offer
 * here cannot drift from what that button does.
 *
 * The press does the whole action, but it is offered only when one of the properties
 * THIS frame is missing can still be bound — `fixes` is that list. Asking whether
 * anything at all is adoptable is not the same question: a user who cleared the state
 * property and never touched the roadmap's would be shown a button on the board that
 * binds three horizon keys and leaves the board saying exactly what it said before.
 * An option someone CLEARED is a decision this must not overrule, so a frame whose own
 * properties are all cleared shows no button — the guidance beside it still names the
 * options to set, which is the honest answer when nothing here can be done for them.
 */
function renderSetupCta(host: BacklogViewHost, empty: HTMLElement, fixes: OptionalField[]): void {
	const adoptable = adoptableProperties(host.config, host.settings);
	if (!adoptable.some((property) => fixes.includes(property.field))) return;
	const btn = empty.createEl('button', { cls: 'mod-cta' });
	setIcon(btn.createSpan({ cls: 'pbl-btn-icon' }), 'sparkles');
	btn.createSpan({ text: t('emptyState.addDefaults') });
	btn.addEventListener('click', () => void runInit(host));
}

/** Everything is done and hidden — celebrate, and offer the way back. `root` — see
 * `renderEmptyState`, above. */
export function renderAllDoneState(
	host: BacklogViewHost,
	treeEl: HTMLElement,
	total: number,
	root: HTMLElement = treeEl,
): void {
	const empty = noticeShell(treeEl, 'circle-check', t('emptyState.allDone', { count: total }));
	const btn = empty.createEl('button', { text: t('emptyState.showCompleted') });
	btn.addEventListener('click', () => host.config.set('showCompleted', true));
	manualLink(empty, host.app, manualSections(), { sectionId: 'finding', label: t('emptyState.whatShowsHere'), root });
}
