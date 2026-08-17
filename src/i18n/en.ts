/**
 * The English catalog — the source, the fallback, and in this round the only one that
 * ships (`docs/requirements/English ships alone.md`).
 *
 * **Data, not code.** No imports, no logic, no computed keys: a translator copies this
 * file and replaces the values without reading the plugin. Everything that reads it is
 * in `t.ts`.
 *
 * Two rules for whoever edits it:
 *
 * - **A key is named for the surface and the meaning, never for the English words.**
 *   Rename a key when the meaning changes, not when the wording does — a catalog keyed
 *   on its own text has to be re-keyed by every locale on every copy edit.
 * - **Two keys holding identical English text is expected, and must not be
 *   deduplicated.** They diverge in the first language that separates them.
 *
 * A `{name}` in a message is a parameter, and the set of them is what `t()` demands of
 * its caller. An entry with plural forms carries `{count}`; the form is chosen by
 * `Intl.PluralRules` for THIS catalog's locale, so a catalog supplies only the
 * categories its own language has — English has `one` and `other`.
 *
 * What is NOT here, and must never be: anything the plugin writes, matches or
 * persists. Type names, state values, view-option keys, tags, file names. Those are
 * data, and a locale that changed them would write notes another locale cannot read.
 */
export const en = {
	/** A bare count of items, standing alone as a label. */
	'count.items': { one: '{count} item', other: '{count} items' },
	/** The same count, once a filter has made it a pair — the whole is the point. */
	'count.shownOfTotal': '{shown} of {total}',
	'count.cards': { one: '{count} card', other: '{count} cards' },
	'count.cardsMatching': '{count} of {total} cards match',
	'count.children': { one: '{count} child', other: '{count} children' },
	/**
	 * A count of children that all share a type. The type is user data and arrives as a
	 * parameter; the trailing `s` pluralizes a word this catalog did not write, which is
	 * the known ceiling `childrenLabel` has always carried and `Type names are data`
	 * owns.
	 */
	'count.childrenOfType': { one: '{count} {type}', other: '{count} {type}s' },

	'toolbar.ignoredNotes': { one: '{count} note ignored', other: '{count} notes ignored' },
	'toolbar.ignoredTooltip': {
		one: '{count} note in this base is not backlog items — no supported type and no parent. Turn off "Ignore notes outside the hierarchy" in the view options to show them.',
		other:
			'{count} notes in this base are not backlog items — no supported type and no parent. Turn off "Ignore notes outside the hierarchy" in the view options to show them.',
	},

	'emptyState.ignored': {
		one: '{count} note in this base has no supported type and no parent, so it is not treated as backlog items. Create your first {topLevel}, or turn off "Ignore notes outside the hierarchy" in the view options to organize the existing notes.',
		other:
			'{count} notes in this base have no supported type and no parent, so they are not treated as backlog items. Create your first {topLevel}, or turn off "Ignore notes outside the hierarchy" in the view options to organize the existing notes.',
	},
	'emptyState.allDone': {
		one: 'All {count} item is done and hidden.',
		other: 'All {count} items are done and hidden.',
	},

	/** A named group on the roadmap — a horizon bucket, or the shelf — with its count. */
	'roadmap.groupLabel': { one: '{name}, {count} item', other: '{name}, {count} items' },
	'roadmap.groupLabelCollapsed': {
		one: '{name}, collapsed, {count} item',
		other: '{name}, collapsed, {count} items',
	},
	'lane.absenceClash': {
		one: 'Crosses an absence, {cost}: {spans}',
		other: 'Crosses {count} absences, {cost}: {spans}',
	},
	/** The {cost} above, when the stretch takes part of the bar — and when it takes it whole. */
	'lane.daysLost': { one: '{count} day lost to absence', other: '{count} days lost to absence' },
	'lane.daysLostWhole': { one: 'all {count} day lost', other: 'all {count} days lost' },

	'card.hiddenChildren': {
		one: '{count} more is hidden by the current view',
		other: '{count} more are hidden by the current view',
	},
	'row.searchMatches': {
		one: '{count} search match below',
		other: '{count} search matches below',
	},

	'undo.conflicts': {
		one: '{count} value was edited since and kept',
		other: '{count} values were edited since and kept',
	},
	'undo.missing': {
		one: '{count} note no longer exists',
		other: '{count} notes no longer exist',
	},
	'init.updatedItems': { one: 'updated {count} item', other: 'updated {count} items' },

	'settings.sharedKey': 'The {properties} properties share the key "{key}".',

	/** The write gate's own failure notice — every view's batch runs through it, so the
	 * message names neither "backlog items" nor any other one view's own vocabulary. */
	'writeGate.applyFailed': 'Failed to apply the change. See the developer console for details.',

	/** The estimation view's own states — loading, unconfigured, misconfigured, and its
	 * own empty result set. */
	'estimation.loading': 'Loading estimation view…',
	'estimation.empty.unconfigured': 'No estimation model is configured for this view.',
	'estimation.empty.hint':
		'Bind the suggested properties and stub them onto the results, or name your own in the view options.',
	'estimation.empty.useDefaults': 'Use recommended defaults',
	'estimation.problems.lead': 'Fix the estimation model first:',
	/** The guided setup action refusing itself: the bindings it would make leave the model
	 *  broken, so nothing is bound and nothing is written. {problem} is the first one. */
	'estimation.problems.blocked': 'Fix the estimation model first: {problem}',
	'estimation.empty.noResults': 'No results to estimate.',

	/** The prioritized list's column labels — also each sort button's own accessible
	 * name, so no separate string names the control. */
	'estimation.column.item': 'Item',
	'estimation.column.value': 'Value',
	'estimation.column.coverage': 'Coverage',
	'estimation.column.confidence': 'Confidence',
	'estimation.column.effort': 'Effort',
	'estimation.column.currency': 'Currency',

	/** The currency chip's word for what a stored total says about itself — never the
	 * rubric or a property name, which are data and never enter this catalog. */
	'estimation.currency.current': 'Current',
	'estimation.currency.stale': 'Needs re-estimation',
	'estimation.currency.foreign': 'Another model',
	'estimation.currency.handwritten': 'Hand-written',
	'estimation.currency.orphan': 'Inputs gone',
	'estimation.currency.none': '—',

	/** The per-item panel: one row per dimension and per bound scale, the two grouped
	 * scales' own heading, the clamp note, and the two labelled derived lines. Rubric
	 * sentences and dimension labels are never here — they are the MODEL's own data
	 * (`docs/requirements/A rubric for every point.md`), reaching the DOM straight from
	 * the saved model rather than through this catalog. */
	'estimation.panel.confidence': 'Confidence',
	'estimation.panel.effort': 'Effort',
	'estimation.panel.complexity': 'Complexity',
	'estimation.panel.effortComplexity': 'Effort and complexity',
	/** A dimension or scale's stored answer fell outside its own declared range. */
	'estimation.clamped': 'Out of range — read as {value}',
	/** In range, so counted as it stands, but not one of the points the rubric describes. */
	'estimation.betweenPoints': 'Between points — counted as {value}',
	/** The per-row clear control's accessible name — {label} is the dimension's or
	 * scale's own (data) label, threaded through rather than joined by this string. */
	'estimation.panel.clear': 'Clear {label}',
	'estimation.panel.term': '{label} {score} × {weight}%',
	'estimation.panel.adjustedValue': 'Confidence-adjusted value: {value}',
	'estimation.panel.valueToEffort': 'Value to effort: {value}',
	'estimation.panel.removeOrphan': 'Remove the orphaned total',
} as const;
