import { Menu, Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { dependentsClosure } from '../../domain/dependencies';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { ItemSuggestModal, SuggestChoice } from '../../ui/itemSuggest';
import { DependsOnDelta } from '../../domain/writePlan';

/**
 * The two menu entries that state and clear a prerequisite.
 *
 * Both plan the same one-note write and hand it to the same gate, so there is one idea
 * of what a dependency write is for the drag to reuse rather than re-plan. Nothing here
 * decides anything a note could not: what is offered is asked of the plan the pick would
 * produce, so an entry that would write nothing is absent rather than inert.
 */

/** Add the pair, in the order they read: state one, then clear one. */
export function addDependencyItems(host: BacklogViewHost, model: BacklogModel, menu: Menu, item: BacklogItem): void {
	menu.addItem((mi) =>
		mi
			.setTitle('Depends on…')
			.setIcon('link')
			.onClick(() => promptAddDependency(host, model, item)),
	);
	// Gated on the KEY's presence, never on what the reader parsed out of it: a value
	// that reads as no dependencies is still a value on disk, and a control keyed to the
	// parsed list could not offer to remove what the parser discarded.
	if (item.ownKeys.dependsOn) {
		menu.addItem((mi) =>
			mi
				.setTitle('Remove dependency…')
				.setIcon('unlink')
				.onClick(() => promptRemoveDependency(host, item)),
		);
	}
}

/**
 * Whether the pair belongs on this row at all.
 *
 * The configured key, and nothing else: an unnamed property is a feature this view does
 * not have, not a disabled control. The context-row half is deliberately NOT repeated
 * here — `buildItemMenu` adds these inside its `editable` block with every other entry
 * that edits the row's own frontmatter, so a second `outsideFilter` test would be a
 * second statement of one rule, and the kind that goes on reading as a guarantee after
 * the real guard moves.
 */
export function dependenciesAvailable(host: BacklogViewHost): boolean {
	return host.settings.dependsOnKey !== '';
}

/**
 * The notes this item may be made to wait for.
 *
 * Every exclusion here is a pick that would write nothing or refuse: itself, what it
 * already waits for, anything that would close a loop, and every row the Base excluded.
 * A result the reader cannot currently SEE is still offered — the focus level and
 * "Show completed items" narrow what is drawn, not what exists, and the link is to a
 * note rather than to a row.
 */
function candidates(model: BacklogModel, item: BacklogItem): BacklogItem[] {
	const prerequisites = new Map(
		[...model.byPath].map(([path, candidate]) => [path, candidate.prerequisites.map((p) => p.file.path)]),
	);
	// Asked once for the whole menu rather than once per row: naming any item that
	// already waits on this one — at any depth — is what would close a loop.
	const closesLoop = dependentsClosure(item.file.path, prerequisites);
	const already = new Set(item.prerequisites.map((p) => p.file.path));
	return model.results.filter(
		(candidate) =>
			!candidate.outsideFilter && !closesLoop.has(candidate.file.path) && !already.has(candidate.file.path),
	);
}

function promptAddDependency(host: BacklogViewHost, model: BacklogModel, item: BacklogItem): void {
	const choices: SuggestChoice<BacklogItem>[] = candidates(model, item).map((candidate) => ({
		label: candidate.title,
		detail: candidate.file.path,
		value: candidate,
	}));
	if (choices.length === 0) {
		// A fact about the plan, not an empty picker — which reads as a broken picker.
		new Notice('Nothing left to depend on: every other item would repeat this one or close a loop.');
		return;
	}
	new ItemSuggestModal(host.app, {
		placeholder: `What must come before ${item.title}?`,
		choices,
		onChoose: (choice) => applyDependencyWrite(host, item, { add: choice.file }),
	}).open();
}

/**
 * Everything the list holds, offered as lines to remove: each prerequisite by name,
 * each entry that became no edge by the raw text the note holds — and, when the key is
 * there but holds nothing nameable, the one entry that removes the key.
 *
 * That last case is why this reads the key's presence rather than the parsed list. A
 * value the reader discards entirely still sits on disk, and without a line to pick it
 * would be reachable from nowhere.
 */
function promptRemoveDependency(host: BacklogViewHost, item: BacklogItem): void {
	const choices: SuggestChoice<DependsOnDelta>[] = [
		...item.prerequisites.map((prerequisite) => ({
			label: prerequisite.title,
			detail: prerequisite.file.path,
			value: { removePath: prerequisite.file.path },
		})),
		// Deduped by TEXT: one line stands for every repeat of it, so a list naming the
		// same missing note twice is cleared in one action rather than looking unchanged.
		...[...new Set(item.brokenPrerequisites)].map((raw) => ({
			label: raw,
			detail: 'Does not resolve in this base',
			value: { removeRaw: raw },
		})),
	];
	if (choices.length === 0) {
		choices.push({ label: 'Remove the empty property', value: { removeKey: true } });
	}
	new ItemSuggestModal(host.app, {
		placeholder: `Stop ${item.title} waiting for…`,
		choices,
		onChoose: (delta) => applyDependencyWrite(host, item, delta),
	}).open();
}

/**
 * The one place a dependency write is planned and applied.
 *
 * Deliberately not exported yet. `Draw a dependency between bars` will call it rather
 * than plan beside it — one move, several inputs, one place the batch is made — but a
 * symbol exported for a caller that does not exist is dead code today, and the register
 * is where that intent is recorded until the second input arrives.
 */
function applyDependencyWrite(host: BacklogViewHost, item: BacklogItem, dependsOn: DependsOnDelta): void {
	void host.applySafely([{ file: item.file, dependsOn }]);
}
