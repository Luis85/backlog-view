import { BasesViewConfig } from 'obsidian';
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
	| 'assignee'
	| 'deliverableState';

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
	| 'assigneeKey'
	| 'deliverableStateKey';

/**
 * One such property: the option that names it, the key it adopts when nothing does,
 * and what it is called out loud. One table, four readers — the view options draw
 * their picker from it, `configProblems` reports collisions by its labels,
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
	/** What the property is called wherever a collision or an adoption is reported. */
	label: string;
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
	state: { option: 'stateProperty', suggested: 'status', label: 'state', settingsKey: 'stateKey' },
	startedDate: { option: 'startedDateProperty', suggested: 'started', label: 'started date', settingsKey: 'startedDateKey' },
	finishedDate: { option: 'finishedDateProperty', suggested: 'finished', label: 'finished date', settingsKey: 'finishedDateKey' },
	// The roadmap's three, whose suggestions follow the ecosystem's own vocabulary
	// (the Tasks plugin's `start` and `due`) without assuming it.
	horizon: { option: 'horizonProperty', suggested: 'horizon', label: 'horizon', settingsKey: 'horizonKey' },
	start: { option: 'startProperty', suggested: 'start', label: 'start', settingsKey: 'startKey' },
	target: { option: 'targetProperty', suggested: 'due', label: 'target', settingsKey: 'targetKey' },
	risk: { option: 'riskProperty', suggested: 'risk', label: 'risk', settingsKey: 'riskKey' },
	assignee: { option: 'assigneeProperty', suggested: 'assignee', label: 'assignee', settingsKey: 'assigneeKey' },
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
		label: 'deliverable state',
		settingsKey: 'deliverableStateKey',
	},
	// Prerequisites, suggested by the name the Tasks plugin already uses for the same
	// idea — offered as a placeholder, never matched by name.
	dependsOn: { option: 'dependsOnProperty', suggested: 'dependsOn', label: 'depends on', settingsKey: 'dependsOnKey' },
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

/** The property id a frontmatter key is named by in the view options. */
export function notePropertyId(key: string): string {
	return `note.${key}`;
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
	const adoptable: OptionalProperty[] = [];
	for (const property of OPTIONAL_PROPERTIES) {
		if (config.get(property.option) !== undefined || taken.has(property.suggested)) continue;
		// Two suggestions cannot collide today, and this is what keeps that a property
		// of the code rather than of the table's current contents.
		taken.add(property.suggested);
		adoptable.push(property);
	}
	return only === undefined ? adoptable : adoptable.filter((property) => property.field === only);
}

/**
 * Every frontmatter key this view owns, labelled, in the order a collision names
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
export function ownedProperties(settings: BacklogSettings): { label: string; key: string }[] {
	return [
		{ label: 'parent', key: settings.parentKey },
		{ label: 'order', key: settings.orderKey },
		{ label: 'type', key: settings.typeKey },
		...OPTIONAL_PROPERTIES.map((property) => ({
			label: property.label,
			key: optionalKeyFor(settings, property.field),
		})),
		{ label: 'tags', key: settings.tagsKey },
	];
}
