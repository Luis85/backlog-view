import { BasesPropertyId, BasesViewConfig } from 'obsidian';
import { BacklogSettings } from './settings';

/**
 * The one vocabulary of write targets beyond `parent`/`order`/`type`, and everything
 * that reads it as a table rather than as a field.
 *
 * Its own module because it is the half of the configuration that GROWS. `settings.ts`
 * says what a resolved configuration is; this says which optional properties exist, what
 * each is called, which key it suggests and which field it lands in — five readers deep,
 * and one row longer every time the plugin learns to write somewhere new. Keeping the two
 * together is what put `settings.ts` against its 400-line budget with the assignee, where
 * a row in a table cost a file its headroom.
 *
 * It reads `BacklogSettings` and is never read BY it, which is what keeps the dependency
 * one-way: nothing in the shape needs to know the table exists.
 */

/**
 * Every write target this view has BEYOND the three the hierarchy always needs,
 * named by FIELD rather than by key. Each one gates a feature — no state property,
 * no board; no horizon property, no bucket axis — and each is unset until something
 * names it, which is the difference between these and `parent`/`order`/`type`.
 *
 * Every layer that has to ask "which property does this live in" asks here, so the
 * mapping from a field to a configured key is stated once: the planner, the writer,
 * the model's presence test and the backfill would otherwise each spell out the same
 * switch.
 */
export type OptionalField =
	| 'state'
	| 'startedDate'
	| 'finishedDate'
	| 'horizon'
	| 'start'
	| 'target'
	| 'dependsOn'
	| 'risk'
	| 'priority'
	| 'assignee'
	| 'deliverableState'
	| 'testState'
	| 'iteration'
	| 'iterationGoal'
	| 'release';

/**
 * The `BacklogSettings` field one optional property's key lands in. Spelled as a union
 * rather than `keyof BacklogSettings` so the table below can only name a string-valued
 * key: `keyof` would let a boolean option through and `optionalKeyFor` would return one.
 */
export type OptionalSettingsKey =
	| 'stateKey'
	| 'startedDateKey'
	| 'finishedDateKey'
	| 'horizonKey'
	| 'startKey'
	| 'targetKey'
	| 'dependsOnKey'
	| 'riskKey'
	| 'priorityKey'
	| 'assigneeKey'
	| 'deliverableStateKey'
	| 'testStateKey'
	| 'iterationKey'
	| 'iterationGoalKey'
	| 'releaseKey';

/**
 * One such property: the option that names it, the key it adopts when nothing does,
 * and where its configured key lands. What it is CALLED is not here and has not been
 * since the options menu moved into the catalog: a collision names it through
 * `property.<field>`, so the word is the catalog's and the field is the id.
 *
 * One table, four readers — the view options draw
 * their picker from it, `configProblems` reports collisions by its fields,
 * `adoptableProperties` binds its suggestions, and the backfill creates its keys —
 * because a key or an option id spelled twice is one that can differ, and both of
 * these are persisted user data.
 */
export interface OptionalProperty {
	field: OptionalField;
	/** The persisted view-option key that names this property. */
	option: string;
	/** The frontmatter key this view suggests, and adopts when the option is untouched. */
	suggested: string;
	/** The `BacklogSettings` field this property's configured key is resolved into. */
	settingsKey: OptionalSettingsKey;
}

/**
 * The table, keyed by field so the COMPILER checks it is complete: a field added to
 * the union above and forgotten here fails to build, rather than reaching a lookup
 * that finds nothing. Declaration order is the order everything reads them in — the
 * pickers, the collision report's wording, the backfill's stubs — because these are
 * plain string keys, whose insertion order `Object.keys` preserves by definition.
 */
const PROPERTY_TABLE: Record<OptionalField, Omit<OptionalProperty, 'field'>> = {
	state: { option: 'stateProperty', suggested: 'status', settingsKey: 'stateKey' },
	startedDate: { option: 'startedDateProperty', suggested: 'started', settingsKey: 'startedDateKey' },
	finishedDate: { option: 'finishedDateProperty', suggested: 'finished', settingsKey: 'finishedDateKey' },
	// The roadmap's three, whose suggestions follow the ecosystem's own vocabulary
	// (the Tasks plugin's `start` and `due`) without assuming it.
	horizon: { option: 'horizonProperty', suggested: 'horizon', settingsKey: 'horizonKey' },
	start: { option: 'startProperty', suggested: 'start', settingsKey: 'startKey' },
	target: { option: 'targetProperty', suggested: 'due', settingsKey: 'targetKey' },
	risk: { option: 'riskProperty', suggested: 'risk', settingsKey: 'riskKey' },
	// The second label property with a declared ladder, risk's row exactly. Its suggestion
	// is the plain word rather than `moscow`: what the option holds is an ordered
	// vocabulary, and MoSCoW is only the one this view ships prefilled.
	priority: { option: 'priorityProperty', suggested: 'priority', settingsKey: 'priorityKey' },
	assignee: { option: 'assigneeProperty', suggested: 'assignee', settingsKey: 'assigneeKey' },
	deliverableState: {
		option: 'deliverableStateProperty',
		// Same suggestion as `state` itself: Deliverables sharing the requirements
		// workflow's own property is a legitimate, explicitly requested configuration
		// (see `configProblems`' exemption in `settingsConsistency.ts` and
		// `resolvedDeliverableStateKey`'s fallback), so the setup action should reach for
		// the one key both workflows
		// already agree to share rather than inventing a second, disused property.
		// `adoptableProperties`'s own "don't suggest an already-taken key" guard is
		// what actually delivers that: `state` is declared first and claims `status`
		// first, so a first-run setup leaves THIS key unbound and the Deliverable
		// workflow falls back to `stateKey` — sharing the property through the
		// fallback this codebase already trusts, never by writing the same explicit
		// key to both options in one pass.
		suggested: 'status',
		settingsKey: 'deliverableStateKey',
	},
	testState: {
		option: 'testStateProperty',
		// Same suggestion as `state` and `deliverableState`, and the same mechanism delivers
		// the same outcome: `adoptableProperties` refuses a suggestion another property has
		// claimed, `state` is declared first and takes `status`, so a first-run setup leaves
		// THIS key unbound and `resolvedTestStateKey` falls back to `stateKey`. Tests read
		// `status` by sharing the plan's property, never by a second option written to point
		// at it — which is what "test items rely on status by default" actually means here.
		suggested: 'status',
		settingsKey: 'testStateKey',
	},
	// Prerequisites, suggested by the name the Tasks plugin already uses for the same
	// idea — offered as a placeholder, never matched by name.
	dependsOn: { option: 'dependsOnProperty', suggested: 'dependsOn', settingsKey: 'dependsOnKey' },
	// The link an item carries to say which time box it is in. Suggested by the name the
	// concept has, and — like every other row here — offered as a placeholder rather than
	// matched: nothing reads a property because of what it is called.
	iteration: { option: 'iterationProperty', suggested: 'iteration', settingsKey: 'iterationKey' },
	// What an iteration is FOR, in one line. A plain string on the Iteration note — never a
	// link, so unlike `iteration` it is a row in the label list (`applyLabels`) rather than
	// a write of its own, and unlike every other row here it is never backfilled: see the
	// `iterationGoal` return in `neverStubbed` (`writePlan.ts`).
	iterationGoal: { option: 'iterationGoalProperty', suggested: 'goal', settingsKey: 'iterationGoalKey' },
	// The link an item carries to say which release it ships in — the iteration row's
	// shape exactly, for the same reason: a placeholder, never matched by name.
	release: { option: 'releaseProperty', suggested: 'release', settingsKey: 'releaseKey' },
};

/** The declaration for one field, for the callers that hold a field rather than a row. */
export function optionalProperty(field: OptionalField): OptionalProperty {
	return { field, ...PROPERTY_TABLE[field] };
}

export const OPTIONAL_FIELDS: OptionalField[] = Object.keys(PROPERTY_TABLE) as OptionalField[];
export const OPTIONAL_PROPERTIES: OptionalProperty[] = OPTIONAL_FIELDS.map(optionalProperty);

/**
 * The roadmap's three write targets — the subset of the above that the placement
 * plans and `AxisWrite` deal in. A narrower type, not a second vocabulary: it reads
 * its keys through `optionalKeyFor` like everything else.
 */
export type AxisField = 'horizon' | 'start' | 'target';
export const AXIS_FIELDS: AxisField[] = ['horizon', 'start', 'target'];

/**
 * The frontmatter key one optional field is stored under; '' when it is unconfigured.
 * Read off `PROPERTY_TABLE`, so the field → key mapping is stated exactly once: a
 * switch beside the table was a second statement of it, and the compiler only ever
 * checked one of them for completeness.
 */
export function optionalKeyFor(settings: BacklogSettings, field: OptionalField): string {
	return settings[PROPERTY_TABLE[field].settingsKey];
}

/**
 * The Deliverable workflow's own state key, or the requirements workflow's shared one
 * when the Deliverable one is unset — "Deliverables don't need their own dedicated
 * status property; they can use the same one". This is the single statement of that
 * fallback: every reader and writer of the Deliverable workflow's state — the model's
 * own read (`model.ts`), the write path (`storage/frontmatter.ts`), the row menu's
 * routing and the board's "no workflow" guidance — calls this rather than
 * `settings.deliverableStateKey` directly, so a card that looks movable on screen
 * cannot resolve to a key nothing actually writes.
 *
 * Deliberately NOT folded into `optionalKeyFor`: `configProblems` (via
 * `ownedProperties`) and `adoptableProperties` read `deliverableStateKey` RAW through
 * that function, because sharing a key by FALLBACK is intended while sharing one by
 * explicit configuration is the collision they already report. Applying this fallback
 * inside `optionalKeyFor` would make every fallback-configured board collide with the
 * very workflow it is deliberately reusing — the `''` a cleared/unset key resolves to
 * there is what lets `ownedProperties` skip it.
 */

export function resolvedDeliverableStateKey(settings: BacklogSettings): string {
	return settings.deliverableStateKey || settings.stateKey;
}

/**
 * The key a TEST's state is read and written through: its own when named, else the
 * requirements key it shares by default. The identical fallback `resolvedDeliverableStateKey`
 * states for the other secondary workflow, and stated separately rather than through a
 * `resolvedSecondaryKey(settings, 'test')` because a dozen call sites read these by name and
 * a parameterised one would make every one of them worse.
 */
export function resolvedTestStateKey(settings: BacklogSettings): string {
	return settings.testStateKey || settings.stateKey;
}

/** The property id a frontmatter key is named by in the view options. */
export function notePropertyId(key: string): string {
	return `note.${key}`;
}

/** A property picker's filter, admitting only note-backed properties — the inverse of
 *  `notePropertyId` above, and shared for the same reason: the backlog's own
 *  `viewOptions.ts` and the estimation view's `estimationOptions.ts` both declared this
 *  identical one-line predicate independently. */
export const notePropsOnly = (prop: BasesPropertyId): boolean => prop.startsWith('note.');

/**
 * The generic shape of one adoptable suggestion — the option that has to be untouched,
 * and the key it offers when it is.
 */
export interface AdoptionCandidate {
	option: string;
	suggested: string;
}

/**
 * Adopt every candidate in `candidates` whose option `config` has never touched — "never
 * set" asked of the CONFIG, never of a resolved settings shape, which cannot tell cleared
 * from untouched apart — and whose suggested key `taken` does not already hold, mutating
 * `taken` as it goes so a later candidate in the SAME list sees an earlier one's pick.
 *
 * Shared by this view's own `adoptableProperties` below and the estimation view's
 * `runEstimationInit` (`view/estimation/init.ts`), which apply the identical rule over two
 * different candidate lists and two different starting "already taken" sets — the two were
 * a hand-rolled copy of this loop each until 2026-08-17.
 *
 * Two suggestions cannot collide within either of today's lists, so the `taken.add` below
 * never actually fires within one call — and that is what keeps it a property of the two
 * TABLES' current contents rather than of this function, the moment either grows a row
 * whose suggested key repeats an earlier one.
 */
export function adoptCandidates<T extends AdoptionCandidate>(
	config: BasesViewConfig,
	candidates: readonly T[],
	taken: Set<string>,
): T[] {
	const adopted: T[] = [];
	for (const candidate of candidates) {
		if (config.get(candidate.option) !== undefined || taken.has(candidate.suggested)) continue;
		adopted.push(candidate);
		taken.add(candidate.suggested);
	}
	return adopted;
}

/**
 * The optional properties this view can set up for itself: the suggested key for
 * every option **nobody has ever touched**. Cleared is not untouched — turning the
 * state property off is a decision, and an action that quietly turned it back on
 * would be overruling the user rather than helping them — so this asks the same
 * "never set" question `clearable` asks, of the config rather than of the resolved
 * settings, which cannot tell the two apart.
 *
 * A suggestion whose key is already spoken for is skipped rather than adopted: it
 * would report as a collision in `configProblems` and block every write in the view,
 * which is a worse state than the unconfigured feature it was meant to enable.
 *
 * `only` narrows the answer to one field, for a feature that binds its own key the first
 * time it is used rather than waiting for ✨ ([[Bind a property by using it]]). It filters
 * the finished list rather than skipping the loop early, and that is the whole subtlety:
 * whether a field may adopt depends on what the fields DECLARED BEFORE IT have claimed, so
 * a loop that skipped them would report a suggestion free that the full pass takes.
 */
export function adoptableProperties(
	config: BasesViewConfig,
	settings: BacklogSettings,
	only?: OptionalField,
): OptionalProperty[] {
	const taken = new Set(ownedProperties(settings).map((owned) => owned.key));
	taken.delete('');
	const adoptable = adoptCandidates(config, OPTIONAL_PROPERTIES, taken);
	return only === undefined ? adoptable : adoptable.filter((property) => property.field === only);
}

/**
 * A property this view owns, named by ROLE: the three the hierarchy always needs, the
 * tags key, and every optional property by its own field. It is an id and never a word —
 * `property.<role>` is what a collision report renders it through, and
 * `WORKFLOW_STATE_LABELS` is what matches on it, so no locale can move a property in or
 * out of the pair that may legitimately share a key.
 */
export type OwnedRole = 'parent' | 'order' | 'type' | 'tags' | OptionalField;

/**
 * Every frontmatter key this view owns, by role, in the order a collision names
 * them. One statement, because two readers depend on it and they must agree: the
 * collision report in `settingsConsistency.ts`, and the adoption above, which may not
 * suggest a key that is already spoken for.
 *
 * The hierarchy's three come first because they are the ones always configured. The
 * optional properties follow in their declared order — a stamp must never overwrite
 * a key the plugin already owns (a date written over someone's parent link is not a
 * thing to recover from by noticing later), and the roadmap's axis keys carry one
 * rule more: start and target sharing a key cannot store a span, and a horizon
 * sharing either is two semantics on one field.
 *
 * `tagsKey` is last and is the one that yields: it cannot collide with the four core
 * properties by the time anything reads it, because `resolveSettings` turns such a
 * tags key off rather than reporting it — that would block every write in a view
 * that was working before the option existed. It does NOT yield to the newer
 * options, which have no working views to protect, so pointing one of those at the
 * tags key is a fresh mistake and gets the collision report every other pair gets.
 */
export function ownedProperties(settings: BacklogSettings): { role: OwnedRole; key: string }[] {
	return [
		{ role: 'parent', key: settings.parentKey },
		{ role: 'order', key: settings.orderKey },
		{ role: 'type', key: settings.typeKey },
		...OPTIONAL_PROPERTIES.map((property) => ({
			role: property.field,
			key: optionalKeyFor(settings, property.field),
		})),
		{ role: 'tags', key: settings.tagsKey },
	];
}
