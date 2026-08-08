import { App, Menu, Notice } from 'obsidian';
import { BacklogViewHost } from '../host';
import { dependentsClosure } from '../../domain/dependencies';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { linkpathFromRawValue } from '../../domain/noteFields';
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
				.onClick(() => promptRemoveDependency(host, model, item)),
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
 * The note one broken raw entry still names, or null when it names nothing this base
 * can resolve — a self-reference and a cycle both resolve, since the entry is only
 * "broken" as a dependency, not as a link. Factored out so the removal picker below can
 * group by the same answer `declaredPrerequisitePaths` collects, rather than resolving
 * a second time and risking the two disagreeing about what a broken entry names.
 */
function resolveBrokenEntry(app: App, item: BacklogItem, raw: string): string | null {
	const linkpath = linkpathFromRawValue(raw);
	if (linkpath.length === 0) return null;
	return app.metadataCache.getFirstLinkpathDest(linkpath, item.file.path)?.path ?? null;
}

/**
 * Every note `item`'s OWN dependsOn list already names — resolved paths, whether the
 * entry became a real prerequisite or was marked broken (a self-reference, or part of a
 * cycle). A broken entry still names a note: offering it again would be a pick the
 * writer collapses into the same line already on disk, a no-op wearing the shape of an
 * offer. `item.prerequisites` alone is only the entries that resolved AND survived —
 * exactly the set that misses both cases, so this asks the vault the same question
 * `dependsOnWrite.ts` asks when it writes, not a second opinion of it.
 */
function declaredPrerequisitePaths(app: App, item: BacklogItem): string[] {
	const resolved = item.prerequisites.map((p) => p.file.path);
	const broken = item.brokenPrerequisites
		.map((raw) => resolveBrokenEntry(app, item, raw))
		.filter((path): path is string => path !== null);
	return [...resolved, ...broken];
}

/**
 * The notes this item may be made to wait for.
 *
 * Every exclusion here is a pick that would write nothing or refuse: itself, what it
 * already waits for however that entry is spelled or whether it resolved, anything that
 * would close a loop, and every row the Base excluded. Drawn from `model.byPath` — the
 * full item set, unaffected by the focus level — rather than `model.results`: a result
 * the reader cannot currently SEE is still offered, because the focus level and "Show
 * completed items" narrow what is *drawn*, not what exists, and the link is to a note
 * rather than to a row. `outsideFilter` is filtered explicitly here for exactly that
 * reason — `byPath` carries context rows that `results` never did.
 */
function candidates(app: App, model: BacklogModel, item: BacklogItem): BacklogItem[] {
	const declared = new Map(
		[...model.byPath].map(([path, candidate]) => [path, declaredPrerequisitePaths(app, candidate)]),
	);
	// Asked once for the whole menu rather than once per row: naming any item that
	// already waits on this one — at any depth, including through a broken cyclic edge —
	// is what would close a loop.
	const closesLoop = dependentsClosure(item.file.path, declared);
	const already = new Set(declared.get(item.file.path) ?? []);
	return [...model.byPath.values()].filter(
		(candidate) =>
			!candidate.outsideFilter && !closesLoop.has(candidate.file.path) && !already.has(candidate.file.path),
	);
}

function promptAddDependency(host: BacklogViewHost, model: BacklogModel, item: BacklogItem): void {
	const choices: SuggestChoice<BacklogItem>[] = candidates(host.app, model, item).map((candidate) => ({
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
 * each broken entry grouped by the note it still names (or by its raw text when it
 * names nothing at all) — and, when the key is there but holds nothing nameable, the
 * one entry that removes the key.
 *
 * That last case is why this reads the key's presence rather than the parsed list. A
 * value the reader discards entirely still sits on disk, and without a line to pick it
 * would be reachable from nowhere.
 */
function promptRemoveDependency(host: BacklogViewHost, model: BacklogModel, item: BacklogItem): void {
	// A broken entry is grouped by the note it resolves to — a self-reference or a
	// cyclic edge names something real, and `removePath` already collapses every live
	// spelling of one note into a single write, so offering it once here and offering
	// `removePath` is what makes one pick clear every repeat (4c's rule, over the
	// broken path 4b asks for). An entry resolving to nothing has no note to group by,
	// so it keeps `removeRaw`, deduped by its own text — raw text is the only identity
	// it has.
	const brokenPaths = new Set<string>();
	const unresolved = new Set<string>();
	for (const raw of new Set(item.brokenPrerequisites)) {
		const path = resolveBrokenEntry(host.app, item, raw);
		if (path !== null) brokenPaths.add(path);
		else unresolved.add(raw);
	}
	const choices: SuggestChoice<DependsOnDelta>[] = [
		...item.prerequisites.map((prerequisite) => ({
			label: prerequisite.title,
			detail: prerequisite.file.path,
			value: { removePath: prerequisite.file.path },
		})),
		...[...brokenPaths].map((path) => ({
			label: model.byPath.get(path)?.title ?? path,
			detail: path,
			value: { removePath: path },
		})),
		...[...unresolved].map((raw) => ({
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
