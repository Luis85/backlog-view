import { App, BasesEntry } from 'obsidian';
import { Absence } from './absences';
import { inferFolderParent } from './folderNotes';
import { DependencyNode, resolveDependencies } from './dependencies';
import { createItems, namedTargets, RawItem, RawStore, ResourceNote } from './readItems';
import {
	childLevelIndex,
	EXTRA_TYPE_RANK,
	focusTarget,
	inCatalog,
	isDeliverableType,
	isIterationType,
	isReleaseType,
	isExtraType,
	isMarkerType,
	ladderFor,
} from './itemTypes';
import {
	CivilDate,
} from './noteFields';
import { BacklogSettings } from './settings';
import { ALL_TYPES, LEVELS } from './typeVocabulary';
import { assertResolvedSettings } from './settingsConsistency';
import { earliest, latest, reversedSpan } from './timeline';
import {
	collectObservedAssignees,
	collectObservedDeliverableStates,
	collectObservedHorizons,
	collectObservedStates,
	collectObservedTags,
	collectObservedTestStates,
} from './vocabulary';

/**
 * The model is built in three phases, and each has its own type. A field exists only
 * once the phase that owns it has run, so a function's parameter type says which
 * fields are real yet and the compiler enforces it — where this used to be 10
 * placeholder values and a paragraph of prose asking readers to remember.
 *
 * `RawItem` → `LinkedItem` → `BacklogItem`, each extending the one before. Consumers
 * outside this module only ever meet `BacklogItem`, so nothing downstream changes.
 */

/**
 * Phase 2 — the tree exists: parent links resolved against the loaded set, folder
 * inference applied, cycles broken. Everything about *shape*, nothing yet about
 * position: an item knows its parent but not how deep it sits or what level it is.
 */
interface LinkedItem extends RawItem {
	parent: LinkedItem | null;
	children: LinkedItem[];
	/** True when a parent value exists but doesn't resolve to an item in this view. */
	orphan: boolean;
}

/**
 * Phase 3 — everything derived from an item's position in the finished tree: levels,
 * visual depth, and the rollups counted back up from the leaves. This is the only
 * phase anything outside `model.ts` ever sees.
 */
export interface BacklogItem extends LinkedItem {
	parent: BacklogItem | null;
	children: BacklogItem[];
	/** Visual depth in the rendered tree (0 for rendered roots, focused or not). */
	depth: number;
	/** Index into {@link BacklogItem.ladder}; -1 when typeName does not name a rung of it. */
	levelIndex: number;
	/**
	 * Which ladder this item is on — `LEVELS` or `TEST_LEVELS` (`itemTypes.ts`). It is
	 * also this view's whole answer to which PROJECTION the item belongs to: `inCatalog`
	 * asks nothing else, so the catalog and the plan cannot disagree about a row.
	 */
	ladder: string[];
	/**
	 * The ladder position this item occupies, chained down the parent levels.
	 * Equals levelIndex for known types; for unknown or missing types it is one
	 * below the parent's effective level. Children derive their level from this,
	 * never from tree depth, so custom types and focus re-rooting can't skew it.
	 */
	effectiveLevelIndex: number;
	/** True when the level was derived from the parent chain because typeName is missing. */
	impliedType: boolean;
	/** True when this item heads the rendered tree only because of the focus level. */
	focusRoot: boolean;
	descendantCount: number;
	/** Number of descendants counting as done. */
	doneDescendants: number;
	/** True when the item and every descendant are done — the unit hidden by "Show completed items". */
	subtreeDone: boolean;
	/**
	 * Earliest start and latest target stated by a RESULT below this item — the
	 * evidence a dateless parent's bar is inferred from, never a value written
	 * anywhere. Null when nothing below states a date of that kind. Gathered by
	 * the same walk and the same exclusion as the progress counts: a context
	 * row's own dates are not this base's plan, though the results beneath it are.
	 */
	descendantStart: CivilDate | null;
	descendantTarget: CivilDate | null;
	/**
	 * The items this one waits for, collapsed to one per note. Assigned by a pass after
	 * `assignAll` — the last phase, because an entry may only resolve against the set
	 * the model KEEPS, which the scope prune decides. Empty when the key is
	 * unconfigured, which is not a special case but the truth: no note declares one.
	 */
	prerequisites: BacklogItem[];
	/** Raw text of every declared entry that became no edge — see `dependencies.ts`. */
	brokenPrerequisites: string[];
}

/**
 * One projection's population: what it roots at, every row it draws, and the results
 * among those. The plan publishes its three as `roots`/`items`/`results` (the names every
 * consumer already reads); the catalog publishes them together under `catalog`.
 */
export interface ProjectionPopulation {
	roots: BacklogItem[];
	items: BacklogItem[];
	results: BacklogItem[];
	/** Distinct state values this population carries: open states first, then done, both alphabetical. */
	observedStates: string[];
	/** Distinct horizon values this population carries, in first-seen order. */
	observedHorizons: string[];
	/** Distinct tags this population carries, alphabetical. */
	observedTags: string[];
	/** Distinct assignees this population carries, alphabetical. */
	observedAssignees: string[];
}

export interface BacklogModel {
	/** Roots of the rendered tree — synthetic focus rows when a focus level is active. */
	roots: BacklogItem[];
	/**
	 * Roots of the full hierarchy, regardless of focus. Data operations (backfill,
	 * ranking parentless items) must use these; only rendering uses `roots`.
	 */
	realRoots: BacklogItem[];
	byPath: Map<string, BacklogItem>;
	/** All rendered rows in depth-first (visual) order — including context rows. */
	items: BacklogItem[];
	/**
	 * The rendered rows the Bases query actually returned. Anything describing *this
	 * base* — counts, the level breakdown, how much is hidden — must use this, or
	 * ancestors loaded only for context inflate the answer.
	 */
	results: BacklogItem[];
	/**
	 * Every Deliverable-typed result in the base, regardless of any active focus level —
	 * the Deliverables board's own population. Unlike `results`, which a focus level
	 * re-roots to one subtree (`collectFocusRoots`), this is read off the whole,
	 * unfocused tree, so no OTHER type being focused elsewhere can narrow it. Excludes
	 * `outsideFilter` items, same as `results`.
	 */
	deliverableResults: BacklogItem[];
	/**
	 * Every `Iteration` result in the base — the roadmap's grid axes' own population,
	 * parallel to `results` rather than a wider version of it. `inPlan` still refuses an
	 * `Iteration` everywhere `projectionForest` builds `roots`/`items`/`results` from —
	 * "the forest and the hiding must agree" (see `inPlan`'s own comment) stays true for
	 * the plan's forest, which is exactly what keeps the tree, both boards, the catalog and
	 * the toolbar's counts untouched by this admission. `roadmapRows` (`domain/roadmap.ts`)
	 * is the one reader, and only for a GRID axis (`drawsGrid`) — the horizons axis and
	 * everything off the roadmap never consult it. Read off `items` — `assignAll`'s whole,
	 * unfocused tree — for `deliverableResults`' own reason: which iterations exist is a
	 * fact about the whole base, not about whichever subtree a focus level set on another
	 * projection happens to be narrowing. Excludes `outsideFilter` items, same as `results`
	 * and `deliverableResults` — an iteration the Base excluded is not this base's to place.
	 */
	iterations: BacklogItem[];
	/**
	 * Every `Release` result in the base — the release view's own population, parallel to
	 * `results` rather than a wider version of it. Read off `items`, the whole unfocused
	 * tree, for `iterations`' own reason: which releases exist is a fact about the base,
	 * not about whichever subtree a focus level set on another projection is narrowing.
	 * Excludes `outsideFilter` items, same as `results` and `iterations` — a release the
	 * Base excluded is not this base's to list. It used to be a guarantee about THIS field
	 * only — a hand-written parent link still seats a release in the TREE, since
	 * `linkAll`/`loadOutsideParents` are not type-gated and neither drops that edge, and it
	 * was drawn there. `inPlan` refuses EVERY release now, excluded or not, so a release is
	 * a row of no projection of the backlog view: the edge stays (the rollup walk needs it)
	 * and the membership goes. This field is unaffected by that, and deliberately — it is
	 * the one place a release still exists to be listed.
	 *
	 * **The `items` named above is `buildModel`'s LOCAL — `assignAll`'s whole tree — and not
	 * {@link BacklogModel.items} beside it, which is the rendered rows and holds no release
	 * at all.** The two are spelled the same and answer differently, which is the reading a
	 * consumer of this interface would get wrong: filtering the published `items` for
	 * releases finds none, and this field is why nothing has to.
	 */
	releases: BacklogItem[];
	/**
	 * The test catalog's own forest — its rendered roots, every row beneath them, and the
	 * results among those. Computed by the same rule `roots`/`items`/`results` are, with
	 * the opposite membership predicate, and off the whole UNFOCUSED tree so a focus level
	 * set for the plan cannot narrow a projection that ignores it.
	 */
	catalog: ProjectionPopulation;
	/** True when a focus level restricts the rendered tree. */
	focused: boolean;
	/** Distinct state values in the result set: open states first, then done, both alphabetical. */
	observedStates: string[];
	/** Distinct horizon values in the result set, in first-seen order — the buckets it mints. */
	observedHorizons: string[];
	/** Distinct tags in the result set, alphabetical — the vocabulary the tag menus offer. */
	observedTags: string[];
	/**
	 * Distinct assignees in the result set, alphabetical. No longer what Set assignee
	 * offers (Task 4, 2026-08-28: that menu reads `resources` instead), and no other
	 * reader has taken its place — `deriveLanes` mints a resource's row from
	 * `assigneeName(item)` directly, per item, never from this list. Retained only
	 * because Task 7 owns deleting it, alongside `collectObservedAssignees`.
	 */
	observedAssignees: string[];
	/** Distinct Deliverable-workflow state values, scoped to Deliverable items. */
	observedDeliverableStates: string[];
	/** Notes the base returned that are not backlog items (see `pruneOutsideHierarchy`). */
	ignoredCount: number;
	/**
	 * Every absence the Base returned, read but never made into an item — see
	 * `src/domain/absences.ts`. Beside the items rather than among them: nothing that
	 * walks the tree, ranks siblings, counts a rollup or draws a projection may meet one,
	 * and the only reader is the resources axis's own row derivation.
	 */
	absences: Absence[];
	/**
	 * The `Resource` notes the base returned, sorted by name — the roster the assignee
	 * menu offers and the roadmap draws a row per. Never items: see `readItems`'
	 * `divertResource`.
	 */
	resources: ResourceNote[];
	/**
	 * Every resource's OWN path, mapped to the label {@link namedTargets} gives it —
	 * built once here, alongside `resources`, rather than asked of `namedTargets` again
	 * at every row. `assigneeBroken` and the assignee chip's label both used to scan
	 * `resources` per row (`.some`/`.find`), an O(items × resources) allocation-per-row
	 * cost this codebase's row-cost rule refuses a second superlinear pass over — see
	 * `docs/domain/CLAUDE.md`'s cost section and
	 * `docs/requirements/A row costs its content, not its wiring.md`. A `Map.has`/`.get`
	 * against this index is O(1) instead, and `namedTargets` already has to run once here
	 * regardless, to sort `resources` disambiguated the same way. Read through
	 * `resourceLabelsOf` (`readItems.ts`) rather than directly, so "no model yet" is
	 * answered once.
	 */
	resourceLabels: ReadonlyMap<string, string>;
}

export function buildModel(app: App, entries: BasesEntry[], settings: BacklogSettings): BacklogModel {
	assertResolvedSettings(settings);
	const store = createItems(app, entries, settings);
	const linked = linkAll(store, settings);
	breakCycles(linked);
	const ignoredCount = settings.hierarchyOnly ? pruneOutsideHierarchy(linked, settings) : 0;
	// Read off the linked phase, where main put it and where it still belongs: a
	// Deliverable is an extra type, so it is never a catalog member and this one
	// vocabulary needs no membership question asked of it. The other four do, and
	// `ladder` is not assigned until `assignAll`, so they are taken below.
	const observedDeliverableStates = collectObservedDeliverableStates(linked.all, settings);
	sortSiblingsDeep(linked.roots);
	const { roots, byPath, items } = assignAll(linked, settings);
	assignDependencies(items);

	// A focus level re-roots the rendered tree at the topmost items of that level,
	// mirroring the per-level backlogs (Epics / Features / Stories) of Azure DevOps.
	const focus = focusTarget(settings);
	const focusIdx = focus ? LEVELS.findIndex((l) => l.toLowerCase() === focus.toLowerCase()) : -1;
	// A focus naming an EXTRA type re-roots at that type by name: it has no rung to
	// match, and "show me the bugs" is the same question as "show me the PBIs".
	const focusExtra = focusIdx < 0 && focus ? focus.toLowerCase() : '';
	// Sorted through `localeCompare` — the collation `collectObservedAssignees` already
	// uses, which follows the USER's locale because a name is data. The path tie-break
	// matters: `localeCompare` returns 0 for two resources sharing a basename, and
	// `Array.sort` is stable, so without it two such resources would come back in
	// whatever order the Base's own query happened to return them — alphabetical order
	// was chosen over Base order BECAUSE it stays put when a Base's sort changes, and an
	// untied collision is the one case that promise did not hold.
	const resources = [...store.resources].sort(
		(a, b) => a.title.localeCompare(b.title) || a.file.path.localeCompare(b.file.path),
	);
	// One pass, here, rather than one `.some`/`.find` per row: see `BacklogModel.resourceLabels`.
	const resourceLabels: ReadonlyMap<string, string> = new Map(
		namedTargets(resources).map((target) => [target.item.file.path, target.label]),
	);
	const rest = {
		realRoots: roots,
		byPath,
		// The PLAN's vocabulary — the whole unfocused tree minus the catalog, and minus a
		// release. All three halves matter: unfocused, so what a menu offers never narrows
		// with what is on screen; minus the catalog, so a value only a test carries cannot
		// reach a plan row's Set state, a plan row's Set horizon, or a board column no plan
		// card could land in; and minus a release for that same reason arriving from a new
		// direction — `inPlan` stopped drawing one anywhere in this view, so a status only
		// a release carries is a value no plan row can show, and the register's own rule is
		// that a row this base does not draw is not this base's vocabulary. Without it a
		// release's `Planned` was offered when setting a PBI's state and printed into the
		// generated README. Reported by review on PR #203.
		//
		// **`isReleaseType` rather than `inPlan`, and the difference is a ruling not an
		// oversight.** `inPlan` also refuses an `Iteration`, which has been excluded from
		// this forest since long before releases were and whose status has leaked here just
		// as long. Sweeping both in one predicate would drop sprint-only status values from
		// work-item menus — defensible by the same rule, a behaviour change this increment
		// did not cause, and wrong for a vault that shares its status vocabulary between
		// sprints and stories. Ruled releases-only on 2026-08-25; the iteration half is
		// recorded in `docs/issues/A release is refused in several places.md`, which is where
		// the vocabulary rule gets decided once rather than twice under a review comment.
		//
		// The POPULATION, never a list of type names: `firstSeen` reads every non-context
		// item, so a rule spelled "skip test items" would leave a `Task` beneath a
		// `Test case` free to mint that column anyway. The release term is the exception
		// that proves it and not a breach — a release has no ladder position for a
		// population rule to reach it by, which is the whole reason it needed its own.
		...vocabularyOf(
			items.filter((item) => !inCatalog(item) && !isReleaseType(item.typeName)),
			settings,
			false,
		),
		observedDeliverableStates,
		// Read off `items` — the whole tree `assignAll` just built, before either branch
		// below narrows anything to a focus subtree. See `BacklogModel.deliverableResults`.
		deliverableResults: items.filter((item) => !item.outsideFilter && isDeliverableType(item.typeName)),
		// Same source, same guard, the same reason — see `BacklogModel.iterations`.
		iterations: items.filter((item) => !item.outsideFilter && isIterationType(item.typeName)),
		// Same source, same guard, the same reason — see `BacklogModel.releases`.
		releases: items.filter((item) => !item.outsideFilter && isReleaseType(item.typeName)),
		// Read off the WHOLE, unfocused tree for the reason `deliverableResults` already
		// is, and the precedent matters more than the line: `buildModel`'s focus branch
		// replaces roots, items and results together, so a catalog computed after it would
		// show only the tests inside a focused `PBI` subtree — usually none — with a count
		// to match and every root-level drop refused. The catalog ignores the focus control
		// (its levels are the other ladder's), and a projection that opts out of a feature
		// opts out of the COMPUTATION, not just the button.
		catalog: projectionForest(roots, inCatalog, settings, true),
		ignoredCount,
		// Straight off the store: the divert happened before phase 1 produced an item, so
		// no later phase has ever seen one and none of them can have changed it.
		absences: store.absences,
		resources,
		resourceLabels,
	};
	// The plan is a projection too, and its forest is computed by the same rule the
	// catalog's is — a work item somebody dropped under a test is drawn in the plan, as a
	// root. Under a focus the two compose: focus decides where the tree is re-rooted, and
	// this decides which of those rows the plan actually draws.
	const focused = focusIdx >= 0 || focusExtra !== '';
	const focusRoots = focused ? collectFocusRoots(roots, focusIdx, focusExtra, settings) : roots;
	const plan = projectionForest(focusRoots, inPlan, settings, false);
	// `rest` LAST, and the order is load-bearing: both objects carry the same `observed*`
	// lists, and the plan's must be the whole-tree-minus-catalog ones in `rest` rather than
	// the forest's own. A forest's vocabulary is collected from what it RENDERS, which a
	// focus level narrows — right for the catalog, which is never focused, and wrong for
	// the plan, where it would make what a Set state or Set horizon menu can reach depend
	// on which subtree happens to be focused.
	return { ...plan, ...rest, focused };
}

/**
 * The board population for ONE iteration: every item that names it, plus the excluded
 * ancestors those items need to be placed at all.
 *
 * **Candidates are not population, and the distinction is the whole function.** An
 * in-scope carrier hanging from an excluded ancestor needs that ancestor drawn or it has
 * nowhere to sit, so the list carries both — while the CARRIERS alone are counted, are
 * writable, and supply anything derived. Nothing here has to enforce that second half:
 * an ancestor arrives `outsideFilter`, which is the question every count, every rollup
 * and every write gate in this codebase already asks.
 *
 * A function rather than a `BacklogModel` field, unlike `deliverableResults` beside it,
 * because the iteration is a runtime PICK: one model serves whichever scope the toolbar
 * is on, and a field would have to be rebuilt on a choice that changes nothing about the
 * vault.
 *
 * Read off `realRoots` — the whole, unfocused tree — for `deliverableResults`' reason: a
 * focus level set on another projection must not narrow a board scoped to a fortnight.
 *
 * Four refusals decide a CARRIER, and each is its own rule:
 *
 * - **Nothing is inherited down the tree.** Committing a parent to a sprint does not
 *   commit its subtree, so a child with no link of its own is not on the board.
 * - **No catalog member.** `inCatalog` answers first and unconditionally — no needle
 *   makes a `Test case` a row of the plan, and a link is a needle like any other.
 * - **No marker**, asked of `isMarkerType` and never of `isIterationType`. A marker
 *   occupies no rung, holds nothing and hangs from nothing — it is not work, and a board
 *   scoped to a commitment to finish some work draws work. Written as the one name, a
 *   hand-written link on a `Milestone` cards it as a sprint item; written as the
 *   predicate, a third marker inherits the rule rather than reopening the hole.
 * - **No context row.** This one follows from none of the others and was the refusal
 *   this function's plan did not state: `iterationEntry` is read on EVERY item,
 *   `outsideFilter` rows included — unlike `declaredEdges`, which skips them, because an
 *   excluded note may be NAMED by a result and may never do the naming. So an excluded
 *   note holding the link is a candidate on the strength of its own frontmatter, and a
 *   list filtered by the link alone would card it, count it and take a drop on it. It
 *   renders, it parents, and that is all.
 *
 * A `Deliverable` is included, with no type filter at all — not the product board's
 * `!isDeliverableType` and not its mirror. A sprint is a commitment to finish some work,
 * and a concept or a design is part of what it commits to.
 *
 * The membership question is asked INSIDE the walk. Scoping the output instead would let
 * a match in ANOTHER iteration keep an ancestor on this board and swallow its "nothing
 * matches" advisory.
 */
export function iterationResults(model: BacklogModel, path: string): BacklogItem[] {
	const carries = (item: BacklogItem): boolean => !item.outsideFilter && inIteration(item, path);
	const drawn: BacklogItem[] = [];
	const walk = (items: BacklogItem[]): void => {
		for (const item of items) {
			const mark = drawn.length;
			if (carries(item)) drawn.push(item);
			walk(item.children);
			// An excluded ancestor joins only once something below it has — inserted at the
			// mark so the list reads top-down, the order a board places cards in.
			if (item.outsideFilter && drawn.length > mark) drawn.splice(mark, 0, item);
		}
	};
	walk(model.realRoots);
	return drawn;
}

/**
 * Whether this item is a row of the PLAN — everything the backlog holds, minus the test
 * catalog, minus the iterations and, since 2026-08-24, minus the releases.
 *
 * **The two refusals are one rule read twice: a marker with a dedicated view of its own is
 * not a row of the plan.** An `Iteration` is the container a board is scoped to rather than
 * work the backlog holds — nothing hangs from it, nothing rolls up into it, and a reader
 * scanning the tree for what is left to do is not looking for a fortnight. A `Release` is
 * the same shape one increment later: the release view is where one is made, listed and
 * read, so a release row in the backlog is a second place saying what one screen already
 * says. A `Milestone` stays, and the difference is not tidiness — a milestone has no view
 * of its own, it is a date the plan answers to, and it reads as a row among the work it
 * dates.
 *
 * **Stated once because the forest and the hiding must agree.** `projectionForest`
 * PROMOTES a member whose parent is not one, and `rowHidden` drops a non-member; asked
 * differently, a `PBI` somebody parented to an iteration was hidden along with its parent
 * and appeared nowhere at all — `renderForest` drops a hidden sibling without descending
 * through it, which is the failure `projectionForest`'s own comment exists to name.
 *
 * **A release is refused HERE — membership — and never by cutting the edge in `linkAll`**,
 * and the difference is the whole reason this clause sits in this function rather than
 * anywhere upstream. The edge is what `assignAll` walks: its rollup traverses THROUGH a row
 * it does not count, so an item unlinked from its excluded parent is stranded from the
 * counts, which is why rooting markers there was refused. Refusing membership leaves the
 * edge alone and makes `projectionForest` promote the child instead: no release row, and
 * the work under it keeps its place as a root of the drawn forest. `loadOutsideParents` is
 * not type-gated either, so a work item that hand-links a release pulls it in as context —
 * and that context row goes the same way, which is `Releases as their own type` 4a.
 *
 * **This is the place, and `projectionMember` (`view/projection.ts`) is not.** Hiding a
 * release there instead was tried and measured: `renderForest` (`view/render/reconcile.ts`)
 * computes `hasChildren` from a row's non-hidden children and recurses INSIDE the branch
 * that drew the row, so a `Feature -> Release -> PBI` chain lost the `PBI` entirely — the
 * forest promoted nothing, because the forest was still built from a predicate that held
 * the release. The roadmap's own `onThisRoadmap` narrowing does not transfer for the same
 * reason in reverse: the roadmap renders no nested forest, so dropping a row there drops a
 * row. That is the agreement rule above, failing in exactly the direction it names.
 *
 * **So a release is drawn by no projection of the backlog view — the boards included.**
 * That is wider than the tree the change set out to clear, and it is the ruled end state
 * rather than a side effect: `byProjectionType` now offers the type nowhere, the way it
 * already offered `Iteration` nowhere. The release view is unaffected either way, because
 * it reads `model.releases` and `byPath` rather than this forest's results
 * (`domain/releases.ts`, `scannableRows`).
 */
export function inPlan(item: { ladder: string[]; typeName: string | null; outsideFilter?: boolean }): boolean {
	if (isReleaseType(item.typeName)) return false;
	return !inCatalog(item) && !isIterationType(item.typeName);
}

/**
 * Whether this item is IN that iteration — the membership rule itself, stated once
 * because it is asked from two directions and the two drifted the moment they were
 * spelled separately.
 *
 * `iterationResults` asks it to choose CARDS. `projectionMember` (`view/projection.ts`)
 * asks it to decide what this board draws at all — a carrier's own child list, the quick
 * filter's index, a drop target. With the marker refusal in the first and not the second,
 * a note retyped to `Milestone` kept its link and its parent: refused a card, and still
 * listed on its parent's card face and still able to keep that parent on screen through a
 * filter match. Found by review (Codex, PR #154), which is the second time this exact
 * shape has been reported on this feature.
 *
 * The three refusals are the population's, minus `outsideFilter` — a context row is
 * placement rather than membership, and each caller answers that its own way.
 */
export function inIteration(item: BacklogItem, path: string): boolean {
	return !isMarkerType(item.typeName) && inPlan(item) && item.iterationEntry?.file?.path === path;
}

/**
 * Resolve declared prerequisites into edges, once the item set is final.
 *
 * Runs after `assignAll` — and therefore after the scope prune — so an entry resolves
 * against the notes the model KEEPS. The two fields it fills are the last to land on a
 * `BacklogItem`, which is why they are assigned here rather than promoted: nothing about
 * an item's place in the tree depends on them, so no earlier phase can be waiting.
 *
 * Nothing else about any item changes. The tree's shape is identical with the property
 * configured and without it, which is the invariant the tests state from the rule.
 */
function assignDependencies(items: BacklogItem[]): void {
	const resolved = resolveDependencies(items.map(dependencyNode));
	for (const item of items) {
		const result = resolved.get(item.file.path);
		item.prerequisites = (result?.prerequisites ?? []).map((node) => node.item);
		item.brokenPrerequisites = result?.broken ?? [];
	}
}

/** The item as `dependencies.ts` needs it, carrying itself back for the result. */
function dependencyNode(item: BacklogItem): DependencyNode & { item: BacklogItem } {
	return {
		path: item.file.path,
		outsideFilter: item.outsideFilter,
		dependsOnEntries: item.dependsOnEntries,
		item,
	};
}

// ------------------------------------------------------------- build phases

interface LinkedTree {
	all: LinkedItem[];
	byPath: Map<string, LinkedItem>;
	roots: LinkedItem[];
}

interface BacklogTree {
	all: BacklogItem[];
	byPath: Map<string, BacklogItem>;
	roots: BacklogItem[];
}

/**
 * Phase 2. Attach children to parents; anything unresolvable becomes a root.
 *
 * The promotion is an assertion followed immediately by the loop that makes it true.
 * That is the price of an object graph with cycles in it — an item's parent points
 * back at the item — which cannot be rebuilt phase by phase without rebuilding every
 * reference to every item, so the fields are added to the objects that already exist.
 * The cost is paid exactly twice in this file, here and in `assignAll`, and both times
 * the very next statement assigns every field the new type claims.
 */
function linkAll(store: RawStore, settings: BacklogSettings): LinkedTree {
	const all = store.all as LinkedItem[];
	for (const item of all) {
		item.parent = null;
		item.children = [];
		item.orphan = false;
	}
	const byPath = store.byPath as Map<string, LinkedItem>;

	const roots: LinkedItem[] = [];
	for (const item of all) {
		let parent = item.parentPath ? byPath.get(item.parentPath) : undefined;
		// Folder mode: notes without an explicit parent link attach to the nearest
		// ancestor folder note, unless an empty parent key pins them to the top.
		if (!parent && settings.folderHierarchy && !item.hasParentValue && !item.explicitRoot) {
			parent = inferFolderParent(item, byPath) ?? undefined;
		}
		if (parent && parent !== item) {
			item.parent = parent;
			parent.children.push(item);
		} else {
			item.orphan = item.hasParentValue;
			roots.push(item);
		}
	}
	return { all, byPath, roots };
}

/** Any item not reachable from a root is part of a parent cycle — re-root it. */
function breakCycles({ all, roots }: LinkedTree): void {
	const visited = new Set<LinkedItem>();
	const markSubtree = (start: LinkedItem) => {
		const stack = [start];
		while (stack.length > 0) {
			const cur = stack.pop() as LinkedItem;
			if (visited.has(cur)) continue;
			visited.add(cur);
			for (const child of cur.children) stack.push(child);
		}
	};
	for (const root of roots) markSubtree(root);
	for (const unreachable of all) {
		if (visited.has(unreachable)) continue;
		// Cut the link that actually closes the loop, not whatever hangs below it:
		// an item is unreachable as soon as any ancestor is in a cycle, and
		// re-rooting the item itself would strand a healthy parent link.
		const item = cycleEntry(unreachable);
		if (item.parent) {
			const siblings = item.parent.children;
			const idx = siblings.indexOf(item);
			if (idx >= 0) siblings.splice(idx, 1);
			item.parent = null;
		}
		item.orphan = true;
		roots.push(item);
		markSubtree(item);
	}
}

/**
 * Drop the notes that are not backlog items. A base scoped with `file.inFolder(...)`
 * returns everything living there — meeting notes, references, a README — and without
 * this they would render as untyped top-level items and be typed by the backfill.
 *
 * A note belongs to the backlog when it declares a *supported* type (one of the
 * configured levels) or has a parent, explicit or folder-inferred, resolvable or not.
 * The test runs per root subtree, not per note: one participant keeps the whole
 * component, so untyped children of a typed item stay, and so does an untyped (or
 * custom-typed) container that holds typed ones.
 *
 * The tree is pruned in place — `all`, `roots` and `byPath` all lose the dropped notes,
 * so what survives here is exactly what the next phase promotes. Returns how many were
 * dropped, for the toolbar's advisory.
 */
function pruneOutsideHierarchy(tree: LinkedTree, settings: BacklogSettings): number {
	const { byPath, roots } = tree;
	// Every DECLARED type, not just the ladder: an extra type is a work item by the same
	// argument a level is, and counting only levels drops a parentless Bug out of the
	// model entirely — the note vanishing from the view moments after being typed.
	const supported = new Set(ALL_TYPES.map((t) => t.toLowerCase()));
	const belongs = (item: LinkedItem): boolean =>
		item.parent !== null ||
		item.hasParentValue ||
		item.explicitRoot ||
		// The anchor may be a folder note the filter excluded and the options chose
		// not to load; the note is still part of the hierarchy either way.
		item.parentExists ||
		(item.typeName !== null && supported.has(item.typeName.toLowerCase()));
	const subtreeBelongs = (item: LinkedItem): boolean => belongs(item) || item.children.some(subtreeBelongs);

	const dropped = new Set<LinkedItem>();
	for (let i = roots.length - 1; i >= 0; i--) {
		const root = roots[i];
		if (subtreeBelongs(root)) continue;
		roots.splice(i, 1);
		const stack = [root];
		while (stack.length > 0) {
			const cur = stack.pop() as LinkedItem;
			dropped.add(cur);
			byPath.delete(cur.file.path);
			for (const child of cur.children) stack.push(child);
		}
	}
	if (dropped.size > 0) tree.all = tree.all.filter((item) => !dropped.has(item));
	return dropped.size;
}

/** Walking up from an unreachable item always ends on the cycle that stranded it. */
function cycleEntry(start: LinkedItem): LinkedItem {
	const seen = new Set<LinkedItem>();
	let cur = start;
	while (cur.parent && !seen.has(cur)) {
		seen.add(cur);
		cur = cur.parent;
	}
	return cur;
}

/**
 * Sort siblings by order; items without an order sort last, in the sequence the
 * Bases query delivered them — which honors the sort the user configured in the
 * Bases toolbar (file name by default).
 */
function sortSiblingsDeep(list: LinkedItem[]): void {
	list.sort(compareSiblings);
	for (const item of list) sortSiblingsDeep(item.children);
}

function compareSiblings(a: RawItem, b: RawItem): number {
	const ao = a.order ?? Number.POSITIVE_INFINITY;
	const bo = b.order ?? Number.POSITIVE_INFINITY;
	if (ao !== bo) return ao < bo ? -1 : 1;
	return a.entryIndex - b.entryIndex;
}

/**
 * Phase 3. Assign visual depth, semantic level and rollup counts over the full tree,
 * promoting every item as it is reached. The walk covers the whole tree — `breakCycles`
 * guarantees every item is reachable from a root, and pruning removes whole root
 * subtrees — so nothing is left behind holding the earlier type.
 *
 * The second and last promotion; see `linkAll` for why an assertion is the price of a
 * cyclic graph. Each item's fields are assigned before the walk moves on, and the
 * counts come back as return values rather than being read off the children, so a
 * rollup cannot accidentally read a field the recursion has not filled in yet.
 */
function assignAll(tree: LinkedTree, settings: BacklogSettings): BacklogTree & { items: BacklogItem[] } {
	const promoted = tree as BacklogTree;
	const items: BacklogItem[] = [];
	const assign = (linked: LinkedItem, depth: number): Rollup => {
		const item = linked as BacklogItem;
		item.depth = depth;
		computeLevel(item, settings);
		item.focusRoot = false;
		items.push(item);
		let count = 0;
		let done = 0;
		let start: CivilDate | null = null;
		let target: CivilDate | null = null;
		for (const child of item.children) {
			const sub = assign(child, depth + 1);
			// A LADDER CROSSING is the third exception here and a STRONGER one than the two
			// below: nothing from it and nothing from beneath it. A context row and a marker
			// each contribute nothing themselves while their subtrees still reach their
			// ancestors — a result under an excluded parent is still this base's work — but a
			// `Task` under a `Test case` is test work by the membership rule, so this walk
			// takes nothing from below a test either.
			//
			// **Asked of the PARENT as well as the child, and the two are not symmetric.**
			// Written as `inCatalog(child)` alone it only stopped the PLAN counting a test,
			// and the mirror ran on: a `PBI` mis-dragged under a `Test case` is HIDDEN by the
			// catalog and promoted to a plan root, so the case drew a rollup for a descendant
			// nothing in that projection can expand to. The fix is NOT
			// `inCatalog(child) !== inCatalog(item)`, which is the shape that reads right and
			// would hand the catalog the rollups 3c declined — a suite counting its cases,
			// since parent and child agree. A rollup is a PLAN number: it counts only where
			// both ends are plan rows.
			//
			// Stated at the walk rather than in the projections because the counts are
			// gathered while the tree is BUILT: a predicate applied at draw time would hide
			// the row and leave the number it had already moved, which is the failure with no
			// evidence on screen. The subtree is still walked — every item needs its own
			// fields — and its rollup is discarded.
			//
			// The stated cost: a suite shows no "3 of 5 cases done". Accepted rather than
			// solved, since a second projection-specific pass is a real price for a number
			// this increment never promised — it records no results at all.
			if (inCatalog(child) || inCatalog(item)) continue;
			// Traverse *through* a context row to the results below it, but never count
			// it: rollups describe what the Base returned, and an excluded note's own
			// state must not skew a progress bar or keep a finished subtree on screen.
			//
			// A MARKER is the second exception, and it is stated here rather than at a
			// call site precisely so it holds for every quantity this walk gathers — the
			// counts, and the date evidence below. A marker is not work: it is neither a
			// unit of progress nor evidence of when work happens, so a release date filed
			// under an epic must not become that epic's inferred end. Its own subtree is
			// traversed exactly as a context row's is.
			const self = child.outsideFilter || isMarkerType(child.typeName) ? 0 : 1;
			count += self + sub.count;
			done += (child.done ? self : 0) + sub.done;
			// Dates gather under the same exclusion, for the same reason: an excluded
			// note's dates are not this base's plan, so they stretch nothing — while
			// the results beneath it still reach their ancestors. `FieldReading.value`
			// is null for an absent key AND for a value the reader refuses, so an
			// unparseable date is not evidence without a branch saying so.
			//
			// A REVERSED pair needs that branch: both ends parse, so both would fold
			// in, and a lone broken child would hand its ancestor crossed evidence
			// that `inferSpan` reads as two single-ended children bracketing the work
			// — one typo drawn as a confident span while the child itself sits on the
			// shelf naming the error. The pair is refused; the subtree below it is not.
			if (self === 1 && !reversedSpan(child.plannedStart.value, child.plannedTarget.value)) {
				start = earliest(start, child.plannedStart.value);
				target = latest(target, child.plannedTarget.value);
			}
			start = earliest(start, sub.start);
			target = latest(target, sub.target);
		}
		item.descendantCount = count;
		item.doneDescendants = done;
		item.subtreeDone = item.done && done === count;
		item.descendantStart = start;
		item.descendantTarget = target;
		return { count, done, start, target };
	};
	for (const root of promoted.roots) assign(root, 0);
	return { ...promoted, items };
}

/** What a subtree contributes to its parent's counts and to its span. */
interface Rollup {
	count: number;
	done: number;
	start: CivilDate | null;
	target: CivilDate | null;
}

/**
 * What a projection roots at: **every item it draws whose parent it does not draw**.
 *
 * A projection cannot be a filter over the rendered rows. `renderForest` drops a hidden
 * sibling *without descending through it*, so an excluded parent takes its whole subtree
 * off the screen with it — which is why a `Test case` mis-dragged under a `PBI` needs
 * this to be a computation rather than a `filter`, and why the plan needs the same
 * computation for the work item somebody dropped under a test. One function asked twice
 * with opposite predicates, so the two directions cannot be argued separately and reach
 * different answers.
 *
 * A promoted root — one this projection draws whose real parent it does not — is marked
 * `focusRoot`, which is not "like" a focus root but the same category: *a root of the
 * rendered forest that is not a root of the model*. The four call sites that already ask
 * it (`siblingContext`, `outdentTarget`, `handleExpandCollapseKey`, the drop-target
 * lookup) then refuse to rank, reparent or navigate it against neighbours that are not
 * on screen, without one of them being edited.
 *
 * Depth is RE-DERIVED here rather than inherited, for the reason focus already had to do
 * it: a test promoted from under a nested `PBI` would otherwise draw three levels
 * indented with `aria-level="4"` and nothing above it — a lie to the eye and a worse one
 * to a screen reader.
 */
function projectionForest(
	roots: BacklogItem[],
	member: (item: BacklogItem) => boolean,
	settings: BacklogSettings,
	catalog: boolean,
): ProjectionPopulation {
	const forest: BacklogItem[] = [];
	const collect = (list: BacklogItem[], parentDrawn: boolean) => {
		for (const item of list) {
			const drawn = member(item);
			if (drawn && !parentDrawn) {
				// Only ever SET, never cleared, so this composes with `collectFocusRoots`
				// rather than undoing it: a focused plan runs both, and a focus root that
				// happens to be a real root of the model is still a focus root.
				if (item.parent !== null) item.focusRoot = true;
				forest.push(item);
			}
			// Descend whether or not this item is drawn: a member can sit below a
			// non-member at any depth, and stopping here is exactly the filter-shaped
			// mistake this function exists instead of.
			collect(item.children, drawn);
		}
	};
	collect(roots, false);
	// The depth walk descends through MEMBERS ONLY, and that is what makes running this
	// twice safe: both projections walk the same objects, so a walk that followed every
	// child would have the plan's descent reach a promoted `Test case` through its `PBI`
	// parent and stamp depth 3 on the row the catalog had just placed at 0. Nothing is
	// lost by stopping: a non-member's own member descendants are roots of this forest in
	// their own right, collected above. This replaced a shared `assignVisualDepth` focus
	// used, which had no predicate to stop at and could not be given one without becoming
	// this function.
	const items: BacklogItem[] = [];
	const assign = (item: BacklogItem, depth: number) => {
		item.depth = depth;
		items.push(item);
		for (const child of item.children) {
			if (member(child)) assign(child, depth + 1);
		}
	};
	for (const root of forest) assign(root, 0);
	return {
		roots: forest,
		items,
		results: items.filter((item) => !item.outsideFilter),
		...vocabularyOf(items, settings, catalog),
	};
}

/**
 * The four vocabularies a population carries, collected together because they are always
 * asked together: *a vocabulary is scoped to the population of the projection that offers
 * it*, stated once rather than four times at four call sites.
 *
 * The horizons are the one list that is ORDERED rather than sorted, so all four are
 * taken from the FINISHED tree rather than the load order: the roadmap mints a bucket per
 * new value as it walks its rows, which are these items filtered, so reading them in the
 * same sequence is what keeps the menu from naming the buckets in an order the axis then
 * contradicts.
 */
function vocabularyOf(
	items: BacklogItem[],
	settings: BacklogSettings,
	catalog: boolean,
): Pick<ProjectionPopulation, 'observedStates' | 'observedHorizons' | 'observedTags' | 'observedAssignees'> {
	return {
		// WHICH workflow, asked of the population rather than of each item: a population is
		// homogeneous by membership, and the done list a state menu sorts by is the
		// population's while the value read is the item's. Supplied by all three callers —
		// `projectionForest`'s two call sites and the plan's own `vocabularyOf` call in
		// `rest` — which are the three places that already know which projection they are
		// computing.
		observedStates: catalog ? collectObservedTestStates(items, settings) : collectObservedStates(items, settings),
		observedHorizons: collectObservedHorizons(items),
		observedTags: collectObservedTags(items),
		observedAssignees: collectObservedAssignees(items),
	};
}

/** The topmost items whose level matches the focus level; nested matches stay children. */
function collectFocusRoots(
	roots: BacklogItem[],
	focusIdx: number,
	focusExtra: string,
	settings: BacklogSettings,
): BacklogItem[] {
	const focusRoots: BacklogItem[] = [];
	// An extra type has no levelIndex but does occupy a rung, so focusing that RUNG has
	// to show it — otherwise a Bug simply vanishes from a focused view rather than
	// ranking beside the level it sits level with. Focusing the type by NAME shows only
	// that type.
	const extraFocused = focusIdx >= 0 && EXTRA_TYPE_RANK === focusIdx;
	const matches = (item: BacklogItem): boolean => {
		// Focus is the PLAN's control. Its levels are the plan ladder's, and a catalog
		// item's `levelIndex` indexes the OTHER ladder — a `Task` under a `Test case` is
		// rung 2 there, which a `PBI` focus would otherwise match and promote into the
		// plan. Skipped here rather than repaired downstream, because the honest statement
		// is that this control does not describe the catalog at all.
		if (inCatalog(item)) return false;
		if (focusExtra) return item.typeName?.toLowerCase() === focusExtra;
		return item.levelIndex === focusIdx || (extraFocused && isExtraType(item.typeName));
	};
	const collect = (list: BacklogItem[]) => {
		for (const item of list) {
			if (matches(item)) {
				item.focusRoot = true;
				focusRoots.push(item);
			} else {
				collect(item.children);
			}
		}
	};
	collect(roots);
	return focusRoots;
}

function computeLevel(item: BacklogItem, settings: BacklogSettings): void {
	// The parent is processed first (pre-order), so both its ladder and its effective
	// level are resolved — which is what lets `ladderFor` chain rather than re-walk.
	item.ladder = ladderFor(item.typeName, item.parent?.ladder ?? null);
	const childSlot = childLevelIndex(item.parent, item.ladder);
	if (item.typeName !== null) {
		const name = item.typeName.toLowerCase();
		const idx = item.ladder.findIndex((l) => l.toLowerCase() === name);
		item.levelIndex = idx;
		// A declared extra type holds the deepest level wherever it hangs, so its rung is
		// its own rather than one below its parent's — that pinning is what separates a
		// Bug (Tasks under it, under an Epic or a PBI alike) from an unknown custom type,
		// which occupies the slot below its parent so its children continue the ladder
		// correctly (Feature > Bugfix > implied Task).
		const offLadder = isExtraType(item.typeName) ? EXTRA_TYPE_RANK : childSlot;
		item.effectiveLevelIndex = idx >= 0 ? idx : offLadder;
		item.impliedType = false;
	} else {
		item.levelIndex = childSlot;
		item.effectiveLevelIndex = childSlot;
		item.impliedType = true;
	}
}
