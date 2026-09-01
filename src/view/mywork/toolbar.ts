import type { MyWorkView } from './myWorkView';
import { t } from '../../i18n/t';
import { namedTargets } from '../../domain/readItems';
import { assignedRows, pickedResource } from '../../domain/assignedWork';
import { anyWorkflowConfigured, hidesDone } from './renderTree';
import { setAllFolds, setScopeFlag } from '../scopeFolds';
import { MYWORK_FOLD } from '../../storage/foldKeys';
import { scopeIconButton } from '../scopeToolbarButton';

/**
 * This view's own toolbar — drawn above every roster-bearing screen (`myWorkView.ts`'s
 * own `draw()`, which includes the "nobody picked yet" empty state: the way OUT of it is
 * the picker itself).
 *
 * The person picker is a native `<select>` rather than a menu of ours: it collapses to
 * nothing in a narrow pane, and it is reachable by keyboard and screen reader with no
 * code here — `docs/requirements/A tree that fits a sidebar.md`'s own reason for every
 * other control in this Feature that gives way in a narrow pane. Collapse-all, expand-all
 * and hide-done are withheld until somebody is picked — a control that asks about a tree
 * that does not exist yet is worse than no control — and hide-done is withheld again
 * where `anyWorkflowConfigured` says no workflow this tree could draw a row for has a
 * bound state key, `view/release/scopeToolbar.ts`'s own `release.done.unconfigured` gate
 * asked of this view's own settings. Three controls, drawn exactly as that module draws
 * its own three (`clickable-icon` buttons, one `aria-label`/tooltip key each): the
 * context-rows toggle that design started with was cut there for the identical reason it
 * would be cut here, and there is nothing left for a fourth control to turn on or off.
 */
export function drawMyWorkToolbar(view: MyWorkView, parentEl: HTMLElement): void {
	const barEl = parentEl.createDiv({ cls: 'pbl-mw-toolbar' });
	drawPersonPicker(view, barEl);
	barEl.createDiv({ cls: 'pbl-mw-spacer' });
	// **The SAME question the body asks** (`myWorkView.ts`'s `draw()`), not the weaker
	// non-null one. A stored pick outlives the note it names — the `Resource` is deleted, or
	// the base's filter stops returning it — and the path stays non-null while nothing
	// resolves it. The body correctly draws the no-pick guidance there; a toolbar gated on
	// non-null alone drew Collapse all, Expand all and Hide done beside it, each handler
	// calling `assignedRows` for a person who is not on the roster. Two gates asking
	// different questions about one state is the shape the checkmark rule already names.
	const person = view.pickedPerson;
	if (person === null || !pickedResource(view.model, person)) return;
	scopeIconButton(barEl, 'chevrons-down-up', t('mywork.collapseAll'), 'pbl-mw-collapse', () => {
		setAllFolds(view, MYWORK_FOLD, person, assignedRows(view.model!, person), true);
		view.render();
	});
	scopeIconButton(barEl, 'chevrons-up-down', t('mywork.expandAll'), 'pbl-mw-expand', () => {
		setAllFolds(view, MYWORK_FOLD, person, assignedRows(view.model!, person), false);
		view.render();
	});
	// Withheld exactly where `hidesDone` can never answer true — the tree's own gate,
	// asked here before drawing rather than re-derived: a control that could hide rows
	// nothing can bring back is worse than no control.
	if (!anyWorkflowConfigured(view.settings)) return;
	const on = hidesDone(view);
	const btn = barEl.createEl('button', {
		cls: 'pbl-mw-toggle pbl-mw-hidedone' + (on ? ' pbl-mw-toggle-on' : ''),
		attr: { type: 'button', 'aria-pressed': String(on) },
		text: t('mywork.hideDone'),
	});
	// `setScopeFlag` renders on its own (`scopeFolds.ts`); the two buttons above call
	// `view.render()` themselves because `setAllFolds` — unlike `toggleFold` — does not.
	btn.addEventListener('click', () => setScopeFlag(view, 'myWorkHideDone', !on));
}

/**
 * `namedTargets(model.resources)` for the collision-aware label — the basename for
 * everybody, except the pair that shares one, which is named by its path instead. The
 * VALUE is always the file's own path, never the label: two people sharing a name must
 * still resolve to two different picks.
 */
function drawPersonPicker(view: MyWorkView, barEl: HTMLElement): void {
	const selectEl = barEl.createEl('select', {
		cls: 'dropdown pbl-mw-person',
		attr: { 'aria-label': t('mywork.person') },
	});
	selectEl.createEl('option', { text: t('mywork.personPlaceholder'), value: '' });
	for (const { item, label } of namedTargets(view.model!.resources)) {
		selectEl.createEl('option', { text: label, value: item.file.path });
	}
	selectEl.value = view.pickedPerson ?? '';
	selectEl.addEventListener('change', () => view.pick(selectEl.value === '' ? null : selectEl.value));
}
