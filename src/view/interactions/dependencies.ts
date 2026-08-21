import { App, Menu, Notice, TFile } from 'obsidian';
import { BacklogViewHost } from '../host';
import { dependentsClosure } from '../../domain/dependencies';
import { BacklogItem, BacklogModel } from '../../domain/model';
import { isMarkerType } from '../../domain/itemTypes';
import { linkpathFromRawValue, readLinkList } from '../../domain/noteFields';
import { adoptableProperties } from '../../domain/optionalProperties';
import { configProblems } from '../../domain/settingsConsistency';
import { resolveSettings } from '../../domain/settingsResolve';
import { ItemSuggestModal, SuggestChoice } from '../../ui/itemSuggest';
import { DependsOnDelta } from '../../domain/writePlan';
import { t } from '../../i18n/t';

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
	// A marker waits for nothing, so neither entry belongs on one: a milestone is a point
	// in time. Both halves go, not just the first — `Remove dependency…` would open on the
	// empty list `readItems` now gives a marker, which is an entry that cannot act.
	// A marker may still BE waited for, and that is expressed from the other end: its own
	// connector stays, because dragging FROM it is how another bar comes to wait on it.
	if (isMarkerType(item.typeName)) return;
	menu.addItem((mi) =>
		mi
			.setTitle(t('dependency.dependsOn'))
			.setIcon('link')
			.onClick(() => promptAddDependency(host, model, item)),
	);
	// Gated on the KEY's presence, never on what the reader parsed out of it: a value
	// that reads as no dependencies is still a value on disk, and a control keyed to the
	// parsed list could not offer to remove what the parser discarded.
	if (item.ownKeys.dependsOn) {
		menu.addItem((mi) =>
			mi
				.setTitle(t('dependency.remove'))
				.setIcon('unlink')
				.onClick(() => promptRemoveDependency(host, model, item)),
		);
	}
}

/**
 * Whether the feature belongs on this row at all.
 *
 * This used to be the configured key and nothing else, which withheld the menu pair, the
 * connector and the drag from every base that had never named the property — and left the
 * only route to naming one running through ✨ or a hand-edited note, since Obsidian's own
 * picker offers the properties a vault HAS. A property no note carries cannot be picked,
 * and a property nothing names cannot be written to a note, so the feature gated itself
 * shut. The write binds the key now ([[Bind a property by using it]]), and the question
 * this asks is therefore whether a key could exist rather than whether one does.
 *
 * What it still refuses is the option the user CLEARED. `adoptableProperties` carries that
 * rule — turning a property off is a decision, and cleared reads identically to never-set
 * in the resolved settings, which is why the CONFIG is asked — and the one other case it
 * refuses comes free with it: a suggestion whose key another property already owns is not
 * adoptable, so the feature is absent rather than offering a control whose write would be
 * reported as a collision. Both leave an entry that would write nothing unoffered, which
 * is the rule [[Linking two items]] states for this menu.
 *
 * The context-row half is deliberately NOT repeated here — `buildItemMenu` adds these
 * inside its `editable` block with every other entry that edits the row's own
 * frontmatter, so a second `outsideFilter` test would be a second statement of one rule,
 * and the kind that goes on reading as a guarantee after the real guard moves.
 */
export function dependenciesAvailable(host: BacklogViewHost): boolean {
	return adoptedKey(host) !== '';
}

/**
 * The frontmatter key a dependency write from this view would land in: the bound one, or
 * the one the first write will bind ([[Bind a property by using it]]). '' exactly when
 * nothing may be written at all, which is what makes it the availability test above.
 *
 * It exists because every legality question here has to be asked of the graph the WRITE
 * will see, not of the one the model happens to hold. Those are the same key once the
 * option is bound and different keys before it, and asking the model's meant asking a
 * graph with no edges in it — `dependsOn` is suggested precisely because the Tasks plugin
 * already uses that name, so a vault carrying it in a base that has never bound it is the
 * vault this feature was designed to meet. There, everything was legal: the menu offered a
 * note that already waits on the one being edited, and the drag marked no bar illegal and
 * then refused the drop. (Codex, PR #128.)
 */
function adoptedKey(host: BacklogViewHost): string {
	if (host.settings.dependsOnKey !== '') return host.settings.dependsOnKey;
	return adoptableProperties(host.config, host.settings, 'dependsOn')[0]?.suggested ?? '';
}

/**
 * Bind the dependency property, if this is the first time anything asked to write one.
 *
 * `configProblems` is asked BEFORE the `.base` is touched, which is `runInit`'s own rule
 * and for its reason: an action that changed the configuration and then had every write
 * refused would leave the view worse than it found it. `applySafely` would refuse the
 * batch either way; what this adds is that the refusal costs no configuration change.
 *
 * The second guard is for the window between the control being drawn and the pick
 * landing. `dependenciesAvailable` was true when the menu was built, so the property was
 * adoptable then — an edit to the `.base` since (clearing the option, or pointing another
 * property at `dependsOn`) can end that while a suggester sits open, which is the same
 * staleness every other pick here re-asks for rather than assumes away.
 *
 * Returns false when nothing may be bound, having said why. Only the ADD path can reach
 * either guard: a removal is offered on the key's presence, which an unbound key cannot
 * have.
 */
function bindDependencyKey(host: BacklogViewHost): boolean {
	if (host.settings.dependsOnKey !== '') return true;
	// Resolved from the live CONFIG, never taken from `host.settings`, which is a snapshot
	// from the last refresh. `adoptDefaultProperties` reads the config for "is this option
	// set" and the settings for "which keys are taken", so a stale half lets a property
	// pointed at `dependsOn` since the menu opened be skipped without its key joining
	// `taken` — and this key is then bound onto it, which is the collision that blocks
	// every write in the view. The two halves have to come from one moment; this is the
	// one where the `.base` is about to be written. (Codex, PR #128.)
	const problems = configProblems(resolveSettings(host.config));
	if (problems.length > 0) {
		new Notice(t('config.fixFirst', { problem: problems[0] }));
		return false;
	}
	const bound = host.adoptDefaultProperties('dependsOn')[0];
	if (bound === undefined) {
		new Notice(t('dependency.propertyChanged'));
		return false;
	}
	// After the fact rather than in front of the gesture: the `.base` changed for everyone
	// who opens this view, so it is never silent — but a confirmation in front of a drag
	// would put a dialog on the common path, to buy a decision that clearing the option
	// takes back in one click.
	new Notice(t('dependency.setUp', { property: bound.suggested }));
	return true;
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
 * Every item's own declared prerequisite paths, in one pass.
 *
 * Hoisted out of `candidates` so a sweep that asks the question of every row builds this
 * once rather than once per row. `candidates` still defaults to building its own, so the
 * two menu callers are unchanged and cannot fall out of step with the sweep — there is
 * one definition of "what this note declares", not a fast one and a careful one.
 */
function declaredMap(host: BacklogViewHost, model: BacklogModel): Map<string, string[]> {
	const key = adoptedKey(host);
	const parsed = key === host.settings.dependsOnKey;
	return new Map(
		[...model.byPath].map(([path, item]) => [
			path,
			parsed ? declaredPrerequisitePaths(host.app, model, item) : adoptedPrerequisitePaths(host.app, model, item, key),
		]),
	);
}

/**
 * The same list for a key nothing has bound yet, read off the note rather than off the
 * model — which parsed a key that is still `''` and so holds no entries at all.
 *
 * The two rules `readItems.ts` keeps at its own read are kept here too, at the same
 * forbidden thing: a context row never declares (an excluded note may be named and may
 * never do the naming) and neither does a marker (a milestone is a point in time, so it
 * waits for nothing). Restating them is the price of reading a second key; deriving this
 * from the model instead is what is not available, since the model has not read it.
 *
 * Entries that resolve outside this base are dropped, which is what makes the result the
 * same SHAPE as `declaredPrerequisitePaths` — both answer "every note this one names that
 * this base's model resolves", so `dependentsClosure` sees one kind of graph.
 */
function adoptedPrerequisitePaths(app: App, model: BacklogModel, item: BacklogItem, key: string): string[] {
	if (item.outsideFilter || isMarkerType(item.typeName)) return [];
	return readLinkList(app, item.file, app.metadataCache.getFileCache(item.file), key)
		.map((entry) => entry.file?.path)
		.filter((path): path is string => path !== undefined && model.byPath.has(path));
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
function candidates(
	host: BacklogViewHost,
	model: BacklogModel,
	item: BacklogItem,
	declared: Map<string, string[]> = declaredMap(host, model),
): BacklogItem[] {
	// Asked once for the whole menu rather than once per row: naming any item that
	// already waits on this one — at any depth, including through a broken cyclic edge —
	// is what would close a loop.
	// A marker declares nothing (`readItems.ts` states the rule at the read), so it has
	// no candidates — which is also what keeps it out of `legalTargetPaths`: dragging ONTO
	// a bar writes to that bar, and a milestone is never the one that waits.
	if (isMarkerType(item.typeName)) return [];
	const closesLoop = dependentsClosure(item.file.path, declared);
	const already = new Set(declared.get(item.file.path) ?? []);
	return [...model.byPath.values()].filter(
		(candidate) =>
			!candidate.outsideFilter && !closesLoop.has(candidate.file.path) && !already.has(candidate.file.path),
	);
}

/**
 * Every note a link drag from `source` may be dropped ONTO.
 *
 * Dragging S onto T writes to T — T is the one that waits — so T is legal exactly when S
 * is a legal prerequisite FOR T. That is `candidates` asked from the other end, and it is
 * asked rather than restated: three of the four exclusions (self, already declared
 * however spelled, would close a loop) have one definition here, `candidates(target)`,
 * and a second formulation beside it is what drifts. Stating it as "something it already
 * waits for" is the MENU's sentence, where the item under the cursor is the dependent;
 * here the dependent is the one dropped onto, and the same words name the wrong end.
 *
 * The fourth — outside the filter — is NOT inherited from `candidates`, and cannot be:
 * `candidates(target)` filters `outsideFilter` on the CANDIDATE side, which constrains
 * what may be offered TO `target`, never whether `target` itself is a context row. The
 * mirror formula needs that question asked of `target` directly, which is what the
 * `!target.outsideFilter` guard below is for — dropping it would let a context row be
 * reported as a legal drop destination, contradicting the root rule that such a row is
 * never a write target. `applySafely`'s structural refusal is still the backstop against
 * an actual write landing there; this guard is about the DRAG's affordance agreeing with
 * that rule rather than offering a target the write path would refuse anyway.
 *
 * One `declaredMap` for the whole sweep, so a target costs one closure walk rather than a
 * rebuild plus a walk.
 *
 * Matched on `.file`, not on the path, for the reason `applyDependencyWrite` states: a
 * note deleted and another created at the same path satisfies a path compare while being
 * a different note.
 */
export function legalTargets(host: BacklogViewHost, model: BacklogModel, source: BacklogItem): Set<TFile> {
	const declared = declaredMap(host, model);
	const legal = new Set<TFile>();
	for (const target of model.byPath.values()) {
		if (target.outsideFilter) continue;
		if (candidates(host, model, target, declared).some((c) => c.file === source.file)) legal.add(target.file);
	}
	return legal;
}

function promptAddDependency(host: BacklogViewHost, model: BacklogModel, item: BacklogItem): void {
	const choices: SuggestChoice<BacklogItem>[] = candidates(host, model, item).map((candidate) => ({
		label: candidate.title,
		detail: candidate.file.path,
		value: candidate,
	}));
	if (choices.length === 0) {
		// A fact about the plan, not an empty picker — which reads as a broken picker.
		new Notice(t('dependency.noneLeft'));
		return;
	}
	new ItemSuggestModal(host.app, {
		placeholder: t('dependency.addPlaceholder', { title: item.title }),
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
			const stillLegal = current !== null && candidates(host, current, item).some((c) => c.file === choice.file);
			if (!stillLegal) {
				new Notice(t('dependency.noteChanged'));
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
		// The TARGET has to still be the note that was offered, not merely something at
		// its path. `declaredPrerequisitePaths` below answers "does the source still name
		// this path", which a replacement satisfies — the live link resolves to it — so on
		// its own it would clear a dependency on a note nobody picked. 2e's replacement
		// rule, which the add path and the source check already keep, asked of the third
		// place a pick names a note. Consolidating the stale-pick guards into one question
		// is what dropped it: the question I kept is about the SOURCE's list, and this one
		// is about the target's identity.
		if (model.byPath.get(target.file.path)?.file !== target.file) return null;
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
			detail: t('dependency.unresolved'),
			value: removalOfRaw(host, item, raw),
		})),
	];
	if (choices.length === 0) {
		choices.push({ label: t('dependency.removeEmpty'), value: removalOfKey(host, item) });
	}
	new ItemSuggestModal(host.app, {
		placeholder: t('dependency.removePlaceholder', { title: item.title }),
		choices,
		onChoose: (plan) => {
			const delta = plan();
			if (delta === null) {
				new Notice(t('dependency.noteChanged'));
				return;
			}
			applyDependencyWrite(host, item, delta);
		},
	}).open();
}

/**
 * The one place a dependency write is planned and applied.
 *
 * Exported for `interactions/linkDrag.ts`, which CALLS it rather than planning beside it:
 * one move, two inputs, one place the batch is made. Adding a third input means calling
 * this, never writing a second plan next to it.
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
 *
 * **The binding no longer changes any answer given before it**, and that is what removed
 * the recheck that used to sit here. Binding rebuilds the model over edges that were
 * invisible while nothing named the property — so a legality question asked of the MODEL
 * before it was asked of a graph with nothing in it, and a pick that closed a loop in the
 * vault's existing `dependsOn` was offered and then had to be refused after the fact. The
 * answer is `adoptedKey`: every legality question here is asked of the key the write will
 * land in, bound or about to be, so the offer and the sweep already see the edges the
 * binding is going to reveal and neither one claims them legal. Refusing after the
 * gesture — which for the drag meant marking no bar illegal and then rejecting the drop —
 * was the thing to remove, not the thing to state better. (Codex, PR #128.)
 */
export function applyDependencyWrite(host: BacklogViewHost, item: BacklogItem, dependsOn: DependsOnDelta): void {
	const source = host.model?.byPath.get(item.file.path);
	if (source === undefined || source.outsideFilter || source.file !== item.file) {
		// Worded for both callers: the picker's own two Notices above are still true only
		// of the picker (the window this one names is a suggester staying open), but this
		// one is reached from the drag too, which has no picker to have stayed open.
		new Notice(t('dependency.noteChangedBeforeWrite'));
		return;
	}
	// After the recheck and before the write: binding rebuilds the model, so doing it
	// first would leave the check above reading a model this function had already
	// replaced — and binding for a write that then turns out to be refused would change
	// the `.base` for nothing.
	if (!bindDependencyKey(host)) return;
	void host.applySafely([{ file: item.file, dependsOn }]);
}
