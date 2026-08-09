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
 * The note one broken raw entry still names, or null when it names nothing THIS BASE'S
 * MODEL resolves — a self-reference and a cycle both resolve, because domain only ever
 * marks an entry broken that way when its note is one `assignDependencies` kept
 * (`Dependencies as a property` 3b: nothing is loaded to make an entry resolve). Checked
 * against `model.byPath` rather than `getFirstLinkpathDest` alone, or a broken entry
 * naming a real vault note this base never loaded — or the scope prune dropped — would
 * be presented as though the base knows it, which is exactly the "mistyped" reading 3b
 * forbids. Factored out so the removal picker below can group by the same answer
 * `declaredPrerequisitePaths` collects, rather than resolving a second time and risking
 * the two disagreeing about what a broken entry names.
 */
function resolveBrokenEntry(app: App, model: BacklogModel, item: BacklogItem, raw: string): BacklogItem | null {
	const linkpath = linkpathFromRawValue(raw);
	if (linkpath.length === 0) return null;
	const path = app.metadataCache.getFirstLinkpathDest(linkpath, item.file.path)?.path ?? null;
	return path === null ? null : (model.byPath.get(path) ?? null);
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
function declaredPrerequisitePaths(app: App, model: BacklogModel, item: BacklogItem): string[] {
	const resolved = item.prerequisites.map((p) => p.file.path);
	const broken = item.brokenPrerequisites
		.map((raw) => resolveBrokenEntry(app, model, item, raw))
		.filter((target): target is BacklogItem => target !== null)
		.map((target) => target.file.path);
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
		[...model.byPath].map(([path, candidate]) => [path, declaredPrerequisitePaths(app, model, candidate)]),
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
		onChoose: (choice) => {
			// The row that built this list can be a refresh behind the note: the graph may
			// have changed while the suggester was open, so legality is asked again of the
			// CURRENT model rather than trusted from when the menu opened — `host.model` may
			// have been rebuilt since, and reusing `candidates` here is what keeps this one
			// rule rather than a second opinion of it (the same rule `dependsOnWrite.ts`'s
			// own `add` arm keeps at the write boundary).
			//
			// Matched on the FILE, not its path, for the reason `applyDependencyWrite`
			// states about the source: a note deleted and another created at the same
			// path would satisfy a path compare while `choice.file` stayed detached, and
			// the link written from it would name a note the user never picked.
			const current = host.model;
			const stillLegal = current !== null && candidates(host.app, current, item).some((c) => c.file === choice.file);
			if (!stillLegal) {
				new Notice('That note changed while the picker was open, so nothing was written.');
				return;
			}
			applyDependencyWrite(host, item, { add: choice.file });
		},
	}).open();
}

/**
 * What clearing one prerequisite line means, asked when the pick LANDS rather than when
 * the list was drawn.
 *
 * The question is deliberately about the SOURCE, not the target: `removePath` and
 * `removeRaw` both match against what this note's own list currently holds, so the only
 * thing that makes a pick effective is that the live list still holds a line it matches.
 * Asking the live source is therefore the same question the writer will ask, one moment
 * earlier, and it covers every way a pick goes stale in one test rather than one guard
 * per way — the note renamed (the entry Obsidian rewrote still resolves to the same
 * mutated file, so it still matches), the note deleted or replaced (nothing resolves to
 * it, so nothing matches), the entry removed or respelled by hand (the raw text is gone).
 *
 * Null when nothing matches, which the caller reports. Silence is the thing refused: a
 * pick that cannot do what it says has to say so, or the picker closes and the reader is
 * left believing a removal happened. The alternative — letting the write go through and
 * surfacing the writer's own no-op — is what `docs/issues/The outcome report was built
 * from one sentence.md` refuses, and for the same reason: nothing here correlates a
 * Bases pass with a write.
 */
function removalOf(host: BacklogViewHost, source: BacklogItem, target: BacklogItem): () => DependsOnDelta | null {
	return () => {
		const model = host.model;
		const live = model && liveSource(model, source);
		if (!model || !live) return null;
		// `declaredPrerequisitePaths` is the same answer the picker was BUILT from, asked
		// again of the live row — so "would this pick still match a line" is one rule
		// rather than a second opinion of it. The path is read off the target's file here
		// rather than captured, so a rename is followed: same object, new path, and the
		// entry Obsidian rewrote resolves to it.
		return declaredPrerequisitePaths(host.app, model, live).includes(target.file.path)
			? { removePath: target.file.path }
			: null;
	};
}

/** The same question for an entry that resolves to nothing: its raw text is its identity,
 *  so the live list is asked whether that exact line is still on it. */
function removalOfRaw(host: BacklogViewHost, source: BacklogItem, raw: string): () => DependsOnDelta | null {
	return () => {
		const live = host.model && liveSource(host.model, source);
		return live?.brokenPrerequisites.includes(raw) === true ? { removeRaw: raw } : null;
	};
}

/**
 * The same question for the whole-key removal, which is the arm with no line to match:
 * what it offers to take away is the KEY, so what has to still be true is the state that
 * produced the offer — the key present, and holding nothing the reader can name. An
 * external edit ends that in either direction, by deleting the key or by giving it a real
 * dependency, and both make this pick a write that changes nothing.
 *
 * `applyDependsOnDelta`'s own `removeKey` arm already refuses the second case at the write
 * boundary, so nothing here prevents a bad write. What it prevents is the SILENCE: without
 * it the picker closes on a refusal the reader never sees, which is the one outcome 2e
 * refuses.
 */
function removalOfKey(host: BacklogViewHost, source: BacklogItem): () => DependsOnDelta | null {
	return () => {
		const live = host.model && liveSource(host.model, source);
		if (!live?.ownKeys.dependsOn) return null;
		const nameable = live.prerequisites.length > 0 || live.brokenPrerequisites.length > 0;
		return nameable ? null : { removeKey: true };
	};
}

/**
 * The item as the CURRENT model has it, or null — never the snapshot the menu closed
 * over. By FILE rather than by path, the distinction `applyDependencyWrite` states: a
 * rename carries the same object to a new path, a replacement puts a different object
 * at the old one.
 */
function liveSource(model: BacklogModel, source: BacklogItem): BacklogItem | null {
	const live = model.byPath.get(source.file.path);
	return live?.file === source.file ? live : null;
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
	const broken = new Set<BacklogItem>();
	const unresolved = new Set<string>();
	for (const raw of new Set(item.brokenPrerequisites)) {
		const target = resolveBrokenEntry(host.app, model, item, raw);
		if (target !== null) broken.add(target);
		else unresolved.add(raw);
	}
	// Each choice is a delta the pick BUILDS, not one the list captured — see
	// `removalOf` for what that buys and what it refuses. A raw entry needs none of it:
	// its text is the only identity it has, and nothing that happens to a note can
	// change what a line SAYS.
	const choices: SuggestChoice<() => DependsOnDelta | null>[] = [
		...[...item.prerequisites, ...broken].map((target) => ({
			label: target.title,
			detail: target.file.path,
			value: removalOf(host, item, target),
		})),
		...[...unresolved].map((raw) => ({
			label: raw,
			detail: 'Does not resolve in this base',
			value: removalOfRaw(host, item, raw),
		})),
	];
	if (choices.length === 0) {
		choices.push({ label: 'Remove the empty property', value: removalOfKey(host, item) });
	}
	new ItemSuggestModal(host.app, {
		placeholder: `Stop ${item.title} waiting for…`,
		choices,
		onChoose: (plan) => {
			const delta = plan();
			if (delta === null) {
				new Notice('That note changed while the picker was open, so nothing was written.');
				return;
			}
			applyDependencyWrite(host, item, delta);
		},
	}).open();
}

/**
 * The one place a dependency write is planned and applied.
 *
 * Deliberately not exported yet. `Draw a dependency between bars` will call it rather
 * than plan beside it — one move, several inputs, one place the batch is made — but a
 * symbol exported for a caller that does not exist is dead code today, and the register
 * is where that intent is recorded until the second input arrives.
 *
 * Rechecks the SOURCE — the item the menu was opened on, not the candidate `onChoose`
 * already re-asks `candidates` about — against `host.model` read fresh here, not the
 * `model` closed over when the menu opened: a suggester left open is exactly the window
 * an external edit can use to drop this note out of the Base's results entirely, and
 * `applySafely`'s own `outsideFilter` test only catches a row still in `byPath` — never
 * one missing from it altogether. Shared by both entries because both plan through here:
 * the add path's own recheck only asks whether the PAIR is still legal, and the removal
 * path asks nothing at all, so neither on its own would have caught this.
 *
 * The recheck is by FILE IDENTITY, not by path: a note deleted and another created at
 * the same path puts a REPLACEMENT in `byPath`, which a path-only test waves through
 * while the batch still carries the captured — now detached — `TFile`. A rename is the
 * case this must not refuse, and does not: Obsidian mutates the one `TFile` in place
 * rather than minting a new one, so the object the menu captured is the object the
 * refreshed model holds, under whatever path it now has.
 */
function applyDependencyWrite(host: BacklogViewHost, item: BacklogItem, dependsOn: DependsOnDelta): void {
	const source = host.model?.byPath.get(item.file.path);
	if (source === undefined || source.outsideFilter || source.file !== item.file) {
		new Notice('That note changed while the picker was open, so nothing was written.');
		return;
	}
	void host.applySafely([{ file: item.file, dependsOn }]);
}
